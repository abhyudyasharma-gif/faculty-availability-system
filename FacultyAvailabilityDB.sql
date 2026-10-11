
-- ============================================
-- FACULTY AVAILABILITY SYSTEM
-- Complete MySQL Database Script
-- ============================================

DROP DATABASE IF EXISTS FacultyAvailabilityDB;
CREATE DATABASE FacultyAvailabilityDB;
USE FacultyAvailabilityDB;


-- 1. FACULTY TABLE

CREATE TABLE Faculty (
    faculty_id INT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    department VARCHAR(50) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    office_no VARCHAR(20)
);


-- 2. STUDENT TABLE

CREATE TABLE Student (
    student_id INT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    department VARCHAR(50) NOT NULL,
    semester INT
);


-- 3. COURSE TABLE

CREATE TABLE Course (
    course_id INT PRIMARY KEY,
    course_name VARCHAR(100) NOT NULL,
    credits INT
);


-- 4. TIMETABLE TABLE

CREATE TABLE Timetable (
    timetable_id INT PRIMARY KEY,
    day VARCHAR(15) NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    room_no VARCHAR(20),
    faculty_id INT NOT NULL,
    course_id INT NOT NULL,
    FOREIGN KEY (faculty_id) REFERENCES Faculty(faculty_id),
    FOREIGN KEY (course_id) REFERENCES Course(course_id)
);


-- 5. SUBSTITUTION TABLE

CREATE TABLE Substitution (
    substitution_id INT PRIMARY KEY,
    date DATE NOT NULL,
    reason VARCHAR(255),
    original_faculty_id INT NOT NULL,
    substitute_faculty_id INT NOT NULL,
    timetable_id INT NOT NULL,
    FOREIGN KEY (original_faculty_id) REFERENCES Faculty(faculty_id),
    FOREIGN KEY (substitute_faculty_id) REFERENCES Faculty(faculty_id),
    FOREIGN KEY (timetable_id) REFERENCES Timetable(timetable_id)
);


-- ============================================
-- INSERT FACULTY DATA
-- ============================================

INSERT INTO Faculty VALUES
(101, 'Amit Sharma', 'CSE', 'amit.sharma@college.com', 'CSE-101'),
(102, 'Neha Verma', 'CSE', 'neha.verma@college.com', 'CSE-102'),
(103, 'Raj Malhotra', 'ECE', 'raj.malhotra@college.com', 'ECE-201'),
(104, 'Priya Singh', 'CSE', 'priya.singh@college.com', 'CSE-103'),
(105, 'Rahul Kumar', 'ECE', 'rahul.kumar@college.com', 'ECE-202');


-- ============================================
-- INSERT STUDENT DATA
-- ============================================

INSERT INTO Student VALUES
(1, 'Student1', 'student1@college.com', 'CSE', 3),
(2, 'Student2', 'student2@college.com', 'CSE', 3),
(3, 'Student3', 'student3@college.com', 'ECE', 3),
(4, 'Student4', 'student4@college.com', 'CSE', 4),
(5, 'Student5', 'student5@college.com', 'ECE', 4),
(6, 'Student6', 'student6@college.com', 'CSE', 3);


-- ============================================
-- INSERT COURSE DATA
-- ============================================

INSERT INTO Course VALUES
(201, 'Data Structures and Algorithms', 4),
(202, 'Database Management System', 4),
(203, 'Computer Organization', 4),
(204, 'Probability and Statistics', 4),
(205, 'Business Management', 3),
(206, 'Computer Networks', 4);


-- ============================================
-- INSERT TIMETABLE DATA
-- ============================================

INSERT INTO Timetable VALUES
(301, 'Monday', '09:00:00', '10:00:00', 'A-101', 101, 201),
(302, 'Monday', '10:00:00', '11:00:00', 'A-102', 102, 202),
(303, 'Monday', '12:00:00', '13:00:00', 'A-103', 104, 203),
(304, 'Tuesday', '09:00:00', '10:00:00', 'A-104', 103, 204),
(305, 'Tuesday', '11:00:00', '12:00:00', 'A-105', 101, 202),
(306, 'Wednesday', '10:00:00', '11:00:00', 'A-106', 102, 201),
(307, 'Wednesday', '14:00:00', '15:00:00', 'A-107', 104, 205),
(308, 'Thursday', '09:00:00', '10:00:00', 'A-108', 103, 206),
(309, 'Thursday', '11:00:00', '12:00:00', 'A-109', 105, 204),
(310, 'Friday', '10:00:00', '11:00:00', 'A-110', 101, 203),
(311, 'Friday', '12:00:00', '13:00:00', 'A-111', 102, 202);


-- ============================================
-- INSERT SUBSTITUTION DATA
-- ============================================

INSERT INTO Substitution VALUES
(401, '2026-10-10', 'Medical Leave', 101, 102, 301),
(402, '2026-10-11', 'Official Duty', 102, 104, 302),
(403, '2026-10-12', 'Personal Reason', 104, 101, 303),
(404, '2026-10-13', 'Emergency Leave', 103, 105, 304);


-- ============================================
-- QUERY 1: COMPLETE FACULTY TIMETABLE
-- ============================================

SELECT
    f.faculty_id,
    f.name AS faculty_name,
    f.department,
    c.course_name,
    c.credits,
    t.day,
    t.start_time,
    t.end_time,
    t.room_no
FROM Faculty f
JOIN Timetable t ON f.faculty_id = t.faculty_id
JOIN Course c ON t.course_id = c.course_id
ORDER BY f.faculty_id, t.day, t.start_time;


-- ============================================
-- QUERY 2: FACULTY AVAILABILITY
-- ============================================

SELECT
    f.faculty_id,
    f.name AS faculty_name,
    f.department,
    t.day,
    t.start_time,
    t.end_time,
    c.course_name,
    t.room_no,
    CASE
        WHEN DAYNAME(CURDATE()) = t.day
             AND CURTIME() >= t.start_time
             AND CURTIME() < t.end_time
            THEN 'Teaching'
        WHEN DAYNAME(CURDATE()) = t.day
             AND CURTIME() < t.start_time
            THEN 'Available Before Class'
        WHEN DAYNAME(CURDATE()) = t.day
             AND CURTIME() >= t.end_time
            THEN 'Available After Class'
        ELSE 'Not Scheduled Today'
    END AS availability_status
FROM Faculty f
JOIN Timetable t ON f.faculty_id = t.faculty_id
JOIN Course c ON t.course_id = c.course_id
ORDER BY f.faculty_id, t.start_time;


-- ============================================
-- QUERY 3: CURRENT STATUS OF EACH FACULTY
-- ============================================

SELECT
    f.faculty_id,
    f.name AS faculty_name,
    CASE
        WHEN EXISTS (
            SELECT 1
            FROM Timetable t
            WHERE t.faculty_id = f.faculty_id
              AND t.day = DAYNAME(CURDATE())
              AND CURTIME() >= t.start_time
              AND CURTIME() < t.end_time
        )
        THEN 'Teaching Now'
        WHEN EXISTS (
            SELECT 1
            FROM Timetable t
            WHERE t.faculty_id = f.faculty_id
              AND t.day = DAYNAME(CURDATE())
        )
        THEN 'Free / Scheduled Later'
        ELSE 'Free Today'
    END AS current_status,
    CURDATE() AS current_date,
    CURTIME() AS current_time
FROM Faculty f;


-- ============================================
-- QUERY 4: FACULTY WITH COURSE AND TIME
-- ============================================

SELECT
    f.name AS faculty_name,
    c.course_name,
    t.day,
    TIME_FORMAT(t.start_time, '%h:%i %p') AS start_time,
    TIME_FORMAT(t.end_time, '%h:%i %p') AS end_time,
    t.room_no
FROM Faculty f
JOIN Timetable t ON f.faculty_id = t.faculty_id
JOIN Course c ON t.course_id = c.course_id
ORDER BY t.day, t.start_time;


-- ============================================
-- QUERY 5: CSE FACULTY
-- ============================================

SELECT *
FROM Faculty
WHERE department = 'CSE';


-- ============================================
-- QUERY 6: ECE FACULTY
-- ============================================

SELECT *
FROM Faculty
WHERE department = 'ECE';


-- ============================================
-- QUERY 7: STUDENTS BY DEPARTMENT
-- ============================================

SELECT department, COUNT(*) AS total_students
FROM Student
GROUP BY department;


-- ============================================
-- QUERY 8: FACULTY COUNT BY DEPARTMENT
-- ============================================

SELECT department, COUNT(*) AS total_faculty
FROM Faculty
GROUP BY department;


-- ============================================
-- QUERY 9: COURSES WITH 4 OR MORE CREDITS
-- ============================================

SELECT *
FROM Course
WHERE credits >= 4
ORDER BY credits DESC;


-- ============================================
-- QUERY 10: CLASSES HANDLED BY EACH FACULTY
-- ============================================

SELECT
    f.faculty_id,
    f.name AS faculty_name,
    COUNT(t.timetable_id) AS total_classes
FROM Faculty f
LEFT JOIN Timetable t ON f.faculty_id = t.faculty_id
GROUP BY f.faculty_id, f.name
ORDER BY total_classes DESC;


-- ============================================
-- QUERY 11: SUBSTITUTION DETAILS
-- ============================================

SELECT
    s.substitution_id,
    s.date,
    s.reason,
    f1.name AS original_faculty,
    f2.name AS substitute_faculty,
    c.course_name,
    t.day,
    t.start_time,
    t.end_time,
    t.room_no
FROM Substitution s
JOIN Faculty f1 ON s.original_faculty_id = f1.faculty_id
JOIN Faculty f2 ON s.substitute_faculty_id = f2.faculty_id
JOIN Timetable t ON s.timetable_id = t.timetable_id
JOIN Course c ON t.course_id = c.course_id
ORDER BY s.date;


-- ============================================
-- QUERY 12: UPCOMING SUBSTITUTIONS
-- ============================================

SELECT
    s.substitution_id,
    s.date,
    s.reason,
    f1.name AS original_faculty,
    f2.name AS substitute_faculty
FROM Substitution s
JOIN Faculty f1 ON s.original_faculty_id = f1.faculty_id
JOIN Faculty f2 ON s.substitute_faculty_id = f2.faculty_id
WHERE s.date >= CURDATE()
ORDER BY s.date;


-- ============================================
-- QUERY 13: AVAILABLE FACULTY FOR A GIVEN TIME
-- Change the day and time below as required.
-- ============================================

SET @check_day = 'Monday';
SET @check_time = '10:30:00';

SELECT
    f.faculty_id,
    f.name AS faculty_name,
    f.department,
    CASE
        WHEN EXISTS (
            SELECT 1
            FROM Timetable t
            WHERE t.faculty_id = f.faculty_id
              AND t.day = @check_day
              AND @check_time >= t.start_time
              AND @check_time < t.end_time
        )
        THEN 'Busy'
        ELSE 'Available'
    END AS status
FROM Faculty f
ORDER BY f.faculty_id;


-- ============================================
-- QUERY 14: FACULTY SCHEDULE FOR MONDAY
-- ============================================

SELECT
    f.name AS faculty_name,
    c.course_name,
    t.start_time,
    t.end_time,
    t.room_no
FROM Faculty f
JOIN Timetable t ON f.faculty_id = t.faculty_id
JOIN Course c ON t.course_id = c.course_id
WHERE t.day = 'Monday'
ORDER BY t.start_time;


-- ============================================
-- QUERY 15: STUDENTS FROM CSE
-- ============================================

SELECT
    student_id,
    name,
    email,
    department,
    semester
FROM Student
WHERE department = 'CSE'
ORDER BY semester, name;


-- ============================================
-- QUERY 16: FACULTY AND STUDENT DEPARTMENT MATCH
-- ============================================

SELECT
    s.name AS student_name,
    s.department,
    f.name AS faculty_name
FROM Student s
JOIN Faculty f ON s.department = f.department
ORDER BY s.department, s.name;


-- ============================================
-- QUERY 17: FACULTY EMAIL SEARCH
-- ============================================

SELECT *
FROM Faculty
WHERE email LIKE '%@college.com';


-- ============================================
-- QUERY 18: UPDATE FACULTY OFFICE NUMBER
-- ============================================

UPDATE Faculty
SET office_no = 'CSE-105'
WHERE faculty_id = 101;


-- ============================================
-- FINAL VERIFICATION: DISPLAY ALL TABLES
-- ============================================

SELECT * FROM Faculty;
SELECT * FROM Student;
SELECT * FROM Course;
SELECT * FROM Timetable;
SELECT * FROM Substitution;

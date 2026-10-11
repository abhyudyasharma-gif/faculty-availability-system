
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



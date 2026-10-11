
CREATE DATABASE IF NOT EXISTS 
FacultyAvailabilityDB;
USE FacultyAvailabilityDB;

CREATE TABLE IF NOT EXISTS Faculty (
    faculty_id INT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    department VARCHAR(50) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    office_no VARCHAR(20)
);

CREATE TABLE IF NOT EXISTS Student (
    student_id INT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    department VARCHAR(50) NOT NULL,
    semester INT
);

CREATE TABLE IF NOT EXISTS Course (
    course_id INT PRIMARY KEY,
    course_name VARCHAR(100) NOT NULL,
    credits INT
);

CREATE TABLE IF NOT EXISTS Timetable (
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

CREATE TABLE IF NOT EXISTS Substitution (
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

CREATE TABLE IF NOT EXISTS Faculty (
    faculty_id INT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    department VARCHAR(50) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    office_no VARCHAR(20)
);

CREATE TABLE IF NOT EXISTS Student (
    student_id INT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    department VARCHAR(50) NOT NULL,
    semester INT
);

CREATE TABLE IF NOT EXISTS Course (
    course_id INT PRIMARY KEY,
    course_name VARCHAR(100) NOT NULL,
    credits INT
);

CREATE TABLE IF NOT EXISTS Timetable (
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

CREATE TABLE IF NOT EXISTS Substitution (
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

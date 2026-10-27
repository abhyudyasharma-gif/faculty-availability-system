-- ============================================================================
-- FacultyFlow — database schema (MySQL 8.0+)
--
-- Entities follow the FacultyFlow ER diagram:
--   Faculty ──< Course ──< Timetable >── Room ──< RoomResource
--   Faculty ──< Timetable >── Section ──< Student
--   Faculty ──< Substitution >── Faculty        (original → substitute)
--   Timetable ──< Substitution
--
-- How to run (MySQL Workbench):
--   1. File → Open SQL Script… → backend/schema.sql
--   2. Click ⚡ Execute (Ctrl+Shift+Enter)
--   3. Refresh SCHEMAS — facultyflow_db now holds demo data for both semesters.
--
-- WARNING: the first statement drops and recreates facultyflow_db.
--          Comment it out if you need to keep existing data.
-- ============================================================================

DROP DATABASE IF EXISTS facultyflow_db;
CREATE DATABASE facultyflow_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE facultyflow_db;

-- ---------------------------------------------------------------- Faculty ---
-- One row per teaching staff member. `emp_no` is the natural key referenced by
-- courses, timetable slots and substitutions, and is the employee number the
-- frontend displays.
CREATE TABLE Faculty (
  emp_no        VARCHAR(20)  NOT NULL,
  name          VARCHAR(120) NOT NULL,
  department    VARCHAR(80)  NOT NULL,
  email         VARCHAR(120) NOT NULL,
  phone         VARCHAR(30),
  office        VARCHAR(40),
  designation   VARCHAR(60),
  max_hours     INT          NOT NULL DEFAULT 18,
  status        ENUM('Active','On leave','Inactive') NOT NULL DEFAULT 'Active',
  PRIMARY KEY (emp_no),
  UNIQUE KEY uq_faculty_email (email),
  CONSTRAINT ck_faculty_hours CHECK (max_hours BETWEEN 1 AND 40)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------- Section ---
-- A class group such as CSE-2B. Sections exist in their own right because both
-- the timetable and the student roster point at them.
CREATE TABLE Section (
  section_id    VARCHAR(20)  NOT NULL,
  department    VARCHAR(80)  NOT NULL,
  semester      VARCHAR(4)   NOT NULL,               -- odd: 1,3,5,7 · even: 2,4,6,8
  strength      INT          NOT NULL DEFAULT 60,
  PRIMARY KEY (section_id),
  CONSTRAINT ck_section_semester CHECK (semester BETWEEN 1 AND 8),
  CONSTRAINT ck_section_strength CHECK (strength BETWEEN 1 AND 300)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------- Student ---
CREATE TABLE Student (
  student_id    VARCHAR(20)  NOT NULL,
  name          VARCHAR(120) NOT NULL,
  email         VARCHAR(120) NOT NULL,
  department    VARCHAR(80)  NOT NULL,
  semester      VARCHAR(4)   NOT NULL,
  section       VARCHAR(20),
  PRIMARY KEY (student_id),
  UNIQUE KEY uq_student_email (email),
  KEY ix_student_section (section),
  CONSTRAINT fk_student_section FOREIGN KEY (section) REFERENCES Section (section_id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT ck_student_semester CHECK (semester BETWEEN 1 AND 8)
) ENGINE=InnoDB;

-- ----------------------------------------------------------------- Course ---
CREATE TABLE Course (
  course_id      VARCHAR(20)  NOT NULL,
  code           VARCHAR(20)  NOT NULL,              -- e.g. CS301
  course_name    VARCHAR(160) NOT NULL,
  department     VARCHAR(80)  NOT NULL,
  semester       VARCHAR(4)   NOT NULL,
  credits        INT          NOT NULL DEFAULT 3,
  weekly_hours   INT          NOT NULL DEFAULT 3,
  faculty_emp_no VARCHAR(20),                        -- faculty in charge
  PRIMARY KEY (course_id),
  UNIQUE KEY uq_course_code (code),
  KEY ix_course_faculty (faculty_emp_no),
  CONSTRAINT fk_course_faculty FOREIGN KEY (faculty_emp_no)
    REFERENCES Faculty (emp_no) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT ck_course_credits CHECK (credits BETWEEN 1 AND 8),
  CONSTRAINT ck_course_hours CHECK (weekly_hours BETWEEN 1 AND 10),
  CONSTRAINT ck_course_semester CHECK (semester BETWEEN 1 AND 8)
) ENGINE=InnoDB;

-- ------------------------------------------------------------------- Room ---
CREATE TABLE Room (
  room_id       VARCHAR(20)  NOT NULL,
  name          VARCHAR(40)  NOT NULL,
  building      VARCHAR(40)  NOT NULL,
  floor         VARCHAR(20),
  kind          ENUM('Lecture hall','Classroom','Laboratory') NOT NULL DEFAULT 'Lecture hall',
  capacity      INT          NOT NULL DEFAULT 40,
  PRIMARY KEY (room_id),
  UNIQUE KEY uq_room_name (name),
  CONSTRAINT ck_room_capacity CHECK (capacity BETWEEN 1 AND 500)
) ENGINE=InnoDB;

-- --------------------------------------------------------- Room resources ---
-- Multi-valued "facilities" attribute of Room (projector, 40 desktops, …).
CREATE TABLE RoomResource (
  room_id       VARCHAR(20)  NOT NULL,
  resource      VARCHAR(40)  NOT NULL,
  PRIMARY KEY (room_id, resource),
  CONSTRAINT fk_resource_room FOREIGN KEY (room_id) REFERENCES Room (room_id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

-- ------------------------------------------------------------- Timetable ---
-- One row = one weekly lecture slot for one section, in one semester.
-- The three UNIQUE keys are the database-level guard against:
--   * one faculty member teaching two sections in the same slot,
--   * one room hosting two lectures in the same slot,
--   * one section having two lectures in the same slot.
CREATE TABLE Timetable (
  timetable_id   VARCHAR(40)  NOT NULL,
  day            ENUM('Mon','Tue','Wed','Thu','Fri','Sat') NOT NULL,
  period         INT          NOT NULL,
  start_time     TIME         NOT NULL,
  end_time       TIME         NOT NULL,
  room_id        VARCHAR(20)  NOT NULL,
  faculty_emp_no VARCHAR(20)  NOT NULL,
  course_id      VARCHAR(20)  NOT NULL,
  section        VARCHAR(20)  NOT NULL,
  term           ENUM('odd','even') NOT NULL DEFAULT 'odd',
  PRIMARY KEY (timetable_id),
  UNIQUE KEY uq_tt_section_slot (term, section, day, period),
  UNIQUE KEY uq_tt_faculty_slot (term, faculty_emp_no, day, period),
  UNIQUE KEY uq_tt_room_slot    (term, room_id, day, period),
  KEY ix_tt_slot (term, section, day, period),
  KEY ix_tt_faculty (faculty_emp_no, term, day, period),
  KEY ix_tt_room (room_id, term, day, period),
  CONSTRAINT fk_tt_room FOREIGN KEY (room_id) REFERENCES Room (room_id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_tt_faculty FOREIGN KEY (faculty_emp_no) REFERENCES Faculty (emp_no)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_tt_course FOREIGN KEY (course_id) REFERENCES Course (course_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_tt_section FOREIGN KEY (section) REFERENCES Section (section_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT ck_tt_period CHECK (period BETWEEN 1 AND 8),
  CONSTRAINT ck_tt_time CHECK (end_time > start_time)
) ENGINE=InnoDB;

-- ---------------------------------------------------------- Substitution ---
-- Cover arranged for one dated lecture. Deleting the timetable entry removes its
-- substitutions; deleting a faculty member is blocked while they are teaching
-- (Timetable RESTRICT) and cascades their substitution records where allowed.
CREATE TABLE Substitution (
  substitution_id     VARCHAR(24) NOT NULL,
  sub_date            DATE        NOT NULL,
  reason              VARCHAR(255) NOT NULL,
  original_emp_no     VARCHAR(20) NOT NULL,
  substitute_emp_no   VARCHAR(20) NOT NULL,
  timetable_id        VARCHAR(40) NOT NULL,
  status              ENUM('Pending','Approved','Declined','Cancelled') NOT NULL DEFAULT 'Pending',
  applied_at          DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (substitution_id),
  KEY ix_sub_tt (timetable_id),
  KEY ix_sub_date (sub_date),
  KEY ix_sub_original (original_emp_no),
  KEY ix_substitute (substitute_emp_no),
  CONSTRAINT fk_sub_original FOREIGN KEY (original_emp_no) REFERENCES Faculty (emp_no)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_substitute FOREIGN KEY (substitute_emp_no) REFERENCES Faculty (emp_no)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_sub_timetable FOREIGN KEY (timetable_id) REFERENCES Timetable (timetable_id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

-- ============================================================================
-- Demo data — mirrors the frontend seed (src/data/seed.ts, terms.ts) so the UI
-- looks the same whether rows come from MySQL or from offline browser storage.
-- ============================================================================

INSERT INTO Faculty (emp_no, name, department, email, phone, office, designation, max_hours, status) VALUES
  ('CSE-1042','Dr. Anita Sharma','Computer Science','anita.sharma@kce.ac.in','+91 98765 40112','C-112','Associate Professor',16,'Active'),
  ('CSE-1057','Prof. Rajesh Iyer','Computer Science','rajesh.iyer@kce.ac.in','+91 98765 40318','C-208','Assistant Professor',18,'Active'),
  ('CSE-1019','Dr. Meera Nair','Computer Science','meera.nair@kce.ac.in','+91 98765 40221','C-105','Professor',14,'On leave'),
  ('IT-2033','Prof. Vikram Desai','Information Technology','vikram.desai@kce.ac.in','+91 98765 40554','B-206','Assistant Professor',18,'Active'),
  ('CSE-1078','Dr. Pooja Kulkarni','Computer Science','pooja.kulkarni@kce.ac.in','+91 98765 40765','C-210','Assistant Professor',16,'Active'),
  ('ECE-3011','Prof. Sanjay Patil','Electronics','sanjay.patil@kce.ac.in','+91 98765 40621','D-118','Assistant Professor',16,'Active'),
  ('IT-2045','Ms. Farah Khan','Information Technology','farah.khan@kce.ac.in','+91 98765 40812','B-202','Lecturer',20,'Active'),
  ('MECH-4007','Dr. Arun Menon','Mechanical','arun.menon@kce.ac.in','+91 98765 40903','E-102','Professor',12,'Active'),
  ('CSE-1083','Prof. Nandini Rao','Computer Science','nandini.rao@kce.ac.in','+91 98765 41024','C-214','Assistant Professor',18,'Active'),
  ('ECE-3026','Mr. Karthik Reddy','Electronics','karthik.reddy@kce.ac.in','+91 98765 41136','D-121','Lecturer',20,'Inactive'),
  ('IT-2051','Ms. Sneha Kamath','Information Technology','sneha.kamath@kce.ac.in','+91 98765 41247','B-209','Assistant Professor',18,'Active');

INSERT INTO Section (section_id, department, semester, strength) VALUES
  ('CSE-2A','Computer Science','3',60),
  ('CSE-2B','Computer Science','5',64),
  ('CSE-2C','Computer Science','3',58),
  ('CSE-3A','Computer Science','5',62),
  ('CSE-3B','Information Technology','6',56),
  ('IT-2A','Information Technology','4',60),
  ('IT-3A','Information Technology','5',52),
  ('ECE-3A','Electronics','5',54);

INSERT INTO Student (student_id, name, email, department, semester, section) VALUES
  ('24CSE042','Aarav Singhania','aarav.2024cse@kce.ac.in','Computer Science','6','CSE-2B'),
  ('24CSE067','Isha Nambiar','isha.2024cse@kce.ac.in','Computer Science','6','CSE-2B'),
  ('23IT015','Rohan Gowda','rohan.2023it@kce.ac.in','Information Technology','6','CSE-3B'),
  ('24IT019','Sanya Kapoor','sanya.2024it@kce.ac.in','Information Technology','4','IT-2A'),
  ('23ECE088','Devansh Pillai','devansh.2023ece@kce.ac.in','Electronics','6','ECE-3A');

INSERT INTO Course (course_id, code, course_name, department, semester, credits, weekly_hours, faculty_emp_no) VALUES
  ('c1','CS301','Database Management Systems','Computer Science','6',4,4,'CSE-1042'),
  ('c2','CS301P','DBMS Laboratory','Computer Science','6',2,2,'CSE-1042'),
  ('c3','CS302','Operating Systems','Computer Science','6',4,4,'CSE-1057'),
  ('c4','CS303','Computer Networks','Computer Science','6',3,3,'CSE-1078'),
  ('c5','CS304','Design & Analysis of Algorithms','Computer Science','6',4,4,'CSE-1083'),
  ('c6','CS305','Software Engineering','Computer Science','6',3,3,'CSE-1019'),
  ('c7','IT201','Data Structures with C','Information Technology','4',4,4,'IT-2033'),
  ('c8','IT202','Object Oriented Programming','Information Technology','4',3,3,'IT-2045'),
  ('c9','EC201','Digital Electronics','Electronics','4',4,4,'ECE-3011'),
  ('c10','ME204','Thermodynamics','Mechanical','4',4,4,'MECH-4007'),
  ('c11','HS102','Technical Communication','Humanities','4',2,2,'CSE-1019'),
  ('c12','IT301','Web Technologies','Information Technology','6',3,3,'IT-2051'),
  ('c13','CS306','Theory of Computation','Computer Science','6',3,3,'CSE-1083'),
  -- Even-semester curriculum
  ('e1','CS402','Advanced Database Systems','Computer Science','6',4,4,'CSE-1042'),
  ('e2','CS403','Distributed Computing','Computer Science','6',3,3,'CSE-1057'),
  ('e3','CS404','Artificial Intelligence','Computer Science','6',4,4,'CSE-1083'),
  ('e4','CS405','Cloud Computing','Computer Science','6',3,3,'CSE-1078'),
  ('e5','CS406P','AI & Data Laboratory','Computer Science','6',2,2,'CSE-1083'),
  ('e6','CS407','Information Security','Computer Science','6',3,3,'CSE-1019'),
  ('e7','IT204','Java Programming','Information Technology','4',4,4,'IT-2045'),
  ('e8','IT205','Computer Organization','Information Technology','4',3,3,'IT-2051'),
  ('e9','EC204','Signals & Systems','Electronics','4',4,4,'ECE-3011'),
  ('e10','ME206','Fluid Mechanics','Mechanical','4',4,4,'MECH-4007'),
  ('e11','HS204','Professional Ethics','Humanities','4',2,2,'IT-2033');

INSERT INTO Room (room_id, name, building, floor, kind, capacity) VALUES
  ('r1','B-204','B Block','2nd floor','Lecture hall',60),
  ('r2','B-206','B Block','2nd floor','Lecture hall',60),
  ('r3','B-101','B Block','1st floor','Lecture hall',72),
  ('r4','C-305','C Block','3rd floor','Classroom',48),
  ('r5','Lab-2','C Block','1st floor','Laboratory',45),
  ('r6','Lab-4','C Block','2nd floor','Laboratory',40),
  ('r7','D-112','D Block','1st floor','Classroom',56);

INSERT INTO RoomResource (room_id, resource) VALUES
  ('r1','Projector'), ('r1','Smart board'),
  ('r2','Projector'),
  ('r3','Projector'), ('r3','Audio system'),
  ('r4','Whiteboard'),
  ('r5','40 desktops'), ('r5','Projector'), ('r5','PostgreSQL'),
  ('r6','36 desktops'), ('r6','Linux image'),
  ('r7','Projector');

-- Weekly lecture slots. Section offers all odd-semester subjects (periods 1-7,
-- lunch break after period 4), while every faculty member teaches at most one
-- class per slot — the UNIQUE keys below are therefore satisfied by this data.
-- Every section opens with its own weekly schedule; the shared rooms and staff
-- create the cross-section conflict context the UI reports on.
INSERT INTO Timetable (timetable_id, day, period, start_time, end_time, room_id, faculty_emp_no, course_id, section, term) VALUES
  ('s1','Mon',1,'09:00:00','10:00:00','r1','CSE-1042','c1','CSE-2B','odd'),
  ('od-CSE-3A-Mon-1-0','Mon',1,'09:00:00','10:00:00','r4','CSE-1057','c3','CSE-3A','odd'),
  ('s26','Mon',1,'09:00:00','10:00:00','r2','IT-2033','c7','IT-2A','odd'),
  ('s32','Mon',2,'10:00:00','11:00:00','r4','CSE-1083','c13','CSE-2A','odd'),
  ('s2','Mon',2,'10:00:00','11:00:00','r1','CSE-1057','c3','CSE-2B','odd'),
  ('od-ECE-3A-Mon-2-0','Mon',2,'10:00:00','11:00:00','r7','ECE-3011','c9','ECE-3A','odd'),
  ('s27','Mon',2,'10:00:00','11:00:00','r2','IT-2045','c8','IT-2A','odd'),
  ('od-IT-3A-Mon-2-0','Mon',2,'10:00:00','11:00:00','r6','IT-2051','c12','IT-3A','odd'),
  ('s33','Mon',3,'11:15:00','12:15:00','r4','CSE-1057','c3','CSE-2A','odd'),
  ('s3','Mon',3,'11:15:00','12:15:00','r1','CSE-1078','c4','CSE-2B','odd'),
  ('od-CSE-3A-Mon-3-1','Mon',3,'11:15:00','12:15:00','r3','CSE-1042','c1','CSE-3A','odd'),
  ('od-IT-3A-Mon-4-1','Mon',3,'11:15:00','12:15:00','r2','IT-2033','c7','IT-3A','odd'),
  ('s4','Mon',4,'12:15:00','13:15:00','r1','CSE-1083','c5','CSE-2B','odd'),
  ('od-CSE-2C-Mon-4-1','Mon',4,'12:15:00','13:15:00','r3','CSE-1019','c6','CSE-2C','odd'),
  ('od-ECE-3A-Mon-4-1','Mon',4,'12:15:00','13:15:00','r7','ECE-3011','c9','ECE-3A','odd'),
  ('s34','Mon',5,'14:00:00','15:00:00','r4','CSE-1078','c4','CSE-2A','odd'),
  ('s5','Mon',5,'14:00:00','15:00:00','r5','CSE-1042','c2','CSE-2B','odd'),
  ('od-CSE-3A-Mon-5-2','Mon',5,'14:00:00','15:00:00','r6','IT-2051','c12','CSE-3A','odd'),
  ('s6','Mon',6,'15:00:00','16:00:00','r5','CSE-1042','c2','CSE-2B','odd'),
  ('s35','Tue',1,'09:00:00','10:00:00','r4','CSE-1083','c13','CSE-2A','odd'),
  ('s7','Tue',1,'09:00:00','10:00:00','r1','CSE-1057','c3','CSE-2B','odd'),
  ('od-CSE-2C-Tue-1-0','Tue',1,'09:00:00','10:00:00','r3','CSE-1042','c1','CSE-2C','odd'),
  ('od-IT-3A-Tue-1-0','Tue',1,'09:00:00','10:00:00','r2','IT-2045','c8','IT-3A','odd'),
  ('s8','Tue',2,'10:00:00','11:00:00','r1','CSE-1019','c6','CSE-2B','odd'),
  ('od-CSE-3A-Tue-2-0','Tue',2,'10:00:00','11:00:00','r4','CSE-1078','c4','CSE-3A','odd'),
  ('od-ECE-3A-Tue-3-0','Tue',3,'11:15:00','12:15:00','r4','IT-2033','c1','ECE-3A','odd'),
  ('s28','Tue',2,'10:00:00','11:00:00','r7','ECE-3011','c9','ECE-3A','odd'),
  ('s9','Tue',3,'11:15:00','12:15:00','r1','CSE-1042','c1','CSE-2B','odd'),
  ('od-IT-3A-Tue-3-1','Tue',3,'11:15:00','12:15:00','r6','IT-2051','c12','IT-3A','odd'),
  ('s37','Tue',4,'12:15:00','13:15:00','r5','CSE-1042','c2','CSE-2A','odd'),
  ('od-CSE-3A-Tue-4-1','Tue',4,'12:15:00','13:15:00','r4','CSE-1083','c13','CSE-3A','odd'),
  ('s10','Tue',5,'14:00:00','15:00:00','r1','CSE-1078','c4','CSE-2B','odd'),
  ('od-ECE-3A-Tue-5-1','Tue',5,'14:00:00','15:00:00','r7','CSE-1019','c11','ECE-3A','odd'),
  ('s11','Tue',6,'15:00:00','16:00:00','r1','CSE-1019','c6','CSE-2B','odd'),
  ('od-CSE-2C-Tue-5-1','Tue',6,'15:00:00','16:00:00','r3','CSE-1078','c4','CSE-2C','odd'),
  ('s36','Tue',7,'16:15:00','17:15:00','r4','CSE-1042','c1','CSE-2A','odd'),
  ('s12','Wed',1,'09:00:00','10:00:00','r1','CSE-1083','c5','CSE-2B','odd'),
  ('s29','Wed',1,'09:00:00','10:00:00','r4','MECH-4007','c10','CSE-3A','odd'),
  ('od-ECE-3A-Wed-1-0','Wed',1,'09:00:00','10:00:00','r3','IT-2045','c9','ECE-3A','odd'),
  ('s38','Wed',2,'10:00:00','11:00:00','r4','CSE-1057','c3','CSE-2A','odd'),
  ('s13','Wed',2,'10:00:00','11:00:00','r1','CSE-1042','c1','CSE-2B','odd'),
  ('od-CSE-2C-Mon-2-0','Wed',2,'10:00:00','11:00:00','r3','CSE-1083','c5','CSE-2C','odd'),
  ('od-IT-3A-Wed-2-0','Wed',2,'10:00:00','11:00:00','r2','IT-2033','c7','IT-3A','odd'),
  ('s14','Wed',3,'11:15:00','12:15:00','r1','CSE-1057','c3','CSE-2B','odd'),
  ('od-CSE-2C-Wed-3-0','Wed',3,'11:15:00','12:15:00','r3','CSE-1083','c13','CSE-2C','odd'),
  ('od-CSE-3A-Wed-3-1','Wed',3,'11:15:00','12:15:00','r5','CSE-1042','c2','CSE-3A','odd'),
  ('s15','Wed',4,'12:15:00','13:15:00','r1','CSE-1078','c4','CSE-2B','odd'),
  ('od-CSE-3A-Wed-4-1','Wed',4,'09:00:00','10:00:00','r4','CSE-1042','c1','CSE-3A','odd'),
  ('od-ECE-3A-Wed-4-1','Wed',4,'12:15:00','13:15:00','r7','ECE-3011','c9','ECE-3A','odd'),
  ('s16','Wed',5,'14:00:00','15:00:00','r1','CSE-1019','c6','CSE-2B','odd'),
  ('od-IT-3A-Wed-5-1','Wed',5,'14:00:00','15:00:00','r7','ECE-3011','c9','IT-3A','odd'),
  ('od-CSE-2C-Wed-6-1','Wed',6,'15:00:00','16:00:00','r3','CSE-1057','c3','CSE-2C','odd'),
  ('s46','Wed',6,'15:00:00','16:00:00','r6','IT-2051','c12','IT-3A','odd'),
  ('s40','Thu',1,'09:00:00','10:00:00','r4','CSE-1083','c13','CSE-2A','odd'),
  ('s17','Thu',1,'09:00:00','10:00:00','r1','CSE-1042','c1','CSE-2B','odd'),
  ('od-CSE-3A-Thu-2-0','Thu',1,'09:00:00','10:00:00','r6','CSE-1078','c5','CSE-3A','odd'),
  ('od-ECE-3A-Thu-1-0','Thu',1,'15:00:00','16:00:00','r7','ECE-3011','c9','ECE-3A','odd'),
  ('s18','Thu',2,'10:00:00','11:00:00','r1','CSE-1083','c5','CSE-2B','odd'),
  ('od-CSE-2C-Thu-2-0','Thu',2,'10:00:00','11:00:00','r3','CSE-1019','c6','CSE-2C','odd'),
  ('od-ECE-3A-Thu-2-0','Thu',2,'10:00:00','11:00:00','r7','MECH-4007','c10','ECE-3A','odd'),
  ('s30','Thu',2,'10:00:00','11:00:00','r2','IT-2033','c7','IT-2A','odd'),
  ('s41','Thu',3,'11:15:00','12:15:00','r4','CSE-1042','c1','CSE-2A','odd'),
  ('od-IT-3A-Thu-3-0','Thu',3,'11:15:00','12:15:00','r2','IT-2045','c8','IT-3A','odd'),
  ('s39','Thu',4,'12:15:00','13:15:00','r4','CSE-1019','c6','CSE-2A','odd'),
  ('s19','Thu',4,'12:15:00','13:15:00','r5','CSE-1042','c2','CSE-2B','odd'),
  ('s20','Thu',5,'14:00:00','15:00:00','r1','CSE-1057','c3','CSE-2B','odd'),
  ('od-CSE-2C-Thu-4-1','Thu',5,'14:00:00','15:00:00','r5','CSE-1078','c2','CSE-2C','odd'),
  ('s42','Fri',6,'15:00:00','16:00:00','r4','CSE-1078','c4','CSE-2A','odd'),
  ('od-CSE-3A-Thu-5-1','Thu',6,'15:00:00','16:00:00','r3','CSE-1057','c3','CSE-3A','odd'),
  ('od-IT-3A-Thu-6-1','Thu',6,'15:00:00','16:00:00','r7','IT-2033','c7','IT-3A','odd'),
  ('s21','Thu',7,'16:15:00','17:15:00','r1','IT-2045','c11','CSE-2B','odd'),
  ('od-CSE-2C-Fri-1-0','Fri',1,'09:00:00','10:00:00','r3','CSE-1042','c1','CSE-2C','odd'),
  ('od-CSE-3A-Fri-1-0','Fri',1,'09:00:00','10:00:00','r4','CSE-1019','c11','CSE-3A','odd'),
  ('s43','Fri',2,'10:00:00','11:00:00','r4','CSE-1019','c6','CSE-2A','odd'),
  ('s22','Fri',2,'10:00:00','11:00:00','r1','CSE-1083','c5','CSE-2B','odd'),
  ('od-ECE-3A-Fri-2-0','Fri',2,'10:00:00','11:00:00','r6','IT-2033','c9','ECE-3A','odd'),
  ('od-IT-3A-Fri-2-0','Fri',2,'10:00:00','11:00:00','r7','ECE-3011','c9','IT-3A','odd'),
  ('s44','Fri',3,'11:15:00','12:15:00','r4','CSE-1057','c3','CSE-2A','odd'),
  ('s23','Fri',3,'11:15:00','12:15:00','r1','CSE-1078','c4','CSE-2B','odd'),
  ('od-CSE-3A-Fri-3-1','Fri',3,'11:15:00','12:15:00','r6','IT-2051','c12','CSE-3A','odd'),
  ('od-ECE-3A-Fri-3-0','Fri',3,'15:00:00','16:00:00','r7','CSE-1019','c11','ECE-3A','odd'),
  ('s31','Fri',4,'12:15:00','13:15:00','r2','IT-2045','c8','IT-2A','odd'),
  ('od-IT-3A-Fri-4-1','Fri',4,'12:15:00','13:15:00','r6','IT-2051','c12','IT-3A','odd'),
  ('s45','Fri',5,'14:00:00','15:00:00','r4','CSE-1042','c1','CSE-2A','odd'),
  ('s24','Fri',5,'14:00:00','15:00:00','r1','CSE-1019','c6','CSE-2B','odd'),
  ('od-CSE-2C-Fri-5-1','Fri',5,'14:00:00','15:00:00','r3','CSE-1083','c5','CSE-2C','odd'),
  ('s25','Fri',7,'16:15:00','17:15:00','r1','CSE-1042','c1','CSE-2B','odd'),
  ('ev-CSE-2B-Mon-1-0','Mon',1,'09:00:00','10:00:00','r5','CSE-1083','e5','CSE-2B','even'),
  ('ev-CSE-3B-Mon-1-0','Mon',1,'09:00:00','10:00:00','r4','IT-2033','e11','CSE-3B','even'),
  ('ev-CSE-2B-Mon-2-1','Mon',2,'10:00:00','11:00:00','r1','CSE-1042','e1','CSE-2B','even'),
  ('ev-CSE-2B-Mon-3-2','Mon',3,'11:15:00','12:15:00','r1','CSE-1057','e2','CSE-2B','even'),
  ('ev-CSE-3B-Mon-3-1','Mon',3,'11:15:00','12:15:00','r2','IT-2045','e7','CSE-3B','even'),
  ('ev-CSE-2B-Mon-4-3','Mon',4,'12:15:00','13:15:00','r1','CSE-1083','e3','CSE-2B','even'),
  ('ev-IT-2A-Mon-4-0','Mon',4,'12:15:00','13:15:00','r2','IT-2045','e7','IT-2A','even'),
  ('ev-CSE-2B-Mon-5-4','Mon',5,'14:00:00','15:00:00','r5','CSE-1083','e5','CSE-2B','even'),
  ('ev-CSE-3B-Mon-5-2','Mon',5,'14:00:00','15:00:00','r4','CSE-1019','e8','CSE-3B','even'),
  ('ev-IT-2A-Mon-5-1','Mon',5,'14:00:00','15:00:00','r2','IT-2051','e8','IT-2A','even'),
  ('ev-IT-2A-Mon-7-2','Mon',7,'16:15:00','17:15:00','r7','ECE-3011','e9','IT-2A','even'),
  ('ev-CSE-2B-Tue-1-0','Tue',1,'09:00:00','10:00:00','r1','CSE-1057','e2','CSE-2B','even'),
  ('ev-IT-2A-Tue-2-0','Tue',1,'09:00:00','10:00:00','r4','IT-2051','e7','IT-2A','even'),
  ('ev-CSE-2B-Tue-2-1','Tue',2,'10:00:00','11:00:00','r1','CSE-1042','e1','CSE-2B','even'),
  ('ev-CSE-3B-Tue-2-0','Tue',2,'10:00:00','11:00:00','r2','IT-2051','e8','CSE-3B','even'),
  ('ev-CSE-2B-Tue-3-2','Tue',3,'11:15:00','12:15:00','r1','CSE-1019','e6','CSE-2B','even'),
  ('ev-CSE-3B-Tue-4-1','Tue',4,'12:15:00','13:15:00','r2','IT-2045','e7','CSE-3B','even'),
  ('ev-CSE-2B-Tue-5-3','Tue',5,'14:00:00','15:00:00','r1','CSE-1078','e4','CSE-2B','even'),
  ('ev-IT-2A-Tue-5-1','Tue',5,'14:00:00','15:00:00','r4','IT-2033','e11','IT-2A','even'),
  ('ev-CSE-3B-Tue-6-2','Tue',6,'15:00:00','16:00:00','r7','ECE-3011','e9','CSE-3B','even'),
  ('ev-CSE-2B-Wed-1-0','Wed',1,'09:00:00','10:00:00','r1','CSE-1042','e1','CSE-2B','even'),
  ('ev-CSE-3B-Wed-2-0','Wed',2,'10:00:00','11:00:00','r7','ECE-3011','e9','CSE-3B','even'),
  ('ev-CSE-2B-Wed-3-1','Wed',3,'11:15:00','12:15:00','r1','CSE-1019','e6','CSE-2B','even'),
  ('ev-IT-2A-Wed-3-0','Wed',3,'11:15:00','12:15:00','r2','IT-2051','e8','IT-2A','even'),
  ('ev-CSE-2B-Wed-4-2','Wed',4,'12:15:00','13:15:00','r1','CSE-1083','e3','CSE-2B','even'),
  ('ev-CSE-3B-Wed-4-1','Wed',4,'12:15:00','13:15:00','r2','IT-2045','e7','CSE-3B','even'),
  ('ev-CSE-2B-Wed-5-3','Wed',5,'14:00:00','15:00:00','r1','CSE-1078','e4','CSE-2B','even'),
  ('ev-IT-2A-Wed-5-1','Wed',5,'14:00:00','15:00:00','r7','ECE-3011','e9','IT-2A','even'),
  ('ev-CSE-3B-Wed-6-2','Wed',6,'15:00:00','16:00:00','r2','IT-2051','e8','CSE-3B','even'),
  ('ev-CSE-2B-Thu-1-0','Thu',1,'09:00:00','10:00:00','r1','CSE-1083','e3','CSE-2B','even'),
  ('ev-IT-2A-Thu-1-0','Thu',1,'09:00:00','10:00:00','r7','MECH-4007','e10','IT-2A','even'),
  ('ev-CSE-2B-Thu-3-1','Thu',3,'11:15:00','12:15:00','r5','CSE-1083','e5','CSE-2B','even'),
  ('ev-CSE-3B-Thu-3-0','Thu',3,'11:15:00','12:15:00','r4','CSE-1019','e6','CSE-3B','even'),
  ('ev-CSE-2B-Thu-4-2','Thu',4,'12:15:00','13:15:00','r1','CSE-1042','e1','CSE-2B','even'),
  ('ev-CSE-2B-Thu-5-3','Thu',5,'14:00:00','15:00:00','r1','IT-2033','e11','CSE-2B','even'),
  ('ev-CSE-3B-Thu-5-1','Thu',5,'14:00:00','15:00:00','r2','IT-2045','e7','CSE-3B','even'),
  ('ev-IT-2A-Thu-5-1','Thu',6,'15:00:00','16:00:00','r2','IT-2045','e7','IT-2A','even'),
  ('ev-CSE-2B-Thu-7-4','Thu',7,'16:15:00','17:15:00','r1','CSE-1057','e2','CSE-2B','even'),
  ('ev-CSE-3B-Thu-7-2','Thu',7,'16:15:00','17:15:00','r4','IT-2033','e11','CSE-3B','even'),
  ('ev-CSE-2B-Fri-1-0','Fri',1,'09:00:00','10:00:00','r1','CSE-1083','e3','CSE-2B','even'),
  ('ev-IT-2A-Fri-1-0','Fri',1,'09:00:00','10:00:00','r2','IT-2051','e8','IT-2A','even'),
  ('ev-CSE-3B-Fri-2-0','Fri',2,'10:00:00','11:00:00','r2','MECH-4007','e10','CSE-3B','even'),
  ('ev-CSE-2B-Fri-3-1','Fri',3,'11:15:00','12:15:00','r1','CSE-1042','e1','CSE-2B','even'),
  ('ev-IT-2A-Fri-5-1','Fri',4,'12:15:00','13:15:00','r4','IT-2045','e7','IT-2A','even'),
  ('ev-CSE-2B-Fri-5-2','Fri',5,'14:00:00','15:00:00','r1','CSE-1019','e6','CSE-2B','even'),
  ('ev-CSE-3B-Fri-5-1','Fri',5,'14:00:00','15:00:00','r2','IT-2051','e8','CSE-3B','even'),
  ('ev-CSE-2B-Fri-7-3','Fri',7,'16:15:00','17:15:00','r1','CSE-1078','e4','CSE-2B','even');

INSERT INTO Substitution (substitution_id, sub_date, reason, original_emp_no, substitute_emp_no, timetable_id, status, applied_at) VALUES
  ('sub-1','2026-10-27','Attending IEEE International Conference on AI & Systems','CSE-1019','CSE-1083','s8','Pending','2026-10-20 14:30:00'),
  ('sub-2','2026-10-28','Medical consultation / On leave','CSE-1019','CSE-1042','s16','Approved','2026-10-19 11:15:00'),
  ('sub-3','2026-10-30','Department Workshop Coordination','ECE-3011','ECE-3026','s28','Pending','2026-10-21 09:20:00');

-- ============================================================================
-- Sanity report — visible in Workbench after the script runs
-- ============================================================================
SELECT 'Faculty' AS entity, COUNT(*) AS rows_in_db FROM Faculty
UNION ALL SELECT 'Section', COUNT(*) FROM Section
UNION ALL SELECT 'Student', COUNT(*) FROM Student
UNION ALL SELECT 'Course', COUNT(*) FROM Course
UNION ALL SELECT 'Room', COUNT(*) FROM Room
UNION ALL SELECT 'RoomResource', COUNT(*) FROM RoomResource
UNION ALL SELECT 'Timetable', COUNT(*) FROM Timetable
UNION ALL SELECT 'Substitution', COUNT(*) FROM Substitution;

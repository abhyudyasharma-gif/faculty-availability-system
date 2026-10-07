USE FacultyAvailabilityDB;

-- 1. View complete faculty timetable
SELECT 
    f.faculty_id,
    f.name AS faculty_name,
    f.department,
    t.day,
    t.start_time,
    t.end_time,
    t.room_no,
    c.course_name
FROM Faculty f
JOIN Timetable t ON f.faculty_id = t.faculty_id
JOIN Course c ON t.course_id = c.course_id
ORDER BY f.faculty_id, t.day, t.start_time;


-- 2. Check current faculty availability
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
        THEN 'Busy'
        ELSE 'Available'
    END AS status
FROM Faculty f;


-- 3. Display CSE faculty
SELECT *
FROM Faculty
WHERE department = 'CSE';


-- 4. Display ECE faculty
SELECT *
FROM Faculty
WHERE department = 'ECE';


-- 5. Count faculty in each department
SELECT
    department,
    COUNT(*) AS faculty_count
FROM Faculty
GROUP BY department;


-- 6. Display courses having 4 or more credits
SELECT *
FROM Course
WHERE credits >= 4;


-- 7. Count classes handled by each faculty
SELECT
    f.faculty_id,
    f.name,
    COUNT(t.timetable_id) AS total_classes
FROM Faculty f
LEFT JOIN Timetable t
    ON f.faculty_id = t.faculty_id
GROUP BY f.faculty_id, f.name;


-- 8. Display substitution details
SELECT
    s.substitution_id,
    s.date,
    original.name AS original_faculty,
    substitute.name AS substitute_faculty,
    c.course_name,
    t.day,
    t.start_time,
    t.end_time
FROM Substitution s
JOIN Faculty original
    ON s.original_faculty_id = original.faculty_id
JOIN Faculty substitute
    ON s.substitute_faculty_id = substitute.faculty_id
JOIN Timetable t
    ON s.timetable_id = t.timetable_id
JOIN Course c
    ON t.course_id = c.course_id
ORDER BY s.date;


-- 9. Find upcoming substitutions
SELECT *
FROM Substitution
WHERE date >= CURDATE()
ORDER BY date;


-- 10. Find faculty availability for a specific day and time
SET @day = 'Monday';
SET @time = '10:30:00';

SELECT
    f.faculty_id,
    f.name AS faculty_name,
    f.department,
    CASE
        WHEN EXISTS (
            SELECT 1
            FROM Timetable t
            WHERE t.faculty_id = f.faculty_id
              AND t.day = @day
              AND @time >= t.start_time
              AND @time < t.end_time
        )
        THEN 'Busy'
        ELSE 'Available'
    END AS status
FROM Faculty f;

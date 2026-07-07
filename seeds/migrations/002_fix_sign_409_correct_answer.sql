-- Fix incorrect correct_option for signs question 409.
-- The sign shows a sharp right curve; the correct answer is 'd', not 'a'.
UPDATE questions
SET correct_option = 'd'
WHERE question_number = 409
  AND topic_id = (SELECT id FROM topics WHERE slug = 'signs');

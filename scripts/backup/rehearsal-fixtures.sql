INSERT INTO topics (id, slug, name_he, order_index) VALUES ('00000000-0000-0000-0000-0000000000a1', 'rehearsal-topic', 'rehearsal', 900);
INSERT INTO questions (id, topic_id, question_number, question_he, option_a, option_b, option_c, option_d) VALUES
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a1', 900001, 'q', 'a', 'b', 'c', 'd'),
  ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000a1', 900002, 'q', 'a', 'b', 'c', 'd');
INSERT INTO auth.users (id, email, email_confirmed_at, raw_user_meta_data, raw_app_meta_data) VALUES
  ('00000000-0000-0000-0000-0000000000c1', 'one@example.test', now(), '{"b":1,"a":[1,2]}', '{"provider":"email"}'),
  ('00000000-0000-0000-0000-0000000000c2', 'two@example.test', now(), '{}', '{"provider":"email"}');
INSERT INTO user_stats (user_id, star_points, streak_days, last_active_date) VALUES
  ('00000000-0000-0000-0000-0000000000c1', 40, 3, '2026-11-01'),
  ('00000000-0000-0000-0000-0000000000c2', 0, 0, NULL);
INSERT INTO user_medals (id, user_id, medal_slug) VALUES
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000c1', 'first-answer');
INSERT INTO user_schedule (id, user_id, day_of_week, start_time, time_zone) VALUES
  ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000c1', 2, '18:30', 'Asia/Jerusalem');
INSERT INTO user_learner_plans (user_id, target_exam_date, daily_question_goal) VALUES
  ('00000000-0000-0000-0000-0000000000c1', '2027-01-15', 25);
INSERT INTO user_topic_progress (id, user_id, topic_id, status) VALUES
  ('00000000-0000-0000-0000-0000000000d3', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000a1', 'in_progress');
INSERT INTO user_quiz_responses (id, user_id, question_id, selected_option, is_correct) VALUES
  ('00000000-0000-0000-0000-0000000000d4', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000b1', 'a', true);
INSERT INTO quiz_answer_events (user_id, question_id, is_correct, answered_at) VALUES
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000b1', false, '2026-11-01T10:00:00Z'),
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000b1', true, '2026-11-02T10:00:00Z');
INSERT INTO quiz_question_rewards (user_id, question_id) VALUES
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000b1');
INSERT INTO user_exam_attempts (id, user_id, score, total, passed, answers) VALUES
  ('00000000-0000-0000-0000-0000000000d5', '00000000-0000-0000-0000-0000000000c1', 28, 30, true, '[{"q":1}]');
INSERT INTO user_exam_sessions (id, user_id, question_ids, answers, expires_at, submitted_at, attempt_id, result) VALUES
  ('00000000-0000-0000-0000-0000000000d6', '00000000-0000-0000-0000-0000000000c1',
   ARRAY['00000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-0000000000b2']::uuid[], '{"1":"a"}',
   '2026-12-01T00:00:00Z', '2026-11-03T00:00:00Z', '00000000-0000-0000-0000-0000000000d5', '{"score":28}');
INSERT INTO user_diagnostic_attempts (id, user_id, answers, topic_scores) VALUES
  ('00000000-0000-0000-0000-0000000000d7', '00000000-0000-0000-0000-0000000000c1', '[]', '{"rehearsal-topic":0.5}');
INSERT INTO user_question_bookmarks (user_id, question_id) VALUES
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000b2');
INSERT INTO user_srs_cards (id, user_id, question_id) VALUES
  ('00000000-0000-0000-0000-0000000000d8', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000b1');
INSERT INTO user_push_subscriptions (id, user_id, endpoint, auth, p256dh) VALUES
  ('00000000-0000-0000-0000-0000000000d9', '00000000-0000-0000-0000-0000000000c1', 'https://push.example.test/abc', 'authvalue', 'p256dhvalue');
INSERT INTO contact_messages (id, user_id, topic, message, locale) VALUES
  ('00000000-0000-0000-0000-0000000000da', '00000000-0000-0000-0000-0000000000c2', 'general', 'rehearsal message', 'he');
INSERT INTO question_reports (id, user_id, question_id, locale) VALUES
  ('00000000-0000-0000-0000-0000000000db', '00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000b1', 'he');
INSERT INTO signs (id, sign_number, name_he, image_path) VALUES
  ('00000000-0000-0000-0000-0000000000a2', '900', 'rehearsal', '/signs/sign-900.png');
INSERT INTO user_srs_cards (id, user_id, sign_id) VALUES
  ('00000000-0000-0000-0000-0000000000dc', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000a2');
INSERT INTO questions (id, topic_id, question_number, question_he, option_a, option_b, option_c, option_d) VALUES
  ('00000000-0000-0000-0000-0000000000b3', '00000000-0000-0000-0000-0000000000a1', 900003, 'q', 'a', 'b', 'c', 'd');
INSERT INTO user_quiz_responses (id, user_id, question_id, selected_option, is_correct) VALUES
  ('00000000-0000-0000-0000-0000000000dd', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000b3', 'b', false);
UPDATE questions SET is_active = false WHERE id = '00000000-0000-0000-0000-0000000000b3';

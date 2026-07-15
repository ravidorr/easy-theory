-- Arabic content for signs question 15 (first question in /ar/topics/signs).
-- Fixes https://github.com/ravidorr/easy-theory/issues/136
UPDATE questions
SET
  question_ar = 'على طريق ثنائي الاتجاه خارج المناطق الحضرية، يُوضَع على جانبه الأيمن أمامك إشارة تمنع التوقّف:',
  option_a_ar = 'وفقًا للإشارة، يُمنع التوقّف على يمين الطريق وعلى الكتف أيضًا.',
  option_b_ar = 'يقتصر المنع الوارد في الإشارة على التوقّف على الطريق فقط.',
  option_c_ar = 'يقتصر المنع على التوقّف على الكتف فقط.',
  option_d_ar = 'تمنع الإشارة التوقّف على جانبي الطريق.'
WHERE question_number = 15
  AND topic_id = (SELECT id FROM topics WHERE slug = 'signs');

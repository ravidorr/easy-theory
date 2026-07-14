-- Migration 012: move the videos and resources page content into the DB
-- Run in the Supabase SQL editor.

CREATE TABLE IF NOT EXISTS videos (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  youtube_id        TEXT UNIQUE NOT NULL,
  section           TEXT NOT NULL CHECK (section IN ('marathon', 'lesson')),
  is_featured       BOOLEAN NOT NULL DEFAULT FALSE,
  order_index       INTEGER NOT NULL,
  title_he          TEXT NOT NULL,
  title_ar          TEXT,
  description_he    TEXT,
  description_ar    TEXT,
  tag_he            TEXT,
  tag_ar            TEXT,
  duration_label_he TEXT,
  duration_label_ar TEXT
);

CREATE TABLE IF NOT EXISTS resources (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  href           TEXT UNIQUE NOT NULL,
  section        TEXT NOT NULL CHECK (section IN ('official', 'practice')),
  order_index    INTEGER NOT NULL,
  title_he       TEXT NOT NULL,
  title_ar       TEXT,
  description_he TEXT,
  description_ar TEXT,
  icon_type      TEXT NOT NULL CHECK (icon_type IN ('sign', 'char')),
  icon_value     TEXT NOT NULL,
  icon_variant   TEXT NOT NULL CHECK (icon_variant IN ('neutral', 'primary', 'success', 'muted'))
);

ALTER TABLE videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE resources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read" ON videos FOR SELECT USING (true);
CREATE POLICY "public read" ON resources FOR SELECT USING (true);

INSERT INTO videos
  (youtube_id, section, is_featured, order_index, title_he, title_ar, description_he, description_ar, tag_he, tag_ar, duration_label_he, duration_label_ar)
VALUES
  ('gd6ES_aAdI0', 'marathon', TRUE, 1,
   'מרתון הכנה למבחן התיאוריה', 'ماراثون التحضير لامتحان نظرية القيادة',
   'סיכום נושאי הליבה: זמני תגובה, הסחות דעת ועוד', 'ملخص موضوعات الأساس: أوقات التفاعل، المشتتات وأكثر',
   NULL, NULL,
   '40 דק׳', '40 دق'),
  ('WsVi4kEiaPE', 'marathon', FALSE, 2,
   'שיעור חזרה מרוכז', 'درس مراجعة مكثف',
   'מעבר על חומר הליבה הנדרש למבחן', 'استعراض المادة الأساسية المطلوبة للامتحان',
   NULL, NULL,
   NULL, NULL),
  ('vk37Vd80S2E', 'lesson', FALSE, 1,
   'מבוא לתמרורים', 'مقدمة عن إشارات المرور',
   NULL, NULL,
   'תמרורים', 'إشارات المرور',
   NULL, NULL),
  ('Rp4wFyF-dok', 'lesson', FALSE, 2,
   'זכות קדימה בצמתים', 'حق الأولوية في التقاطعات',
   NULL, NULL,
   'זכות קדימה', 'حق الأولوية',
   NULL, NULL),
  ('nwbIrAdn8Qc', 'lesson', FALSE, 3,
   'התנהגות בצמתים מורכבים', 'السلوك في التقاطعات المعقدة',
   NULL, NULL,
   'זכות קדימה', 'حق الأولوية',
   NULL, NULL),
  ('kJ5y5JlkMjc', 'lesson', FALSE, 4,
   'שיעור נהיגה לפני טסט', 'درس قيادة قبل الاختبار',
   NULL, NULL,
   'מהשטח', 'من الميدان',
   NULL, NULL)
ON CONFLICT (youtube_id) DO NOTHING;

INSERT INTO resources
  (href, section, order_index, title_he, title_ar, description_he, description_ar, icon_type, icon_value, icon_variant)
VALUES
  ('https://www.gov.il/he/pages/tamrurim_7924_01_18', 'official', 1,
   'לוח התמרורים הרשמי', 'لوحة إشارات المرور الرسمية',
   'כל התמרורים בתוקף, משרד התחבורה', 'جميع إشارات المرور السارية، وزارة النقل',
   'sign', '/signs/sign-301.png', 'neutral'),
  ('https://www.gov.il/he/departments/dynamiccollectors/theoryexamhe_data', 'official', 2,
   'מאגר שאלות התיאוריה', 'قاعدة بيانات أسئلة النظرية',
   'יותר מ-1,800 שאלות אמיתיות מהמבחן', 'أكثر من 1,800 سؤال حقيقي من الامتحان',
   'char', '?', 'primary'),
  ('https://m.noeg.co.il/', 'practice', 1,
   'נוהג, סימולטור תרגול', 'Noeg، محاكي التدريب',
   'מבחני דמה בתנאי אמת, בחינם', 'امتحانات تجريبية في ظروف حقيقية، مجاناً',
   'char', '✓', 'success'),
  ('https://he.wikipedia.org/wiki/%D7%AA%D7%9E%D7%A8%D7%95%D7%A8%D7%99%D7%9D_%D7%91%D7%99%D7%A9%D7%A8%D7%90%D7%9C', 'practice', 2,
   'ויקיפדיה: תמרורים בישראל', 'ويكيبيديا: إشارات المرور في إسرائيل',
   'קטלוג מסודר של כל התמרורים לפי סוג', 'كتالوج منظم لجميع إشارات المرور حسب النوع',
   'char', 'W', 'muted')
ON CONFLICT (href) DO NOTHING;

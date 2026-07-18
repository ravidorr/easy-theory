-- Correct source extraction and Arabic localization for signs 104–107.
-- Safe to run after migration 005_arabic_columns.sql.

UPDATE public.signs
SET
  name_he = 'עקומה ימינה ולאחר מכן שמאלה.',
  meaning_he = 'בדרך שלפניך יש עקומה ימינה ולאחר מכן שמאלה.',
  name_ar = 'منعطف إلى اليمين ثم إلى اليسار.',
  meaning_ar = 'أمامك منعطف إلى اليمين ثم إلى اليسار.'
WHERE sign_number = '104';

UPDATE public.signs
SET
  name_he = 'עקומה שמאלה ולאחר מכן ימינה.',
  meaning_he = 'בדרך שלפניך יש עקומה שמאלה ולאחר מכן ימינה.',
  name_ar = 'منعطف إلى اليسار ثم إلى اليمين.',
  meaning_ar = 'أمامك منعطف إلى اليسار ثم إلى اليمين.'
WHERE sign_number = '105';

UPDATE public.signs
SET
  name_he = 'דרך מפותלת.',
  meaning_he = 'בדרך שלפניך יש דרך מפותלת.',
  name_ar = 'طريق متعرج.',
  meaning_ar = 'أمامك طريق متعرج.'
WHERE sign_number = '106';

UPDATE public.signs
SET
  name_he = 'אזהרה והדרכה בעקומה חדה (שמאלה): המשך הדרך בכיוון המסומן בחצים שעל התמרור; עבור לפני התמרור.',
  meaning_he = 'אזהרה והדרכה בעקומה חדה (שמאלה): המשך הדרך בכיוון המסומן בחצים שעל התמרור; עבור לפני התמרור.',
  name_ar = 'تحذير وإرشاد عند منعطف حاد إلى اليسار: يتجه الطريق في الاتجاه المشار إليه بالأسهم على الإشارة. مرّ أمام الإشارة.',
  meaning_ar = 'تحذير وإرشاد عند منعطف حاد إلى اليسار: يتجه الطريق في الاتجاه المشار إليه بالأسهم على الإشارة. مرّ أمام الإشارة.'
WHERE sign_number = '107';

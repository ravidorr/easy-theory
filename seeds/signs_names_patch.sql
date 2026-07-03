-- Patch sign names where OCR extracted the sign number instead of the name.
-- Names sourced from: https://he.wikipedia.org/wiki/תמרורים_בישראל
-- Run this after seeds/signs.sql

UPDATE signs SET name_he = 'עקומה חדה שמאלה'          WHERE sign_number = '103';
UPDATE signs SET name_he = 'צומת קמץ שמאלה'            WHERE sign_number = '116';
UPDATE signs SET name_he = 'עבודות בכביש'              WHERE sign_number = '143';
UPDATE signs SET name_he = 'אתר תאונה'                 WHERE sign_number = '151';
UPDATE signs SET name_he = 'קצה איסור פנית פרסה'       WHERE sign_number = '431';
UPDATE signs SET name_he = 'רמזור ירוק ניתן לפנות'     WHERE sign_number = '724';
UPDATE signs SET name_he = 'לוחית מידע נוספת'          WHERE sign_number = '911';
UPDATE signs SET name_he = 'לוחית מידע נוספת'          WHERE sign_number = '933';
UPDATE signs SET name_he = 'לוחית מידע נוספת'          WHERE sign_number = '934';

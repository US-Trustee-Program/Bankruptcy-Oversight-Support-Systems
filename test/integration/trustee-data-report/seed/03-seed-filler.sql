-- 100 filler TOD trustees (IDs 200-299): unlinked, with one resigned ('NP', the most common
-- status in ATS_SUB) appointment each, so the report reads them but reports nothing for them.
-- They fill page 1 (100 trustees) so that IDs 500-503 land on page 2, away from their merged
-- partners 40, 41 and 52.

DECLARE @id INT = 200
WHILE @id < 300
BEGIN
  INSERT INTO TRUSTEES (ID, LAST_NAME, FIRST_NAME, STREET, CITY, STATE, ZIP, DISP_ON_WEB,
                        DISP_ON_WEB_A2, TELEPHONE)
  VALUES (@id, 'Filler', CONCAT('Trustee', @id), CONCAT(@id, ' Filler Rd'), 'Springfield', 'IL',
          '62701', 'N', 'N', CONCAT('217-555-', RIGHT(CONCAT('0000', @id), 4)))
  INSERT INTO CHAPTER_DETAILS (TRU_ID, STATUS) VALUES (@id, 'NP')
  SET @id = @id + 1
END
GO

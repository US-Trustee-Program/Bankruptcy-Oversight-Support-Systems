-- TOD (ATS_SUB) data-pattern profile for the trustee data report harness fixtures.
--
-- Run read-only against ATS_SUB from an environment that can reach it. Every query returns
-- counts, lengths or code values (statuses, Y/N flags) only: no names, addresses, phones or
-- emails. Paste the results back as-is. Each query notes the harness scenario it informs.

-- Q1 Totals and appointment coverage (S19-S22, S25)
SELECT
  COUNT(*)                                             AS trustees,
  SUM(CASE WHEN CD.TRU_ID IS NULL THEN 1 ELSE 0 END)   AS no_chapter_rows,
  MIN(T.ID)                                            AS min_id,
  MAX(T.ID)                                            AS max_id
FROM TRUSTEES T
LEFT JOIN (SELECT DISTINCT TRU_ID FROM CHAPTER_DETAILS) CD ON CD.TRU_ID = T.ID;

-- Q2 Appointment status codes, as stored (S20, S21, S25)
SELECT '[' + STATUS + ']' AS status_raw, LEN(STATUS) AS len, COUNT(*) AS rows_
FROM CHAPTER_DETAILS
GROUP BY STATUS
ORDER BY rows_ DESC;

-- Q3 Name shapes (S02, S07, S08)
SELECT
  SUM(CASE WHEN NULLIF(LTRIM(RTRIM(FIRST_NAME)), '') IS NULL
            AND NULLIF(LTRIM(RTRIM(LAST_NAME)), '') IS NULL THEN 1 ELSE 0 END) AS no_person_name,
  SUM(CASE WHEN NULLIF(LTRIM(RTRIM(FIRST_NAME)), '') IS NULL
            AND NULLIF(LTRIM(RTRIM(LAST_NAME)), '') IS NULL
            AND NULLIF(LTRIM(RTRIM(COMPANY)), '') IS NOT NULL THEN 1 ELSE 0 END) AS company_only,
  SUM(CASE WHEN NULLIF(LTRIM(RTRIM(FIRST_NAME)), '') IS NULL
            AND NULLIF(LTRIM(RTRIM(LAST_NAME)), '') IS NOT NULL THEN 1 ELSE 0 END) AS last_name_only,
  SUM(CASE WHEN LAST_NAME COLLATE Latin1_General_BIN = UPPER(LAST_NAME)
            AND LAST_NAME LIKE '%[A-Z]%' THEN 1 ELSE 0 END)                       AS last_name_all_caps,
  SUM(CASE WHEN NULLIF(LTRIM(RTRIM(MIDDLE)), '') IS NOT NULL THEN 1 ELSE 0 END)   AS has_middle,
  SUM(CASE WHEN NULLIF(LTRIM(RTRIM(MIDDLE)), '') IS NOT NULL
            AND LEN(LTRIM(RTRIM(MIDDLE))) <= 2 THEN 1 ELSE 0 END)                AS middle_initial,
  SUM(CASE WHEN LAST_NAME LIKE '%,%' THEN 1 ELSE 0 END)                           AS comma_in_last,
  SUM(CASE WHEN LAST_NAME LIKE '% Jr%' OR LAST_NAME LIKE '% Sr%' OR LAST_NAME LIKE '% II%'
            OR LAST_NAME LIKE '% IV%' THEN 1 ELSE 0 END)                         AS suffix_in_last,
  SUM(CASE WHEN FIRST_NAME LIKE '%.%' OR LAST_NAME LIKE '%.%' THEN 1 ELSE 0 END)  AS period_in_name,
  SUM(CASE WHEN FIRST_NAME LIKE '% %' THEN 1 ELSE 0 END)                          AS space_in_first
FROM TRUSTEES;

-- Q4 Leading/trailing/double spaces and whitespace-only values, per column (S02, S09)
SELECT col,
  SUM(CASE WHEN v IS NULL THEN 1 ELSE 0 END)                                   AS nulls,
  SUM(CASE WHEN v = '' THEN 1 ELSE 0 END)                                      AS empty,
  SUM(CASE WHEN v <> '' AND LTRIM(RTRIM(v)) = '' THEN 1 ELSE 0 END)            AS whitespace_only,
  SUM(CASE WHEN LTRIM(RTRIM(v)) <> '' AND (v LIKE ' %' OR DATALENGTH(v) > DATALENGTH(RTRIM(v)))
           THEN 1 ELSE 0 END)                                                  AS padded,
  SUM(CASE WHEN v LIKE '%  %' AND LTRIM(RTRIM(v)) LIKE '%  %' THEN 1 ELSE 0 END) AS inner_double_space
FROM TRUSTEES
CROSS APPLY (VALUES
  ('FIRST_NAME', FIRST_NAME), ('MIDDLE', MIDDLE), ('LAST_NAME', LAST_NAME), ('COMPANY', COMPANY),
  ('STREET', STREET), ('STREET1', STREET1), ('CITY', CITY), ('STATE', STATE), ('ZIP', ZIP),
  ('ZIP_PLUS', ZIP_PLUS), ('STREET_A2', STREET_A2), ('STREET1_A2', STREET1_A2),
  ('CITY_A2', CITY_A2), ('STATE_A2', STATE_A2), ('ZIP_A2', ZIP_A2), ('ZIP_PLUS_A2', ZIP_PLUS_A2),
  ('TELEPHONE', TELEPHONE), ('EMAIL_ADDRESS', EMAIL_ADDRESS)
) AS c(col, v)
GROUP BY col
ORDER BY col;

-- Q5 Display flag combinations, as stored (S05, S06)
SELECT ISNULL('[' + CAST(DISP_ON_WEB AS VARCHAR(10)) + ']', 'null')    AS disp_on_web,
       ISNULL('[' + CAST(DISP_ON_WEB_A2 AS VARCHAR(10)) + ']', 'null') AS disp_on_web_a2,
       SUM(CASE WHEN NULLIF(LTRIM(RTRIM(STREET_A2)), '') IS NOT NULL THEN 1 ELSE 0 END) AS with_a2_street,
       COUNT(*) AS trustees
FROM TRUSTEES
GROUP BY DISP_ON_WEB, DISP_ON_WEB_A2
ORDER BY trustees DESC;

-- Q6 ZIP shapes for both addresses (S03, S04)
SELECT which, shape, COUNT(*) AS trustees
FROM (
  SELECT 'primary' AS which, ZIP AS zip, ZIP_PLUS AS zip_plus FROM TRUSTEES
  UNION ALL
  SELECT 'a2', ZIP_A2, ZIP_PLUS_A2 FROM TRUSTEES
) z
CROSS APPLY (VALUES (
  CASE
    WHEN NULLIF(LTRIM(RTRIM(zip)), '') IS NULL THEN 'none'
    WHEN zip LIKE '[0-9][0-9][0-9][0-9][0-9]' THEN
      '5 digits' + CASE WHEN zip LIKE '0%' THEN ', leading 0' ELSE '' END
        + CASE WHEN zip_plus LIKE '[0-9][0-9][0-9][0-9]' THEN ' + 4-digit ZIP_PLUS'
               WHEN NULLIF(LTRIM(RTRIM(zip_plus)), '') IS NOT NULL THEN ' + other ZIP_PLUS'
               ELSE '' END
    WHEN zip LIKE '[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]' THEN '9 digits'
    WHEN zip LIKE '[0-9][0-9][0-9][0-9][0-9]-[0-9][0-9][0-9][0-9]' THEN '5-4 with dash'
    WHEN zip LIKE '[0-9][0-9][0-9][0-9]' THEN '4 digits (lost leading 0?)'
    ELSE 'other, length ' + CAST(LEN(zip) AS VARCHAR(3))
  END)) AS s(shape)
GROUP BY which, shape
ORDER BY which, trustees DESC;

-- Q7 Address completeness (S03, S09, merged-record scoring)
SELECT
  SUM(CASE WHEN NULLIF(LTRIM(RTRIM(STREET1)), '') IS NOT NULL THEN 1 ELSE 0 END)    AS has_street1,
  SUM(CASE WHEN NULLIF(LTRIM(RTRIM(STREET1_A2)), '') IS NOT NULL THEN 1 ELSE 0 END) AS has_street1_a2,
  SUM(CASE WHEN NULLIF(LTRIM(RTRIM(STREET_A2)), '') IS NOT NULL THEN 1 ELSE 0 END)  AS has_a2_address,
  SUM(CASE WHEN NULLIF(LTRIM(RTRIM(STATE)), '') IS NULL
            AND NULLIF(LTRIM(RTRIM(STATE_A2)), '') IS NOT NULL THEN 1 ELSE 0 END)   AS state_only_on_a2,
  SUM(CASE WHEN NULLIF(LTRIM(RTRIM(STREET)), '') IS NULL
            AND NULLIF(LTRIM(RTRIM(STREET_A2)), '') IS NULL THEN 1 ELSE 0 END)      AS no_street_at_all
FROM TRUSTEES;

-- Q8 Phone shapes (S10, S11, S16)
SELECT shape, COUNT(*) AS trustees
FROM TRUSTEES
CROSS APPLY (VALUES (
  CASE
    WHEN NULLIF(LTRIM(RTRIM(TELEPHONE)), '') IS NULL THEN 'none'
    WHEN TELEPHONE LIKE '%[xX]%' OR TELEPHONE LIKE '%ext%' THEN 'has extension marker'
    WHEN TELEPHONE LIKE '%[A-Za-z]%' THEN 'other letters'
    ELSE CAST(LEN(TELEPHONE) - LEN(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
           REPLACE(REPLACE(REPLACE(TELEPHONE, '0', ''), '1', ''), '2', ''), '3', ''), '4', ''),
           '5', ''), '6', ''), '7', ''), '8', ''), '9', '')) AS VARCHAR(3)) + ' digits'
         + CASE WHEN TELEPHONE LIKE '%[^0-9]%' THEN ', punctuated' ELSE ', digits only' END
  END)) AS s(shape)
GROUP BY shape
ORDER BY trustees DESC;

-- Q9 Email shapes (S02, S09, S17)
SELECT
  SUM(CASE WHEN NULLIF(LTRIM(RTRIM(EMAIL_ADDRESS)), '') IS NULL THEN 1 ELSE 0 END)     AS none_,
  SUM(CASE WHEN EMAIL_ADDRESS COLLATE Latin1_General_BIN LIKE '%[A-Z]%' THEN 1 ELSE 0 END) AS has_upper,
  SUM(CASE WHEN EMAIL_ADDRESS LIKE '%[;,]%' OR EMAIL_ADDRESS LIKE '%@%@%' THEN 1 ELSE 0 END) AS multiple,
  SUM(CASE WHEN NULLIF(LTRIM(RTRIM(EMAIL_ADDRESS)), '') IS NOT NULL
            AND EMAIL_ADDRESS NOT LIKE '%@%.%' THEN 1 ELSE 0 END)                       AS malformed
FROM TRUSTEES;

-- Q10 Same person more than once (S23, S24, S26-S28). Groups by trimmed, case-folded first+last
-- name; reports group sizes and whether a group's records fall on different report pages
-- (100 TOD IDs per page, in ID order). No names are returned.
WITH ranked AS (
  SELECT ID,
         UPPER(LTRIM(RTRIM(ISNULL(FIRST_NAME, '')))) + '|' + UPPER(LTRIM(RTRIM(ISNULL(LAST_NAME, '')))) AS name_key,
         (ROW_NUMBER() OVER (ORDER BY ID) - 1) / 100 AS report_page
  FROM TRUSTEES
  WHERE NULLIF(LTRIM(RTRIM(LAST_NAME)), '') IS NOT NULL
),
groups_ AS (
  SELECT name_key, COUNT(*) AS records, COUNT(DISTINCT report_page) AS pages
  FROM ranked GROUP BY name_key HAVING COUNT(*) > 1
)
SELECT records, CASE WHEN pages > 1 THEN 'across pages' ELSE 'same page' END AS spread,
       COUNT(*) AS groups_
FROM groups_
GROUP BY records, CASE WHEN pages > 1 THEN 'across pages' ELSE 'same page' END
ORDER BY records, spread;

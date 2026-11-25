-- Appointment scenarios (Slice 2), S48-S57. Each trustee is linked to a CAMS trustee with the same
-- profile, so it produces appointment rows only. Districts are 'Southern', 'New York', which the
-- load maps to 0208; DXTR_INT gives 0208 divisions 081 and 087 (04-seed-dxtr-offices.sql). The
-- CAMS appointments and expected results are in scripts/trustee-data-report-fixtures.ts.
-- All data is synthetic.

INSERT INTO TRUSTEES
  (ID, LAST_NAME, FIRST_NAME, MIDDLE, COMPANY,
   STREET, STREET1, CITY, STATE, ZIP, ZIP_PLUS,
   DISP_ON_WEB, DISP_ON_WEB_A2,
   STREET_A2, STREET1_A2, CITY_A2, STATE_A2, ZIP_A2, ZIP_PLUS_A2,
   TELEPHONE, EMAIL_ADDRESS)
VALUES
  -- S48
  (60, 'Apptexact', 'Ada', NULL, NULL,
   '6000 Appt St', NULL, 'Springfield', 'IL', '62701', NULL, 'Y', 'N',
   NULL, NULL, NULL, NULL, NULL, NULL, '217-555-0160', 'ada.apptexact@example.com'),
  -- S49
  (61, 'Apptodonly', 'Bram', NULL, NULL,
   '6100 Appt St', NULL, 'Springfield', 'IL', '62701', NULL, 'Y', 'N',
   NULL, NULL, NULL, NULL, NULL, NULL, '217-555-0161', 'bram.apptodonly@example.com'),
  -- S50
  (62, 'Apptcamsonly', 'Cleo', NULL, NULL,
   '6200 Appt St', NULL, 'Springfield', 'IL', '62701', NULL, 'Y', 'N',
   NULL, NULL, NULL, NULL, NULL, NULL, '217-555-0162', 'cleo.apptcamsonly@example.com'),
  -- S51
  (63, 'Appttype', 'Dov', NULL, NULL,
   '6300 Appt St', NULL, 'Springfield', 'IL', '62701', NULL, 'Y', 'N',
   NULL, NULL, NULL, NULL, NULL, NULL, '217-555-0163', 'dov.appttype@example.com'),
  -- S52
  (64, 'Apptstatus', 'Esme', NULL, NULL,
   '6400 Appt St', NULL, 'Springfield', 'IL', '62701', NULL, 'Y', 'N',
   NULL, NULL, NULL, NULL, NULL, NULL, '217-555-0164', 'esme.apptstatus@example.com'),
  -- S53
  (65, 'Apptappointed', 'Finn', NULL, NULL,
   '6500 Appt St', NULL, 'Springfield', 'IL', '62701', NULL, 'Y', 'N',
   NULL, NULL, NULL, NULL, NULL, NULL, '217-555-0165', 'finn.apptappointed@example.com'),
  -- S54
  (66, 'Appteffective', 'Gia', NULL, NULL,
   '6600 Appt St', NULL, 'Springfield', 'IL', '62701', NULL, 'Y', 'N',
   NULL, NULL, NULL, NULL, NULL, NULL, '217-555-0166', 'gia.appteffective@example.com'),
  -- S55
  (67, 'Apptnarrowed', 'Hugo', NULL, NULL,
   '6700 Appt St', NULL, 'Springfield', 'IL', '62701', NULL, 'Y', 'N',
   NULL, NULL, NULL, NULL, NULL, NULL, '217-555-0167', 'hugo.apptnarrowed@example.com'),
  -- S56
  (68, 'Apptuntranslated', 'Iris', NULL, NULL,
   '6800 Appt St', NULL, 'Springfield', 'IL', '62701', NULL, 'Y', 'N',
   NULL, NULL, NULL, NULL, NULL, NULL, '217-555-0168', 'iris.apptuntranslated@example.com'),
  -- S57: one person in two TOD records with the same profile
  (69, 'Apptmerged', 'Jude', NULL, NULL,
   '6900 Appt St', NULL, 'Springfield', 'IL', '62701', NULL, 'Y', 'N',
   NULL, NULL, NULL, NULL, NULL, NULL, '217-555-0169', 'jude.apptmerged@example.com'),
  (70, 'Apptmerged', 'Jude', NULL, NULL,
   '6900 Appt St', NULL, 'Springfield', 'IL', '62701', NULL, 'Y', 'N',
   NULL, NULL, NULL, NULL, NULL, NULL, '217-555-0169', 'jude.apptmerged@example.com')
GO

INSERT INTO CHAPTER_DETAILS
  (TRU_ID, DISTRICT, SERVING_STATE, CHAPTER, APPOINTED_DATE, STATUS, STATUS_EFF_DATE)
VALUES
  -- S48 exact match
  (60, 'Southern', 'New York', '7', '2015-03-01', 'PA', '2015-03-01'),
  -- S49 chapter 13 standing is in TOD only
  (61, 'Southern', 'New York', '7', '2015-03-01', 'PA', '2015-03-01'),
  (61, 'Southern', 'New York', '13', '2015-03-01', 'S', '2015-03-01'),
  -- S50 chapter 13 standing is in CAMS only
  (62, 'Southern', 'New York', '7', '2015-03-01', 'PA', '2015-03-01'),
  -- S51 panel in TOD, off-panel in CAMS
  (63, 'Southern', 'New York', '7', '2015-03-01', 'PA', '2015-03-01'),
  -- S52 status differs
  (64, 'Southern', 'New York', '7', '2015-03-01', 'PA', '2015-03-01'),
  -- S53 appointed date differs
  (65, 'Southern', 'New York', '7', '2015-03-01', 'PA', '2015-03-01'),
  -- S54 status effective date differs
  (66, 'Southern', 'New York', '7', '2015-03-01', 'PA', '2015-03-01'),
  -- S55 CAMS covers only division 081
  (67, 'Southern', 'New York', '7', '2015-03-01', 'PA', '2015-03-01'),
  -- S56: chapter 7 matches; the chapter 13 row's district cannot be mapped, so it is not translated
  (68, 'Southern', 'New York', '7', '2015-03-01', 'PA', '2015-03-01'),
  (68, 'Nowhere', 'Atlantis', '13', '2015-03-01', 'S', '2015-03-01'),
  -- S57: merged from 69 and 70. Both have chapter 7 panel; the load kept 69's (active, 2019),
  -- the first in truIds order, not 70's (resigned, 2010). Chapter 13 standing comes from 70.
  (69, 'Southern', 'New York', '7', '2019-01-01', 'PA', '2019-01-01'),
  (70, 'Southern', 'New York', '7', '2010-01-01', 'PR', '2010-01-01'),
  (70, 'Southern', 'New York', '13', '2015-03-01', 'S', '2015-03-01')
GO

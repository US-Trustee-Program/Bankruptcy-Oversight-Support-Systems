-- Seed TRUSTEES and CHAPTER_DETAILS fixture rows for address-normalization tests.
-- Drop and recreate so the test is fully idempotent.

USE ATS_INT
GO

DELETE FROM CHAPTER_DETAILS WHERE TRU_ID IN (1001, 1002, 1003)
GO
DELETE FROM TRUSTEES WHERE ID IN (1001, 1002, 1003)
GO

-- Trustee 1001: no STREET1 / STREET1_A2 (both address line 2 fields are NULL).
-- After migration the trustee in Cosmos should have public.address.address2 = undefined (absent),
-- not null.  This is the primary regression case.
INSERT INTO TRUSTEES
  (ID, LAST_NAME, FIRST_NAME, MIDDLE, COMPANY,
   STREET, STREET1, CITY, STATE, ZIP, ZIP_PLUS,
   DISP_ON_WEB, DISP_ON_WEB_A2,
   STREET_A2, STREET1_A2, CITY_A2, STATE_A2, ZIP_A2, ZIP_PLUS_A2,
   TELEPHONE, EMAIL_ADDRESS)
VALUES
  (1001, 'Testcase', 'Alice', NULL, NULL,
   '100 Main St', NULL, 'Springfield', 'IL', '62701', NULL,
   'y', 'n',
   NULL, NULL, NULL, NULL, NULL, NULL,
   NULL, 'alice.testcase@example.com')
GO

-- Trustee 1002: has STREET1 on primary address (address2 should be present).
INSERT INTO TRUSTEES
  (ID, LAST_NAME, FIRST_NAME, MIDDLE, COMPANY,
   STREET, STREET1, CITY, STATE, ZIP, ZIP_PLUS,
   DISP_ON_WEB, DISP_ON_WEB_A2,
   STREET_A2, STREET1_A2, CITY_A2, STATE_A2, ZIP_A2, ZIP_PLUS_A2,
   TELEPHONE, EMAIL_ADDRESS)
VALUES
  (1002, 'Testcase', 'Bob', NULL, 'Trustee Corp',
   '200 Oak Ave', 'Suite 300', 'Shelbyville', 'IL', '62565', NULL,
   'y', 'n',
   NULL, NULL, NULL, NULL, NULL, NULL,
   '2175550100', 'bob.testcase@example.com')
GO

-- Trustee 1003: A2 is the public address (DISP_ON_WEB_A2='y'), no STREET1_A2.
-- The public address should have no address2, and if the private address has no STREET1 either,
-- the internal contact block should also have no address2.
INSERT INTO TRUSTEES
  (ID, LAST_NAME, FIRST_NAME, MIDDLE, COMPANY,
   STREET, STREET1, CITY, STATE, ZIP, ZIP_PLUS,
   DISP_ON_WEB, DISP_ON_WEB_A2,
   STREET_A2, STREET1_A2, CITY_A2, STATE_A2, ZIP_A2, ZIP_PLUS_A2,
   TELEPHONE, EMAIL_ADDRESS)
VALUES
  (1003, 'Testcase', 'Carol', NULL, NULL,
   '300 Elm Rd', NULL, 'Capital City', 'IL', '62702', NULL,
   'n', 'y',
   '301 Elm Rd', NULL, 'Capital City', 'IL', '62702', NULL,
   NULL, 'carol.testcase@example.com')
GO

-- Active chapter appointments so the trustees are returned by getTrusteesPage (importAll=false)
INSERT INTO CHAPTER_DETAILS
  (TRU_ID, DISTRICT, SERVING_STATE, CHAPTER, APPOINTED_DATE, STATUS, STATUS_EFF_DATE, ARCHIVE_DATE)
VALUES
  (1001, 'Central', 'IL', '7', '2015-01-01', 'PA', '2015-01-01', NULL),
  (1002, 'Central', 'IL', '7', '2018-03-15', 'PA', '2018-03-15', NULL),
  (1003, 'Central', 'IL', '7', '2020-06-01', 'PA', '2020-06-01', NULL)
GO

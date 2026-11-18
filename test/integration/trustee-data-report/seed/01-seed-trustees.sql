-- Synthetic TOD trustees for the trustee data report harness. No row is copied from TOD: names,
-- addresses, phones (555-01xx) and emails (example.com/.org) are invented. Shapes follow the
-- ATS_SUB profile (profiling/ats-sub-patterns.sql, run 2026-11-18): upper-case Y/N display
-- flags, punctuated phones, padded and double-spaced streets. Each row names the scenario it
-- serves; the matching CAMS trustees and every expected result are in
-- scripts/trustee-data-report-fixtures.ts.
--
-- ID layout: the report reads TOD 100 trustees per page in ID order. Scenario rows are 10-54,
-- filler rows 200-299 (03-seed-filler.sql), and 500-503 hold the later records of merged
-- trustees, so those land on page 2 while their first records are on page 1.

DELETE FROM CHAPTER_DETAILS
GO
DELETE FROM TRUSTEES
GO

INSERT INTO TRUSTEES
  (ID, LAST_NAME, FIRST_NAME, MIDDLE, COMPANY,
   STREET, STREET1, CITY, STATE, ZIP, ZIP_PLUS,
   DISP_ON_WEB, DISP_ON_WEB_A2,
   STREET_A2, STREET1_A2, CITY_A2, STATE_A2, ZIP_A2, ZIP_PLUS_A2,
   TELEPHONE, EMAIL_ADDRESS)
VALUES
  -- S01 exact match
  (10, 'Exact', 'Avery', NULL, NULL,
   '100 Main St', NULL, 'Springfield', 'IL', '62701', NULL, 'Y', 'N',
   NULL, NULL, NULL, NULL, NULL, NULL, '217-555-0110', 'avery.exact@example.com'),
  -- S02 formatting only: padded and double-spaced street, parenthesized phone, upper-case email
  (11, 'Formatting', 'Blake ', NULL, NULL,
   '  200   Oak Ave ', NULL, 'Shelbyville', 'IL', '62565', NULL, 'Y', 'N',
   NULL, NULL, NULL, NULL, NULL, NULL, '(217) 555-0111', 'Blake.Formatting@Example.COM'),
  -- S03 address line 2 and a separate ZIP_PLUS
  (12, 'Suite', 'Cameron', NULL, NULL,
   '300 Elm Rd', 'Suite 400', 'Capital City', 'IL', '62702', '1234', 'Y', 'N',
   NULL, NULL, NULL, NULL, NULL, NULL, '217-555-0112', 'cameron.suite@example.com'),
  -- S04 five-digit ZIP with a leading zero, and a ZIP_PLUS
  (13, 'Zeroes', 'Dana', NULL, NULL,
   '1 Harbor Way', NULL, 'Boston', 'MA', '02108', '0001', 'Y', 'N',
   NULL, NULL, NULL, NULL, NULL, NULL, '617-555-0113', 'dana.zeroes@example.com'),
  -- S05 second address (A2) is the public one: DISP_ON_WEB='N', DISP_ON_WEB_A2='Y'
  (14, 'Publictwo', 'Emery', NULL, NULL,
   '400 Private Rd', NULL, 'Dover', 'DE', '19901', NULL, 'N', 'Y',
   '401 Public Ave', 'Suite 2', 'Wilmington', 'DE', '19801', NULL,
   '302-555-0114', 'emery.publictwo@example.com'),
  -- S06 both display flags 'Y': the first address stays public
  (15, 'Bothflags', 'Finley', NULL, NULL,
   '500 First St', NULL, 'Madison', 'WI', '53703', NULL, 'Y', 'Y',
   '502 Second St', NULL, 'Madison', 'WI', '53704', NULL,
   '608-555-0115', 'finley.bothflags@example.com'),
  -- S07 no person name and no company
  (16, NULL, NULL, NULL, NULL,
   '600 Commerce Dr', NULL, 'Columbus', 'OH', '43215', NULL, 'Y', 'N',
   NULL, NULL, NULL, NULL, NULL, NULL, '614-555-0116', NULL),
  -- S08 middle initial and a suffix inside LAST_NAME
  (17, 'Jones, Jr.', 'Mary', 'K.', NULL,
   '700 Maple Ln', NULL, 'Austin', 'TX', '78701', NULL, 'Y', 'N',
   NULL, NULL, NULL, NULL, NULL, NULL, '512-555-0117', 'mary.jones@example.com'),
  -- S09 empty-string columns
  (18, 'Blanks', 'Gale', NULL, '',
   '800 Quiet Ct', '', 'Denver', 'CO', '80202', '', 'Y', 'N',
   NULL, NULL, NULL, NULL, NULL, NULL, '', ''),
  -- S10 phone with extension digits after the number (12-13 digit phones, no 'x' marker)
  (19, 'Extension', 'Harper', NULL, NULL,
   '900 Dial Ave', NULL, 'Portland', 'OR', '97204', NULL, 'Y', 'N',
   NULL, NULL, NULL, NULL, NULL, NULL, '503-555-0119 204', 'harper.extension@example.com'),
  -- S11 eleven-digit phone with a leading country code
  (20, 'Country', 'Indigo', NULL, NULL,
   '1000 Coast Hwy', NULL, 'Seattle', 'WA', '98101', NULL, 'Y', 'N',
   NULL, NULL, NULL, NULL, NULL, NULL, '1-206-555-0120', 'indigo.country@example.com'),
  -- S12-S17 one real difference each (the CAMS side differs; see the fixtures file)
  (21, 'Browne', 'Robert', NULL, NULL,
   '2100 Name St', NULL, 'Springfield', 'IL', '62701', NULL, 'Y', 'N',
   NULL, NULL, NULL, NULL, NULL, NULL, '217-555-0121', 'robert.browne@example.com'),
  (22, 'Firm', 'Jamie', NULL, 'Old Firm LLP',
   '2200 Company St', NULL, 'Springfield', 'IL', '62701', NULL, 'Y', 'N',
   NULL, NULL, NULL, NULL, NULL, NULL, '217-555-0122', 'jamie.firm@example.com'),
  (23, 'Mover', 'Kai', NULL, NULL,
   '500 Pine St', NULL, 'Springfield', 'IL', '62701', NULL, 'Y', 'N',
   NULL, NULL, NULL, NULL, NULL, NULL, '217-555-0123', 'kai.mover@example.com'),
  (24, 'Backoffice', 'Lane', NULL, NULL,
   '2400 Front St', NULL, 'Springfield', 'IL', '62701', NULL, 'Y', 'N',
   '600 Back St', NULL, 'Springfield', 'IL', '62703', NULL,
   '217-555-0124', 'lane.backoffice@example.com'),
  (25, 'Caller', 'Morgan', NULL, NULL,
   '2500 Ring Rd', NULL, 'Springfield', 'IL', '62701', NULL, 'Y', 'N',
   NULL, NULL, NULL, NULL, NULL, NULL, '217-555-0125', 'morgan.caller@example.com'),
  (26, 'Mailer', 'Noel', NULL, NULL,
   '2600 Post Rd', NULL, 'Springfield', 'IL', '62701', NULL, 'Y', 'N',
   NULL, NULL, NULL, NULL, NULL, NULL, '217-555-0126', 'noel.mailer@example.com'),
  -- S18 one of two linked IDs exists in TOD
  (27, 'Partial', 'Oakley', NULL, NULL,
   '2700 Half Way', NULL, 'Springfield', 'IL', '62701', NULL, 'Y', 'N',
   NULL, NULL, NULL, NULL, NULL, NULL, '217-555-0127', 'oakley.partial@example.com'),
  -- S19 linked trustee with only inactive appointments
  (28, 'Retired', 'Parker', NULL, NULL,
   '2800 Rest Ave', NULL, 'Springfield', 'IL', '62701', NULL, 'Y', 'N',
   NULL, NULL, NULL, NULL, NULL, NULL, '217-555-0128', 'parker.retired@example.com'),
  -- S20 unlinked and active: TOD only
  (30, 'Todonly', 'Quinn', NULL, NULL,
   '3000 Lone Rd', NULL, 'Springfield', 'IL', '62701', NULL, 'Y', 'N',
   NULL, NULL, NULL, NULL, NULL, NULL, '217-555-0130', 'quinn.todonly@example.com'),
  -- S21 unlinked and inactive
  (31, 'Inactive', 'Riley', NULL, NULL,
   '3100 Lone Rd', NULL, 'Springfield', 'IL', '62701', NULL, 'Y', 'N',
   NULL, NULL, NULL, NULL, NULL, NULL, '217-555-0131', 'riley.inactive@example.com'),
  -- S22 unlinked with no CHAPTER_DETAILS rows
  (32, 'Noappointments', 'Sage', NULL, NULL,
   '3200 Lone Rd', NULL, 'Springfield', 'IL', '62701', NULL, 'Y', 'N',
   NULL, NULL, NULL, NULL, NULL, NULL, '217-555-0132', 'sage.noappointments@example.com'),
  -- S23 the same person twice in TOD, neither record linked
  (33, 'Twin', 'Jordan', NULL, NULL,
   '3300 Double St', NULL, 'Springfield', 'IL', '62701', NULL, 'Y', 'N',
   NULL, NULL, NULL, NULL, NULL, NULL, '217-555-0133', 'jordan.twin@example.com'),
  (34, 'Twin', 'Jordan', NULL, NULL,
   '3300 Double St', NULL, 'Springfield', 'IL', '62701', NULL, 'Y', 'N',
   NULL, NULL, NULL, NULL, NULL, NULL, '217-555-0133', 'jordan.twin@example.com'),
  -- S24 an unlinked record for a person CAMS has, linked to another record (36)
  (35, 'Namesake', 'Casey', NULL, NULL,
   '3500 Same St', NULL, 'Springfield', 'IL', '62701', NULL, 'Y', 'N',
   NULL, NULL, NULL, NULL, NULL, NULL, '217-555-0135', 'casey.namesake@example.com'),
  (36, 'Namesake', 'Casey', NULL, NULL,
   '3500 Same St', NULL, 'Springfield', 'IL', '62701', NULL, 'Y', 'N',
   NULL, NULL, NULL, NULL, NULL, NULL, '217-555-0135', 'casey.namesake@example.com'),
  -- S25 unlinked, active through a converted-case appointment ('O')
  (37, 'Converted', 'Tatum', NULL, NULL,
   '3700 Case St', NULL, 'Springfield', 'IL', '62701', NULL, 'Y', 'N',
   NULL, NULL, NULL, NULL, NULL, NULL, '217-555-0137', 'tatum.converted@example.com'),
  -- S26 merged trustee across pages, CAMS holds the most complete record (500)
  (40, 'Merged', 'Uma', NULL, NULL,
   '4000 Merge St', NULL, 'Springfield', 'IL', '62701', NULL, 'Y', 'N',
   NULL, NULL, NULL, NULL, NULL, NULL, '217-555-0140', 'uma.merged@example.com'),
  -- S27 merged trustee across pages, CAMS holds the less complete record (41)
  (41, 'Pageorder', 'Vale', NULL, NULL,
   '4100 Merge St', NULL, 'Springfield', 'IL', '62701', NULL, 'Y', 'N',
   NULL, NULL, NULL, NULL, NULL, NULL, '217-555-0141', 'vale.pageorder@example.com'),
  -- S28 merged trustee with both records on the same page, CAMS holds the more complete (43)
  (42, 'Samepage', 'Wren', NULL, NULL,
   '4200 Merge St', NULL, 'Springfield', 'IL', '62701', NULL, 'Y', 'N',
   NULL, NULL, NULL, NULL, NULL, NULL, '217-555-0142', 'wren.samepage@example.com'),
  (43, 'Samepage', 'Wren', NULL, NULL,
   '4200 Merge St', 'Floor 2', 'Springfield', 'IL', '62701', '4200', 'Y', 'N',
   NULL, NULL, NULL, NULL, NULL, NULL, '217-555-0142', 'wren.samepage@example.com'),
  -- S34 both display flags 'N' (the most common combination): the first address stays public
  (44, 'Bothno', 'Ash', NULL, NULL,
   '4400 Usual St', NULL, 'Springfield', 'IL', '62701', NULL, 'N', 'N',
   '4401 Back Ln', NULL, 'Springfield', 'IL', '62704', NULL,
   '217-555-0144', 'ash.bothno@example.com'),
  -- S35 DISP_ON_WEB missing, DISP_ON_WEB_A2='Y': the second address is public
  (45, 'Nullflag', 'Bay', NULL, NULL,
   '4500 Home St', NULL, 'Springfield', 'IL', '62701', NULL, NULL, 'Y',
   '4501 Web Ave', NULL, 'Springfield', 'IL', '62705', NULL,
   '217-555-0145', 'bay.nullflag@example.com'),
  -- S36 no address at all
  (46, 'Noaddress', 'Cove', NULL, NULL,
   NULL, NULL, NULL, NULL, NULL, NULL, 'N', 'N',
   NULL, NULL, NULL, NULL, NULL, NULL, '217-555-0146', 'cove.noaddress@example.com'),
  -- S37 state only on the second address
  (47, 'Stateless', 'Dell', NULL, NULL,
   '4700 Lake Rd', NULL, 'Madison', NULL, '53703', NULL, 'N', 'N',
   '4701 Shore Dr', NULL, 'Madison', 'WI', '53704', NULL,
   '608-555-0147', 'dell.stateless@example.com'),
  -- S38 ZIP_PLUS that is not four digits
  (48, 'Shortplus', 'Eden', NULL, NULL,
   '4800 Plus Ct', NULL, 'Springfield', 'IL', '62701', '12', 'Y', 'N',
   NULL, NULL, NULL, NULL, NULL, NULL, '217-555-0148', 'eden.shortplus@example.com'),
  -- S39 phone with punctuation and no digits
  (49, 'Nodigits', 'Fern', NULL, NULL,
   '4900 Mute Rd', NULL, 'Springfield', 'IL', '62701', NULL, 'Y', 'N',
   NULL, NULL, NULL, NULL, NULL, NULL, '(   )    -', 'fern.nodigits@example.com'),
  -- S40 unlinked, only a numeric status code ('9')
  (50, 'Numeric', 'Glen', NULL, NULL,
   '5000 Code St', NULL, 'Springfield', 'IL', '62701', NULL, 'Y', 'N',
   NULL, NULL, NULL, NULL, NULL, NULL, '217-555-0150', 'glen.numeric@example.com'),
  -- S41 unlinked, only an empty status
  (51, 'Emptystatus', 'Hale', NULL, NULL,
   '5100 Code St', NULL, 'Springfield', 'IL', '62701', NULL, 'Y', 'N',
   NULL, NULL, NULL, NULL, NULL, NULL, '217-555-0151', 'hale.emptystatus@example.com'),
  -- S43 unlinked, active through a numeric chapter 13 code ('1')
  (53, 'Standing', 'Jade', NULL, NULL,
   '5300 Code St', NULL, 'Springfield', 'IL', '62701', NULL, 'Y', 'N',
   NULL, NULL, NULL, NULL, NULL, NULL, '217-555-0153', 'jade.standing@example.com'),
  -- S44 unlinked, active through chapter 12 case-by-case code '2'
  (54, 'Casebycase', 'Kit', NULL, NULL,
   '5400 Code St', NULL, 'Springfield', 'IL', '62701', NULL, 'Y', 'N',
   NULL, NULL, NULL, NULL, NULL, NULL, '217-555-0154', 'kit.casebycase@example.com'),
  -- S42 merged from three records, the last two on page 2; CAMS holds the most complete (503)
  (52, 'Triple', 'Iris', NULL, NULL,
   '5200 Merge St', NULL, 'Springfield', 'IL', '62701', NULL, 'Y', 'N',
   NULL, NULL, NULL, NULL, NULL, NULL, '217-555-0152', 'iris.triple@example.com'),
  -- S26 and S27 second records: more complete (address line 2 and ZIP_PLUS)
  (500, 'Merged', 'Uma', NULL, NULL,
   '4000 Merge St', 'Floor 3', 'Springfield', 'IL', '62701', '4000', 'Y', 'N',
   NULL, NULL, NULL, NULL, NULL, NULL, '217-555-0140', 'uma.merged@example.com'),
  (501, 'Pageorder', 'Vale', NULL, NULL,
   '4100 Merge St', 'Floor 4', 'Springfield', 'IL', '62701', '4100', 'Y', 'N',
   NULL, NULL, NULL, NULL, NULL, NULL, '217-555-0141', 'vale.pageorder@example.com'),
  -- S42 second and third records
  (502, 'Triple', 'Iris', NULL, NULL,
   '5200 Merge St', 'Floor 5', 'Springfield', 'IL', '62701', NULL, 'Y', 'N',
   NULL, NULL, NULL, NULL, NULL, NULL, '217-555-0152', 'iris.triple@example.com'),
  (503, 'Triple', 'Iris', NULL, NULL,
   '5200 Merge St', 'Floor 5', 'Springfield', 'IL', '62701', '5200', 'Y', 'N',
   NULL, NULL, NULL, NULL, NULL, NULL, '217-555-0152', 'iris.triple@example.com')
GO

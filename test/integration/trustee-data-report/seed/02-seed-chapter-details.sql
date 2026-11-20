-- Appointment statuses. Only unlinked TOD trustees are checked for an active status (to decide
-- whether they are reported as TOD only), but linked trustees get realistic rows too.
-- Active codes come from TOD_STATUS_MAP (ats.constants.ts). Every code used here occurs in ATS_SUB.
-- Meanings follow the Appointment Status Matrix: PA panel active, O converted case active,
-- NP off panel; numeric codes are chapter 11/12/13 statuses, where 1, 2 (12CBC only), 8 and 12
-- are active and 3, 5, 6, 7, 9 and 10 are not. The empty status has no mapping.

INSERT INTO CHAPTER_DETAILS (TRU_ID, STATUS)
VALUES
  (10, 'PA'), (11, 'PA'), (12, 'PA'), (13, 'PA'), (14, 'PA'), (15, 'PA'), (16, 'PA'),
  (17, 'PA'), (18, 'PA'), (19, 'PA'), (20, 'PA'),
  (21, 'PA'), (22, 'PA'), (23, 'PA'), (24, 'PA'), (25, 'PA'), (26, 'PA'),
  (27, 'PA'),
  -- S19: linked, only inactive appointments
  (28, 'NP'),
  -- S20: one active and one resigned appointment is still active
  (30, 'NP'), (30, 'PA'),
  -- S21: only resigned
  (31, 'NP'),
  -- S22 (32) has no rows
  (33, 'PA'), (34, 'PA'),
  (35, 'PA'), (36, 'PA'),
  -- S25: converted case
  (37, 'O'),
  (40, 'PA'), (41, 'PA'), (42, 'PA'), (43, 'PA'),
  (44, 'PA'), (45, 'PA'), (46, 'PA'), (47, 'PA'), (48, 'PA'), (49, 'PA'),
  -- S41: empty status only
  (51, ''),
  (52, 'PA'), (500, 'PA'), (501, 'PA'), (502, 'PA'), (503, 'PA'),
  -- S46 and S47: page 2 only
  (504, 'PA'), (505, 'PA')
GO

-- Chapter-dependent numeric codes, with their chapter.
INSERT INTO CHAPTER_DETAILS (TRU_ID, CHAPTER, STATUS)
VALUES
  -- S40: inactive chapter 11 case-by-case
  (50, '11', '9'),
  -- S43: active chapter 13 standing
  (53, '13', '1'),
  -- S44: active chapter 12 case-by-case
  (54, '12CBC', '2')
GO

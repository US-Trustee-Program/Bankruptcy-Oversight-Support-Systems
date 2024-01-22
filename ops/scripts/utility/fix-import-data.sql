-- Fix anonymized data set for the following table to ensure zero padding of COURT_ID
-- Execute this after a data import to ensure correct formatting
update AO_PY set COURT_ID='0'+COURT_ID WHERE LEN(COURT_ID)<4;
update AO_AT set COURT_ID='0'+COURT_ID WHERE LEN(COURT_ID)<4;
update AO_TX set COURT_ID='0'+COURT_ID WHERE LEN(COURT_ID)<4;
GO

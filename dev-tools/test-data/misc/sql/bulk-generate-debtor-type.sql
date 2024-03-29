delete from AO_TX where TX_CODE='1' and CS_CASEID in (
  select CS_CASEID from AO_CS
)

insert into AO_TX (
  CS_CASEID,
  COURT_ID,
  DE_SEQNO,
  CASE_ID,
  JOB_ID,
  TX_TYPE,
  TX_CODE,
  TX_DATE,
  REC)
select
  CS_CASEID,
  COURT_ID,
  0,
  CASE_ID,
  0,
  '1',
  '1',
  CS_DATE_FILED,
  CONCAT('0000000000000-00000            ', AO_CS.CS_CHAPTER, 'CB00-0000000     000000000000000000000000000000000000000000000000000000000VP000000                                 00000') as REC
 from AO_CS;

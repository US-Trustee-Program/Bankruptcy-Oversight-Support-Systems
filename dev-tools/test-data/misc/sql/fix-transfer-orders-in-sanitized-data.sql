/*

select substring(T.REC, 108, 2),
       C.CS_CASEID,
       C.COURT_ID,
       C.CASE_ID,
       C.CS_DIV,
       C.CS_SHORT_TITLE,
       P.PY_TAXID,
       P.PY_SSN,
       T.REC
from AO_TX T
         join AO_CS C ON T.CS_CASEID = C.CS_CASEID
         join AO_PY P ON P.CS_CASEID = T.CS_CASEID
where (TX_TYPE = '1' and TX_CODE = '1' and substring(REC, 108, 2) in ('TI', 'TV'))
   OR (TX_TYPE = 'O' and TX_CODE = 'CTO' and JOB_ID!=0)

-- These cases are transfer cases without source cases.
select * from AO_CS where CS_SHORT_TITLE='Saunders, Williams and Blankenship';
select * from AO_CS where CS_SHORT_TITLE='Whitney Walker';

-- These cases are source cases without matching transfer cases.
select * from AO_CS where CS_SHORT_TITLE='Billy Taylor';
select * from AO_CS where CS_SHORT_TITLE='Boyd-Rangel';

*/


select * from AO_PY where PY_TAXID in ('51-2636656','83-5892954')
select * from AO_PY where PY_SSN in ('145-52-6424');

/* DR Michael Taylor DDS*/
declare @csCaseIdFrom varchar(10) = '295319';
declare @csCaseIdTo varchar(10) = '178767';

update AO_PY set PY_TAXID='99-0000001', PY_SSN=null where CS_CASEID in (@csCaseIdFrom, @csCaseIdTo) AND PY_ROLE='db'
update AO_TX set REC='O000000811912625CTO19111915000000        [15] 191119 28 WARN: 82-80331                                                        '
where CS_CASEID=@csCaseIdFrom and TX_TYPE = 'O' and TX_CODE = 'CTO'
update AO_DE set DT_TEXT='Case transferred to District of Delaware, 82-80331.' where CS_CASEID=@csCaseIdFrom and DE_SEQNO=105
go

/* Billy Taylor */

    -- leave this alone to allow for non matching cases

/* Boyd-Rangel */


declare @csCaseIdFrom varchar(10) = '314256';
declare @csCaseIdTo varchar(10) = '188602';

update AO_PY set PY_TAXID='99-0000010', PY_SSN=null where CS_CASEID in (@csCaseIdFrom, @csCaseIdTo) AND PY_ROLE='db'
update AO_TX set REC='O000000811912625CTO19111915000000        [15] 191119 28 WARN: 65-43581                                                        '
where CS_CASEID=@csCaseIdFrom and TX_TYPE = 'O' and TX_CODE = 'CTO'
update AO_DE set DT_TEXT='Case transferred to District of Delaware, 65-43581.' where CS_CASEID=@csCaseIdFrom and DE_SEQNO=116
update AO_DE set DT_TEXT='Order that this case is transferred from this Court to the U.S. Bankruptcy Court for the District of Delaware.' where CS_CASEID=@csCaseIdFrom and DE_SEQNO=111
go

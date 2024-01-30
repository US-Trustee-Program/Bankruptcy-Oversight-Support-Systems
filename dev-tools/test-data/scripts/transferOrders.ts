import { fakerEN_US as faker } from '@faker-js/faker';
import readline from 'node:readline';
import { AO_TX_Record, buildRecFromTxRecord, toAoTxInsertStatements } from '../tables/AO_TX';
import { AO_DE_Record, toAoDeInsertStatements } from '../tables/AO_DE';
import { AO_DC_Record, toAoDcInsertStatements } from '../tables/AO_DC';
import { randomInt } from '../utility';

const SIZE_MB_5 = 5 * 1024 * 1024;

async function main() {
  const docketEntries: Array<AO_DE_Record> = [];
  const docketDocuments: Array<AO_DC_Record> = [];
  const transferOrders: Array<AO_TX_Record> = [];

  const rl = readline.createInterface({
    input: process.stdin,
  });

  for await (const line of rl) {
    const [csCaseId, courtId, caseId, div, deSeq, deMaxDate] = line.split(',');
    const nextDocketSequenceNumber = Number.parseInt(deSeq) + 1;
    const orderDate = deMaxDate;
    const docketEntry = new AO_DE_Record({
      CS_CASEID: csCaseId,
      COURT_ID: courtId,
      DE_SEQNO: nextDocketSequenceNumber,
      DE_DATE_ENTER: orderDate,
      DE_DATE_FILED: orderDate,
      DE_DOCUMENT_NUM: nextDocketSequenceNumber,
      DE_TYPE: 'order',
      DO_SELECT_TEXT: 'Order Transferring Venue',
      DO_SUMMARY_TEXT: 'Order Transferring Venue',
      DT_TEXT:
        'Order that this case is transferred from this Court to the U.S. Bankruptcy Court for the Central District of Illinois. ' +
        faker.lorem.sentences(8),
    });
    const FILE_NAME = `${courtId}-${csCaseId}-${nextDocketSequenceNumber}-${nextDocketSequenceNumber}-0.pdf`;
    const documentEntry = new AO_DC_Record({
      FILE_NAME,
      COURT_ID: docketEntry.COURT_ID,
      CS_CASEID: docketEntry.CS_CASEID,
      DE_SEQNO: docketEntry.DE_SEQNO,
      PDF_SIZE: randomInt(SIZE_MB_5),
      COURT_STATUS: 'pdf',
    });
    docketDocuments.push(documentEntry);
    const transferOrder = new AO_TX_Record({
      CS_CASEID: csCaseId,
      COURT_ID: courtId,
      CASE_ID: caseId,
      DE_SEQNO: nextDocketSequenceNumber,
      JOB_ID: 0,
      TX_TYPE: 'O',
      TX_CODE: 'CTO',
      TX_DATE: orderDate,
    });
    transferOrder.REC = buildRecFromTxRecord(transferOrder, div, '15', '23 WARN: 23-50607 ');
    transferOrders.push(transferOrder);
    docketEntries.push(docketEntry);
  }

  toAoDeInsertStatements(docketEntries).forEach((statement) => {
    console.log(statement.trim());
  });
  toAoDcInsertStatements(docketDocuments).forEach((statement) => {
    console.log(statement.trim());
  });
  toAoTxInsertStatements(transferOrders).forEach((statement) => {
    console.log(statement.trim());
  });
}

(async () => {
  if (process.stdin.isTTY) {
    console.log(
      'Expecting piped input in the format of [ CS Case Id, court ID, case id, division, order date ] per line.',
    );
    return 1;
  }
  main();
})();

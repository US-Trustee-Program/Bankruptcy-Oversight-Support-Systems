import { fakerEN_US as faker } from '@faker-js/faker';
import readline from 'node:readline';
import { randomTruth, randomInt, someDateAfterThisDate } from '../utility';
import {
  AO_DE_Record,
  AO_DE_RecordProps,
  AO_DE_Types,
  toAoDeInsertStatements,
} from '../tables/AO_DE';
import { AO_DC_Record, toAoDcInsertStatements } from '../tables/AO_DC';

const SIZE_MB_5 = 5 * 1024 * 1024;

function randomSummaryText(type: string): string {
  const choicesMap = new Map([
    ['order', ['Order Re: Motion for Joint Administration']],
    ['motion', ['Motion for Joint Administration']],
    [
      'misc',
      [
        'Add Judge',
        'Case Association - Joint Administration',
        'Petition for Recognition of Foreign Proceeding',
      ],
    ],
    ['crditcrd', ['Auto- docket of credit card']],
  ]);
  const choices = choicesMap.get(type) || ['unknown'];
  return choices[randomInt(choices.length)];
}

interface docketEntryGeneratorProps {
  csCaseId: string;
  courtId: string;
  entryDate: string;
  sequenceNumber: number;
  lastDocumentNumber: number;
}

function docketEntryGenerator(props: docketEntryGeneratorProps): AO_DE_RecordProps {
  const {
    csCaseId: CS_CASEID,
    courtId: COURT_ID,
    entryDate,
    sequenceNumber: DE_SEQNO,
    lastDocumentNumber,
  } = props;
  let DE_TYPE = AO_DE_Types[randomInt(AO_DE_Types.length)];

  // Limit the number of credit card payment entries. Try again if the first time was a credit card.
  if (DE_TYPE === 'crditcrd') DE_TYPE = AO_DE_Types[randomInt(AO_DE_Types.length)];

  const DO_SUMMARY_TEXT = randomSummaryText(DE_TYPE);
  const DE_DATE_FILED = someDateAfterThisDate(entryDate, randomInt(3));
  const DE_DATE_ENTER = someDateAfterThisDate(DE_DATE_FILED, randomInt(2));
  return {
    CS_CASEID,
    COURT_ID,
    DE_SEQNO,
    DE_DOCUMENT_NUM: randomTruth() && DE_TYPE !== 'crditcrd' ? lastDocumentNumber + 1 : undefined,
    DE_DATE_ENTER,
    DE_DATE_FILED,
    DE_TYPE,
    DO_SUMMARY_TEXT,
    DO_SUB_TYPE: DE_TYPE === 'crditcrd' ? 'receipt' : undefined,
    DO_SELECT_TEXT: DO_SUMMARY_TEXT,
    DP_FEE: DE_TYPE === 'crditcrd' ? randomInt(100000) / 100 : undefined,
    DT_TEXT: faker.lorem.text().substring(0, 8000),
  };
}

async function main() {
  const docketEntries: Array<AO_DE_Record> = [];
  const docketDocuments: Array<AO_DC_Record> = [];

  const rl = readline.createInterface({
    input: process.stdin,
  });

  for await (const line of rl) {
    const [csCaseId, courtId, dateFiled] = line.split(',');
    let entryDate = dateFiled;

    // Create up to 50 docket entries.
    let lastDocumentNumber = 0;
    for (let sequenceNumber = 0; sequenceNumber < randomInt(50); sequenceNumber++) {
      const docketEntry = docketEntryGenerator({
        csCaseId,
        courtId,
        entryDate,
        sequenceNumber,
        lastDocumentNumber,
      });
      entryDate = docketEntry.DE_DATE_ENTER!;
      docketEntries.push(new AO_DE_Record(docketEntry));

      if (docketEntry.DE_DOCUMENT_NUM) {
        // At least half the time just create a single document.
        const documentCount = randomTruth() ? 1 : randomInt(5);
        for (let docIndex = 0; docIndex < documentCount; docIndex++) {
          const FILE_NAME = `${courtId}-${csCaseId}-${sequenceNumber}-${lastDocumentNumber}-${docIndex}.pdf`;
          const documentEntry = new AO_DC_Record({
            FILE_NAME,
            COURT_ID: docketEntry.COURT_ID,
            CS_CASEID: docketEntry.CS_CASEID,
            DE_SEQNO: docketEntry.DE_SEQNO,
            PDF_SIZE: randomInt(SIZE_MB_5),
            COURT_STATUS: 'pdf',
          });
          docketDocuments.push(documentEntry);
        }
      }
      lastDocumentNumber = docketEntry.DE_DOCUMENT_NUM || lastDocumentNumber;
    }
  }

  toAoDeInsertStatements(docketEntries).forEach((statement) => {
    console.log(statement.trim());
  });
  toAoDcInsertStatements(docketDocuments).forEach((statement) => {
    console.log(statement.trim());
  });
}

(async () => {
  if (process.stdin.isTTY) {
    console.log(
      'Expecting piped input in the format of CS_CASEID, COURT_ID, CS_DATE_FILED per line.',
    );
    return 1;
  }
  main();
})();

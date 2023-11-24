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

/*

We use the wikipedia API to generate mock documents for development testing.

The wikipedia API is: https://en.wikipedia.org/api/rest_v1/page/pdf/[ARTICLE_NAME]

Where [ARTICLE_NAME] is the name of a wikipedia article.

The base URL "https://en.wikipedia.org/api/rest_v1/page/pdf" is stored in the AO_PDF_PATH table
and linked to a court via the AO_CS_DIV table. In the Flexion environment all courts share
the same AO_PDF_PATH record which points to the base URL of the wikipedia API.

We use a random listing of wikipedia articles to simulate different documents.

Note the DXTR database appears to append 3 characters that must be stripped off.
We use ZZZ here as a placeholder for these characters.

File names in the AO_DC table are limited to 40 characters inclusive of the 3 bogus trailing characters
meaning we only limited to 37 character file name lengths.

*/
const documentUrlFragments: [string, number][] = [
  ['Bankruptcy_in_the_United_States', 0],
  ['United_States_Trustee_Program', 0],
  ['Interim_trustee', 0],
  ['Docket_(court)', 0],
  ['PACER_(law)', 0],
  ['United_States_bankruptcy_court', 0],
];

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
      lastDocumentNumber = docketEntry.DE_DOCUMENT_NUM || lastDocumentNumber;
      docketEntries.push(new AO_DE_Record(docketEntry));

      if (docketEntry.DE_DOCUMENT_NUM) {
        // At least half the time just create a single document.
        const documentCount = randomTruth() ? 1 : randomInt(documentUrlFragments.length);
        for (let docIndex = 0; docIndex < documentCount; docIndex++) {
          const fragment = documentUrlFragments[randomInt(documentUrlFragments.length)];
          const FILE_NAME = fragment[0] + '?' + fragment[1] + 'ZZZ';
          fragment[1] = fragment[1] + 1;
          const documentEntry = new AO_DC_Record({
            FILE_NAME,
            COURT_ID: docketEntry.COURT_ID,
            CS_CASEID: docketEntry.CS_CASEID,
            DE_SEQNO: docketEntry.DE_SEQNO,
          });
          docketDocuments.push(documentEntry);
        }
      }
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

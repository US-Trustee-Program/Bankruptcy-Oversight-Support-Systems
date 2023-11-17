import { fakerEN_US as faker } from '@faker-js/faker';
import readline from 'node:readline';
import { randomTruth, randomInt, someDateAfterThisDate } from '../utility';
import {
  AO_DE_Record,
  AO_DE_RecordProps,
  AO_DE_Types,
  toAoDeInsertStatements,
} from '../tables/AO_DE';

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
  dateFiled: string;
  sequenceNumber: number;
}

function docketEntryGenerator(props: docketEntryGeneratorProps): AO_DE_RecordProps {
  const { csCaseId: CS_CASEID, courtId: COURT_ID, dateFiled, sequenceNumber: DE_SEQNO } = props;
  const DE_TYPE = AO_DE_Types[randomInt(AO_DE_Types.length)];
  const DO_SUMMARY_TEXT = randomSummaryText(DE_TYPE);
  const DE_DATE_FILED = someDateAfterThisDate(dateFiled);
  const DE_DATE_ENTER = someDateAfterThisDate(DE_DATE_FILED, randomInt(3));
  return {
    CS_CASEID,
    COURT_ID,
    DE_SEQNO,
    DE_DOCUMENT_NUM: randomTruth() && DE_TYPE !== 'crditcrd' ? DE_SEQNO : undefined,
    DE_DATE_ENTER,
    DE_DATE_FILED,
    DE_TYPE,
    DO_SUMMARY_TEXT,
    DO_SUB_TYPE: DE_TYPE === 'crditcrd' ? 'receipt' : undefined,
    DO_SELECT_TEXT: DO_SUMMARY_TEXT,
    DP_FEE: DE_TYPE === 'crditcrd' ? randomInt(100000) / 100 : undefined,
    DT_TEXT: faker.lorem.text(),
  };
}

async function main() {
  const caseParties: Array<AO_DE_Record> = [];

  const rl = readline.createInterface({
    input: process.stdin,
  });

  for await (const line of rl) {
    const [csCaseId, courtId, dateFiled] = line.split(',');
    for (let sequenceNumber = 0; sequenceNumber < randomInt(20); sequenceNumber++) {
      caseParties.push(
        new AO_DE_Record(docketEntryGenerator({ csCaseId, courtId, dateFiled, sequenceNumber })),
      );
    }
  }

  toAoDeInsertStatements(caseParties).forEach((statement) => {
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

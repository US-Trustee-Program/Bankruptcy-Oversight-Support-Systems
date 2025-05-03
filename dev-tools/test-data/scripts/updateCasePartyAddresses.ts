import readline from 'node:readline';

import { getFakerLocale } from '../fixtures/lib/common';
import { AO_PY_Record, AO_PY_RecordProps, toAoPyUpdateStatements } from '../tables/AO_PY';
import { randomTruth } from '../utility';

interface partyGeneratorProps {
  chapter?: string;
  courtId: string;
  csCaseId: string;
  role: string;
}

async function main() {
  const caseParties: Array<AO_PY_Record> = [];

  const rl = readline.createInterface({
    input: process.stdin,
  });

  for await (const line of rl) {
    const [csCaseId, courtId, role, chapter] = line.split(',');
    caseParties.push(new AO_PY_Record(partyGenerator({ chapter, courtId, csCaseId, role })));
  }

  const columnsToOmitFromUpdate = [
    'COURT_ID',
    'PY_ROLE',
    'PY_TAXID',
    'PY_SSN',
    'PY_LAST_NAME',
    'PY_MIDDLE_NAME',
    'PY_FIRST_NAME',
    'PY_GENERATION',
    'PY_PHONENO',
    'PY_FAX_PHONE',
    'PY_E_MAIL',
    'PY_PROSE',
    'PY_END_DATE',
    'SSN_EVENT',
    'NAME_EVENT',
    'ADDRESS_EVENT',
  ];

  toAoPyUpdateStatements(caseParties, columnsToOmitFromUpdate).forEach((statement) => {
    console.log(statement.trim());
  });
}

function partyGenerator(props: partyGeneratorProps): AO_PY_RecordProps {
  const faker = getFakerLocale();
  const isCompany = Math.random() >= 0.5 ? 1 : 0;
  if (!props.chapter) props.chapter = '15';

  const fakerState = faker.location.state({ abbreviated: true });
  const PY_STATE = fakerState.length === 2 ? fakerState : undefined; // LIMITED TO 2 CHARACTERS
  const PY_CITY = faker.location.city();
  const PY_ADDRESS3 = PY_STATE
    ? undefined
    : [faker.location.county(), faker.location.state()].join(', ');

  return {
    COURT_ID: props.courtId,
    CS_CASEID: props.csCaseId,
    PY_ADDRESS1: faker.location.streetAddress(),
    PY_ADDRESS2: randomTruth() ? faker.location.secondaryAddress() : undefined,
    PY_ADDRESS3,
    PY_CITY,
    PY_COUNTRY: randomTruth() ? faker.location.countryCode('alpha-2') : faker.location.country(),
    PY_E_MAIL: faker.internet.email(),
    PY_FAX_PHONE: faker.phone.number(),
    PY_FIRST_NAME: isCompany ? undefined : faker.person.firstName(),
    PY_GENERATION: isCompany ? undefined : faker.person.suffix(),
    PY_LAST_NAME: isCompany ? faker.company.name() : faker.person.lastName(),
    PY_MIDDLE_NAME: isCompany ? undefined : faker.person.middleName(),
    PY_PHONENO: faker.phone.number(),
    PY_PROSE: 'n',
    PY_ROLE: props.role,
    PY_SSN:
      isCompany || props.chapter === '15'
        ? undefined
        : faker.number.int({ max: 999, min: 100 }) +
          '-' +
          faker.number.int({ max: 99, min: 10 }) +
          '-' +
          faker.number.int({ max: 9999, min: 1000 }),
    PY_STATE,
    PY_TAXID:
      isCompany && props.chapter !== '15'
        ? faker.number.int({ max: 99, min: 10 }) +
          '-' +
          faker.number.int({ max: 9999999, min: 1000000 })
        : undefined,
    PY_ZIP: faker.location.zipCode(),
  };
}

(async () => {
  if (process.stdin.isTTY) {
    console.log('Expecting piped input in the format of CS Case Id, court ID, role per line.');
    return 1;
  }
  main();
})();

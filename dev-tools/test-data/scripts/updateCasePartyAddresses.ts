import { AO_PY_Record, AO_PY_RecordProps, toAoPyUpdateStatements } from '../tables/AO_PY';
import readline from 'node:readline';
import { getFakerLocale, randomTruth } from '../utility';

interface partyGeneratorProps {
  csCaseId: string;
  courtId: string;
  role: string;
  chapter?: string;
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
    CS_CASEID: props.csCaseId,
    COURT_ID: props.courtId,
    PY_ROLE: props.role,
    PY_LAST_NAME: isCompany ? faker.company.name() : faker.person.lastName(),
    PY_MIDDLE_NAME: isCompany ? undefined : faker.person.middleName(),
    PY_FIRST_NAME: isCompany ? undefined : faker.person.firstName(),
    PY_GENERATION: isCompany ? undefined : faker.person.suffix(),
    PY_TAXID:
      isCompany && props.chapter !== '15'
        ? faker.number.int({ min: 10, max: 99 }) +
          '-' +
          faker.number.int({ min: 1000000, max: 9999999 })
        : undefined,
    PY_SSN:
      isCompany || props.chapter === '15'
        ? undefined
        : faker.number.int({ min: 100, max: 999 }) +
          '-' +
          faker.number.int({ min: 10, max: 99 }) +
          '-' +
          faker.number.int({ min: 1000, max: 9999 }),
    PY_ADDRESS1: faker.location.streetAddress(),
    PY_ADDRESS2: randomTruth() ? faker.location.secondaryAddress() : undefined,
    PY_ADDRESS3,
    PY_CITY,
    PY_STATE,
    PY_ZIP: faker.location.zipCode(),
    PY_COUNTRY: randomTruth() ? faker.location.countryCode('alpha-2') : faker.location.country(),
    PY_PHONENO: faker.phone.number(),
    PY_FAX_PHONE: faker.phone.number(),
    PY_E_MAIL: faker.internet.email(),
    PY_PROSE: 'n',
  };
}

async function main() {
  const caseParties: Array<AO_PY_Record> = [];

  const rl = readline.createInterface({
    input: process.stdin,
  });

  for await (const line of rl) {
    const [csCaseId, courtId, role, chapter] = line.split(',');
    caseParties.push(new AO_PY_Record(partyGenerator({ csCaseId, courtId, role, chapter })));
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

(async () => {
  if (process.stdin.isTTY) {
    console.log('Expecting piped input in the format of CS Case Id, court ID, role per line.');
    return 1;
  }
  main();
})();

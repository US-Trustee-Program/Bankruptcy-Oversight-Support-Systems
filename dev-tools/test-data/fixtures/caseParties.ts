import { AO_PY_Record, AO_PY_RecordProps, toAoPyInsertStatements } from '../tables/AO_PY';
import { faker } from '@faker-js/faker';
import readline from 'node:readline';

interface partyGeneratorProps {
  csCaseId: string;
  courtId: string;
  role?: string;
  chapter?: string;
}

function partyGenerator(props: partyGeneratorProps): AO_PY_RecordProps {
  const isCompany = Math.random() >= 0.5 ? 1 : 0;
  if (!props.chapter) props.chapter = '15';
  return {
    CS_CASEID: props.csCaseId,
    COURT_ID: props.courtId ?? '0208',
    PY_ROLE: props.role ?? 'DB',
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
    PY_CITY: faker.location.city(),
    PY_STATE: 'NY',
    PY_ZIP: faker.location.zipCode(),
    PY_COUNTRY: 'USA',
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
    const [csCaseId, courtId] = line.split(',');
    caseParties.push(new AO_PY_Record(partyGenerator({ csCaseId, courtId })));
  }

  toAoPyInsertStatements(caseParties).forEach((statement) => {
    console.log(statement.trim());
  });
}

(async () => {
  if (process.stdin.isTTY) {
    console.log('Expecting piped input in the format of CS Case Id, court ID per line.');
    return 1;
  }
  main();
})();

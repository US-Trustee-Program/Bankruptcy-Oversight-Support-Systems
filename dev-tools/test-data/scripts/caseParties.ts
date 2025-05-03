import { faker } from '@faker-js/faker';
import readline from 'node:readline';

import { AO_PY_Record, AO_PY_RecordProps, toAoPyInsertStatements } from '../tables/AO_PY';

interface partyGeneratorProps {
  chapter?: string;
  courtId: string;
  csCaseId: string;
  role?: string;
}

async function main() {
  const caseParties: Array<AO_PY_Record> = [];

  const rl = readline.createInterface({
    input: process.stdin,
  });

  for await (const line of rl) {
    const [csCaseId, courtId] = line.split(',');
    caseParties.push(new AO_PY_Record(partyGenerator({ courtId, csCaseId })));
  }

  toAoPyInsertStatements(caseParties).forEach((statement) => {
    console.log(statement.trim());
  });
}

function partyGenerator(props: partyGeneratorProps): AO_PY_RecordProps {
  const isCompany = Math.random() >= 0.5 ? 1 : 0;
  if (!props.chapter) props.chapter = '15';
  return {
    COURT_ID: props.courtId ?? '0208',
    CS_CASEID: props.csCaseId,
    PY_ADDRESS1: faker.location.streetAddress(),
    PY_CITY: faker.location.city(),
    PY_COUNTRY: 'USA',
    PY_E_MAIL: faker.internet.email(),
    PY_FAX_PHONE: faker.phone.number(),
    PY_FIRST_NAME: isCompany ? undefined : faker.person.firstName(),
    PY_GENERATION: isCompany ? undefined : faker.person.suffix(),
    PY_LAST_NAME: isCompany ? faker.company.name() : faker.person.lastName(),
    PY_MIDDLE_NAME: isCompany ? undefined : faker.person.middleName(),
    PY_PHONENO: faker.phone.number(),
    PY_PROSE: 'n',
    PY_ROLE: props.role ?? 'DB',
    PY_SSN:
      isCompany || props.chapter === '15'
        ? undefined
        : faker.number.int({ max: 999, min: 100 }) +
          '-' +
          faker.number.int({ max: 99, min: 10 }) +
          '-' +
          faker.number.int({ max: 9999, min: 1000 }),
    PY_STATE: 'NY',
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
    console.log('Expecting piped input in the format of CS Case Id, court ID per line.');
    return 1;
  }
  main();
})();

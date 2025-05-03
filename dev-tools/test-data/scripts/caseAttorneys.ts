import { fakerEN_US as faker } from '@faker-js/faker';
import readline from 'node:readline';

import { AO_AT_Record, AO_AT_RecordProps, toAoAtInsertStatements } from '../tables/AO_AT';
import { randomTruth } from '../utility';

interface attorneyGeneratorProps {
  chapter?: string;
  courtId: string;
  csCaseId: string;
  role?: string;
}

function attorneyGenerator(props: attorneyGeneratorProps): AO_AT_RecordProps {
  if (!props.chapter) props.chapter = '15';
  const AT_LAST_NAME = faker.person.lastName();
  const AT_OFFICE = AT_LAST_NAME + ', PLC';
  return {
    AT_ADDRESS1: faker.location.streetAddress(),
    AT_ADDRESS2: randomTruth() ? faker.location.secondaryAddress() : undefined,
    AT_CITY: faker.location.city(),
    AT_COUNTRY: 'US',
    AT_E_MAIL: faker.internet.email(),
    AT_FAX_PHONE: faker.phone.number(),
    AT_FIRST_NAME: faker.person.firstName(),
    AT_GENERATION: randomTruth() ? 'JD' : 'Esq.',
    AT_LAST_NAME,
    AT_MIDDLE_NAME: faker.person.middleName(),
    AT_OFFICE,
    AT_PHONENO: faker.phone.number(),
    AT_STATE: faker.location.state({ abbreviated: true }),
    AT_ZIP: faker.location.zipCode(),
    COURT_ID: props.courtId ?? '0208',
    CS_CASEID: props.csCaseId,
    PY_ROLE: props.role ?? 'DB',
  };
}

async function main() {
  const caseParties: Array<AO_AT_Record> = [];

  const rl = readline.createInterface({
    input: process.stdin,
  });

  for await (const line of rl) {
    const [csCaseId, courtId] = line.split(',');
    caseParties.push(new AO_AT_Record(attorneyGenerator({ courtId, csCaseId })));
  }

  toAoAtInsertStatements(caseParties).forEach((statement) => {
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

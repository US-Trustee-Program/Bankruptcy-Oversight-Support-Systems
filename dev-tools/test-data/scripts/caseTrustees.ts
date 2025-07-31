import { AO_PY_Record, AO_PY_RecordProps, toAoPyInsertStatements } from '../tables/AO_PY';
import { faker } from '@faker-js/faker';
import readline from 'node:readline';

interface partyGeneratorProps {
  csCaseId: string;
  courtId: string;
  role?: string;
  chapter?: string;
}

function generateTrustee(): Partial<AO_PY_RecordProps> {
  return {
    PY_ROLE: 'TR',
    PY_LAST_NAME: faker.person.lastName(),
    PY_FIRST_NAME: faker.person.firstName(),
    PY_MIDDLE_NAME: '',
    PY_GENERATION: '',
    PY_ADDRESS1: faker.location.streetAddress(),
    PY_CITY: faker.location.city(),
    PY_STATE: faker.location.state({ abbreviated: true }),
    PY_ZIP: faker.location.zipCode(),
    PY_COUNTRY: 'USA',
    PY_PHONENO: faker.phone.number({ style: 'national' }),
    PY_FAX_PHONE: faker.phone.number({ style: 'national' }),
    PY_E_MAIL: faker.internet.email(),
  };
}

function recordGenerator(props: partyGeneratorProps, trustee: object): AO_PY_RecordProps {
  if (!props.chapter) {
    props.chapter = '15';
  }
  return {
    CS_CASEID: props.csCaseId,
    COURT_ID: props.courtId ?? '0208',
    PY_TAXID: undefined,
    PY_SSN: undefined,
    PY_PROSE: 'n',
    ...trustee,
  } as AO_PY_RecordProps;
}

async function main() {
  const caseParties: Array<AO_PY_Record> = [];

  const rl = readline.createInterface({
    input: process.stdin,
  });

  const trustees = [generateTrustee(), generateTrustee(), generateTrustee()];

  for await (const line of rl) {
    const [csCaseId, courtId] = line.split(',');
    const randomTrustee = trustees[Math.floor(Math.random() * trustees.length)];
    caseParties.push(new AO_PY_Record(recordGenerator({ csCaseId, courtId }, randomTrustee)));
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

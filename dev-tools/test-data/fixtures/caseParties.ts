import { AO_PY_Record, AO_PY_RecordProps } from '../tables/AO_PY';
import { faker } from '@faker-js/faker';

function partyGenerator(csCaseId: string): AO_PY_RecordProps {
  const isCompany = Math.random() >= 0.5 ? 1 : 0;
  return {
    CS_CASEID: csCaseId,
    COURT_ID: '0208',
    PY_ROLE: 'DB',
    PY_LAST_NAME: isCompany ? faker.company.name() : faker.person.lastName(),
    PY_MIDDLE_NAME: isCompany ? '' : faker.person.middleName(),
    PY_FIRST_NAME: isCompany ? '' : faker.person.firstName(),
    PY_GENERATION: isCompany ? '' : faker.person.suffix(),
    PY_TAXID: isCompany
      ? faker.number.int({ min: 10, max: 99 }) +
        '-' +
        faker.number.int({ min: 1000000, max: 9999999 })
      : '',
    PY_SSN: isCompany
      ? ''
      : faker.number.int({ min: 100, max: 999 }) +
        '-' +
        faker.number.int({ min: 10, max: 99 }) +
        '-' +
        faker.number.int({ min: 1000, max: 9999 }),
    PY_ADDRESS1: faker.location.streetAddress(),
    PY_ADDRESS2: '',
    PY_ADDRESS3: '',
    PY_CITY: faker.location.city(),
    PY_STATE: 'NY',
    PY_ZIP: faker.location.zipCode(),
    PY_COUNTRY: 'USA',
    PY_PHONENO: faker.phone.number(),
    PY_FAX_PHONE: faker.phone.number(),
    PY_E_MAIL: faker.internet.email(),
    PY_PROSE: 'n',
    PY_END_DATE: '',
    SSN_EVENT: '',
    NAME_EVENT: '',
    ADDRESS_EVENT: '',
  };
}

export function caseParties(csCaseIds: string[]) {
  const caseParties: Array<AO_PY_Record> = [];

  csCaseIds.forEach((csCaseId) => {
    caseParties.push(new AO_PY_Record(partyGenerator(csCaseId)));
  });

  return caseParties;
}

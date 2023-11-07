import { BCase, BCaseParty, DebtorAttorney } from '../domain/bcase';
import { concatenateName, getFakerLocale, randomTruth } from '../utility';

export function generateCases(caseCount: number): Array<BCase> {
  const bCases: Array<BCase> = [];
  let i = 0;
  while (i < caseCount) {
    bCases.push(generateCase(100000 + i, 10000 + i));
    i++;
  }
  return bCases;
}

function generateCase(dxtrId: number, caseId: number): BCase {
  const isCompany = randomTruth();

  const county = 'NEW YORK-NY';
  const courtId = '0208';
  const group = 'NY';
  const div = '081';
  const reopenCode = '1';

  const chapter = '15'; // TODO: Externalize

  const debtor = generateDebtor(isCompany, chapter);
  const debtorAttorney = generateAttorney();

  return {
    dxtrId: dxtrId.toString(),
    caseId: '11-' + caseId,
    shortTitle: isCompany ? debtor.lastName : concatenateName(debtor) || '',
    chapter,
    county,
    group,
    div,
    courtId,
    reopenCode,
    transactions: [],
    debtor,
    debtorAttorney,
    dateFiled: '2023-02-15',
  };
}

function generateDebtor(isCompany: boolean, chapter: string): BCaseParty {
  const faker = getFakerLocale();
  const fakerState = faker.location.state({ abbreviated: true });
  const state = fakerState.length === 2 ? fakerState : undefined; // LIMITED TO 2 CHARACTERS
  const city = faker.location.city();
  const address3 = state ? undefined : [faker.location.county(), faker.location.state()].join(', ');

  return {
    role: 'DB',
    lastName: isCompany ? faker.company.name() : faker.person.lastName(),
    middleName: isCompany ? undefined : faker.person.middleName(),
    firstName: isCompany ? undefined : faker.person.firstName(),
    generation: isCompany ? undefined : faker.person.suffix(),
    taxId:
      isCompany && chapter !== '15'
        ? faker.number.int({ min: 10, max: 99 }) +
          '-' +
          faker.number.int({ min: 1000000, max: 9999999 })
        : undefined,
    ssn:
      isCompany || chapter === '15'
        ? undefined
        : faker.number.int({ min: 100, max: 999 }) +
          '-' +
          faker.number.int({ min: 10, max: 99 }) +
          '-' +
          faker.number.int({ min: 1000, max: 9999 }),
    address1: faker.location.streetAddress(),
    address2: faker.location.secondaryAddress(),
    address3,
    city,
    state,
    zip: faker.location.zipCode(),
    country: faker.location.country(),
    phone: faker.phone.number(),
    fax: faker.phone.number(),
    email: faker.internet.email(),
    prose: 'n',
  };
}

function generateAttorney(): DebtorAttorney {
  const faker = getFakerLocale();
  const fakerState = faker.location.state({ abbreviated: true });
  const state = fakerState.length === 2 ? fakerState : undefined; // LIMITED TO 2 CHARACTERS
  const city = faker.location.city();
  const address3 = state ? undefined : [faker.location.county(), faker.location.state()].join(', ');

  return {
    lastName: faker.person.lastName(),
    middleName: faker.person.middleName(),
    firstName: faker.person.firstName(),
    generation: faker.person.suffix(),
    address1: faker.location.streetAddress(),
    address2: faker.location.secondaryAddress(),
    address3,
    city,
    state,
    zip: faker.location.zipCode(),
    country: faker.location.country(),
    phone: faker.phone.number(),
  };
}

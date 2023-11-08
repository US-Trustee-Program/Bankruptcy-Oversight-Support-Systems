import { Faker, fakerEN_GB, fakerEN_US, fakerES_MX } from '@faker-js/faker';
import { concatenateName, randomInt, randomTruth } from '../../utility';
import { BCase, BCaseParty, DebtorAttorney, Judge } from '../../domain/bcase';
import { Chapter } from '../../types';

const DEFAULT_CHAPTER: Chapter = '15';

export function getFakerLocale(): Faker {
  const locales = [
    { faker: fakerEN_US, countryCode: 'US', countryName: 'United States' },
    { faker: fakerEN_GB, countryCode: 'UK', countryName: 'United Kingdom' },
    { faker: fakerES_MX, countryCode: 'MX', countryName: 'Mexico' },
  ];
  const { faker, countryCode, countryName } = locales[randomInt(locales.length)];
  faker.location.countryCode = () => {
    return countryCode;
  };
  faker.location.country = () => {
    return countryName;
  };
  return faker;
}

export function generateFakeDxtrId() {
  return '123456';
}

export function generateFakeCaseId() {
  return '00-12345';
}

export interface CreateCaseOptions {
  chapter?: Chapter;
  judges?: Array<Judge>;
  attorneys?: Array<DebtorAttorney>;
  isCompany?: boolean;
}

export function createCases(caseCount: number, options: CreateCaseOptions): Array<BCase> {
  const bCases: Array<BCase> = [];
  for (let _ = 0; _ < caseCount; _++) {
    bCases.push(createCase(options));
  }
  return bCases;
}

export function createCase(options: CreateCaseOptions = {}): BCase {
  // TODO: Make these options / externalize them.
  const county = 'NEW YORK-NY';
  const courtId = '0208';
  const group = 'NY';
  const div = '081';
  const reopenCode = '1';

  const isCompany = options.isCompany === undefined ? randomTruth() : options.isCompany;
  const debtor = createDebtor(isCompany, options.chapter || DEFAULT_CHAPTER);
  const debtorAttorney = options.attorneys
    ? options.attorneys[randomInt(options.attorneys.length)]
    : createAttorney();

  const judge = options.judges ? options.judges[randomInt(options.judges.length)] : undefined;

  return {
    dxtrId: generateFakeDxtrId(),
    caseId: generateFakeCaseId(),
    shortTitle: isCompany ? debtor.lastName : concatenateName(debtor) || '',
    chapter: options.chapter || DEFAULT_CHAPTER,
    county,
    group,
    div,
    courtId,
    judge,
    reopenCode,
    transactions: [],
    debtor,
    debtorAttorney,
    dateFiled: '2023-02-15',
  };
}

export function createDebtor(isCompany: boolean, chapter: string): BCaseParty {
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

export function createAttorney(): DebtorAttorney {
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

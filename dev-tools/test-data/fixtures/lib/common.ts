import { Faker, fakerEN_GB, fakerEN_US, fakerES_MX } from '@faker-js/faker';
import { concatenateName, randomInt, randomTruth } from '../../utility';
import { BCase, BCaseParty, DebtorAttorney, Judge } from '../../domain/bcase';
import { Chapter } from '../../types';
import { Court } from '../../domain/court';
import { courts } from '../courts';

const DEFAULT_CHAPTER: Chapter = '15';

export function buildArray<T = unknown>(fn: () => T, size: number): Array<T> {
  const arr = [];
  for (let i = 0; i < size; i++) {
    arr.push(fn());
  }
  return arr;
}

export function getFakerLocale(useForeignLocales: boolean = false): Faker {
  const locales = [{ faker: fakerEN_US, countryCode: 'US', countryName: 'United States' }];
  if (useForeignLocales) {
    locales.push({ faker: fakerEN_GB, countryCode: 'UK', countryName: 'United Kingdom' });
    locales.push({ faker: fakerES_MX, countryCode: 'MX', countryName: 'Mexico' });
  }
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
  return '' + ('999999' + randomInt(99999)).slice(-6);
}

function generateFakeCaseId() {
  return '99-' + ('00000' + randomInt(99999)).slice(-5);
}

export interface CreateCaseOptions {
  chapters?: Chapter[];
  judges?: Array<Judge>;
  attorneys?: Array<DebtorAttorney>;
  isCompany?: boolean;
  courts?: Array<Court>;
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
  const chapter: Chapter = options.chapters
    ? options.chapters[randomInt(options.chapters.length)]
    : DEFAULT_CHAPTER;
  const court = courts[randomInt(courts.length)];
  const county = court.county;
  const courtId = court.id;
  const group = court.group.id;
  const div = court.div;
  const reopenCode = '1';

  const isCompany = options.isCompany === undefined ? randomTruth() : options.isCompany;
  const debtor = createDebtor(isCompany, chapter);
  const debtorAttorney = options.attorneys
    ? options.attorneys[randomInt(options.attorneys.length)]
    : createAttorney();

  const judge = options.judges ? options.judges[randomInt(options.judges.length)] : undefined;

  return {
    dxtrId: generateFakeDxtrId(),
    caseId: generateFakeCaseId(),
    shortTitle: isCompany ? debtor.lastName : concatenateName(debtor) || '',
    chapter,
    county,
    group,
    div,
    courtId,
    judge,
    reopenCode,
    transactions: [],
    debtorType: isCompany ? 'CB' : chapter === '15' ? 'FD' : 'IC',
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

export function createJudge() {
  const faker = getFakerLocale();
  return {
    lastName: faker.person.lastName(),
    firstName: faker.person.firstName(),
  };
}

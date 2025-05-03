import { Faker, fakerEN_GB, fakerEN_US, fakerES_MX } from '@faker-js/faker';

import { BCase, BCaseParty, DebtorAttorney, Judge } from '../../domain/bcase';
import { Court } from '../../domain/court';
import { Chapter } from '../../types';
import { concatenateName, randomInt, randomTruth } from '../../utility';
import { courts } from '../courts';

const DEFAULT_CHAPTER: Chapter = '15';

export interface CreateCaseOptions {
  attorneys?: Array<DebtorAttorney>;
  chapters?: Chapter[];
  courts?: Array<Court>;
  isCompany?: boolean;
  judges?: Array<Judge>;
}

export function buildArray<T = unknown>(fn: () => T, size: number): Array<T> {
  const arr = [];
  for (let i = 0; i < size; i++) {
    arr.push(fn());
  }
  return arr;
}

export function createAttorney(): DebtorAttorney {
  const faker = getFakerLocale();
  const fakerState = faker.location.state({ abbreviated: true });
  const state = fakerState.length === 2 ? fakerState : undefined; // LIMITED TO 2 CHARACTERS
  const city = faker.location.city();
  const address3 = state ? undefined : [faker.location.county(), faker.location.state()].join(', ');

  return {
    address1: faker.location.streetAddress(),
    address2: faker.location.secondaryAddress(),
    address3,
    city,
    country: faker.location.country(),
    firstName: faker.person.firstName(),
    generation: faker.person.suffix(),
    lastName: faker.person.lastName(),
    middleName: faker.person.middleName(),
    phone: faker.phone.number(),
    state,
    zip: faker.location.zipCode(),
  };
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
    caseId: generateFakeCaseId(),
    chapter,
    county,
    courtId,
    dateFiled: '2023-02-15',
    debtor,
    debtorAttorney,
    debtorType: isCompany ? 'CB' : chapter === '15' ? 'FD' : 'IC',
    div,
    dxtrId: generateFakeDxtrId(),
    group,
    judge,
    reopenCode,
    shortTitle: isCompany ? debtor.lastName : concatenateName(debtor) || '',
    transactions: [],
  };
}

export function createCases(caseCount: number, options: CreateCaseOptions): Array<BCase> {
  const bCases: Array<BCase> = [];
  for (let _ = 0; _ < caseCount; _++) {
    bCases.push(createCase(options));
  }
  return bCases;
}

export function createDebtor(isCompany: boolean, chapter: string): BCaseParty {
  const faker = getFakerLocale();
  const fakerState = faker.location.state({ abbreviated: true });
  const state = fakerState.length === 2 ? fakerState : undefined; // LIMITED TO 2 CHARACTERS
  const city = faker.location.city();
  const address3 = state ? undefined : [faker.location.county(), faker.location.state()].join(', ');

  return {
    address1: faker.location.streetAddress(),
    address2: faker.location.secondaryAddress(),
    address3,
    city,
    country: faker.location.country(),
    email: faker.internet.email(),
    fax: faker.phone.number(),
    firstName: isCompany ? undefined : faker.person.firstName(),
    generation: isCompany ? undefined : faker.person.suffix(),
    lastName: isCompany ? faker.company.name() : faker.person.lastName(),
    middleName: isCompany ? undefined : faker.person.middleName(),
    phone: faker.phone.number(),
    prose: 'n',
    role: 'DB',
    ssn:
      isCompany || chapter === '15'
        ? undefined
        : faker.number.int({ max: 999, min: 100 }) +
          '-' +
          faker.number.int({ max: 99, min: 10 }) +
          '-' +
          faker.number.int({ max: 9999, min: 1000 }),
    state,
    taxId:
      isCompany && chapter !== '15'
        ? faker.number.int({ max: 99, min: 10 }) +
          '-' +
          faker.number.int({ max: 9999999, min: 1000000 })
        : undefined,
    zip: faker.location.zipCode(),
  };
}

export function createJudge() {
  const faker = getFakerLocale();
  return {
    firstName: faker.person.firstName(),
    lastName: faker.person.lastName(),
  };
}

export function generateFakeDxtrId() {
  return '' + ('999999' + randomInt(99999)).slice(-6);
}

export function getFakerLocale(useForeignLocales: boolean = false): Faker {
  const locales = [{ countryCode: 'US', countryName: 'United States', faker: fakerEN_US }];
  if (useForeignLocales) {
    locales.push({ countryCode: 'UK', countryName: 'United Kingdom', faker: fakerEN_GB });
    locales.push({ countryCode: 'MX', countryName: 'Mexico', faker: fakerES_MX });
  }
  const { countryCode, countryName, faker } = locales[randomInt(locales.length)];
  faker.location.countryCode = () => {
    return countryCode;
  };
  faker.location.country = () => {
    return countryName;
  };
  return faker;
}

function generateFakeCaseId() {
  return '99-' + ('00000' + randomInt(99999)).slice(-5);
}

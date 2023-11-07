// Import fixtures to generate.
import { generateCases } from '../fixtures/chapter15Cases';
import { BCase } from '../domain/bcase';
import { CaseDetailInterface } from '../cases';
import { concatenateCityStateZipCountry, concatenateName } from '../utility';

const generate10Cases = () => {
  return generateCases(10);
};

// Add fixture functions to this list to include them in the generated SQL.
const fixturesToCreate = [generate10Cases];

// Generate all the fixtures.
const bCases: Array<BCase> = [];
fixturesToCreate.forEach((fixtureFn) => {
  bCases.push(...fixtureFn());
});

const mappedCases = bCases.map((bCase) => {
  const mappedCase: CaseDetailInterface = {
    caseId: bCase.div + '-' + bCase.caseId,
    chapter: bCase.chapter,
    caseTitle: bCase.shortTitle,
    dateFiled: bCase.dateFiled,
  };
  const debtor = bCase.debtor;
  mappedCase.debtor = {
    name: concatenateName(debtor) || '',
    address1: debtor.address1,
    address2: debtor.address2,
    address3: debtor.address3,
    cityStateZipCountry: concatenateCityStateZipCountry(debtor),
    ssn: debtor.ssn,
    taxId: debtor.taxId,
  };

  const attorney = bCase.debtorAttorney;
  mappedCase.debtorAttorney = {
    name: concatenateName(attorney) || '',
    address1: attorney.address1,
    address2: attorney.address2,
    address3: attorney.address3,
    cityStateZipCountry: concatenateCityStateZipCountry(attorney),
    phone: attorney.phone,
  };

  return mappedCase;
});

console.log(JSON.stringify(mappedCases));

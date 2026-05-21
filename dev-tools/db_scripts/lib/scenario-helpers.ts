import type { GeneratedCaseId } from '../../runner.js';

export function buildCaseSummary(
  ids: GeneratedCaseId,
  chapter: string,
  caseTitle: string,
  debtorName: string,
): Record<string, unknown> {
  return {
    caseId: ids.caseId,
    dxtrId: ids.csCaseId,
    chapter,
    caseTitle,
    caseNumber: ids.caseNumber.split('-')[1],
    dateFiled: '2025-01-15',
    officeName: 'Manhattan',
    officeCode: 'USTP_CAMS_Region_2_Office_081',
    courtId: '0208',
    courtName: 'U.S. Bankruptcy Court Southern District of New York',
    courtDivisionCode: '081',
    courtDivisionName: 'Manhattan',
    groupDesignator: 'NY',
    regionId: '02',
    regionName: 'NEW YORK',
    debtor: {
      name: debtorName,
      address1: '100 Test Street',
      cityStateZipCountry: 'New York, NY 10001',
    },
  };
}

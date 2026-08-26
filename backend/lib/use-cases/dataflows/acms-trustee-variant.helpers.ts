import { formatCityStateZipCountry } from '../../adapters/utils/string-helper';
import { AcmsTrusteeProfessionalDetailRecord } from '../gateways.types';

function rawField(value: string | undefined): string {
  return value ?? '';
}

/**
 * Formats CMMPR's PROF_ZIP (a NUMERIC(9,0) column documented as always holding the full 9-digit
 * USPS zip) into standard "NNNNN-NNNN" form. The raw numeric value drops any leading zeros (e.g.
 * New Haven CT's 065110000 arrives as 65110000), so this zero-pads to 9 digits before splitting
 * 5+4, rather than assuming the value is already 9 digits wide - it does NOT handle a genuine
 * bare 5-digit value, since the column is documented as never holding one. A missing/zero value
 * means no zip was ever recorded in ACMS (the column's DEFAULT) — not a real "00000" zip — so it
 * maps to undefined instead of a fake, confidently-wrong 5-digit string that would otherwise
 * silently corrupt address matching.
 */
export function formatAcmsZip(zip: number | undefined): string | undefined {
  if (!zip) return undefined;
  const padded = String(zip).padStart(9, '0');
  return `${padded.slice(0, 5)}-${padded.slice(5)}`;
}

export function buildAcmsVariant(record: AcmsTrusteeProfessionalDetailRecord): string {
  const shape = {
    firstName: rawField(record.firstName),
    middleName: rawField(record.middleInitial),
    lastName: rawField(record.lastName),
    generation: '',
    address1: rawField(record.address1),
    address2: rawField(record.address2),
    address3: '',
    cityStateZipCountry: rawField(
      formatCityStateZipCountry(record.city, record.state, formatAcmsZip(record.zip), undefined),
    ),
    phone: rawField(record.phone),
    fax: rawField(record.fax),
    email: '',
  };
  return JSON.stringify(shape);
}

import { formatCityStateZipCountry } from '../../adapters/utils/string-helper';
import { AcmsTrusteeProfessionalDetailRecord } from '../gateways.types';

function rawField(value: string | undefined): string {
  return value ?? '';
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
      formatCityStateZipCountry(record.city, record.state, record.zip, undefined),
    ),
    phone: rawField(record.phone),
    fax: rawField(record.fax),
    email: '',
  };
  return JSON.stringify(shape);
}

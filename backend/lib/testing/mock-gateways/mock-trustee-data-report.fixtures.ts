import { Trustee } from '@common/cams/trustees';
import { TrusteeAppointment } from '@common/cams/trustee-appointments';
import { mockAtsTrusteeRecord } from '../../adapters/gateways/ats/ats.mock.gateway';
import { transformTrusteeRecord } from '../../adapters/gateways/ats/cleansing/ats-mappings';

// CAMS trustees for the in-memory (dbMock) trustees repository, linked to MockAtsGateway's TOD
// pool (IDs 1-6; 6 has no active appointment). A local trustee data report run over them finds:
//   - no difference for TOD 1, and none for TOD 3, whose phone differs only in formatting
//   - a phone difference for TOD 2
//   - TOD 4 and 5 as TOD-only; TOD 6 is unlinked but out of scope
//   - two CAMS-only trustees: one with no TOD IDs, one linked only to a TOD ID that does not exist
// and, against MockAtsGateway's report appointment rows (MOCK_REPORT_APPOINTMENT_ROWS):
//   - TOD 1's chapter 7 panel narrowed to division 081 in CAMS
//   - TOD 2's chapter 7 panel with a different appointed date, and a chapter 13 standing
//     appointment in CAMS only
//   - TOD 3's chapter 7 panel in TOD only
//   - 8 TOD appointments not translated, the other mock rows of TOD 1-3

const AUDIT = {
  updatedOn: '2026-11-17T00:00:00.000Z',
  updatedBy: { id: 'SEED', name: 'Mock Data' },
};

function linkedTo(todId: number, trusteeId: string, phone?: string): Trustee {
  const input = transformTrusteeRecord(mockAtsTrusteeRecord(todId));
  return {
    ...AUDIT,
    id: trusteeId,
    trusteeId,
    firstName: input.firstName,
    middleName: input.middleName,
    lastName: input.lastName,
    name: input.name,
    public: phone ? { ...input.public, phone: { number: phone } } : input.public,
    internal: input.internal,
    legacy: { truIds: [String(todId)] },
  };
}

function unlinked(trusteeId: string, name: string, truIds?: string[]): Trustee {
  return {
    ...AUDIT,
    id: trusteeId,
    trusteeId,
    firstName: name,
    lastName: 'Mocktrustee',
    name: `${name} Mocktrustee`,
    public: {
      address: {
        address1: '1 Mock Way',
        city: 'Springfield',
        state: 'IL',
        zipCode: '62701',
        countryCode: 'US',
      },
    },
    legacy: truIds ? { truIds } : undefined,
  };
}

export const MOCK_TRUSTEES_LINKED_TO_MOCK_TOD: Trustee[] = [
  linkedTo(1, 'mock-tdr-unchanged'),
  linkedTo(2, 'mock-tdr-changed-phone', '555-010-0199'),
  linkedTo(3, 'mock-tdr-phone-formatting', '(555) 0003'),
  unlinked('mock-tdr-no-tod-ids', 'Nolink'),
  unlinked('mock-tdr-missing-in-tod', 'Gone', ['99']),
];

function sdnyAppointment(
  id: string,
  trusteeId: string,
  override: Partial<TrusteeAppointment>,
): TrusteeAppointment {
  return {
    ...AUDIT,
    id,
    trusteeId,
    chapter: '7',
    appointmentType: 'panel',
    courtId: '0208',
    divisionCodes: ['081', '084', '087'],
    appointedDate: '2015-03-01',
    status: 'active',
    effectiveDate: '2015-03-01',
    createdOn: AUDIT.updatedOn,
    createdBy: AUDIT.updatedBy,
    ...override,
  };
}

export const MOCK_CAMS_APPOINTMENTS_FOR_MOCK_TOD: TrusteeAppointment[] = [
  sdnyAppointment('mock-tdr-appointment-narrowed', 'mock-tdr-unchanged', {
    divisionCodes: ['081'],
  }),
  sdnyAppointment('mock-tdr-appointment-date', 'mock-tdr-changed-phone', {
    appointedDate: '2016-04-02',
    effectiveDate: '2016-04-01',
  }),
  sdnyAppointment('mock-tdr-appointment-cams-only', 'mock-tdr-changed-phone', {
    chapter: '13',
    appointmentType: 'standing',
  }),
];

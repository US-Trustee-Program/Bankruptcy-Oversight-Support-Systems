import { Trustee } from '@common/cams/trustees';
import { mockAtsTrusteeRecord } from '../../adapters/gateways/ats/ats.mock.gateway';
import { transformTrusteeRecord } from '../../adapters/gateways/ats/cleansing/ats-mappings';

// CAMS trustees for the in-memory (dbMock) trustees repository, linked to MockAtsGateway's TOD
// pool (IDs 1-6; 6 has no active appointment). A local trustee data report run over them finds:
//   - no difference for TOD 1, and none for TOD 3, whose phone differs only in formatting
//   - a phone difference for TOD 2
//   - TOD 4 and 5 as TOD-only; TOD 6 is unlinked but out of scope
//   - two CAMS-only trustees: one with no TOD IDs, one linked only to a TOD ID that does not exist

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

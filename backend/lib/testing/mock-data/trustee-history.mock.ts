import { SYSTEM_USER_REFERENCE } from '../../../../common/src/cams/auditable';
import { TrusteeHistory } from '../../../../common/src/cams/trustees';
import MockData from '../../../../common/src/cams/test-utilities/mock-data';

export const TRUSTEE_HISTORY: TrusteeHistory[] = [
  {
    id: '7d4e2a0b-c39a-4f57-b2c6-ea1fc3c61488',
    documentType: 'AUDIT_NAME',
    updatedOn: '2023-12-14T21:39:18.909Z',
    updatedBy: SYSTEM_USER_REFERENCE,
    before: 'John Doe',
    after: 'John M. Doe',
  },
  {
    id: 'a8f72c5d-6e94-4b1a-9d3e-8c7b59a23f01',
    documentType: 'AUDIT_PUBLIC_CONTACT',
    updatedOn: '2023-12-15T14:22:45.123Z',
    updatedBy: SYSTEM_USER_REFERENCE,
    before: {
      email: 'john.doe@example.com',
      phone: {
        number: '555-123-4567',
        extension: '101',
      },
      address: {
        address1: '123 Main St',
        city: 'Anytown',
        state: 'NY',
        zipCode: '10001',
        countryCode: 'US',
      },
    },
    after: {
      email: 'john.m.doe@example.com',
      phone: {
        number: '555-123-4567',
        extension: '101',
      },
      address: {
        address1: '456 Oak Ave',
        city: 'Newtown',
        state: 'NY',
        zipCode: '10002',
        countryCode: 'US',
      },
    },
  },
  {
    id: 'c6b3e9a2-7d51-48f9-b0e4-3a5c2d1f8e7a',
    documentType: 'AUDIT_INTERNAL_CONTACT',
    updatedOn: '2023-12-16T09:15:30.456Z',
    updatedBy: MockData.getCamsUserReference(),
    before: {
      email: 'internal.doe@example.org',
      phone: {
        number: '555-987-6543',
        extension: '202',
      },
      address: {
        address1: '789 Elm St',
        address2: 'Suite 100',
        city: 'Oldcity',
        state: 'NY',
        zipCode: '10003',
        countryCode: 'US',
      },
    },
    after: {
      email: 'internal.m.doe@example.org',
      phone: {
        number: '555-987-6543',
        extension: '303',
      },
      address: {
        address1: '789 Elm St',
        address2: 'Suite 200',
        city: 'Oldcity',
        state: 'NY',
        zipCode: '10003',
        countryCode: 'US',
      },
    },
  },
];

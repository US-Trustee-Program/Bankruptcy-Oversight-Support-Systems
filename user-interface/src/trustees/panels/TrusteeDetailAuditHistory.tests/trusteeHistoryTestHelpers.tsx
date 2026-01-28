import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import TrusteeDetailAuditHistory, {
  TrusteeDetailAuditHistoryProps,
} from '../TrusteeDetailAuditHistory';
import Api2 from '@/lib/models/api2';
import {
  TrusteeHistory,
  TrusteeNameHistory,
  TrusteePublicContactHistory,
  TrusteeInternalContactHistory,
  TrusteeAppointmentHistory,
  TrusteeZoomInfoHistory,
  ZoomInfo,
} from '@common/cams/trustees';
import { SYSTEM_USER_REFERENCE } from '@common/cams/auditable';
import { ContactInformation } from '@common/cams/contact';
import MockData from '@common/cams/test-utilities/mock-data';

// Constants
export const MOCK_TRUSTEE_ID = '12345';

export const BASE_ZOOM_INFO: ZoomInfo = {
  link: 'https://zoom.us/j/123456789',
  phone: '+1 555-123-4567',
  meetingId: '123 456 789',
  passcode: MockData.randomAlphaNumeric(10),
};

export const BASE_ZOOM_INFO_BEFORE: ZoomInfo = {
  link: 'https://zoom.us/j/111111111',
  phone: '+1 555-111-1111',
  meetingId: '111 111 111',
  passcode: MockData.randomAlphaNumeric(10),
};

const BASE_PUBLIC_CONTACT: ContactInformation = {
  email: 'test@example.com',
  phone: { number: '555-123-4567', extension: '123' },
  address: {
    address1: '123 Test St',
    address2: 'Suite 100',
    address3: '',
    city: 'Test City',
    state: 'NY',
    zipCode: '12345',
    countryCode: 'US',
  },
};

const BASE_INTERNAL_CONTACT: ContactInformation = {
  email: 'internal@example.com',
  phone: { number: '555-111-2222' },
  address: {
    address1: '789 Internal St',
    address2: '',
    address3: '',
    city: 'Internal City',
    state: 'TX',
    zipCode: '78901',
    countryCode: 'US',
  },
};

export let mockIdCounter = 1;

// Test Helpers
export function renderWithProps(props?: Partial<TrusteeDetailAuditHistoryProps>) {
  const defaultProps: TrusteeDetailAuditHistoryProps = {
    trusteeId: MOCK_TRUSTEE_ID,
  };
  const renderProps = { ...defaultProps, ...props };
  render(<TrusteeDetailAuditHistory {...renderProps} />);
}

export async function renderHistoryAndWaitForTable(history: TrusteeHistory[]) {
  vi.spyOn(Api2, 'getTrusteeHistory').mockResolvedValue({ data: history });
  renderWithProps({});
  return await screen.findByTestId('trustee-history-table');
}

// Factory Functions
export function createMockNameHistory(
  overrides: Partial<TrusteeNameHistory> = {},
): TrusteeNameHistory {
  const id = mockIdCounter++;
  return {
    id: `audit-${id}-id`,
    trusteeId: `audit-${id}`,
    documentType: 'AUDIT_NAME',
    before: 'John Smith',
    after: 'John Doe',
    updatedOn: '2024-01-15T10:00:00Z',
    updatedBy: SYSTEM_USER_REFERENCE,
    ...overrides,
  };
}

export function createMockPublicContactHistory(
  overrides: Partial<TrusteePublicContactHistory> = {},
): TrusteePublicContactHistory {
  const id = mockIdCounter++;
  const base: TrusteePublicContactHistory = {
    id: `audit-${id}-id`,
    trusteeId: `audit-${id}`,
    documentType: 'AUDIT_PUBLIC_CONTACT',
    before: { ...BASE_PUBLIC_CONTACT },
    after: {
      ...BASE_PUBLIC_CONTACT,
      email: 'updated@example.com',
      address: {
        ...BASE_PUBLIC_CONTACT.address,
        address1: '456 Updated St',
        city: 'Updated City',
      },
    },
    updatedOn: '2024-01-16T11:00:00Z',
    updatedBy: SYSTEM_USER_REFERENCE,
  };

  return { ...base, ...overrides };
}

export function createMockInternalContactHistory(
  overrides: Partial<TrusteeInternalContactHistory> = {},
): TrusteeInternalContactHistory {
  const id = mockIdCounter++;
  return {
    id: `audit-${id}-id`,
    trusteeId: `audit-${id}`,
    documentType: 'AUDIT_INTERNAL_CONTACT',
    before: undefined,
    after: { ...BASE_INTERNAL_CONTACT },
    updatedOn: '2024-01-17T12:00:00Z',
    updatedBy: {
      id: 'user-456',
      name: 'Jane Admin',
    },
    ...overrides,
  };
}

export function createMockAppointmentHistory(
  overrides: Partial<TrusteeAppointmentHistory> = {},
): TrusteeAppointmentHistory {
  const id = mockIdCounter++;
  return {
    id: `audit-${id}-id`,
    trusteeId: `audit-${id}`,
    documentType: 'AUDIT_APPOINTMENT',
    appointmentId: `appointment-${id}`,
    before: {
      chapter: '7',
      appointmentType: 'panel',
      courtId: '081',
      divisionCode: 'MAB',
      courtName: 'United States Bankruptcy Court - District of Massachusetts',
      courtDivisionName: 'Boston',
      appointedDate: '2023-01-15',
      status: 'active',
      effectiveDate: '2023-01-15',
    },
    after: {
      chapter: '11',
      appointmentType: 'case-by-case',
      courtId: '081',
      divisionCode: 'MAW',
      courtName: 'United States Bankruptcy Court - District of Massachusetts',
      courtDivisionName: 'Worcester',
      appointedDate: '2024-02-01',
      status: 'inactive',
      effectiveDate: '2024-02-15',
    },
    updatedOn: '2024-02-15T14:30:00Z',
    updatedBy: {
      id: 'user-789',
      name: 'Admin User',
    },
    ...overrides,
  };
}

export function createMockZoomInfoHistory(
  overrides: Partial<TrusteeZoomInfoHistory> = {},
): TrusteeZoomInfoHistory {
  const id = mockIdCounter++;
  return {
    id: `audit-${id}-id`,
    trusteeId: `audit-${id}`,
    documentType: 'AUDIT_ZOOM_INFO',
    before: BASE_ZOOM_INFO_BEFORE,
    after: BASE_ZOOM_INFO,
    updatedOn: '2024-01-23T10:00:00Z',
    updatedBy: SYSTEM_USER_REFERENCE,
    ...overrides,
  };
}

import { screen } from '@testing-library/react';
import { vi } from 'vitest';
import Api2 from '@/lib/models/api2';
import {
  TrusteeOversightHistory,
  TrusteeSoftwareHistory,
  TrusteeAssistantHistory,
} from '@common/cams/trustees';
import { SYSTEM_USER_REFERENCE } from '@common/cams/auditable';
import { CamsRole } from '@common/cams/roles';
import MockData from '@common/cams/test-utilities/mock-data';
import {
  renderWithProps,
  createMockNameHistory,
  createMockPublicContactHistory,
  createMockInternalContactHistory,
  createMockZoomInfoHistory,
} from './trusteeHistoryTestHelpers';

describe('TrusteeDetailAuditHistory - RenderTrusteeHistory Integration Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const mockNameHistory = createMockNameHistory();
  const mockPublicContactHistory = createMockPublicContactHistory();
  const mockInternalContactHistory = createMockInternalContactHistory();

  test('should render all history types through RenderTrusteeHistory component', async () => {
    const mockBankHistory = {
      id: 'audit-bank-1',
      trusteeId: 'trustee-1',
      documentType: 'AUDIT_BANKS' as const,
      before: ['Bank A'],
      after: ['Bank B'],
      updatedOn: '2024-01-20T10:00:00Z',
      updatedBy: SYSTEM_USER_REFERENCE,
    };

    const mockSoftwareHistory: TrusteeSoftwareHistory = {
      id: 'audit-software-1',
      trusteeId: 'trustee-1',
      documentType: 'AUDIT_SOFTWARE',
      before: 'Software A',
      after: 'Software B',
      updatedOn: '2024-01-21T15:30:00Z',
      updatedBy: SYSTEM_USER_REFERENCE,
    };

    const mockOversightHistory: TrusteeOversightHistory = {
      id: 'audit-oversight-1',
      trusteeId: 'trustee-1',
      documentType: 'AUDIT_OVERSIGHT',
      before: {
        role: CamsRole.OversightAttorney,
        user: { id: 'user-1', name: 'Attorney A' },
      },
      after: {
        role: CamsRole.OversightAttorney,
        user: { id: 'user-2', name: 'Attorney B' },
      },
      updatedOn: '2024-01-22T16:45:00Z',
      updatedBy: SYSTEM_USER_REFERENCE,
    };

    const mockZoomInfoHistory = createMockZoomInfoHistory({
      trusteeId: 'trustee-1',
      after: {
        link: 'https://zoom.us/j/999999999',
        phone: '+1 555-999-9999',
        meetingId: '999 999 999',
        passcode: MockData.randomAlphaNumeric(10),
      },
    });

    const mockAssistantHistory: TrusteeAssistantHistory = {
      id: 'audit-assistant-1',
      trusteeId: 'trustee-1',
      documentType: 'AUDIT_ASSISTANT',
      assistantId: 'assistant-after',
      before: MockData.getTrusteeAssistant({
        id: 'assistant-before',
        trusteeId: 'trustee-1',
        name: 'Jane Smith',
        contact: MockData.getContactInformation(),
      }),
      after: MockData.getTrusteeAssistant({
        id: 'assistant-after',
        trusteeId: 'trustee-1',
        name: 'Jane M. Smith',
        title: 'Senior Assistant',
        contact: MockData.getContactInformation(),
      }),
      updatedOn: '2024-01-10T10:00:00Z',
      updatedBy: MockData.getCamsUserReference({ name: 'User 8' }),
      createdOn: '2024-01-10T10:00:00Z',
      createdBy: MockData.getCamsUserReference({ name: 'User 8' }),
    };

    const allHistoryTypes = [
      mockNameHistory,
      mockPublicContactHistory,
      mockInternalContactHistory,
      mockBankHistory,
      mockSoftwareHistory,
      mockOversightHistory,
      mockZoomInfoHistory,
      mockAssistantHistory,
    ];

    vi.spyOn(Api2, 'getTrusteeHistory').mockResolvedValue({ data: allHistoryTypes });

    renderWithProps({});

    await screen.findByTestId('trustee-history-table');

    expect(screen.getByTestId('change-type-name-6')).toHaveTextContent('Name');
    expect(screen.getByTestId('change-type-public-contact-5')).toHaveTextContent('Public Contact');
    expect(screen.getByTestId('change-type-internal-contact-4')).toHaveTextContent(
      'Internal Contact',
    );
    expect(screen.getByTestId('change-type-banks-3')).toHaveTextContent('Bank(s)');
    expect(screen.getByTestId('change-type-software-2')).toHaveTextContent('Software');
    expect(screen.getByTestId('change-type-oversight-1')).toHaveTextContent('Oversight');
    expect(screen.getByTestId('change-type-zoom-info-0')).toHaveTextContent(
      '341 Meeting Zoom Info',
    );
    expect(screen.getByTestId('change-type-assistant-7')).toHaveTextContent('Assistant');

    expect(screen.getByTestId('previous-name-6')).toHaveTextContent('John Smith');
    expect(screen.getByTestId('previous-banks-3')).toHaveTextContent('Bank A');
    expect(screen.getByTestId('previous-software-2')).toHaveTextContent('Software A');
    expect(screen.getByTestId('previous-oversight-1')).toHaveTextContent('Attorney A');
    expect(screen.getByTestId('previous-zoom-info-0')).toHaveTextContent(
      'https://zoom.us/j/111111111',
    );
    expect(screen.getByTestId('previous-assistant-name-7')).toHaveTextContent('Jane Smith');
    expect(screen.getByTestId('new-assistant-name-7')).toHaveTextContent('Jane M. Smith');
    expect(screen.getByTestId('new-assistant-title-7')).toHaveTextContent('Senior Assistant');
  });

  test('should handle switch case default correctly for unknown document types', async () => {
    const validHistoryTypes = [
      createMockNameHistory(),
      createMockPublicContactHistory(),
      createMockInternalContactHistory(),
      {
        id: 'audit-bank-1',
        trusteeId: 'trustee-1',
        documentType: 'AUDIT_BANKS' as const,
        before: ['Bank A'],
        after: ['Bank B'],
        updatedOn: '2024-01-20T10:00:00Z',
        updatedBy: SYSTEM_USER_REFERENCE,
      },
      {
        id: 'audit-software-1',
        trusteeId: 'trustee-1',
        documentType: 'AUDIT_SOFTWARE',
        before: 'Software A',
        after: 'Software B',
        updatedOn: '2024-01-21T15:30:00Z',
        updatedBy: SYSTEM_USER_REFERENCE,
      } as TrusteeSoftwareHistory,
      {
        id: 'audit-oversight-1',
        trusteeId: 'trustee-1',
        documentType: 'AUDIT_OVERSIGHT',
        before: {
          role: CamsRole.OversightAttorney,
          user: { id: 'user-1', name: 'Attorney A' },
        },
        after: null,
        updatedOn: '2024-01-22T16:45:00Z',
        updatedBy: SYSTEM_USER_REFERENCE,
      } as TrusteeOversightHistory,
    ];

    vi.spyOn(Api2, 'getTrusteeHistory').mockResolvedValue({ data: validHistoryTypes });

    renderWithProps({});

    await screen.findByTestId('trustee-history-table');

    expect(screen.getAllByRole('row')).toHaveLength(7);
  });
});

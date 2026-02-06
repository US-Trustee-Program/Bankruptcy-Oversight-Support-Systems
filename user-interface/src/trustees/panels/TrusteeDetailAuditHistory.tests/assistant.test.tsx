import { render, screen } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import TrusteeDetailAuditHistory from '../TrusteeDetailAuditHistory';
import Api2 from '@/lib/models/api2';
import { TrusteeAssistantHistory } from '@common/cams/trustees';
import MockData from '@common/cams/test-utilities/mock-data';

const MOCK_TRUSTEE_ID = 'trustee-123';

function createMockAssistantHistory(
  override: Partial<TrusteeAssistantHistory> = {},
): TrusteeAssistantHistory {
  const userRef = MockData.getCamsUserReference({ name: 'John Doe' });
  return {
    id: 'history-1',
    trusteeId: MOCK_TRUSTEE_ID,
    documentType: 'AUDIT_ASSISTANT',
    assistantId: 'assistant-after',
    before: MockData.getTrusteeAssistant({
      id: 'assistant-before',
      trusteeId: MOCK_TRUSTEE_ID,
      name: 'Jane Smith',
      contact: MockData.getContactInformation(),
    }),
    after: MockData.getTrusteeAssistant({
      id: 'assistant-after',
      trusteeId: MOCK_TRUSTEE_ID,
      name: 'Jane M. Smith',
      title: 'Senior Assistant',
      contact: MockData.getContactInformation(),
    }),
    updatedOn: '2024-01-15T10:00:00Z',
    updatedBy: userRef,
    createdOn: '2024-01-15T10:00:00Z',
    createdBy: userRef,
    ...override,
  };
}

describe('TrusteeDetailAuditHistory - Assistant History', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('should render assistant change history with name', async () => {
    const mockHistory = [createMockAssistantHistory()];
    vi.spyOn(Api2, 'getTrusteeHistory').mockResolvedValue({ data: mockHistory });

    render(<TrusteeDetailAuditHistory trusteeId={MOCK_TRUSTEE_ID} />);

    await screen.findByTestId('change-type-assistant-0');

    expect(screen.getByTestId('change-type-assistant-0')).toHaveTextContent('Assistant');
    expect(screen.getByTestId('previous-assistant-0')).toHaveTextContent('Jane Smith');
    expect(screen.getByTestId('new-assistant-0')).toHaveTextContent('Jane M. Smith');
    expect(screen.getByTestId('new-assistant-0')).toHaveTextContent('Senior Assistant');
  });

  test('should render when assistant is newly added (before is undefined)', async () => {
    const mockHistory = [
      createMockAssistantHistory({
        before: undefined,
        after: MockData.getTrusteeAssistant({
          id: 'assistant-after',
          trusteeId: MOCK_TRUSTEE_ID,
          name: 'Jane Smith',
          title: 'Legal Assistant',
          contact: MockData.getContactInformation(),
        }),
      }),
    ];
    vi.spyOn(Api2, 'getTrusteeHistory').mockResolvedValue({ data: mockHistory });

    render(<TrusteeDetailAuditHistory trusteeId={MOCK_TRUSTEE_ID} />);

    await screen.findByTestId('change-type-assistant-0');

    expect(screen.getByTestId('previous-assistant-0')).toBeEmptyDOMElement();
    expect(screen.getByTestId('new-assistant-0')).toHaveTextContent('Jane Smith');
    expect(screen.getByTestId('new-assistant-0')).toHaveTextContent('Legal Assistant');
  });

  test('should render when assistant is removed (after is undefined)', async () => {
    const mockHistory = [
      createMockAssistantHistory({
        before: MockData.getTrusteeAssistant({
          id: 'assistant-before',
          trusteeId: MOCK_TRUSTEE_ID,
          name: 'Jane Smith',
          title: 'Legal Assistant',
          contact: MockData.getContactInformation(),
        }),
        after: undefined,
      }),
    ];
    vi.spyOn(Api2, 'getTrusteeHistory').mockResolvedValue({ data: mockHistory });

    render(<TrusteeDetailAuditHistory trusteeId={MOCK_TRUSTEE_ID} />);

    await screen.findByTestId('change-type-assistant-0');

    expect(screen.getByTestId('previous-assistant-name-0')).toHaveTextContent('Jane Smith');
    expect(screen.getByTestId('previous-assistant-title-0')).toHaveTextContent('Legal Assistant');
    expect(screen.getByTestId('new-assistant-0')).toBeEmptyDOMElement();
  });

  test('should render assistant without title', async () => {
    const mockHistory = [
      createMockAssistantHistory({
        before: MockData.getTrusteeAssistant({
          id: 'assistant-before',
          trusteeId: MOCK_TRUSTEE_ID,
          name: 'Jane Smith',
          contact: MockData.getContactInformation(),
        }),
        after: MockData.getTrusteeAssistant({
          id: 'assistant-after',
          trusteeId: MOCK_TRUSTEE_ID,
          name: 'Jane M. Smith',
          contact: MockData.getContactInformation(),
        }),
      }),
    ];
    vi.spyOn(Api2, 'getTrusteeHistory').mockResolvedValue({ data: mockHistory });

    render(<TrusteeDetailAuditHistory trusteeId={MOCK_TRUSTEE_ID} />);

    await screen.findByTestId('change-type-assistant-0');

    expect(screen.getByTestId('previous-assistant-name-0')).toHaveTextContent('Jane Smith');
    expect(screen.queryByTestId('previous-assistant-title-0')).not.toBeInTheDocument();
    expect(screen.getByTestId('new-assistant-name-0')).toHaveTextContent('Jane M. Smith');
    expect(screen.queryByTestId('new-assistant-title-0')).not.toBeInTheDocument();
  });

  test('should render assistant contact information', async () => {
    const mockContact = MockData.getContactInformation({
      email: 'jane.smith@example.com',
      phone: { number: '555-555-5555', extension: '123' },
      address: {
        address1: '123 Main St',
        city: 'New York',
        state: 'NY',
        zipCode: '10001',
        countryCode: 'US',
      },
    });

    const mockHistory = [
      createMockAssistantHistory({
        after: MockData.getTrusteeAssistant({
          id: 'assistant-after',
          trusteeId: MOCK_TRUSTEE_ID,
          name: 'Jane Smith',
          title: 'Legal Assistant',
          contact: mockContact,
        }),
      }),
    ];
    vi.spyOn(Api2, 'getTrusteeHistory').mockResolvedValue({ data: mockHistory });

    render(<TrusteeDetailAuditHistory trusteeId={MOCK_TRUSTEE_ID} />);

    await screen.findByTestId('change-type-assistant-0');

    const newAssistant = screen.getByTestId('new-assistant-0');
    expect(newAssistant).toHaveTextContent('123 Main St');
    expect(newAssistant).toHaveTextContent('New York');
    expect(newAssistant).toHaveTextContent('555-555-5555, ext. 123');
    expect(newAssistant).toHaveTextContent('jane.smith@example.com');
  });

  test('should render assistant history mixed with other history types', async () => {
    const mockHistory = [
      createMockAssistantHistory(),
      {
        id: 'history-2',
        trusteeId: MOCK_TRUSTEE_ID,
        documentType: 'AUDIT_NAME' as const,
        before: 'John Doe',
        after: 'John M. Doe',
        updatedOn: '2024-01-14T10:00:00Z',
        updatedBy: MockData.getCamsUserReference({ name: 'Admin User' }),
        createdOn: '2024-01-14T10:00:00Z',
        createdBy: MockData.getCamsUserReference({ name: 'Admin User' }),
      },
    ];
    vi.spyOn(Api2, 'getTrusteeHistory').mockResolvedValue({ data: mockHistory });

    render(<TrusteeDetailAuditHistory trusteeId={MOCK_TRUSTEE_ID} />);

    await screen.findByTestId('change-type-assistant-0');

    expect(screen.getByTestId('change-type-assistant-0')).toHaveTextContent('Assistant');
    expect(screen.getByTestId('change-type-name-1')).toHaveTextContent('Name');
  });
});

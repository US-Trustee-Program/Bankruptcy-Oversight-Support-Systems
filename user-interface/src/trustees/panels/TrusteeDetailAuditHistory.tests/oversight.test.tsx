import { screen } from '@testing-library/react';
import { vi } from 'vitest';
import Api2 from '@/lib/models/api2';
import { TrusteeOversightHistory } from '@common/cams/trustees';
import { SYSTEM_USER_REFERENCE } from '@common/cams/auditable';
import { CamsRole, OversightRoleType } from '@common/cams/roles';
import {
  renderWithProps,
  renderHistoryAndWaitForTable,
  createMockNameHistory,
  createMockPublicContactHistory,
} from './trusteeHistoryTestHelpers';

describe('TrusteeDetailAuditHistory - Oversight History Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const mockNameHistory = createMockNameHistory();
  const mockPublicContactHistory = createMockPublicContactHistory();

  const mockOversightHistory: TrusteeOversightHistory = {
    id: 'audit-oversight-1',
    trusteeId: 'audit-oversight-trustee',
    documentType: 'AUDIT_OVERSIGHT',
    before: {
      role: CamsRole.OversightAttorney,
      user: {
        id: 'user-123',
        name: 'John Attorney',
      },
    },
    after: {
      role: CamsRole.OversightAttorney,
      user: {
        id: 'user-456',
        name: 'Jane Attorney',
      },
    },
    updatedOn: '2024-01-22T16:45:00Z',
    updatedBy: SYSTEM_USER_REFERENCE,
  };

  test('should display oversight change history correctly', async () => {
    await renderHistoryAndWaitForTable([mockOversightHistory]);

    expect(screen.getByTestId('change-type-oversight-0')).toHaveTextContent('Oversight');
    expect(screen.getByTestId('previous-oversight-0')).toHaveTextContent('Attorney');
    expect(screen.getByTestId('previous-oversight-0')).toHaveTextContent('John Attorney');
    expect(screen.getByTestId('new-oversight-0')).toHaveTextContent('Attorney');
    expect(screen.getByTestId('new-oversight-0')).toHaveTextContent('Jane Attorney');
    expect(screen.getByTestId('changed-by-0')).toHaveTextContent('SYSTEM');
    expect(screen.getByTestId('change-date-0')).toHaveTextContent('01/22/2024');
  });

  test('should display mixed history types including oversight', async () => {
    const mixedHistory = [mockNameHistory, mockPublicContactHistory, mockOversightHistory];
    await renderHistoryAndWaitForTable(mixedHistory);

    expect(screen.getByTestId('change-type-name-2')).toHaveTextContent('Name');
    expect(screen.getByTestId('change-type-public-contact-1')).toHaveTextContent('Public Contact');
    expect(screen.getByTestId('change-type-oversight-0')).toHaveTextContent('Oversight');

    const previousOversight = screen.getByTestId('previous-oversight-0');
    expect(previousOversight).toHaveTextContent('Attorney');
    expect(previousOversight).toHaveTextContent('John Attorney');
  });

  describe('Oversight History Scenarios', () => {
    const base = { ...mockOversightHistory };

    const scenarios = [
      {
        name: 'basic oversight change',
        override: {},
        expectPrevRole: 'Attorney',
        expectPrevName: 'John Attorney',
        expectNewRole: 'Attorney',
        expectNewName: 'Jane Attorney',
        expectChangedBy: 'SYSTEM',
      },
      {
        name: 'no previous oversight',
        override: {
          before: null,
          after: {
            role: CamsRole.OversightAttorney,
            user: { id: 'user-new', name: 'New Attorney' },
          },
        },
        expectPrev: '(none)',
        expectNewRole: 'Attorney',
        expectNewName: 'New Attorney',
        expectChangedBy: 'SYSTEM',
      },
      {
        name: 'no new oversight',
        override: {
          before: {
            role: CamsRole.OversightAttorney,
            user: { id: 'user-old', name: 'Old Attorney' },
          },
          after: null,
        },
        expectPrevRole: 'Attorney',
        expectPrevName: 'Old Attorney',
        expectNew: '(none)',
        expectChangedBy: 'SYSTEM',
      },
      {
        name: 'both oversight values null',
        override: { before: null, after: null },
        expectPrev: '(none)',
        expectNew: '(none)',
        expectChangedBy: 'SYSTEM',
      },
      {
        name: 'missing updatedBy',
        override: { updatedBy: { id: '', name: '' } },
        expectPrevRole: 'Attorney',
        expectPrevName: 'John Attorney',
        expectNewRole: 'Attorney',
        expectNewName: 'Jane Attorney',
        expectChangedBy: '',
      },
    ];

    test.each(scenarios)(
      'should display oversight history with $name',
      async ({
        override,
        expectPrev,
        expectNew,
        expectPrevRole,
        expectPrevName,
        expectNewRole,
        expectNewName,
        expectChangedBy,
      }) => {
        vi.spyOn(Api2, 'getTrusteeHistory').mockResolvedValue({
          data: [{ ...base, ...override }],
        });
        renderWithProps({});
        await screen.findByTestId('trustee-history-table');

        const prevEl = screen.getByTestId('previous-oversight-0');
        const newEl = screen.getByTestId('new-oversight-0');
        const changedByEl = screen.getByTestId('changed-by-0');

        if (expectPrev) {
          expect(prevEl).toHaveTextContent(expectPrev);
        } else {
          expect(prevEl).toHaveTextContent(expectPrevRole!);
          expect(prevEl).toHaveTextContent(expectPrevName!);
        }

        if (expectNew) {
          expect(newEl).toHaveTextContent(expectNew);
        } else {
          expect(newEl).toHaveTextContent(expectNewRole!);
          expect(newEl).toHaveTextContent(expectNewName!);
        }

        expect(changedByEl).toHaveTextContent(expectChangedBy);
      },
    );
  });

  test('should display role as-is when role is not in roleDisplayMap', async () => {
    const mockOversightHistoryUnknownRole: TrusteeOversightHistory = {
      id: 'audit-oversight-unknown',
      trusteeId: 'audit-oversight-trustee',
      documentType: 'AUDIT_OVERSIGHT',
      before: {
        role: 'unknown-role' as OversightRoleType,
        user: {
          id: 'user-before',
          name: 'John Unknown',
        },
      },
      after: {
        role: 'another-unknown-role' as OversightRoleType,
        user: {
          id: 'user-after',
          name: 'Jane Unknown',
        },
      },
      updatedOn: '2024-01-15T12:00:00Z',
      updatedBy: SYSTEM_USER_REFERENCE,
    };

    vi.spyOn(Api2, 'getTrusteeHistory').mockResolvedValue({
      data: [mockOversightHistoryUnknownRole],
    });

    renderWithProps({});

    await screen.findByTestId('trustee-history-table');

    expect(screen.getByTestId('previous-oversight-0')).toHaveTextContent('unknown-role');
    expect(screen.getByTestId('previous-oversight-0')).toHaveTextContent('John Unknown');
    expect(screen.getByTestId('new-oversight-0')).toHaveTextContent('another-unknown-role');
    expect(screen.getByTestId('new-oversight-0')).toHaveTextContent('Jane Unknown');
  });
});

import { screen } from '@testing-library/react';
import { vi } from 'vitest';
import { TrusteeSoftwareHistory } from '@common/cams/trustees';
import { SYSTEM_USER_REFERENCE } from '@common/cams/auditable';
import { renderHistoryAndWaitForTable } from './trusteeHistoryTestHelpers';

describe('TrusteeDetailAuditHistory - Software History Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const mockSoftwareHistory: TrusteeSoftwareHistory = {
    id: 'audit-software-1',
    trusteeId: 'audit-software-trustee',
    documentType: 'AUDIT_SOFTWARE',
    before: 'Legacy Software v1.0',
    after: 'Modern Software v2.5',
    updatedOn: '2024-01-21T15:30:00Z',
    updatedBy: SYSTEM_USER_REFERENCE,
  };

  test('should display software change history correctly', async () => {
    await renderHistoryAndWaitForTable([mockSoftwareHistory]);

    expect(screen.getByTestId('change-type-software-0')).toHaveTextContent('Software');
    expect(screen.getByTestId('previous-software-0')).toHaveTextContent('Legacy Software v1.0');
    expect(screen.getByTestId('new-software-0')).toHaveTextContent('Modern Software v2.5');
    expect(screen.getByTestId('changed-by-0')).toHaveTextContent('SYSTEM');
    expect(screen.getByTestId('change-date-0')).toHaveTextContent('01/21/2024');
  });

  test('should display (none) for undefined software values', async () => {
    const softwareHistoryWithUndefined = {
      ...mockSoftwareHistory,
      before: undefined,
      after: undefined,
    };

    await renderHistoryAndWaitForTable([softwareHistoryWithUndefined]);

    expect(screen.getByTestId('previous-software-0')).toHaveTextContent('(none)');
    expect(screen.getByTestId('new-software-0')).toHaveTextContent('(none)');
  });
});

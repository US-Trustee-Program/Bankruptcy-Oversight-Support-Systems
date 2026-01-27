import { screen } from '@testing-library/react';
import { vi } from 'vitest';
import {
  renderHistoryAndWaitForTable,
  createMockAppointmentHistory,
} from './trusteeHistoryTestHelpers';

describe('TrusteeDetailAuditHistory - Appointment History Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  test('should display appointment change history correctly', async () => {
    const mockAppointmentHistory = createMockAppointmentHistory();
    await renderHistoryAndWaitForTable([mockAppointmentHistory]);

    expect(screen.getByTestId('change-type-appointment-0')).toHaveTextContent('Appointment');

    const previousCell = screen.getByTestId('previous-appointment-0');
    expect(previousCell).toHaveTextContent('Chapter: 7 - Panel');
    expect(previousCell).toHaveTextContent(
      'District: United States Bankruptcy Court - District of Massachusetts (Boston)',
    );
    expect(previousCell).toHaveTextContent('Appointed: 01/15/2023');
    expect(previousCell).toHaveTextContent('Status: Active 01/15/2023');

    const newCell = screen.getByTestId('new-appointment-0');
    expect(newCell).toHaveTextContent('Chapter: 11');
    expect(newCell).toHaveTextContent(
      'District: United States Bankruptcy Court - District of Massachusetts (Worcester)',
    );
    expect(newCell).toHaveTextContent('Appointed: 02/01/2024');
    expect(newCell).toHaveTextContent('Status: Inactive 02/15/2024');

    expect(screen.getByTestId('changed-by-0')).toHaveTextContent('Admin User');
    expect(screen.getByTestId('change-date-0')).toHaveTextContent('02/15/2024');
  });

  test('should display (none) when before is undefined (new appointment)', async () => {
    const mockAppointmentHistory = createMockAppointmentHistory({
      before: undefined,
    });
    await renderHistoryAndWaitForTable([mockAppointmentHistory]);

    expect(screen.getByTestId('previous-appointment-0')).toHaveTextContent('(none)');
    expect(screen.getByTestId('new-appointment-0')).toHaveTextContent('Chapter: 11');
  });

  test('should display (none) when after is undefined (deleted appointment)', async () => {
    const mockAppointmentHistory = createMockAppointmentHistory({
      after: undefined,
    });
    await renderHistoryAndWaitForTable([mockAppointmentHistory]);

    expect(screen.getByTestId('previous-appointment-0')).toHaveTextContent('Chapter: 7 - Panel');
    expect(screen.getByTestId('new-appointment-0')).toHaveTextContent('(none)');
  });

  test('should display division code when court information is missing', async () => {
    const mockAppointmentHistory = createMockAppointmentHistory({
      before: {
        chapter: '7',
        appointmentType: 'panel',
        courtId: '081',
        divisionCode: 'MAB',
        appointedDate: '2023-01-15',
        status: 'active',
        effectiveDate: '2023-01-15',
      },
    });
    await renderHistoryAndWaitForTable([mockAppointmentHistory]);

    const previousCell = screen.getByTestId('previous-appointment-0');
    expect(previousCell).toHaveTextContent('District: MAB');
  });
});

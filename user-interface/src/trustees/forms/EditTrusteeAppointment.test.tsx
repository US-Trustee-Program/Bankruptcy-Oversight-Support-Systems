import { render, screen, waitFor } from '@testing-library/react';
import { describe, test, expect, beforeEach, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import EditTrusteeAppointment from './EditTrusteeAppointment';
import Api2 from '@/lib/models/api2';
import MockData from '@common/cams/test-utilities/mock-data';
import { TrusteeAppointment } from '@common/cams/trustee-appointments';
import TestingUtilities from '@/lib/testing/testing-utilities';
import { CamsRole } from '@common/cams/roles';
import * as FeatureFlagHook from '@/lib/hooks/UseFeatureFlags';
import { FeatureFlagSet } from '@common/feature-flags';

vi.mock('@/lib/models/api2');

describe('EditTrusteeAppointment', () => {
  const mockTrusteeId = 'trustee-123';
  const mockAppointmentId = 'appointment-456';
  const mockAppointment: TrusteeAppointment = MockData.getTrusteeAppointment({
    id: mockAppointmentId,
    trusteeId: mockTrusteeId,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    TestingUtilities.setUserWithRoles([CamsRole.TrusteeAdmin]);
    vi.spyOn(FeatureFlagHook, 'default').mockReturnValue({
      'trustee-management': true,
    } as FeatureFlagSet);
    vi.spyOn(Api2, 'getCourts').mockResolvedValue({
      data: MockData.getCourts(),
    });
  });

  function renderWithRouter() {
    return render(
      <MemoryRouter
        initialEntries={[`/trustees/${mockTrusteeId}/appointments/${mockAppointmentId}/edit`]}
      >
        <Routes>
          <Route
            path="/trustees/:trusteeId/appointments/:appointmentId/edit"
            element={<EditTrusteeAppointment />}
          />
        </Routes>
      </MemoryRouter>,
    );
  }

  test('should show loading spinner while fetching appointment', () => {
    vi.spyOn(Api2, 'getTrusteeAppointments').mockImplementation(() => new Promise(() => {}));

    renderWithRouter();

    expect(screen.getByText('Loading appointment...')).toBeInTheDocument();
  });

  test('should load and display appointment form', async () => {
    vi.spyOn(Api2, 'getTrusteeAppointments').mockResolvedValue({
      data: [mockAppointment],
    });

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByTestId('trustee-appointment-form')).toBeInTheDocument();
    });
  });

  test('should show error when appointment is not found', async () => {
    vi.spyOn(Api2, 'getTrusteeAppointments').mockResolvedValue({
      data: [],
    });

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByText('Appointment not found')).toBeInTheDocument();
    });
  });

  test('should show error when API call fails', async () => {
    vi.spyOn(Api2, 'getTrusteeAppointments').mockRejectedValue(new Error('API error'));

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByText(/Failed to load appointment: API error/)).toBeInTheDocument();
    });
  });

  test('should pass appointment to TrusteeAppointmentForm', async () => {
    vi.spyOn(Api2, 'getTrusteeAppointments').mockResolvedValue({
      data: [mockAppointment],
    });

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByTestId('trustee-appointment-form')).toBeInTheDocument();
    });

    expect(Api2.getTrusteeAppointments).toHaveBeenCalledWith(mockTrusteeId);
  });
});

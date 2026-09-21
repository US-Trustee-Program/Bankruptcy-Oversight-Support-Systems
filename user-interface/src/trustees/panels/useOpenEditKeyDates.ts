import { useNavigate } from 'react-router-dom';

/**
 * Navigates to a Chapter 13 Standing key-dates edit route, carrying the appointment
 * heading as `subHeading` route state. Shared by the Chapter 13 Standing key-dates cards.
 */
export function useOpenEditKeyDates(
  trusteeId: string,
  appointmentId: string,
  routeSegment: string,
  appointmentHeading?: string,
): () => void {
  const navigate = useNavigate();

  return function openEdit() {
    navigate(`/trustees/${trusteeId}/appointments/${appointmentId}/${routeSegment}/edit`, {
      state: { subHeading: appointmentHeading ?? '' },
    });
  };
}

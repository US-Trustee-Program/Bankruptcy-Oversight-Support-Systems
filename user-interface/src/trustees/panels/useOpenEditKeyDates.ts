import { useNavigate } from 'react-router-dom';

/**
 * Navigates to a Chapter 13 Standing key-dates edit route. Shared by the Chapter 13
 * Standing key-dates cards. The subheading is computed independently by
 * TrusteeDetailScreen from the route params, so it doesn't need to be passed here.
 */
export function useOpenEditKeyDates(
  trusteeId: string,
  appointmentId: string,
  routeSegment: string,
): () => void {
  const navigate = useNavigate();

  return function openEdit() {
    navigate(`/trustees/${trusteeId}/appointments/${appointmentId}/${routeSegment}/edit`);
  };
}

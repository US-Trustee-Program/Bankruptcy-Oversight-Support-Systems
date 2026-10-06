import { useNavigate } from 'react-router-dom';

/**
 * Navigates to a key-dates edit route. Shared by all key-dates cards. The
 * subheading is computed independently by TrusteeDetailScreen from the route
 * params, so it doesn't need to be passed here.
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

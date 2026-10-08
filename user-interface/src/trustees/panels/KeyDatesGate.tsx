import { ReactNode } from 'react';
import Alert, { UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import { TrusteeUpcomingKeyDates } from '@common/cams/trustee-upcoming-key-dates';
import { useUpcomingKeyDates } from './useUpcomingKeyDates';

export interface KeyDatesGateProps {
  trusteeId: string;
  appointmentId: string;
  shouldFetch: boolean;
  errorId: string;
  errorMessage: string;
  children: (data: TrusteeUpcomingKeyDates | null, isLoading: boolean) => ReactNode;
}

export default function KeyDatesGate(props: Readonly<KeyDatesGateProps>) {
  const { trusteeId, appointmentId, shouldFetch, errorId, errorMessage, children } = props;
  const { data, isLoading, error } = useUpcomingKeyDates(trusteeId, appointmentId, shouldFetch);

  if (!shouldFetch) {
    return null;
  }

  if (error) {
    return (
      <Alert id={errorId} type={UswdsAlertStyle.Error} inline={true} show={true} slim>
        {errorMessage}
      </Alert>
    );
  }

  return <>{children(data, isLoading)}</>;
}

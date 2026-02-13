import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { setCurrentNav, createNavStateMapper } from '@/lib/utils/navigation';

export enum TrusteeNavState {
  TRUSTEE_PROFILE,
  APPOINTMENTS,
  ASSIGNED_STAFF,
  AUDIT_HISTORY,
}

export const mapTrusteeDetailNavState = createNavStateMapper<TrusteeNavState>(
  {
    appointments: TrusteeNavState.APPOINTMENTS,
    'assigned-staff': TrusteeNavState.ASSIGNED_STAFF,
    'audit-history': TrusteeNavState.AUDIT_HISTORY,
  },
  TrusteeNavState.TRUSTEE_PROFILE,
);

export interface TrusteeDetailNavigationProps {
  trusteeId: string | undefined;
  initiallySelectedNavLink: TrusteeNavState;
  className?: string;
}

export default function TrusteeDetailNavigation({
  trusteeId,
  initiallySelectedNavLink,
  className,
}: TrusteeDetailNavigationProps) {
  const [activeNav, setActiveNav] = useState<TrusteeNavState>(initiallySelectedNavLink);

  return (
    <>
      <nav
        className={`trustee-details-navigation ${className ?? ''}`}
        aria-label="Trustee Detail Side navigation"
        role="navigation"
      >
        <ul className="usa-sidenav">
          <li className="usa-sidenav__item">
            <NavLink
              to={`/trustees/${trusteeId}`}
              data-testid="trustee-profile-nav-link"
              className={`usa-sidenav__link ${setCurrentNav(activeNav, TrusteeNavState.TRUSTEE_PROFILE)}`}
              onClick={() => setActiveNav(TrusteeNavState.TRUSTEE_PROFILE)}
              title="View basic details about the current trustee"
            >
              Overview
            </NavLink>
          </li>
          <li className="usa-sidenav__item">
            <NavLink
              to={`/trustees/${trusteeId}/appointments`}
              data-testid="trustee-appointments-nav-link"
              className={`usa-sidenav__link ${setCurrentNav(activeNav, TrusteeNavState.APPOINTMENTS)}`}
              onClick={() => setActiveNav(TrusteeNavState.APPOINTMENTS)}
              title="View appointments for the current trustee"
            >
              Appointments
            </NavLink>
          </li>
          <li className="usa-sidenav__item">
            <NavLink
              to={`/trustees/${trusteeId}/assigned-staff`}
              data-testid="trustee-assigned-staff-nav-link"
              className={`usa-sidenav__link ${setCurrentNav(activeNav, TrusteeNavState.ASSIGNED_STAFF)}`}
              onClick={() => setActiveNav(TrusteeNavState.ASSIGNED_STAFF)}
              title="View staff assigned to the current trustee"
            >
              Assigned Staff
            </NavLink>
          </li>
          <li className="usa-sidenav__item">
            <NavLink
              to={`/trustees/${trusteeId}/audit-history`}
              data-testid="trustee-audit-history-nav-link"
              className={`usa-sidenav__link ${setCurrentNav(activeNav, TrusteeNavState.AUDIT_HISTORY)}`}
              onClick={() => setActiveNav(TrusteeNavState.AUDIT_HISTORY)}
              title="View audit history for the trustee"
            >
              Change History
            </NavLink>
          </li>
        </ul>
      </nav>
    </>
  );
}

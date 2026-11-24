import { useMemo, useState } from 'react';
import Icon from '@/lib/components/uswds/Icon';
import { Pagination } from '@/lib/components/uswds/Pagination';
import { Pagination as PaginationModel } from '@common/api/pagination';
import { CourtDivisionDetails } from '@common/cams/courts';
import { TrusteeAppointmentWithAgreement } from '@common/cams/trustee-appointment-verification';
import { formatAppointmentStatus } from '@common/cams/trustee-appointments';
import { formatAppointmentType, formatChapterType } from '@common/cams/trustees';
import useCourts from '@/lib/hooks/UseCourts';
import { buildDivisionsDisplay } from '@/lib/utils/court-utils';
import { DifferenceIcon } from '../trustee-verification/TrusteeComparisonTable';

const APPOINTMENTS_PAGE_SIZE = 5;

function differsDescription(field: string): string {
  return `${field} differs from these cases`;
}

export type AppointmentsTableProps = {
  appointments: TrusteeAppointmentWithAgreement[];
};

function AppointmentRow({
  appointment,
  allCourts,
}: {
  appointment: TrusteeAppointmentWithAgreement;
  allCourts: CourtDivisionDetails[];
}) {
  const { agreement } = appointment;
  const district = appointment.courtName ?? appointment.courtId;
  const division = buildDivisionsDisplay(appointment, allCourts);

  return (
    <tr>
      <td data-label="District">
        <span className="appointment-cell-value">
          {!agreement.matchesCourt && (
            <DifferenceIcon description={differsDescription('District')} />
          )}
          {district}
        </span>
      </td>
      <td data-label="Division">
        <span className="appointment-cell-value">
          {!agreement.matchesDivision && (
            <DifferenceIcon description={differsDescription('Division')} />
          )}
          {division}
        </span>
      </td>
      <td data-label="Chapter">
        <span className="appointment-cell-value">
          {!agreement.matchesChapter && (
            <DifferenceIcon description={differsDescription('Chapter')} />
          )}
          Chapter {formatChapterType(appointment.chapter)}
        </span>
      </td>
      <td data-label="Type">{formatAppointmentType(appointment.appointmentType)}</td>
      <td data-label="Status">
        <span className="appointment-cell-value">
          {!agreement.isActive && <DifferenceIcon description={differsDescription('Status')} />}
          {formatAppointmentStatus(appointment.status)}
        </span>
      </td>
    </tr>
  );
}

/**
 * The trustee's appointments, already ordered by agreement with the task's tuple (closest first)
 * by the backend -- this component paginates and renders only, it never re-sorts. A cell whose
 * field differs from the task's cases (court, division, chapter or active status) shows a
 * warning icon (CAMS-956 Slice 2).
 */
export function AppointmentsTable({ appointments }: Readonly<AppointmentsTableProps>) {
  const [offset, setOffset] = useState(0);
  // Shared/cached across the app (see useCourts), so this never triggers its own fetch when
  // another component on the page has already loaded courts.
  const { courts: allCourts, error: courtsError } = useCourts();

  if (courtsError) {
    console.error('Error loading courts:', courtsError);
  }

  const pagedAppointments = useMemo(
    () => appointments.slice(offset, offset + APPOINTMENTS_PAGE_SIZE),
    [appointments, offset],
  );

  const paginationValues = useMemo((): PaginationModel => {
    return {
      count: pagedAppointments.length,
      limit: APPOINTMENTS_PAGE_SIZE,
      currentPage: Math.floor(offset / APPOINTMENTS_PAGE_SIZE) + 1,
      totalPages: Math.ceil(appointments.length / APPOINTMENTS_PAGE_SIZE),
      totalCount: appointments.length,
    };
  }, [pagedAppointments, appointments, offset]);

  const hasMultiplePages = appointments.length > APPOINTMENTS_PAGE_SIZE;

  return (
    <div className="appointments-table-container">
      <h3>Appointments</h3>
      {appointments.length === 0 ? (
        <p>This trustee has no appointments in CAMS.</p>
      ) : (
        <>
          <p className="appointments-table-key">
            A{' '}
            <Icon
              name="warning"
              className="difference-icon-symbol subtext-icon"
              decorative={false}
              tooltip="warning"
            />{' '}
            icon marks information that differs from the court, division, chapter or status of these
            cases.
          </p>
          <table
            className="usa-table usa-table--borderless appointments-table"
            aria-label="Appointments"
          >
            <thead>
              <tr>
                <th scope="col">District</th>
                <th scope="col">Division</th>
                <th scope="col">Chapter</th>
                <th scope="col">Type</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {pagedAppointments.map((appointment) => (
                <AppointmentRow
                  key={appointment.id}
                  appointment={appointment}
                  allCourts={allCourts}
                />
              ))}
            </tbody>
          </table>
          {hasMultiplePages && (
            <Pagination<{ limit: number; offset: number }>
              paginationValues={paginationValues}
              searchPredicate={{ limit: APPOINTMENTS_PAGE_SIZE, offset }}
              retrievePage={(predicate) => setOffset(predicate.offset ?? 0)}
            />
          )}
        </>
      )}
    </div>
  );
}

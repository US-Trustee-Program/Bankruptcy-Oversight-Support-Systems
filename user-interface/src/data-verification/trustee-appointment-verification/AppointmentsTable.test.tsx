import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, test, expect } from 'vitest';
import { TrusteeAppointmentWithAgreement } from '@common/cams/trustee-appointment-verification';
import { AppointmentAgreement } from '@common/cams/trustee-appointments';
import { AppointmentsTable } from './AppointmentsTable';

function makeAppointment(
  overrides: Partial<TrusteeAppointmentWithAgreement> = {},
): TrusteeAppointmentWithAgreement {
  return {
    id: 'appointment-1',
    trusteeId: 'trustee-1',
    courtId: '081',
    courtName: 'Southern District of New York',
    divisionCode: '1',
    appointedDate: '2020-01-01',
    status: 'active',
    effectiveDate: '2020-01-01',
    chapter: '7',
    appointmentType: 'panel',
    createdOn: '2020-01-01T00:00:00.000Z',
    createdBy: { id: 'SYSTEM', name: 'SYSTEM' },
    updatedOn: '2020-01-01T00:00:00.000Z',
    updatedBy: { id: 'SYSTEM', name: 'SYSTEM' },
    agreement: {
      matchesCourt: true,
      matchesDivision: true,
      matchesChapter: true,
      isActive: true,
      score: 4,
    },
    ...overrides,
  };
}

describe('AppointmentsTable', () => {
  test('replaces the table with a message when the trustee has no appointments', () => {
    render(<AppointmentsTable appointments={[]} />);

    expect(screen.getByText('This trustee has no appointments in CAMS.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  test('has an accessible name and the District, Division, Chapter, Type and Status columns', () => {
    render(<AppointmentsTable appointments={[makeAppointment()]} />);

    const table = screen.getByRole('table', { name: 'Appointments' });
    expect(table).toHaveTextContent('District');
    expect(table).toHaveTextContent('Division');
    expect(table).toHaveTextContent('Chapter');
    expect(table).toHaveTextContent('Type');
    expect(table).toHaveTextContent('Status');
  });

  test('renders each appointment value in its own column', () => {
    const { container } = render(
      <AppointmentsTable
        appointments={[
          makeAppointment({ divisionCode: '1', chapter: '7', appointmentType: 'panel' }),
        ]}
      />,
    );

    const cell = (label: string) => container.querySelector(`td[data-label="${label}"]`);
    expect(cell('District')).toHaveTextContent('Southern District of New York');
    expect(cell('Division')).toHaveTextContent('1');
    expect(cell('Chapter')).toHaveTextContent('7');
    expect(cell('Type')).toHaveTextContent('Panel');
    expect(cell('Status')).toHaveTextContent('Active');
  });

  test('formats a subchapter V chapter slug for display', () => {
    const { container } = render(
      <AppointmentsTable appointments={[makeAppointment({ chapter: '11-subchapter-v' })]} />,
    );

    expect(container.querySelector('td[data-label="Chapter"]')).toHaveTextContent(
      '11 Subchapter V',
    );
  });

  test('falls back to the court id in the District column when the court name is unknown', () => {
    const { container } = render(
      <AppointmentsTable
        appointments={[makeAppointment({ courtName: undefined, courtId: '081' })]}
      />,
    );

    expect(container.querySelector('td[data-label="District"]')).toHaveTextContent('081');
  });

  test('shows the resolved division name in the Division column when the backend provides one', () => {
    const { container } = render(
      <AppointmentsTable appointments={[makeAppointment({ courtDivisionName: 'Foley Square' })]} />,
    );

    expect(container.querySelector('td[data-label="Division"]')).toHaveTextContent(
      'Foley Square',
    );
  });

  test('renders appointments in the order given, without re-sorting', () => {
    const second = makeAppointment({
      id: 'appointment-second',
      chapter: '13',
      agreement: { ...makeAppointment().agreement, score: 2 },
    });
    const first = makeAppointment({
      id: 'appointment-first',
      chapter: '7',
      agreement: { ...makeAppointment().agreement, score: 4 },
    });

    render(<AppointmentsTable appointments={[first, second]} />);

    const rows = screen.getAllByRole('row');
    // rows[0] is the header row.
    expect(rows[1]).toHaveTextContent('7');
    expect(rows[2]).toHaveTextContent('13');
  });

  test.each<{ flag: keyof AppointmentAgreement; cell: string }>([
    { flag: 'matchesCourt', cell: 'District' },
    { flag: 'matchesDivision', cell: 'Division' },
    { flag: 'matchesChapter', cell: 'Chapter' },
    { flag: 'isActive', cell: 'Status' },
  ])('marks only the $cell cell with a warning icon when $flag is false', ({ flag, cell }) => {
    const matchingAgreement: AppointmentAgreement = {
      matchesCourt: true,
      matchesDivision: true,
      matchesChapter: true,
      isActive: true,
      score: 4,
    };

    const { container } = render(
      <AppointmentsTable
        appointments={[
          makeAppointment({ agreement: { ...matchingAgreement, [flag]: false, score: 3 } }),
        ]}
      />,
    );

    const targetCell = container.querySelector(`td[data-label="${cell}"]`) as HTMLElement;
    expect(
      within(targetCell).getByRole('img', { name: `${cell} differs from these cases` }),
    ).toBeInTheDocument();

    container.querySelectorAll('td').forEach((td) => {
      if (td === targetCell) return;
      expect(td.querySelector('[role="img"]')).not.toBeInTheDocument();
    });
  });

  test('shows no warning icon when every field matches the tuple', () => {
    const { container } = render(<AppointmentsTable appointments={[makeAppointment()]} />);

    expect(container.querySelector('[role="img"]')).not.toBeInTheDocument();
  });

  test('shows the key line explaining the warning icon', () => {
    render(<AppointmentsTable appointments={[makeAppointment()]} />);

    expect(
      screen.getByText(
        'A warning icon marks information that differs from the court, division, chapter or status of these cases.',
      ),
    ).toBeInTheDocument();
  });

  test('paginates when there are more than 5 appointments', () => {
    const appointments = Array.from({ length: 6 }, (_, i) =>
      makeAppointment({ id: `appointment-${i}` }),
    );

    render(<AppointmentsTable appointments={appointments} />);

    // Header row + 5 data rows on the first page.
    expect(screen.getAllByRole('row')).toHaveLength(6);
  });

  test('does not paginate when there are 5 or fewer appointments', () => {
    const appointments = Array.from({ length: 5 }, (_, i) =>
      makeAppointment({ id: `appointment-${i}` }),
    );

    render(<AppointmentsTable appointments={appointments} />);

    expect(screen.queryByRole('navigation', { name: 'Pagination' })).not.toBeInTheDocument();
  });

  test('clicking page 2 shows the remaining appointments', () => {
    const appointments = Array.from({ length: 6 }, (_, i) =>
      makeAppointment({ id: `appointment-${i}`, divisionCode: `div-${i}` }),
    );

    render(<AppointmentsTable appointments={appointments} />);
    fireEvent.click(screen.getByTestId('pagination-button-page-2-results'));

    // Header row + the single remaining appointment on page 2.
    const rows = screen.getAllByRole('row');
    expect(rows).toHaveLength(2);
    expect(rows[1]).toHaveTextContent('div-5'); // divisionCode of appointment-5, the 6th item
  });
});

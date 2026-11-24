import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { TrusteeAppointmentWithAgreement } from '@common/cams/trustee-appointment-verification';
import { AppointmentAgreement } from '@common/cams/trustee-appointments';
import { CourtDivisionDetails } from '@common/cams/courts';
import { AppointmentsTable } from './AppointmentsTable';

const mockUseCourts = vi.hoisted(() => vi.fn());

vi.mock('@/lib/hooks/UseCourts', () => ({
  default: mockUseCourts,
}));

function makeCourt(overrides: Partial<CourtDivisionDetails> = {}): CourtDivisionDetails {
  return {
    officeName: '',
    officeCode: '',
    courtId: '081',
    courtName: 'Southern District of New York',
    courtDivisionCode: '1',
    courtDivisionName: 'Foley Square',
    groupDesignator: '',
    regionId: '',
    regionName: '',
    ...overrides,
  };
}

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

const COLUMNS = ['District', 'Division', 'Chapter', 'Type', 'Status'] as const;
type Column = (typeof COLUMNS)[number];

/** The body-row cell under the given column header (first data row). */
function cell(column: Column): HTMLElement {
  return screen.getAllByRole('cell')[COLUMNS.indexOf(column)];
}

/** Matches only when a cell's full text equals exactly this value - toHaveTextContent's default
 * substring match would still pass if the real value merely contained this text, e.g. '1' would
 * wrongly match a cell that actually rendered '11'. */
function exact(value: string): RegExp {
  return new RegExp(`^${value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);
}

describe('AppointmentsTable', () => {
  beforeEach(() => {
    mockUseCourts.mockReturnValue({ courts: [], loading: false, error: null });
  });

  test('replaces the table with a message when the trustee has no appointments, but keeps the Appointments heading', () => {
    render(<AppointmentsTable appointments={[]} />);

    expect(screen.getByRole('heading', { name: 'Appointments', level: 3 })).toBeInTheDocument();
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
    render(
      <AppointmentsTable
        appointments={[
          makeAppointment({ divisionCode: '1', chapter: '7', appointmentType: 'panel' }),
        ]}
      />,
    );

    expect(cell('District')).toHaveTextContent(exact('Southern District of New York'));
    expect(cell('Division')).toHaveTextContent(exact('1'));
    expect(cell('Chapter')).toHaveTextContent(exact('Chapter 7'));
    expect(cell('Type')).toHaveTextContent(exact('Panel'));
    expect(cell('Status')).toHaveTextContent(exact('Active'));
  });

  test('formats a subchapter V chapter slug for display', () => {
    render(<AppointmentsTable appointments={[makeAppointment({ chapter: '11-subchapter-v' })]} />);

    expect(cell('Chapter')).toHaveTextContent(exact('Chapter 11 Subchapter V'));
  });

  test('falls back to the court id in the District column when the court name is unknown', () => {
    render(
      <AppointmentsTable
        appointments={[makeAppointment({ courtName: undefined, courtId: '081' })]}
      />,
    );

    expect(cell('District')).toHaveTextContent(exact('081'));
  });

  test('shows the resolved division name in the Division column when the backend provides one', () => {
    render(
      <AppointmentsTable appointments={[makeAppointment({ courtDivisionName: 'Foley Square' })]} />,
    );

    expect(cell('Division')).toHaveTextContent(exact('Foley Square'));
  });

  test('looks up the division name from the courts list when the backend gives only a code', () => {
    mockUseCourts.mockReturnValue({ courts: [makeCourt()], loading: false, error: null });

    render(
      <AppointmentsTable
        appointments={[
          makeAppointment({ courtId: '081', divisionCode: '1', courtDivisionName: undefined }),
        ]}
      />,
    );

    expect(cell('Division')).toHaveTextContent(exact('Foley Square'));
  });

  test('falls back to the raw division code when it is in none of the loaded courts', () => {
    mockUseCourts.mockReturnValue({
      courts: [makeCourt({ courtDivisionCode: 'unrelated-division' })],
      loading: false,
      error: null,
    });

    render(
      <AppointmentsTable
        appointments={[
          makeAppointment({ courtId: '081', divisionCode: '1', courtDivisionName: undefined }),
        ]}
      />,
    );

    expect(cell('Division')).toHaveTextContent(exact('1'));
  });

  test('still renders when courts fail to load', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockUseCourts.mockReturnValue({
      courts: [],
      loading: false,
      error: new Error('courts unavailable'),
    });

    render(<AppointmentsTable appointments={[makeAppointment()]} />);

    expect(screen.getByRole('table', { name: 'Appointments' })).toBeInTheDocument();
    expect(consoleErrorSpy).toHaveBeenCalled();
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

  test.each<{ flag: keyof AppointmentAgreement; column: Column }>([
    { flag: 'matchesCourt', column: 'District' },
    { flag: 'matchesDivision', column: 'Division' },
    { flag: 'matchesChapter', column: 'Chapter' },
    { flag: 'isActive', column: 'Status' },
  ])('marks only the $column cell with a warning icon when $flag is false', ({ flag, column }) => {
    const matchingAgreement: AppointmentAgreement = {
      matchesCourt: true,
      matchesDivision: true,
      matchesChapter: true,
      isActive: true,
      score: 4,
    };

    render(
      <AppointmentsTable
        appointments={[
          makeAppointment({ agreement: { ...matchingAgreement, [flag]: false, score: 3 } }),
        ]}
      />,
    );

    const targetCell = cell(column);
    expect(
      within(targetCell).getByRole('img', { name: `${column} differs from these cases` }),
    ).toBeInTheDocument();

    // Scoped to the table: the legend above it always shows its own (unrelated) warning icon.
    expect(within(screen.getByRole('table')).getAllByRole('img')).toHaveLength(1);
  });

  test('shows no warning icon when every field matches the tuple', () => {
    render(<AppointmentsTable appointments={[makeAppointment()]} />);

    expect(within(screen.getByRole('table')).queryByRole('img')).not.toBeInTheDocument();
  });

  test('shows a visible Appointments heading', () => {
    render(<AppointmentsTable appointments={[makeAppointment()]} />);

    expect(screen.getByRole('heading', { name: 'Appointments', level: 3 })).toBeInTheDocument();
  });

  test('shows the key line explaining the warning icon, with the icon named so screen readers do not announce "warning icon icon"', () => {
    render(<AppointmentsTable appointments={[makeAppointment()]} />);

    const legend = document.querySelector('.appointments-table-key') as HTMLElement;
    expect(legend).not.toBeNull();
    expect(within(legend).getByRole('img', { name: 'warning' })).toBeInTheDocument();
    expect(legend).toHaveTextContent(
      /icon marks information that differs from the court, division, chapter or status of these cases/,
    );
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

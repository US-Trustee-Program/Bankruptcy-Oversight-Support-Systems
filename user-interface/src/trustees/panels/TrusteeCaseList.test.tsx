import { render, screen, waitFor } from '@testing-library/react';
import { vi, describe, test, expect, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import TrusteeCaseList from './TrusteeCaseList';
import Api2 from '@/lib/models/api2';
import { TrusteeCaseListItem } from '@common/cams/trustee-appointments';

const mockCases: TrusteeCaseListItem[] = [
  {
    caseId: '081-24-12345',
    caseNumber: '24-12345',
    chapter: '7',
    dateFiled: '2024-03-15',
    appointedDate: '2024-03-20',
  },
  {
    caseId: '081-23-99999',
    caseNumber: '23-99999',
    chapter: '13',
    dateFiled: '2023-11-01',
    appointedDate: '2023-11-05',
  },
];

function renderComponent(trusteeId = 'trustee-123') {
  return render(
    <BrowserRouter>
      <TrusteeCaseList trusteeId={trusteeId} />
    </BrowserRouter>,
  );
}

describe('TrusteeCaseList', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  test('shows loading spinner while fetching', () => {
    vi.spyOn(Api2, 'getTrusteeCases').mockReturnValue(new Promise(() => {}));
    renderComponent();
    expect(document.querySelector('.loading-spinner')).toBeInTheDocument();
  });

  test('shows empty state when no cases returned', async () => {
    vi.spyOn(Api2, 'getTrusteeCases').mockResolvedValue({ data: [] });
    renderComponent();
    await waitFor(() => {
      expect(screen.getByText('No case appointments found.')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('trustee-case-list-table')).not.toBeInTheDocument();
  });

  test('shows error alert when fetch fails', async () => {
    vi.spyOn(Api2, 'getTrusteeCases').mockRejectedValue(new Error('network error'));
    renderComponent();
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
    expect(screen.getByRole('alert')).toHaveTextContent('Could not load case list.');
  });

  test('renders table with case data', async () => {
    vi.spyOn(Api2, 'getTrusteeCases').mockResolvedValue({ data: mockCases });
    renderComponent();
    await waitFor(() => {
      expect(screen.getByTestId('trustee-case-list-table')).toBeInTheDocument();
    });
    expect(screen.getByText('24-12345')).toBeInTheDocument();
    expect(screen.getByText('23-99999')).toBeInTheDocument();
  });

  test('renders correct column headers', async () => {
    vi.spyOn(Api2, 'getTrusteeCases').mockResolvedValue({ data: mockCases });
    renderComponent();
    await waitFor(() => {
      expect(screen.getByTestId('trustee-case-list-table')).toBeInTheDocument();
    });
    expect(screen.getByText('Case Number')).toBeInTheDocument();
    expect(screen.getByText('Chapter')).toBeInTheDocument();
    expect(screen.getByText('Filed Date')).toBeInTheDocument();
    expect(screen.getByText('Appointed Date')).toBeInTheDocument();
  });

  test('calls getTrusteeCases with correct trusteeId', async () => {
    const spy = vi.spyOn(Api2, 'getTrusteeCases').mockResolvedValue({ data: [] });
    renderComponent('trustee-abc');
    await waitFor(() => {
      expect(spy).toHaveBeenCalledWith('trustee-abc');
    });
  });

  test('root element has data-testid trustee-case-list', () => {
    vi.spyOn(Api2, 'getTrusteeCases').mockReturnValue(new Promise(() => {}));
    renderComponent();
    expect(screen.getByTestId('trustee-case-list')).toBeInTheDocument();
  });
});

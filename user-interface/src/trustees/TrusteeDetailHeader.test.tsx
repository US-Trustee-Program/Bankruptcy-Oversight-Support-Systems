import { render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import TrusteeDetailHeader, { TrusteeDetailHeaderProps } from './TrusteeDetailHeader';
import { Trustee, ChapterType } from '@common/cams/trustees';
import { SYSTEM_USER_REFERENCE } from '@common/cams/auditable';

// Mock the chapters utility
vi.mock('@common/cams/trustees', () => ({
  formatChapterType: vi.fn((chapter: string) => {
    switch (chapter) {
      case '7-panel':
        return '7 - Panel';
      case '7-non-panel':
        return '7 - Non-Panel';
      case '11':
        return '11';
      case '11-subchapter-v':
        return '11 - Subchapter V';
      case '12':
        return '12';
      case '13':
        return '13';
      default:
        return chapter; // Return original value for unknown chapters
    }
  }),
}));

const mockTrustee: Trustee = {
  id: '--id-guid--',
  trusteeId: '123',
  name: 'John Doe',
  public: {
    address: {
      address1: '123 Main St',
      address2: 'c/o John Smith',
      address3: 'Ch 7',
      city: 'Anytown',
      state: 'NY',
      zipCode: '12345',
      countryCode: 'US',
    },
    phone: { number: '555-123-4567', extension: '1234' },
    email: 'john.doe.public@example.com',
  },
  districts: ['NYEB', 'NYWB'],
  chapters: ['7-panel', '11', '13'],
  status: 'active',
  updatedBy: SYSTEM_USER_REFERENCE,
  updatedOn: '2024-01-01T00:00:00Z',
};

function renderWithProps(props?: Partial<TrusteeDetailHeaderProps>) {
  const defaultProps: TrusteeDetailHeaderProps = {
    trustee: mockTrustee,
    isLoading: false,
    districtLabels: ['Eastern District of New York', 'Central District of California'],
  };

  const renderProps = { ...defaultProps, ...props };
  render(<TrusteeDetailHeader {...renderProps} />);
}

describe('TrusteeDetailHeader', () => {
  test('should render loading state when isLoading is true', () => {
    renderWithProps({ isLoading: true, districtLabels: [] });

    expect(screen.getByText('Trustee Details')).toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByText('John Doe')).not.toBeInTheDocument();
  });

  test('should render loading state when trustee is null', () => {
    renderWithProps({ trustee: null });

    expect(screen.getByText('Trustee Details')).toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  test('should render trustee header with name when loaded', () => {
    renderWithProps({ subHeading: 'Trustee' });

    expect(screen.getByRole('heading', { level: 1, name: 'John Doe' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Trustee' })).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  test('should render status tag with correct formatting and color', () => {
    renderWithProps({});

    const statusTag = screen.getByText('Active');
    expect(statusTag).toBeInTheDocument();
    expect(statusTag).toHaveAttribute('title', 'Trustee status');
    expect(statusTag.closest('[id="trustee-status"]')).toHaveClass('bg-success');
  });

  test('should render district tags with provided labels', () => {
    renderWithProps({});

    expect(screen.getByText('Eastern District of New York')).toBeInTheDocument();
    expect(screen.getByText('Central District of California')).toBeInTheDocument();

    const districtTag1 = screen
      .getByText('Eastern District of New York')
      .closest('[id="district-0"]');
    const districtTag2 = screen
      .getByText('Central District of California')
      .closest('[id="district-1"]');

    expect(districtTag1).toHaveClass('bg-primary');
    expect(districtTag2).toHaveClass('bg-primary');
  });

  test('should render chapter tags with formatted chapter types', () => {
    renderWithProps({});

    expect(screen.getByText('Chapter 7 - Panel')).toBeInTheDocument();
    expect(screen.getByText('Chapter 11')).toBeInTheDocument();
    expect(screen.getByText('Chapter 13')).toBeInTheDocument();

    const chapterTag1 = screen.getByText('Chapter 7 - Panel').closest('[id="chapter-0"]');
    const chapterTag2 = screen.getByText('Chapter 11').closest('[id="chapter-1"]');
    const chapterTag3 = screen.getByText('Chapter 13').closest('[id="chapter-2"]');

    expect(chapterTag1).toHaveClass('bg-accent-warm-dark');
    expect(chapterTag2).toHaveClass('bg-accent-warm-dark');
    expect(chapterTag3).toHaveClass('bg-accent-warm-dark');
  });

  test.each([
    ['active', 'Active', 'bg-success'],
    ['suspended', 'Suspended', 'bg-secondary-dark'],
    ['not active', 'Not Active', 'bg-base-darkest'],
  ])('should format status "%s" as "%s" with style "%s"', (status, expectedText, expectedClass) => {
    const testTrustee = { ...mockTrustee, status: status as 'active' | 'suspended' | 'not active' };

    renderWithProps({ trustee: testTrustee });

    const statusTag = screen.getByText(expectedText);
    expect(statusTag).toBeInTheDocument();
    expect(statusTag.closest('[id="trustee-status"]')).toHaveClass(expectedClass);
  });

  test('should render with single chapter', () => {
    const trusteeWithOneChapter = { ...mockTrustee, chapters: ['11' as ChapterType] };

    renderWithProps({ trustee: trusteeWithOneChapter });

    expect(screen.getByText('Chapter 11')).toBeInTheDocument();
    expect(screen.queryByText('Chapter 7 - Panel')).not.toBeInTheDocument();
    expect(screen.queryByText('Chapter 13')).not.toBeInTheDocument();
  });

  test('should handle empty district labels', () => {
    renderWithProps({ districtLabels: [] });

    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.queryByText('Eastern District of New York')).not.toBeInTheDocument();
    expect(screen.queryByText('Central District of California')).not.toBeInTheDocument();
  });
});

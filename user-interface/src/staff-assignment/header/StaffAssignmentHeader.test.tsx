import { render, screen } from '@testing-library/react';
import { StaffAssignmentHeader } from './StaffAssignmentHeader';

describe('StaffAssignmentHeader', () => {
  test('should render all column headers', () => {
    render(<StaffAssignmentHeader labels={[]} id="test-id" />);

    expect(screen.getByText('Case Number (Division)')).toBeInTheDocument();
    expect(screen.getByText('Case Title')).toBeInTheDocument();
    expect(screen.getByText('Chapter')).toBeInTheDocument();
    expect(screen.getByText('Case Filed')).toBeInTheDocument();
    expect(screen.getByText('Staff Assignment')).toBeInTheDocument();
  });
});

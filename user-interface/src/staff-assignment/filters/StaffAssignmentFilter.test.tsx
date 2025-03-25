import { render, screen } from '@testing-library/react';
import StaffAssignmentFilter, { StaffAssignmentFilterProps } from './StaffAssignmentFilter';
import MockData from '@common/cams/test-utilities/mock-data';
import MockApi2 from '@/lib/testing/mock-api2';

const offices = MockData.getOffices();
const officeCode = offices[0].officeCode;

const defaultProps: StaffAssignmentFilterProps = {
  id: '0',
  officeCode,
};

describe('Tests for Staff Assignment Screen Filters', () => {
  function renderWithProps(props?: Partial<StaffAssignmentFilterProps>) {
    const renderProps = { ...defaultProps, ...props };

    render(<StaffAssignmentFilter {...renderProps} />);
  }

  test('should have a filter multi-select dropdown for Assigned Attorneys', async () => {
    renderWithProps();

    const filter = screen.getByTestId('staff-assignment-filter-0');
    expect(filter).toBeInTheDocument();
  });

  test('should grab staff assignees from Api', async () => {
    const getOfficeAssigneesSpy = vi.spyOn(MockApi2, 'getOfficeAssignees').mockResolvedValue({
      data: [
        MockData.getStaffAssignee(),
        MockData.getStaffAssignee(),
        MockData.getStaffAssignee(),
        MockData.getStaffAssignee(),
      ],
    });

    renderWithProps();

    expect(getOfficeAssigneesSpy).toHaveBeenCalled();
  });
});

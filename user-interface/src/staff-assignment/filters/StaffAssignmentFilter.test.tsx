import { render, screen, waitFor } from '@testing-library/react';
import StaffAssignmentFilter, { StaffAssignmentFilterProps } from './StaffAssignmentFilter';
import MockData from '@common/cams/test-utilities/mock-data';
import Api2 from '@/lib/models/api2';
import { MockInstance } from 'vitest';
//import MockApi2 from '@/lib/testing/mock-api2';

const offices = MockData.getOffices();
const officeCode = offices[0].officeCode;

const defaultProps: StaffAssignmentFilterProps = {
  id: '0',
  officeCode,
};

describe('Tests for Staff Assignment Screen Filters', () => {
  let getOfficeAssigneesSpy: MockInstance;
  function renderWithProps(props?: Partial<StaffAssignmentFilterProps>) {
    const renderProps = { ...defaultProps, ...props };

    render(<StaffAssignmentFilter {...renderProps} />);
  }

  beforeEach(() => {
    getOfficeAssigneesSpy = vi.spyOn(Api2, 'getOfficeAssignees').mockResolvedValue({
      data: [
        MockData.getStaffAssignee(),
        MockData.getStaffAssignee(),
        MockData.getStaffAssignee(),
        MockData.getStaffAssignee(),
      ],
    });
  });

  test('should have a filter multi-select dropdown for Assigned Attorneys', async () => {
    renderWithProps();

    const filter = screen.getByTestId('staff-assignment-filter-0');
    expect(filter).toBeInTheDocument();
  });

  test('should grab staff assignees from Api', async () => {
    renderWithProps();

    expect(getOfficeAssigneesSpy).toHaveBeenCalled();

    await waitFor(() => {
      const itemList = document.querySelector('#staff-assignees-item-list');
      expect(itemList!).toBeInTheDocument();
    });

    expect(screen.getByTestId('staff-assignees-option-item-2')).toBeInTheDocument();
  });
});

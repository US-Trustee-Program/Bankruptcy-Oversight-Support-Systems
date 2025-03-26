import { render, screen, waitFor } from '@testing-library/react';
import StaffAssignmentFilter, {
  getOfficeAssignees,
  StaffAssignmentFilterProps,
} from './StaffAssignmentFilter';
import MockData from '@common/cams/test-utilities/mock-data';
import Api2 from '@/lib/models/api2';
import { MockInstance } from 'vitest';
import { CamsSession } from '@common/cams/session';
import LocalStorage from '@/lib/utils/local-storage';
import userEvent from '@testing-library/user-event';

const offices = MockData.getOffices();

const defaultProps: StaffAssignmentFilterProps = {
  id: '0',
};

const officeStaffData = [
  [
    MockData.getStaffAssignee(),
    MockData.getStaffAssignee(),
    MockData.getStaffAssignee(),
    MockData.getStaffAssignee(),
  ],
  [
    MockData.getStaffAssignee(),
    MockData.getStaffAssignee(),
    MockData.getStaffAssignee(),
    MockData.getStaffAssignee(),
  ],
  [
    MockData.getStaffAssignee(),
    MockData.getStaffAssignee(),
    MockData.getStaffAssignee(),
    MockData.getStaffAssignee(),
  ],
  [
    MockData.getStaffAssignee(),
    MockData.getStaffAssignee(),
    MockData.getStaffAssignee(),
    MockData.getStaffAssignee(),
  ],
];

describe('Tests for Staff Assignment Screen Filters', () => {
  let getOfficeAssigneesSpy: MockInstance;
  let session: CamsSession;
  function renderWithProps(props?: Partial<StaffAssignmentFilterProps>) {
    const renderProps = { ...defaultProps, ...props };

    render(<StaffAssignmentFilter {...renderProps} />);
  }

  beforeEach(() => {
    session = MockData.getCamsSession();
    session.user.offices = offices;
    vi.spyOn(LocalStorage, 'getSession').mockReturnValue(session);
    getOfficeAssigneesSpy = vi
      .spyOn(Api2, 'getOfficeAssignees')
      .mockResolvedValueOnce({
        data: officeStaffData[0],
      })
      .mockResolvedValueOnce({
        data: officeStaffData[1],
      })
      .mockResolvedValueOnce({
        data: officeStaffData[2],
      })
      .mockResolvedValueOnce({
        data: officeStaffData[3],
      });
  });

  test('should have a filter multi-select dropdown for Assigned Attorneys', async () => {
    renderWithProps();

    const filter = screen.getByTestId('staff-assignment-filter-0');
    expect(filter).toBeInTheDocument();
  });

  test('should return an array of type Staff with a list of assignees from all offices the session user is assigned to', async () => {
    const expectedResults = officeStaffData.flat(2);
    const staffArray = await getOfficeAssignees(Api2.getOfficeAssignees, session);
    expect(staffArray).toEqual(expectedResults);
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

  test('should call callback function when assignees are selected', async () => {
    const changeSpy = vi.fn();
    const expectedAssignee = {
      id: officeStaffData[1][0].id,
      name: officeStaffData[1][0].name,
    };

    renderWithProps({ onFilterAssigneeChange: changeSpy });

    let comboBoxExpandButton;
    await waitFor(() => {
      comboBoxExpandButton = document.querySelector('#staff-assignees-expand');
      expect(comboBoxExpandButton).toBeInTheDocument();
    });

    await userEvent.click(comboBoxExpandButton!);

    let assigneeItem;
    await waitFor(() => {
      assigneeItem = screen.getByTestId('staff-assignees-option-item-4');
      expect(assigneeItem).toBeInTheDocument();
    });

    await userEvent.click(assigneeItem!);
    await userEvent.click(document.body);

    expect(changeSpy).toHaveBeenCalled();
    changeSpy.mock.calls.forEach((spy) => {
      expect(spy[0]).toEqual(expectedAssignee);
    });
  });
});

import { render } from '@testing-library/react';
import { StaffAssignmentHeader } from './StaffAssignmentHeader';

describe('TableHeader test', () => {
  test('Should render header', () => {
    render(
      <table>
        <StaffAssignmentHeader labels={[]} id={'test-id'} />
      </table>,
    );
    const header = document.querySelector('#test-id-table-header');
    expect(header).toBeVisible();
  });
});

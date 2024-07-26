import MockData from '@common/cams/test-utilities/mock-data';
import { BrowserRouter } from 'react-router-dom';
import { AssignAttorneyCasesTable } from '@/case-assignment/AssignAttorneyCasesTable';
import { render, waitFor } from '@testing-library/react';
import React from 'react';
import { AssignAttorneyModalRef } from '@/case-assignment/AssignAttorneyModal';

describe('AssignAttorneyCasesTable Tests', () => {
  test('attorney assignment button should not be present if user does not have CaseAssignmentManager role', async () => {
    const caseList = MockData.buildArray(MockData.getCaseBasics, 3);
    const modalRef = React.createRef<AssignAttorneyModalRef>();
    render(
      <BrowserRouter>
        <AssignAttorneyCasesTable caseList={caseList} modalId={'modal'} modalRef={modalRef} />
      </BrowserRouter>,
    );

    await waitFor(() => {
      const assignButton = document.querySelector('.case-assignment-modal-toggle');
      expect(assignButton).toBeNull();
    });
  });
});

import MockData from '@common/cams/test-utilities/mock-data';
import { BrowserRouter } from 'react-router-dom';
import { AssignAttorneyCasesTable } from '@/case-assignment/AssignAttorneyCasesTable';
import { render, waitFor } from '@testing-library/react';
import React from 'react';
import { AssignAttorneyModalRef } from '@/case-assignment/AssignAttorneyModal';
import { Actions, ResourceActions } from '@common/cams/actions';
import { CaseBasics } from '@common/cams/cases';

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

  test('attorney assignment button should be present if user has CaseAssignmentManager role', async () => {
    const caseList: ResourceActions<CaseBasics>[] = MockData.buildArray(() => {
      return { ...MockData.getCaseBasics(), _actions: [Actions.ManageAssignments] };
    }, 3);
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

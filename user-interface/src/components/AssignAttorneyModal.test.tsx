import { render } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import AssignAttorneyModal from './AssignAttorneyModal';
import React from 'react';
import { Chapter15Type } from '../type-declarations/chapter-15';

describe('Test Assign Attorney Modal Component', () => {
  test('Should open modal with submit disabled, and enable button when item is checked, and disable when there are no more items checked.', async () => {
    const bCase: Chapter15Type = {
      caseNumber: '123',
      caseTitle: 'Test Case',
      dateFiled: '01/01/2024',
    };

    const modalRef = React.createRef<ModalRefType>();
    const callback = vi.fn();

    render(
      <React.StrictMode>
        <BrowserRouter>
          <AssignAttorneyModal
            ref={modalRef}
            bCase={bCase}
            modalId="some-modal-id"
            openerId="opener-123"
            callBack={callback}
          ></AssignAttorneyModal>
        </BrowserRouter>
      </React.StrictMode>,
    );
  });
});

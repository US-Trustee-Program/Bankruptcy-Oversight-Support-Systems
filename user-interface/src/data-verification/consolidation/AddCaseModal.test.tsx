import { describe } from 'vitest';
import AddCaseModal, {
  AddCaseModalImperative,
} from '@/data-verification/consolidation/AddCaseModal';
import { render, waitFor } from '@testing-library/react';
import { AddCaseModel } from '@/data-verification/consolidation/consolidationViewModel';
import MockData from '@common/cams/test-utilities/mock-data';
import { BrowserRouter } from 'react-router-dom';
import React, { act } from 'react';

describe('AddCaseModal', () => {
  const handleAddCaseCourtSelectChange = vi.fn().mockReturnValue(undefined);
  const handleAddCaseNumberInputChange = vi.fn().mockReturnValue(undefined);
  const handleAddCaseReset = vi.fn().mockReturnValue(undefined);
  const handleAddCaseAction = vi.fn().mockResolvedValue(undefined);

  function renderWithProps(override: Partial<AddCaseModel> = {}) {
    const ref = React.createRef<AddCaseModalImperative>();

    const defaultDivisionCode = '081';
    const defaultViewModel: AddCaseModel = {
      orderId: '1000',
      defaultDivisionCode,
      handleAddCaseCourtSelectChange,
      handleAddCaseNumberInputChange,
      handleAddCaseReset,
      filteredOfficeRecords: [{ value: defaultDivisionCode, label: 'label' }],
      additionalCaseDivisionRef: {
        current: null,
      },
      additionalCaseNumberRef: {
        current: null,
      },
      addCaseNumberError: null,
      isLookingForCase: false,
      caseToAdd: null,
      handleAddCaseAction,
      caseToAddCourt: '710',
      caseToAddCaseNumber: '11-11111',
      verifyCaseCanBeAdded: vi.fn(),
    };
    const viewModel: AddCaseModel = {
      ...defaultViewModel,
      ...override,
    };

    render(
      <BrowserRouter>
        <AddCaseModal id="test-id" addCaseModel={viewModel} ref={ref}></AddCaseModal>
      </BrowserRouter>,
    );
    return { ref, viewModel };
  }

  test('should show error messages', async () => {
    renderWithProps({ addCaseNumberError: 'Error message' });
    expect(document.querySelector('.usa-alert__body')).toHaveTextContent('Error message');
  });

  test('should show case to add details', async () => {
    const caseToAdd = MockData.getConsolidatedOrderCase();
    renderWithProps({ caseToAdd });
    const details = document.querySelector('.search-results');

    expect(details).toHaveTextContent(caseToAdd.caseTitle);
    expect(details).toHaveTextContent(caseToAdd.chapter);
    expect(details).toHaveTextContent(caseToAdd.dateFiled);
  });

  test('should set the selected court division equal to the default division code', async () => {
    const { ref, viewModel } = renderWithProps({ defaultDivisionCode: '081' });
    act(() => ref.current!.show({}));
    await waitFor(() => {
      expect(viewModel.additionalCaseDivisionRef.current!.getSelections()).toEqual([
        { value: '081', label: 'label' },
      ]);
    });
  });

  test('should not set a court division if the default division code is bad', async () => {
    const { ref, viewModel } = renderWithProps({ defaultDivisionCode: 'bad' });
    act(() => ref.current!.show({}));
    await waitFor(() => {
      expect(viewModel.additionalCaseDivisionRef.current!.getSelections()).toEqual([]);
    });
  });

  test('should delegate reset to the view model', async () => {
    const { ref } = renderWithProps();
    act(() => ref.current!.hide({}));
    expect(handleAddCaseReset).toHaveBeenCalled();
  });

  test('should call verifyCaseCanBeAdded when provided caseToAddCaseNumber and caseToAddCourt', () => {
    const { viewModel } = renderWithProps();
    expect(viewModel.verifyCaseCanBeAdded).toHaveBeenCalled();
  });
});

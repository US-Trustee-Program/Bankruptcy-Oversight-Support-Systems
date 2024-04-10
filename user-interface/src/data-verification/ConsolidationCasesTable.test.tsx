import { BrowserRouter } from 'react-router-dom';
import {
  ConsolidationCaseTable,
  ConsolidationCaseTableProps,
  OrderTableImperative,
} from './ConsolidationCasesTable';
import { render, waitFor } from '@testing-library/react';
import { MockData } from '@common/cams/test-utilities/mock-data';
import React from 'react';

describe('test ConsolidationCasesTable component', () => {
  function renderWithProps(
    props?: Partial<ConsolidationCaseTableProps>,
    tableRef?: React.Ref<OrderTableImperative>,
  ) {
    const defaultProps: ConsolidationCaseTableProps = {
      id: 'test-consolidation-cases-table',
      cases: props?.cases ?? [],
      onSelect: props?.onSelect ?? vi.fn(),
      updateAllSelections: props?.updateAllSelections ?? vi.fn(),
      isAssignmentLoaded: props?.isAssignmentLoaded ?? true,
      displayDocket: props?.displayDocket ?? false,
    };

    const renderProps = { ...defaultProps, ...props };
    render(
      <BrowserRouter>
        <ConsolidationCaseTable {...renderProps} ref={tableRef} />
      </BrowserRouter>,
    );
  }

  test('should select all checkboxes when ref.selectAllCheckboxes() is called and clear them when ref.clearAllCheckboxes() is called', async () => {
    const tableRef = React.createRef<OrderTableImperative>();
    let checkboxes: NodeListOf<HTMLInputElement>;
    let checkbox: HTMLInputElement;

    const props = {
      cases: MockData.buildArray(() => MockData.getConsolidatedOrderCase(), 5),
      updateAllSelections: vi.fn(),
    };

    renderWithProps(props, tableRef);

    checkboxes = document.querySelectorAll(`.consolidation-cases-table input`);

    expect(checkboxes).not.toBeUndefined();

    if (checkboxes) {
      for (checkbox of checkboxes) {
        expect(checkbox.checked).toBeFalsy();
      }
    }

    tableRef.current?.selectAllCheckboxes();

    expect(props.updateAllSelections).toHaveBeenCalledWith(props.cases);

    await waitFor(() => {
      checkboxes = document.querySelectorAll(`.consolidation-cases-table input`);
      for (checkbox of checkboxes) {
        expect((checkbox as HTMLInputElement).checked).toBeTruthy();
      }
    });

    tableRef.current?.clearAllCheckboxes();

    await waitFor(() => {
      checkboxes = document.querySelectorAll(`.consolidation-cases-table input`);
      for (checkbox of checkboxes) {
        expect((checkbox as HTMLInputElement).checked).toBeFalsy();
      }
    });
    expect(props.updateAllSelections).toHaveBeenCalledWith([]);
  });

  test('should have text (unassigned) when no assignments are passed in', async () => {
    const props = {
      cases: [
        MockData.getConsolidatedOrderCase({
          override: {
            attorneyAssignments: [],
          },
        }),
      ],
    };

    renderWithProps(props);

    expect(document.body).toHaveTextContent('(unassigned)');
  });

  test('should have text "no docket entries" when no docket entries are passed in', async () => {
    const props = {
      cases: [
        MockData.getConsolidatedOrderCase({
          override: {
            docketEntries: undefined,
          },
        }),
      ],
    };

    renderWithProps(props);

    expect(document.body).toHaveTextContent('No docket entries');
  });
});

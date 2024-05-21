import { BrowserRouter } from 'react-router-dom';
import {
  ConsolidationCaseTable,
  ConsolidationCaseTableProps,
  OrderTableImperative,
} from './ConsolidationCasesTable';
import { render, waitFor, screen, fireEvent } from '@testing-library/react';
import { MockData } from '@common/cams/test-utilities/mock-data';
import React from 'react';
import { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import { ConsolidationOrderCase } from '@common/cams/orders';

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
      isDataEnhanced: props?.isDataEnhanced ?? true,
      displayDocket: props?.displayDocket ?? false,
      onMarkLead: (_bCase: ConsolidationOrderCase) => {},
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

  test('should have attorney names when assignments are passed in', async () => {
    const assignees = MockData.buildArray(MockData.getAttorneyAssignment, 3);
    const props = {
      cases: [
        MockData.getConsolidatedOrderCase({
          override: {
            attorneyAssignments: assignees,
          },
        }),
      ],
    };

    renderWithProps(props);

    expect(document.body).not.toHaveTextContent('(unassigned)');
    assignees.forEach((assignee) => {
      expect(document.body).toHaveTextContent(assignee.name);
    });
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

  test('Should display "Already part of consolidation" alert if a case in a consolidation order is a part of another consolidation', () => {
    const props = {
      cases: [
        MockData.getConsolidatedOrderCase({
          override: {
            associations: [
              MockData.getConsolidationReference({
                override: {
                  caseId: '11-1111',
                  documentType: 'CONSOLIDATION_FROM',
                },
              }),
            ],
          },
        }),
      ],
    };

    renderWithProps(props);

    expect(screen.getByTestId('alert-container')).toHaveTextContent(
      'This case is already part of a consolidation. Uncheck it to consolidate the other cases.',
    );
  });

  test('Should not display alert if the case not a part of another consolidation', async () => {
    const props = {
      cases: [
        MockData.getConsolidatedOrderCase({
          override: {
            associations: [],
          },
        }),
      ],
    };

    renderWithProps(props);

    const alert = screen.queryByTestId('alert-container');
    expect(alert).not.toBeInTheDocument();
  });

  // test selecting different "lead case" buttons and make sure
  // - Button style and label is updated properly when different buttons are selected or clicked on and off
  // - Button properly fires on click event from parent

  test('should change lead case button styles and labels and call onMarkLead', () => {
    const tableRef = React.createRef<OrderTableImperative>();
    let leadCaseButton: HTMLButtonElement;
    const onMarkLead = vi.fn();

    const props = {
      cases: MockData.buildArray(() => MockData.getConsolidatedOrderCase(), 3),
      onMarkLead,
    };

    renderWithProps(props, tableRef);

    const leadCaseButtons = document.querySelectorAll('.mark-as-lead-button');
    leadCaseButtons.forEach((button) => {
      expect(button).toHaveClass(UswdsButtonStyle.Outline);
      expect(button).toHaveTextContent('Mark as Lead');
    });

    let selectedLeadCaseIndex = 0;
    leadCaseButton = screen.getByTestId(`button-assign-lead-${selectedLeadCaseIndex}`);
    fireEvent.click(leadCaseButton);
    expect(onMarkLead.mock.calls[0][0]).toEqual(props.cases[selectedLeadCaseIndex]);

    leadCaseButtons.forEach((button) => {
      if (leadCaseButton.id === button.id) {
        console.log(button.className);
        expect(button).not.toHaveClass(UswdsButtonStyle.Outline);
        expect(button).toHaveTextContent('Lead Case');
      } else {
        console.log(button.className);
        expect(button).toHaveClass(UswdsButtonStyle.Outline);
        expect(button).toHaveTextContent('Mark as Lead');
      }
    });

    selectedLeadCaseIndex = 1;
    leadCaseButton = screen.getByTestId(`button-assign-lead-${selectedLeadCaseIndex}`);
    fireEvent.click(leadCaseButton);
    expect(onMarkLead.mock.calls[1][0]).toEqual(props.cases[selectedLeadCaseIndex]);

    leadCaseButtons.forEach((button) => {
      if (leadCaseButton.id === button.id) {
        expect(button).not.toHaveClass(UswdsButtonStyle.Outline);
        expect(button).toHaveTextContent('Lead Case');
      } else {
        expect(button).toHaveClass(UswdsButtonStyle.Outline);
        expect(button).toHaveTextContent('Mark as Lead');
      }
    });

    fireEvent.click(leadCaseButton);
    expect(onMarkLead.mock.calls[2][0]).toEqual(props.cases[selectedLeadCaseIndex]);
    leadCaseButtons.forEach((button) => {
      expect(button).toHaveClass(UswdsButtonStyle.Outline);
      expect(button).toHaveTextContent('Mark as Lead');
    });
  });
});

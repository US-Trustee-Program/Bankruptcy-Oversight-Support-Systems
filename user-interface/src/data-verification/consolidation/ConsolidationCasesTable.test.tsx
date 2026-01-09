import { BrowserRouter } from 'react-router-dom';
import ConsolidationCaseTable, {
  ConsolidationCaseTableProps,
  OrderTableImperative,
} from './ConsolidationCasesTable';
import { act, render, waitFor, screen, fireEvent } from '@testing-library/react';
import MockData from '@common/cams/test-utilities/mock-data';
import React from 'react';
import { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import { ConsolidationOrderCase } from '@common/cams/orders';

const tableId = 'test-consolidation-cases-table';

describe('test ConsolidationCasesTable component', () => {
  function renderWithProps(
    props?: Partial<ConsolidationCaseTableProps>,
    tableRef?: React.Ref<OrderTableImperative>,
  ) {
    const defaultProps: ConsolidationCaseTableProps = {
      id: tableId,
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

    act(() => tableRef.current?.selectAllCheckboxes());

    expect(props.updateAllSelections).toHaveBeenCalledWith(props.cases);

    await waitFor(() => {
      checkboxes = document.querySelectorAll(`.consolidation-cases-table input`);
      for (checkbox of checkboxes) {
        expect((checkbox as HTMLInputElement).checked).toBeTruthy();
      }
    });

    act(() => tableRef.current?.clearAllCheckboxes());

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

  test('Should display alert if a case is a part of another consolidation', () => {
    const props = {
      cases: [
        MockData.getConsolidatedOrderCase({
          override: {
            isMemberCase: true,
            associations: [
              MockData.getConsolidationReference({
                override: {
                  caseId: '11-1111',
                  documentType: 'CONSOLIDATION_TO',
                },
              }),
            ],
          },
        }),
      ],
    };

    renderWithProps(props);

    expect(screen.getByTestId('alert-container-is-child')).toHaveTextContent(
      'This case is a member case of a consolidation and cannot be consolidated.',
    );
  });

  test('Should display alert if a case is the lead case of another administrative consolidation', () => {
    const caseId = '11-1111';
    const props = {
      cases: [
        MockData.getConsolidatedOrderCase({
          override: {
            caseId,
            isLeadCase: true,
            associations: [
              MockData.getConsolidationReference({
                override: {
                  caseId,
                  documentType: 'CONSOLIDATION_FROM',
                  consolidationType: 'administrative',
                },
              }),
            ],
          },
        }),
      ],
    };

    renderWithProps(props);

    expect(screen.getByTestId('alert-container-is-lead')).toHaveTextContent(
      'This case is the lead case of a joint administration consolidation and can be used as the lead of this consolidation.',
    );
  });

  test('Should display alert if a case is the lead case of another substantive consolidation', () => {
    const caseId = '11-1111';
    const props = {
      cases: [
        MockData.getConsolidatedOrderCase({
          override: {
            caseId,
            isLeadCase: true,
            associations: [
              MockData.getConsolidationReference({
                override: {
                  caseId,
                  documentType: 'CONSOLIDATION_FROM',
                  consolidationType: 'substantive',
                },
              }),
            ],
          },
        }),
      ],
    };

    renderWithProps(props);

    expect(screen.getByTestId('alert-container-is-lead')).toHaveTextContent(
      'This case is the lead case of a substantive consolidation and can be used as the lead of this consolidation.',
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

  test('should render default button style and Lead Case and call onMarkLead when Mark as Lead is clicked', () => {
    const tableRef = React.createRef<OrderTableImperative>();
    const onMarkLead = vi.fn();
    const cases = MockData.buildArray(() => MockData.getConsolidatedOrderCase(), 3);

    const props = {
      cases,
      onMarkLead,
      leadCaseId: cases[0].caseId,
    };

    renderWithProps(props, tableRef);

    const leadCaseButtons = document.querySelectorAll('.mark-as-lead-button');

    const selectedLeadCaseIndex = 0;
    const leadCaseButton = screen.getByTestId(
      `button-assign-lead-${tableId}-${selectedLeadCaseIndex}`,
    );
    fireEvent.click(leadCaseButton);
    expect(onMarkLead.mock.calls[0][0]).toEqual(props.cases[selectedLeadCaseIndex]);

    leadCaseButtons.forEach((button) => {
      if (leadCaseButton.id === button.id) {
        expect(button).not.toHaveClass(UswdsButtonStyle.Outline);
        expect(button).toHaveTextContent('Lead Case');
      } else {
        expect(button).toHaveClass(UswdsButtonStyle.Outline);
        expect(button).toHaveTextContent('Mark as Lead');
      }
    });
  });

  test('should render outline button style and Mark as Lead and call onMarkLead when Lead Case is clicked', () => {
    const tableRef = React.createRef<OrderTableImperative>();
    const onMarkLead = vi.fn();
    const cases = MockData.buildArray(() => MockData.getConsolidatedOrderCase(), 3);

    const props = {
      cases,
      onMarkLead,
    };

    renderWithProps(props, tableRef);

    const leadCaseButtons = document.querySelectorAll('.mark-as-lead-button');

    const selectedLeadCaseIndex = 1;
    const leadCaseButton = screen.getByTestId(
      `button-assign-lead-${tableId}-${selectedLeadCaseIndex}`,
    );
    fireEvent.click(leadCaseButton);
    expect(onMarkLead.mock.calls[0][0]).toEqual(props.cases[selectedLeadCaseIndex]);

    leadCaseButtons.forEach((button) => {
      expect(button).toHaveClass(UswdsButtonStyle.Outline);
      expect(button).toHaveTextContent('Mark as Lead');
    });
  });
});

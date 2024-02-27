import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { orderType, orderStatusType } from '@/lib/utils/labels';
import { BrowserRouter } from 'react-router-dom';
import { ConsolidationOrder } from '@common/cams/orders';
import {
  ConfirmationModal,
  ConfirmationModalImperative,
  ConfirmationModalProps,
  ConsolidationOrderAccordion,
  ConsolidationOrderAccordionProps,
} from '@/data-verification/ConsolidationOrderAccordion';
import { MockData } from '@common/cams/test-utilities/mock-data';
import { OfficeDetails } from '@common/cams/courts';
import { formatDate } from '@/lib/utils/datetime';
import React from 'react';

vi.mock(
  '../lib/components/SearchableSelect',
  () => import('../lib/components/SearchableSelect.mock'),
);

function findAccordionHeading(id: string) {
  const heading = screen.getByTestId(`accordion-heading-${id}`);
  expect(heading).toBeInTheDocument();
  expect(heading).toBeVisible();
  return heading;
}

function findAccordionContent(id: string, visible: boolean) {
  const content = screen.getByTestId(`accordion-content-${id}`);
  expect(content).toBeInTheDocument();
  if (visible) {
    expect(content).toBeVisible();
  } else {
    expect(content).not.toBeVisible();
  }
  return content;
}

describe('ConsolidationOrderAccordion tests', () => {
  const order: ConsolidationOrder = MockData.getConsolidationOrder();
  const offices: OfficeDetails[] = MockData.getOffices();
  const regionMap = new Map();

  function renderWithProps(props?: Partial<ConsolidationOrderAccordionProps>) {
    const defaultProps: ConsolidationOrderAccordionProps = {
      order,
      officesList: offices,
      orderType,
      statusType: orderStatusType,
      onOrderUpdate: () => {},
      onExpand: () => {},
      regionsMap: regionMap,
    };

    const renderProps = { ...defaultProps, ...props };
    render(
      <BrowserRouter>
        <ConsolidationOrderAccordion {...renderProps} />
      </BrowserRouter>,
    );
  }

  test('should render an order', async () => {
    renderWithProps();

    const heading = findAccordionHeading(order.id!);
    expect(heading?.textContent).toContain(order.courtName);
    expect(heading?.textContent).toContain(formatDate(order.orderDate));

    const content = findAccordionContent(order.id!, false);

    order.childCases.forEach((childCase) => {
      expect(content?.textContent).toContain(childCase.caseTitle);
      expect(content?.textContent).toContain(formatDate(childCase.dateFiled));
      childCase.docketEntries.forEach((de) => {
        expect(content?.textContent).toContain(de.summaryText);
        expect(content?.textContent).toContain(de.fullText);
      });
    });
  });

  test('should display pending order properly', () => {});

  test('should display approved order properly', () => {});

  test('should display rejected order properly', () => {});
});

describe('ConfirmationModalComponent', () => {
  const onCancelSpy = vitest.fn();
  const onConfirmSpy = vitest.fn();

  function selectItemInSearchableSelect(index: string) {
    const selectButton = document.querySelector(`#test-select-button-${index}`);
    expect(selectButton).toBeInTheDocument();
    fireEvent.click(selectButton!);
    return selectButton;
  }

  function findCaseNumberInputInModal(id: string) {
    const caseIdInput = document.querySelector(`input#lead-case-input-${id}`);
    expect(caseIdInput).toBeInTheDocument();
    return caseIdInput;
  }

  function enterCaseNumberInModal(caseIdInput: Element | null | undefined, value: string) {
    if (!caseIdInput) throw Error();

    fireEvent.change(caseIdInput!, { target: { value } });
    expect(caseIdInput).toHaveValue(value);

    return caseIdInput;
  }

  function renderModalWithProps(props: Partial<ConfirmationModalProps> = {}) {
    const modalRef = React.createRef<ConfirmationModalImperative>();
    const defaultProps: ConfirmationModalProps = {
      id: 'mock-modal-id',
      onCancel: onCancelSpy,
      onConfirm: onConfirmSpy,
      courts: [],
    };

    const renderProps = { ...defaultProps, ...props };

    render(
      <BrowserRouter>
        <ConfirmationModal {...renderProps} ref={modalRef} />
      </BrowserRouter>,
    );
    return modalRef;
  }

  beforeEach(() => {
    vitest.clearAllMocks();
  });

  test('should show rejection modal', async () => {
    const id = 'test';
    const caseIds = ['11-11111', '22-22222'];

    const ref = renderModalWithProps({ id });

    await waitFor(() => {
      ref.current?.show({ status: 'rejected', caseIds });
    });

    // Check heading
    const heading = document.querySelector('.usa-modal__heading');
    expect(heading).toHaveTextContent('Reject Case Consolidation?');

    // Check case Ids
    const caseIdDiv = screen.queryByTestId(`confirm-modal-${id}-caseIds`);
    expect(caseIdDiv).toBeInTheDocument();
    caseIds.forEach((caseId) => {
      expect(caseIdDiv).toHaveTextContent(caseId);
    });
  });

  test.only('should show approved modal', async () => {
    const id = 'test';
    const caseIds = ['11-11111', '22-22222'];
    const courts = MockData.getOffices().slice(0, 3);

    const ref = renderModalWithProps({ id, courts });
    let heading;
    await waitFor(() => {
      ref.current?.show({ status: 'approved', caseIds });
      heading = document.querySelector('.usa-modal__heading');
      expect(heading).toHaveTextContent('Additional Consolidation Information');
    });
    // Select Consolidation Type
    // const adminConsolidationRadioButton = screen.getByTestId(
    //   `radio-administrative-consolidation-${id}`,
    // );
    // const subsConsolidationRadioButton = screen.getByTestId(
    //   `radio-substantive-consolidation-${id}`,
    // );
    // fireEvent.click(adminConsolidationRadioButton);

    screen.debug(document.body);

    // Enter lead case court information and click Continue
    selectItemInSearchableSelect(`1`);

    // Enter case id
    const caseNumberInput = findCaseNumberInputInModal('test');
    enterCaseNumberInModal(caseNumberInput, '11-11111');

    // Select attorney
    //selectItemInSearchableSelect(`attorney-select-1`);

    // Click Verify
  });

  test('should call onConfirm callback when confirmation button is clicked', async () => {
    const id = 'test';
    const caseIds = ['11-11111', '22-22222'];

    const ref = renderModalWithProps({ id });

    await waitFor(() => {
      ref.current?.show({ status: 'rejected', caseIds });
    });

    const button = screen.queryByTestId(`toggle-modal-button-submit`);
    fireEvent.click(button as Element);

    await waitFor(() => {
      expect(onConfirmSpy).toHaveBeenCalled();
    });
  });

  test('should call onCancel callback when cancel button is clicked', async () => {
    const id = 'test';
    const caseIds = ['11-11111', '22-22222'];

    const ref = renderModalWithProps({ id });

    await waitFor(() => {
      ref.current?.show({ status: 'rejected', caseIds });
    });

    const button = screen.queryByTestId(`toggle-modal-button-cancel`);
    fireEvent.click(button as Element);

    await waitFor(() => {
      expect(onCancelSpy).toHaveBeenCalled();
    });
  });
});

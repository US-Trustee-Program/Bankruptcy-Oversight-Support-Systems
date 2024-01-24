import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import Chapter15MockApi from '@/lib/models/chapter15-mock.api.cases';
import { OfficeDetails, Order, OrderResponseData } from '@/lib/type-declarations/chapter-15';
import { AlertDetails, orderType, statusType } from './ReviewOrdersScreen';
import { BrowserRouter } from 'react-router-dom';
import { formatDate } from '@/lib/utils/datetime';
import { getCaseNumber } from '@/lib/utils/formatCaseNumber';
import {
  CaseSelection,
  TransferOrderAccordion,
  getOfficeList,
  isValidOrderTransfer,
  validateNewCaseIdInput,
} from './TransferOrderAccordion';
import React from 'react';
import { UswdsAlertStyle } from '@/lib/components/uswds/Alert';

vi.mock(
  '../lib/components/SearchableSelect',
  () => import('../lib/components/SearchableSelect.mock'),
);

describe('TransferOrderAccordion', () => {
  let order: Order;
  const regionMap = new Map();
  regionMap.set('02', 'NEW YORK');
  const testOffices: OfficeDetails[] = [
    {
      divisionCode: '001',
      groupDesignator: 'AA',
      courtId: '0101',
      officeCode: '1',
      officeName: 'A1',
      state: 'NY',
      courtName: 'A',
      courtDivisionName: 'New York 1',
      regionId: '02',
      regionName: 'NEW YORK',
    },
    {
      divisionCode: '003',
      groupDesignator: 'AC',
      courtId: '0103',
      officeCode: '3',
      officeName: 'C1',
      state: 'NY',
      courtName: 'C',
      courtDivisionName: 'New York 1',
      regionId: '02',
      regionName: 'NEW YORK',
    },
    {
      divisionCode: '002',
      groupDesignator: 'AB',
      courtId: '0102',
      officeCode: '2',
      officeName: 'B1',
      state: 'NY',
      courtName: 'B',
      courtDivisionName: 'New York 1',
      regionId: '02',
      regionName: 'NEW YORK',
    },
  ];

  beforeEach(async () => {
    vi.stubEnv('CAMS_PA11Y', 'true');
    const ordersResponse = (await Chapter15MockApi.get('/orders')) as unknown as OrderResponseData;
    order = ordersResponse.body[0];
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test('should render an order', async () => {
    render(
      <BrowserRouter>
        <TransferOrderAccordion
          order={order}
          officesList={testOffices}
          orderType={orderType}
          statusType={statusType}
          onOrderUpdate={() => {}}
          onExpand={() => {}}
          regionsMap={regionMap}
        />
      </BrowserRouter>,
    );

    const heading = screen.getByTestId(`accordion-heading-${order.id}`);
    expect(heading).toBeInTheDocument();
    expect(heading).toBeVisible();
    expect(heading?.textContent).toContain(order.caseTitle);
    expect(heading?.textContent).toContain(getCaseNumber(order.caseId));
    expect(heading?.textContent).toContain(formatDate(order.orderDate));

    const content = screen.getByTestId(`accordion-content-${order.id}`);
    expect(content).toBeInTheDocument();
    expect(content).not.toBeVisible();
    expect(content?.textContent).toContain(order.summaryText);
    expect(content?.textContent).toContain(order.fullText);

    const form = screen.getByTestId(`order-form-${order.id}`);
    expect(form).toBeInTheDocument();

    const newCaseIdText = screen.getByTestId(`new-case-input-${order.id}`);
    expect(newCaseIdText).toHaveValue(order.newCaseId);
  });

  test('should expand and show detail when a header is clicked', async () => {
    render(
      <BrowserRouter>
        <TransferOrderAccordion
          order={order}
          officesList={testOffices}
          orderType={orderType}
          statusType={statusType}
          onOrderUpdate={() => {}}
          onExpand={() => {}}
          regionsMap={regionMap}
        />{' '}
      </BrowserRouter>,
    );

    await waitFor(async () => {
      const heading = screen.getByTestId(`accordion-heading-${order.id}`);
      expect(heading).toBeInTheDocument();
      expect(heading).toBeVisible();

      const content = screen.getByTestId(`accordion-content-${order.id}`);
      expect(content).toBeInTheDocument();
      expect(content).not.toBeVisible();
    });

    const heading = screen.getByTestId(`accordion-heading-${order.id}`);
    if (heading) fireEvent.click(heading);

    await waitFor(async () => {
      const content = screen.getByTestId(`accordion-content-${order.id}`);
      expect(content).toBeInTheDocument();
      expect(content).toBeVisible();
    });
  });

  test('should expand and show order reject details with reason undefined when a rejected header is clicked if rejection does not have a reason.', async () => {
    const rejectedOrder: Order = { ...order, reason: '', status: 'rejected' };

    render(
      <BrowserRouter>
        <TransferOrderAccordion
          order={rejectedOrder}
          officesList={testOffices}
          orderType={orderType}
          statusType={statusType}
          onOrderUpdate={() => {}}
          onExpand={() => {}}
          regionsMap={regionMap}
        />{' '}
      </BrowserRouter>,
    );

    await waitFor(async () => {
      const heading = screen.getByTestId(`accordion-heading-${order.id}`);
      expect(heading).toBeInTheDocument();
    });

    const heading = screen.getByTestId(`accordion-heading-${order.id}`);
    if (heading) fireEvent.click(heading);

    await waitFor(async () => {
      const content = screen.getByTestId(`accordion-content-${order.id}`);
      expect(content).toBeInTheDocument();
      expect(content).toHaveTextContent(`Rejected transfer of ${getCaseNumber(order.caseId)}.`);
    });
  });

  test('should expand and show order reject details with reason when a rejected header is clicked that does have a reason defined', async () => {
    const rejectedOrder: Order = { ...order, reason: 'order is bad', status: 'rejected' };

    render(
      <BrowserRouter>
        <TransferOrderAccordion
          order={rejectedOrder}
          officesList={testOffices}
          orderType={orderType}
          statusType={statusType}
          onOrderUpdate={() => {}}
          onExpand={() => {}}
          regionsMap={regionMap}
        />{' '}
      </BrowserRouter>,
    );

    await waitFor(async () => {
      const heading = screen.getByTestId(`accordion-heading-${order.id}`);
      expect(heading).toBeInTheDocument();
    });

    const heading = screen.getByTestId(`accordion-heading-${order.id}`);
    if (heading) fireEvent.click(heading);

    await waitFor(async () => {
      const content = screen.getByTestId(`accordion-content-${order.id}`);
      expect(content).toBeInTheDocument();
      expect(content).toHaveTextContent(
        `Rejected transfer of ${getCaseNumber(order.caseId)} for the following reason:order is bad`,
      );
    });
  });

  test('should show preview description when a court is selected', async () => {
    render(
      <BrowserRouter>
        <TransferOrderAccordion
          order={order}
          officesList={testOffices}
          orderType={orderType}
          statusType={statusType}
          onOrderUpdate={() => {}}
          onExpand={() => {}}
          regionsMap={regionMap}
        />{' '}
      </BrowserRouter>,
    );

    expect(order.status).toBe('pending');

    await waitFor(async () => {
      const content = screen.getByTestId(`accordion-content-${order.id}`);
      expect(content).toBeInTheDocument();
      expect(content).not.toBeVisible();
    });

    const heading = screen.getByTestId(`accordion-heading-${order.id}`);
    if (heading) fireEvent.click(heading);

    await waitFor(async () => {
      const content = screen.getByTestId(`accordion-content-${order.id}`);
      expect(content).toBeInTheDocument();
      expect(content).toBeVisible();
    });

    /**
     * SearchableSelect is a black box.  We can't fire events on it.  We'll have to mock onChange on it.
     */
    const selectButton = document.querySelector('#test-select-button-1');
    expect(selectButton).toBeInTheDocument();
    fireEvent.click(selectButton!);

    let preview: HTMLElement;
    await waitFor(async () => {
      preview = screen.getByTestId(`preview-description-${order.id}`);
      expect(preview).toBeInTheDocument();
      expect(preview).toBeVisible();
      expect(preview?.textContent).toEqual(
        'USTP Office: transfer fromRegion 2 - Court Division 1toRegion 2 - New York 1',
      );
    });
  });

  test('should display modal and when Approve is clicked, upon submission of modal should update the status of order to approved', async () => {
    const orderUpdateSpy = vi
      .fn()
      .mockImplementation((_alertDetails: AlertDetails, _order?: Order) => {});

    render(
      <BrowserRouter>
        <TransferOrderAccordion
          order={order}
          officesList={testOffices}
          orderType={orderType}
          statusType={statusType}
          onOrderUpdate={orderUpdateSpy}
          onExpand={() => {}}
          regionsMap={regionMap}
        />{' '}
      </BrowserRouter>,
    );

    expect(order.status).toBe('pending');

    await waitFor(async () => {
      const content = screen.getByTestId(`accordion-content-${order.id}`);
      expect(content).toBeInTheDocument();
    });

    let heading: HTMLElement;
    await waitFor(async () => {
      heading = screen.getByTestId(`accordion-heading-${order.id}`);
    }).then(() => {
      fireEvent.click(heading);
    });

    const selectButton = document.querySelector('#test-select-button-1');
    expect(selectButton).toBeInTheDocument();
    fireEvent.click(selectButton!);

    const caseIdInput = document.querySelector(`input#new-case-input-${order.id}`);
    expect(caseIdInput).toBeInTheDocument();
    fireEvent.change(caseIdInput!, { target: { value: '24-12345' } });

    let approveButton;
    await waitFor(() => {
      approveButton = screen.getByTestId(`button-accordion-approve-button-${order.id}`);
      expect(approveButton).toBeEnabled();
    });
    fireEvent.click(approveButton!);

    let confirmModal: HTMLElement;
    await waitFor(async () => {
      confirmModal = screen.getByTestId('toggle-modal-button-submit');
      expect(confirmModal).toBeInTheDocument();
      expect(confirmModal).toBeVisible();
    });
    fireEvent.click(confirmModal!);

    await waitFor(async () => {
      expect(orderUpdateSpy).toHaveBeenCalled();
    });
  });

  test('should properly reject when API returns a successful reponse and a reason is supplied', async () => {
    const orderUpdateSpy = vi
      .fn()
      .mockImplementation((_alertDetails: AlertDetails, _order?: Order) => {});

    render(
      <BrowserRouter>
        <TransferOrderAccordion
          order={order}
          officesList={testOffices}
          orderType={orderType}
          statusType={statusType}
          onOrderUpdate={orderUpdateSpy}
          onExpand={() => {}}
          regionsMap={regionMap}
        />{' '}
      </BrowserRouter>,
    );

    expect(order.status).toBe('pending');

    await waitFor(async () => {
      const content = screen.getByTestId(`accordion-content-${order.id}`);
      expect(content).toBeInTheDocument();
    });

    let heading: HTMLElement;
    await waitFor(async () => {
      heading = screen.getByTestId(`accordion-heading-${order.id}`);
    }).then(() => {
      fireEvent.click(heading);
    });

    const selectButton = document.querySelector('#test-select-button-1');
    expect(selectButton).toBeInTheDocument();
    fireEvent.click(selectButton!);

    const caseIdInput = document.querySelector(`input#new-case-input-${order.id}`);
    expect(caseIdInput).toBeInTheDocument();
    fireEvent.change(caseIdInput!, { target: { value: '24-12345' } });

    let rejectButton;
    await waitFor(() => {
      rejectButton = screen.getByTestId(`button-accordion-reject-button-${order.id}`);
      expect(rejectButton).toBeEnabled();
    });
    fireEvent.click(rejectButton!);

    let rejectionReasonInput: HTMLElement;
    const rejectionValue = 'order has been rejected';
    let confirmModal: HTMLElement;

    await waitFor(async () => {
      rejectionReasonInput = screen.getByTestId(
        `rejection-reason-input-confirmation-modal-${order.id}`,
      );
      fireEvent.change(rejectionReasonInput!, { target: { value: rejectionValue } });
      expect(rejectionReasonInput).toHaveValue(rejectionValue);

      confirmModal = screen.getByTestId('toggle-modal-button-submit');
      expect(confirmModal).toBeInTheDocument();
    });
    fireEvent.click(confirmModal!);

    await waitFor(async () => {
      expect(orderUpdateSpy).toHaveBeenCalledWith(
        {
          message: `Transfer of case ${getCaseNumber(order.caseId)} was rejected.`,
          type: UswdsAlertStyle.Success,
          timeOut: 8,
        },
        {
          ...order,
          status: 'rejected',
          reason: rejectionValue,
        },
      );
    });
  });
  test('should properly clear rejection reason when modal is closed without submitting rejection', async () => {
    const orderUpdateSpy = vi
      .fn()
      .mockImplementation((_alertDetails: AlertDetails, _order?: Order) => {});

    render(
      <BrowserRouter>
        <TransferOrderAccordion
          order={order}
          officesList={testOffices}
          orderType={orderType}
          statusType={statusType}
          onOrderUpdate={orderUpdateSpy}
          onExpand={() => {}}
          regionsMap={regionMap}
        />{' '}
      </BrowserRouter>,
    );

    expect(order.status).toBe('pending');

    await waitFor(async () => {
      const content = screen.getByTestId(`accordion-content-${order.id}`);
      expect(content).toBeInTheDocument();
    });

    let heading: HTMLElement;
    await waitFor(async () => {
      heading = screen.getByTestId(`accordion-heading-${order.id}`);
    }).then(() => {
      fireEvent.click(heading);
    });

    const selectButton = document.querySelector('#test-select-button-1');
    expect(selectButton).toBeInTheDocument();
    fireEvent.click(selectButton!);

    const caseIdInput = document.querySelector(`input#new-case-input-${order.id}`);
    expect(caseIdInput).toBeInTheDocument();
    fireEvent.change(caseIdInput!, { target: { value: '24-12345' } });

    let rejectButton;
    await waitFor(() => {
      rejectButton = screen.getByTestId(`button-accordion-reject-button-${order.id}`);
      expect(rejectButton).toBeEnabled();
    });
    fireEvent.click(rejectButton!);

    let rejectionReasonInput: HTMLElement;
    const rejectionValue = 'order has been rejected';

    await waitFor(async () => {
      rejectionReasonInput = screen.getByTestId(
        `rejection-reason-input-confirmation-modal-${order.id}`,
      );
      fireEvent.change(rejectionReasonInput!, { target: { value: rejectionValue } });
      expect(rejectionReasonInput).toHaveValue(rejectionValue);
    });
    let goBack: HTMLElement;
    await waitFor(async () => {
      goBack = screen.getByTestId('toggle-modal-button-cancel');
      expect(goBack).toBeInTheDocument();
      expect(goBack).toBeVisible();
    });
    fireEvent.click(goBack!);

    fireEvent.click(rejectButton!);

    expect(rejectionReasonInput!).toHaveValue('');
    // Try again, now with the close button on the modal.
    let modalCloseButton: HTMLElement;
    await waitFor(async () => {
      modalCloseButton = screen.getByTestId(
        `modal-x-button-confirm-modal-confirmation-modal-${order.id}`,
      );
      expect(modalCloseButton).toBeInTheDocument();
      expect(modalCloseButton).toBeVisible();
    });

    await waitFor(async () => {
      fireEvent.change(rejectionReasonInput!, { target: { value: rejectionValue } });
      expect(rejectionReasonInput).toHaveValue(rejectionValue);
    });
    fireEvent.click(modalCloseButton!);
    fireEvent.click(rejectButton!);
    expect(rejectionReasonInput!).toHaveValue('');
  });

  test('should throw error durring Approval when API returns an error', async () => {
    const errorMessage = 'Some random error';
    vi.spyOn(Chapter15MockApi, 'patch').mockRejectedValue(new Error(errorMessage));
    const orderUpdateSpy = vi
      .fn()
      .mockImplementation((_alertDetails: AlertDetails, _order?: Order) => {});

    render(
      <BrowserRouter>
        <TransferOrderAccordion
          order={order}
          officesList={testOffices}
          orderType={orderType}
          statusType={statusType}
          onOrderUpdate={orderUpdateSpy}
          onExpand={() => {}}
          regionsMap={regionMap}
        />{' '}
      </BrowserRouter>,
    );

    expect(order.status).toBe('pending');

    await waitFor(async () => {
      const content = screen.getByTestId(`accordion-content-${order.id}`);
      expect(content).toBeInTheDocument();
    });

    let heading: HTMLElement;
    await waitFor(async () => {
      heading = screen.getByTestId(`accordion-heading-${order.id}`);
    }).then(() => {
      fireEvent.click(heading);
    });

    const selectButton = document.querySelector('#test-select-button-1');
    expect(selectButton).toBeInTheDocument();
    fireEvent.click(selectButton!);

    const caseIdInput = document.querySelector(`input#new-case-input-${order.id}`);
    expect(caseIdInput).toBeInTheDocument();
    fireEvent.change(caseIdInput!, { target: { value: '24-12345' } });

    let approveButton;
    await waitFor(() => {
      approveButton = screen.getByTestId(`button-accordion-approve-button-${order.id}`);
      expect(approveButton).toBeEnabled();
    });
    fireEvent.click(approveButton!);

    let confirmModal: HTMLElement;
    await waitFor(async () => {
      confirmModal = screen.getByTestId('toggle-modal-button-submit');
      expect(confirmModal).toBeInTheDocument();
    });
    fireEvent.click(confirmModal!);

    await waitFor(async () => {
      expect(orderUpdateSpy).toHaveBeenCalled();
      expect(orderUpdateSpy).toHaveBeenCalledWith({
        message: errorMessage,
        type: UswdsAlertStyle.Error,
        timeOut: 8,
      });
    });
  });

  test('should throw error durring Rejection when API returns an error', async () => {
    const errorMessage = 'Some random error';
    vi.spyOn(Chapter15MockApi, 'patch').mockRejectedValue(new Error(errorMessage));
    const orderUpdateSpy = vi
      .fn()
      .mockImplementation((_alertDetails: AlertDetails, _order?: Order) => {});

    render(
      <BrowserRouter>
        <TransferOrderAccordion
          order={order}
          officesList={testOffices}
          orderType={orderType}
          statusType={statusType}
          onOrderUpdate={orderUpdateSpy}
          onExpand={() => {}}
          regionsMap={regionMap}
        />{' '}
      </BrowserRouter>,
    );

    expect(order.status).toBe('pending');

    await waitFor(async () => {
      const content = screen.getByTestId(`accordion-content-${order.id}`);
      expect(content).toBeInTheDocument();
    });

    let heading: HTMLElement;
    await waitFor(async () => {
      heading = screen.getByTestId(`accordion-heading-${order.id}`);
    }).then(() => {
      fireEvent.click(heading);
    });

    const selectButton = document.querySelector('#test-select-button-1');
    expect(selectButton).toBeInTheDocument();
    fireEvent.click(selectButton!);

    const caseIdInput = document.querySelector(`input#new-case-input-${order.id}`);
    expect(caseIdInput).toBeInTheDocument();
    fireEvent.change(caseIdInput!, { target: { value: '24-12345' } });

    let rejectButton;
    await waitFor(() => {
      rejectButton = screen.getByTestId(`button-accordion-reject-button-${order.id}`);
      expect(rejectButton).toBeEnabled();
    });
    fireEvent.click(rejectButton!);

    let confirmModal: HTMLElement;
    await waitFor(async () => {
      confirmModal = screen.getByTestId('toggle-modal-button-submit');
      expect(confirmModal).toBeInTheDocument();
    });
    fireEvent.click(confirmModal!);

    await waitFor(async () => {
      expect(orderUpdateSpy).toHaveBeenCalled();
      expect(orderUpdateSpy).toHaveBeenCalledWith({
        message: errorMessage,
        type: UswdsAlertStyle.Error,
        timeOut: 8,
      });
    });
  });

  test('should leave input fields and data in place when closing the modal without approving', async () => {
    const orderUpdateSpy = vi
      .fn()
      .mockImplementation((_alertDetails: AlertDetails, _order?: Order) => {});

    render(
      <BrowserRouter>
        <TransferOrderAccordion
          order={order}
          officesList={testOffices}
          orderType={orderType}
          statusType={statusType}
          onOrderUpdate={orderUpdateSpy}
          onExpand={() => {}}
          regionsMap={regionMap}
        />
      </BrowserRouter>,
    );

    expect(order.status).toBe('pending');

    await waitFor(async () => {
      const content = screen.getByTestId(`accordion-content-${order.id}`);
      expect(content).toBeInTheDocument();
    });

    let heading: HTMLElement;
    await waitFor(async () => {
      heading = screen.getByTestId(`accordion-heading-${order.id}`);
    }).then(() => {
      fireEvent.click(heading);
    });

    const selectButton = document.querySelector('#test-select-button-1');
    expect(selectButton).toBeInTheDocument();
    fireEvent.click(selectButton!);

    const newUserInput = '24-12345';
    const caseIdInput = document.querySelector(`input#new-case-input-${order.id}`);
    expect(caseIdInput).toBeInTheDocument();
    fireEvent.change(caseIdInput!, { target: { value: newUserInput } });

    let approveButton;
    await waitFor(() => {
      approveButton = screen.getByTestId(`button-accordion-approve-button-${order.id}`);
      expect(approveButton).toBeEnabled();
    });
    fireEvent.click(approveButton!);

    // Use the "go back" link to close the modal.
    let goBack: HTMLElement;
    await waitFor(async () => {
      goBack = screen.getByTestId('toggle-modal-button-cancel');
      expect(goBack).toBeInTheDocument();
      expect(goBack).toBeVisible();
    });
    fireEvent.click(goBack!);

    await waitFor(() => {
      expect(caseIdInput).toHaveValue(newUserInput);
    });

    // Try again, now with the close button on the modal.
    fireEvent.click(approveButton!);
    let modalCloseButton: HTMLElement;
    await waitFor(async () => {
      modalCloseButton = screen.getByTestId(
        `modal-x-button-confirm-modal-confirmation-modal-${order.id}`,
      );
      expect(modalCloseButton).toBeInTheDocument();
      expect(modalCloseButton).toBeVisible();
    });
    fireEvent.click(modalCloseButton!);
    await waitFor(() => {
      expect(caseIdInput).toHaveValue(newUserInput);
    });
  });

  test('should clear input values and disable submission button when the Cancel button is clicked within the accordion', async () => {
    const orderUpdateSpy = vi
      .fn()
      .mockImplementation((_alertDetails: AlertDetails, _order?: Order) => {});

    render(
      <BrowserRouter>
        <TransferOrderAccordion
          order={order}
          officesList={testOffices}
          orderType={orderType}
          statusType={statusType}
          onOrderUpdate={orderUpdateSpy}
          onExpand={() => {}}
          regionsMap={regionMap}
        />{' '}
      </BrowserRouter>,
    );

    expect(order.status).toBe('pending');

    await waitFor(async () => {
      const content = screen.getByTestId(`accordion-content-${order.id}`);
      expect(content).toBeInTheDocument();
    });

    let heading: HTMLElement;
    await waitFor(async () => {
      heading = screen.getByTestId(`accordion-heading-${order.id}`);
    }).then(() => {
      fireEvent.click(heading);
    });

    const selectButton = document.querySelector('#test-select-button-1');
    expect(selectButton).toBeInTheDocument();
    fireEvent.click(selectButton!);

    const caseIdInput = document.querySelector(`input#new-case-input-${order.id}`);
    expect(caseIdInput).toBeInTheDocument();
    expect(caseIdInput).toHaveValue(order.newCaseId);

    fireEvent.change(caseIdInput!, { target: { value: '99-99999' } });
    expect(caseIdInput).toHaveValue('99-99999');

    let cancelButton: HTMLElement;
    await waitFor(async () => {
      cancelButton = screen.getByTestId(`button-accordion-cancel-button-${order.id}`);
      expect(cancelButton).toBeInTheDocument();
      expect(cancelButton).toBeVisible();
    });

    fireEvent.click(cancelButton!);

    await waitFor(() => {
      expect(caseIdInput).toHaveValue(order.newCaseId);
    });
  });

  test('should display modal and when Reject is clicked', async () => {
    const orderUpdateSpy = vi
      .fn()
      .mockImplementation((_alertDetails: AlertDetails, _order?: Order) => {});

    render(
      <BrowserRouter>
        <TransferOrderAccordion
          order={order}
          officesList={testOffices}
          orderType={orderType}
          statusType={statusType}
          onOrderUpdate={orderUpdateSpy}
          onExpand={() => {}}
          regionsMap={regionMap}
        />{' '}
      </BrowserRouter>,
    );

    expect(order.status).toBe('pending');

    await waitFor(async () => {
      const content = screen.getByTestId(`accordion-content-${order.id}`);
      expect(content).toBeInTheDocument();
    });

    let heading: HTMLElement;
    await waitFor(async () => {
      heading = screen.getByTestId(`accordion-heading-${order.id}`);
    }).then(() => {
      fireEvent.click(heading);
    });

    const selectButton = document.querySelector('#test-select-button-1');
    expect(selectButton).toBeInTheDocument();
    fireEvent.click(selectButton!);

    const caseIdInput = document.querySelector(`input#new-case-input-${order.id}`);
    expect(caseIdInput).toBeInTheDocument();
    fireEvent.change(caseIdInput!, { target: { value: '24-12345' } });

    let rejectButton;
    await waitFor(() => {
      rejectButton = screen.getByTestId(`button-accordion-reject-button-${order.id}`);
      expect(rejectButton).toBeEnabled();
    });
    fireEvent.click(rejectButton!);

    let confirmModal: HTMLElement;
    await waitFor(async () => {
      confirmModal = screen.getByTestId('toggle-modal-button-submit');
      expect(confirmModal).toBeInTheDocument();
      expect(confirmModal).toBeVisible();
    });
    fireEvent.click(confirmModal!);

    await waitFor(async () => {
      expect(orderUpdateSpy).toHaveBeenCalled();
    });
  });

  test('should allow a court to be deselected', async () => {
    render(
      <BrowserRouter>
        <TransferOrderAccordion
          order={order}
          officesList={testOffices}
          orderType={orderType}
          statusType={statusType}
          onOrderUpdate={() => {}}
          onExpand={() => {}}
          regionsMap={regionMap}
        />
      </BrowserRouter>,
    );

    await waitFor(async () => {
      const content = screen.getByTestId(`accordion-content-${order.id}`);
      expect(content).toBeInTheDocument();
      expect(content).not.toBeVisible();
    });

    const heading = screen.getByTestId(`accordion-heading-${order.id}`);
    if (heading) fireEvent.click(heading);

    await waitFor(async () => {
      const content = screen.getByTestId(`accordion-content-${order.id}`);
      expect(content).toBeInTheDocument();
      expect(content).toBeVisible();
    });

    let selectButton = document.querySelector('#test-select-button-1');
    expect(selectButton).toBeInTheDocument();
    fireEvent.click(selectButton!);

    let preview: HTMLElement;
    await waitFor(async () => {
      preview = screen.getByTestId(`preview-description-${order.id}`);
      expect(preview).toBeInTheDocument();
      expect(preview).toBeVisible();
      expect(preview?.textContent).toEqual(
        'USTP Office: transfer fromRegion 2 - Court Division 1toRegion 2 - New York 1',
      );
    });

    selectButton = document.querySelector('#test-select-button-0');
    expect(selectButton).toBeInTheDocument();
    fireEvent.click(selectButton!);

    await waitFor(async () => {
      const preview = screen.queryByTestId(`preview-description-${order.id}`);
      expect(preview).not.toBeInTheDocument();
    });
  });

  test('should allow the new case ID to be entered', async () => {
    render(
      <BrowserRouter>
        <TransferOrderAccordion
          order={order}
          officesList={testOffices}
          orderType={orderType}
          statusType={statusType}
          onOrderUpdate={() => {}}
          onExpand={() => {}}
          regionsMap={regionMap}
        />{' '}
      </BrowserRouter>,
    );

    await waitFor(async () => {
      screen.getByTestId(`accordion-content-${order.id}`);
    });

    const heading = screen.getByTestId(`accordion-heading-${order.id}`);
    if (heading) fireEvent.click(heading);

    await waitFor(async () => {
      const newCaseIdText = screen.getByTestId(`new-case-input-${order.id}`);
      expect(newCaseIdText).toHaveValue(order.newCaseId);
    });

    const newValue = '22-33333';
    const newCaseIdText = screen.getByTestId(`new-case-input-${order.id}`);
    fireEvent.change(newCaseIdText, { target: { value: newValue } });

    await waitFor(async () => {
      const newCaseIdText = screen.getByTestId(`new-case-input-${order.id}`);
      expect(newCaseIdText).toHaveValue(newValue);
    });
  });

  test('should determine if an transfer update DTO is valid', () => {
    const ok = isValidOrderTransfer({
      id: 'guid-1',
      caseId: '111-22-33333',
      sequenceNumber: 0,
      status: 'pending',
      newCaseId: '222-33-44444',
      newCourtDivisionName: 'new court',
    });
    expect(ok).toBeTruthy();

    const notOk = isValidOrderTransfer({
      id: 'guid-1',
      caseId: '111-22-33333',
      sequenceNumber: 0,
      status: 'pending',
    });
    expect(notOk).toBeFalsy();
  });

  // test('should limit user input to a valid case ID', () => {
  //   const validInput = buildChangeEvent('11-22222');
  //   const ok = validateNewCaseIdInput(validInput);
  //   expect(ok.joinedInput).toEqual('');
  //   expect(ok.newCaseId).toBeUndefined;

  //   const invalidInput = buildChangeEvent('lahwrunxhncntgftitjt');
  //   const notOK = validateNewCaseIdInput(invalidInput);
  //   expect(notOK.joinedInput).toEqual('');
  //   expect(notOK.newCaseId).toBeUndefined;
  // });

  test('should get office select options', () => {
    const expectedOptions: Array<Record<string, string>> = [
      { value: '', label: ' ' },
      { value: '001', label: 'A New York 1' },
      { value: '002', label: 'B New York 1' },
      { value: '003', label: 'C New York 1' },
    ];

    const sortedTestOffices = [...testOffices].sort((a, b) =>
      a.divisionCode < b.divisionCode ? -1 : 1,
    );

    const actualOptions = getOfficeList(sortedTestOffices);
    expect(actualOptions).toStrictEqual(expectedOptions);
  });
});

describe('Test CaseSelection component', () => {
  test('Should display message as expected using toCourt and fromCourt', async () => {
    render(
      <CaseSelection
        fromCourt={{
          region: '1',
          courtDivisionName: 'Division Name 1',
        }}
        toCourt={{
          region: '002',
          courtDivisionName: 'Division Name 2',
        }}
      ></CaseSelection>,
    );

    expect(document.body).toHaveTextContent(
      'USTP Office: transfer fromRegion 1 - Division Name 1toRegion 2 - Division Name 2',
    );
  });

  test('Should properly display region as a non-numeric string when one is supplied', async () => {
    render(
      <CaseSelection
        fromCourt={{
          region: 'ABC',
          courtDivisionName: 'Division Name 1',
        }}
        toCourt={{
          region: 'BCD',
          courtDivisionName: 'Division Name 2',
        }}
      ></CaseSelection>,
    );

    expect(document.body).toHaveTextContent(
      'USTP Office: transfer fromRegion ABC - Division Name 1toRegion BCD - Division Name 2',
    );
  });
});

describe('Test validateNewCaseIdInput function', () => {
  test('When supplied a value with a length greater than 7, it should truncate value to 7 digits', async () => {
    const testValue = '1234567890';
    const resultValue = '12-34567';

    const expectedResult = {
      newCaseId: resultValue,
      joinedInput: resultValue,
    };

    const testEvent = {
      target: {
        value: testValue,
      },
    };

    const returnedValue = validateNewCaseIdInput(testEvent as React.ChangeEvent<HTMLInputElement>);
    expect(returnedValue).toEqual(expectedResult);
  });

  test('When supplied a value with alphabetic characters only, it should return an object with undefined newCaseId and empty string for joinedInput', async () => {
    const testValue = 'abcdefg';
    const resultValue = '';

    const expectedResult = {
      newCaseId: undefined,
      joinedInput: resultValue,
    };

    const testEvent = {
      target: {
        value: testValue,
      },
    };

    const returnedValue = validateNewCaseIdInput(testEvent as React.ChangeEvent<HTMLInputElement>);
    expect(returnedValue).toEqual(expectedResult);
  });
});

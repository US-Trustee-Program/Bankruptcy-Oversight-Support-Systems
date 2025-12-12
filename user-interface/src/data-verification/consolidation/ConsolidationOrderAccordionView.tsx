import { Accordion } from '@/lib/components/uswds/Accordion';
import { FormRequirementsNotice } from '@/lib/components/uswds/FormRequirementsNotice';
import { RadioGroup } from '@/lib/components/uswds/RadioGroup';
import Radio from '@/lib/components/uswds/Radio';
import ConsolidationCaseTable from '@/data-verification/consolidation/ConsolidationCasesTable';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import CaseTable from '@/data-verification/transfer/CaseTable';
import Button, { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import ConsolidationOrderModal from '@/data-verification/consolidation/ConsolidationOrderModal';
import { CaseNumber } from '@/lib/components/CaseNumber';
import {
  AddCaseModel,
  ConsolidationViewModel,
} from '@/data-verification/consolidation/consolidationViewModel';
import { sanitizeText } from '@/lib/utils/sanitize-text';
import AddCaseModal from '@/data-verification/consolidation/AddCaseModal';
import OpenModalButton from '@/lib/components/uswds/modal/OpenModalButton';

function toAddCaseModel(viewModel: ConsolidationViewModel): AddCaseModel {
  const {
    caseToAddCaseNumber,
    caseToAddCourt,
    handleAddCaseCourtSelectChange,
    handleAddCaseNumberInputChange,
    handleAddCaseReset,
    filteredOfficeRecords,
    additionalCaseDivisionRef,
    additionalCaseNumberRef,
    addCaseNumberError,
    isLookingForCase,
    caseToAdd,
    handleAddCaseAction,
    verifyCaseCanBeAdded,
    order: { id: orderId, courtDivisionCode: defaultDivisionCode },
  } = viewModel;

  return {
    caseToAddCaseNumber,
    caseToAddCourt,
    handleAddCaseCourtSelectChange,
    handleAddCaseNumberInputChange,
    handleAddCaseReset,
    filteredOfficeRecords,
    additionalCaseDivisionRef,
    additionalCaseNumberRef,
    addCaseNumberError,
    isLookingForCase,
    caseToAdd,
    handleAddCaseAction,
    orderId: orderId ?? '',
    defaultDivisionCode,
    verifyCaseCanBeAdded,
  };
}

type ConsolidationOrderAccordionViewProps = {
  viewModel: ConsolidationViewModel;
};

export function ConsolidationOrderAccordionView(
  props: Readonly<ConsolidationOrderAccordionViewProps>,
) {
  const { viewModel } = props;

  function printAriaLabel() {
    const action =
      viewModel.expandedAccordionId === `order-list-${viewModel.order.id}` ? 'Collapse' : 'Expand';
    return `Click to ${action}.`;
  }

  return (
    <Accordion
      key={viewModel.order.id}
      id={`order-list-${viewModel.order.id}`}
      expandedId={viewModel.expandedAccordionId}
      onExpand={viewModel.handleOnExpand}
      onCollapse={viewModel.handleClearInputs}
      hidden={viewModel.hidden}
    >
      <section
        className="accordion-heading grid-row grid-gap-lg"
        data-testid={`accordion-heading-${viewModel.order.id}`}
      >
        <div
          className="accordion-header-field grid-col-6 text-no-wrap"
          aria-label={`${viewModel.accordionFieldHeaders[0]} - ${viewModel.order.courtName}.`}
          data-cell={viewModel.accordionFieldHeaders[0]}
        >
          {viewModel.order.courtName}
        </div>
        <div
          className="accordion-header-field grid-col-2 text-no-wrap"
          title={viewModel.accordionFieldHeaders[1]}
          aria-label={`${viewModel.accordionFieldHeaders[1]} on ${viewModel.formattedOrderFiledDate}.`}
          data-cell={viewModel.accordionFieldHeaders[1]}
        >
          {viewModel.formattedOrderFiledDate}
        </div>
        <div
          className="accordion-header-field grid-col-2 order-type text-no-wrap"
          data-cell={viewModel.accordionFieldHeaders[2]}
        >
          <span
            className="event-type-label"
            aria-label={`${viewModel.accordionFieldHeaders[2]} - ${viewModel.orderType.get(viewModel.order.orderType)}.`}
            data-cell={viewModel.accordionFieldHeaders[2]}
          >
            {viewModel.orderType.get(viewModel.order.orderType)}
          </span>
        </div>
        <div
          className="accordion-header-field grid-col-2 order-status text-no-wrap"
          data-cell={viewModel.accordionFieldHeaders[3]}
        >
          <span
            className={`${viewModel.order.status} event-status-label`}
            aria-label={`${viewModel.accordionFieldHeaders[3]} - ${viewModel.statusType.get(viewModel.order.status)}.`}
          >
            {viewModel.statusType.get(viewModel.order.status)}
          </span>
        </div>
        <div className="expand-aria-label" aria-label={printAriaLabel()}></div>
      </section>
      <>
        {viewModel.order.status === 'pending' && (
          <section
            className="accordion-content order-form"
            data-testid={`accordion-content-${viewModel.order.id}`}
          >
            <div className="grid-row grid-gap-lg">
              <div className="grid-col-1"></div>
              <div className="grid-col-10">
                <p aria-details="" className="form-instructions measure-6">
                  Choose a consolidation type. Use the checkboxes to include cases in the
                  consolidation (at least two cases), and then mark a lead case. If a case is not
                  listed, add it at the bottom. When finished, click Verify to review your changes
                  before approving them.
                </p>
                <FormRequirementsNotice />
                <RadioGroup
                  className="consolidation-type-container"
                  label="Consolidation Type"
                  required={true}
                >
                  <Radio
                    id={`joint-admin-${viewModel.order.id}`}
                    name="consolidation-type"
                    label="Joint Administration"
                    value="administrative"
                    className="text-no-wrap"
                    onChange={viewModel.handleSelectConsolidationType}
                    ref={viewModel.jointAdministrationRadio}
                  />
                  <Radio
                    id={`substantive-${viewModel.order.id}`}
                    name="consolidation-type"
                    label="Substantive Consolidation"
                    value="substantive"
                    onChange={viewModel.handleSelectConsolidationType}
                    ref={viewModel.substantiveRadio}
                  />
                </RadioGroup>
              </div>
              <div className="grid-col-1"></div>
            </div>
            <div className="grid-row grid-gap-lg">
              <div className="grid-col-1"></div>
              <div className="grid-col-10">
                <ConsolidationCaseTable
                  id={`case-list-${viewModel.order.id}`}
                  data-testid={`${viewModel.order.id}-case-list`}
                  cases={viewModel.order.childCases}
                  leadCaseId={viewModel.showLeadCaseForm ? undefined : viewModel.leadCase?.caseId}
                  onSelect={viewModel.handleIncludeCase}
                  updateAllSelections={viewModel.updateAllSelections}
                  isDataEnhanced={viewModel.isDataEnhanced}
                  ref={viewModel.caseTableActions}
                  onMarkLead={viewModel.handleMarkLeadCase}
                ></ConsolidationCaseTable>
                <OpenModalButton
                  modalId={`add-case-modal-${viewModel.order.id}`}
                  modalRef={viewModel.addCaseModal}
                >
                  Add Case
                </OpenModalButton>
              </div>
              <div className="grid-col-1"></div>
            </div>
            <div className="button-bar grid-row grid-gap-lg">
              <div className="grid-col-1"></div>
              <div className="grid-col-10 text-no-wrap float-right">
                <LoadingSpinner
                  id={`processing-consolidation-loading-spinner-${viewModel.order.id}`}
                  caption="Updating..."
                  height="40px"
                  hidden={!viewModel.isProcessing}
                />
                <Button
                  id={`accordion-cancel-button-${viewModel.order.id}`}
                  onClick={viewModel.handleClearInputs}
                  uswdsStyle={UswdsButtonStyle.Unstyled}
                  className="unstyled-button"
                  ref={viewModel.clearButton}
                >
                  Clear
                </Button>
                <Button
                  id={`accordion-reject-button-${viewModel.order.id}`}
                  onClick={viewModel.handleRejectButtonClick}
                  uswdsStyle={UswdsButtonStyle.Outline}
                  className="margin-right-2"
                  ref={viewModel.rejectButton}
                >
                  Reject
                </Button>
                <Button
                  id={`accordion-approve-button-${viewModel.order.id}`}
                  onClick={viewModel.handleApproveButtonClick}
                  disabled={true}
                  ref={viewModel.approveButton}
                >
                  Verify
                </Button>
              </div>
              <div className="grid-col-1"></div>
            </div>
            <ConsolidationOrderModal
              ref={viewModel.confirmationModal}
              id={`confirmation-modal-${viewModel.order.id}`}
              onCancel={() => {}}
              onConfirm={viewModel.handleConfirmAction}
            ></ConsolidationOrderModal>
            <AddCaseModal
              id={`add-case-modal-${viewModel.order.id}`}
              ref={viewModel.addCaseModal}
              addCaseModel={toAddCaseModel(viewModel)}
            ></AddCaseModal>
          </section>
        )}
        {viewModel.order.status === 'approved' && (
          <section
            className="accordion-content order-form"
            data-testid={`accordion-content-${viewModel.order.id}`}
          >
            <div className="grid-row grid-gap-lg consolidation-text">
              <div className="grid-col-1"></div>
              <div className="grid-col-10">
                Consolidated the following cases to lead case{' '}
                <CaseNumber
                  data-testid={'lead-case-number'}
                  caseId={viewModel.order.leadCase!.caseId}
                  renderAs="link"
                  openLinkIn="new-window"
                ></CaseNumber>{' '}
                {viewModel.order.leadCase?.caseTitle}.
              </div>
              <div className="grid-col-1"></div>
            </div>
            <div className="grid-row grid-gap-lg">
              <div className="grid-col-1"></div>
              <div className="grid-col-10">
                <CaseTable
                  id={`order-${viewModel.order.id}-child-cases`}
                  cases={viewModel.order.childCases}
                ></CaseTable>
              </div>
              <div className="grid-col-1"></div>
            </div>
          </section>
        )}
        {viewModel.order.status === 'rejected' && (
          <section
            className="accordion-content order-form"
            data-testid={`accordion-content-${viewModel.order.id}`}
          >
            <div className="grid-row grid-gap-lg consolidation-text">
              <div className="grid-col-1"></div>
              <div className="grid-col-10">
                Rejected the consolidation of the cases below
                {viewModel.order.reason?.length && (
                  <>
                    {' '}
                    for the following reason:
                    <blockquote>{sanitizeText(viewModel.order.reason)}</blockquote>
                  </>
                )}
                {!viewModel.order.reason && <>.</>}
              </div>
              <div className="grid-col-1"></div>
            </div>
            <div className="grid-row grid-gap-lg">
              <div className="grid-col-1"></div>
              <div className="grid-col-10">
                <ConsolidationCaseTable
                  id={`${viewModel.order.id}-case-list`}
                  data-testid={`${viewModel.order.id}-case-list`}
                  cases={viewModel.order.childCases}
                  isDataEnhanced={viewModel.isDataEnhanced}
                ></ConsolidationCaseTable>
              </div>
              <div className="grid-col-1"></div>
            </div>
          </section>
        )}
      </>
    </Accordion>
  );
}

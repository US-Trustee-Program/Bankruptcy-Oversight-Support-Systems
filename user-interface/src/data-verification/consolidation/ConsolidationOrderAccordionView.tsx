import { ConsolidationCaseTable } from '@/data-verification/consolidation/ConsolidationCasesTable';
import { ConsolidationOrderModal } from '@/data-verification/consolidation/ConsolidationOrderModal';
import { ConsolidationViewModel } from '@/data-verification/consolidation/consolidationViewModel';
import { CaseTable } from '@/data-verification/transfer/CaseTable';
import { CaseNumber } from '@/lib/components/CaseNumber';
import CaseNumberInput from '@/lib/components/CaseNumberInput';
import ComboBox from '@/lib/components/combobox/ComboBox';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import { Accordion } from '@/lib/components/uswds/Accordion';
import Alert, { UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import Button, { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import Checkbox from '@/lib/components/uswds/Checkbox';
import { FormRequirementsNotice } from '@/lib/components/uswds/FormRequirementsNotice';
import Radio from '@/lib/components/uswds/Radio';
import { RadioGroup } from '@/lib/components/uswds/RadioGroup';
import { getCaseNumber } from '@/lib/utils/caseNumber';
import { sanitizeText } from '@/lib/utils/sanitize-text';
import { useEffect } from 'react';

export type ConsolidationOrderAccordionViewProps = {
  viewModel: ConsolidationViewModel;
};

export function ConsolidationOrderAccordionView(props: ConsolidationOrderAccordionViewProps) {
  const { viewModel } = props;

  function printAriaLabel() {
    const action =
      viewModel.expandedAccordionId === `order-list-${viewModel.order.id}` ? 'Collapse' : 'Expand';
    return `Click to ${action}.`;
  }

  useEffect(() => {
    if (viewModel.showLeadCaseForm) {
      const selectedOption = viewModel.filteredOfficeRecords?.find(
        (office) => office.value === viewModel.divisionCode,
      );

      if (selectedOption && viewModel.leadCaseDivisionInput) {
        viewModel.leadCaseDivisionInput.current?.setSelections([selectedOption]);
      }
    }
  }, [viewModel.showLeadCaseForm]);

  return (
    <Accordion
      expandedId={viewModel.expandedAccordionId}
      hidden={viewModel.hidden}
      id={`order-list-${viewModel.order.id}`}
      key={viewModel.order.id}
      onCollapse={viewModel.handleClearInputs}
      onExpand={viewModel.handleOnExpand}
    >
      <section
        className="accordion-heading grid-row grid-gap-lg"
        data-testid={`accordion-heading-${viewModel.order.id}`}
      >
        <div
          aria-label={`${viewModel.accordionFieldHeaders[0]} - ${viewModel.order.courtName}.`}
          className="accordion-header-field grid-col-6 text-no-wrap"
          data-cell={viewModel.accordionFieldHeaders[0]}
        >
          {viewModel.order.courtName}
        </div>
        <div
          aria-label={`${viewModel.accordionFieldHeaders[1]} on ${viewModel.formattedOrderFiledDate}.`}
          className="accordion-header-field grid-col-2 text-no-wrap"
          data-cell={viewModel.accordionFieldHeaders[1]}
          title={viewModel.accordionFieldHeaders[1]}
        >
          {viewModel.formattedOrderFiledDate}
        </div>
        <div
          className="accordion-header-field grid-col-2 order-type text-no-wrap"
          data-cell={viewModel.accordionFieldHeaders[2]}
        >
          <span
            aria-label={`${viewModel.accordionFieldHeaders[2]} - ${viewModel.orderType.get(viewModel.order.orderType)}.`}
            className="event-type-label"
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
            aria-label={`${viewModel.accordionFieldHeaders[3]} - ${viewModel.statusType.get(viewModel.order.status)}.`}
            className={`${viewModel.order.status} event-status-label`}
          >
            {viewModel.statusType.get(viewModel.order.status)}
          </span>
        </div>
        <div aria-label={printAriaLabel()} className="expand-aria-label"></div>
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
                  consolidation (at least two cases), and then mark a lead case. If the lead case is
                  not listed, enter it at the bottom. When finished, click Verify to review your
                  changes before approving them.
                </p>
                <FormRequirementsNotice />
                <RadioGroup
                  className="consolidation-type-container"
                  label="Consolidation Type"
                  required={true}
                >
                  <Radio
                    className="text-no-wrap"
                    id={`joint-admin-${viewModel.order.id}`}
                    label="Joint Administration"
                    name="consolidation-type"
                    onChange={viewModel.handleSelectConsolidationType}
                    ref={viewModel.jointAdministrationRadio}
                    value="administrative"
                  />
                  <Radio
                    id={`substantive-${viewModel.order.id}`}
                    label="Substantive Consolidation"
                    name="consolidation-type"
                    onChange={viewModel.handleSelectConsolidationType}
                    ref={viewModel.substantiveRadio}
                    value="substantive"
                  />
                </RadioGroup>
              </div>
              <div className="grid-col-1"></div>
            </div>
            <div className="grid-row grid-gap-lg">
              <div className="grid-col-1"></div>
              <div className="grid-col-10">
                <ConsolidationCaseTable
                  cases={viewModel.order.childCases}
                  data-testid={`${viewModel.order.id}-case-list`}
                  id={`case-list-${viewModel.order.id}`}
                  isDataEnhanced={viewModel.isDataEnhanced}
                  leadCaseId={viewModel.showLeadCaseForm ? undefined : viewModel.leadCase?.caseId}
                  onMarkLead={viewModel.handleMarkLeadCase}
                  onSelect={viewModel.handleIncludeCase}
                  ref={viewModel.caseTableActions}
                  updateAllSelections={viewModel.updateAllSelections}
                ></ConsolidationCaseTable>
              </div>
              <div className="grid-col-1"></div>
            </div>
            <div
              className="lead-case-form grid-row grid-gap-lg"
              data-testid={`lead-case-form-${viewModel.order.id}`}
            >
              <div className="grid-col-1"></div>
              <div className="grid-col-10">
                <Checkbox
                  checked={viewModel.showLeadCaseForm}
                  className="lead-case-form-toggle"
                  id={`lead-case-form-checkbox-toggle-${viewModel.order.id}`}
                  label="Lead Case Not Listed"
                  onChange={(ev) => viewModel.handleToggleLeadCaseForm(ev.target.checked)}
                  ref={viewModel.leadCaseFormToggle}
                  value=""
                ></Checkbox>
                {viewModel.showLeadCaseForm && (
                  <section
                    className={`lead-case-form-container lead-case-form-container-${viewModel.order.id}`}
                  >
                    <h3>Enter lead case details:</h3>
                    <span id="lead-case-form-instructions">
                      Choose a new court and enter a case number, and the lead case will be selected
                      for this Case Event automatically.
                    </span>
                    <div className="lead-case-court-container">
                      <ComboBox
                        aria-describedby="lead-case-form-instructions"
                        aria-live="off"
                        ariaDescription="foo bar"
                        className="lead-case-court"
                        id={'lead-case-court'}
                        label="Select a court"
                        multiSelect={false}
                        onUpdateSelection={viewModel.handleSelectLeadCaseCourt}
                        options={viewModel.filteredOfficeRecords!}
                        ref={viewModel.leadCaseDivisionInput}
                        required={true}
                      />
                    </div>
                    <div className="lead-case-number-container">
                      <CaseNumberInput
                        allowPartialCaseNumber={false}
                        aria-describedby="lead-case-form-instructions"
                        className="usa-input"
                        data-testid={`lead-case-input-${viewModel.order.id}`}
                        id={`lead-case-input-${viewModel.order.id}`}
                        label="Enter a case number"
                        onChange={viewModel.handleLeadCaseInputChange}
                        ref={viewModel.leadCaseNumberInput}
                        required={true}
                        value={getCaseNumber(viewModel.leadCase?.caseId)}
                      />
                      {viewModel.leadCaseNumberError ? (
                        <Alert
                          id={`lead-case-number-alert-${viewModel.order.id}`}
                          inline={true}
                          message={viewModel.leadCaseNumberError}
                          show={true}
                          slim={true}
                          type={UswdsAlertStyle.Error}
                        ></Alert>
                      ) : (
                        <LoadingSpinner
                          caption="Verifying lead case number..."
                          height="40px"
                          hidden={!viewModel.isValidatingLeadCaseNumber}
                          id={`lead-case-number-loading-spinner-${viewModel.order.id}`}
                        />
                      )}
                      {viewModel.foundValidCaseNumber && viewModel.leadCase && (
                        <>
                          <h4>Selected Lead Case</h4>
                          <CaseTable
                            cases={[viewModel.leadCase]}
                            id={`valid-case-number-found-${viewModel.order.id}`}
                          ></CaseTable>
                        </>
                      )}
                    </div>
                  </section>
                )}
              </div>
              <div className="grid-col-1"></div>
            </div>
            <div className="button-bar grid-row grid-gap-lg">
              <div className="grid-col-1"></div>
              <div className="grid-col-10 text-no-wrap float-right">
                <LoadingSpinner
                  caption="Updating..."
                  height="40px"
                  hidden={!viewModel.isProcessing}
                  id={`processing-consolidation-loading-spinner-${viewModel.order.id}`}
                />
                <Button
                  className="unstyled-button"
                  id={`accordion-cancel-button-${viewModel.order.id}`}
                  onClick={viewModel.handleClearInputs}
                  ref={viewModel.clearButton}
                  uswdsStyle={UswdsButtonStyle.Unstyled}
                >
                  Clear
                </Button>
                <Button
                  className="margin-right-2"
                  id={`accordion-reject-button-${viewModel.order.id}`}
                  onClick={viewModel.handleRejectButtonClick}
                  ref={viewModel.rejectButton}
                  uswdsStyle={UswdsButtonStyle.Outline}
                >
                  Reject
                </Button>
                <Button
                  disabled={true}
                  id={`accordion-approve-button-${viewModel.order.id}`}
                  onClick={viewModel.handleApproveButtonClick}
                  ref={viewModel.approveButton}
                >
                  Verify
                </Button>
              </div>
              <div className="grid-col-1"></div>
            </div>
            <ConsolidationOrderModal
              id={`confirmation-modal-${viewModel.order.id}`}
              onCancel={() => {}}
              onConfirm={viewModel.handleConfirmAction}
              ref={viewModel.confirmationModal}
            ></ConsolidationOrderModal>
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
                  caseId={viewModel.order.leadCase!.caseId}
                  data-testid={'lead-case-number'}
                  openLinkIn="new-window"
                  renderAs="link"
                ></CaseNumber>{' '}
                {viewModel.order.leadCase?.caseTitle}.
              </div>
              <div className="grid-col-1"></div>
            </div>
            <div className="grid-row grid-gap-lg">
              <div className="grid-col-1"></div>
              <div className="grid-col-10">
                <CaseTable
                  cases={viewModel.order.childCases}
                  id={`order-${viewModel.order.id}-child-cases`}
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
                {viewModel.order.reason && viewModel.order.reason.length && (
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
                  cases={viewModel.order.childCases}
                  data-testid={`${viewModel.order.id}-case-list`}
                  id={`${viewModel.order.id}-case-list`}
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

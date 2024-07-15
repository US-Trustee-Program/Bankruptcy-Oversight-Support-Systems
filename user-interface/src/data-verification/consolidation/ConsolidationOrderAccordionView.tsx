import { Accordion } from '@/lib/components/uswds/Accordion';
import { FormRequirementsNotice } from '@/lib/components/uswds/FormRequirementsNotice';
import { RadioGroup } from '@/lib/components/uswds/RadioGroup';
import Radio from '@/lib/components/uswds/Radio';
import { ConsolidationCaseTable } from '@/data-verification/ConsolidationCasesTable';
import Checkbox from '@/lib/components/uswds/Checkbox';
import CamsSelect from '@/lib/components/CamsSelect';
import CaseNumberInput from '@/lib/components/CaseNumberInput';
import Alert, { UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import { CaseTable } from '@/data-verification/transfer/CaseTable';
import Button, { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import { ConsolidationOrderModal } from '@/data-verification/ConsolidationOrderModal';
import { CaseNumber } from '@/lib/components/CaseNumber';
import { ConsolidationViewModel } from '@/data-verification/consolidation/consolidationViewModel';
import { getCaseNumber } from '../../lib/utils/formatCaseNumber';

export type ConsolidationOrderAccordionViewProps = {
  viewModel: ConsolidationViewModel;
};

export function ConsolidationOrderAccordionView(props: ConsolidationOrderAccordionViewProps) {
  const { viewModel } = props;
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
          className="grid-col-6 text-no-wrap"
          aria-label={`Court district ${viewModel.order.courtName}`}
        >
          {viewModel.order.courtName}
        </div>
        <div
          className="grid-col-2 text-no-wrap"
          title="Order Filed"
          aria-label={`Order Filed ${viewModel.formattedOrderFiledDate}`}
        >
          {viewModel.formattedOrderFiledDate}
        </div>
        <div className="grid-col-2 order-type text-no-wrap">
          <span
            className="event-type-label"
            aria-label={`Event type ${viewModel.orderType.get(viewModel.order.orderType)}`}
          >
            {viewModel.orderType.get(viewModel.order.orderType)}
          </span>
        </div>
        <div className="grid-col-2 order-status text-no-wrap">
          <span
            className={`${viewModel.order.status} event-status-label`}
            aria-label={`Event status ${viewModel.statusType.get(viewModel.order.status)}`}
          >
            {viewModel.statusType.get(viewModel.order.status)}
          </span>
        </div>
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
                  onSelect={viewModel.handleIncludeCase}
                  updateAllSelections={viewModel.updateAllSelections}
                  isDataEnhanced={viewModel.isDataEnhanced}
                  ref={viewModel.caseTableActions}
                  leadCaseId={viewModel.showLeadCaseForm ? undefined : viewModel.leadCase?.caseId}
                  onMarkLead={viewModel.handleMarkLeadCase}
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
                  id={`lead-case-form-checkbox-toggle-${viewModel.order.id}`}
                  className="lead-case-form-toggle"
                  onChange={(ev) => viewModel.handleToggleLeadCaseForm(ev.target.checked)}
                  value=""
                  ref={viewModel.leadCaseFormToggle}
                  label="Lead Case Not Listed"
                  checked={viewModel.showLeadCaseForm}
                ></Checkbox>
                {viewModel.showLeadCaseForm && (
                  <section
                    className={`lead-case-form-container lead-case-form-container-${viewModel.order.id}`}
                  >
                    <h3>Enter lead case details:</h3>
                    <div className="lead-case-court-container">
                      <CamsSelect
                        id={'lead-case-court'}
                        required={true}
                        options={viewModel.filteredOfficeRecords!}
                        onChange={viewModel.handleSelectLeadCaseCourt}
                        ref={viewModel.leadCaseDivisionInput}
                        label="Select a court"
                        value={viewModel.divisionCode}
                        isSearchable={true}
                      />
                    </div>
                    <div className="lead-case-number-container">
                      <CaseNumberInput
                        id={`lead-case-input-${viewModel.order.id}`}
                        data-testid={`lead-case-input-${viewModel.order.id}`}
                        className="usa-input"
                        value={getCaseNumber(viewModel.leadCase?.caseId)}
                        onChange={viewModel.handleLeadCaseInputChange}
                        allowPartialCaseNumber={false}
                        required={true}
                        label="Enter a case number"
                        ref={viewModel.leadCaseNumberInput}
                      />
                      {viewModel.leadCaseNumberError ? (
                        <Alert
                          id={`lead-case-number-alert-${viewModel.order.id}`}
                          message={viewModel.leadCaseNumberError}
                          type={UswdsAlertStyle.Error}
                          show={true}
                          slim={true}
                          inline={true}
                        ></Alert>
                      ) : (
                        <LoadingSpinner
                          id={`lead-case-number-loading-spinner-${viewModel.order.id}`}
                          caption="Verifying lead case number..."
                          height="40px"
                          hidden={!viewModel.isValidatingLeadCaseNumber}
                        />
                      )}
                      {viewModel.foundValidCaseNumber && viewModel.leadCase && (
                        <>
                          <h4>Selected Lead Case</h4>
                          <CaseTable
                            id={`valid-case-number-found-${viewModel.order.id}`}
                            cases={[viewModel.leadCase]}
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
                {viewModel.order.reason && viewModel.order.reason.length && (
                  <>
                    {' '}
                    for the following reason:
                    <blockquote>{viewModel.order.reason}</blockquote>
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

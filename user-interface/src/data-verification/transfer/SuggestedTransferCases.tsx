import CaseNumberInput from '@/lib/components/CaseNumberInput';
import ComboBox, { ComboOption } from '@/lib/components/combobox/ComboBox';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import Alert, { AlertDetails, UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import { FormRequirementsNotice } from '@/lib/components/uswds/FormRequirementsNotice';
import { useApi2 } from '@/lib/hooks/UseApi2';
import { ComboBoxRef, InputRef } from '@/lib/type-declarations/input-fields';
import { CaseSummary } from '@common/cams/cases';
import { CourtDivisionDetails } from '@common/cams/courts';
import { TransferOrder } from '@common/cams/orders';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';

import { getDivisionComboOptions } from '../dataVerificationHelper';
import { CaseTable, CaseTableImperative } from './CaseTable';

enum ValidationStates {
  notValidated,
  found,
  notFound,
}

export type SuggestedTransferCasesImperative = {
  cancel: () => void;
};

export type SuggestedTransferCasesProps = {
  officesList: CourtDivisionDetails[];
  onAlert: (alertDetails: AlertDetails) => void;
  onCaseSelection: (bCase: CaseSummary | null) => void;
  onInvalidCaseNumber: () => void;
  order: TransferOrder;
};

function _SuggestedTransferCases(
  props: SuggestedTransferCasesProps,
  SuggestedTransferCasesRef: React.Ref<SuggestedTransferCasesImperative>,
) {
  const { officesList, order } = props;

  const [validationState, setValidationState] = useState<ValidationStates>(
    ValidationStates.notValidated,
  );
  const [newCaseSummary, setNewCaseSummary] = useState<CaseSummary | null>(null);
  const [newCaseDivision, setNewCaseDivision] = useState<CourtDivisionDetails | null>(null);
  const [newCaseNumber, setNewCaseNumber] = useState<null | string>(
    order.docketSuggestedCaseNumber || null,
  );
  const [enableCaseEntry, setEnableCaseEntry] = useState<boolean>(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState<boolean>(false);
  const [suggestedCases, setSuggestedCases] = useState<CaseSummary[] | null>(null);
  const [loadingCaseSummary, setLoadingCaseSummary] = useState<boolean>(false);

  const suggestedCasesRef = useRef<CaseTableImperative>(null);
  const caseNumberRef = useRef<InputRef>(null);
  const courtSelectionRef = useRef<ComboBoxRef>(null);

  const api = useApi2();

  async function validateCaseNumber(caseId: string) {
    const currentElement = document.activeElement;
    if (loadingCaseSummary) {
      return false;
    }
    setLoadingCaseSummary(true);
    disableEntryForm(true);
    await api
      .getCaseSummary(caseId)
      .then((response) => {
        const caseSummary = response.data;
        props.onCaseSelection(caseSummary);
        setNewCaseSummary(caseSummary);
        setValidationState(ValidationStates.found);
      })
      .catch((_reason) => {
        setValidationState(ValidationStates.notFound);
      })
      .finally(() => {
        setTimeout(() => {
          (currentElement as HTMLElement).focus();
        }, 100);
      });

    setLoadingCaseSummary(false);
    disableEntryForm(false);
  }

  function disableEntryForm(value: boolean) {
    caseNumberRef.current?.disable(value);
    courtSelectionRef.current?.disable(value);
  }

  function handleCourtSelection(selections: ComboOption[]) {
    setValidationState(ValidationStates.notValidated);
    let office = null;
    if (selections.length > 0) {
      office =
        officesList.find((o) => o.courtDivisionCode === (selections[0] as ComboOption)?.value) ||
        null;
    }
    setNewCaseDivision(office);
    if (!office) {
      setValidationState(ValidationStates.notValidated);
      setNewCaseSummary(null);
    }
    caseNumberRef.current?.disable(!office);

    if (office && newCaseNumber) {
      validateCaseNumber(`${office.courtDivisionCode}-${newCaseNumber}`);
    }
  }

  function handleCaseInputChange(caseNumber?: string) {
    setValidationState(ValidationStates.notValidated);
    if (caseNumber) {
      setNewCaseNumber(caseNumber);
    } else {
      setNewCaseNumber(null);
      setValidationState(ValidationStates.notValidated);
      setNewCaseSummary(null);
      props.onInvalidCaseNumber();
      return;
    }

    if (caseNumber && newCaseDivision) {
      validateCaseNumber(`${newCaseDivision.courtDivisionCode}-${caseNumber}`);
    }
  }

  function getTransferredCaseSuggestions(caseId: string) {
    setLoadingSuggestions(true);
    api
      .getOrderSuggestions(caseId)
      .then((response) => {
        const newSuggestedCases = response.data;
        setLoadingSuggestions(false);
        setSuggestedCases(newSuggestedCases);
      })
      .catch((reason: Error) => {
        setLoadingSuggestions(false);
        props.onAlert({ message: reason.message, timeOut: 8, type: UswdsAlertStyle.Error });
      });
  }

  function handleCaseSelection(bCase: CaseSummary | null) {
    setValidationState(ValidationStates.notValidated);
    setEnableCaseEntry(!bCase);
    props.onCaseSelection(bCase);
  }

  function cancel() {
    setNewCaseSummary(null);
    setValidationState(ValidationStates.notValidated);
    if (suggestedCasesRef.current) {
      suggestedCasesRef.current.clearAllCheckboxes();
    }
    setLoadingCaseSummary(false);
    // TODO: Make sure the following only happens when we click the 'Clear' button, not the 'go back' button on the modal
    setNewCaseNumber(order.docketSuggestedCaseNumber || null);
    setNewCaseDivision(null);
    courtSelectionRef.current?.clearSelections();
    caseNumberRef.current?.resetValue();
  }

  useImperativeHandle(SuggestedTransferCasesRef, () => ({
    cancel,
  }));

  useEffect(() => {
    getTransferredCaseSuggestions(order.caseId);
  }, []);

  return (
    <>
      <div className="grid-row grid-gap-lg">
        <div className="grid-col-1"></div>
        <div className="grid-col-10 select-destination-case--label">
          <h3>Select New Case</h3>
        </div>
        <div className="grid-col-1"></div>
      </div>
      <div className="grid-row grid-gap-lg">
        <div className="grid-col-1"></div>
        <div className="grid-col-10">
          {suggestedCases && suggestedCases?.length > 0 && (
            <div
              className="select-destination-case--description"
              data-testid={'suggested-cases-found'}
            >
              Select the new case from the list below. If the case is not listed, select &quot;case
              not listed&quot; and enter the new court division and case number.
            </div>
          )}
          {suggestedCases && suggestedCases?.length === 0 && (
            <div
              className="select-destination-case--description"
              data-testid={'suggested-cases-not-found'}
            >
              Choose a new court division and enter a case number, and a case will be selected for
              this case event automatically.
            </div>
          )}
        </div>
        <div className="grid-col-1"></div>
      </div>
      <section className="order-form" data-testid={`order-form-${order.id}`}>
        <div className="grid-row grid-gap-lg suggestions-form">
          {loadingSuggestions && (
            <>
              <div className="grid-col-1"></div>
              <div className="grid-col-11">
                <LoadingSpinner
                  caption="Loading suggestions..."
                  id={`loading-spinner-${order.id}-suggestions`}
                ></LoadingSpinner>
              </div>
            </>
          )}
          {!loadingSuggestions && (
            <>
              <div className="grid-col-1"></div>
              <div className="transfer-from-to__div transfer-description grid-col-10">
                <div className="transfer-text">
                  {suggestedCases && suggestedCases?.length > 0 && (
                    <CaseTable
                      cases={[...suggestedCases, null]}
                      id="suggested-cases"
                      onSelect={handleCaseSelection}
                      ref={suggestedCasesRef}
                    ></CaseTable>
                  )}
                </div>
                <div className="grid-col-1"></div>
              </div>
            </>
          )}
        </div>
        {(enableCaseEntry || suggestedCases?.length === 0) && (
          <div className="case-entry-form">
            <div className="court-selection grid-row grid-gap-lg">
              <div className="grid-col-1"></div>
              <div className="transfer-from-to__div grid-col-10">
                <div>
                  <FormRequirementsNotice />
                </div>
                <div className="form-row">
                  <div className="select-container court-select-container">
                    <div
                      className="usa-combo-box"
                      data-testid={`court-selection-usa-combo-box-${order.id}`}
                    >
                      <ComboBox
                        ariaLabelPrefix="Select a Court and Division"
                        className="new-court__select"
                        id={`court-selection-${order.id}`}
                        label="New Court"
                        onUpdateSelection={handleCourtSelection}
                        options={getDivisionComboOptions(officesList)}
                        ref={courtSelectionRef}
                        required={true}
                        wrapPills={true}
                      />
                    </div>
                  </div>
                </div>
              </div>
              <div className="grid-col-1"></div>
            </div>

            <div className="case-selection grid-row grid-gap-lg">
              <div className="grid-col-1"></div>
              <div className="grid-col-4">
                <div>
                  <CaseNumberInput
                    allowPartialCaseNumber={false}
                    aria-label="New case number. This will automatically select the case for this case event."
                    className="usa-input"
                    data-testid={`new-case-input-${order.id}`}
                    disabled={true}
                    id={`new-case-input-${order.id}`}
                    label="New Case Number"
                    onChange={handleCaseInputChange}
                    ref={caseNumberRef}
                    required={true}
                    value={order.docketSuggestedCaseNumber}
                  />
                </div>
              </div>
              <div className="grid-col-6"></div>
              <div className="grid-col-1"></div>
            </div>
            <div className="case-verification grid-row grid-gap-lg">
              <div className="grid-col-1"></div>
              <div className="grid-col-10">
                {loadingCaseSummary && (
                  <LoadingSpinner
                    caption="Loading cases..."
                    id={`loading-spinner-${order.id}-case-verification`}
                  ></LoadingSpinner>
                )}
                {!loadingCaseSummary && validationState === ValidationStates.found && (
                  <CaseTable cases={[newCaseSummary!]} id="validated-cases"></CaseTable>
                )}
                {!loadingCaseSummary && validationState === ValidationStates.notFound && (
                  <Alert
                    className="validation-alert"
                    id="validation-not-found"
                    inline={true}
                    message="We couldn't find a case with that number"
                    role="status"
                    show={true}
                    type={UswdsAlertStyle.Error}
                  />
                )}
              </div>
              <div className="grid-col-1"></div>
            </div>
          </div>
        )}
      </section>
    </>
  );
}

export const SuggestedTransferCases = forwardRef(_SuggestedTransferCases);

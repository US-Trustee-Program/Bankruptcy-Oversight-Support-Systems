import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import { useGenericApi } from '@/lib/hooks/UseApi';
import { CaseSummary } from '@common/cams/cases';
import { OfficeDetails } from '@common/cams/courts';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { CaseTable, CaseTableImperative } from './CaseTable';
import Alert, { AlertDetails, UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import { FormRequirementsNotice } from '@/lib/components/uswds/FormRequirementsNotice';
import CamsSelect, { SingleSelectOption } from '@/lib/components/CamsSelect';
import { getOfficeList } from '../dataVerificationHelper';
import CaseNumberInput from '@/lib/components/CaseNumberInput';
import { TransferOrder } from '@common/cams/orders';
import { InputRef } from '@/lib/type-declarations/input-fields';

export type SuggestedTransferCasesImperative = {
  cancel: () => void;
};

enum ValidationStates {
  notValidated,
  found,
  notFound,
}

export type SuggestedTransferCasesProps = {
  order: TransferOrder;
  officesList: OfficeDetails[];
  onCaseSelection: (bCase: CaseSummary | null) => void;
  onAlert: (alertDetails: AlertDetails) => void;
  onInvalidCaseNumber: () => void;
};

function _SuggestedTransferCases(
  props: SuggestedTransferCasesProps,
  SuggestedTransferCasesRef: React.Ref<SuggestedTransferCasesImperative>,
) {
  const { order, officesList } = props;

  const [validationState, setValidationState] = useState<ValidationStates>(
    ValidationStates.notValidated,
  );
  const [newCaseSummary, setNewCaseSummary] = useState<CaseSummary | null>(null);
  const [newCaseDivision, setNewCaseDivision] = useState<OfficeDetails | null>(null);
  const [newCaseNumber, setNewCaseNumber] = useState<string | null>(
    order.docketSuggestedCaseNumber || null,
  );
  const [enableCaseEntry, setEnableCaseEntry] = useState<boolean>(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState<boolean>(false);
  const [suggestedCases, setSuggestedCases] = useState<CaseSummary[] | null>(null);
  const [loadingCaseSummary, setLoadingCaseSummary] = useState<boolean>(false);

  const suggestedCasesRef = useRef<CaseTableImperative>(null);
  const caseNumberRef = useRef<InputRef>(null);
  const courtSelectionRef = useRef<InputRef>(null);

  const api = useGenericApi();

  async function validateCaseNumber(caseId: string) {
    if (loadingCaseSummary) return false;
    setLoadingCaseSummary(true);
    disableEntryForm(true);
    await api
      .get<CaseSummary>(`/cases/${caseId}/summary`)
      .then((response) => {
        const caseSummary = response.data;
        props.onCaseSelection(caseSummary);
        setNewCaseSummary(caseSummary);
        setValidationState(ValidationStates.found);
      })
      .catch((_reason) => {
        setValidationState(ValidationStates.notFound);
      });

    setLoadingCaseSummary(false);
    disableEntryForm(false);
  }

  function disableEntryForm(value: boolean) {
    caseNumberRef.current?.disable(value);
    courtSelectionRef.current?.disable(value);
  }

  function handleCourtSelection(selection: SingleSelectOption) {
    setValidationState(ValidationStates.notValidated);
    const office =
      officesList.find((o) => o.courtDivisionCode === (selection as SingleSelectOption)?.value) ||
      null;
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
      .get<CaseSummary[]>(`/orders-suggestions/${caseId}/`)
      .then((response) => {
        const newSuggestedCases = response.data;
        setLoadingSuggestions(false);
        setSuggestedCases(newSuggestedCases);
      })
      .catch((reason: Error) => {
        setLoadingSuggestions(false);
        props.onAlert({ message: reason.message, type: UswdsAlertStyle.Error, timeOut: 8 });
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
    if (suggestedCasesRef.current) suggestedCasesRef.current.clearAllCheckboxes();
    setEnableCaseEntry(false);
    setLoadingCaseSummary(false);
    // TODO: Make sure the following only happens when we click the 'Clear' button, not the 'go back' button on the modal
    setNewCaseNumber(order.docketSuggestedCaseNumber || null);
    setNewCaseDivision(null);
    courtSelectionRef.current?.clearValue();
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
              not listed&quot; and enter the new court division and enter the new case number.
            </div>
          )}
          {suggestedCases && suggestedCases?.length === 0 && (
            <div
              className="select-destination-case--description"
              data-testid={'suggested-cases-not-found'}
            >
              Select the new court division and enter the new case number.
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
                  id={`loading-spinner-${order.id}-suggestions`}
                  caption="Loading suggestions..."
                ></LoadingSpinner>
              </div>
            </>
          )}
          {!loadingSuggestions && (
            <>
              <div className="grid-col-1"></div>
              <div className="transfer-from-to__div transfer-description grid-col-10">
                <div className="transfer-text" tabIndex={0}>
                  {suggestedCases && suggestedCases?.length > 0 && (
                    <CaseTable
                      id="suggested-cases"
                      cases={[...suggestedCases, null]}
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
                      <CamsSelect
                        id={`court-selection-${order.id}`}
                        className="new-court__select"
                        closeMenuOnSelect={true}
                        label="New Court"
                        ref={courtSelectionRef}
                        onChange={handleCourtSelection}
                        options={getOfficeList(officesList)}
                        isSearchable={true}
                        required={true}
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
                    id={`new-case-input-${order.id}`}
                    data-testid={`new-case-input-${order.id}`}
                    className="usa-input"
                    value={order.docketSuggestedCaseNumber}
                    onChange={handleCaseInputChange}
                    allowPartialCaseNumber={true}
                    aria-label="New case number"
                    ref={caseNumberRef}
                    disabled={true}
                    required={true}
                    label="New Case Number"
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
                    id={`loading-spinner-${order.id}-case-verification`}
                    caption="Loading cases..."
                  ></LoadingSpinner>
                )}
                {!loadingCaseSummary && validationState === ValidationStates.found && (
                  <CaseTable id="validated-cases" cases={[newCaseSummary!]}></CaseTable>
                )}
                {!loadingCaseSummary && validationState === ValidationStates.notFound && (
                  <Alert
                    inline={true}
                    show={true}
                    message="We couldn't find a case with that number"
                    type={UswdsAlertStyle.Error}
                    role="status"
                    className="validation-alert"
                    id="validation-not-found"
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

import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import { useApi } from '@/lib/hooks/UseApi';
import { CaseSummary } from '@common/cams/cases';
import { OfficeDetails } from '@common/cams/courts';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { CaseTable, CaseTableImperative } from './CaseTable';
import Alert, { AlertDetails, UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import { FormRequirementsNotice } from '@/lib/components/uswds/FormRequirementsNotice';
import CamsSelect, {
  CamsSelectOptionList,
  SearchableSelectOption,
} from '@/lib/components/CamsSelect';
import { getOfficeList } from '../dataVerificationHelper';
import CaseNumberInput from '@/lib/components/CaseNumberInput';
import { TransferOrder, TransferOrderAction } from '@common/cams/orders';
import { InputRef } from '@/lib/type-declarations/input-fields';
import { Chapter15CaseSummaryResponseData } from '@/lib/type-declarations/chapter-15';

export function updateOrderTransfer(
  orderTransfer: FlexibleTransferOrderAction,
  office: OfficeDetails | null,
  caseNumber: string | null,
) {
  const updated: FlexibleTransferOrderAction = { ...orderTransfer };
  updated.newCase = {
    ...updated.newCase,
    regionId: office?.regionId,
    regionName: office?.regionName,
    courtName: office?.courtName,
    courtDivisionName: office?.courtDivisionName,
    courtDivisionCode: office?.courtDivisionCode,
    caseId: `${office?.courtDivisionCode}-${caseNumber}`,
  };

  return updated;
}

// TODO: Maybe define this type somewhere where we will not cause a dependency violation or circular dependency.
export type FlexibleTransferOrderAction = Partial<TransferOrderAction> & {
  newCase?: Partial<CaseSummary>;
};

// TODO: Maybe define this type somewhere where we will not cause a dependency violation or circular dependency.
export function getOrderTransferFromOrder(order: TransferOrder): FlexibleTransferOrderAction {
  const { id, caseId } = order;
  return {
    id,
    caseId,
    orderType: order.orderType,
  };
}

export type SuggestedTransferCasesImperative = {
  reset: () => void;
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
  const [orderTransfer, setOrderTransfer] = useState<FlexibleTransferOrderAction>(
    getOrderTransferFromOrder(order),
  );

  const suggestedCasesRef = useRef<CaseTableImperative>(null);
  const caseNumberRef = useRef<InputRef>(null);
  const courtSelectionRef = useRef<InputRef>(null);

  const api = useApi();

  async function isValidOrderTransfer(transfer: FlexibleTransferOrderAction) {
    if (!transfer.newCase?.caseId) return false;
    setLoadingCaseSummary(true);
    let result = false;
    await api
      .get(`/cases/${transfer.newCase.caseId}/summary`)
      .then((response) => {
        const typedResponse = response as Chapter15CaseSummaryResponseData;
        props.onCaseSelection(typedResponse.body);
        setNewCaseSummary(typedResponse.body);
        setValidationState(ValidationStates.found);
        result = true;
      })
      .catch((_reason) => {
        setValidationState(ValidationStates.notFound);
        result = false;
      });

    setLoadingCaseSummary(false);
    return result;
  }

  // TODO: fmadden 03/11/24 - When a court selection is made, getCaseSummary() seems to be getting called and
  // uses the previously set case number, rather than the value in the New Case input field.
  // as a result, you get the wrong case summary listed.
  function handleCourtSelection(selection: CamsSelectOptionList) {
    setValidationState(ValidationStates.notValidated);
    const office =
      officesList.find(
        (o) => o.courtDivisionCode === (selection as SearchableSelectOption)?.value,
      ) || null;
    setNewCaseDivision(office);
    if (!office) {
      setValidationState(ValidationStates.notValidated);
      setNewCaseSummary(null);
    }
    caseNumberRef.current?.disable(!office);

    const updatedOrderTransfer = updateOrderTransfer(orderTransfer, office, newCaseNumber);
    setOrderTransfer(updatedOrderTransfer);
    if (office && newCaseNumber) {
      isValidOrderTransfer(updatedOrderTransfer);
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
      return;
    }

    const updatedOrderTransfer = updateOrderTransfer(orderTransfer, newCaseDivision, caseNumber);
    setOrderTransfer(updatedOrderTransfer);
    if (caseNumber && newCaseDivision) {
      isValidOrderTransfer(updatedOrderTransfer);
    }
  }

  function getTransferredCaseSuggestions(caseId: string) {
    setLoadingSuggestions(true);
    api
      .get(`/orders-suggestions/${caseId}/`)
      .then((response) => {
        setLoadingSuggestions(false);
        setSuggestedCases(response.body as CaseSummary[]);
        if ((response.body as CaseSummary[]).length === 0) {
          setEnableCaseEntry(true);
        }
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

  function reset() {
    setOrderTransfer(getOrderTransferFromOrder(order));
    setNewCaseSummary(null);
    setValidationState(ValidationStates.notValidated);
    if (suggestedCasesRef.current) suggestedCasesRef.current.clearAllCheckboxes();
    setLoadingCaseSummary(false);
  }

  function cancel(): void {
    courtSelectionRef.current?.clearValue();
    caseNumberRef.current?.resetValue();
    setEnableCaseEntry(false);
    reset();
  }
  useImperativeHandle(SuggestedTransferCasesRef, () => ({
    reset,
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
          {(loadingSuggestions || (suggestedCases && suggestedCases?.length > 0)) && (
            <div className="select-destination-case--description">
              Select the new case from the list below. If the case is not listed, select the new
              court division and enter the new case number.
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
                  {suggestedCases && suggestedCases.length === 0 && (
                    <div className="alert-container">
                      <Alert
                        inline={true}
                        show={true}
                        title="No Matching Cases"
                        message="We couldn't find any cases with similar information to the case being transferred. Please try again later. Otherwise, enter the Court and Case Number below."
                        type={UswdsAlertStyle.Warning}
                        role="status"
                        className="suggested-cases-alert"
                        id="suggested-cases-not-found"
                      />
                    </div>
                  )}
                </div>
                <div className="grid-col-1"></div>
              </div>
            </>
          )}
        </div>
        {enableCaseEntry && (
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

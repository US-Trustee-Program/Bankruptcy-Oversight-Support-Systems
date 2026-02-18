import './CaseReload.scss';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import { ComboOption } from '@/lib/components/combobox/ComboBox';
import Api2 from '@/lib/models/api2';
import { CaseDetail } from '@common/cams/cases';
import { getDivisionComboOptions } from '@/data-verification/dataVerificationHelper';
import { sortByCourtLocation } from '@/lib/utils/court-utils';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ComboBoxRef } from '@/lib/type-declarations/input-fields';
import { CASE_NUMBER_REGEX } from '@common/cams/regex';
import { useCaseReloadPolling } from './useCaseReloadPolling';
import { buildCaseId, parseApiValidationError } from './case-reload-helpers';
import { CaseSearchForm } from './CaseSearchForm';
import { ValidatedCaseDisplay } from './ValidatedCaseDisplay';
import { PollingStatusDisplay } from './PollingStatusDisplay';
import { CaseReloadActions } from './CaseReloadActions';
import { ErrorDisplay } from './ErrorDisplay';

export function CaseReload() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [divisionCode, setDivisionCode] = useState('');
  const [divisionName, setDivisionName] = useState('');
  const [caseNumber, setCaseNumber] = useState('');
  const [validatedCase, setValidatedCase] = useState<CaseDetail | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isReloading, setIsReloading] = useState(false);
  const [divisionsList, setDivisionsList] = useState<ComboOption[]>([]);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [reloadError, setReloadError] = useState<string | null>(null);

  const divisionSelectionRef = useRef<ComboBoxRef>(null);

  const { pollStatus, cosmosCase, startPolling, setInitialCase, reset } = useCaseReloadPolling();

  const getCourts = useCallback(() => {
    Api2.getCourts()
      .then((response) => {
        const sortedOffices = sortByCourtLocation(response.data);
        const divisionOptions = getDivisionComboOptions(sortedOffices);
        setDivisionsList(divisionOptions);
      })
      .finally(() => {
        setIsLoaded(true);
      });
  }, []);

  function handleDivisionSelection(selection: ComboOption[]) {
    if (selection.length > 0) {
      setDivisionCode(selection[0].value);
      setDivisionName(selection[0].label);
    } else {
      setDivisionCode('');
      setDivisionName('');
    }
  }

  function handleCaseNumberChange(caseNumber?: string) {
    setCaseNumber(caseNumber || '');
  }

  async function handleValidate() {
    setIsValidating(true);
    setValidationError(null);
    setValidatedCase(null);
    setInitialCase(null);

    try {
      const caseId = buildCaseId(divisionCode, caseNumber);
      const caseDetailResponse = await Api2.getCaseDetail(caseId);
      setValidatedCase(caseDetailResponse.data);

      const searchResponse = await Api2.searchCases({
        caseIds: [caseId],
        limit: 1,
        offset: 0,
      });
      setInitialCase(searchResponse?.data?.[0] ?? null);
    } catch (error: unknown) {
      setValidationError(parseApiValidationError(error));
    } finally {
      setIsValidating(false);
    }
  }

  async function handleReload() {
    setIsReloading(true);
    setReloadError(null);
    try {
      const caseId = buildCaseId(divisionCode, caseNumber);

      await Api2.postCaseReload(caseId);

      startPolling(caseId);
    } catch (error: unknown) {
      const message = (error as Error)?.message ?? 'Reason unknown.';
      setReloadError(`Failed to queue case reload. ${message}`);
    } finally {
      setIsReloading(false);
    }
  }

  function isValidatable() {
    if (!divisionCode.trim()) {
      return false;
    }

    if (!caseNumber || !CASE_NUMBER_REGEX.test(caseNumber)) {
      return false;
    }

    return !isValidating;
  }

  function isReloadable() {
    return validatedCase !== null && !isReloading;
  }

  function handleReset() {
    reset();

    setDivisionCode('');
    setDivisionName('');
    setCaseNumber('');
    setValidatedCase(null);
    setValidationError(null);
    setReloadError(null);

    if (divisionSelectionRef.current) {
      divisionSelectionRef.current.clearSelections();
    }
  }

  useEffect(() => {
    getCourts();
  }, [getCourts]);

  return (
    <div className="case-reload-admin-panel" data-testid="case-reload-panel">
      <h2>Reload Case from DXTR</h2>

      {!isLoaded && <LoadingSpinner caption="Loading..."></LoadingSpinner>}
      {isLoaded && (
        <div className="case-reload-form">
          {!validatedCase && (
            <CaseSearchForm
              divisionsList={divisionsList}
              divisionSelectionRef={divisionSelectionRef}
              isValidating={isValidating}
              isValidatable={isValidatable()}
              onDivisionSelection={handleDivisionSelection}
              onCaseNumberChange={handleCaseNumberChange}
              onValidate={handleValidate}
            />
          )}

          <ErrorDisplay validationError={validationError} reloadError={reloadError} />

          {validatedCase && (
            <>
              <ValidatedCaseDisplay
                divisionName={divisionName}
                caseNumber={caseNumber}
                validatedCase={validatedCase}
                cosmosCase={cosmosCase}
              />

              <PollingStatusDisplay pollStatus={pollStatus} isReloading={isReloading} />

              <CaseReloadActions
                pollStatus={pollStatus}
                isReloadable={isReloadable()}
                isReloading={isReloading}
                onReload={handleReload}
                onReset={handleReset}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}

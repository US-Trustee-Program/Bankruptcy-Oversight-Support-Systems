import Button, { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import CaseNumberInput from '@/lib/components/CaseNumberInput';
import ComboBox, { ComboOption } from '@/lib/components/combobox/ComboBox';
import { ComboBoxRef } from '@/lib/type-declarations/input-fields';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';

interface CaseSearchFormProps {
  divisionsList: ComboOption[];
  divisionSelectionRef: React.RefObject<ComboBoxRef | null>;
  isValidating: boolean;
  isValidatable: boolean;
  onDivisionSelection: (selection: ComboOption[]) => void;
  onCaseNumberChange: (caseNumber?: string) => void;
  onValidate: () => void;
}

export function CaseSearchForm({
  divisionsList,
  divisionSelectionRef,
  isValidating,
  isValidatable,
  onDivisionSelection,
  onCaseNumberChange,
  onValidate,
}: CaseSearchFormProps) {
  return (
    <>
      <div className="grid-row">
        <div className="grid-col-12">
          <ComboBox
            id="division-select"
            label="Division"
            aria-live="off"
            onUpdateSelection={onDivisionSelection}
            options={divisionsList}
            required={false}
            multiSelect={false}
            ref={divisionSelectionRef}
            disabled={isValidating}
          />
        </div>
      </div>

      <div className="grid-row">
        <div className="grid-col-12">
          <CaseNumberInput
            id="case-number-input"
            label="Case Number"
            onChange={onCaseNumberChange}
            allowEnterKey={false}
            allowPartialCaseNumber={false}
            disabled={isValidating}
            autoComplete="off"
          />
        </div>
      </div>

      <div className="grid-row">
        <div className="grid-col-12">
          <Button
            id="validate-button"
            onClick={onValidate}
            uswdsStyle={UswdsButtonStyle.Default}
            disabled={!isValidatable || isValidating}
          >
            Find Case
          </Button>
        </div>
      </div>

      {isValidating && (
        <div className="grid-row">
          <div className="grid-col-12">
            <LoadingSpinner caption="Finding case..." />
          </div>
        </div>
      )}
    </>
  );
}

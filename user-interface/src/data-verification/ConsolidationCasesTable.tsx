import './ConsolidationCasesTable.scss';
import { CaseNumber } from '@/lib/components/CaseNumber';
import DocketEntryDocumentList from '@/lib/components/DocketEntryDocumentList';
import { ConsolidationOrderCase } from '@common/cams/orders';
import {
  SyntheticEvent,
  forwardRef,
  useImperativeHandle,
  useState,
  ReactNode,
  useRef,
} from 'react';
import { Link } from 'react-router-dom';
import { formatDate } from '@/lib/utils/datetime';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import Checkbox, { CheckboxRef, CheckboxState } from '@/lib/components/uswds/Checkbox';

export type OrderTableImperative = {
  clearAllCheckboxes: () => void;
  selectAllCheckboxes: () => void;
};

export interface ConsolidationCaseTableProps {
  id: string;
  cases: Array<ConsolidationOrderCase>;
  onSelect?: (bCase: ConsolidationOrderCase) => void;
  updateAllSelections?: (caseList: ConsolidationOrderCase[]) => void;
  isAssignmentLoaded: boolean;
  displayDocket?: boolean;
}

function _ConsolidationCaseTable(
  props: ConsolidationCaseTableProps,
  OrderTableRef: React.Ref<OrderTableImperative>,
) {
  const { id, cases, onSelect, updateAllSelections } = props;

  const toggleCheckboxRef = useRef<CheckboxRef>(null);
  const [included, setIncluded] = useState<Array<number>>([]);
  const [checkboxGroupState, _setCheckboxGroupState] = useState<CheckboxState>(
    CheckboxState.UNCHECKED,
  );
  const setCheckboxGroupState = (groupState: CheckboxState) => {
    toggleCheckboxRef.current?.setChecked(groupState);
    _setCheckboxGroupState(groupState);
  };

  function handleCaseSelection(e: SyntheticEvent<HTMLInputElement>) {
    let tempSelectedCases: number[];
    const idx = parseInt(e.currentTarget.value);
    const newValue = [...included];
    if (newValue.includes(idx)) {
      tempSelectedCases = newValue.filter((index) => index !== idx);
    } else {
      tempSelectedCases = [...included, idx];
    }
    setIncluded(tempSelectedCases);

    const total = tempSelectedCases.length;
    if (total === 0) {
      setCheckboxGroupState(CheckboxState.UNCHECKED);
    } else if (total < cases.length) {
      setCheckboxGroupState(CheckboxState.INDETERMINATE);
    } else if (total === cases.length) {
      setCheckboxGroupState(CheckboxState.CHECKED);
    }

    const _case = cases[idx];
    if (onSelect) onSelect(_case);
  }

  function clearAllCheckboxes() {
    setIncluded([]);
    setCheckboxGroupState(CheckboxState.UNCHECKED);
    if (updateAllSelections) updateAllSelections([]);
  }

  function selectAllCheckboxes() {
    const newIdList = [];
    const newCaseList = [];
    let bCase = 0;
    const checkboxes = document.querySelectorAll(
      `#id-${id}.consolidation-cases-table input[name="case-selection"]`,
    );
    if (checkboxes) {
      for (const checkBox of checkboxes) {
        bCase = parseInt((checkBox as HTMLInputElement).value);
        newIdList.push(bCase);
        newCaseList.push(cases[bCase]);
      }
    }
    setIncluded(newIdList);
    setCheckboxGroupState(CheckboxState.CHECKED);
    if (updateAllSelections) updateAllSelections(newCaseList);
  }

  function toggleAllCheckBoxes(ev: React.ChangeEvent<HTMLInputElement>) {
    if (!ev.target.checked && checkboxGroupState === CheckboxState.CHECKED) {
      clearAllCheckboxes();
    } else {
      selectAllCheckboxes();
    }
  }

  useImperativeHandle(OrderTableRef, () => ({
    clearAllCheckboxes,
    selectAllCheckboxes,
  }));

  return (
    <>
      <h3>Cases</h3>
      <table
        className="usa-table usa-table--borderless consolidation-cases-table"
        id={`id-${id}`}
        data-testid={id}
      >
        <thead>
          <tr>
            {onSelect && (
              <th scope="col">
                <Checkbox
                  id={`${id}-checkbox-toggle`}
                  className="checkbox-toggle"
                  onChange={toggleAllCheckBoxes}
                  value={checkboxGroupState}
                  ref={toggleCheckboxRef}
                ></Checkbox>
              </th>
            )}
            <th scope="col">Case Number (Division)</th>
            <th scope="col">Debtor</th>
            <th scope="col">Chapter</th>
            <th scope="col">Case Filed</th>
            <th scope="col">Assigned Staff</th>
          </tr>
        </thead>
        <tbody>
          {cases
            ?.reduce((accumulator: ReactNode[], bCase, idx) => {
              const key = `${id}-row-${idx}`;
              accumulator.push(
                <tr key={`${key}-case-info`} data-testid={`${key}-case-info`} className="case-info">
                  {onSelect && (
                    <td scope="row">
                      <Checkbox
                        id={`${id}-case-selection-${idx}`}
                        onChange={handleCaseSelection}
                        name="case-selection"
                        value={idx}
                        title={`select ${bCase.caseTitle}`}
                        checked={included.includes(idx)}
                      ></Checkbox>
                    </td>
                  )}
                  <td scope="row">
                    <CaseNumber caseId={bCase.caseId} /> ({bCase.courtDivisionName})
                  </td>
                  <td scope="row">{bCase.caseTitle}</td>
                  <td scope="row" className="text-no-wrap">
                    {bCase.chapter}
                  </td>
                  <td scope="row">{formatDate(bCase.dateFiled)}</td>
                  <td scope="row" className="text-no-wrap">
                    {!props.isAssignmentLoaded && (
                      <LoadingSpinner
                        id={`loading-spinner-case-asignment-${bCase.caseId}`}
                        height="1rem"
                        caption="Loading..."
                      />
                    )}
                    {props.isAssignmentLoaded &&
                      bCase.attorneyAssignments &&
                      bCase.attorneyAssignments.length > 0 && (
                        <ul className="usa-list--unstyled">
                          {bCase.attorneyAssignments.map((att, idx) => (
                            <li key={`${bCase.caseId}-${idx}`}>{att.name}</li>
                          ))}
                        </ul>
                      )}
                    {props.isAssignmentLoaded &&
                      bCase.attorneyAssignments &&
                      !bCase.attorneyAssignments.length &&
                      '(unassigned)'}
                  </td>
                </tr>,
              );
              accumulator.push(
                <tr
                  key={`${key}-docket-entry`}
                  data-testid={`${key}-docket-entry`}
                  className="docket-entry"
                >
                  {onSelect && <td></td>}
                  <td colSpan={5} className="measure-6">
                    {!bCase.docketEntries && <>No docket entries</>}
                    {bCase.docketEntries &&
                      bCase.docketEntries.map((docketEntry, idx) => {
                        return (
                          <div key={`${key}-docket-entry-${idx}`}>
                            <Link
                              to={`/case-detail/${bCase.caseId}/court-docket?document=${docketEntry.documentNumber}`}
                              target="_blank"
                              title={`Open case ${bCase.caseId} docket in new window`}
                            >
                              {docketEntry.documentNumber && (
                                <span className="document-number">
                                  #{docketEntry.documentNumber} -{' '}
                                </span>
                              )}
                              {bCase.courtName} - {docketEntry.summaryText}
                            </Link>
                            <p tabIndex={0} className="measure-6">
                              {docketEntry.fullText}
                            </p>
                            {docketEntry.documents && (
                              <DocketEntryDocumentList documents={docketEntry.documents} />
                            )}
                          </div>
                        );
                      })}
                  </td>
                </tr>,
              );
              return accumulator;
            }, [])
            .map((node) => {
              return node;
            })}
        </tbody>
      </table>
    </>
  );
}

export const ConsolidationCaseTable = forwardRef(_ConsolidationCaseTable);

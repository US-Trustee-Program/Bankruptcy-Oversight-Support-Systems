import './ConsolidationCasesTable.scss';

import { CaseNumber } from '@/lib/components/CaseNumber';
import DocketEntryDocumentList from '@/lib/components/DocketEntryDocumentList';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import Alert, { UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import Button, { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import Checkbox, { CheckboxRef, CheckboxState } from '@/lib/components/uswds/Checkbox';
import { formatDate } from '@/lib/utils/datetime';
import { ConsolidationOrderCase } from '@common/cams/orders';
import {
  forwardRef,
  ReactNode,
  SyntheticEvent,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { Link } from 'react-router-dom';

export interface ConsolidationCaseTableProps {
  cases: Array<ConsolidationOrderCase>;
  displayDocket?: boolean;
  id: string;
  isDataEnhanced: boolean;
  leadCaseId?: string;
  onMarkLead?: (bCase: ConsolidationOrderCase) => void;
  onSelect?: (bCase: ConsolidationOrderCase) => void;
  updateAllSelections?: (caseList: ConsolidationOrderCase[]) => void;
}

export type OrderTableImperative = {
  clearAllCheckboxes: () => void;
  selectAllCheckboxes: () => void;
};

function _ConsolidationCaseTable(
  props: ConsolidationCaseTableProps,
  OrderTableRef: React.Ref<OrderTableImperative>,
) {
  const { cases, id, leadCaseId, onMarkLead, onSelect, updateAllSelections } = props;

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

    if (onSelect) onSelect(cases[idx]);
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

  function handleLeadCaseButton(bCase: ConsolidationOrderCase) {
    if (onMarkLead) onMarkLead(bCase);
  }

  function setLeadCaseStyle(caseId: string) {
    return leadCaseId && leadCaseId === caseId
      ? UswdsButtonStyle.Default
      : UswdsButtonStyle.Outline;
  }

  function setLeadCaseButtonLabels(caseId: string): ReactNode {
    return leadCaseId && leadCaseId === caseId ? 'Lead Case' : 'Mark as Lead';
  }

  useImperativeHandle(OrderTableRef, () => ({
    clearAllCheckboxes,
    selectAllCheckboxes,
  }));

  return (
    <>
      <h3>Cases to Consolidate</h3>
      <table
        className="usa-table usa-table--borderless consolidation-cases-table"
        data-testid={id}
        id={`id-${id}`}
      >
        <thead>
          <tr>
            {onSelect && (
              <th scope="col">
                <Checkbox
                  className="checkbox-toggle"
                  id={`${id}-checkbox-toggle`}
                  onChange={toggleAllCheckBoxes}
                  ref={toggleCheckboxRef}
                  title="select all cases"
                  value={checkboxGroupState}
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
                <tr className="case-info" data-testid={`${key}-case-info`} key={`${key}-case-info`}>
                  {onSelect && (
                    <td>
                      <Checkbox
                        checked={included.includes(idx)}
                        id={`case-selection-${id}-${idx}`}
                        name="case-selection"
                        onChange={handleCaseSelection}
                        title={`select ${bCase.caseTitle}`}
                        value={idx}
                      ></Checkbox>
                    </td>
                  )}
                  <td>
                    <div className="my-stuff">
                      <div>
                        <CaseNumber caseId={bCase.caseId} /> ({bCase.courtDivisionName})
                      </div>
                    </div>
                  </td>
                  <td>{bCase.caseTitle}</td>
                  <td className="text-no-wrap">{bCase.chapter}</td>
                  <td>{formatDate(bCase.dateFiled)}</td>
                  <td className="text-no-wrap">
                    {!props.isDataEnhanced && (
                      <LoadingSpinner
                        caption="Loading..."
                        height="1rem"
                        id={`loading-spinner-case-assignment-${bCase.caseId}`}
                      />
                    )}
                    {props.isDataEnhanced &&
                      bCase.attorneyAssignments &&
                      bCase.attorneyAssignments.length > 0 && (
                        <ul className="usa-list--unstyled" id={`case-assignment-${bCase.caseId}`}>
                          {bCase.attorneyAssignments.map((att, idx) => (
                            <li key={`${bCase.caseId}-${idx}`}>{att.name}</li>
                          ))}
                        </ul>
                      )}
                    {props.isDataEnhanced &&
                      bCase.attorneyAssignments &&
                      !bCase.attorneyAssignments.length &&
                      '(unassigned)'}
                  </td>
                </tr>,
              );
              accumulator.push(
                <tr
                  className="docket-entry"
                  data-testid={`${key}-docket-entry`}
                  key={`${key}-docket-entry`}
                >
                  {onSelect && <td></td>}
                  <td className="measure-6" colSpan={5}>
                    <div>
                      <Button
                        aria-checked={bCase.caseId === leadCaseId}
                        className="mark-as-lead-button"
                        id={`assign-lead-${id}-${idx}`}
                        onClick={() => handleLeadCaseButton(bCase)}
                        role="switch"
                        uswdsStyle={setLeadCaseStyle(bCase.caseId)}
                      >
                        {setLeadCaseButtonLabels(bCase.caseId)}
                      </Button>
                    </div>
                    {!bCase.docketEntries && <>No docket entries</>}
                    {bCase.docketEntries &&
                      bCase.docketEntries.map((docketEntry, idx) => {
                        return (
                          <div key={`${key}-docket-entry-${idx}`}>
                            <Link
                              target="_blank"
                              title={`Open case ${bCase.caseId} docket in new window`}
                              to={`/case-detail/${bCase.caseId}/court-docket?document=${docketEntry.documentNumber}`}
                            >
                              {docketEntry.documentNumber && (
                                <span className="document-number">
                                  #{docketEntry.documentNumber} -{' '}
                                </span>
                              )}
                              {bCase.courtName} - {docketEntry.summaryText}
                            </Link>
                            <p className="measure-6 text-wrap">{docketEntry.fullText}</p>
                            {docketEntry.documents && (
                              <DocketEntryDocumentList docketEntry={docketEntry} />
                            )}
                          </div>
                        );
                      })}
                    {(bCase.associations?.length ?? 0) > 0 && (
                      <Alert
                        inline={true}
                        message={
                          'This case is already part of a consolidation. Uncheck it to consolidate the other cases.'
                        }
                        show={true}
                        type={UswdsAlertStyle.Warning}
                      ></Alert>
                    )}
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

import './ConsolidationCasesTable.scss';
import { CaseNumber } from '@/lib/components/CaseNumber';
import DocketEntryDocumentList from '@/lib/components/DocketEntryDocumentList';
import { ConsolidationOrderCase } from '@common/cams/orders';
import React, {
  forwardRef,
  ReactNode,
  SyntheticEvent,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { Link } from 'react-router-dom';
import { formatDate } from '@/lib/utils/datetime';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import Checkbox, { CheckboxRef, CheckboxState } from '@/lib/components/uswds/Checkbox';
import Alert, { UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import Button, { UswdsButtonStyle } from '@/lib/components/uswds/Button';

export type OrderTableImperative = {
  clearAllCheckboxes: () => void;
  selectAllCheckboxes: () => void;
};

export interface ConsolidationCaseTableProps {
  id: string;
  cases: Array<ConsolidationOrderCase>;
  leadCaseId?: string;
  onSelect?: (bCase: ConsolidationOrderCase) => void;
  updateAllSelections?: (caseList: ConsolidationOrderCase[]) => void;
  isDataEnhanced: boolean;
  displayDocket?: boolean;
  onMarkLead?: (bCase: ConsolidationOrderCase) => void;
}

function ConsolidationCaseTable_(
  props: ConsolidationCaseTableProps,
  OrderTableRef: React.Ref<OrderTableImperative>,
) {
  const { id, cases, leadCaseId, onSelect, updateAllSelections, onMarkLead } = props;

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
    const idx = Number.parseInt(e.currentTarget.value);
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
        bCase = Number.parseInt((checkBox as HTMLInputElement).value);
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
                  title="Select all cases"
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
                    <td>
                      <Checkbox
                        id={`case-selection-${id}-${idx}`}
                        onChange={handleCaseSelection}
                        name="case-selection"
                        value={idx}
                        title={`Select ${bCase.caseTitle}`}
                        checked={included.includes(idx)}
                        disabled={bCase.isMemberCase}
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
                        id={`loading-spinner-case-assignment-${bCase.caseId}`}
                        height="1rem"
                        caption="Loading..."
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
                  key={`${key}-docket-entry`}
                  data-testid={`${key}-docket-entry`}
                  className="docket-entry"
                >
                  {onSelect && <td></td>}
                  <td colSpan={5} className="measure-6">
                    <div>
                      <Button
                        id={`assign-lead-${id}-${idx}`}
                        uswdsStyle={setLeadCaseStyle(bCase.caseId)}
                        className="mark-as-lead-button"
                        role="switch"
                        aria-checked={bCase.caseId === leadCaseId}
                        onClick={() => handleLeadCaseButton(bCase)}
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
                            <p className="measure-6 text-wrap">{docketEntry.fullText}</p>
                            {docketEntry.documents && (
                              <DocketEntryDocumentList docketEntry={docketEntry} />
                            )}
                          </div>
                        );
                      })}
                    {bCase.isLeadCase && !bCase.isMemberCase && (
                      <Alert
                        id="is-lead"
                        inline={true}
                        show={true}
                        message={`This case is the lead case of a ${bCase.associations?.[0].consolidationType === 'administrative' ? 'joint administration' : 'substantive'} consolidation and can be used as the lead of this consolidation.`}
                        type={UswdsAlertStyle.Warning}
                      ></Alert>
                    )}
                    {bCase.isMemberCase && (
                      <Alert
                        id="is-member"
                        inline={true}
                        show={true}
                        message={
                          'This case is a member case of a consolidation and cannot be consolidated.'
                        }
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

const ConsolidationCaseTable = forwardRef(ConsolidationCaseTable_);
export default ConsolidationCaseTable;

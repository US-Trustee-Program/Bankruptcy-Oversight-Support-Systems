import './AssignAttorneyModal.scss';
import { forwardRef, useRef, useImperativeHandle, useState, RefObject } from 'react';
import Modal from '../lib/components/uswds/modal/Modal';
import { Chapter15Type } from '@/lib/type-declarations/chapter-15';
import React from 'react';
import Checkbox from '../lib/components/uswds/Checkbox';
import { ResponseData } from '@/lib/type-declarations/api';
import { Attorney, AttorneyInfo } from '@/lib/type-declarations/attorneys';
import Api from '../lib/models/api';
import { ModalRefType, SubmitCancelButtonGroupRef } from '../lib/components/uswds/modal/modal-refs';
import { getCaseNumber } from '@/lib/utils/formatCaseNumber';
import { getFullName } from '@common/name-helper';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import Alert, { AlertDetails } from '@/lib/components/uswds/Alert';

export interface ModalOpenProps {
  bCase: Chapter15Type | undefined;
}

export interface AssignAttorneyModalRef {
  show: (showProps: ModalOpenProps | undefined) => void;
  hide: () => void;
  buttons?: RefObject<SubmitCancelButtonGroupRef>;
}

export interface AssignAttorneyModalProps {
  attorneyList: Attorney[];
  modalId: string;
  callBack: (props: CallBackProps) => void;
  alertMessage?: AlertDetails;
}

export interface AttorneyListResponseData extends ResponseData {
  attorneyList: Array<AttorneyInfo>;
}

export interface CallBackProps {
  bCase: Chapter15Type | undefined;
  selectedAttorneyList: string[];
  previouslySelectedList: string[];
  status: 'success' | 'error';
  apiResult: object;
}

function AssignAttorneyModalComponent(
  props: AssignAttorneyModalProps,
  ref: React.Ref<AssignAttorneyModalRef>,
) {
  const [bCase, setBCase] = useState<Chapter15Type>({
    caseId: '',
    chapter: '',
    caseTitle: '',
    dateFiled: '',
    assignments: [],
  });
  const modalRef = useRef<ModalRefType>(null);
  const tableContainer = useRef<HTMLTableSectionElement | null>(null);
  const modalHeading = (
    <>
      Choose Trial Attorney to assign to: {bCase?.caseTitle},{' '}
      <span className="case-number">{getCaseNumber(bCase?.caseId)}</span>
    </>
  );

  const [initialDocumentBodyStyle, setInitialDocumentBodyStyle] = useState<string>('');

  const [checkListValues, setCheckListValues] = useState<string[]>([]);
  const [previouslySelectedList, setPreviouslySelectedList] = useState<string[]>([]);
  const [isUpdatingAssignment, setIsUpdatingAssignment] = useState<boolean>(false);

  const actionButtonGroup = {
    modalId: props.modalId,
    modalRef: ref as React.RefObject<ModalRefType>,
    submitButton: {
      label: 'Assign',
      onClick: submitValues,
      disabled: true,
      closeOnClick: false,
    },
    cancelButton: {
      label: 'Go back',
    },
  };

  function show(showProps: ModalOpenProps | undefined) {
    if (showProps) {
      if (showProps.bCase) {
        setBCase(showProps.bCase);
        if (showProps.bCase.assignments) {
          setCheckListValues([...showProps.bCase.assignments]);
          setPreviouslySelectedList([...showProps.bCase.assignments]);
        }
      }
    }
    if (modalRef.current?.show) {
      modalRef.current?.show({});
    }
  }

  function hide() {
    if (modalRef.current?.hide) {
      modalRef.current?.hide({});
    }
  }

  useImperativeHandle(ref, () => {
    return {
      show,
      hide,
    };
  });

  function areArraysSame(ar1: string[], ar2: string[]): boolean {
    return JSON.stringify(ar1.sort()) === JSON.stringify(ar2.sort());
  }

  function updateCheckList(ev: React.ChangeEvent<HTMLInputElement>, name: string) {
    let localCheckListValues = [...checkListValues];
    if (ev.target.checked && !checkListValues.includes(name)) {
      localCheckListValues.push(name);
    } else if (!ev.target.checked && checkListValues.includes(name)) {
      localCheckListValues = checkListValues.filter((theName) => theName !== name);
    }
    const isTheSame =
      localCheckListValues &&
      bCase.assignments &&
      areArraysSame(localCheckListValues, bCase.assignments);

    modalRef.current?.buttons?.current?.disableSubmitButton(!!isTheSame);

    setCheckListValues(localCheckListValues);
  }

  function cancelModal() {
    setCheckListValues([]);
    thawBackground();
  }

  async function submitValues() {
    let finalAttorneyList: string[] = [];

    modalRef.current?.buttons?.current?.disableSubmitButton(true);

    // call callback from parent with IDs and names of attorneys, and case id.
    finalAttorneyList = props.attorneyList
      .filter((attorney) => checkListValues.includes(getFullName(attorney)))
      .map((atty) => {
        return getFullName(atty);
      });

    // send attorney IDs to API
    setIsUpdatingAssignment(true);
    await Api.post('/case-assignments', {
      caseId: bCase?.caseId,
      attorneyList: finalAttorneyList,
      role: 'TrialAttorney',
    })
      .then((result) => {
        props.callBack({
          bCase,
          selectedAttorneyList: finalAttorneyList,
          previouslySelectedList,
          status: 'success',
          apiResult: result,
        });
        setCheckListValues([]);
        setIsUpdatingAssignment(false);
      })
      .catch((e: Error) => {
        props.callBack({
          bCase,
          selectedAttorneyList: finalAttorneyList,
          previouslySelectedList,
          status: 'error',
          apiResult: e,
        });
        setCheckListValues([]);
        setIsUpdatingAssignment(false);
      });
    thawBackground();
  }

  function onOpen() {
    freezeBackground();
  }

  function freezeBackground() {
    setInitialDocumentBodyStyle(document.body.style.overflow);
    document.body.style.overflow = 'hidden';
  }

  function thawBackground() {
    document.body.style.overflow = initialDocumentBodyStyle;
    setInitialDocumentBodyStyle('');
  }

  const handleFocus = (event: React.FocusEvent<HTMLElement>) => {
    if (tableContainer.current && event.target instanceof HTMLInputElement) {
      // Get the position of the focused input element
      const inputRect = event.target.getBoundingClientRect();
      const divRect = tableContainer.current.getBoundingClientRect();

      // Check if the input element is below the visible area
      if (inputRect.bottom > divRect.bottom + tableContainer.current.scrollTop) {
        // Scroll the div to bring the input element into view
        tableContainer.current.scrollTop += inputRect.bottom - divRect.bottom + 10;
      } else if (inputRect.top < divRect.top + tableContainer.current.scrollTop) {
        // Check if the input element is above the visible area
        // Scroll the div to bring the input element into view
        //tableContainer.current.scrollTop -= divRect.top - inputRect.top;
        tableContainer.current.scrollTop -= inputRect.top;
      }
    }
  };

  return (
    <Modal
      ref={modalRef}
      modalId={props.modalId}
      className="assign-attorney-modal"
      onOpen={onOpen}
      onClose={cancelModal}
      heading={modalHeading}
      content={
        <>
          <div className="visible-headings">
            <label className="attorney-name">Attorney Name</label>
          </div>
          <div className="usa-table-container--scrollable" ref={tableContainer}>
            <table className="attorney-list">
              <thead>
                <tr>
                  <th>Attorney Name</th>
                </tr>
              </thead>
              <tbody data-testid="case-load-table-body">
                {props.attorneyList.length > 0 &&
                  props.attorneyList.map((attorney: Attorney, idx: number) => {
                    const name = getFullName(attorney);
                    return (
                      <tr key={idx}>
                        <td className="assign-attorney-checkbox-column">
                          <Checkbox
                            id={`${idx}-checkbox`}
                            value={`${name}`}
                            onFocus={handleFocus}
                            onChange={(event) => updateCheckList(event, name)}
                            checked={checkListValues.includes(name)}
                            className="attorney-list-checkbox"
                            label={name}
                          />
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
          {props.alertMessage && <Alert {...props.alertMessage} show={true} inline={true} />}
          <LoadingSpinner
            caption="Updating assignment..."
            height="40px"
            hidden={!isUpdatingAssignment}
          />
        </>
      }
      actionButtonGroup={actionButtonGroup}
    ></Modal>
  );
}

const AssignAttorneyModal = forwardRef(AssignAttorneyModalComponent);

export default AssignAttorneyModal;

import './AssignAttorneyModal.scss';
import { forwardRef, RefObject, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { getCaseNumber } from '@/lib/utils/caseNumber';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import Alert, { AlertDetails } from '@/lib/components/uswds/Alert';
import { CaseBasics } from '@common/cams/cases';
import { AttorneyUser, CamsUserReference } from '@common/cams/users';
import { getCamsUserReference } from '@common/cams/session';
import { deepEqual } from '@/lib/utils/objectEquality';
import {
  ModalRefType,
  OpenModalButtonRef,
  SubmitCancelButtonGroupRef,
} from '@/lib/components/uswds/modal/modal-refs';
import Modal from '@/lib/components/uswds/modal/Modal';
import Checkbox from '@/lib/components/uswds/Checkbox';
import { useApi2 } from '@/lib/hooks/UseApi2';
import { ResponseBody } from '@common/api/response';
import { useGlobalAlert } from '@/lib/hooks/UseGlobalAlert';
import { CamsRole } from '@common/cams/roles';

export interface CallbackProps {
  bCase: CaseBasics;
  selectedAttorneyList: AttorneyUser[];
  previouslySelectedList: AttorneyUser[];
  status: 'success' | 'error';
  apiResult: object;
}

type CallbackFunction = (props: CallbackProps) => void;

export interface ModalOpenProps {
  bCase: CaseBasics;
  callback: CallbackFunction;
  openModalButtonRef?: React.Ref<OpenModalButtonRef>;
}

export interface AssignAttorneyModalRef {
  show: (showProps: ModalOpenProps | undefined) => void;
  hide: () => void;
  buttons?: RefObject<SubmitCancelButtonGroupRef>;
}

export interface AssignAttorneyModalProps {
  modalId: string;
  alertMessage?: AlertDetails;
  assignmentChangeCallback: (assignees: CamsUserReference[]) => void;
}

function _AssignAttorneyModal(
  props: AssignAttorneyModalProps,
  ref: React.Ref<AssignAttorneyModalRef>,
) {
  const submitCallbackRef = useRef<CallbackFunction | null>(null);
  const modalRef = useRef<ModalRefType>(null);
  const tableContainer = useRef<HTMLTableSectionElement | null>(null);

  const [bCase, setBCase] = useState<CaseBasics | null>(null);
  const [initialDocumentBodyStyle, setInitialDocumentBodyStyle] = useState<string>('');
  const [checkListValues, setCheckListValues] = useState<CamsUserReference[]>([]);
  const [previouslySelectedList, setPreviouslySelectedList] = useState<AttorneyUser[]>([]);
  const [isUpdatingAssignment, setIsUpdatingAssignment] = useState<boolean>(false);
  const [attorneyList, setAttorneyList] = useState<AttorneyUser[]>([]);

  const modalHeading = (
    <>
      Choose Trial Attorney to assign to: {bCase?.caseTitle},{' '}
      <span className="case-number">{getCaseNumber(bCase?.caseId)}</span>
    </>
  );

  const api = useApi2();
  const globalAlert = useGlobalAlert();

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

  const fetchAttorneys = async () => {
    let attorneys;
    if (!bCase) return;
    try {
      attorneys = await api.getOfficeAttorneys(bCase.officeCode ?? '');
      setAttorneyList((attorneys as ResponseBody<AttorneyUser[]>).data);
    } catch (e) {
      globalAlert?.error((e as Error).message);
    }
  };

  function attorneyIsInCheckList(attorney: AttorneyUser): boolean {
    const result = checkListValues.find((theAttorney) => theAttorney.id === attorney.id);
    return result !== undefined;
  }

  function updateCheckList(ev: React.ChangeEvent<HTMLInputElement>, attorney: AttorneyUser) {
    if (!bCase) return;
    let localCheckListValues = [...checkListValues];
    if (ev.target.checked && !attorneyIsInCheckList(attorney)) {
      localCheckListValues.push(attorney);
    } else if (!ev.target.checked && attorneyIsInCheckList(attorney)) {
      localCheckListValues = checkListValues.filter(
        (theAttorney) => theAttorney.id !== attorney.id,
      );
    }
    const isTheSame =
      localCheckListValues &&
      !!bCase.assignments &&
      deepEqual(localCheckListValues, bCase.assignments);

    modalRef.current?.buttons?.current?.disableSubmitButton(isTheSame);

    setCheckListValues(localCheckListValues);
  }

  function cancelModal() {
    setCheckListValues([]);
    thawBackground();
  }

  async function submitValues() {
    if (!bCase) return;
    let finalAttorneyList: CamsUserReference[] = [];

    modalRef.current?.buttons?.current?.disableSubmitButton(true);

    // call callback from parent with IDs and names of attorneys, and case id.
    const ids = checkListValues.map((item) => item.id);
    finalAttorneyList = attorneyList
      .filter((attorney) => ids.includes(attorney.id))
      .map((attorney) => {
        return getCamsUserReference(attorney);
      });

    // send attorney IDs to API
    setIsUpdatingAssignment(true);

    try {
      await api.postStaffAssignments({
        caseId: bCase?.caseId,
        attorneyList: finalAttorneyList,
        role: CamsRole.TrialAttorney,
      });
      if (submitCallbackRef.current) {
        submitCallbackRef.current({
          bCase,
          selectedAttorneyList: finalAttorneyList,
          previouslySelectedList,
          status: 'success',
          apiResult: {},
        });
        props.assignmentChangeCallback(finalAttorneyList);
      }
      setCheckListValues([]);
      setIsUpdatingAssignment(false);
    } catch (e) {
      if (submitCallbackRef.current) {
        submitCallbackRef.current({
          bCase,
          selectedAttorneyList: finalAttorneyList,
          previouslySelectedList,
          status: 'error',
          apiResult: e as Error,
        });
      }
      setCheckListValues([]);
      setIsUpdatingAssignment(false);
    }
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

  const handleTab = (ev: React.KeyboardEvent, isVisible: boolean) => {
    if (
      ev.key == 'Tab' &&
      !ev.shiftKey &&
      isVisible &&
      (ev.target as Element).classList.contains('usa-modal__close')
    ) {
      const attorneyList = document.querySelector(`#${props.modalId}-description`);
      if (attorneyList) {
        (attorneyList as HTMLElement).focus();
      }
    }
  };

  function show(showProps: ModalOpenProps | undefined) {
    if (showProps && showProps.bCase) {
      setBCase(showProps.bCase);
      if (showProps.bCase.assignments) {
        const attorneys: AttorneyUser[] = [];
        showProps.bCase.assignments.forEach((assignment) => {
          attorneys.push({ id: assignment.userId, name: assignment.name } as AttorneyUser);
        });
        setCheckListValues(attorneys);
        setPreviouslySelectedList(attorneys);
      }
      if (showProps.callback) {
        submitCallbackRef.current = showProps.callback;
      }
    }
    if (modalRef.current?.show) {
      const showOptions = {
        openModalButtonRef: showProps?.openModalButtonRef ?? undefined,
      };
      modalRef.current?.show(showOptions);
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

  useEffect(() => {
    fetchAttorneys();
  }, [bCase]);

  function sortAttorneys(a: AttorneyUser, b: AttorneyUser) {
    if (a.name < b.name) return -1;
    if (a.name > b.name) return 1;
    return 0;
  }

  return (
    <Modal
      ref={modalRef}
      modalId={props.modalId}
      className="assign-attorney-modal"
      onOpen={onOpen}
      onClose={cancelModal}
      onTabKey={handleTab}
      heading={modalHeading}
      content={
        <>
          <div className="visible-headings">
            <h2 className="attorney-name">Attorney Name</h2>
          </div>
          <div className="usa-table-container--scrollable" ref={tableContainer}>
            <table className="attorney-list" role="none">
              <thead>
                <tr>
                  <th>Attorney Name</th>
                </tr>
              </thead>
              <tbody data-testid="case-load-table-body">
                {attorneyList.length > 0 &&
                  attorneyList.sort(sortAttorneys).map((attorney: AttorneyUser, idx: number) => {
                    return (
                      <tr key={idx}>
                        <td className="assign-attorney-checkbox-column">
                          <Checkbox
                            id={`${idx}-checkbox`}
                            value={attorney.id}
                            onFocus={handleFocus}
                            onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                              updateCheckList(event, attorney)
                            }
                            checked={attorneyIsInCheckList(attorney)}
                            className="attorney-list-checkbox"
                            label={attorney.name}
                          />
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
          {props.alertMessage && <Alert {...props.alertMessage} show={true} inline={true} />}
          {isUpdatingAssignment && (
            <LoadingSpinner caption="Updating assignment..." height="40px" />
          )}
        </>
      }
      actionButtonGroup={actionButtonGroup}
    ></Modal>
  );
}

const AssignAttorneyModal = forwardRef(_AssignAttorneyModal);

export default AssignAttorneyModal;

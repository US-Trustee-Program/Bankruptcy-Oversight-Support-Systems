import './AssignAttorneyModal.scss';
import { forwardRef, useRef, useImperativeHandle, useState } from 'react';
import Modal from '../lib/components/uswds/modal/Modal';
import { Chapter15Type } from '@/lib/type-declarations/chapter-15';
import React from 'react';
import Checkbox, { CheckboxRef } from '../lib/components/uswds/Checkbox';
import { ResponseData } from '@/lib/type-declarations/api';
import { Attorney, AttorneyInfo } from '@/lib/type-declarations/attorneys';
import Api from '../lib/models/api';
import { ModalRefType } from '../lib/components/uswds/modal/modal-refs';
import { getCaseNumber } from '@/lib/utils/formatCaseNumber';
import useFeatureFlags, {
  CHAPTER_ELEVEN_ENABLED,
  CHAPTER_TWELVE_ENABLED,
} from '../lib/hooks/UseFeatureFlags';
import { getFullName } from '@common/name-helper';

export interface AssignAttorneyModalProps {
  attorneyList: Attorney[];
  bCase: Chapter15Type | undefined;
  modalId: string;
  callBack: (props: CallBackProps) => void;
}

export interface AttorneyListResponseData extends ResponseData {
  attorneyList: Array<AttorneyInfo>;
}

export interface CallBackProps {
  bCase: Chapter15Type | undefined;
  selectedAttorneyList: string[];
  status: 'success' | 'error';
  apiResult: object;
}

function AssignAttorneyModalComponent(
  props: AssignAttorneyModalProps,
  ref: React.Ref<ModalRefType>,
) {
  const flags = useFeatureFlags();
  const modalRef = useRef<ModalRefType>(null);
  const tableContainer = useRef<HTMLTableSectionElement | null>(null);
  const modalHeading = (
    <>
      Choose Trial Attorney to assign to: {props.bCase?.caseTitle},{' '}
      <span className="case-number">{getCaseNumber(props.bCase?.caseId)}</span>
    </>
  );
  const chapterTwelveEnabled = flags[CHAPTER_TWELVE_ENABLED];
  const chapterElevenEnabled = flags[CHAPTER_ELEVEN_ENABLED];
  const caseLoadLabel =
    chapterTwelveEnabled || chapterElevenEnabled ? 'Case Load' : 'Chapter 15 Cases';

  const [initialDocumentBodyStyle, setInitialDocumentBodyStyle] = useState<string>('');
  const [checkListValues, setCheckListValues] = useState<string[]>([]);
  const checkboxListRefs: React.RefObject<CheckboxRef>[] = [];
  for (let i = 0; i < props.attorneyList.length; i++) {
    const checkboxRef = useRef<CheckboxRef>(null);
    checkboxListRefs.push(checkboxRef);
  }
  const actionButtonGroup = {
    modalId: props.modalId,
    modalRef: ref as React.RefObject<ModalRefType>,
    submitButton: {
      label: 'Assign',
      onClick: submitValues,
      disabled: true,
    },
    cancelButton: {
      label: 'Go back',
    },
  };

  useImperativeHandle(ref, () => {
    if (modalRef.current?.show && modalRef.current?.hide) {
      return { show: modalRef.current?.show, hide: modalRef.current?.hide };
    } else {
      return {
        show: () => null,
        hide: () => null,
      };
    }
  });

  function updateCheckList(ev: React.ChangeEvent<HTMLInputElement>, name: string) {
    let localCheckListValues = checkListValues;
    if (ev.target.checked && !checkListValues.includes(name)) {
      localCheckListValues.push(name);
    } else if (!ev.target.checked && checkListValues.includes(name)) {
      localCheckListValues = checkListValues.filter((theName) => theName !== name);
    }
    modalRef.current?.buttons?.current?.disableSubmitButton(localCheckListValues.length === 0);
    setCheckListValues(localCheckListValues);
  }

  function cancelModal() {
    setCheckListValues([]);
    thawBackground();
  }

  async function submitValues() {
    let finalAttorneyList: string[] = [];

    // call callback from parent with IDs and names of attorneys, and case id.
    finalAttorneyList = props.attorneyList
      .filter((attorney) => checkListValues.includes(getFullName(attorney)))
      .map((atty) => {
        return getFullName(atty);
      });

    setCheckListValues([]);
    modalRef.current?.buttons?.current?.disableSubmitButton(true);
    // send attorney IDs to API
    await Api.post('/case-assignments', {
      caseId: props.bCase?.caseId,
      attorneyList: finalAttorneyList,
      role: 'TrialAttorney',
    })
      .then((result) => {
        props.callBack({
          bCase: props.bCase,
          selectedAttorneyList: finalAttorneyList,
          status: 'success',
          apiResult: result,
        });
      })
      .catch((e: Error) => {
        // we ought to have a section of the screen that takes a z-index top level alert to display updates
        // that is system wide and always displays in the same place.  Probably an alert triggered by
        // a redux update.
        props.callBack({
          bCase: props.bCase,
          selectedAttorneyList: finalAttorneyList,
          status: 'error',
          apiResult: e,
        });
      });
    thawBackground();
  }

  function onOpen() {
    freezeBackground();
    checkboxListRefs.forEach((cbox) => {
      cbox.current?.setChecked(false);
    });
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
            <label className="case-load-label text-right" data-testid="case-load-label">
              {caseLoadLabel}
            </label>
          </div>
          <div className="usa-table-container--scrollable" ref={tableContainer}>
            <table className="attorney-list">
              <thead>
                <tr>
                  <th>Attorney Name</th>
                  <th className="case-load-label" data-testid="case-load-table-header">
                    {caseLoadLabel}
                  </th>
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
                            ref={checkboxListRefs[idx]}
                          />
                        </td>
                        <td className="assign-attorney-case-count-column">
                          <div className="usa-fieldset">{attorney.caseLoad}</div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </>
      }
      actionButtonGroup={actionButtonGroup}
    ></Modal>
  );
}

const AssignAttorneyModal = forwardRef(AssignAttorneyModalComponent);

export default AssignAttorneyModal;

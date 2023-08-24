import './AssignAttorneyModal.scss';
import { forwardRef, useRef, useImperativeHandle, useState } from 'react';
import Modal, { ModalRefType } from './uswds/Modal';
import { Chapter15Type } from '../type-declarations/chapter-15';
import React from 'react';
import Checkbox, { CheckboxRef } from './uswds/Checkbox';
import { ResponseData } from '../type-declarations/api';
import { Attorney, AttorneyInfo } from '../type-declarations/attorneys';
import Api from '../models/api';

export interface AssignAttorneyModalProps {
  attorneyList: Attorney[];
  bCase: Chapter15Type | undefined;
  modalId: string;
  openerId: string;
  callBack: (props: CallBackProps) => void;
}

export interface AssignedAttorney {
  name: string;
  caseCount?: number; // do we need this here?
}

export interface AttorneyListResponseData extends ResponseData {
  attorneyList: Array<AttorneyInfo>;
}

export interface CallBackProps {
  bCase: Chapter15Type | undefined;
  selectedAttorneyList: AssignedAttorney[];
  status: 'success' | 'error';
  apiResult: object;
}

function AssignAttorneyModalComponent(
  props: AssignAttorneyModalProps,
  ref: React.Ref<ModalRefType>,
) {
  const modalRef = useRef<ModalRefType>(null);
  const modalHeading = 'Assign Attorney to Chapter 15 Case';
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
      modalRef.current?.buttons?.current?.disableSubmitButton(false);
    } else if (!ev.target.checked && checkListValues.includes(name)) {
      localCheckListValues = checkListValues.filter((theName) => theName !== name);
      modalRef.current?.buttons?.current?.disableSubmitButton(localCheckListValues.length === 0);
    }
    setCheckListValues(localCheckListValues);
  }

  function cancelModal() {
    setCheckListValues([]);
  }

  async function submitValues() {
    let finalAttorneyList: AssignedAttorney[] = [];

    // call callback from parent with IDs and names of attorneys, and case id.
    finalAttorneyList = props.attorneyList
      .filter((attorney) => checkListValues.includes(attorney.getFullName()))
      .map((atty) => {
        return {
          name: atty.getFullName(),
        };
      });

    setCheckListValues([]);

    // send attorney IDs to API
    const attorneyNames = finalAttorneyList.map((atty) => atty.name);
    await Api.post('/case-assignments', {
      caseId: props.bCase?.caseNumber,
      attorneyList: attorneyNames,
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
  }

  function onOpen() {
    checkboxListRefs.forEach((cbox) => {
      cbox.current?.setChecked(false);
    });
  }

  return (
    <Modal
      ref={modalRef}
      modalId={props.modalId}
      className="assign-attorney-modal"
      openerId={props.openerId}
      onOpen={onOpen}
      onClose={cancelModal}
      heading={modalHeading}
      content={
        <table>
          <thead>
            <tr>
              <th>Attorney Name</th>
              <th>Chapter 15 Cases</th>
            </tr>
          </thead>
          <tbody>
            {props.attorneyList.length > 0 &&
              props.attorneyList.map((attorney: Attorney, idx: number) => {
                const name = attorney.getFullName();
                return (
                  <tr key={idx}>
                    <td className="assign-attorney-checkbox-column">
                      <Checkbox
                        id={`${idx}-checkbox`}
                        value={`${name}`}
                        onChange={(event) => updateCheckList(event, name)}
                        checked={checkListValues.includes(name)}
                        className="attorney-list-checkbox"
                        label={name}
                        ref={checkboxListRefs[idx]}
                      />
                    </td>
                    <td className="assign-attorney-case-count-column">
                      <div className="usa-fieldset">{Math.round(Math.random() * 10)}</div>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      }
      actionButtonGroup={actionButtonGroup}
    ></Modal>
  );
}

const AssignAttorneyModal = forwardRef(AssignAttorneyModalComponent);

export default AssignAttorneyModal;

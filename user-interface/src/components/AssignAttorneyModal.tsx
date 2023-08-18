import { forwardRef, useRef, useImperativeHandle, useState } from 'react';
import Modal, { ModalRefType } from './uswds/Modal';
import { Chapter15Type } from '../type-declarations/chapter-15';
import React from 'react';
import Checkbox, { CheckboxRef } from './uswds/Checkbox';
import Api from '../models/api';

export interface AssignAttorneyModalProps {
  bCase: Chapter15Type | undefined;
  modalId: string;
  openerId: string;
  callBack: (props: CallBackProps) => void;
}

export interface AssignedAttorney {
  id: number;
  name: string;
  caseCount: number;
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
  const [checkListValues, setCheckListValues] = useState<number[]>([]);
  const actionButtonGroup = {
    modalId: props.modalId,
    submitButton: {
      label: 'Assign',
      onClick: submitValues,
    },
    cancelButton: {
      label: 'Go back',
    },
  };

  const attorneyList: AssignedAttorney[] = [
    { id: 1, name: 'Alan Shore', caseCount: 3 },
    { id: 4, name: 'Denny Crane', caseCount: 5 },
    { id: 5, name: 'Jane Doe', caseCount: 4 },
    { id: 6, name: 'John Doe', caseCount: 15 },
    { id: 7, name: 'Roger Morre', caseCount: 256 },
    { id: 8, name: 'Roger Wilco', caseCount: 5 },
    { id: 390, name: 'Cee Threepeeo', caseCount: 0 },
  ];

  const checkboxListRefs: React.RefObject<CheckboxRef>[] = [];
  for (let i = 0; i < attorneyList.length; i++) {
    const checkboxRef = useRef<CheckboxRef>(null);
    checkboxListRefs.push(checkboxRef);
  }

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

  function updateCheckList(ev: React.ChangeEvent<HTMLInputElement>, id: number) {
    const localCheckListValues = checkListValues;
    if (ev.target.checked && !checkListValues.includes(id)) {
      localCheckListValues.push(id);
    }
    setCheckListValues(localCheckListValues);
  }

  function cancelModal() {
    setCheckListValues([]);
  }

  async function submitValues() {
    let finalAttorneyList: AssignedAttorney[] = [];

    // call callback from parent with IDs and names of attorneys, and case id.
    finalAttorneyList = attorneyList.filter((attorney) => checkListValues.includes(attorney.id));

    setCheckListValues([]);

    // send attorney IDs to API
    const attorneyIds = finalAttorneyList.map((atty) => atty.id.toString());
    await Api.post('/case-assignments', {
      caseId: props.bCase?.caseNumber,
      attorneyIdList: attorneyIds,
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
      openerId={props.openerId}
      onOpen={onOpen}
      onClose={cancelModal}
      heading={modalHeading}
      content={
        <table>
          <thead>
            <tr>
              <th></th>
              <th>Attorney Name</th>
              <th>Chapter 15 Cases</th>
            </tr>
          </thead>
          <tbody>
            {attorneyList.length > 0 &&
              attorneyList.map(
                (attorney: { id: number; name: string; caseCount: number }, idx: number) => {
                  return (
                    <tr key={idx}>
                      <td>
                        <Checkbox
                          id={`${idx}-checkbox`}
                          value={`${attorney.id}`}
                          onChange={(event) => updateCheckList(event, attorney.id)}
                          checked={checkListValues.includes(attorney.id)}
                          className="attorney-list-checkbox"
                          label=""
                          ref={checkboxListRefs[idx]}
                        />
                      </td>
                      <td>{attorney.name}</td>
                      <td>{attorney.caseCount}</td>
                    </tr>
                  );
                },
              )}
          </tbody>
        </table>
      }
      actionButtonGroup={actionButtonGroup}
    ></Modal>
  );
}

const AssignAttorneyModal = forwardRef(AssignAttorneyModalComponent);

export default AssignAttorneyModal;

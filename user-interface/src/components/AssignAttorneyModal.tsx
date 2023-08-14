import { forwardRef, useRef, useImperativeHandle } from 'react';
import Modal, { ModalRefType } from './uswds/Modal';
import { Chapter15Type } from '../type-declarations/chapter-15';
import React from 'react';

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
  openerId: string;
  bCase: Chapter15Type | undefined;
  selectedAttorneyList: AssignedAttorney[];
}

function AssignAttorneyModalComponent(
  props: AssignAttorneyModalProps,
  ref: React.Ref<ModalRefType>,
) {
  const modalRef = useRef<ModalRefType>(null);
  const modalHeading = 'Assign Attorney to Chapter 15 Case';
  const actionButtonGroup = {
    modalId: props.modalId,
    submitButton: {
      label: 'Assign',
      onClick: submitValues,
    },
    cancelButton: {
      label: 'Go back',
      onClick: cancelModal,
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

  let checkListValues: number[] = [];
  function updateCheckList(ev: React.ChangeEvent<HTMLInputElement>, id: number) {
    if (ev.target.checked && !checkListValues.includes(id)) {
      checkListValues.push(id);
    }
  }

  function cancelModal() {
    // Isn't getting called on esc key or X
    checkListValues = [];
  }

  function submitValues() {
    // send attorney IDs to API and if successful, then
    //if (true) {
    let finalAttorneyList: AssignedAttorney[] = [];
    // call callback from parent with IDs and names of attorneys, and case id.
    finalAttorneyList = attorneyList.filter((attorney) => checkListValues.includes(attorney.id));
    props.callBack({
      openerId: props.openerId,
      bCase: props.bCase,
      selectedAttorneyList: finalAttorneyList,
    });
    //}
  }

  return (
    <Modal
      ref={modalRef}
      modalId={props.modalId}
      openerId={props.openerId}
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
                        <input
                          type="checkbox"
                          id={`${idx}-checkbox`}
                          name="selectedItems"
                          value={attorney.id}
                          onChange={(event) => updateCheckList(event, attorney.id)}
                          className="attorney-list-checkbox"
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

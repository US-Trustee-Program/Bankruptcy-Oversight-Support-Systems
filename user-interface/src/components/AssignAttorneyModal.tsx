import { forwardRef, useRef, useImperativeHandle } from 'react';
import Modal, { ModalRefType } from './uswds/Modal';
import { Chapter15Type } from '../type-declarations/chapter-15';

export interface AssignAttorneyModalProps {
  bCase: Chapter15Type | undefined;
  modalId: string;
  openerId: string;
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
    },
    cancelButton: {
      label: 'Go back',
    },
  };

  const attorneyList = [
    { id: 1, name: 'Alan Shore', caseCount: 3 },
    { id: 4, name: 'Denny Crane', caseCount: 5 },
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
                          // onChange={(event) => updateCheckList(event, attorney.id)}
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

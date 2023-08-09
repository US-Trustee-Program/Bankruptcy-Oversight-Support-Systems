import Modal, { BaseModalProps } from './uswds/Modal';
import { Chapter15Type } from '../type-declarations/chapter-15';

export interface AssignAttorneyModalProps extends BaseModalProps {
  bCase: Chapter15Type | undefined;
  modalId: string;
}

export default function AssignAttorneyModal(props: AssignAttorneyModalProps) {
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

  return (
    <Modal
      modalId={props.modalId}
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
      hide={props.hide}
      isVisible={props.isVisible}
    ></Modal>
  );
}

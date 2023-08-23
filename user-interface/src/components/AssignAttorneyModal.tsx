import './AssignAttorneyModal.scss';
import { forwardRef, useRef, useImperativeHandle, useState, useEffect } from 'react';
import Modal, { ModalRefType } from './uswds/Modal';
import { Chapter15Type } from '../type-declarations/chapter-15';
import React from 'react';
import Checkbox, { CheckboxRef } from './uswds/Checkbox';
import Api from '../models/api';
import { ResponseData } from '../type-declarations/api';

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

export interface AttorneyList {
  firstName: string;
  middleName: string;
  lastName: string;
  generation: string;
  office: string;
}

export interface AttorneyListResponseData extends ResponseData {
  attorneyList: Array<AttorneyList>;
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
  const [attorneyList, setAttorneyList] = useState<AttorneyList[]>([]);
  const [checkListValues, setCheckListValues] = useState<string[]>([]);
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

  const checkboxListRefs: React.RefObject<CheckboxRef>[] = [];
  function setCheckBoxRefs(attorneyList: AttorneyList[]) {
    for (let i = 0; i < attorneyList.length; i++) {
      const checkboxRef = useRef<CheckboxRef>(null);
      checkboxListRefs.push(checkboxRef);
    }
  }
  useEffect(() => {
    Api.list('/attorneys').then((response) => {
      const attorneyListResponse = response.body as AttorneyListResponseData;
      setAttorneyList(attorneyListResponse.attorneyList);
      setCheckBoxRefs(attorneyListResponse.attorneyList);
    });
  }, [attorneyList.length > 0]);

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
    /*
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
      */
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
            {attorneyList.length > 0 &&
              attorneyList.map(
                (
                  attorney: { firstName: string; middleName: string; lastName: string },
                  idx: number,
                ) => {
                  const name = `${attorney.firstName} ${attorney.middleName} ${attorney.lastName}`;
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

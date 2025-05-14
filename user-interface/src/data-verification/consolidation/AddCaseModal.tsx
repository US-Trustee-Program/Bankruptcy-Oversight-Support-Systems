import Modal from '@/lib/components/uswds/modal/Modal';
import { ModalRefType } from '@/lib/components/uswds/modal/modal-refs';
import { SubmitCancelBtnProps } from '@/lib/components/uswds/modal/SubmitCancelButtonGroup';
import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import './ConsolidationOrderModal.scss';
import ComboBox from '@/lib/components/combobox/ComboBox';
import CaseNumberInput from '@/lib/components/CaseNumberInput';
import Alert, { UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import { CaseTable } from '@/data-verification/transfer/CaseTable';
import { AddCaseModel } from '@/data-verification/consolidation/consolidationViewModel';

export interface AddCaseModalProps {
  addCaseModel: AddCaseModel;
  // id: string;
  // onCancel: () => void;
  // submitAddCase: () => void;
  // courts?: CourtDivisionDetails[];
}

export type AddCaseModalImperative = ModalRefType & {
  show: () => void;
};

// TODO: Refactor out the view model.
function AddCaseForm(addCaseModel: AddCaseModel) {
  return (
    <section
      className={`lead-case-form-container lead-case-form-container-${addCaseModel.orderId}`}
    >
      <h3>Enter lead case details:</h3>
      <span id="lead-case-form-instructions">
        Choose a new court and enter a case number, and the lead case will be selected for this Case
        Event automatically.
      </span>
      <div className="lead-case-court-container">
        <ComboBox
          id={'lead-case-court'}
          className="lead-case-court"
          label="Select a court"
          ariaDescription="foo bar"
          aria-live="off"
          aria-describedby="lead-case-form-instructions"
          onUpdateSelection={addCaseModel.handleSelectLeadCaseCourt}
          options={addCaseModel.filteredOfficeRecords!}
          required={true}
          multiSelect={false}
          ref={addCaseModel.additionalCaseDivisionRef}
        />
      </div>
      <div className="lead-case-number-container">
        <CaseNumberInput
          id={`lead-case-input-${addCaseModel.orderId}`}
          data-testid={`lead-case-input-${addCaseModel.orderId}`}
          className="usa-input"
          onChange={addCaseModel.handleLeadCaseInputChange}
          allowPartialCaseNumber={false}
          required={true}
          label="Enter a case number"
          ref={addCaseModel.additionalCaseNumberRef}
          aria-describedby="lead-case-form-instructions"
        />
        {addCaseModel.addCaseNumberError ? (
          <Alert
            id={`lead-case-number-alert-${addCaseModel.orderId}`}
            message={addCaseModel.addCaseNumberError}
            type={UswdsAlertStyle.Error}
            show={true}
            slim={true}
            inline={true}
          ></Alert>
        ) : (
          <LoadingSpinner
            id={`lead-case-number-loading-spinner-${addCaseModel.orderId}`}
            caption="Verifying lead case number..."
            height="40px"
            hidden={!addCaseModel.isLookingForCase}
          />
        )}
        {addCaseModel.caseToAdd && (
          <>
            <h4>Selected Lead Case</h4>
            <CaseTable
              id={`valid-case-number-found-${addCaseModel.orderId}`}
              cases={[addCaseModel.caseToAdd]}
            ></CaseTable>
          </>
        )}
      </div>
    </section>
  );
}

function _AddCaseModal(
  props: AddCaseModalProps,
  AddCaseModalRef: React.Ref<AddCaseModalImperative>,
) {
  const { handleAddCaseAction, orderId } = props.addCaseModel;
  const modalRef = useRef<ModalRefType>(null);

  const actionButtonGroup: SubmitCancelBtnProps = {
    modalId: `add-case-modal-${orderId}`,
    modalRef: modalRef,
    submitButton: {
      label: 'Add Case',
      onClick: handleAddCaseAction,
      closeOnClick: true,
      disabled: false,
    },
    cancelButton: {
      label: 'Go back',
      onClick: () => {
        reset();
        // TODO: make sure we're clearing the store of any selected data.
      },
    },
  };

  function show() {
    if (modalRef.current?.show) {
      modalRef.current?.show({});
    }
  }

  function reset() {}

  useImperativeHandle(AddCaseModalRef, () => ({
    show,
    hide: reset,
  }));

  return (
    <Modal
      ref={modalRef}
      modalId={orderId}
      className={`add-case-modal consolidation-order-modal`}
      heading="Add Case"
      data-testid={`add-case-modal-${orderId}`}
      onClose={() => {
        /* TODO: do we need to do anything? */
      }}
      content={<AddCaseForm {...props.addCaseModel} />}
      actionButtonGroup={actionButtonGroup}
    ></Modal>
  );
}

export const AddCaseModal = forwardRef(_AddCaseModal);

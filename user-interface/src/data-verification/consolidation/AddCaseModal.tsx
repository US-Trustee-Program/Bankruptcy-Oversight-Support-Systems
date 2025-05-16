import './AddCaseModal.scss';
import Modal from '@/lib/components/uswds/modal/Modal';
import { ModalRefType } from '@/lib/components/uswds/modal/modal-refs';
import { SubmitCancelBtnProps } from '@/lib/components/uswds/modal/SubmitCancelButtonGroup';
import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import ComboBox from '@/lib/components/combobox/ComboBox';
import CaseNumberInput from '@/lib/components/CaseNumberInput';
import Alert, { UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import { AddCaseModel } from '@/data-verification/consolidation/consolidationViewModel';
import { Link } from 'react-router-dom';

export interface AddCaseModalProps {
  addCaseModel: AddCaseModel;
  id: string;
}

export type AddCaseModalImperative = ModalRefType & {
  show: () => void;
};

// TODO: Refactor out the view model.
function AddCaseForm(viewModel: AddCaseModel) {
  return (
    <section className={`add-case-form-container add-case-form-container-${viewModel.orderId}`}>
      <h3>Enter lead case details:</h3>
      <span id="add-case-form-instructions">
        Choose a new court and enter a case number, and the lead case will be selected for this Case
        Event automatically.
      </span>
      <div className="add-case-court-container">
        <ComboBox
          id={'add-case-court'}
          className="add-case-court"
          label="Select a court"
          ariaDescription="foo bar"
          aria-live="off"
          aria-describedby="add-case-form-instructions"
          onUpdateSelection={viewModel.handleAddCaseCourtSelectChange}
          options={viewModel.filteredOfficeRecords!}
          required={true}
          multiSelect={false}
          disabled={viewModel.isLookingForCase}
          ref={viewModel.additionalCaseDivisionRef}
        />
      </div>
      <div className="add-case-number-container">
        <CaseNumberInput
          id={`add-case-input-${viewModel.orderId}`}
          data-testid={`add-case-input-${viewModel.orderId}`}
          className="usa-input"
          onChange={viewModel.handleAddCaseNumberInputChange}
          allowPartialCaseNumber={false}
          required={true}
          disabled={viewModel.isLookingForCase}
          label="Enter a case number"
          ref={viewModel.additionalCaseNumberRef}
          aria-describedby="add-case-form-instructions"
        />
      </div>
      <div className="results-container">
        {viewModel.addCaseNumberError ? (
          <Alert
            id={`add-case-number-alert-${viewModel.orderId}`}
            message={viewModel.addCaseNumberError}
            type={UswdsAlertStyle.Error}
            show={true}
            slim={true}
            inline={true}
          ></Alert>
        ) : (
          <LoadingSpinner
            id={`add-case-number-loading-spinner-${viewModel.orderId}`}
            caption="Verifying lead case number..."
            height="40px"
            hidden={!viewModel.isLookingForCase}
          />
        )}
        {viewModel.caseToAdd && (
          <>
            {/*<h4>Selected Case</h4>*/}
            <div className="search-results grid-container">
              <div className="grid-row">
                <h4 className="grid-col-4">Case Title</h4>
                <div className="grid-col-8">
                  <Link
                    className="usa-link"
                    to={`/case-detail/${viewModel.caseToAdd.caseId}/`}
                    title={`View case number ${viewModel.caseToAdd.caseId} details`}
                    target="_blank"
                  >
                    {viewModel.caseToAdd.caseTitle}
                  </Link>
                </div>
              </div>
              <div className="grid-row">
                <h4 className="grid-col-4">Chapter</h4>
                <span className="grid-col-8">{viewModel.caseToAdd.chapter}</span>
              </div>
              <div className="grid-row">
                <h4 className="grid-col-4">Filed Date</h4>
                <span className="grid-col-8">{viewModel.caseToAdd.dateFiled}</span>
              </div>
            </div>
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
      disabled: !props.addCaseModel.caseToAdd,
    },
    cancelButton: {
      label: 'Go back',
      onClick: props.addCaseModel.handleAddCaseReset,
    },
  };

  function show() {
    if (modalRef.current?.show) {
      modalRef.current?.show({});
    }
  }

  function reset() {
    props.addCaseModel.handleAddCaseReset();
  }

  useImperativeHandle(AddCaseModalRef, () => ({
    show,
    hide: reset,
  }));

  useEffect(() => {
    const divisionCode = props.addCaseModel.defaultDivisionCode;
    const options = props.addCaseModel.filteredOfficeRecords;
    const selected = options?.filter((option) => option.value === divisionCode) ?? [];
    props.addCaseModel.additionalCaseDivisionRef.current?.setSelections(selected);
  }, []);

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

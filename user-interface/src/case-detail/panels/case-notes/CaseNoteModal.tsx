import { AlertDetails } from '@/lib/components/uswds/Alert';
import { forwardRef, RefObject, useImperativeHandle, useRef, useState } from 'react';
import { ModalRefType, SubmitCancelButtonGroupRef } from '@/lib/components/uswds/modal/modal-refs';
import Input from '@/lib/components/uswds/Input';
import Modal from '@/lib/components/uswds/modal/Modal';
import { SubmitCancelBtnProps } from '@/lib/components/uswds/modal/SubmitCancelButtonGroup';
import { TextAreaRef } from '@/lib/type-declarations/input-fields';
import Button, { ButtonRef, UswdsButtonStyle } from '@/lib/components/uswds/Button';
import TextArea from '@/lib/components/uswds/TextArea';
// import Api2 from '@/lib/models/api2';
// import HttpStatusCodes from '@common/api/http-status-codes';
// import { useGlobalAlert } from '@/lib/hooks/UseGlobalAlert';
// import { ResponseBody } from '@common/api/response';

export interface CaseNotesCallbackProps {
  status: 'success' | 'error';
}

type CallbackFunction = (props: CaseNotesCallbackProps) => void;

export type CaseNoteModalOpenProps = {
  id?: string;
  title?: string;
  content?: string;
  caseId: string;
  callback: CallbackFunction;
};

export type CaseNoteModalRef = {
  show: (showProps: CaseNoteModalOpenProps) => void;
  hide: () => void;
  buttons?: RefObject<SubmitCancelButtonGroupRef>;
};

export type CaseNoteModalProps = {
  modalId: string;
  alertMessage?: AlertDetails;
};

function _CaseNoteModal(props: CaseNoteModalProps, ref: React.Ref<CaseNoteModalRef>) {
  // const api = Api2;
  const modalRef = useRef<ModalRefType>(null);
  const titleInputRef = useRef<TextAreaRef>(null);
  const contentInputRef = useRef<TextAreaRef>(null);
  const submitButtonRef = useRef<ButtonRef>(null);
  const clearButtonRef = useRef<ButtonRef>(null);
  // const globalAlert = useGlobalAlert();

  const editNoteModalId = 'edit-note-modal';
  function handleTitleChange(_event: React.ChangeEvent<HTMLInputElement>) {}
  function handleContentChange(_event: React.ChangeEvent<HTMLTextAreaElement>) {}

  const [editNoteModalTitle, setEditNoteModalTitle] = useState<string>('');

  function setFormButtonState(enabled: boolean) {
    submitButtonRef.current?.disableButton(!enabled);
    clearButtonRef.current?.disableButton(!enabled);
  }

  function clearCaseNoteForm() {
    titleInputRef.current?.clearValue();
    contentInputRef.current?.clearValue();
    // LocalFormCache.clearForm(formKey);
    setFormButtonState(false);
  }

  // function disableFormFields(disabled: boolean) {
  //   titleInputRef.current?.disable(disabled);
  //   contentInputRef.current?.disable(disabled);
  //   setFormButtonState(!disabled);
  // }

  async function sendCaseNoteToApi() {
    // api
    //   .postCaseNote(caseNoteInput)
    //   .then(() => {
    //     if (props.onNoteCreation) {
    //       props.onNoteCreation();
    //     }
    //     disableFormFields(false);
    //     clearCaseNoteForm();
    //   })
    //   .catch((e: ResponseBody) => {
    //     if (e.data !== HttpStatusCodes.FORBIDDEN) {
    //       globalAlert?.error('Could not insert case note.');
    //     }
    //     disableFormFields(false);
    //   });
  }

  const editNoteButtonGroup: SubmitCancelBtnProps = {
    modalId: props.modalId,
    modalRef,
    submitButton: {
      label: 'Save',
      onClick: sendCaseNoteToApi,
      disabled: false,
      closeOnClick: true,
    },
    cancelButton: {
      label: 'Cancel',
    },
  };

  function show(showProps: CaseNoteModalOpenProps) {
    setEditNoteModalTitle('replace this with something from showProps');
    if (showProps) {
      // populate form with note data
    }
    if (modalRef.current?.show) {
      const showOptions = {
        //openModalButtonRef: showProps?.openModalButtonRef ?? undefined,
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

  return (
    <Modal
      ref={modalRef}
      modalId={editNoteModalId}
      className="edit-note-modal"
      heading={editNoteModalTitle}
      actionButtonGroup={editNoteButtonGroup}
      content={
        <div className="case-notes-form-container">
          <Input
            id="case-note-title-input"
            label="Note title"
            required={true}
            includeClearButton={true}
            onChange={handleTitleChange}
            autoComplete="off"
            ref={titleInputRef}
          />
          <TextArea
            id="note-content"
            label="Note Text"
            required={true}
            onChange={handleContentChange}
            ref={contentInputRef}
          />
          <div className="form-button-bar">
            <Button
              id="submit-case-note"
              uswdsStyle={UswdsButtonStyle.Default}
              onClick={sendCaseNoteToApi}
              aria-label="Add case note."
              ref={submitButtonRef}
            >
              Add Note
            </Button>
            <Button
              id="clear-case-note"
              uswdsStyle={UswdsButtonStyle.Unstyled}
              onClick={clearCaseNoteForm}
              aria-label="Clear case note form data."
              ref={clearButtonRef}
            >
              Discard
            </Button>
          </div>
        </div>
      }
    ></Modal>
  );
}

const CaseNoteModal = forwardRef(_CaseNoteModal);

export default CaseNoteModal;

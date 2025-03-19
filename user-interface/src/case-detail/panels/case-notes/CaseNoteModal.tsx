import './CaseNoteModal.scss';
import Alert, { AlertDetails, AlertRefType, UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { ModalRefType, OpenModalButtonRef } from '@/lib/components/uswds/modal/modal-refs';
import Input from '@/lib/components/uswds/Input';
import Modal from '@/lib/components/uswds/modal/Modal';
import { SubmitCancelBtnProps } from '@/lib/components/uswds/modal/SubmitCancelButtonGroup';
import { TextAreaRef } from '@/lib/type-declarations/input-fields';
import TextArea from '@/lib/components/uswds/TextArea';
import Api2 from '@/lib/models/api2';
import HttpStatusCodes from '@common/api/http-status-codes';
import { ResponseBody } from '@common/api/response';
import { CaseNoteInput } from '@common/cams/cases';
import { getCamsUserReference } from '@common/cams/session';
import LocalStorage from '@/lib/utils/local-storage';
import LocalFormCache from '@/lib/utils/local-form-cache';

export function getCaseNotesInputValue(ref: TextAreaRef | null) {
  return ref?.getValue() ?? '';
}

function buildCaseNoteFormKey(caseId: string) {
  return `case-notes-${caseId}`;
}

type CallbackFunction = (noteId?: string) => void;

export type CaseNoteModalOpenProps = {
  id?: string;
  title?: string;
  content?: string;
  caseId: string;
  callback: CallbackFunction;
  openModalButtonRef: OpenModalButtonRef;
};

export interface CaseNoteModalRef extends ModalRefType {
  show: (showProps: CaseNoteModalOpenProps) => void;
  hide: () => void;
}

export type CaseNoteModalProps = {
  modalId: string;
  alertMessage?: AlertDetails;
};

const defaultModalOpenOptions: CaseNoteModalOpenProps = {
  caseId: '',
  callback: () => {},
  openModalButtonRef: {
    focus: () => {},
    disableButton: (_state: boolean) => {},
  },
};

function _CaseNoteModal(props: CaseNoteModalProps, ref: React.Ref<CaseNoteModalRef>) {
  const api = Api2;
  const noteModalId = 'case-note-form';

  const [formKey, setFormKey] = useState<string>('');
  const [modalOpenOptions, setModalOpenOptions] =
    useState<CaseNoteModalOpenProps>(defaultModalOpenOptions);
  const [noteModalTitle, setNoteModalTitle] = useState<string>('');
  const [cancelButtonLabel, setCancelButtonLabel] = useState<string>('');
  const [formValuesFromShowOptions, setFormValuesFromShowOptions] = useState<CaseNoteInput | null>(
    null,
  );
  const alertRef = useRef<AlertRefType>(null);

  const modalRef = useRef<ModalRefType>(null);
  const titleInputRef = useRef<TextAreaRef>(null);
  const contentInputRef = useRef<TextAreaRef>(null);

  const session = LocalStorage.getSession();

  function disableSubmitButton(disable: boolean) {
    const buttons = modalRef.current?.buttons;
    if (buttons && buttons.current) {
      buttons.current.disableSubmitButton(disable);
    }
  }

  function toggleButtonOnDirtyForm() {
    const cachedData = LocalFormCache.getForm(formKey) as CaseNoteInput;
    const dirty =
      cachedData &&
      formValuesFromShowOptions &&
      (formValuesFromShowOptions.title !== cachedData.title ||
        formValuesFromShowOptions.content !== cachedData.content);
    disableSubmitButton(!dirty);
  }

  function saveFormData(data: CaseNoteInput) {
    if (data.title?.length > 0 || data.content?.length > 0) {
      LocalFormCache.saveForm(formKey, data);
    } else {
      LocalFormCache.clearForm(formKey);
    }
    toggleButtonOnDirtyForm();
  }

  function handleTitleChange(event: React.ChangeEvent<HTMLInputElement>) {
    saveFormData({
      caseId: modalOpenOptions.caseId,
      title: event?.target.value,
      content: getCaseNotesInputValue(contentInputRef.current),
    });
  }

  function handleContentChange(event: React.ChangeEvent<HTMLTextAreaElement>) {
    saveFormData({
      caseId: modalOpenOptions.caseId,
      title: getCaseNotesInputValue(titleInputRef.current),
      content: event.target.value,
    });
  }

  function clearCaseNoteForm() {
    titleInputRef.current?.clearValue();
    contentInputRef.current?.clearValue();
    LocalFormCache.clearForm(formKey);
    toggleButtonOnDirtyForm();
  }

  function disableFormFields(disabled: boolean) {
    titleInputRef.current?.disable(disabled);
    contentInputRef.current?.disable(disabled);
    disableSubmitButton(disabled);
  }

  async function postCaseNote(caseNoteInput: CaseNoteInput) {
    api
      .postCaseNote(caseNoteInput)
      .then(() => {
        modalOpenOptions.callback();
        clearCaseNoteForm();
        hide();
      })
      .catch((e: ResponseBody) => {
        if (e.data !== HttpStatusCodes.FORBIDDEN) {
          alertRef.current?.show();
        }
      })
      .finally(() => {
        disableFormFields(false);
      });
  }

  async function putCaseNoteEdit(caseNoteInput: CaseNoteInput) {
    api
      .putCaseNote(caseNoteInput)
      .then((noteId: string | undefined) => {
        modalOpenOptions.callback(noteId);
        clearCaseNoteForm();
        hide();
      })
      .catch((e: ResponseBody) => {
        if (e.data !== HttpStatusCodes.FORBIDDEN) {
          alertRef.current?.show();
        }
      })
      .finally(() => {
        disableFormFields(false);
      });
  }

  async function sendCaseNoteToApi() {
    const title = getCaseNotesInputValue(titleInputRef.current);
    const content = getCaseNotesInputValue(contentInputRef.current);
    if (!modalOpenOptions.id && session?.user) {
      const caseNoteInput: CaseNoteInput = {
        caseId: modalOpenOptions.caseId,
        title,
        content,
        updatedBy: getCamsUserReference(session?.user),
      };
      postCaseNote(caseNoteInput);
    } else if (modalOpenOptions.id && session?.user) {
      const caseNoteInput: CaseNoteInput = {
        id: modalOpenOptions.id,
        caseId: modalOpenOptions.caseId,
        title,
        content,
        updatedBy: getCamsUserReference(session?.user),
      };
      putCaseNoteEdit(caseNoteInput);
    }
  }

  const caseNoteFormButtonGroup: SubmitCancelBtnProps = {
    modalId: props.modalId,
    modalRef,
    submitButton: {
      label: 'Save',
      onClick: sendCaseNoteToApi,
      disabled: false,
      closeOnClick: false,
    },
    cancelButton: {
      label: cancelButtonLabel,
      onClick: clearCaseNoteForm,
    },
  };

  function show(showProps: CaseNoteModalOpenProps) {
    setNoteModalTitle(`${showProps.id ? 'Edit' : 'Create'} Case Note`);
    setCancelButtonLabel(`${showProps.id ? 'Cancel' : 'Discard'}`);
    if (showProps) {
      const formKey = buildCaseNoteFormKey(showProps.caseId);
      setFormKey(formKey);
      setModalOpenOptions(showProps);
      setFormValuesFromShowOptions({
        caseId: showProps.caseId,
        title: showProps.title ?? '',
        content: showProps.content ?? '',
      });

      titleInputRef.current?.setValue(showProps.title ?? '');
      contentInputRef.current?.setValue(showProps.content ?? '');

      const formData = LocalFormCache.getForm(formKey) as CaseNoteInput;
      if (
        formData &&
        formData.caseId === showProps.caseId &&
        (formData.title?.length > 0 || formData.content?.length > 0)
      ) {
        titleInputRef.current?.setValue(formData.title);
        contentInputRef.current?.setValue(formData.content);
      }

      if (modalRef.current?.show) {
        const showOptions = {
          openModalButtonRef: showProps.openModalButtonRef,
        };
        modalRef.current?.show(showOptions);
        toggleButtonOnDirtyForm();
      }
    }
  }

  function hide() {
    if (modalRef.current?.hide) {
      modalRef.current?.hide({});
    }
    setFormValuesFromShowOptions(null);
    setModalOpenOptions(defaultModalOpenOptions);
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
      modalId={noteModalId}
      className="note-modal"
      heading={noteModalTitle}
      actionButtonGroup={caseNoteFormButtonGroup}
      forceAction={true}
      content={
        <div className="case-note-form-container">
          <Alert
            id="case-note-form-error"
            message="An error occurred while submitting the case note."
            type={UswdsAlertStyle.Error}
            role={'alert'}
            ref={alertRef}
            timeout={0}
            slim={true}
            inline={true}
          />
          <Input
            id="case-note-title-input"
            label="Note Title"
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
        </div>
      }
    ></Modal>
  );
}

const CaseNoteModal = forwardRef(_CaseNoteModal);

export default CaseNoteModal;

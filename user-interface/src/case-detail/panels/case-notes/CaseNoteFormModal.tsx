import './CaseNoteFormModal.scss';

import Alert, { AlertDetails, AlertRefType, UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import Input from '@/lib/components/uswds/Input';
import Modal from '@/lib/components/uswds/modal/Modal';
import { ModalRefType, OpenModalButtonRef } from '@/lib/components/uswds/modal/modal-refs';
import { SubmitCancelBtnProps } from '@/lib/components/uswds/modal/SubmitCancelButtonGroup';
import TextArea from '@/lib/components/uswds/TextArea';
import Api2 from '@/lib/models/api2';
import { TextAreaRef } from '@/lib/type-declarations/input-fields';
import LocalFormCache from '@/lib/utils/local-form-cache';
import LocalStorage from '@/lib/utils/local-storage';
import HttpStatusCodes from '@common/api/http-status-codes';
import { ResponseBody } from '@common/api/response';
import { CaseNoteInput } from '@common/cams/cases';
import { getCamsUserReference } from '@common/cams/session';
import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react';

const useThrottleCallback = (callback: () => void, delay: number) => {
  const isThrottled = useRef(false);
  const savedCallback = useRef(callback);

  savedCallback.current = callback;

  return useCallback(() => {
    if (isThrottled.current) {
      return;
    }

    isThrottled.current = true;
    savedCallback.current();

    setTimeout(() => {
      isThrottled.current = false;
    }, delay);
  }, [delay]);
};

export type CaseNoteFormModalOpenProps = {
  callback: CallbackFunction;
  caseId: string;
  content?: string;
  id?: string;
  openModalButtonRef: OpenModalButtonRef;
  title?: string;
};

export type CaseNoteFormModalProps = {
  alertMessage?: AlertDetails;
  modalId: string;
};

export interface CaseNoteFormModalRef extends ModalRefType {
  hide: () => void;
  show: (showProps: CaseNoteFormModalOpenProps) => void;
}

type CallbackFunction = (noteId?: string) => void;

export function getCaseNotesInputValue(ref: null | TextAreaRef) {
  return ref?.getValue() ?? '';
}

function buildCaseNoteFormKey(caseId: string) {
  return `case-notes-${caseId}`;
}

const defaultModalOpenOptions: CaseNoteFormModalOpenProps = {
  callback: () => {},
  caseId: '',
  openModalButtonRef: {
    disableButton: (_state: boolean) => {},
    focus: () => {},
  },
};

function _CaseNoteFormModal(props: CaseNoteFormModalProps, ref: React.Ref<CaseNoteFormModalRef>) {
  const api = Api2;
  const noteModalId = 'case-note-form';

  const [formKey, setFormKey] = useState<string>('');
  const [modalOpenOptions, setModalOpenOptions] =
    useState<CaseNoteFormModalOpenProps>(defaultModalOpenOptions);
  const [noteModalTitle, setNoteModalTitle] = useState<string>('');
  const [cancelButtonLabel, setCancelButtonLabel] = useState<string>('');
  const [formValuesFromShowOptions, setFormValuesFromShowOptions] = useState<CaseNoteInput | null>(
    null,
  );
  const [caseNoteFormError, setCaseNoteFormError] = useState<string>('');
  const alertRef = useRef<AlertRefType>(null);

  const modalRef = useRef<ModalRefType>(null);
  const titleInputRef = useRef<TextAreaRef>(null);
  const contentInputRef = useRef<TextAreaRef>(null);
  const notesRequiredFieldsMessage = 'Title and content are both required inputs.';
  const notesSubmissionErrorMessage = 'There was a problem submitting the case note.';
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
      content: getCaseNotesInputValue(contentInputRef.current),
      title: event?.target.value,
    });
  }

  function handleContentChange(event: React.ChangeEvent<HTMLTextAreaElement>) {
    saveFormData({
      caseId: modalOpenOptions.caseId,
      content: event.target.value,
      title: getCaseNotesInputValue(titleInputRef.current),
    });
  }

  function clearCaseNoteForm() {
    titleInputRef.current?.clearValue();
    contentInputRef.current?.clearValue();
    LocalFormCache.clearForm(formKey);
    setCaseNoteFormError('');
    alertRef.current?.hide();
    toggleButtonOnDirtyForm();
  }

  function disableFormFields(disabled: boolean) {
    titleInputRef.current?.disable(disabled);
    contentInputRef.current?.disable(disabled);
    disableSubmitButton(disabled);
  }

  async function postCaseNote(caseNoteInput: CaseNoteInput) {
    disableSubmitButton(true);
    api
      .postCaseNote(caseNoteInput)
      .then(() => {
        modalOpenOptions.callback();
        setCaseNoteFormError('');
        alertRef.current?.hide();
        clearCaseNoteForm();
        hide();
      })
      .catch((e: ResponseBody) => {
        if (e.data !== HttpStatusCodes.FORBIDDEN) {
          setCaseNoteFormError(notesSubmissionErrorMessage);
          alertRef.current?.show();
        }
      })
      .finally(() => {
        disableFormFields(false);
        disableSubmitButton(false);
      });
  }

  async function putCaseNoteEdit(caseNoteInput: CaseNoteInput) {
    disableSubmitButton(true);
    api
      .putCaseNote(caseNoteInput)
      .then((noteId: string | undefined) => {
        modalOpenOptions.callback(noteId);
        clearCaseNoteForm();
        setCaseNoteFormError('');
        alertRef.current?.hide();
        hide();
      })
      .catch((e: ResponseBody) => {
        if (e.data !== HttpStatusCodes.FORBIDDEN) {
          setCaseNoteFormError(notesSubmissionErrorMessage);
          alertRef.current?.show();
        }
      })
      .finally(() => {
        disableFormFields(false);
        disableSubmitButton(false);
      });
  }

  function validFields(title: string, content: string) {
    if (title.length > 0 && content.length > 0) {
      setCaseNoteFormError('');
      alertRef.current?.hide();
      return true;
    } else {
      setCaseNoteFormError(notesRequiredFieldsMessage);
      return false;
    }
  }

  const sendCaseNoteToApi = useThrottleCallback(async () => {
    const title = getCaseNotesInputValue(titleInputRef.current);
    const content = getCaseNotesInputValue(contentInputRef.current);

    if (!modalOpenOptions.id && session?.user) {
      const caseNoteInput: CaseNoteInput = {
        caseId: modalOpenOptions.caseId,
        content,
        title,
        updatedBy: getCamsUserReference(session?.user),
      };
      return validFields(title, content)
        ? await postCaseNote(caseNoteInput)
        : alertRef.current?.show();
    } else if (modalOpenOptions.id && session?.user) {
      const caseNoteInput: CaseNoteInput = {
        caseId: modalOpenOptions.caseId,
        content,
        id: modalOpenOptions.id,
        title,
        updatedBy: getCamsUserReference(session?.user),
      };
      return validFields(title, content)
        ? await putCaseNoteEdit(caseNoteInput)
        : alertRef.current?.show();
    }
  }, 300);

  const caseNoteFormButtonGroup: SubmitCancelBtnProps = {
    cancelButton: {
      label: cancelButtonLabel,
      onClick: clearCaseNoteForm,
    },
    modalId: props.modalId,
    modalRef,
    submitButton: {
      closeOnClick: false,
      disabled: false,
      label: 'Save',
      onClick: sendCaseNoteToApi,
    },
  };

  function show(showProps: CaseNoteFormModalOpenProps) {
    setNoteModalTitle(`${showProps.id ? 'Edit' : 'Create'} Case Note`);
    setCancelButtonLabel(`${showProps.id ? 'Cancel' : 'Discard'}`);
    if (showProps) {
      const formKey = buildCaseNoteFormKey(showProps.caseId);
      setFormKey(formKey);
      setModalOpenOptions(showProps);
      setFormValuesFromShowOptions({
        caseId: showProps.caseId,
        content: showProps.content ?? '',
        title: showProps.title ?? '',
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
      hide,
      show,
    };
  });

  return (
    <Modal
      actionButtonGroup={caseNoteFormButtonGroup}
      className="note-modal"
      content={
        <div className="case-note-form-container">
          <Alert
            id="case-note-form-error"
            inline={true}
            message={caseNoteFormError}
            ref={alertRef}
            role={'alert'}
            slim={true}
            timeout={0}
            type={UswdsAlertStyle.Error}
          />
          <Input
            autoComplete="off"
            id="case-note-title-input"
            includeClearButton={true}
            label="Note Title"
            onChange={handleTitleChange}
            ref={titleInputRef}
            required={true}
          />
          <TextArea
            id="note-content"
            label="Note Text"
            onChange={handleContentChange}
            ref={contentInputRef}
            required={true}
          />
        </div>
      }
      forceAction={true}
      heading={noteModalTitle}
      modalId={noteModalId}
      ref={modalRef}
    ></Modal>
  );
}

const CaseNoteFormModal = forwardRef(_CaseNoteFormModal);

export default CaseNoteFormModal;

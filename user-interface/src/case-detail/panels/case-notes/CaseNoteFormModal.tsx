import './CaseNoteFormModal.scss';
import Alert, { AlertRefType, UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { ModalRefType, OpenModalButtonRef } from '@/lib/components/uswds/modal/modal-refs';
import Input from '@/lib/components/uswds/Input';
import Modal from '@/lib/components/uswds/modal/Modal';
import { SubmitCancelBtnProps } from '@/lib/components/uswds/modal/SubmitCancelButtonGroup';
import { InputRef, TextAreaRef } from '@/lib/type-declarations/input-fields';
import Api2 from '@/lib/models/api2';
import HttpStatusCodes from '@common/api/http-status-codes';
import { ResponseBody } from '@common/api/response';
import { CaseNoteInput } from '@common/cams/cases';
import { getCamsUserReference } from '@common/cams/session';
import LocalStorage from '@/lib/utils/local-storage';
import LocalFormCache from '@/lib/utils/local-form-cache';
import { DOMPURIFY_CONFIG, sanitizeText } from '@/lib/utils/sanitize-text';
import useFeatureFlags, { FORMAT_CASE_NOTES } from '@/lib/hooks/UseFeatureFlags';
import TextArea from '@/lib/components/uswds/TextArea';
import RichTextEditor, {
  RichTextEditorRef,
} from '@/lib/components/cams/RichTextEditor/RichTextEditor';
import DOMPurify from 'dompurify';

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

export function getCaseNotesTitleValue(ref: InputRef | null) {
  return sanitizeText(ref?.getValue() ?? '');
}

function getCaseNotesContentValue(ref: InputRef | null) {
  return sanitizeText(ref?.getValue() ?? '');
}

function getCaseNotesRichTextContentValue(ref: RichTextEditorRef | null) {
  const unsafeHtml = ref?.getHtml() ?? '';
  return DOMPurify.sanitize(unsafeHtml, DOMPURIFY_CONFIG);
}

export function buildCaseNoteFormKey(caseId: string, mode: CaseNoteFormMode, id: string) {
  const base = `case-notes-${caseId}`;
  const edit = mode === 'edit' ? `-${id}` : '';
  return `${base}${edit}`;
}

type CallbackFunction = (noteId?: string) => void;

export type CaseNoteFormMode = 'create' | 'edit';

export type CaseNoteFormModalOpenProps = {
  id?: string;
  title: string;
  content: string;
  caseId: string;
  callback: CallbackFunction;
  openModalButtonRef: OpenModalButtonRef;
  initialTitle: string;
  initialContent: string;
  mode: CaseNoteFormMode;
};

export interface CaseNoteFormModalRef extends ModalRefType {
  show: (showProps: CaseNoteFormModalOpenProps) => void;
  hide: () => void;
}

export type CaseNoteFormModalProps = {
  modalId: string;
  onModalClosed?: (caseId: string, mode: CaseNoteFormMode) => void;
  RichTextEditorRef?: React.RefObject<RichTextEditorRef | null>;
};

const defaultModalOpenOptions: CaseNoteFormModalOpenProps = {
  caseId: '',
  title: '',
  content: '',
  callback: () => {},
  openModalButtonRef: {
    focus: () => {},
    disableButton: (_state: boolean) => {},
  },
  initialTitle: '',
  initialContent: '',
  mode: 'create',
};

function CaseNoteFormModal_(props: CaseNoteFormModalProps, ref: React.Ref<CaseNoteFormModalRef>) {
  const api = Api2;
  const noteModalId = props.modalId || 'case-note-form-modal';
  const featureFlags = useFeatureFlags();

  const formKeyRef = useRef<string>('');
  const [modalOpenOptions, setModalOpenOptions] =
    useState<CaseNoteFormModalOpenProps>(defaultModalOpenOptions);
  const [noteModalTitle, setNoteModalTitle] = useState<string>('');
  const [cancelButtonLabel, setCancelButtonLabel] = useState<string>('');
  const [caseNoteFormError, setCaseNoteFormError] = useState<string>('');
  const [initialTitle, setInitialTitle] = useState<string>('');
  const [initialContent, setInitialContent] = useState<string>('');
  const [mode, setMode] = useState<CaseNoteFormMode>('create');
  const alertRef = useRef<AlertRefType>(null);

  const modalRef = useRef<ModalRefType>(null);
  const titleInputRef = useRef<TextAreaRef>(null);
  const contentInputRef = useRef<TextAreaRef>(null);
  const notesRequiredFieldsMessage = 'Title and content are both required inputs.';
  const notesSubmissionErrorMessage = 'There was a problem submitting the case note.';
  const session = LocalStorage.getSession();

  const richTextContentInputRef = useRef<RichTextEditorRef>(null);
  const richTextRef = props.RichTextEditorRef || richTextContentInputRef;

  function disableSubmitButton(disable: boolean) {
    const buttons = modalRef.current?.buttons;
    if (buttons?.current) {
      buttons.current.disableSubmitButton(disable);
    }
  }

  function toggleButtonOnDirtyForm(initialTitle: string, initialContent: string) {
    setTimeout(() => {
      const currentTitle = titleInputRef.current?.getValue();
      const hasTitle = !!currentTitle;
      const hasTitleChanged = initialTitle !== currentTitle;

      const currentContent = featureFlags[FORMAT_CASE_NOTES]
        ? richTextRef.current?.getHtml()
        : contentInputRef.current?.getValue();
      const hasContent = !(currentContent === '' || currentContent === '<p></p>');
      const hasContentChanged = initialContent !== currentContent;

      const isSavable = hasTitle && hasContent && (hasTitleChanged || hasContentChanged);
      disableSubmitButton(!isSavable);
    }, 10);
  }

  function saveFormData(data: CaseNoteInput) {
    if (formKeyRef.current && (data.title?.length > 0 || data.content?.length > 0)) {
      LocalFormCache.saveForm(formKeyRef.current, data);
    } else if (formKeyRef.current) {
      LocalFormCache.clearForm(formKeyRef.current);
    }
    toggleButtonOnDirtyForm(initialTitle, initialContent);
  }

  function handleTitleChange(event: React.ChangeEvent<HTMLInputElement>) {
    saveFormData({
      caseId: modalOpenOptions.caseId,
      title: event?.target.value,
      content: getCaseNotesContentValue(contentInputRef.current),
    });
  }

  function handleContentChange(event: React.ChangeEvent<HTMLTextAreaElement>) {
    saveFormData({
      caseId: modalOpenOptions.caseId,
      title: getCaseNotesTitleValue(titleInputRef.current),
      content: event.target.value,
    });
  }

  function handleRichTextContentChange(value: string) {
    saveFormData({
      caseId: modalOpenOptions.caseId,
      title: getCaseNotesTitleValue(titleInputRef.current),
      content: value,
    });
  }

  function clearCaseNoteForm() {
    titleInputRef.current?.clearValue();
    if (featureFlags[FORMAT_CASE_NOTES]) {
      richTextRef.current?.clearValue();
    } else {
      contentInputRef.current?.clearValue();
    }
    LocalFormCache.clearForm(formKeyRef.current);

    setCaseNoteFormError('');
    alertRef.current?.hide();
    toggleButtonOnDirtyForm(initialTitle, initialContent);
  }

  function disableFormFields(disabled: boolean) {
    titleInputRef.current?.disable(disabled);
    if (featureFlags[FORMAT_CASE_NOTES]) {
      richTextRef.current?.disable(disabled);
    } else {
      contentInputRef.current?.disable(disabled);
    }
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
    let title = getCaseNotesTitleValue(titleInputRef.current);
    let content = getCaseNotesContentValue(contentInputRef.current);
    if (featureFlags[FORMAT_CASE_NOTES]) {
      title = getCaseNotesTitleValue(titleInputRef.current);
      content = getCaseNotesRichTextContentValue(richTextRef.current);
    }

    if (mode === 'create' && session?.user) {
      const caseNoteInput: CaseNoteInput = {
        caseId: modalOpenOptions.caseId,
        title,
        content,
        updatedBy: getCamsUserReference(session?.user),
      };
      return validFields(title, content)
        ? await postCaseNote(caseNoteInput)
        : alertRef.current?.show();
    } else if (mode === 'edit' && modalOpenOptions.id && session?.user) {
      const caseNoteInput: CaseNoteInput = {
        id: modalOpenOptions.id,
        caseId: modalOpenOptions.caseId,
        title,
        content,
        updatedBy: getCamsUserReference(session?.user),
      };
      return validFields(title, content)
        ? await putCaseNoteEdit(caseNoteInput)
        : alertRef.current?.show();
    }
  }, 300);

  const caseNoteFormButtonGroup: SubmitCancelBtnProps = {
    modalId: props.modalId,
    modalRef,
    submitButton: {
      label: 'Save',
      onClick: sendCaseNoteToApi,
      disabled: true,
      closeOnClick: false,
    },
    cancelButton: {
      label: cancelButtonLabel,
      onClick: () => {
        clearCaseNoteForm();
        hide();
      },
    },
  };

  function show(showProps: CaseNoteFormModalOpenProps) {
    setNoteModalTitle(`${showProps.mode === 'edit' ? 'Edit' : 'Create'} Case Note`);
    setMode(showProps.mode);
    setCancelButtonLabel(`${showProps.mode === 'edit' ? 'Cancel' : 'Discard'}`);

    const formKey = buildCaseNoteFormKey(showProps.caseId, showProps.mode, showProps.id ?? '');
    formKeyRef.current = formKey;
    setModalOpenOptions(showProps);
    setInitialTitle(showProps.initialTitle);
    setInitialContent(showProps.initialContent);
    titleInputRef.current?.setValue(showProps.title ?? '');

    if (featureFlags[FORMAT_CASE_NOTES]) {
      richTextRef.current?.setValue(showProps.content ?? '');
    } else {
      contentInputRef.current?.setValue(showProps.content ?? '');
    }

    if (modalRef.current?.show) {
      const showOptions = {
        openModalButtonRef: showProps.openModalButtonRef,
      };
      modalRef.current?.show(showOptions);
      toggleButtonOnDirtyForm(showProps.initialTitle, showProps.initialContent);
    }
  }

  function hide() {
    if (modalRef.current?.hide) {
      modalRef.current?.hide({});
    }

    if (modalOpenOptions.caseId && props.onModalClosed) {
      props.onModalClosed(modalOpenOptions.caseId, mode);
    }

    setModalOpenOptions(defaultModalOpenOptions);
  }

  useImperativeHandle(ref, () => {
    return {
      show,
      hide,
    };
  });

  useEffect(() => {
    disableSubmitButton(true);
  }, []);

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
            message={caseNoteFormError}
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
          {featureFlags[FORMAT_CASE_NOTES] ? (
            <RichTextEditor
              id="case-note-editor"
              label="Note Text"
              required={true}
              onChange={handleRichTextContentChange}
              ref={props.RichTextEditorRef || richTextContentInputRef}
            />
          ) : (
            <TextArea
              id="note-content"
              label="Note Text"
              required={true}
              onChange={handleContentChange}
              ref={contentInputRef}
            />
          )}
        </div>
      }
    ></Modal>
  );
}

const CaseNoteFormModal = forwardRef(CaseNoteFormModal_);
export default CaseNoteFormModal;

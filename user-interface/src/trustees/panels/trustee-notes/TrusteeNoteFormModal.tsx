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
import { TrusteeNoteInput } from '@common/cams/trustee-notes';
import { getCamsUserReference } from '@common/cams/session';
import LocalStorage from '@/lib/utils/local-storage';
import LocalFormCache from '@/lib/utils/local-form-cache';
import { DOMPURIFY_CONFIG, sanitizeText } from '@/lib/utils/sanitize-text';
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

export function getTrusteeNotesTitleValue(ref: InputRef | null) {
  return sanitizeText(ref?.getValue() ?? '');
}

function getTrusteeNotesRichTextContentValue(ref: RichTextEditorRef | null) {
  const unsafeHtml = ref?.getHtml() ?? '';
  return DOMPurify.sanitize(unsafeHtml, DOMPURIFY_CONFIG);
}

export function buildTrusteeNoteFormKey(trusteeId: string, mode: TrusteeNoteFormMode, id: string) {
  const base = `trustee-notes-${trusteeId}`;
  const edit = mode === 'edit' ? `-${id}` : '';
  return `${base}${edit}`;
}

type CallbackFunction = (noteId?: string) => void;

export type TrusteeNoteFormMode = 'create' | 'edit';

export type TrusteeNoteFormModalOpenProps = {
  id?: string;
  title: string;
  content: string;
  trusteeId: string;
  callback: CallbackFunction;
  openModalButtonRef: OpenModalButtonRef;
  initialTitle: string;
  initialContent: string;
  mode: TrusteeNoteFormMode;
};

export interface TrusteeNoteFormModalRef extends ModalRefType {
  show: (showProps: TrusteeNoteFormModalOpenProps) => void;
  hide: () => void;
}

type TrusteeNoteFormModalProps = {
  modalId: string;
  onModalClosed?: (trusteeId: string, mode: TrusteeNoteFormMode) => void;
  RichTextEditorRef?: React.RefObject<RichTextEditorRef | null>;
};

const defaultModalOpenOptions: TrusteeNoteFormModalOpenProps = {
  trusteeId: '',
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

function TrusteeNoteFormModal_(
  props: TrusteeNoteFormModalProps,
  ref: React.Ref<TrusteeNoteFormModalRef>,
) {
  const api = Api2;
  const noteModalId = props.modalId || 'trustee-note-form-modal';

  const formKeyRef = useRef<string>('');
  const [modalOpenOptions, setModalOpenOptions] =
    useState<TrusteeNoteFormModalOpenProps>(defaultModalOpenOptions);
  const [noteModalTitle, setNoteModalTitle] = useState<string>('');
  const [cancelButtonLabel, setCancelButtonLabel] = useState<string>('');
  const [trusteeNoteFormError, setTrusteeNoteFormError] = useState<string>('');
  const [initialTitle, setInitialTitle] = useState<string>('');
  const [initialContent, setInitialContent] = useState<string>('');
  const [mode, setMode] = useState<TrusteeNoteFormMode>('create');
  const alertRef = useRef<AlertRefType>(null);

  const modalRef = useRef<ModalRefType>(null);
  const titleInputRef = useRef<TextAreaRef>(null);
  const notesRequiredFieldsMessage = 'Title and content are both required inputs.';
  const notesSubmissionErrorMessage = 'There was a problem submitting the trustee note.';
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

      const currentContent = richTextRef.current?.getHtml();
      const hasContent = !(currentContent === '' || currentContent === '<p></p>');
      const hasContentChanged = initialContent !== currentContent;

      const isSavable = hasTitle && hasContent && (hasTitleChanged || hasContentChanged);
      disableSubmitButton(!isSavable);
    }, 10);
  }

  function saveFormData(data: TrusteeNoteInput) {
    if (formKeyRef.current && (data.title?.length > 0 || data.content?.length > 0)) {
      LocalFormCache.saveForm(formKeyRef.current, data);
    } else if (formKeyRef.current) {
      LocalFormCache.clearForm(formKeyRef.current);
    }
    toggleButtonOnDirtyForm(initialTitle, initialContent);
  }

  function updateFormCache() {
    saveFormData({
      trusteeId: modalOpenOptions.trusteeId,
      title: titleInputRef.current?.getValue() ?? '',
      content: richTextRef.current?.getHtml() ?? '',
    });
  }

  function clearTrusteeNoteForm() {
    titleInputRef.current?.clearValue();
    richTextRef.current?.clearValue();
    LocalFormCache.clearForm(formKeyRef.current);

    setTrusteeNoteFormError('');
    alertRef.current?.hide();
    toggleButtonOnDirtyForm(initialTitle, initialContent);
  }

  function disableFormFields(disabled: boolean) {
    titleInputRef.current?.disable(disabled);
    richTextRef.current?.disable(disabled);
    disableSubmitButton(disabled);
  }

  async function postTrusteeNote(trusteeNoteInput: TrusteeNoteInput) {
    disableSubmitButton(true);
    api
      .postTrusteeNote(trusteeNoteInput)
      .then(() => {
        modalOpenOptions.callback();
        setTrusteeNoteFormError('');
        alertRef.current?.hide();
        clearTrusteeNoteForm();
        hide();
      })
      .catch((e: ResponseBody) => {
        if (e.data !== HttpStatusCodes.FORBIDDEN) {
          setTrusteeNoteFormError(notesSubmissionErrorMessage);
          alertRef.current?.show();
        }
      })
      .finally(() => {
        disableFormFields(false);
        disableSubmitButton(false);
      });
  }

  async function putTrusteeNoteEdit(trusteeNoteInput: TrusteeNoteInput) {
    disableSubmitButton(true);
    api
      .putTrusteeNote(trusteeNoteInput)
      .then((noteId: string | undefined) => {
        modalOpenOptions.callback(noteId);
        clearTrusteeNoteForm();
        setTrusteeNoteFormError('');
        alertRef.current?.hide();
        hide();
      })
      .catch((e: ResponseBody) => {
        if (e.data !== HttpStatusCodes.FORBIDDEN) {
          setTrusteeNoteFormError(notesSubmissionErrorMessage);
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
      setTrusteeNoteFormError('');
      alertRef.current?.hide();
      return true;
    } else {
      setTrusteeNoteFormError(notesRequiredFieldsMessage);
      return false;
    }
  }

  const sendTrusteeNoteToApi = useThrottleCallback(async () => {
    const title = getTrusteeNotesTitleValue(titleInputRef.current);
    const content = getTrusteeNotesRichTextContentValue(richTextRef.current);

    if (mode === 'create' && session?.user) {
      const trusteeNoteInput: TrusteeNoteInput = {
        trusteeId: modalOpenOptions.trusteeId,
        title,
        content,
        updatedBy: getCamsUserReference(session?.user),
      };
      return validFields(title, content)
        ? await postTrusteeNote(trusteeNoteInput)
        : alertRef.current?.show();
    } else if (mode === 'edit' && modalOpenOptions.id && session?.user) {
      const trusteeNoteInput: TrusteeNoteInput = {
        id: modalOpenOptions.id,
        trusteeId: modalOpenOptions.trusteeId,
        title,
        content,
        updatedBy: getCamsUserReference(session?.user),
      };
      return validFields(title, content)
        ? await putTrusteeNoteEdit(trusteeNoteInput)
        : alertRef.current?.show();
    }
  }, 300);

  const trusteeNoteFormButtonGroup: SubmitCancelBtnProps = {
    modalId: props.modalId,
    modalRef,
    submitButton: {
      label: 'Save',
      onClick: sendTrusteeNoteToApi,
      disabled: true,
      closeOnClick: false,
    },
    cancelButton: {
      label: cancelButtonLabel,
      onClick: () => {
        clearTrusteeNoteForm();
        hide();
      },
    },
  };

  function show(showProps: TrusteeNoteFormModalOpenProps) {
    setNoteModalTitle(`${showProps.mode === 'edit' ? 'Edit' : 'Create'} Trustee Note`);
    setMode(showProps.mode);
    setCancelButtonLabel(`${showProps.mode === 'edit' ? 'Cancel' : 'Discard'}`);

    const formKey = buildTrusteeNoteFormKey(
      showProps.trusteeId,
      showProps.mode,
      showProps.id ?? '',
    );
    formKeyRef.current = formKey;
    setModalOpenOptions(showProps);
    setInitialTitle(showProps.initialTitle);
    setInitialContent(showProps.initialContent);
    titleInputRef.current?.setValue(showProps.title ?? '');
    richTextRef.current?.setValue(showProps.content ?? '');

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
      modalRef.current?.hide();
    }

    if (modalOpenOptions.trusteeId && props.onModalClosed) {
      props.onModalClosed(modalOpenOptions.trusteeId, mode);
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
      actionButtonGroup={trusteeNoteFormButtonGroup}
      forceAction={true}
      content={
        <div className="trustee-note-form-container">
          <Alert
            id="trustee-note-form-error"
            message={trusteeNoteFormError}
            type={UswdsAlertStyle.Error}
            role={'alert'}
            ref={alertRef}
            timeout={0}
            slim={true}
            inline={true}
          />
          <Input
            id="trustee-note-title-input"
            label="Note Title"
            required={true}
            includeClearButton={true}
            onChange={updateFormCache}
            autoComplete="off"
            ref={titleInputRef}
          />
          <RichTextEditor
            id="trustee-note-editor"
            label="Note Text"
            required={true}
            onChange={updateFormCache}
            ref={props.RichTextEditorRef || richTextContentInputRef}
          />
        </div>
      }
    ></Modal>
  );
}

const TrusteeNoteFormModal = forwardRef(TrusteeNoteFormModal_);
export default TrusteeNoteFormModal;

import './NoteFormModal.scss';
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
import LocalFormCache from '@/lib/utils/local-form-cache';
import { DOMPURIFY_CONFIG, sanitizeText } from '@/lib/utils/sanitize-text';
import RichTextEditor, {
  RichTextEditorRef,
} from '@/lib/components/cams/RichTextEditor/RichTextEditor';
import DOMPurify from 'dompurify';
import { NoteInput } from './types';

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

function getNotesTitleValue(ref: InputRef | null) {
  return sanitizeText(ref?.getValue() ?? '');
}

function getNotesRichTextContentValue(ref: RichTextEditorRef | null) {
  const unsafeHtml = ref?.getHtml() ?? '';
  return DOMPurify.sanitize(unsafeHtml, DOMPURIFY_CONFIG);
}

type NoteFormMode = 'create' | 'edit';

export type NoteFormModalOpenProps = {
  id?: string;
  entityId: string;
  title: string;
  content: string;
  mode: NoteFormMode;
  cacheKey: string;
  openModalButtonRef: OpenModalButtonRef;
  initialTitle: string;
  initialContent: string;
};

export interface NoteFormModalRef extends ModalRefType {
  show: (showProps: NoteFormModalOpenProps) => void;
  hide: () => void;
}

type NoteFormModalProps = {
  modalId: string;
  onSave: (noteData: NoteInput) => Promise<void>;
  onModalClosed?: () => void;
  RichTextEditorRef?: React.RefObject<RichTextEditorRef | null>;
};

const defaultModalOpenOptions: NoteFormModalOpenProps = {
  entityId: '',
  title: '',
  content: '',
  cacheKey: '',
  mode: 'create',
  openModalButtonRef: {
    focus: () => {},
    disableButton: (_state: boolean) => {},
  },
  initialTitle: '',
  initialContent: '',
};

function NoteFormModal_(props: NoteFormModalProps, ref: React.Ref<NoteFormModalRef>) {
  const noteModalId = props.modalId || 'note-form-modal';

  const formKeyRef = useRef<string>('');
  const [modalOpenOptions, setModalOpenOptions] =
    useState<NoteFormModalOpenProps>(defaultModalOpenOptions);
  const [noteModalTitle, setNoteModalTitle] = useState<string>('');
  const [cancelButtonLabel, setCancelButtonLabel] = useState<string>('');
  const [noteFormError, setNoteFormError] = useState<string>('');
  const [initialTitle, setInitialTitle] = useState<string>('');
  const [initialContent, setInitialContent] = useState<string>('');
  const [mode, setMode] = useState<NoteFormMode>('create');
  const alertRef = useRef<AlertRefType>(null);

  const modalRef = useRef<ModalRefType>(null);
  const titleInputRef = useRef<TextAreaRef>(null);
  const notesRequiredFieldsMessage = 'Title and content are both required inputs.';
  const notesSubmissionErrorMessage = 'There was a problem submitting the note.';

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

  function saveFormData(data: NoteInput) {
    if (formKeyRef.current && (data.title?.length > 0 || data.content?.length > 0)) {
      LocalFormCache.saveForm(formKeyRef.current, data);
    } else if (formKeyRef.current) {
      LocalFormCache.clearForm(formKeyRef.current);
    }
    toggleButtonOnDirtyForm(initialTitle, initialContent);
  }

  function updateFormCache() {
    saveFormData({
      entityId: modalOpenOptions.entityId,
      title: titleInputRef.current?.getValue() ?? '',
      content: richTextRef.current?.getHtml() ?? '',
    });
  }

  function clearNoteForm() {
    titleInputRef.current?.clearValue();
    richTextRef.current?.clearValue();
    LocalFormCache.clearForm(formKeyRef.current);

    setNoteFormError('');
    alertRef.current?.hide();
    toggleButtonOnDirtyForm(initialTitle, initialContent);
  }

  function disableFormFields(disabled: boolean) {
    titleInputRef.current?.disable(disabled);
    richTextRef.current?.disable(disabled);
    disableSubmitButton(disabled);
  }

  async function saveNote(noteInput: NoteInput) {
    disableSubmitButton(true);
    try {
      await props.onSave(noteInput);
      setNoteFormError('');
      alertRef.current?.hide();
      clearNoteForm();
      hide();
    } catch (_error) {
      setNoteFormError(notesSubmissionErrorMessage);
      alertRef.current?.show();
    } finally {
      disableFormFields(false);
      disableSubmitButton(false);
    }
  }

  function validFields(title: string, content: string) {
    if (title.length > 0 && content.length > 0) {
      setNoteFormError('');
      alertRef.current?.hide();
      return true;
    } else {
      setNoteFormError(notesRequiredFieldsMessage);
      return false;
    }
  }

  const sendNoteToApi = useThrottleCallback(async () => {
    const title = getNotesTitleValue(titleInputRef.current);
    const content = getNotesRichTextContentValue(richTextRef.current);

    if (!validFields(title, content)) {
      alertRef.current?.show();
      return;
    }

    const noteInput: NoteInput = {
      entityId: modalOpenOptions.entityId,
      title,
      content,
    };

    if (mode === 'edit' && modalOpenOptions.id) {
      noteInput.id = modalOpenOptions.id;
    }

    await saveNote(noteInput);
  }, 300);

  const noteFormButtonGroup: SubmitCancelBtnProps = {
    modalId: props.modalId,
    modalRef,
    submitButton: {
      label: 'Save',
      onClick: sendNoteToApi,
      disabled: true,
      closeOnClick: false,
    },
    cancelButton: {
      label: cancelButtonLabel,
      onClick: () => {
        clearNoteForm();
        hide();
      },
    },
  };

  function show(showProps: NoteFormModalOpenProps) {
    setNoteModalTitle(`${showProps.mode === 'edit' ? 'Edit' : 'Create'} Note`);
    setMode(showProps.mode);
    setCancelButtonLabel(`${showProps.mode === 'edit' ? 'Cancel' : 'Discard'}`);

    formKeyRef.current = showProps.cacheKey;
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

    if (props.onModalClosed) {
      props.onModalClosed();
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
      actionButtonGroup={noteFormButtonGroup}
      forceAction={true}
      content={
        <div className="note-form-container">
          <Alert
            id="note-form-error"
            message={noteFormError}
            type={UswdsAlertStyle.Error}
            role={'alert'}
            ref={alertRef}
            timeout={0}
            slim={true}
            inline={true}
          />
          <Input
            id="note-title-input"
            label="Note Title"
            required={true}
            includeClearButton={true}
            onChange={updateFormCache}
            autoComplete="off"
            ref={titleInputRef}
          />
          <RichTextEditor
            id="note-editor"
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

const NoteFormModal = forwardRef(NoteFormModal_);
export default NoteFormModal;

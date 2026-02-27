import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import TrusteeNoteFormModal, {
  TrusteeNoteFormModalRef,
  TrusteeNoteFormModalOpenProps,
  buildTrusteeNoteFormKey,
  getTrusteeNotesTitleValue,
} from './TrusteeNoteFormModal';
import React from 'react';
import { randomUUID } from 'crypto';
import { InputRef } from '@/lib/type-declarations/input-fields';
import MockData from '@common/cams/test-utilities/mock-data';
import LocalStorage from '@/lib/utils/local-storage';
import Api2 from '@/lib/models/api2';
import { RichTextEditorRef } from '@/lib/components/cams/RichTextEditor/RichTextEditor';

vi.mock('@/lib/components/cams/RichTextEditor/RichTextEditor', async () => {
  const { forwardRef, useRef, useImperativeHandle } = await import('react');
  return {
    default: forwardRef(function MockRichTextEditor(_props: unknown, ref: React.Ref<unknown>) {
      const content = useRef('<p></p>');
      useImperativeHandle(ref, () => ({
        getHtml: () => content.current,
        setValue: (v: string) => {
          content.current = v;
        },
        clearValue: () => {
          content.current = '';
        },
        disable: () => {},
      }));
      return null;
    }),
  };
});

const trusteeId = randomUUID();
const modalRef = React.createRef<TrusteeNoteFormModalRef>();
const modalId = 'trustee-note-form-modal-test';

function getSubmitButton() {
  return screen.getByTestId(`button-${modalId}-submit-button`);
}

function getCancelButton() {
  return screen.getByTestId(`button-${modalId}-cancel-button`);
}

const defaultShowProps: TrusteeNoteFormModalOpenProps = {
  trusteeId,
  title: 'My Title',
  content: '<p>Some content</p>',
  callback: vi.fn(),
  openModalButtonRef: { focus: vi.fn(), disableButton: vi.fn() },
  initialTitle: '',
  initialContent: '',
  mode: 'create',
};

describe('TrusteeNoteFormModal', () => {
  beforeEach(() => {
    vi.spyOn(LocalStorage, 'getSession').mockReturnValue(MockData.getCamsSession());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('should render modal without throwing', () => {
    expect(() => render(<TrusteeNoteFormModal ref={modalRef} modalId={modalId} />)).not.toThrow();
  });

  test('buildTrusteeNoteFormKey returns correct key for create mode', () => {
    const key = buildTrusteeNoteFormKey(trusteeId, 'create', '');
    expect(key).toBe(`trustee-notes-${trusteeId}`);
  });

  test('buildTrusteeNoteFormKey returns correct key for edit mode', () => {
    const noteId = randomUUID();
    const key = buildTrusteeNoteFormKey(trusteeId, 'edit', noteId);
    expect(key).toBe(`trustee-notes-${trusteeId}-${noteId}`);
  });

  test('getTrusteeNotesTitleValue returns empty string for null ref', () => {
    expect(getTrusteeNotesTitleValue(null)).toBe('');
  });

  test('getTrusteeNotesTitleValue sanitizes value from ref', () => {
    const mockRef: InputRef = {
      getValue: () => 'My Title',
      setValue: vi.fn(),
      clearValue: vi.fn(),
      resetValue: vi.fn(),
      disable: vi.fn(),
      focus: vi.fn(),
    };
    expect(getTrusteeNotesTitleValue(mockRef)).toBe('My Title');
  });

  test('should show "Create Trustee Note" heading in create mode', async () => {
    render(<TrusteeNoteFormModal ref={modalRef} modalId={modalId} />);

    act(() => {
      modalRef.current?.show(defaultShowProps);
    });

    await waitFor(() => {
      expect(screen.queryByText('Create Trustee Note')).toBeInTheDocument();
    });
  });

  test('should show "Edit Trustee Note" heading in edit mode', async () => {
    render(<TrusteeNoteFormModal ref={modalRef} modalId={modalId} />);

    act(() => {
      modalRef.current?.show({
        ...defaultShowProps,
        id: randomUUID(),
        mode: 'edit',
        initialTitle: 'My Title',
        initialContent: '<p>Some content</p>',
      });
    });

    await waitFor(() => {
      expect(screen.queryByText('Edit Trustee Note')).toBeInTheDocument();
    });
  });

  test('should call onModalClosed with trusteeId and mode when hide is called after show', async () => {
    const onModalClosed = vi.fn();
    render(<TrusteeNoteFormModal ref={modalRef} modalId={modalId} onModalClosed={onModalClosed} />);

    act(() => {
      modalRef.current?.show(defaultShowProps);
    });

    await waitFor(() => {
      expect(screen.queryByText('Create Trustee Note')).toBeInTheDocument();
    });

    modalRef.current?.hide();

    expect(onModalClosed).toHaveBeenCalledWith(trusteeId, 'create');
  });

  test('should not call onModalClosed when hide is called without a prior show', () => {
    const onModalClosed = vi.fn();
    render(<TrusteeNoteFormModal ref={modalRef} modalId={modalId} onModalClosed={onModalClosed} />);

    modalRef.current?.hide();

    expect(onModalClosed).not.toHaveBeenCalled();
  });

  test('should call onModalClosed when cancel button is clicked', async () => {
    const onModalClosed = vi.fn();
    render(<TrusteeNoteFormModal ref={modalRef} modalId={modalId} onModalClosed={onModalClosed} />);

    act(() => {
      modalRef.current?.show(defaultShowProps);
    });

    await waitFor(() => {
      expect(screen.queryByText('Create Trustee Note')).toBeInTheDocument();
    });

    fireEvent.click(getCancelButton());

    expect(onModalClosed).toHaveBeenCalledWith(trusteeId, 'create');
  });

  test('should call postTrusteeNote when create form submitted with valid data', async () => {
    const callback = vi.fn();
    const postSpy = vi.spyOn(Api2, 'postTrusteeNote').mockResolvedValue();
    const richTextRef = React.createRef<RichTextEditorRef | null>();

    render(
      <TrusteeNoteFormModal ref={modalRef} modalId={modalId} RichTextEditorRef={richTextRef} />,
    );

    act(() => {
      modalRef.current?.show({ ...defaultShowProps, callback });
    });

    await waitFor(() => expect(getSubmitButton()).not.toBeDisabled());

    fireEvent.click(getSubmitButton());

    await waitFor(() => {
      expect(postSpy).toHaveBeenCalledWith(
        expect.objectContaining({ trusteeId, title: 'My Title' }),
      );
      expect(callback).toHaveBeenCalled();
    });
  });

  test('should show validation error when submitted with empty content', async () => {
    vi.spyOn(Api2, 'postTrusteeNote').mockResolvedValue();
    const richTextRef = React.createRef<RichTextEditorRef | null>();

    render(
      <TrusteeNoteFormModal ref={modalRef} modalId={modalId} RichTextEditorRef={richTextRef} />,
    );

    act(() => {
      modalRef.current?.show(defaultShowProps);
    });

    // Wait for button to enable with valid title+content
    await waitFor(() => expect(getSubmitButton()).not.toBeDisabled());

    // Clear content via the ref so validFields gets empty content
    act(() => {
      richTextRef.current?.clearValue();
    });

    fireEvent.click(getSubmitButton());

    await waitFor(() => {
      expect(screen.queryByText('Title and content are both required inputs.')).toBeInTheDocument();
    });
  });

  test('should show error message when postTrusteeNote fails', async () => {
    vi.spyOn(Api2, 'postTrusteeNote').mockRejectedValue({ data: undefined });
    const richTextRef = React.createRef<RichTextEditorRef | null>();

    render(
      <TrusteeNoteFormModal ref={modalRef} modalId={modalId} RichTextEditorRef={richTextRef} />,
    );

    act(() => {
      modalRef.current?.show(defaultShowProps);
    });

    await waitFor(() => expect(getSubmitButton()).not.toBeDisabled());

    fireEvent.click(getSubmitButton());

    await waitFor(() => {
      expect(
        screen.queryByText('There was a problem submitting the trustee note.'),
      ).toBeInTheDocument();
    });
  });

  test('should call putTrusteeNote when edit form submitted with valid data', async () => {
    const callback = vi.fn();
    const noteId = randomUUID();
    const putSpy = vi.spyOn(Api2, 'putTrusteeNote').mockResolvedValue(noteId);
    const richTextRef = React.createRef<RichTextEditorRef | null>();

    render(
      <TrusteeNoteFormModal ref={modalRef} modalId={modalId} RichTextEditorRef={richTextRef} />,
    );

    act(() => {
      modalRef.current?.show({
        ...defaultShowProps,
        id: noteId,
        mode: 'edit',
        callback,
        initialTitle: 'Old Title',
        initialContent: '<p>old</p>',
      });
    });

    await waitFor(() => expect(getSubmitButton()).not.toBeDisabled());

    fireEvent.click(getSubmitButton());

    await waitFor(() => {
      expect(putSpy).toHaveBeenCalledWith(
        expect.objectContaining({ id: noteId, trusteeId, title: 'My Title' }),
      );
      expect(callback).toHaveBeenCalledWith(noteId);
    });
  });

  test('should show error message when putTrusteeNote fails', async () => {
    const noteId = randomUUID();
    vi.spyOn(Api2, 'putTrusteeNote').mockRejectedValue({ data: undefined });
    const richTextRef = React.createRef<RichTextEditorRef | null>();

    render(
      <TrusteeNoteFormModal ref={modalRef} modalId={modalId} RichTextEditorRef={richTextRef} />,
    );

    act(() => {
      modalRef.current?.show({
        ...defaultShowProps,
        id: noteId,
        mode: 'edit',
        initialTitle: 'Old Title',
        initialContent: '<p>old</p>',
      });
    });

    await waitFor(() => expect(getSubmitButton()).not.toBeDisabled());

    fireEvent.click(getSubmitButton());

    await waitFor(() => {
      expect(
        screen.queryByText('There was a problem submitting the trustee note.'),
      ).toBeInTheDocument();
    });
  });
});

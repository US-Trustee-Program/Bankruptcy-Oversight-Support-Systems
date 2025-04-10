import { ModalRefType } from '@/lib/components/uswds/modal/modal-refs';
import { Controls, Store } from './AssignAttorneyModal.types';
import assignAttorneyModalUseCase from './assignAttorneyModalUseCase';
import { ChangeEvent } from 'react';

type RectProps = {
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
  width?: number;
  height?: number;
  x?: number;
  y?: number;
  toJSON?: () => void;
};

const screenTop = 100;
const screenBottom = 500;
const initialScrollTop = 0;

const buildBoundingClientRect = (props: RectProps = {}): DOMRect => {
  return {
    top: screenTop,
    bottom: screenBottom,
    left: 100,
    right: 500,
    width: 400,
    height: 400,
    x: 100,
    y: 100,
    toJSON: () => '',
    ...props,
  };
};

function useAssignAttorneyModalControlsMock(): Controls {
  const modalRef: React.RefObject<ModalRefType> = {
    current: {
      show: () => {},
      hide: () => {},
      buttons: {
        current: {
          disableSubmitButton: (_state: boolean) => {},
        },
      },
    },
  };

  const tableContainerRef: React.RefObject<HTMLDivElement> = {
    current: {
      getBoundingClientRect: () => buildBoundingClientRect(),
      scrollTop: initialScrollTop,
    } as Partial<HTMLDivElement> as HTMLDivElement,
  };

  return {
    modalRef,
    tableContainerRef,
  };
}

const mockControls = useAssignAttorneyModalControlsMock();
const mockStore: Store = {
  bCase: null,
  setBCase: vi.fn(),
  initialDocumentBodyStyle: '',
  setInitialDocumentBodyStyle: vi.fn(),
  checkListValues: [],
  setCheckListValues: vi.fn(),
  previouslySelectedList: [],
  setPreviouslySelectedList: vi.fn(),
  isUpdatingAssignment: false,
  setIsUpdatingAssignment: vi.fn(),
  attorneyList: [],
  setAttorneyList: vi.fn(),
  submissionCallback: null,
  setSubmissionCallback: vi.fn(),
  globalAlertError: undefined,
  setGlobalAlertError: vi.fn(),
};

const useCase = assignAttorneyModalUseCase(mockStore, mockControls);

describe('assignAttorneyModalUseCase tests', () => {
  test.skip('', async () => {
    //
  });

  describe('test handleFocus', () => {
    test('handleFocus should scroll input element into view if the input is above the visible screen', async () => {
      const mockInput = document.createElement('input');
      mockInput.getBoundingClientRect = () =>
        buildBoundingClientRect({
          top: screenTop - 150,
          bottom: screenTop - 120,
        });

      const mockEvent = {
        target: mockInput,
      };

      mockControls.tableContainerRef.current!.scrollTop = 100;

      useCase.handleFocus(
        mockEvent as Partial<React.FocusEvent<HTMLElement>> as React.FocusEvent<HTMLElement>,
      );

      expect(mockControls.tableContainerRef.current!.scrollTop).toEqual(150);
    });

    test('handleFocus should scroll input element into view if the input is below the visible screen', async () => {
      const mockInput = document.createElement('input');
      mockInput.getBoundingClientRect = () =>
        buildBoundingClientRect({
          top: screenBottom + 100,
          bottom: screenBottom + 130,
        });

      const mockEvent = {
        target: mockInput,
      };

      mockControls.tableContainerRef.current!.scrollTop = 0;

      useCase.handleFocus(
        mockEvent as Partial<React.FocusEvent<HTMLElement>> as React.FocusEvent<HTMLElement>,
      );

      expect(mockControls.tableContainerRef.current!.scrollTop).toEqual(140);
    });

    test('handleFocus should not scroll if input element is within the visible screen', async () => {
      const mockInput = document.createElement('input');
      mockInput.getBoundingClientRect = () =>
        buildBoundingClientRect({
          top: screenTop + 100,
          bottom: screenBottom - 100,
        });

      const mockEvent = {
        target: mockInput,
      };

      mockControls.tableContainerRef.current!.scrollTop = 50;

      useCase.handleFocus(
        mockEvent as Partial<React.FocusEvent<HTMLElement>> as React.FocusEvent<HTMLElement>,
      );

      expect(mockControls.tableContainerRef.current!.scrollTop).toEqual(50);
    });
  });

  test('sortAttorneys should return -1 if a < b, 1 if a > b, and 0 if they are equal', () => {
    const a = {
      id: '1',
      name: 'a',
    };

    const b = {
      id: '0',
      name: 'b',
    };

    expect(useCase.sortAttorneys(a, a)).toEqual(0);
    expect(useCase.sortAttorneys(a, b)).toEqual(-1);
    expect(useCase.sortAttorneys(b, a)).toEqual(1);
  });

  test('submitValues should throw an error when no case is supplied.', async () => {
    expect(useCase.submitValues(() => {})).rejects.toThrow(
      'No bankruptcy case was supplied. Can not set attorneys without a case.',
    );
  });

  test('updateCheckList should throw an error when no case is supplied.', async () => {
    const mockInput = document.createElement('input');
    const mockEvent = {
      target: mockInput,
    } as Partial<ChangeEvent<HTMLInputElement>> as ChangeEvent<HTMLInputElement>;
    const mockUser = {
      id: '0',
      name: 'bob',
    };

    expect(() => useCase.updateCheckList(mockEvent, mockUser)).toThrow(
      'No bankruptcy case was supplied. Can not update checklist without a case.',
    );
  });

  const tabTestProps = [
    {
      _label: 'should',
      shouldHaveFocus: true,
      keyName: 'Tab',
      shiftKey: false,
      isVisible: true,
      className: 'usa-modal__close',
    },
    {
      _label: 'should not',
      shouldHaveFocus: false,
      keyName: 'Enter',
      shiftKey: false,
      isVisible: true,
      className: 'usa-modal__close',
    },
    {
      _label: 'should not',
      shouldHaveFocus: false,
      keyName: 'Tab',
      shiftKey: true,
      isVisible: true,
      className: 'usa-modal__close',
    },
    {
      _label: 'should not',
      shouldHaveFocus: false,
      keyName: 'Tab',
      shiftKey: false,
      isVisible: false,
      className: 'usa-modal__close',
    },
    {
      _label: 'should not',
      shouldHaveFocus: false,
      keyName: 'Tab',
      shiftKey: false,
      isVisible: true,
      className: 'bad_button',
    },
  ];

  test.each(tabTestProps)(
    'pressing the tab key %s focus on the next element in a list of attorneys',
    async ({ _label, shouldHaveFocus, keyName, shiftKey, isVisible, className }) => {
      const modalId = 'test-id';

      // Setup the DOM
      document.body.innerHTML = `
      <button class="bad_button" />
      <button class="usa-modal__close" />
      <button id="${modalId}-description" />
    `;

      const closeButton: HTMLButtonElement = document.querySelector(
        `.${className}`,
      ) as HTMLButtonElement;
      const descriptionButton: HTMLButtonElement = document.querySelector(
        `#${modalId}-description`,
      ) as HTMLButtonElement;

      // Initially focus on the close button
      closeButton!.focus();

      // Create the native tab event
      const tabEvent = new KeyboardEvent('keydown', {
        key: keyName,
        shiftKey,
        keyCode: 9,
        code: keyName,
        which: 9,
        altKey: false, // No Alt key
        ctrlKey: false, // No Ctrl key
        metaKey: false, // No Meta key
        bubbles: true, // Event can bubble up
        cancelable: true, // Event can be cancelled
      });

      // Mock React's KeyboardEvent and extend the native event
      const reactTabEvent = {
        ...tabEvent, // Spread the tab event properties from native event
        target: closeButton, // Set the target element
        nativeEvent: tabEvent, // Set nativeEvent as the original tabEvent
        isDefaultPrevented: () => false, // Mock method to return false (no default action prevented)
        isPropagationStopped: () => false, // Mock method to return false (event not stopped)
        persist: () => {}, // Mock persist method (no-op)
        locale: '',
        key: keyName,
        shiftKey,
      } as unknown as React.KeyboardEvent; // Cast to React's KeyboardEvent type

      // Call handleTab with the mocked React.KeyboardEvent
      useCase.handleTab(reactTabEvent, isVisible, modalId);

      if (shouldHaveFocus) {
        expect(descriptionButton).toHaveFocus();
      } else {
        expect(descriptionButton).not.toHaveFocus();
      }
    },
    10000,
  );
});

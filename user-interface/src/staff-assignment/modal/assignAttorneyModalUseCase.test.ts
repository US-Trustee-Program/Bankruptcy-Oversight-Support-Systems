import { ModalRefType } from '@/lib/components/uswds/modal/modal-refs';
import { ChangeEvent } from 'react';

import { AssignAttorneyModalControls, AssignAttorneyModalStore } from './assignAttorneyModal.types';
import assignAttorneyModalUseCase from './assignAttorneyModalUseCase';

type RectProps = {
  bottom?: number;
  height?: number;
  left?: number;
  right?: number;
  toJSON?: () => void;
  top?: number;
  width?: number;
  x?: number;
  y?: number;
};

const screenTop = 100;
const screenBottom = 500;
const initialScrollTop = 0;

const buildBoundingClientRect = (props: RectProps = {}): DOMRect => {
  return {
    bottom: screenBottom,
    height: 400,
    left: 100,
    right: 500,
    toJSON: () => '',
    top: screenTop,
    width: 400,
    x: 100,
    y: 100,
    ...props,
  };
};

function useAssignAttorneyModalControlsMock(): AssignAttorneyModalControls {
  const modalRef: React.RefObject<ModalRefType> = {
    current: {
      buttons: {
        current: {
          disableSubmitButton: (_state: boolean) => {},
        },
      },
      hide: () => {},
      show: () => {},
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
const mockStore: AssignAttorneyModalStore = {
  attorneyList: [],
  bCase: null,
  checkListValues: [],
  globalAlertError: undefined,
  initialDocumentBodyStyle: '',
  isUpdatingAssignment: false,
  previouslySelectedList: [],
  setAttorneyList: vi.fn(),
  setBCase: vi.fn(),
  setCheckListValues: vi.fn(),
  setGlobalAlertError: vi.fn(),
  setInitialDocumentBodyStyle: vi.fn(),
  setIsUpdatingAssignment: vi.fn(),
  setPreviouslySelectedList: vi.fn(),
  setSubmissionCallback: vi.fn(),
  submissionCallback: null,
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
          bottom: screenTop - 120,
          top: screenTop - 150,
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
          bottom: screenBottom + 130,
          top: screenBottom + 100,
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
          bottom: screenBottom - 100,
          top: screenTop + 100,
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
      className: 'usa-modal__close',
      isVisible: true,
      keyName: 'Tab',
      shiftKey: false,
      shouldHaveFocus: true,
    },
    {
      _label: 'should not',
      className: 'usa-modal__close',
      isVisible: true,
      keyName: 'Enter',
      shiftKey: false,
      shouldHaveFocus: false,
    },
    {
      _label: 'should not',
      className: 'usa-modal__close',
      isVisible: true,
      keyName: 'Tab',
      shiftKey: true,
      shouldHaveFocus: false,
    },
    {
      _label: 'should not',
      className: 'usa-modal__close',
      isVisible: false,
      keyName: 'Tab',
      shiftKey: false,
      shouldHaveFocus: false,
    },
    {
      _label: 'should not',
      className: 'bad_button',
      isVisible: true,
      keyName: 'Tab',
      shiftKey: false,
      shouldHaveFocus: false,
    },
  ];

  test.each(tabTestProps)(
    'pressing the tab key %s focus on the next element in a list of attorneys',
    async ({ _label, className, isVisible, keyName, shiftKey, shouldHaveFocus }) => {
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
        altKey: false, // No Alt key
        bubbles: true, // Event can bubble up
        cancelable: true, // Event can be cancelled
        code: keyName,
        ctrlKey: false, // No Ctrl key
        key: keyName,
        keyCode: 9,
        metaKey: false, // No Meta key
        shiftKey,
        which: 9,
      });

      // Mock React's KeyboardEvent and extend the native event
      const reactTabEvent = {
        ...tabEvent, // Spread the tab event properties from native event
        isDefaultPrevented: () => false, // Mock method to return false (no default action prevented)
        isPropagationStopped: () => false, // Mock method to return false (event not stopped)
        key: keyName,
        locale: '',
        nativeEvent: tabEvent, // Set nativeEvent as the original tabEvent
        persist: () => {}, // Mock persist method (no-op)
        shiftKey,
        target: closeButton, // Set the target element
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

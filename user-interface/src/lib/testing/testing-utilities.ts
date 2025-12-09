/* eslint-disable @typescript-eslint/no-explicit-any */
import { CamsRole } from '@common/cams/roles';
import MockData from '@common/cams/test-utilities/mock-data';
import LocalStorage from '../utils/local-storage';
import { GlobalAlertRef } from '../components/cams/GlobalAlert/GlobalAlert';
import * as globalAlertHook from '@/lib/hooks/UseGlobalAlert';
import { CamsUser } from '@common/cams/users';
import * as UseStateModule from '@/lib/hooks/UseState';
import { waitFor, fireEvent, screen } from '@testing-library/react';
import userEvent, { UserEvent } from '@testing-library/user-event';
import { delay } from '@common/delay';

export type CamsUserEvent = Omit<UserEvent, 'setup'>;

async function nonReactWaitFor(
  condition: () => boolean,
  timeout = 5000,
  interval = 50,
): Promise<void> {
  const startTime = Date.now();

  return new Promise((resolve, reject) => {
    const checkCondition = () => {
      if (condition()) {
        resolve();
      } else if (Date.now() - startTime >= timeout) {
        reject(new Error('waitFor timed out'));
      } else {
        delay(interval, checkCondition);
      }
    };

    checkCondition();
  });
}

function setUser(override: Partial<CamsUser> = {}) {
  const user = MockData.getCamsUser(override);
  LocalStorage.setSession(MockData.getCamsSession({ user }));
  return user;
}

function setUserWithRoles(roles: CamsRole[]) {
  const user = MockData.getCamsUser({ roles });
  LocalStorage.setSession(MockData.getCamsSession({ user }));
  return user;
}

function spyOnGlobalAlert() {
  const hookFunctions: GlobalAlertRef = {
    show: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    success: vi.fn(),
  };
  vi.spyOn(globalAlertHook, 'useGlobalAlert').mockReturnValue(hookFunctions);
  return hookFunctions;
}

const useStateMock: any = (initialValue: any) => {
  // Credit: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set#implementing_basic_set_operations
  function difference(setA: Set<string>, setB: Set<string>) {
    const _difference = new Set(setA);
    for (const elem of setB) {
      _difference.delete(elem);
    }
    return _difference as Set<string>;
  }

  let value = typeof initialValue === 'object' ? { ...initialValue } : initialValue;
  return [
    value,
    <T = any>(newValue: T) => {
      if (typeof value === 'object') {
        const existingKeys = new Set([...Object.keys(value)]);
        const newKeys = new Set([...Object.keys(value)]);
        difference(existingKeys, newKeys).forEach((key) => {
          delete value[key];
        });
        Object.keys(newValue as object).forEach((key) => {
          value[key] = (newValue as Record<string, any>)[key];
        });
      } else {
        value = newValue;
      }
    },
  ];
};

function spyOnUseState() {
  return vi.spyOn(UseStateModule, 'useState').mockImplementation(useStateMock);
}

async function selectCheckbox(id: string) {
  const checkbox = document.querySelector(`#checkbox-${id}`);
  if (checkbox) {
    const checkboxLabelButton = document.querySelector(`#checkbox-${id}-click-target`);
    if (checkboxLabelButton) {
      await userEvent.click(checkboxLabelButton);
    }
  }
  return checkbox;
}

function selectRadio(id: string) {
  const radio = document.querySelector(`#radio-${id}`);
  if (radio) {
    const radioLabelButton = document.querySelector(`#radio-${id}-click-target`);
    if (radioLabelButton) {
      fireEvent.click(radioLabelButton);
    }
  }
  return radio;
}

async function clearComboBoxSelection(id: string) {
  const clearButton = document.querySelector(`#${id}-clear-all`);
  if (clearButton) {
    await userEvent.click(clearButton);
  } else {
    throw new Error(`Clear button not found for ComboBox with id: ${id}`);
  }
}

async function toggleComboBoxItemSelection(id: string, itemIndex: number = 0, selected = true) {
  const itemListContainer = document.querySelector(`#${id}-item-list-container`);
  if (!itemListContainer!.classList.contains('expanded')) {
    const expandButton = document.querySelector(`#${id}-expand`);
    await userEvent.click(expandButton!);
  }

  const testId = `${id}-option-item-${itemIndex}`;

  await vi.waitFor(() => {
    expect(screen.getByTestId(testId)).toBeVisible();
  });

  const listItem = screen.getByTestId(testId);

  await userEvent.click(listItem);
  await vi.waitFor(() => {
    if (selected) {
      expect(listItem).toHaveClass('selected');
    } else {
      expect(listItem).not.toHaveClass('selected');
    }
  });
}

async function waitForDocumentBody() {
  await waitFor(() => expect(document.body).toBeDefined());
}

function setupUserEvent(): CamsUserEvent {
  const { setup: _, ...camsUserEvent } = userEvent.setup();
  return camsUserEvent;
}

const TestingUtilities = {
  nonReactWaitFor,
  setUser,
  setUserWithRoles,
  spyOnGlobalAlert,
  spyOnUseState,
  selectCheckbox,
  selectRadio,
  toggleComboBoxItemSelection,
  clearComboBoxSelection,
  waitForDocumentBody,
  setupUserEvent,
};

export default TestingUtilities;

/* eslint-disable @typescript-eslint/no-explicit-any */
import { CamsRole } from '@common/cams/roles';
import MockData from '@common/cams/test-utilities/mock-data';
import LocalStorage from '../utils/local-storage';
import { GlobalAlertRef } from '../components/cams/GlobalAlert/GlobalAlert';
import * as globalAlertHook from '@/lib/hooks/UseGlobalAlert';
import { CamsUser } from '@common/cams/users';
import * as UseStateModule from '@/lib/hooks/UseState';
import { fireEvent } from '@testing-library/react';

async function waitFor(condition: () => boolean, timeout = 5000, interval = 50): Promise<void> {
  const startTime = Date.now();

  return new Promise((resolve, reject) => {
    const checkCondition = () => {
      if (condition()) {
        resolve();
      } else if (Date.now() - startTime >= timeout) {
        reject(new Error('waitFor timed out'));
      } else {
        setTimeout(checkCondition, interval);
      }
    };

    checkCondition();
  });
}

async function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

function selectCheckbox(id: string) {
  const checkbox = document.querySelector(`#checkbox-${id}`);
  if (checkbox) {
    const checkboxLabelButton = document.querySelector(`#checkbox-${id}-click-target`);
    if (checkboxLabelButton) fireEvent.click(checkboxLabelButton);
  }
  return checkbox;
}

function selectRadio(id: string) {
  const radio = document.querySelector(`#radio-${id}`);
  if (radio) {
    const radioLabelButton = document.querySelector(`#radio-${id}-click-target`);
    if (radioLabelButton) fireEvent.click(radioLabelButton);
  }
  return radio;
}

async function selectComboBoxItem(id: string, itemIndex: number = 0) {
  const itemListContainer = document.querySelector(`#${id}-item-list-container`);
  if (!itemListContainer!.classList.contains('expanded')) {
    const expandButton = document.querySelector(`#${id}-expand`);
    fireEvent.click(expandButton!);
  }

  const listItem = document.querySelector(`[data-testid=${id}-item-${itemIndex}]`);
  expect(listItem as HTMLElement).toBeVisible();

  const listItemButton = document.querySelector(`[data-testid=${id}-option-item-${itemIndex}]`);
  expect(listItemButton).toBeVisible();

  fireEvent.click(listItemButton as Element);
  await vi.waitFor(() => {
    expect(listItem).toHaveClass('selected');
  });
}

export const TestingUtilities = {
  waitFor,
  delay,
  setUser,
  setUserWithRoles,
  spyOnGlobalAlert,
  spyOnUseState,
  selectCheckbox,
  selectRadio,
  selectComboBoxItem,
};

export default TestingUtilities;

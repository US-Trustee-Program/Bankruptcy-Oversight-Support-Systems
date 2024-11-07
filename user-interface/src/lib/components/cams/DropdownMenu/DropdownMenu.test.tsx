import { fireEvent, render, waitFor } from '@testing-library/react';
import { DropdownMenu, MenuItem } from './DropdownMenu';
import { faker } from '@faker-js/faker';
import { BrowserRouter } from 'react-router-dom';
import userEvent from '@testing-library/user-event';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('DropdownMenu component tests', () => {
  const menuItems: MenuItem[] = [
    {
      id: 'menu-item-test-menu-0',
      label: 'Item 0',
      address: faker.internet.url(),
    },
    {
      id: 'menu-item-test-menu-1',
      label: 'Item 1',
      address: faker.internet.url(),
    },
    {
      id: 'menu-item-test-menu-2',
      label: 'Item 2',
      address: faker.internet.url(),
    },
    {
      id: 'menu-item-test-menu-3',
      label: 'Item 3',
      address: faker.internet.url(),
    },
  ];

  function renderMenu() {
    render(
      <BrowserRouter>
        <button id="test-button-0">Test Button 0</button>
        <DropdownMenu id="test-menu" menuItems={menuItems}>
          Test Menu
        </DropdownMenu>
        <button id="test-button-1">Test Button 1</button>
      </BrowserRouter>,
    );
  }

  function focusMenu() {
    const menu = document.querySelector('#test-menu');
    if (menu) {
      (menu as HTMLElement).focus();
      return menu;
    }
  }

  test('Menu should expand when pressing Enter key', async () => {
    renderMenu();

    const menu = focusMenu();
    expect(menu!.getAttribute('aria-expanded')).toBe('false');

    fireEvent.click(menu!);

    await waitFor(() => {
      expect(menu!.getAttribute('aria-expanded')).toBe('true');
    });
  });

  test('If expanded, then pressing Tab should focus on first menu item.  Pressing tab again should focus on each menu item in turn, followed by next item outside of menu.', async () => {
    renderMenu();
    const item1 = document.querySelector('#menu-item-test-menu-0 a');
    const item2 = document.querySelector('#menu-item-test-menu-1 a');
    const item3 = document.querySelector('#menu-item-test-menu-2 a');
    const item4 = document.querySelector('#menu-item-test-menu-3 a');
    const button = document.querySelector('button#test-button-1');

    const menu = focusMenu();
    await waitFor(() => {
      expect(menu!.getAttribute('aria-expanded')).toBe('false');
    });
    //fireEvent.keyDown(menu!, { key: 'Enter' });
    userEvent.click(menu!);
    await delay(1000);
    expect(menu!.getAttribute('aria-expanded')).toBe('true');

    userEvent.tab();
    //fireEvent.keyDown(menu!, { key: 'ArrowDown' });
    await delay(1000);
    expect(menu!.getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement).toBe(item1);
    console.log(`Focus after 1st tab: ${document.activeElement?.id}`);

    userEvent.tab();
    //fireEvent.keyDown(item1!, { key: 'ArrowDown' });
    await delay(500);
    expect(document.activeElement).toBe(item2);
    await waitFor(() => {
      expect(document.activeElement).toBe(item2);
      console.log(`Focus after 2nd tab: ${document.activeElement?.id}`);
    });

    userEvent.tab();
    await delay(100);
    await waitFor(() => {
      expect(document.activeElement).toBe(item3);
      console.log(`Focus after 3rd tab: ${document.activeElement?.id}`);
    });

    userEvent.tab();
    await delay(100);
    await waitFor(() => {
      expect(document.activeElement).toBe(item4);
      console.log(`Focus after 4th tab: ${document.activeElement?.id}`);
    });

    userEvent.tab();
    await delay(100);
    await waitFor(() => {
      expect(document.activeElement).toBe(button);
      console.log(`Focus after 5th tab: ${document.activeElement?.id}`);
    });

    expect(menu!.getAttribute('aria-expanded')).toBe('false');
  });

  test('If expanded, then pressing Shift-Tab should close menu and focus on previous item on page.', async () => {
    renderMenu();
    const button = document.querySelector('button#test-button-0');

    const menu = focusMenu();
    await waitFor(() => {
      expect(menu!.getAttribute('aria-expanded')).toBe('false');
    });
    userEvent.click(menu!);
    await delay(100);
    expect(menu!.getAttribute('aria-expanded')).toBe('true');

    userEvent.tab({ shift: true });
    await delay(100);
    expect(menu!.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(button);
  });

  test('If expanded, then pressing Down Arrow should focus on first menu item.  Pressing down arrow again should focus on each menu item in turn. If the last item was already focused, then the menu should close and closed menu, being the parent of items, should receive focus.', async () => {
    renderMenu();
    const item1 = document.querySelector('#menu-item-test-menu-0 a');
    const item2 = document.querySelector('#menu-item-test-menu-1 a');
    const item3 = document.querySelector('#menu-item-test-menu-2 a');
    const item4 = document.querySelector('#menu-item-test-menu-3 a');

    const menu = focusMenu();
    await waitFor(() => {
      expect(menu!.getAttribute('aria-expanded')).toBe('false');
    });
    userEvent.click(menu!);
    await delay(100);
    expect(menu!.getAttribute('aria-expanded')).toBe('true');

    userEvent.keyboard('{ArrowDown}');
    await delay(100);
    expect(document.activeElement).toBe(item1);

    userEvent.keyboard('{ArrowDown}');
    await delay(100);
    expect(document.activeElement).toBe(item2);

    userEvent.keyboard('{ArrowDown}');
    await delay(100);
    expect(document.activeElement).toBe(item3);

    userEvent.keyboard('{ArrowDown}');
    await delay(100);
    expect(document.activeElement).toBe(item4);

    userEvent.keyboard('{ArrowDown}');
    await delay(100);
    expect(document.activeElement).toBe(menu);
    expect(menu!.getAttribute('aria-expanded')).toBe('false');
  });

  test('If expanded, and menu item is focused, then pressing Escape should close menu and closed menu, being the parent of items, should receive focus.', async () => {
    //
  });
});

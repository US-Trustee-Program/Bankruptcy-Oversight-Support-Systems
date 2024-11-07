import { render } from '@testing-library/react';
import { DropdownMenu, MenuItem } from './DropdownMenu';
import { faker } from '@faker-js/faker';
import { BrowserRouter } from 'react-router-dom';
import userEvent from '@testing-library/user-event';

describe('DropdownMenu component tests', () => {
  const menuId = 'test-menu';
  let menu: HTMLElement;
  let item1: HTMLElement;
  let item2: HTMLElement;
  let item3: HTMLElement;
  let item4: HTMLElement;
  let button0: HTMLElement;
  let button1: HTMLElement;
  const clickFn = vi.fn();
  const menuItems: MenuItem[] = [
    {
      label: 'Item 0',
      address: faker.internet.url(),
    },
    {
      label: 'Item 1',
      address: faker.internet.url(),
    },
    {
      label: 'Item 2',
      address: faker.internet.url(),
    },
    {
      label: 'Item 3',
      address: faker.internet.url(),
    },
  ];

  function renderMenu() {
    render(
      <BrowserRouter>
        <button id="test-button-0">Test Button 0</button>
        <DropdownMenu id={menuId} menuItems={menuItems} onClick={clickFn}>
          Test Menu
        </DropdownMenu>
        <button id="test-button-1">Test Button 1</button>
      </BrowserRouter>,
    );
  }

  beforeEach(() => {
    renderMenu();
    menu = document.querySelector(`#${menuId}`) as HTMLElement;
    item1 = document.querySelector(`#menu-link-${menuId}-0`) as HTMLElement;
    item2 = document.querySelector(`#menu-link-${menuId}-1`) as HTMLElement;
    item3 = document.querySelector(`#menu-link-${menuId}-2`) as HTMLElement;
    item4 = document.querySelector(`#menu-link-${menuId}-3`) as HTMLElement;
    button0 = document.querySelector(`#test-button-0`) as HTMLElement;
    button1 = document.querySelector(`#test-button-1`) as HTMLElement;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test('Menu should expand when pressing Enter key', async () => {
    menu.focus();
    expect(menu.getAttribute('aria-expanded')).toBe('false');

    await userEvent.click(menu);
    expect(menu.getAttribute('aria-expanded')).toBe('true');
  });

  test('If expanded, then pressing Tab should focus on first menu item.  Pressing tab again should focus on next item outside of menu and close menu.', async () => {
    const user = userEvent.setup();
    expect(menu.getAttribute('aria-expanded')).toBe('false');

    menu.focus();
    await user.keyboard('{Enter}');
    expect(menu.getAttribute('aria-expanded')).toBe('true');

    await user.tab();
    expect(menu.getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement).toBe(item1);

    await user.tab();
    expect(document.activeElement).toBe(button1);
    expect(menu.getAttribute('aria-expanded')).toBe('false');
  });

  test('If expanded, then pressing Shift-Tab should close menu and focus on previous item on page.', async () => {
    expect(menu.getAttribute('aria-expanded')).toBe('false');

    await userEvent.click(menu);
    expect(menu.getAttribute('aria-expanded')).toBe('true');

    await userEvent.tab({ shift: true });
    expect(menu.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(button0);
  });

  test('If expanded, then pressing Down Arrow should focus on first menu item.  Pressing down arrow again should focus on each menu item in turn. If the last item was already focused, then the menu should close and closed menu, being the parent of items, should receive focus.', async () => {
    const user = userEvent.setup();

    expect(menu.getAttribute('aria-expanded')).toBe('false');
    menu.focus();

    await user.keyboard('{Enter}');
    expect(menu!.getAttribute('aria-expanded')).toBe('true');

    await user.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(item1);

    await user.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(item2);

    await user.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(item3);

    await user.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(item4);

    await user.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(menu);
    expect(menu!.getAttribute('aria-expanded')).toBe('false');
  });

  test('If expanded, and last item is focused, then pressing Up Arrow should focus on each item above in sequence until reaching the top.  Pressing up arrow again should close menu, and focus on the menu.', async () => {
    const user = userEvent.setup();

    await user.click(menu);
    item4.focus();
    expect(document.activeElement).toBe(item4);

    await user.keyboard('{ArrowUp}');
    expect(document.activeElement).toBe(item3);

    await user.keyboard('{ArrowUp}');
    expect(document.activeElement).toBe(item2);

    await user.keyboard('{ArrowUp}');
    expect(document.activeElement).toBe(item1);

    await user.keyboard('{ArrowUp}');
    expect(document.activeElement).toBe(menu);

    expect(menu.getAttribute('aria-expanded')).toBe('false');
  });

  test('If expanded, and menu item is focused, then pressing Escape should close menu and closed menu, being the parent of items, should receive focus.', async () => {
    expect(menu!.getAttribute('aria-expanded')).toBe('false');

    menu.focus();
    await userEvent.keyboard('{Enter}');
    expect(menu!.getAttribute('aria-expanded')).toBe('true');

    await userEvent.tab();
    expect(document.activeElement).toBe(item1);

    await userEvent.keyboard('{Escape}');
    expect(menu!.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(menu);
  });

  test('Should call click function onClick', async () => {
    await userEvent.click(menu);
    expect(clickFn).toHaveBeenCalled();
  });
});

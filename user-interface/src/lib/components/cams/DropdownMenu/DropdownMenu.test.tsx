import { render } from '@testing-library/react';
import { DropdownMenu, MenuItem } from './DropdownMenu';
import { BrowserRouter } from 'react-router-dom';
import LinkUtils from '../linkUtils';
import TestingUtilities, { CamsUserEvent } from '@/lib/testing/testing-utilities';

describe('DropdownMenu component tests', () => {
  const menuId = 'test-menu';
  let menu: HTMLElement;
  let item1: HTMLElement;
  let item2: HTMLElement;
  let item3: HTMLElement;
  let item4: HTMLElement;
  let button0: HTMLElement;
  let button1: HTMLElement;
  let userEvent: CamsUserEvent;

  const clickFn = vi.fn();
  const menuItems: MenuItem[] = [
    {
      label: 'A Item 0',
      address: '/test-address-0',
    },
    {
      label: 'b Item 1',
      address: '/test-address-1',
    },
    {
      label: 'c Item 2',
      address: '/test-address-2',
    },
    {
      label: '3 Item 3',
      address: '/test-address-3',
    },
  ];

  function renderMenu() {
    render(
      <BrowserRouter>
        <button id="test-button-0">Test Button 0</button>
        <DropdownMenu
          id={menuId}
          menuItems={menuItems}
          onClick={clickFn}
          ariaLabel={'Test Aria Label'}
        >
          Test Menu
        </DropdownMenu>
        <button id="test-button-1">Test Button 1</button>
      </BrowserRouter>,
    );
    menu = document.querySelector(`#${menuId}`) as HTMLElement;
    item1 = document.querySelector(`#menu-link-${menuId}-0`) as HTMLElement;
    item2 = document.querySelector(`#menu-link-${menuId}-1`) as HTMLElement;
    item3 = document.querySelector(`#menu-link-${menuId}-2`) as HTMLElement;
    item4 = document.querySelector(`#menu-link-${menuId}-3`) as HTMLElement;
    button0 = document.querySelector(`#test-button-0`) as HTMLElement;
    button1 = document.querySelector(`#test-button-1`) as HTMLElement;
  }

  beforeEach(() => {
    userEvent = TestingUtilities.setupUserEvent();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test('Menu should expand when clicking menu button, and focused item should be first menu item in list', async () => {
    renderMenu();
    menu.focus();
    expect(menu.getAttribute('aria-expanded')).toBe('false');

    await userEvent.click(menu);
    expect(menu.getAttribute('aria-expanded')).toBe('true');
    const firstItem: HTMLLinkElement | null = document.querySelector('ul li a');
    expect(firstItem).toHaveFocus();
  });

  test('Menu should expand when pressing Enter key, and focused item should be first menu item in list', async () => {
    renderMenu();
    menu.focus();
    expect(menu.getAttribute('aria-expanded')).toBe('false');

    await userEvent.keyboard('{Enter}');
    expect(menu.getAttribute('aria-expanded')).toBe('true');
    const firstItem: HTMLLinkElement | null = document.querySelector('ul li a');
    expect(firstItem).toHaveFocus();
  });

  test('Menu should expand when pressing Space key, and focused item should be first menu item in list', async () => {
    renderMenu();
    menu.focus();
    expect(menu.getAttribute('aria-expanded')).toBe('false');

    await userEvent.keyboard(' ');
    expect(menu.getAttribute('aria-expanded')).toBe('true');
    const firstItem: HTMLLinkElement | null = document.querySelector('ul li a');
    expect(firstItem).toHaveFocus();
  });

  test('Menu should have aria-controls="test-menu-item-list", aria-label, and aria-haspopup="menu" and UL should have role="menu", and LI should have role="menuitem"', () => {
    renderMenu();
    expect(menu).toHaveAttribute('aria-controls', `${menuId}-item-list`);
    expect(menu).toHaveAttribute('aria-label', 'Test Aria Label');
    expect(menu).toHaveAttribute('aria-haspopup', 'menu');
    const ul = document.querySelector('ul');
    expect(ul).toHaveAttribute('id', `${menuId}-item-list`);
    expect(ul).toHaveAttribute('role', 'menu');
    const menuItems = ul!.querySelectorAll('li');
    expect(menuItems.length).toEqual(4);
    if (menuItems)
      menuItems.forEach((item) => {
        expect(item).toHaveAttribute('role', 'menuitem');
      });
  });

  test('Menu should close when clicking outside of menu', async () => {
    renderMenu();
    await userEvent.click(menu);
    expect(menu.getAttribute('aria-expanded')).toBe('true');

    await userEvent.click(button0);
    expect(menu.getAttribute('aria-expanded')).toBe('false');
  });

  test('If expanded, then pressing Tab should focus on next item outside of menu and close menu.', async () => {
    renderMenu();
    expect(menu.getAttribute('aria-expanded')).toBe('false');

    menu.focus();
    await userEvent.keyboard('{Enter}');
    expect(menu.getAttribute('aria-expanded')).toBe('true');

    await userEvent.tab();
    expect(document.activeElement).toBe(button1);
    expect(menu.getAttribute('aria-expanded')).toBe('false');
  });

  test('If expanded, then pressing Shift-Tab should close menu and focus on menu.', async () => {
    renderMenu();
    expect(menu.getAttribute('aria-expanded')).toBe('false');

    await userEvent.click(menu);
    expect(menu.getAttribute('aria-expanded')).toBe('true');

    await userEvent.tab({ shift: true });
    expect(menu.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(menu);
  });

  test('If expanded, then pressing Down Arrow should focus on each menu item in turn. If the last item was already focused, then the first menu item should receive focus.', async () => {
    renderMenu();

    expect(menu.getAttribute('aria-expanded')).toBe('false');
    menu.focus();

    await userEvent.keyboard('{Enter}');
    expect(menu!.getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement).toBe(item1);

    await userEvent.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(item2);

    await userEvent.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(item3);

    await userEvent.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(item4);

    await userEvent.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(item1);
  });

  test('If expanded, and last item is focused, then pressing Up Arrow should focus on each item above in sequence until reaching the top.  Pressing up arrow again should focus on the last menu item in the list.', async () => {
    renderMenu();

    await userEvent.click(menu);
    item4.focus();
    expect(document.activeElement).toBe(item4);

    await userEvent.keyboard('{ArrowUp}');
    expect(document.activeElement).toBe(item3);

    await userEvent.keyboard('{ArrowUp}');
    expect(document.activeElement).toBe(item2);

    await userEvent.keyboard('{ArrowUp}');
    expect(document.activeElement).toBe(item1);

    await userEvent.keyboard('{ArrowUp}');
    expect(document.activeElement).toBe(item4);
  });

  test('If expanded, End key should jump to last item in list and Home key should jump to first item in list.', async () => {
    renderMenu();

    menu.focus();
    await userEvent.keyboard('{Enter}');
    expect(document.activeElement).toBe(item1);

    await userEvent.keyboard('{End}');
    expect(document.activeElement).toBe(item4);

    await userEvent.keyboard('{Home}');
    expect(document.activeElement).toBe(item1);
  });

  test('If expanded, pressing a letter or number should jump to the first menu item that starts with that letter', async () => {
    renderMenu();

    menu.focus();
    await userEvent.keyboard('{Enter}');
    expect(document.activeElement).toBe(item1);

    await userEvent.keyboard('3');
    expect(document.activeElement).toBe(item4);

    await userEvent.keyboard('b');
    expect(document.activeElement).toBe(item2);

    await userEvent.keyboard('a');
    expect(document.activeElement).toBe(item1);

    await userEvent.keyboard('c');
    expect(document.activeElement).toBe(item3);
  });

  test('If expanded, and menu item is focused, then pressing Escape should close menu and closed menu, being the parent of items, should receive focus.', async () => {
    renderMenu();
    expect(menu!.getAttribute('aria-expanded')).toBe('false');

    menu.focus();
    await userEvent.keyboard('{Enter}');
    expect(menu!.getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement).toBe(item1);

    await userEvent.keyboard('{Escape}');
    expect(menu!.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(menu);
  });

  test('Should call click function onClick', async () => {
    renderMenu();
    await userEvent.click(menu);
    expect(clickFn).toHaveBeenCalled();
  });

  describe('Test link activation', () => {
    beforeEach(() => {
      vi.spyOn(LinkUtils, 'executeLinkClick').mockImplementation((link: HTMLAnchorElement) => {
        const url = new URL(link.href);
        return url.pathname;
      });
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    test('Should follow link when Enter key is pressed', async () => {
      renderMenu();
      await userEvent.click(menu);
      expect(item1).toHaveFocus();
      await userEvent.keyboard('{Enter}');

      expect(LinkUtils.executeLinkClick).toHaveReturnedWith(menuItems[0].address);
    });

    test('Should follow link when Space key is pressed', async () => {
      renderMenu();
      await userEvent.click(menu);
      expect(item1).toHaveFocus();
      await userEvent.keyboard(' ');

      expect(LinkUtils.executeLinkClick).toHaveReturnedWith(menuItems[0].address);
    });
  });
});

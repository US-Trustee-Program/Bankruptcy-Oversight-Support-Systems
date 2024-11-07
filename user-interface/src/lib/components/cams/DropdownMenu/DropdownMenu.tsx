import './DropdownMenu.scss';
import { useEffect, useRef, useState } from 'react';
import { NavLink } from 'react-router-dom';

export type MenuItem = {
  label: string;
  address: string;
  title?: string;
  className?: string;
};

export type DropdownMenuProps = {
  id: string;
  children: React.ReactNode;
  menuItems: MenuItem[];
  className?: string;
  onClick?: () => void;
};

export function DropdownMenu(props: DropdownMenuProps) {
  const { id, menuItems, className, children } = props;
  const submenuItemCount = menuItems.length;

  const [expanded, setExpanded] = useState<boolean>(false);
  const [focus, setFocus] = useState<boolean>(false);

  const buttonRef = useRef<HTMLButtonElement>(null);

  function handleToggleExpand() {
    setExpanded(!expanded);
    if (props.onClick) props.onClick();
  }

  function handleMenuKeyDown(ev: React.KeyboardEvent) {
    if (ev.key === 'ArrowDown' && expanded === true) {
      const firstItem = document.querySelector(`#menu-link-${id}-0`);
      if (firstItem) (firstItem as HTMLLIElement).focus();
    } else if (expanded === true && ev.key === 'Tab' && ev.shiftKey === true) {
      handleToggleExpand();
    }
  }

  function handleSubItemKeyDown(ev: React.KeyboardEvent) {
    if (ev.key === 'Escape') {
      handleToggleExpand();
      setFocus(true);
    } else {
      const firstItem = document.querySelector(`#menu-link-${id}-0`);
      const lastItem = document.querySelector(`#menu-link-${id}-${submenuItemCount - 1}`);
      if (ev.key === 'ArrowDown') {
        if (ev.currentTarget === lastItem) {
          handleToggleExpand();
          setFocus(true);
        } else {
          const nextItem = ev.currentTarget.parentElement?.nextElementSibling;
          if (nextItem) (nextItem.children[0] as HTMLLIElement).focus();
        }
      } else if (ev.key === 'ArrowUp') {
        if (ev.currentTarget === firstItem) {
          handleToggleExpand();
          setFocus(true);
        } else {
          const previousItem = ev.currentTarget.parentElement?.previousElementSibling;
          if (previousItem) (previousItem.children[0] as HTMLLIElement).focus();
        }
      } else if (ev.key === 'Tab' && ev.shiftKey === false) {
        handleToggleExpand();
      }
    }
  }

  useEffect(() => {
    if (focus) {
      buttonRef.current?.focus();
      setFocus(false);
    }
  }, [focus]);

  return (
    <div className="cams-dropdown-menu">
      <button
        id={id}
        type="button"
        className={`usa-accordion__button usa-nav__link ${className ?? ''}`}
        onClick={handleToggleExpand}
        aria-expanded={expanded}
        aria-controls="user-submenu"
        onKeyDown={handleMenuKeyDown}
        ref={buttonRef}
      >
        <span>{children}</span>
      </button>
      <ul id={`${id}-item-list`} className={`usa-nav__submenu ${className}`} hidden={!expanded}>
        {menuItems.map((item, idx) => (
          <li
            id={`li-${id}-${idx}`}
            className={`usa-nav__submenu-item ${item.className ?? ''}`}
            key={idx}
          >
            <NavLink
              id={`menu-link-${id}-${idx}`}
              to={item.address}
              data-testid={`menu-item-${id}-${idx}`}
              className="usa-nav-link"
              title={item.title ?? ''}
              onKeyDown={handleSubItemKeyDown}
            >
              {item.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </div>
  );
}

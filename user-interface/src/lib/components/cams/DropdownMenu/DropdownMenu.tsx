import './DropdownMenu.scss';
import { useEffect, useRef, useState } from 'react';
import { NavLink } from 'react-router-dom';
import LinkUtils from '../linkUtils';

export type MenuItem = {
  label: string;
  address: string;
  title?: string;
  className?: string;
  target?: string;
};

type DropdownMenuProps = {
  id: string;
  children: React.ReactNode;
  menuItems: MenuItem[];
  className?: string;
  ariaLabel: string;
  onClick?: () => void;
};

export function DropdownMenu(props: DropdownMenuProps) {
  const { id, menuItems, className, children, ariaLabel } = props;
  const submenuItemCount = menuItems.length;

  const [expanded, setExpanded] = useState<boolean>(false);
  const [focus, setFocus] = useState<boolean>(false);

  const buttonRef = useRef<HTMLButtonElement>(null);

  function handleToggleExpand() {
    setExpanded(!expanded);
    if (props.onClick) {
      props.onClick();
    }
  }

  function handleClickOutside(ev: MouseEvent) {
    const itemList = document.getElementById(`${id}-item-list`);
    if (itemList && !itemList.contains(ev.target as Node)) {
      setExpanded(false);
    }
  }

  function handleSubItemKeyDown(ev: React.KeyboardEvent) {
    if (ev.key === 'Escape') {
      handleToggleExpand();
      setFocus(true);
    } else {
      const firstItem: HTMLLinkElement | null = document.querySelector(`#menu-link-${id}-0`);
      const lastItem: HTMLLinkElement | null = document.querySelector(
        `#menu-link-${id}-${submenuItemCount - 1}`,
      );
      if (ev.key === 'ArrowDown') {
        if (ev.currentTarget === lastItem) {
          if (firstItem) {
            firstItem.focus();
          }
        } else {
          const nextItem = ev.currentTarget.parentElement?.nextElementSibling;
          if (nextItem) {
            (nextItem.children[0] as HTMLLIElement).focus();
          }
        }
        ev.preventDefault();
      } else if (ev.key === 'ArrowUp') {
        if (ev.currentTarget === firstItem) {
          if (lastItem) {
            lastItem.focus();
          }
        } else {
          const previousItem = ev.currentTarget.parentElement?.previousElementSibling;
          if (previousItem) {
            (previousItem.children[0] as HTMLLIElement).focus();
          }
        }
        ev.preventDefault();
      } else if (ev.key === 'Home') {
        ev.preventDefault();
        if (firstItem) {
          firstItem.focus();
        }
      } else if (ev.key === 'End') {
        ev.preventDefault();
        if (lastItem) {
          lastItem.focus();
        }
      } else if (ev.key === 'Tab') {
        handleToggleExpand();
      } else if (ev.key === ' ' || ev.key === 'Enter') {
        LinkUtils.executeLinkClick(ev.currentTarget as HTMLAnchorElement);
      } else if (ev.key.length === 1) {
        const key = ev.key.toUpperCase();
        menuItems.forEach((item, index) => {
          if (item.label[0].toUpperCase() === key) {
            const menuItem: HTMLLinkElement | null = document.querySelector(
              `#menu-link-${id}-${index}`,
            );
            if (menuItem) {
              menuItem.focus();
            }
          }
        });
      }
    }
  }

  useEffect(() => {
    if (focus) {
      buttonRef.current?.focus();
      setFocus(false);
    }
  }, [focus]);

  useEffect(() => {
    if (expanded) {
      document.addEventListener('mousedown', handleClickOutside);

      // move focus to first item in list
      const firstItem: HTMLElement | null = document.querySelector(`#menu-link-${id}-0`);
      if (firstItem) {
        firstItem.focus();
      }
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [expanded]);

  return (
    <div className="cams-dropdown-menu">
      <button
        id={id}
        type="button"
        className={`usa-accordion__button usa-nav__link ${className ?? ''}`}
        onClick={handleToggleExpand}
        aria-expanded={expanded}
        aria-haspopup="menu"
        aria-controls={`${id}-item-list`}
        aria-label={ariaLabel}
        ref={buttonRef}
      >
        <span>{children}</span>
      </button>
      <ul
        id={`${id}-item-list`}
        className={`usa-nav__submenu ${className}`}
        hidden={!expanded}
        role="menu"
      >
        {menuItems.map((item, idx) => (
          <li
            id={`li-${id}-${idx}`}
            className={`usa-nav__submenu-item ${item.className ?? ''}`}
            role="menuitem"
            key={idx}
          >
            <NavLink
              id={`menu-link-${id}-${idx}`}
              to={item.address}
              data-testid={`menu-item-${id}-${idx}`}
              className="usa-nav-link"
              title={item.title ?? ''}
              target={item.target}
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

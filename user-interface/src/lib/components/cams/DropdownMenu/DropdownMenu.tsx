import { useEffect, useRef, useState } from 'react';
import { NavLink } from 'react-router-dom';

export type MenuItem = {
  id?: string;
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
  const submenuItemCount = menuItems.length - 1;

  const [expanded, setExpanded] = useState<boolean>(false);
  const [focus, setFocus] = useState<boolean>(false);

  const buttonRef = useRef<HTMLButtonElement>(null);

  function handleToggleExpand() {
    setExpanded(!expanded);
    if (props.onClick) props.onClick();
  }

  function handleMenuKeyDown(ev: React.KeyboardEvent) {
    if (ev.key === 'ArrowDown' && expanded === true) {
      const firstItem = document.querySelector(`#menu-item-${id}-0`);
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
      const lastItem = document.querySelector(`#menu-item-${id}-${submenuItemCount}`);
      if (ev.key === 'ArrowDown') {
        if (ev.target === lastItem) {
          handleToggleExpand();
          setFocus(true);
        } else {
          const nextItem = document.querySelector(`#menu-item-${id}-${submenuItemCount + 1}`);
          if (nextItem) (nextItem as HTMLLIElement).focus();
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
    <>
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
      <ul id="user-submenu" className={`usa-nav__submenu ${className}`} hidden={!expanded}>
        {menuItems.map((item, idx) => (
          <li id={item.id ?? ''} className={`usa-nav__submenu-item ${item.className}`} key={idx}>
            <NavLink
              id={`menu-item-${id}-${idx}`}
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
    </>
  );
}

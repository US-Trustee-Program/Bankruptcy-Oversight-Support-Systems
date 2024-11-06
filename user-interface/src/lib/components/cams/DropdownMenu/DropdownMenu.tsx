import { useState } from 'react';
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

export default function DropdownMenu(props: DropdownMenuProps) {
  const { id, menuItems, className, children } = props;

  const [expanded, setExpanded] = useState<boolean>(false);

  function handleToggleExpand() {
    setExpanded(!expanded);
    if (props.onClick) props.onClick();
  }

  function handleKeyDown(ev: React.KeyboardEvent) {
    if (ev.key === 'Enter') {
      handleToggleExpand();
    }
  }

  return (
    <>
      <button
        id={id}
        type="button"
        className={`usa-accordion__button usa-nav__link ${className ?? ''}`}
        onClick={handleToggleExpand}
        onKeyDown={handleKeyDown}
        aria-expanded={expanded}
        aria-controls="user-submenu"
      >
        <span>{children}</span>
      </button>
      <ul id="user-submenu" className={`usa-nav__submenu ${className}`} hidden={!expanded}>
        {menuItems.map((item, idx) => (
          <li id={item.id ?? ''} className={`usa-nav__submenu-item ${item.className}`} key={idx}>
            <NavLink
              to={item.address}
              data-testid={`menu-item-${id}-${idx}`}
              className="usa-nav-link"
              title={item.title ?? ''}
            >
              {item.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </>
  );
}

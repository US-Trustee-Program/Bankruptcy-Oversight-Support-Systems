import './TabNav.scss';
import { NavLink } from 'react-router-dom';

type TabNavItem = {
  label: string;
  to: string;
  testId?: string;
  // Match the path exactly, so a parent path's tab isn't selected on a child path.
  end?: boolean;
};

interface TabNavProps {
  'aria-label': string;
  tabs: TabNavItem[];
}

export function TabNav({ 'aria-label': ariaLabel, tabs }: Readonly<TabNavProps>) {
  return (
    <nav className="tab-nav" aria-label={ariaLabel}>
      <ul className="tab-nav__list">
        {tabs.map((tab) => (
          <li key={tab.to} className="tab-nav__item">
            <NavLink
              to={tab.to}
              end={tab.end}
              className={({ isActive }) =>
                'tab-nav__link' + (isActive ? ' tab-nav__link--current' : '')
              }
              data-testid={tab.testId}
            >
              {tab.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

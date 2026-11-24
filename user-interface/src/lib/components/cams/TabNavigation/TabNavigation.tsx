import './TabNavigation.scss';
import { NavLink } from 'react-router-dom';

type TabNavigationTab = {
  label: string;
  to: string;
};

type TabNavigationProps = {
  id: string;
  ariaLabel: string;
  tabs: TabNavigationTab[];
};

/**
 * A horizontal row of route links styled as tabs. Each tab is a page in its own right, so this uses
 * a navigation landmark with aria-current rather than the ARIA tab pattern (role="tablist").
 */
export default function TabNavigation({ id, ariaLabel, tabs }: Readonly<TabNavigationProps>) {
  return (
    <nav id={id} className="tab-navigation" aria-label={ariaLabel}>
      <ul className="tab-navigation__list">
        {tabs.map((tab) => (
          <li key={tab.to} className="tab-navigation__item">
            <NavLink
              to={tab.to}
              className={({ isActive }) =>
                'tab-navigation__link' + (isActive ? ' tab-navigation__link--current' : '')
              }
            >
              {tab.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

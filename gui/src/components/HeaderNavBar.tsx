import { NavLink } from 'react-router-dom';
import './HeaderNavBar.scss';

export const HeaderNavBar = () => {
  return (
    <nav className="nav-bar" role="navigation" aria-label="main-navigation">
      <NavLink to="/cases">Cases</NavLink>
      <NavLink to="/">Login</NavLink>
    </nav>
  );
};

//import { Link } from 'react-router-dom';

export default function CaseDetailNavigation() {
  return (
    <>
      <nav aria-label="Side navigation">
        <ul className="usa-sidenav">
          <li className="usa-sidenav__item">
            <a href="javascript:void(0);" className="usa-current">
              Basic Information
            </a>
          </li>
          <li className="usa-sidenav__item">
            <a href="javascript:void(0);">Court Docket</a>
          </li>
        </ul>
      </nav>
    </>
  );
}

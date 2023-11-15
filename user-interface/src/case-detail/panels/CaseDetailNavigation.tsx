import { Link } from 'react-router-dom';

export interface CaseDetailNavigationProps {
  caseId: string | undefined;
}

function checkCurrentNav(keyword: string): string {
  const usaCurrent = 'usa-current';
  const splitPath = location.pathname.replace(/^\//, '').replace(/\/$/, '').split('/');

  if (keyword.length == 0 && splitPath.length < 3) return usaCurrent;
  else if (keyword.length > 0 && location.pathname.includes(keyword)) return usaCurrent;
  else return '';
}

export default function CaseDetailNavigation({ caseId }: CaseDetailNavigationProps) {
  return (
    <>
      <nav aria-label="Side navigation">
        <ul className="usa-sidenav">
          <li className="usa-sidenav__item">
            <Link className={checkCurrentNav('')} to={`/case-detail/${caseId}/`}>
              Basic Information
            </Link>
          </li>
          <li className="usa-sidenav__item">
            <Link
              className={checkCurrentNav('/court-docket')}
              to={`/case-detail/${caseId}/court-docket`}
            >
              Court Docket
            </Link>
          </li>
        </ul>
      </nav>
    </>
  );
}

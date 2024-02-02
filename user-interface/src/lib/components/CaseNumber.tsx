import { Link } from 'react-router-dom';
import { getCaseNumber } from '../utils/formatCaseNumber';

export interface CaseNumberProps {
  caseNumber: string;
  renderAs?: 'link' | 'span';
  className?: string;
  'data-testid'?: string;
}

export function CaseNumber(props: CaseNumberProps) {
  const { className, caseNumber, renderAs = 'link' } = props;
  const dataTestId = props['data-testid'];
  const span = (
    <span className={className} data-testid={dataTestId}>
      {getCaseNumber(caseNumber)}
    </span>
  );
  if (renderAs === 'link') {
    return (
      <Link
        to={`/case-detail/${caseNumber}/`}
        className={`usa-link ${className}`}
        data-testid={`${dataTestId}-link`}
        title={`Open case ${caseNumber}`}
        target="_blank"
        reloadDocument={true}
      >
        {span}
      </Link>
    );
  } else {
    return span;
  }
}

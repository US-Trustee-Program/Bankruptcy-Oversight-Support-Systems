import { Link } from 'react-router-dom';
import { getCaseNumber } from '../utils/formatCaseNumber';

export interface CaseNumberProps {
  caseNumber: string;
  renderAs?: 'link' | 'span';
  openLinkIn?: 'same-window' | 'new-window';
  className?: string;
  'data-testid'?: string;
}

export function CaseNumber(props: CaseNumberProps) {
  const { className, caseNumber, renderAs = 'link', openLinkIn = 'new-window' } = props;
  const dataTestId = props['data-testid'];
  const span = (
    <span className={className ?? ''} data-testid={dataTestId}>
      {getCaseNumber(caseNumber)}
    </span>
  );
  if (renderAs === 'link') {
    const target = openLinkIn === 'new-window' ? '_blank' : '_self';
    return (
      <Link
        to={`/case-detail/${caseNumber}/`}
        className={`usa-link`}
        data-testid={`${dataTestId}-link`}
        title={`Open case ${caseNumber}`}
        target={target}
        reloadDocument={true}
      >
        {span}
      </Link>
    );
  } else {
    return span;
  }
}

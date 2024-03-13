import { Link } from 'react-router-dom';
import { getCaseNumber } from '../utils/formatCaseNumber';

export interface CaseNumberProps {
  caseId: string;
  renderAs?: 'link' | 'span';
  openLinkIn?: 'same-window' | 'new-window';
  className?: string;
  'data-testid'?: string;
}

export function CaseNumber(props: CaseNumberProps) {
  const { className, caseId, renderAs = 'link', openLinkIn = 'new-window' } = props;
  const dataTestId = props['data-testid'];
  const span = (
    <span className={className ?? ''} data-testid={dataTestId}>
      {getCaseNumber(caseId)}
    </span>
  );
  if (renderAs === 'link') {
    const target = openLinkIn === 'new-window' ? '_blank' : '_self';
    return (
      <Link
        to={`/case-detail/${caseId}/`}
        className={`usa-link`}
        data-testid={`${dataTestId}-link`}
        title={`Open case ${caseId}`}
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

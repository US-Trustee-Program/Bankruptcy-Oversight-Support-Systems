import { Link } from 'react-router-dom';
import { getCaseNumber } from '../utils/formatCaseNumber';

export type CaseNumberProps = JSX.IntrinsicElements['span'] & {
  caseId: string;
  renderAs?: 'link' | 'span';
  openLinkIn?: 'same-window' | 'new-window';
  'data-testid'?: string;
};

export function CaseNumber(props: CaseNumberProps) {
  const { caseId, renderAs = 'link', openLinkIn = 'new-window', ...otherProps } = props;
  const span = <span {...otherProps}>{getCaseNumber(caseId)}</span>;
  if (renderAs === 'link') {
    const target = openLinkIn === 'new-window' ? `CAMS-case-detail-${caseId}` : '_self';
    const dataTestId = props['data-testid'] ? `${props['data-testid']}-link` : undefined;
    return (
      <Link
        data-testid={dataTestId}
        to={`/case-detail/${caseId}/`}
        className={`usa-link`}
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

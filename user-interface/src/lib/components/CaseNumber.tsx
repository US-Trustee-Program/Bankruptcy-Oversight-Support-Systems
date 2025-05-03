import { Link } from 'react-router-dom';

import { getCaseNumber } from '../utils/caseNumber';

export type CaseNumberProps = JSX.IntrinsicElements['span'] & {
  caseId: string;
  'data-testid'?: string;
  openLinkIn?: 'new-window' | 'same-window';
  renderAs?: 'link' | 'span';
};

export function CaseNumber(props: CaseNumberProps) {
  const { caseId, openLinkIn = 'new-window', renderAs = 'link', ...otherProps } = props;
  const span = <span {...otherProps}>{getCaseNumber(caseId)}</span>;
  if (renderAs === 'link') {
    const target = openLinkIn === 'new-window' ? `CAMS-case-detail-${caseId}` : '_self';
    const dataTestId = props['data-testid'] ? `${props['data-testid']}-link` : undefined;
    return (
      <Link
        className={`usa-link`}
        data-testid={dataTestId}
        reloadDocument={true}
        target={target}
        title={`View case number ${props.caseId} details`}
        to={`/case-detail/${caseId}/`}
      >
        {span}
      </Link>
    );
  } else {
    return span;
  }
}

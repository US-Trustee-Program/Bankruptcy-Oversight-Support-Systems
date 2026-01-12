import { Link } from 'react-router-dom';
import { getCaseNumber } from '../utils/caseNumber';

import type { JSX } from 'react';

export type CaseNumberProps = JSX.IntrinsicElements['span'] & {
  caseId: string;
  renderAs?: 'link' | 'span';
  openLinkIn?: 'same-window' | 'new-window';
  'data-testid'?: string;
  tab?: string;
};

export function CaseNumber(props: CaseNumberProps) {
  const { caseId, renderAs = 'link', openLinkIn = 'new-window', tab, ...otherProps } = props;
  const span = <span {...otherProps}>{getCaseNumber(caseId)}</span>;
  if (renderAs === 'link') {
    const target = openLinkIn === 'new-window' ? '_blank' : '_self';
    const rel = openLinkIn === 'new-window' ? 'noopener noreferrer' : undefined;
    const dataTestId = props['data-testid'] ? `${props['data-testid']}-link` : undefined;
    return (
      <Link
        data-testid={dataTestId}
        to={`/case-detail/${caseId}/${tab ?? ''}`}
        className={`usa-link`}
        title={`View case number ${props.caseId} details`}
        target={target}
        rel={rel}
        reloadDocument={true}
      >
        {span}
      </Link>
    );
  } else {
    return span;
  }
}

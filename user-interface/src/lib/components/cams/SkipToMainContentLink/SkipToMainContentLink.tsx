import './SkipToMainContentLink.scss';

import type { JSX } from 'react';

type SkipToMainContentLinkProps = JSX.IntrinsicElements['a'];

export function SkipToMainContentLink(props: SkipToMainContentLinkProps) {
  return (
    <a id={props.id ?? ''} className="skip-to-main-content-link" href="#main">
      {props.children}
    </a>
  );
}

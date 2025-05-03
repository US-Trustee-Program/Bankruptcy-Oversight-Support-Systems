import './SkipToMainContentLink.scss';

export type SkipToMainContentLinkProps = JSX.IntrinsicElements['a'];

export function SkipToMainContentLink(props: SkipToMainContentLinkProps) {
  return (
    <a className="skip-to-main-content-link" href="#main" id={props.id ?? ''}>
      {props.children}
    </a>
  );
}

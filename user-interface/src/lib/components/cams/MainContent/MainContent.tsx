export type MainContentProps = JSX.IntrinsicElements['div'];

export function MainContent(props: MainContentProps) {
  return <main id="main">{props.children}</main>;
}

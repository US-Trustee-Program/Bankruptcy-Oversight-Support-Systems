export type MainContentProps = JSX.IntrinsicElements['div'];

export function MainContent(props: MainContentProps) {
  const { children, ...otherProps } = props;

  return (
    <main {...otherProps} aria-live="polite" id="main" role="main">
      {children}
    </main>
  );
}

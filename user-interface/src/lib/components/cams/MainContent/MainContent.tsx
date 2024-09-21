export type MainContentProps = JSX.IntrinsicElements['div'];

export function MainContent(props: MainContentProps) {
  const { children, ...otherProps } = props;
  return (
    <main {...otherProps} id="main" aria-live="polite">
      {children}
    </main>
  );
}

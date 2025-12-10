import type { JSX } from 'react';
type MainContentProps = JSX.IntrinsicElements['div'];

export function MainContent(props: MainContentProps) {
  const { children, ...otherProps } = props;

  return (
    <main {...otherProps} id="main" role="main" aria-live="polite">
      {children}
    </main>
  );
}

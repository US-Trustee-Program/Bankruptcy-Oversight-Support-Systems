import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

export type MainContentProps = JSX.IntrinsicElements['div'];

export function MainContent(props: MainContentProps) {
  const { children, ...otherProps } = props;
  const location = useLocation();

  const mainContentRef = useRef<HTMLElement>(null);
  const firstLoad = useRef(true);

  useEffect(() => {
    if (firstLoad.current) {
      const header = document.querySelector('header');
      if (header) {
        header.focus();
      }
    } else {
      if (mainContentRef.current) {
        mainContentRef.current.focus();
      }
    }
    firstLoad.current = false;
  }, [location]);

  return (
    <main
      {...otherProps}
      id="main"
      role="main"
      aria-live="polite"
      ref={mainContentRef}
      tabIndex={-1}
    >
      {children}
    </main>
  );
}

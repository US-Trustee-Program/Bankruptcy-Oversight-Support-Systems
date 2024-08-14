import { useEffect } from 'react';
import './ScrollToTopButton.scss';
import Button from './uswds/Button';
import Icon from './uswds/Icon';

export interface ScrollToTopButtonProps {
  target: Element | null;
}

export default function ScrollToTopButton(props: ScrollToTopButtonProps) {
  const appRoot = document.getElementById('app-root');

  function documentScroll(ev: Event) {
    const scrollButton = document.querySelector('.scroll-to-top-button');
    console.log(scrollButton);
    if ((ev.currentTarget as Element).scrollTop > 100) {
      (ev.target as HTMLElement).className = 'App header-scrolled-out';
      //setAppClasses('App header-scrolled-out');
      // setScrollBtnClass('show');
      if (scrollButton) scrollButton.className = 'scroll-to-top-button show';
    } else {
      (ev.target as HTMLElement).className = 'App';
      //setAppClasses('App');
      // setScrollBtnClass('');
      if (scrollButton) scrollButton.className = 'scroll-to-top-button';
    }
  }

  function scrollElement(el: Element | null) {
    if (el) {
      const appRoot = document.getElementById('app-root');
      if (appRoot) {
        appRoot.scrollTop = 0;
        const scrollEvent = new CustomEvent('scroll');
        appRoot.dispatchEvent(scrollEvent);
      }
    }
  }

  useEffect(() => {
    appRoot?.addEventListener('scroll', documentScroll);

    return () => {
      appRoot?.removeEventListener('scroll', documentScroll);
    };
  }, []);

  return (
    <Button
      onClick={() => scrollElement(props.target)}
      className="scroll-to-top-button"
      title="scroll to top"
      aria-label="scroll to top of docket entry list"
    >
      <Icon name="arrow_upward"></Icon>
    </Button>
  );
}

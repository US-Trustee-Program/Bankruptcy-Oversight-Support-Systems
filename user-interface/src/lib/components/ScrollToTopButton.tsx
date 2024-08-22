import { useEffect } from 'react';
import './ScrollToTopButton.scss';
import Button from './uswds/Button';
import Icon from './uswds/Icon';

export default function ScrollToTopButton() {
  function documentScroll(ev: Event) {
    const scrollButton = document.querySelector('.scroll-to-top-button');
    if ((ev.currentTarget as Element).scrollTop > 100) {
      (ev.target as HTMLElement).className = 'App header-scrolled-out';
      if (scrollButton) scrollButton.classList.add('show');
    } else {
      (ev.target as HTMLElement).className = 'App';
      if (scrollButton) scrollButton.classList.remove('show');
    }
  }

  function scrollElement() {
    const appRoot = document.getElementById('app-root');
    if (appRoot) {
      appRoot.scrollTop = 0;
      const scrollEvent = new CustomEvent('scroll');
      appRoot.dispatchEvent(scrollEvent);
    }
  }

  useEffect(() => {
    const appRoot = document.getElementById('app-root');
    appRoot?.addEventListener('scroll', documentScroll);

    return () => {
      const appRoot = document.getElementById('app-root');
      appRoot?.removeEventListener('scroll', documentScroll);
    };
  }, []);

  return (
    <Button
      onClick={() => scrollElement()}
      className="scroll-to-top-button"
      title="scroll to top"
      aria-label="scroll to top of docket entry list"
    >
      <Icon name="arrow_upward"></Icon>
    </Button>
  );
}

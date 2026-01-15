import { useEffect } from 'react';
import './ScrollToTopButton.scss';
import Button from './uswds/Button';
import Icon from './uswds/Icon';

export default function ScrollToTopButton() {
  function documentScroll(_ev: Event) {
    const app = document.querySelector('.App');
    if (app) {
      const scrollButton = document.querySelector('.scroll-to-top-button');
      if (window.scrollY > 100) {
        app.className = 'App header-scrolled-out';
        if (scrollButton) scrollButton.classList.add('show');
      } else {
        app.className = 'App';
        if (scrollButton) scrollButton.classList.remove('show');
      }
    }
  }

  function scrollElement() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    const scrollEvent = new CustomEvent('scroll');
    window.dispatchEvent(scrollEvent);
  }

  useEffect(() => {
    window.addEventListener('scroll', documentScroll);

    return () => {
      window.removeEventListener('scroll', documentScroll);
    };
  }, []);

  return (
    <Button
      onClick={() => scrollElement()}
      className="scroll-to-top-button"
      title="Scroll to top."
      aria-label="scroll to top of the screen contents"
    >
      <Icon name="arrow_upward"></Icon>
    </Button>
  );
}

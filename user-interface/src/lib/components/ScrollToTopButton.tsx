import './ScrollToTopButton.scss';
import Button from './uswds/Button';
import Icon from './uswds/Icon';

export interface ScrollToTopButtonProps {
  target: Element | null;
  className?: string;
}

export default function ScrollToTopButton(props: ScrollToTopButtonProps) {
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

  return (
    <Button
      onClick={() => scrollElement(props.target)}
      className={`scroll-to-top-button ${props.className}`}
      title="scroll to top"
      aria-label="scroll to top of docket entry list"
    >
      <Icon name="arrow_upward"></Icon>
    </Button>
  );
}

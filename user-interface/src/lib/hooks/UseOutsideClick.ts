import React from 'react';

// NOTE:  This hook acts on "mousedown" rather than "click" so that it does
// not disturb other click events. For instance, if a comboBox dropdown
// popup is open, and a user clicks on a button, we don't want to swallow
// up the click event on the button, but do want to close the dropdown.
// (That's quite a run-on sentence huah?) By handling a "mousedown", the click
// is then handled by the button.
export default function useOutsideClick(
  refs: Array<React.RefObject<HTMLElement>>,
  callback: (event: MouseEvent) => void,
) {
  React.useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      let fireCallback = true;
      refs.forEach((ref) => {
        if (
          ref.current &&
          ref.current.contains &&
          ref.current.contains(event.target as HTMLElement)
        ) {
          fireCallback = false;
        }
      });

      if (fireCallback) callback(event);
    };

    document.addEventListener('mousedown', handleClick);

    return () => {
      document.removeEventListener('mousedown', handleClick);
    };
  }, [refs]);

  return refs;
}

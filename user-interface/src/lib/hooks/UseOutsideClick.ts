import React from 'react';

export default function useOutsideClick(
  refs: Array<React.RefObject<HTMLElement>>,
  callback: (event: MouseEvent) => void,
) {
  //const ref = React.useRef<HTMLDivElement>(null);

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

    document.addEventListener('click', handleClick);

    return () => {
      document.removeEventListener('click', handleClick);
    };
  }, [refs]);

  return refs;
}

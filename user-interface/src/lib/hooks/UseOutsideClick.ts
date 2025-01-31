import React from 'react';

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

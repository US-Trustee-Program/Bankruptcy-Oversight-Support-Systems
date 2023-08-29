import React from 'react';
import { ObjectKeyVal } from '../type-declarations/basic';

export default function useGlobalKeyDown(
  callback: (ev: KeyboardEvent, state: ObjectKeyVal) => void,
  state: ObjectKeyVal,
) {
  React.useEffect(() => {
    const handleKeyDown = (ev: KeyboardEvent) => {
      callback(ev, state);
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);
}

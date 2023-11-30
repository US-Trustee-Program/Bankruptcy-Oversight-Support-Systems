import { useState } from 'react';

export default function useFixedPosition() {
  const [isFixed, setIsFixed] = useState(false);

  const loosen = () => {
    setIsFixed(false);
  };

  const fix = () => {
    setIsFixed(true);
  };

  return {
    isFixed,
    loosen,
    fix,
  };
}

import { useState } from 'react';

export default function useComponent() {
  const [isVisible, setIsVisible] = useState(false);

  const hide = () => {
    setIsVisible(false);
  };

  const show = () => {
    setIsVisible(true);
  };

  return {
    hide,
    isVisible,
    show,
  };
}

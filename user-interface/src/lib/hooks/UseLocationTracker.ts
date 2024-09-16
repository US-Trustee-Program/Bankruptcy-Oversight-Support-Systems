import { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

export function isValidPath(path: string): boolean {
  const pathRegex = /^\/[a-zA-Z0-9\-_]+$/;
  return pathRegex.test(path);
}

export default function useLocationTracker() {
  const location = useLocation();
  const [previousLocation, setPreviousLocation] = useState<string>(() => {
    const storedLocation = localStorage.getItem('previousLocation');

    return storedLocation && isValidPath(storedLocation) ? storedLocation : '/my-cases';
  });

  const updateLocation = useCallback((newLocation?: string) => {
    if (newLocation && isValidPath(newLocation)) {
      setPreviousLocation(newLocation);
      localStorage.setItem('previousLocation', newLocation);
    } else {
      const pathLocation = location.pathname ?? '/my-cases';
      setPreviousLocation(pathLocation);
      localStorage.setItem('previousLocation', pathLocation);
    }
  }, []);

  useEffect(() => {
    const storedLocation = localStorage.getItem('previousLocation');
    if (storedLocation && isValidPath(storedLocation)) {
      setPreviousLocation(storedLocation);
    }
  });

  return { previousLocation, updateLocation };
}

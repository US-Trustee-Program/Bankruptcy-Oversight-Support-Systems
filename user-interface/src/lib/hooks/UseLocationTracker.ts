import { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

export function isValidPath(path: string): boolean {
  const pathRegex = /^\/[a-zA-Z\-_]+[a-zA-Z0-9\-._~!$?&'()*+,;=:@/]*$/;
  return pathRegex.test(path);
}

export default function useLocationTracker() {
  const location = useLocation();
  const [previousLocation, setPreviousLocation] = useState<string>(() => {
    const storedLocation = localStorage.getItem('previousLocation');

    return storedLocation && isValidPath(storedLocation) ? storedLocation : '/my-cases';
  });
  const [homeTab, setHomeTab] = useState<string>(() => {
    const target = localStorage.getItem('homeTab');

    return target ?? '';
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
    if (window.name.match(/^CAMS_WINDOW_[0-9]+/)) {
      setHomeTab(window.name);
      localStorage.setItem('homeTab', window.name);
    }
  }, []);

  useEffect(() => {
    const storedLocation = localStorage.getItem('previousLocation');
    const storedTab = localStorage.getItem('homeTab');

    if (storedLocation && isValidPath(storedLocation)) {
      setPreviousLocation(storedLocation);
    }
    if (storedTab && storedTab.length > 0) {
      setHomeTab(storedTab);
    }
  }, []);

  return { previousLocation, homeTab, updateLocation };
}

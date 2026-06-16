import { useEffect, useRef, useState } from 'react';

type FocusNavKey = 'Tab' | 'ArrowDown' | 'ArrowUp';

function getNextFocusIndex(
  key: FocusNavKey,
  shiftKey: boolean,
  currentIndex: number,
  length: number,
): number {
  switch (key) {
    case 'Tab':
      if (shiftKey) return currentIndex > 0 ? currentIndex - 1 : length - 1;
      return currentIndex < length - 1 ? currentIndex + 1 : 0;
    case 'ArrowDown':
      return currentIndex < length - 1 ? currentIndex + 1 : 0;
    case 'ArrowUp':
      return currentIndex > 0 ? currentIndex - 1 : length - 1;
  }
}

export function useMobileNav() {
  const [open, setOpen] = useState(false);
  const navRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) {
      document.body.classList.add('usa-mobile-nav-active');
      closeButtonRef.current?.focus();
    } else {
      document.body.classList.remove('usa-mobile-nav-active');
    }
    return () => {
      document.body.classList.remove('usa-mobile-nav-active');
    };
  }, [open]);

  const onKeyDown: React.KeyboardEventHandler<HTMLElement> = (e) => {
    if (!['Tab', 'ArrowDown', 'ArrowUp', 'Escape'].includes(e.key)) return;

    if (e.key === 'Escape' && open) {
      setOpen(false);
      menuButtonRef.current?.focus();
      return;
    }

    const nav = navRef.current;
    if (!nav || !open) return;

    const focusable = Array.from(
      nav.querySelectorAll<HTMLElement>('a[href], button:not([disabled])'),
    ).filter((el) => !el.closest('.desktop-user-menu'));

    if (focusable.length === 0) return;

    e.preventDefault();
    const key = e.key as FocusNavKey;
    const currentIndex = focusable.indexOf(document.activeElement as HTMLElement);
    const nextIndex = getNextFocusIndex(key, e.shiftKey, currentIndex, focusable.length);
    focusable[nextIndex]?.focus();
  };

  return { open, setOpen, navRef, menuButtonRef, closeButtonRef, onKeyDown };
}

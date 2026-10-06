import { useCallback, useState, type FocusEvent } from 'react';

// For a row of two or more fields that are only valid together (e.g. a
// Year/Status pair), validation errors should stay hidden while the user is
// still working within the row and only appear once focus actually leaves
// it -- not on every keystroke/selection change. Attach handleFocus/handleBlur
// to the row's wrapping element and gate the error message (and any
// hasError styling) on `touched`.
function useGroupBlur() {
  const [hasInteracted, setHasInteracted] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const handleFocus = useCallback(() => {
    setIsFocused(true);
    setHasInteracted(true);
  }, []);

  const handleBlur = useCallback((ev: FocusEvent<HTMLElement>) => {
    if (!ev.currentTarget.contains(ev.relatedTarget as Node | null)) {
      setIsFocused(false);
    }
  }, []);

  return { touched: hasInteracted && !isFocused, handleFocus, handleBlur };
}

export default useGroupBlur;

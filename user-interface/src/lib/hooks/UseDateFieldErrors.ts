import { useCallback, useState } from 'react';

function useDateFieldErrors() {
  const [errorsByField, setErrorsByField] = useState<Record<string, boolean>>({});

  const registerFieldError = useCallback((fieldId: string, hasError: boolean) => {
    setErrorsByField((prev) => {
      if (prev[fieldId] === hasError) {
        return prev;
      }
      return { ...prev, [fieldId]: hasError };
    });
  }, []);

  const hasErrorAmong = useCallback(
    (fieldIds: string[]) => fieldIds.some((fieldId) => errorsByField[fieldId]),
    [errorsByField],
  );

  return { registerFieldError, hasErrorAmong };
}

export default useDateFieldErrors;

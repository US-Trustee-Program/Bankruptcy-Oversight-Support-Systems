/**
 * Scrolls to the first form field with a validation error.
 *
 * This function queries the DOM for USWDS error classes applied to form inputs
 * and combo boxes, then smoothly scrolls to and focuses the first error found.
 *
 * @remarks
 * Uses `setTimeout` to ensure error classes are applied to DOM after React state updates.
 * Works with USWDS Input and ComboBox components that apply `.usa-input-group--error` class.
 *
 * @example
 * ```typescript
 * // In form validation
 * if (!formIsValid) {
 *   setFieldErrors(errors);
 *   scrollToFirstError();
 * }
 * ```
 */
export function scrollToFirstError(): void {
  setTimeout(() => {
    const errorElement = document.querySelector('.usa-input-group--error');
    if (errorElement && 'scrollIntoView' in errorElement) {
      errorElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const inputElement = errorElement.querySelector('input');
      inputElement?.focus();
    }
  }, 0);
}

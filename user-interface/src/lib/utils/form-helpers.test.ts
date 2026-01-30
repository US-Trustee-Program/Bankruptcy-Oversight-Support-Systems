import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { scrollToFirstError } from './form-helpers';

describe('form-helpers', () => {
  describe('scrollToFirstError', () => {
    let mockElement: HTMLDivElement;
    let mockInput: HTMLInputElement;
    let querySelectorSpy: ReturnType<typeof vi.spyOn>;
    let scrollIntoViewSpy: ReturnType<typeof vi.fn>;
    let focusSpy: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      mockInput = document.createElement('input');
      mockElement = document.createElement('div');
      mockElement.classList.add('usa-input-group--error');
      mockElement.appendChild(mockInput);

      scrollIntoViewSpy = vi.fn();
      focusSpy = vi.fn();
      mockElement.scrollIntoView = scrollIntoViewSpy;
      mockInput.focus = focusSpy;

      querySelectorSpy = vi.spyOn(document, 'querySelector');

      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.restoreAllMocks();
      vi.useRealTimers();
    });

    test('should scroll to first error element and focus input', () => {
      querySelectorSpy.mockReturnValue(mockElement);

      scrollToFirstError();

      vi.runAllTimers();

      expect(querySelectorSpy).toHaveBeenCalledWith('.usa-input-group--error');
      expect(scrollIntoViewSpy).toHaveBeenCalledWith({
        behavior: 'smooth',
        block: 'center',
      });
      expect(focusSpy).toHaveBeenCalled();
    });

    test('should handle case when no error element is found', () => {
      querySelectorSpy.mockReturnValue(null);

      scrollToFirstError();
      vi.runAllTimers();

      expect(querySelectorSpy).toHaveBeenCalledWith('.usa-input-group--error');
      expect(scrollIntoViewSpy).not.toHaveBeenCalled();
      expect(focusSpy).not.toHaveBeenCalled();
    });
  });
});

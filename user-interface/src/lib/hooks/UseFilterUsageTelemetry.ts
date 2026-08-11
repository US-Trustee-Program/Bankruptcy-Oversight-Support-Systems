import { useEffect, useRef } from 'react';
import useDebounce from './UseDebounce';
import { getAppInsights } from './UseApplicationInsights';

export interface FilterUsageTelemetryOptions<T> {
  changedEventName: string | ((value: T) => string);
  clearedEventName: string | ((previousValue: T) => string);
  changedProperties?: (value: T) => Record<string, string> | undefined;
  suppressClearRef?: { current: boolean };
  isEmpty: (value: T) => boolean;
  debounceMs?: number;
  isEqual?: (a: T, b: T) => boolean;
}

function useFilterUsageTelemetry<T>(value: T, options: FilterUsageTelemetryOptions<T>) {
  const debounce = useDebounce();

  // A debounced evaluation runs later than the render that scheduled it, and other options
  // (e.g. changedProperties) can change in the interim, so we read the freshest options at
  // evaluation time via a ref rather than closing over a value frozen at schedule time.
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const lastReportedRef = useRef<T>(value);

  useEffect(() => {
    // Captured now rather than read from optionsRef inside evaluate(): a debounced evaluate()
    // runs on a real timer, long after a same-commit trailing effect (see CaseDetailScreen's
    // suppressClearRef reset) would have already flipped the ref back — so suppression must be
    // decided at schedule time, while the flag still reflects the action that triggered this effect.
    const suppressThisClear = optionsRef.current.suppressClearRef?.current ?? false;

    const evaluate = () => {
      const opts = optionsRef.current;
      const currentlyEmpty = opts.isEmpty(value);
      const previouslyEmpty = opts.isEmpty(lastReportedRef.current);

      if (currentlyEmpty) {
        if (!previouslyEmpty && !suppressThisClear) {
          // lastReportedRef.current still holds the pre-clear value here; the assignment at the
          // end of evaluate() runs after this branch, so a function-form clearedEventName can
          // name the event from the value that was active right before the clear.
          const clearedName =
            typeof opts.clearedEventName === 'string'
              ? opts.clearedEventName
              : opts.clearedEventName(lastReportedRef.current);
          getAppInsights().appInsights.trackEvent({ name: clearedName });
        }
      } else if (previouslyEmpty || !(opts.isEqual ?? Object.is)(value, lastReportedRef.current)) {
        const name =
          typeof opts.changedEventName === 'string'
            ? opts.changedEventName
            : opts.changedEventName(value);
        const properties = opts.changedProperties?.(value);
        if (properties) {
          getAppInsights().appInsights.trackEvent({ name }, properties);
        } else {
          getAppInsights().appInsights.trackEvent({ name });
        }
      }

      lastReportedRef.current = value;
    };

    const delay = optionsRef.current.debounceMs ?? 0;
    if (delay > 0) {
      debounce(evaluate, delay);
    } else {
      evaluate();
    }
  }, [value, debounce]);
}

export default useFilterUsageTelemetry;

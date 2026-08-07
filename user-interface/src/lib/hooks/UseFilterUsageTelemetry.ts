import { useEffect, useRef } from 'react';
import useDebounce from './UseDebounce';
import { getAppInsights } from './UseApplicationInsights';

export interface FilterUsageTelemetryOptions<T> {
  changedEventName: string;
  clearedEventName: string;
  resultCount: number;
  isEmpty: (value: T) => boolean;
  debounceMs?: number;
  isEqual?: (a: T, b: T) => boolean;
}

function useFilterUsageTelemetry<T>(value: T, options: FilterUsageTelemetryOptions<T>) {
  const debounce = useDebounce();

  // A debounced evaluation runs later than the render that scheduled it, and unrelated
  // filters can change resultCount in the interim, so we read the freshest options at
  // evaluation time via a ref rather than closing over a value frozen at schedule time.
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const lastReportedRef = useRef<T>(value);

  useEffect(() => {
    const evaluate = () => {
      const opts = optionsRef.current;
      const currentlyEmpty = opts.isEmpty(value);
      const previouslyEmpty = opts.isEmpty(lastReportedRef.current);

      if (currentlyEmpty) {
        if (!previouslyEmpty) {
          getAppInsights().appInsights.trackEvent({ name: opts.clearedEventName });
        }
      } else if (previouslyEmpty || !(opts.isEqual ?? Object.is)(value, lastReportedRef.current)) {
        getAppInsights().appInsights.trackEvent(
          { name: opts.changedEventName },
          { resultCount: opts.resultCount },
        );
      }

      lastReportedRef.current = value;
    };

    const delay = optionsRef.current.debounceMs ?? 0;
    if (delay > 0) {
      debounce(evaluate, delay);
    } else {
      evaluate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- options is intentionally read via optionsRef at evaluation time; adding it would re-run this effect on every render since callers pass a new object literal each time
  }, [value, debounce]);
}

export default useFilterUsageTelemetry;

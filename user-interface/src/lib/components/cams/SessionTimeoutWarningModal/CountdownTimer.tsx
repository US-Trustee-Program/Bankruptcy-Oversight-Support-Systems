import { useEffect, useState, useRef } from 'react';

export interface CountdownTimerProps {
  timeInMs: number;
  running?: boolean;
}

export function CountdownTimer({ timeInMs, running = true }: CountdownTimerProps) {
  const [secondsRemaining, setSecondsRemaining] = useState<number>(
    Math.max(0, Math.floor(timeInMs / 1000)),
  );
  const previousRunning = useRef<boolean>(running);

  useEffect(() => {
    // Reset the timer when timeInMs changes
    setSecondsRemaining(Math.max(0, Math.floor(timeInMs / 1000)));
  }, [timeInMs]);

  useEffect(() => {
    // Reset timer when transitioning from running to stopped (modal closes)
    if (!running && previousRunning.current) {
      setSecondsRemaining(Math.max(0, Math.floor(timeInMs / 1000)));
    }
    previousRunning.current = running;

    // Only set up interval when running is true
    if (!running) {
      return;
    }

    // Set up interval to countdown every second
    const intervalId = setInterval(() => {
      setSecondsRemaining((prevSeconds) => {
        if (prevSeconds <= 0) {
          return 0;
        }
        return prevSeconds - 1;
      });
    }, 1000);

    // Cleanup interval on unmount or when running changes
    return () => {
      clearInterval(intervalId);
    };
  }, [running, timeInMs]);

  return <span data-testid="countdown-timer">{secondsRemaining}</span>;
}

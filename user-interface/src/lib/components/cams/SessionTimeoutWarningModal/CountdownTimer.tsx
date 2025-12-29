import { useEffect, useState } from 'react';

export interface CountdownTimerProps {
  timeInMs: number;
}

export function CountdownTimer({ timeInMs }: CountdownTimerProps) {
  const [secondsRemaining, setSecondsRemaining] = useState<number>(
    Math.max(0, Math.floor(timeInMs / 1000)),
  );

  useEffect(() => {
    // Reset the timer when timeInMs changes
    setSecondsRemaining(Math.max(0, Math.floor(timeInMs / 1000)));

    // Set up interval to countdown every second
    const intervalId = setInterval(() => {
      setSecondsRemaining((prevSeconds) => {
        if (prevSeconds <= 0) {
          return 0;
        }
        return prevSeconds - 1;
      });
    }, 1000);

    // Cleanup interval on unmount or when timeInMs changes
    return () => {
      clearInterval(intervalId);
    };
  }, [timeInMs]);

  return <span data-testid="countdown-timer">{secondsRemaining}</span>;
}

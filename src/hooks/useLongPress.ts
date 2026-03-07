import { useCallback, useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react';

interface UseLongPressOptions {
  onLongPress: () => void;
  delay?: number;
  disabled?: boolean;
  shouldStart?: (event: ReactPointerEvent<HTMLElement>) => boolean;
}

interface LongPressBind {
  onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerUp: () => void;
  onPointerCancel: () => void;
  onPointerLeave: () => void;
}

export const useLongPress = ({
  onLongPress,
  delay = 420,
  disabled = false,
  shouldStart
}: UseLongPressOptions): LongPressBind => {
  const timerRef = useRef<number | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startTimer = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (disabled) {
        return;
      }

      if (shouldStart && !shouldStart(event)) {
        return;
      }

      clearTimer();

      timerRef.current = window.setTimeout(() => {
        onLongPress();
        timerRef.current = null;
      }, delay);
    },
    [clearTimer, delay, disabled, onLongPress, shouldStart]
  );

  useEffect(() => clearTimer, [clearTimer]);

  return {
    onPointerDown: startTimer,
    onPointerUp: clearTimer,
    onPointerCancel: clearTimer,
    onPointerLeave: clearTimer
  };
};

import { useMemo, useRef, type TouchEvent } from 'react';

interface UseHorizontalSwipeOptions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  threshold?: number;
  disabled?: boolean;
}

interface HorizontalSwipeBind {
  onTouchStart: (event: TouchEvent<HTMLElement>) => void;
  onTouchMove: (event: TouchEvent<HTMLElement>) => void;
  onTouchEnd: () => void;
  onTouchCancel: () => void;
}

export const useHorizontalSwipe = ({
  onSwipeLeft,
  onSwipeRight,
  threshold = 56,
  disabled = false
}: UseHorizontalSwipeOptions): HorizontalSwipeBind => {
  const activeRef = useRef(false);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const deltaXRef = useRef(0);
  const deltaYRef = useRef(0);

  return useMemo(
    () => ({
      onTouchStart: (event) => {
        if (disabled || event.touches.length !== 1) {
          activeRef.current = false;
          return;
        }

        activeRef.current = true;
        startXRef.current = event.touches[0].clientX;
        startYRef.current = event.touches[0].clientY;
        deltaXRef.current = 0;
        deltaYRef.current = 0;
      },
      onTouchMove: (event) => {
        if (!activeRef.current || event.touches.length !== 1) {
          return;
        }

        deltaXRef.current = event.touches[0].clientX - startXRef.current;
        deltaYRef.current = event.touches[0].clientY - startYRef.current;
      },
      onTouchEnd: () => {
        if (!activeRef.current) {
          return;
        }

        const deltaX = deltaXRef.current;
        const deltaY = deltaYRef.current;
        const isHorizontalIntent = Math.abs(deltaX) > Math.abs(deltaY) * 1.2;

        if (isHorizontalIntent && Math.abs(deltaX) >= threshold) {
          if (deltaX < 0) {
            onSwipeLeft?.();
          } else {
            onSwipeRight?.();
          }
        }

        activeRef.current = false;
        deltaXRef.current = 0;
        deltaYRef.current = 0;
      },
      onTouchCancel: () => {
        activeRef.current = false;
        deltaXRef.current = 0;
        deltaYRef.current = 0;
      }
    }),
    [disabled, onSwipeLeft, onSwipeRight, threshold]
  );
};

import { useMemo, useRef, type TouchEvent } from 'react';

interface UseEdgeSwipeNavigationOptions {
  onNavigate: (direction: 1 | -1) => void;
  edgeSize?: number;
  threshold?: number;
  disabled?: boolean;
}

interface EdgeBind {
  onTouchStart: (event: TouchEvent<HTMLElement>) => void;
  onTouchMove: (event: TouchEvent<HTMLElement>) => void;
  onTouchEnd: () => void;
  onTouchCancel: () => void;
}

export const useEdgeSwipeNavigation = ({
  onNavigate,
  edgeSize = 24,
  threshold = 72,
  disabled = false
}: UseEdgeSwipeNavigationOptions): EdgeBind => {
  const sideRef = useRef<'left' | 'right' | null>(null);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const deltaXRef = useRef(0);
  const deltaYRef = useRef(0);

  return useMemo(
    () => ({
      onTouchStart: (event) => {
        if (disabled || event.touches.length !== 1) {
          sideRef.current = null;
          return;
        }

        const touch = event.touches[0];
        const width = window.innerWidth;

        if (touch.clientX <= edgeSize) {
          sideRef.current = 'left';
        } else if (touch.clientX >= width - edgeSize) {
          sideRef.current = 'right';
        } else {
          sideRef.current = null;
        }

        startXRef.current = touch.clientX;
        startYRef.current = touch.clientY;
        deltaXRef.current = 0;
        deltaYRef.current = 0;
      },
      onTouchMove: (event) => {
        if (!sideRef.current || event.touches.length !== 1) {
          return;
        }

        deltaXRef.current = event.touches[0].clientX - startXRef.current;
        deltaYRef.current = event.touches[0].clientY - startYRef.current;
      },
      onTouchEnd: () => {
        if (!sideRef.current) {
          return;
        }

        const deltaX = deltaXRef.current;
        const deltaY = deltaYRef.current;
        const isHorizontalIntent = Math.abs(deltaX) > Math.abs(deltaY) * 1.25;

        if (sideRef.current === 'left' && isHorizontalIntent && deltaX > threshold) {
          onNavigate(-1);
        }

        if (sideRef.current === 'right' && isHorizontalIntent && deltaX < -threshold) {
          onNavigate(1);
        }

        sideRef.current = null;
        deltaXRef.current = 0;
        deltaYRef.current = 0;
      },
      onTouchCancel: () => {
        sideRef.current = null;
        deltaXRef.current = 0;
        deltaYRef.current = 0;
      }
    }),
    [disabled, edgeSize, onNavigate, threshold]
  );
};

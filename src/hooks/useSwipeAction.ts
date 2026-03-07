import { useMemo } from 'react';
import type { PanInfo } from 'framer-motion';

interface UseSwipeActionOptions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  threshold?: number;
  disabled?: boolean;
}

interface SwipeBind {
  drag: 'x';
  dragConstraints: { left: number; right: number };
  dragElastic: number;
  onDragEnd: (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => void;
}

export const useSwipeAction = ({
  onSwipeLeft,
  onSwipeRight,
  threshold = 76,
  disabled = false
}: UseSwipeActionOptions): SwipeBind => {
  return useMemo(
    () => ({
      drag: 'x' as const,
      dragConstraints: { left: 0, right: 0 },
      dragElastic: 0.18,
      onDragEnd: (_event, info) => {
        if (disabled) {
          return;
        }

        const offset = info.offset.x;

        if (offset <= -threshold && onSwipeLeft) {
          onSwipeLeft();
          return;
        }

        if (offset >= threshold && onSwipeRight) {
          onSwipeRight();
        }
      }
    }),
    [disabled, onSwipeLeft, onSwipeRight, threshold]
  );
};

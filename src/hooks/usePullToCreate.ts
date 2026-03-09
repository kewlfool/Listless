import { useCallback, useRef, useState, type TouchEvent } from 'react';

interface UsePullToCreateOptions {
  threshold?: number;
  onTrigger: () => void;
  direction?: 'down' | 'up';
  disabled?: boolean;
  edgeTolerance?: number;
  requireEdge?: boolean;
}

interface PullBind {
  onTouchStart: (event: TouchEvent<HTMLElement>) => void;
  onTouchMove: (event: TouchEvent<HTMLElement>) => void;
  onTouchEnd: () => void;
  onTouchCancel: () => void;
}

export const usePullToCreate = ({
  threshold = 70,
  onTrigger,
  direction = 'down',
  disabled = false,
  edgeTolerance = 1,
  requireEdge = true
}: UsePullToCreateOptions): {
  bind: PullBind;
  distance: number;
  isReady: boolean;
} => {
  const startY = useRef(0);
  const startX = useRef(0);
  const pulling = useRef(false);

  const [distance, setDistance] = useState(0);
  const [isReady, setIsReady] = useState(false);

  const reset = useCallback(() => {
    pulling.current = false;
    startY.current = 0;
    startX.current = 0;
    setDistance(0);
    setIsReady(false);
  }, []);

  const onTouchStart = useCallback((event: TouchEvent<HTMLElement>) => {
    const node = event.currentTarget;
    const isAtTop = node.scrollTop <= edgeTolerance;
    const isAtBottom = node.scrollHeight - node.clientHeight - node.scrollTop <= edgeTolerance;
    const edgeMismatch = (direction === 'down' && !isAtTop) || (direction === 'up' && !isAtBottom);

    if (disabled || event.touches.length !== 1 || (requireEdge && edgeMismatch)) {
      reset();
      return;
    }

    startY.current = event.touches[0].clientY;
    startX.current = event.touches[0].clientX;
    pulling.current = true;
  }, [direction, disabled, edgeTolerance, requireEdge, reset]);

  const onTouchMove = useCallback(
    (event: TouchEvent<HTMLElement>) => {
      if (disabled || !pulling.current || event.touches.length !== 1) {
        return;
      }

      const node = event.currentTarget;
      const isAtTop = node.scrollTop <= edgeTolerance;
      const isAtBottom = node.scrollHeight - node.clientHeight - node.scrollTop <= edgeTolerance;
      const edgeMismatch = (direction === 'down' && !isAtTop) || (direction === 'up' && !isAtBottom);
      if (requireEdge && edgeMismatch) {
        reset();
        return;
      }

      const currentY = event.touches[0].clientY;
      const currentX = event.touches[0].clientX;
      const deltaY = direction === 'down' ? currentY - startY.current : startY.current - currentY;
      const deltaX = Math.abs(currentX - startX.current);

      if (deltaY <= 0 || deltaY < deltaX) {
        setDistance(0);
        setIsReady(false);
        return;
      }

      const dampened = Math.min(128, deltaY * 0.66);

      setDistance(dampened);
      setIsReady(dampened >= threshold);

      event.preventDefault();
    },
    [direction, disabled, edgeTolerance, requireEdge, reset, threshold]
  );

  const onTouchEnd = useCallback(() => {
    if (disabled) {
      reset();
      return;
    }

    if (pulling.current && isReady) {
      onTrigger();
    }

    reset();
  }, [disabled, isReady, onTrigger, reset]);

  return {
    bind: {
      onTouchStart,
      onTouchMove,
      onTouchEnd,
      onTouchCancel: reset
    },
    distance,
    isReady
  };
};

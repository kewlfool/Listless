import { useCallback, type PointerEvent as ReactPointerEvent } from 'react';
import { useDragControls } from 'framer-motion';

interface LongPressDragBind {
  dragControls: ReturnType<typeof useDragControls>;
  dragListener: false;
  onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerUp: () => void;
  onPointerCancel: () => void;
  onPointerLeave: () => void;
}

export const useLongPressDrag = (): {
  bind: LongPressDragBind;
} => {
  const controls = useDragControls();

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      controls.start(event);
    },
    [controls]
  );

  return {
    bind: {
      dragControls: controls,
      dragListener: false,
      onPointerDown,
      onPointerUp: () => undefined,
      onPointerCancel: () => undefined,
      onPointerLeave: () => undefined
    }
  };
};

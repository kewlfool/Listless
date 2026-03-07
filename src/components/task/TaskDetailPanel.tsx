import { AnimatePresence, Reorder, motion } from 'framer-motion';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useLongPressDrag } from '../../hooks/useLongPressDrag';
import { useSwipeAction } from '../../hooks/useSwipeAction';
import { useListStore } from '../../store/useListStore';
import type { Task } from '../../types/models';

interface TaskDetailPanelProps {
  listId: string;
  task: Task | null;
  onClose: () => void;
}

interface SubtaskRowProps {
  listId: string;
  taskId: string;
  subtask: Task['subtasks'][number];
}

const SubtaskRow = ({ listId, taskId, subtask }: SubtaskRowProps): JSX.Element => {
  const toggleSubtask = useListStore((state) => state.toggleSubtask);
  const deleteSubtask = useListStore((state) => state.deleteSubtask);
  const { bind: dragBind } = useLongPressDrag();
  const {
    dragControls,
    dragListener,
    onPointerDown,
    onPointerUp,
    onPointerCancel,
    onPointerLeave
  } = dragBind;

  const swipeBind = useSwipeAction({
    onSwipeLeft: () => deleteSubtask(listId, taskId, subtask.id),
    onSwipeRight: () => toggleSubtask(listId, taskId, subtask.id)
  });

  return (
    <Reorder.Item
      value={subtask.id}
      className="reorder-item"
      dragListener={dragListener}
      dragControls={dragControls}
    >
      <motion.div className={`subtask-row ${subtask.completed ? 'is-complete' : ''}`} layout>
        <motion.div className="subtask-main" {...swipeBind}>
          <span className="task-check" aria-hidden>
            {subtask.completed ? '●' : '○'}
          </span>
          <span className="task-title">{subtask.title}</span>
        </motion.div>
        <button
          className="drag-handle"
          type="button"
          aria-label="Hold and drag subtask"
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
          onPointerLeave={onPointerLeave}
        >
          ≡
        </button>
      </motion.div>
    </Reorder.Item>
  );
};

export const TaskDetailPanel = ({ listId, task, onClose }: TaskDetailPanelProps): JSX.Element => {
  const addSubtask = useListStore((state) => state.addSubtask);
  const reorderSubtasks = useListStore((state) => state.reorderSubtasks);

  const [subtaskTitle, setSubtaskTitle] = useState('');
  const [order, setOrder] = useState<string[]>([]);

  const subtasks = useMemo(() => task?.subtasks ?? [], [task]);

  useEffect(() => {
    setOrder(subtasks.map((subtask) => subtask.id));
  }, [subtasks]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!task) {
      return;
    }

    addSubtask(listId, task.id, subtaskTitle);
    setSubtaskTitle('');
  };

  return (
    <AnimatePresence>
      {task ? (
        <motion.section
          className="detail-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="detail-panel"
            initial={{ y: 420 }}
            animate={{ y: 0 }}
            exit={{ y: 420 }}
            transition={{ type: 'spring', stiffness: 290, damping: 28 }}
            onClick={(event) => event.stopPropagation()}
          >
            <header className="detail-header">
              <h3>{task.title}</h3>
              <button type="button" className="ghost-button" onClick={onClose}>
                Done
              </button>
            </header>

            <form className="subtask-form" onSubmit={handleSubmit}>
              <input
                className="list-input"
                placeholder="Add subtask"
                value={subtaskTitle}
                onChange={(event) => setSubtaskTitle(event.target.value)}
              />
              <button type="submit" className="solid-button">
                Add
              </button>
            </form>

            <Reorder.Group
              axis="y"
              values={order}
              onReorder={(nextOrder) => {
                setOrder(nextOrder);
                reorderSubtasks(listId, task.id, nextOrder);
              }}
              className="task-stack"
            >
              <AnimatePresence initial={false}>
                {order
                  .map((id) => subtasks.find((subtask) => subtask.id === id))
                  .filter((subtask): subtask is Task['subtasks'][number] => Boolean(subtask))
                  .map((subtask) => (
                    <SubtaskRow key={subtask.id} listId={listId} taskId={task.id} subtask={subtask} />
                  ))}
              </AnimatePresence>
            </Reorder.Group>
          </motion.div>
        </motion.section>
      ) : null}
    </AnimatePresence>
  );
};

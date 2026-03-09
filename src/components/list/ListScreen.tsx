import { motion } from 'framer-motion';
import { Trash2 } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useHorizontalSwipe } from '../../hooks/useHorizontalSwipe';
import { useLongPress } from '../../hooks/useLongPress';
import { usePinchToOverview } from '../../hooks/usePinchToOverview';
import { usePullToCreate } from '../../hooks/usePullToCreate';
import { useListStore } from '../../store/useListStore';
import type { List, Task } from '../../types/models';
import { TaskRow } from './TaskRow';

interface ListScreenProps {
  list: List;
  settinglessOpen: boolean;
}

export const ListScreen = ({ list, settinglessOpen }: ListScreenProps): JSX.Element => {
  const addTask = useListStore((state) => state.addTask);
  const updateTaskTitle = useListStore((state) => state.updateTaskTitle);
  const toggleTask = useListStore((state) => state.toggleTask);
  const deleteTask = useListStore((state) => state.deleteTask);
  const clearCompletedTasks = useListStore((state) => state.clearCompletedTasks);
  const addSubtask = useListStore((state) => state.addSubtask);
  const updateSubtaskTitle = useListStore((state) => state.updateSubtaskTitle);
  const toggleSubtask = useListStore((state) => state.toggleSubtask);
  const deleteSubtask = useListStore((state) => state.deleteSubtask);
  const moveActiveListBy = useListStore((state) => state.moveActiveListBy);
  const openOverview = useListStore((state) => state.openOverview);

  const [draftTitle, setDraftTitle] = useState('');
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [showPullComposer, setShowPullComposer] = useState(false);

  const composerInputRef = useRef<HTMLInputElement | null>(null);

  const tasks = useMemo(() => list.tasks, [list.tasks]);
  const completedTaskCount = useMemo(() => tasks.filter((task) => task.completed).length, [tasks]);

  useEffect(() => {
    if (expandedTaskId && !tasks.some((task) => task.id === expandedTaskId)) {
      setExpandedTaskId(null);
    }
  }, [expandedTaskId, tasks]);

  useEffect(() => {
    if (!showPullComposer) {
      return;
    }

    requestAnimationFrame(() => {
      composerInputRef.current?.focus();
      composerInputRef.current?.select();
    });
  }, [showPullComposer]);

  const listTitleSwipe = useHorizontalSwipe({
    onSwipeLeft: () => moveActiveListBy(1),
    onSwipeRight: () => moveActiveListBy(-1),
    threshold: 60
  });

  const pinch = usePinchToOverview({
    onPinchIn: openOverview,
    threshold: 42,
    disabled: settinglessOpen
  });

  const pullToCreate = usePullToCreate({
    threshold: 72,
    disabled: settinglessOpen,
    onTrigger: () => {
      flushSync(() => {
        setShowPullComposer(true);
      });

      composerInputRef.current?.focus();
      composerInputRef.current?.click();

      requestAnimationFrame(() => {
        composerInputRef.current?.focus();
      });
    }
  });

  const listTitleLongPress = useLongPress({
    onLongPress: openOverview,
    delay: 430
  });

  const commitPullTaskDraft = () => {
    const trimmed = draftTitle.trim();
    if (trimmed) {
      addTask(list.id, trimmed);
    }

    setDraftTitle('');
    setShowPullComposer(false);
  };

  const handleComposerSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    commitPullTaskDraft();
  };

  return (
    <motion.section
      className="list-shell"
      initial={{ opacity: 0, x: 18 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -18 }}
      onPointerDownCapture={(event) => {
        const target = event.target;
        if (!(target instanceof Element)) {
          return;
        }

        if (expandedTaskId && !target.closest('.task-shell.is-expanded')) {
          setExpandedTaskId(null);
        }
      }}
      onTouchStart={(event) => {
        pullToCreate.bind.onTouchStart(event);
        pinch.onTouchStart(event);
      }}
      onTouchMove={(event) => {
        pullToCreate.bind.onTouchMove(event);
        pinch.onTouchMove(event);
      }}
      onTouchEnd={() => {
        pullToCreate.bind.onTouchEnd();
        pinch.onTouchEnd();
      }}
      onTouchCancel={() => {
        pullToCreate.bind.onTouchCancel();
        pinch.onTouchCancel();
      }}
    >
      <header className="list-header">
        <div
          className="list-title-swipe-zone"
          onTouchStart={listTitleSwipe.onTouchStart}
          onTouchMove={listTitleSwipe.onTouchMove}
          onTouchEnd={listTitleSwipe.onTouchEnd}
          onTouchCancel={listTitleSwipe.onTouchCancel}
          onPointerDown={listTitleLongPress.onPointerDown}
          onPointerUp={listTitleLongPress.onPointerUp}
          onPointerCancel={listTitleLongPress.onPointerCancel}
          onPointerLeave={listTitleLongPress.onPointerLeave}
        >
          <h1>{list.title}</h1>
        </div>

        <div className="header-actions" />
      </header>

      <motion.div
        className={`pull-indicator ${pullToCreate.isReady ? 'is-ready' : ''}`}
        animate={{ height: pullToCreate.distance, opacity: pullToCreate.distance ? 1 : 0 }}
      >
        {pullToCreate.isReady ? 'release to add task' : 'pull to add task'}
      </motion.div>

      {showPullComposer ? (
        <form className="task-create-form task-create-form-inline" onSubmit={handleComposerSubmit} autoComplete="off">
          <input
            ref={composerInputRef}
            autoFocus
            type="text"
            name="task-title-new"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            enterKeyHint="done"
            data-lpignore="true"
            data-form-type="other"
            inputMode="text"
            className="task-create-input"
            value={draftTitle}
            onChange={(event) => setDraftTitle(event.target.value)}
            onBlur={commitPullTaskDraft}
            placeholder="Task name"
          />
        </form>
      ) : null}

      <div className={`task-list ${completedTaskCount > 0 ? 'has-completed-clear' : ''}`} data-scroll-container="tasks">
        {tasks.length === 0 ? <p className="task-empty-state">No tasks yet. Add your first task above.</p> : null}
        {tasks.map((task: Task) => (
          <TaskRow
            key={task.id}
            task={task}
            expanded={expandedTaskId === task.id}
            onExpand={(taskId) => {
              setExpandedTaskId((prev) => (prev === taskId ? null : taskId));
            }}
            onCollapse={() => setExpandedTaskId(null)}
            onToggle={() => toggleTask(list.id, task.id)}
            onDelete={() => {
              if (expandedTaskId === task.id) {
                setExpandedTaskId(null);
              }
              deleteTask(list.id, task.id);
            }}
            onRename={(title) => updateTaskTitle(list.id, task.id, title)}
            onAddSubtask={(title) => addSubtask(list.id, task.id, title)}
            onToggleSubtask={(subtaskId) => toggleSubtask(list.id, task.id, subtaskId)}
            onDeleteSubtask={(subtaskId) => deleteSubtask(list.id, task.id, subtaskId)}
            onRenameSubtask={(subtaskId, title) => updateSubtaskTitle(list.id, task.id, subtaskId, title)}
          />
        ))}
      </div>

      {completedTaskCount > 0 ? (
        <button
          type="button"
          className="completed-clear-fab"
          aria-label={`Delete ${completedTaskCount} completed task${completedTaskCount === 1 ? '' : 's'}`}
          onClick={() => {
            const confirmed = window.confirm(
              `Delete ${completedTaskCount} completed task${completedTaskCount === 1 ? '' : 's'}?`
            );
            if (confirmed) {
              clearCompletedTasks(list.id);
            }
          }}
        >
          <Trash2 size={16} />
          <span className="completed-clear-count">{completedTaskCount}</span>
        </button>
      ) : null}
    </motion.section>
  );
};

import { Check, Pencil, Plus, Square, Trash2 } from 'lucide-react';
import { FormEvent, KeyboardEvent, TouchEvent, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import type { Subtask, Task } from '../../types/models';

interface TaskRowProps {
  task: Task;
  expanded: boolean;
  onExpand: (taskId: string) => void;
  onCollapse: () => void;
  onToggle: () => void;
  onDelete: () => void;
  onRename: (title: string) => void;
  onAddSubtask: (title: string) => void;
  onToggleSubtask: (subtaskId: string) => void;
  onDeleteSubtask: (subtaskId: string) => void;
  onRenameSubtask: (subtaskId: string, title: string) => void;
}

interface SubtaskEditorRowProps {
  subtask: Subtask;
  onToggle: () => void;
  onDelete: () => void;
  onRename: (title: string) => void;
}

const TASK_RAIL_WIDTH = 88;
const SUBTASK_RAIL_WIDTH = 80;

const SubtaskEditorRow = ({ subtask, onToggle, onDelete, onRename }: SubtaskEditorRowProps): JSX.Element => {
  const [draft, setDraft] = useState(subtask.title);
  const [railOpen, setRailOpen] = useState(false);
  const [editing, setEditing] = useState(false);

  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setDraft(subtask.title);
  }, [subtask.title]);

  useEffect(() => {
    if (!editing) {
      return;
    }

    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
  }, [editing]);

  const commit = () => {
    const trimmed = draft.trim();
    if (!trimmed) {
      setDraft(subtask.title);
      setEditing(false);
      return;
    }

    if (trimmed !== subtask.title) {
      onRename(trimmed);
    }

    setEditing(false);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      (event.currentTarget as HTMLInputElement).blur();
    }
  };

  const onTouchStart = (event: TouchEvent<HTMLElement>) => {
    if (event.touches.length !== 1 || editing) {
      swipeStartRef.current = null;
      return;
    }

    const touch = event.touches[0];
    swipeStartRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const onTouchEnd = (event: TouchEvent<HTMLElement>) => {
    const start = swipeStartRef.current;
    swipeStartRef.current = null;

    if (!start || event.changedTouches.length !== 1 || editing) {
      return;
    }

    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - start.x;
    const deltaY = Math.abs(touch.clientY - start.y);

    if (deltaY > Math.abs(deltaX) * 1.1) {
      return;
    }

    if (deltaX <= -48) {
      if (railOpen) {
        setRailOpen(false);
        onDelete();
        return;
      }

      setRailOpen(true);
      return;
    }

    if (deltaX >= 54) {
      onToggle();
      setRailOpen(false);
      return;
    }

    if (Math.abs(deltaX) < 12 && railOpen) {
      setRailOpen(false);
    }
  };

  return (
    <li className="subtask-row-shell-simple">
      <div className="subtask-swipe-rail" aria-hidden={!railOpen}>
        <button
          type="button"
          className="subtask-swipe-action"
          aria-label="Edit subtask"
          onClick={() => {
            setRailOpen(false);
            flushSync(() => {
              setEditing(true);
            });
            inputRef.current?.focus();
            inputRef.current?.click();
          }}
        >
          <Pencil size={14} />
        </button>
        <button
          type="button"
          className="subtask-swipe-action"
          aria-label="Delete subtask"
          onClick={() => {
            setRailOpen(false);
            onDelete();
          }}
        >
          <Trash2 size={14} />
        </button>
      </div>

      <div
        className="subtask-row-simple"
        style={{ transform: railOpen ? `translateX(-${SUBTASK_RAIL_WIDTH}px)` : 'translateX(0)' }}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onTouchCancel={() => {
          swipeStartRef.current = null;
        }}
      >
        <button
          type="button"
          className={`subtask-toggle-button ${subtask.completed ? 'is-complete' : ''}`}
          onClick={onToggle}
          aria-label={subtask.completed ? 'Mark subtask incomplete' : 'Mark subtask complete'}
        >
          {subtask.completed ? (
            <span className="check-wrap">
              <Square size={16} />
              <Check size={12} />
            </span>
          ) : (
            <Square size={16} />
          )}
        </button>

        {editing ? (
          <input
            ref={inputRef}
            type="text"
            name="subtask-title-edit"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            enterKeyHint="done"
            data-lpignore="true"
            data-form-type="other"
            className={`subtask-row-input ${subtask.completed ? 'is-complete' : ''}`}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={commit}
            onKeyDown={onKeyDown}
          />
        ) : (
          <button
            type="button"
            className={`subtask-title-button ${subtask.completed ? 'is-complete' : ''}`}
            onClick={() => {
              flushSync(() => {
                setEditing(true);
              });
              inputRef.current?.focus();
              inputRef.current?.click();
            }}
          >
            {subtask.title}
          </button>
        )}
      </div>
    </li>
  );
};

export const TaskRow = ({
  task,
  expanded,
  onExpand,
  onCollapse,
  onToggle,
  onDelete,
  onRename,
  onAddSubtask,
  onToggleSubtask,
  onDeleteSubtask,
  onRenameSubtask
}: TaskRowProps): JSX.Element => {
  const [taskTitleDraft, setTaskTitleDraft] = useState(task.title);
  const [subtaskDraft, setSubtaskDraft] = useState('');
  const [taskRailOpen, setTaskRailOpen] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);

  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);
  const titleInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setTaskTitleDraft(task.title);
  }, [task.title]);

  useEffect(() => {
    if (!expanded) {
      setTaskRailOpen(false);
    }
  }, [expanded]);

  useEffect(() => {
    if (!editingTitle) {
      return;
    }

    requestAnimationFrame(() => {
      titleInputRef.current?.focus();
      titleInputRef.current?.select();
    });
  }, [editingTitle]);

  const doneSubtasks = useMemo(
    () => task.subtasks.filter((subtask) => subtask.completed).length,
    [task.subtasks]
  );

  const commitTaskTitle = () => {
    const trimmed = taskTitleDraft.trim();
    if (!trimmed) {
      setTaskTitleDraft(task.title);
      setEditingTitle(false);
      return;
    }

    if (trimmed !== task.title) {
      onRename(trimmed);
    }

    setEditingTitle(false);
  };

  const saveTaskTitle = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    commitTaskTitle();
  };

  const addSubtask = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmed = subtaskDraft.trim();
    if (!trimmed) {
      return;
    }

    onAddSubtask(trimmed);
    setSubtaskDraft('');
  };

  const onTaskTouchStart = (event: TouchEvent<HTMLElement>) => {
    if (event.touches.length !== 1 || editingTitle) {
      swipeStartRef.current = null;
      return;
    }

    const touch = event.touches[0];
    swipeStartRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const onTaskTouchEnd = (event: TouchEvent<HTMLElement>) => {
    const start = swipeStartRef.current;
    swipeStartRef.current = null;

    if (!start || event.changedTouches.length !== 1 || editingTitle) {
      return;
    }

    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - start.x;
    const deltaY = Math.abs(touch.clientY - start.y);

    if (deltaY > Math.abs(deltaX) * 1.1) {
      return;
    }

    if (deltaX <= -56) {
      if (taskRailOpen) {
        setTaskRailOpen(false);
        onDelete();
        return;
      }

      setTaskRailOpen(true);
      return;
    }

    if (deltaX >= 62) {
      onToggle();
      setTaskRailOpen(false);
      return;
    }

    if (Math.abs(deltaX) < 12 && taskRailOpen) {
      setTaskRailOpen(false);
    }
  };

  return (
    <article className={`task-shell ${task.completed ? 'is-complete' : ''} ${expanded ? 'is-expanded' : ''}`}>
      <div className="task-swipe-rail" aria-hidden={!taskRailOpen}>
        <button
          type="button"
          className="task-swipe-action"
          aria-label="Edit task"
          onClick={() => {
            setTaskRailOpen(false);
            flushSync(() => {
              setEditingTitle(true);
            });
            titleInputRef.current?.focus();
            titleInputRef.current?.click();
          }}
        >
          <Pencil size={15} />
        </button>
        <button
          type="button"
          className="task-swipe-action"
          aria-label="Delete task"
          onClick={() => {
            setTaskRailOpen(false);
            onDelete();
          }}
        >
          <Trash2 size={15} />
        </button>
      </div>

      <div
        className="task-card-head"
        style={{ transform: taskRailOpen ? `translateX(-${TASK_RAIL_WIDTH}px)` : 'translateX(0)' }}
        onTouchStart={onTaskTouchStart}
        onTouchEnd={onTaskTouchEnd}
        onTouchCancel={() => {
          swipeStartRef.current = null;
        }}
      >
        <button
          type="button"
          className={`task-check-button ${task.completed ? 'is-complete' : ''}`}
          onClick={onToggle}
          aria-label={task.completed ? 'Mark task incomplete' : 'Mark task complete'}
        >
          {task.completed ? (
            <span className="check-wrap">
              <Square size={17} />
              <Check size={12} />
            </span>
          ) : (
            <Square size={17} />
          )}
        </button>

        {editingTitle ? (
          <form className="task-title-inline-form" onSubmit={saveTaskTitle} autoComplete="off">
            <input
              ref={titleInputRef}
              type="text"
              name="task-title-edit"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              enterKeyHint="done"
              data-lpignore="true"
              data-form-type="other"
              className="task-title-inline-input"
              value={taskTitleDraft}
              onChange={(event) => setTaskTitleDraft(event.target.value)}
              onBlur={commitTaskTitle}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  commitTaskTitle();
                }
              }}
            />
          </form>
        ) : (
          <button
            type="button"
            className="task-title-button"
            onClick={() => {
              if (expanded) {
                onCollapse();
              } else {
                onExpand(task.id);
              }
            }}
          >
            <span className="task-title-line">
              <span className="task-title-text">{task.title}</span>
              {task.subtasks.length > 0 ? <span className="task-meta-text">{doneSubtasks}/{task.subtasks.length}</span> : null}
            </span>
          </button>
        )}

      </div>

      {expanded ? (
        <section className="task-editor">
          <section className="subtask-section">
            <ul className="subtask-list-simple">
              {task.subtasks.map((subtask) => (
                <SubtaskEditorRow
                  key={subtask.id}
                  subtask={subtask}
                  onToggle={() => onToggleSubtask(subtask.id)}
                  onDelete={() => onDeleteSubtask(subtask.id)}
                  onRename={(title) => onRenameSubtask(subtask.id, title)}
                />
              ))}
            </ul>

            <form className="subtask-add-form" onSubmit={addSubtask} autoComplete="off">
              <input
                type="text"
                name="subtask-title-new"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                enterKeyHint="done"
                data-lpignore="true"
                data-form-type="other"
                className="subtask-add-input"
                value={subtaskDraft}
                onChange={(event) => setSubtaskDraft(event.target.value)}
                placeholder="Add subtask"
              />
              <button type="submit" className="subtask-add-button" aria-label="Add subtask">
                <Plus size={16} />
              </button>
            </form>
          </section>
        </section>
      ) : null}
    </article>
  );
};

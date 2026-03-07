import { AnimatePresence, motion } from 'framer-motion';
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react';
import { type FormEvent, type TouchEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useTimeReminderStore } from '../../store/useTimeReminderStore';
import type { TimeReminder } from '../../types/models';

const TIME_REMINDER_RAIL_WIDTH = 88;
const CLOCK_FORMAT_STORAGE_KEY = 'timeless-clock-format-v1';
const WEEKDAY_LABELS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const;
const MONTH_LABELS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'] as const;

type ClockFormat = '24h' | '12h';

const pad2 = (value: number): string => value.toString().padStart(2, '0');

const formatTime24 = (date: Date, includeSeconds: boolean): string => {
  const base = `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
  if (!includeSeconds) {
    return base;
  }

  return `${base}:${pad2(date.getSeconds())}`;
};

const formatTime12 = (date: Date): string => {
  const hours24 = date.getHours();
  const hours12 = hours24 % 12 || 12;
  const suffix = hours24 >= 12 ? 'PM' : 'AM';
  return `${pad2(hours12)}:${pad2(date.getMinutes())} ${suffix}`;
};

const formatClockTime = (date: Date, clockFormat: ClockFormat, showMinutesOnly: boolean): string => {
  if (clockFormat === '12h') {
    return formatTime12(date);
  }

  return formatTime24(date, !showMinutesOnly);
};

const formatDate = (date: Date): string => {
  return `${WEEKDAY_LABELS[date.getDay()]} ${MONTH_LABELS[date.getMonth()]} ${pad2(date.getDate())} ${date.getFullYear()}`;
};

const loadClockFormat = (): ClockFormat => {
  if (typeof window === 'undefined') {
    return '24h';
  }

  const stored = window.localStorage.getItem(CLOCK_FORMAT_STORAGE_KEY);
  return stored === '12h' ? '12h' : '24h';
};

const saveClockFormat = (clockFormat: ClockFormat): void => {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(CLOCK_FORMAT_STORAGE_KEY, clockFormat);
};

const toDateInputValue = (timestamp: number): string => {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
};

const toTimeInputValue = (timestamp: number): string => {
  const date = new Date(timestamp);
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
};

const formatReminderDate = (timestamp: number): string => {
  const date = new Date(timestamp);
  return `${pad2(date.getMonth() + 1)}/${pad2(date.getDate())}/${date.getFullYear()}`;
};

const formatReminderTime = (timestamp: number): string => {
  const date = new Date(timestamp);
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
};

const resolveDateTime = (dateValue: string, timeValue: string): number | null => {
  if (!dateValue || !timeValue) {
    return null;
  }

  const [yearText, monthText, dayText] = dateValue.split('-');
  const [hourText, minuteText] = timeValue.split(':');

  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    !Number.isInteger(hour) ||
    !Number.isInteger(minute)
  ) {
    return null;
  }

  const value = new Date(year, month - 1, day, hour, minute, 0, 0).getTime();
  if (!Number.isFinite(value)) {
    return null;
  }

  return value;
};

const reminderSort = (a: TimeReminder, b: TimeReminder): number => {
  return a.fireAt - b.fireAt || a.createdAt - b.createdAt || a.id.localeCompare(b.id);
};

const createDefaultDateTime = (): { date: string; time: string } => {
  const seed = Date.now() + 15 * 60 * 1000;
  return {
    date: toDateInputValue(seed),
    time: toTimeInputValue(seed)
  };
};

export const TimelessHomeScreen = (): JSX.Element => {
  const reminders = useTimeReminderStore((state) => state.reminders);
  const createReminder = useTimeReminderStore((state) => state.createReminder);
  const updateReminder = useTimeReminderStore((state) => state.updateReminder);
  const toggleReminderCanceled = useTimeReminderStore((state) => state.toggleReminderCanceled);
  const toggleReminderCompleted = useTimeReminderStore((state) => state.toggleReminderCompleted);
  const deleteReminder = useTimeReminderStore((state) => state.deleteReminder);

  const [now, setNow] = useState(() => new Date());
  const [clockFormat, setClockFormat] = useState<ClockFormat>(() => loadClockFormat());

  const [showCreateEditor, setShowCreateEditor] = useState(false);
  const [createNameDraft, setCreateNameDraft] = useState('Reminder');
  const [createDateDraft, setCreateDateDraft] = useState(() => createDefaultDateTime().date);
  const [createTimeDraft, setCreateTimeDraft] = useState(() => createDefaultDateTime().time);
  const [createError, setCreateError] = useState('');

  const [editingReminderId, setEditingReminderId] = useState<string | null>(null);
  const [editingNameDraft, setEditingNameDraft] = useState('');
  const [editingDateDraft, setEditingDateDraft] = useState('');
  const [editingTimeDraft, setEditingTimeDraft] = useState('');
  const [editingError, setEditingError] = useState('');

  const [openRailReminderId, setOpenRailReminderId] = useState<string | null>(null);
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const timerId = window.setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => {
      window.clearInterval(timerId);
    };
  }, []);

  useEffect(() => {
    saveClockFormat(clockFormat);
  }, [clockFormat]);

  useEffect(() => {
    if (!editingReminderId) {
      return;
    }

    const exists = reminders.some((reminder) => reminder.id === editingReminderId);
    if (!exists) {
      setEditingReminderId(null);
      setEditingNameDraft('');
      setEditingDateDraft('');
      setEditingTimeDraft('');
      setEditingError('');
    }
  }, [editingReminderId, reminders]);

  const orderedReminders = useMemo(() => [...reminders].sort(reminderSort), [reminders]);

  const hasReminders = orderedReminders.length > 0;
  const showReminderPanel = hasReminders || showCreateEditor;
  const isSettingReminder = showCreateEditor || editingReminderId !== null;
  const clockText = formatClockTime(now, clockFormat, isSettingReminder);

  const resetCreateDraft = () => {
    const defaults = createDefaultDateTime();
    setCreateNameDraft('Reminder');
    setCreateDateDraft(defaults.date);
    setCreateTimeDraft(defaults.time);
    setCreateError('');
  };

  const openCreate = () => {
    resetCreateDraft();
    setEditingReminderId(null);
    setEditingNameDraft('');
    setEditingDateDraft('');
    setEditingTimeDraft('');
    setEditingError('');
    setOpenRailReminderId(null);
    setShowCreateEditor(true);
  };

  const closeCreate = () => {
    setShowCreateEditor(false);
    resetCreateDraft();
  };

  const submitCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const fireAt = resolveDateTime(createDateDraft, createTimeDraft);
    if (!fireAt || fireAt <= Date.now()) {
      setCreateError('Choose a future date and time.');
      return;
    }

    const result = await createReminder({
      name: createNameDraft,
      fireAt
    });

    if (!result.ok) {
      setCreateError(result.message ?? 'Unable to create reminder.');
      return;
    }

    closeCreate();
  };

  const startEditingReminder = (reminder: TimeReminder) => {
    setShowCreateEditor(false);
    setCreateError('');
    setOpenRailReminderId(null);
    setEditingReminderId(reminder.id);
    setEditingNameDraft(reminder.name);
    setEditingDateDraft(toDateInputValue(reminder.fireAt));
    setEditingTimeDraft(toTimeInputValue(reminder.fireAt));
    setEditingError('');
  };

  const cancelEditingReminder = () => {
    setEditingReminderId(null);
    setEditingNameDraft('');
    setEditingDateDraft('');
    setEditingTimeDraft('');
    setEditingError('');
  };

  const submitReminderEdit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!editingReminderId) {
      return;
    }

    const fireAt = resolveDateTime(editingDateDraft, editingTimeDraft);
    if (!fireAt || fireAt <= Date.now()) {
      setEditingError('Choose a future date and time.');
      return;
    }

    const result = await updateReminder(editingReminderId, {
      name: editingNameDraft,
      fireAt
    });

    if (!result.ok) {
      setEditingError(result.message ?? 'Unable to update reminder.');
      return;
    }

    cancelEditingReminder();
  };

  const onReminderTouchStart = (reminderId: string) => (event: TouchEvent<HTMLElement>) => {
    if (event.touches.length !== 1 || editingReminderId === reminderId || showCreateEditor) {
      swipeStartRef.current = null;
      return;
    }

    const touch = event.touches[0];
    swipeStartRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const onReminderTouchEnd = (reminder: TimeReminder) => (event: TouchEvent<HTMLElement>) => {
    const start = swipeStartRef.current;
    swipeStartRef.current = null;

    if (!start || event.changedTouches.length !== 1 || editingReminderId === reminder.id || showCreateEditor) {
      return;
    }

    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - start.x;
    const deltaY = Math.abs(touch.clientY - start.y);

    if (deltaY > Math.abs(deltaX) * 1.1) {
      return;
    }

    if (deltaX <= -54) {
      if (openRailReminderId === reminder.id) {
        deleteReminder(reminder.id);
        setOpenRailReminderId(null);
        return;
      }

      setOpenRailReminderId(reminder.id);
      return;
    }

    if (deltaX >= 58) {
      toggleReminderCompleted(reminder.id);
      setOpenRailReminderId(null);
      return;
    }

    if (Math.abs(deltaX) < 12 && openRailReminderId === reminder.id) {
      setOpenRailReminderId(null);
    }
  };

  return (
    <motion.section
      className={`overview-shell timeless-shell ${showReminderPanel ? 'has-reminders' : ''}`}
      initial={{ opacity: 0, scale: 0.99 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.99 }}
      onPointerDownCapture={(event) => {
        const target = event.target;
        if (!(target instanceof Element)) {
          return;
        }

        if (openRailReminderId && !target.closest('.timeless-reminder-shell')) {
          setOpenRailReminderId(null);
        }

        if (
          showCreateEditor &&
          !target.closest('.timeless-reminder-form') &&
          !target.closest('.timeless-add-fab')
        ) {
          closeCreate();
        }
      }}
    >
      <motion.div
        className="timeless-content"
        aria-live="polite"
        aria-atomic="true"
        animate={{ y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 280, damping: 30, mass: 0.75 }}
      >
        <button
          type="button"
          className="timeless-time timeless-time-toggle"
          onClick={() => {
            setClockFormat((prev) => (prev === '24h' ? '12h' : '24h'));
          }}
          aria-label={`Switch to ${clockFormat === '24h' ? '12-hour' : '24-hour'} time format`}
        >
          {clockText}
        </button>
        <p className="timeless-date">{formatDate(now)}</p>
      </motion.div>

      <AnimatePresence initial={false}>
        {showReminderPanel ? (
          <motion.section
            key="timeless-reminder-panel"
            className="timeless-reminder-panel"
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.2 }}
          >
            {showCreateEditor ? (
              <form className="timeless-reminder-form" onSubmit={submitCreate}>
                <input
                  type="text"
                  className="timeless-reminder-input"
                  value={createNameDraft}
                  onChange={(event) => setCreateNameDraft(event.target.value)}
                  maxLength={64}
                  placeholder="Reminder name"
                  aria-label="Reminder name"
                />
                <input
                  type="date"
                  className="timeless-reminder-input timeless-reminder-input-date"
                  value={createDateDraft}
                  onChange={(event) => setCreateDateDraft(event.target.value)}
                  aria-label="Reminder date"
                />
                <input
                  type="time"
                  className="timeless-reminder-input timeless-reminder-input-time"
                  value={createTimeDraft}
                  onChange={(event) => setCreateTimeDraft(event.target.value)}
                  step={60}
                  aria-label="Reminder time"
                />
                <button type="submit" className="timeless-reminder-icon" aria-label="Save reminder">
                  <Check size={15} />
                </button>
                <button
                  type="button"
                  className="timeless-reminder-icon"
                  onClick={closeCreate}
                  aria-label="Cancel new reminder"
                >
                  <X size={15} />
                </button>
              </form>
            ) : null}

            {createError ? <p className="muted timeless-reminder-error">{createError}</p> : null}

            <div className="timeless-reminder-list">
              {orderedReminders.map((reminder) => {
                const railOpen = openRailReminderId === reminder.id;
                const isEditing = editingReminderId === reminder.id;

                return (
                  <article key={reminder.id} className="timeless-reminder-shell">
                    <div className="timeless-reminder-swipe-rail" aria-hidden={!railOpen}>
                      <button
                        type="button"
                        className="timeless-reminder-swipe-action"
                        aria-label="Edit reminder"
                        onClick={() => {
                          startEditingReminder(reminder);
                        }}
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        className="timeless-reminder-swipe-action"
                        aria-label="Delete reminder"
                        onClick={() => {
                          deleteReminder(reminder.id);
                          setOpenRailReminderId(null);
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>

                    {isEditing ? (
                      <form
                        className="timeless-reminder-row timeless-reminder-edit-form"
                        onSubmit={submitReminderEdit}
                      >
                        <input
                          type="text"
                          className="timeless-reminder-input"
                          value={editingNameDraft}
                          onChange={(event) => setEditingNameDraft(event.target.value)}
                          maxLength={64}
                          placeholder="Reminder name"
                          aria-label="Reminder name"
                        />
                        <input
                          type="date"
                          className="timeless-reminder-input timeless-reminder-input-date"
                          value={editingDateDraft}
                          onChange={(event) => setEditingDateDraft(event.target.value)}
                          aria-label="Reminder date"
                        />
                        <input
                          type="time"
                          className="timeless-reminder-input timeless-reminder-input-time"
                          value={editingTimeDraft}
                          onChange={(event) => setEditingTimeDraft(event.target.value)}
                          step={60}
                          aria-label="Reminder time"
                        />
                        <button type="submit" className="timeless-reminder-icon" aria-label="Save reminder">
                          <Check size={15} />
                        </button>
                        <button
                          type="button"
                          className="timeless-reminder-icon"
                          onClick={cancelEditingReminder}
                          aria-label="Cancel editing reminder"
                        >
                          <X size={15} />
                        </button>
                      </form>
                    ) : (
                      <div
                        className={`timeless-reminder-row ${reminder.completed ? 'is-done' : ''} ${reminder.canceled ? 'is-canceled' : ''}`}
                        style={{ transform: railOpen ? `translateX(-${TIME_REMINDER_RAIL_WIDTH}px)` : 'translateX(0)' }}
                        onTouchStart={onReminderTouchStart(reminder.id)}
                        onTouchEnd={onReminderTouchEnd(reminder)}
                        onTouchCancel={() => {
                          swipeStartRef.current = null;
                        }}
                      >
                        <span className="timeless-reminder-name">{reminder.name}</span>
                        <span className="timeless-reminder-date-cell">{formatReminderDate(reminder.fireAt)}</span>
                        <span className="timeless-reminder-time-cell">{formatReminderTime(reminder.fireAt)}</span>
                        <button
                          type="button"
                          className="timeless-reminder-cancel"
                          onClick={() => {
                            toggleReminderCanceled(reminder.id);
                            setOpenRailReminderId(null);
                          }}
                          aria-label={reminder.canceled ? 'Resume reminder' : 'Cancel reminder'}
                        >
                          {reminder.canceled ? 'Canceled' : 'Cancel'}
                        </button>
                      </div>
                    )}

                    {isEditing && editingError ? <p className="muted timeless-reminder-error">{editingError}</p> : null}
                  </article>
                );
              })}
            </div>
          </motion.section>
        ) : null}
      </AnimatePresence>

      <button
        type="button"
        className="overview-add-fab timeless-add-fab"
        onClick={openCreate}
        aria-label="Add reminder"
      >
        <Plus size={18} />
      </button>
    </motion.section>
  );
};

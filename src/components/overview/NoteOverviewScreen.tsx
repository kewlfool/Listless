import { AnimatePresence, motion } from 'framer-motion';
import { LayoutGrid, List, Pencil, Plus, Square, Trash2 } from 'lucide-react';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent
} from 'react';
import { useNoteStore } from '../../store/useNoteStore';
import type { Note, ViewMode } from '../../types/models';
import { noteContentToPlainText } from '../../utils/noteContent';

const viewModeOrder: ViewMode[] = ['card', 'list', 'preview'];

const modeIcon = (mode: ViewMode): JSX.Element => {
  if (mode === 'list') {
    return <List size={17} />;
  }

  if (mode === 'card') {
    return <LayoutGrid size={17} />;
  }

  return <Square size={17} />;
};

const wordCount = (note: Note): number => {
  const trimmed = noteContentToPlainText(note.content).trim();
  if (!trimmed) {
    return 0;
  }

  return trimmed.split(/\s+/).length;
};

const lineCount = (note: Note): number => {
  const trimmed = noteContentToPlainText(note.content).trim();
  if (!trimmed) {
    return 0;
  }

  return trimmed.split(/\r?\n/).length;
};

const charCount = (note: Note): number => {
  return noteContentToPlainText(note.content).length;
};

const previewLines = (note: Note): string[] => {
  const lines = noteContentToPlainText(note.content)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  return lines.slice(0, 10);
};

const noteTitleForAria = (note: Note): string => {
  return note.title || 'note';
};

const NoteMenu = ({
  open,
  onClose,
  onEdit,
  onDelete
}: {
  open: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}): JSX.Element | null => {
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const closeOnOutsidePress = (event: MouseEvent | TouchEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      if (menuRef.current && !menuRef.current.contains(target)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', closeOnOutsidePress);
    document.addEventListener('touchstart', closeOnOutsidePress, { passive: true });

    return () => {
      document.removeEventListener('mousedown', closeOnOutsidePress);
      document.removeEventListener('touchstart', closeOnOutsidePress);
    };
  }, [onClose, open]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="list-menu-wrap"
      ref={menuRef}
      onClick={(event) => {
        event.stopPropagation();
      }}
      onKeyDown={(event) => {
        event.stopPropagation();
      }}
      onPointerDown={(event) => {
        event.stopPropagation();
      }}
    >
      <div className="list-menu-dropdown">
        <button
          type="button"
          className="list-menu-action"
          aria-label="Edit note name"
          onClick={(event) => {
            event.stopPropagation();
            onClose();
            onEdit();
          }}
        >
          <Pencil size={15} />
        </button>
        <button
          type="button"
          className="list-menu-action"
          aria-label="Delete note"
          onClick={(event) => {
            event.stopPropagation();
            onClose();
            const confirmed = window.confirm('Delete this note?');
            if (confirmed) {
              onDelete();
            }
          }}
        >
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  );
};

export const NoteOverviewScreen = (): JSX.Element => {
  const notes = useNoteStore((state) => state.notes);
  const activeNoteId = useNoteStore((state) => state.activeNoteId);
  const viewMode = useNoteStore((state) => state.viewMode);
  const closeOverview = useNoteStore((state) => state.closeOverview);
  const setActiveNote = useNoteStore((state) => state.setActiveNote);
  const setViewMode = useNoteStore((state) => state.setViewMode);
  const createNote = useNoteStore((state) => state.createNote);
  const updateNoteTitle = useNoteStore((state) => state.updateNoteTitle);
  const deleteNote = useNoteStore((state) => state.deleteNote);

  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteTitleDraft, setEditingNoteTitleDraft] = useState('');
  const [openMenuNoteId, setOpenMenuNoteId] = useState<string | null>(null);
  const editNoteInputRef = useRef<HTMLInputElement | null>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const suppressClickNoteIdRef = useRef<string | null>(null);

  const orderedNotes = useMemo(
    () => [...notes].sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id)),
    [notes]
  );

  const selectNote = (noteId: string) => {
    setActiveNote(noteId);
    closeOverview();
  };

  const cycleViewMode = () => {
    const currentIndex = viewModeOrder.indexOf(viewMode);
    const nextMode = viewModeOrder[(currentIndex + 1) % viewModeOrder.length];
    setOpenMenuNoteId(null);
    cancelInlineEdit();
    setViewMode(nextMode);
  };

  const clearLongPressTimer = () => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const editNoteTitle = (note: Note) => {
    setOpenMenuNoteId(null);
    setEditingNoteId(note.id);
    setEditingNoteTitleDraft(note.title);
  };

  useEffect(() => {
    if (!editingNoteId) {
      return;
    }

    requestAnimationFrame(() => {
      editNoteInputRef.current?.focus();
      editNoteInputRef.current?.select();
    });
  }, [editingNoteId]);

  useEffect(() => clearLongPressTimer, []);

  useEffect(() => {
    if (editingNoteId && !orderedNotes.some((note) => note.id === editingNoteId)) {
      setEditingNoteId(null);
      setEditingNoteTitleDraft('');
    }

    if (openMenuNoteId && !orderedNotes.some((note) => note.id === openMenuNoteId)) {
      setOpenMenuNoteId(null);
    }
  }, [editingNoteId, openMenuNoteId, orderedNotes]);

  const cancelInlineEdit = () => {
    setEditingNoteId(null);
    setEditingNoteTitleDraft('');
  };

  const commitInlineEdit = () => {
    if (!editingNoteId) {
      return;
    }

    updateNoteTitle(editingNoteId, editingNoteTitleDraft);

    setOpenMenuNoteId(null);
    cancelInlineEdit();
  };

  const submitInlineEdit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    commitInlineEdit();
  };

  const createAndOpenNote = () => {
    setOpenMenuNoteId(null);
    cancelInlineEdit();
    createNote();
  };

  const startNoteLongPress = (noteId: string) => (event: ReactPointerEvent<HTMLElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) {
      return;
    }

    if (Boolean(editingNoteId)) {
      return;
    }

    const target = event.target;
    if (target instanceof Element && target.closest('input, textarea')) {
      return;
    }

    clearLongPressTimer();
    longPressTimerRef.current = window.setTimeout(() => {
      setOpenMenuNoteId(noteId);
      suppressClickNoteIdRef.current = noteId;
      longPressTimerRef.current = null;
    }, 430);
  };

  const stopNoteLongPress = () => {
    clearLongPressTimer();
  };

  const handleNoteCardClick = (noteId: string) => {
    if (suppressClickNoteIdRef.current === noteId) {
      suppressClickNoteIdRef.current = null;
      return;
    }

    if (editingNoteId === noteId) {
      return;
    }

    selectNote(noteId);
  };

  const showFloatingAddButton = orderedNotes.length > 0;

  const onNoteCardKeyDown = (event: ReactKeyboardEvent<HTMLElement>, noteId: string) => {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }

    event.preventDefault();
    handleNoteCardClick(noteId);
  };

  const handleOverviewPointerDownCapture = (event: ReactPointerEvent<HTMLElement>) => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    if (target.closest('.new-list-inline-form, .list-menu-wrap, input, textarea')) {
      return;
    }

    if (!editingNoteId) {
      return;
    }

    commitInlineEdit();
    event.preventDefault();
    event.stopPropagation();
  };

  return (
    <motion.section
      className="overview-shell"
      initial={{ opacity: 0, scale: 0.99 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.99 }}
      onPointerDownCapture={handleOverviewPointerDownCapture}
    >
      <header className="overview-header overview-header-flat">
        <h1>Noteless</h1>
        <div className="header-actions">
          <button type="button" className="plain-icon-button" onClick={cycleViewMode} aria-label="Switch note view mode">
            {modeIcon(viewMode)}
          </button>
        </div>
      </header>

      <AnimatePresence mode="wait">
        {viewMode === 'card' ? (
          <motion.div
            key="card"
            className={`overview-grid ${showFloatingAddButton ? 'has-floating-add' : ''}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            {orderedNotes.map((note) => {
              const words = wordCount(note);
              const isEditing = editingNoteId === note.id;

              return (
                <article
                  key={note.id}
                  className={`card ${activeNoteId === note.id ? 'is-active' : ''}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleNoteCardClick(note.id)}
                  onKeyDown={(event) => onNoteCardKeyDown(event, note.id)}
                  onPointerDown={startNoteLongPress(note.id)}
                  onPointerUp={stopNoteLongPress}
                  onPointerCancel={stopNoteLongPress}
                  onPointerLeave={stopNoteLongPress}
                  aria-label={`Open ${noteTitleForAria(note)}`}
                >
                  {isEditing ? (
                    <form
                      className="card-main card-main-edit new-list-inline-form"
                      onSubmit={submitInlineEdit}
                      autoComplete="off"
                      onClick={(event) => {
                        event.stopPropagation();
                      }}
                    >
                      <input
                        ref={editNoteInputRef}
                        type="text"
                        name="note-title-inline-edit"
                        autoComplete="off"
                        autoCorrect="off"
                        autoCapitalize="none"
                        spellCheck={false}
                        enterKeyHint="done"
                        data-lpignore="true"
                        data-form-type="other"
                        className="new-list-inline-input"
                        value={editingNoteTitleDraft}
                        onChange={(event) => setEditingNoteTitleDraft(event.target.value)}
                        onBlur={commitInlineEdit}
                        onKeyDown={(event) => {
                          if (event.key === 'Escape') {
                            event.preventDefault();
                            cancelInlineEdit();
                          }
                        }}
                        placeholder="Note name"
                        maxLength={56}
                      />
                    </form>
                  ) : (
                    <button
                      type="button"
                      className="card-main"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleNoteCardClick(note.id);
                      }}
                      aria-label={`Open ${noteTitleForAria(note)}`}
                    >
                      <strong>{note.title}</strong>
                      <span className="card-left-count">{words} word{words === 1 ? '' : 's'}</span>
                    </button>
                  )}

                  {!isEditing ? <span className="card-total-count">{charCount(note)}</span> : null}

                  <NoteMenu
                    open={openMenuNoteId === note.id}
                    onClose={() => setOpenMenuNoteId(null)}
                    onEdit={() => editNoteTitle(note)}
                    onDelete={() => deleteNote(note.id)}
                  />
                </article>
              );
            })}

            {orderedNotes.length === 0 ? (
              <button type="button" className="card add-card" onClick={createAndOpenNote} aria-label="Create note">
                <Plus size={18} />
              </button>
            ) : null}
          </motion.div>
        ) : null}

        {viewMode === 'list' ? (
          <motion.div
            key="list"
            className={`overview-list ${showFloatingAddButton ? 'has-floating-add' : ''}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            {orderedNotes.map((note) => {
              const isEditing = editingNoteId === note.id;
              const lines = lineCount(note);

              return (
                <article
                  key={note.id}
                  className="row-card"
                  role="button"
                  tabIndex={0}
                  onClick={() => handleNoteCardClick(note.id)}
                  onKeyDown={(event) => onNoteCardKeyDown(event, note.id)}
                  onPointerDown={startNoteLongPress(note.id)}
                  onPointerUp={stopNoteLongPress}
                  onPointerCancel={stopNoteLongPress}
                  onPointerLeave={stopNoteLongPress}
                  aria-label={`Open ${noteTitleForAria(note)}`}
                >
                  {isEditing ? (
                    <form
                      className="row-card-main new-list-inline-form"
                      onSubmit={submitInlineEdit}
                      autoComplete="off"
                      onClick={(event) => {
                        event.stopPropagation();
                      }}
                    >
                      <input
                        ref={editNoteInputRef}
                        type="text"
                        name="note-title-inline-edit"
                        autoComplete="off"
                        autoCorrect="off"
                        autoCapitalize="none"
                        spellCheck={false}
                        enterKeyHint="done"
                        data-lpignore="true"
                        data-form-type="other"
                        className="new-list-inline-input"
                        value={editingNoteTitleDraft}
                        onChange={(event) => setEditingNoteTitleDraft(event.target.value)}
                        onBlur={commitInlineEdit}
                        onKeyDown={(event) => {
                          if (event.key === 'Escape') {
                            event.preventDefault();
                            cancelInlineEdit();
                          }
                        }}
                        placeholder="Note name"
                        maxLength={56}
                      />
                    </form>
                  ) : (
                    <button
                      type="button"
                      className="row-card-main"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleNoteCardClick(note.id);
                      }}
                      aria-label={`Open ${noteTitleForAria(note)}`}
                    >
                      <strong>{note.title}</strong>
                      <small>{lines} line{lines === 1 ? '' : 's'}</small>
                    </button>
                  )}

                  <NoteMenu
                    open={openMenuNoteId === note.id}
                    onClose={() => setOpenMenuNoteId(null)}
                    onEdit={() => editNoteTitle(note)}
                    onDelete={() => deleteNote(note.id)}
                  />
                </article>
              );
            })}

            {orderedNotes.length === 0 ? (
              <button type="button" className="row-card add-row" onClick={createAndOpenNote} aria-label="Create note">
                <Plus size={18} />
              </button>
            ) : null}
          </motion.div>
        ) : null}

        {viewMode === 'preview' ? (
          <motion.div
            key="preview"
            className={`preview-grid ${showFloatingAddButton ? 'has-floating-add' : ''}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            {orderedNotes.map((note) => {
              const isEditing = editingNoteId === note.id;
              const lines = previewLines(note);

              return (
                <article
                  key={note.id}
                  className="preview-card"
                  role="button"
                  tabIndex={0}
                  onClick={() => handleNoteCardClick(note.id)}
                  onKeyDown={(event) => onNoteCardKeyDown(event, note.id)}
                  onPointerDown={startNoteLongPress(note.id)}
                  onPointerUp={stopNoteLongPress}
                  onPointerCancel={stopNoteLongPress}
                  onPointerLeave={stopNoteLongPress}
                  aria-label={`Open ${noteTitleForAria(note)}`}
                >
                  <header>
                    {isEditing ? (
                      <form
                        className="preview-card-main new-list-inline-form"
                        onSubmit={submitInlineEdit}
                        autoComplete="off"
                        onClick={(event) => {
                          event.stopPropagation();
                        }}
                      >
                        <input
                          ref={editNoteInputRef}
                          type="text"
                          name="note-title-inline-edit"
                          autoComplete="off"
                          autoCorrect="off"
                          autoCapitalize="none"
                          spellCheck={false}
                          enterKeyHint="done"
                          data-lpignore="true"
                          data-form-type="other"
                          className="new-list-inline-input"
                          value={editingNoteTitleDraft}
                          onChange={(event) => setEditingNoteTitleDraft(event.target.value)}
                          onBlur={commitInlineEdit}
                          onKeyDown={(event) => {
                            if (event.key === 'Escape') {
                              event.preventDefault();
                              cancelInlineEdit();
                            }
                          }}
                          placeholder="Note name"
                          maxLength={56}
                        />
                      </form>
                    ) : (
                      <button
                        type="button"
                        className="preview-card-main"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleNoteCardClick(note.id);
                        }}
                        aria-label={`Open ${noteTitleForAria(note)}`}
                      >
                        <strong>{note.title}</strong>
                      </button>
                    )}

                    <NoteMenu
                      open={openMenuNoteId === note.id}
                      onClose={() => setOpenMenuNoteId(null)}
                      onEdit={() => editNoteTitle(note)}
                      onDelete={() => deleteNote(note.id)}
                    />
                  </header>
                  <ul className="thumbnail-task-list">
                    {lines.length > 0 ? (
                      lines.map((line, index) => <li key={`${note.id}-${index}`}>{line}</li>)
                    ) : (
                      <li className="muted">Empty note</li>
                    )}
                  </ul>
                </article>
              );
            })}

            {orderedNotes.length === 0 ? (
              <button type="button" className="preview-card add-preview" onClick={createAndOpenNote} aria-label="Create note">
                <Plus size={18} />
              </button>
            ) : null}
          </motion.div>
        ) : null}
      </AnimatePresence>

      {showFloatingAddButton ? (
        <button type="button" className="overview-add-fab" onClick={createAndOpenNote} aria-label="Add note">
          <Plus size={18} />
        </button>
      ) : null}
    </motion.section>
  );
};

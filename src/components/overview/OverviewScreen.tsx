import { AnimatePresence, motion } from 'framer-motion';
import { LayoutGrid, List, Pencil, Plus, Square, Trash2 } from 'lucide-react';
import {
  type FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent
} from 'react';
import { useListStore } from '../../store/useListStore';
import type { List as ListModel, ViewMode } from '../../types/models';

interface OverviewScreenProps {
  startCreateDraftSeq?: number;
  onStartCreateDraftHandled?: (seq: number) => void;
}

const viewModeOrder: ViewMode[] = ['card', 'list', 'preview'];

const taskCountLabel = (list: ListModel): string => {
  const count = list.tasks.length;
  return `${count} task${count === 1 ? '' : 's'}`;
};

const modeIcon = (mode: ViewMode): JSX.Element => {
  if (mode === 'list') {
    return <List size={17} />;
  }

  if (mode === 'card') {
    return <LayoutGrid size={17} />;
  }

  return <Square size={17} />;
};

const ListMenu = ({
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
          aria-label="Edit list name"
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
          aria-label="Delete list"
          onClick={(event) => {
            event.stopPropagation();
            onClose();
            const confirmed = window.confirm('Delete this list?');
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

export const OverviewScreen = ({
  startCreateDraftSeq = 0,
  onStartCreateDraftHandled
}: OverviewScreenProps): JSX.Element => {
  const lists = useListStore((state) => state.lists);
  const activeListId = useListStore((state) => state.activeListId);
  const viewMode = useListStore((state) => state.viewMode);
  const closeOverview = useListStore((state) => state.closeOverview);
  const openOverview = useListStore((state) => state.openOverview);
  const setActiveList = useListStore((state) => state.setActiveList);
  const setViewMode = useListStore((state) => state.setViewMode);
  const createList = useListStore((state) => state.createList);
  const updateListTitle = useListStore((state) => state.updateListTitle);
  const deleteList = useListStore((state) => state.deleteList);
  const [isCreatingInline, setIsCreatingInline] = useState(false);
  const [newListTitleDraft, setNewListTitleDraft] = useState('');
  const [editingListId, setEditingListId] = useState<string | null>(null);
  const [editingListTitleDraft, setEditingListTitleDraft] = useState('');
  const [openMenuListId, setOpenMenuListId] = useState<string | null>(null);
  const newListInputRef = useRef<HTMLInputElement | null>(null);
  const editListInputRef = useRef<HTMLInputElement | null>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const suppressClickListIdRef = useRef<string | null>(null);

  const orderedLists = useMemo(
    () => [...lists].sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id)),
    [lists]
  );

  const selectList = (listId: string) => {
    setActiveList(listId);
    closeOverview();
  };

  const cycleViewMode = () => {
    const currentIndex = viewModeOrder.indexOf(viewMode);
    const nextMode = viewModeOrder[(currentIndex + 1) % viewModeOrder.length];
    setOpenMenuListId(null);
    cancelInlineCreate();
    cancelInlineEdit();
    setViewMode(nextMode);
  };

  const clearLongPressTimer = () => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const editListTitle = (list: ListModel) => {
    setIsCreatingInline(false);
    setNewListTitleDraft('');
    setOpenMenuListId(null);
    setEditingListId(list.id);
    setEditingListTitleDraft(list.title);
  };

  useEffect(() => {
    if (!isCreatingInline) {
      return;
    }

    requestAnimationFrame(() => {
      newListInputRef.current?.focus();
      newListInputRef.current?.select();
    });
  }, [isCreatingInline]);

  useEffect(() => {
    if (!editingListId) {
      return;
    }

    requestAnimationFrame(() => {
      editListInputRef.current?.focus();
      editListInputRef.current?.select();
    });
  }, [editingListId]);

  useEffect(() => clearLongPressTimer, []);

  useEffect(() => {
    if (editingListId && !orderedLists.some((list) => list.id === editingListId)) {
      setEditingListId(null);
      setEditingListTitleDraft('');
    }

    if (openMenuListId && !orderedLists.some((list) => list.id === openMenuListId)) {
      setOpenMenuListId(null);
    }
  }, [editingListId, openMenuListId, orderedLists]);

  useEffect(() => {
    if (startCreateDraftSeq < 1) {
      return;
    }

    setEditingListId(null);
    setEditingListTitleDraft('');
    setOpenMenuListId(null);
    setNewListTitleDraft('');
    setIsCreatingInline(true);
    onStartCreateDraftHandled?.(startCreateDraftSeq);
  }, [onStartCreateDraftHandled, startCreateDraftSeq]);

  const startInlineCreate = () => {
    setEditingListId(null);
    setEditingListTitleDraft('');
    setOpenMenuListId(null);
    setNewListTitleDraft('');
    setIsCreatingInline(true);
  };

  const cancelInlineCreate = () => {
    setIsCreatingInline(false);
    setNewListTitleDraft('');
  };

  const commitInlineCreate = () => {
    const createdId = createList(newListTitleDraft);
    if (!createdId) {
      cancelInlineCreate();
      return;
    }

    cancelInlineCreate();
    setOpenMenuListId(null);
    openOverview();
  };

  const submitInlineCreate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    commitInlineCreate();
  };

  const cancelInlineEdit = () => {
    setEditingListId(null);
    setEditingListTitleDraft('');
  };

  const commitInlineEdit = () => {
    if (!editingListId) {
      return;
    }

    const trimmed = editingListTitleDraft.trim();
    if (trimmed) {
      updateListTitle(editingListId, trimmed);
    }

    setOpenMenuListId(null);
    cancelInlineEdit();
  };

  const submitInlineEdit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    commitInlineEdit();
  };

  const startListLongPress = (listId: string) => (event: ReactPointerEvent<HTMLElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) {
      return;
    }

    if (isCreatingInline || Boolean(editingListId)) {
      return;
    }

    const target = event.target;
    if (target instanceof Element && target.closest('input, textarea')) {
      return;
    }

    clearLongPressTimer();
    longPressTimerRef.current = window.setTimeout(() => {
      setOpenMenuListId(listId);
      suppressClickListIdRef.current = listId;
      longPressTimerRef.current = null;
    }, 430);
  };

  const stopListLongPress = () => {
    clearLongPressTimer();
  };

  const handleListCardClick = (listId: string) => {
    if (suppressClickListIdRef.current === listId) {
      suppressClickListIdRef.current = null;
      return;
    }

    if (editingListId === listId) {
      return;
    }

    selectList(listId);
  };

  const showFloatingAddButton = orderedLists.length > 0 && !isCreatingInline;

  const onListCardKeyDown = (event: ReactKeyboardEvent<HTMLElement>, listId: string) => {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }

    event.preventDefault();
    handleListCardClick(listId);
  };

  const handleOverviewPointerDownCapture = (event: ReactPointerEvent<HTMLElement>) => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    if (target.closest('.new-list-inline-form, .list-menu-wrap, input, textarea')) {
      return;
    }

    let shouldConsume = false;

    if (isCreatingInline) {
      commitInlineCreate();
      shouldConsume = true;
    }

    if (editingListId) {
      commitInlineEdit();
      shouldConsume = true;
    }

    if (shouldConsume) {
      event.preventDefault();
      event.stopPropagation();
    }
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
        <h1>Listless</h1>
        <div className="header-actions">
          <button type="button" className="plain-icon-button" onClick={cycleViewMode} aria-label="Switch list view mode">
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
            {orderedLists.map((list) => {
              const undoneCount = list.tasks.filter((task) => !task.completed).length;
              const isEditing = editingListId === list.id;

              return (
                <article
                  key={list.id}
                  className={`card ${activeListId === list.id ? 'is-active' : ''}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleListCardClick(list.id)}
                  onKeyDown={(event) => onListCardKeyDown(event, list.id)}
                  onPointerDown={startListLongPress(list.id)}
                  onPointerUp={stopListLongPress}
                  onPointerCancel={stopListLongPress}
                  onPointerLeave={stopListLongPress}
                  aria-label={`Open ${list.title}`}
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
                        ref={editListInputRef}
                        type="text"
                        name="list-title-inline-edit"
                        autoComplete="off"
                        autoCorrect="off"
                        autoCapitalize="none"
                        spellCheck={false}
                        enterKeyHint="done"
                        data-lpignore="true"
                        data-form-type="other"
                        className="new-list-inline-input"
                        value={editingListTitleDraft}
                        onChange={(event) => setEditingListTitleDraft(event.target.value)}
                        onBlur={commitInlineEdit}
                        onKeyDown={(event) => {
                          if (event.key === 'Escape') {
                            event.preventDefault();
                            cancelInlineEdit();
                          }
                        }}
                        placeholder="List name"
                        maxLength={56}
                      />
                    </form>
                  ) : (
                    <button
                      type="button"
                      className="card-main"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleListCardClick(list.id);
                      }}
                      aria-label={`Open ${list.title}`}
                    >
                      <strong>{list.title}</strong>
                      <span className="card-left-count">{undoneCount} left</span>
                    </button>
                  )}

                  {!isEditing ? <span className="card-total-count">{list.tasks.length}</span> : null}

                  <ListMenu
                    open={openMenuListId === list.id}
                    onClose={() => setOpenMenuListId(null)}
                    onEdit={() => editListTitle(list)}
                    onDelete={() => deleteList(list.id)}
                  />
                </article>
              );
            })}
            {isCreatingInline ? (
              <article className="card add-card new-list-inline-card" aria-label="Create new list">
                <form className="new-list-inline-form" onSubmit={submitInlineCreate} autoComplete="off">
                  <input
                    ref={newListInputRef}
                    type="text"
                    name="list-title-inline-new"
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    enterKeyHint="done"
                    data-lpignore="true"
                    data-form-type="other"
                    className="new-list-inline-input"
                    value={newListTitleDraft}
                    onChange={(event) => setNewListTitleDraft(event.target.value)}
                    onBlur={commitInlineCreate}
                    onKeyDown={(event) => {
                      if (event.key === 'Escape') {
                        event.preventDefault();
                        cancelInlineCreate();
                      }
                    }}
                    placeholder="List name"
                    maxLength={56}
                  />
                </form>
              </article>
            ) : null}

            {!isCreatingInline && orderedLists.length === 0 ? (
              <button type="button" className="card add-card" onClick={startInlineCreate} aria-label="Create list">
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
            {orderedLists.map((list) => {
              const isEditing = editingListId === list.id;

              return (
                <article
                  key={list.id}
                  className="row-card"
                  role="button"
                  tabIndex={0}
                  onClick={() => handleListCardClick(list.id)}
                  onKeyDown={(event) => onListCardKeyDown(event, list.id)}
                  onPointerDown={startListLongPress(list.id)}
                  onPointerUp={stopListLongPress}
                  onPointerCancel={stopListLongPress}
                  onPointerLeave={stopListLongPress}
                  aria-label={`Open ${list.title}`}
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
                        ref={editListInputRef}
                        type="text"
                        name="list-title-inline-edit"
                        autoComplete="off"
                        autoCorrect="off"
                        autoCapitalize="none"
                        spellCheck={false}
                        enterKeyHint="done"
                        data-lpignore="true"
                        data-form-type="other"
                        className="new-list-inline-input"
                        value={editingListTitleDraft}
                        onChange={(event) => setEditingListTitleDraft(event.target.value)}
                        onBlur={commitInlineEdit}
                        onKeyDown={(event) => {
                          if (event.key === 'Escape') {
                            event.preventDefault();
                            cancelInlineEdit();
                          }
                        }}
                        placeholder="List name"
                        maxLength={56}
                      />
                    </form>
                  ) : (
                    <button
                      type="button"
                      className="row-card-main"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleListCardClick(list.id);
                      }}
                      aria-label={`Open ${list.title}`}
                    >
                      <strong>{list.title}</strong>
                      <small>{taskCountLabel(list)}</small>
                    </button>
                  )}

                  <ListMenu
                    open={openMenuListId === list.id}
                    onClose={() => setOpenMenuListId(null)}
                    onEdit={() => editListTitle(list)}
                    onDelete={() => deleteList(list.id)}
                  />
                </article>
              );
            })}
            {isCreatingInline ? (
              <article className="row-card add-row new-list-inline-row" aria-label="Create new list">
                <form className="new-list-inline-form" onSubmit={submitInlineCreate} autoComplete="off">
                  <input
                    ref={newListInputRef}
                    type="text"
                    name="list-title-inline-new"
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    enterKeyHint="done"
                    data-lpignore="true"
                    data-form-type="other"
                    className="new-list-inline-input"
                    value={newListTitleDraft}
                    onChange={(event) => setNewListTitleDraft(event.target.value)}
                    onBlur={commitInlineCreate}
                    onKeyDown={(event) => {
                      if (event.key === 'Escape') {
                        event.preventDefault();
                        cancelInlineCreate();
                      }
                    }}
                    placeholder="List name"
                    maxLength={56}
                  />
                </form>
              </article>
            ) : null}

            {!isCreatingInline && orderedLists.length === 0 ? (
              <button type="button" className="row-card add-row" onClick={startInlineCreate} aria-label="Create list">
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
            {orderedLists.map((list) => {
              const isEditing = editingListId === list.id;

              return (
                <article
                  key={list.id}
                  className="preview-card"
                  role="button"
                  tabIndex={0}
                  onClick={() => handleListCardClick(list.id)}
                  onKeyDown={(event) => onListCardKeyDown(event, list.id)}
                  onPointerDown={startListLongPress(list.id)}
                  onPointerUp={stopListLongPress}
                  onPointerCancel={stopListLongPress}
                  onPointerLeave={stopListLongPress}
                  aria-label={`Open ${list.title}`}
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
                          ref={editListInputRef}
                          type="text"
                          name="list-title-inline-edit"
                          autoComplete="off"
                          autoCorrect="off"
                          autoCapitalize="none"
                          spellCheck={false}
                          enterKeyHint="done"
                          data-lpignore="true"
                          data-form-type="other"
                          className="new-list-inline-input"
                          value={editingListTitleDraft}
                          onChange={(event) => setEditingListTitleDraft(event.target.value)}
                          onBlur={commitInlineEdit}
                          onKeyDown={(event) => {
                            if (event.key === 'Escape') {
                              event.preventDefault();
                              cancelInlineEdit();
                            }
                          }}
                          placeholder="List name"
                          maxLength={56}
                        />
                      </form>
                    ) : (
                      <button
                        type="button"
                        className="preview-card-main"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleListCardClick(list.id);
                        }}
                        aria-label={`Open ${list.title}`}
                      >
                        <strong>{list.title}</strong>
                      </button>
                    )}

                    <ListMenu
                      open={openMenuListId === list.id}
                      onClose={() => setOpenMenuListId(null)}
                      onEdit={() => editListTitle(list)}
                      onDelete={() => deleteList(list.id)}
                    />
                  </header>
                  <ul className="thumbnail-task-list">
                    {list.tasks.length > 0 ? (
                      list.tasks.map((task) => (
                        <li key={task.id} className={task.completed ? 'is-complete' : ''}>
                          {task.title}
                        </li>
                      ))
                    ) : (
                      <li className="muted">No tasks</li>
                    )}
                  </ul>
                </article>
              );
            })}
            {isCreatingInline ? (
              <article className="preview-card add-preview new-list-inline-preview" aria-label="Create new list">
                <form className="new-list-inline-form" onSubmit={submitInlineCreate} autoComplete="off">
                  <input
                    ref={newListInputRef}
                    type="text"
                    name="list-title-inline-new"
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    enterKeyHint="done"
                    data-lpignore="true"
                    data-form-type="other"
                    className="new-list-inline-input"
                    value={newListTitleDraft}
                    onChange={(event) => setNewListTitleDraft(event.target.value)}
                    onBlur={commitInlineCreate}
                    onKeyDown={(event) => {
                      if (event.key === 'Escape') {
                        event.preventDefault();
                        cancelInlineCreate();
                      }
                    }}
                    placeholder="List name"
                    maxLength={56}
                  />
                </form>
              </article>
            ) : null}

            {!isCreatingInline && orderedLists.length === 0 ? (
              <button type="button" className="preview-card add-preview" onClick={startInlineCreate} aria-label="Create list">
                <Plus size={18} />
              </button>
            ) : null}
          </motion.div>
        ) : null}
      </AnimatePresence>

      {showFloatingAddButton ? (
        <button type="button" className="overview-add-fab" onClick={startInlineCreate} aria-label="Add list">
          <Plus size={18} />
        </button>
      ) : null}
    </motion.section>
  );
};

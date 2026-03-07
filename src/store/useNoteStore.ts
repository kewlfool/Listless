import { create } from 'zustand';
import {
  loadNotes,
  loadNoteViewMode,
  removeNoteFromDB,
  saveNote,
  saveNoteViewMode
} from '../db/listlessDb';
import { createId, type Note, type ViewMode } from '../types/models';
import { applyNoteTitleToContent, extractNoteTitle } from '../utils/noteTitle';

const NOTE_CONTENT_DEBOUNCE_MS = 400;
const pendingSaveTimers = new Map<string, number>();

interface NoteState {
  notes: Note[];
  activeNoteId: string | null;
  viewMode: ViewMode;
  showOverview: boolean;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  createNote: () => string;
  updateNoteTitle: (noteId: string, title: string) => void;
  updateNoteContent: (noteId: string, content: string) => void;
  flushNoteContent: (noteId: string) => void;
  deleteNote: (noteId: string) => void;
  setActiveNote: (noteId: string) => void;
  moveActiveNoteBy: (offset: 1 | -1) => void;
  openOverview: () => void;
  closeOverview: () => void;
  setViewMode: (mode: ViewMode) => void;
}

const sortNotes = (notes: Note[]): Note[] => {
  return [...notes].sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
};

const clearPendingSave = (noteId: string): void => {
  const timerId = pendingSaveTimers.get(noteId);
  if (timerId !== undefined) {
    window.clearTimeout(timerId);
    pendingSaveTimers.delete(noteId);
  }
};

const queueContentSave = (note: Note): void => {
  clearPendingSave(note.id);
  const timerId = window.setTimeout(() => {
    void saveNote(note);
    pendingSaveTimers.delete(note.id);
  }, NOTE_CONTENT_DEBOUNCE_MS);
  pendingSaveTimers.set(note.id, timerId);
};

const flushContentSave = (note: Note | undefined): void => {
  if (!note) {
    return;
  }

  clearPendingSave(note.id);
  void saveNote(note);
};

export const useNoteStore = create<NoteState>((set, get) => ({
  notes: [],
  activeNoteId: null,
  viewMode: 'card',
  showOverview: false,
  hydrated: false,

  hydrate: async () => {
    const [notes, viewMode] = await Promise.all([loadNotes(), loadNoteViewMode()]);
    set((state) => ({
      notes,
      activeNoteId: state.activeNoteId ?? notes[0]?.id ?? null,
      viewMode: viewMode ?? state.viewMode,
      hydrated: true
    }));
  },

  createNote: () => {
    const now = Date.now();

    const newNote: Note = {
      id: createId(),
      title: '',
      content: '',
      createdAt: now,
      updatedAt: now
    };

    set((state) => ({
      notes: sortNotes([...state.notes, newNote]),
      activeNoteId: newNote.id,
      showOverview: false
    }));

    void saveNote(newNote);
    return newNote.id;
  },

  updateNoteTitle: (noteId: string, title: string) => {
    let updatedNote: Note | undefined;
    set((state) => ({
      notes: state.notes.map((note) => {
        if (note.id !== noteId) {
          return note;
        }

        const content = applyNoteTitleToContent(note.content, title);
        updatedNote = {
          ...note,
          title: extractNoteTitle(content),
          content,
          updatedAt: Date.now()
        };
        return updatedNote;
      })
    }));

    flushContentSave(updatedNote);
  },

  updateNoteContent: (noteId: string, content: string) => {
    let updatedNote: Note | undefined;
    set((state) => ({
      notes: state.notes.map((note) => {
        if (note.id !== noteId) {
          return note;
        }

        updatedNote = {
          ...note,
          title: extractNoteTitle(content),
          content,
          updatedAt: Date.now()
        };
        return updatedNote;
      })
    }));

    if (updatedNote) {
      queueContentSave(updatedNote);
    }
  },

  flushNoteContent: (noteId: string) => {
    const note = get().notes.find((row) => row.id === noteId);
    flushContentSave(note);
  },

  deleteNote: (noteId: string) => {
    clearPendingSave(noteId);

    set((state) => {
      const notes = state.notes.filter((note) => note.id !== noteId);
      const activeNoteId =
        state.activeNoteId === noteId ? (notes.length ? notes[0].id : null) : state.activeNoteId;

      return {
        notes,
        activeNoteId,
        showOverview: notes.length > 0 ? state.showOverview : false
      };
    });

    void removeNoteFromDB(noteId);
  },

  setActiveNote: (noteId: string) => {
    set({ activeNoteId: noteId });
  },

  moveActiveNoteBy: (offset: 1 | -1) => {
    set((state) => {
      if (state.notes.length < 2) {
        return state;
      }

      const currentIndex = state.notes.findIndex((note) => note.id === state.activeNoteId);
      const sourceIndex = currentIndex >= 0 ? currentIndex : 0;
      const nextIndex = (sourceIndex + offset + state.notes.length) % state.notes.length;

      return {
        ...state,
        activeNoteId: state.notes[nextIndex].id
      };
    });
  },

  openOverview: () => {
    set({ showOverview: true });
  },

  closeOverview: () => {
    set({ showOverview: false });
  },

  setViewMode: (mode: ViewMode) => {
    set({ viewMode: mode });
    void saveNoteViewMode(mode);
  }
}));

export const selectActiveNote = (state: NoteState): Note | null => {
  return state.notes.find((note) => note.id === state.activeNoteId) ?? null;
};

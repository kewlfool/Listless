import Dexie, { type Table } from 'dexie';
import type { HomeMode, List, Note, ThemeMode, TimeReminder, ViewMode } from '../types/models';
import { sortListData } from '../utils/sort';
import { extractNoteTitle } from '../utils/noteTitle';

interface SettingRecord {
  key: string;
  value: string;
}

class ListlessDB extends Dexie {
  lists!: Table<List, string>;
  notes!: Table<Note, string>;
  timeReminders!: Table<TimeReminder, string>;
  settings!: Table<SettingRecord, string>;

  constructor() {
    super('listless-db');

    this.version(1).stores({
      lists: 'id, createdAt',
      settings: 'key'
    });

    this.version(2).stores({
      lists: 'id, createdAt',
      notes: 'id, createdAt, updatedAt',
      settings: 'key'
    });

    this.version(3).stores({
      lists: 'id, createdAt',
      notes: 'id, createdAt, updatedAt',
      timeReminders: 'id, fireAt, createdAt, updatedAt, canceled, completed',
      settings: 'key'
    });
  }
}

export const db = new ListlessDB();

export const loadLists = async (): Promise<List[]> => {
  const lists = await db.lists.toArray();

  return lists
    .map(sortListData)
    .sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
};

export const saveList = async (list: List): Promise<void> => {
  await db.lists.put(sortListData(list));
};

export const saveLists = async (lists: List[]): Promise<void> => {
  await db.transaction('rw', db.lists, async () => {
    await db.lists.clear();
    await db.lists.bulkPut(lists.map(sortListData));
  });
};

export const removeListFromDB = async (listId: string): Promise<void> => {
  await db.lists.delete(listId);
};

export const loadNotes = async (): Promise<Note[]> => {
  const notes = await db.notes.toArray();

  return notes
    .map((note) => {
      const content = note.content ?? '';
      return {
        ...note,
        title: extractNoteTitle(content),
        content
      };
    })
    .sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
};

export const saveNote = async (note: Note): Promise<void> => {
  const content = note.content ?? '';
  await db.notes.put({
    ...note,
    title: extractNoteTitle(content),
    content,
    updatedAt: note.updatedAt
  });
};

export const saveNotes = async (notes: Note[]): Promise<void> => {
  await db.transaction('rw', db.notes, async () => {
    await db.notes.clear();
    await db.notes.bulkPut(
      notes.map((note) => {
        const content = note.content ?? '';
        return {
          ...note,
          title: extractNoteTitle(content),
          content
        };
      })
    );
  });
};

export const removeNoteFromDB = async (noteId: string): Promise<void> => {
  await db.notes.delete(noteId);
};

export const loadTimeReminders = async (): Promise<TimeReminder[]> => {
  const reminders = await db.timeReminders.toArray();

  return reminders.sort(
    (a, b) => a.fireAt - b.fireAt || a.createdAt - b.createdAt || a.id.localeCompare(b.id)
  );
};

export const saveTimeReminder = async (reminder: TimeReminder): Promise<void> => {
  await db.timeReminders.put(reminder);
};

export const saveTimeReminders = async (reminders: TimeReminder[]): Promise<void> => {
  await db.transaction('rw', db.timeReminders, async () => {
    await db.timeReminders.clear();
    await db.timeReminders.bulkPut(reminders);
  });
};

export const removeTimeReminderFromDB = async (reminderId: string): Promise<void> => {
  await db.timeReminders.delete(reminderId);
};

const LIST_VIEW_MODE_KEY = 'viewMode';
const NOTE_VIEW_MODE_KEY = 'noteViewMode';
const HOME_MODE_KEY = 'homeMode';
const THEME_MODE_KEY = 'themeMode';

const parseViewMode = (value: string): ViewMode | null => {
  if (value === 'card' || value === 'list' || value === 'preview') {
    return value;
  }

  return null;
};

const parseThemeMode = (value: string): ThemeMode | null => {
  if (value === 'light' || value === 'dark') {
    return value;
  }

  return null;
};

export const loadViewMode = async (): Promise<ViewMode | null> => {
  const row = await db.settings.get(LIST_VIEW_MODE_KEY);

  if (!row) {
    return null;
  }

  return parseViewMode(row.value);
};

export const saveViewMode = async (viewMode: ViewMode): Promise<void> => {
  await db.settings.put({ key: LIST_VIEW_MODE_KEY, value: viewMode });
};

export const loadNoteViewMode = async (): Promise<ViewMode | null> => {
  const row = await db.settings.get(NOTE_VIEW_MODE_KEY);

  if (!row) {
    return null;
  }

  return parseViewMode(row.value);
};

export const saveNoteViewMode = async (viewMode: ViewMode): Promise<void> => {
  await db.settings.put({ key: NOTE_VIEW_MODE_KEY, value: viewMode });
};

export const loadHomeMode = async (): Promise<HomeMode | null> => {
  const row = await db.settings.get(HOME_MODE_KEY);
  if (!row) {
    return null;
  }

  const value = row.value;
  if (value === 'listless' || value === 'noteless' || value === 'timeless') {
    return value;
  }

  return null;
};

export const saveHomeMode = async (mode: HomeMode): Promise<void> => {
  await db.settings.put({ key: HOME_MODE_KEY, value: mode });
};

export const loadThemeMode = async (): Promise<ThemeMode | null> => {
  const row = await db.settings.get(THEME_MODE_KEY);
  if (!row) {
    return null;
  }

  return parseThemeMode(row.value);
};

export const saveThemeMode = async (mode: ThemeMode): Promise<void> => {
  await db.settings.put({ key: THEME_MODE_KEY, value: mode });
};

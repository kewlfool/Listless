import { AnimatePresence } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { EmptyState } from './components/list/EmptyState';
import { ListScreen } from './components/list/ListScreen';
import { NoteEmptyState } from './components/note/NoteEmptyState';
import { NoteScreen } from './components/note/NoteScreen';
import { NoteOverviewScreen } from './components/overview/NoteOverviewScreen';
import { OverviewScreen } from './components/overview/OverviewScreen';
import { TimelessHomeScreen } from './components/time/TimelessHomeScreen';
import { TimelessSettinglessScreen } from './components/time/TimelessSettinglessScreen';
import { useHorizontalSwipe } from './hooks/useHorizontalSwipe';
import { usePullToCreate } from './hooks/usePullToCreate';
import { useHomeStore } from './store/useHomeStore';
import { selectActiveNote, useNoteStore } from './store/useNoteStore';
import { selectActiveList, useListStore } from './store/useListStore';
import { useTimelessAnnouncementStore } from './store/useTimelessAnnouncementStore';
import { useTimeReminderStore } from './store/useTimeReminderStore';

const normalizeBasePath = (value: string): string => (value.endsWith('/') ? value : `${value}/`);

const basePath = normalizeBasePath(import.meta.env.BASE_URL);
const rootPath = basePath !== '/' ? basePath.slice(0, -1) : basePath;

const isKnownPath = (pathname: string): boolean =>
  pathname === basePath || pathname === `${basePath}index.html` || pathname === rootPath;

const isEditableElement = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
    return true;
  }

  return target.isContentEditable || Boolean(target.closest('[contenteditable="true"], [contenteditable="plaintext-only"]'));
};

const NotFoundScreen = (): JSX.Element => (
  <main className="app-shell not-found-shell">
    <h1>404</h1>
    <p className="muted">Page not found.</p>
    <a className="not-found-link" href={basePath}>
      Go to Listless
    </a>
  </main>
);

const AppContent = (): JSX.Element => {
  const hydrateLists = useListStore((state) => state.hydrate);
  const lists = useListStore((state) => state.lists);
  const showListOverview = useListStore((state) => state.showOverview);
  const openListOverview = useListStore((state) => state.openOverview);
  const listHydrated = useListStore((state) => state.hydrated);
  const activeList = useListStore(selectActiveList);

  const hydrateNotes = useNoteStore((state) => state.hydrate);
  const notes = useNoteStore((state) => state.notes);
  const showNoteOverview = useNoteStore((state) => state.showOverview);
  const noteHydrated = useNoteStore((state) => state.hydrated);
  const activeNote = useNoteStore(selectActiveNote);
  const createNote = useNoteStore((state) => state.createNote);

  const hydrateHome = useHomeStore((state) => state.hydrate);
  const homeMode = useHomeStore((state) => state.homeMode);
  const themeMode = useHomeStore((state) => state.themeMode);
  const homeHydrated = useHomeStore((state) => state.hydrated);
  const setHomeMode = useHomeStore((state) => state.setHomeMode);
  const hydrateTimeReminders = useTimeReminderStore((state) => state.hydrate);
  const timeRemindersHydrated = useTimeReminderStore((state) => state.hydrated);
  const hydrateTimelessAnnouncements = useTimelessAnnouncementStore((state) => state.hydrate);
  const timelessAnnouncementsHydrated = useTimelessAnnouncementStore((state) => state.hydrated);
  const resyncTimelessAnnouncementSchedule = useTimelessAnnouncementStore((state) => state.resyncSchedule);
  const tickTimelessRandomHour = useTimelessAnnouncementStore((state) => state.tickRandomHour);

  const [startCreateDraftSeq, setStartCreateDraftSeq] = useState(0);
  const [showTimelessSettingless, setShowTimelessSettingless] = useState(false);

  useEffect(() => {
    void Promise.all([
      hydrateLists(),
      hydrateNotes(),
      hydrateHome(),
      hydrateTimeReminders(),
      hydrateTimelessAnnouncements()
    ]);
  }, [hydrateHome, hydrateLists, hydrateNotes, hydrateTimeReminders, hydrateTimelessAnnouncements]);

  useEffect(() => {
    const preventDefault = (event: Event) => {
      event.preventDefault();
    };

    document.addEventListener('gesturestart', preventDefault, { passive: false });
    document.addEventListener('gesturechange', preventDefault, { passive: false });
    document.addEventListener('gestureend', preventDefault, { passive: false });

    return () => {
      document.removeEventListener('gesturestart', preventDefault);
      document.removeEventListener('gesturechange', preventDefault);
      document.removeEventListener('gestureend', preventDefault);
    };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = themeMode;
  }, [themeMode]);

  useEffect(() => {
    if (homeMode !== 'timeless') {
      setShowTimelessSettingless(false);
    }
  }, [homeMode]);

  useEffect(() => {
    const handleResync = () => {
      resyncTimelessAnnouncementSchedule();
    };

    const handleVisibility = () => {
      if (!document.hidden) {
        handleResync();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    document.addEventListener('resume', handleResync as EventListener);
    document.addEventListener('deviceready', handleResync as EventListener);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      document.removeEventListener('resume', handleResync as EventListener);
      document.removeEventListener('deviceready', handleResync as EventListener);
    };
  }, [resyncTimelessAnnouncementSchedule]);

  useEffect(() => {
    tickTimelessRandomHour();
    const intervalId = window.setInterval(() => {
      tickTimelessRandomHour();
    }, 30000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [tickTimelessRandomHour]);

  const listScreenKey = useMemo(() => {
    if (showListOverview) {
      return 'overview';
    }

    if (!lists.length) {
      return 'empty';
    }

    return activeList?.id ?? 'list';
  }, [activeList?.id, lists.length, showListOverview]);

  const noteScreenKey = useMemo(() => {
    if (showNoteOverview) {
      return 'note-overview';
    }

    if (!notes.length) {
      return 'note-empty';
    }

    return activeNote?.id ?? 'note';
  }, [activeNote?.id, notes.length, showNoteOverview]);

  const homeSwipeEnabled =
    (homeMode === 'listless' && (showListOverview || lists.length === 0)) ||
    (homeMode === 'noteless' && (showNoteOverview || notes.length === 0)) ||
    homeMode === 'timeless';
  const isTimelessModeScreen = homeMode === 'timeless';

  const homeModeSwipe = useHorizontalSwipe({
    onSwipeLeft: () => {
      if (homeMode === 'listless') {
        setHomeMode('timeless');
        return;
      }

      if (homeMode === 'noteless') {
        setHomeMode('listless');
      }
    },
    onSwipeRight: () => {
      if (homeMode === 'listless') {
        setHomeMode('noteless');
        return;
      }

      if (homeMode === 'timeless') {
        setHomeMode('listless');
      }
    },
    threshold: 72,
    disabled: !homeSwipeEnabled
  });

  const pullToTimelessSettingless = usePullToCreate({
    threshold: 48,
    direction: 'up',
    requireEdge: false,
    disabled: !isTimelessModeScreen || showTimelessSettingless,
    onTrigger: () => {
      setShowTimelessSettingless(true);
    }
  });

  if (!listHydrated || !noteHydrated || !homeHydrated || !timeRemindersHydrated || !timelessAnnouncementsHydrated) {
    return <main className="app-shell loading-shell">Loading...</main>;
  }

  const handleCreateFromListlessHome = () => {
    openListOverview();
    setStartCreateDraftSeq((prev) => prev + 1);
  };

  const handleCreateDraftHandled = (seq: number) => {
    setStartCreateDraftSeq((current) => (current === seq ? 0 : current));
  };

  const handleCreateFromNotelessHome = () => {
    createNote();
  };

  return (
    <main
      className="app-shell"
      onTouchStart={(event) => {
        if (isEditableElement(document.activeElement) || isEditableElement(event.target)) {
          homeModeSwipe.onTouchCancel();
          pullToTimelessSettingless.bind.onTouchCancel();
          return;
        }

        homeModeSwipe.onTouchStart(event);
        if (isTimelessModeScreen && event.touches.length === 1) {
          pullToTimelessSettingless.bind.onTouchStart(event);
        } else {
          pullToTimelessSettingless.bind.onTouchCancel();
        }
      }}
      onTouchMove={(event) => {
        if (isEditableElement(document.activeElement) || isEditableElement(event.target)) {
          homeModeSwipe.onTouchCancel();
          pullToTimelessSettingless.bind.onTouchCancel();
          return;
        }

        homeModeSwipe.onTouchMove(event);
        pullToTimelessSettingless.bind.onTouchMove(event);
      }}
      onTouchEnd={() => {
        homeModeSwipe.onTouchEnd();
        pullToTimelessSettingless.bind.onTouchEnd();
      }}
      onTouchCancel={() => {
        homeModeSwipe.onTouchCancel();
        pullToTimelessSettingless.bind.onTouchCancel();
      }}
    >
      <AnimatePresence mode="wait" initial={false}>
        {homeMode === 'listless' ? (
          <>
            {!lists.length && !showListOverview ? (
              <EmptyState
                key="empty"
                onCreate={() => {
                  handleCreateFromListlessHome();
                }}
              />
            ) : null}

            {showListOverview ? (
              <OverviewScreen
                key="overview"
                startCreateDraftSeq={startCreateDraftSeq}
                onStartCreateDraftHandled={handleCreateDraftHandled}
              />
            ) : null}

            {lists.length > 0 && !showListOverview && activeList ? (
              <ListScreen
                key={listScreenKey}
                list={activeList}
              />
            ) : null}
          </>
        ) : null}

        {homeMode === 'noteless' ? (
          <>
            {!notes.length && !showNoteOverview ? (
              <NoteEmptyState
                key="note-empty"
                onCreate={() => {
                  handleCreateFromNotelessHome();
                }}
              />
            ) : null}

            {showNoteOverview ? <NoteOverviewScreen key="note-overview" /> : null}

            {notes.length > 0 && !showNoteOverview && activeNote ? (
              <NoteScreen key={noteScreenKey} note={activeNote} />
            ) : null}
          </>
        ) : null}

        {homeMode === 'timeless' ? <TimelessHomeScreen key="timeless" /> : null}
      </AnimatePresence>

      <AnimatePresence>
        {showTimelessSettingless ? (
          <TimelessSettinglessScreen
            onClose={() => {
              setShowTimelessSettingless(false);
            }}
          />
        ) : null}
      </AnimatePresence>
    </main>
  );
};

const App = (): JSX.Element => {
  const pathname = window.location.pathname;

  if (!isKnownPath(pathname)) {
    return <NotFoundScreen />;
  }

  return <AppContent />;
};

export default App;

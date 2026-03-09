import { motion } from 'framer-motion';
import { useRef } from 'react';
import { usePullToCreate } from '../../hooks/usePullToCreate';
import { useHomeStore } from '../../store/useHomeStore';
import { useTimelessAnnouncementStore } from '../../store/useTimelessAnnouncementStore';
import type { TimelessChimeMode } from '../../types/models';
import { formatHourLabel } from '../../utils/timelessAnnouncements';

interface TimelessSettinglessScreenProps {
  onClose: () => void;
}

const CHIME_MODE_LABELS: Record<TimelessChimeMode, string> = {
  hourly: 'every hour',
  halfHourly: 'every half hour',
  random: 'randomly'
};

const toTimeValue = (hour: number): string => `${hour.toString().padStart(2, '0')}:00`;

const parseHourFromTimeValue = (value: string): number | null => {
  const [hourText] = value.split(':');
  const hour = Number.parseInt(hourText ?? '', 10);
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
    return null;
  }

  return hour;
};

export const TimelessSettinglessScreen = ({
  onClose
}: TimelessSettinglessScreenProps): JSX.Element => {
  const themeMode = useHomeStore((state) => state.themeMode);
  const setThemeMode = useHomeStore((state) => state.setThemeMode);
  const mode = useTimelessAnnouncementStore((state) => state.mode);
  const fromHour = useTimelessAnnouncementStore((state) => state.fromHour);
  const tillHour = useTimelessAnnouncementStore((state) => state.tillHour);
  const enabled = useTimelessAnnouncementStore((state) => state.enabled);
  const randomMinute1 = useTimelessAnnouncementStore((state) => state.randomMinute1);
  const randomMinute2 = useTimelessAnnouncementStore((state) => state.randomMinute2);
  const cycleMode = useTimelessAnnouncementStore((state) => state.cycleMode);
  const setFromHour = useTimelessAnnouncementStore((state) => state.setFromHour);
  const setTillHour = useTimelessAnnouncementStore((state) => state.setTillHour);
  const setEnabled = useTimelessAnnouncementStore((state) => state.setEnabled);
  const shuffleRandomMinutes = useTimelessAnnouncementStore((state) => state.shuffleRandomMinutes);
  const fromInputRef = useRef<HTMLInputElement | null>(null);
  const tillInputRef = useRef<HTMLInputElement | null>(null);
  const showRandomShuffleButton = mode === 'random';
  const pullToDismiss = usePullToCreate({
    threshold: 56,
    direction: 'down',
    requireEdge: false,
    onTrigger: onClose
  });

  return (
    <motion.section
      className="settingless-screen timeless-settingless-screen"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 16 }}
      transition={{ duration: 0.16 }}
      onTouchStart={pullToDismiss.bind.onTouchStart}
      onTouchMove={pullToDismiss.bind.onTouchMove}
      onTouchEnd={pullToDismiss.bind.onTouchEnd}
      onTouchCancel={pullToDismiss.bind.onTouchCancel}
    >
      <header className="settingless-header">
        <h2>Settingless</h2>
      </header>

      <div className="settingless-list timeless-settingless-list">
        <button
          type="button"
          className="settingless-row timeless-settingless-row timeless-settingless-cycle-row"
          onClick={() => cycleMode(1)}
          aria-label="Cycle talk mode"
        >
          <span className="settingless-row-label">Talk</span>
          <span className="timeless-settingless-value">
            {CHIME_MODE_LABELS[mode]}
          </span>
        </button>

        <label
          className="settingless-row timeless-settingless-row timeless-settingless-time-row"
          onClick={() => {
            fromInputRef.current?.showPicker?.();
            fromInputRef.current?.focus();
            fromInputRef.current?.click();
          }}
        >
          <span className="settingless-row-label">From</span>
          <input
            ref={fromInputRef}
            type="time"
            className="timeless-settingless-time-input"
            value={toTimeValue(fromHour)}
            step={3600}
            aria-label="From time"
            onChange={(event) => {
              const nextHour = parseHourFromTimeValue(event.target.value);
              if (nextHour === null) {
                return;
              }

              setFromHour(nextHour);
            }}
          />
          <span className="timeless-settingless-value">{formatHourLabel(fromHour)}</span>
        </label>

        <label
          className="settingless-row timeless-settingless-row timeless-settingless-time-row"
          onClick={() => {
            tillInputRef.current?.showPicker?.();
            tillInputRef.current?.focus();
            tillInputRef.current?.click();
          }}
        >
          <span className="settingless-row-label">Till</span>
          <input
            ref={tillInputRef}
            type="time"
            className="timeless-settingless-time-input"
            value={toTimeValue(tillHour)}
            step={3600}
            aria-label="Till time"
            onChange={(event) => {
              const nextHour = parseHourFromTimeValue(event.target.value);
              if (nextHour === null) {
                return;
              }

              setTillHour(nextHour);
            }}
          />
          <span className="timeless-settingless-value">{formatHourLabel(tillHour)}</span>
        </label>

        <button
          type="button"
          className="settingless-row timeless-settingless-row"
          onClick={() => {
            setEnabled(!enabled);
          }}
          aria-pressed={enabled}
        >
          <span className="settingless-row-label">Make it Talk</span>
          <span className={`settingless-switch ${enabled ? 'is-on' : ''}`} aria-hidden="true">
            <span className="settingless-switch-knob" />
          </span>
        </button>

        <button
          type="button"
          className="settingless-row timeless-settingless-row"
          onClick={() => {
            setThemeMode(themeMode === 'dark' ? 'light' : 'dark');
          }}
          aria-pressed={themeMode === 'dark'}
        >
          <span className="settingless-row-label">Dark mode</span>
          <span className={`settingless-switch ${themeMode === 'dark' ? 'is-on' : ''}`} aria-hidden="true">
            <span className="settingless-switch-knob" />
          </span>
        </button>
      </div>

      {showRandomShuffleButton ? (
        <button
          type="button"
          className="timeless-random-shuffle-button"
          onClick={shuffleRandomMinutes}
          aria-label="Shuffle random talk minutes"
        >
          M{randomMinute1}/M{randomMinute2}
        </button>
      ) : null}
    </motion.section>
  );
};

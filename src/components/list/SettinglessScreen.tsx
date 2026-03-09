import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useHomeStore } from '../../store/useHomeStore';

interface SettinglessScreenProps {
  onClose: () => void;
}

export const SettinglessScreen = ({ onClose }: SettinglessScreenProps): JSX.Element => {
  const themeMode = useHomeStore((state) => state.themeMode);
  const setThemeMode = useHomeStore((state) => state.setThemeMode);

  return (
    <motion.section
      className="settingless-screen"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 16 }}
      transition={{ duration: 0.16 }}
    >
      <header className="settingless-header">
        <h2>Settingless</h2>
        <button type="button" className="plain-icon-button settingless-close" onClick={onClose} aria-label="Close settings">
          <X size={17} />
        </button>
      </header>

      <div className="settingless-list">
        <button
          type="button"
          className="settingless-row"
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
    </motion.section>
  );
};

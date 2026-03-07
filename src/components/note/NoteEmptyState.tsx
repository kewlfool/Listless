import { motion } from 'framer-motion';
import { PlusButton } from '../common/PlusButton';

interface NoteEmptyStateProps {
  onCreate: () => void;
}

export const NoteEmptyState = ({ onCreate }: NoteEmptyStateProps): JSX.Element => {
  return (
    <motion.section
      className="empty-state"
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.25 }}
    >
      <PlusButton label="Create first note" onClick={onCreate} />
      <p className="muted">Tap to create your first note</p>
    </motion.section>
  );
};

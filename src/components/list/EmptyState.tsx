import { motion } from 'framer-motion';
import { PlusButton } from '../common/PlusButton';

interface EmptyStateProps {
  onCreate: () => void;
}

export const EmptyState = ({ onCreate }: EmptyStateProps): JSX.Element => {
  return (
    <motion.section
      className="empty-state"
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.25 }}
    >
      <PlusButton label="Create first list" onClick={onCreate} />
      <p className="muted">Tap to create your first list</p>
    </motion.section>
  );
};

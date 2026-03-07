import { motion } from 'framer-motion';

interface PlusButtonProps {
  label: string;
  onClick: () => void;
}

export const PlusButton = ({ label, onClick }: PlusButtonProps): JSX.Element => {
  return (
    <motion.button
      className="plus-button"
      whileTap={{ scale: 0.94 }}
      whileHover={{ scale: 1.03 }}
      transition={{ type: 'spring', stiffness: 280, damping: 24 }}
      onClick={onClick}
      aria-label={label}
    >
      +
    </motion.button>
  );
};

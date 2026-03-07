import { AnimatePresence, motion } from 'framer-motion';
import { FormEvent, useEffect, useRef, useState } from 'react';

interface CreateListModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (title: string) => void;
}

export const CreateListModal = ({ open, onClose, onSubmit }: CreateListModalProps): JSX.Element => {
  const [title, setTitle] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }
  }, [open]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = title.trim();

    if (!trimmed) {
      return;
    }

    onSubmit(trimmed);
    setTitle('');
  };

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="modal-sheet"
            initial={{ y: 42, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 32, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 24 }}
            onClick={(event) => event.stopPropagation()}
          >
            <h2>Create List</h2>
            <form onSubmit={handleSubmit} className="stack-12">
              <input
                ref={inputRef}
                type="text"
                name="list-title-new"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                enterKeyHint="done"
                data-lpignore="true"
                data-form-type="other"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="list-input"
                placeholder="List name"
                maxLength={56}
              />
              <div className="modal-actions">
                <button type="button" className="ghost-button" onClick={onClose}>
                  Cancel
                </button>
                <button type="submit" className="solid-button">
                  Create
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
};

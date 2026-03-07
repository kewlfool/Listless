import { motion } from 'framer-motion';
import { useCallback, useEffect, useRef, useState, type ChangeEvent, type CSSProperties, type RefObject } from 'react';
import { useHorizontalSwipe } from '../../hooks/useHorizontalSwipe';
import { useLongPress } from '../../hooks/useLongPress';
import { usePinchToOverview } from '../../hooks/usePinchToOverview';
import { useNoteStore } from '../../store/useNoteStore';
import type { Note } from '../../types/models';
import { normalizeStoredNoteContent } from '../../utils/noteContent';

interface NoteScreenProps {
  note: Note;
}

interface EditorToolState {
  h1: boolean;
  h2: boolean;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
  bullet: boolean;
  numbered: boolean;
  quote: boolean;
  code: boolean;
  foreColor: string;
  highlightColor: string;
}

interface EditorTool {
  id: string;
  label: string;
  className?: string;
  active?: boolean;
  style?: CSSProperties;
  run: () => void;
}

const DEFAULT_TEXT_COLOR = '#1f2937';
const DEFAULT_HIGHLIGHT_COLOR = '#fff59d';

const DEFAULT_EDITOR_TOOL_STATE: EditorToolState = {
  h1: false,
  h2: false,
  bold: false,
  italic: false,
  underline: false,
  strike: false,
  bullet: false,
  numbered: false,
  quote: false,
  code: false,
  foreColor: DEFAULT_TEXT_COLOR,
  highlightColor: DEFAULT_HIGHLIGHT_COLOR
};

const normalizeEditorHtml = (html: string): string => {
  const trimmed = html.replace(/\u200b/g, '').trim();
  if (!trimmed || trimmed === '<br>' || trimmed === '<div><br></div>') {
    return '';
  }

  return html;
};

const normalizeCommandColor = (value: string, fallback: string): string => {
  const normalized = value.replace(/['"]/g, '').trim().toLowerCase();
  if (!normalized || normalized === 'transparent' || normalized === 'inherit') {
    return fallback;
  }

  if (/^#[0-9a-f]{3}$/i.test(normalized)) {
    return `#${normalized[1]}${normalized[1]}${normalized[2]}${normalized[2]}${normalized[3]}${normalized[3]}`;
  }

  if (/^#[0-9a-f]{6}$/i.test(normalized)) {
    return normalized;
  }

  const rgbMatch = normalized.match(/rgba?\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (!rgbMatch) {
    return fallback;
  }

  const toHex = (valuePart: string): string => {
    const parsed = Math.max(0, Math.min(255, Number.parseInt(valuePart, 10)));
    return parsed.toString(16).padStart(2, '0');
  };

  return `#${toHex(rgbMatch[1])}${toHex(rgbMatch[2])}${toHex(rgbMatch[3])}`;
};

const isSelectionInsideEditor = (editor: HTMLDivElement | null): boolean => {
  if (!editor) {
    return false;
  }

  const selection = window.getSelection();
  if (!selection || selection.rangeCount < 1) {
    return false;
  }

  const anchorNode = selection.anchorNode;
  return Boolean(anchorNode && editor.contains(anchorNode));
};

export const NoteScreen = ({ note }: NoteScreenProps): JSX.Element => {
  const updateNoteContent = useNoteStore((state) => state.updateNoteContent);
  const flushNoteContent = useNoteStore((state) => state.flushNoteContent);
  const moveActiveNoteBy = useNoteStore((state) => state.moveActiveNoteBy);
  const openOverview = useNoteStore((state) => state.openOverview);
  const [isEditorFocused, setIsEditorFocused] = useState(false);
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  const [activeTools, setActiveTools] = useState<EditorToolState>(DEFAULT_EDITOR_TOOL_STATE);
  const editorRef = useRef<HTMLDivElement | null>(null);
  const activeNoteIdRef = useRef(note.id);
  const savedRangeRef = useRef<Range | null>(null);
  const textColorInputRef = useRef<HTMLInputElement | null>(null);
  const highlightColorInputRef = useRef<HTMLInputElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);

  const titleSwipe = useHorizontalSwipe({
    onSwipeLeft: () => moveActiveNoteBy(1),
    onSwipeRight: () => moveActiveNoteBy(-1),
    threshold: 60
  });

  const titleLongPress = useLongPress({
    onLongPress: openOverview,
    delay: 430
  });
  const pinch = usePinchToOverview({
    onPinchIn: openOverview,
    threshold: 42
  });

  const syncEditorContent = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) {
      return;
    }

    const html = normalizeEditorHtml(editor.innerHTML);
    updateNoteContent(note.id, html);
  }, [note.id, updateNoteContent]);

  const saveSelectionRange = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) {
      return;
    }

    const selection = window.getSelection();
    if (!selection || selection.rangeCount < 1) {
      return;
    }

    const range = selection.getRangeAt(0);
    const ancestor = range.commonAncestorContainer;
    if (editor.contains(ancestor)) {
      savedRangeRef.current = range.cloneRange();
    }
  }, []);

  const restoreSelectionRange = useCallback(() => {
    const editor = editorRef.current;
    const savedRange = savedRangeRef.current;
    if (!editor || !savedRange) {
      return;
    }

    const selection = window.getSelection();
    if (!selection) {
      return;
    }

    selection.removeAllRanges();
    selection.addRange(savedRange);
  }, []);

  const refreshEditorToolState = useCallback(() => {
    if (!isEditorFocused) {
      setActiveTools(DEFAULT_EDITOR_TOOL_STATE);
      return;
    }

    const editor = editorRef.current;
    if (!editor || !isSelectionInsideEditor(editor)) {
      return;
    }

    const formatBlock = String(document.queryCommandValue('formatBlock') || '')
      .replace(/[<>"']/g, '')
      .trim()
      .toLowerCase();

    const foreColor = normalizeCommandColor(String(document.queryCommandValue('foreColor') || ''), DEFAULT_TEXT_COLOR);
    const highlightRaw = String(document.queryCommandValue('hiliteColor') || document.queryCommandValue('backColor') || '');
    const highlightColor = normalizeCommandColor(highlightRaw, DEFAULT_HIGHLIGHT_COLOR);

    setActiveTools({
      h1: formatBlock === 'h1',
      h2: formatBlock === 'h2',
      bold: document.queryCommandState('bold'),
      italic: document.queryCommandState('italic'),
      underline: document.queryCommandState('underline'),
      strike: document.queryCommandState('strikeThrough'),
      bullet: document.queryCommandState('insertUnorderedList'),
      numbered: document.queryCommandState('insertOrderedList'),
      quote: formatBlock === 'blockquote',
      code: formatBlock === 'pre',
      foreColor,
      highlightColor
    });
  }, [isEditorFocused]);

  const runEditorCommand = useCallback(
    (command: string, value?: string) => {
      const editor = editorRef.current;
      if (!editor) {
        return;
      }

      editor.focus();
      restoreSelectionRange();
      document.execCommand('styleWithCSS', false, 'true');
      document.execCommand(command, false, value);
      syncEditorContent();
      saveSelectionRange();

      requestAnimationFrame(() => {
        editorRef.current?.focus();
        refreshEditorToolState();
      });
    },
    [refreshEditorToolState, restoreSelectionRange, saveSelectionRange, syncEditorContent]
  );

  const applyHighlightColor = useCallback(
    (value: string) => {
      const editor = editorRef.current;
      if (!editor) {
        return;
      }

      editor.focus();
      restoreSelectionRange();
      document.execCommand('styleWithCSS', false, 'true');
      const applied = document.execCommand('hiliteColor', false, value);
      if (!applied) {
        document.execCommand('backColor', false, value);
      }
      syncEditorContent();
      saveSelectionRange();
      requestAnimationFrame(refreshEditorToolState);
    },
    [refreshEditorToolState, restoreSelectionRange, saveSelectionRange, syncEditorContent]
  );

  useEffect(() => {
    return () => {
      flushNoteContent(note.id);
    };
  }, [flushNoteContent, note.id]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) {
      return;
    }

    const noteChanged = activeNoteIdRef.current !== note.id;
    const nextHtml = normalizeStoredNoteContent(note.content);
    if (noteChanged || !isEditorFocused) {
      if (editor.innerHTML !== nextHtml) {
        editor.innerHTML = nextHtml;
      }
    }

    activeNoteIdRef.current = note.id;
  }, [isEditorFocused, note.content, note.id]);

  useEffect(() => {
    if (!isEditorFocused) {
      setKeyboardOffset(0);
      return;
    }

    const viewport = window.visualViewport;
    if (!viewport) {
      return;
    }

    const updateOffset = () => {
      const offset = Math.max(0, window.innerHeight - (viewport.height + viewport.offsetTop));
      setKeyboardOffset(offset);
    };

    updateOffset();
    viewport.addEventListener('resize', updateOffset);
    viewport.addEventListener('scroll', updateOffset);

    return () => {
      viewport.removeEventListener('resize', updateOffset);
      viewport.removeEventListener('scroll', updateOffset);
    };
  }, [isEditorFocused]);

  useEffect(() => {
    if (!isEditorFocused) {
      return;
    }

    const editor = editorRef.current;
    if (!editor) {
      return;
    }

    const handleSelectionChange = () => {
      if (isSelectionInsideEditor(editorRef.current)) {
        saveSelectionRange();
        refreshEditorToolState();
      }
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    editor.addEventListener('keyup', handleSelectionChange);
    editor.addEventListener('mouseup', handleSelectionChange);
    editor.addEventListener('input', handleSelectionChange);
    refreshEditorToolState();

    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
      editor.removeEventListener('keyup', handleSelectionChange);
      editor.removeEventListener('mouseup', handleSelectionChange);
      editor.removeEventListener('input', handleSelectionChange);
    };
  }, [isEditorFocused, refreshEditorToolState, saveSelectionRange]);

  const openColorPicker = (inputRef: RefObject<HTMLInputElement>) => {
    saveSelectionRange();
    inputRef.current?.click();
  };

  const handleTextColorChange = (event: ChangeEvent<HTMLInputElement>) => {
    const color = event.target.value;
    runEditorCommand('foreColor', color);
  };

  const handleHighlightColorChange = (event: ChangeEvent<HTMLInputElement>) => {
    const color = event.target.value;
    applyHighlightColor(color);
  };

  const handleImageFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        return;
      }

      runEditorCommand('insertImage', reader.result);
    };
    reader.readAsDataURL(file);
  };

  const tools: EditorTool[] = [
    { id: 'h1', label: 'H1', active: activeTools.h1, run: () => runEditorCommand('formatBlock', '<h1>') },
    { id: 'h2', label: 'H2', active: activeTools.h2, run: () => runEditorCommand('formatBlock', '<h2>') },
    { id: 'bold', label: 'B', className: 'is-strong', active: activeTools.bold, run: () => runEditorCommand('bold') },
    { id: 'italic', label: 'I', className: 'is-italic', active: activeTools.italic, run: () => runEditorCommand('italic') },
    {
      id: 'underline',
      label: 'U',
      className: 'is-under',
      active: activeTools.underline,
      run: () => runEditorCommand('underline')
    },
    {
      id: 'strike',
      label: 'S',
      className: 'is-strike',
      active: activeTools.strike,
      run: () => runEditorCommand('strikeThrough')
    },
    { id: 'bullet', label: '-', active: activeTools.bullet, run: () => runEditorCommand('insertUnorderedList') },
    { id: 'numbered', label: '1.', active: activeTools.numbered, run: () => runEditorCommand('insertOrderedList') },
    {
      id: 'text-color',
      label: 'A',
      className: 'is-color-tool',
      active: activeTools.foreColor !== DEFAULT_TEXT_COLOR,
      style: { color: activeTools.foreColor },
      run: () => openColorPicker(textColorInputRef)
    },
    {
      id: 'highlight-color',
      label: 'Bg',
      className: 'is-color-tool',
      active: activeTools.highlightColor !== DEFAULT_HIGHLIGHT_COLOR,
      style: { background: activeTools.highlightColor },
      run: () => openColorPicker(highlightColorInputRef)
    },
    { id: 'check', label: '[ ]', run: () => runEditorCommand('insertText', '- [ ] ') },
    { id: 'quote', label: '"', active: activeTools.quote, run: () => runEditorCommand('formatBlock', '<blockquote>') },
    { id: 'code', label: '</>', active: activeTools.code, run: () => runEditorCommand('formatBlock', '<pre>') },
    {
      id: 'table',
      label: 'Tbl',
      run: () =>
        runEditorCommand(
          'insertHTML',
          '<table><tbody><tr><th>Heading 1</th><th>Heading 2</th></tr><tr><td>Cell</td><td>Cell</td></tr></tbody></table><div><br></div>'
        )
    },
    {
      id: 'image',
      label: 'Img',
      run: () => {
        saveSelectionRange();
        imageInputRef.current?.click();
      }
    },
    {
      id: 'link',
      label: 'Link',
      run: () => {
        const href = window.prompt('Link URL');
        if (!href) {
          return;
        }

        runEditorCommand('createLink', href);
      }
    },
    { id: 'clear', label: 'Tx', run: () => runEditorCommand('removeFormat') }
  ];

  return (
    <motion.section
      className="list-shell note-screen-shell"
      initial={{ opacity: 0, x: 18 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -18 }}
      onTouchStart={(event) => {
        pinch.onTouchStart(event);
      }}
      onTouchMove={(event) => {
        pinch.onTouchMove(event);
      }}
      onTouchEnd={() => {
        pinch.onTouchEnd();
      }}
      onTouchCancel={() => {
        pinch.onTouchCancel();
      }}
    >
      <header className="list-header">
        <div
          className="list-title-swipe-zone note-gesture-zone"
          onTouchStart={titleSwipe.onTouchStart}
          onTouchMove={titleSwipe.onTouchMove}
          onTouchEnd={titleSwipe.onTouchEnd}
          onTouchCancel={titleSwipe.onTouchCancel}
          onPointerDown={titleLongPress.onPointerDown}
          onPointerUp={titleLongPress.onPointerUp}
          onPointerCancel={titleLongPress.onPointerCancel}
          onPointerLeave={titleLongPress.onPointerLeave}
          aria-hidden="true"
        />

        <div className="header-actions" />
      </header>

      <div
        ref={editorRef}
        className={`note-editor-content ${isEditorFocused ? 'is-toolbar-open' : ''}`}
        contentEditable
        role="textbox"
        aria-label="Note editor"
        spellCheck
        data-placeholder="Start writing..."
        suppressContentEditableWarning
        onInput={syncEditorContent}
        onPointerDown={() => {
          setIsEditorFocused(true);
        }}
        onFocus={() => {
          setIsEditorFocused(true);
          refreshEditorToolState();
        }}
        onBlur={() => {
          setIsEditorFocused(false);
          flushNoteContent(note.id);
        }}
      />

      {isEditorFocused ? (
        <div
          className="note-editor-toolbar"
          role="toolbar"
          aria-label="Text formatting tools"
          style={
            {
              '--note-keyboard-offset': `${keyboardOffset}px`
            } as CSSProperties
          }
        >
          {tools.map((tool) => (
            <button
              key={tool.id}
              type="button"
              className={`note-editor-tool ${tool.className ?? ''} ${tool.active ? 'is-active' : ''}`}
              style={tool.style}
              onPointerDown={(event) => {
                event.preventDefault();
                saveSelectionRange();
              }}
              onClick={tool.run}
              aria-label={tool.id}
            >
              {tool.label}
            </button>
          ))}
        </div>
      ) : null}

      <input
        ref={textColorInputRef}
        type="color"
        className="note-hidden-input"
        tabIndex={-1}
        aria-hidden="true"
        value={activeTools.foreColor}
        onChange={handleTextColorChange}
      />
      <input
        ref={highlightColorInputRef}
        type="color"
        className="note-hidden-input"
        tabIndex={-1}
        aria-hidden="true"
        value={activeTools.highlightColor}
        onChange={handleHighlightColorChange}
      />
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="note-hidden-input"
        tabIndex={-1}
        aria-hidden="true"
        onChange={handleImageFileChange}
      />
    </motion.section>
  );
};

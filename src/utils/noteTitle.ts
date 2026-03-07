import { noteContentToPlainText, plainTextToHtml } from './noteContent';

export const extractNoteTitle = (content: string): string => {
  const plainText = noteContentToPlainText(content);
  const firstLine = plainText.split(/\r?\n/, 1)[0] ?? '';
  return firstLine.trim();
};

export const applyNoteTitleToContent = (content: string, title: string): string => {
  const plainText = noteContentToPlainText(content);
  const normalizedTitle = title.trim();
  const lines = plainText.split(/\r?\n/);

  if (lines.length <= 1) {
    return plainTextToHtml(normalizedTitle);
  }

  return plainTextToHtml([normalizedTitle, ...lines.slice(1)].join('\n'));
};

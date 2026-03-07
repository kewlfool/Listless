const decodeHtmlEntities = (value: string): string => {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
};

const escapeHtml = (value: string): string => {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

const isLikelyHtml = (content: string): boolean => /<\/?[a-z][\s\S]*>/i.test(content);

const htmlToPlainText = (html: string): string => {
  const withLineBreaks = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(div|p|li|h1|h2|h3|h4|h5|h6|blockquote|pre|ul|ol)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '- ')
    .replace(/<[^>]+>/g, '');

  return decodeHtmlEntities(withLineBreaks)
    .replace(/\u00a0/g, ' ')
    .replace(/\r\n?/g, '\n')
    .replace(/\n{3,}/g, '\n\n');
};

export const plainTextToHtml = (plainText: string): string => {
  const normalized = plainText.replace(/\r\n?/g, '\n');
  if (!normalized) {
    return '';
  }

  return normalized
    .split('\n')
    .map((line) => (line.length > 0 ? `<div>${escapeHtml(line)}</div>` : '<div><br></div>'))
    .join('');
};

export const normalizeStoredNoteContent = (content: string): string => {
  if (!content) {
    return '';
  }

  if (isLikelyHtml(content)) {
    return content;
  }

  return plainTextToHtml(content);
};

export const noteContentToPlainText = (content: string): string => {
  if (!content) {
    return '';
  }

  const normalized = normalizeStoredNoteContent(content);
  return htmlToPlainText(normalized);
};

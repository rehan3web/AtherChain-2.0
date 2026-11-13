/** Admin news uploads return a filename; other media APIs return full paths. */
export function newsMediaPath(value: string): string {
  const path = value.trim();
  if (/^https?:\/\//i.test(path) || path.startsWith('/')) return path;
  if (path.startsWith('uploads/news/')) return `/${path}`;
  // Only a filename belongs beneath this directory, never another URL scheme
  // or an arbitrary relative path. Preserve generic media URL validation.
  if (!path || path === '.' || path === '..' || /[/\\:?#\u0000-\u001f]/.test(path)) {
    throw new Error('The backend returned an invalid news image URL.');
  }
  return `/uploads/news/${encodeURIComponent(path)}`;
}

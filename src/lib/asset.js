// Resolve an image path. External URLs and data: URIs pass through untouched;
// bare paths like "crew/icons/nesta.jpg" are resolved against the app's base
// path (e.g. /pirateproject/) so they work on GitHub Pages and in local dev.
export function assetUrl(path) {
  if (!path) return ''
  if (/^(https?:)?\/\//i.test(path) || path.startsWith('data:')) return path
  const base = import.meta.env.BASE_URL || '/'
  return base.replace(/\/?$/, '/') + path.replace(/^\//, '')
}

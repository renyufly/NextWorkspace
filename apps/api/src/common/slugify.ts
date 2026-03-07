export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

export function createUniqueSlug(value: string, existingSlugs: Iterable<string>): string {
  const baseSlug = slugify(value) || 'workspace';
  const existing = new Set(existingSlugs);

  if (!existing.has(baseSlug)) {
    return baseSlug;
  }

  let counter = 2;

  while (existing.has(`${baseSlug}-${counter}`)) {
    counter += 1;
  }

  return `${baseSlug}-${counter}`;
}
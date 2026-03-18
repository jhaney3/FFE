export interface TagMeta {
  id: string;
  item_type_id: string;
  name: string;
  is_parent: boolean;
}

/** Name of the parent (grouping) attribute from an item's attribute array, or null. */
export function getParentAttr(attributes: string[], tags: TagMeta[]): string | null {
  const parentNames = new Set(tags.filter(t => t.is_parent).map(t => t.name));
  return attributes.find(a => parentNames.has(a)) ?? null;
}

/** The non-parent (child) attributes from an item's attribute array. */
export function getChildAttrs(attributes: string[], tags: TagMeta[]): string[] {
  const parentNames = new Set(tags.filter(t => t.is_parent).map(t => t.name));
  return attributes.filter(a => !parentNames.has(a));
}

/** Given a full combo string and the parent attr value, return the child-only label. */
export function childDisplayLabel(fullCombo: string, parentAttr: string | null): string {
  if (!parentAttr || parentAttr === '(no group)') return fullCombo;
  const parts = fullCombo.split(', ').filter(p => p !== parentAttr);
  return parts.length > 0 ? parts.join(', ') : '(no details)';
}

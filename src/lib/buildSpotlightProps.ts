import { type ImageKeyEntry } from '@/components/report/SpotlightMapView';

export interface Spotlight {
  typeName: string;
  parentAttr: string | null;  // null = whole type
  attrCombo: string | null;   // null = all combos (full sorted comma-joined string, e.g. "Adult, Black")
}

export interface CondBreakdown { excellent: number; good: number; fair: number; poor: number; }

export interface SpotlightProps {
  imageKey: ImageKeyEntry[];
  mapComboRoomCounts: Record<string, Record<string, number>>;
  mapComboRooms: Record<string, string[]>;
  mapComboRoomConditions: Record<string, Record<string, CondBreakdown>>;
  activeRoomIds: Set<string>;
}

/**
 * Pure function: given inventory items (with room_id), tagMeta, and a spotlight selection,
 * returns the props needed to render SpotlightMapView.
 */
export function buildSpotlightProps(
  items: any[],
  tagMeta: Map<string, boolean>,
  spotlight: Spotlight
): SpotlightProps {
  const { typeName: spotlightType, parentAttr: spotlightParent, attrCombo: spotlightAttr } = spotlight;

  const activeRoomIds = new Set<string>();
  const keyMap = new Map<string, ImageKeyEntry>();
  const comboRooms: Record<string, string[]> = {};
  const comboRoomCounts: Record<string, Record<string, number>> = {};
  const comboRoomConditions: Record<string, Record<string, CondBreakdown>> = {};

  for (const item of items) {
    const typeName = item.ItemTypes?.name;
    if (!typeName) continue;
    if (spotlightType && typeName !== spotlightType) continue;

    const combo = item.attributes?.length > 0 ? [...item.attributes].sort().join(', ') : '(no attributes)';
    if (spotlightAttr && combo !== spotlightAttr) continue;
    if (!spotlightAttr && spotlightParent && !(item.attributes || []).includes(spotlightParent)) continue;

    const qty = (item.qty_excellent || 0) + (item.qty_good || 0) + (item.qty_fair || 0) + (item.qty_poor || 0);

    if (qty > 0 && item.room_id) {
      activeRoomIds.add(item.room_id);
    }

    // When spotlighting a type without pinning to a specific combo, group by parent attr
    const groupByParent = !!spotlightType && !spotlightAttr && !spotlightParent;
    const parentAttr = groupByParent
      ? ((item.attributes || []).find((a: string) => tagMeta.get(`${item.item_type_id}:${a}`)) ?? null)
      : null;
    const label = groupByParent
      ? (parentAttr ?? '(ungrouped)')
      : spotlightType ? combo : `${typeName} — ${combo}`;

    // imageKey
    if (!keyMap.has(label)) {
      const keyAttrs = groupByParent
        ? (parentAttr ? [{ name: parentAttr, isParent: true }] : [])
        : [...(item.attributes || [])].sort((a: string, b: string) => {
            const aP = tagMeta.get(`${item.item_type_id}:${a}`) ?? false;
            const bP = tagMeta.get(`${item.item_type_id}:${b}`) ?? false;
            if (aP !== bP) return aP ? -1 : 1;
            return a.localeCompare(b);
          }).map((name: string) => ({ name, isParent: tagMeta.get(`${item.item_type_id}:${name}`) ?? false }));
      keyMap.set(label, { label, photoUrl: item.photo_url || null, count: qty, attrs: keyAttrs });
    } else {
      const e = keyMap.get(label)!;
      e.count += qty;
      if (!e.photoUrl && item.photo_url) {
        e.photoUrl = item.photo_url;
      } else if (item.photo_url?.includes('/assets/') && !e.photoUrl?.includes('/assets/')) {
        e.photoUrl = item.photo_url;
      }
    }

    // label → rooms + per-room counts + per-room condition breakdown (spotlight only, non-zero qty)
    if (spotlightType && qty > 0 && item.room_id) {
      if (!comboRooms[label]) comboRooms[label] = [];
      if (!comboRooms[label].includes(item.room_id)) comboRooms[label].push(item.room_id);
      if (!comboRoomCounts[label]) comboRoomCounts[label] = {};
      comboRoomCounts[label][item.room_id] = (comboRoomCounts[label][item.room_id] || 0) + qty;
      if (!comboRoomConditions[label]) comboRoomConditions[label] = {};
      if (!comboRoomConditions[label][item.room_id]) comboRoomConditions[label][item.room_id] = { excellent: 0, good: 0, fair: 0, poor: 0 };
      comboRoomConditions[label][item.room_id].excellent += item.qty_excellent || 0;
      comboRoomConditions[label][item.room_id].good      += item.qty_good      || 0;
      comboRoomConditions[label][item.room_id].fair      += item.qty_fair      || 0;
      comboRoomConditions[label][item.room_id].poor      += item.qty_poor      || 0;
    }
  }

  return {
    imageKey: Array.from(keyMap.values()).sort((a, b) => a.label.localeCompare(b.label)),
    mapComboRoomCounts: comboRoomCounts,
    mapComboRooms: comboRooms,
    mapComboRoomConditions: comboRoomConditions,
    activeRoomIds,
  };
}

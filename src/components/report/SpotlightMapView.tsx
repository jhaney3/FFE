'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { Package } from 'lucide-react';

const FloorPlanAnnotated = dynamic(
  () => import('./FloorPlanAnnotated'),
  { ssr: false, loading: () => (
    <div className="flex items-center justify-center h-48 bg-gray-100 rounded text-gray-400 text-sm gap-2">
      <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
      Rendering floor plan…
    </div>
  )}
);

export const SPOTLIGHT_COLORS = [
  '#6366f1', '#f59e0b', '#10b981', '#ef4444', '#3b82f6',
  '#8b5cf6', '#f97316', '#14b8a6', '#ec4899', '#84cc16',
];

export interface ImageKeyEntry {
  label: string;
  photoUrl: string | null;
  count: number;
  attrs?: Array<{ name: string; isParent: boolean }>;
}

interface Props {
  floorPlan: any;
  pageRooms: any[];
  activeRoomIds: Set<string>;
  pageNum: number;
  imageKey: ImageKeyEntry[];
  // comboLabel → { roomId → count }
  mapComboRoomCounts: Record<string, Record<string, number>>;
  mapComboRooms: Record<string, string[]>;
  onPhotoClick?: (url: string) => void;
}

// All coordinates are expressed as percentages of the outerRef container (0–100).
// Using a fixed viewBox="0 0 100 100" + preserveAspectRatio="none" means the SVG
// coordinate space always matches the container's aspect ratio, so percentage-based
// coordinates computed at screen time remain correct at print time (browser scales
// all dimensions uniformly, preserving ratios).
interface LineSpec { x1: number; y1: number; x2: number; y2: number; color: string; }

export default function SpotlightMapView({
  floorPlan, pageRooms, activeRoomIds, pageNum,
  imageKey, mapComboRoomCounts, mapComboRooms, onPhotoClick,
}: Props) {
  const outerRef  = useRef<HTMLDivElement>(null);
  const keyRefs   = useRef<(HTMLDivElement | null)[]>([]);
  const fpWrapRef = useRef<HTMLDivElement>(null);
  const [lines, setLines]                   = useState<LineSpec[]>([]);
  const [badgePositions, setBadgePositions] = useState<Map<string, { x: number; y: number }>>(new Map());

  const measure = useCallback(() => {
    if (!outerRef.current || !fpWrapRef.current) return;
    const outerRect = outerRef.current.getBoundingClientRect();
    const fpRect    = fpWrapRef.current.getBoundingClientRect();
    if (fpRect.width === 0 || fpRect.height === 0) return;

    // ── SVG connecting lines ──────────────────────────────────────────────────
    const next: LineSpec[] = [];
    imageKey.forEach((entry, i) => {
      const keyEl = keyRefs.current[i];
      if (!keyEl) return;
      const keyRect = keyEl.getBoundingClientRect();
      const color   = SPOTLIGHT_COLORS[i % SPOTLIGHT_COLORS.length];
      const x1 = (keyRect.left + keyRect.width / 2 - outerRect.left) / outerRect.width  * 100;
      const y1 = (keyRect.bottom - outerRect.top)                     / outerRect.height * 100;
      (mapComboRooms[entry.label] || []).forEach(roomId => {
        const room = pageRooms.find(r => r.id === roomId);
        if (!room?.map_coordinates) return;
        const { x, y, width, height } = room.map_coordinates;
        const x2 = (fpRect.left - outerRect.left + (x + width  / 2) / 100 * fpRect.width)  / outerRect.width  * 100;
        const y2 = (fpRect.top  - outerRect.top  + (y + height / 2) / 100 * fpRect.height) / outerRect.height * 100;
        next.push({ x1, y1, x2, y2, color });
      });
    });
    setLines(next);

    // ── Badge position force simulation ──────────────────────────────────────
    // Estimate badge size in %-of-fpWrapRef space so we know how much clearance we need.
    const BADGE_W_PCT = (36 / fpRect.width)  * 100;
    const BADGE_H_PCT = (20 / fpRect.height) * 100;
    const MIN_SEP_X   = BADGE_W_PCT * 1.15;
    const MIN_SEP_Y   = BADGE_H_PCT * 1.25;

    type Pos = { key: string; x: number; y: number; ox: number; oy: number };
    const positions: Pos[] = [];

    pageRooms.forEach(room => {
      if (!activeRoomIds.has(room.id) || !room.map_coordinates) return;
      const { x, y, width, height } = room.map_coordinates;
      const cx = x + width / 2;
      const cy = y + height / 2;
      // Build this room's badge list in imageKey order (matches render order)
      const roomBadges: { color: string; count: number }[] = [];
      imageKey.forEach((entry, i) => {
        const count = mapComboRoomCounts[entry.label]?.[room.id];
        if (count) roomBadges.push({ color: SPOTLIGHT_COLORS[i % SPOTLIGHT_COLORS.length], count });
      });
      if (roomBadges.length === 0) return;
      const spread = roomBadges.length > 1 ? ARC_R : 0;
      roomBadges.forEach((_, bi) => {
        const angle = roomBadges.length === 1 ? 0 : (bi / roomBadges.length) * 2 * Math.PI - Math.PI / 2;
        const px = cx + spread * Math.cos(angle);
        const py = cy + spread * Math.sin(angle);
        positions.push({ key: `${room.id}-${bi}`, x: px, y: py, ox: px, oy: py });
      });
    });

    // Iteratively push overlapping badges apart, with a weak spring back to origin.
    for (let iter = 0; iter < 120; iter++) {
      for (let i = 0; i < positions.length; i++) {
        for (let j = i + 1; j < positions.length; j++) {
          const pi = positions[i], pj = positions[j];
          const dx = pj.x - pi.x;
          const dy = pj.y - pi.y;
          if (Math.abs(dx) < MIN_SEP_X && Math.abs(dy) < MIN_SEP_Y) {
            // Push along the axis of minimum overlap (Separating Axis Theorem style)
            const overlapX = (MIN_SEP_X - Math.abs(dx)) / 2 + 0.01;
            const overlapY = (MIN_SEP_Y - Math.abs(dy)) / 2 + 0.01;
            if (overlapX < overlapY) {
              const sign = dx >= 0 ? 1 : -1;
              pi.x -= overlapX * sign;
              pj.x += overlapX * sign;
            } else {
              const sign = dy >= 0 ? 1 : -1;
              pi.y -= overlapY * sign;
              pj.y += overlapY * sign;
            }
          }
        }
      }
      // Weak spring toward original position — keeps badges anchored to their room
      for (const p of positions) {
        p.x += (p.ox - p.x) * 0.08;
        p.y += (p.oy - p.y) * 0.08;
      }
    }

    setBadgePositions(new Map(positions.map(p => [p.key, { x: p.x, y: p.y }])));
  }, [imageKey, mapComboRooms, mapComboRoomCounts, pageRooms, activeRoomIds]);

  // Re-measure when the floor plan image loads (fpWrapRef resizes as canvas renders)
  useEffect(() => {
    if (!fpWrapRef.current) return;
    const ro = new ResizeObserver(measure);
    ro.observe(fpWrapRef.current);
    return () => ro.disconnect();
  }, [measure]);

  useEffect(() => { measure(); }, [measure]);

  // Collect badges for each room: [ { color, count } ] ordered by imageKey index
  const roomBadgeMap = new Map<string, { color: string; count: number }[]>();
  pageRooms.forEach(room => {
    if (!activeRoomIds.has(room.id)) return;
    const badges: { color: string; count: number }[] = [];
    imageKey.forEach((entry, i) => {
      const count = mapComboRoomCounts[entry.label]?.[room.id];
      if (count) badges.push({ color: SPOTLIGHT_COLORS[i % SPOTLIGHT_COLORS.length], count });
    });
    if (badges.length > 0) roomBadgeMap.set(room.id, badges);
  });

  const ARC_R = 1.8; // spread radius as % of fpWrapRef container

  return (
    <div ref={outerRef} style={{ position: 'relative' }}>

      {/* ── SVG connecting lines ─────────────────────────────────────────────
          viewBox="0 0 100 100" + preserveAspectRatio="none":
          All coords are %-of-container, so no re-measurement needed at print time.
      ─────────────────────────────────────────────────────────────────────── */}
      <svg
        aria-hidden="true"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          zIndex: 10,
          overflow: 'visible',
        }}
      >
        {lines.map((ln, i) => {
          const midY = (ln.y1 + ln.y2) / 2;
          return (
            <path
              key={`p-${i}`}
              d={`M ${ln.x1},${ln.y1} C ${ln.x1},${midY} ${ln.x2},${midY} ${ln.x2},${ln.y2}`}
              fill="none"
              stroke={ln.color}
              strokeWidth="0.3"
              strokeDasharray="0.9 0.6"
              strokeOpacity="0.6"
              strokeLinecap="round"
            />
          );
        })}
      </svg>

      {/* ── Key images ── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, marginBottom: 32, position: 'relative', zIndex: 20 }}>
        {imageKey.map((entry, i) => {
          const color = SPOTLIGHT_COLORS[i % SPOTLIGHT_COLORS.length];
          return (
            <div
              key={entry.label}
              ref={el => { keyRefs.current[i] = el; }}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}
            >
              {entry.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={entry.photoUrl}
                  alt={entry.label}
                  onClick={() => onPhotoClick?.(entry.photoUrl!)}
                  className="w-36 h-36 object-cover rounded-xl bg-gray-100"
                  style={{
                    border: `3px solid ${color}`,
                    cursor: onPhotoClick ? 'zoom-in' : 'default',
                  }}
                />
              ) : (
                <div
                  className="w-36 h-36 rounded-xl bg-gray-100 flex items-center justify-center"
                  style={{ border: `3px solid ${color}` }}
                >
                  <Package size={36} color="#94a3b8" />
                </div>
              )}
              <div style={{ textAlign: 'center', maxWidth: 144 }}>
                {entry.attrs && entry.attrs.length > 0 ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, justifyContent: 'center', marginBottom: 2 }}>
                    {entry.attrs.map((attr, ai) => (
                      <span
                        key={ai}
                        style={{
                          fontSize: 10,
                          fontWeight: 600,
                          padding: '1px 6px',
                          borderRadius: 4,
                          lineHeight: 1.5,
                          background: attr.isParent ? '#fffbeb' : '#eef2ff',
                          color:      attr.isParent ? '#b45309' : '#4338ca',
                          border:     attr.isParent ? '1px solid #fcd34d' : '1px solid #c7d2fe',
                          WebkitPrintColorAdjust: 'exact',
                          printColorAdjust: 'exact',
                        } as React.CSSProperties}
                      >
                        {attr.name}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#1e293b', lineHeight: 1.3 }}>{entry.label}</div>
                )}
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{entry.count} total</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Annotated floor plan + arc-spread per-combo badges ── */}
      <div ref={fpWrapRef} style={{ position: 'relative' }}>
        <FloorPlanAnnotated
          floorPlan={floorPlan}
          rooms={pageRooms}
          activeRoomIds={activeRoomIds}
          pageNumber={pageNum}
        />

        {pageRooms
          .filter(r => activeRoomIds.has(r.id) && r.map_coordinates && roomBadgeMap.has(r.id))
          .flatMap(room => {
            const { x, y, width, height } = room.map_coordinates;
            const cx     = x + width  / 2;
            const cy     = y + height / 2;
            const badges = roomBadgeMap.get(room.id)!;
            const spread = badges.length > 1 ? ARC_R : 0;

            return badges.map((badge, bi) => {
              const key = `${room.id}-${bi}`;
              const pos = badgePositions.get(key);
              const angle = badges.length === 1 ? 0 : (bi / badges.length) * 2 * Math.PI - Math.PI / 2;
              const bx = pos?.x ?? (cx + spread * Math.cos(angle));
              const by = pos?.y ?? (cy + spread * Math.sin(angle));
              return (
                <div
                  key={key}
                  style={{
                    position: 'absolute',
                    left: `${bx}%`,
                    top:  `${by}%`,
                    transform: 'translate(-50%, -50%)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 3,
                    background: 'white',
                    border: `1.5px solid ${badge.color}`,
                    borderRadius: 999,
                    padding: '1px 5px 1px 3px',
                    fontSize: 10,
                    fontWeight: 700,
                    color: '#1e293b',
                    lineHeight: 1.5,
                    boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                    whiteSpace: 'nowrap',
                    pointerEvents: 'none',
                    zIndex: 20,
                    WebkitPrintColorAdjust: 'exact',
                    printColorAdjust: 'exact',
                  } as React.CSSProperties}
                >
                  <div style={{
                    width: 7, height: 7, borderRadius: '50%',
                    background: badge.color, flexShrink: 0,
                    WebkitPrintColorAdjust: 'exact',
                    printColorAdjust: 'exact',
                  } as React.CSSProperties} />
                  {badge.count}
                </div>
              );
            });
          })
        }
      </div>

    </div>
  );
}

'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useDroppable, useDraggable } from '@dnd-kit/core';
import { Building2, Layers, Package, Pencil, Trash2, GripVertical } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useLowBandwidth } from '@/lib/BandwidthContext';
import EditItemModal from './EditItemModal';

// ─── Room type → color ────────────────────────────────────────────────────────

const TYPE_COLORS: Record<string, string> = {
  sanctuary:          '#8b5cf6',
  chapel:             '#8b5cf6',
  worship:            '#8b5cf6',
  classroom:          '#3b82f6',
  library:            '#6366f1',
  office:             '#64748b',
  conference:         '#0ea5e9',
  'meeting room':     '#0ea5e9',
  kitchen:            '#f59e0b',
  storage:            '#78716c',
  bathroom:           '#06b6d4',
  restroom:           '#06b6d4',
  lobby:              '#14b8a6',
  foyer:              '#14b8a6',
  entrance:           '#14b8a6',
  gym:                '#22c55e',
  'fellowship hall':  '#22c55e',
  hall:               '#22c55e',
  hallway:            '#94a3b8',
  corridor:           '#94a3b8',
  nursery:            '#f43f5e',
  other:              '#a8a29e',
};

const FALLBACK_PALETTE = [
  '#f97316','#84cc16','#10b981','#06b6d4',
  '#8b5cf6','#ec4899','#f59e0b','#3b82f6',
];

function getRoomColor(roomType?: string): string {
  if (!roomType) return '#6b7280';
  const key = roomType.toLowerCase().trim();
  if (TYPE_COLORS[key]) return TYPE_COLORS[key];
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return FALLBACK_PALETTE[hash % FALLBACK_PALETTE.length];
}

// ─── Draggable item row ───────────────────────────────────────────────────────

function DraggableItemRow({ item, tagMeta, lowBandwidth, isRevealed, onReveal, onEdit, onDelete }: {
  item: any;
  tagMeta?: Map<string, boolean>;
  lowBandwidth: boolean;
  isRevealed: boolean;
  onReveal: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `inventory-item-${item.id}`,
    data: { type: 'inventory-item', item },
  });

  return (
    <div
      ref={setNodeRef}
      className={`group/item flex items-center gap-2 p-2 border border-gray-800 bg-gray-950/50 relative transition-opacity ${isDragging ? 'opacity-30' : 'opacity-100'}`}
    >
      {/* Drag handle */}
      <div
        {...listeners}
        {...attributes}
        className="text-gray-700 hover:text-gray-500 cursor-grab active:cursor-grabbing shrink-0 touch-none py-1 px-0.5"
        title="Drag to move to another room"
      >
        <GripVertical size={11} />
      </div>

      {/* Photo */}
      {item.photo_url && (!lowBandwidth || isRevealed) ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.photo_url} alt={item.ItemTypes?.name || 'Item'} className="w-9 h-9 object-cover bg-gray-800 shrink-0" loading="lazy" />
      ) : item.photo_url ? (
        <div
          onClick={onReveal}
          title="Click to load image"
          className="w-9 h-9 bg-gray-800 border border-gray-700 flex items-center justify-center text-gray-600 shrink-0 cursor-pointer hover:text-gray-400 hover:border-gray-600 transition-colors"
        >
          <Package size={14} />
        </div>
      ) : (
        <div className="w-9 h-9 bg-gray-800 border border-gray-700 flex items-center justify-center text-gray-600 shrink-0"><Package size={14} /></div>
      )}

      <div className="flex-1 min-w-0 pr-10">
        <p className="text-[12px] font-semibold text-gray-100 truncate leading-tight">{item.ItemTypes?.name}</p>
        <div className="flex items-center gap-1.5 mt-1 overflow-hidden">
          {item.qty_excellent > 0 && <span className="flex items-center gap-1 shrink-0"><span className="w-1 h-1 bg-green-400" /><span className="font-mono text-[10px] font-bold text-green-400">{item.qty_excellent}</span><span className="font-mono text-[9px] text-green-400/60">E</span></span>}
          {item.qty_good      > 0 && <span className="flex items-center gap-1 shrink-0"><span className="w-1 h-1 bg-blue-400"  /><span className="font-mono text-[10px] font-bold text-blue-400" >{item.qty_good}     </span><span className="font-mono text-[9px] text-blue-400/60" >G</span></span>}
          {item.qty_fair      > 0 && <span className="flex items-center gap-1 shrink-0"><span className="w-1 h-1 bg-yellow-400"/><span className="font-mono text-[10px] font-bold text-yellow-400">{item.qty_fair}     </span><span className="font-mono text-[9px] text-yellow-400/60">F</span></span>}
          {item.qty_poor      > 0 && <span className="flex items-center gap-1 shrink-0"><span className="w-1 h-1 bg-red-400"   /><span className="font-mono text-[10px] font-bold text-red-400"  >{item.qty_poor}     </span><span className="font-mono text-[9px] text-red-400/60"  >P</span></span>}
          {item.attributes?.length > 0 && <span className="ffe-attr w-px h-3 bg-gray-700 shrink-0 mx-0.5" />}
          {[...(item.attributes ?? [])].sort((a: string, b: string) => {
            const aP = tagMeta?.get(`${item.item_type_id}:${a}`) ?? false;
            const bP = tagMeta?.get(`${item.item_type_id}:${b}`) ?? false;
            if (aP !== bP) return aP ? -1 : 1;
            return a.localeCompare(b);
          }).map((tag: string) => {
            const isParent = tagMeta?.get(`${item.item_type_id}:${tag}`) ?? false;
            return (
              <span key={tag} className={`ffe-attr font-mono text-[9px] px-1 py-px border shrink-0 leading-none ${
                isParent
                  ? 'border-amber-700/50 bg-amber-900/20 text-amber-400'
                  : 'border-blue-800/50 bg-blue-900/15 text-blue-400'
              }`}>{tag}</span>
            );
          })}
        </div>
        {item.notes && <p className="ffe-notes font-mono text-[9px] text-gray-600 mt-0.5 truncate leading-tight">{item.notes}</p>}
      </div>

      <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover/item:opacity-100 transition-opacity">
        <button onClick={onEdit} className="p-1 text-gray-600 hover:text-blue-400 hover:bg-blue-500/10 transition-colors border border-transparent hover:border-blue-800" title="Edit item"><Pencil size={11} /></button>
        <button onClick={onDelete} className="p-1 text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-colors border border-transparent hover:border-red-800" title="Remove from room"><Trash2 size={11} /></button>
      </div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

type Corner = 'tl' | 'tr' | 'bl' | 'br';

export default function RoomZone({ room, items = [], activeAdmin, mapRef, onDeleteZone, onEditZone, onUpdateZone, onItemDeleted, spotlightType, spotlightParent, spotlightAttribute, tagMeta, closeSignal }: {
  room: any;
  items?: any[];
  activeAdmin: boolean;
  mapRef: React.RefObject<HTMLDivElement | null>;
  onDeleteZone?: (id: string) => void;
  onEditZone?:   (room: any) => void;
  onUpdateZone?: (id: string, coords: { x: number; y: number; width: number; height: number }) => void;
  onItemDeleted?: () => void;
  spotlightType?: string | null;
  spotlightParent?: string | null;
  spotlightAttribute?: string | null;
  tagMeta?: Map<string, boolean>;
  closeSignal?: number;
}) {
  const [isHovered, setIsHovered]         = useState(false);
  const [isOpen, setIsOpen]               = useState(false);
  const [editingItem, setEditingItem]     = useState<any>(null);
  const [expandedWidth, setExpandedWidth] = useState(80);

  // ── Refs ──────────────────────────────────────────────────────────────────
  const nameRef    = useRef<HTMLSpanElement | null>(null);
  const { lowBandwidth } = useLowBandwidth();
  const [revealedImages, setRevealedImages] = useState<Set<string>>(new Set());
  const zoneRef    = useRef<HTMLDivElement | null>(null);
  const popoutRef  = useRef<HTMLDivElement | null>(null);
  const svgLineRef = useRef<SVGLineElement | null>(null);

  // Live coordinates (updated imperatively during drag/resize to avoid re-renders)
  const coords = room.map_coordinates;
  const liveCoords = useRef({ x: coords.x, y: coords.y, width: coords.width, height: coords.height });

  // Zone drag
  const zoneDrag = useRef({ active: false, startX: 0, startY: 0, startCoords: { x: 0, y: 0, width: 0, height: 0 } });

  // Corner resize
  const resizeDrag = useRef({ active: false, corner: '' as Corner, startX: 0, startY: 0, startCoords: { x: 0, y: 0, width: 0, height: 0 } });

  // Popout drag/resize
  const popoutDrag    = useRef({ active: false, startX: 0, startY: 0, startLeft: 0, startTop: 0 });
  const pos           = useRef({ left: 0, top: 0 });
  const size          = useRef({ width: 360, height: 0 });
  const popoutResize  = useRef({ active: false, startX: 0, startY: 0, startW: 0, startH: 0 });

  const { isOver, setNodeRef } = useDroppable({ id: room.id, data: { type: 'room', room } });

  const combinedRef = (el: HTMLDivElement | null) => {
    zoneRef.current = el;
    setNodeRef(el);
  };

  // Sync liveCoords when room data changes (e.g. after save)
  useEffect(() => {
    liveCoords.current = { x: coords.x, y: coords.y, width: coords.width, height: coords.height };
  }, [coords.x, coords.y, coords.width, coords.height]);

  // Close popout when parent signals a background click
  useEffect(() => {
    if (closeSignal) setIsOpen(false);
  }, [closeSignal]);

  // ── Pill label measurement ─────────────────────────────────────────────────

  const measureName = useCallback(() => {
    if (nameRef.current) setExpandedWidth(nameRef.current.offsetWidth + 22);
  }, []);

  useEffect(() => {
    requestAnimationFrame(measureName);
  }, [measureName, room.name]);

  // ── SVG connector line ────────────────────────────────────────────────────

  const updateLine = () => {
    if (!svgLineRef.current || !zoneRef.current || !popoutRef.current) return;
    const zr = zoneRef.current.getBoundingClientRect();
    const pr = popoutRef.current.getBoundingClientRect();
    svgLineRef.current.setAttribute('x1', String(zr.left + zr.width  / 2));
    svgLineRef.current.setAttribute('y1', String(zr.top  + zr.height / 2));
    svgLineRef.current.setAttribute('x2', String(pr.left + pr.width  / 2));
    svgLineRef.current.setAttribute('y2', String(pr.top));
  };

  useEffect(() => {
    if (!isOpen) return;
    let rafId: number;
    const loop = () => { updateLine(); rafId = requestAnimationFrame(loop); };
    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    requestAnimationFrame(() => {
      if (popoutRef.current && size.current.height === 0) {
        const MAX_H = 320; // ~3 items
        const h = Math.min(popoutRef.current.offsetHeight, MAX_H);
        size.current.height = h;
        popoutRef.current.style.height = `${h}px`;
      }
    });
  }, [isOpen]);

  // ── Popout open ───────────────────────────────────────────────────────────

  const openPopout = () => {
    if (!zoneRef.current) return;
    const rect = zoneRef.current.getBoundingClientRect();
    const popoutW    = size.current.width || 360;
    const estimatedH = size.current.height || 320;

    const left = Math.min(
      Math.max(8, rect.left + rect.width / 2 - popoutW / 2),
      window.innerWidth - popoutW - 8
    );

    const spaceBelow = window.innerHeight - rect.bottom - 12;
    const spaceAbove = rect.top - 12;
    const flipUp = spaceBelow < estimatedH && spaceAbove > spaceBelow;

    const top = flipUp
      ? Math.max(8, rect.top - estimatedH - 12)
      : rect.bottom + 12;

    pos.current = { left, top };
    size.current = { width: popoutW, height: 0 };
    setIsOpen(true);
  };

  // ── Popout drag ───────────────────────────────────────────────────────────

  const handlePopoutDragDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (!popoutRef.current) return;
    popoutDrag.current = { active: true, startX: e.clientX, startY: e.clientY, startLeft: pos.current.left, startTop: pos.current.top };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePopoutDragMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!popoutDrag.current.active || !popoutRef.current) return;
    const left = popoutDrag.current.startLeft + (e.clientX - popoutDrag.current.startX);
    const top  = popoutDrag.current.startTop  + (e.clientY - popoutDrag.current.startY);
    pos.current = { left, top };
    popoutRef.current.style.left = `${left}px`;
    popoutRef.current.style.top  = `${top}px`;
    updateLine();
  };

  const handlePopoutDragUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!popoutDrag.current.active) return;
    popoutDrag.current.active = false;
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  // ── Popout resize ─────────────────────────────────────────────────────────

  const handlePopoutResizeDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (!popoutRef.current) return;
    popoutResize.current = { active: true, startX: e.clientX, startY: e.clientY, startW: size.current.width, startH: size.current.height || popoutRef.current.offsetHeight };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePopoutResizeMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!popoutResize.current.active || !popoutRef.current) return;
    const width  = Math.max(220, popoutResize.current.startW + (e.clientX - popoutResize.current.startX));
    const height = Math.max(150, popoutResize.current.startH + (e.clientY - popoutResize.current.startY));
    size.current = { width, height };
    popoutRef.current.style.width  = `${width}px`;
    popoutRef.current.style.height = `${height}px`;
  };

  const handlePopoutResizeUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!popoutResize.current.active) return;
    popoutResize.current.active = false;
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  // ── Zone drag (admin move) ────────────────────────────────────────────────

  const handleZonePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!activeAdmin || !mapRef.current) return;
    if (resizeDrag.current.active) return;
    e.stopPropagation();
    zoneDrag.current = {
      active:     true,
      startX:     e.clientX,
      startY:     e.clientY,
      startCoords: { ...liveCoords.current },
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handleZonePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!zoneDrag.current.active || !mapRef.current || !zoneRef.current) return;
    const map = mapRef.current.getBoundingClientRect();
    const dx  = (e.clientX - zoneDrag.current.startX) / map.width  * 100;
    const dy  = (e.clientY - zoneDrag.current.startY) / map.height * 100;
    const x   = Math.max(0, Math.min(100 - liveCoords.current.width,  zoneDrag.current.startCoords.x + dx));
    const y   = Math.max(0, Math.min(100 - liveCoords.current.height, zoneDrag.current.startCoords.y + dy));
    liveCoords.current = { ...liveCoords.current, x, y };
    zoneRef.current.style.left = `${x}%`;
    zoneRef.current.style.top  = `${y}%`;
  };

  const handleZonePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!zoneDrag.current.active) return;
    zoneDrag.current.active = false;
    e.currentTarget.releasePointerCapture(e.pointerId);
    if (onUpdateZone) onUpdateZone(room.id, { ...liveCoords.current });
  };

  // ── Corner resize (admin) ─────────────────────────────────────────────────

  const handleCornerDown = (e: React.PointerEvent<HTMLDivElement>, corner: Corner) => {
    e.stopPropagation();
    if (!mapRef.current) return;
    resizeDrag.current = {
      active:      true,
      corner,
      startX:      e.clientX,
      startY:      e.clientY,
      startCoords: { ...liveCoords.current },
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handleCornerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!resizeDrag.current.active || !mapRef.current || !zoneRef.current) return;
    const map    = mapRef.current.getBoundingClientRect();
    const dx     = (e.clientX - resizeDrag.current.startX) / map.width  * 100;
    const dy     = (e.clientY - resizeDrag.current.startY) / map.height * 100;
    const { corner, startCoords: sc } = resizeDrag.current;
    const MIN    = 2;

    let { x, y, width, height } = sc;

    if (corner === 'tl') { x = sc.x + dx; width  = sc.width  - dx; y = sc.y + dy; height = sc.height - dy; }
    if (corner === 'tr') {                 width  = sc.width  + dx; y = sc.y + dy; height = sc.height - dy; }
    if (corner === 'bl') { x = sc.x + dx; width  = sc.width  - dx;                height = sc.height + dy; }
    if (corner === 'br') {                 width  = sc.width  + dx;                height = sc.height + dy; }

    if (width  < MIN) { if (corner === 'tl' || corner === 'bl') x = sc.x + sc.width  - MIN; width  = MIN; }
    if (height < MIN) { if (corner === 'tl' || corner === 'tr') y = sc.y + sc.height - MIN; height = MIN; }

    liveCoords.current = { x, y, width, height };
    zoneRef.current.style.left   = `${x}%`;
    zoneRef.current.style.top    = `${y}%`;
    zoneRef.current.style.width  = `${width}%`;
    zoneRef.current.style.height = `${height}%`;
  };

  const handleCornerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!resizeDrag.current.active) return;
    resizeDrag.current.active = false;
    e.currentTarget.releasePointerCapture(e.pointerId);
    if (onUpdateZone) onUpdateZone(room.id, { ...liveCoords.current });
  };

  // ── Item delete ───────────────────────────────────────────────────────────

  const handleDeleteItem = async (itemId: string, photoUrl: string | null) => {
    const { error } = await supabase.from('InventoryItems').delete().eq('id', itemId);
    if (error) { alert(error.message); return; }
    if (photoUrl) await supabase.from('IncomingPhotos').update({ status: 'pending' }).eq('photo_url', photoUrl);

    // If this was an asset photo, delete from storage only when nothing else references it
    if (photoUrl) {
      const marker = '/inventory_photos/';
      const idx = photoUrl.indexOf(marker);
      if (idx !== -1) {
        const filePath = photoUrl.slice(idx + marker.length);
        if (filePath.startsWith('assets/')) {
          const [{ count: itemCount }, { count: assetCount }] = await Promise.all([
            supabase.from('InventoryItems').select('id', { count: 'exact', head: true }).eq('photo_url', photoUrl),
            supabase.from('Assets').select('id', { count: 'exact', head: true }).eq('photo_url', photoUrl),
          ]);
          if ((itemCount ?? 1) === 0 && (assetCount ?? 1) === 0) {
            await supabase.storage.from('inventory_photos').remove([filePath]);
          }
        }
      }
    }

    if (onItemDeleted) onItemDeleted();
  };

  // ── Render ────────────────────────────────────────────────────────────────

  // Spotlight computation
  const spotlightActive = !!spotlightType;
  const spotlightCount = spotlightActive
    ? items.reduce((sum, item) => {
        if (item.ItemTypes?.name !== spotlightType) return sum;
        if (spotlightAttribute) {
          // Full combo match (e.g. "Adult, Black") — sort to match ItemTypeFilter's comboKey
          const combo = [...(item.attributes || [])].sort().join(', ');
          if (combo !== spotlightAttribute) return sum;
        } else if (spotlightParent) {
          if (spotlightParent === '(ungrouped)') {
            // Match items that have no parent attribute
            const hasParent = (item.attributes || []).some((a: string) => tagMeta?.get(`${item.item_type_id}:${a}`));
            if (hasParent) return sum;
          } else {
            // Parent-only match — item must have the parent attribute anywhere in its array
            if (!(item.attributes || []).includes(spotlightParent)) return sum;
          }
        }
        return sum + (item.qty_excellent || 0) + (item.qty_good || 0) + (item.qty_fair || 0) + (item.qty_poor || 0);
      }, 0)
    : 0;
  const spotlightMatch = spotlightActive && spotlightCount > 0;
  const spotlightDim   = spotlightActive && spotlightCount === 0;

  const dotColor = getRoomColor(room.room_type);
  const active   = isHovered || isOpen;

  return (
    <div
      ref={combinedRef}
      data-room-zone
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      // Stop map from starting a new-zone draw when clicking an existing zone in admin mode
      onMouseDown={(e) => { if (activeAdmin) e.stopPropagation(); }}
      onPointerDown={activeAdmin ? handleZonePointerDown : undefined}
      onPointerMove={activeAdmin ? handleZonePointerMove : undefined}
      onPointerUp={activeAdmin   ? handleZonePointerUp   : undefined}
      onPointerCancel={activeAdmin ? handleZonePointerUp : undefined}
      onClick={(e) => {
        if (activeAdmin) return;
        e.stopPropagation();
        if (isOpen) setIsOpen(false);
        else openPopout();
      }}
      className={`absolute group transition-all ${
        isOver
          ? 'bg-blue-500/40 border-2 border-blue-400 z-20'
          : activeAdmin
            ? 'bg-blue-500/10 border border-blue-600/40 hover:bg-blue-500/20 z-10 hover:z-20 cursor-move'
            : 'hover:bg-blue-500/8 border border-transparent hover:border-blue-400/30 z-10 cursor-pointer'
      } ${isOpen && !activeAdmin ? '!z-[100] !border-blue-400/40 bg-blue-500/8' : ''} ${
        spotlightDim ? 'opacity-30 grayscale' : ''
      }`}
      style={{
        left:   `${coords.x}%`,
        top:    `${coords.y}%`,
        width:  `${coords.width}%`,
        height: `${coords.height}%`,
        ...(spotlightMatch ? {
          backgroundColor: 'rgba(99,102,241,0.35)',
          outline: '2px solid #6366f1',
        } : {}),
      }}
    >

      {/* ── Expanding pill label (non-admin) ── */}
      {!activeAdmin && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 pointer-events-none">
          {/* Hidden measuring span */}
          <span
            ref={nameRef}
            aria-hidden="true"
            style={{ position: 'absolute', visibility: 'hidden', pointerEvents: 'none', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap', top: 0, left: 0 }}
          >
            {room.name}
          </span>
          {/* Animated pill */}
          <div
            style={{
              width:           active ? expandedWidth : 10,
              height:          active ? 20 : 10,
              backgroundColor: dotColor,
              borderRadius:    2,
              overflow:        'hidden',
              display:         'flex',
              alignItems:      'center',
              justifyContent:  'center',
              flexShrink:      0,
              whiteSpace:      'nowrap',
              boxShadow:       '0 1px 3px rgba(0,0,0,0.5)',
              transition:      'width 0.2s cubic-bezier(0.4,0,0.2,1), height 0.18s cubic-bezier(0.4,0,0.2,1)',
            }}
          >
            <span style={{ color: 'white', fontSize: 10, fontWeight: 600, lineHeight: 1, letterSpacing: '0.04em', userSelect: 'none', opacity: active ? 1 : 0, transition: active ? 'opacity 0.12s ease-out 0.08s' : 'opacity 0.06s ease-out' }}>
              {room.name}
            </span>
          </div>
        </div>
      )}

      {/* ── Zone name label in admin mode ── */}
      {activeAdmin && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-10 px-2 py-0.5 font-mono text-[10px] font-semibold text-blue-300 bg-gray-900/80 whitespace-nowrap max-w-[90%] truncate border border-blue-800/50">
          {room.name}
        </div>
      )}

      {/* ── Spotlight count badge ── */}
      {spotlightMatch && (
        <div className="absolute top-1 right-1 z-40 pointer-events-none bg-blue-500 text-white font-mono text-[10px] font-bold px-1.5 py-0.5 leading-none">
          {spotlightCount}
        </div>
      )}

      {/* ── Edit / Delete toolbar (admin) — floats above zone center, clear of corner handles ── */}
      {activeAdmin && (onEditZone || onDeleteZone) && (
        <div
          className="absolute -top-7 left-1/2 -translate-x-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-30"
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {onEditZone && (
            <button
              onClick={(e) => { e.stopPropagation(); onEditZone(room); }}
              className="bg-gray-900 border border-gray-700 hover:border-blue-500 hover:text-blue-400 text-gray-400 p-1.5 flex items-center justify-center cursor-pointer transition-colors"
              title="Edit Zone"
            >
              <Pencil size={12} />
            </button>
          )}
          {onDeleteZone && (
            <button
              onClick={(e) => { e.stopPropagation(); onDeleteZone(room.id); }}
              className="bg-gray-900 border border-gray-700 hover:border-red-500 hover:text-red-400 text-gray-400 p-1.5 flex items-center justify-center cursor-pointer transition-colors"
              title="Delete Zone"
            >
              <Trash2 size={12} />
            </button>
          )}
        </div>
      )}

      {/* ── Corner resize handles (admin) ── */}
      {activeAdmin && (
        <>
          {(['tl', 'tr', 'bl', 'br'] as Corner[]).map(corner => (
            <div
              key={corner}
              className={`absolute w-2.5 h-2.5 bg-gray-900 border border-blue-500 z-30 touch-none ${
                corner === 'tl' ? '-top-1.5 -left-1.5  cursor-nw-resize' :
                corner === 'tr' ? '-top-1.5 -right-1.5 cursor-ne-resize' :
                corner === 'bl' ? '-bottom-1.5 -left-1.5  cursor-sw-resize' :
                                  '-bottom-1.5 -right-1.5 cursor-se-resize'
              }`}
              onPointerDown={(e) => handleCornerDown(e, corner)}
              onPointerMove={handleCornerMove}
              onPointerUp={handleCornerUp}
              onPointerCancel={handleCornerUp}
            />
          ))}
        </>
      )}

      {/* ── Popout portal ── */}
      {isOpen && !activeAdmin && createPortal(
        <>
          <style>{`
            .ffe-popout  { container-type: inline-size; }
            .ffe-attr    { display: none; }
            .ffe-notes   { display: none; }
            @container (min-width: 340px) {
              .ffe-attr  { display: inline-block; }
              .ffe-notes { display: block; }
            }
          `}</style>

          <svg style={{ position: 'fixed', inset: 0, width: '100vw', height: '100vh', pointerEvents: 'none', zIndex: 9998 }}>
            <line ref={svgLineRef} stroke="#0d7fff" strokeWidth="1" strokeDasharray="4 4" strokeLinecap="square" />
          </svg>

          <div
            ref={popoutRef}
            data-room-popout
            style={{ position: 'fixed', left: pos.current.left, top: pos.current.top, width: size.current.width, zIndex: 9999 }}
            className="ffe-popout bg-gray-900 border border-gray-700 surface-raised flex flex-col select-none overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drag handle */}
            <div
              className="w-full flex justify-center pt-2.5 pb-1 cursor-grab active:cursor-grabbing shrink-0 group/handle touch-none"
              onPointerDown={handlePopoutDragDown}
              onPointerMove={handlePopoutDragMove}
              onPointerUp={handlePopoutDragUp}
              onPointerCancel={handlePopoutDragUp}
            >
              <div className="w-8 h-px bg-gray-700 group-hover/handle:bg-gray-500 transition-colors" />
            </div>

            <div className="flex-1 flex flex-col overflow-hidden px-4 pb-3 gap-2.5 min-h-0">
              {/* Zone header */}
              <div className="flex items-start justify-between border-b border-gray-800 pb-2.5 shrink-0">
                <div className="flex-1 pr-2">
                  <h3 className="text-gray-100 font-semibold text-sm flex items-center gap-1.5 break-words leading-tight">
                    <span className="w-2 h-2 shrink-0 border border-gray-700" style={{ backgroundColor: dotColor }} />
                    {room.name}
                  </h3>
                  <div className="flex items-center gap-3 mt-1 font-mono text-[10px] text-gray-500">
                    {room.building_name && <span className="flex items-center gap-1"><Building2 size={11} />{room.building_name}</span>}
                    {room.level_name    && <span className="flex items-center gap-1"><Layers    size={11} />{room.level_name}</span>}
                  </div>
                </div>
                {room.room_type && (
                  <span className="font-mono text-[9px] uppercase tracking-[0.12em] px-2 py-0.5 border shrink-0 ml-2" style={{ color: dotColor, borderColor: `${dotColor}44`, backgroundColor: `${dotColor}11` }}>
                    {room.room_type}
                  </span>
                )}
              </div>

              {/* Item list */}
              <div className="flex-1 space-y-1.5 overflow-y-auto pr-1 min-h-0 custom-scrollbar">
                {items.length > 0 ? items.map(item => (
                  <DraggableItemRow
                    key={item.id}
                    item={item}
                    tagMeta={tagMeta}
                    lowBandwidth={lowBandwidth}
                    isRevealed={revealedImages.has(item.id)}
                    onReveal={() => setRevealedImages(prev => { const s = new Set(prev); s.add(item.id); return s; })}
                    onEdit={() => setEditingItem(item)}
                    onDelete={() => handleDeleteItem(item.id, item.photo_url)}
                  />
                )) : (
                  <div className="text-center py-6 flex flex-col items-center gap-1.5">
                    <Package size={18} className="text-gray-700" />
                    <p className="font-mono text-[10px] text-gray-600 tracking-wider uppercase">No items assigned</p>
                  </div>
                )}
              </div>
            </div>

            {/* Resize handle */}
            <div
              className="absolute bottom-0 right-0 w-5 h-5 cursor-se-resize touch-none group/resize"
              onPointerDown={handlePopoutResizeDown}
              onPointerMove={handlePopoutResizeMove}
              onPointerUp={handlePopoutResizeUp}
              onPointerCancel={handlePopoutResizeUp}
            >
              <svg width="8" height="8" viewBox="0 0 8 8" className="absolute bottom-1.5 right-1.5 text-gray-700 group-hover/resize:text-gray-500 transition-colors">
                <path d="M7 1L1 7M7 4L4 7" stroke="currentColor" strokeWidth="1" strokeLinecap="square"/>
              </svg>
            </div>
          </div>
        </>,
        document.body
      )}

      {editingItem && (
        <EditItemModal
          item={editingItem}
          onClose={() => setEditingItem(null)}
          onSaved={() => { if (onItemDeleted) onItemDeleted(); }}
        />
      )}
    </div>
  );
}

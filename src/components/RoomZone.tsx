'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useDroppable } from '@dnd-kit/core';
import { Building2, Layers, Package, Pencil, Tag, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
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

// ─── Component ────────────────────────────────────────────────────────────────

type Corner = 'tl' | 'tr' | 'bl' | 'br';

export default function RoomZone({ room, items = [], activeAdmin, mapRef, onDeleteZone, onEditZone, onUpdateZone, onItemDeleted }: {
  room: any;
  items?: any[];
  activeAdmin: boolean;
  mapRef: React.RefObject<HTMLDivElement | null>;
  onDeleteZone?: (id: string) => void;
  onEditZone?:   (room: any) => void;
  onUpdateZone?: (id: string, coords: { x: number; y: number; width: number; height: number }) => void;
  onItemDeleted?: () => void;
}) {
  const [isHovered, setIsHovered]         = useState(false);
  const [isOpen, setIsOpen]               = useState(false);
  const [editingItem, setEditingItem]     = useState<any>(null);
  const [expandedWidth, setExpandedWidth] = useState(80);

  // ── Refs ──────────────────────────────────────────────────────────────────
  const nameRef    = useRef<HTMLSpanElement | null>(null);
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
  const size          = useRef({ width: 288, height: 0 });
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
        const h = popoutRef.current.offsetHeight;
        size.current.height = h;
        popoutRef.current.style.height = `${h}px`;
      }
    });
  }, [isOpen]);

  // ── Popout open ───────────────────────────────────────────────────────────

  const openPopout = () => {
    if (!zoneRef.current) return;
    const rect = zoneRef.current.getBoundingClientRect();
    const popoutW    = size.current.width || 288;
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
    if (!confirm('Are you sure you want to delete this item?')) return;
    const { error } = await supabase.from('InventoryItems').delete().eq('id', itemId);
    if (error) { alert(error.message); return; }
    if (photoUrl) await supabase.from('IncomingPhotos').update({ status: 'pending' }).eq('photo_url', photoUrl);
    if (onItemDeleted) onItemDeleted();
  };

  // ── Render ────────────────────────────────────────────────────────────────

  const dotColor = getRoomColor(room.room_type);
  const active   = isHovered || isOpen;

  return (
    <div
      ref={combinedRef}
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
      className={`absolute group ${
        isOver
          ? 'bg-blue-500/50 border-2 border-blue-400 ring-4 ring-blue-300/50 shadow-lg z-20 scale-[1.02]'
          : activeAdmin
            ? 'bg-indigo-500/20 border border-indigo-500/60 hover:bg-indigo-500/35 z-10 hover:z-20 cursor-move'
            : 'hover:bg-blue-500/10 border border-transparent hover:border-blue-300/50 z-10 cursor-pointer'
      } ${isOpen && !activeAdmin ? '!z-[100] !border-blue-400/50 bg-blue-500/10 ring-2 ring-blue-400/20' : ''}`}
      style={{
        left:   `${coords.x}%`,
        top:    `${coords.y}%`,
        width:  `${coords.width}%`,
        height: `${coords.height}%`,
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
              width:           active ? expandedWidth : 12,
              height:          active ? 22 : 12,
              backgroundColor: dotColor,
              borderRadius:    9999,
              overflow:        'hidden',
              display:         'flex',
              alignItems:      'center',
              justifyContent:  'center',
              flexShrink:      0,
              whiteSpace:      'nowrap',
              boxShadow:       '0 1px 4px rgba(0,0,0,0.35), 0 0 0 2px rgba(255,255,255,0.55)',
              transition:      'width 0.25s cubic-bezier(0.4,0,0.2,1), height 0.2s cubic-bezier(0.4,0,0.2,1)',
            }}
          >
            <span style={{ color: 'white', fontSize: 11, fontWeight: 700, lineHeight: 1, userSelect: 'none', opacity: active ? 1 : 0, transition: active ? 'opacity 0.15s ease-out 0.1s' : 'opacity 0.08s ease-out' }}>
              {room.name}
            </span>
          </div>
        </div>
      )}

      {/* ── Zone name label in admin mode ── */}
      {activeAdmin && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-10 px-2 py-0.5 rounded text-[10px] font-bold text-indigo-200 bg-indigo-900/50 whitespace-nowrap max-w-[90%] truncate">
          {room.name}
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
              className="bg-indigo-500 hover:bg-indigo-600 text-white p-1.5 rounded-full shadow-lg flex items-center justify-center cursor-pointer"
              title="Edit Zone"
            >
              <Pencil size={12} />
            </button>
          )}
          {onDeleteZone && (
            <button
              onClick={(e) => { e.stopPropagation(); onDeleteZone(room.id); }}
              className="bg-red-500 hover:bg-red-600 text-white p-1.5 rounded-full shadow-lg flex items-center justify-center cursor-pointer"
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
              className={`absolute w-3 h-3 bg-white border-2 border-indigo-500 z-30 touch-none ${
                corner === 'tl' ? '-top-1.5 -left-1.5  cursor-nw-resize rounded-tl-sm' :
                corner === 'tr' ? '-top-1.5 -right-1.5 cursor-ne-resize rounded-tr-sm' :
                corner === 'bl' ? '-bottom-1.5 -left-1.5  cursor-sw-resize rounded-bl-sm' :
                                  '-bottom-1.5 -right-1.5 cursor-se-resize rounded-br-sm'
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
            <line ref={svgLineRef} stroke="#6366f1" strokeWidth="1.5" strokeDasharray="5 4" strokeLinecap="round" />
          </svg>

          <div
            ref={popoutRef}
            style={{ position: 'fixed', left: pos.current.left, top: pos.current.top, width: size.current.width, zIndex: 9999 }}
            className="ffe-popout bg-black/85 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl flex flex-col select-none overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="w-full flex justify-center pt-3 pb-1 cursor-grab active:cursor-grabbing shrink-0 group/handle touch-none"
              onPointerDown={handlePopoutDragDown}
              onPointerMove={handlePopoutDragMove}
              onPointerUp={handlePopoutDragUp}
              onPointerCancel={handlePopoutDragUp}
            >
              <div className="w-12 h-1.5 bg-white/20 group-hover/handle:bg-white/40 rounded-full transition-colors" />
            </div>

            <div className="flex-1 flex flex-col overflow-hidden px-4 pb-4 gap-3 min-h-0">
              <div className="flex items-start justify-between border-b border-white/10 pb-2 shrink-0">
                <div className="flex-1 pr-2">
                  <h3 className="text-white font-semibold text-sm flex items-center gap-1.5 break-words leading-tight">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0 border border-white/20" style={{ backgroundColor: dotColor }} />
                    {room.name}
                  </h3>
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                    {room.building_name && <span className="flex items-center gap-1"><Building2 size={12} />{room.building_name}</span>}
                    {room.level_name    && <span className="flex items-center gap-1"><Layers    size={12} />{room.level_name}</span>}
                  </div>
                </div>
                {room.room_type && (
                  <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-sm shrink-0 ml-2" style={{ color: dotColor, backgroundColor: `${dotColor}22` }}>
                    {room.room_type}
                  </span>
                )}
              </div>

              <div className="flex-1 space-y-2 overflow-y-auto pr-1 min-h-0">
                {items.length > 0 ? items.map(item => (
                  <div key={item.id} className="group/item flex items-center gap-2.5 p-2 rounded-lg bg-white/5 border border-white/5 relative">
                    {item.photo_url ? (
                      <img src={item.photo_url} alt={item.ItemTypes?.name || 'Item'} className="w-10 h-10 rounded-md object-cover bg-gray-800 shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded-md bg-gray-800 flex items-center justify-center text-gray-500 shrink-0"><Package size={16} /></div>
                    )}
                    <div className="flex-1 min-w-0 pr-12">
                      <p className="text-[13px] font-semibold text-gray-100 truncate leading-tight">{item.ItemTypes?.name}</p>
                      <div className="flex items-center gap-2 mt-1 overflow-hidden">
                        {item.qty_excellent > 0 && <span className="flex items-center gap-1 shrink-0"><span className="w-1.5 h-1.5 rounded-full bg-green-400" /><span className="text-[11px] font-bold text-green-400">{item.qty_excellent}</span><span className="text-[10px] text-green-400/60">Exc</span></span>}
                        {item.qty_good      > 0 && <span className="flex items-center gap-1 shrink-0"><span className="w-1.5 h-1.5 rounded-full bg-blue-400"  /><span className="text-[11px] font-bold text-blue-400" >{item.qty_good}     </span><span className="text-[10px] text-blue-400/60" >Good</span></span>}
                        {item.qty_fair      > 0 && <span className="flex items-center gap-1 shrink-0"><span className="w-1.5 h-1.5 rounded-full bg-yellow-400"/><span className="text-[11px] font-bold text-yellow-400">{item.qty_fair}     </span><span className="text-[10px] text-yellow-400/60">Fair</span></span>}
                        {item.qty_poor      > 0 && <span className="flex items-center gap-1 shrink-0"><span className="w-1.5 h-1.5 rounded-full bg-red-400"   /><span className="text-[11px] font-bold text-red-400"  >{item.qty_poor}     </span><span className="text-[10px] text-red-400/60"  >Poor</span></span>}
                        {item.attributes?.length > 0 && <span className="ffe-attr w-px h-3 bg-white/15 shrink-0 mx-0.5" />}
                        {item.attributes?.map((tag: string) => (
                          <span key={tag} className="ffe-attr text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-300/90 shrink-0 leading-none">{tag}</span>
                        ))}
                      </div>
                      {item.notes && <p className="ffe-notes text-[10px] text-gray-500 mt-0.5 truncate italic leading-tight">{item.notes}</p>}
                    </div>
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover/item:opacity-100 transition-opacity">
                      <button onClick={() => setEditingItem(item)} className="p-1.5 rounded-md text-gray-400 hover:text-blue-400 hover:bg-blue-500/10 transition-colors" title="Edit item"><Pencil size={13} /></button>
                      <button onClick={() => handleDeleteItem(item.id, item.photo_url)} className="p-1.5 rounded-md text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-colors" title="Move back to triage queue"><Trash2 size={13} /></button>
                    </div>
                  </div>
                )) : (
                  <div className="text-center py-4 text-xs text-gray-500 flex flex-col items-center gap-1">
                    <Package size={20} className="opacity-50" />
                    <p>No items assigned yet</p>
                  </div>
                )}
              </div>
            </div>

            <div
              className="absolute bottom-0 right-0 w-5 h-5 cursor-se-resize touch-none group/resize"
              onPointerDown={handlePopoutResizeDown}
              onPointerMove={handlePopoutResizeMove}
              onPointerUp={handlePopoutResizeUp}
              onPointerCancel={handlePopoutResizeUp}
            >
              <svg width="10" height="10" viewBox="0 0 10 10" className="absolute bottom-1.5 right-1.5 text-white/20 group-hover/resize:text-white/50 transition-colors">
                <path d="M9 1L1 9M9 5L5 9M9 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
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

'use client';

import { useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useDroppable } from '@dnd-kit/core';
import { Building2, Layers, Package, Pencil, Tag, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import EditItemModal from './EditItemModal';

export default function RoomZone({ room, items = [], activeAdmin, onDeleteZone, onItemDeleted }: {
  room: any; items?: any[]; activeAdmin: boolean; onDeleteZone?: (id: string) => void; onItemDeleted?: () => void;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);

  // Refs — no state during drag so there are zero re-renders while moving
  const zoneRef = useRef<HTMLDivElement | null>(null);
  const popoutRef = useRef<HTMLDivElement | null>(null);
  const svgLineRef = useRef<SVGLineElement | null>(null);
  const drag = useRef({ active: false, startX: 0, startY: 0, startLeft: 0, startTop: 0 });
  const pos = useRef({ left: 0, top: 0 }); // current screen-space position of popout

  const { isOver, setNodeRef } = useDroppable({ id: room.id, data: { type: 'room', room } });

  // Combine dnd-kit droppable ref with our zone ref
  const combinedRef = (el: HTMLDivElement | null) => {
    zoneRef.current = el;
    setNodeRef(el);
  };

  // Redraws the SVG connector line using live bounding rects — works even after PDF pan/zoom
  const updateLine = () => {
    if (!svgLineRef.current || !zoneRef.current || !popoutRef.current) return;
    const zr = zoneRef.current.getBoundingClientRect();
    const pr = popoutRef.current.getBoundingClientRect();
    svgLineRef.current.setAttribute('x1', String(zr.left + zr.width / 2));
    svgLineRef.current.setAttribute('y1', String(zr.top + zr.height / 2));
    svgLineRef.current.setAttribute('x2', String(pr.left + pr.width / 2));
    svgLineRef.current.setAttribute('y2', String(pr.top));
  };

  // Draw line after portal mounts into the DOM
  useEffect(() => {
    if (isOpen) requestAnimationFrame(updateLine);
  }, [isOpen]);

  // Also redraw on every render (handles PDF pan/zoom shifting the zone)
  useEffect(() => {
    if (isOpen) updateLine();
  });

  const openPopout = () => {
    if (!zoneRef.current) return;
    const rect = zoneRef.current.getBoundingClientRect();
    pos.current = {
      left: Math.max(8, rect.left + rect.width / 2 - 144), // center the 288px wide popout
      top: Math.min(window.innerHeight - 100, rect.bottom + 12),
    };
    setIsOpen(true);
  };

  // --- Drag handlers: all imperative, zero setState ---

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (!popoutRef.current) return;
    drag.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      startLeft: pos.current.left,
      startTop: pos.current.top,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current.active || !popoutRef.current) return;
    const left = drag.current.startLeft + (e.clientX - drag.current.startX);
    const top  = drag.current.startTop  + (e.clientY - drag.current.startY);
    pos.current = { left, top };
    // Direct DOM write — no React re-render, no lag
    popoutRef.current.style.left = `${left}px`;
    popoutRef.current.style.top  = `${top}px`;
    updateLine();
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current.active) return;
    drag.current.active = false;
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const handleDeleteItem = async (itemId: string, photoUrl: string | null) => {
    if (!confirm('Are you sure you want to delete this item?')) return;
    const { error } = await supabase.from('InventoryItems').delete().eq('id', itemId);
    if (error) { alert(error.message); return; }
    if (photoUrl) await supabase.from('IncomingPhotos').update({ status: 'pending' }).eq('photo_url', photoUrl);
    if (onItemDeleted) onItemDeleted();
  };

  const coords = room.map_coordinates;

  return (
    <div
      ref={combinedRef}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={(e) => {
        if (activeAdmin) return;
        e.stopPropagation();
        if (isOpen) setIsOpen(false);
        else openPopout();
      }}
      className={`absolute transition-all group ${
        isOver
          ? 'bg-blue-500/50 border-2 border-blue-400 ring-4 ring-blue-300/50 shadow-lg z-20 scale-[1.02]'
          : activeAdmin
            ? 'bg-indigo-500/20 border border-indigo-500/50 hover:bg-indigo-500/40 z-10 hover:z-20'
            : 'hover:bg-blue-500/20 border border-transparent hover:border-blue-300 z-10'
      } ${isOpen && !activeAdmin ? '!z-[100] !border-blue-400 bg-blue-500/10 shadow-md ring-2 ring-blue-400/30' : ''}`}
      style={{
        left: `${coords.x}%`,
        top: `${coords.y}%`,
        width: `${coords.width}%`,
        height: `${coords.height}%`,
      }}
    >
      {/* Room label pill */}
      <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center justify-center pointer-events-none transition-all duration-200 ${
        isHovered || isOpen ? 'z-40 scale-110 drop-shadow-lg' : 'z-30 opacity-90'
      }`}>
        <div className="px-2.5 py-1 text-[10px] md:text-[11px] font-bold text-gray-800 dark:text-gray-100 bg-white/90 dark:bg-gray-900/90 backdrop-blur-md rounded-full shadow-sm whitespace-nowrap border border-gray-200/50 dark:border-gray-700/50 flex items-center gap-1.5">
          {room.name}
        </div>
      </div>

      {/* Admin delete button */}
      {activeAdmin && onDeleteZone && (
        <button
          onMouseDown={(e) => { e.stopPropagation(); onDeleteZone(room.id); }}
          className="absolute -top-3 -right-3 bg-red-500 hover:bg-red-600 text-white p-1.5 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-30 flex items-center justify-center cursor-pointer"
          title="Delete Zone"
        >
          <Trash2 size={12} />
        </button>
      )}

      {/*
        Portal: renders directly into document.body, completely outside TransformWrapper.
        This means:
          - Fixed screen-space coordinates — no zoom/pan distortion
          - Pointer events never bubble into react-zoom-pan-pinch
          - Drag is driven by direct DOM writes, zero React re-renders during move
      */}
      {isOpen && !activeAdmin && createPortal(
        <>
          {/* Full-viewport SVG for the connector line */}
          <svg
            style={{ position: 'fixed', inset: 0, width: '100vw', height: '100vh', pointerEvents: 'none', zIndex: 9998 }}
          >
            <line
              ref={svgLineRef}
              stroke="#6366f1"
              strokeWidth="1.5"
              strokeDasharray="5 4"
              strokeLinecap="round"
            />
          </svg>

          {/* Floating popout table */}
          <div
            ref={popoutRef}
            style={{ position: 'fixed', left: pos.current.left, top: pos.current.top, width: 288, zIndex: 9999 }}
            className="bg-black/85 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl flex flex-col select-none"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drag handle — pointer events only here, content scrolls normally */}
            <div
              className="w-full flex justify-center pt-3 pb-1 cursor-grab active:cursor-grabbing shrink-0 group/handle touch-none"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
            >
              <div className="w-12 h-1.5 bg-white/20 group-hover/handle:bg-white/40 rounded-full transition-colors" />
            </div>

            <div className="px-4 pb-4 space-y-3">
              {/* Header */}
              <div className="flex items-start justify-between border-b border-white/10 pb-2">
                <div className="flex-1 pr-2">
                  <h3 className="text-white font-semibold text-sm flex items-center gap-1.5 break-words leading-tight">
                    <Tag size={14} className="text-indigo-400 shrink-0" /> {room.name}
                  </h3>
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                    {room.building_name && <span className="flex items-center gap-1"><Building2 size={12} />{room.building_name}</span>}
                    {room.level_name && <span className="flex items-center gap-1"><Layers size={12} />{room.level_name}</span>}
                  </div>
                </div>
                {room.room_type && (
                  <span className="text-[10px] uppercase tracking-wider font-semibold text-indigo-300 bg-indigo-500/20 px-2 py-0.5 rounded-sm shrink-0 ml-2">
                    {room.room_type}
                  </span>
                )}
              </div>

              {/* Items list */}
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {items.length > 0 ? items.map(item => (
                  <div key={item.id} className="group/item flex items-center gap-3 p-2 rounded-lg bg-white/5 border border-white/5 relative">
                    {item.photo_url ? (
                      <img src={item.photo_url} alt={item.ItemTypes?.name || 'Item'} className="w-10 h-10 rounded-md object-cover bg-gray-800 shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded-md bg-gray-800 flex items-center justify-center text-gray-500 shrink-0"><Package size={16} /></div>
                    )}
                    <div className="flex-1 min-w-0 pr-14">
                      <p className="text-sm font-medium text-gray-200 truncate">{item.ItemTypes?.name}</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {item.qty_excellent > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/20 text-green-400 shrink-0">{item.qty_excellent} Exc</span>}
                        {item.qty_good > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 shrink-0">{item.qty_good} Good</span>}
                        {item.qty_fair > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 shrink-0">{item.qty_fair} Fair</span>}
                        {item.qty_poor > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400 shrink-0">{item.qty_poor} Poor</span>}
                      </div>
                    </div>
                    {/* Actions — only visible on row hover */}
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover/item:opacity-100 transition-opacity">
                      <button
                        onClick={() => setEditingItem(item)}
                        className="p-1.5 rounded-md text-gray-400 hover:text-blue-400 hover:bg-blue-500/10 transition-colors"
                        title="Edit item"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={() => handleDeleteItem(item.id, item.photo_url)}
                        className="p-1.5 rounded-md text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        title="Move back to triage queue"
                      >
                        <Trash2 size={13} />
                      </button>
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
          </div>
        </>,
        document.body
      )}

      {/* Edit modal — portalled separately so it sits above everything */}
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

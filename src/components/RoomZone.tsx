'use client';

import { useRef, useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { Building2, Layers, Package, Tag, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function RoomZone({ room, items = [], activeAdmin, onDeleteZone, onItemDeleted }: { room: any, items?: any[], activeAdmin: boolean, onDeleteZone?: (id: string) => void, onItemDeleted?: () => void }) {
  const [isHovered, setIsHovered] = useState(false);
  const [isClicked, setIsClicked] = useState(false);

  const [popoutPos, setPopoutPos] = useState({ x: 0, y: 0 });
  const [isDraggingPopout, setIsDraggingPopout] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, initialX: 0, initialY: 0 });

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    setIsDraggingPopout(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      initialX: popoutPos.x,
      initialY: popoutPos.y,
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingPopout) return;
    e.stopPropagation();
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    setPopoutPos({
      x: dragStartRef.current.initialX + dx,
      y: dragStartRef.current.initialY + dy,
    });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (isDraggingPopout) {
      setIsDraggingPopout(false);
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      if (!isClicked) setIsClicked(true); 
    }
  };

  const handleDeleteItem = async (itemId: string, photoUrl: string | null) => {
    if (!confirm('Are you sure you want to delete this item?')) return;
    
    // Delete the inventory item
    const { error } = await supabase.from('InventoryItems').delete().eq('id', itemId);
    if (error) {
      alert(error.message);
      return;
    }
    
    // Restore the photo to pending
    if (photoUrl) {
       await supabase.from('IncomingPhotos').update({ status: 'pending' }).eq('photo_url', photoUrl);
    }
    
    if (onItemDeleted) onItemDeleted();
  };

  const { isOver, setNodeRef } = useDroppable({
    id: room.id,
    data: { type: 'room', room },
  });

  const coords = room.map_coordinates;

  return (
    <div
      ref={setNodeRef}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        if (!isDraggingPopout) setIsHovered(false);
      }}
      onClick={(e) => {
        if (!activeAdmin) {
          e.stopPropagation();
          setIsClicked(!isClicked);
        }
      }}
      className={`absolute transition-all group ${
        isOver 
          ? 'bg-blue-500/50 border-2 border-blue-400 ring-4 ring-blue-300/50 shadow-lg z-20 scale-[1.02]' 
          : (activeAdmin 
              ? 'bg-indigo-500/20 border border-indigo-500/50 hover:bg-indigo-500/40 z-10 hover:z-20' 
              : 'hover:bg-blue-500/20 border border-transparent hover:border-blue-300 z-10')
      } ${isClicked && !activeAdmin ? '!z-[100] !border-blue-400 bg-blue-500/10 shadow-md ring-2 ring-blue-400/30' : ''} ${(isHovered || isClicked) && !activeAdmin ? '!z-[100]' : ''}`}
      style={{
        left: `${coords.x}%`,
        top: `${coords.y}%`,
        width: `${coords.width}%`,
        height: `${coords.height}%`,
      }}
    >
      <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center justify-center pointer-events-none transition-all duration-200 ${
        isHovered || isClicked ? 'z-40 scale-110 drop-shadow-lg' : 'z-30 opacity-90'
      }`}>
        <div className="px-2.5 py-1 text-[10px] md:text-[11px] font-bold text-gray-800 dark:text-gray-100 bg-white/90 dark:bg-gray-900/90 backdrop-blur-md rounded-full shadow-sm whitespace-nowrap border border-gray-200/50 dark:border-gray-700/50 flex items-center gap-1.5">
          {room.name}
        </div>
      </div>

      {activeAdmin && onDeleteZone && (
        <button
          onMouseDown={(e) => {
            e.stopPropagation();
            onDeleteZone(room.id);
          }}
          className="absolute -top-3 -right-3 bg-red-500 hover:bg-red-600 text-white p-1.5 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-30 flex items-center justify-center cursor-pointer"
          title="Delete Zone"
        >
          <Trash2 size={12} />
        </button>
      )}

      {(isHovered || isClicked) && !activeAdmin && (
        <>
          {/* Connector line when dragged */}
          {(popoutPos.x !== 0 || popoutPos.y !== 0) && (
            <svg className="absolute inset-0 overflow-visible pointer-events-none z-0 w-full h-full">
              <line 
                x1="50%" 
                y1="50%" 
                x2={`calc(50% + ${popoutPos.x}px)`} 
                y2={`calc(100% + 8px + ${popoutPos.y}px)`} 
                stroke="#6366f1" 
                strokeWidth="2" 
                strokeDasharray="4" 
              />
            </svg>
          )}

          <div 
            className="absolute top-full mt-2 w-72 bg-black/85 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl z-50 animate-in fade-in slide-in-from-top-2 duration-200 flex flex-col cursor-default" 
            style={{ 
              left: `calc(50% + ${popoutPos.x}px)`,
              transform: `translate(-50%, ${popoutPos.y}px)`
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drag Handle */}
            <div 
              className="w-full flex justify-center pt-3 pb-1 cursor-grab active:cursor-grabbing shrink-0 group relative"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
            >
              <div className="w-12 h-1.5 bg-white/20 group-hover:bg-white/40 rounded-full transition-colors" />
            </div>

            <div className="px-4 pb-4 space-y-3">
              {/* Header info */}
              <div className="flex items-start justify-between border-b border-white/10 pb-2">
              <div className="flex-1 pr-2">
                <h3 className="text-white font-semibold text-sm flex items-center gap-1.5 break-words leading-tight">
                  <Tag size={14} className="text-indigo-400 shrink-0" /> {room.name}
                </h3>
                <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                  {room.building_name && (
                    <span className="flex items-center gap-1"><Building2 size={12}/>{room.building_name}</span>
                  )}
                  {room.level_name && (
                    <span className="flex items-center gap-1"><Layers size={12}/>{room.level_name}</span>
                  )}
                </div>
              </div>
              {room.room_type && (
                <span className="text-[10px] uppercase tracking-wider font-semibold text-indigo-300 bg-indigo-500/20 px-2 py-0.5 rounded-sm shrink-0 ml-2">
                  {room.room_type}
                </span>
              )}
            </div>
            
            {/* Items */}
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {items.length > 0 ? (
                items.map(item => (
                  <div key={item.id} className="group/item flex items-center gap-3 p-2 rounded-lg bg-white/5 border border-white/5 relative">
                    {item.photo_url ? (
                      <img src={item.photo_url} alt={item.ItemTypes?.name || 'Item'} className="w-10 h-10 rounded-md object-cover bg-gray-800" />
                    ) : (
                      <div className="w-10 h-10 rounded-md bg-gray-800 flex items-center justify-center text-gray-500">
                        <Package size={16} />
                      </div>
                    )}
                    <div className="flex-1 min-w-0 pr-8">
                      <p className="text-sm font-medium text-gray-200 truncate">{item.ItemTypes?.name}</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {item.qty_excellent > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/20 text-green-400 shrink-0">{item.qty_excellent} Exc</span>}
                        {item.qty_good > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 shrink-0">{item.qty_good} Good</span>}
                        {item.qty_fair > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 shrink-0">{item.qty_fair} Fair</span>}
                        {item.qty_poor > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400 shrink-0">{item.qty_poor} Poor</span>}
                      </div>
                    </div>
                    
                    {/* Delete Item Button */}
                    <button
                      onClick={() => handleDeleteItem(item.id, item.photo_url)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-red-500 hover:bg-red-600 rounded-md opacity-0 group-hover/item:opacity-100 transition-opacity z-10"
                      title="Move back to triage queue"
                    >
                      <Trash2 size={14} className="text-white" />
                    </button>
                  </div>
                ))
              ) : (
                <div className="text-center py-4 text-xs text-gray-500 flex flex-col items-center gap-1">
                  <Package size={20} className="opacity-50" />
                  <p>No items assigned yet</p>
                </div>
              )}
            </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

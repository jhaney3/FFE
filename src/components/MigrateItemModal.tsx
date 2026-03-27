'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '@/lib/supabase';
import { useProjectId } from '@/lib/ProjectContext';
import { X, Search, ArrowRight, Building2, Layers } from 'lucide-react';

export default function MigrateItemModal({ itemIds, onClose, onSaved }: {
  itemIds: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const projectId = useProjectId();
  const [rooms, setRooms] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!projectId) return;
    supabase
      .from('Rooms')
      .select('id, name, level_name, building_name, room_type')
      .eq('project_id', projectId)
      .order('name')
      .then(({ data }) => { if (data) setRooms(data); });
  }, [projectId]);

  const filteredRooms = rooms.filter(r => {
    const q = search.toLowerCase();
    return (
      r.name?.toLowerCase().includes(q) ||
      r.level_name?.toLowerCase().includes(q) ||
      r.building_name?.toLowerCase().includes(q) ||
      r.room_type?.toLowerCase().includes(q)
    );
  });

  const handleConfirm = async () => {
    if (!selectedRoomId) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from('InventoryItems')
        .update({ room_id: selectedRoomId })
        .in('id', itemIds);
      if (error) throw error;
      onSaved();
      onClose();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 bg-black/60 z-[10000] flex items-center justify-center p-4">
      <div className="bg-gray-900 w-full max-w-md border border-gray-700 flex flex-col" style={{ maxHeight: '85vh' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-800">
          <div>
            <p className="font-mono text-[10px] tracking-[0.18em] uppercase text-gray-500 mb-0.5">Migration</p>
            <h2 className="text-sm font-semibold text-gray-100">
              Move {itemIds.length === 1 ? '1 item' : `${itemIds.length} items`} to a different room
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-600 hover:text-gray-200 hover:bg-gray-800 border border-transparent hover:border-gray-700 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Search */}
        <div className="px-6 py-3 border-b border-gray-800">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600 pointer-events-none" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search rooms..."
              className="w-full pl-8 pr-3 py-2 bg-gray-950 border border-gray-700 text-gray-100 text-sm placeholder:text-gray-600 outline-none focus:border-blue-500 transition-colors font-mono text-[12px]"
              autoFocus
            />
          </div>
        </div>

        {/* Room list */}
        <div className="flex-1 overflow-y-auto custom-scrollbar px-3 py-2 min-h-0">
          {filteredRooms.length === 0 ? (
            <p className="text-center font-mono text-[10px] text-gray-600 py-8 tracking-wider uppercase">No rooms found</p>
          ) : filteredRooms.map(room => (
            <button
              key={room.id}
              type="button"
              onClick={() => setSelectedRoomId(room.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors border mb-1 ${
                selectedRoomId === room.id
                  ? 'border-blue-600 bg-blue-600/10'
                  : 'border-transparent hover:border-gray-700 hover:bg-gray-800/50'
              }`}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-100 truncate">{room.name}</p>
                <div className="flex items-center gap-3 mt-0.5 font-mono text-[10px] text-gray-500">
                  {room.level_name    && <span className="flex items-center gap-1"><Layers   size={10} />{room.level_name}</span>}
                  {room.building_name && <span className="flex items-center gap-1"><Building2 size={10} />{room.building_name}</span>}
                </div>
              </div>
              {room.room_type && (
                <span className="font-mono text-[9px] uppercase tracking-wider text-blue-400 border border-blue-800/50 bg-blue-900/15 px-1.5 py-0.5 shrink-0">
                  {room.room_type}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-800">
          <button
            onClick={onClose}
            className="font-mono text-[10px] tracking-wider uppercase text-gray-500 hover:text-gray-200 px-4 py-2 border border-gray-700 hover:border-gray-500 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!selectedRoomId || loading}
            className="flex items-center gap-1.5 font-mono text-[10px] tracking-wider uppercase px-4 py-2 bg-blue-600 text-white border border-blue-500 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ArrowRight size={12} /> {loading ? 'Moving...' : 'Move to Room'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

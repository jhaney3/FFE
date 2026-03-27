'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useDroppable, useDraggable } from '@dnd-kit/core';
import { supabase } from '@/lib/supabase';
import { useProjectId } from '@/lib/ProjectContext';
import { ChevronRight, ChevronDown, Map as MapIcon, Package, Plus, Pencil, Trash2, GripVertical } from 'lucide-react';
import AddLocationModal from './AddLocationModal';
import EditItemModal from './EditItemModal';
import NewZoneModal from './NewZoneModal';

interface LocationsTreeProps {
  onAddItem: (room: any) => void;
  itemsVersion: number;
}

type TreeGroup = {
  building: string;
  levels: { level: string; rooms: any[] }[];
};

// ── Room row ─────────────────────────────────────────────────────────────────

function RoomRow({ room, itemCount, isSelected, onSelect, onEdit, onDelete }: {
  room: any;
  itemCount: number;
  isSelected: boolean;
  onSelect: () => void;
  onEdit: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `tree-room-${room.id}`, data: { room } });

  return (
    <div
      ref={setNodeRef}
      onClick={onSelect}
      className={`group/room flex items-center justify-between px-3 py-1.5 cursor-pointer border-l-2 transition-colors ${
        isOver        ? 'border-l-blue-500 bg-blue-900/20 text-gray-200' :
        isSelected    ? 'border-l-blue-600 bg-blue-950/20 text-gray-200' :
                        'border-l-transparent hover:bg-gray-900 text-gray-400'
      }`}
    >
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="font-mono text-[11px] truncate">{room.name}</span>
        {room.floor_plan_id && <MapIcon size={9} className="text-blue-700 shrink-0" />}
      </div>
      <div className="flex items-center gap-0.5 ml-1 shrink-0">
        {itemCount > 0 && (
          <span className="font-mono text-[9px] px-1.5 py-0.5 bg-blue-900/40 text-blue-400 border border-blue-900 mr-0.5">
            {itemCount}
          </span>
        )}
        {/* Edit + delete — visible only on row hover, to avoid accidental use */}
        <button
          onClick={onEdit}
          className="opacity-0 group-hover/room:opacity-100 p-0.5 text-gray-600 hover:text-blue-400 hover:bg-blue-900/20 border border-transparent hover:border-blue-900 transition-all"
          title="Edit room"
        >
          <Pencil size={10} />
        </button>
        <button
          onClick={onDelete}
          className="opacity-0 group-hover/room:opacity-100 p-0.5 text-gray-600 hover:text-red-400 hover:bg-red-900/20 border border-transparent hover:border-red-900 transition-all"
          title="Delete room"
        >
          <Trash2 size={10} />
        </button>
      </div>
    </div>
  );
}

// ── Item card ─────────────────────────────────────────────────────────────────

function ItemCard({ item, tagParents, onEdit, onDelete }: {
  item: any;
  tagParents: Set<string>;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `inventory-item-${item.id}`,
    data: { type: 'inventory-item', item },
  });

  const total = (item.qty_excellent ?? 0) + (item.qty_good ?? 0) + (item.qty_fair ?? 0) + (item.qty_poor ?? 0);

  const conditionEntries = [
    { label: 'Excellent' as const, qty: item.qty_excellent ?? 0 },
    { label: 'Good'      as const, qty: item.qty_good      ?? 0 },
    { label: 'Fair'      as const, qty: item.qty_fair      ?? 0 },
    { label: 'Poor'      as const, qty: item.qty_poor      ?? 0 },
  ].filter(e => e.qty > 0);

  const dominantCondition = conditionEntries.length > 0
    ? conditionEntries.reduce((a, b) => a.qty >= b.qty ? a : b).label
    : 'Good';

  const conditionColor = {
    Excellent: 'border-green-700 text-green-400',
    Good:      'border-blue-700 text-blue-400',
    Fair:      'border-yellow-700 text-yellow-400',
    Poor:      'border-red-700 text-red-400',
  } as const;

  // Parents first (sorted), then children (sorted alphabetically)
  const parentAttrs = (item.attributes ?? [])
    .filter((a: string) =>  tagParents.has(a)).sort();
  const childAttrs  = (item.attributes ?? [])
    .filter((a: string) => !tagParents.has(a)).sort();

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      className={`group/card flex gap-3 border border-gray-800 bg-gray-950/50 p-3 hover:border-gray-700 transition-colors transition-opacity ${isDragging ? 'opacity-30' : 'opacity-100'}`}
    >
      {/* Drag handle */}
      <div
        {...listeners}
        className="self-center text-gray-700 hover:text-gray-500 cursor-grab active:cursor-grabbing shrink-0 touch-none py-1"
        title="Drag to move to another room"
      >
        <GripVertical size={13} />
      </div>

      {/* Thumbnail */}
      <div className="w-14 h-14 shrink-0 bg-gray-900 border border-gray-800 overflow-hidden">
        {item.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.photo_url} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Package size={16} className="text-gray-600" />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2 mb-1">
          <div className="flex items-baseline gap-2 flex-wrap min-w-0">
            <span className="text-sm font-medium text-gray-200">{item.ItemTypes?.name ?? '—'}</span>
            <span className="font-mono text-[10px] text-gray-500">× {total}</span>
          </div>
          <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover/card:opacity-100 transition-opacity">
            <button
              onClick={onEdit}
              className="p-1 text-gray-500 hover:text-blue-400 hover:bg-blue-900/20 border border-transparent hover:border-blue-800 transition-colors"
              title="Edit item"
            >
              <Pencil size={11} />
            </button>
            <button
              onClick={onDelete}
              className="p-1 text-gray-500 hover:text-red-400 hover:bg-red-900/20 border border-transparent hover:border-red-800 transition-colors"
              title="Delete item"
            >
              <Trash2 size={11} />
            </button>
          </div>
        </div>

        {/* Condition chips */}
        <div className="flex flex-wrap gap-1 mb-1.5">
          {conditionEntries.length === 1 ? (
            <span className={`font-mono text-[9px] px-1.5 py-0.5 border ${conditionColor[dominantCondition]}`}>
              {dominantCondition}
            </span>
          ) : conditionEntries.map(e => (
            <span key={e.label} className={`font-mono text-[9px] px-1.5 py-0.5 border ${conditionColor[e.label]}`}>
              {e.label[0]} {e.qty}
            </span>
          ))}
        </div>

        {/* Tags — parents (amber) first, children (blue) second, both sorted */}
        {(parentAttrs.length > 0 || childAttrs.length > 0) && (
          <div className="flex flex-wrap gap-1">
            {parentAttrs.map((attr: string) => (
              <span key={attr} className="font-mono text-[9px] px-1.5 py-0.5 border border-amber-800/60 bg-amber-900/10 text-amber-500">
                {attr}
              </span>
            ))}
            {childAttrs.map((attr: string) => (
              <span key={attr} className="font-mono text-[9px] px-1.5 py-0.5 border border-blue-900/60 bg-blue-900/10 text-blue-400/80">
                {attr}
              </span>
            ))}
          </div>
        )}

        {item.notes && (
          <p className="font-mono text-[10px] text-gray-500 mt-1 truncate">{item.notes}</p>
        )}
      </div>
    </div>
  );
}

// ── Inline rename input ───────────────────────────────────────────────────────

function InlineRename({ value, onSave, onCancel, className }: {
  value: string;
  onSave: (v: string) => void;
  onCancel: () => void;
  className?: string;
}) {
  const [val, setVal] = useState(value);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.select(); }, []);

  return (
    <input
      ref={ref}
      value={val}
      onChange={e => setVal(e.target.value)}
      onClick={e => e.stopPropagation()}
      onKeyDown={e => {
        e.stopPropagation();
        if (e.key === 'Enter')  { e.preventDefault(); onSave(val); }
        if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
      }}
      onBlur={() => onSave(val)}
      className={`bg-gray-800 border border-blue-600 px-1 outline-none text-gray-100 font-mono text-[10px] tracking-[0.15em] uppercase ${className ?? ''}`}
    />
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function LocationsTree({ onAddItem, itemsVersion }: LocationsTreeProps) {
  const projectId = useProjectId();

  const [rooms, setRooms] = useState<any[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<any | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [tagParentMap, setTagParentMap] = useState<Map<string, Set<string>>>(new Map());

  const [expandedBuildings, setExpandedBuildings] = useState<Set<string>>(new Set());
  const [expandedLevels, setExpandedLevels]       = useState<Set<string>>(new Set());

  const [addLocationFor,    setAddLocationFor]    = useState<{ building?: string; level?: string } | null>(null);
  const [editingItem,       setEditingItem]       = useState<any | null>(null);
  const [editingRoom,       setEditingRoom]       = useState<any | null>(null);

  // Inline rename state
  const [renamingBuildingKey, setRenamingBuildingKey] = useState<string | null>(null);
  const [renamingLevelKey,    setRenamingLevelKey]    = useState<string | null>(null);

  const [itemCounts,  setItemCounts]  = useState<Record<string, number>>({});
  const [initialized, setInitialized] = useState(false);

  // ── Data fetching ───────────────────────────────────────────────────────────

  const fetchRooms = useCallback(async () => {
    if (!projectId) return;
    const { data } = await supabase.from('Rooms').select('*').eq('project_id', projectId).order('name');
    if (data) setRooms(data);
  }, [projectId]);

  const fetchItemCounts = useCallback(async () => {
    if (!projectId) return;
    const { data } = await supabase.from('InventoryItems').select('room_id').eq('project_id', projectId);
    if (data) {
      const counts: Record<string, number> = {};
      for (const item of data) counts[item.room_id] = (counts[item.room_id] ?? 0) + 1;
      setItemCounts(counts);
    }
  }, [projectId]);

  const fetchItems = useCallback(async () => {
    if (!selectedRoom) { setItems([]); setTagParentMap(new Map()); return; }
    const { data } = await supabase
      .from('InventoryItems').select('*, ItemTypes(name)')
      .eq('room_id', selectedRoom.id).order('created_at', { ascending: false });
    if (!data) return;
    setItems(data);

    const typeIds = [...new Set(data.map((i: any) => i.item_type_id).filter(Boolean))];
    if (typeIds.length > 0) {
      const { data: attrData } = await supabase
        .from('ItemTypeAttributes').select('item_type_id, name, is_parent')
        .in('item_type_id', typeIds);
      const map = new Map<string, Set<string>>();
      for (const a of attrData ?? []) {
        if (!map.has(a.item_type_id)) map.set(a.item_type_id, new Set());
        if (a.is_parent) map.get(a.item_type_id)!.add(a.name);
      }
      setTagParentMap(map);
    } else {
      setTagParentMap(new Map());
    }
  }, [selectedRoom]);

  useEffect(() => { fetchRooms(); fetchItemCounts(); }, [fetchRooms, fetchItemCounts]);
  useEffect(() => { fetchItems(); }, [fetchItems, itemsVersion]);
  useEffect(() => { fetchItemCounts(); }, [fetchItemCounts, itemsVersion]);

  useEffect(() => {
    if (!initialized && rooms.length > 0) {
      const buildings = new Set<string>();
      const levels    = new Set<string>();
      for (const r of rooms) {
        const b = r.building_name || '__no_building__';
        buildings.add(b);
        levels.add(`${b}::${r.level_name || '__no_level__'}`);
      }
      setExpandedBuildings(buildings);
      setExpandedLevels(levels);
      setInitialized(true);
    }
  }, [rooms, initialized]);

  useEffect(() => {
    if (!projectId) return;
    const ch = supabase.channel('locations-tree')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'Rooms',          filter: `project_id=eq.${projectId}` }, fetchRooms)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'InventoryItems', filter: `project_id=eq.${projectId}` }, () => { fetchItemCounts(); fetchItems(); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [projectId, fetchRooms, fetchItemCounts, fetchItems]);

  // ── Mutations ───────────────────────────────────────────────────────────────

  const handleRenameBuilding = async (oldBuilding: string, newName: string) => {
    setRenamingBuildingKey(null);
    const trimmed = newName.trim();
    if (!trimmed || trimmed === oldBuilding) return;
    let q = supabase.from('Rooms').update({ building_name: trimmed }).eq('project_id', projectId!);
    q = oldBuilding ? q.eq('building_name', oldBuilding) : q.is('building_name', null);
    await q;
    fetchRooms();
  };

  const handleRenameLevel = async (building: string, oldLevel: string, newName: string) => {
    setRenamingLevelKey(null);
    const trimmed = newName.trim();
    if (!trimmed || trimmed === oldLevel) return;
    let q = supabase.from('Rooms').update({ level_name: trimmed }).eq('project_id', projectId!);
    q = building ? q.eq('building_name', building) : q.is('building_name', null);
    q = oldLevel ? q.eq('level_name', oldLevel)    : q.is('level_name', null);
    await q;
    fetchRooms();
  };

  const handleSaveEditRoom = async (data: any) => {
    if (!editingRoom) return;
    await supabase.from('Rooms').update({
      name:          data.name,
      room_type:     data.room_type,
      building_name: data.building_name,
      level_name:    data.level_name,
    }).eq('id', editingRoom.id);
    setEditingRoom(null);
    fetchRooms();
    // Refresh selected room metadata if it was the one being edited
    if (selectedRoom?.id === editingRoom.id) {
      setSelectedRoom((prev: any) => prev ? {
        ...prev, name: data.name, room_type: data.room_type,
        building_name: data.building_name, level_name: data.level_name,
      } : prev);
    }
  };

  const handleDeleteRoom = async (room: any) => {
    const count = itemCounts[room.id] ?? 0;
    const msg = count > 0
      ? `Delete "${room.name}" and all ${count} item${count !== 1 ? 's' : ''} inside it? This cannot be undone.`
      : `Delete "${room.name}"? This cannot be undone.`;
    if (!confirm(msg)) return;
    await supabase.from('Rooms').delete().eq('id', room.id);
    if (selectedRoom?.id === room.id) setSelectedRoom(null);
    fetchRooms();
    fetchItemCounts();
  };

  const handleDeleteItem = async (item: any) => {
    if (!confirm(`Remove this ${item.ItemTypes?.name ?? 'item'}?`)) return;
    const { error } = await supabase.from('InventoryItems').delete().eq('id', item.id);
    if (error) { alert(error.message); return; }
    // Restore triage photo to pending if applicable
    if (item.photo_url) {
      await supabase.from('IncomingPhotos').update({ status: 'pending' }).eq('photo_url', item.photo_url);
      // Clean up asset photo only if nothing else references it
      const marker = '/inventory_photos/';
      const idx = item.photo_url.indexOf(marker);
      if (idx !== -1) {
        const filePath = item.photo_url.slice(idx + marker.length);
        if (filePath.startsWith('assets/')) {
          const [{ count: iCount }, { count: aCount }] = await Promise.all([
            supabase.from('InventoryItems').select('id', { count: 'exact', head: true }).eq('photo_url', item.photo_url),
            supabase.from('Assets').select('id', { count: 'exact', head: true }).eq('photo_url', item.photo_url),
          ]);
          if ((iCount ?? 1) === 0 && (aCount ?? 1) === 0)
            await supabase.storage.from('inventory_photos').remove([filePath]);
        }
      }
    }
    fetchItems();
    fetchItemCounts();
  };

  // ── Tree grouping ───────────────────────────────────────────────────────────

  const treeGroups: TreeGroup[] = (() => {
    const map = new Map<string, Map<string, any[]>>();
    for (const r of rooms) {
      const b = r.building_name || '', l = r.level_name || '';
      if (!map.has(b)) map.set(b, new Map());
      if (!map.get(b)!.has(l)) map.get(b)!.set(l, []);
      map.get(b)!.get(l)!.push(r);
    }
    const sortB = [...map.keys()].sort((a, b) => (!a && b) ? 1 : (a && !b) ? -1 : a.localeCompare(b));
    return sortB.map(building => {
      const lMap = map.get(building)!;
      const sortL = [...lMap.keys()].sort((a, b) => (!a && b) ? 1 : (a && !b) ? -1 : a.localeCompare(b));
      return { building, levels: sortL.map(level => ({ level, rooms: lMap.get(level)! })) };
    });
  })();

  const toggleBuilding = (k: string) => setExpandedBuildings(p => { const n = new Set(p); n.has(k) ? n.delete(k) : n.add(k); return n; });
  const toggleLevel    = (k: string) => setExpandedLevels(p    => { const n = new Set(p); n.has(k) ? n.delete(k) : n.add(k); return n; });

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-1 h-full min-h-0 min-w-0 overflow-hidden">

      {/* ── Left panel — tree ─────────────────────────────────────────────── */}
      <div className="w-60 shrink-0 border-r border-gray-800 flex flex-col h-full overflow-hidden">

        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-800 shrink-0">
          <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-gray-400">Files</span>
          <button
            onClick={() => setAddLocationFor({})}
            className="flex items-center gap-1 font-mono text-[10px] px-2 py-0.5 border border-gray-600 text-gray-400 hover:border-blue-600 hover:text-blue-400 hover:bg-blue-900/10 transition-colors"
          >
            <Plus size={9} /> Location
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar py-1">
          {treeGroups.length === 0 && (
            <p className="font-mono text-[10px] text-gray-500 text-center py-6 px-3">No locations yet</p>
          )}

          {treeGroups.map(group => {
            const bKey     = group.building || '__no_building__';
            const bExpanded = expandedBuildings.has(bKey);
            const isRenaming = renamingBuildingKey === bKey;

            return (
              <div key={bKey}>

                {/* Building row */}
                <div
                  className="group/brow flex items-center justify-between px-2 py-1 hover:bg-gray-900 cursor-pointer"
                  onClick={() => !isRenaming && toggleBuilding(bKey)}
                >
                  <div className="flex items-center gap-1 min-w-0 flex-1">
                    {bExpanded
                      ? <ChevronDown  size={10} className="text-gray-500 shrink-0" />
                      : <ChevronRight size={10} className="text-gray-500 shrink-0" />}
                    {isRenaming ? (
                      <InlineRename
                        value={group.building}
                        onSave={v  => handleRenameBuilding(group.building, v)}
                        onCancel={() => setRenamingBuildingKey(null)}
                        className="w-32"
                      />
                    ) : (
                      <span className={`font-mono text-[10px] tracking-[0.2em] uppercase truncate ${group.building ? 'text-gray-400' : 'text-gray-600'}`}>
                        {group.building || '(No Building)'}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0">
                    {/* Rename — only for named buildings */}
                    {group.building && (
                      <button
                        onClick={e => { e.stopPropagation(); setRenamingBuildingKey(bKey); }}
                        className="opacity-50 group-hover/brow:opacity-100 p-0.5 text-gray-500 hover:text-blue-400 hover:bg-blue-900/20 border border-transparent hover:border-blue-900 transition-all"
                        title="Rename building"
                      >
                        <Pencil size={9} />
                      </button>
                    )}
                    <button
                      onClick={e => { e.stopPropagation(); setAddLocationFor({ building: group.building }); }}
                      className="opacity-50 group-hover/brow:opacity-100 flex items-center justify-center w-4 h-4 border border-gray-600 text-gray-400 hover:border-blue-600 hover:text-blue-400 hover:bg-blue-900/20 transition-all"
                      title="Add location in this building"
                    >
                      <Plus size={8} />
                    </button>
                  </div>
                </div>

                {bExpanded && group.levels.map(({ level, rooms: levelRooms }) => {
                  const lKey      = `${bKey}::${level || '__no_level__'}`;
                  const lExpanded  = expandedLevels.has(lKey);
                  const isLRenaming = renamingLevelKey === lKey;

                  return (
                    <div key={lKey}>

                      {/* Level row */}
                      <div
                        className="group/lrow flex items-center justify-between pl-5 pr-2 py-1 hover:bg-gray-900 cursor-pointer"
                        onClick={() => !isLRenaming && toggleLevel(lKey)}
                      >
                        <div className="flex items-center gap-1 min-w-0 flex-1">
                          {lExpanded
                            ? <ChevronDown  size={9} className="text-gray-500 shrink-0" />
                            : <ChevronRight size={9} className="text-gray-500 shrink-0" />}
                          {isLRenaming ? (
                            <InlineRename
                              value={level}
                              onSave={v  => handleRenameLevel(group.building, level, v)}
                              onCancel={() => setRenamingLevelKey(null)}
                              className="w-24"
                            />
                          ) : (
                            <span className={`font-mono text-[10px] tracking-[0.15em] uppercase truncate ${level ? 'text-gray-500' : 'text-gray-600'}`}>
                              {level || '(No Level)'}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-0.5 shrink-0">
                          {level && (
                            <button
                              onClick={e => { e.stopPropagation(); setRenamingLevelKey(lKey); }}
                              className="opacity-50 group-hover/lrow:opacity-100 p-0.5 text-gray-500 hover:text-blue-400 hover:bg-blue-900/20 border border-transparent hover:border-blue-900 transition-all"
                              title="Rename level"
                            >
                              <Pencil size={9} />
                            </button>
                          )}
                          <button
                            onClick={e => { e.stopPropagation(); setAddLocationFor({ building: group.building, level }); }}
                            className="opacity-50 group-hover/lrow:opacity-100 flex items-center justify-center w-4 h-4 border border-gray-600 text-gray-400 hover:border-blue-600 hover:text-blue-400 hover:bg-blue-900/20 transition-all"
                            title="Add location in this level"
                          >
                            <Plus size={8} />
                          </button>
                        </div>
                      </div>

                      {lExpanded && levelRooms.map(room => (
                        <div key={room.id} className="pl-8">
                          <RoomRow
                            room={room}
                            itemCount={itemCounts[room.id] ?? 0}
                            isSelected={selectedRoom?.id === room.id}
                            onSelect={() => setSelectedRoom(room)}
                            onEdit={e => { e.stopPropagation(); setEditingRoom(room); }}
                            onDelete={e => { e.stopPropagation(); handleDeleteRoom(room); }}
                          />
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Right panel — room detail ──────────────────────────────────────── */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {selectedRoom ? (
          <>
            <div className="flex items-start justify-between px-6 py-4 border-b border-gray-800 shrink-0">
              <div>
                <p className="font-mono text-[10px] tracking-[0.18em] uppercase text-gray-400 mb-1">
                  {[selectedRoom.building_name, selectedRoom.level_name].filter(Boolean).join(' · ') || 'Location'}
                  {selectedRoom.room_type && <><span className="text-gray-600 mx-1.5">·</span>{selectedRoom.room_type}</>}
                </p>
                <h2 className="text-lg font-semibold text-gray-100">{selectedRoom.name}</h2>
              </div>
              <button
                onClick={() => onAddItem(selectedRoom)}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-blue-700 bg-blue-700/10 text-blue-400 hover:bg-blue-700/20 font-mono text-[10px] tracking-wider uppercase transition-colors shrink-0"
              >
                <Plus size={11} /> Add Item
              </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-2">
              {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 gap-3">
                  <Package size={24} className="text-gray-700" />
                  <p className="font-mono text-[10px] text-gray-600 text-center">
                    No items yet<br />drag a photo here or click &quot;+ Add Item&quot;
                  </p>
                </div>
              ) : (
                items.map(item => (
                  <ItemCard
                    key={item.id}
                    item={item}
                    tagParents={tagParentMap.get(item.item_type_id) ?? new Set()}
                    onEdit={() => setEditingItem(item)}
                    onDelete={() => handleDeleteItem(item)}
                  />
                ))
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <p className="font-mono text-[10px] tracking-[0.15em] uppercase text-gray-500">
              Select a location to view its inventory
            </p>
          </div>
        )}
      </div>

      {/* ── Modals ────────────────────────────────────────────────────────── */}

      {addLocationFor !== null && (
        <AddLocationModal
          initialBuilding={addLocationFor.building}
          initialLevel={addLocationFor.level}
          onSaved={() => {
            setAddLocationFor(null);
            fetchRooms();
            const b = addLocationFor.building || '__no_building__';
            const l = addLocationFor.level    || '__no_level__';
            setExpandedBuildings(p => new Set([...p, b]));
            setExpandedLevels(p    => new Set([...p, `${b}::${l}`]));
          }}
          onClose={() => setAddLocationFor(null)}
        />
      )}

      {editingRoom && (
        <NewZoneModal
          pageNumber={editingRoom.page_number ?? 1}
          initialRoom={editingRoom}
          onSave={handleSaveEditRoom}
          onCancel={() => setEditingRoom(null)}
        />
      )}

      {editingItem && (
        <EditItemModal
          item={editingItem}
          onClose={() => setEditingItem(null)}
          onSaved={() => { setEditingItem(null); fetchItems(); fetchItemCounts(); }}
        />
      )}
    </div>
  );
}

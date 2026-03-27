'use client';

import { useState, useRef, useEffect } from 'react';
import { X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useProjectId } from '@/lib/ProjectContext';

interface AddLocationModalProps {
  onSaved: () => void;
  onClose: () => void;
  initialBuilding?: string;
  initialLevel?: string;
}

const BASE_ROOM_TYPES = [
  'Classroom', 'Kitchen', 'Storage Closet', 'Office', 'Bathroom', 'Hallway', 'Sanctuary', 'Lobby',
];

export default function AddLocationModal({ onSaved, onClose, initialBuilding, initialLevel }: AddLocationModalProps) {
  const projectId = useProjectId();
  const [name, setName] = useState('');
  const [levelName, setLevelName] = useState(initialLevel || '');
  const [buildingName, setBuildingName] = useState(initialBuilding || '');
  const [roomType, setRoomType] = useState('Classroom');
  const [customTypeInput, setCustomTypeInput] = useState('');
  const [dbRoomTypes, setDbRoomTypes] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const customInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchRoomTypes = async () => {
      const { data } = await supabase.from('Rooms').select('room_type');
      if (data) {
        const distinct = Array.from(new Set(
          data.map((r: any) => r.room_type).filter(Boolean)
        )) as string[];
        setDbRoomTypes(distinct.filter(t => !BASE_ROOM_TYPES.includes(t)));
      }
    };
    fetchRoomTypes();
  }, []);

  useEffect(() => {
    if (roomType === 'Other') customInputRef.current?.focus();
  }, [roomType]);

  const allRoomTypes = [...BASE_ROOM_TYPES, ...dbRoomTypes, 'Other'];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !projectId) return;

    let finalRoomType = roomType;
    if (roomType === 'Other') {
      const trimmed = customTypeInput.trim();
      if (!trimmed) return;
      finalRoomType = trimmed;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from('Rooms').insert([{
        name: name.trim(),
        building_name: buildingName.trim() || null,
        level_name: levelName.trim() || null,
        room_type: finalRoomType,
        floor_plan_id: null,
        map_coordinates: null,
        project_id: projectId,
      }]);
      if (error) throw error;
      onSaved();
    } catch (err: any) {
      alert(err.message);
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75">
      <div className="bg-gray-900 w-full max-w-md border border-gray-700 surface-raised overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-800 flex justify-between items-center">
          <div>
            <p className="font-mono text-[10px] tracking-[0.18em] uppercase text-gray-500 mb-1">
              New Location
            </p>
            <h2 className="text-base font-semibold text-gray-100">Add Location</h2>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-600 hover:text-gray-200 hover:bg-gray-800 border border-transparent hover:border-gray-700 transition-colors">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block font-mono text-[10px] tracking-[0.15em] uppercase text-gray-400 mb-1.5">Location Name *</label>
            <input
              type="text"
              required
              autoFocus
              placeholder="e.g. Room 101"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-gray-700 bg-gray-950 focus:border-blue-500 px-3 py-2 outline-none transition-colors text-gray-100 text-sm placeholder:text-gray-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-mono text-[10px] tracking-[0.15em] uppercase text-gray-400 mb-1.5">Building</label>
              <input
                type="text"
                placeholder="e.g. A"
                value={buildingName}
                onChange={(e) => setBuildingName(e.target.value)}
                className="w-full border border-gray-700 bg-gray-950 focus:border-blue-500 px-3 py-2 outline-none transition-colors text-gray-100 text-sm placeholder:text-gray-500"
              />
            </div>
            <div>
              <label className="block font-mono text-[10px] tracking-[0.15em] uppercase text-gray-400 mb-1.5">Level</label>
              <input
                type="text"
                placeholder="e.g. Upper"
                value={levelName}
                onChange={(e) => setLevelName(e.target.value)}
                className="w-full border border-gray-700 bg-gray-950 focus:border-blue-500 px-3 py-2 outline-none transition-colors text-gray-100 text-sm placeholder:text-gray-500"
              />
            </div>
          </div>

          <div>
            <label className="block font-mono text-[10px] tracking-[0.15em] uppercase text-gray-400 mb-1.5">Room Type</label>
            <select
              value={roomType}
              onChange={(e) => { setRoomType(e.target.value); setCustomTypeInput(''); }}
              className="w-full border border-gray-700 bg-gray-950 focus:border-blue-500 px-3 py-2 outline-none transition-colors text-gray-100 text-sm appearance-none"
            >
              {allRoomTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
            {roomType === 'Other' && (
              <input
                ref={customInputRef}
                type="text"
                required
                placeholder="Describe the room type..."
                value={customTypeInput}
                onChange={(e) => setCustomTypeInput(e.target.value)}
                className="mt-2 w-full border border-blue-600 bg-gray-950 focus:border-blue-400 px-3 py-2 outline-none transition-colors text-gray-100 text-sm placeholder:text-gray-600"
              />
            )}
          </div>

          <div className="pt-2 flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 font-mono text-[11px] tracking-wider uppercase border border-gray-700 text-gray-400 hover:text-gray-200 hover:bg-gray-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !name.trim() || (roomType === 'Other' && !customTypeInput.trim())}
              className="flex-1 py-2 font-mono text-[11px] tracking-wider uppercase border border-blue-600 bg-blue-600/10 text-blue-400 hover:bg-blue-600/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? 'Saving...' : 'Save Location'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

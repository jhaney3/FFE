'use client';

import { useState } from 'react';
import { X, Building2, Layers, Tag, Type } from 'lucide-react';

interface NewZoneModalProps {
  onSuggestName?: string;
  onSave: (data: { name: string; page_number: number; level_name: string; building_name: string; room_type: string }) => void;
  onCancel: () => void;
  pageNumber: number;
}

const ROOM_TYPES = [
  'Classroom', 'Kitchen', 'Storage Closet', 'Office', 'Bathroom', 'Hallway', 'Sanctuary', 'Lobby', 'Other'
];

export default function NewZoneModal({ onSave, onCancel, pageNumber }: NewZoneModalProps) {
  const [name, setName] = useState('');
  const [levelName, setLevelName] = useState('');
  const [buildingName, setBuildingName] = useState('');
  const [roomType, setRoomType] = useState('Classroom');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave({
      name,
      page_number: pageNumber,
      level_name: levelName,
      building_name: buildingName,
      room_type: roomType
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-md rounded-2xl shadow-2xl border border-white/20 dark:border-gray-800/50 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-gray-200/50 dark:border-gray-800/50 flex justify-between items-center bg-gradient-to-r from-gray-50/50 to-white/50 dark:from-gray-900/50 dark:to-gray-800/50">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2">
            <Tag size={20} className="text-indigo-500" />
            Configure New Zone
          </h2>
          <button onClick={onCancel} className="p-1 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-gray-500 transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="space-y-4">
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                <Type size={16} className="text-gray-400" /> Zone Name *
              </label>
              <input
                type="text"
                required
                autoFocus
                placeholder="e.g. Room 101"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none transition-all placeholder:text-gray-400"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  <Building2 size={16} className="text-gray-400" /> Building
                </label>
                <input
                  type="text"
                  placeholder="e.g. A"
                  value={buildingName}
                  onChange={(e) => setBuildingName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none transition-all placeholder:text-gray-400"
                />
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  <Layers size={16} className="text-gray-400" /> Level
                </label>
                <input
                  type="text"
                  placeholder="e.g. Upper"
                  value={levelName}
                  onChange={(e) => setLevelName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none transition-all placeholder:text-gray-400"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Room Type
              </label>
              <select
                value={roomType}
                onChange={(e) => setRoomType(e.target.value)}
                className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none transition-all appearance-none"
              >
                {ROOM_TYPES.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="pt-2 flex justify-end gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="px-5 py-2.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="px-5 py-2.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:hover:bg-indigo-600 rounded-xl shadow-lg shadow-indigo-500/30 transition-all"
            >
              Save Zone
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

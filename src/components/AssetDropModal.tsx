'use client';

import { useState } from 'react';
import { X, Package, Check } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function AssetDropModal({ asset, room, onClose, onSaved }: {
  asset: any;
  room: any;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const [qty, setQty] = useState(1);
  const [quality, setQuality] = useState('Good');
  const [notes, setNotes] = useState(asset.notes || '');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.from('InventoryItems').insert([{
        room_id:       room.id,
        photo_url:     asset.photo_url,
        item_type_id:  asset.item_type_id,
        qty_excellent: quality === 'Excellent' ? qty : 0,
        qty_good:      quality === 'Good'      ? qty : 0,
        qty_fair:      quality === 'Fair'      ? qty : 0,
        qty_poor:      quality === 'Poor'      ? qty : 0,
        attributes:    asset.attributes || [],
        notes:         notes.trim(),
      }]);
      if (error) throw error;
      onSaved?.();
      onClose();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[10000] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-sm border border-gray-200 dark:border-gray-800 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500 mb-0.5">Adding to <span className="font-semibold text-gray-700 dark:text-gray-300">{room.name}</span></p>
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">{asset.name}</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Asset preview */}
          <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-950 rounded-xl border border-gray-100 dark:border-gray-800">
            {asset.photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={asset.photo_url} alt={asset.name} className="w-14 h-14 rounded-lg object-cover shrink-0" />
            ) : (
              <div className="w-14 h-14 rounded-lg bg-gray-200 dark:bg-gray-800 flex items-center justify-center shrink-0">
                <Package size={20} className="text-gray-400" />
              </div>
            )}
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">{asset.name}</p>
              {asset.attributes?.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {asset.attributes.map((a: string) => (
                    <span key={a} className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300 leading-none">{a}</span>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Quantity</label>
              <input
                type="number" min="1" value={qty}
                onChange={(e) => setQty(parseInt(e.target.value) || 1)}
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 rounded-lg outline-none focus:border-indigo-400 font-bold text-center"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Quality</label>
              <select
                value={quality} onChange={(e) => setQuality(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 rounded-lg outline-none focus:border-indigo-400 appearance-none"
              >
                <option>Excellent</option>
                <option>Good</option>
                <option>Fair</option>
                <option>Poor</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Notes</label>
            <textarea
              value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional observations..."
              rows={2}
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 rounded-lg outline-none focus:border-indigo-400 resize-none text-sm"
            />
          </div>

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors">
              Cancel
            </button>
            <button
              type="submit" disabled={loading}
              className="flex-1 py-2.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-xl shadow-lg shadow-indigo-500/30 flex items-center justify-center gap-1.5 transition-all"
            >
              {loading ? 'Adding...' : <><Check size={15} /> Add to Room</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

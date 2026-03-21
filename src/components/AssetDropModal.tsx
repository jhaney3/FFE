'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Package, Check, SplitSquareVertical, Info } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function AssetDropModal({ asset, room, onClose, onSaved }: {
  asset: any;
  room: any;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const qtyInputRef = useRef<HTMLInputElement>(null);
  const [qty, setQty] = useState(1);
  const [quality, setQuality] = useState('Good');
  const [isSplit, setIsSplit] = useState(false);
  const [splitQty, setSplitQty] = useState({ Excellent: 0, Good: 1, Fair: 0, Poor: 0 });
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [tagMeta, setTagMeta] = useState<Map<string, boolean>>(new Map());

  useEffect(() => {
    if (asset.item_type_id) {
      supabase.from('ItemTypeAttributes')
        .select('name, is_parent')
        .eq('item_type_id', asset.item_type_id)
        .then(({ data }) => {
          if (data) {
            const map = new Map<string, boolean>();
            data.forEach((a: any) => { if (a.is_parent) map.set(`${asset.item_type_id}:${a.name}`, true); });
            setTagMeta(map);
          }
        });
    }
  }, [asset.item_type_id]);

  useEffect(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        qtyInputRef.current?.focus();
        qtyInputRef.current?.select();
      });
    });
  }, []);

  const currentSplitTotal = Object.values(splitQty).reduce((sum, val) => sum + val, 0);

  const handleToggleSplit = () => {
    if (!isSplit) {
      setSplitQty({
        Excellent: quality === 'Excellent' ? qty : 0,
        Good:      quality === 'Good'      ? qty : 0,
        Fair:      quality === 'Fair'      ? qty : 0,
        Poor:      quality === 'Poor'      ? qty : 0,
      });
    }
    setIsSplit(!isSplit);
  };

  const handleSplitChange = (q: keyof typeof splitQty, newValue: number) => {
    if (isNaN(newValue)) return;
    const val = Math.max(0, newValue);
    setSplitQty(prev => {
      const primaryBin = quality as keyof typeof splitQty;
      const otherBinsSum = Object.entries(prev)
        .filter(([key]) => key !== q && key !== primaryBin)
        .reduce((sum, [, v]) => sum + v, 0);
      if (q === primaryBin) {
        return { ...prev, [primaryBin]: Math.min(val, Math.max(0, qty - otherBinsSum)) };
      }
      const safeVal = Math.min(val, Math.max(0, qty - otherBinsSum));
      return { ...prev, [q]: safeVal, [primaryBin]: Math.max(0, qty - otherBinsSum - safeVal) };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSplit && currentSplitTotal !== qty) {
      return alert(`Split quantities (${currentSplitTotal}) must equal Total Quantity (${qty}).`);
    }
    setLoading(true);
    try {
      const { error } = await supabase.from('InventoryItems').insert([{
        room_id:       room.id,
        photo_url:     asset.photo_url,
        item_type_id:  asset.item_type_id,
        qty_excellent: isSplit ? splitQty.Excellent : (quality === 'Excellent' ? qty : 0),
        qty_good:      isSplit ? splitQty.Good      : (quality === 'Good'      ? qty : 0),
        qty_fair:      isSplit ? splitQty.Fair      : (quality === 'Fair'      ? qty : 0),
        qty_poor:      isSplit ? splitQty.Poor      : (quality === 'Poor'      ? qty : 0),
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
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md border border-gray-200 dark:border-gray-800 overflow-hidden">
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
                  {[...asset.attributes].sort((a: string, b: string) => {
                    const aP = tagMeta.get(`${asset.item_type_id}:${a}`) ?? false;
                    const bP = tagMeta.get(`${asset.item_type_id}:${b}`) ?? false;
                    if (aP !== bP) return aP ? -1 : 1;
                    return a.localeCompare(b);
                  }).map((a: string) => {
                    const isParent = tagMeta.get(`${asset.item_type_id}:${a}`) ?? false;
                    return (
                      <span key={a} className={`text-[10px] px-1.5 py-0.5 rounded leading-none font-medium ${
                        isParent
                          ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                          : 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300'
                      }`}>{a}</span>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Quantity + Quality row */}
          <div className="bg-gray-50 dark:bg-gray-900/50 p-3 rounded-xl border border-gray-100 dark:border-gray-800">
            <div className="flex items-end gap-3">
              <div className="w-1/3">
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Quantity</label>
                <input
                  ref={qtyInputRef}
                  type="number" min="1"
                  value={qty || ''}
                  onChange={(e) => setQty(parseInt(e.target.value) || 0)}
                  onBlur={() => { if (!qty || qty < 1) setQty(1); }}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 rounded-lg outline-none focus:border-indigo-400 font-bold text-center"
                />
              </div>
              {!isSplit && (
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Quality</label>
                  <select
                    value={quality} onChange={(e) => setQuality(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 rounded-lg outline-none focus:border-indigo-400 appearance-none text-sm"
                  >
                    <option>Excellent</option>
                    <option>Good</option>
                    <option>Fair</option>
                    <option>Poor</option>
                  </select>
                </div>
              )}
              <button
                type="button"
                onClick={handleToggleSplit}
                className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition-all ${
                  isSplit
                    ? 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/40 dark:text-blue-400 dark:border-blue-700'
                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300'
                }`}
              >
                <SplitSquareVertical size={13} />
                {isSplit ? 'Splitting' : 'Split'}
              </button>
            </div>

            {isSplit && (
              <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-500">Allocate all {qty} items by condition:</span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                    currentSplitTotal === qty
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400'
                      : 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400'
                  }`}>
                    {currentSplitTotal} / {qty}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {(['Excellent', 'Good', 'Fair', 'Poor'] as const).map((q) => (
                    <div key={q} className="bg-white dark:bg-gray-950 p-2 rounded-lg border border-gray-200 dark:border-gray-800 flex flex-col items-center">
                      <label className={`text-[9px] uppercase tracking-wider font-bold mb-1 ${
                        q === 'Excellent' ? 'text-green-600 dark:text-green-400' :
                        q === 'Good' ? 'text-blue-600 dark:text-blue-400' :
                        q === 'Fair' ? 'text-yellow-600 dark:text-yellow-500' : 'text-red-600 dark:text-red-400'
                      }`}>{q}</label>
                      <input
                        type="number" min="0"
                        value={splitQty[q]}
                        onChange={(e) => handleSplitChange(q, parseInt(e.target.value) || 0)}
                        className="w-full text-center text-base font-semibold bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded outline-none focus:border-indigo-400 py-0.5"
                      />
                    </div>
                  ))}
                </div>
                {currentSplitTotal !== qty && (
                  <p className="text-[11px] text-red-500 mt-2 flex items-center gap-1 font-medium bg-red-50 dark:bg-red-900/10 p-1.5 rounded-md border border-red-100 dark:border-red-900/30">
                    <Info size={11} /> Quantities must sum to {qty}.
                  </p>
                )}
              </div>
            )}
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
              type="submit" disabled={loading || (isSplit && currentSplitTotal !== qty)}
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

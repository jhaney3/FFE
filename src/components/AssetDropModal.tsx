'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Package, Check, SplitSquareVertical, Info, ChevronDown } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useProjectId } from '@/lib/ProjectContext';

export default function AssetDropModal({ asset, room, onClose, onSaved }: {
  asset: any;
  room: any;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const projectId = useProjectId();
  const qtyInputRef = useRef<HTMLInputElement>(null);
  const [qty, setQty] = useState(1);
  const [quality, setQuality] = useState('Good');
  const [isConditionOpen, setIsConditionOpen] = useState(false);
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
        project_id:    projectId,
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
    <div className="fixed inset-0 bg-black/75 z-[10000] flex items-center justify-center p-4">
      <div className="bg-gray-900 w-full max-w-md border border-gray-700 surface-raised overflow-hidden">

        <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between">
          <div>
            <p className="font-mono text-[10px] tracking-[0.15em] uppercase text-gray-500 mb-0.5">
              Adding to <span className="text-gray-400">{room.name}</span>
            </p>
            <h2 className="text-base font-semibold text-gray-100">{asset.name}</h2>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-600 hover:text-gray-200 hover:bg-gray-800 border border-transparent hover:border-gray-700 transition-colors">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Asset preview */}
          <div className="flex items-center gap-3 p-3 border border-gray-800 bg-gray-950">
            {asset.photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={asset.photo_url} alt={asset.name} className="w-14 h-14 object-cover shrink-0" />
            ) : (
              <div className="w-14 h-14 bg-gray-800 border border-gray-700 flex items-center justify-center shrink-0">
                <Package size={20} className="text-gray-600" />
              </div>
            )}
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-200 truncate">{asset.name}</p>
              {asset.attributes?.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {[...asset.attributes].sort((a: string, b: string) => {
                    const aP = tagMeta.get(`${asset.item_type_id}:${a}`) ?? false;
                    const bP = tagMeta.get(`${asset.item_type_id}:${b}`) ?? false;
                    if (aP !== bP) return aP ? -1 : 1;
                    return a.localeCompare(b);
                  }).map((a: string) => {
                    const isParent = tagMeta.get(`${asset.item_type_id}:${a}`) ?? false;
                    return (
                      <span key={a} className={`font-mono text-[10px] px-1.5 py-0.5 border ${
                        isParent
                          ? 'border-amber-700 bg-amber-700/10 text-amber-400'
                          : 'border-blue-800 bg-blue-900/10 text-blue-400'
                      }`}>{a}</span>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Quantity + Quality */}
          <div className="border border-gray-800 bg-gray-950/50 p-4">
            <div className="flex items-end gap-3">
              <div className="w-1/3">
                <label className="block font-mono text-[10px] tracking-[0.12em] uppercase text-gray-500 mb-1.5">Quantity</label>
                <input
                  ref={qtyInputRef}
                  type="number" min="1"
                  value={qty || ''}
                  onChange={(e) => setQty(parseInt(e.target.value) || 0)}
                  onBlur={() => { if (!qty || qty < 1) setQty(1); }}
                  className="w-full border border-gray-700 bg-gray-950 focus:border-blue-500 px-3 py-2.5 outline-none transition-colors text-gray-100 text-sm"
                />
              </div>
              {!isSplit && (
                <div className="flex-1">
                  <label className="block font-mono text-[10px] tracking-[0.12em] uppercase text-gray-500 mb-1.5">Condition</label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setIsConditionOpen(v => !v)}
                      onBlur={() => setTimeout(() => setIsConditionOpen(false), 150)}
                      className="w-full border border-gray-700 bg-gray-950 focus:border-blue-500 px-3 py-2.5 pr-8 outline-none transition-colors text-gray-100 text-sm text-left cursor-pointer"
                    >
                      {quality}
                    </button>
                    <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-600 pointer-events-none" size={14} />
                    {isConditionOpen && (
                      <div className="absolute z-20 w-full bg-gray-900 border border-gray-700 border-t-0 top-full">
                        {(['Excellent', 'Good', 'Fair', 'Poor'] as const).map(q => (
                          <button
                            key={q}
                            type="button"
                            onMouseDown={() => { setQuality(q); setIsConditionOpen(false); }}
                            className="w-full text-left px-3 py-2 hover:bg-gray-800 text-gray-300 text-sm transition-colors border-b border-gray-800 last:border-0"
                          >
                            {q}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
              <div className="shrink-0 flex flex-col">
                <span className="block font-mono text-[10px] mb-1.5 invisible">_</span>
                <button
                  type="button"
                  onClick={handleToggleSplit}
                  className={`flex items-center justify-center gap-1.5 px-3 py-2.5 leading-5 font-mono text-[10px] tracking-wider uppercase border transition-colors ${
                    isSplit
                      ? 'border-blue-600 bg-blue-600/10 text-blue-400'
                      : 'border-gray-700 text-gray-500 hover:border-gray-500 hover:text-gray-300'
                  }`}
                >
                  <SplitSquareVertical size={12} />
                  {isSplit ? 'Splitting' : 'Split'}
                </button>
              </div>
            </div>

            {isSplit && (
              <div className="mt-4 pt-4 border-t border-gray-800">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-mono text-[10px] text-gray-600 uppercase tracking-wider">Allocate {qty} by condition</span>
                  <span className={`font-mono text-[10px] px-2 py-0.5 border ${
                    currentSplitTotal === qty
                      ? 'border-green-800 text-green-500 bg-green-900/10'
                      : 'border-red-800 text-red-500 bg-red-900/10'
                  }`}>
                    {currentSplitTotal}/{qty}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {(['Excellent', 'Good', 'Fair', 'Poor'] as const).map((q) => (
                    <div key={q} className="border border-gray-800 bg-gray-900 p-2 flex flex-col items-center gap-1">
                      <label className={`font-mono text-[9px] uppercase tracking-wider ${
                        q === 'Excellent' ? 'text-green-500' :
                        q === 'Good' ? 'text-blue-400' :
                        q === 'Fair' ? 'text-yellow-500' : 'text-red-500'
                      }`}>{q[0]}</label>
                      <input
                        type="number" min="0"
                        value={splitQty[q]}
                        onChange={(e) => handleSplitChange(q, parseInt(e.target.value) || 0)}
                        className="w-full text-center text-base font-bold border border-gray-700 bg-gray-950 focus:border-blue-500 outline-none text-gray-100 py-1"
                      />
                    </div>
                  ))}
                </div>
                {currentSplitTotal !== qty && (
                  <p className="font-mono text-[10px] text-red-500 mt-2 flex items-center gap-1 border border-red-900 bg-red-900/10 px-2 py-1.5">
                    <Info size={10} /> Quantities must sum to {qty}
                  </p>
                )}
              </div>
            )}
          </div>

          <div>
            <label className="block font-mono text-[10px] tracking-[0.12em] uppercase text-gray-500 mb-1.5">Notes</label>
            <textarea
              value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional observations..."
              rows={2}
              className="w-full border border-gray-700 bg-gray-950 focus:border-blue-500 px-3 py-2 outline-none resize-none text-gray-100 text-sm placeholder:text-gray-700"
            />
          </div>

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2 font-mono text-[11px] tracking-wider uppercase border border-gray-700 text-gray-400 hover:text-gray-200 hover:bg-gray-800 transition-colors">
              Cancel
            </button>
            <button
              type="submit" disabled={loading || (isSplit && currentSplitTotal !== qty)}
              className="flex-1 py-2 font-mono text-[11px] tracking-wider uppercase border border-blue-600 bg-blue-600/10 text-blue-400 hover:bg-blue-600/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1.5"
            >
              {loading ? 'Adding...' : <><Check size={13} /> Add to Room</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

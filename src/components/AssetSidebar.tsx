'use client';

import { useState, useEffect } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { X, Package, Search, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

function AssetCard({ asset, onDelete }: { asset: any; onDelete: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `asset-${asset.id}`,
    data: { type: 'asset', asset },
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`group relative bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden cursor-grab active:cursor-grabbing transition-all ${
        isDragging ? 'opacity-40 ring-2 ring-indigo-400' : 'hover:border-indigo-300 dark:hover:border-indigo-700 hover:shadow-md'
      }`}
    >
      <div className="w-full aspect-square bg-gray-200 dark:bg-gray-800">
        {asset.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={asset.photo_url} alt={asset.name} className="w-full h-full object-cover pointer-events-none" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400">
            <Package size={24} />
          </div>
        )}
      </div>

      <div className="p-2">
        <p className="text-[12px] font-semibold text-gray-800 dark:text-gray-100 truncate leading-tight">{asset.name}</p>
        {asset.attributes?.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {asset.attributes.slice(0, 2).map((attr: string) => (
              <span key={attr} className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300 leading-none">{attr}</span>
            ))}
            {asset.attributes.length > 2 && (
              <span className="text-[10px] text-gray-400">+{asset.attributes.length - 2}</span>
            )}
          </div>
        )}
      </div>

      <button
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => { e.stopPropagation(); onDelete(asset.id); }}
        className="absolute top-1.5 right-1.5 p-1 rounded-full bg-black/40 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
        title="Delete asset"
      >
        <Trash2 size={11} />
      </button>
    </div>
  );
}

export default function AssetSidebar({ onClose }: { onClose: () => void }) {
  const [assets, setAssets] = useState<any[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    supabase.from('Assets').select('*').order('created_at', { ascending: false })
      .then(({ data }) => { if (data) setAssets(data); });

    const channel = supabase
      .channel('assets-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'Assets' }, () => {
        supabase.from('Assets').select('*').order('created_at', { ascending: false })
          .then(({ data }) => { if (data) setAssets(data); });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this asset?')) return;
    await supabase.from('Assets').delete().eq('id', id);
    setAssets(prev => prev.filter(a => a.id !== id));
  };

  const filtered = search
    ? assets.filter(a =>
        a.name.toLowerCase().includes(search.toLowerCase()) ||
        (a.attributes || []).some((t: string) => t.toLowerCase().includes(search.toLowerCase()))
      )
    : assets;

  return (
    <div className="fixed right-0 top-14 bottom-0 w-64 bg-white dark:bg-gray-950 border-l border-gray-200 dark:border-gray-800 shadow-2xl z-30 flex flex-col animate-in slide-in-from-right duration-200">
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between shrink-0">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2">
          <Package size={15} className="text-indigo-500" /> Assets
        </h2>
        <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 transition-colors">
          <X size={16} />
        </button>
      </div>

      <div className="px-3 py-2 shrink-0">
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search assets..."
            className="w-full pl-7 pr-3 py-1.5 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg outline-none focus:border-indigo-400 transition-colors"
          />
        </div>
      </div>

      <p className="px-3 pb-2 text-[10px] text-gray-400 shrink-0">Drag onto a room zone to add an item.</p>

      <div className="flex-1 overflow-y-auto px-3 pb-3 custom-scrollbar">
        {filtered.length === 0 ? (
          <div className="text-center py-10 text-gray-400">
            <Package size={28} className="mx-auto mb-2 opacity-40" />
            <p className="text-xs leading-relaxed">
              {assets.length === 0
                ? 'No assets yet.\nUse "Save as asset" when logging an item.'
                : 'No matches.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {filtered.map(asset => (
              <AssetCard key={asset.id} asset={asset} onDelete={handleDelete} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

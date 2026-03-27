'use client';

import { useState, useEffect } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { X, Package, Search, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

function AssetCard({ asset, onDelete, tagMeta }: { asset: any; onDelete: (id: string) => void; tagMeta: Map<string, boolean> }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `asset-${asset.id}`,
    data: { type: 'asset', asset },
  });

  const sortedAttrs = [...(asset.attributes ?? [])].sort((a: string, b: string) => {
    const aP = tagMeta.get(`${asset.item_type_id}:${a}`) ?? false;
    const bP = tagMeta.get(`${asset.item_type_id}:${b}`) ?? false;
    if (aP !== bP) return aP ? -1 : 1;
    return a.localeCompare(b);
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`group relative border overflow-hidden cursor-grab active:cursor-grabbing transition-all ${
        isDragging
          ? 'opacity-40 border-blue-500'
          : 'border-gray-800 bg-gray-950/50 hover:border-gray-700'
      }`}
    >
      <div className="w-full aspect-square bg-gray-900 border-b border-gray-800">
        {asset.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={asset.photo_url} alt={asset.name} className="w-full h-full object-cover pointer-events-none" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-600">
            <Package size={20} />
          </div>
        )}
      </div>

      <div className="p-2">
        <p className="text-[11px] font-semibold text-gray-200 truncate leading-tight">{asset.name}</p>
        {sortedAttrs.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {sortedAttrs.slice(0, 2).map((attr: string) => {
              const isParent = tagMeta.get(`${asset.item_type_id}:${attr}`) ?? false;
              return (
                <span key={attr} className={`font-mono text-[9px] px-1 py-px border leading-none ${
                  isParent
                    ? 'border-amber-700/50 bg-amber-900/20 text-amber-400'
                    : 'border-blue-800/50 bg-blue-900/15 text-blue-400'
                }`}>{attr}</span>
              );
            })}
            {sortedAttrs.length > 2 && (
              <span className="font-mono text-[9px] text-gray-600">+{sortedAttrs.length - 2}</span>
            )}
          </div>
        )}
      </div>

      <button
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => { e.stopPropagation(); onDelete(asset.id); }}
        className="absolute top-1.5 right-1.5 p-1 border border-transparent bg-black/50 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity hover:border-red-700 hover:text-red-400 hover:bg-red-900/20"
        title="Delete asset"
      >
        <Trash2 size={10} />
      </button>
    </div>
  );
}

export default function AssetSidebar({ onClose }: { onClose: () => void }) {
  const [assets, setAssets] = useState<any[]>([]);
  const [tagMeta, setTagMeta] = useState<Map<string, boolean>>(new Map());
  const [search, setSearch] = useState('');

  const fetchAssetsAndMeta = async () => {
    const { data } = await supabase.from('Assets').select('*').order('created_at', { ascending: false });
    if (!data) return;
    setAssets(data);
    const typeIds = [...new Set(data.map((a: any) => a.item_type_id).filter(Boolean))];
    if (typeIds.length === 0) return;
    const { data: attrs } = await supabase.from('ItemTypeAttributes')
      .select('item_type_id, name, is_parent')
      .in('item_type_id', typeIds);
    if (attrs) {
      const map = new Map<string, boolean>();
      attrs.forEach((a: any) => { if (a.is_parent) map.set(`${a.item_type_id}:${a.name}`, true); });
      setTagMeta(map);
    }
  };

  useEffect(() => {
    fetchAssetsAndMeta();

    const channel = supabase
      .channel('assets-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'Assets' }, fetchAssetsAndMeta)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleDelete = async (id: string) => {
    const asset = assets.find(a => a.id === id);

    // Check how many inventory items reference this asset's photo
    let referencingItems: any[] = [];
    if (asset?.photo_url) {
      const { data } = await supabase
        .from('InventoryItems')
        .select('id')
        .eq('photo_url', asset.photo_url);
      referencingItems = data || [];
    }

    const count = referencingItems.length;
    const message = count > 0
      ? `Delete this asset? ${count} inventory item${count !== 1 ? 's' : ''} still use its photo — the file will be kept until the last item is removed.`
      : 'Delete this asset?';

    if (!confirm(message)) return;

    await supabase.from('Assets').delete().eq('id', id);
    setAssets(prev => prev.filter(a => a.id !== id));

    // Only delete the storage file if no inventory items still reference it
    if (count === 0 && asset?.photo_url) {
      const marker = '/inventory_photos/';
      const idx = asset.photo_url.indexOf(marker);
      if (idx !== -1) {
        const filePath = asset.photo_url.slice(idx + marker.length);
        if (filePath.startsWith('assets/')) {
          await supabase.storage.from('inventory_photos').remove([filePath]);
        }
      }
    }
  };

  const filtered = search
    ? assets.filter(a =>
        a.name.toLowerCase().includes(search.toLowerCase()) ||
        (a.attributes || []).some((t: string) => t.toLowerCase().includes(search.toLowerCase()))
      )
    : assets;

  return (
    <div className="fixed right-0 top-14 bottom-0 w-60 bg-gray-900 border-l border-gray-800 surface-raised z-30 flex flex-col animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between shrink-0">
        <span className="font-mono text-[10px] tracking-[0.15em] uppercase text-gray-500 flex items-center gap-1.5">
          <Package size={11} className="text-blue-500" />
          Asset Library
        </span>
        <button
          onClick={onClose}
          className="p-1 border border-transparent hover:border-gray-700 text-gray-600 hover:text-gray-300 transition-colors"
        >
          <X size={14} />
        </button>
      </div>

      {/* Search */}
      <div className="px-3 py-2.5 border-b border-gray-800 shrink-0">
        <div className="relative">
          <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-600 pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search assets..."
            className="w-full pl-7 pr-3 py-1.5 font-mono text-[11px] bg-gray-950 border border-gray-700 focus:border-blue-500 outline-none transition-colors text-gray-100 placeholder:text-gray-500"
          />
        </div>
      </div>

      <p className="px-3 py-1.5 font-mono text-[9px] tracking-wider text-gray-500 uppercase shrink-0">Drag onto a zone to assign</p>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto px-3 pb-3 custom-scrollbar">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-2">
            <Package size={22} className="text-gray-800" />
            <p className="font-mono text-[10px] text-gray-500 text-center leading-relaxed tracking-wider uppercase">
              {assets.length === 0 ? 'No assets yet' : 'No matches'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-1.5">
            {filtered.map(asset => (
              <AssetCard key={asset.id} asset={asset} onDelete={handleDelete} tagMeta={tagMeta} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

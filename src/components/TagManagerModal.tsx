'use client';

import { useState, useEffect } from 'react';
import { X, ChevronDown, ChevronRight, Trash2, AlertTriangle, Check } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type Tag = {
  id: string;
  name: string;
  is_parent: boolean;
  itemCount: number;
};

type ItemTypeGroup = {
  id: string;
  name: string;
  tags: Tag[];
};

export default function TagManagerModal({ onClose }: { onClose: () => void }) {
  const [groups, setGroups] = useState<ItemTypeGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedTypes, setExpandedTypes] = useState<Set<string>>(new Set());

  // Pending delete state
  const [pendingDelete, setPendingDelete] = useState<{
    typeId: string;
    typeName: string;
    tag: Tag;
    mode: 'catalog' | 'all';
  } | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    const [{ data: types }, { data: attrs }, { data: items }] = await Promise.all([
      supabase.from('ItemTypes').select('id, name').order('name'),
      supabase.from('ItemTypeAttributes').select('id, item_type_id, name, is_parent'),
      supabase.from('InventoryItems').select('item_type_id, attributes'),
    ]);

    if (!types || !attrs || !items) { setLoading(false); return; }

    // Count usage per (item_type_id, tag name)
    const usageMap = new Map<string, number>();
    for (const item of items) {
      for (const attr of (item.attributes || [])) {
        const key = `${item.item_type_id}:${attr}`;
        usageMap.set(key, (usageMap.get(key) ?? 0) + 1);
      }
    }

    const built: ItemTypeGroup[] = types.map(t => ({
      id: t.id,
      name: t.name,
      tags: attrs
        .filter(a => a.item_type_id === t.id)
        .map(a => ({
          id: a.id,
          name: a.name,
          is_parent: a.is_parent,
          itemCount: usageMap.get(`${t.id}:${a.name}`) ?? 0,
        }))
        .sort((a, b) => {
          if (a.is_parent !== b.is_parent) return a.is_parent ? -1 : 1;
          return a.name.localeCompare(b.name);
        }),
    })).filter(g => g.tags.length > 0);

    setGroups(built);
    // Auto-expand if only one type
    if (built.length === 1) setExpandedTypes(new Set([built[0].id]));
    setLoading(false);
  };

  const toggleExpand = (id: string) => {
    setExpandedTypes(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleConfirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    const { typeId, tag, mode } = pendingDelete;
    try {
      // Always remove from catalog
      await supabase.from('ItemTypeAttributes').delete().eq('id', tag.id);

      // Optionally strip from all items
      if (mode === 'all' && tag.itemCount > 0) {
        // Fetch affected items and strip the tag from their attributes array
        const { data: affected } = await supabase
          .from('InventoryItems')
          .select('id, attributes')
          .eq('item_type_id', typeId);

        if (affected) {
          await Promise.all(
            affected
              .filter(item => (item.attributes || []).includes(tag.name))
              .map(item =>
                supabase.from('InventoryItems')
                  .update({ attributes: (item.attributes as string[]).filter((a: string) => a !== tag.name) })
                  .eq('id', item.id)
              )
          );
        }
      }

      setPendingDelete(null);
      await fetchAll();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[10000] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg border border-gray-200 dark:border-gray-800 overflow-hidden flex flex-col max-h-[80vh]">

        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Tag Manager</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Remove tags from item type catalogs</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto custom-scrollbar flex-1 p-4 space-y-2">
          {loading ? (
            <p className="text-sm text-gray-400 text-center py-8">Loading...</p>
          ) : groups.length === 0 ? (
            <p className="text-sm text-gray-400 italic text-center py-8">No tags found.</p>
          ) : groups.map(group => {
            const expanded = expandedTypes.has(group.id);
            return (
              <div key={group.id} className="rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
                {/* Type header */}
                <button
                  type="button"
                  onClick={() => toggleExpand(group.id)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-950 hover:bg-gray-100 dark:hover:bg-gray-800/60 transition-colors text-left"
                >
                  <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">{group.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-gray-400">{group.tags.length} tag{group.tags.length !== 1 ? 's' : ''}</span>
                    {expanded ? <ChevronDown size={15} className="text-gray-400" /> : <ChevronRight size={15} className="text-gray-400" />}
                  </div>
                </button>

                {/* Tags list */}
                {expanded && (
                  <div className="divide-y divide-gray-100 dark:divide-gray-800">
                    {group.tags.map(tag => (
                      <div key={tag.id} className="flex items-center justify-between px-4 py-2.5 bg-white dark:bg-gray-900">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase tracking-wide shrink-0 ${
                            tag.is_parent
                              ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                              : 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                          }`}>
                            {tag.is_parent ? 'Group' : 'Tag'}
                          </span>
                          <span className="text-sm text-gray-800 dark:text-gray-200 truncate">{tag.name}</span>
                        </div>
                        <div className="flex items-center gap-3 shrink-0 ml-3">
                          <span className="text-xs text-gray-400">
                            {tag.itemCount > 0 ? `${tag.itemCount} item${tag.itemCount !== 1 ? 's' : ''}` : 'unused'}
                          </span>
                          <button
                            type="button"
                            onClick={() => setPendingDelete({ typeId: group.id, typeName: group.name, tag, mode: tag.itemCount > 0 ? 'catalog' : 'all' })}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                            title="Delete tag"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Delete confirmation sub-modal */}
      {pendingDelete && (
        <div className="fixed inset-0 bg-black/40 z-[10001] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-sm border border-gray-200 dark:border-gray-800 p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0">
                <AlertTriangle size={16} className="text-red-500" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  Delete <span className="text-indigo-500">"{pendingDelete.tag.name}"</span> from {pendingDelete.typeName}?
                </p>
                {pendingDelete.tag.itemCount > 0 && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    This tag is used on <span className="font-semibold text-gray-700 dark:text-gray-200">{pendingDelete.tag.itemCount} item{pendingDelete.tag.itemCount !== 1 ? 's' : ''}</span>.
                  </p>
                )}
              </div>
            </div>

            {/* Mode selector — only shown when tag is in use */}
            {pendingDelete.tag.itemCount > 0 && (
              <div className="space-y-2">
                {(['catalog', 'all'] as const).map(mode => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setPendingDelete(p => p ? { ...p, mode } : p)}
                    className={`w-full text-left px-4 py-3 rounded-xl border text-sm transition-all ${
                      pendingDelete.mode === mode
                        ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 text-gray-900 dark:text-gray-100'
                        : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-0.5">
                      <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                        pendingDelete.mode === mode ? 'border-indigo-500' : 'border-gray-400'
                      }`}>
                        {pendingDelete.mode === mode && <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />}
                      </div>
                      <span className="font-semibold text-xs uppercase tracking-wide">
                        {mode === 'catalog' ? 'Catalog only' : 'All items too'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 ml-5">
                      {mode === 'catalog'
                        ? 'Remove from suggestions. Existing items keep the tag.'
                        : `Strip from all ${pendingDelete.tag.itemCount} item${pendingDelete.tag.itemCount !== 1 ? 's' : ''} and remove from suggestions.`}
                    </p>
                  </button>
                ))}
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setPendingDelete(null)}
                className="flex-1 py-2.5 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                disabled={deleting}
                onClick={handleConfirmDelete}
                className="flex-1 py-2.5 text-sm font-semibold text-white bg-red-500 hover:bg-red-600 disabled:opacity-50 rounded-xl transition-colors flex items-center justify-center gap-1.5"
              >
                {deleting ? 'Deleting...' : <><Trash2 size={14} /> Delete</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

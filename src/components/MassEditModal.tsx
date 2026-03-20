'use client';

import { useState, useEffect, useRef } from 'react';
import { X, ChevronDown, Check, AlertTriangle, Tag, Layers, ShieldCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase';

function Section({ title, enabled, onToggle, icon, children }: {
  title: string;
  enabled: boolean;
  onToggle: () => void;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className={`rounded-xl border transition-all ${
      enabled
        ? 'border-indigo-200 dark:border-indigo-800 bg-indigo-50/40 dark:bg-indigo-900/10'
        : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900'
    }`}>
      <button type="button" onClick={onToggle} className="w-full flex items-center justify-between px-4 py-3 text-left">
        <span className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
          {icon}{title}
        </span>
        <div className={`w-8 h-4 rounded-full transition-colors relative shrink-0 ${enabled ? 'bg-indigo-500' : 'bg-gray-300 dark:bg-gray-700'}`}>
          <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-all ${enabled ? 'left-4' : 'left-0.5'}`} />
        </div>
      </button>
      {enabled && (
        <div className="px-4 pb-4 pt-3 border-t border-indigo-100 dark:border-indigo-900/40 animate-in fade-in slide-in-from-top-1 duration-150">
          {children}
        </div>
      )}
    </div>
  );
}

export default function MassEditModal({ selectedIds, selectedItems, allItems, onClose, onSaved }: {
  selectedIds: string[];
  selectedItems: any[];
  allItems: any[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [step, setStep] = useState<'edit' | 'confirm'>('edit');
  const [loading, setLoading] = useState(false);

  // ── Attributes ──────────────────────────────────────────────────────────────
  const [attrsEnabled, setAttrsEnabled]   = useState(false);
  const [tagsToAdd, setTagsToAdd]         = useState<string[]>([]);
  const [tagInput, setTagInput]           = useState('');
  const tagInputRef                       = useRef<HTMLInputElement>(null);

  // ── Item Type ────────────────────────────────────────────────────────────────
  const [typeEnabled, setTypeEnabled]     = useState(false);
  const [itemTypes, setItemTypes]         = useState<any[]>([]);
  const [typeSearch, setTypeSearch]       = useState('');
  const [typeId, setTypeId]               = useState<string | null>(null);
  const [typeDropdownOpen, setTypeDropdownOpen] = useState(false);

  // ── Quality ──────────────────────────────────────────────────────────────────
  const [qualityEnabled, setQualityEnabled] = useState(false);
  const [quality, setQuality]               = useState('Good');

  useEffect(() => {
    supabase.from('ItemTypes').select('*').order('name')
      .then(({ data }) => { if (data) setItemTypes(data); });
  }, []);

  // Tags from ItemTypeAttributes scoped to the types in the selection (+ new type if changed)
  const [availableTags, setAvailableTags] = useState<any[]>([]);

  useEffect(() => {
    const typeIds = Array.from(new Set([
      ...selectedItems.map(i => i.item_type_id).filter(Boolean),
      ...(typeId ? [typeId] : []),
    ]));
    if (typeIds.length === 0) return;
    supabase.from('ItemTypeAttributes')
      .select('name, is_parent, item_type_id')
      .in('item_type_id', typeIds)
      .then(({ data }) => {
        if (data) {
          // Deduplicate by name, prefer is_parent=true if any row has it
          const seen = new Map<string, any>();
          data.forEach((r: any) => {
            if (!seen.has(r.name) || r.is_parent) seen.set(r.name, r);
          });
          setAvailableTags(Array.from(seen.values()).sort((a, b) => a.name.localeCompare(b.name)));
        }
      });
  }, [selectedItems, typeId]);

  const parentSuggestions = availableTags.filter(t => t.is_parent && !tagsToAdd.includes(t.name));
  const childSuggestions  = availableTags.filter(t => !t.is_parent && !tagsToAdd.includes(t.name));
  const parentNames       = new Set(availableTags.filter(t => t.is_parent).map(t => t.name));

  const addTag = (tagName: string, isParent: boolean) => {
    if (isParent) {
      // Radio: replace any existing parent tag
      setTagsToAdd(prev => [...prev.filter(t => !parentNames.has(t)), tagName]);
    } else {
      setTagsToAdd(prev => [...prev, tagName]);
    }
  };

  const filteredTypes = itemTypes.filter(t =>
    t.name.toLowerCase().includes(typeSearch.toLowerCase())
  );

  const commitTagInput = () => {
    const val = tagInput.trim().replace(/,$/, '');
    if (val && !tagsToAdd.includes(val)) setTagsToAdd(prev => [...prev, val]);
    setTagInput('');
  };

  // Build confirmation summary
  const summaryLines: string[] = [];
  if (attrsEnabled) {
    summaryLines.push(
      tagsToAdd.length > 0
        ? `Set attributes to: ${tagsToAdd.join(', ')} (replaces existing tags on all selected items)`
        : 'Clear all attributes on selected items'
    );
  }
  if (typeEnabled && typeSearch.trim()) summaryLines.push(`Change type to: "${typeSearch.trim()}"`);
  if (qualityEnabled) summaryLines.push(`Reassign quality to: ${quality} (collapses split quantities)`);

  const canProceed =
    attrsEnabled ||
    (typeEnabled && typeSearch.trim()) ||
    qualityEnabled;

  const handleSave = async () => {
    setLoading(true);
    try {
      // 1. Item type — single batch update
      let resolvedTypeId: string | null = null;
      if (typeEnabled && typeSearch.trim()) {
        resolvedTypeId = typeId;
        if (!resolvedTypeId) {
          const { data: existing } = await supabase
            .from('ItemTypes').select('id').ilike('name', typeSearch.trim()).maybeSingle();
          if (existing) {
            resolvedTypeId = existing.id;
          } else {
            const { data: created } = await supabase
              .from('ItemTypes').insert([{ name: typeSearch.trim() }]).select().single();
            resolvedTypeId = created?.id;
          }
        }
        if (resolvedTypeId) {
          await supabase.from('InventoryItems')
            .update({ item_type_id: resolvedTypeId })
            .in('id', selectedIds);
        }
      }

      // 2. Attributes — replace all selected items with the chosen tag set
      if (attrsEnabled) {
        await supabase.from('InventoryItems')
          .update({ attributes: tagsToAdd })
          .in('id', selectedIds);

        // Persist new tags to ItemTypeAttributes so they appear in future dropdowns
        if (tagsToAdd.length > 0) {
          const affectedTypeIds = resolvedTypeId
            ? [resolvedTypeId]
            : Array.from(new Set(selectedItems.map(i => i.item_type_id).filter(Boolean)));

          for (const tid of affectedTypeIds) {
            for (const tagName of tagsToAdd) {
              await supabase.from('ItemTypeAttributes').upsert(
                { item_type_id: tid, name: tagName },
                { onConflict: 'item_type_id,name' as any }
              );
            }
          }
        }
      }

      // 3. Quality — per-item (each has a different total quantity)
      if (qualityEnabled) {
        await Promise.all(selectedItems.map(item => {
          const total = (item.qty_excellent || 0) + (item.qty_good || 0) + (item.qty_fair || 0) + (item.qty_poor || 0);
          return supabase.from('InventoryItems').update({
            qty_excellent: quality === 'Excellent' ? total : 0,
            qty_good:      quality === 'Good'      ? total : 0,
            qty_fair:      quality === 'Fair'      ? total : 0,
            qty_poor:      quality === 'Poor'      ? total : 0,
          }).eq('id', item.id);
        }));
      }

      onSaved();
      onClose();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[10000] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg border border-gray-200 dark:border-gray-800 overflow-hidden">

        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Mass Edit</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">{selectedIds.length} item{selectedIds.length !== 1 ? 's' : ''} selected</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 transition-colors">
            <X size={18} />
          </button>
        </div>

        {step === 'edit' ? (
          <div className="p-5 space-y-3 max-h-[72vh] overflow-y-auto custom-scrollbar">

            {/* Attributes */}
            <Section title="Set Attributes" enabled={attrsEnabled} onToggle={() => setAttrsEnabled(v => !v)} icon={<Tag size={14} />}>
              <p className="text-[11px] text-gray-400 mb-2">These tags will replace existing attributes on all selected items.</p>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {parentSuggestions.length > 0 && (
                  <div className="w-full">
                    <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider mb-1 block">Grouping (pick one)</span>
                    <div className="flex flex-wrap gap-1.5">
                      {parentSuggestions.map(tag => (
                        <button key={tag.name} type="button"
                          onClick={() => addTag(tag.name, true)}
                          className="text-[11px] px-2 py-1 rounded-full border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-400 transition-colors"
                        >+ {tag.name}</button>
                      ))}
                    </div>
                  </div>
                )}
                {childSuggestions.map(tag => (
                  <button key={tag.name} type="button"
                    onClick={() => addTag(tag.name, false)}
                    className="text-[11px] px-2 py-1 rounded-full border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
                  >+ {tag.name}</button>
                ))}
                <input
                  ref={tagInputRef}
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if ((e.key === 'Enter' || e.key === ',') && tagInput.trim()) {
                      e.preventDefault();
                      commitTagInput();
                    }
                  }}
                  onBlur={commitTagInput}
                  placeholder="Custom tag + Enter"
                  className="text-[11px] px-2 py-1 rounded-full border border-dashed border-gray-300 dark:border-gray-600 outline-none focus:border-indigo-400 w-36 bg-transparent"
                />
              </div>
              {tagsToAdd.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {tagsToAdd.map(tag => {
                    const isParent = parentNames.has(tag);
                    return (
                      <span key={tag} className={`text-[11px] px-2 py-1 rounded-full flex items-center gap-1 border ${
                        isParent
                          ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                          : 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800'
                      }`}>
                        {tag}
                        <button onClick={() => setTagsToAdd(prev => prev.filter(t => t !== tag))} className="hover:text-red-500 leading-none">×</button>
                      </span>
                    );
                  })}
                </div>
              ) : (
                <p className="text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-1">
                  <AlertTriangle size={11} className="shrink-0" /> No tags selected — saving will clear all attributes.
                </p>
              )}
            </Section>

            {/* Item Type */}
            <Section title="Change Item Type" enabled={typeEnabled} onToggle={() => setTypeEnabled(v => !v)} icon={<Layers size={14} />}>
              <div className="relative">
                <input
                  value={typeSearch}
                  onChange={(e) => { setTypeSearch(e.target.value); setTypeId(null); setTypeDropdownOpen(true); }}
                  onFocus={() => setTypeDropdownOpen(true)}
                  onBlur={() => setTimeout(() => setTypeDropdownOpen(false), 200)}
                  placeholder="e.g. Chair, Desk..."
                  className="w-full px-3 py-2 pr-8 border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 rounded-lg outline-none focus:border-indigo-400 text-sm"
                />
                <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                {typeDropdownOpen && typeSearch && (
                  <div className="absolute z-20 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-36 overflow-y-auto">
                    {filteredTypes.length > 0 ? filteredTypes.map(t => (
                      <button key={t.id} type="button"
                        onMouseDown={() => { setTypeSearch(t.name); setTypeId(t.id); setTypeDropdownOpen(false); }}
                        className="w-full text-left px-3 py-2 hover:bg-blue-50 dark:hover:bg-blue-900/30 text-sm transition-colors"
                      >{t.name}</button>
                    )) : (
                      <div className="px-3 py-2 text-sm text-gray-500 italic">
                        Create new: <span className="font-semibold text-blue-600 dark:text-blue-400">"{typeSearch}"</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </Section>

            {/* Quality */}
            <Section title="Reassign Quality" enabled={qualityEnabled} onToggle={() => setQualityEnabled(v => !v)} icon={<ShieldCheck size={14} />}>
              <select
                value={quality}
                onChange={(e) => setQuality(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 rounded-lg outline-none focus:border-indigo-400 text-sm appearance-none mb-2"
              >
                <option>Excellent</option>
                <option>Good</option>
                <option>Fair</option>
                <option>Poor</option>
              </select>
              <p className="text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-1">
                <AlertTriangle size={11} className="shrink-0" />
                Each item's full quantity is moved to this condition. Split quantities will be collapsed.
              </p>
            </Section>

            {/* Footer */}
            <div className="flex gap-2 pt-1">
              <button onClick={onClose} className="flex-1 py-2.5 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors">
                Cancel
              </button>
              <button
                disabled={!canProceed}
                onClick={() => setStep('confirm')}
                className="flex-1 py-2.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl transition-colors"
              >
                Review Changes
              </button>
            </div>
          </div>
        ) : (
          // Confirm step
          <div className="p-6 space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Applying to <span className="font-bold text-gray-900 dark:text-gray-100">{selectedIds.length} item{selectedIds.length !== 1 ? 's' : ''}</span>:
            </p>
            <ul className="space-y-2.5 bg-gray-50 dark:bg-gray-950 rounded-xl p-4 border border-gray-100 dark:border-gray-800">
              {summaryLines.map((line, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <Check size={15} className="text-green-500 mt-0.5 shrink-0" />
                  {line}
                </li>
              ))}
            </ul>
            <div className="flex gap-2 pt-1">
              <button onClick={() => setStep('edit')} className="flex-1 py-2.5 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors">
                Back
              </button>
              <button
                disabled={loading}
                onClick={handleSave}
                className="flex-1 py-2.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-xl transition-colors flex items-center justify-center gap-1.5"
              >
                {loading ? 'Saving...' : <><Check size={15} /> Apply to {selectedIds.length} Items</>}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

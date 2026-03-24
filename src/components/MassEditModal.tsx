'use client';

import { useState, useEffect, useRef } from 'react';
import { X, ChevronDown, Check, AlertTriangle, Tag, Layers, ShieldCheck, Package } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { saveAssetIfNew } from '@/lib/saveAsset';

function Section({ title, enabled, onToggle, icon, children }: {
  title: string;
  enabled: boolean;
  onToggle: () => void;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className={`border transition-all ${
      enabled ? 'border-blue-700 bg-blue-900/5' : 'border-gray-700 bg-gray-900'
    }`}>
      <button type="button" onClick={onToggle} className="w-full flex items-center justify-between px-4 py-3 text-left">
        <span className="flex items-center gap-2 font-mono text-[10px] tracking-[0.12em] uppercase text-gray-400">
          {icon}{title}
        </span>
        <span className={`inline-block w-3 h-3 border transition-colors ${enabled ? 'border-blue-500 bg-blue-500' : 'border-gray-600'}`} />
      </button>
      {enabled && (
        <div className="px-4 pb-4 pt-3 border-t border-gray-800">
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
  const [step, setStep] = useState<'edit' | 'confirm' | 'pick-photo' | 'asset-exists'>('edit');
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

  // ── Post-save asset state ────────────────────────────────────────────────────
  const [matchedAsset, setMatchedAsset]         = useState<any>(null);
  const [postSaveTypeId, setPostSaveTypeId]     = useState<string | null>(null);
  const [postSaveTypeName, setPostSaveTypeName] = useState('');
  const [postSaveAttrs, setPostSaveAttrs]       = useState<string[]>([]);
  const [savedItems, setSavedItems]             = useState<any[]>([]);
  const [savedCount, setSavedCount]             = useState(0);
  const [selectedPhotoItemId, setSelectedPhotoItemId] = useState<string | null>(null);
  const [removePhotoIds, setRemovePhotoIds]     = useState<Set<string>>(new Set());
  const [convertAll, setConvertAll]             = useState(false);
  const [assetLoading, setAssetLoading]         = useState(false);

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

      // Snapshot before onSaved() resets parent selection
      const itemsSnapshot = [...selectedItems];
      const countSnapshot = selectedIds.length;
      setSavedItems(itemsSnapshot);
      setSavedCount(countSnapshot);

      onSaved();

      // Check if all items now share the same type + attributes → offer asset creation
      const finalTypeId = resolvedTypeId ?? itemsSnapshot[0]?.item_type_id ?? null;
      const allSameType = finalTypeId && itemsSnapshot.every(i =>
        (resolvedTypeId ?? i.item_type_id) === finalTypeId
      );

      if (allSameType) {
        let checkAttrs: string[];
        let allSameAttrs: boolean;
        if (attrsEnabled) {
          allSameAttrs = true;
          checkAttrs = tagsToAdd;
        } else {
          const firstSorted = [...(itemsSnapshot[0]?.attributes || [])].sort().join(',');
          allSameAttrs = itemsSnapshot.every(i =>
            [...(i.attributes || [])].sort().join(',') === firstSorted
          );
          checkAttrs = itemsSnapshot[0]?.attributes || [];
        }

        if (allSameAttrs) {
          const sortedAttrs = [...checkAttrs].sort();
          const { data: assets } = await supabase
            .from('Assets').select('*').eq('item_type_id', finalTypeId);
          const found = assets?.find(a =>
            JSON.stringify([...(a.attributes || [])].sort()) === JSON.stringify(sortedAttrs)
          );
          const typeName = itemTypes.find(t => t.id === finalTypeId)?.name || typeSearch.trim();
          setPostSaveTypeId(finalTypeId);
          setPostSaveTypeName(typeName);
          setPostSaveAttrs(checkAttrs);
          if (found) {
            setMatchedAsset(found);
            setStep('asset-exists');
            return;
          } else {
            const firstWithPhoto = itemsSnapshot.find(i => i.photo_url);
            setSelectedPhotoItemId(firstWithPhoto?.id ?? null);
            setStep('pick-photo');
            return;
          }
        }
      }

      onClose();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const deleteItemPhoto = async (item: any) => {
    if (!item?.photo_url) return;
    const marker = '/inventory_photos/';
    const idx = item.photo_url.indexOf(marker);
    const filePath = idx !== -1
      ? item.photo_url.slice(idx + marker.length)
      : item.photo_url.split('/').pop();
    // Never delete asset-owned files — they live in the assets/ subfolder
    if (!filePath || filePath.startsWith('assets/')) return;
    await supabase.storage.from('inventory_photos').remove([filePath]);
  };

  // Shared photo cleanup — called after asset exists or is created
  // assetPhotoUrl: the url to replace item photos with (null = just delete)
  // skipItemId: the representative item whose photo we keep intact
  const handlePhotoCleanup = async (assetPhotoUrl: string | null, skipItemId: string | null) => {
    if (convertAll) {
      for (const item of savedItems) {
        if (item.id === skipItemId || !item.photo_url) continue;
        await deleteItemPhoto(item);
        await supabase.from('InventoryItems')
          .update({ photo_url: assetPhotoUrl })
          .eq('id', item.id);
      }
    } else {
      for (const itemId of removePhotoIds) {
        const item = savedItems.find(i => i.id === itemId);
        await deleteItemPhoto(item);
        await supabase.from('InventoryItems').update({ photo_url: assetPhotoUrl }).eq('id', itemId);
      }
    }
  };

  const handleCreateAsset = async () => {
    setAssetLoading(true);
    try {
      const chosenItem = savedItems.find(i => i.id === selectedPhotoItemId);
      const result = await saveAssetIfNew({
        name:         postSaveTypeName,
        item_type_id: postSaveTypeId!,
        photo_url:    chosenItem?.photo_url ?? null,
        attributes:   postSaveAttrs,
        notes:        '',
      });

      const assetPhotoUrl = result.assetPhotoUrl;

      // Update all other items (deletes their root photos, points them at asset photo)
      await handlePhotoCleanup(assetPhotoUrl, selectedPhotoItemId);

      // Also update the representative item itself to the assets/ path
      if (selectedPhotoItemId && assetPhotoUrl) {
        await supabase.from('InventoryItems')
          .update({ photo_url: assetPhotoUrl })
          .eq('id', selectedPhotoItemId);
      }

      onSaved();
      onClose();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setAssetLoading(false);
    }
  };

  const handleExistingAssetDone = async () => {
    setAssetLoading(true);
    try {
      await handlePhotoCleanup(matchedAsset?.photo_url ?? null, null);
      onSaved();
      onClose();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setAssetLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/75 z-[10000] flex items-center justify-center p-4">
      <div className="bg-gray-900 w-full max-w-lg border border-gray-700 surface-raised overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between">
          <div>
            <p className="font-mono text-[10px] tracking-[0.15em] uppercase text-gray-500">Mass Edit</p>
            <p className="text-base font-semibold text-gray-100">{savedCount || selectedIds.length} item{(savedCount || selectedIds.length) !== 1 ? 's' : ''} selected</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-600 hover:text-gray-200 hover:bg-gray-800 border border-transparent hover:border-gray-700 transition-colors">
            <X size={18} />
          </button>
        </div>

        {step === 'edit' ? (
          <div className="p-5 space-y-3 max-h-[72vh] overflow-y-auto custom-scrollbar">

            {/* Attributes */}
            <Section title="Set Attributes" enabled={attrsEnabled} onToggle={() => setAttrsEnabled(v => !v)} icon={<Tag size={14} />}>
              <p className="font-mono text-[10px] tracking-[0.12em] uppercase text-gray-500 mb-1.5">These tags will replace existing attributes on all selected items.</p>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {parentSuggestions.length > 0 && (
                  <div className="w-full">
                    <span className="font-mono text-[10px] tracking-[0.12em] uppercase text-gray-500 mb-1.5 block">Grouping (pick one)</span>
                    <div className="flex flex-wrap gap-1.5">
                      {parentSuggestions.map(tag => (
                        <button key={tag.name} type="button"
                          onClick={() => addTag(tag.name, true)}
                          className="font-mono text-[11px] px-2 py-0.5 border border-amber-800 text-amber-600 hover:border-amber-600 hover:text-amber-400 transition-colors"
                        >+ {tag.name}</button>
                      ))}
                    </div>
                  </div>
                )}
                {childSuggestions.map(tag => (
                  <button key={tag.name} type="button"
                    onClick={() => addTag(tag.name, false)}
                    className="font-mono text-[11px] px-2 py-0.5 border border-gray-700 text-gray-500 hover:border-blue-700 hover:text-blue-400 transition-colors"
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
                  className="font-mono text-[11px] px-2 py-0.5 border border-dashed border-gray-600 outline-none focus:border-blue-600 bg-transparent text-gray-300 w-36"
                />
              </div>
              {tagsToAdd.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {tagsToAdd.map(tag => {
                    const isParent = parentNames.has(tag);
                    return (
                      <span key={tag} className={`font-mono text-[11px] px-2 py-0.5 flex items-center gap-1 border ${
                        isParent
                          ? 'border-amber-700 bg-amber-700/10 text-amber-400'
                          : 'border-blue-700 bg-blue-700/10 text-blue-400'
                      }`}>
                        {tag}
                        <button onClick={() => setTagsToAdd(prev => prev.filter(t => t !== tag))} className="hover:text-red-500 leading-none">×</button>
                      </span>
                    );
                  })}
                </div>
              ) : (
                <p className="font-mono text-[10px] text-amber-500 flex items-center gap-1 border border-amber-900 bg-amber-900/10 px-2 py-1.5">
                  <AlertTriangle size={11} className="shrink-0" /> No tags selected — saving will clear all attributes.
                </p>
              )}
            </Section>

            {/* Item Type */}
            <Section title="Change Item Type" enabled={typeEnabled} onToggle={() => setTypeEnabled(v => !v)} icon={<Layers size={14} />}>
              <label className="font-mono text-[10px] tracking-[0.12em] uppercase text-gray-500 mb-1.5 block">Item Type</label>
              <div className="relative">
                <input
                  value={typeSearch}
                  onChange={(e) => { setTypeSearch(e.target.value); setTypeId(null); setTypeDropdownOpen(true); }}
                  onFocus={() => setTypeDropdownOpen(true)}
                  onBlur={() => setTimeout(() => setTypeDropdownOpen(false), 200)}
                  placeholder="e.g. Chair, Desk..."
                  className="w-full border border-gray-700 bg-gray-950 focus:border-blue-500 px-3 py-2 outline-none transition-colors text-gray-100 text-sm pr-8"
                />
                <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                {typeDropdownOpen && typeSearch && (
                  <div className="absolute z-20 w-full bg-gray-900 border border-gray-700 border-t-0 max-h-36 overflow-y-auto">
                    {filteredTypes.length > 0 ? filteredTypes.map(t => (
                      <button key={t.id} type="button"
                        onMouseDown={() => { setTypeSearch(t.name); setTypeId(t.id); setTypeDropdownOpen(false); }}
                        className="w-full text-left px-3 py-2 hover:bg-gray-800 text-gray-300 text-sm transition-colors"
                      >{t.name}</button>
                    )) : (
                      <div className="px-3 py-2 text-sm text-gray-500">
                        Create new: <span className="font-semibold text-blue-400">"{typeSearch}"</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </Section>

            {/* Quality */}
            <Section title="Reassign Quality" enabled={qualityEnabled} onToggle={() => setQualityEnabled(v => !v)} icon={<ShieldCheck size={14} />}>
              <label className="font-mono text-[10px] tracking-[0.12em] uppercase text-gray-500 mb-1.5 block">Quality</label>
              <select
                value={quality}
                onChange={(e) => setQuality(e.target.value)}
                className="w-full border border-gray-700 bg-gray-950 focus:border-blue-500 px-3 py-2 outline-none text-gray-100 text-sm appearance-none mb-2"
              >
                <option>Excellent</option>
                <option>Good</option>
                <option>Fair</option>
                <option>Poor</option>
              </select>
              <p className="font-mono text-[10px] text-amber-500 flex items-center gap-1 border border-amber-900 bg-amber-900/10 px-2 py-1.5">
                <AlertTriangle size={11} className="shrink-0" />
                Each item's full quantity is moved to this condition. Split quantities will be collapsed.
              </p>
            </Section>

            {/* Footer */}
            <div className="flex gap-2 pt-1">
              <button onClick={onClose} className="flex-1 py-2 font-mono text-[11px] tracking-wider uppercase border border-gray-700 text-gray-400 hover:text-gray-200 hover:bg-gray-800 transition-colors">
                Cancel
              </button>
              <button
                disabled={!canProceed}
                onClick={() => setStep('confirm')}
                className="flex-1 py-2 font-mono text-[11px] tracking-wider uppercase border border-blue-600 bg-blue-600/10 text-blue-400 hover:bg-blue-600/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1.5"
              >
                Review Changes
              </button>
            </div>
          </div>
        ) : step === 'confirm' ? (
          // Confirm step
          <div className="p-5 space-y-4">
            <p className="font-mono text-[10px] tracking-[0.12em] uppercase text-gray-500">
              Applying to <span className="text-gray-100">{selectedIds.length} item{selectedIds.length !== 1 ? 's' : ''}</span>:
            </p>
            <ul className="space-y-2.5 border border-gray-800 bg-gray-950 p-4">
              {summaryLines.map((line, i) => (
                <li key={i} className="flex items-start gap-2 font-mono text-[11px] text-gray-400">
                  <Check size={13} className="text-blue-400 mt-0.5 shrink-0" />
                  {line}
                </li>
              ))}
            </ul>
            <div className="flex gap-2 pt-1">
              <button onClick={() => setStep('edit')} className="flex-1 py-2 font-mono text-[11px] tracking-wider uppercase border border-gray-700 text-gray-400 hover:text-gray-200 hover:bg-gray-800 transition-colors">
                Back
              </button>
              <button
                disabled={loading}
                onClick={handleSave}
                className="flex-1 py-2 font-mono text-[11px] tracking-wider uppercase border border-blue-600 bg-blue-600/10 text-blue-400 hover:bg-blue-600/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1.5"
              >
                {loading ? 'Saving...' : <><Check size={13} /> Apply to {selectedIds.length} Items</>}
              </button>
            </div>
          </div>

        ) : step === 'asset-exists' ? (
          // Existing asset match
          <div className="p-5 space-y-4 max-h-[72vh] overflow-y-auto custom-scrollbar">
            <p className="font-mono text-[10px] tracking-[0.15em] uppercase text-amber-500">Matches existing asset</p>
            <div className="border border-amber-800 bg-amber-900/10 p-4 flex items-center gap-3">
              {matchedAsset?.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={matchedAsset.photo_url} alt={matchedAsset.name} className="w-14 h-14 object-cover shrink-0" />
              ) : (
                <div className="w-14 h-14 bg-gray-800 border border-gray-700 flex items-center justify-center shrink-0">
                  <Package size={20} className="text-amber-500" />
                </div>
              )}
              <div>
                <p className="text-sm font-medium text-gray-100">{matchedAsset?.name}</p>
                {matchedAsset?.attributes?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {matchedAsset.attributes.map((a: string) => (
                      <span key={a} className="font-mono text-[10px] px-1.5 py-0.5 border border-amber-800 text-amber-400">{a}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Photo management for existing asset */}
            {savedItems.some(i => i.photo_url) && (
              <>
                <p className="font-mono text-[10px] tracking-[0.12em] uppercase text-gray-500">Would you like to clean up individual item photos?</p>

                {/* Convert all toggle */}
                <button
                  type="button"
                  onClick={() => { setConvertAll(v => !v); setRemovePhotoIds(new Set()); }}
                  className={`w-full flex items-center gap-3 px-4 py-3 border text-sm transition-all ${
                    convertAll
                      ? 'border-blue-600 bg-blue-600/10 text-blue-300'
                      : 'border-gray-700 text-gray-400 hover:border-blue-800'
                  }`}
                >
                  <span className={`inline-block w-3 h-3 border shrink-0 transition-colors ${convertAll ? 'border-blue-500 bg-blue-500' : 'border-gray-600'}`} />
                  <div className="text-left">
                    <p className="leading-none font-mono text-[11px] tracking-wider uppercase">Convert all to asset image</p>
                    <p className="text-[11px] text-gray-500 mt-0.5 font-normal">Replace every item photo with the asset representative above</p>
                  </div>
                </button>

                {/* Individual checkboxes when convert-all is off */}
                {!convertAll && (
                  <div className="grid grid-cols-3 gap-2">
                    {savedItems.filter(i => i.photo_url).map(item => {
                      const willRemove = removePhotoIds.has(item.id);
                      return (
                        <div key={item.id} className="relative border-2 border-gray-700 overflow-hidden transition-all">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={item.photo_url} alt="" className="w-full h-20 object-cover" />
                          <div className="p-1.5 bg-gray-900">
                            <button
                              type="button"
                              onClick={() => {
                                setRemovePhotoIds(prev => {
                                  const next = new Set(prev);
                                  next.has(item.id) ? next.delete(item.id) : next.add(item.id);
                                  return next;
                                });
                              }}
                              className="flex items-center gap-1.5 w-full cursor-pointer"
                            >
                              <div className={`w-3.5 h-3.5 border flex items-center justify-center shrink-0 transition-colors ${
                                willRemove ? 'bg-blue-500 border-blue-500' : 'border-gray-500 bg-gray-800'
                              }`}>
                                {willRemove && <Check size={9} className="text-white" />}
                              </div>
                              <span className="text-[10px] text-gray-400 leading-tight">Remove from item</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {(convertAll || removePhotoIds.size > 0) && (
                  <p className="font-mono text-[10px] text-amber-500 flex items-center gap-1 border border-amber-900 bg-amber-900/10 px-2 py-1.5">
                    <AlertTriangle size={11} className="shrink-0" />
                    {convertAll
                      ? 'All item photos will be permanently replaced with the asset image.'
                      : 'Removing a photo from an item is permanent.'}
                  </p>
                )}
              </>
            )}

            <div className="flex gap-2 pt-1">
              <button onClick={onClose} className="flex-1 py-2 font-mono text-[11px] tracking-wider uppercase border border-gray-700 text-gray-400 hover:text-gray-200 hover:bg-gray-800 transition-colors">
                Skip
              </button>
              <button
                disabled={assetLoading}
                onClick={handleExistingAssetDone}
                className="flex-1 py-2 font-mono text-[11px] tracking-wider uppercase border border-blue-600 bg-blue-600/10 text-blue-400 hover:bg-blue-600/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1.5"
              >
                {assetLoading ? 'Applying...' : <><Check size={13} /> Done</>}
              </button>
            </div>
          </div>

        ) : (
          // Pick photo step
          <div className="p-5 space-y-4 max-h-[72vh] overflow-y-auto custom-scrollbar">
            <div>
              <p className="font-mono text-[10px] tracking-[0.15em] uppercase text-blue-400 mb-0.5">Create Reusable Asset</p>
              <p className="text-sm text-gray-400">
                All {savedCount} items now share the same type and attributes. Pick a photo to represent <span className="font-medium text-gray-200">{postSaveTypeName}</span> as an asset.
              </p>
            </div>

            {savedItems.some(i => i.photo_url) ? (
              <>
                {/* Photo grid — radio select for representative */}
                <div className="grid grid-cols-3 gap-2">
                  {savedItems.filter(i => i.photo_url).map(item => {
                    const isSelected = selectedPhotoItemId === item.id;
                    const willRemove = removePhotoIds.has(item.id);
                    const isRep = isSelected;
                    return (
                      <div key={item.id} className={`relative border-2 overflow-hidden transition-all ${
                        isSelected ? 'border-blue-500' : 'border-gray-700'
                      }`}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={item.photo_url}
                          alt=""
                          className="w-full h-20 object-cover cursor-pointer"
                          onClick={() => setSelectedPhotoItemId(item.id)}
                        />
                        {isSelected && (
                          <div className="absolute top-1 left-1 w-5 h-5 bg-blue-500 flex items-center justify-center">
                            <Check size={11} className="text-white" />
                          </div>
                        )}
                        {/* Per-item remove checkbox — only shown when convertAll is off */}
                        {!convertAll && (
                          <div className="p-1.5 bg-gray-900">
                            <button
                              type="button"
                              disabled={isRep}
                              onClick={() => {
                                if (isRep) return;
                                setRemovePhotoIds(prev => {
                                  const next = new Set(prev);
                                  next.has(item.id) ? next.delete(item.id) : next.add(item.id);
                                  return next;
                                });
                              }}
                              className={`flex items-center gap-1.5 w-full ${isRep ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}`}
                            >
                              <div className={`w-3.5 h-3.5 border flex items-center justify-center shrink-0 transition-colors ${
                                willRemove && !isRep
                                  ? 'bg-blue-500 border-blue-500'
                                  : 'border-gray-500 bg-gray-800'
                              }`}>
                                {willRemove && !isRep && <Check size={9} className="text-white" />}
                              </div>
                              <span className="text-[10px] text-gray-400 leading-tight">Remove from item</span>
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Convert all toggle — primary mass action */}
                <button
                  type="button"
                  onClick={() => { setConvertAll(v => !v); setRemovePhotoIds(new Set()); }}
                  className={`w-full flex items-center gap-3 px-4 py-3 border text-sm transition-all ${
                    convertAll
                      ? 'border-blue-600 bg-blue-600/10 text-blue-300'
                      : 'border-gray-700 text-gray-400 hover:border-blue-800'
                  }`}
                >
                  <span className={`inline-block w-3 h-3 border shrink-0 transition-colors ${convertAll ? 'border-blue-500 bg-blue-500' : 'border-gray-600'}`} />
                  <div className="text-left">
                    <p className="leading-none font-mono text-[11px] tracking-wider uppercase">Convert all to asset image</p>
                    <p className="text-[11px] text-gray-500 mt-0.5 font-normal">Replace every other item photo with the representative above</p>
                  </div>
                </button>

                {(convertAll || removePhotoIds.size > 0) && (
                  <p className="font-mono text-[10px] text-amber-500 flex items-center gap-1 border border-amber-900 bg-amber-900/10 px-2 py-1.5">
                    <AlertTriangle size={11} className="shrink-0" />
                    {convertAll
                      ? 'All other item photos will be permanently replaced with the asset image.'
                      : 'Removing a photo from an item is permanent.'}
                  </p>
                )}
              </>
            ) : (
              <p className="font-mono text-[11px] text-gray-500">No photos available — asset will be created without one.</p>
            )}

            <div className="flex gap-2 pt-1">
              <button
                onClick={onClose}
                className="flex-1 py-2 font-mono text-[11px] tracking-wider uppercase border border-gray-700 text-gray-400 hover:text-gray-200 hover:bg-gray-800 transition-colors"
              >
                Skip
              </button>
              <button
                disabled={assetLoading}
                onClick={handleCreateAsset}
                className="flex-1 py-2 font-mono text-[11px] tracking-wider uppercase border border-blue-600 bg-blue-600/10 text-blue-400 hover:bg-blue-600/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1.5"
              >
                {assetLoading ? 'Creating...' : <><Check size={13} /> Create Asset</>}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '@/lib/supabase';
import { saveAssetIfNew } from '@/lib/saveAsset';
import { useProjectId } from '@/lib/ProjectContext';
import { X, Check, Tag, ChevronDown, SplitSquareVertical, Info, Package } from 'lucide-react';

export default function EditItemModal({ item, onClose, onSaved }: {
  item: any;
  onClose: () => void;
  onSaved: () => void;
}) {
  const projectId = useProjectId();
  const [loading, setLoading] = useState(false);

  // Auto-complete Types state
  const [itemTypes, setItemTypes] = useState<any[]>([]);
  const [typeSearch, setTypeSearch] = useState(item.ItemTypes?.name || '');
  const [isTypeDropdownOpen, setIsTypeDropdownOpen] = useState(false);
  const typeInputRef = useRef<HTMLInputElement>(null);

  // Tags State
  const [availableTags, setAvailableTags] = useState<any[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>(item.attributes || []);
  const [tagSearch, setTagSearch] = useState('');
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [newTagInput, setNewTagInput] = useState('');
  const newTagInputRef = useRef<HTMLInputElement>(null);
  const [isAddingGroup, setIsAddingGroup] = useState(false);
  const [newGroupInput, setNewGroupInput] = useState('');
  const newGroupInputRef = useRef<HTMLInputElement>(null);

  const [matchedAsset, setMatchedAsset] = useState<any>(null);
  const [pendingTypeId, setPendingTypeId] = useState<string | null>(null);

  // Quantities & Qualities State — derive from saved data
  const [isSplit, setIsSplit] = useState(false);
  const [totalQuantity, setTotalQuantity] = useState(1);
  const [globalQuality, setGlobalQuality] = useState('Good');
  const [isConditionOpen, setIsConditionOpen] = useState(false);
  const [splitQty, setSplitQty] = useState({ Excellent: 0, Good: 1, Fair: 0, Poor: 0 });

  const [notes, setNotes] = useState(item.notes || '');
  const [saveAsAsset, setSaveAsAsset] = useState(false);

  // Initialise quantity/quality state from saved item
  useEffect(() => {
    const e = item.qty_excellent || 0;
    const g = item.qty_good || 0;
    const f = item.qty_fair || 0;
    const p = item.qty_poor || 0;
    const total = e + g + f + p;
    setTotalQuantity(total || 1);
    setSplitQty({ Excellent: e, Good: g, Fair: f, Poor: p });

    const nonZero = [
      e > 0 && 'Excellent',
      g > 0 && 'Good',
      f > 0 && 'Fair',
      p > 0 && 'Poor',
    ].filter(Boolean) as string[];

    if (nonZero.length <= 1) {
      setIsSplit(false);
      setGlobalQuality(nonZero[0] || 'Good');
    } else {
      setIsSplit(true);
    }
  }, [item]);

  useEffect(() => {
    fetchTypes();
    // Fetch attributes immediately using the known item_type_id — don't wait for itemTypes to load
    if (item.item_type_id) {
      supabase.from('ItemTypeAttributes').select('*').eq('item_type_id', item.item_type_id)
        .then(({ data }) => { if (data) applyTags(data); });
    }
  }, []);

  useEffect(() => {
    if (isAddingTag && newTagInputRef.current) {
      newTagInputRef.current.focus();
    }
  }, [isAddingTag]);

  useEffect(() => {
    if (isAddingGroup && newGroupInputRef.current) {
      newGroupInputRef.current.focus();
    }
  }, [isAddingGroup]);

  useEffect(() => {
    setTagSearch('');
    if (typeSearch) {
      fetchTagsForType(typeSearch);
    } else {
      setAvailableTags([]);
    }
  }, [typeSearch, itemTypes]);

  // Reactively check for a matching asset as type/attributes change
  useEffect(() => {
    setMatchedAsset(null);
    setPendingTypeId(null);
    const existingType = itemTypes.find(t => t.name.toLowerCase() === typeSearch.toLowerCase());
    if (!existingType || selectedTags.length === 0) return;
    const sorted = [...selectedTags].sort();
    const timer = setTimeout(async () => {
      const { data: assets } = await supabase.from('Assets').select('*').eq('item_type_id', existingType.id);
      const match = assets?.find(a =>
        JSON.stringify([...(a.attributes || [])].sort()) === JSON.stringify(sorted)
      );
      if (match && match.photo_url !== item.photo_url) {
        setPendingTypeId(existingType.id);
        setMatchedAsset(match);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [typeSearch, selectedTags, itemTypes]);

  const fetchTypes = async () => {
    const { data } = await supabase.from('ItemTypes').select('*').order('name');
    if (data) setItemTypes(data);
  };

  const applyTags = (tags: any[]) => {
    setAvailableTags(tags);
    // Enforce radio: if more than one parent is selected, keep only the last one
    const parentNames = new Set(tags.filter((t: any) => t.is_parent).map((t: any) => t.name));
    setSelectedTags(prev => {
      const selectedParents = prev.filter(t => parentNames.has(t));
      if (selectedParents.length <= 1) return prev;
      return [...prev.filter(t => !parentNames.has(t)), selectedParents[selectedParents.length - 1]];
    });
  };

  const fetchTagsForType = async (typeName: string) => {
    const existingType = itemTypes.find(t => t.name.toLowerCase() === typeName.toLowerCase());
    if (existingType) {
      const { data } = await supabase
        .from('ItemTypeAttributes')
        .select('*')
        .eq('item_type_id', existingType.id);
      if (data) applyTags(data);
    } else {
      setAvailableTags([]);
    }
  };

  const toggleTag = (tagName: string) => {
    const tag = availableTags.find((t: any) => t.name === tagName);
    const isParent = tag?.is_parent ?? false;
    if (selectedTags.includes(tagName)) {
      setSelectedTags(prev => prev.filter(t => t !== tagName));
    } else if (isParent) {
      const parentNames = new Set(availableTags.filter((t: any) => t.is_parent).map((t: any) => t.name));
      setSelectedTags(prev => [...prev.filter(t => !parentNames.has(t)), tagName]);
    } else {
      setSelectedTags(prev => [...prev, tagName]);
    }
  };

  const handleAddGroup = (name: string) => {
    const cleanName = name.trim();
    if (!cleanName) { setIsAddingGroup(false); return; }
    // Track as group tag locally so display is correct and submit can persist with is_parent: true
    const parentNamesSet = new Set([
      ...availableTags.filter((t: any) => t.is_parent).map((t: any) => t.name),
      cleanName,
    ]);
    setAvailableTags(prev =>
      prev.some((t: any) => t.name.toLowerCase() === cleanName.toLowerCase() && t.is_parent)
        ? prev
        : [...prev.filter((t: any) => t.name.toLowerCase() !== cleanName.toLowerCase()), { name: cleanName, is_parent: true }]
    );
    setSelectedTags(prev => [...prev.filter(t => !parentNamesSet.has(t)), cleanName]);
    setNewGroupInput('');
    setIsAddingGroup(false);
  };

  const handleAddNewTag = (name: string) => {
    const cleanName = name.trim();
    if (!cleanName) { setIsAddingTag(false); return; }
    if (!selectedTags.includes(cleanName)) {
      setSelectedTags(prev => [...prev, cleanName]);
    }
    setNewTagInput('');
    setIsAddingTag(false);
  };

  const toTitleCase = (str: string) => str.replace(/\b\w/g, c => c.toUpperCase());

  const handleTypeKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      setTypeSearch(toTitleCase(typeSearch));
      setIsTypeDropdownOpen(false);
      typeInputRef.current?.blur();
    } else if (e.key === 'Tab' && filteredTypes.length > 0) {
      const exactMatch = filteredTypes.find(t => t.name.toLowerCase() === typeSearch.toLowerCase());
      if (!exactMatch) {
        e.preventDefault();
        setTypeSearch(filteredTypes[0].name);
        setIsTypeDropdownOpen(false);
      }
    } else if (e.key === 'Escape') {
      setIsTypeDropdownOpen(false);
    }
  };

  const handleToggleSplit = () => {
    if (!isSplit) {
      setSplitQty({
        Excellent: globalQuality === 'Excellent' ? totalQuantity : 0,
        Good:      globalQuality === 'Good'      ? totalQuantity : 0,
        Fair:      globalQuality === 'Fair'      ? totalQuantity : 0,
        Poor:      globalQuality === 'Poor'      ? totalQuantity : 0,
      });
    }
    setIsSplit(!isSplit);
  };

  const currentSplitTotal = Object.values(splitQty).reduce((sum, val) => sum + val, 0);

  const handleSplitChange = (quality: keyof typeof splitQty, newValue: number) => {
    if (isNaN(newValue)) return;
    const val = Math.max(0, newValue);
    setSplitQty(prev => {
      const primaryBin = globalQuality as keyof typeof splitQty;
      const otherBinsSum = Object.entries(prev)
        .filter(([key]) => key !== quality && key !== primaryBin)
        .reduce((sum, [, v]) => sum + v, 0);
      if (quality === primaryBin) {
        return { ...prev, [primaryBin]: Math.min(val, Math.max(0, totalQuantity - otherBinsSum)) };
      }
      const safeVal = Math.min(val, Math.max(0, totalQuantity - otherBinsSum));
      return { ...prev, [quality]: safeVal, [primaryBin]: Math.max(0, totalQuantity - otherBinsSum - safeVal) };
    });
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (matchedAsset) return;
    if (!typeSearch.trim()) return alert('Please enter an Item Type');
    if (isSplit && currentSplitTotal !== totalQuantity) {
      return alert(`Split quantities (${currentSplitTotal}) must equal Total Quantity (${totalQuantity}).`);
    }

    setLoading(true);
    try {
      // 1. Resolve ItemType
      const typeName = toTitleCase(typeSearch.trim());
      let itemTypeId: string;

      const { data: existingType } = await supabase
        .from('ItemTypes')
        .select('id')
        .ilike('name', typeName)
        .maybeSingle();

      if (existingType) {
        itemTypeId = existingType.id;
      } else {
        const { data: newType, error: typeError } = await supabase
          .from('ItemTypes')
          .insert([{ name: typeName, project_id: projectId }])
          .select()
          .single();
        if (typeError) throw typeError;
        itemTypeId = newType.id;
      }

      // 2. Upsert any new tags for this type
      for (const tagName of selectedTags) {
        const isParent = availableTags.find((t: any) => t.name === tagName)?.is_parent ?? false;
        await supabase.from('ItemTypeAttributes').upsert(
          { item_type_id: itemTypeId, name: tagName, is_parent: isParent },
          { onConflict: 'item_type_id,name' as any }
        );
      }

      // 3. Update InventoryItem
      const { error } = await supabase.from('InventoryItems').update({
        item_type_id: itemTypeId,
        qty_excellent: isSplit ? splitQty.Excellent : (globalQuality === 'Excellent' ? totalQuantity : 0),
        qty_good:      isSplit ? splitQty.Good      : (globalQuality === 'Good'      ? totalQuantity : 0),
        qty_fair:      isSplit ? splitQty.Fair      : (globalQuality === 'Fair'      ? totalQuantity : 0),
        qty_poor:      isSplit ? splitQty.Poor      : (globalQuality === 'Poor'      ? totalQuantity : 0),
        attributes: selectedTags,
        notes: notes.trim(),
      }).eq('id', item.id);
      if (error) throw error;

      // Optionally save as a reusable asset
      if (saveAsAsset) {
        const result = await saveAssetIfNew({
          name:         typeName,
          item_type_id: itemTypeId,
          photo_url:    item.photo_url,
          attributes:   selectedTags,
          notes:        notes.trim(),
          project_id:   projectId!,
        });
        if (result.status === 'duplicate') {
          alert(`An asset for "${typeName}" with these attributes already exists.`);
        } else if (result.assetPhotoUrl && result.assetPhotoUrl !== item.photo_url) {
          // Point the item at the asset's copy so it won't lose its photo if the original file is cleaned up
          await supabase.from('InventoryItems').update({ photo_url: result.assetPhotoUrl }).eq('id', item.id);
        }
      }

      onSaved();
      onClose();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredTypes = itemTypes.filter(t =>
    t.name.toLowerCase().includes(typeSearch.toLowerCase())
  );

  return createPortal(
    <div className="fixed inset-0 bg-black/60 z-[10000] flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-gray-900 w-full max-w-4xl overflow-hidden flex flex-col md:flex-row border border-gray-700 my-8 surface-raised">

        {/* Left Panel */}
        <div className="w-full md:w-[45%] bg-gray-950 flex flex-col justify-center border-b md:border-b-0 md:border-r border-gray-800 relative overflow-hidden">

          <div className="px-7 pt-8 pb-5">
            <p className="font-mono text-[10px] tracking-[0.18em] uppercase text-gray-500 mb-1">Editing Item</p>
            <p className="text-xl font-semibold text-blue-400">{item.ItemTypes?.name || 'Unknown Type'}</p>
          </div>

          <div className="border-t border-gray-800 border-b overflow-hidden">
            {item.photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.photo_url}
                className="w-full h-auto object-cover max-h-72"
                alt="Item"
              />
            ) : (
              <div className="w-full h-48 bg-gray-900 flex items-center justify-center">
                <Package size={40} className="text-gray-700" />
              </div>
            )}
          </div>
        </div>

        {/* Right Panel */}
        <div className="w-full md:w-[55%] flex flex-col bg-gray-900 h-full max-h-[85vh] overflow-y-auto custom-scrollbar relative">

          {/* Sticky Header */}
          <div className="flex justify-between items-center sticky top-0 bg-gray-900 px-7 pt-6 pb-4 border-b border-gray-800 z-10 mb-5">
            <div>
              <p className="font-mono text-[10px] tracking-[0.18em] uppercase text-gray-500 mb-1">Edit Item</p>
              <h2 className="text-lg font-semibold text-gray-100">Update Details</h2>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-gray-600 hover:text-gray-200 hover:bg-gray-800 border border-transparent hover:border-gray-700 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          <form onSubmit={handleSubmit} onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }} className="flex-1 flex flex-col space-y-5 px-7 pb-7">

            {/* Type Autocomplete */}
            <div className="relative">
              <label className="block font-mono text-[10px] tracking-[0.15em] uppercase text-gray-500 mb-1.5">Item Type</label>
              <div className="relative">
                <input
                  ref={typeInputRef}
                  value={typeSearch}
                  onChange={(e) => {
                    setTypeSearch(e.target.value);
                    setIsTypeDropdownOpen(true);
                  }}
                  onKeyDown={handleTypeKeyDown}
                  onFocus={() => setIsTypeDropdownOpen(true)}
                  onBlur={() => setTimeout(() => setIsTypeDropdownOpen(false), 150)}
                  placeholder="e.g. Chair, Desk, Monitor"
                  required
                  className="w-full border border-gray-700 bg-gray-950 focus:border-blue-500 px-3 py-2.5 outline-none transition-colors text-gray-100 text-sm placeholder:text-gray-700 pr-8"
                />
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 pointer-events-none" size={16} />
              </div>

              {isTypeDropdownOpen && (
                <div className="absolute z-20 w-full bg-gray-900 border border-gray-700 border-t-0 max-h-48 overflow-y-auto top-full custom-scrollbar">
                  {filteredTypes.length > 0 ? (
                    filteredTypes.map(t => (
                      <button
                        key={t.id}
                        type="button"
                        className="w-full text-left px-3 py-2 hover:bg-gray-800 text-gray-300 text-sm transition-colors border-b border-gray-800 last:border-0"
                        onMouseDown={() => {
                          setTypeSearch(t.name);
                          setIsTypeDropdownOpen(false);
                        }}
                      >
                        {t.name}
                      </button>
                    ))
                  ) : typeSearch ? (
                    <div className="font-mono text-[11px] text-gray-500 px-3 py-2">
                      Create new type: &ldquo;{typeSearch}&rdquo;
                    </div>
                  ) : null}
                </div>
              )}
            </div>

            {/* Tags / Attributes */}
            <div>
              <label className="block font-mono text-[10px] tracking-[0.15em] uppercase text-gray-500 mb-1.5">Attributes</label>

              {availableTags.length > 5 && (
                <input
                  value={tagSearch}
                  onChange={(e) => setTagSearch(e.target.value)}
                  placeholder="Filter attributes..."
                  className="w-full mb-2 border border-gray-700 bg-gray-950 focus:border-blue-500 px-3 py-2.5 outline-none transition-colors text-gray-100 text-sm placeholder:text-gray-700"
                />
              )}

              {/* Group Section (amber, radio — pick one) */}
              <div className="flex items-start gap-2 mb-2">
                  <span className="font-mono text-[9px] tracking-[0.12em] uppercase text-amber-600/70 shrink-0 pt-1 w-10">Group</span>
                  <div className="flex flex-wrap gap-1.5 items-center flex-1">
                    {availableTags.filter((t: any) => t.is_parent && (!tagSearch || t.name.toLowerCase().includes(tagSearch.toLowerCase()))).map((tag: any) => {
                      const isSelected = selectedTags.includes(tag.name);
                      return (
                        <button key={tag.id ?? tag.name} type="button" onClick={() => toggleTag(tag.name)}
                          className={isSelected
                            ? 'flex items-center gap-1 font-mono text-[10px] px-2 py-0.5 border border-amber-600 bg-amber-600/10 text-amber-400'
                            : 'font-mono text-[10px] px-2 py-0.5 border border-gray-700 text-gray-500 hover:border-amber-700 hover:text-amber-400 transition-colors'
                          }>
                          {isSelected && <Check size={9} />}
                          {tag.name}
                        </button>
                      );
                    })}
                    {isAddingGroup ? (
                      <input
                        ref={newGroupInputRef}
                        value={newGroupInput}
                        onChange={(e) => setNewGroupInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); handleAddGroup(newGroupInput); }
                          else if (e.key === 'Escape') { setIsAddingGroup(false); setNewGroupInput(''); }
                        }}
                        onBlur={() => { setIsAddingGroup(false); setNewGroupInput(''); }}
                        placeholder="Group name..."
                        className="font-mono text-[10px] border border-amber-700 bg-gray-950 focus:border-amber-500 px-2 py-0.5 outline-none text-amber-400 placeholder:text-amber-900 w-32"
                      />
                    ) : (
                      <button type="button" onClick={() => setIsAddingGroup(true)}
                        className="font-mono text-[10px] px-2 py-0.5 border border-dashed border-amber-800 text-amber-700 hover:border-amber-600 hover:text-amber-500 transition-colors"
                        title="Add group">+
                      </button>
                    )}
                  </div>
                </div>

              {/* Tags Section (blue, multi-select) */}
              <div className="flex items-start gap-2">
                <span className="font-mono text-[9px] tracking-[0.12em] uppercase text-blue-600/70 shrink-0 pt-1 w-10">Tags</span>
                <div className="flex-1">
                  <div className="flex flex-wrap gap-1.5 mb-1.5 items-center">
                    {availableTags.filter((t: any) => !t.is_parent && !selectedTags.includes(t.name) && (!tagSearch || t.name.toLowerCase().includes(tagSearch.toLowerCase()))).map((tag: any) => (
                      <button key={tag.id} type="button" onClick={() => toggleTag(tag.name)}
                        className="font-mono text-[10px] px-2 py-0.5 border border-gray-700 text-gray-500 hover:border-blue-700 hover:text-blue-400 transition-colors">
                        {tag.name}
                      </button>
                    ))}
                    {isAddingTag ? (
                      <input
                        ref={newTagInputRef}
                        value={newTagInput}
                        onChange={(e) => setNewTagInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); handleAddNewTag(newTagInput); }
                          else if (e.key === 'Escape') { setIsAddingTag(false); setNewTagInput(''); }
                        }}
                        onBlur={() => setIsAddingTag(false)}
                        placeholder="Tag name..."
                        className="font-mono text-[10px] border border-blue-700 bg-gray-950 focus:border-blue-500 px-2 py-0.5 outline-none text-blue-400 placeholder:text-blue-900 w-32"
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => setIsAddingTag(true)}
                        className="font-mono text-[10px] px-2 py-0.5 border border-dashed border-blue-800 text-blue-700 hover:border-blue-600 hover:text-blue-500 transition-colors"
                        title="Add tag"
                      >
                        +
                      </button>
                    )}
                  </div>

                  {/* Selected Tags Box */}
                  <div className="flex flex-wrap gap-1.5 min-h-[28px] p-1.5 border border-gray-800 bg-gray-950">
                    {selectedTags.filter(st => !availableTags.find((t: any) => t.name === st)?.is_parent).length === 0 ? (
                      <span className="font-mono text-[10px] text-gray-700 p-0.5">No tags selected...</span>
                    ) : (
                      selectedTags
                        .filter(st => !availableTags.find((t: any) => t.name === st)?.is_parent)
                        .map(st => (
                          <button key={st} type="button" onClick={() => toggleTag(st)}
                            className="flex items-center gap-1 font-mono text-[10px] px-2 py-0.5 border border-blue-700 bg-blue-700/10 text-blue-400 hover:border-red-700 hover:bg-red-900/10 hover:text-red-400 transition-colors">
                            {st}
                            <X size={9} />
                          </button>
                        ))
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Quantity and Quality */}
            <div className="border border-gray-800 bg-gray-950/50 p-4">
              <div className="flex items-end gap-3 mb-3">
                <div className="w-1/3">
                  <label className="block font-mono text-[10px] tracking-[0.15em] uppercase text-gray-500 mb-1.5">Total Qty</label>
                  <input
                    type="number"
                    min="1"
                    value={totalQuantity || ''}
                    onChange={(e) => setTotalQuantity(parseInt(e.target.value) || 0)}
                    onBlur={() => { if (!totalQuantity || totalQuantity < 1) setTotalQuantity(1); }}
                    className="w-full border border-gray-700 bg-gray-950 focus:border-blue-500 px-3 py-2.5 outline-none transition-colors text-gray-100 text-sm placeholder:text-gray-700"
                  />
                </div>

                {!isSplit && (
                  <div className="flex-1">
                    <label className="block font-mono text-[10px] tracking-[0.15em] uppercase text-gray-500 mb-1.5">Condition</label>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setIsConditionOpen(v => !v)}
                        onBlur={() => setTimeout(() => setIsConditionOpen(false), 150)}
                        className="w-full border border-gray-700 bg-gray-950 focus:border-blue-500 px-3 py-2.5 pr-8 outline-none transition-colors text-gray-100 text-sm text-left cursor-pointer"
                      >
                        {globalQuality}
                      </button>
                      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-600 pointer-events-none" size={14} />
                      {isConditionOpen && (
                        <div className="absolute z-20 w-full bg-gray-900 border border-gray-700 border-t-0 top-full">
                          {(['Excellent', 'Good', 'Fair', 'Poor'] as const).map(q => (
                            <button
                              key={q}
                              type="button"
                              onMouseDown={() => { setGlobalQuality(q); setIsConditionOpen(false); }}
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
                <div className="pt-3 border-t border-gray-800">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-[10px] text-gray-600">Allocate {totalQuantity} items by condition:</span>
                    <span className={`font-mono text-[10px] px-2 py-0.5 border ${
                      currentSplitTotal === totalQuantity
                        ? 'border-green-700 text-green-400'
                        : 'border-red-700 text-red-400'
                    }`}>
                      {currentSplitTotal} / {totalQuantity}
                    </span>
                  </div>

                  <div className="grid grid-cols-4 gap-2">
                    {(['Excellent', 'Good', 'Fair', 'Poor'] as const).map((q) => (
                      <div key={q} className="border border-gray-800 bg-gray-900 p-2 flex flex-col items-center gap-1">
                        <label className={`font-mono text-[10px] uppercase tracking-wider ${
                          q === 'Excellent' ? 'text-green-400' :
                          q === 'Good' ? 'text-blue-400' :
                          q === 'Fair' ? 'text-yellow-500' : 'text-red-400'
                        }`}>{q}</label>
                        <input
                          type="number"
                          min="0"
                          value={splitQty[q]}
                          onChange={(e) => handleSplitChange(q, parseInt(e.target.value) || 0)}
                          className="w-full text-center text-base font-semibold border border-gray-700 bg-gray-950 focus:border-blue-500 outline-none py-1 text-gray-100"
                        />
                      </div>
                    ))}
                  </div>

                  {currentSplitTotal !== totalQuantity && (
                    <p className="font-mono text-[10px] text-red-400 mt-2 flex items-center gap-1">
                      <Info size={11} /> Quantities must sum to {totalQuantity}.
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Notes */}
            <div>
              <label className="block font-mono text-[10px] tracking-[0.15em] uppercase text-gray-500 mb-1.5">Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Details on condition, manufacturer info, etc..."
                className="w-full h-20 border border-gray-700 bg-gray-950 focus:border-blue-500 px-3 py-2 outline-none resize-none text-gray-100 text-sm placeholder:text-gray-700 custom-scrollbar"
              />
            </div>

            {/* Matched asset warning */}
            {matchedAsset && (
              <div className="border border-amber-800 bg-amber-900/10 overflow-hidden">
                <div className="flex min-h-[100px]">
                  <div className="w-28 shrink-0 relative bg-gray-900">
                    {matchedAsset.photo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={matchedAsset.photo_url} alt={matchedAsset.name} className="absolute inset-0 w-full h-full object-cover" />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Package size={24} className="text-amber-700" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 p-3 flex flex-col gap-2 min-w-0">
                    <div>
                      <p className="font-mono text-[9px] tracking-[0.15em] uppercase text-amber-500 mb-1">Existing asset matches</p>
                      <p className="text-sm font-semibold text-gray-100 truncate">{matchedAsset.name}</p>
                      {matchedAsset.attributes?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {[...matchedAsset.attributes].sort((a: string, b: string) => {
                            const aP = availableTags.find((t: any) => t.name === a)?.is_parent ?? false;
                            const bP = availableTags.find((t: any) => t.name === b)?.is_parent ?? false;
                            if (aP !== bP) return aP ? -1 : 1;
                            return a.localeCompare(b);
                          }).map((a: string) => {
                            const isParent = availableTags.find((t: any) => t.name === a)?.is_parent ?? false;
                            return (
                              <span key={a} className={`font-mono text-[10px] px-1.5 py-0.5 border ${
                                isParent
                                  ? 'border-amber-700 bg-amber-900/20 text-amber-400'
                                  : 'border-blue-800 bg-blue-900/20 text-blue-400'
                              }`}>{a}</span>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2 mt-auto">
                      <button
                        type="button"
                        onClick={async () => {
                          setLoading(true);
                          try {
                            const oldPhotoUrl = item.photo_url;
                            // Update item with asset identity + current form quantities/notes
                            const { error } = await supabase.from('InventoryItems').update({
                              photo_url:     matchedAsset.photo_url,
                              item_type_id:  matchedAsset.item_type_id,
                              attributes:    matchedAsset.attributes || [],
                              qty_excellent: isSplit ? splitQty.Excellent : (globalQuality === 'Excellent' ? totalQuantity : 0),
                              qty_good:      isSplit ? splitQty.Good      : (globalQuality === 'Good'      ? totalQuantity : 0),
                              qty_fair:      isSplit ? splitQty.Fair      : (globalQuality === 'Fair'      ? totalQuantity : 0),
                              qty_poor:      isSplit ? splitQty.Poor      : (globalQuality === 'Poor'      ? totalQuantity : 0),
                              notes:         notes.trim(),
                            }).eq('id', item.id);
                            if (error) throw error;
                            // Delete old photo from storage if it wasn't already an asset photo
                            if (oldPhotoUrl) {
                              const marker = '/inventory_photos/';
                              const idx = oldPhotoUrl.indexOf(marker);
                              const filePath = idx !== -1 ? oldPhotoUrl.slice(idx + marker.length) : null;
                              if (filePath && !filePath.startsWith('assets/')) {
                                const { count } = await supabase
                                  .from('InventoryItems')
                                  .select('id', { count: 'exact', head: true })
                                  .eq('photo_url', oldPhotoUrl);
                                if ((count ?? 1) === 0) {
                                  await supabase.storage.from('inventory_photos').remove([filePath]);
                                }
                              }
                            }
                            onSaved();
                            onClose();
                          } catch (err: any) {
                            alert(err.message);
                            setLoading(false);
                          }
                        }}
                        className="flex-1 py-1.5 font-mono text-[10px] tracking-wider uppercase border border-amber-600 bg-amber-600/10 text-amber-400 hover:bg-amber-600/20 transition-colors"
                      >
                        Use Asset
                      </button>
                      <button
                        type="button"
                        onClick={() => setMatchedAsset(null)}
                        className="flex-1 py-1.5 font-mono text-[10px] tracking-wider uppercase border border-gray-700 text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-colors"
                      >
                        Keep My Image
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Save as asset toggle */}
            <div className="mt-auto">
              <button
                type="button"
                onClick={() => setSaveAsAsset(v => !v)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 border text-sm font-medium transition-all mb-3 ${
                  saveAsAsset
                    ? 'border-amber-700 bg-amber-900/10 text-amber-400'
                    : 'border-gray-700 text-gray-500 hover:border-amber-800 hover:text-amber-600'
                }`}
              >
                <span className={`inline-block w-3 h-3 border transition-colors ${saveAsAsset ? 'border-amber-500 bg-amber-500' : 'border-gray-600'}`} />
                <span className="font-mono text-[10px] tracking-wider uppercase">{saveAsAsset ? 'Will save as reusable asset' : 'Save as reusable asset'}</span>
              </button>

              <button
                disabled={loading || (isSplit && currentSplitTotal !== totalQuantity) || !!matchedAsset}
                type="submit"
                className="w-full border border-blue-600 bg-blue-600/10 text-blue-400 hover:bg-blue-600/20 font-mono text-[11px] tracking-wider uppercase py-3 flex justify-center items-center gap-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Saving...
                  </>
                ) : (
                  <><Check size={14} /> Save Changes</>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>,
    document.body
  );
}

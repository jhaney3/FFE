'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '@/lib/supabase';
import { saveAssetIfNew } from '@/lib/saveAsset';
import { X, Check, Tag, ChevronDown, SplitSquareVertical, Info, Package, Bookmark } from 'lucide-react';

export default function EditItemModal({ item, onClose, onSaved }: {
  item: any;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [loading, setLoading] = useState(false);

  // Auto-complete Types state
  const [itemTypes, setItemTypes] = useState<any[]>([]);
  const [typeSearch, setTypeSearch] = useState(item.ItemTypes?.name || '');
  const [isTypeDropdownOpen, setIsTypeDropdownOpen] = useState(false);
  const typeInputRef = useRef<HTMLInputElement>(null);

  // Tags State
  const [availableTags, setAvailableTags] = useState<any[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>(item.attributes || []);
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [newTagInput, setNewTagInput] = useState('');
  const newTagInputRef = useRef<HTMLInputElement>(null);

  // Quantities & Qualities State — derive from saved data
  const [isSplit, setIsSplit] = useState(false);
  const [totalQuantity, setTotalQuantity] = useState(1);
  const [globalQuality, setGlobalQuality] = useState('Good');
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
    if (typeSearch) {
      fetchTagsForType(typeSearch);
    } else {
      setAvailableTags([]);
    }
  }, [typeSearch, itemTypes]);

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

  const toggleIsParent = async (tag: any) => {
    const promoting = !tag.is_parent;
    await supabase.from('ItemTypeAttributes').update({ is_parent: promoting }).eq('id', tag.id);

    if (promoting) {
      const existingParentNames = availableTags
        .filter((t: any) => t.is_parent && t.name !== tag.name)
        .map((t: any) => t.name);
      if (existingParentNames.length > 0) {
        const { data: affected } = await supabase
          .from('InventoryItems')
          .select('id, attributes')
          .eq('item_type_id', tag.item_type_id)
          .contains('attributes', [tag.name]);
        const toClean = (affected || []).filter((item: any) =>
          existingParentNames.some(p => (item.attributes || []).includes(p))
        );
        await Promise.all(toClean.map((item: any) =>
          supabase.from('InventoryItems')
            .update({ attributes: item.attributes.filter((a: string) => a !== tag.name) })
            .eq('id', item.id)
        ));
      }
    }

    fetchTagsForType(typeSearch);
  };

  const commitTag = (value: string, keepOpen: boolean) => {
    const cleanTag = value.trim();
    if (cleanTag && !selectedTags.includes(cleanTag)) {
      setSelectedTags(prev => [...prev, cleanTag]);
    }
    setNewTagInput('');
    if (keepOpen) {
      newTagInputRef.current?.focus();
    } else {
      setIsAddingTag(false);
    }
  };

  const handleAddNewTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      if (newTagInput.trim()) commitTag(newTagInput, false);
      else setIsAddingTag(false);
    } else if (e.key === ',') {
      e.preventDefault();
      if (newTagInput.trim()) commitTag(newTagInput, true);
    } else if (e.key === 'Escape') {
      setIsAddingTag(false);
      setNewTagInput('');
    }
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
          .insert([{ name: typeName }])
          .select()
          .single();
        if (typeError) throw typeError;
        itemTypeId = newType.id;
      }

      // 2. Upsert any new tags for this type
      for (const tagName of selectedTags) {
        await supabase.from('ItemTypeAttributes').upsert(
          { item_type_id: itemTypeId, name: tagName },
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
        });
        if (result === 'duplicate') alert(`An asset for "${typeName}" with these attributes already exists.`);
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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[10000] flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col md:flex-row border border-gray-200 dark:border-gray-800 my-8 shadow-black/50">

        {/* Left Side: Photo preview */}
        <div className="w-full md:w-[45%] bg-gray-50 dark:bg-gray-950/80 p-8 flex flex-col justify-center border-b md:border-b-0 md:border-r border-gray-200 dark:border-gray-800 relative overflow-hidden group">
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-indigo-500 to-purple-500" />

          <div className="mb-6 mt-4">
            <h3 className="text-xs font-bold text-gray-500 mb-1 uppercase tracking-wider">Editing Item</h3>
            <p className="text-2xl font-black bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent inline-block drop-shadow-sm">
              {item.ItemTypes?.name || 'Unknown Type'}
            </p>
          </div>

          <div className="relative rounded-xl overflow-hidden shadow-xl border border-white/20 dark:border-gray-700/50 group-hover:shadow-indigo-500/20 transition-all duration-300">
            {item.photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.photo_url}
                className="w-full h-auto object-cover max-h-80 transform group-hover:scale-[1.02] transition-transform duration-500 ease-out"
                alt="Item"
              />
            ) : (
              <div className="w-full h-48 bg-gray-200 dark:bg-gray-800 flex items-center justify-center text-gray-400">
                <Package size={48} />
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Form */}
        <div className="w-full md:w-[55%] p-8 flex flex-col bg-white dark:bg-gray-900 h-full max-h-[85vh] overflow-y-auto custom-scrollbar relative">
          <div className="flex justify-between items-start mb-6 sticky top-0 bg-white/90 dark:bg-gray-900/90 backdrop-blur-md pb-4 border-b border-gray-100 dark:border-gray-800 z-10 -mt-2 pt-2">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">Edit Item</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Update the details for this inventory item.</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 -mr-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 bg-gray-100/50 hover:bg-gray-100 dark:bg-gray-800/50 dark:hover:bg-gray-800 rounded-full transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSubmit} onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }} className="flex-1 flex flex-col space-y-6">

            {/* Type Autocomplete */}
            <div className="relative">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Item Type</label>
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
                  className="w-full rounded-lg border-gray-300 dark:border-gray-700 dark:bg-gray-950 bg-gray-50 shadow-sm focus:border-blue-500 focus:ring-blue-500/50 px-4 py-2.5 border outline-none transition-all pr-10"
                />
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={18} />
              </div>

              {isTypeDropdownOpen && (
                <div className="absolute z-20 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-48 overflow-y-auto top-full mt-1">
                  {filteredTypes.length > 0 ? (
                    filteredTypes.map(t => (
                      <button
                        key={t.id}
                        type="button"
                        className="w-full text-left px-4 py-2 hover:bg-blue-50 dark:hover:bg-blue-900/30 text-gray-700 dark:text-gray-200 text-sm transition-colors"
                        onMouseDown={() => {
                          setTypeSearch(t.name);
                          setIsTypeDropdownOpen(false);
                        }}
                      >
                        {t.name}
                      </button>
                    ))
                  ) : typeSearch ? (
                    <div className="px-4 py-2 text-sm text-gray-500 italic">
                      Create new type: <span className="font-semibold text-blue-600 dark:text-blue-400">"{typeSearch}"</span>
                    </div>
                  ) : null}
                </div>
              )}
            </div>

            {/* Tags / Attributes */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1.5">
                <Tag size={16} className="text-gray-400" /> Attributes
              </label>

              {/* Parent (grouping) tags — always visible, filled when selected */}
              {availableTags.some((t: any) => t.is_parent) && (
                <div className="mb-2">
                  <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider mb-1 block">Grouping (pick one)</span>
                  <div className="flex flex-wrap gap-1.5 items-center">
                    {availableTags.filter((t: any) => t.is_parent).map((tag: any) => {
                      const isSelected = selectedTags.includes(tag.name);
                      return (
                        <div key={tag.id} className="flex items-center gap-0.5 group">
                          <button type="button" onClick={() => toggleTag(tag.name)}
                            className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors flex items-center gap-1 ${
                              isSelected
                                ? 'bg-amber-500 border-amber-500 text-white dark:bg-amber-600 dark:border-amber-600'
                                : 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-400'
                            }`}>
                            {isSelected && <Check size={10} />}
                            {tag.name}
                          </button>
                          <button type="button" onClick={() => toggleIsParent(tag)} title="Unmark as grouping"
                            className="text-amber-400 hover:text-gray-400 opacity-0 group-hover:opacity-100 transition-all text-[10px] leading-none">★</button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Child (detail) tags — gray, multi-select */}
              <div className="flex flex-wrap gap-2 mb-3 items-center">
                {availableTags.filter((t: any) => !t.is_parent && !selectedTags.includes(t.name)).map((tag: any) => (
                  <div key={tag.id} className="flex items-center gap-0.5 group">
                    <button type="button" onClick={() => toggleTag(tag.name)}
                      className="px-3 py-1.5 rounded-full text-xs font-medium border bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100 dark:bg-gray-800/50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 transition-colors">
                      {tag.name}
                    </button>
                    <button type="button" onClick={() => toggleIsParent(tag)} title="Mark as grouping"
                      className="text-gray-300 hover:text-amber-400 opacity-0 group-hover:opacity-100 transition-all text-[10px] leading-none">★</button>
                  </div>
                ))}

                {isAddingTag ? (
                  <input
                    ref={newTagInputRef}
                    value={newTagInput}
                    onChange={(e) => setNewTagInput(e.target.value)}
                    onKeyDown={handleAddNewTag}
                    onBlur={() => setIsAddingTag(false)}
                    placeholder="Type and press Enter..."
                    className="text-xs rounded-full border-gray-300 dark:border-gray-700 dark:bg-gray-900 bg-white focus:border-blue-500 focus:ring-blue-500/30 px-3 py-1.5 border outline-none transition-all w-48 shadow-sm"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsAddingTag(true)}
                    className="w-7 h-7 flex items-center justify-center rounded-full border border-dashed border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-blue-500 hover:border-blue-400 transition-colors"
                    title="Add custom attribute"
                  >
                    +
                  </button>
                )}
              </div>

              <div className="w-full min-h-[48px] p-2 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 shadow-sm flex flex-wrap gap-2 items-start">
                {selectedTags.filter(st => !availableTags.find((t: any) => t.name === st)?.is_parent).length === 0 ? (
                  <span className="text-sm text-gray-400 p-1.5 italic">No detail attributes selected...</span>
                ) : (
                  selectedTags
                    .filter(st => !availableTags.find((t: any) => t.name === st)?.is_parent)
                    .map(st => (
                      <button key={st} type="button" onClick={() => toggleTag(st)}
                        className="px-3 py-1.5 rounded-md text-xs font-medium bg-blue-50 border border-blue-200 text-blue-700 dark:bg-blue-900/40 dark:border-blue-800 dark:text-blue-300 transition-colors flex items-center gap-1.5 group">
                        {st}
                        <span className="opacity-50 group-hover:opacity-100 group-hover:text-red-500 transition-all"><X size={12} /></span>
                      </button>
                    ))
                )}
              </div>
            </div>

            {/* Quantity and Quality */}
            <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-xl border border-gray-100 dark:border-gray-800">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4 w-full mr-4">
                  <div className="w-1/3">
                    <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Total Quantity</label>
                    <input
                      type="number"
                      min="1"
                      value={totalQuantity || ''}
                      onChange={(e) => setTotalQuantity(parseInt(e.target.value) || 0)}
                      onBlur={() => { if (!totalQuantity || totalQuantity < 1) setTotalQuantity(1); }}
                      className="w-full rounded-md border-gray-300 dark:border-gray-700 dark:bg-gray-950 bg-white shadow-sm focus:border-blue-500 focus:ring-blue-500/50 px-3 py-2 border outline-none transition-all font-bold"
                    />
                  </div>

                  {!isSplit && (
                    <div className="flex-1">
                      <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Overall Quality</label>
                      <select
                        value={globalQuality}
                        onChange={(e) => setGlobalQuality(e.target.value)}
                        className="w-full rounded-md border-gray-300 dark:border-gray-700 dark:bg-gray-950 bg-white shadow-sm focus:border-blue-500 focus:ring-blue-500/50 px-3 py-2 border outline-none transition-all appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%239CA3AF%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E')] bg-[length:12px_12px] bg-[right_12px_center] bg-no-repeat text-sm font-medium"
                      >
                        <option value="Excellent">Excellent</option>
                        <option value="Good">Good</option>
                        <option value="Fair">Fair</option>
                        <option value="Poor">Poor</option>
                      </select>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleToggleSplit}
                  className={`shrink-0 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-semibold border transition-all mt-4 ${
                    isSplit
                      ? 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/40 dark:text-blue-400 dark:border-blue-700'
                      : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700'
                  }`}
                >
                  <SplitSquareVertical size={14} />
                  {isSplit ? 'Splitting' : 'Split Quality'}
                </button>
              </div>

              {isSplit && (
                <div className="pt-4 border-t border-gray-200 dark:border-gray-800 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-medium text-gray-500">Allocate condition of all {totalQuantity} items:</span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      currentSplitTotal === totalQuantity
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400'
                        : 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400'
                    }`}>
                      {currentSplitTotal} / {totalQuantity} Assigned
                    </span>
                  </div>

                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {(['Excellent', 'Good', 'Fair', 'Poor'] as const).map((q) => (
                      <div key={q} className="bg-white dark:bg-gray-950 p-2 rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm flex flex-col items-center">
                        <label className={`text-[10px] uppercase tracking-wider font-bold mb-1.5 ${
                          q === 'Excellent' ? 'text-green-600 dark:text-green-400' :
                          q === 'Good' ? 'text-blue-600 dark:text-blue-400' :
                          q === 'Fair' ? 'text-yellow-600 dark:text-yellow-500' : 'text-red-600 dark:text-red-400'
                        }`}>{q}</label>
                        <input
                          type="number"
                          min="0"
                          value={splitQty[q]}
                          onChange={(e) => handleSplitChange(q, parseInt(e.target.value) || 0)}
                          className="w-full text-center text-lg font-semibold bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded outline-none focus:border-blue-500 py-1"
                        />
                      </div>
                    ))}
                  </div>

                  {currentSplitTotal !== totalQuantity && (
                    <p className="text-[11px] text-red-500 mt-3 flex items-center justify-center gap-1 font-medium bg-red-50 dark:bg-red-900/10 p-1.5 rounded-md border border-red-100 dark:border-red-900/30">
                      <Info size={12} /> The allocated qualities must sum exactly to your total quantity ({totalQuantity}).
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Notes */}
            <div className="flex-1 flex flex-col pt-1">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Observations / Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Details on condition, manufacturer info, etc..."
                className="w-full h-24 rounded-lg border-gray-300 dark:border-gray-700 dark:bg-gray-950 bg-gray-50 shadow-sm focus:border-blue-500 focus:ring-blue-500/50 px-4 py-3 border outline-none resize-none transition-all custom-scrollbar placeholder:text-gray-400 text-sm"
              />
            </div>

            {/* Save as asset toggle */}
            <div className="pt-2 mt-auto border-t border-gray-100 dark:border-gray-800">
              <button
                type="button"
                onClick={() => setSaveAsAsset(v => !v)}
                className={`w-full flex items-center gap-2.5 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all mb-3 ${
                  saveAsAsset
                    ? 'bg-amber-50 border-amber-300 text-amber-700 dark:bg-amber-900/20 dark:border-amber-700 dark:text-amber-400'
                    : 'bg-gray-50 border-gray-200 text-gray-500 dark:bg-gray-900 dark:border-gray-800 dark:text-gray-400 hover:border-amber-300 hover:text-amber-600'
                }`}
              >
                <Bookmark size={15} className={saveAsAsset ? 'fill-amber-500 text-amber-500' : ''} />
                <span>{saveAsAsset ? 'Will be saved as a reusable asset' : 'Save as reusable asset'}</span>
                <div className={`ml-auto w-8 h-4 rounded-full transition-colors relative shrink-0 ${saveAsAsset ? 'bg-amber-400' : 'bg-gray-300 dark:bg-gray-700'}`}>
                  <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-all ${saveAsAsset ? 'left-4' : 'left-0.5'}`} />
                </div>
              </button>

              <button
                disabled={loading || (isSplit && currentSplitTotal !== totalQuantity)}
                type="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 px-4 rounded-xl shadow-md flex justify-center items-center gap-2 transition-all transform active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Saving Changes...
                  </span>
                ) : (
                  <><Check size={20} /> Save Changes</>
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

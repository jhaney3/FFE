'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { saveAssetIfNew } from '@/lib/saveAsset';
import { X, Check, Tag, ChevronDown, SplitSquareVertical, Info, Package } from 'lucide-react';

export default function FormModal({ photo, room, onClose, onSaved }: { photo: any, room: any, onClose: () => void, onSaved?: () => void }) {
  const [loading, setLoading] = useState(false);

  // Auto-complete Types state
  const [itemTypes, setItemTypes] = useState<any[]>([]);
  const [typeSearch, setTypeSearch] = useState('');
  const [isTypeDropdownOpen, setIsTypeDropdownOpen] = useState(false);
  const typeInputRef = useRef<HTMLInputElement>(null);
  
  // Tags State
  const [availableTags, setAvailableTags] = useState<any[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagSearch, setTagSearch] = useState('');
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [newTagInput, setNewTagInput] = useState('');
  const newTagInputRef = useRef<HTMLInputElement>(null);
  const [isAddingGroup, setIsAddingGroup] = useState(false);
  const [newGroupInput, setNewGroupInput] = useState('');
  const newGroupInputRef = useRef<HTMLInputElement>(null);

  // Quantities & Qualities State
  const [isSplit, setIsSplit] = useState(false);
  const [totalQuantity, setTotalQuantity] = useState(1);
  const [globalQuality, setGlobalQuality] = useState('Good');
  const [isConditionOpen, setIsConditionOpen] = useState(false);
  
  const [splitQty, setSplitQty] = useState({
    Excellent: 0,
    Good: 1,
    Fair: 0,
    Poor: 0,
  });

  const [notes, setNotes] = useState('');
  const [saveAsAsset, setSaveAsAsset] = useState(false);
  const [suggestionApplied, setSuggestionApplied] = useState(false);
  const [matchedAsset, setMatchedAsset] = useState<any>(null);
  const [pendingTypeId, setPendingTypeId] = useState<string | null>(null);

  useEffect(() => {
    fetchTypes();
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (typeInputRef.current) typeInputRef.current.focus();
      });
    });
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
  }, [typeSearch]);

  // Reactively check for a matching asset as type/attributes change
  useEffect(() => {
    setMatchedAsset(null);
    setPendingTypeId(null);

    const existingType = itemTypes.find(t => t.name.toLowerCase() === typeSearch.toLowerCase());
    if (!existingType || selectedTags.length === 0) return;

    const sorted = [...selectedTags].sort();
    const timer = setTimeout(async () => {
      const { data: assets } = await supabase
        .from('Assets')
        .select('*')
        .eq('item_type_id', existingType.id);
      const match = assets?.find(a =>
        JSON.stringify([...(a.attributes || [])].sort()) === JSON.stringify(sorted)
      );
      if (match && match.photo_url !== photo.photo_url) {
        setPendingTypeId(existingType.id);
        setMatchedAsset(match);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [typeSearch, selectedTags, itemTypes]);

  // Effect A — apply suggestion type, quantity, quality, notes once itemTypes loads
  useEffect(() => {
    if (suggestionApplied) return;
    if (itemTypes.length === 0) return;
    if (!photo.suggestion_type_name) return;

    setSuggestionApplied(true);
    setTypeSearch(photo.suggestion_type_name); // triggers existing [typeSearch] effect → fetchTagsForType

    const hasSplit = [photo.suggestion_qty_excellent, photo.suggestion_qty_good,
                      photo.suggestion_qty_fair, photo.suggestion_qty_poor]
      .some((v: any) => v != null);

    if (hasSplit) {
      const ex = photo.suggestion_qty_excellent ?? 0;
      const go = photo.suggestion_qty_good      ?? 0;
      const fa = photo.suggestion_qty_fair      ?? 0;
      const po = photo.suggestion_qty_poor      ?? 0;
      setTotalQuantity(ex + go + fa + po || 1);
      setSplitQty({ Excellent: ex, Good: go, Fair: fa, Poor: po });
      const primary = (Object.entries({ Excellent: ex, Good: go, Fair: fa, Poor: po }) as [string, number][])
        .sort(([, a], [, b]) => b - a)[0][0];
      setGlobalQuality(primary);
      setIsSplit(true);
    } else {
      if (photo.suggestion_quantity) setTotalQuantity(photo.suggestion_quantity);
      if (photo.suggestion_quality) setGlobalQuality(photo.suggestion_quality);
    }

    if (photo.suggestion_notes) setNotes(photo.suggestion_notes);
  }, [itemTypes, suggestionApplied]); // eslint-disable-line react-hooks/exhaustive-deps

  // Effect B — apply suggested attributes once availableTags loads (chained from Effect A → fetchTagsForType)
  useEffect(() => {
    if (!suggestionApplied) return;
    if (!photo.suggestion_attributes?.length) return;
    if (availableTags.length === 0) return;

    const validNames = new Set(availableTags.map((t: any) => t.name));
    const valid = (photo.suggestion_attributes as string[]).filter((a: string) => validNames.has(a));
    if (valid.length > 0) setSelectedTags(valid);
  }, [availableTags, suggestionApplied]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchTypes = async () => {
    const { data } = await supabase.from('ItemTypes').select('*').order('name');
    if (data) setItemTypes(data);
  };

  const applyTags = (tags: any[]) => {
    setAvailableTags(tags);
    const parentNames = new Set(tags.filter((t: any) => t.is_parent).map((t: any) => t.name));
    setSelectedTags(prev => {
      const selectedParents = prev.filter(t => parentNames.has(t));
      if (selectedParents.length <= 1) return prev;
      return [...prev.filter(t => !parentNames.has(t)), selectedParents[selectedParents.length - 1]];
    });
  };

  const fetchTagsForType = async (typeName: string) => {
    // Find if the typed name exactly matches an existing type
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
      // Radio behavior: deselect any other parent tag first
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

  // Autocomplete Tab selection
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

  // When switching to split, we default to assigning all totalQuantity to the currently selected globalQuality
  const handleToggleSplit = () => {
    if (!isSplit) {
      setSplitQty({
        Excellent: globalQuality === 'Excellent' ? totalQuantity : 0,
        Good: globalQuality === 'Good' ? totalQuantity : 0,
        Fair: globalQuality === 'Fair' ? totalQuantity : 0,
        Poor: globalQuality === 'Poor' ? totalQuantity : 0,
      });
    }
    setIsSplit(!isSplit);
  };

  const currentSplitTotal = Object.values(splitQty).reduce((sum, val) => sum + val, 0);

  // Smart Split Logic: Auto-deduct from the originally allocated split category
  const handleSplitChange = (quality: keyof typeof splitQty, newValue: number) => {
    // Basic bounds checking
    if (isNaN(newValue)) return;
    const val = Math.max(0, newValue);
    
    setSplitQty(prev => {
      const primaryBin = globalQuality as keyof typeof splitQty;
      const otherBinsSum = Object.entries(prev)
        .filter(([key]) => key !== quality && key !== primaryBin)
        .reduce((sum, [_, v]) => sum + v, 0);

      // If we are editing the primary bin directly, we just cap it so we don't exceed the total.
      if (quality === primaryBin) {
        // The max the primary bin can be is the total minus whatever is locked in the other bins
        const maxAllowed = Math.max(0, totalQuantity - otherBinsSum);
        return { ...prev, [primaryBin]: Math.min(val, maxAllowed) };
      }

      // We are editing a secondary bin. 
      // The absolute max this secondary bin can be is (Total - Other Secondary Bins).
      const maxAllowedForThisBin = Math.max(0, totalQuantity - otherBinsSum);
      const safeVal = Math.min(val, maxAllowedForThisBin);
      
      // Calculate how much space is left for the primary bin to absorb
      const newPrimaryValue = Math.max(0, totalQuantity - otherBinsSum - safeVal);

      return {
        ...prev,
        [quality]: safeVal,
        [primaryBin]: newPrimaryValue
      };
    });
  };

  const doInsert = async (itemTypeId: string, typeName: string) => {
    setLoading(true);
    try {
      // 1. Insert any new tags for this Type
      for (const tagName of selectedTags) {
        const isParent = availableTags.find((t: any) => t.name === tagName)?.is_parent ?? false;
        await supabase.from('ItemTypeAttributes').upsert(
          { item_type_id: itemTypeId, name: tagName, is_parent: isParent },
          { onConflict: 'item_type_id,name' as any }
        );
      }

      // 2. Insert InventoryItem
      const qtyExcellent = isSplit ? splitQty.Excellent : (globalQuality === 'Excellent' ? totalQuantity : 0);
      const qtyGood      = isSplit ? splitQty.Good      : (globalQuality === 'Good'      ? totalQuantity : 0);
      const qtyFair      = isSplit ? splitQty.Fair      : (globalQuality === 'Fair'      ? totalQuantity : 0);
      const qtyPoor      = isSplit ? splitQty.Poor      : (globalQuality === 'Poor'      ? totalQuantity : 0);

      const { data: invData, error: invError } = await supabase.from('InventoryItems').insert([{
        room_id: room.id,
        photo_url: photo.photo_url,
        item_type_id: itemTypeId,
        qty_excellent: qtyExcellent,
        qty_good: qtyGood,
        qty_fair: qtyFair,
        qty_poor: qtyPoor,
        attributes: selectedTags,
        notes: notes.trim(),
      }]).select('id').single();
      if (invError) throw invError;

      // 3. Update Photo Status
      const { error: photoError } = await supabase
        .from('IncomingPhotos')
        .update({ status: 'processed' })
        .eq('id', photo.id);
      if (photoError) throw photoError;

      // 4. Optionally save as a reusable asset
      if (saveAsAsset) {
        const result = await saveAssetIfNew({
          name:         typeName,
          item_type_id: itemTypeId,
          photo_url:    photo.photo_url,
          attributes:   selectedTags,
          notes:        notes.trim(),
        });
        if (result.status === 'duplicate') {
          alert(`An asset for "${typeName}" with these attributes already exists.`);
        } else if (result.assetPhotoUrl && result.assetPhotoUrl !== photo.photo_url) {
          // Point the item at the asset's copy so it won't lose its photo if the triage file is cleaned up
          await supabase.from('InventoryItems').update({ photo_url: result.assetPhotoUrl }).eq('id', invData.id);
        }
      }

      onSaved?.();
      onClose();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (matchedAsset) return; // warning already visible — user must interact with it
    if (!typeSearch.trim()) return alert('Please enter an Item Type');

    if (isSplit && currentSplitTotal !== totalQuantity) {
      return alert(`Split quantities (${currentSplitTotal}) must equal Total Quantity (${totalQuantity}).`);
    }

    setLoading(true);

    try {
      // Resolve ItemType
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

      // Check for a matching asset before inserting
      const sortedAttrs = [...selectedTags].sort();
      const { data: assets } = await supabase
        .from('Assets')
        .select('*')
        .eq('item_type_id', itemTypeId);
      const match = assets?.find(a =>
        JSON.stringify([...(a.attributes || [])].sort()) === JSON.stringify(sortedAttrs)
      );

      if (match) {
        setPendingTypeId(itemTypeId);
        setMatchedAsset(match);
        setLoading(false);
        return;
      }

      await doInsert(itemTypeId, typeName);
    } catch (err: any) {
      alert(err.message);
      setLoading(false);
    }
  };

  const filteredTypes = itemTypes.filter(t => t.name.toLowerCase().includes(typeSearch.toLowerCase()));

  return (
    <div className="fixed inset-0 bg-black/75 z-[10000] flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-gray-900 w-full max-w-4xl overflow-hidden flex flex-col md:flex-row border border-gray-700 my-8 surface-raised">

        {/* Left Side: Photo + destination */}
        <div className="w-full md:w-[42%] bg-gray-950 flex flex-col justify-center border-b md:border-b-0 md:border-r border-gray-800 relative overflow-hidden">
          {/* Accent bar */}

          <div className="px-7 pt-8 pb-5">
            <p className="font-mono text-[10px] tracking-[0.18em] uppercase text-gray-500 mb-2">Destination</p>
            <p className="text-xl font-semibold text-blue-400 tracking-tight">{room.name}</p>
          </div>

          <div className="overflow-hidden border-t border-gray-800 border-b">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo.photo_url} className="w-full h-auto object-cover max-h-72" alt="Item" />
          </div>
        </div>

        {/* Right Side: Form */}
        <div className="w-full md:w-[58%] flex flex-col bg-gray-900 h-full max-h-[85vh] overflow-y-auto custom-scrollbar relative">
          <div className="flex justify-between items-center sticky top-0 bg-gray-900 px-7 pt-6 pb-4 border-b border-gray-800 z-10 mb-5">
            <div>
              <p className="font-mono text-[10px] tracking-[0.18em] uppercase text-gray-500 mb-1">New Entry</p>
              <h2 className="text-lg font-semibold text-gray-100">Log Details</h2>
            </div>
            <button onClick={onClose} className="p-1.5 text-gray-600 hover:text-gray-200 hover:bg-gray-800 border border-transparent hover:border-gray-700 transition-colors">
              <X size={16} />
            </button>
          </div>

          {photo.suggestion_type_name && (
            <div className="mx-7 mb-2 px-3 py-1.5 border border-blue-700/40 bg-blue-900/10">
              <span className="font-mono text-[9px] tracking-[0.15em] uppercase text-blue-400/70">
                Pre-filled from mobile suggestion — edit freely
              </span>
            </div>
          )}

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
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-600 pointer-events-none" size={14} />
              </div>

              {/* Autocomplete Dropdown */}
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
                    <div className="px-3 py-2 font-mono text-[11px] text-gray-500">
                      Create: <span className="text-blue-400">"{typeSearch}"</span>
                    </div>
                  ) : null}
                </div>
              )}
            </div>

            {/* Tags / Attributes */}
            <div>
              <label className="block font-mono text-[10px] tracking-[0.15em] uppercase text-gray-500 mb-2">Attributes</label>

              {availableTags.length > 5 && (
                <input
                  value={tagSearch}
                  onChange={(e) => setTagSearch(e.target.value)}
                  placeholder="Filter attributes..."
                  className="w-full mb-2 border border-gray-700 bg-gray-950 focus:border-blue-500 px-3 py-1.5 text-xs outline-none transition-colors text-gray-100 placeholder:text-gray-700"
                />
              )}

              <div className="flex items-start gap-2.5 mb-2">
                  <span className="font-mono text-[9px] tracking-[0.12em] uppercase text-amber-600/70 shrink-0 pt-1 w-10">Group</span>
                  <div className="flex flex-wrap gap-1.5 items-center flex-1">
                    {availableTags.filter((t: any) => t.is_parent && (!tagSearch || t.name.toLowerCase().includes(tagSearch.toLowerCase()))).map((tag: any) => {
                      const isSelected = selectedTags.includes(tag.name);
                      return (
                        <button key={tag.id ?? tag.name} type="button" onClick={() => toggleTag(tag.name)}
                          className={`flex items-center gap-1 font-mono text-[10px] px-2 py-0.5 border transition-colors ${
                            isSelected
                              ? 'border-amber-600 bg-amber-600/10 text-amber-400'
                              : 'border-gray-700 text-gray-500 hover:border-amber-700 hover:text-amber-500'
                          }`}>
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
                        placeholder="New group..."
                        className="font-mono text-[10px] border border-amber-700 bg-gray-950 focus:border-amber-500 px-2 py-0.5 outline-none transition-colors text-amber-400 placeholder:text-amber-900 w-32"
                      />
                    ) : (
                      <button type="button" onClick={() => setIsAddingGroup(true)}
                        className="font-mono text-[10px] px-2 py-0.5 border border-dashed border-amber-800 text-amber-700 hover:border-amber-600 hover:text-amber-500 transition-colors"
                        title="Add group">+</button>
                    )}
                  </div>
                </div>

              <div className="flex items-start gap-2.5">
                <span className="font-mono text-[9px] tracking-[0.12em] uppercase text-blue-600/70 shrink-0 pt-1 w-10">Tags</span>
                <div className="flex-1 space-y-1.5">
                  <div className="flex flex-wrap gap-1.5 items-center">
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
                        placeholder="Type + Enter..."
                        className="font-mono text-[10px] border border-blue-700 bg-gray-950 focus:border-blue-500 px-2 py-0.5 outline-none transition-colors text-blue-400 placeholder:text-blue-900 w-36"
                      />
                    ) : (
                      <button type="button" onClick={() => setIsAddingTag(true)}
                        className="font-mono text-[10px] px-2 py-0.5 border border-dashed border-gray-700 text-gray-600 hover:border-blue-700 hover:text-blue-500 transition-colors"
                        title="Add tag">+</button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5 min-h-[28px] p-1.5 border border-gray-800 bg-gray-950">
                    {selectedTags.filter(st => !availableTags.find((t: any) => t.name === st)?.is_parent).length === 0 ? (
                      <span className="font-mono text-[10px] text-gray-700 italic">No tags selected</span>
                    ) : (
                      selectedTags
                        .filter(st => !availableTags.find((t: any) => t.name === st)?.is_parent)
                        .map(st => (
                          <button key={st} type="button" onClick={() => toggleTag(st)}
                            className="flex items-center gap-1 font-mono text-[10px] px-2 py-0.5 border border-blue-700 bg-blue-700/10 text-blue-400 hover:border-red-700 hover:bg-red-900/10 hover:text-red-400 transition-colors">
                            {st} <X size={9} />
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
                          value={splitQty[q as keyof typeof splitQty]}
                          onChange={(e) => handleSplitChange(q as keyof typeof splitQty, parseInt(e.target.value) || 0)}
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
            <div className="flex-1 flex flex-col">
              <label className="block font-mono text-[10px] tracking-[0.12em] uppercase text-gray-500 mb-1.5">Observations / Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Details on condition, manufacturer info, etc..."
                className="w-full h-20 border border-gray-700 bg-gray-950 focus:border-blue-500 px-3 py-2 outline-none resize-none transition-colors text-gray-100 text-sm placeholder:text-gray-700 custom-scrollbar"
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
                  <div className="flex-1 p-4 flex flex-col gap-2 min-w-0">
                    <div>
                      <p className="font-mono text-[9px] tracking-[0.15em] uppercase text-amber-500 mb-1">Existing asset matches</p>
                      <p className="text-sm font-medium text-gray-100 truncate">{matchedAsset.name}</p>
                      {matchedAsset.attributes?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {[...matchedAsset.attributes].sort((a: string, b: string) => {
                            const aP = availableTags.find((t: any) => t.name === a)?.is_parent ?? false;
                            const bP = availableTags.find((t: any) => t.name === b)?.is_parent ?? false;
                            if (aP !== bP) return aP ? -1 : 1;
                            return a.localeCompare(b);
                          }).map((attr: string) => {
                            const isParent = availableTags.find((t: any) => t.name === attr)?.is_parent ?? false;
                            return (
                              <span key={attr} className={`font-mono text-[10px] px-1.5 py-0.5 border ${
                                isParent
                                  ? 'border-amber-700 bg-amber-700/10 text-amber-400'
                                  : 'border-blue-800 bg-blue-900/10 text-blue-400'
                              }`}>{attr}</span>
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
                            // Insert inventory item using asset identity + current form quantities/notes
                            const qtyExcellent = isSplit ? splitQty.Excellent : (globalQuality === 'Excellent' ? totalQuantity : 0);
                            const qtyGood      = isSplit ? splitQty.Good      : (globalQuality === 'Good'      ? totalQuantity : 0);
                            const qtyFair      = isSplit ? splitQty.Fair      : (globalQuality === 'Fair'      ? totalQuantity : 0);
                            const qtyPoor      = isSplit ? splitQty.Poor      : (globalQuality === 'Poor'      ? totalQuantity : 0);
                            const { error } = await supabase.from('InventoryItems').insert([{
                              room_id:       room.id,
                              photo_url:     matchedAsset.photo_url,
                              item_type_id:  matchedAsset.item_type_id,
                              qty_excellent: qtyExcellent,
                              qty_good:      qtyGood,
                              qty_fair:      qtyFair,
                              qty_poor:      qtyPoor,
                              attributes:    matchedAsset.attributes || [],
                              notes:         notes.trim(),
                            }]);
                            if (error) throw error;
                            // Remove from triage queue via status update (triggers Sidebar realtime handler)
                            await supabase.from('IncomingPhotos').update({ status: 'processed' }).eq('id', photo.id);
                            // Delete the storage file since this photo won't be referenced by any item
                            if (photo.photo_url) {
                              const marker = '/inventory_photos/';
                              const idx = photo.photo_url.indexOf(marker);
                              const filePath = idx !== -1 ? photo.photo_url.slice(idx + marker.length) : photo.photo_url.split('/').pop();
                              if (filePath) await supabase.storage.from('inventory_photos').remove([filePath]);
                            }
                            onSaved?.();
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
                        onClick={() => {
                          const typeName = toTitleCase(typeSearch.trim());
                          setMatchedAsset(null);
                          doInsert(pendingTypeId!, typeName);
                        }}
                        className="flex-1 py-1.5 font-mono text-[10px] tracking-wider uppercase border border-gray-700 text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-colors"
                      >
                        Continue Anyway
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Save as asset toggle + submit */}
            <div className="pt-2 mt-auto border-t border-gray-800">
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
                {loading ? 'Processing...' : <><Check size={13} /> Record Inventory Item</>}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

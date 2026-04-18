import { useState, useMemo } from 'react';

export function useInventoryFilters(items: any[], tagMeta: Map<string, boolean>) {
  const [typeFilter,       setTypeFilterRaw]       = useState('');
  const [parentAttrFilter, setParentAttrFilterRaw] = useState('');
  const [childAttrFilter,  setChildAttrFilter]     = useState('');
  const [qualityFilter,    setQualityFilter]       = useState('');
  const [levelFilter,      setLevelFilterRaw]      = useState('');
  const [buildingFilter,   setBuildingFilterRaw]   = useState('');
  const [roomTypeFilter,   setRoomTypeFilter]      = useState('');

  // Cascading setters
  const setTypeFilter = (v: string) => {
    setTypeFilterRaw(v);
    setParentAttrFilterRaw('');
    setChildAttrFilter('');
  };
  const setParentAttrFilter = (v: string) => {
    setParentAttrFilterRaw(v);
    setChildAttrFilter('');
  };
  const setLevelFilter = (v: string) => {
    setLevelFilterRaw(v);
    setBuildingFilterRaw('');
    setRoomTypeFilter('');
  };
  const setBuildingFilter = (v: string) => {
    setBuildingFilterRaw(v);
    setRoomTypeFilter('');
  };

  // Distinct type names across all items
  const uniqueTypes = useMemo(() =>
    Array.from(new Set(items.map(i => i.ItemTypes?.name).filter(Boolean))).sort() as string[],
    [items]
  );

  // Items matching typeFilter (exact match since it comes from a dropdown of distinct values)
  const typeFilteredItems = useMemo(() =>
    typeFilter ? items.filter(i => i.ItemTypes?.name === typeFilter) : items,
    [items, typeFilter]
  );

  // Parent attr options: distinct parent attrs for items matching typeFilter
  const parentAttrOptions = useMemo(() => {
    const opts = new Set<string>();
    typeFilteredItems.forEach(item => {
      (item.attributes || []).forEach((attr: string) => {
        if (tagMeta.get(`${item.item_type_id}:${attr}`)) opts.add(attr);
      });
    });
    return Array.from(opts).sort();
  }, [typeFilteredItems, tagMeta]);

  // Items matching typeFilter + parentAttrFilter
  const parentFilteredItems = useMemo(() =>
    parentAttrFilter
      ? typeFilteredItems.filter(i => (i.attributes || []).includes(parentAttrFilter))
      : typeFilteredItems,
    [typeFilteredItems, parentAttrFilter]
  );

  // Child attr options: distinct non-parent attrs for items matching typeFilter + parentAttrFilter
  const childAttrOptions = useMemo(() => {
    const opts = new Set<string>();
    parentFilteredItems.forEach(item => {
      (item.attributes || []).forEach((attr: string) => {
        if (!tagMeta.get(`${item.item_type_id}:${attr}`)) opts.add(attr);
      });
    });
    return Array.from(opts).sort();
  }, [parentFilteredItems, tagMeta]);

  // Full filter application
  const filteredItems = useMemo(() => items.filter(item => {
    if (typeFilter       && item.ItemTypes?.name        !== typeFilter)       return false;
    if (parentAttrFilter && !(item.attributes || []).includes(parentAttrFilter)) return false;
    if (childAttrFilter  && !(item.attributes || []).includes(childAttrFilter))  return false;
    if (qualityFilter === 'Excellent' && (item.qty_excellent || 0) === 0) return false;
    if (qualityFilter === 'Good'      && (item.qty_good      || 0) === 0) return false;
    if (qualityFilter === 'Fair'      && (item.qty_fair      || 0) === 0) return false;
    if (qualityFilter === 'Poor'      && (item.qty_poor      || 0) === 0) return false;
    if (levelFilter    && item.Rooms?.level_name    !== levelFilter)    return false;
    if (buildingFilter && item.Rooms?.building_name !== buildingFilter) return false;
    if (roomTypeFilter && item.Rooms?.room_type     !== roomTypeFilter) return false;
    return true;
  }), [items, typeFilter, parentAttrFilter, childAttrFilter, qualityFilter, levelFilter, buildingFilter, roomTypeFilter]);

  const activeFilterCount = [typeFilter, parentAttrFilter, childAttrFilter, qualityFilter, levelFilter, buildingFilter, roomTypeFilter].filter(Boolean).length;

  const clearFilters = () => {
    setTypeFilterRaw('');
    setParentAttrFilterRaw('');
    setChildAttrFilter('');
    setQualityFilter('');
    setLevelFilterRaw('');
    setBuildingFilterRaw('');
    setRoomTypeFilter('');
  };

  return {
    typeFilter,        setTypeFilter,
    parentAttrFilter,  setParentAttrFilter,
    childAttrFilter,   setChildAttrFilter,
    qualityFilter,     setQualityFilter,
    levelFilter,       setLevelFilter,
    buildingFilter,    setBuildingFilter,
    roomTypeFilter,    setRoomTypeFilter,
    uniqueTypes,
    parentAttrOptions,
    childAttrOptions,
    filteredItems,
    activeFilterCount,
    clearFilters,
  };
}

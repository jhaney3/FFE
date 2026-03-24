'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useLowBandwidth } from '@/lib/BandwidthContext';
import { Download, Filter, Search, Pencil, X, Check, Minus, Printer, Package } from 'lucide-react';

function Checkbox({ checked, indeterminate, onChange }: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onChange(); }}
      className={`w-3.5 h-3.5 flex items-center justify-center border transition-all shrink-0 ${
        checked || indeterminate
          ? 'border-blue-500 bg-blue-600'
          : 'border-gray-700 bg-transparent hover:border-gray-500'
      }`}
    >
      {indeterminate && !checked
        ? <Minus size={10} className="text-white" strokeWidth={3} />
        : checked
          ? <Check size={10} className="text-white" strokeWidth={3} />
          : null}
    </button>
  );
}
import Papa from 'papaparse';
import MassEditModal from './MassEditModal';

export default function Dashboard() {
  const { lowBandwidth } = useLowBandwidth();
  const [items, setItems] = useState<any[]>([]);
  const [tagMeta, setTagMeta] = useState<Map<string, boolean>>(new Map());
  const [loading, setLoading] = useState(true);

  // Hierarchical zone filters — each level resets the ones below it
  const [levelFilter,    setLevelFilter]    = useState('');
  const [buildingFilter, setBuildingFilter] = useState('');
  const [roomTypeFilter, setRoomTypeFilter] = useState('');

  // Item filters
  const [typeFilter,       setTypeFilter]       = useState('');
  const [qualityFilter,    setQualityFilter]    = useState('');
  const [attributeFilter,  setAttributeFilter]  = useState('');

  // Selection
  const [selectedIds, setSelectedIds]     = useState<Set<string>>(new Set());
  const [massEditOpen, setMassEditOpen]   = useState(false);

  useEffect(() => {
    fetchItems();

    let debounce: ReturnType<typeof setTimeout>;
    const channel = supabase
      .channel('dashboard-inventory')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'InventoryItems' }, () => {
        clearTimeout(debounce);
        debounce = setTimeout(() => fetchItems(), 300);
      })
      .subscribe();

    return () => {
      clearTimeout(debounce);
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchItems = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('InventoryItems')
      .select(`
        *,
        ItemTypes ( name ),
        Rooms (
          name, level_name, building_name, room_type, page_number,
          FloorPlans ( name )
        )
      `)
      .order('created_at', { ascending: false });
    if (data) {
      setItems(data);
      const typeIds = [...new Set(data.map((i: any) => i.item_type_id).filter(Boolean))];
      if (typeIds.length > 0) {
        const { data: tagData } = await supabase
          .from('ItemTypeAttributes')
          .select('item_type_id, name')
          .in('item_type_id', typeIds)
          .eq('is_parent', true);
        const meta = new Map<string, boolean>();
        (tagData || []).forEach((t: any) => meta.set(`${t.item_type_id}:${t.name}`, true));
        setTagMeta(meta);
      }
    }
    setLoading(false);
  };

  // --- Cascading filter option lists ---

  const uniqueLevels = Array.from(new Set(
    items.map(i => i.Rooms?.level_name).filter(Boolean)
  )).sort();

  const uniqueBuildings = Array.from(new Set(
    items
      .filter(i => !levelFilter || i.Rooms?.level_name === levelFilter)
      .map(i => i.Rooms?.building_name).filter(Boolean)
  )).sort();

  const uniqueRoomTypes = Array.from(new Set(
    items
      .filter(i => (!levelFilter    || i.Rooms?.level_name    === levelFilter)
                && (!buildingFilter || i.Rooms?.building_name === buildingFilter))
      .map(i => i.Rooms?.room_type).filter(Boolean)
  )).sort();

  // Unique attributes — scoped to all active filters except attributeFilter itself
  const uniqueAttributes = Array.from(new Set(
    items
      .filter(i => (!levelFilter    || i.Rooms?.level_name    === levelFilter)
                && (!buildingFilter || i.Rooms?.building_name === buildingFilter)
                && (!roomTypeFilter || i.Rooms?.room_type     === roomTypeFilter)
                && (!typeFilter     || (i.ItemTypes?.name || '').toLowerCase().includes(typeFilter.toLowerCase())))
      .flatMap(i => i.attributes || [])
      .filter(Boolean)
  )).sort();

  // --- Filter application ---

  const filteredItems = items.filter(item => {
    if (levelFilter    && item.Rooms?.level_name    !== levelFilter)    return false;
    if (buildingFilter && item.Rooms?.building_name !== buildingFilter) return false;
    if (roomTypeFilter && item.Rooms?.room_type     !== roomTypeFilter) return false;
    if (typeFilter && !(item.ItemTypes?.name || '').toLowerCase().includes(typeFilter.toLowerCase())) return false;
    if (attributeFilter && !(item.attributes || []).includes(attributeFilter)) return false;
    if (qualityFilter === 'Excellent' && item.qty_excellent === 0) return false;
    if (qualityFilter === 'Good'      && item.qty_good      === 0) return false;
    if (qualityFilter === 'Fair'      && item.qty_fair      === 0) return false;
    if (qualityFilter === 'Poor'      && item.qty_poor      === 0) return false;
    return true;
  });

  // --- Selection helpers ---

  const filteredIds = filteredItems.map(i => i.id);
  const allFilteredSelected = filteredIds.length > 0 && filteredIds.every(id => selectedIds.has(id));
  const someFilteredSelected = filteredIds.some(id => selectedIds.has(id));

  const toggleItem = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        filteredIds.forEach(id => next.delete(id));
        return next;
      });
    } else {
      setSelectedIds(prev => new Set([...prev, ...filteredIds]));
    }
  };

  const clearSelection = () => setSelectedIds(new Set());

  const selectedItems = items.filter(i => selectedIds.has(i.id));

  // --- CSV Export ---

  const exportCSV = () => {
    const csvData = filteredItems.map(item => ({
      'Item ID':        item.id,
      'Floor Plan':     item.Rooms?.FloorPlans?.name || '',
      'Level':          item.Rooms?.level_name   || '',
      'Building':       item.Rooms?.building_name || '',
      'Room Type':      item.Rooms?.room_type     || '',
      'Room / Zone':    item.Rooms?.name          || '',
      'Page Number':    item.Rooms?.page_number   || 1,
      'Item Type':      item.ItemTypes?.name      || '',
      'Qty Excellent':  item.qty_excellent,
      'Qty Good':       item.qty_good,
      'Qty Fair':       item.qty_fair,
      'Qty Poor':       item.qty_poor,
      'Total Quantity': item.qty_excellent + item.qty_good + item.qty_fair + item.qty_poor,
      'Grouping':       Array.isArray(item.attributes) ? (item.attributes.find((a: string) => tagMeta.get(`${item.item_type_id}:${a}`)) ?? '') : '',
      'Attributes':     Array.isArray(item.attributes) ? item.attributes.filter((a: string) => !tagMeta.get(`${item.item_type_id}:${a}`)).join(', ') : '',
      'Notes':          item.notes || '',
      'Photo URL':      item.photo_url || '',
      'Added At':       new Date(item.created_at).toLocaleString(),
    }));
    const blob = new Blob([Papa.unparse(csvData)], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `inventory_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const openReport = () => {
    const params = new URLSearchParams();
    if (levelFilter)     params.set('level',     levelFilter);
    if (buildingFilter)  params.set('building',  buildingFilter);
    if (roomTypeFilter)  params.set('roomType',  roomTypeFilter);
    if (typeFilter)      params.set('type',      typeFilter);
    if (qualityFilter)   params.set('quality',   qualityFilter);
    if (attributeFilter) params.set('attribute', attributeFilter);
    window.open(`/report?${params.toString()}`, '_blank');
  };

  const selectClass = "w-full px-3 py-1.5 bg-gray-950 border border-gray-800 outline-none focus:border-blue-600 focus:ring-1 ring-blue-600/30 appearance-none text-gray-200 text-xs font-mono transition-colors";

  return (
    <div className="flex-1 w-full bg-gray-950 flex flex-col items-center py-6 px-4 sm:px-8 overflow-y-auto custom-scrollbar">
      <div className="max-w-7xl w-full pb-24">

        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-6 gap-4 border-b border-gray-800 pb-5">
          <div>
            <p className="font-mono text-[10px] tracking-[0.18em] uppercase text-gray-500 mb-1.5">Inventory Registry</p>
            <h1 className="text-2xl font-semibold text-gray-100 tracking-tight">FFE Catalog</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={openReport}
              className="border border-gray-700 hover:border-gray-600 text-gray-400 hover:text-gray-200 px-4 py-2 font-mono text-[10px] tracking-[0.12em] uppercase flex items-center gap-2 transition-colors hover:bg-gray-900"
            >
              <Printer size={13} /> Report
            </button>
            <button
              onClick={exportCSV}
              className="border border-blue-700/50 hover:border-blue-500 text-blue-400 hover:text-blue-300 px-4 py-2 font-mono text-[10px] tracking-[0.12em] uppercase flex items-center gap-2 transition-colors bg-blue-600/5 hover:bg-blue-600/10"
            >
              <Download size={13} /> Export CSV
            </button>
          </div>
        </div>

        {/* Filter Panel */}
        <div className="border border-gray-800 bg-gray-900/40 px-5 py-4 mb-0 space-y-4">
          <div className="flex items-center gap-2 font-mono text-[10px] tracking-[0.18em] uppercase text-gray-500">
            <Filter size={11} /> Filters
          </div>

          {/* Row 1: Location hierarchy */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="block font-mono text-[10px] tracking-[0.12em] uppercase text-gray-500 mb-1">Level</label>
              <select value={levelFilter} onChange={(e) => { setLevelFilter(e.target.value); setBuildingFilter(''); setRoomTypeFilter(''); setAttributeFilter(''); }} className={selectClass}>
                <option value="">All Levels</option>
                {uniqueLevels.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="block font-mono text-[10px] tracking-[0.12em] uppercase text-gray-500 mb-1">Building</label>
              <select value={buildingFilter} onChange={(e) => { setBuildingFilter(e.target.value); setRoomTypeFilter(''); setAttributeFilter(''); }} className={selectClass}>
                <option value="">All Buildings</option>
                {uniqueBuildings.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div>
              <label className="block font-mono text-[10px] tracking-[0.12em] uppercase text-gray-500 mb-1">Room Type</label>
              <select value={roomTypeFilter} onChange={(e) => { setRoomTypeFilter(e.target.value); setAttributeFilter(''); }} className={selectClass}>
                <option value="">All Types</option>
                {uniqueRoomTypes.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block font-mono text-[10px] tracking-[0.12em] uppercase text-gray-500 mb-1">Attribute</label>
              <select value={attributeFilter} onChange={(e) => setAttributeFilter(e.target.value)} className={selectClass}>
                <option value="">All Attributes</option>
                {uniqueAttributes.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
          </div>

          {/* Row 2: Item filters */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1 border-t border-gray-800">
            <div className="relative">
              <label className="block font-mono text-[10px] tracking-[0.12em] uppercase text-gray-500 mb-1">Item Type</label>
              <Search className="absolute left-2.5 bottom-2 text-gray-600 h-3.5 w-3.5" />
              <input
                type="text"
                placeholder="Search by type name..."
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="w-full pl-8 pr-4 py-1.5 bg-gray-950 border border-gray-800 outline-none focus:border-blue-600 focus:ring-1 ring-blue-600/30 text-xs font-mono text-gray-200 placeholder:text-gray-700 transition-colors"
              />
            </div>
            <div>
              <label className="block font-mono text-[10px] tracking-[0.12em] uppercase text-gray-500 mb-1">Condition</label>
              <select value={qualityFilter} onChange={(e) => setQualityFilter(e.target.value)} className={selectClass}>
                <option value="">All Conditions</option>
                <option value="Excellent">Excellent</option>
                <option value="Good">Good</option>
                <option value="Fair">Fair</option>
                <option value="Poor">Poor</option>
              </select>
            </div>
          </div>

          {/* Active filter summary + clear */}
          {(levelFilter || buildingFilter || roomTypeFilter || typeFilter || qualityFilter || attributeFilter) && (
            <div className="flex items-center gap-3 pt-1 flex-wrap">
              <span className="font-mono text-[10px] text-gray-400">{filteredItems.length} result{filteredItems.length !== 1 ? 's' : ''}</span>
              <button
                onClick={() => { setLevelFilter(''); setBuildingFilter(''); setRoomTypeFilter(''); setTypeFilter(''); setQualityFilter(''); setAttributeFilter(''); }}
                className="font-mono text-[10px] tracking-wider uppercase text-gray-500 hover:text-gray-200 transition-colors border-b border-gray-700 hover:border-gray-400"
              >
                Clear filters
              </button>
            </div>
          )}
        </div>

        {/* Table */}
        <div className="border border-t-0 border-gray-800 overflow-hidden">
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-900/60 border-b border-gray-800">
                  <th className="pl-5 pr-2 py-3 w-10">
                    <Checkbox
                      checked={allFilteredSelected}
                      indeterminate={someFilteredSelected && !allFilteredSelected}
                      onChange={toggleSelectAll}
                    />
                  </th>
                  <th className="px-4 py-3 font-mono text-[10px] tracking-[0.12em] uppercase text-gray-500">Photo</th>
                  <th className="px-4 py-3 font-mono text-[10px] tracking-[0.12em] uppercase text-gray-500">Type & Attributes</th>
                  <th className="px-4 py-3 font-mono text-[10px] tracking-[0.12em] uppercase text-gray-500">Condition</th>
                  <th className="px-4 py-3 font-mono text-[10px] tracking-[0.12em] uppercase text-gray-500">Location</th>
                  <th className="px-4 py-3 font-mono text-[10px] tracking-[0.12em] uppercase text-gray-500">Added</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} className="px-6 py-12 text-center font-mono text-xs text-gray-500 tracking-widest">LOADING...</td></tr>
                ) : filteredItems.length === 0 ? (
                  <tr><td colSpan={6} className="px-6 py-12 text-center font-mono text-xs text-gray-500 tracking-widest">NO RESULTS</td></tr>
                ) : filteredItems.map(item => {
                  const isSelected = selectedIds.has(item.id);
                  return (
                    <tr
                      key={item.id}
                      onClick={() => toggleItem(item.id)}
                      className={`transition-colors cursor-pointer group border-l-2 border-b ${
                        isSelected
                          ? 'bg-blue-500/5 border-l-blue-500 border-b-blue-900/30'
                          : 'border-l-transparent border-b-gray-800/50 hover:bg-gray-900/50 hover:border-l-gray-700'
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="pl-5 pr-2 py-3 w-10">
                        <Checkbox checked={isSelected} onChange={() => toggleItem(item.id)} />
                      </td>

                      {/* Photo */}
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <a href={item.photo_url} target="_blank" rel="noreferrer" className="block w-10 h-10 overflow-hidden border border-gray-800 group-hover:border-gray-700 shrink-0 transition-colors">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          {lowBandwidth
                            ? <div className="w-full h-full bg-gray-900 flex items-center justify-center text-gray-700"><Package size={14} /></div>
                            : <img src={item.photo_url} alt={item.ItemTypes?.name} className="w-full h-full object-cover" loading="lazy" />}
                        </a>
                      </td>

                      {/* Type & Attributes */}
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-100 text-sm">{item.ItemTypes?.name}</div>
                        {item.attributes?.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {(() => {
                              const sorted = [...item.attributes].sort((a: string, b: string) => {
                                const aP = tagMeta.get(`${item.item_type_id}:${a}`) ?? false;
                                const bP = tagMeta.get(`${item.item_type_id}:${b}`) ?? false;
                                if (aP !== bP) return aP ? -1 : 1;
                                return a.localeCompare(b);
                              });
                              return sorted.map((tag: string, i: number) => {
                                const isParent = tagMeta.get(`${item.item_type_id}:${tag}`) ?? false;
                                return (
                                  <span key={i} className={`font-mono text-[10px] uppercase px-1.5 py-0.5 border ${
                                    isParent
                                      ? 'text-amber-400 bg-amber-900/20 border-amber-800/60'
                                      : 'text-blue-400 bg-blue-900/15 border-blue-800/40'
                                  }`}>{tag}</span>
                                );
                              });
                            })()}
                          </div>
                        )}
                        {item.notes && (
                          <div className="font-mono text-[10px] text-gray-600 mt-1.5 max-w-xs truncate" title={item.notes}>{item.notes}</div>
                        )}
                      </td>

                      {/* Condition */}
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          {item.qty_excellent > 0 && <span className="inline-flex items-center gap-1.5 font-mono text-[10px] text-green-400 bg-green-900/15 px-2 py-0.5 border border-green-800/40 w-max"><span className="font-semibold">{item.qty_excellent}</span> EXC</span>}
                          {item.qty_good > 0    && <span className="inline-flex items-center gap-1.5 font-mono text-[10px] text-blue-400 bg-blue-900/15 px-2 py-0.5 border border-blue-800/40 w-max"><span className="font-semibold">{item.qty_good}</span> GD</span>}
                          {item.qty_fair > 0    && <span className="inline-flex items-center gap-1.5 font-mono text-[10px] text-yellow-400 bg-yellow-900/15 px-2 py-0.5 border border-yellow-800/40 w-max"><span className="font-semibold">{item.qty_fair}</span> FAIR</span>}
                          {item.qty_poor > 0    && <span className="inline-flex items-center gap-1.5 font-mono text-[10px] text-red-400 bg-red-900/15 px-2 py-0.5 border border-red-800/40 w-max"><span className="font-semibold">{item.qty_poor}</span> POOR</span>}
                        </div>
                      </td>

                      {/* Location */}
                      <td className="px-4 py-3 min-w-[180px]">
                        <div className="flex items-center gap-1 font-mono text-[10px] text-gray-600 mb-1 flex-wrap">
                          {item.Rooms?.level_name && <span>{item.Rooms.level_name}</span>}
                          {item.Rooms?.level_name && item.Rooms?.building_name && <span className="text-gray-700">›</span>}
                          {item.Rooms?.building_name && <span>{item.Rooms.building_name}</span>}
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-sm font-medium text-gray-200">{item.Rooms?.name}</span>
                          {item.Rooms?.room_type && (
                            <span className="font-mono text-[10px] uppercase tracking-wide text-blue-400 bg-blue-900/15 border border-blue-800/40 px-1.5 py-0.5">{item.Rooms.room_type}</span>
                          )}
                        </div>
                      </td>

                      {/* Added */}
                      <td className="px-4 py-3 font-mono text-[11px] text-gray-600 whitespace-nowrap">
                        {new Date(item.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Floating action bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 bg-gray-900 border border-gray-700 px-5 py-2.5 animate-in slide-in-from-bottom-2 duration-200">
          <span className="font-mono text-[10px] tracking-[0.12em] uppercase text-gray-400">
            <span className="text-gray-100 font-semibold">{selectedIds.size}</span> selected
          </span>
          <div className="w-px h-3 bg-gray-700" />
          <button
            onClick={() => setMassEditOpen(true)}
            className="flex items-center gap-1.5 font-mono text-[10px] tracking-wider uppercase text-blue-400 border border-blue-700/50 hover:border-blue-500 bg-blue-600/5 hover:bg-blue-600/15 px-3 py-1.5 transition-colors"
          >
            <Pencil size={11} /> Mass Edit
          </button>
          <button
            onClick={clearSelection}
            className="text-gray-600 hover:text-gray-300 transition-colors p-0.5"
            title="Clear selection"
          >
            <X size={13} />
          </button>
        </div>
      )}

      {massEditOpen && (
        <MassEditModal
          selectedIds={[...selectedIds]}
          selectedItems={selectedItems}
          allItems={items}
          onClose={() => setMassEditOpen(false)}
          onSaved={() => { clearSelection(); fetchItems(); }}
        />
      )}
    </div>
  );
}

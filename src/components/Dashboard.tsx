'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Download, Filter, Search } from 'lucide-react';
import Papa from 'papaparse';

export default function Dashboard() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Hierarchical zone filters — each level resets the ones below it
  const [levelFilter,    setLevelFilter]    = useState('');
  const [buildingFilter, setBuildingFilter] = useState('');
  const [roomTypeFilter, setRoomTypeFilter] = useState('');
  const [roomFilter,     setRoomFilter]     = useState('');

  // Item filters
  const [typeFilter,    setTypeFilter]    = useState('');
  const [qualityFilter, setQualityFilter] = useState('');

  useEffect(() => { fetchItems(); }, []);

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
    if (data) setItems(data);
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

  const uniqueRooms = Array.from(new Set(
    items
      .filter(i => (!levelFilter    || i.Rooms?.level_name    === levelFilter)
                && (!buildingFilter || i.Rooms?.building_name === buildingFilter)
                && (!roomTypeFilter || i.Rooms?.room_type     === roomTypeFilter))
      .map(i => i.Rooms?.name).filter(Boolean)
  )).sort();

  // --- Filter application ---

  const filteredItems = items.filter(item => {
    if (levelFilter    && item.Rooms?.level_name    !== levelFilter)    return false;
    if (buildingFilter && item.Rooms?.building_name !== buildingFilter) return false;
    if (roomTypeFilter && item.Rooms?.room_type     !== roomTypeFilter) return false;
    if (roomFilter     && item.Rooms?.name          !== roomFilter)     return false;
    if (typeFilter && !(item.ItemTypes?.name || '').toLowerCase().includes(typeFilter.toLowerCase())) return false;
    if (qualityFilter === 'Excellent' && item.qty_excellent === 0) return false;
    if (qualityFilter === 'Good'      && item.qty_good      === 0) return false;
    if (qualityFilter === 'Fair'      && item.qty_fair      === 0) return false;
    if (qualityFilter === 'Poor'      && item.qty_poor      === 0) return false;
    return true;
  });

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
      'Attributes':     Array.isArray(item.attributes) ? item.attributes.join(', ') : '',
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

  const selectClass = "w-full px-3 py-2 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg outline-none focus:ring-2 ring-blue-500/50 appearance-none text-gray-700 dark:text-gray-200 text-sm";

  return (
    <div className="flex-1 w-full bg-gray-50 dark:bg-gray-950 flex flex-col items-center py-8 px-4 sm:px-8 overflow-y-auto custom-scrollbar">
      <div className="max-w-7xl w-full">

        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">Inventory Dashboard</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">View, filter, and export the logged FFE items.</p>
          </div>
          <button
            onClick={exportCSV}
            className="bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-lg shadow-sm font-medium flex items-center gap-2 transition-all active:scale-95"
          >
            <Download size={18} /> Export CSV
          </button>
        </div>

        {/* Filter Panel */}
        <div className="bg-white dark:bg-gray-900 p-5 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 mb-6 space-y-4">
          <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 font-semibold text-sm">
            <Filter size={15} /> Filters
          </div>

          {/* Row 1: Location hierarchy */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {/* Level */}
            <div>
              <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Level</label>
              <select
                value={levelFilter}
                onChange={(e) => { setLevelFilter(e.target.value); setBuildingFilter(''); setRoomTypeFilter(''); setRoomFilter(''); }}
                className={selectClass}
              >
                <option value="">All Levels</option>
                {uniqueLevels.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>

            {/* Building */}
            <div>
              <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Building</label>
              <select
                value={buildingFilter}
                onChange={(e) => { setBuildingFilter(e.target.value); setRoomTypeFilter(''); setRoomFilter(''); }}
                className={selectClass}
              >
                <option value="">All Buildings</option>
                {uniqueBuildings.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>

            {/* Room Type */}
            <div>
              <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Room Type</label>
              <select
                value={roomTypeFilter}
                onChange={(e) => { setRoomTypeFilter(e.target.value); setRoomFilter(''); }}
                className={selectClass}
              >
                <option value="">All Types</option>
                {uniqueRoomTypes.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            {/* Room / Zone */}
            <div>
              <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Room / Zone</label>
              <select
                value={roomFilter}
                onChange={(e) => setRoomFilter(e.target.value)}
                className={selectClass}
              >
                <option value="">All Rooms</option>
                {uniqueRooms.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>

          {/* Row 2: Item filters */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1 border-t border-gray-100 dark:border-gray-800">
            <div className="relative">
              <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Item Type</label>
              <Search className="absolute left-3 bottom-2.5 text-gray-400 h-4 w-4" />
              <input
                type="text"
                placeholder="Search by type name..."
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg outline-none focus:ring-2 ring-blue-500/50 text-sm"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Condition</label>
              <select
                value={qualityFilter}
                onChange={(e) => setQualityFilter(e.target.value)}
                className={selectClass}
              >
                <option value="">All Conditions</option>
                <option value="Excellent">Excellent</option>
                <option value="Good">Good</option>
                <option value="Fair">Fair</option>
                <option value="Poor">Poor</option>
              </select>
            </div>
          </div>

          {/* Active filter summary + clear */}
          {(levelFilter || buildingFilter || roomTypeFilter || roomFilter || typeFilter || qualityFilter) && (
            <div className="flex items-center gap-2 pt-1 flex-wrap">
              <span className="text-xs text-gray-400">{filteredItems.length} result{filteredItems.length !== 1 ? 's' : ''}</span>
              <button
                onClick={() => { setLevelFilter(''); setBuildingFilter(''); setRoomTypeFilter(''); setRoomFilter(''); setTypeFilter(''); setQualityFilter(''); }}
                className="text-xs text-red-500 hover:text-red-600 font-medium underline"
              >
                Clear all filters
              </button>
            </div>
          )}
        </div>

        {/* Table */}
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden">
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-950/50 border-b border-gray-200 dark:border-gray-800 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  <th className="px-6 py-4">Photo</th>
                  <th className="px-6 py-4">Type & Attributes</th>
                  <th className="px-6 py-4">Condition</th>
                  <th className="px-6 py-4">Location</th>
                  <th className="px-6 py-4">Added</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60">
                {loading ? (
                  <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-500">Loading data...</td></tr>
                ) : filteredItems.length === 0 ? (
                  <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-500">No items found matching the filters.</td></tr>
                ) : filteredItems.map(item => (
                  <tr key={item.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/20 transition-colors group">

                    {/* Photo */}
                    <td className="px-6 py-4">
                      <a href={item.photo_url} target="_blank" rel="noreferrer" className="block w-12 h-12 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 group-hover:border-blue-300 shrink-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={item.photo_url} alt={item.ItemTypes?.name} className="w-full h-full object-cover" />
                      </a>
                    </td>

                    {/* Type & Attributes */}
                    <td className="px-6 py-4">
                      <div className="font-semibold text-gray-900 dark:text-gray-100">{item.ItemTypes?.name}</div>
                      {item.attributes?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {item.attributes.map((tag: string, i: number) => (
                            <span key={i} className="text-[10px] uppercase font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-1.5 py-0.5 rounded-sm">{tag}</span>
                          ))}
                        </div>
                      )}
                      {item.notes && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1.5 max-w-xs truncate italic" title={item.notes}>{item.notes}</div>
                      )}
                    </td>

                    {/* Condition */}
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        {item.qty_excellent > 0 && <span className="inline-flex items-center gap-1.5 text-xs font-medium text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-2.5 py-1 rounded-full border border-green-200 dark:border-green-800/50 w-max"><span className="font-bold">{item.qty_excellent}</span> Excellent</span>}
                        {item.qty_good > 0    && <span className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2.5 py-1 rounded-full border border-blue-200 dark:border-blue-800/50 w-max"><span className="font-bold">{item.qty_good}</span> Good</span>}
                        {item.qty_fair > 0    && <span className="inline-flex items-center gap-1.5 text-xs font-medium text-yellow-700 dark:text-yellow-500 bg-yellow-50 dark:bg-yellow-900/20 px-2.5 py-1 rounded-full border border-yellow-200 dark:border-yellow-800/50 w-max"><span className="font-bold">{item.qty_fair}</span> Fair</span>}
                        {item.qty_poor > 0    && <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-2.5 py-1 rounded-full border border-red-200 dark:border-red-800/50 w-max"><span className="font-bold">{item.qty_poor}</span> Poor</span>}
                      </div>
                    </td>

                    {/* Location — full hierarchy */}
                    <td className="px-6 py-4 min-w-[180px]">
                      {/* Breadcrumb: Level → Building */}
                      <div className="flex items-center gap-1 text-[11px] text-gray-400 dark:text-gray-500 font-medium mb-1 flex-wrap">
                        {item.Rooms?.level_name && (
                          <span>{item.Rooms.level_name}</span>
                        )}
                        {item.Rooms?.level_name && item.Rooms?.building_name && (
                          <span className="text-gray-300 dark:text-gray-600">›</span>
                        )}
                        {item.Rooms?.building_name && (
                          <span>{item.Rooms.building_name}</span>
                        )}
                      </div>
                      {/* Room name + type badge */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">{item.Rooms?.name}</span>
                        {item.Rooms?.room_type && (
                          <span className="text-[10px] uppercase tracking-wider font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-1.5 py-0.5 rounded-sm">{item.Rooms.room_type}</span>
                        )}
                      </div>
                    </td>

                    {/* Added */}
                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      {new Date(item.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

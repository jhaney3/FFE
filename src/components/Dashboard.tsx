'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Download, Filter, Image as ImageIcon, Search } from 'lucide-react';
import Papa from 'papaparse';

export default function Dashboard() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [roomFilter, setRoomFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [qualityFilter, setQualityFilter] = useState('');

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('InventoryItems')
      .select(`
        *,
        ItemTypes (
          name
        ),
        Rooms (
          name,
          level_name,
          building_name,
          room_type,
          page_number,
          FloorPlans (
            name
          )
        )
      `)
      .order('created_at', { ascending: false });

    if (data) setItems(data);
    setLoading(false);
  };

  const filteredItems = items.filter(item => {
    if (roomFilter && item.Rooms?.name !== roomFilter) return false;
    const typeName = item.ItemTypes?.name || '';
    if (typeFilter && !typeName.toLowerCase().includes(typeFilter.toLowerCase())) return false;
    if (qualityFilter) {
      if (qualityFilter === 'Excellent' && item.qty_excellent === 0) return false;
      if (qualityFilter === 'Good' && item.qty_good === 0) return false;
      if (qualityFilter === 'Fair' && item.qty_fair === 0) return false;
      if (qualityFilter === 'Poor' && item.qty_poor === 0) return false;
    }
    return true;
  });

  const uniqueRooms = Array.from(new Set(items.map(item => item.Rooms?.name).filter(Boolean)));
  const uniqueQualities = ['Excellent', 'Good', 'Fair', 'Poor'];

  const exportCSV = () => {
    const csvData = filteredItems.map(item => ({
      'Item ID': item.id,
      'Floor Plan': item.Rooms?.FloorPlans?.name || 'Unknown',
      'Building': item.Rooms?.building_name || '',
      'Level': item.Rooms?.level_name || '',
      'Room/Zone Name': item.Rooms?.name || 'Unknown',
      'Room Type': item.Rooms?.room_type || '',
      'Page Number': item.Rooms?.page_number || 1,
      'Item Type': item.ItemTypes?.name || '',
      'Qty Excellent': item.qty_excellent,
      'Qty Good': item.qty_good,
      'Qty Fair': item.qty_fair,
      'Qty Poor': item.qty_poor,
      'Total Quantity': item.qty_excellent + item.qty_good + item.qty_fair + item.qty_poor,
      'Tags': Array.isArray(item.attributes) ? item.attributes.join(', ') : '',
      'Notes': item.notes || '',
      'Photo URL': item.photo_url,
      'Added At': new Date(item.created_at).toLocaleString(),
    }));

    const csvStr = Papa.unparse(csvData);
    const blob = new Blob([csvStr], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `inventory_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex-1 w-full bg-gray-50 dark:bg-gray-950 flex flex-col items-center py-8 px-4 sm:px-8 overflow-y-auto w-full custom-scrollbar">
      <div className="max-w-7xl w-full">
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

        <div className="bg-white dark:bg-gray-900 p-5 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 mb-6 flex flex-col md:flex-row gap-4 items-center">
          <div className="flex items-center gap-2 text-gray-500 font-medium whitespace-nowrap mr-2">
            <Filter size={18} /> Filters
          </div>
          
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
            <input 
              type="text" 
              placeholder="Search by Type..." 
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg outline-none focus:ring-2 ring-blue-500/50 transition-shadow"
            />
          </div>

          <div className="w-full md:w-64">
            <select 
              value={roomFilter} 
              onChange={(e) => setRoomFilter(e.target.value)}
              className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg outline-none focus:ring-2 ring-blue-500/50 appearance-none text-gray-700 dark:text-gray-200"
            >
              <option value="">All Rooms</option>
              {uniqueRooms.map((roomName: any) => (
                <option key={roomName} value={roomName}>{roomName}</option>
              ))}
            </select>
          </div>

          <div className="w-full md:w-48">
            <select 
              value={qualityFilter} 
              onChange={(e) => setQualityFilter(e.target.value)}
              className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg outline-none focus:ring-2 ring-blue-500/50 appearance-none text-gray-700 dark:text-gray-200"
            >
              <option value="">All Qualities</option>
              {uniqueQualities.map((q: any) => (
                <option key={q} value={q}>{q}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden">
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-950/50 border-b border-gray-200 dark:border-gray-800 text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  <th className="px-6 py-4">Photo</th>
                  <th className="px-6 py-4">Type & Details</th>
                  <th className="px-6 py-4">Quantities</th>
                  <th className="px-6 py-4">Zone Details</th>
                  <th className="px-6 py-4">Added</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                      Loading data...
                    </td>
                  </tr>
                ) : filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                      No items found matching the filters.
                    </td>
                  </tr>
                ) : (
                  filteredItems.map(item => (
                    <tr key={item.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/20 transition-colors group">
                      <td className="px-6 py-4">
                        <a href={item.photo_url} target="_blank" rel="noreferrer" className="block relative w-12 h-12 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 group-hover:border-blue-300">
                           {/* eslint-disable-next-line @next/next/no-img-element */}
                           <img src={item.photo_url} alt={item.ItemTypes?.name} className="w-full h-full object-cover" />
                        </a>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-semibold text-gray-900 dark:text-gray-100">{item.ItemTypes?.name}</div>
                        {item.attributes && item.attributes.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {item.attributes.map((tag: string, i: number) => (
                              <span key={i} className="text-[10px] uppercase font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-1.5 py-0.5 rounded-sm">
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                        {item.notes && (
                          <div className="text-xs text-gray-500 mt-1.5 max-w-xs truncate" title={item.notes}>
                            {item.notes}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1.5">
                          {item.qty_excellent > 0 && <span className="inline-flex items-center gap-1.5 text-xs font-medium text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-2.5 py-1 rounded-full border border-green-200 dark:border-green-800/50 w-max"><span className="font-bold">{item.qty_excellent}</span> Excellent</span>}
                          {item.qty_good > 0 && <span className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2.5 py-1 rounded-full border border-blue-200 dark:border-blue-800/50 w-max"><span className="font-bold">{item.qty_good}</span> Good</span>}
                          {item.qty_fair > 0 && <span className="inline-flex items-center gap-1.5 text-xs font-medium text-yellow-700 dark:text-yellow-500 bg-yellow-50 dark:bg-yellow-900/20 px-2.5 py-1 rounded-full border border-yellow-200 dark:border-yellow-800/50 w-max"><span className="font-bold">{item.qty_fair}</span> Fair</span>}
                          {item.qty_poor > 0 && <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-2.5 py-1 rounded-full border border-red-200 dark:border-red-800/50 w-max"><span className="font-bold">{item.qty_poor}</span> Poor</span>}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-800 dark:text-gray-200">
                          {item.Rooms?.name} {item.Rooms?.room_type && <span className="text-gray-500 font-normal">({item.Rooms.room_type})</span>}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5 truncate max-w-[200px]">
                          {item.Rooms?.building_name && `Bldg: ${item.Rooms.building_name} | `}
                          {item.Rooms?.level_name && `Level: ${item.Rooms.level_name} | `}
                          {item.Rooms?.FloorPlans?.name} (Pg {item.Rooms?.page_number || 1})
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                        {new Date(item.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

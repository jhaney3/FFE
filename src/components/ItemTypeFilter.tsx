'use client';

import { useState, useMemo } from 'react';
import { SlidersHorizontal, X, ChevronRight, ChevronDown, FileOutput } from 'lucide-react';

interface Props {
  items: any[];
  activeType: string | null;
  activeAttribute: string | null;
  onSelect: (type: string | null, attribute: string | null) => void;
  floorplanId?: string | null;
  pageNumber?: number;
}

export default function ItemTypeFilter({ items, activeType, activeAttribute, onSelect, floorplanId, pageNumber = 1 }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [expandedType, setExpandedType] = useState<string | null>(null);

  const typeData = useMemo(() => {
    const map = new Map<string, { total: number; attributes: Map<string, number> }>();
    for (const item of items) {
      const typeName = item.ItemTypes?.name;
      if (!typeName) continue;
      const qty = (item.qty_excellent || 0) + (item.qty_good || 0) + (item.qty_fair || 0) + (item.qty_poor || 0);
      if (!map.has(typeName)) map.set(typeName, { total: 0, attributes: new Map() });
      const entry = map.get(typeName)!;
      entry.total += qty;
      const combo = item.attributes?.length > 0 ? item.attributes.join(', ') : '(no attributes)';
      entry.attributes.set(combo, (entry.attributes.get(combo) || 0) + qty);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, data]) => ({
        name,
        total: data.total,
        attributes: Array.from(data.attributes.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([combo, count]) => ({ combo, count })),
      }));
  }, [items]);

  const filtered = search.trim()
    ? typeData.filter(t => t.name.toLowerCase().includes(search.toLowerCase()))
    : typeData;

  const handleExport = () => {
    if (!activeType || !floorplanId) return;
    const params = new URLSearchParams({
      mapOnly: 'true',
      floorplan: floorplanId,
      page: String(pageNumber),
      spotlightType: activeType,
      ...(activeAttribute ? { spotlightAttribute: activeAttribute } : {}),
    });
    window.open(`/report?${params.toString()}`, '_blank');
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className={`absolute bottom-20 left-6 z-20 flex items-center gap-2 px-3.5 py-2 rounded-full shadow-lg backdrop-blur-md text-sm font-semibold border transition-all ${
          activeType
            ? 'bg-indigo-600 text-white border-indigo-500 shadow-indigo-500/40'
            : 'bg-white/90 dark:bg-black/90 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-800 hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-400'
        }`}
      >
        <SlidersHorizontal size={15} />
        <span>{activeType ?? 'Spotlight'}</span>
        {activeType && <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />}
      </button>
    );
  }

  return (
    <div className="absolute bottom-20 left-6 z-20 w-64 bg-white/95 dark:bg-gray-950/95 backdrop-blur-md border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-2">
          <SlidersHorizontal size={14} className="text-indigo-500" />
          <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">Spotlight Filter</span>
        </div>
        <div className="flex items-center gap-1">
          {activeType && floorplanId && (
            <button
              onClick={handleExport}
              title="Export spotlight map"
              className="p-1 text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
            >
              <FileOutput size={14} />
            </button>
          )}
          {activeType && (
            <button
              onClick={() => { onSelect(null, null); setExpandedType(null); }}
              className="text-xs text-indigo-500 hover:text-indigo-700 font-medium px-1.5 py-0.5 rounded hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
            >
              Clear
            </button>
          )}
          <button
            onClick={() => setOpen(false)}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-800">
        <input
          type="text"
          placeholder="Search item types…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-700 dark:text-gray-300 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
        />
      </div>

      {/* List */}
      <div className="max-h-72 overflow-y-scroll rounded-b-2xl">
        {filtered.length === 0 ? (
          <div className="py-4 text-center text-xs text-gray-400">No item types found</div>
        ) : (
          filtered.map(type => {
            const isTypeActive = activeType === type.name;
            const isExpanded = expandedType === type.name || (isTypeActive && !!activeAttribute);

            return (
              <div key={type.name}>
                <button
                  onClick={() => {
                    onSelect(type.name, null);
                    setExpandedType(prev => prev === type.name ? null : type.name);
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${
                    isTypeActive && !activeAttribute ? 'bg-indigo-50 dark:bg-indigo-900/20' : ''
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full border shrink-0 transition-colors ${
                    isTypeActive && !activeAttribute ? 'bg-indigo-500 border-indigo-500' : 'border-gray-300 dark:border-gray-600'
                  }`} />
                  <span className={`flex-1 text-xs font-medium truncate ${
                    isTypeActive && !activeAttribute ? 'text-indigo-700 dark:text-indigo-300' : 'text-gray-700 dark:text-gray-300'
                  }`}>
                    {type.name}
                  </span>
                  <span className="text-[10px] text-gray-400 font-medium shrink-0">{type.total}</span>
                  {isExpanded
                    ? <ChevronDown size={12} className="text-gray-300 dark:text-gray-600 shrink-0" />
                    : <ChevronRight size={12} className="text-gray-300 dark:text-gray-600 shrink-0" />
                  }
                </button>

                {isExpanded && type.attributes.map(attr => {
                  const isAttrActive = isTypeActive && activeAttribute === attr.combo;
                  return (
                    <button
                      key={attr.combo}
                      onClick={() => onSelect(type.name, attr.combo)}
                      className={`w-full flex items-center gap-2 pl-7 pr-3 py-1.5 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${
                        isAttrActive ? 'bg-indigo-50 dark:bg-indigo-900/20' : ''
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full border shrink-0 transition-colors ${
                        isAttrActive ? 'bg-indigo-500 border-indigo-500' : 'border-gray-300 dark:border-gray-600'
                      }`} />
                      <span className={`flex-1 text-[11px] truncate ${
                        isAttrActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-500 dark:text-gray-400'
                      }`}>
                        {attr.combo}
                      </span>
                      <span className="text-[10px] text-gray-400">{attr.count}</span>
                    </button>
                  );
                })}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

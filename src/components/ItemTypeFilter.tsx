'use client';

import { useState, useMemo, useEffect } from 'react';
import { SlidersHorizontal, X, ChevronRight, ChevronDown, FileOutput } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { childDisplayLabel } from '@/lib/attributeUtils';

interface Props {
  items: any[];
  activeType: string | null;
  activeParent: string | null;
  activeAttribute: string | null;
  onSelect: (type: string | null, parent: string | null, attribute: string | null) => void;
  floorplanId?: string | null;
  pageNumber?: number;
}

export default function ItemTypeFilter({
  items, activeType, activeParent, activeAttribute, onSelect, floorplanId, pageNumber = 1,
}: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [expandedType, setExpandedType] = useState<string | null>(null);
  const [expandedParent, setExpandedParent] = useState<string | null>(null);

  // tagMeta: `${item_type_id}:${name}` → true  (only is_parent=true entries stored)
  const [tagMeta, setTagMeta] = useState<Map<string, boolean>>(new Map());
  // typesWithParents: Set of item_type_ids that have at least one is_parent tag
  const [typesWithParents, setTypesWithParents] = useState<Set<string>>(new Set());

  useEffect(() => {
    const typeIds = [...new Set(items.map(i => i.item_type_id).filter(Boolean))];
    if (typeIds.length === 0) return;
    supabase.from('ItemTypeAttributes')
      .select('item_type_id, name, is_parent')
      .in('item_type_id', typeIds)
      .eq('is_parent', true)
      .then(({ data }) => {
        const meta = new Map<string, boolean>();
        const withParents = new Set<string>();
        (data || []).forEach(t => {
          meta.set(`${t.item_type_id}:${t.name}`, true);
          withParents.add(t.item_type_id);
        });
        setTagMeta(meta);
        setTypesWithParents(withParents);
      });
  }, [items]);

  // ── Build 3-level typeData ────────────────────────────────────────────────
  const typeData = useMemo(() => {
    // typeId: typeName
    const typeNameMap = new Map<string, string>();
    items.forEach(i => { if (i.item_type_id && i.ItemTypes?.name) typeNameMap.set(i.item_type_id, i.ItemTypes.name); });

    // typeName → { total, hasParents, parentGroups: Map<parentAttr, { total, combos: Map<fullCombo, count> }> }
    const typeMap = new Map<string, {
      total: number;
      typeId: string;
      hasParents: boolean;
      parentGroups: Map<string, { total: number; combos: Map<string, number> }>;
    }>();

    for (const item of items) {
      const typeName = item.ItemTypes?.name;
      if (!typeName) continue;
      const qty = (item.qty_excellent || 0) + (item.qty_good || 0) + (item.qty_fair || 0) + (item.qty_poor || 0);

      if (!typeMap.has(typeName)) {
        typeMap.set(typeName, { total: 0, typeId: item.item_type_id, hasParents: false, parentGroups: new Map() });
      }
      const te = typeMap.get(typeName)!;
      te.total += qty;

      const hasParents = typesWithParents.has(item.item_type_id);
      if (hasParents) te.hasParents = true;

      const attrs: string[] = item.attributes || [];
      const parentAttr = hasParents
        ? (attrs.find(a => tagMeta.get(`${item.item_type_id}:${a}`)) || '(ungrouped)')
        : '(flat)'; // sentinel: no parent level

      const fullCombo = attrs.length > 0 ? attrs.join(', ') : '(no attributes)';

      if (!te.parentGroups.has(parentAttr)) te.parentGroups.set(parentAttr, { total: 0, combos: new Map() });
      const pg = te.parentGroups.get(parentAttr)!;
      pg.total += qty;
      pg.combos.set(fullCombo, (pg.combos.get(fullCombo) || 0) + qty);
    }

    return Array.from(typeMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, data]) => ({
        name,
        total: data.total,
        typeId: data.typeId,
        hasParents: data.hasParents,
        parentGroups: Array.from(data.parentGroups.entries())
          .sort(([a], [b]) => a === '(ungrouped)' ? 1 : b === '(ungrouped)' ? -1 : a.localeCompare(b))
          .map(([parentAttr, pg]) => ({
            parentAttr,
            total: pg.total,
            combos: Array.from(pg.combos.entries())
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([fullCombo, count]) => ({ fullCombo, count })),
          })),
      }));
  }, [items, tagMeta, typesWithParents]);

  const filtered = search.trim()
    ? typeData.filter(t => t.name.toLowerCase().includes(search.toLowerCase()))
    : typeData;

  const handleExport = () => {
    if (!activeType || !floorplanId) return;
    const params = new URLSearchParams({
      mapOnly:      'true',
      floorplan:    floorplanId,
      page:         String(pageNumber),
      spotlightType: activeType,
      ...(activeParent    ? { spotlightParent:    activeParent    } : {}),
      ...(activeAttribute ? { spotlightAttribute: activeAttribute } : {}),
    });
    window.open(`/report?${params.toString()}`, '_blank');
  };

  const handleClear = () => { onSelect(null, null, null); setExpandedType(null); setExpandedParent(null); };

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
        <span>
          {activeType
            ? activeParent
              ? activeAttribute
                ? `${activeType} › ${activeParent} › ${childDisplayLabel(activeAttribute, activeParent)}`
                : `${activeType} › ${activeParent}`
              : activeType
            : 'Spotlight'}
        </span>
        {activeType && <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />}
      </button>
    );
  }

  return (
    <div className="absolute bottom-20 left-6 z-20 w-72 bg-white/95 dark:bg-gray-950/95 backdrop-blur-md border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl">
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
              onClick={handleClear}
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
      <div className="max-h-80 overflow-y-scroll rounded-b-2xl custom-scrollbar">
        {filtered.length === 0 ? (
          <div className="py-4 text-center text-xs text-gray-400">No item types found</div>
        ) : (
          filtered.map(type => {
            const isTypeActive = activeType === type.name;
            const isExpanded   = expandedType === type.name || isTypeActive;

            return (
              <div key={type.name}>
                {/* ── Type row ── */}
                <button
                  onClick={() => {
                    onSelect(type.name, null, null);
                    setExpandedType(prev => prev === type.name ? null : type.name);
                    setExpandedParent(null);
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${
                    isTypeActive && !activeParent && !activeAttribute ? 'bg-indigo-50 dark:bg-indigo-900/20' : ''
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full border shrink-0 transition-colors ${
                    isTypeActive && !activeParent ? 'bg-indigo-500 border-indigo-500' : 'border-gray-300 dark:border-gray-600'
                  }`} />
                  <span className={`flex-1 text-xs font-medium truncate ${
                    isTypeActive && !activeParent ? 'text-indigo-700 dark:text-indigo-300' : 'text-gray-700 dark:text-gray-300'
                  }`}>{type.name}</span>
                  <span className="text-[10px] text-gray-400 font-medium shrink-0">{type.total}</span>
                  {isExpanded
                    ? <ChevronDown size={12} className="text-gray-300 dark:text-gray-600 shrink-0" />
                    : <ChevronRight size={12} className="text-gray-300 dark:text-gray-600 shrink-0" />
                  }
                </button>

                {/* ── Expanded content ── */}
                {isExpanded && (
                  type.hasParents ? (
                    // ── 3-level: parent groups ──
                    type.parentGroups.map(pg => {
                      const isParentActive    = isTypeActive && activeParent === pg.parentAttr;
                      const isParentExpanded  = expandedParent === `${type.name}::${pg.parentAttr}` || isParentActive;
                      const isUngrouped       = pg.parentAttr === '(ungrouped)';

                      return (
                        <div key={pg.parentAttr}>
                          {/* Parent attr row */}
                          <button
                            onClick={() => {
                              onSelect(type.name, pg.parentAttr, null);
                              setExpandedParent(prev =>
                                prev === `${type.name}::${pg.parentAttr}`
                                  ? null
                                  : `${type.name}::${pg.parentAttr}`
                              );
                            }}
                            className={`w-full flex items-center gap-2 pl-6 pr-3 py-1.5 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${
                              isParentActive && !activeAttribute ? 'bg-amber-50 dark:bg-amber-900/20' : ''
                            }`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full border shrink-0 ${
                              isParentActive && !activeAttribute
                                ? 'bg-amber-500 border-amber-500'
                                : 'border-gray-300 dark:border-gray-600'
                            }`} />
                            <span className={`flex-1 text-[11px] font-semibold truncate ${
                              isParentActive && !activeAttribute
                                ? 'text-amber-700 dark:text-amber-300'
                                : isUngrouped
                                  ? 'text-gray-400 italic'
                                  : 'text-gray-600 dark:text-gray-400'
                            }`}>{pg.parentAttr}</span>
                            <span className="text-[10px] text-gray-400">{pg.total}</span>
                            {isParentExpanded
                              ? <ChevronDown size={11} className="text-gray-300 dark:text-gray-600 shrink-0" />
                              : <ChevronRight size={11} className="text-gray-300 dark:text-gray-600 shrink-0" />
                            }
                          </button>

                          {/* Child combo rows */}
                          {isParentExpanded && pg.combos.map(({ fullCombo, count }) => {
                            const isActive = isTypeActive && activeAttribute === fullCombo;
                            const label    = childDisplayLabel(fullCombo, isUngrouped ? null : pg.parentAttr);
                            return (
                              <button
                                key={fullCombo}
                                onClick={() => onSelect(type.name, pg.parentAttr, fullCombo)}
                                className={`w-full flex items-center gap-2 pl-10 pr-3 py-1.5 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${
                                  isActive ? 'bg-indigo-50 dark:bg-indigo-900/20' : ''
                                }`}
                              >
                                <span className={`w-1.5 h-1.5 rounded-full border shrink-0 ${
                                  isActive ? 'bg-indigo-500 border-indigo-500' : 'border-gray-300 dark:border-gray-600'
                                }`} />
                                <span className={`flex-1 text-[11px] truncate ${
                                  isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-500 dark:text-gray-400'
                                }`}>{label}</span>
                                <span className="text-[10px] text-gray-400">{count}</span>
                              </button>
                            );
                          })}
                        </div>
                      );
                    })
                  ) : (
                    // ── Flat combos (no parent attrs defined for this type) ──
                    type.parentGroups[0]?.combos.map(({ fullCombo, count }) => {
                      const isActive = isTypeActive && activeAttribute === fullCombo;
                      return (
                        <button
                          key={fullCombo}
                          onClick={() => onSelect(type.name, null, fullCombo)}
                          className={`w-full flex items-center gap-2 pl-7 pr-3 py-1.5 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${
                            isActive ? 'bg-indigo-50 dark:bg-indigo-900/20' : ''
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full border shrink-0 ${
                            isActive ? 'bg-indigo-500 border-indigo-500' : 'border-gray-300 dark:border-gray-600'
                          }`} />
                          <span className={`flex-1 text-[11px] truncate ${
                            isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-500 dark:text-gray-400'
                          }`}>{fullCombo}</span>
                          <span className="text-[10px] text-gray-400">{count}</span>
                        </button>
                      );
                    })
                  )
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

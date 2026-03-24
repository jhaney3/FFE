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
  // Controlled mode — if isOpen is provided, the trigger button is not rendered
  isOpen?: boolean;
  onClose?: () => void;
}

export default function ItemTypeFilter({
  items, activeType, activeParent, activeAttribute, onSelect, floorplanId, pageNumber = 1,
  isOpen: controlledOpen, onClose,
}: Props) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [expandedType, setExpandedType] = useState<string | null>(null);
  const [expandedParent, setExpandedParent] = useState<string | null>(null);

  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;

  const closePanel = () => {
    if (isControlled) {
      onClose?.();
    } else {
      setInternalOpen(false);
    }
  };

  // tagMeta: `${item_type_id}:${name}` → true  (only is_parent=true entries stored)
  const [tagMeta, setTagMeta] = useState<Map<string, boolean>>(new Map());
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

  const typeData = useMemo(() => {
    const typeNameMap = new Map<string, string>();
    items.forEach(i => { if (i.item_type_id && i.ItemTypes?.name) typeNameMap.set(i.item_type_id, i.ItemTypes.name); });

    const typeMap = new Map<string, {
      total: number;
      typeId: string;
      hasParents: boolean;
      parentGroups: Map<string, { total: number; combos: Map<string, number> }>;
    }>();

    items.forEach(item => {
      const typeId   = item.item_type_id;
      const typeName = item.ItemTypes?.name;
      if (!typeId || !typeName) return;

      const qty = (item.qty_excellent || 0) + (item.qty_good || 0) + (item.qty_fair || 0) + (item.qty_poor || 0);
      if (!typeMap.has(typeName)) {
        typeMap.set(typeName, { total: 0, typeId, hasParents: typesWithParents.has(typeId), parentGroups: new Map() });
      }
      const td = typeMap.get(typeName)!;
      td.total += qty;

      const attrs: string[] = item.attributes || [];
      const comboKey = attrs.join(', ') || '';
      const parentAttr = attrs.find(a => tagMeta.get(`${typeId}:${a}`)) ?? '(ungrouped)';

      if (!td.parentGroups.has(parentAttr)) td.parentGroups.set(parentAttr, { total: 0, combos: new Map() });
      const pg = td.parentGroups.get(parentAttr)!;
      pg.total += qty;
      pg.combos.set(comboKey, (pg.combos.get(comboKey) ?? 0) + qty);
    });

    return Array.from(typeMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, td]) => ({
        name,
        total: td.total,
        typeId: td.typeId,
        hasParents: td.hasParents,
        parentGroups: Array.from(td.parentGroups.entries())
          .sort(([a], [b]) => {
            if (a === '(ungrouped)') return 1;
            if (b === '(ungrouped)') return -1;
            return a.localeCompare(b);
          })
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

  // ── Uncontrolled trigger button (legacy standalone use) ──────────────────
  if (!isControlled && !open) {
    return (
      <button
        onClick={() => setInternalOpen(true)}
        className={`absolute bottom-20 left-5 z-20 flex items-center gap-1.5 px-3 py-1.5 font-mono text-[10px] tracking-wider uppercase border transition-colors surface-raised ${
          activeType
            ? 'bg-blue-500/15 text-blue-400 border-blue-500'
            : 'bg-gray-900 text-gray-500 border-gray-700 hover:border-gray-500 hover:text-gray-300'
        }`}
      >
        <SlidersHorizontal size={11} />
        {activeType
          ? activeParent
            ? activeAttribute
              ? `${activeType} › ${childDisplayLabel(activeAttribute, activeParent)}`
              : `${activeType} › ${activeParent}`
            : activeType
          : 'Spotlight'}
        {activeType && <span className="w-1 h-1 rounded-full bg-blue-400 animate-pulse" />}
      </button>
    );
  }

  if (!open) return null;

  // ── Panel ─────────────────────────────────────────────────────────────────
  const panelClass = isControlled
    ? 'absolute bottom-14 left-5 z-20 w-72 bg-gray-900 border border-gray-700 surface-raised'
    : 'absolute bottom-20 left-5 z-20 w-72 bg-gray-900 border border-gray-700 surface-raised';

  return (
    <div className={panelClass}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <SlidersHorizontal size={12} className="text-blue-500" />
          <span className="font-mono text-[10px] tracking-[0.15em] uppercase text-gray-400">Spotlight Filter</span>
        </div>
        <div className="flex items-center gap-1">
          {activeType && floorplanId && (
            <button
              onClick={handleExport}
              title="Export spotlight map"
              className="p-1 text-gray-500 hover:text-blue-400 transition-colors"
            >
              <FileOutput size={13} />
            </button>
          )}
          {activeType && (
            <button
              onClick={handleClear}
              className="font-mono text-[10px] tracking-wider uppercase text-gray-600 hover:text-gray-300 px-1.5 py-0.5 border border-transparent hover:border-gray-700 transition-colors"
            >
              Clear
            </button>
          )}
          <button
            onClick={closePanel}
            className="p-1 text-gray-600 hover:text-gray-300 transition-colors"
          >
            <X size={13} />
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="px-3 py-2 border-b border-gray-800">
        <input
          type="text"
          placeholder="Search item types…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full font-mono text-[11px] px-2.5 py-1.5 border border-gray-700 bg-gray-950 text-gray-300 placeholder:text-gray-700 outline-none focus:border-blue-600 transition-colors"
        />
      </div>

      {/* List */}
      <div className="max-h-72 overflow-y-scroll custom-scrollbar">
        {filtered.length === 0 ? (
          <div className="py-4 text-center font-mono text-[10px] text-gray-600 tracking-widest">NO TYPES FOUND</div>
        ) : (
          filtered.map(type => {
            const isTypeActive = activeType === type.name;
            const isExpanded   = expandedType === type.name || isTypeActive;

            return (
              <div key={type.name}>
                {/* Type row */}
                <button
                  onClick={() => {
                    onSelect(type.name, null, null);
                    setExpandedType(prev => prev === type.name ? null : type.name);
                    setExpandedParent(null);
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-colors ${
                    isTypeActive && !activeParent && !activeAttribute
                      ? 'bg-blue-500/8 border-l-2 border-blue-500'
                      : 'hover:bg-gray-800/50 border-l-2 border-transparent'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full border shrink-0 transition-colors ${
                    isTypeActive && !activeParent ? 'bg-blue-500 border-blue-500' : 'border-gray-600'
                  }`} />
                  <span className={`flex-1 text-xs truncate ${
                    isTypeActive && !activeParent ? 'text-blue-400 font-medium' : 'text-gray-300'
                  }`}>{type.name}</span>
                  <span className="font-mono text-[10px] text-gray-600 shrink-0">{type.total}</span>
                  {isExpanded
                    ? <ChevronDown size={11} className="text-gray-600 shrink-0" />
                    : <ChevronRight size={11} className="text-gray-600 shrink-0" />
                  }
                </button>

                {/* Expanded content */}
                {isExpanded && (
                  type.hasParents ? (
                    type.parentGroups.map(pg => {
                      const isParentActive   = isTypeActive && activeParent === pg.parentAttr;
                      const isParentExpanded = expandedParent === `${type.name}::${pg.parentAttr}` || isParentActive;
                      const isUngrouped      = pg.parentAttr === '(ungrouped)';

                      return (
                        <div key={pg.parentAttr}>
                          <button
                            onClick={() => {
                              onSelect(type.name, pg.parentAttr, null);
                              setExpandedParent(prev =>
                                prev === `${type.name}::${pg.parentAttr}`
                                  ? null
                                  : `${type.name}::${pg.parentAttr}`
                              );
                            }}
                            className={`w-full flex items-center gap-2 pl-6 pr-3 py-1.5 text-left transition-colors ${
                              isParentActive && !activeAttribute
                                ? 'bg-amber-900/15 border-l-2 border-amber-500'
                                : 'hover:bg-gray-800/50 border-l-2 border-transparent'
                            }`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full border shrink-0 ${
                              isParentActive && !activeAttribute
                                ? 'bg-amber-500 border-amber-500'
                                : 'border-gray-600'
                            }`} />
                            <span className={`flex-1 text-[11px] truncate ${
                              isParentActive && !activeAttribute
                                ? 'text-amber-400 font-medium'
                                : isUngrouped
                                  ? 'text-gray-600 italic'
                                  : 'text-gray-400'
                            }`}>{pg.parentAttr}</span>
                            <span className="font-mono text-[10px] text-gray-600">{pg.total}</span>
                            {isParentExpanded
                              ? <ChevronDown size={10} className="text-gray-600 shrink-0" />
                              : <ChevronRight size={10} className="text-gray-600 shrink-0" />
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
                                className={`w-full flex items-center gap-2 pl-10 pr-3 py-1.5 text-left transition-colors ${
                                  isActive
                                    ? 'bg-blue-500/8 border-l-2 border-blue-500'
                                    : 'hover:bg-gray-800/50 border-l-2 border-transparent'
                                }`}
                              >
                                <span className={`w-1.5 h-1.5 rounded-full border shrink-0 ${
                                  isActive ? 'bg-blue-500 border-blue-500' : 'border-gray-600'
                                }`} />
                                <span className={`flex-1 text-[11px] truncate ${
                                  isActive ? 'text-blue-400' : 'text-gray-500'
                                }`}>{label}</span>
                                <span className="font-mono text-[10px] text-gray-600">{count}</span>
                              </button>
                            );
                          })}
                        </div>
                      );
                    })
                  ) : (
                    type.parentGroups[0]?.combos.map(({ fullCombo, count }) => {
                      const isActive = isTypeActive && activeAttribute === fullCombo;
                      return (
                        <button
                          key={fullCombo}
                          onClick={() => onSelect(type.name, null, fullCombo)}
                          className={`w-full flex items-center gap-2 pl-7 pr-3 py-1.5 text-left transition-colors ${
                            isActive
                              ? 'bg-blue-500/8 border-l-2 border-blue-500'
                              : 'hover:bg-gray-800/50 border-l-2 border-transparent'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full border shrink-0 ${
                            isActive ? 'bg-blue-500 border-blue-500' : 'border-gray-600'
                          }`} />
                          <span className={`flex-1 text-[11px] truncate ${
                            isActive ? 'text-blue-400' : 'text-gray-500'
                          }`}>{fullCombo}</span>
                          <span className="font-mono text-[10px] text-gray-600">{count}</span>
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

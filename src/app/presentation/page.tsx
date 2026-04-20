'use client';

import { Suspense, useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Printer, Map as MapIcon, X } from 'lucide-react';
import { buildGroups } from '@/components/report/ReportSummary';
import { useInventoryFilters } from '@/lib/useInventoryFilters';
import { type Spotlight } from '@/lib/buildSpotlightProps';
import InteractiveTable from '@/components/report/InteractiveTable';
import MapPanel from '@/components/report/MapPanel';
import PhotoLightbox from '@/components/report/PhotoLightbox';

const selectClass =
  'px-2.5 py-1.5 bg-gray-900 border border-gray-800 outline-none focus:border-blue-600 appearance-none text-gray-200 text-xs font-mono transition-colors';

function PresentationContent() {
  const searchParams = useSearchParams();

  const [allItems, setAllItems] = useState<any[]>([]);
  const [tagMeta,  setTagMeta]  = useState<Map<string, boolean>>(new Map());
  const [loading,  setLoading]  = useState(true);

  const [spotlight,   setSpotlight]   = useState<Spotlight | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [mapOpen,     setMapOpen]     = useState(true);

  // ── Data fetch ──────────────────────────────────────────────────────────────
  useEffect(() => {
    async function fetchData() {
      setLoading(true);

      const { data: items } = await supabase
        .from('InventoryItems')
        .select(`
          *,
          ItemTypes ( name ),
          Rooms (
            id, name, level_name, building_name, room_type, page_number, map_coordinates,
            FloorPlans ( id, name, image_url, page_labels )
          )
        `)
        .order('created_at', { ascending: false });

      const allFetched = items || [];
      setAllItems(allFetched);

      const typeIds = [...new Set(allFetched.map((i: any) => i.item_type_id).filter(Boolean))];
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

      setLoading(false);
    }
    fetchData();
  }, []);

  // ── Filters ─────────────────────────────────────────────────────────────────
  const {
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
  } = useInventoryFilters(allItems, tagMeta);

  // Seed filters from URL params once on mount
  const [seeded, setSeeded] = useState(false);
  useEffect(() => {
    if (seeded || allItems.length === 0) return;
    const level    = searchParams.get('level')    || '';
    const building = searchParams.get('building') || '';
    const roomType = searchParams.get('roomType') || '';
    const type     = searchParams.get('type')     || '';
    const quality  = searchParams.get('quality')  || '';
    // Call in order — React batches, so last write per state wins
    if (level)    setLevelFilter(level);
    if (building) setBuildingFilter(building);
    if (roomType) setRoomTypeFilter(roomType);
    if (type)     setTypeFilter(type);
    if (quality)  setQualityFilter(quality);
    setSeeded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allItems.length, seeded]);

  // Clear spotlight when the spotlighted type is no longer in filteredItems
  useEffect(() => {
    if (!spotlight) return;
    const typePresent = filteredItems.some(i => i.ItemTypes?.name === spotlight.typeName);
    if (!typePresent) setSpotlight(null);
  }, [filteredItems, spotlight]);

  // ── Grouped table data ───────────────────────────────────────────────────────
  const typeGroups = useMemo(() => buildGroups(filteredItems, tagMeta), [filteredItems, tagMeta]);

  // ── Scoped dropdown option lists for secondary filters ───────────────────────
  const uniqueLevels = useMemo(() =>
    Array.from(new Set(allItems.map(i => i.Rooms?.level_name).filter(Boolean))).sort() as string[],
    [allItems]
  );
  const uniqueBuildings = useMemo(() =>
    Array.from(new Set(
      allItems.filter(i => !levelFilter || i.Rooms?.level_name === levelFilter)
        .map(i => i.Rooms?.building_name).filter(Boolean)
    )).sort() as string[],
    [allItems, levelFilter]
  );
  const uniqueRoomTypes = useMemo(() =>
    Array.from(new Set(
      allItems
        .filter(i => (!levelFilter || i.Rooms?.level_name === levelFilter) && (!buildingFilter || i.Rooms?.building_name === buildingFilter))
        .map(i => i.Rooms?.room_type).filter(Boolean)
    )).sort() as string[],
    [allItems, levelFilter, buildingFilter]
  );

  // ── Loading state ────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="bg-gray-950 h-screen flex items-center justify-center text-gray-500">
        <div className="text-center">
          <div className="w-6 h-6 border border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="font-mono text-xs tracking-widest uppercase">Loading inventory…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-950 h-screen flex flex-col overflow-hidden text-gray-100 print-expand">

      {/* ── Header bar ─────────────────────────────────────────────────────────── */}
      <header className="no-print flex items-center justify-between px-5 py-2.5 border-b border-gray-800 bg-gray-950 shrink-0 gap-4">
        <div>
          <p className="font-mono text-[10px] tracking-[0.18em] uppercase text-gray-500 leading-none mb-0.5">
            Inventory Registry
          </p>
          <h1 className="text-base font-semibold text-gray-100 tracking-tight leading-none">
            FFE Catalog — Presentation
          </h1>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {activeFilterCount > 0 && (
            <span className="font-mono text-[10px] text-gray-400">
              {filteredItems.length} item{filteredItems.length !== 1 ? 's' : ''}
            </span>
          )}
          <button
            onClick={() => window.print()}
            className="border border-gray-700 hover:border-gray-600 text-gray-400 hover:text-gray-200 px-3 py-1.5 font-mono text-[10px] tracking-[0.12em] uppercase flex items-center gap-1.5 transition-colors hover:bg-gray-900"
          >
            <Printer size={12} /> Print
          </button>
          <button
            onClick={() => setMapOpen(o => !o)}
            className={`border px-3 py-1.5 font-mono text-[10px] tracking-[0.12em] uppercase flex items-center gap-1.5 transition-colors ${
              mapOpen
                ? 'border-blue-700/50 text-blue-400 bg-blue-600/5 hover:bg-blue-600/10'
                : 'border-gray-700 text-gray-400 hover:text-gray-200 hover:bg-gray-900'
            }`}
          >
            <MapIcon size={12} /> Map
          </button>
        </div>
      </header>

      {/* ── Filter bar ─────────────────────────────────────────────────────────── */}
      <div className="no-print px-5 py-3 border-b border-gray-800 bg-gray-900/30 shrink-0 space-y-2.5">
        {/* Primary filters */}
        <div className="flex items-end gap-3 flex-wrap">
          <div>
            <label className="block font-mono text-[10px] tracking-[0.12em] uppercase text-gray-500 mb-1">Type</label>
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className={selectClass}>
              <option value="">All Types</option>
              {uniqueTypes.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block font-mono text-[10px] tracking-[0.12em] uppercase text-gray-500 mb-1">Group</label>
            <select
              value={parentAttrFilter}
              onChange={e => setParentAttrFilter(e.target.value)}
              disabled={parentAttrOptions.length === 0}
              className={`${selectClass} disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              <option value="">All Groups</option>
              {parentAttrOptions.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div>
            <label className="block font-mono text-[10px] tracking-[0.12em] uppercase text-gray-500 mb-1">Attribute</label>
            <select
              value={childAttrFilter}
              onChange={e => setChildAttrFilter(e.target.value)}
              disabled={childAttrOptions.length === 0}
              className={`${selectClass} disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              <option value="">All Attrs</option>
              {childAttrOptions.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div>
            <label className="block font-mono text-[10px] tracking-[0.12em] uppercase text-gray-500 mb-1">Condition</label>
            <select value={qualityFilter} onChange={e => setQualityFilter(e.target.value)} className={selectClass}>
              <option value="">All Conditions</option>
              <option value="Excellent">Excellent</option>
              <option value="Good">Good</option>
              <option value="Fair">Fair</option>
              <option value="Poor">Poor</option>
            </select>
          </div>
          {activeFilterCount > 0 && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 font-mono text-[10px] tracking-wider uppercase text-gray-500 hover:text-gray-200 transition-colors border-b border-gray-700 hover:border-gray-400 pb-0.5 mb-1.5"
            >
              <X size={10} /> Clear
            </button>
          )}
        </div>

        {/* Secondary filters — de-emphasized */}
        <div className="flex items-end gap-3 flex-wrap opacity-60 hover:opacity-100 transition-opacity">
          <div>
            <label className="block font-mono text-[9px] tracking-[0.12em] uppercase text-gray-600 mb-1">Level</label>
            <select value={levelFilter} onChange={e => setLevelFilter(e.target.value)} className={`${selectClass} text-[11px] py-1`}>
              <option value="">All Levels</option>
              {uniqueLevels.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="block font-mono text-[9px] tracking-[0.12em] uppercase text-gray-600 mb-1">Building</label>
            <select value={buildingFilter} onChange={e => setBuildingFilter(e.target.value)} className={`${selectClass} text-[11px] py-1`}>
              <option value="">All Buildings</option>
              {uniqueBuildings.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          <div>
            <label className="block font-mono text-[9px] tracking-[0.12em] uppercase text-gray-600 mb-1">Room Type</label>
            <select value={roomTypeFilter} onChange={e => setRoomTypeFilter(e.target.value)} className={`${selectClass} text-[11px] py-1`}>
              <option value="">All Room Types</option>
              {uniqueRoomTypes.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* ── Main content ───────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden print-expand">

        {/* Table area */}
        <div className="flex-1 overflow-y-auto custom-scrollbar min-w-0 print-expand">
          <InteractiveTable
            typeGroups={typeGroups}
            tagMeta={tagMeta}
            spotlight={spotlight}
            onSpotlightChange={setSpotlight}
          />
        </div>

        {/* Map panel — hidden in print */}
        <div className="no-print">
          <MapPanel
            isOpen={mapOpen}
            onToggle={() => setMapOpen(o => !o)}
            filteredItems={filteredItems}
            tagMeta={tagMeta}
            spotlight={spotlight}
            onPhotoClick={url => setLightboxUrl(url)}
          />
        </div>
      </div>

      {lightboxUrl && (
        <PhotoLightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />
      )}
    </div>
  );
}

export default function PresentationPage() {
  return (
    <Suspense
      fallback={
        <div className="bg-gray-950 h-screen flex items-center justify-center text-gray-500">
          <p className="font-mono text-xs tracking-widest uppercase">Loading…</p>
        </div>
      }
    >
      <PresentationContent />
    </Suspense>
  );
}

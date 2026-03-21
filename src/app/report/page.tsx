'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import dynamic from 'next/dynamic';
import { Printer } from 'lucide-react';
import ReportSummary from '@/components/report/ReportSummary';
import { type ImageKeyEntry } from '@/components/report/SpotlightMapView';

const FloorPlanAnnotated = dynamic(
  () => import('@/components/report/FloorPlanAnnotated'),
  { ssr: false, loading: () => (
    <div className="flex items-center justify-center h-48 bg-gray-100 rounded text-gray-400 text-sm gap-2">
      <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
      Rendering floor plan…
    </div>
  )}
);

const SpotlightMapView = dynamic(
  () => import('@/components/report/SpotlightMapView'),
  { ssr: false }
);

function applyFilters(
  items: any[],
  params: { level: string; building: string; roomType: string; type: string; quality: string; attribute: string }
) {
  return items.filter(item => {
    if (params.level     && item.Rooms?.level_name    !== params.level)     return false;
    if (params.building  && item.Rooms?.building_name !== params.building)  return false;
    if (params.roomType  && item.Rooms?.room_type     !== params.roomType)  return false;
    if (params.type      && !(item.ItemTypes?.name || '').toLowerCase().includes(params.type.toLowerCase())) return false;
    if (params.attribute && !(item.attributes || []).includes(params.attribute)) return false;
    if (params.quality === 'Excellent' && (item.qty_excellent || 0) === 0) return false;
    if (params.quality === 'Good'      && (item.qty_good      || 0) === 0) return false;
    if (params.quality === 'Fair'      && (item.qty_fair      || 0) === 0) return false;
    if (params.quality === 'Poor'      && (item.qty_poor      || 0) === 0) return false;
    return true;
  });
}

function ReportContent() {
  const searchParams = useSearchParams();
  const [items, setItems]     = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // mapOnly state
  const [mapFloorPlan, setMapFloorPlan]         = useState<any | null>(null);
  const [mapRooms, setMapRooms]                 = useState<any[]>([]);
  const [mapActiveRoomIds, setMapActiveRoomIds] = useState<Set<string>>(new Set());
  const [imageKey, setImageKey]                 = useState<ImageKeyEntry[]>([]);
  const [mapComboRoomCounts, setMapComboRoomCounts] = useState<Record<string, Record<string, number>>>({});
  const [mapComboRooms, setMapComboRooms]           = useState<Record<string, string[]>>({});

  const mapOnly         = searchParams.get('mapOnly') === 'true';
  const floorplanId     = searchParams.get('floorplan') || '';
  const pageNum         = parseInt(searchParams.get('page') || '1', 10);
  const spotlightType   = searchParams.get('spotlightType') || '';
  const spotlightParent = searchParams.get('spotlightParent') || '';
  const spotlightAttr   = searchParams.get('spotlightAttribute') || '';

  const filters = {
    level:     searchParams.get('level')     || '',
    building:  searchParams.get('building')  || '',
    roomType:  searchParams.get('roomType')  || '',
    type:      searchParams.get('type')      || '',
    quality:   searchParams.get('quality')   || '',
    attribute: searchParams.get('attribute') || '',
  };

  useEffect(() => {
    async function fetchData() {
      setLoading(true);

      if (mapOnly && floorplanId) {
        const [{ data: fp }, { data: rooms }] = await Promise.all([
          supabase.from('FloorPlans').select('*').eq('id', floorplanId).single(),
          supabase.from('Rooms').select('*').eq('floor_plan_id', floorplanId),
        ]);
        if (fp) setMapFloorPlan(fp);
        const roomList = rooms || [];
        setMapRooms(roomList);

        if (roomList.length > 0) {
          const { data: roomItems } = await supabase
            .from('InventoryItems')
            .select('room_id, item_type_id, photo_url, attributes, qty_excellent, qty_good, qty_fair, qty_poor, ItemTypes(name)')
            .in('room_id', roomList.map((r: any) => r.id));

          const allItems: any[] = roomItems || [];

          // Build tagMeta for group vs tag distinction
          const typeIds = [...new Set(allItems.map((i: any) => i.item_type_id).filter(Boolean))];
          const tagMeta = new Map<string, boolean>();
          if (typeIds.length > 0) {
            const { data: tagData } = await supabase.from('ItemTypeAttributes')
              .select('item_type_id, name').in('item_type_id', typeIds).eq('is_parent', true);
            (tagData || []).forEach((t: any) => tagMeta.set(`${t.item_type_id}:${t.name}`, true));
          }

          // Active room IDs
          if (spotlightType) {
            const matchingIds = new Set<string>(
              allItems
                .filter(item => {
                  if (item.ItemTypes?.name !== spotlightType) return false;
                  if (spotlightAttr) {
                    const combo = item.attributes?.length > 0 ? item.attributes.join(', ') : '(no attributes)';
                    if (combo !== spotlightAttr) return false;
                  } else if (spotlightParent) {
                    if (!(item.attributes || []).includes(spotlightParent)) return false;
                  }
                  return (item.qty_excellent || 0) + (item.qty_good || 0) + (item.qty_fair || 0) + (item.qty_poor || 0) > 0;
                })
                .map(item => item.room_id)
            );
            setMapActiveRoomIds(matchingIds);
          } else {
            setMapActiveRoomIds(new Set(allItems.map(i => i.room_id)));
          }

          // Image key + combo→rooms map (single pass)
          const keyMap            = new Map<string, ImageKeyEntry>();
          const comboRooms:      Record<string, string[]>            = {};
          const comboRoomCounts: Record<string, Record<string, number>> = {};

          for (const item of allItems) {
            const typeName = item.ItemTypes?.name;
            if (!typeName) continue;
            if (spotlightType && typeName !== spotlightType) continue;
            const combo = item.attributes?.length > 0 ? item.attributes.join(', ') : '(no attributes)';
            if (spotlightAttr && combo !== spotlightAttr) continue;
            if (!spotlightAttr && spotlightParent && !(item.attributes || []).includes(spotlightParent)) continue;
            const qty = (item.qty_excellent || 0) + (item.qty_good || 0) + (item.qty_fair || 0) + (item.qty_poor || 0);

            // When spotlighting a type without pinning to a specific combo, group by parent
            // attribute so the key shows one entry per group (e.g. 5 groups → 5 images),
            // not one entry per unique full-combo (which could be dozens).
            const groupByParent = !!spotlightType && !spotlightAttr && !spotlightParent;
            const parentAttr = groupByParent
              ? ((item.attributes || []).find((a: string) => tagMeta.get(`${item.item_type_id}:${a}`)) ?? null)
              : null;
            const label = groupByParent
              ? (parentAttr ?? '(ungrouped)')
              : spotlightType ? combo : `${typeName} — ${combo}`;

            // imageKey
            if (!keyMap.has(label)) {
              const keyAttrs = groupByParent
                ? (parentAttr ? [{ name: parentAttr, isParent: true }] : [])
                : [...(item.attributes || [])].sort((a: string, b: string) => {
                    const aP = tagMeta.get(`${item.item_type_id}:${a}`) ?? false;
                    const bP = tagMeta.get(`${item.item_type_id}:${b}`) ?? false;
                    if (aP !== bP) return aP ? -1 : 1;
                    return a.localeCompare(b);
                  }).map((name: string) => ({ name, isParent: tagMeta.get(`${item.item_type_id}:${name}`) ?? false }));
              keyMap.set(label, { label, photoUrl: item.photo_url || null, count: qty, attrs: keyAttrs });
            } else {
              const e = keyMap.get(label)!;
              e.count += qty;
              // Prefer asset photos as the representative image
              if (!e.photoUrl && item.photo_url) {
                e.photoUrl = item.photo_url;
              } else if (item.photo_url?.includes('/assets/') && !e.photoUrl?.includes('/assets/')) {
                e.photoUrl = item.photo_url;
              }
            }

            // label → rooms + per-room counts (spotlight only, non-zero qty)
            if (spotlightType && qty > 0) {
              if (!comboRooms[label]) comboRooms[label] = [];
              if (!comboRooms[label].includes(item.room_id)) comboRooms[label].push(item.room_id);

              if (!comboRoomCounts[label]) comboRoomCounts[label] = {};
              comboRoomCounts[label][item.room_id] = (comboRoomCounts[label][item.room_id] || 0) + qty;
            }
          }

          setImageKey(Array.from(keyMap.values()).sort((a, b) => a.label.localeCompare(b.label)));
          setMapComboRooms(comboRooms);
          setMapComboRoomCounts(comboRoomCounts);
        }
      } else {
        const { data: rawItems } = await supabase
          .from('InventoryItems')
          .select('*, ItemTypes ( name ), Rooms ( id, name, level_name, building_name, room_type )')
          .order('created_at', { ascending: true });
        setItems(applyFilters(rawItems || [], filters));
      }

      setLoading(false);
    }
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-white text-gray-500">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          Building report…
        </div>
      </div>
    );
  }

  // ── Map-only / spotlight export view ──────────────────────────────────────
  if (mapOnly) {
    const pageRooms      = mapRooms.filter(r => (r.page_number || 1) === pageNum);
    const reportDate     = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const spotlightLabel = spotlightType
      ? spotlightAttr
        ? `${spotlightType} — ${spotlightAttr}`
        : spotlightParent
          ? `${spotlightType} — ${spotlightParent} (all)`
          : spotlightType
      : null;

    return (
      <div className="bg-white h-screen overflow-y-auto text-gray-900" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
        <style>{`
          @media print {
            .no-print { display: none !important; }
            body { margin: 0; font-size: 11pt; }
            img { max-width: 100% !important; }
            * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          }
        `}</style>

        <div className="no-print fixed top-4 right-4 z-50">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg shadow-lg font-medium text-sm transition-colors"
          >
            <Printer size={16} /> Print / Save as PDF
          </button>
        </div>

        <div className="max-w-5xl mx-auto px-8 py-10">
          {/* Header */}
          <div className="border-b-2 border-gray-200 pb-5 mb-8">
            <div className="flex items-baseline gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-gray-900">FFE Inventory — Floor Plan Export</h1>
              {spotlightLabel && (
                <span className="text-sm font-semibold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                  Spotlight: {spotlightLabel}
                </span>
              )}
            </div>
            <div className="flex gap-6 mt-2 text-sm text-gray-500">
              <span>Date: <span className="font-semibold text-gray-700">{reportDate}</span></span>
              <span>Rooms highlighted: <span className="font-semibold text-gray-700">{mapActiveRoomIds.size}</span></span>
              {mapFloorPlan && (
                <span>
                  Floor plan: <span className="font-semibold text-gray-700">{mapFloorPlan.name}</span>
                  {mapRooms.some(r => (r.page_number || 1) !== 1) ? `, Page ${pageNum}` : ''}
                </span>
              )}
            </div>
          </div>

          {mapFloorPlan ? (
            spotlightType ? (
              <SpotlightMapView
                floorPlan={mapFloorPlan}
                pageRooms={pageRooms}
                activeRoomIds={mapActiveRoomIds}
                pageNum={pageNum}
                imageKey={imageKey}
                mapComboRoomCounts={mapComboRoomCounts}
                mapComboRooms={mapComboRooms}
              />
            ) : (
              <FloorPlanAnnotated
                floorPlan={mapFloorPlan}
                rooms={pageRooms}
                activeRoomIds={mapActiveRoomIds}
                pageNumber={pageNum}
              />
            )
          ) : (
            <div className="p-12 bg-gray-50 rounded-xl text-center text-gray-400">Floor plan not found.</div>
          )}
        </div>
      </div>
    );
  }

  // ── Normal report view ─────────────────────────────────────────────────────
  const reportDate    = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const uniqueRoomIds = new Set(items.map(i => i.Rooms?.id).filter(Boolean));
  const totalItems    = items.reduce((sum, i) => sum + (i.qty_excellent || 0) + (i.qty_good || 0) + (i.qty_fair || 0) + (i.qty_poor || 0), 0);

  const activeFilters = [
    filters.level     && `Level: ${filters.level}`,
    filters.building  && `Building: ${filters.building}`,
    filters.roomType  && `Room Type: ${filters.roomType}`,
    filters.type      && `Type contains: "${filters.type}"`,
    filters.quality   && `Condition: ${filters.quality}`,
    filters.attribute && `Attribute: ${filters.attribute}`,
  ].filter(Boolean) as string[];

  return (
    <div className="bg-white h-screen overflow-y-auto text-gray-900" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { font-size: 11pt; }
          table { page-break-inside: avoid; }
        }
      `}</style>

      <div className="no-print fixed top-4 right-4 z-50">
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg shadow-lg font-medium text-sm transition-colors"
        >
          <Printer size={16} /> Print / Save as PDF
        </button>
      </div>

      <div className="max-w-5xl mx-auto px-8 py-10">
        <div className="border-b-2 border-gray-200 pb-6 mb-8">
          <h1 className="text-3xl font-bold text-gray-900">FFE Inventory Report</h1>
          <p className="text-sm text-gray-500 mt-1">Church Furniture, Fixtures &amp; Equipment — Committee Report</p>
          <div className="flex flex-wrap gap-6 mt-4 text-sm">
            <div><span className="text-gray-500">Date: </span><span className="font-semibold">{reportDate}</span></div>
            <div><span className="text-gray-500">Total items: </span><span className="font-semibold">{totalItems}</span></div>
            <div><span className="text-gray-500">Rooms covered: </span><span className="font-semibold">{uniqueRoomIds.size}</span></div>
            <div><span className="text-gray-500">Line entries: </span><span className="font-semibold">{items.length}</span></div>
          </div>
          {activeFilters.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2 items-center">
              <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Filters applied:</span>
              {activeFilters.map((f, i) => (
                <span key={i} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full border border-blue-200">{f}</span>
              ))}
            </div>
          )}
        </div>

        {items.length === 0 ? (
          <div className="p-12 bg-gray-50 rounded-xl text-center text-gray-400 text-lg">
            No inventory items match the selected filters.
          </div>
        ) : (
          <div className="mb-10">
            <ReportSummary items={items} />
          </div>
        )}
      </div>
    </div>
  );
}

export default function ReportPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-screen bg-white text-gray-500">
          Building report…
        </div>
      }
    >
      <ReportContent />
    </Suspense>
  );
}

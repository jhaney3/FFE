'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import dynamic from 'next/dynamic';
import { ChevronRight, Maximize2, X } from 'lucide-react';
import { buildSpotlightProps, type Spotlight } from '@/lib/buildSpotlightProps';

const FloorPlanAnnotated = dynamic(
  () => import('./FloorPlanAnnotated'),
  { ssr: false, loading: () => (
    <div className="flex items-center justify-center h-48 bg-gray-900 text-gray-600 text-xs gap-2">
      <div className="w-3 h-3 border border-gray-600 border-t-transparent rounded-full animate-spin" />
      Rendering floor plan…
    </div>
  )}
);

const SpotlightMapView = dynamic(
  () => import('./SpotlightMapView'),
  { ssr: false }
);

interface Props {
  isOpen: boolean;
  onToggle: () => void;
  filteredItems: any[];
  tagMeta: Map<string, boolean>;
  spotlight: Spotlight | null;
  onPhotoClick?: (url: string) => void;
}

export default function MapPanel({ isOpen, onToggle, filteredItems, tagMeta, spotlight, onPhotoClick }: Props) {
  const [activePlanId, setActivePlanId] = useState<string>('');
  const [expanded,     setExpanded]     = useState(false);
  const [panelWidth,   setPanelWidth]   = useState(420);
  const resizeState = useRef({ active: false, startX: 0, startWidth: 0 });

  // ESC closes the expanded lightbox
  useEffect(() => {
    if (!expanded) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setExpanded(false); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [expanded]);

  // Items matching the current spotlight (for plan scoping)
  const spotlightItems = useMemo(() => {
    if (!spotlight) return filteredItems;
    return filteredItems.filter(item => {
      if (item.ItemTypes?.name !== spotlight.typeName) return false;
      if (spotlight.attrCombo) {
        const combo = item.attributes?.length > 0 ? [...item.attributes].sort().join(', ') : '(no attributes)';
        return combo === spotlight.attrCombo;
      }
      if (spotlight.parentAttr) return (item.attributes || []).includes(spotlight.parentAttr);
      return true;
    });
  }, [filteredItems, spotlight]);

  // Distinct floor plans from spotlighted items (falls back to all filtered items)
  const distinctPlans = useMemo(() => {
    const planMap = new Map<string, any>();
    const source = spotlightItems.length > 0 ? spotlightItems : filteredItems;
    source.forEach(item => {
      if (item.Rooms?.FloorPlans?.id) {
        planMap.set(item.Rooms.FloorPlans.id, item.Rooms.FloorPlans);
      }
    });
    return Array.from(planMap.values());
  }, [spotlightItems, filteredItems]);

  // Auto-select first plan when available plans change
  useEffect(() => {
    if (distinctPlans.length === 0) return;
    if (!distinctPlans.find(p => p.id === activePlanId)) {
      setActivePlanId(distinctPlans[0].id);
    }
  }, [distinctPlans, activePlanId]);

  const activePlan = distinctPlans.find(p => p.id === activePlanId) ?? distinctPlans[0] ?? null;

  // All page numbers for the active plan that have relevant items, sorted.
  // When a spotlight is active, only include pages containing spotlighted items
  // so we don't render unrelated PDF pages.
  const allPageNumbers = useMemo(() => {
    if (!activePlanId) return [1];
    const source = (spotlight && spotlightItems.length > 0) ? spotlightItems : filteredItems;
    const pages = new Set<number>();
    source.forEach(item => {
      if (item.Rooms?.FloorPlans?.id === activePlanId) pages.add(item.Rooms?.page_number || 1);
    });
    const sorted = Array.from(pages).sort((a, b) => a - b);
    return sorted.length > 0 ? sorted : [1];
  }, [filteredItems, spotlightItems, spotlight, activePlanId]);

  // Rooms for a specific page on the active plan, deduplicated by room id
  const getRoomsForPage = useCallback((page: number) => {
    if (!activePlanId) return [];
    const roomMap = new Map<string, any>();
    filteredItems.forEach(item => {
      if (
        item.Rooms?.FloorPlans?.id === activePlanId &&
        (item.Rooms?.page_number || 1) === page &&
        item.Rooms?.id
      ) {
        roomMap.set(item.Rooms.id, item.Rooms);
      }
    });
    return Array.from(roomMap.values());
  }, [filteredItems, activePlanId]);

  // Spotlight map props (only when spotlight is active)
  const spotProps = useMemo(() => {
    if (!spotlight) return null;
    return buildSpotlightProps(filteredItems, tagMeta, spotlight);
  }, [filteredItems, tagMeta, spotlight]);

  const activeRoomIds = useMemo(() => {
    if (spotlight && spotProps) return spotProps.activeRoomIds;
    return new Set<string>(filteredItems.map(i => i.room_id).filter(Boolean));
  }, [spotlight, spotProps, filteredItems]);

  // ── Panel resize (drag left edge) ────────────────────────────────────────────
  const handleResizeStart = (e: React.PointerEvent) => {
    e.preventDefault();
    resizeState.current = { active: true, startX: e.clientX, startWidth: panelWidth };
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  };
  const handleResizeMove = (e: React.PointerEvent) => {
    if (!resizeState.current.active) return;
    // Dragging left increases width (panel anchored to right)
    const dx = resizeState.current.startX - e.clientX;
    setPanelWidth(Math.min(900, Math.max(280, resizeState.current.startWidth + dx)));
  };
  const handleResizeEnd = (e: React.PointerEvent) => {
    if (!resizeState.current.active) return;
    resizeState.current.active = false;
    (e.currentTarget as Element).releasePointerCapture(e.pointerId);
  };

  // ── Tab strip (shared between panel + lightbox) ───────────────────────────────
  const TabStrip = ({ compact = false }: { compact?: boolean }) => distinctPlans.length > 1 ? (
    <div className={`flex border-gray-800 overflow-x-auto ${compact ? 'border' : 'border-b shrink-0'}`}>
      {distinctPlans.map(plan => (
        <button
          key={plan.id}
          onClick={() => setActivePlanId(plan.id)}
          className={`px-3 py-1.5 font-mono text-[10px] tracking-wider uppercase whitespace-nowrap transition-colors border-r border-gray-800 last:border-r-0 ${
            activePlanId === plan.id
              ? 'text-blue-400 bg-blue-900/20'
              : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/50'
          }`}
        >
          {plan.name}
        </button>
      ))}
    </div>
  ) : null;

  // ── Map content: all pages stacked ───────────────────────────────────────────
  const MapContent = () => activePlan ? (
    <div className="flex flex-col gap-8">
      {allPageNumbers.map(page => {
        const roomsForPage = getRoomsForPage(page);
        return (
          <div key={page}>
            {(allPageNumbers.length > 1 || activePlan.page_labels?.[page]) && (
              <div className="flex items-center gap-3 mb-4">
                <div className="flex-1 h-px bg-gray-700" />
                <span className="font-mono text-sm font-semibold text-gray-100 uppercase tracking-widest px-1">
                  {activePlan.page_labels?.[page] || `Page ${page}`}
                </span>
                <div className="flex-1 h-px bg-gray-700" />
              </div>
            )}
            {spotlight && spotProps ? (
              <SpotlightMapView
                floorPlan={activePlan}
                pageRooms={roomsForPage}
                activeRoomIds={activeRoomIds}
                pageNum={page}
                imageKey={spotProps.imageKey}
                mapComboRoomCounts={spotProps.mapComboRoomCounts}
                mapComboRooms={spotProps.mapComboRooms}
                mapComboRoomConditions={spotProps.mapComboRoomConditions}
                onPhotoClick={onPhotoClick}
              />
            ) : (
              <FloorPlanAnnotated
                floorPlan={activePlan}
                rooms={roomsForPage}
                activeRoomIds={activeRoomIds}
                pageNumber={page}
              />
            )}
          </div>
        );
      })}
    </div>
  ) : (
    <div className="flex items-center justify-center h-full text-gray-700 font-mono text-xs">
      No floor plan data
    </div>
  );

  return (
    <>
      <div className="h-full shrink-0 relative">
        {/* Inner collapsing content */}
        <div
          style={{ width: isOpen ? panelWidth : 0, transition: 'width 0.22s ease-in-out' }}
          className="h-full overflow-hidden"
        >
          <div
            style={{ width: panelWidth }}
            className="h-full bg-gray-900 border-l border-gray-800 flex flex-col overflow-hidden relative"
          >
            {/* Resize handle — drag to adjust panel width */}
            <div
              className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize z-10 hover:bg-blue-500/40 active:bg-blue-500/60 transition-colors"
              onPointerDown={handleResizeStart}
              onPointerMove={handleResizeMove}
              onPointerUp={handleResizeEnd}
              onPointerCancel={handleResizeEnd}
            />

            {/* Panel header */}
            <div className="pl-3 pr-4 py-2.5 border-b border-gray-800 flex items-center justify-between shrink-0">
              <p className="font-mono text-[10px] tracking-[0.18em] uppercase text-gray-500">Floor Plan</p>
              <div className="flex items-center gap-2">
                {spotlight && (
                  <span className="font-mono text-[10px] text-blue-400 bg-blue-900/20 border border-blue-800/40 px-1.5 py-0.5 truncate max-w-[160px]">
                    {spotlight.attrCombo ?? spotlight.parentAttr ?? spotlight.typeName}
                  </span>
                )}
                {activePlan && (
                  <button
                    onClick={() => setExpanded(true)}
                    title="Expand map"
                    className="text-gray-600 hover:text-gray-300 transition-colors p-0.5"
                  >
                    <Maximize2 size={13} />
                  </button>
                )}
              </div>
            </div>

            <TabStrip />

            {/* Map view — scrollable, all pages stacked */}
            <div className="flex-1 overflow-y-auto custom-scrollbar min-h-0 p-2">
              <MapContent />
            </div>
          </div>
        </div>

        {/* Toggle tab */}
        <button
          onClick={onToggle}
          title={isOpen ? 'Hide map' : 'Show map'}
          className="absolute top-1/2 -translate-y-1/2 right-full w-4 h-10 bg-gray-900 border border-r-0 border-gray-800 flex items-center justify-center hover:bg-gray-800 z-10 transition-colors"
        >
          <ChevronRight
            size={12}
            className="text-gray-600"
            style={{ transition: 'transform 0.22s ease-in-out', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
          />
        </button>
      </div>

      {/* ── Expanded map lightbox ── */}
      {expanded && createPortal(
        <div
          className="fixed inset-0 bg-gray-950/98 z-[10000] flex flex-col"
          onClick={() => setExpanded(false)}
        >
          {/* Lightbox header */}
          <div
            className="flex items-center justify-between px-5 py-3 border-b border-gray-800 shrink-0 bg-gray-900"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <p className="font-mono text-[10px] tracking-[0.18em] uppercase text-gray-500">Floor Plan</p>
              {spotlight && (
                <span className="font-mono text-[10px] text-blue-400 bg-blue-900/20 border border-blue-800/40 px-1.5 py-0.5">
                  {spotlight.attrCombo ?? spotlight.parentAttr ?? spotlight.typeName}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <TabStrip compact />
              <button
                onClick={() => setExpanded(false)}
                className="text-gray-500 hover:text-gray-100 transition-colors p-1 ml-2"
                title="Close"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Map content — full remaining height, all pages stacked */}
          <div
            className="flex-1 overflow-y-auto custom-scrollbar p-6 min-h-0"
            onClick={e => e.stopPropagation()}
          >
            <MapContent />
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

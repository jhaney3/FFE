'use client';

import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import dynamic from 'next/dynamic';
import { ChevronRight, ChevronLeft, Maximize2, X } from 'lucide-react';
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
  const [pageNumber,   setPageNumber]   = useState(1);
  const [expanded,     setExpanded]     = useState(false);

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
      setPageNumber(1);
    }
  }, [distinctPlans, activePlanId]);

  const activePlan = distinctPlans.find(p => p.id === activePlanId) ?? distinctPlans[0] ?? null;

  // Max page for the active plan
  const maxPage = useMemo(() => {
    if (!activePlanId) return 1;
    const pages = new Set<number>();
    filteredItems.forEach(item => {
      if (item.Rooms?.FloorPlans?.id === activePlanId) pages.add(item.Rooms?.page_number || 1);
    });
    return Math.max(...Array.from(pages), 1);
  }, [filteredItems, activePlanId]);

  // Rooms on the current plan + page, deduplicated
  const pageRooms = useMemo(() => {
    if (!activePlanId) return [];
    const roomMap = new Map<string, any>();
    filteredItems.forEach(item => {
      if (
        item.Rooms?.FloorPlans?.id === activePlanId &&
        (item.Rooms?.page_number || 1) === pageNumber &&
        item.Rooms?.id
      ) {
        roomMap.set(item.Rooms.id, item.Rooms);
      }
    });
    return Array.from(roomMap.values());
  }, [filteredItems, activePlanId, pageNumber]);

  // Spotlight map props (only when spotlight is active)
  const spotProps = useMemo(() => {
    if (!spotlight) return null;
    return buildSpotlightProps(filteredItems, tagMeta, spotlight);
  }, [filteredItems, tagMeta, spotlight]);

  const activeRoomIds = useMemo(() => {
    if (spotlight && spotProps) return spotProps.activeRoomIds;
    return new Set<string>(filteredItems.map(i => i.room_id).filter(Boolean));
  }, [spotlight, spotProps, filteredItems]);

  // ── Shared chrome: tab strip + page stepper ──────────────────────────────────
  const TabStrip = () => distinctPlans.length > 1 ? (
    <div className="flex shrink-0 border-b border-gray-800 overflow-x-auto">
      {distinctPlans.map(plan => (
        <button
          key={plan.id}
          onClick={() => { setActivePlanId(plan.id); setPageNumber(1); }}
          className={`px-3 py-2 font-mono text-[10px] tracking-wider uppercase whitespace-nowrap transition-colors border-r border-gray-800 ${
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

  const PageStepper = () => maxPage > 1 ? (
    <div className="flex items-center justify-between px-4 py-1.5 border-b border-gray-800 shrink-0">
      <button onClick={() => setPageNumber(p => Math.max(1, p - 1))} disabled={pageNumber <= 1}
        className="text-gray-500 hover:text-gray-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
        <ChevronLeft size={14} />
      </button>
      <span className="font-mono text-[10px] text-gray-500">
        Page <span className="text-gray-300">{pageNumber}</span> / {maxPage}
      </span>
      <button onClick={() => setPageNumber(p => Math.min(maxPage, p + 1))} disabled={pageNumber >= maxPage}
        className="text-gray-500 hover:text-gray-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
        <ChevronRight size={14} />
      </button>
    </div>
  ) : null;

  const MapContent = ({ className = '' }: { className?: string }) => activePlan ? (
    spotlight && spotProps ? (
      <SpotlightMapView
        floorPlan={activePlan}
        pageRooms={pageRooms}
        activeRoomIds={activeRoomIds}
        pageNum={pageNumber}
        imageKey={spotProps.imageKey}
        mapComboRoomCounts={spotProps.mapComboRoomCounts}
        mapComboRooms={spotProps.mapComboRooms}
        onPhotoClick={onPhotoClick}
      />
    ) : (
      <FloorPlanAnnotated
        floorPlan={activePlan}
        rooms={pageRooms}
        activeRoomIds={activeRoomIds}
        pageNumber={pageNumber}
      />
    )
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
          style={{ width: isOpen ? 420 : 0, transition: 'width 0.22s ease-in-out' }}
          className="h-full overflow-hidden"
        >
          <div className="w-[420px] h-full bg-gray-900 border-l border-gray-800 flex flex-col overflow-hidden">

            {/* Panel header */}
            <div className="px-4 py-2.5 border-b border-gray-800 flex items-center justify-between shrink-0">
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
            <PageStepper />

            {/* Map view */}
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
              {/* Tab strip inline when expanded */}
              {distinctPlans.length > 1 && (
                <div className="flex border border-gray-800 overflow-x-auto">
                  {distinctPlans.map(plan => (
                    <button
                      key={plan.id}
                      onClick={() => { setActivePlanId(plan.id); setPageNumber(1); }}
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
              )}
              {/* Page stepper inline when expanded */}
              {maxPage > 1 && (
                <div className="flex items-center gap-2">
                  <button onClick={() => setPageNumber(p => Math.max(1, p - 1))} disabled={pageNumber <= 1}
                    className="text-gray-500 hover:text-gray-300 disabled:opacity-30 transition-colors">
                    <ChevronLeft size={14} />
                  </button>
                  <span className="font-mono text-[10px] text-gray-500">
                    <span className="text-gray-300">{pageNumber}</span> / {maxPage}
                  </span>
                  <button onClick={() => setPageNumber(p => Math.min(maxPage, p + 1))} disabled={pageNumber >= maxPage}
                    className="text-gray-500 hover:text-gray-300 disabled:opacity-30 transition-colors">
                    <ChevronRight size={14} />
                  </button>
                </div>
              )}
              <button
                onClick={() => setExpanded(false)}
                className="text-gray-500 hover:text-gray-100 transition-colors p-1 ml-2"
                title="Close"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Map content — full remaining height */}
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

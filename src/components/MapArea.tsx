'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import RoomZone from '@/components/RoomZone';
import PdfUploader from './PdfUploader';
import NewZoneModal from './NewZoneModal';
import { Layers, ShieldAlert, Trash2, ChevronLeft, ChevronRight, ChevronDown, ZoomIn, ZoomOut, Maximize, Package, Tag, SlidersHorizontal, MapPin, X } from 'lucide-react';
import AssetSidebar from './AssetSidebar';
import ItemTypeFilter from './ItemTypeFilter';
import TagManagerModal from './TagManagerModal';
import { Document, Page, pdfjs } from 'react-pdf';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { useProjectId } from '@/lib/ProjectContext';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export default function MapArea({ itemsVersion }: { itemsVersion?: number }) {
  const projectId = useProjectId();
  const [floorPlans, setFloorPlans] = useState<any[]>([]);
  const [activePlanId, setActivePlanId] = useState<string | null>(null);
  const [rooms, setRooms] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [tagManagerOpen, setTagManagerOpen] = useState(false);
  const [controlsOpen, setControlsOpen] = useState(false);
  const [pendingZoneParams, setPendingZoneParams] = useState<{x: number, y: number, width: number, height: number} | null>(null);
  const [editingRoom, setEditingRoom] = useState<any | null>(null);
  const [assetSidebarOpen, setAssetSidebarOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [virtualRooms, setVirtualRooms] = useState<any[]>([]);
  const [virtualRoomsOpen, setVirtualRoomsOpen] = useState(false);
  const [placingRoom, setPlacingRoom] = useState<any | null>(null);
  const [spotlightOpen, setSpotlightOpen] = useState(false);
  const [activeSpotlightType, setActiveSpotlightType]           = useState<string | null>(null);
  const [activeSpotlightParent, setActiveSpotlightParent]       = useState<string | null>(null);
  const [activeSpotlightAttribute, setActiveSpotlightAttribute] = useState<string | null>(null);

  // tagMeta for spotlight-aware attribute color-coding in RoomZone popouts
  const [tagMeta, setTagMeta] = useState<Map<string, boolean>>(new Map());

  // Incremented on background clicks to close all open room popouts
  const [closeSignal, setCloseSignal] = useState(0);

  // PDF state
  const [numPages, setNumPages] = useState<number>(1);
  const [pageNumber, setPageNumber] = useState<number>(1);

  // Drawing state
  const [drawingZone, setDrawingZone] = useState<{ startX: number; startY: number; currentX: number; currentY: number } | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchFloorPlans();
    fetchVirtualRooms();
  }, []);

  const fetchVirtualRooms = async () => {
    if (!projectId) return;
    const { data } = await supabase
      .from('Rooms')
      .select('*')
      .eq('project_id', projectId)
      .is('floor_plan_id', null)
      .order('name');
    if (data) setVirtualRooms(data);
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Element;
      if (!target.closest('[data-room-zone]') && !target.closest('[data-room-popout]')) {
        setCloseSignal(s => s + 1);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    setNumPages(1);
    setPageNumber(1);
    if (activePlanId) fetchRooms(activePlanId);
  }, [activePlanId]);


  useEffect(() => {
    if (activePlanId && itemsVersion) fetchRooms(activePlanId);
  }, [itemsVersion]);

  const fetchFloorPlans = async () => {
    const { data } = await supabase.from('FloorPlans').select('*').order('created_at');
    if (data && data.length > 0) {
      setFloorPlans(data);
      if (!activePlanId || !data.find(p => p.id === activePlanId)) {
        setActivePlanId(data[0].id);
      }
    } else {
      setFloorPlans([]);
      setActivePlanId(null);
    }
  };

  const fetchRooms = async (planId: string) => {
    const { data: roomsData } = await supabase.from('Rooms').select('*').eq('floor_plan_id', planId);
    if (roomsData) {
      setRooms(roomsData);
      const roomIds = roomsData.map(r => r.id);
      if (roomIds.length > 0) {
        const { data: itemsData } = await supabase.from('InventoryItems').select('*, ItemTypes(name)').in('room_id', roomIds);
        if (itemsData) {
          setItems(itemsData);
          // Fetch parent-attr metadata for color-coding
          const typeIds = [...new Set(itemsData.map((i: any) => i.item_type_id).filter(Boolean))];
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
      } else {
        setItems([]);
      }
    } else {
      setRooms([]);
      setItems([]);
    }
  };

  const deleteActivePlan = async () => {
    if (!activePlanId) return;
    if (!confirm('Are you sure you want to delete this floor plan and ALL its associated rooms/items? This action cannot be undone.')) return;

    const { error } = await supabase.from('FloorPlans').delete().eq('id', activePlanId);
    if (!error) {
      fetchFloorPlans();
    } else {
      alert(error.message);
    }
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isAdminMode || e.button !== 0) return; // Only left click in admin mode
    const rect = mapRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    
    setDrawingZone({ startX: x, startY: y, currentX: x, currentY: y });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isAdminMode || !drawingZone) return;
    const rect = mapRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    
    setDrawingZone({ ...drawingZone, currentX: Math.max(0, Math.min(100, x)), currentY: Math.max(0, Math.min(100, y)) });
  };

  const handleMouseUp = async () => {
    if (!isAdminMode || !drawingZone) return;

    const width = Math.abs(drawingZone.currentX - drawingZone.startX);
    const height = Math.abs(drawingZone.currentY - drawingZone.startY);
    const left = Math.min(drawingZone.startX, drawingZone.currentX);
    const top = Math.min(drawingZone.startY, drawingZone.currentY);

    setDrawingZone(null);

    if (width < 2 || height < 2) return; // Too small

    const coords = { x: left, y: top, width, height };

    if (placingRoom) {
      await handlePlaceVirtualRoom(coords);
    } else {
      setPendingZoneParams(coords);
    }
  };

  const handlePlaceVirtualRoom = async (coords: { x: number; y: number; width: number; height: number }) => {
    if (!placingRoom || !activePlanId) return;
    const { error } = await supabase.from('Rooms').update({
      floor_plan_id: activePlanId,
      map_coordinates: coords,
      page_number: pageNumber,
    }).eq('id', placingRoom.id);
    if (error) {
      alert(error.message);
      return;
    }
    setPlacingRoom(null);
    setIsAdminMode(false);
    fetchRooms(activePlanId);
    fetchVirtualRooms();
  };

  const handleCreateZone = async (zoneData: any) => {
    if (!pendingZoneParams) return;
    const { error } = await supabase.from('Rooms').insert([{
      floor_plan_id: activePlanId,
      name: zoneData.name,
      page_number: zoneData.page_number,
      level_name: zoneData.level_name,
      building_name: zoneData.building_name,
      room_type: zoneData.room_type,
      map_coordinates: pendingZoneParams,
      project_id: projectId,
    }]);

    if (!error) {
      setPendingZoneParams(null);
      fetchRooms(activePlanId!);
      fetchVirtualRooms();
    } else {
      alert(error.message);
    }
  };

  const handleUpdateZone = async (roomId: string, coords: any) => {
    await supabase.from('Rooms').update({ map_coordinates: coords }).eq('id', roomId);
    setRooms(prev => prev.map(r => r.id === roomId ? { ...r, map_coordinates: coords } : r));
  };

  const handleSaveEditZone = async (data: any) => {
    if (!editingRoom) return;
    await supabase.from('Rooms').update({
      name:          data.name,
      room_type:     data.room_type,
      building_name: data.building_name,
      level_name:    data.level_name,
      page_number:   data.page_number,
    }).eq('id', editingRoom.id);
    setEditingRoom(null);
    fetchRooms(activePlanId!);
  };

  const handleDeleteZone = async (roomId: string) => {
    if (!confirm('Are you sure you want to delete this zone and ALL items inside it? This cannot be undone.')) return;
    const { error } = await supabase.from('Rooms').delete().eq('id', roomId);
    if (!error) {
      fetchRooms(activePlanId!);
    } else {
      alert(error.message);
    }
  };

  const activePlan = floorPlans.find(fp => fp.id === activePlanId);

  return (
    <div className="flex-1 flex flex-col h-full bg-gray-900 border-l border-gray-800 min-w-0">
      {/* Collapsible floor plan controls */}
      <div className="shrink-0 bg-gray-950 border-b border-gray-800 z-10 w-full">
        <div
          style={{ maxHeight: controlsOpen ? '48px' : '0px', transition: 'max-height 0.2s ease-in-out' }}
          className="overflow-hidden"
        >
          <div className="py-2 px-4 flex flex-wrap gap-1.5 items-center justify-between w-full">
            <div className="flex flex-wrap gap-2 items-center">
              {floorPlans.map(plan => (
                <button
                  key={plan.id}
                  onClick={() => setActivePlanId(plan.id)}
                  className={`px-3 py-1 font-mono text-[10px] tracking-wider uppercase border transition-colors ${
                    activePlanId === plan.id
                      ? 'border-blue-500 bg-blue-500/10 text-blue-400'
                      : 'border-gray-700 text-gray-500 hover:border-gray-600 hover:text-gray-300'
                  }`}
                >
                  {plan.name}
                </button>
              ))}
              <PdfUploader onUploaded={fetchFloorPlans} />
            </div>
            {activePlan && (
              <button
                onClick={deleteActivePlan}
                title="Delete Floor Plan"
                className="p-2 text-gray-600 hover:text-red-400 hover:bg-red-900/20 border border-transparent hover:border-red-800 transition-colors"
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Toggle strip */}
        <button
          onClick={() => setControlsOpen(o => !o)}
          className="w-full flex items-center justify-center gap-1 py-1 font-mono text-[9px] tracking-[0.15em] uppercase text-gray-600 hover:text-gray-400 hover:bg-gray-900/60 transition-colors"
        >
          <ChevronDown
            size={12}
            style={{ transition: 'transform 0.2s ease-in-out', transform: controlsOpen ? 'rotate(0deg)' : 'rotate(180deg)' }}
          />
          <span>{controlsOpen ? 'Hide floor plans' : 'Floor plans'}</span>
        </button>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col items-center justify-center pattern-dots relative">
        {activePlan ? (
          <TransformWrapper
            initialScale={1}
            minScale={0.1}
            maxScale={4}
            centerOnInit={true}
            disabled={isAdminMode}
            limitToBounds={false}
          >
            {({ zoomIn, zoomOut, resetTransform }) => (
              <>
                {/* Placement mode banner */}
                {placingRoom && (
                  <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 px-4 py-2 bg-amber-900/80 border border-amber-600 backdrop-blur-sm surface-raised">
                    <MapPin size={12} className="text-amber-400 shrink-0" />
                    <span className="font-mono text-[10px] tracking-wider uppercase text-amber-300">
                      Draw a zone to place <span className="text-amber-100 font-semibold">{placingRoom.name}</span>
                    </span>
                    <button
                      onClick={() => { setPlacingRoom(null); setIsAdminMode(false); }}
                      className="text-amber-500 hover:text-amber-200 transition-colors ml-1"
                    >
                      <X size={12} />
                    </button>
                  </div>
                )}

                {/* Unplaced rooms badge */}
                {virtualRooms.length > 0 && (
                  <div className="absolute top-5 left-5 z-20">
                    <button
                      onClick={() => setVirtualRoomsOpen(o => !o)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 font-mono text-[10px] tracking-wider uppercase border transition-colors surface-raised ${
                        virtualRoomsOpen
                          ? 'bg-amber-500/15 text-amber-400 border-amber-500'
                          : 'bg-gray-900 text-amber-500/80 border-amber-800/60 hover:border-amber-600 hover:text-amber-400'
                      }`}
                    >
                      <MapPin size={11} />
                      {virtualRooms.length} unplaced
                    </button>

                    {virtualRoomsOpen && (
                      <div className="absolute top-full left-0 mt-1.5 w-64 bg-gray-900 border border-gray-700 surface-raised overflow-hidden">
                        <div className="px-3 py-2 border-b border-gray-800">
                          <p className="font-mono text-[9px] tracking-[0.15em] uppercase text-gray-400">Rooms not yet on the map</p>
                        </div>
                        <div className="max-h-60 overflow-y-auto custom-scrollbar">
                          {virtualRooms.map(room => (
                            <div key={room.id} className="flex items-center justify-between px-3 py-2 border-b border-gray-800 last:border-0 hover:bg-gray-800/50 transition-colors">
                              <div className="min-w-0">
                                <p className="text-sm text-gray-200 truncate">{room.name}</p>
                                {(room.building_name || room.level_name) && (
                                  <p className="font-mono text-[9px] text-gray-500 truncate">
                                    {[room.building_name, room.level_name].filter(Boolean).join(' · ')}
                                  </p>
                                )}
                              </div>
                              <button
                                onClick={() => {
                                  setPlacingRoom(room);
                                  setIsAdminMode(true);
                                  setVirtualRoomsOpen(false);
                                }}
                                className="shrink-0 ml-3 flex items-center gap-1 px-2 py-1 font-mono text-[9px] tracking-wider uppercase border border-amber-800 text-amber-500 hover:border-amber-600 hover:text-amber-300 transition-colors"
                              >
                                <MapPin size={9} /> Place
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Zoom controls */}
                <div className="absolute top-5 right-5 flex flex-col z-20 bg-gray-900 border border-gray-700 surface-raised overflow-hidden">
                  <button onClick={() => zoomIn()} className="p-2.5 text-gray-400 hover:bg-gray-800 hover:text-gray-200 border-b border-gray-700 transition-colors"><ZoomIn size={16}/></button>
                  <button onClick={() => zoomOut()} className="p-2.5 text-gray-400 hover:bg-gray-800 hover:text-gray-200 border-b border-gray-700 transition-colors"><ZoomOut size={16}/></button>
                  <button onClick={() => resetTransform()} className="p-2.5 text-gray-400 hover:bg-gray-800 hover:text-gray-200 transition-colors"><Maximize size={16}/></button>
                </div>

                {/* Spotlight panel — controlled by hub */}
                <ItemTypeFilter
                  items={items}
                  activeType={activeSpotlightType}
                  activeParent={activeSpotlightParent}
                  activeAttribute={activeSpotlightAttribute}
                  onSelect={(type, parent, attr) => {
                    setActiveSpotlightType(type);
                    setActiveSpotlightParent(parent);
                    setActiveSpotlightAttribute(attr);
                  }}
                  floorplanId={activePlanId}
                  pageNumber={pageNumber}
                  isOpen={spotlightOpen}
                  onClose={() => setSpotlightOpen(false)}
                />

                {/* ── Tools hub — flowers into Admin / Tags / Spotlight ── */}
                <div className="absolute bottom-5 left-5 z-20 flex flex-col-reverse items-start gap-1.5">

                  {/* Hub trigger */}
                  <button
                    onClick={() => setToolsOpen(o => !o)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 font-mono text-[10px] tracking-wider uppercase border transition-colors surface-raised ${
                      toolsOpen || isAdminMode || !!activeSpotlightType
                        ? 'bg-blue-500/15 text-blue-400 border-blue-500'
                        : 'bg-gray-900 text-gray-500 border-gray-700 hover:border-gray-500 hover:text-gray-300'
                    }`}
                  >
                    <SlidersHorizontal size={11} />
                    Tools
                    {(isAdminMode || !!activeSpotlightType) && (
                      <span className="w-1 h-1 rounded-full bg-blue-400" />
                    )}
                  </button>

                  {/* Flowering items — stagger from hub upward */}
                  {([
                    {
                      label: 'Admin',
                      icon: ShieldAlert,
                      active: isAdminMode,
                      onClick: () => setIsAdminMode(m => !m),
                      dot: isAdminMode,
                    },
                    {
                      label: 'Tags',
                      icon: Tag,
                      active: false,
                      onClick: () => { setTagManagerOpen(true); setToolsOpen(false); },
                      dot: false,
                    },
                    {
                      label: 'Spotlight',
                      icon: SlidersHorizontal,
                      active: !!activeSpotlightType,
                      onClick: () => { setSpotlightOpen(true); setToolsOpen(false); },
                      dot: !!activeSpotlightType,
                    },
                  ] as const).map((item, i) => (
                    <div
                      key={item.label}
                      style={{
                        transform: toolsOpen ? 'translateY(0)' : 'translateY(6px)',
                        opacity: toolsOpen ? 1 : 0,
                        pointerEvents: toolsOpen ? 'auto' : 'none',
                        transition: [
                          `transform 140ms ease ${toolsOpen ? i * 40 : (2 - i) * 30}ms`,
                          `opacity 140ms ease ${toolsOpen ? i * 40 : (2 - i) * 30}ms`,
                        ].join(', '),
                      }}
                    >
                      <button
                        onClick={item.onClick}
                        className={`group/btn flex items-center overflow-hidden border transition-all surface-raised ${
                          item.active
                            ? 'bg-blue-500/15 text-blue-400 border-blue-500'
                            : 'bg-gray-900 text-gray-500 border-gray-700 hover:border-gray-500 hover:text-gray-300'
                        }`}
                        style={{ padding: '6px 8px' }}
                      >
                        <item.icon size={11} className="shrink-0" />
                        <span className="font-mono text-[10px] tracking-wider uppercase max-w-0 overflow-hidden whitespace-nowrap group-hover/btn:max-w-[80px] group-hover/btn:ml-1.5 transition-all duration-200">
                          {item.label}
                        </span>
                        {item.dot && <span className="ml-1 w-1 h-1 bg-blue-400 animate-pulse shrink-0" />}
                      </button>
                    </div>
                  ))}
                </div>

                {/* Assets FAB — floating bottom-right */}
                <button
                  onClick={() => setAssetSidebarOpen(o => !o)}
                  className={`absolute bottom-5 right-5 z-20 flex items-center gap-1.5 px-3 py-1.5 font-mono text-[10px] tracking-wider uppercase border transition-colors surface-raised ${
                    assetSidebarOpen
                      ? 'bg-amber-500/15 text-amber-400 border-amber-500'
                      : 'bg-gray-900 text-gray-500 border-gray-700 hover:border-amber-600 hover:text-amber-400'
                  }`}
                >
                  <Package size={12} />
                  Assets
                </button>

                {/* Page switcher — bottom-center */}
                {numPages > 1 && (
                  <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-3 z-20 bg-gray-900 border border-gray-700 px-3 py-1.5 surface-raised">
                    <button
                      disabled={pageNumber <= 1}
                      onClick={() => setPageNumber(prev => prev - 1)}
                      className="text-gray-500 disabled:opacity-25 hover:text-gray-200 transition-colors"
                    >
                      <ChevronLeft size={14}/>
                    </button>
                    <span className="font-mono text-[10px] text-gray-400 tabular-nums tracking-wider">{pageNumber} / {numPages}</span>
                    <button
                      disabled={pageNumber >= numPages}
                      onClick={() => setPageNumber(prev => prev + 1)}
                      className="text-gray-500 disabled:opacity-25 hover:text-gray-200 transition-colors"
                    >
                      <ChevronRight size={14}/>
                    </button>
                  </div>
                )}

                <TransformComponent wrapperClass="!w-full !h-full" contentClass="!w-full !h-full flex justify-center items-center">
                  <div 
                    ref={mapRef}
                    className={`relative inline-block border-2 bg-white ${
                      isAdminMode ? 'cursor-crosshair border-blue-500' : 'cursor-grab active:cursor-grabbing border-gray-700'
                    }`}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={() => setDrawingZone(null)}
                    onDragStart={(e) => e.preventDefault()}
                  >
                    {activePlan.image_url.toLowerCase().includes('.pdf') ? (
                      <Document 
                        file={activePlan.image_url} 
                        onLoadSuccess={({ numPages }) => setNumPages(numPages)}
                        loading={<div className="p-24 text-gray-500 animate-pulse font-medium text-center">Loading PDF Data...</div>}
                        className="pointer-events-none"
                      >
                        <Page 
                          pageNumber={pageNumber} 
                          renderTextLayer={false} 
                          renderAnnotationLayer={false} 
                          className="pointer-events-none select-none"
                          width={1200}
                        />
                      </Document>
                    ) : (
                      <img 
                        src={activePlan.image_url} 
                        alt="Floor Plan" 
                        className="w-[1200px] object-contain pointer-events-none select-none" 
                      />
                    )}

                    {rooms.filter(r => (r.page_number || 1) === pageNumber).map(room => (
                      <RoomZone
                        key={room.id}
                        room={room}
                        items={items.filter(i => i.room_id === room.id)}
                        activeAdmin={isAdminMode}
                        mapRef={mapRef}
                        onDeleteZone={handleDeleteZone}
                        onEditZone={setEditingRoom}
                        onUpdateZone={handleUpdateZone}
                        onItemDeleted={() => fetchRooms(activePlanId!)}
                        spotlightType={activeSpotlightType}
                        spotlightParent={activeSpotlightParent}
                        spotlightAttribute={activeSpotlightAttribute}
                        tagMeta={tagMeta}
                        closeSignal={closeSignal}
                      />
                    ))}

                    {drawingZone && isAdminMode && (
                      <div
                        className="absolute bg-indigo-500/30 border-2 border-indigo-500"
                        style={{
                          left: `${Math.min(drawingZone.startX, drawingZone.currentX)}%`,
                          top: `${Math.min(drawingZone.startY, drawingZone.currentY)}%`,
                          width: `${Math.abs(drawingZone.currentX - drawingZone.startX)}%`,
                          height: `${Math.abs(drawingZone.currentY - drawingZone.startY)}%`,
                        }}
                      />
                    )}
                  </div>
                </TransformComponent>
              </>
            )}
          </TransformWrapper>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <Layers size={48} className="mb-4 opacity-50" />
            <p>No floor plans available.</p>
          </div>
        )}
      </div>

      {pendingZoneParams && (
        <NewZoneModal
          pageNumber={pageNumber}
          onCancel={() => setPendingZoneParams(null)}
          onSave={handleCreateZone}
        />
      )}

      {editingRoom && (
        <NewZoneModal
          pageNumber={editingRoom.page_number || pageNumber}
          initialRoom={editingRoom}
          onCancel={() => setEditingRoom(null)}
          onSave={handleSaveEditZone}
        />
      )}

      {assetSidebarOpen && (
        <AssetSidebar onClose={() => setAssetSidebarOpen(false)} />
      )}

      {tagManagerOpen && (
        <TagManagerModal onClose={() => setTagManagerOpen(false)} />
      )}
    </div>
  );
}

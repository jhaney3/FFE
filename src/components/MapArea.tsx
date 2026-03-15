'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import RoomZone from '@/components/RoomZone';
import PdfUploader from './PdfUploader';
import NewZoneModal from './NewZoneModal';
import { Layers, ShieldAlert, Trash2, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Maximize } from 'lucide-react';
import { Document, Page, pdfjs } from 'react-pdf';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export default function MapArea() {
  const [floorPlans, setFloorPlans] = useState<any[]>([]);
  const [activePlanId, setActivePlanId] = useState<string | null>(null);
  const [rooms, setRooms] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [pendingZoneParams, setPendingZoneParams] = useState<{x: number, y: number, width: number, height: number} | null>(null);
  
  // PDF state
  const [numPages, setNumPages] = useState<number>(1);
  const [pageNumber, setPageNumber] = useState<number>(1);

  // Drawing state
  const [drawingZone, setDrawingZone] = useState<{ startX: number; startY: number; currentX: number; currentY: number } | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchFloorPlans();
  }, []);

  useEffect(() => {
    setNumPages(1);
    setPageNumber(1);
    if (activePlanId) fetchRooms(activePlanId);
  }, [activePlanId]);

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
        if (itemsData) setItems(itemsData);
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
    
    setPendingZoneParams({ x: left, y: top, width, height });
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
      map_coordinates: pendingZoneParams
    }]);

    if (!error) {
      setPendingZoneParams(null);
      fetchRooms(activePlanId!);
    } else {
      alert(error.message);
    }
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
    <div className="flex-1 flex flex-col h-full bg-gray-50 dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800">
      <div className="min-h-[4rem] py-3 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 flex flex-wrap gap-4 items-center justify-between px-6 shrink-0 shadow-sm z-10">
        <div className="flex flex-wrap gap-2 items-center">
          {floorPlans.map(plan => (
            <button
              key={plan.id}
              onClick={() => setActivePlanId(plan.id)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activePlanId === plan.id 
                  ? 'bg-blue-50 text-blue-600 border border-blue-200 shadow-sm dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800/50' 
                  : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
              }`}
            >
              {plan.name}
            </button>
          ))}
          <PdfUploader onUploaded={fetchFloorPlans} />
        </div>
        
        <div className="flex items-center space-x-3">
          {activePlan && (
            <button
              onClick={deleteActivePlan}
              title="Delete Floor Plan"
              className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
            >
              <Trash2 size={18} />
            </button>
          )}

          <button
            onClick={() => setIsAdminMode(!isAdminMode)}
            className={`flex items-center space-x-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
              isAdminMode ? 'bg-indigo-100 text-indigo-700 border border-indigo-200 dark:bg-indigo-900/40 dark:text-indigo-300 dark:border-indigo-800' : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
            }`}
          >
            <ShieldAlert size={16} />
            <span>Admin Mode</span>
            {isAdminMode && <span className="flex h-2 w-2 rounded-full bg-indigo-500 animate-pulse ml-2" />}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden bg-gray-100 dark:bg-gray-950 flex flex-col items-center justify-center pattern-dots relative">
        {activePlan ? (
          <TransformWrapper
            initialScale={1}
            minScale={0.1}
            maxScale={4}
            centerOnInit={true}
            disabled={isAdminMode} // disable drag-to-pan in admin mode
            limitToBounds={false}
          >
            {({ zoomIn, zoomOut, resetTransform }) => (
              <>
                <div className="absolute top-6 right-6 flex flex-col gap-2 z-20 bg-white/90 dark:bg-black/90 p-1.5 rounded-xl shadow-lg border border-gray-200 dark:border-gray-800 backdrop-blur-md">
                  <button onClick={() => zoomIn()} className="p-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"><ZoomIn size={20}/></button>
                  <button onClick={() => zoomOut()} className="p-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"><ZoomOut size={20}/></button>
                  <button onClick={() => resetTransform()} className="p-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"><Maximize size={20}/></button>
                </div>

                {numPages > 1 && (
                  <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4 z-20 bg-white/90 dark:bg-black/90 px-4 py-2 rounded-full shadow-lg border border-gray-200 dark:border-gray-800 backdrop-blur-md">
                    <button 
                      disabled={pageNumber <= 1}
                      onClick={() => setPageNumber(prev => prev - 1)}
                      className="p-1 disabled:opacity-30 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full"
                    >
                      <ChevronLeft size={20}/>
                    </button>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Page {pageNumber} of {numPages}</span>
                    <button 
                      disabled={pageNumber >= numPages}
                      onClick={() => setPageNumber(prev => prev + 1)}
                      className="p-1 disabled:opacity-30 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full"
                    >
                      <ChevronRight size={20}/>
                    </button>
                  </div>
                )}

                <TransformComponent wrapperClass="!w-full !h-full" contentClass="!w-full !h-full flex justify-center items-center">
                  <div 
                    ref={mapRef}
                    className={`relative inline-block border-2 border-gray-200 dark:border-gray-700 shadow-2xl bg-white ${
                      isAdminMode ? 'cursor-crosshair border-indigo-500 ring-4 ring-indigo-500/20' : 'cursor-grab active:cursor-grabbing'
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
                        onDeleteZone={handleDeleteZone}
                        onItemDeleted={() => fetchRooms(activePlanId!)}
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
    </div>
  );
}

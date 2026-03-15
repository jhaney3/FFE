'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import Sidebar from '@/components/Sidebar';

const MapArea = dynamic(() => import('@/components/MapArea'), {
  ssr: false,
});
import Dashboard from '@/components/Dashboard';
import FormModal from '@/components/FormModal';
import { DndContext, DragOverlay, useSensor, useSensors, PointerSensor } from '@dnd-kit/core';
import { LayoutGrid, Map as MapIcon, Database } from 'lucide-react';

export default function Home() {
  const [activeTab, setActiveTab] = useState<'map' | 'list'>('map');
  const [activePhoto, setActivePhoto] = useState<any>(null);
  const [modalState, setModalState] = useState<{ photo: any, room: any } | null>(null);
  const [itemsVersion, setItemsVersion] = useState(0);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const handleDragStart = (event: any) => {
    setActivePhoto(event.active.data.current?.photo);
  };

  const handleDragEnd = (event: any) => {
    setActivePhoto(null);
    const { over, active } = event;

    if (over && active) {
      const photo = active.data.current?.photo;
      const room = over.data.current?.room;
      // Delay one task so dnd-kit's post-drag async cleanup (focus restoration,
      // accessibility announcements) fully completes before the modal opens.
      setTimeout(() => setModalState({ photo, room }), 50);
    }
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-white dark:bg-gray-950 font-sans">
      <div className="h-14 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 flex items-center px-6 justify-between shrink-0 shadow-sm z-20">
         <div className="font-bold text-lg tracking-tight flex items-center gap-2 text-gray-900 dark:text-gray-100 hidden md:flex">
           <Database className="text-blue-600 dark:text-blue-500" size={20} />
           <span>Church FFE Transition</span>
         </div>
         <div className="flex bg-gray-100 dark:bg-gray-900 p-1 rounded-lg">
           <button 
             onClick={() => setActiveTab('map')} 
             className={`flex items-center gap-2 px-5 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === 'map' ? 'bg-white dark:bg-gray-800 shadow text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'}`}
           >
             <MapIcon size={16}/> <span className="hidden sm:inline">Map View</span>
           </button>
           <button 
             onClick={() => setActiveTab('list')} 
             className={`flex items-center gap-2 px-5 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === 'list' ? 'bg-white dark:bg-gray-800 shadow text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'}`}
           >
             <LayoutGrid size={16}/> <span className="hidden sm:inline">List View</span>
           </button>
         </div>
      </div>
      
      <main className="flex-1 w-full bg-white dark:bg-gray-950 relative flex min-h-0 min-w-0">
        {activeTab === 'map' ? (
          <DndContext
            sensors={sensors}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            accessibility={{ restoreFocus: false }}
          >
            <Sidebar />
            <MapArea itemsVersion={itemsVersion} />
            
            <DragOverlay dropAnimation={null}>
              {activePhoto ? (
                <div className="w-10 h-10 rounded-full overflow-hidden bg-white shadow-2xl cursor-grabbing ring-2 ring-blue-500 transition-transform origin-center flex items-center justify-center relative translate-x-2 -translate-y-2 pointer-events-none">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={activePhoto.photo_url} alt="Dragging item" className="w-full h-full object-cover opacity-60" />
                  <div className="absolute inset-0 flex items-center justify-center bg-blue-500/30">
                     <span className="text-white drop-shadow-md"><LayoutGrid size={14} /></span>
                  </div>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        ) : (
          <Dashboard />
        )}
      </main>

      {modalState && (
        <FormModal
          photo={modalState.photo}
          room={modalState.room}
          onClose={() => setModalState(null)}
          onSaved={() => setItemsVersion(v => v + 1)}
        />
      )}
    </div>
  );
}

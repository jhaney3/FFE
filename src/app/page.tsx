'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import Sidebar from '@/components/Sidebar';

const MapArea = dynamic(() => import('@/components/MapArea'), {
  ssr: false,
});
import Dashboard from '@/components/Dashboard';
import FormModal from '@/components/FormModal';
import AssetDropModal from '@/components/AssetDropModal';
import { DndContext, DragOverlay, useSensor, useSensors, PointerSensor } from '@dnd-kit/core';
import { LayoutGrid, Map as MapIcon, Database, LogOut } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';

export default function Home() {
  const [activeTab, setActiveTab] = useState<'map' | 'list'>('map');
  const [activePhoto, setActivePhoto] = useState<any>(null);
  const [activeAsset, setActiveAsset] = useState<any>(null);
  const [modalState, setModalState] = useState<{ photo: any, room: any } | null>(null);
  const [assetDropState, setAssetDropState] = useState<{ asset: any, room: any } | null>(null);
  const [itemsVersion, setItemsVersion] = useState(0);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Centers the DragOverlay on the cursor instead of anchoring to the draggable element's top-left
  const snapCenterToCursor = ({ transform, draggingNodeRect, activatorEvent }: any) => {
    if (!draggingNodeRect || !activatorEvent) return transform;
    const overlayHalf = 20; // half of the 40px (w-10) overlay
    return {
      ...transform,
      x: transform.x + activatorEvent.clientX - draggingNodeRect.left - overlayHalf,
      y: transform.y + activatorEvent.clientY - draggingNodeRect.top - overlayHalf,
    };
  };

  const handleDragStart = (event: any) => {
    const data = event.active.data.current;
    if (data?.type === 'asset') {
      setActiveAsset(data.asset);
    } else {
      setActivePhoto(data?.photo);
    }
  };

  const handleDragEnd = (event: any) => {
    setActivePhoto(null);
    setActiveAsset(null);
    const { over, active } = event;

    if (over && active) {
      const data = active.data.current;
      const room = over.data.current?.room;
      if (data?.type === 'asset') {
        setTimeout(() => setAssetDropState({ asset: data.asset, room }), 50);
      } else {
        const photo = data?.photo;
        setTimeout(() => setModalState({ photo, room }), 50);
      }
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
         <div className="flex items-center gap-3">
           {user?.user_metadata?.avatar_url && (
             // eslint-disable-next-line @next/next/no-img-element
             <img src={user.user_metadata.avatar_url} alt={user.user_metadata?.full_name} className="w-8 h-8 rounded-full border border-gray-200 dark:border-gray-700" />
           )}
           {user && (
             <span className="text-sm text-gray-600 dark:text-gray-400 hidden md:inline">{user.user_metadata?.full_name || user.email}</span>
           )}
           <button
             onClick={handleSignOut}
             title="Sign out"
             className="text-gray-400 hover:text-red-500 transition-colors p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
           >
             <LogOut size={16} />
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
            modifiers={[snapCenterToCursor]}
          >
            <Sidebar />
            <MapArea itemsVersion={itemsVersion} />
            
            <DragOverlay dropAnimation={null}>
              {activePhoto ? (
                <div className="w-10 h-10 rounded-full overflow-hidden bg-white shadow-2xl cursor-grabbing ring-2 ring-blue-500 flex items-center justify-center relative pointer-events-none">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={activePhoto.photo_url} alt="Dragging item" className="w-full h-full object-cover opacity-60" />
                  <div className="absolute inset-0 flex items-center justify-center bg-blue-500/30">
                    <span className="text-white drop-shadow-md"><LayoutGrid size={14} /></span>
                  </div>
                </div>
              ) : activeAsset ? (
                <div className="w-14 h-14 rounded-xl overflow-hidden bg-white shadow-2xl cursor-grabbing ring-2 ring-amber-400 pointer-events-none">
                  {activeAsset.photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={activeAsset.photo_url} alt={activeAsset.name} className="w-full h-full object-cover opacity-80" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-amber-50">
                      <LayoutGrid size={18} className="text-amber-400" />
                    </div>
                  )}
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

      {assetDropState && (
        <AssetDropModal
          asset={assetDropState.asset}
          room={assetDropState.room}
          onClose={() => setAssetDropState(null)}
          onSaved={() => setItemsVersion(v => v + 1)}

        />
      )}
    </div>
  );
}

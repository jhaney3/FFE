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
import { LayoutGrid, Map as MapIcon, Database, LogOut, WifiOff } from 'lucide-react';
import { BandwidthProvider, useLowBandwidth } from '@/lib/BandwidthContext';
import { supabase } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';

function HomeInner() {
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
    <div className="flex flex-col h-screen overflow-hidden bg-gray-950 font-sans">
      <div className="h-11 border-b border-gray-800 bg-gray-950 flex items-center px-5 justify-between shrink-0 z-20">
        <div className="hidden md:flex items-center gap-3">
          <Database size={13} className="text-blue-500 shrink-0" />
          <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-gray-400">
            FFE <span className="text-gray-700 mx-1.5">·</span> Transition Registry
          </span>
          <div className="flex items-center gap-1 border-l border-gray-800 pl-3">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500 opacity-80" />
            <span className="font-mono text-[9px] tracking-widest uppercase text-gray-600">Live</span>
          </div>
        </div>
        <div className="flex items-center gap-px">
          <button
            onClick={() => setActiveTab('map')}
            className={`flex items-center gap-1.5 px-4 py-1.5 font-mono text-[10px] tracking-[0.12em] uppercase border transition-colors ${
              activeTab === 'map'
                ? 'border-blue-600 bg-blue-600/10 text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-300 hover:bg-gray-900'
            }`}
          >
            <MapIcon size={11} /> Map
          </button>
          <button
            onClick={() => setActiveTab('list')}
            className={`flex items-center gap-1.5 px-4 py-1.5 font-mono text-[10px] tracking-[0.12em] uppercase border transition-colors ${
              activeTab === 'list'
                ? 'border-blue-600 bg-blue-600/10 text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-300 hover:bg-gray-900'
            }`}
          >
            <LayoutGrid size={11} /> List
          </button>
        </div>
        <div className="flex items-center gap-3">
          {user?.user_metadata?.avatar_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.user_metadata.avatar_url} alt={user.user_metadata?.full_name} className="w-6 h-6 rounded-full opacity-70 border border-gray-700" />
          )}
          {user && (
            <span className="font-mono text-[10px] text-gray-500 hidden md:inline tracking-wide">{user.user_metadata?.full_name || user.email}</span>
          )}
          <BandwidthToggle />
          <button
            onClick={handleSignOut}
            title="Sign out"
            className="text-gray-600 hover:text-gray-300 transition-colors p-1"
          >
            <LogOut size={13} />
          </button>
        </div>
      </div>

      <main className="flex-1 w-full bg-gray-950 relative flex min-h-0 min-w-0">
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
                <div className="w-10 h-10 overflow-hidden bg-gray-900 cursor-grabbing border border-blue-500 flex items-center justify-center relative pointer-events-none">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={activePhoto.photo_url} alt="Dragging item" className="w-full h-full object-cover opacity-60" />
                  <div className="absolute inset-0 flex items-center justify-center bg-blue-500/20">
                    <span className="text-blue-400"><LayoutGrid size={13} /></span>
                  </div>
                </div>
              ) : activeAsset ? (
                <div className="w-14 h-14 overflow-hidden bg-gray-900 cursor-grabbing border border-amber-500/60 pointer-events-none">
                  {activeAsset.photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={activeAsset.photo_url} alt={activeAsset.name} className="w-full h-full object-cover opacity-80" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gray-800">
                      <LayoutGrid size={16} className="text-amber-400" />
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

function BandwidthToggle() {
  const { lowBandwidth, toggle } = useLowBandwidth();
  return (
    <button
      onClick={toggle}
      title={lowBandwidth ? 'Low bandwidth mode on — click to resume loading' : 'Click to pause data loading'}
      className={`flex items-center gap-1.5 px-2 py-1 font-mono text-[9px] tracking-wider uppercase border transition-colors ${
        lowBandwidth
          ? 'border-amber-700 bg-amber-900/20 text-amber-500'
          : 'border-transparent text-gray-600 hover:text-gray-300'
      }`}
    >
      <WifiOff size={11} />
      {lowBandwidth && <span>Paused</span>}
    </button>
  );
}

export default function Home() {
  return (
    <BandwidthProvider>
      <HomeInner />
    </BandwidthProvider>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import PhotoUploader from './PhotoUploader';
import { useDraggable } from '@dnd-kit/core';
import { ChevronLeft, Trash2 } from 'lucide-react';

function DraggableThumbnail({ photo, onDelete }: { photo: any, onDelete: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: photo.id,
    data: { type: 'photo', photo },
  });

  const style = {
    zIndex: isDragging ? 50 : 'auto',
    opacity: isDragging ? 0.25 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`relative group overflow-hidden border transition-colors cursor-grab active:cursor-grabbing aspect-square ${
        isDragging
          ? 'border-blue-500'
          : 'border-gray-800 hover:border-gray-600'
      }`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photo.photo_url}
        alt="Incoming Triage item"
        className="w-full h-full object-cover pointer-events-none"
        loading="lazy"
      />

      {/* Hover delete */}
      <button
        type="button"
        onPointerDown={(e) => {
          e.stopPropagation();
          onDelete(photo.id);
        }}
        className="absolute top-1 right-1 bg-gray-950/90 hover:bg-red-500/80 text-gray-500 hover:text-white p-1 opacity-0 group-hover:opacity-100 transition-all z-10 flex items-center justify-center cursor-pointer border border-gray-700 hover:border-red-400"
        title="Discard Photo"
      >
        <Trash2 size={11} />
      </button>
    </div>
  );
}

export default function Sidebar() {
  const [photos, setPhotos] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  const fetchPhotos = async (uid: string) => {
    const { data } = await supabase
      .from('IncomingPhotos')
      .select('*')
      .eq('status', 'pending')
      .eq('uploaded_by', uid)
      .order('created_at', { ascending: false });

    if (data) setPhotos(data);
  };

  const deletePhoto = async (id: string) => {
    const photo = photos.find(p => p.id === id);
    setPhotos(prev => prev.filter(p => p.id !== id));
    await supabase.from('IncomingPhotos').delete().eq('id', id);
    if (photo?.photo_url) {
      const marker = '/inventory_photos/';
      const idx = photo.photo_url.indexOf(marker);
      const filePath = idx !== -1 ? photo.photo_url.slice(idx + marker.length) : photo.photo_url.split('/').pop();
      if (filePath) await supabase.storage.from('inventory_photos').remove([filePath]);
    }
  };

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const uid = data.user?.id;
      if (!uid) return;
      setUserId(uid);
      fetchPhotos(uid);

      const channel = supabase
        .channel(`incoming-photos-${uid}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'IncomingPhotos', filter: `uploaded_by=eq.${uid}` },
          (payload) => {
            const photo = payload.new as any;
            if (photo.status === 'pending') {
              setPhotos(prev => [photo, ...prev]);
            }
          }
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'IncomingPhotos', filter: `uploaded_by=eq.${uid}` },
          (payload) => {
            const photo = payload.new as any;
            if (photo.status === 'pending') {
              setPhotos(prev => prev.find(p => p.id === photo.id) ? prev : [photo, ...prev]);
            } else {
              setPhotos(prev => prev.filter(p => p.id !== photo.id));
            }
          }
        )
        .on(
          'postgres_changes',
          { event: 'DELETE', schema: 'public', table: 'IncomingPhotos' },
          (payload) => {
            setPhotos(prev => prev.filter(p => p.id !== payload.old.id));
          }
        )
        .subscribe();

      return () => { supabase.removeChannel(channel); };
    });
  }, []);

  return (
    <div className="h-full shrink-0 relative z-10">
      {/* Collapsing content panel */}
      <div
        style={{ width: isOpen ? 288 : 0, transition: 'width 0.22s ease-in-out' }}
        className="h-full overflow-hidden"
      >
        <div className="w-72 h-full bg-gray-950 border-r border-gray-800 flex flex-col surface-raised">

          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between shrink-0">
            <p className="font-mono text-[10px] tracking-[0.18em] uppercase text-gray-500">Triage Queue</p>
            {photos.length > 0 && (
              <span className="font-mono text-[10px] text-blue-400 bg-blue-900/20 border border-blue-700/40 px-1.5 py-0.5 tabular-nums">
                {photos.length}
              </span>
            )}
          </div>

          <PhotoUploader />

          {/* 2-column photo grid */}
          <div className="flex-1 overflow-y-auto p-3 custom-scrollbar min-h-0">
            {photos.length > 0 ? (
              <div className="grid grid-cols-2 gap-2">
                {photos.map((photo) => (
                  <DraggableThumbnail key={photo.id} photo={photo} onDelete={deletePhoto} />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-32 gap-2">
                <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-gray-700">No items</span>
                <p className="text-xs text-gray-700">Scan the QR code to upload photos.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Toggle tab */}
      <button
        onClick={() => setIsOpen(o => !o)}
        title={isOpen ? 'Hide triage panel' : 'Show triage panel'}
        style={{ left: isOpen ? 288 : 0, transition: 'left 0.22s ease-in-out' }}
        className="absolute top-1/2 -translate-y-1/2 w-4 h-10 bg-gray-900 border border-l-0 border-gray-800 flex items-center justify-center hover:bg-gray-800 transition-colors"
      >
        <ChevronLeft
          size={12}
          className="text-gray-600"
          style={{ transition: 'transform 0.22s ease-in-out', transform: isOpen ? 'rotate(0deg)' : 'rotate(180deg)' }}
        />
      </button>
    </div>
  );
}

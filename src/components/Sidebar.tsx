'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import PhotoUploader from './PhotoUploader';
import { useDraggable } from '@dnd-kit/core';
import { Trash2 } from 'lucide-react';

function DraggableThumbnail({ photo, onDelete }: { photo: any, onDelete: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: photo.id,
    data: { type: 'photo', photo },
  });

  const style = {
    zIndex: isDragging ? 50 : 'auto',
    opacity: isDragging ? 0.3 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`relative group rounded-md overflow-hidden bg-gray-100 shadow-sm border border-gray-200 hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing ${isDragging ? 'shadow-xl ring-2 ring-blue-500' : ''}`}
    >
      <img 
        src={photo.photo_url} 
        alt="Incoming Triage item" 
        className="w-full h-32 object-cover pointer-events-none transition-all" 
      />
      
      {/* Delete Overlay */}
      <button
        type="button"
        onPointerDown={(e) => {
          e.stopPropagation(); // Stop drag kit from stealing the click
          onDelete(photo.id);
        }}
        className="absolute top-2 right-2 bg-red-500/90 hover:bg-red-600 text-white p-1.5 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-10 flex items-center justify-center cursor-pointer"
        title="Discard Photo"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}

export default function Sidebar() {
  const [photos, setPhotos] = useState<any[]>([]);

  const fetchPhotos = async () => {
    const { data, error } = await supabase
      .from('IncomingPhotos')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    
    if (data) setPhotos(data);
  };

  const deletePhoto = async (id: string) => {
    // Optimistic UI update
    setPhotos(prev => prev.filter(p => p.id !== id));
    await supabase.from('IncomingPhotos').delete().eq('id', id);
  };

  useEffect(() => {
    fetchPhotos();
    
    // Set up realtime subscription for new incoming photos
    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'IncomingPhotos'
        },
        () => {
          fetchPhotos();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div className="w-80 bg-white dark:bg-gray-950 border-r border-gray-200 dark:border-gray-800 flex flex-col h-full overflow-hidden shrink-0 z-10 shadow-lg">
      <div className="p-4 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950">
        <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 tracking-tight">Incoming Triage</h2>
        <p className="text-sm text-gray-500 mt-1">Drag and drop unassigned photos to specific rooms on the floor plan.</p>
      </div>
      
      <PhotoUploader />

      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 dark:bg-gray-900/20 custom-scrollbar min-h-0">
        {photos.map((photo) => (
          <DraggableThumbnail key={photo.id} photo={photo} onDelete={deletePhoto} />
        ))}
        {photos.length === 0 && (
          <div className="flex flex-col items-center justify-center text-gray-400 text-sm h-32 space-y-2">
            <span className="text-2xl">📸</span>
            <p>Queue is empty.</p>
          </div>
        )}
      </div>
    </div>
  );
}

'use client';

import { useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Camera, CheckCircle2, Loader2, RefreshCcw } from 'lucide-react';

export default function CameraPage() {
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCapture = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);
      setSuccess(false);
      
      if (!event.target.files || event.target.files.length === 0) return;

      const file = event.target.files[0];
      const fileExt = file.name.split('.').pop() || 'jpg';
      const fileName = `mobile_capture_${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

      // Upload raw image to bucket
      const { error: uploadError } = await supabase.storage
        .from('inventory_photos')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data } = supabase.storage
        .from('inventory_photos')
        .getPublicUrl(fileName);

      // Insert into incoming triage queue
      const { error: dbError } = await supabase
        .from('IncomingPhotos')
        .insert([{ 
          photo_url: data.publicUrl, 
          uploaded_by: 'Mobile User', 
          status: 'pending' 
        }]);

      if (dbError) throw dbError;

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (error: any) {
      alert(`Upload failed: ${error.message}`);
    } finally {
      setUploading(false);
      // Reset input so the same file can be captured again if needed
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 sm:p-12 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/30 via-black to-blue-900/20 z-0"/>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl z-0 pointer-events-none"/>
      
      <div className="z-10 w-full max-w-md flex flex-col items-center">
        
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-white tracking-tight mb-2">Inventory Camera</h1>
          <p className="text-indigo-200/70 text-sm">Snap a photo to instantly beam it to the triage dashboard.</p>
        </div>

        {/* Main Action Button */}
        <div className="relative group">
          <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full blur opacity-50 group-hover:opacity-100 transition duration-500"/>
          
          <button 
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className={`relative flex items-center justify-center w-40 h-40 sm:w-56 sm:h-56 rounded-full shadow-2xl transition-all duration-300 ${
              uploading ? 'bg-indigo-900 scale-95 border-4 border-indigo-700' : 'bg-gradient-to-br from-indigo-500 to-blue-600 hover:scale-105 active:scale-95 border-4 border-white/20'
            }`}
          >
            {uploading ? (
              <div className="flex flex-col items-center text-white">
                <Loader2 className="w-12 h-12 sm:w-16 sm:h-16 animate-spin mb-3 opacity-90" />
                <span className="font-semibold text-sm sm:text-base tracking-wide uppercase">Sending...</span>
              </div>
            ) : (
              <div className="flex flex-col items-center text-white">
                <Camera aria-hidden className="w-14 h-14 sm:w-20 sm:h-20 mb-3 drop-shadow-md" />
                <span className="font-bold tracking-widest text-sm sm:text-lg uppercase drop-shadow-sm">Capture</span>
              </div>
            )}
          </button>
        </div>

        {/* Hidden File Input targeted at mobile cameras */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleCapture}
          className="hidden"
        />

        {/* Success Feedback */}
        <div className={`mt-10 flex items-center gap-2 px-6 py-3 rounded-2xl bg-green-500/20 border border-green-500/30 text-green-400 font-medium transition-all duration-500 ${success ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
          <CheckCircle2 size={24} />
          <span>Upload Successful! Ready for next.</span>
        </div>

        {/* Footer info */}
        <div className="absolute bottom-8 text-white/30 text-xs flex items-center gap-2">
          <RefreshCcw size={12} />
          Synced securely via Supabase Realtime
        </div>
      </div>
    </div>
  );
}

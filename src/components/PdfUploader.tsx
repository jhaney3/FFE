'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Upload, FileUp, Loader2 } from 'lucide-react';

export default function PdfUploader({ onUploaded }: { onUploaded: () => void }) {
  const [uploading, setUploading] = useState(false);

  const uploadPdf = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);
      if (!event.target.files || event.target.files.length === 0) {
        throw new Error('You must select a PDF to upload.');
      }

      const file = event.target.files[0];
      const fileName = `${Math.random()}.pdf`;
      const filePath = `${fileName}`;
      
      const planName = prompt("Enter a name for this floor plan (e.g. 'Main Level'):") || 'New Level';

      const { error: uploadError } = await supabase.storage
        .from('floor_plans')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('floor_plans')
        .getPublicUrl(filePath);

      const { error: dbError } = await supabase
        .from('FloorPlans')
        .insert([{ name: planName, image_url: data.publicUrl }]);

      if (dbError) throw dbError;

      onUploaded();
    } catch (error: any) {
      alert(error.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <label className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium flex items-center gap-2 hover:bg-indigo-700 cursor-pointer shadow-sm transition-colors">
      {uploading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <FileUp size={16} />
      )}
      <span>Upload PDF Plan</span>
      <input
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={uploadPdf}
        disabled={uploading}
      />
    </label>
  );
}

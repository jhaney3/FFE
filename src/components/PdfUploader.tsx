'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Upload, FileUp, Loader2 } from 'lucide-react';
import { useProjectId } from '@/lib/ProjectContext';

export default function PdfUploader({ onUploaded }: { onUploaded: () => void }) {
  const projectId = useProjectId();
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
        .insert([{ name: planName, image_url: data.publicUrl, project_id: projectId }]);

      if (dbError) throw dbError;

      onUploaded();
    } catch (error: any) {
      alert(error.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <label className="px-3 py-1 border border-gray-600 bg-gray-900 text-gray-400 hover:border-blue-600 hover:text-blue-400 font-mono text-[10px] tracking-wider uppercase flex items-center gap-1.5 cursor-pointer transition-colors">
      {uploading ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : (
        <FileUp size={12} />
      )}
      <span>{uploading ? 'Uploading...' : 'Upload PDF'}</span>
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

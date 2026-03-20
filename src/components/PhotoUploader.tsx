'use client';

import { useState, useEffect } from 'react';
import { QrCode, Smartphone, ChevronUp, ChevronDown } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '@/lib/supabase';

export default function PhotoUploader() {
  const [cameraUrl, setCameraUrl] = useState('');
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const uid = data.user?.id ?? 'unknown';
      setCameraUrl(`${window.location.origin}/camera?uid=${uid}`);
    });
  }, []);

  return (
    <div className="border-b border-gray-200 dark:border-gray-800 bg-gray-50/80 dark:bg-gray-900/40 flex flex-col items-center">
      {/* Header bar that doubles as the toggle */}
      <button 
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="w-full flex items-center justify-between p-4 hover:bg-black/5 dark:hover:bg-white/5 transition-colors focus:outline-none"
      >
        <div className="flex items-center gap-2 text-gray-800 dark:text-gray-200 font-semibold tracking-tight">
          <Smartphone size={18} className="text-indigo-500" />
          <span>Mobile Triage Camera</span>
        </div>
        <div className="text-gray-400">
          {isCollapsed ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
        </div>
      </button>

      {/* Expandable Content */}
      <div 
        className={`w-full overflow-hidden transition-all duration-300 ease-in-out flex flex-col items-center ${
          isCollapsed ? 'max-h-0 opacity-0' : 'max-h-[300px] opacity-100 pb-5 px-5'
        }`}
      >
        <div className="bg-white p-3 rounded-2xl shadow-sm border border-gray-200/50 hover:shadow-md transition-shadow">
          {cameraUrl ? (
            <QRCodeSVG 
              value={cameraUrl} 
              size={160} 
              bgColor="#ffffff" 
              fgColor="#1e1b4b" 
              level="Q" 
              marginSize={2}
            />
          ) : (
            <div className="w-[160px] h-[160px] bg-gray-100 animate-pulse rounded-xl flex items-center justify-center">
              <QrCode className="text-gray-300 w-10 h-10" />
            </div>
          )}
        </div>

        <div className="mt-4 text-center space-y-2 w-full">
          <p className="text-xs text-gray-500 font-medium px-4">
            Scan to open the rapid-capture camera. Photos will instantly sync here!
          </p>
        </div>
      </div>
    </div>
  );
}

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
    <div className="border-b border-gray-800 flex flex-col items-center">
      {/* Header bar — toggle */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-gray-900/60 transition-colors focus:outline-none"
      >
        <div className="flex items-center gap-2">
          <Smartphone size={12} className="text-blue-500" />
          <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-gray-500">Mobile Capture</span>
        </div>
        <div className="text-gray-700">
          {isCollapsed ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
        </div>
      </button>

      {/* Expandable Content */}
      <div
        className={`w-full overflow-hidden transition-all duration-300 ease-in-out flex flex-col items-center ${
          isCollapsed ? 'max-h-0 opacity-0' : 'max-h-[280px] opacity-100 pb-4 px-4'
        }`}
      >
        <div className="border border-gray-800 p-2 bg-gray-900">
          {cameraUrl ? (
            <QRCodeSVG
              value={cameraUrl}
              size={148}
              bgColor="#0c0e1a"
              fgColor="#dde2f0"
              level="Q"
              marginSize={1}
            />
          ) : (
            <div className="w-[148px] h-[148px] bg-gray-900 border border-gray-800 flex items-center justify-center">
              <QrCode className="text-gray-700 w-8 h-8" />
            </div>
          )}
        </div>

        <p className="mt-3 text-[11px] text-gray-600 text-center px-2 leading-relaxed">
          Scan to open rapid-capture camera. Photos sync instantly.
        </p>
      </div>
    </div>
  );
}

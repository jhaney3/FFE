'use client';

import { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

interface Room {
  id: string;
  name: string;
  map_coordinates: { x: number; y: number; width: number; height: number } | null;
  page_number: number;
}

interface Props {
  floorPlan: { id: string; name: string; image_url: string };
  rooms: Room[];
  activeRoomIds: Set<string>;
  pageNumber: number;
}

// SVG overlay for room annotations — no canvas needed for image floor plans.
// viewBox="0 0 100 100" + preserveAspectRatio="none" maps room % coords directly.
function RoomOverlay({ rooms, activeRoomIds }: { rooms: Room[]; activeRoomIds: Set<string> }) {
  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden="true"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
    >
      {rooms.map(room => {
        if (!room.map_coordinates) return null;
        const { x, y, width, height } = room.map_coordinates;
        const hasItems = activeRoomIds.has(room.id);
        const fontSize = Math.max(0.7, Math.min(1.3, width / 8));
        return (
          <g key={room.id}>
            <rect
              x={x} y={y} width={width} height={height}
              fill={hasItems ? 'rgba(59,130,246,0.18)' : 'rgba(148,163,184,0.06)'}
              stroke={hasItems ? '#2563eb' : '#94a3b8'}
              strokeWidth={hasItems ? 0.25 : 0.12}
            />
            {hasItems && (
              <text
                x={x + 0.4} y={y + fontSize + 0.3}
                fontSize={fontSize}
                fontWeight="bold"
                fill="#1e3a5f"
              >
                {room.name}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

export default function FloorPlanAnnotated({ floorPlan, rooms, activeRoomIds, pageNumber }: Props) {
  const isPdf = floorPlan.image_url.toLowerCase().endsWith('.pdf');

  // ── Image floor plans: direct <img> + SVG overlay, no canvas needed ──────
  if (!isPdf) {
    return (
      <div style={{ position: 'relative' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={floorPlan.image_url}
          alt={floorPlan.name}
          className="max-w-full border border-gray-200 rounded shadow-sm"
          style={{ display: 'block' }}
        />
        <RoomOverlay rooms={rooms} activeRoomIds={activeRoomIds} />
      </div>
    );
  }

  // ── PDF floor plans: pdfjs → canvas → JPEG dataUrl ───────────────────────
  return <PdfFloorPlan floorPlan={floorPlan} rooms={rooms} activeRoomIds={activeRoomIds} pageNumber={pageNumber} />;
}

function PdfFloorPlan({ floorPlan, rooms, activeRoomIds, pageNumber }: Props) {
  const canvasRef      = useRef<HTMLCanvasElement>(null);
  const renderTaskRef  = useRef<{ cancel: () => void } | null>(null);
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (renderTaskRef.current) {
      renderTaskRef.current.cancel();
      renderTaskRef.current = null;
    }

    let cancelled = false;
    setDataUrl(null);
    setError(null);

    pdfjsLib.getDocument(floorPlan.image_url).promise
      .then(pdf => pdf.getPage(pageNumber))
      .then(page => {
        if (cancelled) return;
        const viewport = page.getViewport({ scale: 1.0 }); // was 1.5 — lower scale = faster render + smaller output
        canvas.width  = viewport.width;
        canvas.height = viewport.height;
        const task = page.render({ canvasContext: ctx, viewport } as any);
        renderTaskRef.current = task;
        return task.promise;
      })
      .then(() => {
        renderTaskRef.current = null;
        if (cancelled) return;
        // Draw room annotations
        rooms.forEach(room => {
          const coords = room.map_coordinates;
          if (!coords) return;
          const x = (coords.x / 100) * canvas.width;
          const y = (coords.y / 100) * canvas.height;
          const w = (coords.width  / 100) * canvas.width;
          const h = (coords.height / 100) * canvas.height;
          const hasItems = activeRoomIds.has(room.id);
          ctx.fillStyle   = hasItems ? 'rgba(59,130,246,0.18)' : 'rgba(148,163,184,0.06)';
          ctx.fillRect(x, y, w, h);
          ctx.strokeStyle = hasItems ? '#2563eb' : '#94a3b8';
          ctx.lineWidth   = hasItems ? 2 : 1;
          ctx.strokeRect(x, y, w, h);
          if (hasItems) {
            const fontSize = Math.max(9, Math.min(13, w / 7));
            ctx.fillStyle = '#1e3a5f';
            ctx.font      = `bold ${fontSize}px sans-serif`;
            ctx.fillText(room.name, x + 4, y + fontSize + 3, w - 8);
          }
        });
        // JPEG is ~5–10× smaller than PNG and much faster to encode
        setDataUrl(canvas.toDataURL('image/jpeg', 0.88));
      })
      .catch(err => {
        renderTaskRef.current = null;
        if (!cancelled && err?.name !== 'RenderingCancelledException') {
          setError(`Could not render PDF: ${err.message}`);
        }
      });

    return () => {
      cancelled = true;
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
        renderTaskRef.current = null;
      }
    };
  }, [floorPlan, rooms, activeRoomIds, pageNumber]);

  return (
    <div>
      <canvas ref={canvasRef} className="hidden" />
      {error ? (
        <div className="p-4 bg-red-50 text-red-600 rounded text-sm">{error}</div>
      ) : dataUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={dataUrl}
          alt={`${floorPlan.name}${pageNumber > 1 ? ` — Page ${pageNumber}` : ''}`}
          className="max-w-full border border-gray-200 rounded shadow-sm"
        />
      ) : (
        <div className="flex items-center justify-center h-48 bg-gray-100 rounded text-gray-400 text-sm gap-2">
          <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
          Rendering floor plan…
        </div>
      )}
    </div>
  );
}

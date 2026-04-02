'use client';

import { useState, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
  Camera, CheckCircle2, Loader2,
  ChevronRight, ChevronLeft, Check, Plus, Minus,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

type Phase =
  | { phase: 'idle' }
  | { phase: 'uploading' }
  | { phase: 'filling';    photoUrl: string }
  | { phase: 'submitting'; photoUrl: string }
  | { phase: 'success' };

type QualityKey = 'Excellent' | 'Good' | 'Fair' | 'Poor';

const Q: Record<QualityKey, { text: string; border: string; activeBg: string; short: string }> = {
  Excellent: { text: 'text-emerald-400', border: 'border-emerald-700', activeBg: 'bg-emerald-950/60', short: 'EXC' },
  Good:      { text: 'text-blue-400',    border: 'border-blue-700',    activeBg: 'bg-blue-950/60',    short: 'GOOD' },
  Fair:      { text: 'text-amber-400',   border: 'border-amber-700',   activeBg: 'bg-amber-950/60',   short: 'FAIR' },
  Poor:      { text: 'text-red-400',     border: 'border-red-800',     activeBg: 'bg-red-950/60',     short: 'POOR' },
};

// ─── Shared primitives ───────────────────────────────────────────────────────

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-[8px] tracking-[0.25em] uppercase text-slate-600 mb-2">
      {children}
    </p>
  );
}

// Corner bracket decoration (tactical UI element)
function Brackets({ color = 'border-slate-700' }: { color?: string }) {
  const cls = `absolute w-3 h-3 ${color}`;
  return (
    <>
      <span className={`${cls} -top-px -left-px border-t border-l`} />
      <span className={`${cls} -top-px -right-px border-t border-r`} />
      <span className={`${cls} -bottom-px -left-px border-b border-l`} />
      <span className={`${cls} -bottom-px -right-px border-b border-r`} />
    </>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

function CameraCapture() {
  const uid = useSearchParams().get('uid') ?? 'unknown';
  const pid = useSearchParams().get('pid') ?? '';
  const [phase, setPhase] = useState<Phase>({ phase: 'idle' });
  const [formStep, setFormStep] = useState<1 | 2>(1);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Suggestions form state
  const [itemTypes, setItemTypes]         = useState<{ id: string; name: string }[]>([]);
  const [typeSearch, setTypeSearch]       = useState('');
  const [typeConfirmed, setTypeConfirmed] = useState(false);
  const [showDrop, setShowDrop]           = useState(false);
  const [availableAttrs, setAvailableAttrs] = useState<{ id: string; name: string; is_parent: boolean }[]>([]);
  const [selectedTags, setSelectedTags]   = useState<string[]>([]);
  const [tagFilter, setTagFilter]         = useState('');
  const [qty, setQty]                     = useState(1);
  const [quality, setQuality]             = useState<QualityKey>('Good');
  const [isSplit, setIsSplit]             = useState(false);
  const [splitQty, setSplitQty]           = useState({ Excellent: 0, Good: 1, Fair: 0, Poor: 0 });
  const [notes, setNotes]                 = useState('');

  const reset = () => {
    setFormStep(1);
    setTypeSearch(''); setTypeConfirmed(false); setShowDrop(false);
    setAvailableAttrs([]); setSelectedTags([]);
    setQty(1); setQuality('Good');
    setIsSplit(false); setSplitQty({ Excellent: 0, Good: 1, Fair: 0, Poor: 0 });
    setNotes('');
    setTagFilter('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ── Handlers ────────────────────────────────────────────────────────────

  const handleCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    const file = e.target.files[0];
    setPhase({ phase: 'uploading' });
    try {
      const ext  = file.name.split('.').pop() || 'jpg';
      const name = `mobile_capture_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage.from('inventory_photos').upload(name, file);
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage.from('inventory_photos').getPublicUrl(name);
      const { data: types } = await supabase.rpc('get_types_for_project', { p_project_id: pid });
      if (types) setItemTypes(types);
      setPhase({ phase: 'filling', photoUrl: publicUrl });
    } catch (err: any) {
      alert(err.message);
      setPhase({ phase: 'idle' });
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const confirmType = async (name: string) => {
    setTypeSearch(name); setTypeConfirmed(true); setShowDrop(false);
    const existing = itemTypes.find(t => t.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      const { data } = await supabase.from('ItemTypeAttributes').select('*').eq('item_type_id', existing.id);
      setAvailableAttrs(data ?? []);
    } else {
      setAvailableAttrs([]);
    }
  };

  const toggleTag = (name: string) => {
    const isParent = availableAttrs.find(t => t.name === name)?.is_parent ?? false;
    if (selectedTags.includes(name)) {
      setSelectedTags(p => p.filter(t => t !== name));
    } else if (isParent) {
      const parents = new Set(availableAttrs.filter(t => t.is_parent).map(t => t.name));
      setSelectedTags(p => [...p.filter(t => !parents.has(t)), name]);
    } else {
      setSelectedTags(p => [...p, name]);
    }
  };

  const handleToggleSplit = () => {
    if (!isSplit) {
      setSplitQty({
        Excellent: quality === 'Excellent' ? qty : 0,
        Good:      quality === 'Good'      ? qty : 0,
        Fair:      quality === 'Fair'      ? qty : 0,
        Poor:      quality === 'Poor'      ? qty : 0,
      });
    }
    setIsSplit(p => !p);
  };

  const submit = async (withSuggestions: boolean) => {
    const photoUrl = (phase as { photoUrl: string }).photoUrl;
    setPhase({ phase: 'submitting', photoUrl });
    try {
      const row: Record<string, any> = { photo_url: photoUrl, uploaded_by: uid, status: 'pending', project_id: pid };
      if (withSuggestions) {
        if (typeSearch.trim()) {
          row.suggestion_type_name = typeSearch.trim();
          if (selectedTags.length > 0) row.suggestion_attributes = selectedTags;
        }
        row.suggestion_quality = quality;
        if (isSplit) {
          row.suggestion_qty_excellent = splitQty.Excellent;
          row.suggestion_qty_good      = splitQty.Good;
          row.suggestion_qty_fair      = splitQty.Fair;
          row.suggestion_qty_poor      = splitQty.Poor;
          row.suggestion_quantity = Object.values(splitQty).reduce((a, b) => a + b, 0);
        } else {
          row.suggestion_quantity = qty;
        }
        if (notes.trim()) row.suggestion_notes = notes.trim();
      }
      const { error } = await supabase.from('IncomingPhotos').insert([row]);
      if (error) throw error;
      setPhase({ phase: 'success' });
    } catch (err: any) {
      alert(err.message);
      setPhase({ phase: 'filling', photoUrl });
    }
  };

  const filtered   = itemTypes.filter(t => t.name.toLowerCase().includes(typeSearch.toLowerCase()));
  const parents    = availableAttrs.filter(t => t.is_parent);
  const tagAttrs   = availableAttrs.filter(t => !t.is_parent);
  const busy       = phase.phase === 'submitting';
  const photoUrl   = (phase as any).photoUrl as string | undefined;

  // ─────────────────────────────────────────────────────────────────────────
  // IDLE
  // ─────────────────────────────────────────────────────────────────────────
  if (phase.phase === 'idle') {
    return (
      <div className="h-[100dvh] bg-black flex flex-col items-center justify-center font-mono relative overflow-hidden select-none">
        {/* Dot grid background */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.035]"
          style={{
            backgroundImage: 'radial-gradient(circle, #94a3b8 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }}
        />
        <div className="relative z-10 flex flex-col items-center gap-10 px-8 w-full max-w-xs">
          <div className="text-center space-y-1.5">
            <p className="text-[7px] tracking-[0.4em] uppercase text-slate-700">FFE Inventory System</p>
            <p className="text-[11px] tracking-[0.22em] uppercase text-slate-300">Field Capture</p>
          </div>

          {/* Capture button with corner bracket decoration */}
          <div className="relative w-full">
            <Brackets color="border-slate-700" />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full border border-slate-800 bg-slate-950 active:bg-slate-900 transition-colors flex flex-col items-center gap-4 py-10"
            >
              <Camera size={30} strokeWidth={1} className="text-slate-500" />
              <span className="text-[10px] tracking-[0.3em] uppercase text-slate-400">Capture</span>
            </button>
          </div>

          <p className="text-[7px] tracking-[0.18em] uppercase text-slate-800 text-center">
            Synced to triage via Supabase Realtime
          </p>
        </div>
        <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={handleCapture} className="hidden" />
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // UPLOADING
  // ─────────────────────────────────────────────────────────────────────────
  if (phase.phase === 'uploading') {
    return (
      <div className="h-[100dvh] bg-black flex flex-col items-center justify-center font-mono gap-4">
        <Loader2 size={22} strokeWidth={1.5} className="text-blue-600 animate-spin" />
        <p className="text-[8px] tracking-[0.28em] uppercase text-slate-600">Uploading…</p>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SUCCESS
  // ─────────────────────────────────────────────────────────────────────────
  if (phase.phase === 'success') {
    return (
      <div className="h-[100dvh] bg-black flex flex-col items-center justify-center font-mono gap-8">
        <div className="relative">
          <Brackets color="border-emerald-800" />
          <div className="border border-emerald-900/60 bg-emerald-950/20 px-10 py-6 flex flex-col items-center gap-3">
            <CheckCircle2 size={26} strokeWidth={1.5} className="text-emerald-500" />
            <p className="text-[9px] tracking-[0.3em] uppercase text-emerald-400">Transmitted</p>
          </div>
        </div>
        <p className="text-[7px] tracking-[0.18em] uppercase text-slate-700 text-center">
          Photo queued for triage review
        </p>
        <button
          onClick={() => { reset(); setPhase({ phase: 'idle' }); }}
          className="border border-slate-800 px-8 py-3 text-[9px] tracking-[0.22em] uppercase text-slate-500 active:bg-slate-900 transition-colors"
        >
          Capture Another
        </button>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // FILLING / SUBMITTING  (2-step form, fixed viewport, no page scroll)
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="h-[100dvh] bg-black flex flex-col font-mono overflow-hidden">

      {/* ── Photo strip — taller on step 2 to absorb the extra space ─────── */}
      <div className={`shrink-0 relative border-b border-slate-900 h-[20dvh]`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photoUrl} alt="" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/80" />
        <p className="absolute bottom-1.5 left-3 text-[7px] tracking-[0.25em] uppercase text-slate-500">
          Field Photo
        </p>
      </div>

      {/* ── Optional hint ───────────────────────────────────────────────── */}
      <div className="shrink-0 px-4 py-1.5 border-b border-slate-900 bg-black">
        <p className="text-[7px] tracking-[0.25em] uppercase text-slate-700 text-center">
          Suggestions optional — tap Skip to submit photo only
        </p>
      </div>

      {/* ── Step indicator ──────────────────────────────────────────────── */}
      <div className="shrink-0 flex items-center gap-0 border-b border-slate-900">
        {([1, 2] as const).map((s, i) => {
          const active   = formStep === s;
          const complete = formStep > s;
          const label    = s === 1 ? 'Identify' : 'Quantify';
          return (
            <button
              key={s}
              type="button"
              onClick={() => setFormStep(s)}
              className={`flex-1 flex items-center gap-2 px-3 py-2.5 transition-colors ${
                i > 0 ? 'border-l border-slate-900' : ''
              } ${active ? 'bg-slate-950' : 'active:bg-slate-950'}`}
            >
              <div className={`w-[18px] h-[18px] shrink-0 border flex items-center justify-center text-[7px] transition-colors ${
                active   ? 'border-blue-700 bg-blue-950/60 text-blue-400' :
                complete ? 'border-slate-700 bg-slate-900 text-slate-500' :
                           'border-slate-800 text-slate-700'
              }`}>
                {complete ? <Check size={8} strokeWidth={2.5} /> : s}
              </div>
              <span className={`text-[8px] tracking-[0.2em] uppercase transition-colors ${
                active ? 'text-slate-300' : 'text-slate-700'
              }`}>
                {label}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Step content ────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-hidden">

        {/* STEP 1 — Type + Attributes */}
        {formStep === 1 && (
          <div className="h-full flex flex-col px-4 pt-4 overflow-hidden">

            {/* Type input row */}
            <div className="shrink-0 mb-4">
              <FieldLabel>Item Type</FieldLabel>
              <div className="flex gap-0 relative">
                <input
                  value={typeSearch}
                  onChange={e => {
                    setTypeSearch(e.target.value);
                    setTypeConfirmed(false);
                    setAvailableAttrs([]);
                    setSelectedTags([]);
                    setShowDrop(true);
                  }}
                  onFocus={() => { if (typeSearch) setShowDrop(true); }}
                  onBlur={() => setTimeout(() => setShowDrop(false), 200)}
                  placeholder="Chair, Desk, Monitor…"
                  className="flex-1 h-11 border border-slate-800 border-r-0 bg-slate-950 px-3 text-[11px] text-slate-200 placeholder:text-slate-700 outline-none focus:border-blue-800 transition-colors"
                />
                <button
                  type="button"
                  onMouseDown={() => { if (typeSearch.trim()) confirmType(typeSearch.trim()); }}
                  className="w-11 h-11 border border-slate-800 bg-slate-950 flex items-center justify-center text-slate-600 hover:border-blue-800 hover:text-blue-500 active:bg-slate-900 transition-colors shrink-0"
                >
                  <ChevronRight size={14} strokeWidth={1.5} />
                </button>

                {/* Autocomplete dropdown */}
                {showDrop && typeSearch && (
                  <div className="absolute z-30 top-full left-0 right-0 border border-slate-800 border-t-0 bg-black max-h-40 overflow-y-auto shadow-xl shadow-black/60">
                    {filtered.map(t => (
                      <button
                        key={t.id}
                        type="button"
                        onMouseDown={() => confirmType(t.name)}
                        className="w-full text-left px-3 py-2.5 text-[11px] text-slate-400 hover:bg-slate-950 border-b border-slate-900 last:border-0 transition-colors"
                      >
                        {t.name}
                      </button>
                    ))}
                    {!filtered.find(t => t.name.toLowerCase() === typeSearch.toLowerCase()) && (
                      <button
                        type="button"
                        onMouseDown={() => confirmType(typeSearch)}
                        className="w-full text-left px-3 py-2.5 text-[11px] text-blue-600/80 hover:bg-slate-950 transition-colors"
                      >
                        Use &ldquo;{typeSearch}&rdquo;
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Confirmed badge */}
              {typeConfirmed && (
                <p className="mt-1.5 text-[7px] tracking-[0.2em] uppercase text-slate-600 flex items-center gap-1">
                  <Check size={7} className="text-blue-700" /> Type confirmed
                </p>
              )}
            </div>

            {/* Attributes — fills remaining height, scrolls internally if needed */}
            <div className="flex-1 min-h-0 overflow-y-auto">
              {!typeConfirmed ? (
                <p className="text-[8px] tracking-[0.15em] uppercase text-slate-800 italic">
                  Confirm type to see attributes
                </p>
              ) : availableAttrs.length === 0 ? (
                <p className="text-[8px] tracking-[0.15em] uppercase text-slate-700 italic">
                  No attributes defined for this type
                </p>
              ) : (
                <div className="space-y-4 pb-2">
                  {/* Group (parent) — radio */}
                  {parents.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <FieldLabel>Group</FieldLabel>
                        <p className="font-mono text-[7px] tracking-wide text-slate-700 mb-2">— pick one</p>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {parents.map(tag => {
                          const sel = selectedTags.includes(tag.name);
                          return (
                            <button
                              key={tag.id ?? tag.name}
                              type="button"
                              onClick={() => toggleTag(tag.name)}
                              className={`min-h-[40px] px-3 border text-[10px] tracking-wide transition-colors ${
                                sel
                                  ? 'border-amber-700 bg-amber-950/50 text-amber-400'
                                  : 'border-slate-800 bg-slate-950 text-slate-500 active:bg-slate-900'
                              }`}
                            >
                              {sel && <Check size={8} strokeWidth={2.5} className="inline mr-1" />}
                              {tag.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Tags (child) — multi-select */}
                  {tagAttrs.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <FieldLabel>Tags</FieldLabel>
                        <p className="font-mono text-[7px] tracking-wide text-slate-700 mb-2">— pick any</p>
                      </div>
                      {tagAttrs.length > 5 && (
                        <input
                          value={tagFilter}
                          onChange={e => setTagFilter(e.target.value)}
                          placeholder="Filter tags…"
                          className="w-full h-8 mb-2 border border-slate-800 bg-slate-950 px-2 text-[10px] text-slate-300 placeholder:text-slate-700 outline-none focus:border-blue-800 transition-colors"
                        />
                      )}
                      <div className="flex flex-wrap gap-1.5">
                        {tagAttrs.filter(t => !tagFilter || t.name.toLowerCase().includes(tagFilter.toLowerCase())).map(tag => {
                          const sel = selectedTags.includes(tag.name);
                          return (
                            <button
                              key={tag.id ?? tag.name}
                              type="button"
                              onClick={() => toggleTag(tag.name)}
                              className={`min-h-[40px] px-3 border text-[10px] tracking-wide transition-colors ${
                                sel
                                  ? 'border-blue-700 bg-blue-950/50 text-blue-400'
                                  : 'border-slate-800 bg-slate-950 text-slate-500 active:bg-slate-900'
                              }`}
                            >
                              {sel && <Check size={8} strokeWidth={2.5} className="inline mr-1" />}
                              {tag.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* STEP 2 — Quantity + Condition + Notes */}
        {formStep === 2 && (
          <div className="h-full flex flex-col px-4 pt-4 gap-4 overflow-hidden">

            {/* Quantity stepper */}
            <div className="shrink-0">
              <FieldLabel>Quantity</FieldLabel>
              <div className="flex items-stretch gap-0 w-fit">
                <button
                  type="button"
                  onClick={() => setQty(q => Math.max(1, q - 1))}
                  className="w-10 h-10 border border-slate-800 border-r-0 bg-slate-950 flex items-center justify-center text-slate-600 active:bg-slate-900 transition-colors"
                >
                  <Minus size={11} strokeWidth={2} />
                </button>
                <input
                  type="number"
                  min="1"
                  value={qty || ''}
                  onChange={e => setQty(parseInt(e.target.value) || 1)}
                  className="w-14 h-10 border border-slate-800 bg-slate-950 text-center text-[14px] font-semibold text-slate-200 outline-none focus:border-blue-800 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setQty(q => q + 1)}
                  className="w-10 h-10 border border-slate-800 border-l-0 bg-slate-950 flex items-center justify-center text-slate-600 active:bg-slate-900 transition-colors"
                >
                  <Plus size={11} strokeWidth={2} />
                </button>
              </div>
            </div>

            {/* Condition */}
            <div className="shrink-0">
              <div className="flex items-center justify-between mb-2">
                <FieldLabel>Condition</FieldLabel>
                <button
                  type="button"
                  onClick={handleToggleSplit}
                  className={`flex items-center gap-1.5 h-6 px-2.5 border text-[7px] tracking-[0.18em] uppercase transition-colors ${
                    isSplit
                      ? 'border-blue-800 bg-blue-950/40 text-blue-500'
                      : 'border-slate-800 text-slate-600 active:bg-slate-900'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 border transition-colors ${isSplit ? 'bg-blue-500 border-blue-500' : 'border-slate-600'}`} />
                  Split
                </button>
              </div>

              {!isSplit ? (
                /* Single quality — 4 chips in a row */
                <div className="grid grid-cols-4 gap-1">
                  {(['Poor', 'Fair', 'Good', 'Excellent'] as QualityKey[]).map(q => {
                    const sel = quality === q;
                    return (
                      <button
                        key={q}
                        type="button"
                        onClick={() => setQuality(q)}
                        className={`h-10 border text-[8px] tracking-[0.08em] uppercase transition-colors ${
                          sel
                            ? `${Q[q].border} ${Q[q].activeBg} ${Q[q].text}`
                            : 'border-slate-800 bg-slate-950 text-slate-600 active:bg-slate-900'
                        }`}
                      >
                        {sel && '· '}{Q[q].short}
                      </button>
                    );
                  })}
                </div>
              ) : (
                /* Split mode — 4 number inputs */
                <div className="grid grid-cols-4 gap-1">
                  {(['Poor', 'Fair', 'Good', 'Excellent'] as QualityKey[]).map(q => (
                    <div key={q} className="border border-slate-800 bg-slate-950 p-1.5 flex flex-col items-center gap-1">
                      <span className={`text-[7px] tracking-[0.12em] uppercase ${Q[q].text}`}>{Q[q].short}</span>
                      <input
                        type="number"
                        min="0"
                        value={splitQty[q]}
                        onChange={e => setSplitQty(prev => ({ ...prev, [q]: parseInt(e.target.value) || 0 }))}
                        className="w-full h-8 text-center text-[13px] font-semibold border border-slate-800 bg-slate-900 text-slate-200 outline-none focus:border-blue-800 transition-colors"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Notes — fixed height, remaining space goes to photo strip */}
            <div className="shrink-0">
              <FieldLabel>Notes <span className="text-slate-800 normal-case tracking-normal font-sans">(optional)</span></FieldLabel>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Condition details, manufacturer, location notes…"
                rows={3}
                className="w-full h-[72px] border border-slate-800 bg-slate-950 px-3 py-2 text-[11px] text-slate-300 placeholder:text-slate-700 outline-none focus:border-blue-800 resize-none transition-colors"
              />
            </div>
          </div>
        )}
      </div>

      {/* ── Bottom nav ──────────────────────────────────────────────────── */}
      <div className="shrink-0 border-t border-slate-900 flex h-14">
        {formStep === 1 ? (
          <>
            {/* Skip — submits with zero suggestions */}
            <button
              type="button"
              onClick={() => submit(false)}
              disabled={busy}
              className="flex-[2] border-r border-slate-800 bg-slate-950 flex flex-col items-center justify-center gap-0.5 active:bg-slate-900 transition-colors disabled:opacity-40"
            >
              {busy ? (
                <Loader2 size={13} className="text-slate-400 animate-spin" />
              ) : (
                <>
                  <span className="text-[9px] tracking-[0.22em] uppercase text-slate-200">Skip</span>
                  <span className="text-[7px] tracking-[0.12em] uppercase text-slate-600">photo only</span>
                </>
              )}
            </button>
            {/* Next — add optional details */}
            <button
              type="button"
              onClick={() => setFormStep(2)}
              className="flex-1 text-[8px] tracking-[0.18em] uppercase text-slate-500 flex items-center justify-center gap-1.5 active:bg-slate-950 transition-colors"
            >
              Details <ChevronRight size={10} strokeWidth={2} />
            </button>
          </>
        ) : (
          <>
            {/* Back */}
            <button
              type="button"
              onClick={() => setFormStep(1)}
              className="flex-1 border-r border-slate-900 text-[8px] tracking-[0.22em] uppercase text-slate-600 flex items-center justify-center gap-1.5 active:bg-slate-950 transition-colors"
            >
              <ChevronLeft size={11} strokeWidth={2} /> Back
            </button>
            {/* Submit with details */}
            <button
              type="button"
              onClick={() => submit(true)}
              disabled={busy}
              className="flex-[2] bg-blue-950/50 border-l border-blue-900/40 text-[8px] tracking-[0.22em] uppercase text-blue-400 flex items-center justify-center gap-2 active:bg-blue-950/70 transition-colors disabled:opacity-40"
            >
              {busy
                ? <Loader2 size={13} className="animate-spin" />
                : <><Check size={11} strokeWidth={2.5} /> Submit</>
              }
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function CameraPage() {
  return (
    <Suspense>
      <CameraCapture />
    </Suspense>
  );
}

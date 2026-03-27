'use client';

import { useState } from 'react';
import { X, Link2, Copy, Check, Loader2, Clock, RefreshCw } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useProjectId } from '@/lib/ProjectContext';

export default function InviteModal({ onClose }: { onClose: () => void }) {
  const projectId = useProjectId();
  const [link, setLink] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    try {
      const { data: token, error: rpcError } = await supabase.rpc('create_invite', {
        p_project_id: projectId,
      });
      if (rpcError) throw rpcError;
      setLink(`${window.location.origin}/invite?token=${token}`);
    } catch (err: any) {
      setError(err.message || 'Failed to generate invite link.');
    } finally {
      setLoading(false);
    }
  };

  const copyLink = async () => {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div
        className="bg-gray-950 border border-gray-800 w-full max-w-md mx-4"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-800">
          <div className="flex items-center gap-2.5">
            <Link2 size={12} className="text-blue-500" />
            <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-gray-400">
              Invite Team Member
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-gray-600 hover:text-gray-300 transition-colors p-0.5"
          >
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-5">
          <p className="font-mono text-[11px] text-gray-500 leading-relaxed mb-5">
            Generate a single-use invite link. Anyone with the link can join this project using their Google account.
            Links expire after <span className="text-gray-400">7 days</span>.
          </p>

          {/* Error */}
          {error && (
            <div className="mb-4 px-3 py-2 border border-red-900/60 bg-red-900/10">
              <span className="font-mono text-[10px] text-red-400">{error}</span>
            </div>
          )}

          {/* Link display */}
          {link && (
            <div className="mb-4">
              <div className="font-mono text-[9px] tracking-[0.16em] uppercase text-gray-600 mb-1.5">
                Invite Link
              </div>
              <div className="flex items-stretch gap-0">
                <div className="flex-1 px-3 py-2.5 bg-gray-900 border border-gray-700 border-r-0 overflow-hidden">
                  <span className="font-mono text-[10px] text-gray-400 break-all leading-relaxed">
                    {link}
                  </span>
                </div>
                <button
                  onClick={copyLink}
                  className={`px-3 border transition-colors flex items-center gap-1.5 font-mono text-[10px] tracking-wide whitespace-nowrap ${
                    copied
                      ? 'border-green-700 bg-green-900/20 text-green-400'
                      : 'border-gray-700 bg-gray-900 text-gray-400 hover:border-blue-600 hover:text-blue-400'
                  }`}
                >
                  {copied ? <Check size={11} /> : <Copy size={11} />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>

              {/* Expiry notice */}
              <div className="flex items-center gap-1.5 mt-2">
                <Clock size={9} className="text-gray-700" />
                <span className="font-mono text-[9px] text-gray-500">
                  Expires in 7 days · single use
                </span>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            {link ? (
              <>
                <button
                  onClick={copyLink}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 font-mono text-[10px] tracking-[0.12em] uppercase border transition-colors ${
                    copied
                      ? 'border-green-700 bg-green-900/20 text-green-400'
                      : 'border-blue-700 bg-blue-600/10 text-blue-400 hover:bg-blue-600/20'
                  }`}
                >
                  {copied ? <Check size={11} /> : <Copy size={11} />}
                  {copied ? 'Copied!' : 'Copy Link'}
                </button>
                <button
                  onClick={generate}
                  disabled={loading}
                  className="px-3 py-2.5 border border-gray-700 text-gray-500 hover:text-gray-300 hover:border-gray-600 transition-colors"
                  title="Generate new link"
                >
                  <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
                </button>
              </>
            ) : (
              <button
                onClick={generate}
                disabled={loading || !projectId}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 font-mono text-[10px] tracking-[0.12em] uppercase border border-blue-700 bg-blue-600/10 text-blue-400 hover:bg-blue-600/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <Loader2 size={11} className="animate-spin" />
                ) : (
                  <Link2 size={11} />
                )}
                {loading ? 'Generating…' : 'Generate Invite Link'}
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-2.5 font-mono text-[10px] tracking-[0.12em] uppercase border border-gray-800 text-gray-500 hover:text-gray-300 hover:border-gray-700 transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

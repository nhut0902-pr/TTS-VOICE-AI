/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Trash2, Film, Play, Download, Clock, Sliders, Sparkles } from 'lucide-react';
import { SynthesisHistory } from '../types';

interface HistoryListProps {
  history: SynthesisHistory[];
  activeHistoryId?: string;
  onSelectTrack: (track: SynthesisHistory) => void;
  onDeleteTrack: (id: string) => void;
  onClearAll: () => void;
}

export default function HistoryList({
  history,
  activeHistoryId,
  onSelectTrack,
  onDeleteTrack,
  onClearAll
}: HistoryListProps) {
  // Simple human relative date formatter
  const formatTime = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    const secs = Math.floor(diff / 1000);
    const mins = Math.floor(secs / 60);
    const hours = Math.floor(mins / 60);

    if (secs < 60) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return new Date(timestamp).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div id="history-panel-container" className="bg-white border border-gray-100 rounded-2xl shadow-xs overflow-hidden flex flex-col h-full">
      {/* List Header */}
      <div id="history-box-header" className="p-5 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 tracking-tight">Audio History</h3>
          <p className="text-xs text-gray-500 mt-0.5">Stored locally in your current session browser cache</p>
        </div>
        {history.length > 0 && (
          <button
            onClick={onClearAll}
            className="text-xs font-semibold text-rose-600 hover:text-rose-800 transition-colors"
          >
            Clear All
          </button>
        )}
      </div>

      {/* Grid listing */}
      <div id="history-scroller" className="flex-1 overflow-y-auto max-h-[300px] md:max-h-[350px] p-4 space-y-3">
        {history.length === 0 ? (
          <div className="text-center py-12 px-4 border border-dashed border-gray-100 rounded-xl">
            <Film className="h-8 w-8 text-gray-300 mx-auto mb-2" />
            <p className="text-xs font-semibold text-gray-500">History file is empty</p>
            <p className="text-[11px] text-gray-400 mt-1 max-w-[200px] mx-auto leading-relaxed">
              Synthesize a sentence to create your first speech file preview.
            </p>
          </div>
        ) : (
          history.map((record) => {
            const isActive = record.id === activeHistoryId;
            return (
              <div
                key={record.id}
                id={`history-row-${record.id}`}
                className={`group border rounded-xl p-3.5 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  isActive 
                    ? 'border-gray-900 bg-gray-50/50 shadow-2xs' 
                    : 'border-gray-100 bg-white hover:border-gray-200 hover:bg-gray-50/30'
                }`}
              >
                {/* Meta details */}
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 text-[10px] text-gray-400 font-mono">
                      <Clock className="h-3 w-3" />
                      {formatTime(record.timestamp)}
                    </span>
                    <span className="text-[10px] font-semibold text-gray-700 bg-gray-100 px-1.5 py-0.5 rounded">
                      🗣️ {record.voiceName}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[10px] text-gray-500 bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100 font-mono">
                      <Sliders className="h-2.5 w-2.5 text-gray-400" />
                      R:{record.speed}x / P:{record.pitch}x
                    </span>
                  </div>

                  {/* Text preview */}
                  <p className="text-xs text-gray-700 font-sans font-medium line-clamp-2 md:line-clamp-1 leading-relaxed">
                    "{record.text}"
                  </p>
                </div>

                {/* Right controls */}
                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                  <button
                    onClick={() => onSelectTrack(record)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs font-semibold transition-all ${
                      isActive 
                        ? 'bg-gray-900 text-white border-gray-900 hover:bg-black' 
                        : 'bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-300'
                    }`}
                    title="Load voice sample"
                  >
                    <Play className="h-3 w-3 fill-current" />
                    <span>Play</span>
                  </button>

                  <a
                    href={record.audioUrl}
                    download={`tts-prompt-${record.voiceId}-${record.timestamp}.mp3`}
                    className="p-1.5 border border-gray-100 rounded-lg hover:border-gray-200 text-gray-500 hover:text-gray-900 bg-white shadow-2xs hover:shadow-xs transition-all"
                    title="Save MP3 File"
                  >
                    <Download className="h-3.5 w-3.5" />
                  </a>

                  <button
                    onClick={() => onDeleteTrack(record.id)}
                    className="p-1.5 border border-transparent rounded-lg hover:bg-rose-50 text-gray-400 hover:text-rose-600 transition-all"
                    title="Delete record"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* history summary stats */}
      {history.length > 0 && (
        <div className="p-3 bg-gray-50/50 border-t border-gray-100 flex justify-between items-center text-[10px] font-semibold text-gray-400 uppercase tracking-widest px-5">
          <span>Active tape list</span>
          <span className="flex items-center gap-1 text-gray-600 normal-case shrink-0">
            <Sparkles className="h-3 w-3 text-amber-500 animate-spin" />
            {history.length} {history.length === 1 ? 'conversion cached' : 'conversions cached'}
          </span>
        </div>
      )}
    </div>
  );
}

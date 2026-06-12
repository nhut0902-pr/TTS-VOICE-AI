/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useMemo } from 'react';
import { Search, SlidersHorizontal, Info, Check, Globe, RefreshCw } from 'lucide-react';
import { Voice, VoiceGender } from '../types';

interface VoiceSelectorProps {
  voices: Voice[];
  selectedVoiceId: string;
  onSelectVoice: (voice: Voice) => void;
  isLoading?: boolean;
}

export default function VoiceSelector({
  voices,
  selectedVoiceId,
  onSelectVoice,
  isLoading = false
}: VoiceSelectorProps) {
  const [search, setSearch] = useState('');
  const [selectedGender, setSelectedGender] = useState<'all' | VoiceGender>('all');
  const [selectedLang, setSelectedLang] = useState<string>('all');

  // Compute unique languages present in voices
  const languages = useMemo(() => {
    const list = voices.map(v => v.language);
    return ['all', ...Array.from(new Set(list))];
  }, [voices]);

  // Filter voices based on preferences
  const filteredVoices = useMemo(() => {
    return voices.filter(voice => {
      const matchesSearch = 
        voice.name.toLowerCase().includes(search.toLowerCase()) ||
        voice.description.toLowerCase().includes(search.toLowerCase()) ||
        voice.language.toLowerCase().includes(search.toLowerCase());

      const matchesGender = selectedGender === 'all' || voice.gender === selectedGender;
      const matchesLang = selectedLang === 'all' || voice.language === selectedLang;

      return matchesSearch && matchesGender && matchesLang;
    });
  }, [voices, search, selectedGender, selectedLang]);

  const selectedVoice = useMemo(() => {
    return voices.find(v => v.id === selectedVoiceId) || voices[0];
  }, [voices, selectedVoiceId]);

  return (
    <div id="voice-selector-container" className="flex flex-col h-full bg-white border border-gray-100 rounded-2xl shadow-xs overflow-hidden">
      {/* Title Header */}
      <div id="voice-selector-header" className="p-5 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 tracking-tight">Active Voice Model</h3>
          <p className="text-xs text-gray-500 mt-0.5">Select a voice accent and profile</p>
        </div>
        {selectedVoice && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100 animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            {selectedVoice.name}
          </span>
        )}
      </div>

      {/* Filters Area */}
      <div id="voice-filters-box" className="p-4 bg-white border-b border-gray-100 space-y-3.5">
        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <input
            id="voice-search-field"
            type="text"
            placeholder="Search voices by name or language..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs border border-gray-200 rounded-lg placeholder-gray-400 focus:outline-hidden focus:ring-1 focus:ring-gray-900 focus:border-gray-900 bg-gray-50/30 font-sans"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-2.5 text-xs text-gray-400 hover:text-gray-900"
            >
              Clear
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          {/* Language filter */}
          <div>
            <label className="block text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1">Language</label>
            <div className="relative">
              <select
                id="voice-lang-select"
                value={selectedLang}
                onChange={(e) => setSelectedLang(e.target.value)}
                className="w-full text-xs border border-gray-200 rounded-lg py-1.5 px-2 bg-white text-gray-700 focus:ring-1 focus:ring-gray-900 focus:outline-hidden appearance-none pr-6 cursor-pointer"
              >
                {languages.map((lang) => (
                  <option key={lang} value={lang}>
                    {lang === 'all' ? 'All Languages' : lang}
                  </option>
                ))}
              </select>
              <Globe className="absolute right-2 top-2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {/* Gender Selector */}
          <div>
            <label className="block text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1">Gender</label>
            <div className="flex border border-gray-200 rounded-lg overflow-hidden p-0.5 bg-gray-50">
              {(['all', 'female', 'male'] as const).map((genderChoice) => (
                <button
                  key={genderChoice}
                  onClick={() => setSelectedGender(genderChoice)}
                  className={`flex-1 text-[11px] font-semibold py-1 rounded-md capitalize transition-colors ${
                    selectedGender === genderChoice
                      ? 'bg-white text-gray-900 shadow-2xs'
                      : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  {genderChoice === 'all' ? 'All' : genderChoice.slice(0, 3)}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Voice Selection List */}
      <div id="voice-scroll-area" className="flex-1 overflow-y-auto max-h-[300px] md:max-h-[380px] p-3 space-y-2 bg-gray-50/30">
        {filteredVoices.length === 0 ? (
          <div className="text-center py-8 px-4">
            <SlidersHorizontal className="h-6 w-6 text-gray-300 mx-auto mb-2" />
            <p className="text-xs font-semibold text-gray-500">No matching voices found</p>
            <p className="text-[11px] text-gray-400 mt-0.5">Try widening your filters or search term</p>
          </div>
        ) : (
          filteredVoices.map((voice) => {
            const isSelected = voice.id === selectedVoiceId;
            return (
              <div
                key={voice.id}
                id={`voice-card-${voice.id}`}
                onClick={() => onSelectVoice(voice)}
                className={`group relative p-3 border rounded-xl cursor-pointer text-left transition-all ${
                  isSelected
                    ? 'bg-gray-900 border-gray-900 text-white shadow-sm'
                    : 'bg-white border-gray-100 text-gray-900 hover:border-gray-200 hover:bg-gray-50/50'
                }`}
              >
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-xs tracking-tight">{voice.name}</span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${
                        isSelected 
                          ? 'bg-gray-800 text-gray-300 border border-gray-700' 
                          : 'bg-gray-100 text-gray-600 border border-gray-200'
                      }`}>
                        {voice.languageCode.toUpperCase()}
                      </span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded capitalize font-medium ${
                        isSelected 
                          ? 'bg-gray-800 text-gray-300' 
                          : 'bg-gray-50 text-gray-500'
                      }`}>
                        {voice.gender}
                      </span>
                    </div>
                    <p className={`text-[11px] mt-1.5 line-clamp-2 leading-relaxed ${
                      isSelected ? 'text-gray-300' : 'text-gray-500 group-hover:text-gray-600'
                    }`}>
                      {voice.description}
                    </p>
                  </div>
                  {isSelected && (
                    <div className="bg-emerald-500 text-white p-1 rounded-full">
                      <Check className="h-3 w-3" />
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer Info context */}
      {selectedVoice && (
        <div id="voice-info-footer" className="p-3 bg-white border-t border-gray-100 flex items-start gap-2 text-gray-400">
          <Info className="h-4 w-4 mt-0.5 shrink-0 text-gray-400" />
          <p className="text-[10px] leading-relaxed text-gray-500">
            Selected voice <strong className="text-gray-700">{selectedVoice.name}</strong> will receive your speech input. Speed and pitch can be tweaked via the controls.
          </p>
        </div>
      )}
    </div>
  );
}

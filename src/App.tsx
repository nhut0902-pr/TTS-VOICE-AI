/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useTransition, useMemo } from 'react';
import { 
  AudioLines, Play, Sliders, FileText, Settings, Sparkles, 
  Trash2, RefreshCw, AlertTriangle, CheckCircle, Info, ExternalLink, HelpCircle
} from 'lucide-react';
import { Voice, SynthesisHistory, AdvancedConfig } from './types';
import { SUPPORTED_VOICES, generateSpeech, DEFAULT_CONFIG } from './services/ttsService';
import VoiceSelector from './components/VoiceSelector';
import AudioPlayer from './components/AudioPlayer';
import HistoryList from './components/HistoryList';

const PRESET_PROMPTS = [
  {
    id: 'intro_vi',
    label: '🇻🇳 Giới thiệu (Tiếng Việt)',
    text: 'Chào mừng bạn đến với Auden Voice Studio! Đây là ứng dụng chuyển đổi văn bản thành giọng nói tiếng Việt cao cấp, tự nhiên và vô cùng mượt mà. Hãy thử chọn một giọng đọc và nhấn nút Phát để trải nghiệm ngay nhé!'
  },
  {
    id: 'narrator_vi',
    label: '📖 Kể chuyện cổ tích',
    text: 'Ngày xửa ngày xưa, ở một thung lũng xa xôi được bao phủ bởi những làn sương mờ nhân ảnh, có một thư viện cổ kính đầy phép thuật. Nơi đây lưu giữ hàng vạn cuốn sách ghi lại lịch sử của vũ trụ, chờ đợi một người đủ duyên lành đến mở lối.'
  },
  {
    id: 'assistant_vi',
    label: '🔔 Thông báo Trợ lý',
    text: 'Xin lỗi vì đã ngắt lời bạn, nhưng bạn có một cuộc họp đánh giá dự án quan trọng bắt đầu sau mười lăm phút nữa. Tôi đã đồng bộ toàn bộ tài liệu báo cáo và tải lên bảng điều khiển của bạn rồi. Chúc bạn một ngày làm việc hiệu quả!'
  },
  {
    id: 'news_vi',
    label: '📰 Bản tin Công nghệ',
    text: 'Mới đây, trí tuệ nhân tạo thế hệ mới đã lập kỷ lục về tốc độ phản hồi và chuyển đổi ngôn ngữ tự nhiên. Công nghệ này giúp hàng triệu người dùng toàn cầu tương tác mượt mà bằng tiếng mẹ đẻ mà không gặp bất kỳ rào cản nào.'
  }
];

export default function App() {
  const [text, setText] = useState('Chào mừng bạn đến với Auden Voice Studio! Hãy nhập nội dung tiếng Việt của bạn vào đây, chọn một giọng đọc ấm áp ở bên dưới và nhấn nút Phát để bắt đầu nhé.');
  const [selectedVoice, setSelectedVoice] = useState<Voice>(SUPPORTED_VOICES[0]);
  const [speed, setSpeed] = useState(1.0);
  const [pitch, setPitch] = useState(1.0);

  // Local/Browser Speech Synthesis Integration
  const [engineMode, setEngineMode] = useState<'cloud' | 'local'>('cloud');
  const [deviceVoices, setDeviceVoices] = useState<SpeechSynthesisVoice[]>([]);

  // Load native device voices on startup
  useEffect(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      const loadVoices = () => {
        const allVoices = window.speechSynthesis.getVoices();
        setDeviceVoices(allVoices);
      };
      loadVoices();
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, []);

  // Format device voices into standard Voice object structure
  const systemVoices = useMemo(() => {
    return deviceVoices.map((v, idx) => {
      // Guess gender
      let gender: 'male' | 'female' | 'neutral' = 'neutral';
      const lowercaseName = v.name.toLowerCase();
      if (lowercaseName.includes('male') || lowercaseName.includes('david') || lowercaseName.includes('george') || lowercaseName.includes('mark') || lowercaseName.includes('nam') || lowercaseName.includes('an_') || lowercaseName.includes('cuong') || lowercaseName.includes('thanh')) {
        gender = 'male';
      } else if (lowercaseName.includes('female') || lowercaseName.includes('zira') || lowercaseName.includes('hazel') || lowercaseName.includes('susan') || lowercaseName.includes('linh') || lowercaseName.includes('hoai') || lowercaseName.includes('chi') || lowercaseName.includes('lan') || lowercaseName.includes('mai')) {
        gender = 'female';
      }

      // Format language name
      let language = v.lang;
      if (v.lang.startsWith('vi')) language = 'Vietnamese (Vietnam)';
      else if (v.lang.startsWith('en-US')) language = 'English (US)';
      else if (v.lang.startsWith('en-GB')) language = 'English (UK)';
      else if (v.lang.startsWith('fr')) language = 'French (France)';
      else if (v.lang.startsWith('de')) language = 'German (Germany)';
      else if (v.lang.startsWith('es')) language = 'Spanish (Spain)';
      else if (v.lang.startsWith('ja')) language = 'Japanese (Japan)';

      return {
        id: `system_${idx}_${v.name}`,
        name: v.name,
        gender,
        language,
        languageCode: v.lang,
        description: `Local device speech engine (${v.localService ? 'Offline' : 'Online'}). Highly responsive fallback.`
      };
    });
  }, [deviceVoices]);

  // Handle active selected system voice
  const activeDeviceVoice = useMemo(() => {
    if (engineMode !== 'local' || !selectedVoice.id.startsWith('system_')) return null;
    const parts = selectedVoice.id.split('_');
    const idx = parseInt(parts[1], 10);
    return !isNaN(idx) && deviceVoices[idx] ? deviceVoices[idx] : null;
  }, [engineMode, selectedVoice, deviceVoices]);

  // Auto select appropriate local voice upon changing engine
  useEffect(() => {
    if (engineMode === 'local') {
      const viVoice = systemVoices.find(v => v.languageCode.toLowerCase().startsWith('vi'));
      if (viVoice) {
        setSelectedVoice(viVoice);
      } else if (systemVoices.length > 0) {
        setSelectedVoice(systemVoices[0]);
      }
    } else {
      if (selectedVoice.id.startsWith('system_')) {
        setSelectedVoice(SUPPORTED_VOICES[0]);
      }
    }
  }, [engineMode, systemVoices]);
  
  // Synthesis States
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [attemptIndex, setAttemptIndex] = useState(1);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [successText, setSuccessText] = useState<string | null>(null);
  const [activeAudioUrl, setActiveAudioUrl] = useState<string>('');
  const [activeSessionId, setActiveSessionId] = useState<string>('');

  // Config States
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [advancedConfig, setAdvancedConfig] = useState<AdvancedConfig>(() => {
    const saved = localStorage.getItem('tts_advanced_config');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && (parsed.endpoint === 'https://tts-voice-ai.onrender.com' || !parsed.endpoint)) {
          parsed.endpoint = '/api/synthesize';
        }
        return parsed;
      } catch {
        return DEFAULT_CONFIG;
      }
    }
    return DEFAULT_CONFIG;
  });

  // History states
  const [history, setHistory] = useState<SynthesisHistory[]>(() => {
    const saved = localStorage.getItem('tts_synthesis_history_v1');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return [];
      }
    }
    return [];
  });

  // Drag-and-drop state helpers
  const [isDragging, setIsDragging] = useState(false);

  // References
  const elapsedTimerRef = useRef<number | null>(null);

  // Save history on changes
  useEffect(() => {
    localStorage.setItem('tts_synthesis_history_v1', JSON.stringify(history));
  }, [history]);

  // Save config on changes
  useEffect(() => {
    localStorage.setItem('tts_advanced_config', JSON.stringify(advancedConfig));
  }, [advancedConfig]);

  // Handle elapsed synthesis duration timers
  useEffect(() => {
    if (isSynthesizing) {
      setElapsedSeconds(0);
      elapsedTimerRef.current = window.setInterval(() => {
        setElapsedSeconds(prev => prev + 1);
      }, 1000);
    } else {
      if (elapsedTimerRef.current) {
        clearInterval(elapsedTimerRef.current);
        elapsedTimerRef.current = null;
      }
    }

    return () => {
      if (elapsedTimerRef.current) {
        clearInterval(elapsedTimerRef.current);
      }
    };
  }, [isSynthesizing]);

  // Handles drag and drop file operations
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      const isTxt = file.name.endsWith('.txt') || file.name.endsWith('.md');
      
      if (!isTxt) {
        setErrorText('Unsupported file format. Please drop a valid text (.txt) or markdown (.md) file.');
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target && typeof event.target.result === 'string') {
          setText(event.target.result);
          setSuccessText(`Successfully imported text from "${file.name}"!`);
          setErrorText(null);
        }
      };
      reader.onerror = () => {
        setErrorText('Failed to read the dropped file. Please try again.');
      };
      reader.readAsText(file);
    }
  };

  // Triggers TTS synthesis fetch process
  const triggerSpeak = async () => {
    if (!text.trim()) {
      setErrorText('Please specify some text content to synthesize.');
      return;
    }

    setIsSynthesizing(true);
    setAttemptIndex(1);
    setErrorText(null);
    setSuccessText(null);

    try {
      if (engineMode === 'local') {
        const localId = crypto.randomUUID();
        const historyItem: SynthesisHistory = {
          id: localId,
          text: text.slice(0, 180),
          voiceId: selectedVoice.id,
          voiceName: selectedVoice.name,
          speed,
          pitch,
          audioUrl: 'local_playback',
          timestamp: Date.now()
        };
        setHistory(prev => [historyItem, ...prev]);
        setActiveAudioUrl('local_playback');
        setActiveSessionId(localId);
        setSuccessText('Đang đọc ngoại tuyến (Local Client driver) bằng giọng nói hệ thống!');
        setIsSynthesizing(false);
        return;
      }

      const generatedUrl = await generateSpeech(text, selectedVoice.id);

      let playErrorOccurred = false;
      try {
        const audio = new Audio(generatedUrl);
        await audio.play();
      } catch (playErr) {
        playErrorOccurred = true;
      }

      // Create a valid history item
      const historyItem: SynthesisHistory = {
        id: crypto.randomUUID(),
        text: text.slice(0, 180),
        voiceId: selectedVoice.id,
        voiceName: selectedVoice.name,
        speed,
        pitch,
        audioUrl: generatedUrl,
        timestamp: Date.now()
      };

      setHistory(prev => [historyItem, ...prev]);
      setActiveAudioUrl(generatedUrl);
      setActiveSessionId(historyItem.id);

      if (playErrorOccurred) {
        setSuccessText('Nhấn nút phát để nghe âm thanh');
      } else {
        setSuccessText('Đã tạo thành công và đang phát âm thanh!');
      }
    } catch (err: any) {
      console.error(err);
      setErrorText(err.message || 'Speech synthesis failed. Verify server compatibility or check input parameters.');
    } finally {
      setIsSynthesizing(false);
    }
  };

  const handleSelectTrack = (track: SynthesisHistory) => {
    setActiveAudioUrl(track.audioUrl);
    setActiveSessionId(track.id);
    setSuccessText(`Loaded track synthesized with voice: ${track.voiceName}`);
    setErrorText(null);
  };

  const handleDeleteTrack = (id: string) => {
    setHistory(prev => prev.filter(t => t.id !== id));
    if (activeSessionId === id) {
      setActiveAudioUrl('');
      setActiveSessionId('');
    }
  };

  const handleClearHistory = () => {
    if (window.confirm('Are you sure you want to clear your local audio history?')) {
      // Release Blob URLs from storage to avoid memory leaks
      history.forEach(item => {
        if (item.audioUrl.startsWith('blob:')) {
          URL.revokeObjectURL(item.audioUrl);
        }
      });
      setHistory([]);
      setActiveAudioUrl('');
      setActiveSessionId('');
    }
  };

  // Helper values
  const textCharsCount = text.length;
  const textWordsCount = text.trim() === '' ? 0 : text.trim().split(/\s+/).length;

  return (
    <div id="application-container" className="min-h-screen bg-gray-50/70 font-sans text-gray-900 selection:bg-gray-900 selection:text-white flex flex-col antialiased">
      {/* Sleek top ambient status header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100 flex-none h-16 flex items-center px-6 justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-gray-900 text-white rounded-xl shadow-xs shrink-0">
            <AudioLines className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-sm font-semibold tracking-tight text-gray-950">Auden Voice Studio</h1>
            <p className="text-[10px] text-gray-400 font-mono">TEXT TO SPEECH WORKSPACE • PRODUCTION BUILD</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-xs font-semibold transition-all shadow-2xs ${
              showAdvanced 
                ? 'bg-gray-100 border-gray-300 text-gray-700' 
                : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Settings className="h-3.5 w-3.5" />
            <span>Advanced API Settings</span>
          </button>
        </div>
      </header>

      {/* Main workspace layout */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 md:px-6 py-6 flex flex-col md:grid md:grid-cols-12 gap-6 overflow-hidden">
        
        {/* LEFT COLUMN: Input form and parameters (8 cols) */}
        <section className="col-span-12 md:col-span-8 flex flex-col gap-6">

          {/* ADVANCED API CONFIG PANEL */}
          {showAdvanced && (
            <div id="advanced-settings-drawer" className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-4 animate-fadeIn">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <span className="text-xs font-semibold text-gray-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Sliders className="h-4 w-4 text-gray-600" />
                  API Endpoint Engine Customizer
                </span>
                <button 
                  onClick={() => setAdvancedConfig(DEFAULT_CONFIG)}
                  className="text-[10px] font-bold text-gray-400 hover:text-gray-900"
                >
                  Reset Defaults
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Custom target domain */}
                <div className="col-span-1 sm:col-span-2">
                  <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Speech API Server URL</label>
                  <input
                    id="endpoint-url-input"
                    type="url"
                    value={advancedConfig.endpoint}
                    onChange={(e) => setAdvancedConfig(prev => ({ ...prev, endpoint: e.target.value }))}
                    placeholder="https://tts-voice-ai.onrender.com"
                    className="w-full text-xs font-mono border border-gray-200 p-2.5 rounded-lg bg-gray-50 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-gray-900 focus:border-gray-900"
                  />
                </div>

                {/* HTTP Request Mode */}
                <div>
                  <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Request Structure</label>
                  <select
                    id="request-type-select"
                    value={advancedConfig.requestType}
                    onChange={(e) => setAdvancedConfig(prev => ({ 
                      ...prev, 
                      requestType: e.target.value as any 
                    }))}
                    className="w-full text-xs border border-gray-200 p-2 rounded-lg bg-white appearance-none cursor-pointer"
                  >
                    <option value="POST_JSON">POST with JSON content-type (Default)</option>
                    <option value="POST_FORM">POST with Form Data fields</option>
                    <option value="GET_QUERY">GET with URL Query Parameters</option>
                  </select>
                </div>

                {/* Intelligent Fallbacks Toggle */}
                <div className="flex items-center justify-between p-3 border border-gray-100 rounded-lg bg-gray-50/50">
                  <div className="space-y-0.5">
                    <span className="text-xs font-semibold text-gray-800 block">Path-Probing Cascade</span>
                    <span className="text-[10px] text-gray-400 block leading-relaxed">Auto-tries typical paths like /tts and /api/tts</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      id="fallbacks-toggle"
                      type="checkbox"
                      checked={advancedConfig.useFallbacks}
                      onChange={(e) => setAdvancedConfig(prev => ({ ...prev, useFallbacks: e.target.checked }))}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-gray-900" />
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* MAIN WRITING WORKSPACE */}
          <div 
            id="workspace-editor-box"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`bg-white border rounded-2xl p-5 shadow-xs transition-all relative ${
              isDragging ? 'border-gray-900 ring-2 ring-gray-900/5 bg-gray-50/50 scale-[0.99]' : 'border-gray-100'
            }`}
          >
            {/* SPEECH ENGINE SEGMENTED SELECTOR */}
            <div className="mb-5 bg-gray-100/80 p-1 rounded-xl border border-gray-100 flex gap-1">
              <button
                onClick={() => {
                  setEngineMode('cloud');
                  setSuccessText('Đã chuyển sang: Máy chủ giọng đọc AI Cloud.');
                  setErrorText(null);
                }}
                className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  engineMode === 'cloud'
                    ? 'bg-white text-gray-950 shadow-xs border border-gray-200/50'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                <Sparkles className={`h-3.5 w-3.5 transition-colors ${engineMode === 'cloud' ? 'text-indigo-600' : 'text-gray-400'}`} />
                <span className="font-semibold text-xs tracking-tight">AI Cloud Server</span>
              </button>
              <button
                onClick={() => {
                  setEngineMode('local');
                  setSuccessText('Đã chuyển sang: Giọng đọc Thiết bị (Offline / Không lỗi mạng).');
                  setErrorText(null);
                }}
                className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  engineMode === 'local'
                    ? 'bg-white text-gray-950 shadow-xs border border-gray-200/50'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                <AudioLines className={`h-3.5 w-3.5 transition-colors ${engineMode === 'local' ? 'text-emerald-500' : 'text-gray-400'}`} />
                <span className="font-semibold text-xs tracking-tight">Giọng đọc Thiết bị (Offline)</span>
              </button>
            </div>

            {/* Quick Presets header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-4 mb-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-900 tracking-tight flex items-center gap-1.5">
                  <FileText className="h-4 w-4 text-gray-400" />
                  Speech Script Editor
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">A clean, focused environment for translation</p>
              </div>

              {/* Presets Button Row */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] font-bold text-gray-400 mr-1 uppercase">Sample Presets:</span>
                {PRESET_PROMPTS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      setText(p.text);
                      setSuccessText('Preset loaded into editor!');
                      setErrorText(null);
                    }}
                    className="text-xs font-semibold px-2.5 py-1 bg-gray-50 hover:bg-gray-100 border border-gray-100 hover:border-gray-200 text-gray-700 rounded-lg transition-all"
                  >
                    {p.label.split(' ')[0]} {p.label.split(' ').slice(1).join(' ')}
                  </button>
                ))}
              </div>
            </div>

            {/* Drag & Drop File Mask */}
            {isDragging && (
              <div className="absolute inset-0 bg-white/95 z-40 rounded-2xl flex flex-col items-center justify-center border-2 border-dashed border-gray-900 p-6 pointer-events-none transition-all">
                <Sparkles className="h-10 w-10 text-gray-900 animate-bounce mb-3" />
                <p className="text-xs font-bold text-gray-900 uppercase tracking-widest">Drop Script File here</p>
                <p className="text-[11px] text-gray-500 mt-1">Accepts and loads standard .txt or .md files automatically</p>
              </div>
            )}

            {/* Inner textarea */}
            <div className="space-y-4">
              <textarea
                id="main-source-textarea"
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  setErrorText(null);
                }}
                maxLength={2000}
                placeholder="Compose script text to transform..."
                rows={7}
                className="w-full text-xs placeholder-gray-400 bg-transparent border-0 focus:ring-0 focus:outline-hidden leading-relaxed font-sans scrollbar-thin text-gray-800"
              />

              <div className="flex items-center justify-between border-t border-gray-100 pt-3 text-[10px] font-semibold text-gray-400 uppercase tracking-wider font-mono">
                <span className="flex items-center gap-1 text-gray-500 select-none normal-case">
                  💾 Drag & drop text/markdown file directly to load
                </span>
                <span>
                  {textWordsCount} Words &nbsp;•&nbsp; {textCharsCount} / 2000 Characters
                </span>
              </div>
            </div>
          </div>

          {/* SPEECH SYNTHESIS ENGINE CONTROLLER */}
          <div className="space-y-4">
            {/* Status notifications: Success & Error Feedback banner */}
            {errorText && (
              <div id="feedback-error-banner" className="p-4 border border-rose-100 rounded-xl bg-rose-50/50 flex gap-3 text-rose-800 animate-slideUp">
                <AlertTriangle className="h-5 w-5 shrink-0 text-rose-500 mt-0.5" />
                <div className="space-y-1">
                  <span className="text-xs font-semibold block">Speech Synthesis Blocked</span>
                  <p className="text-xs">{errorText}</p>
                </div>
              </div>
            )}

            {successText && (
              <div id="feedback-success-banner" className="p-4 border border-emerald-100 rounded-xl bg-emerald-50/55 flex gap-3 text-emerald-800 animate-slideUp">
                <CheckCircle className="h-5 w-5 shrink-0 text-emerald-500 mt-0.5" />
                <div className="space-y-1">
                  <span className="text-xs font-semibold block">Success</span>
                  <p className="text-xs">{successText}</p>
                </div>
              </div>
            )}

            {/* Primary Action Panel */}
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
              {/* Pitch and rate sliders */}
              <div className="w-full sm:w-auto flex-1 flex flex-col sm:flex-row gap-4">
                {/* Speed rate slider */}
                <div className="flex-1 min-w-[130px] space-y-1">
                  <div className="flex justify-between items-center text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                    <span className="flex items-center gap-1 text-gray-500 font-semibold">Speed Ratio</span>
                    <span className="font-mono text-gray-800">{speed.toFixed(1)}x</span>
                  </div>
                  <input
                    id="rate-range-slider"
                    type="range"
                    min={0.5}
                    max={2.0}
                    step={0.1}
                    value={speed}
                    onChange={(e) => setSpeed(parseFloat(e.target.value))}
                    className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-gray-900"
                  />
                </div>

                {/* Pitch slider */}
                <div className="flex-1 min-w-[130px] space-y-1">
                  <div className="flex justify-between items-center text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                    <span className="flex items-center gap-1 text-gray-500 font-semibold">Voice Pitch</span>
                    <span className="font-mono text-gray-800">{pitch.toFixed(1)}x</span>
                  </div>
                  <input
                    id="pitch-range-slider"
                    type="range"
                    min={0.5}
                    max={1.5}
                    step={0.1}
                    value={pitch}
                    onChange={(e) => setPitch(parseFloat(e.target.value))}
                    className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-gray-900"
                  />
                </div>
              </div>

              {/* ACTION SPEAK BUTTON */}
              <button
                id="generate-speech-button"
                onClick={triggerSpeak}
                disabled={isSynthesizing || !text.trim()}
                className={`w-full sm:w-auto px-6 py-3 rounded-xl font-semibold text-xs transition-all relative flex items-center justify-center gap-2 select-none shrink-0 ${
                  isSynthesizing 
                    ? 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed' 
                    : 'bg-gray-900 hover:bg-black text-white hover:scale-105 active:scale-95 disabled:opacity-50'
                }`}
              >
                {isSynthesizing ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin text-gray-500" />
                    <span>
                      Synthesizing (Attempt {attemptIndex}/3, {elapsedSeconds}s)
                    </span>
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 fill-current text-white" />
                    <span>Convert Speech Prompt</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* ACTIVE AUDIO CONTROLLER CARD */}
          {activeAudioUrl ? (
            <AudioPlayer
              audioUrl={activeAudioUrl}
              voiceName={
                history.find(t => t.id === activeSessionId)?.voiceName || selectedVoice.name
              }
              onTrackEnd={() => {
                setSuccessText('Finished streaming speech playback!');
              }}
              engineMode={engineMode}
              localText={text}
              localVoice={activeDeviceVoice}
              localSpeed={speed}
              localPitch={pitch}
            />
          ) : (
            <div className="p-6 border border-dashed border-gray-200 rounded-2xl flex flex-col items-center justify-center text-center bg-white">
              <AudioLines className="h-8 w-8 text-gray-300 mb-2 shrink-0" />
              <h4 className="text-xs font-semibold text-gray-600">Audio playback workspace idle</h4>
              <p className="text-[11px] text-gray-400 mt-1 max-w-[280px] leading-relaxed">
                Choose a voice, write your prompt, and trigger conversion to activate playback controls.
              </p>
            </div>
          )}

          {/* LOCAL CACHE HISTORY LIST */}
          <HistoryList
            history={history}
            activeHistoryId={activeSessionId}
            onSelectTrack={handleSelectTrack}
            onDeleteTrack={handleDeleteTrack}
            onClearAll={handleClearHistory}
          />
        </section>

        {/* RIGHT COLUMN: Voice Picker and configurations (4 cols) */}
        <section className="col-span-12 md:col-span-4 h-full flex flex-col gap-6">
          <VoiceSelector
            voices={engineMode === 'local' ? systemVoices : SUPPORTED_VOICES}
            selectedVoiceId={selectedVoice.id}
            onSelectVoice={(v) => {
              setSelectedVoice(v);
              setSuccessText(`Active voice profile changed to: ${v.name}`);
              setErrorText(null);
            }}
          />

          {/* API Guidelines context information card */}
          <div className="bg-white border border-gray-100 rounded-2xl p-4 space-y-3">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
              <Info className="h-4 w-4 text-gray-400 shrink-0" />
              Developer Compliance
            </span>
            <p className="text-[11px] leading-relaxed text-gray-500">
              This applet is fully prepared for <strong className="text-gray-700">Vercel static deployment</strong>. Environment dependencies have been streamlined for maximum speed and zero server-side cold boots.
            </p>
            <div className="text-[10px] text-gray-400 flex flex-col gap-1 font-mono">
              <span className="flex items-center gap-1 text-gray-500">
                ✔️ Compliant fetch with 15s timeout
              </span>
              <span className="flex items-center gap-1 text-gray-500">
                ✔️ Fail-fast 3x retry mechanism
              </span>
              <span className="flex items-center gap-1 text-gray-500">
                ✔️ Android Chrome touch pre-approved
              </span>
            </div>
          </div>
        </section>

      </main>

      {/* Decorative clean footer */}
      <footer className="mt-8 border-t border-gray-100 bg-white py-4 flex-none">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between text-[11px] text-gray-400">
          <span>© 100% Client-Side Pure Web Architecture ready for deployment</span>
          <span className="flex items-center gap-1 mt-1 sm:mt-0 font-mono text-[10px] text-gray-500">
            ENV: production • STAGE: vercel-static-spa
          </span>
        </div>
      </footer>
    </div>
  );
}

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, Pause, RotateCcw, Volume2, VolumeX, Download, 
  ChevronRight, ChevronLeft, Sparkles 
} from 'lucide-react';

interface AudioPlayerProps {
  audioUrl: string;
  voiceName?: string;
  onTrackEnd?: () => void;
  engineMode?: 'cloud' | 'local';
  localText?: string;
  localVoice?: SpeechSynthesisVoice | null;
  localSpeed?: number;
  localPitch?: number;
}

export default function AudioPlayer({
  audioUrl,
  voiceName = 'Synthesis Feed',
  onTrackEnd,
  engineMode = 'cloud',
  localText = '',
  localVoice = null,
  localSpeed = 1.0,
  localPitch = 1.0
}: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.85);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);

  // Stop local speech if any
  const stopLocalSpeech = () => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  };

  // Synchronize playback rate adjustments
  useEffect(() => {
    if (audioRef.current && engineMode === 'cloud') {
      audioRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate, engineMode]);

  // Re-load source whenever the audioUrl changes
  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    stopLocalSpeech();

    if (engineMode === 'local') {
      // Auto-play local device speech synthesis
      const words = localText ? localText.trim().split(/\s+/).length : 0;
      // Estimate 130 words per minute, modified by rate
      const estDuration = Math.max(2, (words / 130) * 60 / localSpeed);
      setDuration(estDuration);
      
      const timer = setTimeout(() => {
        setIsPlaying(true);
        triggerLocalSpeak();
      }, 300);
      
      return () => {
        clearTimeout(timer);
        stopLocalSpeech();
      };
    } else {
      const audio = audioRef.current;
      if (audio && audioUrl && audioUrl !== 'local_playback') {
        audio.src = audioUrl;
        audio.load();
        audio.playbackRate = playbackRate;
        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              setIsPlaying(true);
            })
            .catch(() => {
              setIsPlaying(false);
            });
        }
      }
    }

    return () => {
      stopLocalSpeech();
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [audioUrl, engineMode, localText, localVoice, localSpeed, localPitch]);

  // Handle ticking progress for local engine
  useEffect(() => {
    let intervalId: number | null = null;
    if (isPlaying && engineMode === 'local') {
      intervalId = window.setInterval(() => {
        setCurrentTime(prev => {
          if (prev >= duration) {
            setIsPlaying(false);
            stopLocalSpeech();
            if (intervalId) clearInterval(intervalId);
            if (onTrackEnd) onTrackEnd();
            return duration;
          }
          return prev + 0.2;
        });
      }, 200);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isPlaying, engineMode, duration, onTrackEnd]);

  // Trigger browser SpeechSynthesis
  const triggerLocalSpeak = () => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(localText);
    utterance.rate = localSpeed;
    utterance.pitch = localPitch;
    if (localVoice) {
      utterance.voice = localVoice;
      utterance.lang = localVoice.lang;
    } else {
      utterance.lang = 'vi-VN';
    }

    utterance.onend = () => {
      setIsPlaying(false);
      setCurrentTime(0);
      if (onTrackEnd) onTrackEnd();
    };

    utterance.onerror = () => {
      setIsPlaying(false);
    };

    window.speechSynthesis.speak(utterance);
    setIsPlaying(true);
  };

  // Waveform visualization loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set high-DPI scaling
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvas.clientWidth * dpr;
    canvas.height = canvas.clientHeight * dpr;
    ctx.scale(dpr, dpr);

    const width = canvas.width / dpr;
    const height = canvas.height / dpr;

    let phase = 0;

    const drawWave = () => {
      ctx.clearRect(0, 0, width, height);

      const numBars = 50;
      const barPadding = 3;
      const barWidth = (width - numBars * barPadding) / numBars;

      for (let i = 0; i < numBars; i++) {
        // Calculate center proximity
        const centerOffset = Math.abs(i - numBars / 2) / (numBars / 2);
        const wavePower = 1 - centerOffset; // high in middle

        let barHeight = 6; // minimum height
        if (isPlaying) {
          // Dynamic pulsing height based on sine wave and random chatter
          const waveVal = Math.sin(phase + i * 0.15) * 0.5 + 0.5;
          barHeight += waveVal * wavePower * (height - 12);
          barHeight += Math.random() * 3 * wavePower; // noise
        } else {
          // Flat representation with beautiful idle curve
          barHeight += Math.sin(i * 0.1) * 3 + wavePower * 8;
        }

        const x = i * (barWidth + barPadding);
        const y = (height - barHeight) / 2;

        // Custom linear gradient color
        const gradient = ctx.createLinearGradient(0, y, 0, y + barHeight);
        if (isSelectedBar(i, numBars)) {
          gradient.addColorStop(0, '#111827'); // dark gray
          gradient.addColorStop(1, '#374151');
        } else {
          gradient.addColorStop(0, '#e5e7eb'); // light off-gray
          gradient.addColorStop(1, '#e5e7eb');
        }

        ctx.fillStyle = gradient;
        
        // Draw round-capped bars
        const radius = barWidth / 2;
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(x, y, barWidth, barHeight, radius);
        } else {
          // Fallback if roundRect not supported
          ctx.rect(x, y, barWidth, barHeight);
        }
        ctx.fill();
      }

      phase += isPlaying ? 0.08 : 0.002;
      animationRef.current = requestAnimationFrame(drawWave);
    };

    /** Calculate standard percentage progress highlights */
    const isSelectedBar = (index: number, total: number) => {
      if (duration === 0) return false;
      const progress = currentTime / duration;
      return index / total <= progress;
    };

    drawWave();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying, currentTime, duration]);

  const togglePlay = () => {
    if (engineMode === 'local') {
      if (typeof window === 'undefined' || !window.speechSynthesis) return;
      if (isPlaying) {
        window.speechSynthesis.pause();
        setIsPlaying(false);
      } else {
        if (window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
          setIsPlaying(true);
        } else {
          triggerLocalSpeak();
        }
      }
      return;
    }

    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play()
        .then(() => setIsPlaying(true))
        .catch(err => {
          console.error("Audio playback blocked:", err);
          setIsPlaying(false);
        });
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (engineMode === 'local') return;
    const time = parseFloat(e.target.value);
    setCurrentTime(time);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
  };

  const skipRelative = (seconds: number) => {
    if (engineMode === 'local') return;
    const audio = audioRef.current;
    if (!audio) return;
    const newTime = Math.min(Math.max(0, audio.currentTime + seconds), duration);
    audio.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextVolume = parseFloat(e.target.value);
    setVolume(nextVolume);
    setIsMuted(nextVolume === 0);
    if (audioRef.current) {
      audioRef.current.volume = nextVolume;
      audioRef.current.muted = nextVolume === 0;
    }
  };

  const toggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    if (audioRef.current) {
      audioRef.current.muted = nextMuted;
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    if (onTrackEnd) onTrackEnd();
  };

  // Convert seconds to clean display MM:SS
  const formatTime = (timeInSec: number) => {
    if (isNaN(timeInSec)) return '0:00';
    const mins = Math.floor(timeInSec / 60);
    const secs = Math.floor(timeInSec % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div id="audio-player-card" className="bg-white border border-gray-100 rounded-2xl shadow-xs overflow-hidden transition-all duration-300">
      {/* Hidden native audio tag */}
      <audio
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        preload="metadata"
        referrerPolicy="no-referrer"
      />

      {/* Top track details */}
      <div className="px-5 py-4 bg-gray-50/50 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-gray-900 shrink-0" />
          <div>
            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest block">Active Synthesis Playback</span>
            <span className="text-xs font-semibold text-gray-800">{voiceName} Voice Engine</span>
          </div>
        </div>

        {/* Playback speed presets multiplier */}
        <div className="flex items-center gap-1.5 bg-white border border-gray-100 rounded-md p-0.5 shadow-2xs">
          {([0.75, 1.0, 1.25, 1.5, 2.0] as const).map((rate) => (
            <button
              key={rate}
              onClick={() => setPlaybackRate(rate)}
              className={`text-[10px] font-bold py-1 px-2 rounded-sm transition-colors ${
                playbackRate === rate
                  ? 'bg-gray-900 text-white shadow-2xs'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              {rate === 1.0 ? '1x' : `${rate}x`}
            </button>
          ))}
        </div>
      </div>

      <div className="p-5 space-y-4">
        {/* WAVEFORM CONTAINER */}
        <div className="relative bg-gray-50 border border-gray-100 rounded-xl px-5 py-3 h-24 flex items-center justify-center overflow-hidden">
          <canvas
            ref={canvasRef}
            className="w-full h-full max-h-[70px] pointer-events-none"
          />

          {/* Time floating display */}
          <div className="absolute right-3.5 bottom-2 text-[10px] font-semibold text-gray-400 font-mono">
            {formatTime(currentTime)} / {formatTime(duration)}
          </div>
        </div>

        {/* PROGRESS SLIDER */}
        <div className="space-y-1">
          <input
            id="audio-progress-bar"
            type="range"
            min={0}
            max={duration || 100}
            step={0.05}
            value={currentTime}
            onChange={handleSeek}
            disabled={duration === 0}
            className="w-full h-1 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-gray-900 focus:outline-hidden disabled:opacity-50"
          />
        </div>

        {/* MAIN CONTROLS ROW */}
        <div className="flex items-center justify-between gap-4 pt-1">
          {/* Mute & Sound slider */}
          <div className="flex items-center gap-2 w-28 md:w-32">
            <button
              onClick={toggleMute}
              className="text-gray-500 hover:text-gray-900 shrink-0 p-1 hover:bg-gray-50 rounded"
              title="Mute/Unmute"
            >
              {isMuted ? (
                <VolumeX className="h-4 w-4 text-rose-500" />
              ) : (
                <Volume2 className="h-4 w-4" />
              )}
            </button>
            <input
              id="audio-volume-bar"
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={isMuted ? 0 : volume}
              onChange={handleVolumeChange}
              className="w-full h-1 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-gray-600 focus:outline-hidden"
              title="Volume Slider"
            />
          </div>

          {/* Player controls */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => skipRelative(-10)}
              disabled={duration === 0}
              className="p-1.5 border border-gray-100 rounded-lg hover:border-gray-200 text-gray-500 hover:text-gray-900 bg-white shadow-2xs hover:shadow-xs transition-all disabled:opacity-50"
              title="Skip backward 10s"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <button
              onClick={togglePlay}
              disabled={duration === 0}
              className={`p-3 bg-gray-900 hover:bg-black text-white rounded-full transition-all shadow-sm hover:scale-105 active:scale-95 disabled:opacity-50`}
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? (
                <Pause className="h-5 w-5 fill-white" />
              ) : (
                <Play className="h-5 w-5 fill-white ml-0.5" />
              )}
            </button>

            <button
              onClick={() => skipRelative(10)}
              disabled={duration === 0}
              className="p-1.5 border border-gray-100 rounded-lg hover:border-gray-200 text-gray-500 hover:text-gray-900 bg-white shadow-2xs hover:shadow-xs transition-all disabled:opacity-50"
              title="Skip forward 10s"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Right side helper metrics (Export audio download) */}
          <div className="w-28 md:w-32 flex justify-end">
            {engineMode === 'local' ? (
              <span className="text-[10px] text-gray-400 font-mono italic text-right leading-tight select-none">
                Local Driver (Live Play)
              </span>
            ) : (
              <a
                href={audioUrl}
                download={`tts-speak-${voiceName.toLowerCase()}-${Date.now()}.mp3`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 bg-white hover:bg-gray-50/50 hover:border-gray-300 transition-all shadow-2xs"
                title="Export Audio File"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Download</span>
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

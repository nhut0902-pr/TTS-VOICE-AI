/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type VoiceGender = 'male' | 'female' | 'neutral';

export interface Voice {
  id: string;
  name: string;
  gender: VoiceGender;
  language: string;
  languageCode: string;
  description: string;
}

export interface SynthesisHistory {
  id: string;
  text: string;
  voiceId: string;
  voiceName: string;
  speed: number;
  pitch: number;
  audioUrl: string;
  timestamp: number;
  duration?: number; // duration in seconds
}

export interface AdvancedConfig {
  endpoint: string;
  requestType: 'POST_JSON' | 'POST_FORM' | 'GET_QUERY';
  useFallbacks: boolean;
}

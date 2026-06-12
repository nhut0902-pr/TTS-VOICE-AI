/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Voice, AdvancedConfig } from '../types';

export const DEFAULT_CONFIG: AdvancedConfig = {
  endpoint: 'https://tts-voice-ai.onrender.com/tts',
  requestType: 'GET_QUERY',
  useFallbacks: false
};

export const SUPPORTED_VOICES: Voice[] = [
  {
    id: 'vi-female',
    name: 'Hoài An (Nữ Việt)',
    gender: 'female',
    language: 'Vietnamese (Vietnam)',
    languageCode: 'vi-VN',
    description: 'Giọng nữ tiếng Việt tự nhiên, truyền cảm, mượt mà. Hoàn hảo cho bài viết, tin tức.'
  },
  {
    id: 'vi-male',
    name: 'Minh Quang (Nam Việt)',
    gender: 'male',
    language: 'Vietnamese (Vietnam)',
    languageCode: 'vi-VN',
    description: 'Giọng nam tiếng Việt trầm ấm, dõng dạc, rất rõ ràng. Thích hợp cho thuyết trình.'
  },
  {
    id: 'en-female',
    name: 'Sarah (English Female)',
    gender: 'female',
    language: 'English (US)',
    languageCode: 'en-US',
    description: 'Balanced, versatile, and highly conversational female voice in US English.'
  },
  {
    id: 'en-male',
    name: 'John (English Male)',
    gender: 'male',
    language: 'English (US)',
    languageCode: 'en-US',
    description: 'Warm, deep, and authoritative male voice in US English.'
  },
  {
    id: 'ja-female',
    name: 'Sakura (Japanese Female)',
    gender: 'female',
    language: 'Japanese (Japan)',
    languageCode: 'ja-JP',
    description: 'Polite, clear, and natural Tokyo accent female voice.'
  },
  {
    id: 'ja-male',
    name: 'Kaito (Japanese Male)',
    gender: 'male',
    language: 'Japanese (Japan)',
    languageCode: 'ja-JP',
    description: 'Warm, articulated, and deep male voice in Japanese.'
  },
  {
    id: 'ko-female',
    name: 'Ji-won (Korean Female)',
    gender: 'female',
    language: 'Korean (South Korea)',
    languageCode: 'ko-KR',
    description: 'Polite, melodic, and natural female voice in Korean.'
  },
  {
    id: 'ko-male',
    name: 'Min-jun (Korean Male)',
    gender: 'male',
    language: 'Korean (South Korea)',
    languageCode: 'ko-KR',
    description: 'Clear, modern, and confident male voice in Korean.'
  }
];

export async function generateSpeech(text: string, voice: string): Promise<string> {
  const encodedText = encodeURIComponent(text);
  const directTtsUrl = `https://tts-voice-ai.onrender.com/tts?text=${encodedText}&voice=${voice}`;
  const proxyTtsUrl = `/api/synthesize`;

  console.log(`[TTS Service] Starting speech generation for voice "${voice}"`);

  // We will try running a direct browser GET fetch with retry up to 3 times.
  // If direct browser fetch fails (mostly due to CORS or Iframe sandboxing issues),
  // we instantly fallback to our local companion Express proxy which bypasses CORS constraints.
  let attempts = 3;
  let lastError: any = null;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 seconds timeout

    try {
      console.log(`[TTS Service Attempt ${attempt}] Request Method: GET`);
      console.log(`[TTS Service Attempt ${attempt}] Request URL: ${directTtsUrl}`);

      const response = await fetch(directTtsUrl, {
        method: 'GET',
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      // Extract details for logging
      const statusCode = response.status;
      const contentType = response.headers.get('content-type') || '';
      
      console.log(`[TTS Service Response Attempt ${attempt}] Status Code: ${statusCode}`);
      console.log(`[TTS Service Response Attempt ${attempt}] Content-Type: ${contentType}`);
      
      // Log headers
      const headersObj: Record<string, string> = {};
      response.headers.forEach((val, key) => {
        headersObj[key] = val;
      });
      console.log(`[TTS Service Response Attempt ${attempt}] Headers:`, JSON.stringify(headersObj, null, 2));

      // 8. Chấp nhận thành công 200
      if (statusCode === 200) {
        if (!contentType.includes('audio')) {
          if (contentType.includes('application/json')) {
            const jsonText = await response.text();
            console.log(`[TTS Service Error response body]:`, jsonText);
            try {
              const json = JSON.parse(jsonText);
              throw new Error(json.error || json.message || 'Máy chủ phản hồi bằng dữ liệu JSON không chứa audio.');
            } catch {
              throw new Error(`Dữ liệu JSON thô: ${jsonText.slice(0, 150)}`);
            }
          }
          const textSample = await response.text().catch(() => '');
          throw new Error(`Định dạng phản hồi không hợp lệ (${contentType}). Chi tiết: ${textSample.slice(0, 100)}`);
        }

        const blob = await response.blob();
        if (blob.size === 0) {
          throw new Error('Độ dài file âm thanh bị rỗng (0 bytes).');
        }

        console.log(`[TTS Service Attempt ${attempt}] Success! Generated Blob size: ${blob.size} bytes`);
        return URL.createObjectURL(blob);
      } else {
        // If status is not 200
        const bodyText = await response.text().catch(() => '');
        console.error(`[TTS Service Attempt ${attempt} HTTP Error Body]:`, bodyText);
        throw new Error(`Máy chủ báo lỗi HTTP ${statusCode}: ${bodyText.slice(0, 150)}`);
      }
    } catch (err: any) {
      clearTimeout(timeoutId);
      lastError = err;
      console.warn(`[TTS Service Direct Attempt ${attempt} failed]:`, err.message || err);

      // Detect "Failed to fetch" (usually CORS or network offline) or abort
      const isFailedToFetch = err instanceof TypeError && err.message.toLowerCase().includes('failed to fetch');
      const isCORSOrSandbox = isFailedToFetch || (err.message && err.message.includes('CORS'));

      if (isCORSOrSandbox) {
        console.log(`[TTS Service Fallback] Local server bypass triggers because of connection/CORS issue.`);
        // Immediately try fallbacking to Express proxy server side
        try {
          console.log(`[TTS Service Proxy Call] Request Method: POST to ${proxyTtsUrl}`);
          console.log(`[TTS Service Proxy Payload]:`, JSON.stringify({ text, voice }));

          const proxyResponse = await fetch(proxyTtsUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ text, voice }),
            signal: controller.signal
          });

          const pStatus = proxyResponse.status;
          const pContentType = proxyResponse.headers.get('content-type') || '';

          console.log(`[TTS Service Proxy Response] Status Code: ${pStatus}`);
          console.log(`[TTS Service Proxy Response] Content-Type: ${pContentType}`);

          if (pStatus === 200) {
            const blob = await proxyResponse.blob();
            console.log(`[TTS Service Proxy Success] Generated audio blob size: ${blob.size} bytes`);
            return URL.createObjectURL(blob);
          } else {
            const pErrorText = await proxyResponse.text().catch(() => '');
            console.error(`[TTS Service Proxy Error Body]:`, pErrorText);
            try {
              const pErrorJson = JSON.parse(pErrorText);
              throw new Error(pErrorJson.error || pErrorJson.message || `Proxy báo lỗi mã ${pStatus}`);
            } catch {
              throw new Error(`Lỗi máy chủ proxy (${pStatus}): ${pErrorText.slice(0, 150)}`);
            }
          }
        } catch (proxyErr: any) {
          console.error(`[TTS Service Proxy Fallback also failed]:`, proxyErr.message || proxyErr);
          lastError = proxyErr;
        }
      }

      // If we are about to retry, add a small backoff delay to let Render wake up (free tier spinup time can be up to 30~50 seconds)
      if (attempt < attempts) {
        console.log(`[TTS Service] Waiting 2 seconds before retry attempt #${attempt + 1}...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }

  // Handle errors elegantly
  throw new Error(lastError?.message || 'Có lỗi xảy ra trong quá trình kết nối với hệ thống giọng đọc AI.');
}

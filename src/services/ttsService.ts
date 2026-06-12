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
  const url = '/api/synthesize';

  console.log("TTS REQUEST URL:", url);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 seconds timeout

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ text, voice }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    console.log("TTS RESPONSE STATUS:", response.status);

    const contentType = response.headers.get('content-type') || '';

    if (response.status === 200) {
      if (!contentType.includes('audio')) {
        if (contentType.includes('application/json')) {
          const bodyText = await response.text();
          let parsedError = 'Nội dung phản hồi JSON không hợp lệ.';
          try {
            const bodyJson = JSON.parse(bodyText);
            parsedError = bodyJson.error || bodyJson.message || bodyText;
          } catch {
            parsedError = bodyText;
          }
          throw new Error(`[Lỗi máy chủ]: Phản hồi từ máy chủ chứa thông tin lỗi:\n- Kết quả: ${parsedError}`);
        }
        const bodyText = await response.text().catch(() => '');
        throw new Error(`[Lỗi định dạng]: Máy chủ không trả về âm thanh (Content-Type: ${contentType}).\nPhản hồi nhận được:\n${bodyText.slice(0, 200)}`);
      }

      const blob = await response.blob();
      if (blob.size === 0) {
        throw new Error('Lỗi: Dữ liệu âm thanh nhận được bị rỗng (0 bytes). Trình duyệt không thể phát.');
      }

      console.log(`[TTS Service] Tạo thành công! Kích thước: ${blob.size} bytes`);
      return URL.createObjectURL(blob);
    } else {
      const bodyText = await response.text().catch(() => '');
      throw new Error(
        `Yêu cầu thiết lập âm thanh thất bại.\n` +
        `- URL đã gọi: ${url}\n` +
        `- Mã trạng thái (Status Code): ${response.status}\n` +
        `- Chi tiết phản hồi (Response Body): ${bodyText || '(Rỗng)'}`
      );
    }
  } catch (err: any) {
    clearTimeout(timeoutId);

    if (err.name === 'AbortError') {
      throw new Error(
        `Không nhận được phản hồi (Quá hạn 60 giây).\n` +
        `- URL đã gọi: ${url}\n` +
        `- Chi tiết: Tiến trình bị hủy do vượt quá thời gian phản hồi quy định.`
      );
    }

    // Pass through custom detailed errors
    if (err.message && err.message.includes('URL đã gọi')) {
      throw err;
    }

    throw new Error(
      `Không thể hoàn thành yêu cầu (Lỗi kết nối hoặc chặn ứng dụng).\n` +
      `- URL đã gọi: ${url}\n` +
      `- Chi tiết lỗi: ${err.message || err}`
    );
  }
}

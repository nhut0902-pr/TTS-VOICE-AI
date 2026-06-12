/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';

const PORT = 3000;
const HOST = '0.0.0.0';

const app = express();
app.use(express.json());

// Enable CORS for frontend compatibility (crucial for local / Vercel sandboxes)
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// 1. API PROXY ENDPOINT
// Helper to split long text into safe-sized chunks of characters
function splitTextIntoChunks(text: string, maxLen = 250): string[] {
  const paragraphs = text.split(/\n+/);
  const chunks: string[] = [];

  for (const paragraph of paragraphs) {
    if (!paragraph.trim()) continue;

    // Split by sentence-closing punctuation while keeping punctuation, matching Unicode-friendly chars
    const sentenceRegex = /([^.!?\n\u3002\uff01\uff1f]+[.!?\n\u3002\uff01\uff1f]*)/g;
    const matches = paragraph.match(sentenceRegex) || [paragraph];
    
    let currentChunk = '';

    for (let sentence of matches) {
      sentence = sentence.trim();
      if (!sentence) continue;

      if (currentChunk.length + sentence.length + 1 <= maxLen) {
        currentChunk = currentChunk ? currentChunk + ' ' + sentence : sentence;
      } else {
        if (currentChunk) {
          chunks.push(currentChunk);
        }
        
        // Split extra-long sentences by words or spaces Safely
        if (sentence.length > maxLen) {
          const words = sentence.split(/\s+/);
          let wordChunk = '';
          for (const word of words) {
            if (wordChunk.length + word.length + 1 <= maxLen) {
              wordChunk = wordChunk ? wordChunk + ' ' + word : word;
            } else {
              if (wordChunk) chunks.push(wordChunk);
              wordChunk = word;
            }
          }
          currentChunk = wordChunk;
        } else {
          currentChunk = sentence;
        }
      }
    }
    if (currentChunk) {
      chunks.push(currentChunk);
    }
  }

  return chunks;
}

// Proxies requests to tts-voice-ai.onrender.com with GET method, chunking long text to bypass length limits & truncation
app.post('/api/synthesize', async (req, res) => {
  const { text, voice } = req.body;

  if (!text || !voice) {
    res.status(400).json({ error: 'Parameters "text" and "voice" are required' });
    return;
  }

  // 1. Split text into safe, optimal chunks to avoid silent upstream truncation / URI limits
  const chunks = splitTextIntoChunks(text, 250);
  console.log(`[TTS Chunking] Input text split into ${chunks.length} chunks. Voice: ${voice}`);

  const buffers: Buffer[] = new Array(chunks.length);
  let globalError: any = null;

  // 2. Fetch a single chunk with retry mechanism
  const fetchChunkWithRetry = async (index: number): Promise<void> => {
    const chunk = chunks[index];
    const encodedText = encodeURIComponent(chunk);
    const ttsUrl = `https://tts-voice-ai.onrender.com/tts?text=${encodedText}&voice=${voice}`;

    console.log(`[Express Proxy Chunk ${index + 1}/${chunks.length}] Target: ${ttsUrl}`);

    for (let attempt = 1; attempt <= 3; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout per chunk attempt

      try {
        const apiResponse = await fetch(ttsUrl, {
          method: 'GET',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AudenVoiceStudio/1.0'
          },
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        const contentType = apiResponse.headers.get('content-type') || '';

        if (apiResponse.status === 200) {
          if (!contentType.includes('audio')) {
            if (contentType.includes('application/json')) {
              const jsonData = await apiResponse.json();
              throw new Error(jsonData.error || jsonData.message || 'JSON returned instead of audio.');
            }
            const txt = await apiResponse.text().catch(() => '');
            throw new Error(`Invalid content-type from upstream: ${contentType}. Info: ${txt.slice(0, 100)}`);
          }

          const arrayBuf = await apiResponse.arrayBuffer();
          buffers[index] = Buffer.from(arrayBuf);
          console.log(`[Express Proxy Chunk ${index + 1}/${chunks.length}] Success! Size: ${buffers[index].length} bytes`);
          return; // Success, stop retries for this chunk
        } else {
          const textSample = await apiResponse.text().catch(() => '');
          if (textSample.includes('suspended') || textSample.includes('sleeping') || textSample.includes('Spin up') || apiResponse.status === 503) {
            throw new Error(`Upstream TTS is currently sleeping on Render.com (status ${apiResponse.status}).`);
          }
          throw new Error(`Upstream returned error status ${apiResponse.status}: ${textSample.slice(0, 150)}`);
        }
      } catch (err: any) {
        clearTimeout(timeoutId);
        console.error(`[Express Proxy Chunk ${index + 1}/${chunks.length} Attempt ${attempt} Error]:`, err.message || err);
        
        if (attempt === 3) {
          throw err;
        }
        // Wait before next retry for this chunk (Render recovery delay)
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  };

  try {
    // 3. Process fetching concurrently (up to 3 parallel workers) to keep performance fast while avoiding rate limits
    const activeIndexes = [...Array(chunks.length).keys()];
    const queueWorker = async () => {
      while (activeIndexes.length > 0) {
        const idx = activeIndexes.shift();
        if (idx !== undefined) {
          await fetchChunkWithRetry(idx);
        }
      }
    };

    // Spin up 3 concurrent workers
    const workersCount = Math.min(3, chunks.length);
    const workers = Array(workersCount).fill(null).map(() => queueWorker());
    await Promise.all(workers);

    // 4. Concatenate MP3 binary chunks into a single final playback stream
    const finalBuffer = Buffer.concat(buffers);
    console.log(`[Express Proxy Concatenation] Merged ${chunks.length} chunks into a single stream. Total size: ${finalBuffer.length} bytes`);

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', finalBuffer.length);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.send(finalBuffer);
  } catch (err: any) {
    console.error('[Express Proxy Global Error]:', err.message || err);
    res.status(502).json({ error: err.message || 'Lỗi trong quá trình chia nhỏ và ghép dữ liệu giọng đọc' });
  }
});

// Serve frontend assets in production or development
if (process.env.NODE_ENV !== 'production') {
  // Use dynamic import so Vite is not statically pulled in on production/Vercel (which crashes if devDependencies aren't installed)
  import('vite').then(async ({ createServer: createViteServer }) => {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    app.listen(PORT, HOST, () => {
      console.log(`Server running in development mode on http://localhost:${PORT}`);
    });
  }).catch((err) => {
    console.error('Failed to create Vite dev server:', err);
  });
} else {
  const distPath = path.join(process.cwd(), 'dist');
  app.use(express.static(distPath));

  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });

  // Regular server standalone boot (for container hosting like Cloud Run)
  if (!process.env.VERCEL) {
    app.listen(PORT, HOST, () => {
      console.log(`Server running in production mode on http://localhost:${PORT}`);
    });
  }
}

export default app;

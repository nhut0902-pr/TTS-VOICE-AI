/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';

const PORT = 3000;
const HOST = '0.0.0.0';

async function startServer() {
  const app = express();
  app.use(express.json());

  // 1. API PROXY ENDPOINT
  // Proxies requests to tts-voice-ai.onrender.com with GET method to completely bypass CORS / connection errors
  app.post('/api/synthesize', async (req, res) => {
    const { text, voice } = req.body;

    if (!text || !voice) {
      res.status(400).json({ error: 'Parameters "text" and "voice" are required' });
      return;
    }

    const encodedText = encodeURIComponent(text);
    const ttsUrl = `https://tts-voice-ai.onrender.com/tts?text=${encodedText}&voice=${voice}`;

    let lastError: any = null;

    // Retry loop with 3 attempts to handle Render cold-starts gracefully
    for (let attempt = 1; attempt <= 3; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 seconds timeout per attempt

      try {
        console.log(`[Express Proxy Attempt ${attempt}] GET: ${ttsUrl}`);
        const apiResponse = await fetch(ttsUrl, {
          method: 'GET',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AudenVoiceStudio/1.0'
          },
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        const contentType = apiResponse.headers.get('content-type') || '';
        console.log(`[Express Proxy Response] Status: ${apiResponse.status}, Content-Type: ${contentType}`);

        if (apiResponse.status === 200) {
          if (!contentType.includes('audio')) {
            if (contentType.includes('application/json')) {
              const jsonData = await apiResponse.json();
              throw new Error(jsonData.error || jsonData.message || 'JSON returned from backend.');
            }
            const txt = await apiResponse.text().catch(() => '');
            throw new Error(`Invalid content-type from upstream: ${contentType}. Info: ${txt.slice(0, 100)}`);
          }

          const arrayBuf = await apiResponse.arrayBuffer();
          const buffer = Buffer.from(arrayBuf);
          res.setHeader('Content-Type', 'audio/mpeg');
          res.setHeader('Content-Length', buffer.length);
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.send(buffer);
          return;
        } else {
          const textSample = await apiResponse.text().catch(() => '');
          if (textSample.includes('suspended') || textSample.includes('sleeping') || textSample.includes('Spin up') || apiResponse.status === 503) {
            throw new Error(`Upstream TTS is currently boot-looping or sleeping on Render.com free tier (status ${apiResponse.status}).`);
          }
          throw new Error(`Upstream returned error status ${apiResponse.status}: ${textSample.slice(0, 150)}`);
        }
      } catch (err: any) {
        clearTimeout(timeoutId);
        lastError = err;
        console.error(`[Express Proxy Attempt ${attempt} Error]:`, err.message || err);
        if (attempt === 3) break;
        // sleep 2.5 seconds before retrying
        await new Promise(resolve => setTimeout(resolve, 2500));
      }
    }

    res.status(502).json({ error: lastError?.message || 'Upstream speech server was unreachable after 3 retries' });
  });

  // 2. VITE DEVSERVER / STATIC FILES SERVING MIDDLEWARE
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    // Serve fallback index.html for React router compatibility
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, HOST, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});

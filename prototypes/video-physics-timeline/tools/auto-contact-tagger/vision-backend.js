'use strict';
// vision-backend.js
// 可替換的 vision API 後端。依 endpoint 自動切換格式：
//  - 結尾 /api/chat        → Ollama 原生（messages[].images=[base64]，回 message.content）
//  - 結尾 /v1/chat/completions → OpenAI 相容（image_url data URI；reasoning 模型
//                                content 可能為空時 fallback 到 message.reasoning）
// 預設本地 Ollama 原生 endpoint。model / endpoint / api key 透過選項或環境變數。

const DEFAULT_ENDPOINT = 'http://127.0.0.1:11434/api/chat';

const DEFAULT_CLASSIFY_PROMPT =
  '這是桌球訓練影片中的一格畫面。判斷球拍與球的關係狀態，只回答下列其中一個詞：' +
  'before_contact（球拍尚未觸球）、contact（球拍正在觸球或極近）、' +
  'after_contact（已擊球，球已離開球拍）、unclear（無法判斷）。只輸出該詞，不要其他文字。';

const DEFAULT_ISCONTACT_PROMPT =
  '這是桌球訓練影片中的連續畫面的一格。判斷這一格是否為「球拍接觸球」的瞬間。' +
  '只回答 JSON：{"is_contact": true|false, "confidence": 0.0到1.0}，不要其他文字。';

// 'contact' 是 'before_contact'/'after_contact' 的子字串，故先比對前後再比對 contact。
const LABEL_ORDER = ['before_contact', 'after_contact', 'contact', 'unclear'];

function normalizeLabel(text) {
  const t = String(text || '').toLowerCase();
  for (const lab of LABEL_ORDER) if (t.includes(lab)) return lab;
  return 'unclear';
}

function num(v, fallback) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : fallback;
}

function parseIsContact(text) {
  const t = String(text || '');
  let obj = null;
  const m = t.match(/\{[\s\S]*?\}/);
  if (m) { try { obj = JSON.parse(m[0]); } catch (e) {} }
  if (obj && typeof obj === 'object') {
    return { is_contact: !!obj.is_contact, confidence: num(obj.confidence, obj.is_contact ? 0.5 : 0.2) };
  }
  const truthy = /is_contact["'\s:]+true/i.test(t);
  return { is_contact: truthy, confidence: 0.3 };
}

function readFrameBase64(frame) {
  const fs = require('fs');
  if (frame.base64) return frame.base64;
  if (frame.path) return fs.readFileSync(frame.path).toString('base64');
  throw new Error('frame has neither base64 nor path');
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function isNativeOllama(endpoint) {
  return /\/api\/chat\/?$/.test(endpoint);
}

function makeVisionBackend(opts) {
  opts = opts || {};
  const endpoint = opts.endpoint || process.env.OLLAMA_BASE_URL || DEFAULT_ENDPOINT;
  const model = opts.model || process.env.OLLAMA_VISION_MODEL || process.env.OPENAI_MODEL || null;
  const apiKey = opts.apiKey || process.env.OLLAMA_API_KEY || process.env.OPENAI_API_KEY || null;
  const rateLimit = opts.rateLimitPerSec || 5;
  const maxRetries = opts.maxRetries != null ? opts.maxRetries : 3;
  const minIntervalMs = 1000 / rateLimit;
  let lastCall = 0;

  if (!model) throw new Error('no vision model specified (set --model 或環境變數 OLLAMA_VISION_MODEL)');
  const native = isNativeOllama(endpoint);

  async function chatImage(imageBase64, textPrompt, callOpts) {
    callOpts = callOpts || {};
    let body, parseRes;
    if (native) {
      body = {
        model: model, stream: false,
        options: { temperature: callOpts.temperature != null ? callOpts.temperature : 0 },
        messages: [{ role: 'user', content: textPrompt, images: [imageBase64] }]
      };
      parseRes = function (data) { return (data && data.message && data.message.content) || ''; };
    } else {
      body = {
        model: model,
        messages: [{ role: 'user', content: [
          { type: 'text', text: textPrompt },
          { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,' + imageBase64 } }
        ]}],
        temperature: callOpts.temperature != null ? callOpts.temperature : 0,
        max_tokens: callOpts.maxTokens != null ? callOpts.maxTokens : 256
      };
      parseRes = function (data) {
        const m = data && data.choices && data.choices[0] && data.choices[0].message;
        if (!m) return '';
        return m.content || m.reasoning || '';
      };
    }
    const headers = { 'Content-Type': 'application/json' };
    if (apiKey) headers['Authorization'] = 'Bearer ' + apiKey;

    let lastErr = null;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const now = Date.now();
      const wait = lastCall + minIntervalMs - now;
      if (wait > 0) await sleep(wait);
      lastCall = Date.now();
      try {
        const res = await fetch(endpoint, { method: 'POST', headers: headers, body: JSON.stringify(body) });
        if (res.status === 429 || res.status >= 500) {
          lastErr = new Error('HTTP ' + res.status);
          await sleep(1000 * Math.pow(2, attempt));
          continue;
        }
        const txt = await res.text();
        if (!res.ok) throw new Error('HTTP ' + res.status + ': ' + txt.slice(0, 200));
        const data = JSON.parse(txt);
        return parseRes(data);
      } catch (e) {
        lastErr = e;
        if (attempt < maxRetries) await sleep(1000 * Math.pow(2, attempt));
      }
    }
    throw lastErr || new Error('vision call failed');
  }

  async function classifyFrame(frame, prompt) {
    const b64 = readFrameBase64(frame);
    const txt = await chatImage(b64, prompt || DEFAULT_CLASSIFY_PROMPT, { maxTokens: 12 });
    return normalizeLabel(txt);
  }
  async function isContact(frame, prompt) {
    const b64 = readFrameBase64(frame);
    const txt = await chatImage(b64, prompt || DEFAULT_ISCONTACT_PROMPT, { maxTokens: 64 });
    return parseIsContact(txt);
  }
  return {
    chatImage: chatImage, classifyFrame: classifyFrame, isContact: isContact,
    getModel: function () { return model; }, getEndpoint: function () { return endpoint; }, isNative: function () { return native; }
  };
}

module.exports = {
  makeVisionBackend: makeVisionBackend, normalizeLabel: normalizeLabel, parseIsContact: parseIsContact,
  DEFAULT_CLASSIFY_PROMPT: DEFAULT_CLASSIFY_PROMPT, DEFAULT_ISCONTACT_PROMPT: DEFAULT_ISCONTACT_PROMPT
};
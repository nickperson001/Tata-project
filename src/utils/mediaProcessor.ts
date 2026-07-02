import path from 'path';
import crypto from 'crypto';
import fs from 'fs/promises';
import fsSync from 'fs';
import os from 'os';

let HfInference: any = null;
let vision: any = null;
try { HfInference = require('@huggingface/inference').HfInference; } catch { }
try { vision = require('@google-cloud/vision'); } catch { }

const CONFIG = {
  tmpDir: os.tmpdir(),
  audio: {
    maxSizeBytes: 10 * 1024 * 1024,
    timeoutMs: 45_000,
    model: 'openai/whisper-large-v3',
    language: 'id',
    supportedMimes: [
      'audio/ogg', 'audio/mpeg', 'audio/mp4', 'audio/aac',
      'audio/wav', 'audio/webm', 'audio/opus', 'audio/x-m4a',
      'audio/3gp', 'audio/amr', 'video/ogg',
    ],
  },
  image: {
    maxSizeBytes: 8 * 1024 * 1024,
    timeoutMs: 30_000,
    minTextLength: 5,
    supportedMimes: [
      'image/jpeg', 'image/jpg', 'image/png', 'image/webp',
      'image/gif', 'image/bmp', 'image/tiff',
    ],
  },
};

let _hfClient: any = null;
function getHFClient() {
  if (!process.env.HF_TOKEN) throw new Error('HF_TOKEN tidak diset di environment variables.');
  if (!HfInference) throw new Error('Package @huggingface/inference tidak terinstall.');
  if (!_hfClient) _hfClient = new HfInference(process.env.HF_TOKEN);
  return _hfClient;
}

let _visionClient: any = null;
function getVisionClient() {
  if (!vision) throw new Error('Package @google-cloud/vision tidak terinstall. Jalankan: npm install @google-cloud/vision');
  if (!_visionClient) {
    if (process.env.GOOGLE_VISION_CREDENTIALS_JSON) {
      try {
        const credentials = JSON.parse(process.env.GOOGLE_VISION_CREDENTIALS_JSON);
        _visionClient = new vision.ImageAnnotatorClient({ credentials });
        return _visionClient;
      } catch { throw new Error('Format GOOGLE_VISION_CREDENTIALS_JSON tidak valid atau rusak.'); }
    }
    if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      throw new Error('Kredensial Google Vision tidak ditemukan. Set GOOGLE_APPLICATION_CREDENTIALS (path file) atau GOOGLE_VISION_CREDENTIALS_JSON (isi teks JSON).');
    }
    _visionClient = new vision.ImageAnnotatorClient();
  }
  return _visionClient;
}

try { if (!fsSync.existsSync(CONFIG.tmpDir)) fsSync.mkdirSync(CONFIG.tmpDir, { recursive: true }); } catch { }

function base64SizeBytes(b64: string): number {
  if (!b64) return 0;
  const padding = (b64.match(/=/g) || []).length;
  return Math.floor((b64.length * 3) / 4) - padding;
}

function tmpFilePath(ext: string): string {
  return path.join(CONFIG.tmpDir, `${crypto.randomUUID()}.${ext}`);
}

async function cleanupFile(filePath: string): Promise<void> {
  if (!filePath) return;
  try { await fs.unlink(filePath); } catch { }
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout (${ms / 1000}s) saat ${label}`)), ms)
    ),
  ]);
}

function log(level: string, context: string, message: string, extra: Record<string, any> = {}) {
  const ts = new Date().toISOString();
  const extraStr = Object.keys(extra).length ? ` ${JSON.stringify(extra)}` : '';
  console[level === 'error' ? 'error' : 'log'](`[${ts}] [${level.toUpperCase()}] [${context}] ${message}${extraStr}`);
}

interface MediaObj {
  data: string;
  mimetype?: string;
}

interface ValidationResult {
  valid: boolean;
  error?: string;
  sizeBytes?: number;
  ext?: string;
  mime?: string;
}

function validateAudio(mediaObj: MediaObj): ValidationResult {
  if (!mediaObj || !mediaObj.data) return { valid: false, error: 'Data audio kosong atau tidak valid.' };

  const mime = (mediaObj.mimetype || '').toLowerCase();
  const sizeBytes = base64SizeBytes(mediaObj.data);

  const isKnownMime = CONFIG.audio.supportedMimes.includes(mime);
  const looksAudio = mime.includes('audio') || mime.includes('ogg') || mime.includes('opus');
  if (!isKnownMime && !looksAudio) return { valid: false, error: `Format audio tidak didukung: ${mime}` };

  if (sizeBytes > CONFIG.audio.maxSizeBytes) {
    const mb = (sizeBytes / 1024 / 1024).toFixed(1);
    return { valid: false, error: `Ukuran audio terlalu besar (${mb}MB). Maksimal 10MB.` };
  }
  if (sizeBytes < 100) return { valid: false, error: 'Audio terlalu pendek atau kosong.' };

  const extMap: Record<string, string> = {
    'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/aac': 'aac',
    'audio/wav': 'wav', 'audio/webm': 'webm', 'audio/ogg': 'ogg',
    'audio/opus': 'ogg', 'audio/x-m4a': 'm4a', 'video/ogg': 'ogg',
  };
  const ext = extMap[mime] || 'ogg';

  return { valid: true, sizeBytes, ext, mime };
}

function validateImage(mediaObj: MediaObj): ValidationResult {
  if (!mediaObj || !mediaObj.data) return { valid: false, error: 'Data gambar kosong atau tidak valid.' };

  const mime = (mediaObj.mimetype || '').toLowerCase();
  const sizeBytes = base64SizeBytes(mediaObj.data);

  const isKnownMime = CONFIG.image.supportedMimes.includes(mime);
  const looksImage = mime.includes('image');
  if (!isKnownMime && !looksImage) return { valid: false, error: `Format gambar tidak didukung: ${mime}` };

  if (sizeBytes > CONFIG.image.maxSizeBytes) {
    const mb = (sizeBytes / 1024 / 1024).toFixed(1);
    return { valid: false, error: `Ukuran gambar terlalu besar (${mb}MB). Maksimal 8MB.` };
  }
  if (sizeBytes < 500) return { valid: false, error: 'Gambar terlalu kecil atau rusak.' };

  return { valid: true, sizeBytes, mime };
}

function cleanOcrText(raw: string): string {
  if (!raw) return '';
  let text = raw
    .replace(/[\r]/g, '\n')
    .replace(/[|}{\\<>@#^~`]/g, ' ')
    .replace(/[^\x20-\x7E\xA0-\xFF\n]/g, ' ')
    .replace(/ {3,}/g, ' ')
    .replace(/\n{4,}/g, '\n\n')
    .replace(/^\s+|\s+$/gm, '')
    .trim();

  text = text.replace(/(?<=[\d.,])l(?=[\d.,])/g, '1');
  text = text.replace(/(?<=[\d.,])I(?=[\d.,])/g, '1');
  text = text.replace(/(?<=\d)O(?=\d)/g, '0');
  text = text.replace(/\bl(?=\d)/g, '1');
  text = text.replace(/\bO(?=\d)/g, '0');

  if (text.length > 800) text = text.substring(0, 800);

  return text;
}

function cleanTranscriptText(raw: string): string {
  if (!raw) return '';
  return raw
    .replace(/[^\w\s.,!?;:()/\-+Rp0-9]/g, ' ')
    .replace(/ {2,}/g, ' ')
    .trim();
}

function detectTransactionInText(text: string): { hasTransaction: boolean; confidence: number } {
  if (!text || text.length < 3) return { hasTransaction: false, confidence: 0 };

  const lower = text.toLowerCase();
  let score = 0;

  const hasNumber = /\d{3,}/.test(text);
  if (hasNumber) score += 30;

  const finWords = ['rp', 'total', 'bayar', 'harga', 'jual', 'beli', 'masuk', 'keluar',
    'tunai', 'cash', 'transfer', 'debit', 'kredit', 'kembalian', 'jumlah',
    'subtotal', 'diskon', 'pajak', 'ppn', 'nota', 'struk', 'receipt', 'invoice'];
  const wordHits = finWords.filter(w => lower.includes(w)).length;
  score += wordHits * 10;

  if (/rp\s*[\d.,]+/i.test(text)) score += 25;
  if (/[\d.,]{4,}/.test(text)) score += 10;

  return { hasTransaction: score >= 30, confidence: Math.min(100, score) };
}

async function transcribeAudio(mediaObj: MediaObj): Promise<{
  success: boolean; text: string; error: string | null; source: string;
  rawText?: string; hasTransaction?: boolean; confidence?: number;
}> {
  const ctx = 'AUDIO';
  const validation = validateAudio(mediaObj);

  if (!validation.valid) {
    log('warn', ctx, 'Validasi gagal', { error: validation.error });
    return { success: false, text: '', error: validation.error!, source: 'audio' };
  }

  const { sizeBytes, ext, mime } = validation;
  log('info', ctx, 'Mulai transkrip', { sizeKB: Math.round((sizeBytes!) / 1024), mime });

  let hf;
  try { hf = getHFClient(); } catch (err: any) {
    log('error', ctx, 'HF client gagal', { error: err.message });
    return { success: false, text: '', error: 'Fitur voice note tidak tersedia (HF_TOKEN belum diset).', source: 'audio' };
  }

  const filePath = tmpFilePath(ext!);

  try {
    await fs.writeFile(filePath, Buffer.from(mediaObj.data, 'base64'));
    const audioBuffer = await fs.readFile(filePath);

    const audioBlob = new Blob([audioBuffer], { type: 'audio/ogg' });
    const result = await withTimeout<{ text?: string }>(
      hf.automaticSpeechRecognition({
        model: CONFIG.audio.model,
        data: audioBlob,
        parameters: { language: CONFIG.audio.language },
      }),
      CONFIG.audio.timeoutMs,
      'Whisper transcription'
    );

    const raw = result?.text || '';
    const clean = cleanTranscriptText(raw);

    if (!clean || clean.length < 2) {
      log('warn', ctx, 'Hasil transcribe kosong');
      return { success: false, text: '', error: 'Suara tidak terdeteksi atau terlalu pendek. Coba kirim ulang dengan lebih jelas.', source: 'audio' };
    }

    const detection = detectTransactionInText(clean);
    log('info', ctx, 'Transcribe berhasil', { length: clean.length, confidence: detection.confidence });

    return {
      success: true, text: clean, rawText: raw,
      hasTransaction: detection.hasTransaction, confidence: detection.confidence,
      source: 'audio', error: null,
    };
  } catch (err: any) {
    const isTimeout = err.message.includes('Timeout');
    const msg = isTimeout
      ? 'Voice note terlalu panjang, coba kirim pesan singkat saja ya Bos.'
      : `Gagal memproses audio: ${err.message}`;
    log('error', ctx, 'Transcribe error', { error: err.message, isTimeout });
    return { success: false, text: '', error: msg, source: 'audio' };
  } finally {
    await cleanupFile(filePath);
  }
}

async function extractTextFromImage(mediaObj: MediaObj): Promise<{
  success: boolean; text: string; error: string | null; source: string;
  hasTransaction?: boolean; confidence?: number; ocrConfidence?: number; chain?: string;
}> {
  const ctx = 'IMAGE-OCR';
  const validation = validateImage(mediaObj);

  if (!validation.valid) {
    log('warn', ctx, 'Validasi gagal', { error: validation.error });
    return { success: false, text: '', error: validation.error!, source: 'image' };
  }

  let visionClient;
  try { visionClient = getVisionClient(); } catch (err: any) {
    log('error', ctx, 'Vision client gagal', { error: err.message });
    return { success: false, text: '', error: `Fitur scan struk tidak tersedia: ${err.message}`, source: 'image' };
  }

  const { sizeBytes, mime } = validation;
  log('info', ctx, 'Mulai OCR (Google Vision)', { sizeKB: Math.round((sizeBytes!) / 1024), mime });

  try {
    const imageBuffer = Buffer.from(mediaObj.data, 'base64');

    const [result] = await withTimeout<any[]>(
      visionClient.textDetection({ image: { content: imageBuffer } }),
      CONFIG.image.timeoutMs,
      'Google Vision OCR'
    );

    if (result.error) {
      log('error', ctx, 'Vision API error', { error: result.error.message });
      return { success: false, text: '', error: `Google Vision error: ${result.error.message}`, source: 'image' };
    }

    const fullText = result.fullTextAnnotation?.text || '';
    const clean = cleanOcrText(fullText);

    if (!clean || clean.length < CONFIG.image.minTextLength) {
      log('warn', ctx, 'Tidak ada teks terdeteksi oleh Vision API');
      return { success: false, text: '', error: 'Tidak ada teks terdeteksi di gambar. Pastikan foto struk cukup terang dan tidak buram.', source: 'image' };
    }

    const detection = detectTransactionInText(clean);

    let visionConfidence = 0;
    const pages = result.fullTextAnnotation?.pages || [];
    if (pages.length > 0) {
      let totalConf = 0, blockCount = 0;
      for (const page of pages) {
        for (const block of (page.blocks || [])) {
          if (block.confidence !== undefined) { totalConf += block.confidence; blockCount++; }
        }
      }
      visionConfidence = blockCount > 0 ? Math.round((totalConf / blockCount) * 100) : 0;
    }

    log('info', ctx, 'OCR selesai (Google Vision)', { len: clean.length, visionConf: visionConfidence, txConf: detection.confidence });

    return {
      success: true, text: clean, hasTransaction: detection.hasTransaction,
      confidence: detection.confidence, ocrConfidence: visionConfidence,
      chain: 'google-vision', source: 'image', error: null,
    };
  } catch (err: any) {
    const isTimeout = err.message.includes('Timeout');
    const msg = isTimeout
      ? 'Proses OCR terlalu lama. Coba kirim foto yang lebih kecil atau lebih jelas.'
      : `Gagal memproses gambar: ${err.message}`;
    log('error', ctx, 'OCR error', { error: err.message, isTimeout });
    return { success: false, text: '', error: msg, source: 'image' };
  }
}

export { transcribeAudio, extractTextFromImage, validateAudio, validateImage, detectTransactionInText };

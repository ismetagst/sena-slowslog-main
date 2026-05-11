// Robust browser-native audio normalization pipeline.
// No FFmpeg.wasm — too fragile in preview (COOP/COEP, large worker).
// Strategy:
//   1. Try the original blob — if the browser can decode + play it, ship it as-is.
//   2. Else: try Web Audio decodeAudioData (handles MP3, WAV, M4A/AAC, OGG, FLAC, WebM/Opus).
//      Re-encode the decoded PCM to a clean WAV (16kHz mono) container that EVERY browser
//      can play (HTMLAudioElement supports PCM WAV natively).
//   3. Else: try ADTS-AAC remux to M4A (raw .aac files from Android/iOS).
//   4. Else: bubble up an explicit error so the user knows the file is unsupported.

import { isAdtsAacBlob, parseAdtsFrames, remuxAdtsAacToM4a } from "./audio-remux";

export interface NormalizedAudio {
  blob: Blob;
  duration: number;
  sourceDuration: number;
  strategy: "passthrough" | "webaudio-wav" | "webcodecs-aac-wav" | "adts-remux";
  mime: string;
}

interface NormalizeAudioOptions {
  /** Prefer a clean PCM WAV payload instead of trusting browser/container MIME. */
  preferWav?: boolean;
  /** Only pass through native-playable files when they already fit storage. */
  maxPassthroughBytes?: number;
  /** Recordings from MediaRecorder should keep their native container. */
  source?: "recording" | "upload";
  /** Trusted duration from the recorder when a container has weak metadata. */
  durationHint?: number;
}

interface WebCodecsAudioData {
  numberOfChannels: number;
  numberOfFrames: number;
  sampleRate: number;
  copyTo: (destination: Float32Array, options: { planeIndex: number; format: "f32-planar" }) => void;
  close?: () => void;
}

interface WebCodecsAudioDecoder {
  configure: (config: Record<string, unknown>) => void;
  decode: (chunk: unknown) => void;
  flush: () => Promise<void>;
  close?: () => void;
}

const getAudioContextCtor = () => {
  const win = window as typeof window & { webkitAudioContext?: typeof AudioContext };
  return window.AudioContext || win.webkitAudioContext;
};

const probeBlobPlayable = (blob: Blob, timeoutMs = 4000): Promise<{ ok: boolean; duration: number; error?: string }> =>
  new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const audio = new Audio();
    let settled = false;
    const cleanup = () => {
      audio.onloadedmetadata = null;
      audio.oncanplay = null;
      audio.onerror = null;
      audio.removeAttribute("src");
      audio.load();
      URL.revokeObjectURL(url);
    };
    const finish = (result: { ok: boolean; duration: number; error?: string }) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      cleanup();
      resolve(result);
    };
    const timer = window.setTimeout(() => finish({ ok: false, duration: 0, error: "probe timeout" }), timeoutMs);

    audio.preload = "auto";
    const tryFinish = () => {
      const d = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 0;
      if (d > 0) finish({ ok: true, duration: d });
      // wait for canplay if duration not yet available
    };
    audio.onloadedmetadata = tryFinish;
    audio.oncanplay = () => {
      const d = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 0;
      finish({ ok: true, duration: d || 0.001 });
    };
    audio.onerror = () => {
      const code = audio.error?.code;
      const msg =
        code === MediaError.MEDIA_ERR_DECODE
          ? "decode error"
          : code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED
          ? "MIME/source not supported"
          : audio.error?.message || "playback error";
      finish({ ok: false, duration: 0, error: msg });
    };
    audio.src = url;
    audio.load();
  });

const encodeWavMono16k = (samples: Float32Array, sampleRate: number): Blob => {
  const numSamples = samples.length;
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);
  const writeStr = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + numSamples * 2, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, numSamples * 2, true);
  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }
  return new Blob([buffer], { type: "audio/wav" });
};

export const encodeFloat32MonoToWav = (
  input: Float32Array,
  inputSampleRate: number,
  targetSampleRate = 16000,
  maxDurationSeconds?: number
) => {
  const maxInputSamples = maxDurationSeconds
    ? Math.min(input.length, Math.max(1, Math.floor(maxDurationSeconds * inputSampleRate)))
    : input.length;
  const duration = maxInputSamples / inputSampleRate;
  const outputLength = Math.max(1, Math.ceil(duration * targetSampleRate));
  const output = new Float32Array(outputLength);
  const ratio = inputSampleRate / targetSampleRate;

  for (let i = 0; i < outputLength; i++) {
    const srcIndex = Math.min(maxInputSamples - 1, i * ratio);
    const left = Math.floor(srcIndex);
    const right = Math.min(maxInputSamples - 1, left + 1);
    const weight = srcIndex - left;
    output[i] = input[left] * (1 - weight) + input[right] * weight;
  }

  return encodeWavMono16k(output, targetSampleRate);
};

const sniffAudioMime = async (blob: Blob, fileName: string) => {
  const name = fileName.toLowerCase();
  const head = new Uint8Array(await blob.slice(0, 16).arrayBuffer());
  const text = String.fromCharCode(...head);
  if (text.startsWith("RIFF") && text.slice(8, 12) === "WAVE") return "audio/wav";
  if (text.startsWith("ID3") || (head[0] === 0xff && (head[1] & 0xe0) === 0xe0)) return "audio/mpeg";
  if (text.startsWith("OggS")) return "audio/ogg";
  if (text.startsWith("fLaC")) return "audio/flac";
  if (head[0] === 0x1a && head[1] === 0x45 && head[2] === 0xdf && head[3] === 0xa3) return "audio/webm";
  if (text.slice(4, 8) === "ftyp") return "audio/mp4";
  if (head[0] === 0xff && (head[1] & 0xf0) === 0xf0) return "audio/aac";
  if (name.endsWith(".m4a") || name.endsWith(".mp4") || name.endsWith(".3gp") || name.endsWith(".3gpp")) return "audio/mp4";
  if (name.endsWith(".mp3")) return "audio/mpeg";
  if (name.endsWith(".wav")) return "audio/wav";
  if (name.endsWith(".ogg") || name.endsWith(".oga") || name.endsWith(".opus")) return "audio/ogg";
  if (name.endsWith(".webm") || name.endsWith(".weba")) return "audio/webm";
  if (name.endsWith(".aac")) return "audio/aac";
  return blob.type || "audio/unknown";
};

const decodeWithWebAudio = async (blob: Blob, maxDurationSeconds: number) => {
  const Ctor = getAudioContextCtor();
  if (!Ctor || typeof OfflineAudioContext === "undefined") {
    throw new Error("Web Audio API not available in this browser");
  }
  const ac = new Ctor();
  await ac.resume().catch(() => undefined);
  let decoded: AudioBuffer;
  try {
    decoded = await ac.decodeAudioData(await blob.arrayBuffer());
  } finally {
    await ac.close().catch(() => undefined);
  }

  const sourceDuration = Number.isFinite(decoded.duration) && decoded.duration > 0 ? decoded.duration : 0;
  if (sourceDuration <= 0) throw new Error("decoded audio has no duration");

  const duration = Math.min(maxDurationSeconds, sourceDuration);
  const targetRate = 16000;
  const frames = Math.max(1, Math.ceil(duration * targetRate));
  const offline = new OfflineAudioContext(1, frames, targetRate);
  const src = offline.createBufferSource();
  src.buffer = decoded;
  src.connect(offline.destination);
  src.start(0, 0, duration);
  const rendered = await offline.startRendering();
  const wav = encodeWavMono16k(rendered.getChannelData(0), targetRate);
  return { blob: wav, duration, sourceDuration };
};

const decodeAdtsAacWithWebCodecs = async (blob: Blob, maxDurationSeconds: number) => {
  const win = window as typeof window & {
    AudioDecoder?: new (init: { output: (audioData: WebCodecsAudioData) => void; error: (error: unknown) => void }) => WebCodecsAudioDecoder;
    EncodedAudioChunk?: new (init: { type: "key"; timestamp: number; duration: number; data: Uint8Array }) => unknown;
  };
  const AudioDecoderCtor = win.AudioDecoder;
  const EncodedAudioChunkCtor = win.EncodedAudioChunk;
  if (!AudioDecoderCtor || !EncodedAudioChunkCtor) throw new Error("WebCodecs AAC decoder not available");

  const frameSet = parseAdtsFrames(new Uint8Array(await blob.arrayBuffer()), maxDurationSeconds);
  const chunks: Float32Array[] = [];
  let outputRate = frameSet.sampleRate;
  let decodedSamples = 0;
  let decodeError: unknown = null;

  const decoder = new AudioDecoderCtor({
    output: (audioData: WebCodecsAudioData) => {
      try {
        const channelCount = Math.max(1, audioData.numberOfChannels || frameSet.channelConfig || 1);
        const frameCount = Math.max(1, audioData.numberOfFrames || 0);
        outputRate = audioData.sampleRate || outputRate;
        const mono = new Float32Array(frameCount);
        const plane = new Float32Array(frameCount);
        for (let channel = 0; channel < channelCount; channel++) {
          plane.fill(0);
          audioData.copyTo(plane, { planeIndex: channel, format: "f32-planar" });
          for (let i = 0; i < frameCount; i++) mono[i] += plane[i] / channelCount;
        }
        chunks.push(mono);
        decodedSamples += frameCount;
      } finally {
        audioData.close?.();
      }
    },
    error: (error: unknown) => {
      decodeError = error;
    },
  });

  decoder.configure({
    codec: `mp4a.40.${frameSet.objectType}`,
    sampleRate: frameSet.sampleRate,
    numberOfChannels: Math.max(1, frameSet.channelConfig || 1),
    description: new Uint8Array([
      (frameSet.objectType << 3) | (frameSet.frequencyIndex >> 1),
      ((frameSet.frequencyIndex & 1) << 7) | ((frameSet.channelConfig || 1) << 3),
    ]),
  });

  const frameDurationUs = Math.round((1024 / frameSet.sampleRate) * 1_000_000);
  frameSet.frames.forEach((frame, index) => {
    decoder.decode(new EncodedAudioChunkCtor({ type: "key", timestamp: index * frameDurationUs, duration: frameDurationUs, data: frame }));
  });
  await decoder.flush();
  decoder.close?.();

  if (decodeError) throw decodeError instanceof Error ? decodeError : new Error("WebCodecs AAC decode failed");
  if (!decodedSamples || chunks.length === 0) throw new Error("WebCodecs decoded AAC to empty audio");

  const pcm = new Float32Array(decodedSamples);
  let offset = 0;
  chunks.forEach((chunk) => {
    pcm.set(chunk, offset);
    offset += chunk.length;
  });
  const duration = Math.min(maxDurationSeconds, decodedSamples / outputRate);
  return { blob: encodeFloat32MonoToWav(pcm, outputRate, 16000, maxDurationSeconds), duration, sourceDuration: frameSet.duration };
};

const isLikelyAdtsAac = (blob: Blob, fileName: string) => {
  const name = fileName.toLowerCase();
  if (name.endsWith(".aac")) return true;
  if (blob.type.includes("aac") && !blob.type.includes("mp4")) return true;
  return false;
};

export const normalizeAudio = async (
  source: Blob,
  fileName: string,
  maxDurationSeconds: number,
  options: NormalizeAudioOptions = {}
): Promise<NormalizedAudio> => {
  if (!(source instanceof Blob) || source.size <= 0) throw new Error("audio source is empty (0 B)");
  const sniffedMime = await sniffAudioMime(source, fileName);
  const sourceForProbe = sniffedMime && sniffedMime !== source.type
    ? new Blob([source], { type: sniffedMime })
    : source;
  const sourceIsAdtsAac = await isAdtsAacBlob(sourceForProbe).catch(() => false);
  const canPassThroughSize = !options.maxPassthroughBytes || sourceForProbe.size <= options.maxPassthroughBytes;
  const durationHint = Number.isFinite(options.durationHint || 0) && (options.durationHint || 0) > 0 ? options.durationHint || 0 : 0;

  if (options.source === "recording" && canPassThroughSize && /audio\/(webm|ogg|mp4)/i.test(sourceForProbe.type || sniffedMime)) {
    const probe = await probeBlobPlayable(sourceForProbe, 2500);
    const sourceDuration = probe.ok && probe.duration > 0 ? probe.duration : durationHint || 0.001;
    return {
      blob: sourceForProbe,
      duration: Math.min(maxDurationSeconds, sourceDuration),
      sourceDuration,
      strategy: "passthrough",
      mime: sourceForProbe.type || sniffedMime || "audio/webm",
    };
  }

  const forceAacTranscode = sourceIsAdtsAac;

  if (options.preferWav && forceAacTranscode) {
    const errors: string[] = [];
    // 1) Try Web Audio directly on raw .aac (works in some desktop browsers).
    try {
      const result = await decodeWithWebAudio(sourceForProbe, maxDurationSeconds);
      return { ...result, strategy: "webaudio-wav", mime: "audio/wav" };
    } catch (e) {
      errors.push(e instanceof Error ? e.message : "webaudio raw aac failed");
    }
    // 2) Remux ADTS → M4A then Web Audio decode (most reliable on Android Chrome).
    try {
      const remuxed = await remuxAdtsAacToM4a(sourceForProbe, maxDurationSeconds);
      const result = await decodeWithWebAudio(remuxed.blob, maxDurationSeconds);
      return { ...result, sourceDuration: remuxed.duration || result.sourceDuration, strategy: "webaudio-wav", mime: "audio/wav" };
    } catch (e) {
      errors.push(e instanceof Error ? e.message : "remux+webaudio failed");
    }
    // 3) Remux only — keep M4A if it natively probes ok.
    try {
      const remuxed = await remuxAdtsAacToM4a(sourceForProbe, maxDurationSeconds);
      const remuxProbe = await probeBlobPlayable(remuxed.blob);
      if (remuxProbe.ok) {
        return {
          blob: remuxed.blob,
          duration: Math.min(maxDurationSeconds, remuxed.duration),
          sourceDuration: remuxed.duration,
          strategy: "adts-remux",
          mime: "audio/mp4",
        };
      }
    } catch (e) {
      errors.push(e instanceof Error ? e.message : "remux probe failed");
    }
    // 4) Last resort: WebCodecs (rarely available on mobile).
    try {
      const result = await decodeAdtsAacWithWebCodecs(sourceForProbe, maxDurationSeconds);
      return { ...result, strategy: "webcodecs-aac-wav", mime: "audio/wav" };
    } catch (e) {
      errors.push(e instanceof Error ? e.message : "webcodecs failed");
    }
    throw new Error(`AAC could not be transcoded to WAV (${errors.join(" | ")}). try M4A, MP3, WAV, OGG, or WebM.`);
  }

  if (options.preferWav) {
    try {
      const result = await decodeWithWebAudio(sourceForProbe, maxDurationSeconds);
      return { ...result, strategy: "webaudio-wav", mime: "audio/wav" };
    } catch {
      if (sourceIsAdtsAac) {
        try {
          const result = await decodeAdtsAacWithWebCodecs(sourceForProbe, maxDurationSeconds);
          return { ...result, strategy: "webcodecs-aac-wav", mime: "audio/wav" };
        } catch {
          // Continue to native/remux fallbacks below.
        }
      }
      // Continue to native/remux fallbacks below.
    }
  }

  // Step 1 — passthrough if already playable
  const probe = await probeBlobPlayable(sourceForProbe);
  if (probe.ok && probe.duration > 0 && canPassThroughSize) {
    const duration = Math.min(maxDurationSeconds, probe.duration);
    return {
      blob: sourceForProbe,
      duration,
      sourceDuration: probe.duration,
      strategy: "passthrough",
      mime: sourceForProbe.type || sniffedMime || "audio/unknown",
    };
  }

  // Step 2 — try Web Audio decoding (covers most modern formats)
  try {
    const result = await decodeWithWebAudio(sourceForProbe, maxDurationSeconds);
    return { ...result, strategy: "webaudio-wav", mime: "audio/wav" };
  } catch (webAudioErr) {
    // Step 3 — fallback for raw ADTS AAC streams
    if (sourceIsAdtsAac || isLikelyAdtsAac(sourceForProbe, fileName)) {
      try {
        const result = await decodeAdtsAacWithWebCodecs(sourceForProbe, maxDurationSeconds);
        return { ...result, strategy: "webcodecs-aac-wav", mime: "audio/wav" };
      } catch {
        // Continue to M4A remux fallback.
      }
      try {
        const remuxed = await remuxAdtsAacToM4a(sourceForProbe, maxDurationSeconds);
        // Probe the remuxed result; if browser still can't play, try webaudio on it
        const remuxProbe = await probeBlobPlayable(remuxed.blob);
        if (remuxProbe.ok) {
          return {
            blob: remuxed.blob,
            duration: Math.min(maxDurationSeconds, remuxed.duration),
            sourceDuration: remuxed.duration,
            strategy: "adts-remux",
            mime: "audio/mp4",
          };
        }
        const result = await decodeWithWebAudio(remuxed.blob, maxDurationSeconds);
        return { ...result, strategy: "webaudio-wav", mime: "audio/wav" };
      } catch {
        // fall through
      }
    }
    const reason = webAudioErr instanceof Error ? webAudioErr.message : "decode failed";
    throw new Error(`audio format not supported (${reason}). try MP3, WAV, M4A, OGG, or WebM.`);
  }
};

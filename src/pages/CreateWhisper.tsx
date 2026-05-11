import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import fixWebmDuration from "fix-webm-duration";
import Header from "@/components/Header";
import { useAuth } from "@/hooks/useAuth";
import { useWhisperEventStatus } from "@/hooks/useWhisper";
import { useCreateWhisper } from "@/hooks/useCreateWhisper";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Mic, Pause, Play, Square, Trash2, Lock, Upload, RotateCcw, MicOff, Settings as SettingsIcon } from "lucide-react";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";
import { detectMicPlatform, classifyMicError, getMicInstructions, type MicErrorInfo } from "@/lib/mic-permission";

const MAX_DURATION_SECONDS = 120;
const MAX_FILE_SIZE_MB = 5;
const SOURCE_FILE_SIZE_MB = 20;
const TARGET_SAMPLE_RATE = 16000;

const formatDuration = (seconds: number) => {
  const safe = Math.max(0, Math.round(seconds));
  return `${Math.floor(safe / 60)}:${(safe % 60).toString().padStart(2, "0")}`;
};

const formatBytes = (bytes: number) => {
  if (!bytes) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

type DebugSource = "idle" | "recording" | "upload";

interface WhisperDebugInfo {
  source: DebugSource;
  recorderMime: string;
  originalMime: string;
  uploadMime: string;
  fileName: string;
  originalSize: number;
  blobSize: number;
  parsedDuration: number;
  playable: boolean;
  canPlayType: string;
  conversion: string;
  mediaError: string;
}

const initialDebugInfo: WhisperDebugInfo = {
  source: "idle",
  recorderMime: "—",
  originalMime: "—",
  uploadMime: "—",
  fileName: "—",
  originalSize: 0,
  blobSize: 0,
  parsedDuration: 0,
  playable: false,
  canPlayType: "—",
  conversion: "waiting",
  mediaError: "—",
};

const getMediaErrorMessage = (audio: HTMLAudioElement) => {
  const code = audio.error?.code;
  if (code === MediaError.MEDIA_ERR_ABORTED) return "playback aborted";
  if (code === MediaError.MEDIA_ERR_NETWORK) return "network error while loading audio";
  if (code === MediaError.MEDIA_ERR_DECODE) return "browser could not decode this audio";
  if (code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED) return "audio source or MIME is not supported";
  return audio.error?.message || "unknown media element error";
};

const fileWithType = (blob: Blob, fileName: string, type: string, ext: string) => {
  const base = fileName.replace(/\.[^.]+$/, "") || "whisper";
  return new File([blob], `${base}.${ext}`, { type });
};

const isAacUpload = (blob: Blob, fileName: string) => {
  const name = fileName.toLowerCase();
  return name.endsWith(".aac") || (blob.type.includes("aac") && !blob.type.includes("mp4"));
};

const getAudioRecorderWorklet = () => `
class WhisperRecorderProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const channel = inputs[0] && inputs[0][0];
    if (channel && channel.length) {
      const copy = new Float32Array(channel);
      this.port.postMessage(copy, [copy.buffer]);
    }
    return true;
  }
}
registerProcessor('whisper-recorder-processor', WhisperRecorderProcessor);
`;

const concatFloat32 = (chunks: Float32Array[]) => {
  const output = new Float32Array(chunks.reduce((total, chunk) => total + chunk.length, 0));
  let offset = 0;
  chunks.forEach((chunk) => {
    output.set(chunk, offset);
    offset += chunk.length;
  });
  return output;
};

const probePlayableAudio = (src: string, durationHint: number): Promise<{ duration: number; error: string }> =>
  new Promise((resolve, reject) => {
    const audio = new Audio();
    let settled = false;
    const cleanup = () => {
      window.clearTimeout(timeout);
      audio.oncanplay = null;
      audio.oncanplaythrough = null;
      audio.onloadedmetadata = null;
      audio.onerror = null;
      audio.removeAttribute("src");
      audio.load();
    };
    const done = (duration: number) => {
      if (settled) return;
      settled = true;
      cleanup();
      const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : durationHint;
      if (safeDuration > 0) resolve({ duration: safeDuration, error: "" });
      else reject(new Error("playable audio has no duration"));
    };
    const fail = () => {
      if (settled) return;
      settled = true;
      const message = getMediaErrorMessage(audio);
      cleanup();
      reject(new Error(message));
    };
    const timeout = window.setTimeout(() => {
      fail();
    }, 6000);

    audio.preload = "auto";
    audio.onloadedmetadata = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) done(audio.duration);
    };
    audio.oncanplay = () => done(audio.duration);
    audio.oncanplaythrough = () => done(audio.duration);
    audio.onerror = fail;
    audio.src = src;
    audio.load();
  });

const getSupportedRecordingMime = () => {
  if (typeof MediaRecorder === "undefined") return "";
  const playable = document.createElement("audio");
  const ua = navigator.userAgent.toLowerCase();
  const preferMp4 = /iphone|ipad|ipod|safari/.test(ua) && !/chrome|crios|firefox|fxios|android/.test(ua);
  const webmCandidates = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"];
  const mp4Candidates = ["audio/mp4;codecs=mp4a.40.2", "audio/mp4"];
  const candidates = preferMp4 ? [...mp4Candidates, ...webmCandidates] : [...webmCandidates, ...mp4Candidates];

  return candidates.find((mime) => MediaRecorder.isTypeSupported(mime) && playable.canPlayType(mime) !== "") || "";
};

const CreateWhisper = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const folderId = searchParams.get("folder");
  const { user, profile, loading } = useAuth();
  const { data: status, isLoading: statusLoading } = useWhisperEventStatus();
  const createMut = useCreateWhisper();

  const [title, setTitle] = useState("");
  const [recipient, setRecipient] = useState("");
  const [message, setMessage] = useState("");
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [playbackTime, setPlaybackTime] = useState(0);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const [previewReady, setPreviewReady] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<WhisperDebugInfo>(initialDebugInfo);
  const [uploadStatus, setUploadStatus] = useState<
    | { phase: "idle" }
    | { phase: "reading"; fileName: string }
    | { phase: "parsing"; fileName: string }
    | { phase: "success"; fileName: string; duration: number }
    | { phase: "error"; message: string; stage: "parse" | "upload" }
  >({ phase: "idle" });
  const [saveProgress, setSaveProgress] = useState<number | null>(null);
  const [lastFile, setLastFile] = useState<File | null>(null);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [micError, setMicError] = useState<MicErrorInfo | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const elapsedRef = useRef(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const recorderNodeRef = useRef<AudioWorkletNode | null>(null);
  const recorderSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const recorderMonitorRef = useRef<GainNode | null>(null);
  const pcmChunksRef = useRef<Float32Array[]>([]);
  const recorderModeRef = useRef<"webaudio" | "mediarecorder" | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const recordingStartedAtRef = useRef<number>(0);

  // Hard caps for everyone — including admin/founder for safety.
  const maxDuration = MAX_DURATION_SECONDS;
  const maxFileSizeMB = MAX_FILE_SIZE_MB;
  const maxUploadBytes = useMemo(() => maxFileSizeMB * 1024 * 1024, [maxFileSizeMB]);

  useEffect(() => {
    elapsedRef.current = elapsed;
  }, [elapsed]);

  const replaceAudioUrl = useCallback((nextUrl: string | null) => {
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    audioUrlRef.current = nextUrl;
    setAudioUrl(nextUrl);
    setPlaybackTime(0);
    setIsPreviewPlaying(false);
    setPreviewReady(false);
    setPreviewError(null);
  }, []);

  useEffect(() => {
    if (!loading && !user) navigate("/auth");
  }, [loading, user, navigate]);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      recorderNodeRef.current?.disconnect();
      recorderSourceRef.current?.disconnect();
      recorderMonitorRef.current?.disconnect();
      audioContextRef.current?.close().catch(() => undefined);
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    };
  }, []);

  const preparePlayableAudio = useCallback(
    async (
      sourceBlob: Blob,
      opts: { source: Exclude<DebugSource, "idle">; fileName: string; recorderMime?: string; originalMime?: string; durationHint?: number }
    ) => {
      let nextUrl: string | null = null;
      setPreviewReady(false);
      setPreviewError(null);
      setAudioBlob(null);
      setDebugInfo({
        ...initialDebugInfo,
        source: opts.source,
        recorderMime: opts.recorderMime || "—",
        originalMime: opts.originalMime || sourceBlob.type || "unknown",
        uploadMime: "checking",
        fileName: opts.fileName,
        originalSize: sourceBlob.size,
        conversion: "checking browser playback",
      });

      try {
        let parsedDuration = opts.durationHint || 0;
        let conversion = "preparing audio";

        const forceAac = opts.source === "upload" && isAacUpload(sourceBlob, opts.fileName);
        setDebugInfo((prev) => ({
          ...prev,
          conversion: forceAac
            ? "AAC upload: transcoding to WAV"
            : "checking native playback first",
        }));
        const { normalizeAudio } = await import("@/lib/audio-transcode");
        // Only force WAV transcode for raw AAC uploads. For everything else
        // (webm/opus from MediaRecorder, mp3, m4a, wav, ogg) we probe-passthrough
        // first — the browser that recorded/has the file can almost always play it.
        const normalized = await normalizeAudio(sourceBlob, opts.fileName, maxDuration, {
          preferWav: forceAac,
          maxPassthroughBytes: maxUploadBytes,
          source: opts.source,
          durationHint: opts.durationHint,
        });
        const ext = normalized.strategy === "passthrough"
          ? (opts.fileName.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] || "audio")
          : normalized.strategy === "adts-remux"
          ? "m4a"
          : "wav";
        const playableBlob = fileWithType(normalized.blob, opts.fileName, normalized.mime, ext);
        parsedDuration = normalized.sourceDuration || opts.durationHint || normalized.duration || 0;
        conversion =
          normalized.strategy === "passthrough"
            ? `playable as-is (${normalized.mime})`
            : normalized.strategy === "adts-remux"
            ? "remuxed raw AAC → M4A"
            : normalized.strategy === "webcodecs-aac-wav"
            ? "decoded raw AAC with WebCodecs → WAV PCM 16k mono"
            : `decoded with Web Audio → WAV PCM 16k mono`;
        if (parsedDuration > maxDuration) conversion += ` · trimmed to first ${maxDuration}s`;

        if (playableBlob.size <= 0) throw new Error("prepared audio is empty (0 B)");
        if (playableBlob.size > maxUploadBytes) throw new Error(`prepared audio is too large (${formatBytes(playableBlob.size)})`);

        nextUrl = URL.createObjectURL(playableBlob);
        let finalDuration = Math.max(1, Math.min(maxDuration, Math.round(parsedDuration || opts.durationHint || 0)));
        try {
          const probe = await probePlayableAudio(nextUrl, parsedDuration || opts.durationHint || 0);
          finalDuration = Math.max(1, Math.min(maxDuration, Math.round(probe.duration || parsedDuration || opts.durationHint || 0)));
        } catch (probeErr) {
          if (opts.source !== "recording") throw probeErr;
          setDebugInfo((prev) => ({
            ...prev,
            mediaError: probeErr instanceof Error ? `recording saved with recorder duration fallback: ${probeErr.message}` : "recording saved with recorder duration fallback",
          }));
        }

        replaceAudioUrl(nextUrl);
        nextUrl = null;
        setAudioBlob(playableBlob);
        setElapsed(finalDuration);
        setPreviewReady(true);
        setPreviewError(null);
        setDebugInfo((prev) => ({
          ...prev,
          uploadMime: playableBlob.type,
          blobSize: playableBlob.size,
          parsedDuration: Number((parsedDuration || finalDuration).toFixed(2)),
          playable: true,
          canPlayType: document.createElement("audio").canPlayType(playableBlob.type) || "confirmed by probe",
          conversion,
          mediaError: opts.source === "recording" ? "recording ready" : "—",
        }));

        if (parsedDuration > maxDuration) toast.info(`audio is ${Math.round(parsedDuration)}s — only the first ${maxDuration}s will play`);
        return { ok: true as const, duration: finalDuration };
      } catch (err) {
        if (nextUrl) URL.revokeObjectURL(nextUrl);
        const message = err instanceof Error ? err.message : "audio could not be prepared";
        replaceAudioUrl(null);
        setAudioBlob(null);
        setElapsed(0);
        setPreviewReady(false);
        setPreviewError("audio belum bisa diputar di browser ini");
        setDebugInfo((prev) => ({ ...prev, playable: false, blobSize: 0, uploadMime: "—", mediaError: message }));
        return { ok: false as const, error: message };
      }
    },
    [maxDuration, maxUploadBytes, replaceAudioUrl]
  );

  const stopRecordingTracks = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const releaseRecorderResources = async () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        // Already stopped by the browser.
      }
    }
    mediaRecorderRef.current = null;
    recorderModeRef.current = null;
    chunksRef.current = [];
    pcmChunksRef.current = [];
    stopRecordingTracks();
    await cleanupWebAudioRecorder();
  };

  const cleanupWebAudioRecorder = async () => {
    recorderNodeRef.current?.disconnect();
    recorderSourceRef.current?.disconnect();
    recorderMonitorRef.current?.disconnect();
    recorderNodeRef.current = null;
    recorderSourceRef.current = null;
    recorderMonitorRef.current = null;
    const ctx = audioContextRef.current;
    audioContextRef.current = null;
    await ctx?.close().catch(() => undefined);
  };

  const finishWebAudioRecording = async () => {
    const recordedSeconds = Math.max(
      1,
      Math.min(maxDuration, Math.round((Date.now() - recordingStartedAtRef.current) / 1000) || elapsedRef.current)
    );
    const ctxSampleRate = audioContextRef.current?.sampleRate || 48000;
    const pcm = concatFloat32(pcmChunksRef.current);
    pcmChunksRef.current = [];
    await cleanupWebAudioRecorder();
    stopRecordingTracks();

    if (pcm.length === 0) {
      setDebugInfo({
        ...initialDebugInfo,
        source: "recording",
        recorderMime: `webaudio/pcm;rate=${ctxSampleRate}`,
        originalMime: "audio/pcm",
        fileName: "recording.wav",
        mediaError: "Web Audio recorder returned no samples",
      });
      toast.error("recording was empty — please try again");
      return;
    }

    setUploadStatus({ phase: "parsing", fileName: "recording.wav" });
    const { encodeFloat32MonoToWav } = await import("@/lib/audio-transcode");
    const wavBlob = encodeFloat32MonoToWav(pcm, ctxSampleRate, TARGET_SAMPLE_RATE, maxDuration);
    if (wavBlob.size <= 44) {
      toast.error("recording was empty — please try again");
      setUploadStatus({ phase: "idle" });
      return;
    }

    const prepared = await preparePlayableAudio(wavBlob, {
      source: "recording",
      fileName: "recording.wav",
      recorderMime: `webaudio/pcm;rate=${ctxSampleRate}`,
      originalMime: "audio/wav",
      durationHint: recordedSeconds,
    });
    setUploadStatus({ phase: "idle" });
    if (!prepared.ok) toast.error("audio rekaman belum bisa diputar — lihat debug whisper");
  };

  const startRecording = async () => {
    try {
      if (recording) return;
      if (!navigator.mediaDevices?.getUserMedia) {
        toast.error("recording is not supported in this browser");
        return;
      }
      await releaseRecorderResources();
      replaceAudioUrl(null);
      setAudioBlob(null);
      setDebugInfo(initialDebugInfo);
      setUploadStatus({ phase: "idle" });
      setMicError(null);

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      pcmChunksRef.current = [];

      if (typeof MediaRecorder !== "undefined") {
        recorderModeRef.current = "mediarecorder";
      } else {
        const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AudioContextCtor) {
          stopRecordingTracks();
          toast.error("recording is not supported in this browser");
          return;
        }
        const ctx = new AudioContextCtor();
        audioContextRef.current = ctx;
        const worklet = (ctx as AudioContext & { audioWorklet?: AudioWorklet }).audioWorklet;
        if (!worklet) {
          await ctx.close().catch(() => undefined);
          audioContextRef.current = null;
          recorderModeRef.current = null;
        } else {
          const workletUrl = URL.createObjectURL(new Blob([getAudioRecorderWorklet()], { type: "text/javascript" }));
          try {
            await worklet.addModule(workletUrl);
            const source = ctx.createMediaStreamSource(stream);
            const node = new AudioWorkletNode(ctx, "whisper-recorder-processor");
            const monitor = ctx.createGain();
            monitor.gain.value = 0;
            node.port.onmessage = (event) => {
              if (event.data instanceof Float32Array) pcmChunksRef.current.push(event.data);
            };
            source.connect(node);
            node.connect(monitor);
            monitor.connect(ctx.destination);
            recorderSourceRef.current = source;
            recorderNodeRef.current = node;
            recorderMonitorRef.current = monitor;
            recorderModeRef.current = "webaudio";
            await ctx.resume().catch(() => undefined);
          } catch {
            await ctx.close().catch(() => undefined);
            audioContextRef.current = null;
            recorderModeRef.current = typeof MediaRecorder !== "undefined" ? "mediarecorder" : null;
          } finally {
            URL.revokeObjectURL(workletUrl);
          }
        }
      }

      if (!recorderModeRef.current) {
        stopRecordingTracks();
        toast.error("recording is not supported in this browser");
        return;
      }

      if (recorderModeRef.current === "mediarecorder") {
        const mime = getSupportedRecordingMime();
        const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
        mediaRecorderRef.current = mr;

        mr.ondataavailable = (e) => {
          if (e.data.size > 0) chunksRef.current.push(e.data);
        };
        mr.onstop = async () => {
          const recordedSeconds = Math.max(
            1,
            Math.min(maxDuration, Math.round((Date.now() - recordingStartedAtRef.current) / 1000) || elapsedRef.current)
          );
          const rawBlob = new Blob(chunksRef.current, { type: mr.mimeType || "audio/webm" });
          stopRecordingTracks();
          chunksRef.current = [];

          if (rawBlob.size === 0) {
            setDebugInfo({
              ...initialDebugInfo,
              source: "recording",
              recorderMime: mr.mimeType || "unknown",
              originalMime: rawBlob.type || "unknown",
              fileName: "recording",
              mediaError: "MediaRecorder returned an empty blob",
            });
            toast.error("recording was empty — please try again");
            return;
          }

          setUploadStatus({ phase: "parsing", fileName: "recording" });
          const fixedBlob = rawBlob.type.includes("webm")
            ? await fixWebmDuration(rawBlob, recordedSeconds * 1000, { logger: false }).catch(() => rawBlob)
            : rawBlob;
          const prepared = await preparePlayableAudio(fixedBlob, {
            source: "recording",
            fileName: rawBlob.type.includes("mp4") ? "recording.m4a" : rawBlob.type.includes("ogg") ? "recording.ogg" : "recording.webm",
            recorderMime: mr.mimeType || "unknown",
            originalMime: fixedBlob.type || rawBlob.type || "unknown",
            durationHint: recordedSeconds,
          });
          setUploadStatus({ phase: "idle" });
          if (!prepared.ok) toast.error("audio rekaman belum bisa diputar — lihat debug whisper");
        };
        mr.start(1000);
      }

      recordingStartedAtRef.current = Date.now();
      setRecording(true);
      setElapsed(0);

      timerRef.current = window.setInterval(() => {
        setElapsed((e) => {
          const n = e + 1;
          if (n >= maxDuration) stopRecording();
          return n;
        });
      }, 1000);
    } catch (err) {
      cleanupWebAudioRecorder();
      stopRecordingTracks();
      setRecording(false);
      const info = classifyMicError(err);
      setMicError(info);
      const friendly =
        info.kind === "denied"
          ? "microphone access denied"
          : info.kind === "no-device"
          ? "no microphone detected"
          : info.kind === "in-use"
          ? "microphone is being used by another app"
          : info.kind === "insecure"
          ? "microphone needs a secure (HTTPS) connection"
          : info.kind === "unsupported"
          ? "this browser does not support recording"
          : "could not start microphone";
      toast.error(friendly);
    }
  };

  const requestMicAgain = async () => {
    setMicError(null);
    await startRecording();
  };

  const stopRecording = () => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (recorderModeRef.current === "webaudio") {
      setRecording(false);
      recorderModeRef.current = null;
      finishWebAudioRecording();
      return;
    }
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      try {
        recorder.requestData();
      } catch {
        // Some browsers do not allow requestData right before stop; stop still flushes available chunks.
      }
      recorder.stop();
    }
    recorderModeRef.current = null;
    setRecording(false);
  };

  const discardRecording = () => {
    setAudioBlob(null);
    replaceAudioUrl(null);
    setElapsed(0);
    setLastFile(null);
    setDebugInfo(initialDebugInfo);
    setUploadStatus({ phase: "idle" });
    setDiscardOpen(false);
  };

  const processFile = async (file: File) => {
    setLastFile(file);
    setUploadStatus({ phase: "reading", fileName: file.name });

    const maxSourceSize = SOURCE_FILE_SIZE_MB * 1024 * 1024;
    if (file.size > maxSourceSize) {
      const msg = `file too large (max ${SOURCE_FILE_SIZE_MB}MB)`;
      setDebugInfo({
        ...initialDebugInfo,
        source: "upload",
        fileName: file.name,
        originalMime: file.type || "unknown",
        originalSize: file.size,
        mediaError: msg,
      });
      setUploadStatus({ phase: "error", message: msg, stage: "parse" });
      toast.error(msg);
      return;
    }

    setUploadStatus({ phase: "parsing", fileName: file.name });
    const prepared = await preparePlayableAudio(file, {
      source: "upload",
      fileName: file.name,
      originalMime: file.type || "unknown / extension-only",
    });

    if (!prepared.ok) {
      const message = prepared.error || "audio belum bisa diputar";
      setUploadStatus({ phase: "error", message, stage: "parse" });
      toast.error("audio belum bisa diputar — lihat debug whisper");
      return;
    }

    setUploadStatus({ phase: "success", fileName: file.name, duration: prepared.duration });
  };

  const handleUploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    await processFile(file);
  };

  const retryUpload = () => {
    if (lastFile) {
      processFile(lastFile);
    } else {
      fileInputRef.current?.click();
    }
  };

  const togglePreview = async () => {
    const audio = audioElRef.current;
    if (!audio || !audioUrl || !previewReady || previewError) {
      toast.error("audio belum lolos validasi playback");
      return;
    }

    if (!audio.paused) {
      audio.pause();
      setIsPreviewPlaying(false);
      return;
    }

    try {
      setPreviewError(null);
      if (audio.currentTime >= maxDuration || audio.currentTime >= elapsed) {
        audio.currentTime = 0;
        setPlaybackTime(0);
      }
      await audio.play();
      setIsPreviewPlaying(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "preview audio belum bisa diputar di browser ini";
      setIsPreviewPlaying(false);
      setPreviewReady(false);
      setPreviewError("preview audio belum bisa diputar di browser ini");
      setDebugInfo((prev) => ({ ...prev, playable: false, mediaError: message }));
    }
  };

  const seekPreview = (value: number) => {
    const audio = audioElRef.current;
    const next = Math.max(0, Math.min(elapsed, value));
    setPlaybackTime(next);
    if (audio) audio.currentTime = next;
  };

  const handleSave = () => {
    if (!user || !audioBlob) return;
    if (!previewReady || previewError || elapsed <= 0) {
      toast.error("audio belum bisa diputar, jadi belum bisa disimpan");
      return;
    }
    if (!title.trim()) {
      toast.error("please add a title");
      return;
    }
    if (!folderId) {
      toast.error("please open a folder first to add a whisper");
      return;
    }
    setSaveProgress(0);
    createMut.mutate(
      {
        userId: user.id,
        folderId,
        title,
        recipientName: recipient,
        shortMessage: message,
        audioBlob,
        durationSeconds: elapsed,
        onProgress: (p) => setSaveProgress(p),
      },
      {
        onSuccess: () => {
          setSaveProgress(null);
          if (profile?.username) navigate(`/@${profile.username}/whisper/${folderId}`);
          else navigate("/");
        },
        onError: () => setSaveProgress(null),
      }
    );
  };

  if (loading || statusLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="py-20 text-center text-sm text-muted-foreground">loading...</div>
      </div>
    );
  }

  if (!status?.can_create) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="mx-auto max-w-md px-6 py-20 text-center">
          <Lock className="mx-auto mb-3 h-5 w-5 text-muted-foreground" />
          <h1 className="font-serif text-xl text-foreground mb-2">whisper is closed</h1>
          <p className="text-sm text-muted-foreground">
            {!status?.feature_enabled
              ? "the feature is resting (◕‿◕｡) — check back soon"
              : !status?.window_open
              ? "the window isn't open right now"
              : !status?.is_privileged
              ? "only inner circle members can create whispers during the window"
              : "you've reached the limit for this window"}
          </p>
          <Button variant="outline" className="mt-6" onClick={() => navigate(-1)}>
            go back
          </Button>
        </main>
      </div>
    );
  }

  const remaining = maxDuration - elapsed;
  const audioUsable = !!audioBlob && previewReady && !previewError && elapsed > 0;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-lg px-6 py-10">
        <div className="mb-8 text-center">
          <h1 className="font-serif text-2xl text-foreground">leave a whisper (♪⌒)</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            {status?.is_privileged
              ? `unlimited count · max ${maxDuration}s`
              : `${status.used_count}/${status.max_notes} used in this window · max ${maxDuration}s`}
          </p>
        </div>

        {/* Recorder */}
        <div className="rounded-md border border-border bg-muted/20 p-6 text-center">
          {!audioBlob ? (
            <>
              <div className="font-mono text-3xl text-foreground tabular-nums">
                {Math.floor(elapsed / 60)}:{(elapsed % 60).toString().padStart(2, "0")}
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {recording ? `${remaining}s remaining` : `up to ${maxDuration}s`}
              </p>
              <div className="mt-5 flex justify-center">
                {!recording ? (
                  <Button onClick={startRecording} size="lg" className="rounded-full h-16 w-16 p-0">
                    <Mic className="h-6 w-6" />
                  </Button>
                ) : (
                  <Button
                    onClick={stopRecording}
                    size="lg"
                    variant="destructive"
                    className="rounded-full h-16 w-16 p-0 animate-pulse"
                  >
                    <Square className="h-5 w-5" />
                  </Button>
                )}
              </div>
              {!recording && (
                <>
                  <div className="mt-4 flex items-center justify-center gap-2 text-[11px] text-muted-foreground">
                    <span className="h-px flex-1 bg-border max-w-[60px]" />
                    <span>or</span>
                    <span className="h-px flex-1 bg-border max-w-[60px]" />
                  </div>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="mt-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <Upload className="h-3.5 w-3.5" /> upload audio file
                  </button>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    most audio formats · max {SOURCE_FILE_SIZE_MB}MB source · {maxDuration}s saved
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.oga,.opus,.webm,.weba,.mp4,.3gp,.3gpp,.amr,.flac,.caf,.aiff,.aif,.wma"
                    className="hidden"
                    onChange={handleUploadFile}
                  />
                  {uploadStatus.phase !== "idle" && uploadStatus.phase !== "success" && (
                    <div
                      className={`mt-3 mx-auto max-w-xs rounded border px-3 py-2 text-[11px] ${
                        uploadStatus.phase === "error"
                          ? "border-destructive/40 bg-destructive/5 text-destructive"
                          : "border-border bg-background text-muted-foreground"
                      }`}
                    >
                      {uploadStatus.phase === "reading" && (
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                          <span>reading <span className="text-foreground">{uploadStatus.fileName}</span>...</span>
                        </div>
                      )}
                      {uploadStatus.phase === "parsing" && (
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                        <span>checking audio playback...</span>
                        </div>
                      )}
                      {uploadStatus.phase === "error" && (
                        <div className="flex flex-col items-center gap-2">
                          <span>✕ {uploadStatus.message}</span>
                          <button
                            type="button"
                            onClick={retryUpload}
                            className="inline-flex items-center gap-1 rounded border border-destructive/40 px-2 py-1 text-[10px] text-destructive hover:bg-destructive/10"
                          >
                            <RotateCcw className="h-3 w-3" /> coba lagi
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </>
          ) : (
            <>
              <p className="text-xs text-muted-foreground mb-3">
                {uploadStatus.phase === "success"
                  ? <>✓ uploaded · <span className="text-foreground">{uploadStatus.fileName}</span> · {formatDuration(elapsed)}</>
                  : <>recorded · {formatDuration(elapsed)}</>}
              </p>
              <audio
                ref={audioElRef}
                src={audioUrl ?? undefined}
                preload="auto"
                className="hidden"
                onLoadedMetadata={(e) => {
                  const dur = e.currentTarget.duration;
                  if (Number.isFinite(dur) && dur > 0) {
                    setElapsed((prev) => Math.max(1, Math.min(maxDuration, Math.round(prev || dur))));
                    setPreviewReady(true);
                    setPreviewError(null);
                  }
                }}
                onCanPlay={() => {
                  if (elapsed > 0) {
                    setPreviewReady(true);
                    setPreviewError(null);
                    setDebugInfo((prev) => ({ ...prev, playable: true, mediaError: "—" }));
                  }
                }}
                onPlay={() => setIsPreviewPlaying(true)}
                onPause={() => setIsPreviewPlaying(false)}
                onEnded={() => {
                  setIsPreviewPlaying(false);
                  setPlaybackTime(0);
                }}
                onError={(e) => {
                  const message = getMediaErrorMessage(e.currentTarget);
                  setIsPreviewPlaying(false);
                  setPreviewReady(false);
                  setPreviewError("preview audio belum bisa diputar di browser ini");
                  setDebugInfo((prev) => ({ ...prev, playable: false, mediaError: message }));
                }}
                onTimeUpdate={(e) => {
                  const el = e.currentTarget;
                  setPlaybackTime(Math.min(el.currentTime, elapsed));
                  if (el.currentTime > maxDuration) {
                    el.pause();
                    el.currentTime = maxDuration;
                  }
                }}
              />
              <div className="mx-auto max-w-sm rounded-full border border-border bg-background px-4 py-3">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={togglePreview}
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground disabled:opacity-50"
                    disabled={!audioUrl || !previewReady || !!previewError}
                    aria-label={isPreviewPlaying ? "pause preview" : "play preview"}
                  >
                    {isPreviewPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center justify-between font-mono text-[11px] tabular-nums text-muted-foreground">
                      <span>{formatDuration(playbackTime)}</span>
                      <span>{formatDuration(elapsed)}</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={Math.max(1, elapsed)}
                      step={0.1}
                      value={Math.min(playbackTime, elapsed)}
                      onChange={(e) => seekPreview(Number(e.target.value))}
                      className="h-2 w-full accent-primary"
                      aria-label="audio preview position"
                    />
                  </div>
                </div>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  {previewError ?? (previewReady ? "preview ready" : "preparing preview...")}
                </p>
              </div>
              <button
                onClick={() => setDiscardOpen(true)}
                className="mt-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-3 w-3" /> discard & re-record
              </button>
              <AlertDialog open={discardOpen} onOpenChange={setDiscardOpen}>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>discard this whisper?</AlertDialogTitle>
                    <AlertDialogDescription>
                      your current audio will be removed so you can record or upload again.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={discardRecording}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      continue
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
        </div>

        {micError && (
          <section className="mt-4 rounded-md border border-destructive/40 bg-destructive/5 p-4 text-left">
            <div className="mb-2 flex items-center gap-2">
              <MicOff className="h-4 w-4 text-destructive" />
              <h2 className="font-serif text-sm text-destructive">
                {micError.kind === "denied" && "microphone access blocked"}
                {micError.kind === "no-device" && "no microphone detected"}
                {micError.kind === "in-use" && "microphone is busy"}
                {micError.kind === "insecure" && "secure connection required"}
                {micError.kind === "unsupported" && "recording not supported"}
                {micError.kind === "unknown" && "could not access microphone"}
              </h2>
            </div>
            <p className="mb-3 text-[11px] text-muted-foreground">
              {micError.kind === "denied"
                ? "your browser blocked microphone access for this site. follow the steps for your device, then try again."
                : micError.kind === "no-device"
                ? "no input device was found. plug in a microphone or check your audio settings, then try again."
                : micError.kind === "in-use"
                ? "another app or tab is using the microphone. close it (e.g. zoom, meet, voice notes) and try again."
                : micError.kind === "insecure"
                ? "browsers only allow mic on https pages. open this site over https (or localhost) and try again."
                : micError.kind === "unsupported"
                ? "this browser/version does not support audio recording. try the latest chrome, safari, or firefox."
                : "something went wrong. retry, or follow the steps below if it keeps failing."}
            </p>

            {(micError.kind === "denied" || micError.kind === "unknown") && (() => {
              const platform = detectMicPlatform();
              const guide = getMicInstructions(platform);
              return (
                <div className="rounded border border-border bg-background p-3">
                  <div className="mb-2 flex items-center gap-1.5 text-[11px] text-foreground">
                    <SettingsIcon className="h-3 w-3" />
                    <span>how to enable on <span className="font-medium">{guide.title}</span></span>
                  </div>
                  <ol className="list-decimal space-y-1 pl-5 text-[11px] text-muted-foreground">
                    {guide.steps.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ol>
                </div>
              );
            })()}

            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={requestMicAgain}>
                <RotateCcw className="mr-1 h-3 w-3" /> try again
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setMicError(null);
                  fileInputRef.current?.click();
                }}
              >
                <Upload className="mr-1 h-3 w-3" /> upload a file instead
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setMicError(null)}>
                dismiss
              </Button>
            </div>
            <p className="mt-2 text-[10px] text-muted-foreground/80 font-mono">
              debug: {micError.rawName} · {micError.message}
            </p>
          </section>
        )}

        {debugInfo.source !== "idle" && (
          <section className="mt-5 rounded-md border border-border bg-muted/20 p-4 text-left">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="font-serif text-sm text-foreground">debug whisper</h2>
              <span className={`rounded-full border px-2 py-0.5 text-[10px] ${debugInfo.playable ? "border-primary/30 text-primary" : "border-destructive/30 text-destructive"}`}>
                {debugInfo.playable ? "playable" : "blocked"}
              </span>
            </div>
            <dl className="grid grid-cols-[110px_1fr] gap-x-3 gap-y-1.5 text-[11px]">
              <dt className="text-muted-foreground">source</dt><dd className="break-all text-foreground">{debugInfo.source}</dd>
              <dt className="text-muted-foreground">file</dt><dd className="break-all text-foreground">{debugInfo.fileName}</dd>
              <dt className="text-muted-foreground">mime recorder</dt><dd className="break-all text-foreground">{debugInfo.recorderMime}</dd>
              <dt className="text-muted-foreground">mime original</dt><dd className="break-all text-foreground">{debugInfo.originalMime}</dd>
              <dt className="text-muted-foreground">mime upload</dt><dd className="break-all text-foreground">{debugInfo.uploadMime}</dd>
              <dt className="text-muted-foreground">ukuran original</dt><dd className="font-mono text-foreground">{formatBytes(debugInfo.originalSize)}</dd>
              <dt className="text-muted-foreground">ukuran upload</dt><dd className="font-mono text-foreground">{formatBytes(debugInfo.blobSize)}</dd>
              <dt className="text-muted-foreground">durasi parse</dt><dd className="font-mono text-foreground">{debugInfo.parsedDuration ? `${debugInfo.parsedDuration}s` : "0s"}</dd>
              <dt className="text-muted-foreground">canPlayType</dt><dd className="break-all text-foreground">{debugInfo.canPlayType}</dd>
              <dt className="text-muted-foreground">conversion</dt><dd className="break-all text-foreground">{debugInfo.conversion}</dd>
              <dt className="text-muted-foreground">media error</dt><dd className="break-all text-foreground">{debugInfo.mediaError}</dd>
            </dl>
          </section>
        )}

        {/* Metadata */}
        <div className="mt-8 space-y-4">
          <div>
            <label className="block text-xs text-muted-foreground mb-1.5">title *</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="a soft note to..."
              maxLength={80}
            />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1.5">
              for whom (optional)
            </label>
            <Input
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder="someone, no one, you"
              maxLength={60}
            />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1.5">
              short message (optional)
            </label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="a line of context..."
              maxLength={200}
              rows={2}
            />
            <p className="mt-1 text-[10px] text-muted-foreground text-right">
              {message.length}/200
            </p>
          </div>
        </div>

        {createMut.isPending && saveProgress !== null && (
          <div className="mt-6 space-y-2">
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>
                {saveProgress < 100
                  ? `uploading audio to storage... ${saveProgress}%`
                  : "finalizing..."}
              </span>
              <span className="font-mono tabular-nums">{saveProgress}%</span>
            </div>
            <Progress value={saveProgress} className="h-2" />
          </div>
        )}

        <div className="mt-8 flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="text-xs text-muted-foreground hover:text-foreground"
            disabled={createMut.isPending}
          >
            cancel
          </button>
          <Button
            onClick={handleSave}
            disabled={!audioUsable || createMut.isPending}
          >
            {createMut.isPending
              ? saveProgress !== null && saveProgress < 100
                ? `uploading ${saveProgress}%`
                : "saving..."
              : "save whisper"}
          </Button>
        </div>
      </main>
    </div>
  );
};

export default CreateWhisper;

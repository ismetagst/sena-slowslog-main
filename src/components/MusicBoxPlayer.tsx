import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import type { WhisperNote } from "@/hooks/useWhisper";
import { toast } from "sonner";

interface MusicBoxPlayerProps {
  note: WhisperNote | null;
  onClose: () => void;
}

const formatTime = (s: number) => {
  if (!isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${r.toString().padStart(2, "0")}`;
};

const getMediaErrorMessage = (audio: HTMLAudioElement) => {
  if (audio.error?.code === MediaError.MEDIA_ERR_NETWORK) return "network error saat memuat audio";
  if (audio.error?.code === MediaError.MEDIA_ERR_DECODE) return "browser tidak bisa decode audio ini";
  if (audio.error?.code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED) return "format audio tidak didukung browser";
  return audio.error?.message || "audio belum bisa diputar";
};

const HANDLE_CENTER = { x: 210, y: 110 };

const MusicBoxPlayer = ({ note, onClose }: MusicBoxPlayerProps) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const draggingRef = useRef(false);
  const lastAngleRef = useRef<number | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0); // 0..1
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playError, setPlayError] = useState<string | null>(null);
  // Continuous handle rotation in degrees (accumulates while playing/dragging)
  const [handleRotation, setHandleRotation] = useState(0);
  const playStartRef = useRef<{ at: number; rotationAt: number } | null>(null);

  useEffect(() => {
    if (!note) {
      setIsPlaying(false);
      setProgress(0);
      setCurrent(0);
      setDuration(0);
      setPlayError(null);
      setHandleRotation(0);
      return;
    }
    audioRef.current?.pause();
    const a = new Audio(note.audio_url);
    audioRef.current = a;
    a.preload = "auto";
    setIsPlaying(false);
    setProgress(0);
    setCurrent(0);
    setDuration(note.duration_seconds || 0);
    setPlayError(null);
    setHandleRotation(0);

    const onTime = () => {
      setCurrent(a.currentTime);
      const safeDuration = Number.isFinite(a.duration) && a.duration > 0 ? a.duration : note.duration_seconds || 0;
      setProgress(safeDuration ? Math.min(1, a.currentTime / safeDuration) : 0);
      // Drive handle rotation from playback time (180°/sec) when not dragging
      if (!draggingRef.current) {
        setHandleRotation(a.currentTime * 180);
      }
    };
    const onMeta = () => setDuration(Number.isFinite(a.duration) && a.duration > 0 ? a.duration : note.duration_seconds || 0);
    const onEnd = () => {
      setIsPlaying(false);
      setProgress(0);
      setCurrent(0);
    };
    const onError = () => {
      setIsPlaying(false);
      const message = getMediaErrorMessage(a);
      setPlayError(message);
      toast.error(message);
    };

    a.addEventListener("timeupdate", onTime);
    a.addEventListener("loadedmetadata", onMeta);
    a.addEventListener("ended", onEnd);
    a.addEventListener("error", onError);
    a.load();

    return () => {
      a.pause();
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("loadedmetadata", onMeta);
      a.removeEventListener("ended", onEnd);
      a.removeEventListener("error", onError);
      audioRef.current = null;
      playStartRef.current = null;
    };
  }, [note]);

  const togglePlay = () => {
    const a = audioRef.current;
    if (!a) return;
    if (isPlaying) {
      a.pause();
      setIsPlaying(false);
    } else {
      setPlayError(null);
      a.play()
        .then(() => setIsPlaying(true))
        .catch(() => {
          setIsPlaying(false);
          const message = getMediaErrorMessage(a);
          setPlayError(message);
          toast.error(message);
        });
    }
  };

  // ---- Crank handle drag-to-seek ----
  const getAngleFromEvent = (clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    // SVG viewBox is 240x180; map client coords to viewBox space
    const vbX = ((clientX - rect.left) / rect.width) * 240;
    const vbY = ((clientY - rect.top) / rect.height) * 180;
    const dx = vbX - HANDLE_CENTER.x;
    const dy = vbY - HANDLE_CENTER.y;
    return (Math.atan2(dy, dx) * 180) / Math.PI;
  };

  const onHandlePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    if (!audioRef.current || duration <= 0) return;
    draggingRef.current = true;
    lastAngleRef.current = getAngleFromEvent(e.clientX, e.clientY);
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  };

  const onHandlePointerMove = (e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    const angle = getAngleFromEvent(e.clientX, e.clientY);
    if (angle === null || lastAngleRef.current === null) return;
    let delta = angle - lastAngleRef.current;
    // Normalize to (-180, 180]
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;
    lastAngleRef.current = angle;
    setHandleRotation((prev) => {
      const next = prev + delta;
      const a = audioRef.current;
      if (a && duration > 0) {
        // 180°/sec mapping; clamp to [0, duration]
        const targetTime = Math.max(0, Math.min(duration, next / 180));
        a.currentTime = targetTime;
        setCurrent(targetTime);
        setProgress(targetTime / duration);
      }
      return next;
    });
  };

  const onHandlePointerUp = (e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    lastAngleRef.current = null;
    try {
      (e.currentTarget as Element).releasePointerCapture(e.pointerId);
    } catch {}
  };

  return (
    <Dialog open={!!note} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md bg-[hsl(36,30%,96%)] border-foreground/20">
        <DialogTitle className="sr-only">Whisper player</DialogTitle>
        <DialogDescription className="sr-only">Listen to whisper note</DialogDescription>

        {note && (
          <div className="flex flex-col items-center pt-4 pb-2">
            <p className="font-serif text-base text-foreground text-center mb-1">
              {note.title || "Untitled whisper"}
            </p>
            {note.recipient_name && (
              <p className="text-xs text-muted-foreground italic mb-4">
                for {note.recipient_name}
              </p>
            )}

            <svg
              ref={svgRef}
              width="240"
              height="180"
              viewBox="0 0 240 180"
              fill="none"
              className="text-foreground select-none touch-none"
            >
              {/* Box body */}
              <path
                d="M30 70 Q28 68 32 66 L208 64 Q212 66 210 70 L212 150 Q210 154 206 152 L34 154 Q30 152 32 148 Z"
                stroke="currentColor"
                strokeWidth="1.5"
                fill="hsl(36,30%,92%)"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Lid */}
              <path
                d="M30 70 Q60 50 120 48 Q180 50 210 70"
                stroke="currentColor"
                strokeWidth="1.5"
                fill="hsl(36,30%,88%)"
                strokeLinecap="round"
              />
              <path
                d="M50 60 Q90 52 150 53"
                stroke="currentColor"
                strokeWidth="0.8"
                strokeDasharray="2 3"
                fill="none"
                opacity="0.5"
              />

              {/* Cylinder (rotates with handle) */}
              <g style={{ transformOrigin: "120px 110px", transform: `rotate(${handleRotation}deg)`, transition: isPlaying || draggingRef.current ? "none" : "transform 0.25s" }}>
                <circle cx="120" cy="110" r="22" stroke="currentColor" strokeWidth="1.2" fill="hsl(36,25%,82%)" />
                <circle cx="120" cy="110" r="2" fill="currentColor" />
                {[0, 60, 120, 180, 240, 300].map((deg) => (
                  <circle
                    key={deg}
                    cx={120 + Math.cos((deg * Math.PI) / 180) * 16}
                    cy={110 + Math.sin((deg * Math.PI) / 180) * 16}
                    r="1.2"
                    fill="currentColor"
                  />
                ))}
              </g>

              {/* Comb */}
              <g stroke="currentColor" strokeWidth="1" opacity="0.7">
                <line x1="60" y1="105" x2="92" y2="105" />
                <line x1="60" y1="110" x2="92" y2="110" />
                <line x1="60" y1="115" x2="92" y2="115" />
              </g>

              {/* Play/pause hit-area on the box */}
              <rect
                x="30"
                y="64"
                width="180"
                height="90"
                fill="transparent"
                style={{ cursor: "pointer" }}
                onClick={togglePlay}
              />

              {/* Crank handle — draggable */}
              <g
                onPointerDown={onHandlePointerDown}
                onPointerMove={onHandlePointerMove}
                onPointerUp={onHandlePointerUp}
                onPointerCancel={onHandlePointerUp}
                style={{
                  transformOrigin: `${HANDLE_CENTER.x}px ${HANDLE_CENTER.y}px`,
                  transform: `rotate(${handleRotation}deg)`,
                  transition: isPlaying || draggingRef.current ? "none" : "transform 0.25s",
                  cursor: "grab",
                  touchAction: "none",
                }}
              >
                {/* Wider transparent hit area for easy grabbing */}
                <circle cx={HANDLE_CENTER.x + 18} cy={HANDLE_CENTER.y} r="14" fill="transparent" />
                <line
                  x1={HANDLE_CENTER.x}
                  y1={HANDLE_CENTER.y}
                  x2={HANDLE_CENTER.x + 16}
                  y2={HANDLE_CENTER.y}
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
                <circle
                  cx={HANDLE_CENTER.x + 18}
                  cy={HANDLE_CENTER.y}
                  r="5"
                  fill="hsl(36,25%,82%)"
                  stroke="currentColor"
                  strokeWidth="1.2"
                />
              </g>
              <circle cx={HANDLE_CENTER.x} cy={HANDLE_CENTER.y} r="3" fill="currentColor" />

              {isPlaying && (
                <g className="text-foreground" opacity="0.6">
                  <text x="150" y="40" fontSize="14" fill="currentColor" className="animate-bounce">♪</text>
                  <text x="80" y="35" fontSize="12" fill="currentColor" style={{ animation: "bounce 1.5s infinite 0.3s" }}>♫</text>
                  <text x="180" y="30" fontSize="10" fill="currentColor" style={{ animation: "bounce 1.7s infinite 0.6s" }}>♪</text>
                </g>
              )}
            </svg>

            <p className="mt-2 text-[11px] text-muted-foreground text-center">
              {playError || (isPlaying ? "♪ playing — tap box to pause · drag handle to seek" : "tap box to play · drag the handle (♪⌒)")}
            </p>

            {/* Progress + time */}
            <div className="w-full mt-5 px-2">
              <div className="h-px bg-border relative">
                <div
                  className="absolute top-0 left-0 h-px bg-foreground transition-all"
                  style={{ width: `${progress * 100}%` }}
                />
              </div>
              <div className="mt-1.5 flex justify-between text-[10px] text-muted-foreground font-mono">
                <span>{formatTime(current)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            {note.short_message && (
              <p className="mt-4 text-xs text-muted-foreground italic text-center font-serif max-w-xs">
                "{note.short_message}"
              </p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default MusicBoxPlayer;

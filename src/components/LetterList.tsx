import { useState, useEffect } from "react";
import { format } from "date-fns";
import { Mail, Lock, Plus, EyeOff, Eye, Trash2 } from "lucide-react";
import {
  useLetterEventStatus,
  useLetters,
  useCreateLetter,
  useUpdateLetterStatus,
  useDeleteLetter,
  type Letter,
  type PaperStyle,
} from "@/hooks/useLetters";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
import { Link } from "react-router-dom";

interface LetterListProps {
  recipientUserId: string;
  isOwnProfile: boolean;
  recipientDisplayName: string;
}

// Refined handmade-paper palette (envelope + letter share tones)
const PAPER_STYLES: {
  value: PaperStyle;
  label: string;
  bg: string;
  border: string;
  envelope: string; // hex/hsl for SVG envelope body
  envelopeShade: string; // shadow tone
  envelopeEdge: string; // edge stroke
  paper: string; // inner letter paper
  paperShade: string;
}[] = [
  { value: "cream",  label: "cream",  bg: "bg-[hsl(38_28%_90%)]", border: "border-[hsl(36_18%_75%)]", envelope: "hsl(38, 28%, 88%)", envelopeShade: "hsl(34, 22%, 78%)", envelopeEdge: "hsl(34, 18%, 70%)", paper: "hsl(40, 35%, 96%)", paperShade: "hsl(36, 20%, 86%)" },
  { value: "blush",  label: "blush",  bg: "bg-[hsl(20_25%_90%)]", border: "border-[hsl(18_18%_76%)]", envelope: "hsl(20, 24%, 88%)", envelopeShade: "hsl(18, 20%, 78%)", envelopeEdge: "hsl(16, 16%, 70%)", paper: "hsl(22, 32%, 96%)", paperShade: "hsl(18, 18%, 86%)" },
  { value: "sky",    label: "sky",    bg: "bg-[hsl(210_18%_90%)]", border: "border-[hsl(210_15%_76%)]", envelope: "hsl(210, 18%, 88%)", envelopeShade: "hsl(210, 14%, 78%)", envelopeEdge: "hsl(210, 12%, 70%)", paper: "hsl(210, 25%, 96%)", paperShade: "hsl(210, 14%, 86%)" },
  { value: "sage",   label: "sage",   bg: "bg-[hsl(90_10%_89%)]",  border: "border-[hsl(90_10%_74%)]", envelope: "hsl(90, 10%, 87%)",  envelopeShade: "hsl(90, 8%, 77%)",   envelopeEdge: "hsl(90, 8%, 68%)",   paper: "hsl(90, 18%, 96%)",  paperShade: "hsl(90, 10%, 85%)" },
];

const paperClasses = (style: PaperStyle) => {
  return PAPER_STYLES.find((s) => s.value === style) || PAPER_STYLES[0];
};

// Reusable refined envelope rendered as SVG. Used both for the closed
// thumbnail card and the dialog. `flapOpen` rotates the top flap; `slide`
// shifts the letter paper upward through the flap.
const RefinedEnvelope = ({
  paper,
  flapOpen,
  letterY = 0,
  letterOpacity = 0,
  showSeal = true,
  children,
  size = "md",
}: {
  paper: ReturnType<typeof paperClasses>;
  flapOpen: boolean;
  letterY?: number;
  letterOpacity?: number;
  showSeal?: boolean;
  children?: React.ReactNode;
  size?: "sm" | "md";
}) => {
  // viewBox 200x150 — envelope landscape
  const W = 200, H = 150;
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className={size === "sm" ? "h-full w-full" : "h-full w-full"}
      style={{ overflow: "visible" }}
    >
      <defs>
        {/* paper texture noise */}
        <filter id={`paper-noise-${paper.value}`} x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="3" />
          <feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.06 0" />
          <feComposite in2="SourceGraphic" operator="in" />
        </filter>
        {/* soft drop shadow */}
        <filter id="env-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="2" />
          <feOffset dx="0" dy="2" result="off" />
          <feComponentTransfer><feFuncA type="linear" slope="0.18" /></feComponentTransfer>
          <feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <linearGradient id={`env-grad-${paper.value}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={paper.envelope} />
          <stop offset="100%" stopColor={paper.envelopeShade} />
        </linearGradient>
        {/* clip so paper only shows where envelope back is */}
        <clipPath id={`env-clip-${paper.value}`}>
          <rect x="6" y="20" width={W - 12} height={H - 28} rx="2" />
        </clipPath>
      </defs>

      {/* === Envelope back body (rectangle with subtle deckle edge) === */}
      <g filter="url(#env-shadow)">
        <rect
          x="6" y="20" width={W - 12} height={H - 28} rx="2"
          fill={`url(#env-grad-${paper.value})`}
          stroke={paper.envelopeEdge}
          strokeWidth="0.6"
        />
        {/* subtle deckle/torn edge highlight */}
        <rect
          x="6" y="20" width={W - 12} height={H - 28} rx="2"
          fill="none"
          stroke="white"
          strokeWidth="0.4"
          opacity="0.5"
          transform="translate(0,1)"
        />
      </g>

      {/* === Bottom V flaps (left + right + bottom) — visible behind paper === */}
      <g opacity="0.95">
        {/* left side flap */}
        <path
          d={`M 6 22 L 100 90 L 6 122 Z`}
          fill={paper.envelopeShade}
          stroke={paper.envelopeEdge}
          strokeWidth="0.4"
          opacity="0.7"
        />
        {/* right side flap */}
        <path
          d={`M ${W - 6} 22 L 100 90 L ${W - 6} 122 Z`}
          fill={paper.envelopeShade}
          stroke={paper.envelopeEdge}
          strokeWidth="0.4"
          opacity="0.7"
        />
        {/* bottom flap (front) */}
        <path
          d={`M 6 122 L 100 70 L ${W - 6} 122 L ${W - 6} ${H - 8} Q ${W / 2} ${H - 4} 6 ${H - 8} Z`}
          fill={paper.envelope}
          stroke={paper.envelopeEdge}
          strokeWidth="0.5"
        />
      </g>

      {/* === Letter paper (rises through the flap) === */}
      <g
        clipPath={flapOpen ? undefined : `url(#env-clip-${paper.value})`}
        style={{
          transform: `translateY(${letterY}px)`,
          transition: "transform 1.1s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.6s ease",
          opacity: letterOpacity,
        }}
      >
        <rect
          x="22" y="8" width={W - 44} height="120"
          rx="1"
          fill={paper.paper}
          stroke={paper.paperShade}
          strokeWidth="0.4"
          filter="url(#env-shadow)"
        />
        <rect
          x="22" y="8" width={W - 44} height="120"
          fill="transparent"
          filter={`url(#paper-noise-${paper.value})`}
        />
        {children}
      </g>

      {/* === Top flap (rotates open) === */}
      <g
        style={{
          transformOrigin: `100px 22px`,
          transform: flapOpen ? "rotateX(170deg) translateY(-1px)" : "rotateX(0deg)",
          transition: "transform 0.9s cubic-bezier(0.7, 0, 0.3, 1)",
          transformBox: "fill-box" as any,
          transformStyle: "preserve-3d",
        }}
      >
        <path
          d={`M 6 22 Q ${W / 2} 18 ${W - 6} 22 L 100 90 Z`}
          fill={paper.envelope}
          stroke={paper.envelopeEdge}
          strokeWidth="0.5"
        />
        {/* subtle inner shadow on flap */}
        <path
          d={`M 6 22 Q ${W / 2} 18 ${W - 6} 22 L 100 90 Z`}
          fill="none"
          stroke={paper.envelopeShade}
          strokeWidth="0.8"
          opacity="0.5"
          transform="translate(0, 1)"
        />
      </g>

      {/* === Wax seal (only when sealed) === */}
      {showSeal && (
        <g
          style={{
            opacity: flapOpen ? 0 : 1,
            transition: "opacity 0.3s ease",
          }}
        >
          <circle cx="100" cy="84" r="11" fill="hsl(0, 0%, 25%)" opacity="0.85" />
          <circle cx="100" cy="84" r="11" fill="none" stroke="hsl(0, 0%, 15%)" strokeWidth="0.5" />
          <circle cx="100" cy="84" r="9" fill="none" stroke="white" strokeWidth="0.3" opacity="0.4" />
          <text x="100" y="88" textAnchor="middle" fontSize="9" fontFamily="Georgia, serif" fontStyle="italic" fill="hsl(38, 28%, 92%)">ℒ</text>
        </g>
      )}
    </svg>
  );
};

// ─── Sealed envelope card (closed thumbnail) ──────────────────────────
const EnvelopeCard = ({
  letter,
  onOpen,
}: {
  letter: Letter;
  onOpen: () => void;
}) => {
  const isHidden = letter.status === "hidden_by_recipient";
  const p = paperClasses(letter.paper_style);
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`group relative block w-full transition-all duration-500 hover:-translate-y-1 ${
        isHidden ? "opacity-60" : ""
      }`}
      aria-label="open letter"
    >
      <div className="relative aspect-[4/3] w-full">
        <RefinedEnvelope paper={p} flapOpen={false} showSeal={true} size="sm" />
      </div>
      {isHidden && (
        <div className="absolute right-2 top-1 z-20 rounded bg-background/80 px-1.5 py-0.5 text-[9px] text-muted-foreground">
          hidden
        </div>
      )}
      <div className="mt-1 text-center text-[10px] tracking-[0.25em] text-foreground/40 uppercase font-serif">
        {format(new Date(letter.created_at), "d MMM")}
      </div>
    </button>
  );
};

// ─── Open letter dialog (two-stage manual reveal) ─────────────────────
const LetterReader = ({
  letter,
  onClose,
  isOwnProfile,
  isSender,
  recipientUserId,
}: {
  letter: Letter;
  onClose: () => void;
  isOwnProfile: boolean;
  isSender: boolean;
  recipientUserId: string;
}) => {
  const updateStatus = useUpdateLetterStatus();
  const remove = useDeleteLetter();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [stage, setStage] = useState<"closed" | "opening" | "reading">("closed");
  const p = paperClasses(letter.paper_style);

  const handleEnvelopeClick = () => {
    if (stage === "closed") {
      setStage("opening");
      setTimeout(() => setStage("reading"), 800);
    }
  };

  const flapOpen = stage !== "closed";
  const reading = stage === "reading";

  const ENV_W = 300;
  const ENV_H = 200;
  const FLAP_H = 105;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md p-0 overflow-hidden bg-background border-none shadow-2xl">
        <div className="px-6 pt-5 pb-3 flex items-center justify-between border-b border-border/40">
          <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground font-serif">
            ✉ a letter
          </p>
          <p className="text-[10px] tracking-wider text-muted-foreground font-serif italic">
            {format(new Date(letter.created_at), "d MMMM yyyy")}
          </p>
        </div>

        <div className="relative px-6 py-10 min-h-[480px] flex items-end justify-center bg-gradient-to-b from-background to-muted/30 overflow-hidden">
          <div
            className="relative cursor-pointer select-none"
            style={{ width: ENV_W, height: 400, perspective: "1400px" }}
            onClick={handleEnvelopeClick}
            role="button"
            aria-label={stage === "closed" ? "tap to open envelope" : "letter"}
          >
            {/* LETTER PAPER */}
            <div
              className="absolute left-[6%] right-[6%] overflow-hidden"
              style={{
                bottom: 14,
                height: ENV_H - 30,
                borderRadius: 2,
                backgroundColor: p.paper,
                border: `1px solid ${p.paperShade}`,
                boxShadow: reading
                  ? "0 12px 28px -8px rgba(0,0,0,0.18), 0 2px 4px rgba(0,0,0,0.06)"
                  : "0 1px 2px rgba(0,0,0,0.05)",
                transform: reading
                  ? `translateY(-${ENV_H - 30}px)`
                  : "translateY(0)",
                transition:
                  "transform 1.1s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.6s ease, height 0.6s ease",
                zIndex: reading ? 6 : 2,
              }}
            >
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  backgroundImage: `repeating-linear-gradient(transparent 0, transparent 25px, ${p.paperShade}40 26px)`,
                  opacity: reading ? 1 : 0,
                  transition: "opacity 0.5s ease 0.3s",
                }}
              />
              <div
                className="relative h-full px-5 py-5 flex flex-col"
                style={{
                  opacity: reading ? 1 : 0,
                  transition: "opacity 0.6s ease 0.4s",
                }}
              >
                <div
                  className="text-[10px] tracking-[0.35em] italic mb-3 text-center font-serif"
                  style={{ color: p.envelopeEdge }}
                >
                  ~ a quiet note ~
                </div>
                <p className="font-serif text-[14px] leading-[24px] text-foreground/90 whitespace-pre-line break-words flex-1">
                  {letter.body}
                </p>
                {letter.signature && (
                  <p className="mt-3 text-right font-serif italic text-xs text-foreground/60">
                    — {letter.signature}
                  </p>
                )}
              </div>
            </div>

            {/* ENVELOPE BACK BODY */}
            <div
              className="absolute inset-x-0 bottom-0"
              style={{
                height: ENV_H,
                backgroundColor: p.envelope,
                border: `1px solid ${p.envelopeEdge}`,
                borderRadius: 3,
                boxShadow:
                  "0 8px 20px -6px rgba(0,0,0,0.15), inset 0 0 30px rgba(0,0,0,0.03)",
                zIndex: 1,
              }}
            />

            {/* SIDE FLAP shading */}
            <div
              className="absolute inset-x-0 bottom-0 pointer-events-none"
              style={{
                height: ENV_H,
                background: `linear-gradient(135deg, ${p.envelopeShade} 0%, transparent 50%), linear-gradient(225deg, ${p.envelopeShade} 0%, transparent 50%)`,
                clipPath: `polygon(0 0, 50% 55%, 100% 0, 100% 100%, 0 100%)`,
                opacity: 0.45,
                zIndex: 3,
              }}
            />

            {/* BOTTOM V FLAP (front, covers paper bottom) */}
            <div
              className="absolute inset-x-0 bottom-0 pointer-events-none"
              style={{
                height: ENV_H,
                backgroundColor: p.envelope,
                clipPath: "polygon(0 100%, 50% 35%, 100% 100%)",
                borderBottom: `1px solid ${p.envelopeEdge}`,
                zIndex: 4,
                boxShadow: "inset 0 -2px 4px rgba(0,0,0,0.04)",
              }}
            />
            <svg
              className="absolute inset-x-0 bottom-0 pointer-events-none"
              style={{ height: ENV_H, zIndex: 5 }}
              viewBox={`0 0 ${ENV_W} ${ENV_H}`}
              preserveAspectRatio="none"
            >
              <path
                d={`M 0 ${ENV_H} L ${ENV_W / 2} ${ENV_H * 0.35} L ${ENV_W} ${ENV_H}`}
                fill="none"
                stroke={p.envelopeEdge}
                strokeWidth="0.6"
                opacity="0.6"
              />
            </svg>

            {/* TOP FLAP — rotates open */}
            <div
              className="absolute inset-x-0"
              style={{
                bottom: ENV_H - FLAP_H,
                height: FLAP_H,
                backgroundColor: p.envelope,
                clipPath: "polygon(0 0, 100% 0, 50% 100%)",
                transformOrigin: "50% 0%",
                transform: flapOpen
                  ? "rotateX(180deg) translateY(-1px)"
                  : "rotateX(0deg)",
                transition: "transform 0.9s cubic-bezier(0.65, 0, 0.35, 1)",
                transformStyle: "preserve-3d",
                backfaceVisibility: "visible",
                zIndex: flapOpen ? 2 : 7,
                boxShadow: flapOpen
                  ? "0 4px 8px rgba(0,0,0,0.08)"
                  : "inset 0 6px 10px rgba(0,0,0,0.04)",
                filter: flapOpen ? "brightness(0.97)" : "none",
              }}
            />
            <div
              className="absolute inset-x-0 pointer-events-none"
              style={{
                bottom: ENV_H - 1,
                height: 1,
                background: p.envelopeEdge,
                opacity: 0.4,
                zIndex: 8,
              }}
            />

            {/* WAX SEAL */}
            <div
              className="absolute left-1/2 pointer-events-none"
              style={{
                bottom: ENV_H - FLAP_H + 8,
                opacity: stage === "closed" ? 1 : 0,
                transform: `translateX(-50%) scale(${stage === "closed" ? 1 : 0.6})`,
                transition: "opacity 0.3s ease, transform 0.3s ease",
                zIndex: 9,
              }}
            >
              <div
                className="h-10 w-10 rounded-full flex items-center justify-center"
                style={{
                  background:
                    "radial-gradient(circle at 35% 30%, hsl(0 0% 35%), hsl(0 0% 18%) 70%)",
                  boxShadow:
                    "0 2px 4px rgba(0,0,0,0.25), inset 0 -2px 3px rgba(0,0,0,0.3), inset 0 2px 3px rgba(255,255,255,0.15)",
                  border: "1px solid hsl(0 0% 12%)",
                }}
              >
                <span
                  className="font-serif italic text-sm select-none"
                  style={{ color: p.paper }}
                >
                  ℒ
                </span>
              </div>
            </div>

            {stage === "closed" && (
              <div className="absolute -bottom-2 left-0 right-0 text-center text-[10px] tracking-[0.3em] text-muted-foreground/60 uppercase font-serif animate-pulse">
                tap to open
              </div>
            )}
          </div>
        </div>

        <div
          className={`px-6 py-4 border-t border-border/40 flex items-center justify-between text-[11px] text-muted-foreground transition-opacity duration-500 ${
            reading ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
          style={{ transitionDelay: reading ? "700ms" : "0ms" }}
        >
          {letter.sender ? (
            <Link
              to={`/@${letter.sender.username}`}
              className="hover:text-foreground italic font-serif"
            >
              left by @{letter.sender.username}
            </Link>
          ) : (
            <span className="italic font-serif">left by someone</span>
          )}
          <div className="flex items-center gap-3">
            {isOwnProfile && (
              <button
                onClick={() =>
                  updateStatus.mutate({
                    id: letter.id,
                    status:
                      letter.status === "hidden_by_recipient"
                        ? "active"
                        : "hidden_by_recipient",
                    recipientUserId,
                  })
                }
                className="flex items-center gap-1 hover:text-foreground"
              >
                {letter.status === "hidden_by_recipient" ? (
                  <><Eye className="h-3 w-3" /> show</>
                ) : (
                  <><EyeOff className="h-3 w-3" /> hide</>
                )}
              </button>
            )}
            {(isOwnProfile || isSender) && (
              <button
                onClick={() => setConfirmDelete(true)}
                className="flex items-center gap-1 hover:text-destructive"
              >
                <Trash2 className="h-3 w-3" /> delete
              </button>
            )}
          </div>
        </div>

        <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this letter?</AlertDialogTitle>
              <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>No, keep it</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  remove.mutate(
                    { id: letter.id, recipientUserId },
                    { onSuccess: () => onClose() },
                  );
                }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Yes, delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
};

// ─── Send letter dialog ───────────────────────────────────────────────
const SendLetterDialog = ({
  recipientUserId,
  recipientDisplayName,
  senderUserId,
  maxLength,
  trigger,
}: {
  recipientUserId: string;
  recipientDisplayName: string;
  senderUserId: string;
  maxLength: number;
  trigger: React.ReactNode;
}) => {
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [signature, setSignature] = useState("");
  const [paper, setPaper] = useState<PaperStyle>("cream");
  const create = useCreateLetter();

  const handleSubmit = () => {
    if (!body.trim()) return;
    create.mutate(
      { recipientUserId, senderUserId, body, signature, paper_style: paper },
      {
        onSuccess: () => {
          setOpen(false);
          setBody("");
          setSignature("");
          setPaper("cream");
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif">leave a letter on your profile</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="text-xs text-muted-foreground">message</Label>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value.slice(0, maxLength))}
              placeholder="write something quietly..."
              rows={5}
              className="mt-1.5 resize-none"
            />
            <p className="mt-1 text-right text-[10px] text-muted-foreground">
              {body.length}/{maxLength}
            </p>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">sign as (optional)</Label>
            <Input
              value={signature}
              onChange={(e) => setSignature(e.target.value.slice(0, 30))}
              placeholder="your initials, a flower, or nothing..."
              className="mt-1.5"
              maxLength={30}
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-2 block">paper</Label>
            <div className="grid grid-cols-4 gap-2">
              {PAPER_STYLES.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setPaper(p.value)}
                  className={`h-12 rounded border transition-all ${p.bg} ${p.border} ${
                    paper === p.value
                      ? "ring-2 ring-foreground/40 ring-offset-2 ring-offset-background"
                      : ""
                  }`}
                  aria-label={p.label}
                />
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>cancel</Button>
          <Button onClick={handleSubmit} disabled={!body.trim() || create.isPending}>
            {create.isPending ? "leaving..." : "leave letter"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ─── Status banner ────────────────────────────────────────────────────
const StatusBanner = () => {
  const { data: status } = useLetterEventStatus();
  if (!status) return null;

  if (!status.feature_enabled && !status.is_privileged) {
    return (
      <div className="mb-6 rounded-md border border-border bg-muted/30 px-4 py-3 text-center">
        <Lock className="mx-auto mb-1.5 h-4 w-4 text-muted-foreground" />
        <p className="text-xs text-muted-foreground">letters are resting (◕‿◕｡) — coming soon</p>
      </div>
    );
  }

  if (!status.is_privileged && !status.is_inner_circle) {
    return (
      <div className="mb-6 rounded-md border border-border bg-muted/30 px-4 py-3 text-center">
        <Lock className="mx-auto mb-1.5 h-4 w-4 text-muted-foreground" />
        <p className="text-xs text-muted-foreground">
          letters are an Inner Circle ritual (◕ᴗ◕✿)
        </p>
      </div>
    );
  }

  if (status.window_enabled && !status.window_open) {
    return (
      <div className="mb-6 rounded-md border border-border bg-muted/30 px-4 py-3">
        <p className="text-xs text-muted-foreground">✉ letter window is closed</p>
        {status.window_start && (
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            next opens {format(new Date(status.window_start), "d MMM, HH:mm")}
          </p>
        )}
      </div>
    );
  }

  if (status.window_enabled && status.window_open) {
    return (
      <div className="mb-6 rounded-md border border-border bg-accent/40 px-4 py-3">
        <p className="text-xs font-medium">✉ letter window is open</p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          until {status.window_end ? format(new Date(status.window_end), "d MMM, HH:mm") : "—"}
        </p>
      </div>
    );
  }

  return null;
};

// ─── Main ─────────────────────────────────────────────────────────────
const LetterList = ({ recipientUserId, isOwnProfile, recipientDisplayName }: LetterListProps) => {
  const { user } = useAuth();
  const { data: status } = useLetterEventStatus();
  const { data: letters, isLoading } = useLetters(recipientUserId);
  const [openLetter, setOpenLetter] = useState<Letter | null>(null);

  // Flow: profile OWNER writes letters on their own profile; visitors read them.
  const canSend = !!user && isOwnProfile && !!status?.can_create;
  const maxLen = status?.max_body_length ?? 280;

  if (isLoading) {
    return <p className="py-12 text-center text-sm text-muted-foreground">loading...</p>;
  }

  return (
    <div>
      <StatusBanner />

      {canSend && (
        <div className="mb-4 flex justify-end">
          <SendLetterDialog
            recipientUserId={recipientUserId}
            recipientDisplayName={recipientDisplayName}
            senderUserId={user!.id}
            maxLength={maxLen}
            trigger={
              <Button size="sm" variant="outline">
                <Plus className="h-3.5 w-3.5 mr-1" /> leave a letter
              </Button>
            }
          />
        </div>
      )}

      {!letters?.length ? (
        <div className="py-12 text-center">
          <Mail className="mx-auto mb-2 h-5 w-5 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">no letters yet (｡◕‿◕｡)</p>
          {isOwnProfile && canSend && (
            <p className="mt-1 text-[11px] text-muted-foreground">leave a quiet note for visitors</p>
          )}
        </div>
      ) : (
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3">
          {letters.map((l) => (
            <EnvelopeCard key={l.id} letter={l} onOpen={() => setOpenLetter(l)} />
          ))}
        </div>
      )}

      {openLetter && (
        <LetterReader
          letter={openLetter}
          onClose={() => setOpenLetter(null)}
          isOwnProfile={isOwnProfile}
          isSender={!!user && user.id === openLetter.sender_user_id}
          recipientUserId={recipientUserId}
        />
      )}
    </div>
  );
};

export default LetterList;

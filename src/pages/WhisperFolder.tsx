import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { ArrowLeft, Music, Clock, Plus, Globe, Link2, EyeOff, Share2, Trash2, Lock, Settings as SettingsIcon } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import MusicBoxPlayer from "@/components/MusicBoxPlayer";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useAuth } from "@/hooks/useAuth";
import {
  useWhisperFolder,
  useFolderNotes,
  useDeleteFolder,
  useUpdateFolder,
  useWhisperEventStatus,
  type WhisperNote,
  type WhisperVisibility,
} from "@/hooks/useWhisper";
import { useDeleteWhisper } from "@/hooks/useCreateWhisper";
import { toast } from "sonner";

const formatDuration = (s: number) => {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
};

const visibilityMeta = (v: WhisperVisibility) => {
  if (v === "public") return { icon: Globe, label: "public" };
  if (v === "link_only") return { icon: Link2, label: "link only" };
  return { icon: EyeOff, label: "private" };
};

const NoteRow = ({
  note,
  onPlay,
  canDelete,
}: {
  note: WhisperNote;
  onPlay: (n: WhisperNote) => void;
  canDelete: boolean;
}) => {
  const del = useDeleteWhisper();
  return (
    <div className="group flex items-start gap-3 py-3">
      <button
        onClick={() => onPlay(note)}
        className="flex flex-1 items-start gap-3 text-left hover:bg-muted/30 transition-colors px-2 -mx-2 rounded-md py-1"
      >
        <div className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-border bg-muted/40 group-hover:border-foreground/40">
          <Music className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-serif text-sm text-foreground truncate">
            {note.title || "Untitled whisper"}
          </p>
          {note.recipient_name && (
            <p className="text-[11px] text-muted-foreground">for {note.recipient_name}</p>
          )}
          {note.short_message && (
            <p className="mt-1 text-xs text-muted-foreground italic line-clamp-2">"{note.short_message}"</p>
          )}
          <div className="mt-1.5 flex items-center gap-3 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" /> {formatDuration(note.duration_seconds)}
            </span>
            <span>{format(new Date(note.created_at), "d MMM yyyy")}</span>
          </div>
        </div>
      </button>
      {canDelete && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-muted-foreground hover:text-destructive">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>delete this whisper?</AlertDialogTitle>
              <AlertDialogDescription>this voice note will be permanently removed.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => del.mutate({ id: note.id, audio_path: note.audio_path })}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
};

const EditFolderDialog = ({ folderId, current }: { folderId: string; current: { title: string; description: string | null; visibility: WhisperVisibility; cover_emoji: string | null } }) => {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(current.title);
  const [description, setDescription] = useState(current.description || "");
  const [visibility, setVisibility] = useState<WhisperVisibility>(current.visibility);
  const [emoji, setEmoji] = useState(current.cover_emoji || "♪");
  const update = useUpdateFolder();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost"><SettingsIcon className="h-3.5 w-3.5" /></Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif">edit folder</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-end gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">cover</Label>
              <Input value={emoji} onChange={(e) => setEmoji(e.target.value.slice(0, 2))} className="w-16 text-center mt-1.5" maxLength={2} />
            </div>
            <div className="flex-1">
              <Label className="text-xs text-muted-foreground">title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={60} className="mt-1.5" />
            </div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={160} rows={2} className="mt-1.5" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-2 block">visibility</Label>
            <RadioGroup value={visibility} onValueChange={(v) => setVisibility(v as WhisperVisibility)} className="space-y-2">
              <label className="flex items-start gap-2 cursor-pointer p-2 rounded border border-border hover:bg-muted/30">
                <RadioGroupItem value="private" className="mt-0.5" />
                <div><p className="text-xs font-medium flex items-center gap-1.5"><EyeOff className="h-3 w-3" /> private</p></div>
              </label>
              <label className="flex items-start gap-2 cursor-pointer p-2 rounded border border-border hover:bg-muted/30">
                <RadioGroupItem value="link_only" className="mt-0.5" />
                <div><p className="text-xs font-medium flex items-center gap-1.5"><Link2 className="h-3 w-3" /> link only</p></div>
              </label>
              <label className="flex items-start gap-2 cursor-pointer p-2 rounded border border-border hover:bg-muted/30">
                <RadioGroupItem value="public" className="mt-0.5" />
                <div><p className="text-xs font-medium flex items-center gap-1.5"><Globe className="h-3 w-3" /> public</p></div>
              </label>
            </RadioGroup>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>cancel</Button>
          <Button
            onClick={() =>
              update.mutate(
                { id: folderId, title, description, visibility, cover_emoji: emoji },
                { onSuccess: () => setOpen(false) }
              )
            }
            disabled={update.isPending || !title.trim()}
          >
            {update.isPending ? "saving..." : "save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const WhisperFolderPage = () => {
  const { folderId, username: rawUsername } = useParams();
  const username = rawUsername?.startsWith("@") ? rawUsername.slice(1) : rawUsername;
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: folder, isLoading: folderLoading } = useWhisperFolder(folderId);
  const { data: notes, isLoading: notesLoading } = useFolderNotes(folderId);
  const { data: status } = useWhisperEventStatus();
  const deleteFolder = useDeleteFolder();
  const [active, setActive] = useState<WhisperNote | null>(null);

  const isOwner = !!(user && folder && user.id === folder.user_id);

  if (folderLoading) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <p className="text-sm text-muted-foreground">loading...</p>
        </main>
        <Footer />
      </div>
    );
  }

  if (!folder) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <Lock className="mb-2 h-5 w-5 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">folder not found or private</p>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => navigate(-1)}>go back</Button>
        </main>
        <Footer />
      </div>
    );
  }

  const VisIcon = visibilityMeta(folder.visibility).icon;
  const visLabel = visibilityMeta(folder.visibility).label;

  const handleShare = async () => {
    const url = `${window.location.origin}/@${username}/whisper/${folder.id}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("link copied to clipboard");
    } catch {
      toast.error("could not copy link");
    }
  };

  const canCreateInside = isOwner;
  const windowOpen = !!status?.can_create;

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <section className="mx-auto max-w-2xl px-6 py-10">
          <Link
            to={`/@${username}`}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3 w-3" /> back to profile
          </Link>

          <div className="mt-6 flex items-start gap-4">
            <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-md border border-border bg-muted/30 text-2xl">
              {folder.cover_emoji || "♪"}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="font-serif text-xl text-foreground">{folder.title}</h1>
              {folder.description && (
                <p className="mt-1 text-sm text-muted-foreground">{folder.description}</p>
              )}
              <div className="mt-2 flex items-center gap-3 text-[11px] text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <VisIcon className="h-3 w-3" /> {visLabel}
                </span>
                <span>·</span>
                <span>{notes?.length ?? 0} note{(notes?.length ?? 0) === 1 ? "" : "s"}</span>
                <span>·</span>
                <span>{format(new Date(folder.created_at), "d MMM yyyy")}</span>
              </div>
            </div>
            {isOwner && (
              <div className="flex items-center gap-1">
                <EditFolderDialog
                  folderId={folder.id}
                  current={{ title: folder.title, description: folder.description, visibility: folder.visibility, cover_emoji: folder.cover_emoji }}
                />
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>delete this folder?</AlertDialogTitle>
                      <AlertDialogDescription>
                        all whispers inside will be permanently removed. this cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() =>
                          deleteFolder.mutate(folder, { onSuccess: () => navigate(`/@${username}`) })
                        }
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        delete folder
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}
          </div>

          <div className="mt-6 flex items-center justify-between gap-2">
            {(folder.visibility === "public" || folder.visibility === "link_only") && (
              <button
                onClick={handleShare}
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                <Share2 className="h-3.5 w-3.5" /> copy share link
              </button>
            )}
            {canCreateInside && (
              <Button
                asChild={windowOpen}
                size="sm"
                variant="outline"
                className="ml-auto"
                disabled={!windowOpen}
                title={windowOpen ? "" : "whisper window is closed"}
              >
                {windowOpen ? (
                  <Link to={`/whisper/new?folder=${folder.id}`}>
                    <Plus className="h-3.5 w-3.5 mr-1" /> add whisper
                  </Link>
                ) : (
                  <span className="inline-flex items-center">
                    <Lock className="h-3.5 w-3.5 mr-1" /> window closed
                  </span>
                )}
              </Button>
            )}
          </div>

          <div className="mt-4 divide-y divide-border">
            {notesLoading ? (
              <p className="py-12 text-center text-sm text-muted-foreground">loading...</p>
            ) : !notes?.length ? (
              <div className="py-12 text-center">
                <Music className="mx-auto mb-2 h-5 w-5 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">no whispers in this folder yet (♪⌒)</p>
                {canCreateInside && windowOpen && (
                  <Button asChild size="sm" variant="outline" className="mt-4">
                    <Link to={`/whisper/new?folder=${folder.id}`}>
                      <Plus className="h-3.5 w-3.5 mr-1" /> record your first whisper
                    </Link>
                  </Button>
                )}
              </div>
            ) : (
              notes.map((n) => (
                <NoteRow key={n.id} note={n} onPlay={setActive} canDelete={isOwner} />
              ))
            )}
          </div>
        </section>
      </main>
      <Footer />
      <MusicBoxPlayer note={active} onClose={() => setActive(null)} />
    </div>
  );
};

export default WhisperFolderPage;

import { useState } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { Music, Lock, Plus, Globe, Link2, EyeOff, Folder } from "lucide-react";
import {
  useWhisperEventStatus,
  useWhisperFolders,
  useCreateFolder,
  type WhisperVisibility,
  type WhisperFolder,
} from "@/hooks/useWhisper";
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
  RadioGroup,
  RadioGroupItem,
} from "@/components/ui/radio-group";

interface WhisperListProps {
  userId: string;
  isOwnProfile: boolean;
  profileUsername: string;
}

const visibilityIcon = (v: WhisperVisibility) => {
  if (v === "public") return <Globe className="h-3 w-3" />;
  if (v === "link_only") return <Link2 className="h-3 w-3" />;
  return <EyeOff className="h-3 w-3" />;
};

const visibilityLabel = (v: WhisperVisibility) => {
  if (v === "public") return "public";
  if (v === "link_only") return "link only";
  return "private";
};

const FolderCard = ({
  folder,
  username,
}: {
  folder: WhisperFolder;
  username: string;
}) => (
  <Link
    to={`/@${username}/whisper/${folder.id}`}
    className="group block rounded-md border border-border bg-muted/20 hover:bg-muted/40 hover:border-foreground/30 transition-colors p-4"
  >
    <div className="flex items-start gap-3">
      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md border border-border bg-background text-base">
        {folder.cover_emoji || "♪"}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-serif text-sm text-foreground truncate group-hover:text-foreground">
          {folder.title || "Untitled folder"}
        </p>
        {folder.description && (
          <p className="mt-0.5 text-[11px] text-muted-foreground line-clamp-1">
            {folder.description}
          </p>
        )}
        <div className="mt-1.5 flex items-center gap-3 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <Music className="h-3 w-3" />
            {folder.note_count ?? 0} note{(folder.note_count ?? 0) === 1 ? "" : "s"}
          </span>
          <span className="flex items-center gap-1">
            {visibilityIcon(folder.visibility)}
            {visibilityLabel(folder.visibility)}
          </span>
          <span>{format(new Date(folder.created_at), "d MMM yyyy")}</span>
        </div>
      </div>
    </div>
  </Link>
);

const CreateFolderDialog = ({ userId }: { userId: string }) => {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<WhisperVisibility>("private");
  const [emoji, setEmoji] = useState("♪");
  const create = useCreateFolder();

  const handleSubmit = () => {
    if (!title.trim()) return;
    create.mutate(
      { userId, title, description, visibility, cover_emoji: emoji },
      {
        onSuccess: () => {
          setOpen(false);
          setTitle("");
          setDescription("");
          setVisibility("private");
          setEmoji("♪");
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Plus className="h-3.5 w-3.5 mr-1" /> new folder
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif">create whisper folder</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-end gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">cover</Label>
              <Input
                value={emoji}
                onChange={(e) => setEmoji(e.target.value.slice(0, 2))}
                className="w-16 text-center text-base mt-1.5"
                maxLength={2}
              />
            </div>
            <div className="flex-1">
              <Label className="text-xs text-muted-foreground">title</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="My Voice from May"
                maxLength={60}
                className="mt-1.5"
              />
            </div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">description (optional)</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="a few words about this collection..."
              maxLength={160}
              rows={2}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-2 block">visibility</Label>
            <RadioGroup
              value={visibility}
              onValueChange={(v) => setVisibility(v as WhisperVisibility)}
              className="space-y-2"
            >
              <label className="flex items-start gap-2 cursor-pointer p-2 rounded border border-border hover:bg-muted/30">
                <RadioGroupItem value="private" className="mt-0.5" />
                <div>
                  <p className="text-xs font-medium flex items-center gap-1.5"><EyeOff className="h-3 w-3" /> private</p>
                  <p className="text-[11px] text-muted-foreground">only you can see this</p>
                </div>
              </label>
              <label className="flex items-start gap-2 cursor-pointer p-2 rounded border border-border hover:bg-muted/30">
                <RadioGroupItem value="link_only" className="mt-0.5" />
                <div>
                  <p className="text-xs font-medium flex items-center gap-1.5"><Link2 className="h-3 w-3" /> link only</p>
                  <p className="text-[11px] text-muted-foreground">anyone with the link can listen</p>
                </div>
              </label>
              <label className="flex items-start gap-2 cursor-pointer p-2 rounded border border-border hover:bg-muted/30">
                <RadioGroupItem value="public" className="mt-0.5" />
                <div>
                  <p className="text-xs font-medium flex items-center gap-1.5"><Globe className="h-3 w-3" /> public</p>
                  <p className="text-[11px] text-muted-foreground">shown on your profile to everyone</p>
                </div>
              </label>
            </RadioGroup>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>cancel</Button>
          <Button onClick={handleSubmit} disabled={!title.trim() || create.isPending}>
            {create.isPending ? "creating..." : "create folder"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const EventWindowBanner = () => {
  const { data: status } = useWhisperEventStatus();
  if (!status) return null;

  if (!status.feature_enabled) {
    return (
      <div className="mb-6 rounded-md border border-border bg-muted/30 px-4 py-3 text-center">
        <Lock className="mx-auto mb-1.5 h-4 w-4 text-muted-foreground" />
        <p className="text-xs text-muted-foreground">
          whisper is resting (◕‿◕｡) — coming soon
        </p>
      </div>
    );
  }

  if (status.window_open) {
    return (
      <div className="mb-6 rounded-md border border-border bg-accent/40 px-4 py-3">
        <p className="text-xs font-medium text-foreground">♪ whisper window is open</p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          until {status.window_end ? format(new Date(status.window_end), "d MMM, HH:mm") : "—"}
          {" · "}
          {status.is_privileged
            ? "unlimited notes"
            : `${status.used_count}/${status.max_notes} used`}
        </p>
      </div>
    );
  }

  return (
    <div className="mb-6 rounded-md border border-border bg-muted/30 px-4 py-3">
      <p className="text-xs text-muted-foreground">♪ whisper window is closed</p>
      {status.window_start && (
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          next opens {format(new Date(status.window_start), "d MMM, HH:mm")}
        </p>
      )}
    </div>
  );
};

const WhisperList = ({ userId, isOwnProfile, profileUsername }: WhisperListProps) => {
  const { data: folders, isLoading } = useWhisperFolders(userId);

  if (isLoading) {
    return <p className="py-12 text-center text-sm text-muted-foreground">loading...</p>;
  }

  return (
    <div>
      {isOwnProfile && <EventWindowBanner />}

      {isOwnProfile && (
        <div className="mb-4 flex justify-end">
          <CreateFolderDialog userId={userId} />
        </div>
      )}

      {!folders?.length ? (
        <div className="py-12 text-center">
          <Folder className="mx-auto mb-2 h-5 w-5 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">no whisper folders yet (♪⌒)</p>
          {isOwnProfile && (
            <p className="mt-1 text-[11px] text-muted-foreground">create one to start collecting voice notes</p>
          )}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {folders.map((f) => (
            <FolderCard key={f.id} folder={f} username={profileUsername} />
          ))}
        </div>
      )}
    </div>
  );
};

export default WhisperList;

import { useParams, useNavigate, Link } from "react-router-dom";
import { useState } from "react";
import Header from "@/components/Header";
import RoleBadge from "@/components/RoleBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { useStory, useStoryAuthor, useDeleteStory, useTogglePin, useToggleVisibility, useToggleHidden } from "@/hooks/useStories";
import { useAuth } from "@/hooks/useAuth";
import { useBookmarks, useToggleBookmark } from "@/hooks/useBookmarks";
import { useRecordView } from "@/hooks/useRecordView";
import { useInnerCircleEnabled } from "@/hooks/useInnerCircle";
import { ArrowLeft, Bookmark, BookmarkCheck, MoreHorizontal, Eye, EyeOff, Minus, Plus, Sun, Moon, Pencil, Pin, Trash2, Globe, BadgeCheck, Lock } from "lucide-react";
import highfiveDefault from "@/assets/highfive-default.png";
import highfiveActive from "@/assets/highfive-active.png";
import VerifiedBadge from "@/components/VerifiedBadge";
import { useHighFiveCount, useHasHighFived, useToggleHighFive } from "@/hooks/useHighFives";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { format } from "date-fns";
import { toast } from "sonner";
import { editorSpacingClassesImportant } from "@/lib/editor-content-classes";
import { sanitizeStoryHtml } from "@/lib/sanitize-html";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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

const StoryDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: story, isLoading, isFetching } = useStory(id);
  const { data: author } = useStoryAuthor(story?.user_id);
  const { user, roles } = useAuth();
  const deleteMutation = useDeleteStory();
  const pinMutation = useTogglePin();
  const visibilityMutation = useToggleVisibility();
  const hiddenMutation = useToggleHidden();
  const { data: bookmarks } = useBookmarks();
  const bookmarkMutation = useToggleBookmark();
  const { data: highFiveCount } = useHighFiveCount(id);
  const { data: hasHighFived } = useHasHighFived(id);
  const highFiveMutation = useToggleHighFive();
  const { data: isInnerCircleEnabled } = useInnerCircleEnabled();
  const [fontSize, setFontSize] = useState(18);
  const [darkReading, setDarkReading] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const showIdentityBadges = !!user;

  useRecordView(id);

  const isBookmarked = bookmarks?.includes(id || "") ?? false;

  if (isLoading && !story) {
    return (
      <div className="flex min-h-screen flex-col bg-background text-foreground">
        <Header />
        <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-8">
          <div className="mt-10 space-y-4">
            <Skeleton className="h-9 w-3/4" />
            <Skeleton className="h-6 w-1/2" />
            <div className="flex gap-2 pt-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-16" />
            </div>
            <div className="my-8 h-px w-12 bg-border" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/6" />
          </div>
        </main>
      </div>
    );
  }
  if (!story) return <div className="flex min-h-screen items-center justify-center"><p className="text-sm text-muted-foreground">story not found (╥﹏╥)</p></div>;
  const resolvedAuthor = author ?? story.author;

  const isOwner = user?.id === story.user_id;
  const hasInnerCircleRole = roles.includes("inner_circle");
  const isInnerCircleStory = story.visibility === "inner_circle";
  const isContentLocked = isInnerCircleStory && !isOwner && !hasInnerCircleRole;
  const date = story.published_at ? format(new Date(story.published_at), "MMM d, yyyy") : "";

  const handleDelete = async () => {
    await deleteMutation.mutateAsync(story.id);
    toast.success("moved to trash (T_T)");
    navigate("/");
  };

  const handlePin = async () => {
    await pinMutation.mutateAsync({ id: story.id, pinned: !story.is_pinned });
    toast.success(story.is_pinned ? "unpinned" : "pinned (◕‿◕)");
  };

  const handleToggleVisibility = async () => {
    const newVis = story.visibility === "public" ? "inner_circle" : "public";
    await visibilityMutation.mutateAsync({ id: story.id, visibility: newVis });
    toast.success(newVis === "inner_circle" ? "set to Inner Circle only (★‿★)" : "set to public (◕‿◕)");
  };

  const handleToggleHidden = async () => {
    await hiddenMutation.mutateAsync({ id: story.id, is_hidden: !story.is_hidden });
    toast.success(story.is_hidden ? "story is now visible" : "story is now hidden");
  };

  return (
    <div className={darkReading ? "dark" : ""}>
      <div className="flex min-h-screen flex-col bg-background text-foreground">
        <Header />
        <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-8">
          <div className="flex items-center justify-between">
            <button onClick={() => navigate(-1)} className="text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="inline h-4 w-4" /> back
            </button>
            <div className="flex items-center gap-2">
              {user && (
                <button
                  onClick={() => bookmarkMutation.mutate({ storyId: story.id, bookmarked: isBookmarked })}
                  className="h-8 w-8 rounded text-muted-foreground hover:text-foreground flex items-center justify-center"
                  title={isBookmarked ? "Remove bookmark" : "Bookmark"}
                >
                  {isBookmarked ? <BookmarkCheck className="h-4 w-4 text-foreground" /> : <Bookmark className="h-4 w-4" />}
                </button>
              )}
              {isOwner && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="h-8 w-8 rounded text-muted-foreground hover:text-foreground flex items-center justify-center">
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem onClick={() => navigate(`/write?edit=${story.id}&from=/story/${story.id}`)} className="gap-2 cursor-pointer">
                      <Pencil className="h-4 w-4" /> Edit article
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handlePin} className="gap-2 cursor-pointer">
                      <Pin className="h-4 w-4" /> {story.is_pinned ? "Unpin from profile" : "Pin to profile"}
                    </DropdownMenuItem>
                    {hasInnerCircleRole && (
                      <DropdownMenuItem onClick={handleToggleVisibility} className="gap-2 cursor-pointer">
                        {story.visibility === "inner_circle" ? (
                          <><Globe className="h-4 w-4" /> <span>Make Public</span></>
                        ) : (
                          <><BadgeCheck className="h-4 w-4 text-[hsl(45,90%,50%)]" /> <span className="text-[hsl(45,90%,50%)]">Only My Circle</span></>
                        )}
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={handleToggleHidden} className="gap-2 cursor-pointer">
                      {story.is_hidden ? (
                        <><Eye className="h-4 w-4" /> Show Blog</>
                      ) : (
                        <><EyeOff className="h-4 w-4" /> Hide Blog</>
                      )}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setShowDeleteDialog(true)} className="gap-2 cursor-pointer text-destructive">
                      <Trash2 className="h-4 w-4" /> Delete story
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              <Popover>
                <PopoverTrigger asChild>
                  <button className="text-xs text-muted-foreground hover:text-foreground">
                    <Eye className="inline h-3.5 w-3.5" /> reading mode
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-52" align="end">
                  <div className="space-y-4">
                    <div>
                      <p className="mb-2 text-[10px] uppercase tracking-widest text-muted-foreground">size</p>
                      <div className="flex items-center justify-between">
                        <button onClick={() => setFontSize((s) => Math.max(14, s - 2))} className="h-7 w-7 rounded border border-border text-xs hover:bg-muted flex items-center justify-center">
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="text-xs">{fontSize}px</span>
                        <button onClick={() => setFontSize((s) => Math.min(28, s + 2))} className="h-7 w-7 rounded border border-border text-xs hover:bg-muted flex items-center justify-center">
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                    <div>
                      <p className="mb-2 text-[10px] uppercase tracking-widest text-muted-foreground">theme</p>
                      <div className="flex gap-2">
                        <button onClick={() => setDarkReading(false)} className={`flex-1 rounded-md px-3 py-1.5 text-xs ${!darkReading ? "bg-foreground text-background" : "bg-muted text-muted-foreground"}`}>
                          <Sun className="inline h-3 w-3" /> light
                        </button>
                        <button onClick={() => setDarkReading(true)} className={`flex-1 rounded-md px-3 py-1.5 text-xs ${darkReading ? "bg-foreground text-background" : "bg-muted text-muted-foreground"}`}>
                          <Moon className="inline h-3 w-3" /> dark
                        </button>
                      </div>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <article className="mt-10">
            {isInnerCircleStory && (
              <div className="mb-4">
                {isInnerCircleEnabled ? (
                  <Link
                    to="/inner-circle"
                    className="inline-flex items-center gap-1.5 rounded-full border border-[hsl(45,90%,50%)]/30 bg-[hsl(45,90%,50%)]/5 px-3 py-1 text-xs font-medium text-[hsl(45,90%,50%)] transition-colors hover:bg-[hsl(45,90%,50%)]/10"
                  >
                    <BadgeCheck className="h-3.5 w-3.5" /> Inner Circle only
                  </Link>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-[hsl(45,90%,50%)]/30 bg-[hsl(45,90%,50%)]/5 px-3 py-1 text-xs font-medium text-[hsl(45,90%,50%)] cursor-default">
                    <BadgeCheck className="h-3.5 w-3.5" /> Inner Circle only
                  </span>
                )}
              </div>
            )}
            <h1 className="font-serif text-3xl font-medium tracking-tight">{story.title}</h1>
            {story.subtitle && <p className="mt-3 text-xl leading-relaxed text-muted-foreground">{story.subtitle}</p>}

            <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
              {resolvedAuthor ? (
                <>
                  <Link to={`/@${resolvedAuthor.username}`} className="text-foreground/70 hover:text-foreground transition-colors">{resolvedAuthor.display_name}</Link>
                  {showIdentityBadges && <RoleBadge role={resolvedAuthor.role} />}
                  <span>·</span>
                </>
              ) : (
                <>
                  <Skeleton className="h-3 w-20" />
                  <span>·</span>
                </>
              )}
              <span>{date}</span>
              <span>·</span>
              <span><Eye className="inline h-3 w-3" /> {story.views}</span>
            </div>

            <div className="my-8 h-px w-12 bg-border" />

            {isContentLocked ? (
              <div className="relative">
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <VerifiedBadge size="md" className="mb-3" />
                  <p className="font-serif text-lg font-medium">Inner Circle Only</p>
                  <p className="mt-1 text-sm text-muted-foreground max-w-xs">
                    This story is exclusive to Inner Circle members. Join to read the full content.
                  </p>
                  {isInnerCircleEnabled ? (
                    <Link
                      to="/inner-circle"
                      className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-[hsl(45,90%,50%)] px-4 py-2 text-xs font-medium text-[hsl(45,90%,50%)] transition-colors hover:bg-[hsl(45,90%,50%)]/10"
                    >
                      <Lock className="h-3 w-3" /> Join Inner Circle
                    </Link>
                  ) : (
                    <span className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-muted px-4 py-2 text-xs font-medium text-muted-foreground cursor-not-allowed opacity-50">
                      <Lock className="h-3 w-3" /> Currently Unavailable
                    </span>
                  )}
                </div>
              </div>
            ) : !story.content && isFetching ? (
              <div className="space-y-4" style={{ fontSize: `${fontSize}px` }}>
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-11/12" />
                <Skeleton className="h-4 w-4/6" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            ) : (
              <div
                className={`story-content prose prose-neutral max-w-none leading-relaxed text-muted-foreground [&_*]:!bg-transparent [&_*:not(blockquote):not(blockquote_*)]:!text-inherit [&_*:not(blockquote):not(blockquote_*)]:!font-[inherit] [&_a]:!text-foreground [&_a]:!underline [&_a]:!underline-offset-2 [&_a]:!decoration-foreground/30 hover:[&_a]:!decoration-foreground/60 ${editorSpacingClassesImportant}`}
                style={{ fontSize: `${fontSize}px` }}
                dangerouslySetInnerHTML={{
                  __html: sanitizeStoryHtml(story.content || ""),
                }}
              />
            )}

            {/* Respectful Greeting */}
            {!isContentLocked && (
            <div className="mt-12 flex items-center gap-3">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => {
                        if (!user) {
                          toast.error("login first to send a respectful greeting (◕‿◕)");
                          return;
                        }
                        highFiveMutation.mutate({ storyId: story.id, hasHighFived: !!hasHighFived });
                      }}
                      className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors ${
                        hasHighFived
                          ? "border-foreground/20 bg-foreground/5 text-foreground"
                          : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/20"
                      }`}
                    >
                      <img src={hasHighFived ? highfiveActive : highfiveDefault} alt="Respectful Greeting" className="h-5 w-auto object-contain dark:invert" />
                      <span>{highFiveCount ?? 0}</span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">Respectful Greeting</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            )}

            {/* Divider */}
            <div className="my-10 h-px w-full bg-border" />

            {/* More from author */}
            {resolvedAuthor && (
              <div className="pb-8">
                <Link
                  to={`/@${resolvedAuthor.username}`}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  More from {resolvedAuthor.display_name} →
                </Link>
              </div>
            )}
          </article>
        </main>

        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this story?</AlertDialogTitle>
              <AlertDialogDescription>
                "{story.title}" will be moved to trash. You can recover it within 24 hours.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>No, keep it</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Yes, delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
};

export default StoryDetail;

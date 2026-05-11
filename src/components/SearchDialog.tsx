import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import { FileText, User } from "lucide-react";

interface SearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SearchDialog = ({ open, onOpenChange }: SearchDialogProps) => {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [stories, setStories] = useState<{ id: string; title: string; subtitle: string | null }[]>([]);
  const [users, setUsers] = useState<{ username: string; display_name: string }[]>([]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setStories([]);
      setUsers([]);
    }
  }, [open]);

  useEffect(() => {
    if (query.length < 2) {
      setStories([]);
      setUsers([]);
      return;
    }

    const timeout = setTimeout(async () => {
      const cleanQuery = query.startsWith("@") ? query.slice(1) : query;
      const term = `%${cleanQuery}%`;

      const [storiesRes, usersRes] = await Promise.all([
        supabase
          .from("stories")
          .select("id, title, subtitle")
          .eq("is_draft", false)
          .or(`title.ilike.${term},subtitle.ilike.${term}`)
          .limit(5),
        supabase
          .from("profiles")
          .select("username, display_name")
          .or(`username.ilike.${term},display_name.ilike.${term}`)
          .limit(5),
      ]);

      setStories(storiesRes.data || []);
      setUsers(usersRes.data || []);
    }, 300);

    return () => clearTimeout(timeout);
  }, [query]);

  const select = (path: string) => {
    onOpenChange(false);
    navigate(path);
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} shouldFilter={false}>
      <CommandInput placeholder="Search stories & users..." value={query} onValueChange={setQuery} />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        {stories.length > 0 && (
          <CommandGroup heading="Stories">
            {stories.map((s) => (
              <CommandItem key={s.id} onSelect={() => select(`/story/${s.id}`)} className="cursor-pointer gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm">{s.title}</p>
                  {s.subtitle && <p className="text-xs text-muted-foreground">{s.subtitle}</p>}
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {users.length > 0 && (
          <CommandGroup heading="Users">
            {users.map((u) => (
              <CommandItem key={u.username} onSelect={() => select(`/@${u.username}`)} className="cursor-pointer gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm">{u.display_name}</p>
                  <p className="text-xs text-muted-foreground">@{u.username}</p>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
};

export default SearchDialog;

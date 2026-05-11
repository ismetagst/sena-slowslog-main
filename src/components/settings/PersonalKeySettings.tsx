import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Key, AlertTriangle, ChevronDown } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";

const PersonalKeySettings = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [saving, setSaving] = useState(false);

  const handleOpenChange = () => {
    setIsOpen(true);
  };

  const handleSave = () => {
    if (!newKey || newKey.length < 10) {
      toast.error("Key must be at least 10 characters");
      return;
    }
    setConfirmOpen(true);
    setConfirmText("");
  };

  const handleConfirmSave = async () => {
    if (confirmText !== "new-personal-key") return;
    setSaving(true);

    const { data, error } = await supabase.functions.invoke("manage-registration", {
      body: { action: "change_key", new_key: newKey },
    });

    setSaving(false);
    if (error || data?.error) {
      toast.error(data?.error || "Failed to change key");
    } else {
      toast.success("Personal Key updated (◕‿◕)");
      setIsOpen(false);
      setConfirmOpen(false);
      setNewKey("");
      setConfirmText("");
    }
  };

  const [collapsed, setCollapsed] = useState(true);

  return (
    <div className="rounded-md border border-border mt-6">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex w-full items-center justify-between p-4"
      >
        <div className="flex items-center gap-2">
          <Key className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-medium">Personal Key</h3>
        </div>
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${collapsed ? "-rotate-90" : ""}`} />
      </button>

      {!collapsed && (
        <div className="px-4 pb-4 space-y-3">
          <div className="rounded-md bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground italic leading-relaxed">
              This key is not just access.<br />
              It's a quiet agreement between you and your words.
            </p>
          </div>

          <button
            onClick={handleOpenChange}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <Key className="h-3 w-3" /> Change Personal Key
          </button>
        </div>
      )}

      {/* Change Key Dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-serif">
              <AlertTriangle className="h-4 w-4 text-yellow-500" /> Change Personal Key
            </DialogTitle>
            <DialogDescription>
              Your previous key will be replaced immediately.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <input
              type="text"
              placeholder="Enter new personal key (min 10 chars)"
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              className="w-full border-b border-border bg-transparent py-2 text-sm font-mono text-foreground placeholder:text-muted-foreground/40 focus:border-foreground focus:outline-none"
            />
            <button
              onClick={handleSave}
              disabled={!newKey || newKey.length < 10}
              className="w-full rounded bg-foreground py-2.5 text-sm font-medium text-background hover:opacity-80 disabled:opacity-40 transition-opacity"
            >
              Save
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif">Confirm Change</AlertDialogTitle>
            <AlertDialogDescription>
              To confirm, type <span className="font-mono font-medium text-foreground">"new-personal-key"</span> in the box below
            </AlertDialogDescription>
          </AlertDialogHeader>
          <input
            type="text"
            placeholder='Type "new-personal-key"'
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            className="w-full border-b border-border bg-transparent py-2 text-sm font-mono text-foreground placeholder:text-muted-foreground/40 focus:border-foreground focus:outline-none"
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmSave}
              disabled={confirmText !== "new-personal-key" || saving}
              className="bg-foreground text-background hover:bg-foreground/80"
            >
              {saving ? "..." : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default PersonalKeySettings;

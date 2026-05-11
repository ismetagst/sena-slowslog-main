import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";

const categories = {
  Happy: [
    "(｡◕‿◕｡)", "(◕‿◕)", "(ﾉ◕ヮ◕)ﾉ*:・ﾟ✧", "(*´▽`*)", "(◠‿◠)", "(✿◠‿◠)",
    "(*≧ω≦)", "✧◝(⁰▿⁰)◜✧", "(ﾉ´ヮ`)ﾉ", "(◕ᴗ◕✿)", "ヽ(>∀<☆)ノ",
    "(●´∀`●)", "(○´∀`○)", "(⌒▽⌒)", "(´｡• ᵕ •｡`)", "(*≧▽≦)",
  ],
  Calm: [
    "(‾◡◝)", "(ᵕ—ᴗ—)", "( ˘ᴗ˘ )", "(◡‿◡)", "(ᴗ_ ᴗ。)", "( ◜‿◝ )",
    "(￣▽￣)", "( ˘ω˘ )", "(─‿─)", "(ᵕᴗᵕ)", "( ◡‿◡ *)",
    "(´• ω •`)", "( ˶ˆᗜˆ˵ )",
  ],
  Sad: [
    "(╥﹏╥)", "(っ˘̩╭╮˘̩)っ", "(;﹏;)", "(T_T)", "(ᗒᗣᗕ)",
    "(T▽T)", "(;_;)", "(╥_╥)", "( ; ω ; )", "(っ╥╯╥c)",
    "(｡•́︿•̀｡)", "(ノ_<。)", "(μ_μ)", "(.﹒︣︿﹒︣.)",
  ],
  Love: [
    "(｡♥‿♥｡)", "(♡μ_μ)", "(◕‿◕)♡", "( ´ ▽ ` ).｡ﾟ♡", "(灬♥ω♥灬)",
    "(♡´▽`♡)", "(◕‿◕)♡", "(*♡∀♡)", "(´,,•ω•,,)♡",
    "(○´∀`○)♡", "(✧ω✧)♡", "( ˘ ³˘)♥",
  ],
  Play: [
    "(づ￣ ³￣)づ", "ヽ(>∀<☆)ノ", "( ˘ ³˘)♥", "(ﾉ´ з `)ノ",
    "ヽ(´ー`)ﾉ", "(ﾉ◕ヮ◕)ﾉ", "┗(^▽^)ノ", "(ノ´ヮ`)ノ",
    "(つ≧▽≦)つ", "ヽ(○´∀`)ﾉ", "(ノ・∀・)ノ",
    "ヽ(^◇^*)/", "o(>ω<)o",
  ],
  Think: [
    "(⊙_⊙)", "(¬‿¬)", "(눈_눈)", "( •̀ᴗ•́ )", "(⌐■_■)",
    "(; ─_─)", "(←_←)", "(→_→)", "( ´_ゝ`)", "(｡-_-｡)",
    "(¬_¬ )", "( ˘_˘ )", "(ㆆ_ㆆ)",
  ],
  Write: [
    "✍(◔◡◔)", "φ(゜▽゜*)", "φ(..)", "✎(ノ_<。)",
    "φ(￣ー￣ )", "φ(．．)", "φ(。。)",
    "✏(◉_◉)", "φ(•ᴗ•)", "✐(ー_ー)",
  ],
} as const;

type Category = keyof typeof categories;

interface KaomojiPickerProps {
  onSelect: (kaomoji: string) => void;
  children: React.ReactNode;
}

const KaomojiPicker = ({ onSelect, children }: KaomojiPickerProps) => {
  const [active, setActive] = useState<Category>("Happy");

  const handleCopy = async (kaomoji: string) => {
    try {
      await navigator.clipboard.writeText(kaomoji);
      toast.success("copied! paste it anywhere (◕‿◕)");
    } catch {
      // Fallback
      onSelect(kaomoji);
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-80 p-4" align="start">
        <div className="mb-3 flex flex-wrap gap-1">
          {(Object.keys(categories) as Category[]).map((cat) => (
            <button
              key={cat}
              onClick={() => setActive(cat)}
              className={`rounded-full px-3 py-1 text-xs transition-colors ${
                active === cat
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-4 gap-1 max-h-48 overflow-y-auto">
          {categories[active].map((k) => (
            <button
              key={k}
              onClick={() => handleCopy(k)}
              className="rounded-lg p-2 text-[10px] transition-colors hover:bg-muted text-center truncate"
              title={`Click to copy: ${k}`}
            >
              {k}
            </button>
          ))}
        </div>
        <p className="mt-2 text-[9px] text-muted-foreground text-center">click to copy, then paste</p>
      </PopoverContent>
    </Popover>
  );
};

export default KaomojiPicker;

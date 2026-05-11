import { Link } from "react-router-dom";
import { useFooterPages } from "@/hooks/useFooterPages";

const Footer = () => {
  const { data: pages } = useFooterPages(true);

  return (
    <footer className="border-t border-border text-center px-0 my-[42px] py-[18px]">
      <p className="font-mono text-xs text-muted-foreground">
        Crafted by{" "}
        <a
          href="https://www.instagram.com/mantra.senarasi/"
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-foreground no-underline"
        >
          Mantra
        </a>
      </p>
      <p className="font-mono text-xs text-muted-foreground mt-2">A work in progress, taking it slow.</p>

      {pages && pages.length > 0 && (
        <nav className="mt-4 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 px-4">
          {pages.map((p, i) => (
            <span key={p.id} className="inline-flex items-center gap-2">
              <Link
                to={`/page/${p.slug}`}
                className="font-mono text-xs font-semibold text-foreground no-underline hover:opacity-70 transition-opacity"
              >
                {p.title}
              </Link>
              {i < pages.length - 1 && (
                <span className="font-mono text-xs text-muted-foreground/50">|</span>
              )}
            </span>
          ))}
        </nav>
      )}
    </footer>
  );
};

export default Footer;

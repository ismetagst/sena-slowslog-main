import { useParams, Navigate } from "react-router-dom";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useFooterPage } from "@/hooks/useFooterPages";
import { Loader2 } from "lucide-react";

const FooterPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const { data: page, isLoading } = useFooterPage(slug || "");

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!page || !page.enabled) {
    return <Navigate to="/404" replace />;
  }

  const isRoadmap = page.slug === "roadmap";

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <article className="mx-auto max-w-2xl px-6 py-16">
          <h1 className="font-serif text-3xl font-bold text-foreground">{page.title}</h1>
          <div className="mt-8 font-serif text-base leading-relaxed text-foreground/90 whitespace-pre-wrap">
            {isRoadmap ? <RoadmapContent content={page.content} /> : page.content}
          </div>
          <p className="mt-12 font-mono text-[10px] text-muted-foreground/60">
            last updated · {new Date(page.updated_at).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })}
          </p>
        </article>
      </main>
      <Footer />
    </div>
  );
};

// Render roadmap with section headings (## Heading) and a small "in progress" indicator
const RoadmapContent = ({ content }: { content: string }) => {
  const blocks = content.split(/\n(?=## )/g);
  return (
    <>
      {blocks.map((block, i) => {
        const headingMatch = block.match(/^## (.+)/);
        if (!headingMatch) {
          return (
            <p key={i} className="whitespace-pre-wrap">{block}</p>
          );
        }
        const heading = headingMatch[1].trim();
        const body = block.replace(/^## .+\n?/, "").trim();
        const isInProgress = /in progress/i.test(heading);
        return (
          <section key={i} className="mt-8 first:mt-0">
            <h2 className="flex items-center gap-2 font-serif text-lg font-bold text-foreground">
              {heading}
              {isInProgress && (
                <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 font-mono text-[10px] font-normal text-muted-foreground">
                  <Loader2 className="h-2.5 w-2.5 animate-spin" />
                  active
                </span>
              )}
            </h2>
            <div className="mt-3 whitespace-pre-wrap text-foreground/90">{body}</div>
          </section>
        );
      })}
    </>
  );
};

export default FooterPage;

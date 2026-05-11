import { Link } from "react-router-dom";

const Landing = () => {
  return (
    <div className="flex min-h-screen flex-col">
      <main className="flex-1">
        <section className="mx-auto max-w-2xl px-6 pt-10 pb-16 md:pt-16 md:pb-24">
          <Link to="/read" className="inline-block mb-10">
            <span className="font-serif tracking-tight text-primary font-medium text-xl">Sena (◕ᴗ◕✿)</span>
          </Link>
          <h1 className="font-serif text-xl font-semibold text-foreground">Only writing.</h1>
          <p className="mt-1 text-base font-mono text-muted-foreground py-[8px]">No rush. No noise.<br />Just words, taking their time.</p>

          <div className="mt-4 flex items-center gap-4 font-serif text-base py-[5px]">
            <Link
              to="/auth"
              className="font-bold text-foreground underline-offset-4 hover:underline hover:italic"
            >
              Start writing
            </Link>
            <span className="text-muted-foreground/40">·</span>
            <Link
              to="/read"
              className="font-bold text-foreground underline-offset-4 hover:underline hover:italic"
            >
              Read
            </Link>
          </div>

          <h2 className="mt-8 font-serif text-lg font-semibold text-foreground">
            A quiet place on the internet, where writing still matters.
          </h2>
          <ul className="mt-3 space-y-0.5 text-base text-muted-foreground font-mono font-thin my-[19px] py-[8px]">
            <li className="font-mono">· No algorithm to chase</li>
            <li className="font-mono">· No pressure to perform</li>
            <li className="font-mono">· No noise to keep up with</li>
            <li className="font-mono">· Just you, and your words</li>
          </ul>

          <p className="mt-6 font-serif text-foreground font-semibold text-base">
            Feeling tired of social media?<br />
            Write here.
          </p>

          <footer className="mt-16 pb-10">
            <p className="font-mono text-xs text-muted-foreground">Crafted by <a href="https://www.instagram.com/mantra.senarasi/" target="_blank" rel="noopener noreferrer" className="font-semibold text-foreground no-underline">Mantra</a></p>
            <p className="font-mono text-xs text-muted-foreground mt-1">A work in progress, taking it slow.</p>
          </footer>
        </section>
      </main>
    </div>
  );
};

export default Landing;

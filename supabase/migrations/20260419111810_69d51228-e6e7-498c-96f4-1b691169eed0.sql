
CREATE TABLE public.footer_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  content text NOT NULL DEFAULT '',
  enabled boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.footer_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enabled footer pages viewable by everyone"
ON public.footer_pages FOR SELECT
TO public
USING (enabled = true OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'founder'::app_role));

CREATE POLICY "Admins can manage footer pages"
ON public.footer_pages FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Founders can manage footer pages"
ON public.footer_pages FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'founder'::app_role))
WITH CHECK (has_role(auth.uid(), 'founder'::app_role));

CREATE TRIGGER trg_footer_pages_updated_at
BEFORE UPDATE ON public.footer_pages
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.footer_pages (slug, title, content, sort_order, enabled) VALUES
('about', 'About', 'Draft. This page is being written. Sena is a quiet space for slow writing and reading. More coming soon.', 1, true),
('privacy', 'Privacy Policy', 'Sena is built around quiet, intentional reading. We collect only what is needed to keep your account working.

What we store:
- Your email address, used only to deliver your personal key and important account messages.
- Your username, display name, bio, and avatar — the parts of your profile you choose to show.
- The stories, drafts, bookmarks, and high fives you create while using Sena.
- Basic activity such as story views and login attempts, used to keep the platform safe and to power simple analytics on your own writing.

What we do not do:
- We do not sell your data.
- We do not run third-party advertising trackers.
- We do not share your private drafts with anyone.

Your content belongs to you. You can request your account or stories to be removed at any time by contacting the team.

This page may evolve as Sena grows. The spirit will not: keep things small, keep things honest.', 2, true),
('terms', 'Terms of Service', 'By using Sena you agree to a few simple things.

1. Be kind. Sena is a slow, quiet place. Harassment, hate speech, spam, and content that harms others are not welcome and may lead to removal.

2. Write your own words. Do not publish content that you do not own or have permission to share.

3. Respect the rhythm. Sena enforces publish cooldowns on purpose — to encourage thought over volume. Attempts to bypass these limits may result in restrictions.

4. Inner Circle. Premium features are offered as-is. Memberships can be revoked for serious violations of these terms.

5. Your account, your responsibility. Keep your personal key safe. We can help recover access, but we cannot read keys we do not store.

6. We may update these terms as Sena grows. Significant changes will be announced inside the app.

If something here is unclear, reach out. We would rather talk than enforce.', 3, true),
('roadmap', 'Roadmap', '## In Progress
- Footer pages and admin editor
- Refining the writing experience
- Smoother onboarding for new writers

## Under Consideration
- Reading lists and collections
- Reply / quiet comment system
- Email digest of stories you follow
- Mobile app shell

## Recently Shipped
- Inner Circle memberships
- Achievement badges
- Global search (Cmd+K)
- Trash and recovery for Inner Circle

This roadmap is a living document. Things move slowly here, on purpose.', 4, true);

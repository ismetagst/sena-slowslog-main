export type Role = "founder" | "admin" | "early_adopter" | "contributor" | "writer" | "inner_circle";

// Priority order: founder > admin > contributor > early_adopter > writer
// (inner_circle is a separate visual badge, not a primary role)
export const ROLE_PRIORITY: Role[] = ["founder", "admin", "contributor", "early_adopter", "writer"];

export const getPrimaryRole = (roles: string[] | null | undefined): Role => {
  const list = (roles || []) as Role[];
  return ROLE_PRIORITY.find((r) => list.includes(r)) || "writer";
};

export const getPrimaryRoleForDisplay = (roles: string[] | null | undefined): Role | undefined => {
  const list = (roles || []) as Role[];
  return ROLE_PRIORITY.find((r) => list.includes(r));
};

export interface Author {
  id: string;
  user_id: string;
  display_name: string;
  username: string;
  avatar_url?: string | null;
  role?: Role;
  bio: string;
}

export interface Story {
  id: string;
  user_id: string;
  title: string;
  subtitle: string | null;
  content: string | null;
  is_draft: boolean;
  is_pinned: boolean;
  is_hidden: boolean;
  visibility: "public" | "inner_circle";
  views: number;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  author?: Author;
}

export const ROLE_LABELS: Record<Role, string> = {
  founder: "Founder",
  admin: "Admin",
  early_adopter: "Early Adopter",
  contributor: "Contributor",
  writer: "Writer",
  inner_circle: "Inner Circle",
};

export const ROLE_KAOMOJI: Record<Role, string> = {
  founder: "(*´▽`*)",
  admin: "(⌐■_■)",
  early_adopter: "(◕‿◕)",
  contributor: "(｡◕‿◕｡)",
  writer: "(￣▽￣)",
  inner_circle: "(★‿★)",
};

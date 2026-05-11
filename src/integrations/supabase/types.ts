export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      achievement_badges: {
        Row: {
          category: string
          check_type: string
          check_value: number | null
          created_at: string
          description: string
          id: string
          image_url: string | null
          is_active: boolean
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          category: string
          check_type?: string
          check_value?: number | null
          created_at?: string
          description?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          check_type?: string
          check_value?: number | null
          created_at?: string
          description?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      bookmarks: {
        Row: {
          created_at: string
          id: string
          story_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          story_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          story_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookmarks_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "stories"
            referencedColumns: ["id"]
          },
        ]
      }
      footer_pages: {
        Row: {
          content: string
          created_at: string
          enabled: boolean
          id: string
          slug: string
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          content?: string
          created_at?: string
          enabled?: boolean
          id?: string
          slug: string
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          enabled?: boolean
          id?: string
          slug?: string
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      forgot_key_requests: {
        Row: {
          created_at: string
          email: string
          id: string
          resolved_at: string | null
          resolved_by: string | null
          status: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
        }
        Relationships: []
      }
      high_fives: {
        Row: {
          created_at: string
          id: string
          story_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          story_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          story_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "high_fives_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "stories"
            referencedColumns: ["id"]
          },
        ]
      }
      ic_memberships: {
        Row: {
          created_at: string
          expires_at: string | null
          granted_by: string | null
          id: string
          plan: string
          starts_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          granted_by?: string | null
          id?: string
          plan: string
          starts_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          granted_by?: string | null
          id?: string
          plan?: string
          starts_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ic_orders: {
        Row: {
          admin_note: string | null
          created_at: string
          discount_amount: number | null
          email: string
          final_price: number | null
          id: string
          plan: string
          status: Database["public"]["Enums"]["ic_order_status"]
          transfer_proof_url: string | null
          updated_at: string
          user_id: string
          voucher_code: string | null
        }
        Insert: {
          admin_note?: string | null
          created_at?: string
          discount_amount?: number | null
          email: string
          final_price?: number | null
          id?: string
          plan: string
          status?: Database["public"]["Enums"]["ic_order_status"]
          transfer_proof_url?: string | null
          updated_at?: string
          user_id: string
          voucher_code?: string | null
        }
        Update: {
          admin_note?: string | null
          created_at?: string
          discount_amount?: number | null
          email?: string
          final_price?: number | null
          id?: string
          plan?: string
          status?: Database["public"]["Enums"]["ic_order_status"]
          transfer_proof_url?: string | null
          updated_at?: string
          user_id?: string
          voucher_code?: string | null
        }
        Relationships: []
      }
      invite_codes: {
        Row: {
          code: string
          created_at: string
          id: string
          is_active: boolean
          max_uses: number | null
          used_count: number
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          max_uses?: number | null
          used_count?: number
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          max_uses?: number | null
          used_count?: number
        }
        Relationships: []
      }
      letters: {
        Row: {
          body: string
          cover_emoji: string | null
          created_at: string
          event_window_start: string | null
          id: string
          paper_style: string
          recipient_user_id: string
          sender_user_id: string
          signature: string | null
          status: string
          updated_at: string
        }
        Insert: {
          body: string
          cover_emoji?: string | null
          created_at?: string
          event_window_start?: string | null
          id?: string
          paper_style?: string
          recipient_user_id: string
          sender_user_id: string
          signature?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          body?: string
          cover_emoji?: string | null
          created_at?: string
          event_window_start?: string | null
          id?: string
          paper_style?: string
          recipient_user_id?: string
          sender_user_id?: string
          signature?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      login_attempts: {
        Row: {
          attempted_at: string
          email: string
          id: string
          ip_address: string | null
        }
        Insert: {
          attempted_at?: string
          email: string
          id?: string
          ip_address?: string | null
        }
        Update: {
          attempted_at?: string
          email?: string
          id?: string
          ip_address?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          badge_id: string | null
          count: number
          created_at: string
          id: string
          milestone_value: number | null
          story_id: string | null
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          badge_id?: string | null
          count?: number
          created_at?: string
          id?: string
          milestone_value?: number | null
          story_id?: string | null
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          badge_id?: string | null
          count?: number
          created_at?: string
          id?: string
          milestone_value?: number | null
          story_id?: string | null
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "achievement_badges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "stories"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_methods: {
        Row: {
          created_at: string
          id: string
          image_url: string | null
          is_active: boolean
          link_url: string | null
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          link_url?: string | null
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          link_url?: string | null
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      personal_key_history: {
        Row: {
          change_type: string
          created_at: string
          generated_by: string | null
          id: string
          user_id: string
        }
        Insert: {
          change_type?: string
          created_at?: string
          generated_by?: string | null
          id?: string
          user_id: string
        }
        Update: {
          change_type?: string
          created_at?: string
          generated_by?: string | null
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          display_name: string
          display_name_changed_at: string | null
          id: string
          is_setup_complete: boolean
          joined_at: string | null
          notifications_last_seen_at: string
          updated_at: string
          user_id: string
          username: string
          username_changed_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name: string
          display_name_changed_at?: string | null
          id?: string
          is_setup_complete?: boolean
          joined_at?: string | null
          notifications_last_seen_at?: string
          updated_at?: string
          user_id: string
          username: string
          username_changed_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string
          display_name_changed_at?: string | null
          id?: string
          is_setup_complete?: boolean
          joined_at?: string | null
          notifications_last_seen_at?: string
          updated_at?: string
          user_id?: string
          username?: string
          username_changed_at?: string | null
        }
        Relationships: []
      }
      site_settings: {
        Row: {
          id: string
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      stories: {
        Row: {
          content: string | null
          created_at: string
          deleted_at: string | null
          id: string
          is_draft: boolean
          is_hidden: boolean
          is_pinned: boolean
          published_at: string | null
          subtitle: string | null
          title: string
          updated_at: string
          user_id: string
          views: number
          visibility: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_draft?: boolean
          is_hidden?: boolean
          is_pinned?: boolean
          published_at?: string | null
          subtitle?: string | null
          title?: string
          updated_at?: string
          user_id: string
          views?: number
          visibility?: string
        }
        Update: {
          content?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_draft?: boolean
          is_hidden?: boolean
          is_pinned?: boolean
          published_at?: string | null
          subtitle?: string | null
          title?: string
          updated_at?: string
          user_id?: string
          views?: number
          visibility?: string
        }
        Relationships: []
      }
      story_views: {
        Row: {
          created_at: string
          device_type: string | null
          id: string
          story_id: string
          viewer_id: string | null
          viewer_ip: string | null
        }
        Insert: {
          created_at?: string
          device_type?: string | null
          id?: string
          story_id: string
          viewer_id?: string | null
          viewer_ip?: string | null
        }
        Update: {
          created_at?: string
          device_type?: string | null
          id?: string
          story_id?: string
          viewer_id?: string | null
          viewer_ip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "story_views_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "stories"
            referencedColumns: ["id"]
          },
        ]
      }
      user_achievements: {
        Row: {
          badge_id: string
          granted_at: string
          granted_by: string | null
          id: string
          user_id: string
        }
        Insert: {
          badge_id: string
          granted_at?: string
          granted_by?: string | null
          id?: string
          user_id: string
        }
        Update: {
          badge_id?: string
          granted_at?: string
          granted_by?: string | null
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_achievements_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "achievement_badges"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vouchers: {
        Row: {
          code: string
          created_at: string
          discount_type: string
          discount_value: number
          id: string
          is_active: boolean
          max_uses: number | null
          updated_at: string
          used_count: number
        }
        Insert: {
          code: string
          created_at?: string
          discount_type?: string
          discount_value?: number
          id?: string
          is_active?: boolean
          max_uses?: number | null
          updated_at?: string
          used_count?: number
        }
        Update: {
          code?: string
          created_at?: string
          discount_type?: string
          discount_value?: number
          id?: string
          is_active?: boolean
          max_uses?: number | null
          updated_at?: string
          used_count?: number
        }
        Relationships: []
      }
      waitlist: {
        Row: {
          auth_user_id: string | null
          created_at: string
          email: string
          id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
        }
        Insert: {
          auth_user_id?: string | null
          created_at?: string
          email: string
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Update: {
          auth_user_id?: string | null
          created_at?: string
          email?: string
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Relationships: []
      }
      waitlist_attempts: {
        Row: {
          created_at: string
          email: string
          id: string
          ip_address: string | null
          success: boolean
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          ip_address?: string | null
          success?: boolean
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          ip_address?: string | null
          success?: boolean
          user_agent?: string | null
        }
        Relationships: []
      }
      whisper_folders: {
        Row: {
          cover_emoji: string | null
          created_at: string
          description: string | null
          event_window_start: string | null
          id: string
          title: string
          updated_at: string
          user_id: string
          visibility: string
        }
        Insert: {
          cover_emoji?: string | null
          created_at?: string
          description?: string | null
          event_window_start?: string | null
          id?: string
          title?: string
          updated_at?: string
          user_id: string
          visibility?: string
        }
        Update: {
          cover_emoji?: string | null
          created_at?: string
          description?: string | null
          event_window_start?: string | null
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
          visibility?: string
        }
        Relationships: []
      }
      whisper_notes: {
        Row: {
          audio_path: string
          audio_url: string
          created_at: string
          duration_seconds: number
          event_window_start: string | null
          expires_at: string | null
          file_size_bytes: number
          folder_id: string | null
          id: string
          recipient_name: string | null
          short_message: string | null
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          audio_path: string
          audio_url: string
          created_at?: string
          duration_seconds?: number
          event_window_start?: string | null
          expires_at?: string | null
          file_size_bytes?: number
          folder_id?: string | null
          id?: string
          recipient_name?: string | null
          short_message?: string | null
          status?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          audio_path?: string
          audio_url?: string
          created_at?: string
          duration_seconds?: number
          event_window_start?: string | null
          expires_at?: string | null
          file_size_bytes?: number
          folder_id?: string | null
          id?: string
          recipient_name?: string | null
          short_message?: string | null
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whisper_notes_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "whisper_folders"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_letter_event_status: { Args: never; Returns: Json }
      get_pending_waitlist_count: { Args: never; Returns: number }
      get_story_content: { Args: { p_story_id: string }; Returns: string }
      get_today_waitlist_count: { Args: never; Returns: number }
      get_whisper_event_status: { Args: never; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_voucher_usage: { Args: { p_code: string }; Returns: undefined }
      mark_notifications_seen: { Args: never; Returns: undefined }
      record_story_view:
        | {
            Args: { p_story_id: string; p_viewer_id: string }
            Returns: undefined
          }
        | {
            Args: {
              p_device_type?: string
              p_story_id: string
              p_viewer_id: string
            }
            Returns: undefined
          }
      use_invite_code: { Args: { p_code: string }; Returns: boolean }
      validate_voucher: { Args: { p_code: string }; Returns: Json }
    }
    Enums: {
      app_role:
        | "founder"
        | "early_adopter"
        | "contributor"
        | "writer"
        | "inner_circle"
        | "admin"
      ic_order_status: "pending" | "approved" | "rejected"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "founder",
        "early_adopter",
        "contributor",
        "writer",
        "inner_circle",
        "admin",
      ],
      ic_order_status: ["pending", "approved", "rejected"],
    },
  },
} as const

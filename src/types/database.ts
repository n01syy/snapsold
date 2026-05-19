/**
 * Hand-written Supabase table types for Snapsold.
 *
 * Regenerate from the live project when the schema changes:
 *   npx supabase gen types typescript --project-id <ref> > src/types/database.ts
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      analyses: {
        Row: {
          id: string;
          user_id: string;
          product_title: string;
          product_id: string | null;
          search_query: string;
          identify_source: "image" | "name" | "barcode";
          recommended_price: number;
          quick_price: number;
          max_price: number;
          sample_size: number;
          confidence: number;
          analysis: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          product_title: string;
          product_id?: string | null;
          search_query: string;
          identify_source: "image" | "name" | "barcode";
          recommended_price: number;
          quick_price: number;
          max_price: number;
          sample_size?: number;
          confidence?: number;
          analysis: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          product_title?: string;
          product_id?: string | null;
          search_query?: string;
          identify_source?: "image" | "name" | "barcode";
          recommended_price?: number;
          quick_price?: number;
          max_price?: number;
          sample_size?: number;
          confidence?: number;
          analysis?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          display_name: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          display_name?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

// Flexible Database type for external Supabase project
// This replaces the auto-generated types which don't reflect the actual schema

export type Database = {
  public: {
    Tables: {
      [key: string]: {
        Row: Record<string, any>;
        Insert: Record<string, any>;
        Update: Record<string, any>;
      };
    };
    Views: {
      [key: string]: {
        Row: Record<string, any>;
      };
    };
    Functions: {
      [key: string]: any;
    };
    Enums: {
      [key: string]: string;
    };
    CompositeTypes: {
      [key: string]: any;
    };
  };
};

// Re-export supabase client with relaxed types for tables not yet in the schema
import { supabase as _supabase } from "@/integrations/supabase/client";

// Cast to any to allow .from() with any table name while DB schema catches up
export const supabase = _supabase as any;

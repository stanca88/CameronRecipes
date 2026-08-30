import { createClient } from "@supabase/supabase-js";

// This is Supabase's publishable ("anon") key format (sb_publishable_...),
// which is safe to ship to the browser — it only grants what the project's
// Row Level Security policies allow. Keep the service-role key out of client code.
const SUPABASE_URL = "https://yveqzlpemdxjgzlxvocs.supabase.co";
const SUPABASE_KEY = "sb_publishable_vPv7fZZUYOKIIwCDJHfCSA_EM9qXM8Z";

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

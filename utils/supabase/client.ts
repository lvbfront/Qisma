import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}

let browserClient: ReturnType<typeof createClient> | undefined;

/**
 * The shared browser client. Call it inside event handlers or effects, never while
 * rendering: creating the client reads the clock, which Next does not allow during prerender.
 */
export const supabaseBrowser = () => (browserClient ??= createClient());

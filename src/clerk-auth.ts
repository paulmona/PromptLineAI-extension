/**
 * Clerk auth for background service worker only.
 * Uses createClerkClient from @clerk/chrome-extension/background.
 * Publishable key and sync host are injected at build time (see scripts/build.mjs).
 */
import { createClerkClient } from "@clerk/chrome-extension/background";
import { CLERK_PUBLISHABLE_KEY, CLERK_SYNC_HOST } from "./env.generated";
import { logger } from "./lib/logger";

const PUBLISHABLE_KEY = CLERK_PUBLISHABLE_KEY;
const SYNC_HOST = CLERK_SYNC_HOST;

// One-time diagnostic: service worker console shows key presence (remove after confirming)
logger.log("clerk-auth", "Publishable key at load:", PUBLISHABLE_KEY.length ? `length ${PUBLISHABLE_KEY.length}` : "empty");

export function getClerkPublishableKey(): string {
  return PUBLISHABLE_KEY;
}

export function getClerkSyncHost(): string {
  return SYNC_HOST;
}

let clerkInstance: Awaited<ReturnType<typeof createClerkClient>> | null = null;

async function getClerkInstance(): Promise<Awaited<ReturnType<typeof createClerkClient>> | null> {
  if (!PUBLISHABLE_KEY) {
    logger.warn("clerk-auth", "Clerk publishable key not configured");
    return null;
  }
  try {
    if (!clerkInstance) {
      clerkInstance = await createClerkClient({
        publishableKey: PUBLISHABLE_KEY,
        ...(SYNC_HOST ? { syncHost: SYNC_HOST } : {}),
      });
    }
    return clerkInstance;
  } catch (err) {
    logger.error("clerk-auth", "Failed to create Clerk client:", err);
    return null;
  }
}

/**
 * Get a Bearer token for the current session. Retry once on failure.
 * Returns null if not signed in or getToken fails (e.g. cold worker).
 * Never logs the token.
 */
export async function getClerkToken(retry = true): Promise<string | null> {
  const clerk = await getClerkInstance();
  if (!clerk) return null;

  if (!clerk.session) {
    clerkInstance = null;
    logger.log("clerk-auth", "getToken: session present", false);
    return null;
  }

  logger.log("clerk-auth", "getToken: session present", true);
  try {
    const token = await clerk.session.getToken();
    return token;
  } catch (err) {
    logger.warn("clerk-auth", "getToken failed", err);
    if (retry) {
      clerkInstance = null;
      return getClerkToken(false);
    }
    return null;
  }
}

/**
 * Auth state for display only (no token). Used by popup via message from background.
 */
export interface AuthStateForDisplay {
  signedIn: boolean;
  userDisplay?: string;
  orgDisplay?: string;
  /** Sync host URL for "Open sync host to sign in" link (no token). */
  syncHostUrl?: string;
}

/**
 * Get auth state for popup display only. Never returns tokens.
 */
export async function getAuthStateForDisplay(): Promise<AuthStateForDisplay> {
  const clerk = await getClerkInstance();
  if (!clerk) return { signedIn: false, syncHostUrl: SYNC_HOST || undefined };
  try {
    const session = clerk.session;
    if (!session || !clerk.user) return { signedIn: false, syncHostUrl: SYNC_HOST || undefined };
    const user = clerk.user;
    const userDisplay =
      user.primaryEmailAddress?.emailAddress ??
      user.username ??
      (user.firstName
        ? [user.firstName, user.lastName].filter(Boolean).join(" ")
        : user.id?.slice(0, 8) ?? "User");
    const orgDisplay =
      typeof (clerk as unknown as { organization?: { name?: string } }).organization?.name ===
      "string"
        ? (clerk as unknown as { organization: { name: string } }).organization.name
        : undefined;
    return { signedIn: true, userDisplay, orgDisplay, syncHostUrl: SYNC_HOST || undefined };
  } catch {
    return { signedIn: false, syncHostUrl: SYNC_HOST || undefined };
  }
}

/**
 * Sign out the current session.
 */
export async function clerkSignOut(): Promise<void> {
  const clerk = await getClerkInstance();
  if (clerk) {
    try {
      await clerk.signOut();
      clerkInstance = null;
    } catch (err) {
      logger.error("clerk-auth", "Sign out failed:", err);
    }
  }
}

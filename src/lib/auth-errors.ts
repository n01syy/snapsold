/** Map Supabase auth errors to short, user-readable copy. */
export function friendlyAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) {
    return "Wrong email or password — double-check and try again.";
  }
  if (m.includes("email not confirmed")) {
    return "Confirm your email first — check your inbox for the link we sent.";
  }
  if (m.includes("user already registered")) {
    return "An account with this email already exists. Try signing in instead.";
  }
  if (m.includes("password should be at least")) {
    return "Password must be at least 8 characters.";
  }
  if (m.includes("unable to validate email")) {
    return "That email address doesn't look valid.";
  }
  if (m.includes("signup is disabled")) {
    return "Sign-ups are temporarily disabled. Try again later.";
  }
  if (m.includes("rate limit")) {
    return "Too many attempts — wait a minute and try again.";
  }
  return message;
}

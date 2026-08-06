export class OAuthIdentityError extends Error {}

export interface OAuthProps {
  email?: unknown;
}

export function authenticatedEmail(props: unknown): string {
  if (!props || typeof props !== "object") {
    throw new OAuthIdentityError("Missing OAuth identity.");
  }

  const email = (props as OAuthProps).email;
  if (typeof email !== "string" || email.trim().length === 0) {
    throw new OAuthIdentityError("OAuth identity has no email.");
  }
  return email.trim();
}

/**
 * Pure helpers for the generated Favicon placeholder shown when the
 * get-favicons map has no icon for an Entry link's hostname.
 *
 * Identity is the exact hostname: the leading "www." is stripped for the
 * displayed letter only, never for the color hash, so subdomain-distinct
 * hostnames always render distinct placeholders.
 */

export function getHostnameFromLink(link: string): string | null {
  try {
    return new URL(link).hostname.toLowerCase();
  } catch {
    return null;
  }
}

export function getPlaceholderInitial(hostname: string): string {
  const displayed = hostname.startsWith("www.") && hostname.length > "www.".length ? hostname.slice(4) : hostname;
  return displayed.charAt(0).toUpperCase();
}

// FNV-1a: stable, dependency-free, spreads similar hostnames across hues
function hashHostname(hostname: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < hostname.length; i++) {
    hash ^= hostname.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function getPlaceholderColor(hostname: string): string {
  const hue = hashHostname(hostname) % 360;
  // Muted saturation and dark lightness to sit quietly on the zinc theme
  return `hsl(${hue}, 25%, 32%)`;
}

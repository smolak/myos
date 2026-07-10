import { hostnameFromLink, placeholderColor, placeholderInitial } from "./favicon-placeholder";

interface Props {
  readonly link: string;
  readonly favicons: Readonly<Record<string, string>>;
}

/**
 * 16px decorative icon shown left of an Entry title: the cached Favicon when
 * the get-favicons map has the link's exact hostname, otherwise a lettered
 * placeholder derived deterministically from the hostname. Always reserves
 * the same space so titles stay vertically aligned.
 */
export function EntryIcon({ link, favicons }: Props) {
  const hostname = hostnameFromLink(link);
  const src = hostname ? favicons[hostname] : undefined;

  if (src) {
    return <img src={src} alt="" aria-hidden="true" className="w-4 h-4 shrink-0 rounded-sm" />;
  }

  if (!hostname) {
    return <span aria-hidden="true" className="w-4 h-4 shrink-0 rounded-sm bg-zinc-800" />;
  }

  return (
    <span
      aria-hidden="true"
      className="w-4 h-4 shrink-0 rounded-sm flex items-center justify-center text-[10px] font-medium leading-none text-zinc-200"
      style={{ backgroundColor: placeholderColor(hostname) }}
    >
      {placeholderInitial(hostname)}
    </span>
  );
}

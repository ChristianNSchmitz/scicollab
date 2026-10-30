import { initialsOf } from "@/lib/format";
import { parseAvatar, PRESET_ICONS } from "@/lib/avatar";

/**
 * A researcher's picture, wherever a person is shown.
 *
 * Three forms, in this order: an uploaded image, a built-in preset (an icon
 * on a colour), or the first letter of the name. Square, with a 1px rule,
 * like every other element in the house kit.
 */
export default function Avatar({
  name, url, size = 26,
}: { name: string; url?: string | null; size?: number }) {
  const a = parseAvatar(url);
  const box: React.CSSProperties = {
    width: size, height: size, flex: "none", border: "1px solid var(--ink)",
    display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden",
    background: "var(--bg)",
  };

  if (a.kind === "image") {
    // eslint-disable-next-line @next/next/no-img-element
    return <img className="sc-avatar" src={a.src} alt="" width={size} height={size} style={{ ...box, objectFit: "cover", padding: 0 }} />;
  }
  if (a.kind === "preset") {
    const icon = PRESET_ICONS.find((i) => i.id === a.icon) ?? PRESET_ICONS[0];
    return (
      <span className="sc-avatar" aria-hidden="true" style={{ ...box, background: a.colour, borderColor: a.colour }}>
        <svg width={Math.round(size * 0.62)} height={Math.round(size * 0.62)} viewBox="0 0 24 24" fill="none"
             stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d={icon.d} />
        </svg>
      </span>
    );
  }
  return (
    <span className="sc-avatar" aria-hidden="true" style={{ ...box, font: `500 ${Math.max(9, Math.round(size * 0.4))}px/1 var(--mono)` }}>
      {initialsOf(name)}
    </span>
  );
}

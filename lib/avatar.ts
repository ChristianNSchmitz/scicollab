/**
 * Profile pictures are stored as one text column, profiles.avatar_url:
 *   - an https URL (an upload in the avatars bucket),
 *   - a data: URL (an upload in demo mode, where there is no storage),
 *   - "preset:<icon>:<colour>" for a built-in picture,
 *   - null, which shows the first letter of the name.
 */

export const PRESET_ICONS = [
  { id: "flask",      label: "Flask",      d: "M9 3v6l-5 9a2 2 0 0 0 1.7 3h12.6a2 2 0 0 0 1.7-3l-5-9V3M8 3h8M7.5 14h9" },
  { id: "microscope", label: "Microscope", d: "M6 21h12M9 17h6M12 17v-3M10 4l4 0M11 4v6a3 3 0 0 0 6 0M8 14a5 5 0 0 0 9 2" },
  { id: "dna",        label: "DNA",        d: "M7 3c0 6 10 6 10 12s-10 6-10 6M17 3c0 6-10 6-10 12M8.5 7h7M8.5 17h7M10 12h4" },
  { id: "atom",       label: "Atom",       d: "M12 12h.01M12 3c2.5 0 3 4 3 9s-.5 9-3 9-3-4-3-9 .5-9 3-9zM4.2 7.5c1.2-2.2 5.2-.6 9.5 1.9s7.4 5.4 6.1 7.6-5.2.6-9.5-1.9-7.4-5.4-6.1-7.6z" },
  { id: "brain",      label: "Brain",      d: "M9 4a3 3 0 0 0-3 3 3 3 0 0 0-2 5 3 3 0 0 0 2 5 3 3 0 0 0 6 1V5a2 2 0 0 0-3-1zm6 0a3 3 0 0 1 3 3 3 3 0 0 1 2 5 3 3 0 0 1-2 5 3 3 0 0 1-6 1" },
  { id: "cell",       label: "Cell",       d: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 14.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM7 8h.01M17 16h.01M16 7h.01" },
  { id: "leaf",       label: "Leaf",       d: "M5 19c0-9 5-14 15-15 0 10-5 15-14 15zM5 19l7-7" },
  { id: "chart",      label: "Chart",      d: "M4 20V4M4 20h16M8 16v-4M12 16V8M16 16v-6" },
] as const;

/** Colours that hold white icons at 4.5:1 in both themes. */
export const PRESET_COLOURS = ["#0D0D0D", "#B33600", "#0B7A4B", "#1B4FA0", "#6B3FA0", "#8A5A00"] as const;

export type ParsedAvatar =
  | { kind: "image"; src: string }
  | { kind: "preset"; icon: string; colour: string }
  | { kind: "initial" };

export function parseAvatar(url: string | null | undefined): ParsedAvatar {
  const v = (url ?? "").trim();
  if (v.startsWith("preset:")) {
    const [, icon, colour] = v.split(":");
    const c = PRESET_COLOURS.find((x) => x.toLowerCase() === (colour ?? "").toLowerCase());
    if (PRESET_ICONS.some((i) => i.id === icon) && c) return { kind: "preset", icon, colour: c };
    return { kind: "initial" };
  }
  if (/^https:\/\//.test(v) || /^data:image\/(jpeg|png|webp);base64,/.test(v)) return { kind: "image", src: v };
  return { kind: "initial" };
}

export const presetValue = (icon: string, colour: string) => `preset:${icon}:${colour}`;

"use client";

import { useEffect, useId, useRef, useState, type CSSProperties, type TextareaHTMLAttributes } from "react";
import { suggestPeople } from "@/app/actions/social";

type Person = { id: string; name: string; institution: string };

/**
 * A textarea that offers members' names after "@". Picking one writes
 * "@Full Name"; the server matches it when the text is saved and notifies
 * that person. Works as a normal form field: the text is submitted as is.
 */
export default function MentionTextarea({ style, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & { style?: CSSProperties }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [query, setQuery] = useState<{ start: number; text: string } | null>(null);
  const [options, setOptions] = useState<Person[]>([]);
  const [active, setActive] = useState(0);
  const listId = `mention-${useId().replace(/:/g, "")}`;

  useEffect(() => {
    if (!query || !query.text) { setOptions([]); return; }
    const t = setTimeout(() => {
      suggestPeople(query.text).then((r) => { setOptions(r); setActive(0); }).catch(() => setOptions([]));
    }, 150);
    return () => clearTimeout(t);
  }, [query]);

  function detect() {
    const el = ref.current;
    if (!el) return;
    const upto = el.value.slice(0, el.selectionStart ?? 0);
    const m = upto.match(/(?:^|[\s(])@([\p{L}][\p{L}'’.-]*(?: [\p{L}][\p{L}'’.-]*)?)$/u);
    setQuery(m ? { start: upto.length - m[1].length - 1, text: m[1] } : null);
  }

  function pick(p: Person) {
    const el = ref.current;
    if (!el || !query) return;
    const end = el.selectionStart ?? el.value.length;
    const insert = `@${p.name} `;
    el.value = el.value.slice(0, query.start) + insert + el.value.slice(end);
    const caret = query.start + insert.length;
    el.setSelectionRange(caret, caret);
    el.focus();
    setQuery(null);
    setOptions([]);
  }

  const open = options.length > 0;
  return (
    <div style={{ position: "relative" }}>
      <textarea
        {...props}
        ref={ref}
        style={style}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open ? `${listId}-${active}` : undefined}
        onInput={(e) => { detect(); props.onInput?.(e); }}
        onClick={detect}
        onKeyDown={(e) => {
          if (open) {
            if (e.key === "ArrowDown") { e.preventDefault(); setActive((active + 1) % options.length); return; }
            if (e.key === "ArrowUp") { e.preventDefault(); setActive((active - 1 + options.length) % options.length); return; }
            if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); pick(options[active]); return; }
            if (e.key === "Escape") { setOptions([]); return; }
          }
          props.onKeyDown?.(e);
        }}
        onBlur={(e) => { setTimeout(() => setOptions([]), 150); props.onBlur?.(e); }}
      />
      {open && (
        <ul id={listId} role="listbox" style={{
          position: "absolute", left: 0, top: "100%", zIndex: 20, margin: 0, padding: 0, listStyle: "none",
          minWidth: 260, background: "var(--surface)", border: "1px solid var(--ink)",
        }}>
          {options.map((p, i) => (
            <li key={p.id} id={`${listId}-${i}`} role="option" aria-selected={i === active}
              onMouseDown={(e) => { e.preventDefault(); pick(p); }}
              style={{ padding: "8px 10px", cursor: "pointer", background: i === active ? "var(--bg)" : "transparent", borderBottom: "1px solid var(--rule)" }}>
              <div style={{ font: "500 12.5px/1.3 var(--mono)" }}>{p.name}</div>
              {p.institution && <div style={{ font: "400 11px/1.3 var(--mono)", color: "var(--mute)", marginTop: 2 }}>{p.institution}</div>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

/** A person's name, linking to their profile. Inherits the surrounding type. */
export default function PersonLink({ id, children, style }: { id: string | null | undefined; children: ReactNode; style?: CSSProperties }) {
  if (!id) return <>{children}</>;
  return <Link href={`/people/${id}`} style={{ color: "inherit", textDecoration: "underline", textDecorationColor: "var(--rule)", textUnderlineOffset: 3, ...style }}>{children}</Link>;
}

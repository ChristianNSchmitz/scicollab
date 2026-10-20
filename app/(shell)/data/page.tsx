import { redirect } from "next/navigation";

/** Data is no longer a destination of its own — it is a tab inside a project.
 *  Kept so existing links and bookmarks land somewhere sensible. */
export default function Data() {
  redirect("/projects");
}

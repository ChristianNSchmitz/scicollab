import { redirect } from "next/navigation";

/** Code is no longer a destination of its own — it is a tab inside a project. */
export default function Code() {
  redirect("/projects");
}

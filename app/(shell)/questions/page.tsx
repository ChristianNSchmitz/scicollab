import { redirect } from "next/navigation";

/** Questions are listed on Ask, next to the form for asking one. Kept so a
 *  trimmed /questions/<id> URL lands somewhere useful instead of a 404. */
export default function Questions() {
  redirect("/ask#questions");
}

import { redirect } from "next/navigation";

/** Rooms are now topic groups, listed on the Groups page. Kept so existing links land there. */
export default function Rooms() {
  redirect("/groups#topics");
}

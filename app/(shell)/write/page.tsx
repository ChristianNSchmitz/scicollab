import { redirect } from "next/navigation";

/** Writing starts in the composer at the top of the feed now. Kept so existing links land there. */
export default function Write() {
  redirect("/home#compose");
}

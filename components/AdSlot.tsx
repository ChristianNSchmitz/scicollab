/**
 * Room for advertising. Nothing is served yet: the box keeps its place so a
 * page does not move when something is. Put the ad inside this element.
 *
 *   "rect"   300 x 250, the "medium rectangle", for a side column (the feed).
 *   "banner" 728 x 90, the "leaderboard", under the heading of a browse page.
 *
 * The banner is opt-in on a page (`<Page ad>`): lists and searches, not forms,
 * messages, settings or anything with private work on it.
 */
export default function AdSlot({ shape = "rect", className = "" }: { shape?: "rect" | "banner"; className?: string }) {
  return (
    <aside aria-label="Advertisement" className={`sc-ad sc-ad-${shape} ${className}`.trim()}>
      <span>Advertisement</span>
    </aside>
  );
}

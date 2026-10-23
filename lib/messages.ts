import type { MessageProblem } from "@/app/actions/messages";

/** What each refused message says, on the thread page and in the chat dock. */
export const MESSAGE_PROBLEM: Record<MessageProblem, string> = {
  empty: "Write something first.",
  long: "Messages are limited to 4,000 characters.",
  gated: "You cannot message this person yet. Record a method card, ask or answer a question, or reply to a post first.",
  limited: "That was not sent: you have reached the limit for now. Please wait a few minutes and try again.",
  card: "You can only attach your own method cards.",
};

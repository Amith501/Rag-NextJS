import { llm } from "./llm";

export type Turn = { role: "user" | "assistant"; text: string };

export async function rewriteQuestion(question: string, history: Turn[]) {
  if (history.length === 0) return question;

  const transcript = history
    .slice(-6)
    .map((t) => `${t.role === "user" ? "User" : "Assistant"}: ${t.text.slice(0, 500)}`)
    .join("\n");

  const prompt = `Given the conversation below and a follow-up question, rewrite the follow-up as one standalone question that can be understood without the conversation. Keep names, numbers and technical terms. If it is already standalone, return it unchanged. Return only the question, nothing else.

Conversation:
${transcript}

Follow-up question: ${question}

Standalone question:`;

  try {
    const res = await llm.invoke(prompt);
    const text = typeof res.content === "string" ? res.content.trim() : "";
    return text || question;
  } catch {
    // If rewriting fails, fall back to the original question
    return question;
  }
}
import { ChatMessage, Plan, PlannerAgent } from "./types.js";
import { createDefaultGeminiClient } from "./api.js";

const PLANNER_SYSTEM_PROMPT = `You are a web task planner. Given a user's goal, output a minimal sequential plan as JSON with a steps array of plain strings.
Rules:
- Only include concrete, browser-executable steps.
- Use verbs like Navigate, Locate, Click, Type, Extract, Return.
- Keep 3-7 steps.
Output JSON only. Example:
{ "steps": ["Navigate to bbc.com", "Locate the headlines section", "Extract top 3 headlines", "Return them"] }`;

export class GeminiPlannerAgent implements PlannerAgent {
  async plan(query: string, history: ChatMessage[], abortSignal?: AbortSignal): Promise<Plan> {
    const client = createDefaultGeminiClient();
    const messages: ChatMessage[] = [
      ...history,
      { id: crypto.randomUUID(), role: "system", content: PLANNER_SYSTEM_PROMPT, createdAt: Date.now() },
    ];
    const { text } = await client.sendMessage(messages, query, abortSignal);
    try {
      const jsonStart = text.indexOf("{");
      const jsonEnd = text.lastIndexOf("}");
      const json = text.substring(jsonStart, jsonEnd + 1);
      const parsed = JSON.parse(json);
      if (Array.isArray(parsed?.steps)) {
        return { steps: parsed.steps.map((s: unknown) => String(s)) };
      }
    } catch {
      // fallthrough to fallback
    }
    return { steps: [
      `Interpret goal: ${query}`,
      "Navigate to a likely website",
      "Locate the relevant section",
      "Extract the requested information",
      "Return the results"
    ] };
  }
}



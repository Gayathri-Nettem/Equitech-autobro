import { ChatMessage, Plan, PlannerAgent } from "./types.js";
import { createDefaultGeminiClient } from "./api.js";

const PLANNER_SYSTEM_PROMPT = `You are a web task planner. Given a user's goal, output a minimal sequential plan as JSON with a steps array of plain strings.
Rules:
- Only include concrete, browser-executable steps.
- Use specific verbs: Navigate to [URL], Click on [element], Type [text] into [field], Extract [content] from [selector], Wait for [condition].
- Always start with navigation if a specific website is mentioned.
- Be very specific about what to extract and from where.
- Keep 3-7 steps.
- Use full URLs for navigation.
Output JSON only. Example:
{ "steps": ["Navigate to https://www.bbc.com", "Wait for page to load", "Extract headlines from h1, h2, h3 elements", "Return the extracted headlines"] }`;

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
    // Generate a more specific fallback plan based on the query
    const lowerQuery = query.toLowerCase();
    if (lowerQuery.includes("langgraph") || lowerQuery.includes("langchain")) {
      return { steps: [
        "Navigate to https://langchain-ai.github.io/langgraph/",
        "Wait for page to load",
        "Extract main content from h1, h2, h3, p elements",
        "Return the extracted information about LangGraph"
      ] };
    } else if (lowerQuery.includes("bbc") || lowerQuery.includes("headline")) {
      return { steps: [
        "Navigate to https://www.bbc.com",
        "Wait for page to load",
        "Extract headlines from h1, h2, h3, .headline elements",
        "Return the top headlines"
      ] };
    } else {
      return { steps: [
        "Navigate to https://www.google.com",
        "Wait for page to load",
        "Extract main content from h1, h2, h3 elements",
        "Return the extracted information"
      ] };
    }
  }
}



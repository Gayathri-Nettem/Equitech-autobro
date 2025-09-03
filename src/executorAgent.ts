import { ChatMessage, ExecutorAction, ExecutorAgent } from "./types.js";
import { createDefaultGeminiClient } from "./api.js";

const EXECUTOR_SYSTEM_PROMPT = `You are a browser DOM action generator. Convert the given step into a concise list of actions.
Allowed action types: navigate(url), click(selector), type(selector, value), extract(selector).
Selectors must be simple CSS. Prefer robust attributes or headings.
Only output JSON array of actions, no prose.`;

export class GeminiExecutorAgent implements ExecutorAgent {
  async decideActions(step: string, pageContext: string, history: ChatMessage[], abortSignal?: AbortSignal): Promise<ExecutorAction[]> {
    const client = createDefaultGeminiClient();
    const userPrompt = `Step: ${step}\n\nCurrent page context (truncated):\n${pageContext.slice(0, 2000)}`;
    const messages: ChatMessage[] = [
      ...history,
      { id: crypto.randomUUID(), role: "system", content: EXECUTOR_SYSTEM_PROMPT, createdAt: Date.now() },
    ];
    const { text } = await client.sendMessage(messages, userPrompt, abortSignal);
    try {
      const jsonStart = text.indexOf("[");
      const jsonEnd = text.lastIndexOf("]");
      const json = text.substring(jsonStart, jsonEnd + 1);
      const parsed = JSON.parse(json);
      if (Array.isArray(parsed)) {
        return parsed.map((a: any) => ({
          type: a.type,
          selector: a.selector,
          value: a.value,
          url: a.url
        } as ExecutorAction));
      }
    } catch {
      // fallthrough
    }
    return [];
  }

  async executeActions(actions: ExecutorAction[]): Promise<string> {
    let lastOutput = "";
    for (const action of actions) {
      if (action.type === "navigate" && action.url) {
        await chrome.tabs.update({ url: action.url });
        await this.waitForLoad();
        lastOutput = `Navigated to ${action.url}`;
      } else if (action.type === "click" && action.selector) {
        await chrome.scripting.executeScript({
          target: { tabId: await this.getActiveTabId() },
          func: (selector: string) => {
            const el = document.querySelector(selector) as HTMLElement | null;
            if (el) el.click();
            return !!el;
          },
          args: [action.selector]
        });
        lastOutput = `Clicked ${action.selector}`;
      } else if (action.type === "type" && action.selector) {
        await chrome.scripting.executeScript({
          target: { tabId: await this.getActiveTabId() },
          func: (selector: string, value?: string) => {
            const el = document.querySelector(selector) as HTMLInputElement | HTMLTextAreaElement | null;
            if (el) {
              el.focus();
              el.value = value ?? "";
              el.dispatchEvent(new Event('input', { bubbles: true }));
            }
            return !!el;
          },
          args: [action.selector, action.value]
        });
        lastOutput = `Typed into ${action.selector}`;
      } else if (action.type === "extract" && action.selector) {
        const [{ result }] = await chrome.scripting.executeScript({
          target: { tabId: await this.getActiveTabId() },
          func: (selector: string) => {
            const nodes = Array.from(document.querySelectorAll(selector));
            return nodes.map(n => (n as HTMLElement).innerText.trim()).filter(Boolean).slice(0, 10);
          },
          args: [action.selector]
        }) as unknown as Array<{ result: string[] }>;
        lastOutput = result?.join("\n") ?? "";
      }
    }
    return lastOutput;
  }

  private async getActiveTabId(): Promise<number> {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error("No active tab");
    return tab.id;
  }

  private async waitForLoad(): Promise<void> {
    // simple delay; could be improved by waiting for tab status
    await new Promise(r => setTimeout(r, 1200));
  }
}



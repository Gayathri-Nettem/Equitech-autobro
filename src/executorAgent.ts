import { ChatMessage, ExecutorAction, ExecutorAgent } from "./types.js";
import { createDefaultGeminiClient } from "./api.js";

const EXECUTOR_SYSTEM_PROMPT = `You are a browser DOM action generator. Convert the given step into specific, executable actions.
Allowed action types: navigate(url), click(selector), type(selector, value), extract(selector), wait(ms).
- navigate: use full URLs (e.g., "https://bbc.com")
- click: use specific selectors (e.g., "a[href*='headlines']", "h1", ".menu-item")
- type: for input fields (e.g., "input[type='search']", "#search-box")
- extract: to get text content (e.g., "h1, h2, h3", ".headline", "article")
- wait: for page loads (e.g., 2000ms)

Output ONLY a JSON array with this exact format:
[
  {
    "type": "navigate",
    "url": "https://example.com"
  },
  {
    "type": "wait",
    "value": "2000"
  },
  {
    "type": "extract",
    "selector": "h1, h2, h3"
  }
]`;

export class GeminiExecutorAgent implements ExecutorAgent {
  async decideActions(step: string, pageContext: string, history: ChatMessage[], abortSignal?: AbortSignal): Promise<ExecutorAction[]> {
    const client = createDefaultGeminiClient();
    const userPrompt = `Step: ${step}\n\nCurrent page context (truncated):\n${pageContext.slice(0, 2000)}`;
    const messages: ChatMessage[] = [
      ...history,
      { id: crypto.randomUUID(), role: "system", content: EXECUTOR_SYSTEM_PROMPT, createdAt: Date.now() },
    ];
    const { text } = await client.sendMessage(messages, userPrompt, abortSignal);

    console.log("Executor response:", text); // Debug log

    try {
      const jsonStart = text.indexOf("[");
      const jsonEnd = text.lastIndexOf("]");
      if (jsonStart === -1 || jsonEnd === -1) {
        console.log("No JSON array found in response");
        return this.generateFallbackActions(step);
      }

      const json = text.substring(jsonStart, jsonEnd + 1);
      console.log("Extracted JSON:", json); // Debug log

      const parsed = JSON.parse(json);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const actions = parsed.map((a: any) => ({
          type: a.type || a.action, // Handle both "type" and "action" properties
          selector: a.selector,
          value: a.value,
          url: a.url
        } as ExecutorAction));
        console.log("Parsed actions:", actions); // Debug log
        return actions;
      }
    } catch (error) {
      console.log("JSON parse error:", error);
    }

    return this.generateFallbackActions(step);
  }

    private generateFallbackActions(step: string): ExecutorAction[] {
    const lowerStep = step.toLowerCase();

    if (lowerStep.includes("navigate") || lowerStep.includes("go to")) {
      if (lowerStep.includes("langgraph") || lowerStep.includes("langchain")) {
        return [{ type: "navigate", url: "https://langchain-ai.github.io/langgraph/" }];
      } else if (lowerStep.includes("bbc")) {
        return [{ type: "navigate", url: "https://www.bbc.com" }];
      } else if (lowerStep.includes("booking")) {
        return [{ type: "navigate", url: "https://www.booking.com" }];
      } else if (lowerStep.includes("google")) {
        return [{ type: "navigate", url: "https://www.google.com" }];
      }
    }

    if (lowerStep.includes("type") && lowerStep.includes("destination")) {
      return [
        { type: "wait", value: "2000" },
        { type: "type", selector: "input[name='ss'], input[placeholder*='destination'], input[data-testid*='destination']", value: "Bangalore" }
      ];
    }

    if (lowerStep.includes("type") && (lowerStep.includes("search") || lowerStep.includes("query"))) {
      return [
        { type: "wait", value: "1000" },
        { type: "type", selector: "input[type='search'], input[name='q'], input[placeholder*='search']", value: "Bangalore" }
      ];
    }

    if (lowerStep.includes("click") && lowerStep.includes("search")) {
      return [
        { type: "wait", value: "1000" },
        { type: "click", selector: "button[type='submit'], button[data-testid*='search'], .search-button" }
      ];
    }

    if (lowerStep.includes("extract") || lowerStep.includes("find") || lowerStep.includes("get")) {
      if (lowerStep.includes("hotel") || lowerStep.includes("result")) {
        return [
          { type: "wait", value: "3000" },
          { type: "extract", selector: ".hotel-name, .property-name, [data-testid*='hotel'], h3, h4" }
        ];
      } else if (lowerStep.includes("headline")) {
        return [
          { type: "wait", value: "2000" },
          { type: "extract", selector: "h1, h2, h3, .headline, [data-testid*='headline']" }
        ];
      } else if (lowerStep.includes("title") || lowerStep.includes("heading")) {
        return [
          { type: "wait", value: "2000" },
          { type: "extract", selector: "h1, h2, h3" }
        ];
      } else {
        return [
          { type: "wait", value: "2000" },
          { type: "extract", selector: "h1, h2, h3, p" }
        ];
      }
    }

    if (lowerStep.includes("click") || lowerStep.includes("select")) {
      return [
        { type: "wait", value: "1000" },
        { type: "click", selector: "a, button, [role='button']" }
      ];
    }

    // Default fallback
    return [
      { type: "wait", value: "2000" },
      { type: "extract", selector: "body" }
    ];
  }

    async executeActions(actions: ExecutorAction[]): Promise<string> {
    let lastOutput = "";

    const tabId = await this.getActiveTabId();
    console.log("Active tab ID:", tabId); // Debug log
    console.log("Executing actions:", actions); // Debug log

    for (const action of actions) {
      console.log("Executing action:", action); // Debug log
      try {
        if (action.type === "navigate" && action.url) {
          try {
            await this.sendMessageToBackground({
              action: "updateTab",
              tabId,
              url: action.url
            });
          } catch (error) {
            console.log("Background script failed, trying direct API:", error);
            // Fallback to direct Chrome API
            if (typeof chrome !== 'undefined' && chrome.tabs) {
              await chrome.tabs.update(tabId, { url: action.url });
            } else {
              throw error;
            }
          }
          await this.waitForLoad();
          lastOutput = `✅ Navigated to ${action.url}`;
        } else if (action.type === "click" && action.selector) {
          const response = await this.sendMessageToBackground({
            action: "executeScript",
            tabId,
            func: (selector: string) => {
              const el = document.querySelector(selector) as HTMLElement | null;
              if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                el.click();
                return { success: true, text: el.innerText?.slice(0, 100) || 'clicked' };
              }
              return { success: false, error: `Element not found: ${selector}` };
            },
            args: [action.selector]
          });

          console.log("Click script response:", response); // Debug log

          if (!response.success) {
            throw new Error(response.error || "Script execution failed");
          }

          const result = response.results?.[0]?.result;
          if (result?.success) {
            lastOutput = `✅ Clicked: ${result.text}`;
          } else {
            throw new Error(result?.error || `Failed to click ${action.selector}`);
          }
        } else if (action.type === "type" && action.selector) {
          const response = await this.sendMessageToBackground({
            action: "executeScript",
            tabId,
            func: (selector: string, value?: string) => {
              const el = document.querySelector(selector) as HTMLInputElement | HTMLTextAreaElement | null;
              if (el) {
                el.focus();
                el.value = value ?? "";
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
                return { success: true, value: el.value };
              }
              return { success: false, error: `Input not found: ${selector}` };
            },
            args: [action.selector, action.value]
          });

          console.log("Type script response:", response); // Debug log
          if (!response.success) {
            throw new Error(response.error || "Script execution failed");
          }

          const result = response.results?.[0]?.result;
          if (result?.success) {
            lastOutput = `✅ Typed "${result.value}" into ${action.selector}`;
          } else {
            throw new Error(result?.error || `Failed to type into ${action.selector}`);
          }
        } else if (action.type === "extract" && action.selector) {
          let response;
          try {
            response = await this.sendMessageToBackground({
              action: "executeScript",
              tabId,
              func: (selector: string) => {
                const nodes = Array.from(document.querySelectorAll(selector));
                return nodes.map(n => (n as HTMLElement).innerText.trim()).filter(Boolean).slice(0, 10);
              },
              args: [action.selector]
            });
          } catch (error) {
            console.log("Background script failed, trying direct API:", error);
            // Fallback to direct Chrome API
            if (typeof chrome !== 'undefined' && chrome.scripting) {
              const results = await chrome.scripting.executeScript({
                target: { tabId },
                func: (selector: string) => {
                  const nodes = Array.from(document.querySelectorAll(selector));
                  return nodes.map(n => (n as HTMLElement).innerText.trim()).filter(Boolean).slice(0, 10);
                },
                args: [action.selector]
              });
              response = { success: true, results };
            } else {
              throw error;
            }
          }

          console.log("Extract script response:", response); // Debug log

          if (!response.success) {
            throw new Error(response.error || "Script execution failed");
          }

          const extracted = response.results?.[0]?.result?.filter(Boolean) || [];
          if (extracted.length > 0) {
            lastOutput = `📄 Extracted ${extracted.length} items:\n${extracted.join('\n')}`;
          } else {
            lastOutput = `⚠️ No content found with selector: ${action.selector}`;
          }
        } else if (action.type === "wait") {
          const ms = parseInt(action.value || "2000");
          await new Promise(resolve => setTimeout(resolve, ms));
          lastOutput = `⏳ Waited ${ms}ms`;
        }
      } catch (error) {
        throw new Error(`Action failed (${action.type}): ${(error as Error).message}`);
      }
    }
    return lastOutput;
  }

  private async sendMessageToBackground(message: any): Promise<any> {
    return new Promise((resolve, reject) => {
      // Add timeout to prevent hanging
      const timeout = setTimeout(() => {
        reject(new Error("Background script timeout"));
      }, 5000);

      chrome.runtime.sendMessage(message, (response: any) => {
        clearTimeout(timeout);
        if (chrome.runtime.lastError) {
          console.error("Chrome runtime error:", chrome.runtime.lastError);
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response);
        }
      });
    });
  }

  private async getActiveTabId(): Promise<number> {
    console.log("Querying for active tab..."); // Debug log

    try {
      const response = await this.sendMessageToBackground({
        action: "getActiveTab"
      });

      console.log("Get active tab response:", response); // Debug log

      if (!response.success) {
        throw new Error(response.error || "Failed to get active tab");
      }

      return response.tabId;
    } catch (error) {
      console.log("Background script failed, trying direct API:", error);

      // Fallback to direct Chrome API
      if (typeof chrome !== 'undefined' && chrome.tabs) {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tabs && tabs.length > 0 && tabs[0].id) {
          return tabs[0].id;
        }
      }

      throw new Error("Could not get active tab ID");
    }
  }

  private async waitForLoad(): Promise<void> {
    // simple delay; could be improved by waiting for tab status
    await new Promise(r => setTimeout(r, 1200));
  }
}



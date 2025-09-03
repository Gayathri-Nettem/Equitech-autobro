import { ChatMessage, WorkflowController, WorkflowState } from "./types.js";
import { GeminiPlannerAgent } from "./plannerAgent.js";
import { GeminiExecutorAgent } from "./executorAgent.js";

export class LangGraphLikeWorkflow implements WorkflowController {
  private readonly planner = new GeminiPlannerAgent();
  private readonly executor = new GeminiExecutorAgent();
  private readonly maxRetries = 3;

  async run(query: string, onUpdate: (state: WorkflowState) => void, abortSignal?: AbortSignal): Promise<WorkflowState> {
    const state: WorkflowState = {
      messages: [],
      currentStepIndex: 0,
      stepResults: []
    };

    const addMessage = (role: ChatMessage["role"], content: string) => {
      state.messages.push({ id: crypto.randomUUID(), role, content, createdAt: Date.now() });
    };

    addMessage("user", query);
    onUpdate({ ...state });

    // Plan with retry logic
    let plan = await this.planner.plan(query, state.messages, abortSignal);
    state.plan = plan;
    addMessage("model", `📋 **Plan generated with ${plan.steps.length} steps:**\n${plan.steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}`);
    onUpdate({ ...state });

    // Execute steps with retry logic
    let attempt = 0;
    while (attempt < this.maxRetries) {
      const failedSteps = await this.executeSteps(state, onUpdate, abortSignal);

      if (failedSteps.length === 0) {
        break; // All steps succeeded
      }

      attempt++;
      if (attempt >= this.maxRetries) {
        addMessage("model", `❌ **Execution failed after ${this.maxRetries} attempts.** Final results below.`);
        break;
      }

      // Revise plan based on failures
      addMessage("model", `🔄 **Attempt ${attempt + 1}/${this.maxRetries}: Revising plan due to failures...**`);
      const revisionPrompt = `Previous plan failed on steps: ${failedSteps.join(', ')}. Please create a revised plan that addresses these issues. Original goal: ${query}`;
      plan = await this.planner.plan(revisionPrompt, state.messages, abortSignal);
      state.plan = plan;
      state.currentStepIndex = 0;
      state.stepResults = []; // Reset results for retry
      addMessage("model", `📋 **Revised plan:**\n${plan.steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}`);
      onUpdate({ ...state });
    }

    // Finalize
    const final = this.composeFinal(state);
    state.finalOutput = final;
    addMessage("model", final);
    onUpdate({ ...state });
    return state;
  }

  private async executeSteps(state: WorkflowState, onUpdate: (state: WorkflowState) => void, abortSignal?: AbortSignal): Promise<number[]> {
    const failedSteps: number[] = [];

    for (let i = 0; i < state.plan!.steps.length; i++) {
      state.currentStepIndex = i;
      const step = state.plan!.steps[i];

      const addMessage = (role: ChatMessage["role"], content: string) => {
        state.messages.push({ id: crypto.randomUUID(), role, content, createdAt: Date.now() });
      };

      addMessage("model", `🚀 **Executing step ${i + 1}/${state.plan!.steps.length}:** ${step}`);
      onUpdate({ ...state });

      const pageContext = await this.readPageContext();
      console.log("Page context:", pageContext.slice(0, 500)); // Debug log

      const actions = await this.executor.decideActions(step, pageContext, state.messages, abortSignal);
      console.log("Generated actions for step:", step, actions); // Debug log

      let success = true;
      let output = "";
      let error: string | undefined;

      try {
        if (actions.length === 0) {
          throw new Error("No actions generated for this step");
        }
        output = await this.executor.executeActions(actions);
        console.log("Action execution result:", output); // Debug log
      } catch (e) {
        success = false;
        error = (e as Error).message;
        console.log("Action execution error:", error); // Debug log
        failedSteps.push(i);
      }

      state.stepResults.push({ stepIndex: i, step, output, success, error });

      if (output) {
        addMessage("model", output);
      }
      if (error) {
        addMessage("model", `❌ **Step ${i + 1} failed:** ${error}`);
      }

      onUpdate({ ...state });
    }

    return failedSteps;
  }

  private async readPageContext(): Promise<string> {
    try {
      const tabId = await this.getActiveTabId();
      const [{ result }] = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => document.body?.innerText?.slice(0, 5000) || "",
      }) as unknown as Array<{ result: string }>; 
      return result ?? "";
    } catch {
      return "";
    }
  }

  private composeFinal(state: WorkflowState): string {
    const lines: string[] = ["## 🎯 Final Result\n"];

    const successfulSteps = state.stepResults.filter(r => r.success && r.output);
    const failedSteps = state.stepResults.filter(r => !r.success);

    if (successfulSteps.length > 0) {
      lines.push("### ✅ Successful Steps:");
      for (const r of successfulSteps) {
        lines.push(`**Step ${r.stepIndex + 1}:** ${r.step}`);
        lines.push(r.output);
        lines.push("");
      }
    }

    if (failedSteps.length > 0) {
      lines.push("### ❌ Failed Steps:");
      for (const r of failedSteps) {
        lines.push(`**Step ${r.stepIndex + 1}:** ${r.step}`);
        lines.push(`Error: ${r.error}`);
        lines.push("");
      }
    }

    // Extract final meaningful results
    const extractedContent = successfulSteps
      .filter(r => r.output.includes("📄 Extracted"))
      .map(r => r.output)
      .join("\n\n");

    if (extractedContent) {
      lines.push("### 📄 Extracted Content:");
      lines.push(extractedContent);
    }

    return lines.join("\n");
  }

  private async getActiveTabId(): Promise<number> {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error("No active tab");
    return tab.id;
  }
}



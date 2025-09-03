import { ChatMessage, WorkflowController, WorkflowState } from "./types.js";
import { GeminiPlannerAgent } from "./plannerAgent.js";
import { GeminiExecutorAgent } from "./executorAgent.js";

export class LangGraphLikeWorkflow implements WorkflowController {
  private readonly planner = new GeminiPlannerAgent();
  private readonly executor = new GeminiExecutorAgent();

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

    // Plan
    const plan = await this.planner.plan(query, state.messages, abortSignal);
    state.plan = plan;
    addMessage("model", `Plan generated with ${plan.steps.length} steps.`);
    onUpdate({ ...state });

    // Execute steps
    for (let i = 0; i < plan.steps.length; i++) {
      state.currentStepIndex = i;
      const step = plan.steps[i];
      addMessage("model", `Executing step ${i + 1}/${plan.steps.length}: ${step}`);
      onUpdate({ ...state });

      const pageContext = await this.readPageContext();
      const actions = await this.executor.decideActions(step, pageContext, state.messages, abortSignal);
      let success = true;
      let output = "";
      let error: string | undefined;
      try {
        output = await this.executor.executeActions(actions);
      } catch (e) {
        success = false;
        error = (e as Error).message;
      }

      state.stepResults.push({ stepIndex: i, step, output, success, error });
      if (output) addMessage("model", output);
      if (error) addMessage("model", `Error: ${error}`);
      onUpdate({ ...state });
    }

    // Finalize
    const final = this.composeFinal(state);
    state.finalOutput = final;
    addMessage("model", final);
    onUpdate({ ...state });
    return state;
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
    const lines: string[] = [];
    lines.push("## Final Result\n");
    for (const r of state.stepResults) {
      if (r.output) {
        lines.push(`### Step ${r.stepIndex + 1}: ${r.step}`);
        lines.push(r.output);
        lines.push("");
      }
    }
    return lines.join("\n");
  }

  private async getActiveTabId(): Promise<number> {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error("No active tab");
    return tab.id;
  }
}



import { GeminiPlannerAgent } from "./plannerAgent.js";
import { GeminiExecutorAgent } from "./executorAgent.js";
export class LangGraphLikeWorkflow {
    planner = new GeminiPlannerAgent();
    executor = new GeminiExecutorAgent();
    async run(query, onUpdate, abortSignal) {
        const state = {
            messages: [],
            currentStepIndex: 0,
            stepResults: []
        };
        const addMessage = (role, content) => {
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
            let error;
            try {
                output = await this.executor.executeActions(actions);
            }
            catch (e) {
                success = false;
                error = e.message;
            }
            state.stepResults.push({ stepIndex: i, step, output, success, error });
            if (output)
                addMessage("model", output);
            if (error)
                addMessage("model", `Error: ${error}`);
            onUpdate({ ...state });
        }
        // Finalize
        const final = this.composeFinal(state);
        state.finalOutput = final;
        addMessage("model", final);
        onUpdate({ ...state });
        return state;
    }
    async readPageContext() {
        try {
            const tabId = await this.getActiveTabId();
            const [{ result }] = await chrome.scripting.executeScript({
                target: { tabId },
                func: () => document.body?.innerText?.slice(0, 5000) || "",
            });
            return result ?? "";
        }
        catch {
            return "";
        }
    }
    composeFinal(state) {
        const lines = [];
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
    async getActiveTabId() {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab?.id)
            throw new Error("No active tab");
        return tab.id;
    }
}

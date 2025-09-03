// Simple workflow runner that mimics LangGraph's node-based approach
export class LangGraphWorkflow {
    planner;
    executor;
    constructor(planner, executor) {
        this.planner = planner;
        this.executor = executor;
    }
    async run(query, onUpdate, abortSignal) {
        const state = {
            messages: [],
            currentStepIndex: 0,
            stepResults: []
        };
        const addMessage = (role, content) => {
            state.messages.push({ id: crypto.randomUUID(), role, content, createdAt: Date.now() });
        };
        // Node 1: Plan
        addMessage("user", query);
        onUpdate({ ...state });
        state.plan = await this.planner.plan(query, state.messages, abortSignal);
        addMessage("model", `Plan generated with ${state.plan.steps.length} steps.`);
        onUpdate({ ...state });
        // Node 2: Execute (loop)
        for (let i = 0; i < state.plan.steps.length; i++) {
            state.currentStepIndex = i;
            const step = state.plan.steps[i];
            addMessage("model", `Executing step ${i + 1}/${state.plan.steps.length}: ${step}`);
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
        // Node 3: Final
        const final = this.composeFinal(state);
        state.finalOutput = final;
        addMessage("model", final);
        onUpdate({ ...state });
        return state;
    }
    async readPageContext() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab?.id)
                return "";
            const [{ result }] = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: () => document.body?.innerText?.slice(0, 5000) || "",
            });
            return result ?? "";
        }
        catch {
            return "";
        }
    }
    composeFinal(state) {
        const lines = ["## Final Result\n"];
        for (const r of state.stepResults) {
            if (r.output) {
                lines.push(`### Step ${r.stepIndex + 1}: ${r.step}`);
                lines.push(r.output);
                lines.push("");
            }
        }
        return lines.join("\n");
    }
}
// Factory function to create a LangGraph-style workflow
export function buildLangGraph(planner, executor) {
    return new LangGraphWorkflow(planner, executor);
}

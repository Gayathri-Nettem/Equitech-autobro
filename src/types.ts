export type Role = "user" | "model" | "system";

export interface ChatMessage {
  id: string;
  role: Role;
  content: string;
  createdAt: number;
}

export interface ChatStateSnapshot {
  messages: ChatMessage[];
}

export interface ChatModelResponse {
  text: string;
}

export interface ChatModelClient {
  sendMessage(history: ChatMessage[], input: string, abortSignal?: AbortSignal): Promise<ChatModelResponse>;
}

export interface ChatManagerOptions {
  modelClient: ChatModelClient;
  maxMessages?: number;
}


// LangGraph workflow types
export interface Plan {
  steps: string[];
}

export interface StepResult {
  stepIndex: number;
  step: string;
  output: string; // markdown or plain text
  success: boolean;
  error?: string;
}

export interface WorkflowState {
  messages: ChatMessage[];
  plan?: Plan;
  currentStepIndex: number;
  stepResults: StepResult[];
  finalOutput?: string;
}

export interface PlannerAgent {
  plan(query: string, history: ChatMessage[], abortSignal?: AbortSignal): Promise<Plan>;
}

export interface ExecutorAction {
  type: "navigate" | "click" | "type" | "extract" | "wait";
  selector?: string;
  value?: string;
  url?: string;
}

export interface ExecutorAgent {
  decideActions(step: string, pageContext: string, history: ChatMessage[], abortSignal?: AbortSignal): Promise<ExecutorAction[]>;
  executeActions(actions: ExecutorAction[]): Promise<string>; // returns extracted/observed output
}

export interface WorkflowController {
  run(query: string, onUpdate: (state: WorkflowState) => void, abortSignal?: AbortSignal): Promise<WorkflowState>;
}


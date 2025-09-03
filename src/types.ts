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



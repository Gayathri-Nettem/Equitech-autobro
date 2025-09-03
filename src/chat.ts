import { ChatManagerOptions, ChatMessage, ChatStateSnapshot } from "./types.js";

export class ChatManager {
  private readonly modelClient;
  private readonly maxMessages;
  private messages: ChatMessage[] = [];

  constructor(private readonly options: ChatManagerOptions) {
    this.modelClient = options.modelClient;
    this.maxMessages = options.maxMessages ?? 50;
  }

  get state(): ChatStateSnapshot {
    return { messages: [...this.messages] };
  }

  reset() {
    this.messages = [];
  }

  addUserMessage(content: string): ChatMessage {
    const msg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content,
      createdAt: Date.now()
    };
    this.messages.push(msg);
    this.truncate();
    return msg;
  }

  addModelMessage(content: string): ChatMessage {
    const msg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "model",
      content,
      createdAt: Date.now()
    };
    this.messages.push(msg);
    this.truncate();
    return msg;
  }

  private truncate() {
    if (this.messages.length > this.maxMessages) {
      this.messages = this.messages.slice(-this.maxMessages);
    }
  }

  async sendAndReceive(input: string, abortSignal?: AbortSignal): Promise<ChatMessage> {
    this.addUserMessage(input);
    const { text } = await this.modelClient.sendMessage(this.messages, input, abortSignal);
    return this.addModelMessage(text);
  }
}



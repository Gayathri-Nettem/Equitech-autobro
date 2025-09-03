export class ChatManager {
    options;
    modelClient;
    maxMessages;
    messages = [];
    constructor(options) {
        this.options = options;
        this.modelClient = options.modelClient;
        this.maxMessages = options.maxMessages ?? 50;
    }
    get state() {
        return { messages: [...this.messages] };
    }
    reset() {
        this.messages = [];
    }
    addUserMessage(content) {
        const msg = {
            id: crypto.randomUUID(),
            role: "user",
            content,
            createdAt: Date.now()
        };
        this.messages.push(msg);
        this.truncate();
        return msg;
    }
    addModelMessage(content) {
        const msg = {
            id: crypto.randomUUID(),
            role: "model",
            content,
            createdAt: Date.now()
        };
        this.messages.push(msg);
        this.truncate();
        return msg;
    }
    truncate() {
        if (this.messages.length > this.maxMessages) {
            this.messages = this.messages.slice(-this.maxMessages);
        }
    }
    async sendAndReceive(input, abortSignal) {
        this.addUserMessage(input);
        const { text } = await this.modelClient.sendMessage(this.messages, input, abortSignal);
        return this.addModelMessage(text);
    }
}

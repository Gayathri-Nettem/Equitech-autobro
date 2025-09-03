// Simple Gemini API client using fetch; easy to swap for LangGraph later
export class GeminiClient {
    apiKey;
    model;
    constructor(apiKey, model = "gemini-2.5-flash") {
        this.apiKey = apiKey;
        this.model = model;
    }
    async sendMessage(history, input, abortSignal) {
        const messages = [
            ...history.map(m => ({ role: m.role === "user" ? "user" : "model", parts: [{ text: m.content }] })),
            { role: "user", parts: [{ text: input }] }
        ];
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.model)}:generateContent?key=${encodeURIComponent(this.apiKey)}`;
        const body = {
            contents: messages
        };
        const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
            signal: abortSignal
        });
        if (!res.ok) {
            const text = await res.text().catch(() => "");
            throw new Error(`Gemini API error ${res.status}: ${text}`);
        }
        const data = await res.json();
        const candidate = data?.candidates?.[0];
        const text = candidate?.content?.parts?.[0]?.text ?? "(No response)";
        return { text };
    }
}
export function createDefaultGeminiClient() {
    const apiKey = "AIzaSyCAuEUHEhPbnM9tC397GVQbx2Lkx6R3nP4"; // Replace at runtime or via storage later
    return new GeminiClient(apiKey);
}

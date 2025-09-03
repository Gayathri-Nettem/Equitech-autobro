import { ChatManager } from "./chat.js";
import { createDefaultGeminiClient } from "./api.js";
function qs(sel) {
    const el = document.querySelector(sel);
    if (!el)
        throw new Error(`Missing element: ${sel}`);
    return el;
}
const chatArea = qs("#chat");
const form = qs("#composer");
const input = qs("#message-input");
const sendBtn = qs("#send-btn");
const manager = new ChatManager({ modelClient: createDefaultGeminiClient() });
function renderMessage(msg) {
    const div = document.createElement("div");
    div.className = `bubble ${msg.role}`;
    div.textContent = msg.content;
    chatArea.appendChild(div);
}
function renderAll() {
    chatArea.innerHTML = "";
    for (const msg of manager.state.messages)
        renderMessage(msg);
    chatArea.scrollTop = chatArea.scrollHeight;
}
async function handleSubmit(e) {
    e.preventDefault();
    const value = input.value.trim();
    if (!value)
        return;
    // Optimistically render the user message before awaiting API
    manager.addUserMessage(value);
    input.value = "";
    renderAll();
    sendBtn.disabled = true;
    try {
        const historyWithoutCurrent = manager.state.messages.slice(0, -1);
        const controller = new AbortController();
        const { text } = await createDefaultGeminiClient().sendMessage(historyWithoutCurrent, value, controller.signal);
        manager.addModelMessage(text);
    }
    catch (err) {
        manager.addModelMessage(`Error: ${err.message}`);
    }
    finally {
        sendBtn.disabled = false;
        renderAll();
    }
}
form.addEventListener("submit", handleSubmit);
// Initial system hint
manager.addModelMessage("Hi! I'm your Gemini-powered assistant. Ask me anything.");
renderAll();

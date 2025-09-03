import { ChatManager } from "./chat.js";
import { createDefaultGeminiClient } from "./api.js";
// Lightweight Markdown -> HTML converter (handles code blocks, inline code,
// bold, italics, links, and paragraphs). This avoids external deps so the
// UI works in restricted environments.
function escapeHtml(s) {
    return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function markdownToHtml(md) {
    if (!md)
        return '';
    // Extract code blocks first
    const codeBlocks = [];
    const placeholder = '%%CODE_BLOCK_';
    md = md.replace(/```([\s\S]*?)```/g, (_, code) => {
        const idx = codeBlocks.push(code) - 1;
        return `${placeholder}${idx}%%`;
    });
    // Escape the remaining text
    let out = escapeHtml(md);
    // Links: [text](url)
    out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, text, url) => `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${text}</a>`);
    // Bold **text**
    out = out.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    // Italic *text*
    out = out.replace(/\*(.+?)\*/g, '<em>$1</em>');
    // Inline code `code`
    out = out.replace(/`([^`]+)`/g, (_, code) => `<code>${escapeHtml(code)}</code>`);
    // Paragraphs: split on double newlines
    const paragraphs = out.split(/\n{2,}/).map(p => p.replace(/\n/g, '<br>'));
    out = paragraphs.map(p => `<p>${p}</p>`).join('');
    // Restore code blocks (escaped inside <pre><code>)
    out = out.replace(new RegExp(`${placeholder}(\d+)%%`, 'g'), (_, idx) => {
        const code = codeBlocks[Number(idx)] || '';
        return `<pre><code>${escapeHtml(code)}</code></pre>`;
    });
    return out;
}
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
async function renderMessage(msg) {
    const div = document.createElement("div");
    div.className = `bubble ${msg.role}`;
    if (msg.role === "model") {
        try {
            div.innerHTML = markdownToHtml(msg.content);
        }
        catch (err) {
            div.textContent = msg.content;
            // eslint-disable-next-line no-console
            console.error('markdownToHtml failed', err);
        }
    }
    else {
        div.textContent = msg.content;
    }
    chatArea.appendChild(div);
}
async function renderAll() {
    chatArea.innerHTML = "";
    for (const msg of manager.state.messages)
        await renderMessage(msg);
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
    await renderAll();
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
        await renderAll();
    }
}
form.addEventListener("submit", handleSubmit);
// Initial system hint
manager.addModelMessage("Hi! I'm your Gemini-powered assistant. Ask me anything.");
void renderAll();

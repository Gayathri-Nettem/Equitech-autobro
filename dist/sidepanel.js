import { LangGraphLikeWorkflow } from "./workflow.js";
function qs(sel) {
    const el = document.querySelector(sel);
    if (!el)
        throw new Error(`Missing element: ${sel}`);
    return el;
}
const appMain = qs("#chat");
const form = qs("#composer");
const input = qs("#message-input");
// No extra sections; everything renders inside the chat as bubbles
function renderMarkdown(md) {
    const esc = (s) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' }[c]));
    // a very tiny markdown renderer (headers and newlines)
    return md
        .replace(/^### (.*)$/gm, '<h3>$1<\/h3>')
        .replace(/^## (.*)$/gm, '<h2>$1<\/h2>')
        .replace(/^# (.*)$/gm, '<h1>$1<\/h1>')
        .split(/\n\n+/).map(p => `<p>${esc(p).replace(/\n/g, '<br>')}<\/p>`).join('');
}
// Lightweight Markdown -> HTML converter (includes code blocks/inline code/links/bold/italic)
function markdownToHtml(md) {
    if (!md)
        return '';
    const esc = (s) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' }[c]));
    const codeBlocks = [];
    const placeholder = '%%CODE_BLOCK_';
    md = md.replace(/```([\s\S]*?)```/g, (_, code) => {
        const idx = codeBlocks.push(code) - 1;
        return `${placeholder}${idx}%%`;
    });
    let out = md;
    out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, text, url) => `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${text}</a>`);
    out = out.replace(/\*\*(.+?)\*\*/g, '<strong>$1<\/strong>');
    out = out.replace(/\*(.+?)\*/g, '<em>$1<\/em>');
    out = out.replace(/`([^`]+)`/g, (_, code) => `<code>${esc(code)}<\/code>`);
    const paragraphs = out.split(/\n{2,}/).map(p => p.replace(/\n/g, '<br>'));
    out = paragraphs.map(p => `<p>${p}<\/p>`).join('');
    out = out.replace(new RegExp(`${placeholder}(\n|\r)?(\d+)%?%`, 'g'), (_m, _nl, idx) => {
        const code = codeBlocks[Number(idx)] || '';
        return `<pre><code>${esc(code)}<\/code><\/pre>`;
    });
    return out;
}
// Removed plan/progress/final panels; messages stream into the chat
async function renderMessages(messages) {
    appMain.innerHTML = "";
    for (const msg of messages) {
        const div = document.createElement("div");
        const roleClass = msg.role === "user" ? "user" : "model";
        div.className = `bubble ${roleClass}`;
        if (roleClass === "model") {
            try {
                div.innerHTML = markdownToHtml(msg.content);
            }
            catch {
                div.textContent = msg.content;
            }
        }
        else {
            div.textContent = msg.content;
        }
        appMain.appendChild(div);
    }
    appMain.scrollTop = appMain.scrollHeight;
}
const workflow = new LangGraphLikeWorkflow();
form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const goal = input.value.trim();
    if (!goal)
        return;
    input.value = "";
    const controller = new AbortController();
    await workflow.run(goal, (state) => {
        void renderMessages(state.messages);
    }, controller.signal);
});

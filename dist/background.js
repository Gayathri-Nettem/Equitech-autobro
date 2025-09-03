"use strict";
// Background script to handle Chrome API calls
console.log("Background script loaded");
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("Background received message:", request);
    if (request.action === "executeScript") {
        handleExecuteScript(request, sendResponse);
        return true; // Keep message channel open for async response
    }
    if (request.action === "getActiveTab") {
        handleGetActiveTab(sendResponse);
        return true;
    }
    if (request.action === "updateTab") {
        handleUpdateTab(request, sendResponse);
        return true;
    }
    // Handle unknown actions
    console.log("Unknown action:", request.action);
    sendResponse({ success: false, error: "Unknown action" });
    return true;
});
async function handleExecuteScript(request, sendResponse) {
    try {
        console.log("Executing script:", request);
        const results = await chrome.scripting.executeScript({
            target: { tabId: request.tabId },
            func: request.func,
            args: request.args || []
        });
        console.log("Script execution results:", results);
        sendResponse({ success: true, results });
    }
    catch (error) {
        console.error("Script execution error:", error);
        sendResponse({ success: false, error: error.message });
    }
}
async function handleGetActiveTab(sendResponse) {
    try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        console.log("Found tabs:", tabs);
        if (!tabs || tabs.length === 0) {
            sendResponse({ success: false, error: "No active tab found" });
            return;
        }
        const tab = tabs[0];
        sendResponse({ success: true, tabId: tab.id });
    }
    catch (error) {
        console.error("Get active tab error:", error);
        sendResponse({ success: false, error: error.message });
    }
}
async function handleUpdateTab(request, sendResponse) {
    try {
        await chrome.tabs.update(request.tabId, { url: request.url });
        sendResponse({ success: true });
    }
    catch (error) {
        console.error("Update tab error:", error);
        sendResponse({ success: false, error: error.message });
    }
}

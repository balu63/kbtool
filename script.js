// DOM elements
const messagesContainer = document.getElementById("messagesContainer");
const userInput = document.getElementById("userInput");
const sendBtn = document.getElementById("sendBtn");
const newChatBtn = document.getElementById("newChatBtn");
const chatHistoryDiv = document.getElementById("chatHistory");
const modelSelect = document.getElementById("modelSelect");
const mobileMenuBtn = document.getElementById("mobileMenuBtn");
const sidebar = document.querySelector(".sidebar");
const voiceInputBtn = document.getElementById("voiceInputBtn");
const voiceTriggerBtn = document.getElementById("voiceTriggerBtn");
const openImageGenBtn = document.getElementById("openImageGenBtn");
const imageModal = document.getElementById("imageModal");
const closeModal = document.querySelector(".close-modal");
const generateImageBtn = document.getElementById("generateImageBtn");
const imagePrompt = document.getElementById("imagePrompt");
const imageResult = document.getElementById("imageResult");
const loginBtn = document.getElementById("loginBtn");
const signupBtn = document.getElementById("signupBtn");
const authCta = document.getElementById("authCta");
const searchChats = document.getElementById("searchChats");

// State
let currentChatId = Date.now().toString();
let chats = {
  [currentChatId]: { title: "New Chat", messages: [] },
};
let isWaiting = false;
let recognition = null;

// Load / Save
function loadChats() {
  const stored = localStorage.getItem("kb_tool_chats");
  if (stored) {
    chats = JSON.parse(stored);
    if (!chats[currentChatId])
      currentChatId = Object.keys(chats)[0] || Date.now().toString();
  }
  renderHistory();
  renderMessages();
}
function saveChats() {
  localStorage.setItem("kb_tool_chats", JSON.stringify(chats));
}

// Render chat history
function renderHistory() {
  chatHistoryDiv.innerHTML = "";
  const sorted = Object.entries(chats).sort((a, b) => b[0] - a[0]);
  for (const [id, chat] of sorted) {
    if (
      searchChats.value &&
      !chat.title.toLowerCase().includes(searchChats.value.toLowerCase())
    )
      continue;
    const div = document.createElement("div");
    div.className = `history-item ${currentChatId === id ? "active" : ""}`;
    div.innerHTML = `<span>${escapeHtml(chat.title.slice(0, 30))}</span><button class="delete-chat" data-id="${id}">🗑️</button>`;
    div.querySelector("span").onclick = () => switchChat(id);
    div.querySelector(".delete-chat").onclick = (e) => {
      e.stopPropagation();
      deleteChat(id);
    };
    chatHistoryDiv.appendChild(div);
  }
}
searchChats?.addEventListener("input", () => renderHistory());

function switchChat(id) {
  currentChatId = id;
  renderHistory();
  renderMessages();
  saveChats();
}
function deleteChat(id) {
  delete chats[id];
  if (Object.keys(chats).length === 0) {
    const newId = Date.now().toString();
    chats[newId] = { title: "New Chat", messages: [] };
    currentChatId = newId;
  } else if (id === currentChatId) currentChatId = Object.keys(chats)[0];
  saveChats();
  renderHistory();
  renderMessages();
}

function renderMessages() {
  const chat = chats[currentChatId];
  if (!chat) return;
  messagesContainer.innerHTML = "";
  if (chat.messages.length === 0) {
    messagesContainer.innerHTML = `<div class="welcome-screen"><div class="welcome-icon">✨</div><h2>What are you working on?</h2><div class="suggestion-chips"><button class="chip">Write a Python script</button><button class="chip">Explain quantum computing</button><button class="chip">Help with resume</button><button class="chip">Generate a story</button></div><div class="auth-cta"><p>Get responses tailored to you</p><button class="cta-login">Log in</button></div></div>`;
    document.querySelectorAll(".chip").forEach(
      (chip) =>
        (chip.onclick = () => {
          userInput.value = chip.innerText;
          sendMessage();
        }),
    );
    document
      .querySelector(".cta-login")
      ?.addEventListener("click", () => alert("Login feature coming soon"));
    return;
  }
  chat.messages.forEach((msg) =>
    appendMessageToDOM(msg.role, msg.content, false),
  );
  scrollToBottom();
}

function appendMessageToDOM(role, content, scroll = true) {
  const msgDiv = document.createElement("div");
  msgDiv.className = `message ${role}`;
  const contentDiv = document.createElement("div");
  contentDiv.className = "message-content";
  if (role === "assistant") {
    contentDiv.innerHTML = formatMessage(content);
    attachCopyHandlers(contentDiv);
  } else contentDiv.innerText = content;
  msgDiv.appendChild(contentDiv);
  messagesContainer.appendChild(msgDiv);
  if (scroll) scrollToBottom();
}

function formatMessage(text) {
  let formatted = text.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    const escaped = escapeHtml(code.trim());
    return `<div class="code-block-wrapper"><button class="copy-code-btn" data-code="${encodeURIComponent(escaped)}">Copy</button><pre><code class="language-${lang || "plaintext"}">${escaped}</code></pre></div>`;
  });
  formatted = formatted.replace(
    /`([^`]+)`/g,
    '<code class="inline-code">$1</code>',
  );
  formatted = formatted.replace(/\n/g, "<br>");
  return formatted;
}

function attachCopyHandlers(container) {
  container.querySelectorAll(".copy-code-btn").forEach((btn) => {
    btn.onclick = () => {
      const code = decodeURIComponent(btn.dataset.code);
      navigator.clipboard.writeText(code);
      btn.textContent = "Copied!";
      setTimeout(() => (btn.textContent = "Copy"), 1500);
    };
  });
}

function escapeHtml(str) {
  return str.replace(
    /[&<>]/g,
    (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[m],
  );
}
function scrollToBottom() {
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Send message with streaming
async function sendMessage() {
  const text = userInput.value.trim();
  if (!text || isWaiting) return;
  if (!chats[currentChatId]) {
    const newId = Date.now().toString();
    chats[newId] = { title: "New Chat", messages: [] };
    currentChatId = newId;
    saveChats();
    renderHistory();
  }
  const userMsg = { role: "user", content: text };
  chats[currentChatId].messages.push(userMsg);
  saveChats();
  appendMessageToDOM("user", text);
  if (chats[currentChatId].messages.length === 1) {
    chats[currentChatId].title = text.slice(0, 30);
    renderHistory();
  }
  userInput.value = "";
  isWaiting = true;
  const typingDiv = document.createElement("div");
  typingDiv.className = "message assistant typing";
  typingDiv.innerHTML = `<div class="message-content typing-indicator"><span></span><span></span><span></span></div>`;
  messagesContainer.appendChild(typingDiv);
  scrollToBottom();
  const history = chats[currentChatId].messages
    .slice(-10)
    .map((m) => ({ role: m.role, content: m.content }));
  const model = modelSelect.value;
  try {
    const response = await fetch("http://localhost:3000/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: history, model }),
    });
    typingDiv.remove();
    const assistantDiv = document.createElement("div");
    assistantDiv.className = "message assistant";
    const contentDiv = document.createElement("div");
    contentDiv.className = "message-content";
    assistantDiv.appendChild(contentDiv);
    messagesContainer.appendChild(assistantDiv);
    let full = "";
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value);
      const lines = chunk.split("\n");
      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6);
          if (data === "[DONE]") continue;
          try {
            const json = JSON.parse(data);
            if (json.content) {
              full += json.content;
              contentDiv.innerHTML = formatMessage(full);
              attachCopyHandlers(contentDiv);
              scrollToBottom();
            }
          } catch (e) {}
        }
      }
    }
    chats[currentChatId].messages.push({ role: "assistant", content: full });
    saveChats();
  } catch (err) {
    typingDiv.remove();
    appendMessageToDOM(
      "assistant",
      "❌ Error: Backend not running or API key invalid.",
      true,
    );
  }
  isWaiting = false;
  userInput.focus();
}

// Voice input
function initVoice() {
  if (!("webkitSpeechRecognition" in window)) {
    console.warn("Voice not supported");
    return;
  }
  recognition = new webkitSpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.lang = "en-US";
  recognition.onresult = (e) => {
    const transcript = e.results[0][0].transcript;
    userInput.value = transcript;
    sendMessage();
  };
  recognition.onerror = (e) => console.error(e);
}
function startVoice() {
  if (recognition) recognition.start();
}
voiceInputBtn?.addEventListener("click", startVoice);
voiceTriggerBtn?.addEventListener("click", startVoice);
initVoice();

// Image generation (OpenRouter)
openImageGenBtn?.addEventListener(
  "click",
  () => (imageModal.style.display = "flex"),
);
closeModal?.addEventListener(
  "click",
  () => (imageModal.style.display = "none"),
);
window.onclick = (e) => {
  if (e.target == imageModal) imageModal.style.display = "none";
};
generateImageBtn?.addEventListener("click", async () => {
  const prompt = imagePrompt.value;
  if (!prompt) return;
  imageResult.innerHTML = "Generating...";
  try {
    const res = await fetch("http://localhost:3000/generate-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });
    const data = await res.json();
    if (data.imageUrl)
      imageResult.innerHTML = `<img src="${data.imageUrl}" style="max-width:100%">`;
    else imageResult.innerHTML = "Failed to generate.";
  } catch (e) {
    imageResult.innerHTML = "Error. Check backend.";
  }
});

// Auth mock
loginBtn?.addEventListener("click", () =>
  alert("Login functionality can be added with JWT. For now, mock."),
);
signupBtn?.addEventListener("click", () => alert("Sign up mock."));
document
  .querySelectorAll(".cta-login")
  .forEach((btn) => (btn.onclick = () => alert("Login")));

// Mobile sidebar
mobileMenuBtn?.addEventListener("click", () =>
  sidebar.classList.toggle("open"),
);

// New chat
newChatBtn.addEventListener("click", () => {
  const newId = Date.now().toString();
  chats[newId] = { title: "New Chat", messages: [] };
  currentChatId = newId;
  saveChats();
  renderHistory();
  renderMessages();
  userInput.focus();
});

sendBtn.addEventListener("click", sendMessage);
userInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});
loadChats();
userInput.focus();

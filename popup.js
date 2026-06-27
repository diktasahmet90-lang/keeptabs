// KeepTabs — all data lives in chrome.storage.local, on the device. No server, no account.

document.addEventListener("DOMContentLoaded", init);

async function init() {
  refreshTabCount();
  render();
  document.getElementById("saveBtn").addEventListener("click", onSave);
  document.getElementById("backupBtn").addEventListener("click", onBackup);
  document.getElementById("folderName").addEventListener("keydown", (e) => {
    if (e.key === "Enter") onSave();
  });
}

// --- Helpers: tabs & storage ---
async function getCurrentTabs() {
  return await chrome.tabs.query({ currentWindow: true });
}
async function getFolders() {
  const { folders } = await chrome.storage.local.get({ folders: [] });
  return folders;
}
async function setFolders(folders) {
  await chrome.storage.local.set({ folders });
}

async function refreshTabCount() {
  const tabs = await getCurrentTabs();
  document.getElementById("tabCount").textContent = tabs.length;
}

// --- Save ---
async function onSave() {
  const input = document.getElementById("folderName");
  let name = input.value.trim();
  const tabs = await getCurrentTabs();
  if (tabs.length === 0) return;
  if (!name) name = "Folder " + new Date().toLocaleDateString("en-US");

  const folder = {
    id: Date.now().toString(),
    name,
    createdAt: Date.now(),
    tabs: tabs.map((t) => ({
      title: t.title || t.url,
      url: t.url,
      favIconUrl: t.favIconUrl || "",
    })),
  };

  const folders = await getFolders();
  folders.unshift(folder);
  await setFolders(folders);
  input.value = "";
  render();
}

// --- Open ---
async function openFolder(id) {
  const folders = await getFolders();
  const f = folders.find((x) => x.id === id);
  if (!f) return;
  for (const t of f.tabs) {
    try { await chrome.tabs.create({ url: t.url, active: false }); } catch (e) {}
  }
}
function openSingle(url) {
  chrome.tabs.create({ url, active: true });
}

// --- Delete (irreversible -> confirm first, per our "never lose your tabs" promise) ---
async function deleteFolder(id) {
  if (!confirm("Are you sure you want to delete this folder? This can't be undone.")) return;
  let folders = await getFolders();
  folders = folders.filter((x) => x.id !== id);
  await setFolders(folders);
  render();
}

// --- Backup (one-click JSON download) ---
async function onBackup() {
  const folders = await getFolders();
  const blob = new Blob([JSON.stringify(folders, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "keeptabs-backup-" + new Date().toISOString().slice(0, 10) + ".json";
  a.click();
  URL.revokeObjectURL(url);
}

// --- Render ---
async function render() {
  const folders = await getFolders();
  const wrap = document.getElementById("folders");
  const empty = document.getElementById("empty");
  wrap.innerHTML = "";

  if (folders.length === 0) {
    empty.style.display = "block";
    return;
  }
  empty.style.display = "none";

  for (const f of folders) {
    const card = document.createElement("div");
    card.className = "folder";

    // Header row
    const head = document.createElement("div");
    head.className = "folder-head";

    const title = document.createElement("button");
    title.className = "folder-title";
    const chev = document.createElement("span");
    chev.className = "chev";
    chev.textContent = "▸";
    const count = document.createElement("span");
    count.className = "count";
    count.textContent = " (" + f.tabs.length + ")";
    title.append(chev, document.createTextNode(" 📁 " + f.name), count);

    const actions = document.createElement("div");
    actions.className = "folder-actions";
    const openBtn = document.createElement("button");
    openBtn.className = "mini";
    openBtn.textContent = "Open all";
    openBtn.addEventListener("click", () => openFolder(f.id));
    const delBtn = document.createElement("button");
    delBtn.className = "mini danger";
    delBtn.textContent = "🗑";
    delBtn.title = "Delete";
    delBtn.addEventListener("click", () => deleteFolder(f.id));
    actions.append(openBtn, delBtn);

    head.append(title, actions);

    // Tab list (collapsed by default)
    const list = document.createElement("div");
    list.className = "tab-list";
    list.style.display = "none";
    for (const t of f.tabs) {
      const link = document.createElement("button");
      link.className = "tab-link";
      link.title = t.url;
      const img = document.createElement("img");
      img.className = "fav";
      img.src = t.favIconUrl || "";
      img.addEventListener("error", () => { img.style.visibility = "hidden"; });
      const span = document.createElement("span");
      span.textContent = t.title || t.url;
      link.append(img, span);
      link.addEventListener("click", () => openSingle(t.url));
      list.append(link);
    }

    // Click title -> expand/collapse
    title.addEventListener("click", () => {
      const isOpen = list.style.display !== "none";
      list.style.display = isOpen ? "none" : "block";
      chev.textContent = isOpen ? "▸" : "▾";
    });

    card.append(head, list);
    wrap.append(card);
  }
}

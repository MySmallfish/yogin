import { renderMarkdown } from "../shared/markdown.js";

const root = document.getElementById("legal-content");
const mdPath = document.body.dataset.md || "";
const title = document.body.dataset.title || "";

if (title) {
  document.title = title;
}

async function loadMarkdown() {
  if (!root || !mdPath) return;
  try {
    const response = await fetch(mdPath);
    const text = await response.text();
    root.innerHTML = renderMarkdown(text);
  } catch {
    root.textContent = "Unable to load document.";
  }
}

loadMarkdown();

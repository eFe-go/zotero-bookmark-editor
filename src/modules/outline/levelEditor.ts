import { config } from "../../../package.json";
import { getString } from "../../utils/locale";
import {
  loadOutlineFromJSON,
  saveOutlineToJSON,
  createTreeNodes,
  DEFAULT_BASE_FONT_SIZE,
  loadOutlineInfoFromJSON,
  updateOutlineFontSize,
  registerOutlineCSS,
  registerThemeChange,
} from "./outline";
import {
  initEventListener,
  moveNodeUp,
  moveNodeDown,
  nestNode,
  unnestNode,
} from "./events";
import { ICONS } from "./style";

const WINDOW_NAME = "bookmark-editor-level-editor";

/**
 * Open the standalone Level Editor window for the current PDF reader.
 * Renders the outline tree at full width, with explicit movement buttons
 * per node (up / down / nest / unnest), plus Save / Discard footer.
 */
export async function openLevelEditor(
  reader: _ZoteroTypes.ReaderInstance,
): Promise<void> {
  const item = reader._item;
  if (!item) return;

  // Block if another instance is already open
  if (addon.data.levelEditorOpen) return;
  addon.data.levelEditorOpen = true;

  const treeData = (await loadOutlineFromJSON(item)) ?? [];
  const outlineInfo = await loadOutlineInfoFromJSON(item);
  const baseFontSize = outlineInfo?.baseFontSize ?? DEFAULT_BASE_FONT_SIZE;

  const mainWindow = Zotero.getMainWindow();
  const dlg = mainWindow.openDialog(
    `chrome://${config.addonRef}/content/level-editor.xhtml`,
    WINDOW_NAME,
    "chrome,centerscreen,resizable,width=1000,height=700,dialog=no",
  );

  if (!dlg) {
    addon.data.levelEditorOpen = false;
    return;
  }

  let dirty = false;
  const markDirty = () => {
    dirty = true;
  };

  dlg.addEventListener("load", () => {
    const doc = dlg.document;

    // Localized labels
    const titleEl = doc.getElementById("le-title-text");
    if (titleEl) titleEl.textContent = getString("level-editor-title");
    const saveBtn = doc.getElementById("level-editor-save");
    if (saveBtn) saveBtn.textContent = getString("level-editor-save");
    const discardBtn = doc.getElementById("level-editor-discard");
    if (discardBtn) discardBtn.textContent = getString("level-editor-discard");

    // Inject all the outline CSS rules (tree-list, tree-node, level-N, etc.)
    // into the modal so the tree looks identical to the sidebar.
    registerOutlineCSS(doc);
    registerThemeChange(dlg);
    updateOutlineFontSize(doc, baseFontSize);

    const rootList = doc.getElementById("root-list");
    if (rootList) {
      createTreeNodes(treeData, rootList, doc);
      injectActionButtons(doc);
      // Reuse all tree handlers (drag, drop, keyboard shortcuts, click).
      // initEventListener depends on #j-outline-viewer + #root-list being in the doc.
      initEventListener(reader, doc);
    }

    // Track edits to ask before discarding
    rootList?.addEventListener("click", markDirty, { capture: true });
    rootList?.addEventListener("dragend", markDirty, { capture: true });
    rootList?.addEventListener("keydown", markDirty, { capture: true });

    saveBtn?.addEventListener("click", async () => {
      await persistAndSync(reader, doc);
      dlg.close();
    });

    discardBtn?.addEventListener("click", () => {
      if (dirty) {
        const ok = dlg.confirm(getString("level-editor-discard-confirm"));
        if (!ok) return;
      }
      dlg.close();
    });
  });

  dlg.addEventListener("unload", () => {
    addon.data.levelEditorOpen = false;
  });
}

/**
 * Inject 4 buttons (up / down / nest / unnest) next to every tree-node
 * inside the document. New nodes added later (via drag/drop or keyboard)
 * will be wrapped through a MutationObserver.
 */
function injectActionButtons(doc: Document): void {
  function wrap(treeNode: Element) {
    if (treeNode.querySelector(".tree-node-actions")) return;
    const li = treeNode.closest("li") as HTMLLIElement | null;
    if (!li) return;
    const span = doc.createElement("span");
    span.className = "tree-node-actions";
    span.innerHTML = `
      <button data-action="up" title="${getString("level-editor-move-up")}">${ICONS.arrowUp}</button>
      <button data-action="down" title="${getString("level-editor-move-down")}">${ICONS.arrowDown}</button>
      <button data-action="unnest" title="${getString("level-editor-unnest")}">${ICONS.arrowLeft}</button>
      <button data-action="nest" title="${getString("level-editor-nest")}">${ICONS.arrowRight}</button>
    `;
    span.addEventListener("click", async (ev) => {
      const btn = (ev.target as HTMLElement).closest("button");
      if (!btn) return;
      ev.stopPropagation();
      const action = btn.getAttribute("data-action");
      switch (action) {
        case "up":
          await moveNodeUp(li);
          break;
        case "down":
          await moveNodeDown(li);
          break;
        case "nest":
          await nestNode(li);
          break;
        case "unnest":
          await unnestNode(li);
          break;
      }
    });
    treeNode.appendChild(span);
  }

  doc.querySelectorAll<HTMLElement>(".tree-node").forEach(wrap);

  // Pick up new nodes inserted later by the tree-add or drag-drop flows.
  const root = doc.getElementById("root-list");
  if (!root) return;
  const observer = new (doc.defaultView as any).MutationObserver(
    (mutations: MutationRecord[]) => {
      for (const m of mutations) {
        m.addedNodes.forEach((n) => {
          if (!n || (n as Node).nodeType !== 1) return;
          const el = n as Element;
          el.querySelectorAll<HTMLElement>(".tree-node").forEach(wrap);
          if (el.classList?.contains("tree-node")) wrap(el);
        });
      }
    },
  );
  observer.observe(root, { childList: true, subtree: true });
}

/**
 * Read the tree currently rendered in `doc`, persist to JSON, and refresh
 * the sidebar of the open PDF reader so the user sees the changes immediately.
 */
async function persistAndSync(
  reader: _ZoteroTypes.ReaderInstance,
  modalDoc: Document,
): Promise<void> {
  // Serialize the tree present in the modal document (override of the
  // page-scoped getOutlineFromPage which assumes a single document).
  const rootList = modalDoc.getElementById("root-list");
  if (!rootList) return;
  const serialize = (ul: Element): OutlineNode[] => {
    const items = Array.from(
      ul.querySelectorAll(":scope > li.tree-item"),
    ) as HTMLLIElement[];
    return items.map((li: HTMLLIElement) => {
      const titleSpan = li.querySelector("span.node-title")!;
      const nodeDiv = li.querySelector("div.tree-node")!;
      const childUl = li.querySelector(":scope > ul");
      return {
        level: parseInt(nodeDiv.getAttribute("level") || "1"),
        title: titleSpan.textContent || "",
        page: parseInt(nodeDiv.getAttribute("page") || "1"),
        x: parseFloat(nodeDiv.getAttribute("x") || "0"),
        y: parseFloat(nodeDiv.getAttribute("y") || "0"),
        children: childUl ? serialize(childUl) : [],
        collapsed: li.classList.contains("collapsed"),
      };
    });
  };
  const outline = serialize(rootList);
  await saveOutlineToJSON(reader._item, outline);

  // Refresh the sidebar tree of the reader so it picks up the new state.
  const sidebarRoot = reader._iframeWindow?.document.getElementById(
    "root-list",
  );
  if (sidebarRoot) {
    sidebarRoot.innerHTML = "";
    createTreeNodes(outline, sidebarRoot, reader._iframeWindow!.document);
  }
}

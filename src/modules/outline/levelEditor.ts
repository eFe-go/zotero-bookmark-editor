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
  addNewNode,
  deleteSelectedNode,
  expandAll,
  collapseAll,
  makeNodeEditable,
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
    "chrome,centerscreen,resizable,width=1100,height=720,dialog=no",
  );

  if (!dlg) {
    addon.data.levelEditorOpen = false;
    return;
  }

  let dirty = false;
  const markDirty = () => {
    dirty = true;
    updateStatusBar(dlg.document);
  };

  dlg.addEventListener("load", () => {
    const doc = dlg.document;

    // Inject the outline CSS rules so .tree-list / .tree-node / level-N
    // are available; the modal CSS then overrides bullet/indent/font.
    registerOutlineCSS(doc);
    registerThemeChange(dlg);
    updateOutlineFontSize(doc, baseFontSize);

    setupLabels(doc);
    setupToolbarIcons(doc);
    setupImportDialogLabels(doc);

    const rootList = doc.getElementById("root-list");
    if (rootList) {
      createTreeNodes(treeData, rootList, doc);
      injectFolderFileIcons(doc);
      ensureDropIndicator(doc);
      // Reuse all tree handlers (drag, drop, keyboard shortcuts, click).
      initEventListener(reader, doc);
    }

    wireToolbar(doc, reader, markDirty);
    wireKeyboardShortcuts(doc, reader, markDirty, dlg);
    wireContextMenu(doc, markDirty);
    wireExportImport(doc, dlg, reader, markDirty);

    // Track edits to ask before discarding + update toolbar/status
    rootList?.addEventListener("click", () => {
      updateToolbarState(doc);
      updateStatusBar(doc);
    });
    rootList?.addEventListener("dragend", markDirty);
    rootList?.addEventListener("keydown", markDirty);

    // Observe DOM mutations to (a) keep folder/file icons on new nodes,
    // (b) mark dirty, (c) refresh status bar, (d) refresh toolbar state.
    const observer = new (doc.defaultView as any).MutationObserver(
      (mutations: MutationRecord[]) => {
        let touched = false;
        for (const m of mutations) {
          if (m.type === "childList" && m.addedNodes.length > 0) {
            touched = true;
            m.addedNodes.forEach((n) => {
              if (!n || (n as Node).nodeType !== 1) return;
              ensureFolderFileIcon(n as Element, doc);
              (n as Element)
                .querySelectorAll<HTMLElement>(".tree-node")
                .forEach((tn) => {
                  ensureFolderFileIcon(tn, doc);
                  ensurePageNumber(tn, doc);
                });
              if ((n as Element).classList?.contains("tree-node")) {
                ensurePageNumber(n as HTMLElement, doc);
              }
            });
          }
          if (m.type === "childList" && m.removedNodes.length > 0) {
            touched = true;
          }
          if (
            m.type === "attributes" &&
            (m.attributeName === "level" || m.attributeName === "class")
          ) {
            // Class change may swap has-children — refresh icon
            const target = m.target as Element;
            if (target.classList?.contains("tree-item")) {
              ensureFolderFileIcon(target, doc);
            }
          }
        }
        if (touched) {
          dirty = true;
          updateStatusBar(doc);
          updateToolbarState(doc);
        }
      },
    );
    if (rootList) {
      observer.observe(rootList, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["class", "level"],
      });
    }

    // Footer buttons
    doc
      .getElementById("level-editor-save")
      ?.addEventListener("click", async () => {
        await persistAndSync(reader, doc);
        dirty = false;
        dlg.close();
      });
    doc
      .getElementById("level-editor-discard")
      ?.addEventListener("click", () => {
        if (dirty) {
          const ok = dlg.confirm(getString("level-editor-discard-confirm"));
          if (!ok) return;
        }
        dlg.close();
      });

    updateToolbarState(doc);
    updateStatusBar(doc);
  });

  dlg.addEventListener("unload", () => {
    addon.data.levelEditorOpen = false;
  });
}

/**
 * Set localized text on title, status, footer buttons, and toolbar button
 * tooltips. Status text gets filled later by updateStatusBar.
 */
function setupLabels(doc: Document): void {
  const set = (id: string, text: string) => {
    const el = doc.getElementById(id);
    if (el) el.textContent = text;
  };
  set("le-title-text", getString("level-editor-title"));
  set("level-editor-save", getString("level-editor-save"));
  set("level-editor-discard", getString("level-editor-discard"));

  const setTitle = (id: string, text: string) => {
    const el = doc.getElementById(id);
    if (el) el.setAttribute("title", text);
  };
  setTitle("le-btn-new-sibling", getString("level-editor-new-sibling"));
  setTitle("le-btn-new-child", getString("level-editor-new-child"));
  setTitle("le-btn-rename", getString("level-editor-rename"));
  setTitle("le-btn-delete", getString("level-editor-delete"));
  setTitle("le-btn-up", getString("level-editor-move-up"));
  setTitle("le-btn-down", getString("level-editor-move-down"));
  setTitle("le-btn-nest", getString("level-editor-nest"));
  setTitle("le-btn-unnest", getString("level-editor-unnest"));
  setTitle("le-btn-expand-all", getString("level-editor-expand-all"));
  setTitle("le-btn-collapse-all", getString("level-editor-collapse-all"));
  setTitle("le-btn-export-ai", getString("level-editor-export-ai"));
  setTitle("le-btn-import-json", getString("level-editor-import-json"));
}

/** Static text inside the import dialog overlay. */
function setupImportDialogLabels(doc: Document): void {
  const set = (id: string, text: string) => {
    const el = doc.getElementById(id);
    if (el) el.textContent = text;
  };
  set("le-import-title", getString("level-editor-import-title"));
  set("le-import-help", getString("level-editor-import-help"));
  set("le-import-cancel", getString("level-editor-import-cancel"));
  set("le-import-apply", getString("level-editor-import-apply"));
  const ta = doc.getElementById("le-import-textarea") as HTMLTextAreaElement | null;
  if (ta) ta.placeholder = getString("level-editor-import-placeholder");
}

/** Inject SVG icons into each toolbar button. */
function setupToolbarIcons(doc: Document): void {
  const icons: Array<[string, string]> = [
    ["le-btn-new-sibling", ICONS.insertSibling],
    ["le-btn-new-child", ICONS.insertChild],
    ["le-btn-rename", ICONS.rename],
    ["le-btn-delete", ICONS.del],
    ["le-btn-up", ICONS.arrowUp],
    ["le-btn-down", ICONS.arrowDown],
    ["le-btn-nest", ICONS.arrowRight],
    ["le-btn-unnest", ICONS.arrowLeft],
    ["le-btn-expand-all", ICONS.expand],
    ["le-btn-collapse-all", ICONS.collapse],
    ["le-btn-export-ai", ICONS.shareAI],
    ["le-btn-import-json", ICONS.pasteJSON],
  ];
  for (const [id, svg] of icons) {
    const el = doc.getElementById(id);
    if (el) el.innerHTML = svg;
  }
}

/** Wire toolbar button clicks to the matching tree operations. */
function wireToolbar(
  doc: Document,
  reader: _ZoteroTypes.ReaderInstance,
  markDirty: () => void,
): void {
  const click = (id: string, fn: (ev: Event) => void | Promise<void>) => {
    doc.getElementById(id)?.addEventListener("click", async (ev: Event) => {
      await fn(ev);
      markDirty();
      updateToolbarState(doc);
    });
  };

  click("le-btn-new-sibling", async (ev) => {
    await addNewNode(ev);
  });
  click("le-btn-new-child", async () => {
    // Simulate "create as child" by selecting first, then triggering ] (nest).
    // Easier: directly call addNewNode but with a synthetic flag won't work.
    // Instead: temporarily set the newNodeAsChild pref, call addNewNode, restore.
    const prevPref = Zotero.Prefs.get(
      `${config.prefsPrefix}.newNodeAsChild`,
      true,
    );
    Zotero.Prefs.set(`${config.prefsPrefix}.newNodeAsChild`, true, true);
    try {
      const fakeEv = new (doc.defaultView as any).Event("click");
      Object.defineProperty(fakeEv, "target", {
        value: doc.getElementById("root-list"),
      });
      await addNewNode(fakeEv);
    } finally {
      Zotero.Prefs.set(
        `${config.prefsPrefix}.newNodeAsChild`,
        prevPref as boolean,
        true,
      );
    }
  });
  click("le-btn-rename", () => {
    const selected = doc.querySelector(".node-selected") as HTMLElement | null;
    if (!selected) return;
    const titleEl = selected.querySelector(
      "span.node-title",
    ) as HTMLElement | null;
    if (titleEl) makeNodeEditable(titleEl);
  });
  click("le-btn-delete", async (ev) => {
    await deleteSelectedNode(ev);
  });
  click("le-btn-up", async () => {
    const li = getSelectedLi(doc);
    if (li) await moveNodeUp(li);
  });
  click("le-btn-down", async () => {
    const li = getSelectedLi(doc);
    if (li) await moveNodeDown(li);
  });
  click("le-btn-nest", async () => {
    const li = getSelectedLi(doc);
    if (li) await nestNode(li);
  });
  click("le-btn-unnest", async () => {
    const li = getSelectedLi(doc);
    if (li) await unnestNode(li);
  });
  click("le-btn-expand-all", async (ev) => {
    await expandAll(ev);
  });
  click("le-btn-collapse-all", async (ev) => {
    await collapseAll(ev);
  });
}

function getSelectedLi(doc: Document): HTMLLIElement | null {
  const selected = doc.querySelector(".node-selected");
  if (!selected) return null;
  return selected.closest("li.tree-item") as HTMLLIElement | null;
}

/** Enable / disable toolbar buttons based on current selection state. */
function updateToolbarState(doc: Document): void {
  const li = getSelectedLi(doc);
  const setDisabled = (id: string, disabled: boolean) => {
    const el = doc.getElementById(id) as HTMLButtonElement | null;
    if (el) el.disabled = disabled;
  };

  // Always enabled
  setDisabled("le-btn-new-sibling", false);
  setDisabled("le-btn-expand-all", false);
  setDisabled("le-btn-collapse-all", false);

  // Need a selection
  const noSel = !li;
  setDisabled("le-btn-new-child", noSel);
  setDisabled("le-btn-rename", noSel);
  setDisabled("le-btn-delete", noSel);
  if (!li) {
    setDisabled("le-btn-up", true);
    setDisabled("le-btn-down", true);
    setDisabled("le-btn-nest", true);
    setDisabled("le-btn-unnest", true);
    return;
  }

  const parent = li.parentElement as HTMLElement | null;
  const isFirst = !li.previousElementSibling;
  const isLast = !li.nextElementSibling;
  const isRoot = parent?.id === "root-list";

  setDisabled("le-btn-up", isFirst);
  setDisabled("le-btn-down", isLast);
  setDisabled("le-btn-nest", isFirst); // can't nest if no prev sibling
  setDisabled("le-btn-unnest", isRoot);
}

/** Refresh the "X bookmarks · Y levels · ● modified" status bar text. */
function updateStatusBar(doc: Document): void {
  const root = doc.getElementById("root-list");
  if (!root) return;
  const items = root.querySelectorAll("li.tree-item");
  const count = items.length;
  let maxLevel = 0;
  items.forEach((li) => {
    const lvl = parseInt(
      li.querySelector(".tree-node")?.getAttribute("level") || "1",
      10,
    );
    if (lvl > maxLevel) maxLevel = lvl;
  });

  const countTxt = getString("level-editor-status-count", {
    args: { count },
  });
  const levelsTxt = getString("level-editor-status-levels", {
    args: { levels: maxLevel },
  });

  const statusEl = doc.getElementById("le-status");
  if (statusEl) {
    statusEl.innerHTML = `${countTxt} · ${levelsTxt}`;
  }
}

/** F2 / Insert / Shift+Insert / Delete / Ctrl+S / Esc shortcuts. */
function wireKeyboardShortcuts(
  doc: Document,
  reader: _ZoteroTypes.ReaderInstance,
  markDirty: () => void,
  dlg: Window,
): void {
  doc.addEventListener(
    "keydown",
    async (ev: KeyboardEvent) => {
      // Ignore when typing inside contenteditable
      const target = ev.target as HTMLElement;
      if (
        target?.getAttribute &&
        target.getAttribute("contenteditable") === "true"
      ) {
        return;
      }

      if (ev.key === "F2") {
        ev.preventDefault();
        const selected = doc.querySelector(
          ".node-selected",
        ) as HTMLElement | null;
        const titleEl = selected?.querySelector(
          "span.node-title",
        ) as HTMLElement | null;
        if (titleEl) makeNodeEditable(titleEl);
      } else if (ev.key === "Insert" && !ev.shiftKey) {
        ev.preventDefault();
        const btn = doc.getElementById("le-btn-new-sibling");
        btn?.click();
      } else if (ev.key === "Insert" && ev.shiftKey) {
        ev.preventDefault();
        const btn = doc.getElementById("le-btn-new-child");
        btn?.click();
      } else if (ev.key === "s" && (ev.ctrlKey || ev.metaKey)) {
        ev.preventDefault();
        const btn = doc.getElementById("level-editor-save");
        btn?.click();
      } else if (ev.key === "Escape") {
        ev.preventDefault();
        const btn = doc.getElementById("level-editor-discard");
        btn?.click();
      }
    },
    true,
  );
}

/**
 * The sidebar renderTree() creates a div.drop-indicator that handleDragOver
 * / hideDropIndicator look for via doc.querySelector(".drop-indicator").
 * The modal uses createTreeNodes() directly, so we must inject one ourselves
 * — otherwise every dragover throws "dropIndicator is null".
 */
function ensureDropIndicator(doc: Document): void {
  if (doc.querySelector(".drop-indicator")) return;
  const indicator = doc.createElement("div");
  indicator.classList.add("drop-indicator");
  const viewer = doc.getElementById("j-outline-viewer");
  (viewer ?? doc.body).appendChild(indicator);
}

/**
 * Right-click on any row opens a context menu mirroring the toolbar
 * actions. Items get enabled/disabled per the same logic as the toolbar.
 */
function wireContextMenu(doc: Document, markDirty: () => void): void {
  const menu = doc.getElementById("le-context-menu");
  if (!menu) return;

  // Populate labels + icons once
  const items: Array<[string, string, string]> = [
    ["rename", "level-editor-rename", ICONS.rename],
    ["delete", "level-editor-delete", ICONS.del],
    ["new-sibling", "level-editor-new-sibling", ICONS.insertSibling],
    ["new-child", "level-editor-new-child", ICONS.insertChild],
    ["up", "level-editor-move-up", ICONS.arrowUp],
    ["down", "level-editor-move-down", ICONS.arrowDown],
    ["nest", "level-editor-nest", ICONS.arrowRight],
    ["unnest", "level-editor-unnest", ICONS.arrowLeft],
    ["expand-all", "level-editor-expand-all", ICONS.expand],
    ["collapse-all", "level-editor-collapse-all", ICONS.collapse],
  ];
  for (const [action, key, svg] of items) {
    const el = menu.querySelector(
      `.le-menu-item[data-action="${action}"]`,
    ) as HTMLElement | null;
    if (!el) continue;
    const label = el.querySelector(".le-menu-label") as HTMLElement | null;
    const icon = el.querySelector(".le-menu-icon") as HTMLElement | null;
    if (label) label.textContent = getString(key);
    if (icon) icon.innerHTML = svg;
  }

  const hide = () => {
    menu.classList.remove("visible");
  };

  // Show on right-click inside the tree
  const rootList = doc.getElementById("root-list");
  rootList?.addEventListener("contextmenu", (ev: Event) => {
    ev.preventDefault();
    const mouseEv = ev as MouseEvent;
    const targetRow = (mouseEv.target as Element).closest(
      ".tree-node",
    ) as HTMLElement | null;
    if (targetRow) {
      // Select the right-clicked row before showing the menu
      doc
        .querySelectorAll(".node-selected")
        .forEach((n) => n.classList.remove("node-selected"));
      targetRow.classList.add("node-selected");
      updateToolbarState(doc);
    }
    // Position the menu at the cursor, clamping to viewport
    const win = doc.defaultView!;
    const x = Math.min(
      mouseEv.clientX,
      win.innerWidth - menu.offsetWidth - 8 || mouseEv.clientX,
    );
    const y = Math.min(
      mouseEv.clientY,
      win.innerHeight - menu.offsetHeight - 8 || mouseEv.clientY,
    );
    (menu as HTMLElement).style.left = `${Math.max(4, x)}px`;
    (menu as HTMLElement).style.top = `${Math.max(4, y)}px`;
    menu.classList.add("visible");
    updateContextMenuState(doc, !!targetRow);
  });

  // Click on an item dispatches to the matching toolbar button
  menu.addEventListener("click", async (ev: Event) => {
    const item = (ev.target as Element).closest(
      ".le-menu-item",
    ) as HTMLElement | null;
    if (!item || item.classList.contains("disabled")) return;
    const action = item.getAttribute("data-action");
    hide();
    if (!action) return;
    const buttonId: Record<string, string> = {
      rename: "le-btn-rename",
      delete: "le-btn-delete",
      "new-sibling": "le-btn-new-sibling",
      "new-child": "le-btn-new-child",
      up: "le-btn-up",
      down: "le-btn-down",
      nest: "le-btn-nest",
      unnest: "le-btn-unnest",
      "expand-all": "le-btn-expand-all",
      "collapse-all": "le-btn-collapse-all",
    };
    const btn = doc.getElementById(buttonId[action]) as HTMLButtonElement | null;
    if (btn && !btn.disabled) btn.click();
    markDirty();
  });

  // Close on outside click / Escape / scroll
  doc.addEventListener("click", (ev: Event) => {
    if (!(ev.target as Element).closest("#le-context-menu")) hide();
  });
  doc.addEventListener("keydown", (ev: KeyboardEvent) => {
    if (ev.key === "Escape") hide();
  });
  doc
    .getElementById("level-editor-content")
    ?.addEventListener("scroll", hide, true);
}

/**
 * Reflect toolbar enable/disable state on the context menu items.
 * Mirrors updateToolbarState — keeps both menus in sync.
 */
function updateContextMenuState(doc: Document, hasRow: boolean): void {
  const menu = doc.getElementById("le-context-menu");
  if (!menu) return;
  const setDisabled = (action: string, disabled: boolean) => {
    const item = menu.querySelector(`.le-menu-item[data-action="${action}"]`);
    if (item) item.classList.toggle("disabled", disabled);
  };

  setDisabled("new-sibling", false);
  setDisabled("expand-all", false);
  setDisabled("collapse-all", false);

  if (!hasRow) {
    setDisabled("rename", true);
    setDisabled("delete", true);
    setDisabled("new-child", true);
    setDisabled("up", true);
    setDisabled("down", true);
    setDisabled("nest", true);
    setDisabled("unnest", true);
    return;
  }

  setDisabled("rename", false);
  setDisabled("delete", false);
  setDisabled("new-child", false);

  const li = getSelectedLi(doc);
  if (!li) return;
  const parent = li.parentElement as HTMLElement | null;
  const isFirst = !li.previousElementSibling;
  const isLast = !li.nextElementSibling;
  const isRoot = parent?.id === "root-list";
  setDisabled("up", isFirst);
  setDisabled("down", isLast);
  setDisabled("nest", isFirst);
  setDisabled("unnest", !!isRoot);
}

/** Insert a folder/file SVG and page number into every existing row. */
function injectFolderFileIcons(doc: Document): void {
  doc.querySelectorAll<HTMLElement>(".tree-node").forEach((tn) => {
    ensureFolderFileIcon(tn, doc);
    ensurePageNumber(tn, doc);
  });
}

/** Append a "p.NN" span at the right side of the row showing the page. */
function ensurePageNumber(row: HTMLElement, doc: Document): void {
  if (!row.classList?.contains("tree-node")) return;
  const page = row.getAttribute("page");
  if (!page) return;
  let pageEl = row.querySelector(":scope > .node-page") as HTMLSpanElement | null;
  const text = `p.${page}`;
  if (!pageEl) {
    pageEl = doc.createElement("span");
    pageEl.className = "node-page";
    pageEl.textContent = text;
    row.appendChild(pageEl);
  } else if (pageEl.textContent !== text) {
    pageEl.textContent = text;
  }
}

/**
 * Make sure the row has a .node-icon span with the right SVG depending on
 * whether the parent li has the .has-children class. Idempotent: replaces
 * the existing icon if the type changed.
 */
function ensureFolderFileIcon(el: Element, doc: Document): void {
  // If passed a <li>, find its child .tree-node
  let row: HTMLElement | null = null;
  if (el.classList?.contains("tree-node")) {
    row = el as HTMLElement;
  } else if (el.classList?.contains("tree-item")) {
    row = el.querySelector(":scope > .tree-node");
  } else {
    return;
  }
  if (!row) return;

  const li = row.closest("li.tree-item");
  const hasChildren = li?.classList.contains("has-children") ?? false;
  const wantSvg = hasChildren ? ICONS.folder : ICONS.file;

  let icon = row.querySelector(":scope > .node-icon") as HTMLSpanElement | null;
  if (!icon) {
    icon = doc.createElement("span");
    icon.className = "node-icon";
    // Insert AFTER the expander but BEFORE the node-content / node-title.
    // The DOM is tree-node > [expander, node-content > node-title], so we
    // anchor on whatever direct child of tree-node holds the title.
    const titleEl = row.querySelector("span.node-title");
    const anchor =
      titleEl && titleEl.parentNode && titleEl.parentNode !== row
        ? (titleEl.parentNode as Element)
        : titleEl;
    try {
      if (anchor && anchor.parentNode === row) {
        row.insertBefore(icon, anchor);
      } else {
        // Fallback: append at the end, the CSS still aligns it via flex.
        row.appendChild(icon);
      }
    } catch (_e) {
      row.appendChild(icon);
    }
  }
  // Cheap check: tag the icon with the current type to skip re-render
  if (icon.getAttribute("data-type") === (hasChildren ? "folder" : "file"))
    return;
  icon.setAttribute("data-type", hasChildren ? "folder" : "file");
  icon.innerHTML = wantSvg;
}

/**
 * Read the tree currently rendered in `doc`, persist to JSON, and refresh
 * the sidebar of the open PDF reader so the user sees the changes immediately.
 */
async function persistAndSync(
  reader: _ZoteroTypes.ReaderInstance,
  modalDoc: Document,
): Promise<void> {
  const rootList = modalDoc.getElementById("root-list");
  if (!rootList) return;
  // Compute level dynamically from DOM depth so we ignore any stale
  // `level` attribute left over from addNewNode / drag-drop / nest ops.
  // The sidebar relies on level-N CSS classes for the rainbow border,
  // so a wrong level here paints children with the parent's color.
  const serialize = (ul: Element, currentLevel: number): OutlineNode[] => {
    const items = Array.from(
      ul.querySelectorAll(":scope > li.tree-item"),
    ) as HTMLLIElement[];
    return items.map((li: HTMLLIElement) => {
      const titleSpan = li.querySelector("span.node-title")!;
      const nodeDiv = li.querySelector("div.tree-node")!;
      const childUl = li.querySelector(":scope > ul");
      return {
        level: currentLevel,
        title: titleSpan.textContent || "",
        page: parseInt(nodeDiv.getAttribute("page") || "1"),
        x: parseFloat(nodeDiv.getAttribute("x") || "0"),
        y: parseFloat(nodeDiv.getAttribute("y") || "0"),
        children: childUl ? serialize(childUl, currentLevel + 1) : [],
        collapsed: li.classList.contains("collapsed"),
      };
    });
  };
  const outline = serialize(rootList, 1);
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

/* ===================================================================
 * Export to AI / Import from JSON
 * ================================================================ */

type CleanNode = {
  title: string;
  page: number;
  children?: CleanNode[];
};

/** Read the modal DOM and produce a depth-clean OutlineNode[] array. */
function readOutlineFromModal(doc: Document): OutlineNode[] {
  const root = doc.getElementById("root-list");
  if (!root) return [];
  const walk = (ul: Element, level: number): OutlineNode[] => {
    const items = Array.from(
      ul.querySelectorAll(":scope > li.tree-item"),
    ) as HTMLLIElement[];
    return items.map((li) => {
      const titleSpan = li.querySelector("span.node-title")!;
      const nodeDiv = li.querySelector("div.tree-node")!;
      const childUl = li.querySelector(":scope > ul");
      return {
        level,
        title: titleSpan.textContent || "",
        page: parseInt(nodeDiv.getAttribute("page") || "1"),
        x: parseFloat(nodeDiv.getAttribute("x") || "0"),
        y: parseFloat(nodeDiv.getAttribute("y") || "0"),
        children: childUl ? walk(childUl, level + 1) : [],
        collapsed: li.classList.contains("collapsed"),
      };
    });
  };
  return walk(root, 1);
}

/** Strip level/x/y/collapsed so the JSON the user sees is minimal. */
function toCleanNodes(nodes: OutlineNode[]): CleanNode[] {
  return nodes.map((n) => {
    const out: CleanNode = { title: n.title, page: n.page };
    if (n.children && n.children.length > 0) {
      out.children = toCleanNodes(n.children);
    }
    return out;
  });
}

/** Reverse: fill back level/x/y so createTreeNodes is happy. */
function fromCleanNodes(
  nodes: CleanNode[],
  level: number,
): OutlineNode[] {
  return nodes.map((n) => {
    if (typeof n.title !== "string") {
      throw new Error("Each node needs a 'title' (string).");
    }
    if (typeof n.page !== "number" || !Number.isFinite(n.page)) {
      throw new Error(`Node '${n.title}' is missing a numeric 'page'.`);
    }
    const out: OutlineNode = {
      level,
      title: n.title,
      page: n.page,
      x: 0,
      y: 0,
      children: [],
    };
    if (Array.isArray(n.children) && n.children.length > 0) {
      out.children = fromCleanNodes(n.children, level + 1);
    }
    return out;
  });
}

/** Builds the text we put in the clipboard: prompt + JSON. */
function buildExportText(outline: OutlineNode[]): string {
  const clean = toCleanNodes(outline);
  const payload = {
    format: "zotero-bookmark-editor",
    version: 1,
    outline: clean,
  };
  const prompt = [
    "Necesito que me ayudes a expandir el indice de bookmarks de un PDF.",
    "Cada bookmark tiene: title (string), page (numero entero), children (array de bookmarks).",
    "La jerarquia se infiere de la anidacion en children. Maximo 7 niveles.",
    "",
    "INDICE ACTUAL (formato JSON):",
    "",
    "```json",
    JSON.stringify(payload, null, 2),
    "```",
    "",
    "INSTRUCCIONES:",
    "1. Sugerime que sub-secciones o capitulos agregar y donde.",
    "2. Devolveme SOLO el JSON valido completo con los cambios aplicados (sin texto extra, sin ```).",
    "3. Manten los page numbers existentes para los nodos que ya estaban.",
    "4. Para nodos nuevos sin page conocido, usa el page del nodo padre.",
  ].join("\n");
  return prompt;
}

/** Connect the export + import toolbar buttons. */
function wireExportImport(
  doc: Document,
  dlg: Window,
  _reader: _ZoteroTypes.ReaderInstance,
  markDirty: () => void,
): void {
  // --- Export ---
  doc.getElementById("le-btn-export-ai")?.addEventListener("click", async () => {
    const outline = readOutlineFromModal(doc);
    const text = buildExportText(outline);
    const ok = await copyToClipboard(text, dlg);
    showToast(
      doc,
      getString(ok ? "level-editor-copied" : "level-editor-copy-failed"),
    );
  });

  // --- Import: open overlay ---
  const overlay = doc.getElementById("le-import-overlay");
  const ta = doc.getElementById("le-import-textarea") as HTMLTextAreaElement | null;
  const errEl = doc.getElementById("le-import-error");
  const openOverlay = () => {
    if (!overlay) return;
    if (ta) ta.value = "";
    if (errEl) errEl.textContent = "";
    overlay.classList.add("visible");
    setTimeout(() => ta?.focus(), 50);
  };
  const closeOverlay = () => {
    overlay?.classList.remove("visible");
  };
  doc
    .getElementById("le-btn-import-json")
    ?.addEventListener("click", openOverlay);
  doc
    .getElementById("le-import-cancel")
    ?.addEventListener("click", closeOverlay);
  overlay?.addEventListener("click", (ev) => {
    if (ev.target === overlay) closeOverlay();
  });

  // --- Import: apply ---
  doc
    .getElementById("le-import-apply")
    ?.addEventListener("click", () => {
      if (!ta) return;
      const raw = ta.value.trim();
      if (!raw) return;
      if (errEl) errEl.textContent = "";

      let parsed: any;
      try {
        // Try to recover from ```json fences if the AI added them
        const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/```$/, "");
        parsed = JSON.parse(cleaned);
      } catch (e: any) {
        if (errEl) {
          errEl.textContent = getString("level-editor-import-invalid", {
            args: { error: e?.message || String(e) },
          });
        }
        return;
      }

      let nodes: CleanNode[];
      try {
        if (Array.isArray(parsed)) {
          nodes = parsed;
        } else if (parsed && Array.isArray(parsed.outline)) {
          nodes = parsed.outline;
        } else {
          throw new Error("Expected an array or an object with 'outline'.");
        }
        if (nodes.length === 0) {
          throw new Error("The outline is empty.");
        }
      } catch (e: any) {
        if (errEl) {
          errEl.textContent = getString("level-editor-import-invalid", {
            args: { error: e?.message || String(e) },
          });
        }
        return;
      }

      let outline: OutlineNode[];
      try {
        outline = fromCleanNodes(nodes, 1);
      } catch (e: any) {
        if (errEl) {
          errEl.textContent = getString("level-editor-import-invalid", {
            args: { error: e?.message || String(e) },
          });
        }
        return;
      }

      const ok = dlg.confirm(getString("level-editor-import-confirm"));
      if (!ok) return;

      const rootList = doc.getElementById("root-list");
      if (!rootList) return;
      rootList.innerHTML = "";
      createTreeNodes(outline, rootList, doc);
      injectFolderFileIcons(doc);

      const count = countNodes(outline);
      closeOverlay();
      markDirty();
      updateStatusBar(doc);
      updateToolbarState(doc);
      showToast(
        doc,
        getString("level-editor-import-success", { args: { count } }),
      );
    });
}

function countNodes(nodes: OutlineNode[]): number {
  let n = 0;
  for (const node of nodes) {
    n += 1;
    if (node.children) n += countNodes(node.children);
  }
  return n;
}

/** Toast that fades in for ~1.5s. */
function showToast(doc: Document, message: string): void {
  const toast = doc.getElementById("le-toast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("visible");
  const win = doc.defaultView!;
  win.setTimeout(() => toast.classList.remove("visible"), 1500);
}

/**
 * Try navigator.clipboard.writeText first; fall back to a hidden
 * <textarea> + execCommand("copy") which still works in privileged
 * Zotero chrome contexts.
 */
async function copyToClipboard(text: string, dlg: Window): Promise<boolean> {
  try {
    const nav = dlg.navigator as any;
    if (nav?.clipboard?.writeText) {
      await nav.clipboard.writeText(text);
      return true;
    }
  } catch (_e) {
    /* fall through */
  }
  try {
    const doc = dlg.document;
    const ta = doc.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.left = "-10000px";
    ta.style.top = "-10000px";
    doc.body.appendChild(ta);
    ta.select();
    const ok = doc.execCommand("copy");
    doc.body.removeChild(ta);
    return ok;
  } catch (_e) {
    return false;
  }
}

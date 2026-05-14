import { config } from "../package.json";
import { initLocale } from "./utils/locale";
import {
  registerPrefsPane,
  onPrefsWindowLoad,
  initPrefs,
} from "./modules/preferences/main";
import { createZToolkit } from "./utils/ztoolkit";
import { registerTab } from "./modules/notifier";

async function onStartup() {
  await Promise.all([
    Zotero.initializationPromise,
    Zotero.unlockPromise,
    Zotero.uiReadyPromise,
  ]);

  initLocale();
  ztoolkit.log("BookmarkEditor.onStartup: begin");

  registerPrefsPane();
  initPrefs();
  registerTab();

  // @ts-ignore - Not typed.
  await Zotero.Promise.delay(1000);
  await Promise.all(
    Zotero.getMainWindows().map((win) => onMainWindowLoad(win)),
  );
}

async function onMainWindowLoad(_win: Window): Promise<void> {
  addon.data.ztoolkit = createZToolkit();
}

function onShutdown(): void {
  ztoolkit.unregisterAll();
  addon.data.alive = false;
  // @ts-ignore - Plugin instance is not typed
  delete Zotero[config.addonInstance];
}

export default {
  onStartup,
  onShutdown,
  onMainWindowLoad,
  onPrefsWindowLoad,
};

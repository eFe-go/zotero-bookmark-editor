import { config } from "../../package.json";
import { getPref } from "../utils/prefs";
import { registerOutline } from "./outline";

/**
 * Registers the bookmark/outline editor in the Zotero PDF reader toolbar.
 * Triggered by the "renderToolbar" reader event on each opened tab.
 */
export function registerTab() {
  Zotero.Reader.registerEventListener(
    "renderToolbar",
    tabRegisterCallback,
    config.addonID,
  );
}

async function tabRegisterCallback(event: any) {
  if (getPref("enableBookmark")) {
    const { reader } = event;
    await registerOutline(reader.tabID);
  } else {
    ztoolkit.log("Bookmark editor is disabled (enableBookmark = false)");
  }
}

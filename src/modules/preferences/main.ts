import { config } from "../../../package.json";
import { getString } from "../../utils/locale";

export function registerPrefsPane() {
  Zotero.PreferencePanes.register({
    pluginID: config.addonID,
    src: `chrome://${config.addonRef}/content/preferences-main.xhtml`,
    label: getString("plugin-name"),
    image: `chrome://${config.addonRef}/content/icons/icon.png`,
  });
}

export async function onPrefsWindowLoad(_window: Window) {
  if (!addon.data.prefs) {
    addon.data.prefs = {
      window: _window,
    };
  } else {
    addon.data.prefs.window = _window;
  }
}

export async function initPrefs() {
  ztoolkit.log("Bookmark editor prefs initialized");
}

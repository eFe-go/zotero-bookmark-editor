import hooks from "./hooks";
import { createZToolkit } from "./utils/ztoolkit";
import { getOutlineFromPDF } from "./modules/outline/outline";

export type AddonAPI = {
  getOutlineFromPDF: typeof getOutlineFromPDF;
};

class Addon {
  public data: {
    alive: boolean;
    env: "development" | "production";
    ztoolkit: ZToolkit;
    locale?: {
      current: any;
    };
    prefs?: {
      window: Window;
    };
    windows: Record<string, Window>;
    levelEditorOpen?: boolean;
  };
  public hooks: typeof hooks;
  public api: AddonAPI;

  constructor() {
    this.data = {
      alive: true,
      env: __env__,
      ztoolkit: createZToolkit(),
      windows: {},
    };
    this.hooks = hooks;
    this.api = {
      getOutlineFromPDF,
    };
  }
}

export default Addon;

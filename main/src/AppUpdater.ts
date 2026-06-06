import { autoUpdater } from "electron-updater";
import type { ServerEvents } from "./server";
import type { UpdateInfo, UpdaterAction } from "../../ipc/types";

type UpdateInfoChange = (info: UpdateInfo) => void;

export class AppUpdater {
  private _checkedAtStartup = false;
  private _info: UpdateInfo = { state: "initial" };

  public readonly noAutoUpdatesReason: Extract<
    UpdateInfo,
    { state: "update-available" }
  >["noDownloadReason"] = null;

  get info() {
    return this._info;
  }

  set info(info: UpdateInfo) {
    this._info = info;
    this.server.sendEventTo("broadcast", {
      name: "MAIN->CLIENT::updater-state",
      payload: info,
    });
    this.onInfoChange?.(info);
  }

  constructor(
    private server: ServerEvents,
    private onInfoChange?: UpdateInfoChange,
  ) {
    setInterval(this.check, 16 * 60 * 60 * 1000);

    this.server.onEventAnyClient("CLIENT->MAIN::user-action", ({ action }) => {
      this.handleUserAction(action);
    });

    // https://www.electron.build/configuration/nsis.html#portable
    autoUpdater.autoDownload = !process.env.PORTABLE_EXECUTABLE_DIR;

    if (!autoUpdater.autoDownload || process.platform === "darwin") {
      this.noAutoUpdatesReason = "not-supported";
    } else if (process.argv.includes("--no-updates")) {
      autoUpdater.autoDownload = false;
      this.noAutoUpdatesReason = "disabled-by-flag";
    }

    autoUpdater.on("checking-for-update", () => {
      this.info = { state: "checking-for-update" };
    });
    autoUpdater.on("update-available", (info: { version: string }) => {
      this.info = {
        state: "update-available",
        version: info.version,
        noDownloadReason: this.noAutoUpdatesReason,
      };
    });
    autoUpdater.on("update-not-available", () => {
      this.info = { state: "update-not-available", checkedAt: Date.now() };
    });
    autoUpdater.on("error", () => {
      this.info = { state: "error", checkedAt: Date.now() };
    });
    autoUpdater.on("update-downloaded", (info: { version: string }) => {
      this.info = { state: "update-downloaded", version: info.version };
    });
    // on('download-progress') https://github.com/electron-userland/electron-builder/issues/2521
  }

  checkAtStartup() {
    if (!this._checkedAtStartup) {
      this._checkedAtStartup = true;
      this.check();
    }
  }

  handleUserAction(action: UpdaterAction | string) {
    if (action === "check-for-update") {
      this.checkNow();
    } else if (action === "update-and-restart") {
      this.installAndRestart();
    }
  }

  checkNow() {
    this.check();
  }

  installAndRestart() {
    if (this.info.state === "update-downloaded") {
      autoUpdater.quitAndInstall(false);
    }
  }

  private check = async () => {
    try {
      await autoUpdater.checkForUpdates();
    } catch {
      // handled by event
    }
  };
}

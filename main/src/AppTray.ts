import path from "path";
import { app, Tray, Menu, shell, nativeImage, dialog } from "electron";
import type { ServerEvents } from "./server";
import type { UpdateInfo } from "../../ipc/types";

interface UpdaterTrayActions {
  checkNow: () => void;
  installAndRestart: () => void;
}

export class AppTray {
  private _overlayKey = "Shift + Space";
  private tray: Tray;
  private updaterActions: UpdaterTrayActions | null = null;
  private updaterInfo: UpdateInfo = { state: "initial" };
  serverPort = 0;

  constructor(server: ServerEvents) {
    let trayImage = nativeImage.createFromPath(
      path.join(
        __dirname,
        process.env.STATIC!,
        process.platform === "win32" ? "icon.ico" : "icon.png",
      ),
    );

    if (process.platform === "darwin") {
      // Mac image size needs to be smaller, or else it looks huge. Size
      // guideline is from https://iconhandbook.co.uk/reference/chart/osx/
      trayImage = trayImage.resize({ width: 22, height: 22 });
    }

    this.tray = new Tray(trayImage);
    this.tray.setToolTip(`Exiled Exchange 2 v${app.getVersion()}`);
    this.rebuildMenu();

    server.onEventAnyClient("CLIENT->MAIN::user-action", ({ action }) => {
      if (action === "quit") {
        app.quit();
      }
    });
  }

  get overlayKey() {
    return this._overlayKey;
  }

  set overlayKey(value: string) {
    this._overlayKey = value;
    this.rebuildMenu();
  }

  setUpdaterActions(actions: UpdaterTrayActions) {
    this.updaterActions = actions;
    this.rebuildMenu();
  }

  setUpdaterInfo(info: UpdateInfo) {
    this.updaterInfo = info;
    this.rebuildMenu();
  }

  rebuildMenu() {
    const contextMenu = Menu.buildFromTemplate([
      {
        label: "Settings/League",
        click: () => {
          dialog.showMessageBox({
            title: "Settings",
            message: `Open Path of Exile 2 and press "${this.overlayKey}". Click on the button with cog icon there.`,
          });
        },
      },
      {
        label: "Open in Browser",
        click: () => {
          shell.openExternal(`http://localhost:${this.serverPort}`);
        },
      },
      { type: "separator" },
      this.createUpdateMenuItem(),
      { type: "separator" },
      {
        label: "Open config folder",
        click: () => {
          shell.openPath(path.join(app.getPath("userData"), "apt-data"));
        },
      },
      {
        label: "Quit",
        click: () => {
          app.quit();
        },
      },
    ]);

    this.tray.setContextMenu(contextMenu);
  }

  private createUpdateMenuItem(): Electron.MenuItemConstructorOptions {
    switch (this.updaterInfo.state) {
      case "checking-for-update":
        return {
          label: "Checking for Updates...",
          enabled: false,
        };
      case "update-available":
        if (this.updaterInfo.noDownloadReason === null) {
          return {
            label: `Downloading Update ${this.updaterInfo.version}...`,
            enabled: false,
          };
        }
        return {
          label: `Check for Updates (${this.updaterInfo.version} found)`,
          enabled: this.updaterActions !== null,
          click: () => this.updaterActions?.checkNow(),
        };
      case "update-downloaded":
        return {
          label: `Update Now (${this.updaterInfo.version})`,
          enabled: this.updaterActions !== null,
          click: () => this.updaterActions?.installAndRestart(),
        };
      default:
        return {
          label: "Check for Updates",
          enabled: this.updaterActions !== null,
          click: () => this.updaterActions?.checkNow(),
        };
    }
  }
}

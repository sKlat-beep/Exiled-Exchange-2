import fs from "fs";
import path from "path";
import { app } from "electron";
import type { ServerEvents } from "./server";

const MAX_LOG_BYTES = 128 * 1024;

export class Logger {
  history = "";
  private logPath = path.join(app.getPath("userData"), "apt-data", "debug.log");

  constructor(private server: ServerEvents) {
    fs.mkdirSync(path.dirname(this.logPath), { recursive: true });
  }

  write(message: string) {
    message = `[${new Date().toLocaleTimeString()}] ${message}\n`;
    this.history += message;
    this.writeToFile(message);
    this.server.sendEventTo("broadcast", {
      name: "MAIN->CLIENT::log-entry",
      payload: { message },
    });
  }

  private writeToFile(message: string) {
    try {
    if (
      fs.existsSync(this.logPath) &&
      fs.statSync(this.logPath).size > MAX_LOG_BYTES
    ) {
      const current = fs.readFileSync(this.logPath);
      fs.writeFileSync(
        this.logPath,
        current.subarray(Math.floor(current.length / 2)),
      );
    }
      fs.appendFileSync(this.logPath, message);
    } catch {
      // Logging should never crash the app.
    }
  }
}

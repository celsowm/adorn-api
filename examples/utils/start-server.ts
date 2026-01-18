import type { Application } from "express";
import type { Server } from "http";

const DEFAULT_PORT = 3000;

export interface StartServerOptions {
  /**
   * Friendly name for the running example to include in the log message.
   */
  name: string;
  /**
   * Port to listen on when `PORT` is not set in the environment.
   */
  port?: number;
  /**
   * Additional log lines to emit once the server is listening.
   */
  extraLogs?: Array<(port: number) => string>;
}

export function startExampleServer(app: Application, options: StartServerOptions): void {
  const envPort = Number(process.env.PORT);
  const port = Number.isInteger(envPort) && envPort > 0 ? envPort : (options.port ?? DEFAULT_PORT);

  let server: Server | undefined;
  try {
    server = app.listen(port, () => {
      console.log(`${options.name} running on http://localhost:${port}`);
      for (const log of options.extraLogs ?? []) {
        console.log(log(port));
      }
    });
  } catch (error) {
    handleListenError(error, port);
    return;
  }

  if (!server) {
    return;
  }

  server.on("error", (error) => {
    handleListenError(error, port);
  });
}

function handleListenError(error: unknown, port: number): never {
  const err = error as NodeJS.ErrnoException | undefined;
  if (err?.code === "EADDRINUSE") {
    console.error(
      `Port ${port} is already in use. Please stop the process listening on it (e.g. "npx kill-port ${port}", "taskkill /F /PID <pid>" on Windows, or "kill <pid>" on Unix) and try again.`
    );
    process.exit(1);
  }
  throw err ?? error;
}

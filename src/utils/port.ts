import { createServer, Server } from "net";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export interface ProcessInfo {
  pid: number;
  command?: string;
}

export async function isPortAvailable(port: number, host: string = "0.0.0.0"): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const server: Server = createServer();

    server.on("error", (err: any) => {
      if (err.code === "EADDRINUSE") {
        resolve(false);
      } else {
        resolve(false);
      }
    });

    server.once("listening", () => {
      server.close(() => {
        resolve(true);
      });
    });

    server.listen(port, host);
  });
}

export async function findProcessOnPort(port: number): Promise<ProcessInfo | null> {
  try {
    const platform = process.platform;

    if (platform === "win32") {
      const { stdout } = await execAsync(`netstat -ano | findstr :${port}`);
      
      for (const line of stdout.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.includes("PID")) continue;
        
        const parts = trimmed.split(/\s+/);
        if (parts.length >= 5) {
          const address = parts[1];
          const pid = parseInt(parts[parts.length - 1], 10);
          
          if (address.includes(`:${port}`) && !isNaN(pid)) {
            const command = await getProcessNameOnWindows(pid);
            return { pid, command };
          }
        }
      }
    } else {
      const { stdout } = await execAsync(`lsof -ti:${port}`);
      const pids = stdout.trim().split("\n").filter(Boolean).map(Number);
      
      if (pids.length > 0) {
        const pid = pids[0];
        const command = await getProcessNameOnUnix(pid);
        return { pid, command };
      }
    }

    return null;
  } catch (error: any) {
    if (error.message.includes("matches found")) {
      return null;
    }
    return null;
  }
}

async function getProcessNameOnWindows(pid: number): Promise<string | undefined> {
  try {
    const { stdout } = await execAsync(`tasklist /FI "PID eq ${pid}" /FO CSV /NH`);
    const line = stdout.trim().split("\n")[0];
    if (line) {
      const parts = line.split('","');
      if (parts.length >= 2) {
        return parts[0].replace(/"/g, "");
      }
    }
  } catch {
    return undefined;
  }
}

async function getProcessNameOnUnix(pid: number): Promise<string | undefined> {
  try {
    const { stdout } = await execAsync(`ps -p ${pid} -o comm=`);
    return stdout.trim() || undefined;
  } catch {
    return undefined;
  }
}

export async function killProcess(pid: number): Promise<boolean> {
  try {
    process.kill(pid, "SIGTERM");
    
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Process did not terminate gracefully"));
      }, 5000);
      
      const check = () => {
        try {
          process.kill(pid, 0);
          setTimeout(check, 500);
        } catch {
          clearInterval(interval);
          clearTimeout(timeout);
          resolve();
        }
      };
      
      const interval = setInterval(check, 500);
    });
    
    return true;
  } catch {
    try {
      process.kill(pid, "SIGKILL");
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Process did not terminate"));
        }, 3000);
        
        setTimeout(() => {
          try {
            process.kill(pid, 0);
            clearTimeout(timeout);
            reject(new Error("Process still running"));
          } catch {
            clearTimeout(timeout);
            resolve();
          }
        }, 1000);
      });
      
      return true;
    } catch {
      return false;
    }
  }
}

export async function waitForPort(port: number, host: string = "0.0.0.0", timeout: number = 5000): Promise<boolean> {
  const start = Date.now();
  
  while (Date.now() - start < timeout) {
    if (await isPortAvailable(port, host)) {
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  
  return false;
}

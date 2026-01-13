#!/usr/bin/env node

const { exec } = require("child_process");
const { promisify } = require("util");
const readline = require("readline");

const execAsync = promisify(exec);

async function checkPortInUse(port) {
  try {
    const { stdout } = await execAsync(
      `netstat -ano | findstr :${port} | findstr LISTENING`,
    );
    return stdout.trim().length > 0;
  } catch (error) {
    return false;
  }
}

async function getProcessIdUsingPort(port) {
  try {
    const { stdout } = await execAsync(
      `netstat -ano | findstr :${port} | findstr LISTENING`,
    );
    const lines = stdout.trim().split("\n");
    if (lines.length === 0) return null;
    const parts = lines[0].trim().split(/\s+/);
    return parts[parts.length - 1];
  } catch (error) {
    return null;
  }
}

async function killProcess(pid) {
  try {
    await execAsync(`taskkill /PID ${pid} /F`);
    console.log(`Process ${pid} killed successfully.`);
  } catch (error) {
    console.error(`Failed to kill process ${pid}:`, error);
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error("Usage: node check-port.cjs <port> [--kill]");
    process.exit(1);
  }

  const port = parseInt(args[0], 10);
  if (isNaN(port)) {
    console.error("Invalid port number");
    process.exit(1);
  }

  const shouldKill = args.includes("--kill");
  const isPortInUse = await checkPortInUse(port);

  if (!isPortInUse) {
    console.log(`Port ${port} is available.`);
    process.exit(0);
  }

  const pid = await getProcessIdUsingPort(port);
  if (!pid) {
    console.error(`Port ${port} is in use, but could not determine the process ID.`);
    process.exit(1);
  }

  console.log(`Port ${port} is already in use by process ID ${pid}.`);

  if (shouldKill) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question("Do you want to kill this process? (y/n): ", async (answer) => {
      if (answer.toLowerCase() === "y") {
        await killProcess(pid);
        rl.close();
        process.exit(0);
      } else {
        console.log("Process not killed. Exiting...");
        rl.close();
        process.exit(1);
      }
    });
  } else {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
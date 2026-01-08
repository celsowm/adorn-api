/**
 * Progress tracking utilities for the adorn-api CLI.
 * Provides structured progress output, timing, and build summaries.
 */

import process from "node:process";

/**
 * Phase definition for progress tracking.
 */
export interface ProgressPhase {
  name: string;
  startTime: number;
  endTime?: number;
  status: "pending" | "running" | "completed" | "failed";
  message?: string;
}

/**
 * Statistics collected during the build.
 */
export interface BuildStatistics {
  controllers: number;
  operations: number;
  schemas: number;
  sourceFiles: number;
  artifactsWritten: string[];
}

/**
 * Progress tracker for build operations.
 */
export class ProgressTracker {
  private phases: Map<string, ProgressPhase> = new Map();
  private startTime: number;
  private verbose: boolean = false;
  private quiet: boolean = false;
  private indentLevel: number = 0;

  constructor(options: { verbose?: boolean; quiet?: boolean } = {}) {
    this.verbose = options.verbose ?? false;
    this.quiet = options.quiet ?? false;
    this.startTime = performance.now();
  }

  /**
   * Start a new phase.
   */
  startPhase(name: string, message?: string): void {
    this.phases.set(name, {
      name,
      startTime: performance.now(),
      status: "running",
      message,
    });
    if (!this.quiet) {
      this.log(`● ${message || name}`);
    }
  }

  /**
   * Complete a phase successfully.
   */
  completePhase(name: string, message?: string): void {
    const phase = this.phases.get(name);
    if (phase) {
      phase.endTime = performance.now();
      phase.status = "completed";
      phase.message = message;
    }
    if (!this.quiet) {
      const elapsed = phase ? this.formatElapsed(phase.startTime, phase.endTime) : "";
      const status = this.verbose 
        ? `✓ ${message || name} ${elapsed}`
        : `✓ ${message || name} ${elapsed}`;
      this.log(status);
    }
  }

  /**
   * Mark a phase as failed.
   */
  failPhase(name: string, message?: string): void {
    const phase = this.phases.get(name);
    if (phase) {
      phase.endTime = performance.now();
      phase.status = "failed";
      phase.message = message;
    }
    if (!this.quiet) {
      this.log(`✗ ${message || name}`);
    }
  }

  /**
   * Log a verbose message.
   */
  verboseLog(message: string): void {
    if (this.verbose && !this.quiet) {
      const elapsed = this.formatElapsed(this.startTime);
      this.log(`[${elapsed}] ${message}`);
    }
  }

  /**
   * Log a regular message.
   */
  log(message: string): void {
    const indent = "  ".repeat(this.indentLevel);
    process.stdout.write(indent + message + "\n");
  }

  /**
   * Log a sub-message (indented).
   */
  logSub(message: string): void {
    this.indentLevel++;
    this.log(message);
    this.indentLevel--;
  }

  /**
   * Get the total elapsed time in milliseconds.
   */
  getTotalElapsed(): number {
    return performance.now() - this.startTime;
  }

  /**
   * Format elapsed time as a human-readable string.
   */
  formatElapsed(startTime?: number, endTime?: number): string {
    const elapsed = (endTime ?? performance.now()) - (startTime ?? this.startTime);
    if (elapsed < 1) {
      return `${(elapsed * 1000).toFixed(0)}ms`;
    } else if (elapsed < 1000) {
      return `${elapsed.toFixed(0)}ms`;
    } else {
      return `${(elapsed / 1000).toFixed(2)}s`;
    }
  }

  /**
   * Get all completed phases with their timings.
   */
  getPhases(): ProgressPhase[] {
    return Array.from(this.phases.values());
  }

  /**
   * Print a build summary.
   */
  printSummary(stats: BuildStatistics): void {
    if (this.quiet) return;

    this.log("");
    this.log("Build Summary:");
    this.log(`  Controllers:     ${stats.controllers}`);
    this.log(`  Operations:      ${stats.operations}`);
    this.log(`  Schemas:         ${stats.schemas}`);
    this.log(`  Source files:    ${stats.sourceFiles}`);
    this.log(`  Output dir:      ${stats.artifactsWritten[0]?.split("/").slice(0, -1).join("/") || ".adorn"}`);

    this.log("");
    this.log("Timings:");
    for (const phase of this.phases.values()) {
      if (phase.status === "completed" && phase.endTime) {
        const elapsed = phase.endTime - phase.startTime;
        const timeStr = elapsed < 1 
          ? `${(elapsed * 1000).toFixed(0)}ms`
          : elapsed < 1000 
            ? `${elapsed.toFixed(0)}ms`
            : `${(elapsed / 1000).toFixed(2)}s`;
        this.log(`  ${phase.name.padEnd(20)} ${timeStr}`);
      }
    }
    this.log(`  ${"─".repeat(21)}`);
    this.log(`  Total time:      ${this.formatElapsed()}`);
    this.log("");
  }

  /**
   * Print artifact list.
   */
  printArtifacts(artifacts: Array<{ name: string; size?: number }>): void {
    if (this.quiet) return;
    
    this.log("Written artifacts:");
    for (const artifact of artifacts) {
      const sizeStr = artifact.size 
        ? ` (${artifact.size >= 1024 ? `${(artifact.size / 1024).toFixed(1)} KB` : `${artifact.size} B`})`
        : "";
      this.log(`  ├── ${artifact.name}${sizeStr}`);
    }
  }
}

/**
 * Simple spinner for long-running operations.
 */
export class Spinner {
  private frames = ["⠋", "⠙", "⠹", "⠸", "⢰", "⠴", "⠦", "⠧", "⠇", "⠏"];
  private interval?: NodeJS.Timeout;
  private message: string;
  private current: number = 0;
  private total: number = 0;
  private customStatus?: string;

  constructor(message: string = "") {
    this.message = message;
  }

  /**
   * Start the spinner.
   */
  start(): void {
    let frameIndex = 0;
    this.interval = setInterval(() => {
      const frame = this.frames[frameIndex];
      let output: string;
      if (this.customStatus) {
        output = `\r${frame} ${this.customStatus}`;
      } else if (this.total > 0) {
        output = `\r${frame} ${this.message} (${this.current}/${this.total})`;
      } else {
        output = `\r${frame} ${this.message}`;
      }
      process.stdout.write(output);
      if (process.stdout.writable) {
        process.stdout.write("");
      }
      frameIndex = (frameIndex + 1) % this.frames.length;
    }, 80);
  }

  /**
   * Set progress counters.
   */
  setProgress(current: number, total: number): void {
    this.current = current;
    this.total = total;
  }

  /**
   * Set a custom status message (overrides counters).
   */
  setStatus(status: string): void {
    this.customStatus = status;
    // Write immediately to ensure update is visible
    const frame = this.frames[this.current];
    process.stdout.write(`\r${frame} ${status}`);
    if (process.stdout.writable) {
      process.stdout.write("");
    }
  }

  /**
   * Clear the custom status message.
   */
  clearStatus(): void {
    this.customStatus = undefined;
  }

  /**
   * Stop the spinner with a completion message.
   */
  stop(completedMessage?: string): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = undefined;
    }
    // Clear the line
    process.stdout.write("\r" + " ".repeat(60) + "\r");
    if (completedMessage) {
      process.stdout.write(completedMessage + "\n");
    }
    // Also flush to ensure output is visible
    if (process.stdout.writable) {
      process.stdout.write("");
    }
  }

  /**
   * Stop the spinner with a failure message.
   */
  fail(failedMessage?: string): void {
    this.stop();
    if (failedMessage) {
      process.stdout.write(`✗ ${failedMessage}\n`);
    }
  }
}

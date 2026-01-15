type LogLevel = "log" | "warn" | "error";

function log(level: LogLevel, tag: string, ...args: unknown[]): void {
  const prefix = `[${tag}]`;
  console[level](prefix, ...args);
}

export const logger = {
  log: (tag: string, ...args: unknown[]) => log("log", tag, ...args),
  warn: (tag: string, ...args: unknown[]) => log("warn", tag, ...args),
  error: (tag: string, ...args: unknown[]) => log("error", tag, ...args),
};

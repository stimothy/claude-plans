import * as disk from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createLogger, type LogLevel, logLevels } from "./index.ts";

let directory = "";
let time = new Date("2026-03-15T23:59:59.000Z");

beforeEach(() => {
  directory = disk.mkdtempSync(join(tmpdir(), "claude-plans-logging-"));
  time = new Date("2026-03-15T23:59:59.000Z");
});

afterEach(() => {
  vi.restoreAllMocks();
  disk.rmSync(directory, { recursive: true, force: true });
});

function logger(level: LogLevel = "info") {
  return createLogger({ dataDirectory: directory, program: "backend", level, now: () => time });
}

function entries(name = "backend-2026-03-15.log"): unknown[] {
  const lines = disk
    .readFileSync(join(directory, "logs", name), "utf8")
    .trimEnd()
    .split("\n");
  return lines.map((line): unknown => JSON.parse(line));
}

function files(): string[] {
  return disk.readdirSync(join(directory, "logs")).toSorted();
}

describe("a log entry", () => {
  it("is one line of JSON with a UTC time, a level, and a message", () => {
    logger().info("Started.\nListening.");

    expect(entries()).toEqual([{ time: "2026-03-15T23:59:59.000Z", level: "info", message: "Started.\nListening." }]);
  });

  it("includes an error's stack trace, and those of what caused it", () => {
    const cause = new Error("No such file.");
    const error = new Error("Cannot start.", { cause });

    logger().error("Start failed.", error);

    expect(entries()).toMatchObject([{ stack: [error.stack, `Caused by: ${String(cause.stack)}`].join("\n") }]);
  });

  it("includes the stack traces of errors that were gathered into one", () => {
    const inner = new Error("Refused.");

    logger().error("Cannot connect.", new AggregateError([inner], "All attempts failed."));

    expect(JSON.stringify(entries())).toContain("Error: Refused.\\n");
  });

  it("ends the stack trace of an error that caused itself", () => {
    const error = new Error("Again.");
    error.cause = error;

    logger().error("Failed.", error);

    expect(entries()).toMatchObject([{ stack: error.stack }]);
  });

  it("leaves out the other properties of an error, which may hold secrets", () => {
    logger().error("Failed.", Object.assign(new Error("Rejected."), { token: "do-not-log" }));

    expect(JSON.stringify(entries())).not.toContain("do-not-log");
  });

  it.each<[unknown, string]>([
    ["it broke", "it broke"],
    [{ token: "do-not-log" }, "A value of type object was thrown."],
    [null, "A value of type object was thrown."],
  ])("describes %j when it was thrown in place of an error", (thrown, stack) => {
    logger().warn("Failed.", thrown);

    expect(entries()).toMatchObject([{ stack }]);
  });
});

describe("the log level", () => {
  it.each(logLevels.map((level, index) => [level, logLevels.slice(0, index + 1)]))(
    "of %s writes %j",
    (level, written) => {
      const log = logger(level);

      for (const entryLevel of logLevels) {
        log[entryLevel]("Message.");
      }

      expect(entries()).toMatchObject(written.map((entryLevel) => ({ level: entryLevel })));
    },
  );
});

describe("the log files", () => {
  it("start anew each UTC day, in a file named for the program and the date", () => {
    const log = logger();
    log.info("Before midnight.");
    time = new Date("2026-03-16T00:00:00.000Z");

    log.info("After midnight.");

    expect(files()).toEqual(["backend-2026-03-15.log", "backend-2026-03-16.log"]);
    expect(entries("backend-2026-03-16.log")).toMatchObject([{ message: "After midnight." }]);
  });

  it("are kept for 14 days, and only the program's own older ones are deleted", () => {
    const kept = ["backend-2026-03-02.log", "backend-notes.log", "cli-2026-01-01.log", "other-backend-2026-01-01.log"];
    disk.mkdirSync(join(directory, "logs"));
    for (const name of [...kept, "backend-2026-03-01.log", "backend-2025-12-31.log"]) {
      disk.writeFileSync(join(directory, "logs", name), "");
    }

    logger().info("Message.");

    expect(files()).toEqual([...kept, "backend-2026-03-15.log"].toSorted());
  });

  it("are checked for old ones again when a running program reaches a new day", () => {
    const log = logger();
    log.info("Message.");
    time = new Date("2026-03-29T12:00:00.000Z");

    log.info("Two weeks later.");

    expect(files()).toEqual(["backend-2026-03-29.log"]);
  });

  it("report a failure to write on the error output, without stopping the program", () => {
    const report = vi.spyOn(process.stderr, "write").mockReturnValue(true);
    // A file where the log directory belongs makes writing fail on any system.
    disk.writeFileSync(join(directory, "logs"), "");

    logger().info("Message.");

    expect(report).toHaveBeenCalledWith(expect.stringContaining("Cannot write the log:"));
  });

  it("use the current time unless a clock is given", () => {
    createLogger({ dataDirectory: directory, program: "cli", level: "info" }).info("Message.");

    expect(files()).toEqual([expect.stringMatching(/^cli-\d{4}-\d{2}-\d{2}\.log$/)]);
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

import { healthReport } from "../health/health-report.ts";
import { createApplication } from "./application.ts";
import { isFromThisServer } from "./request-protection.ts";

vi.mock("../health/health-report.ts", () => ({ healthReport: vi.fn() }));
// A request made without a network has no port to check.
vi.mock("./request-protection.ts", () => ({ isFromThisServer: vi.fn() }));

const log = { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() };
const options = { dataDirectory: "/data", version: "1.2.3", token: "token", log, shutDown: vi.fn() };

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(isFromThisServer).mockReturnValue(true);
});

// Nothing listens here, so the requests are made without a network.
async function send(method: "GET", url: string): Promise<{ status: number; body: string }> {
  const application = createApplication(options);
  const answer = await application.inject({ method, url });
  await application.close();
  return { status: answer.statusCode, body: answer.body };
}

describe("a request that fails", () => {
  it("is logged with its route and the error, and the answer does not say what went wrong", async () => {
    const failure = new Error("private detail");
    vi.mocked(healthReport).mockImplementation(() => {
      throw failure;
    });

    const answer = await send("GET", "/api/health?secret=1");

    expect(answer).toEqual({ status: 500, body: '{"message":"The server could not handle the request."}' });
    expect(log.error.mock.calls).toEqual([["The server could not handle GET /api/health", failure]]);
  });

  // An error about a request may quote it.
  it("keeps what a faulty request's error says out of every log and the answer", async () => {
    vi.mocked(isFromThisServer).mockImplementation(() => {
      throw Object.assign(new Error("quoted from the request"), { statusCode: 400 });
    });

    const answer = await send("GET", "/api/health");

    expect(answer).toEqual({ status: 400, body: '{"message":"The server could not handle the request."}' });
    expect(Object.values(log).flatMap((write) => write.mock.calls)).toEqual([]);
  });
});

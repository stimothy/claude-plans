import { expect, it, vi } from "vitest";

it("shows the page in the document", async () => {
  await import("./main.tsx");

  await vi.waitFor(() => {
    expect(document.querySelector("h1")?.textContent).toBe("Hello, world");
  });
});

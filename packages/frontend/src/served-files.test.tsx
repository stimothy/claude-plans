import { expect, it } from "vitest";

// The test is served from its full path, which shows where the repository is. Where a path starts with a drive
// letter, as on Windows, Vitest puts /@fs before it.
const own = new URL(import.meta.url).pathname.replace(/^\/@fs(?=\/)/, "");
const repository = own.replace(/packages\/frontend\/src\/.*$/, "");
const asked = async (file: string): Promise<number> => (await fetch(`/@fs${repository}${file}?raw`)).status;

// The server that runs these tests could otherwise read out the real data in the maintainer's own copy.
it("gives out the page's files, and no other file of the repository", async () => {
  const answers = await Promise.all([asked("packages/frontend/src/main.tsx"), asked("package.json")]);

  expect(answers).toEqual([200, 403]);
});

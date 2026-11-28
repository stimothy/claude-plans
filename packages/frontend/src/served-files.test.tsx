import { expect, it } from "vitest";

// The test is served from its full path, which shows where the repository is.
const repository = new URL(import.meta.url).pathname.replace(/packages\/frontend\/src\/.*$/, "");
const asked = async (file: string): Promise<number> => (await fetch(`/@fs${repository}${file}?raw`)).status;

// The server that runs these tests could otherwise read out the real data in the maintainer's own copy.
it("gives out the page's files, and no other file of the repository", async () => {
  const answers = await Promise.all([asked("packages/frontend/src/main.tsx"), asked("package.json")]);

  expect(answers).toEqual([200, 403]);
});

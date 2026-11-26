import { z } from "zod";

/** Checks a report about whether the studio works. */
export const healthReportSchema = z.object({
  /** Whether everything works. */
  status: z.enum(["ok", "error"]),
  /** The application's version. */
  version: z.string().min(1),
  /** What is known about the database. */
  database: z.object({
    /** Whether the database can be read. */
    accessible: z.boolean(),
    /** The number of the last migration that ran, 0 before the first, or null if it cannot be read. */
    migrationVersion: z.int().nonnegative().nullable(),
  }),
});

/** Whether the studio works. */
export type HealthReport = z.infer<typeof healthReportSchema>;

/** The API that reports the studio's health. */
export const healthContract = {
  path: "/api/health",
  read: { method: "GET", response: healthReportSchema },
} as const;

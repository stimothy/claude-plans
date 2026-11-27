/**
 * The server's port and log level: the default, which the settings file overrides, which a command option
 * overrides.
 *
 * @packageDocumentation
 */
import { logLevels } from "@claude-plans/logging";
import { z } from "zod";

const highestPort = 65_535;
const defaultPort = 4310;

/** Checks a port number that the server can be told to use. */
export const portSchema = z.int().min(1).max(highestPort);

/** Checks how much detail the logs hold. */
export const logLevelSchema = z.enum(logLevels);

const serverSettingsSchema = z.object({ port: portSchema, logLevel: logLevelSchema });

/** The settings that the server starts with. */
export type ServerSettings = z.infer<typeof serverSettingsSchema>;

/** The server settings that one source gives. It may leave any of them out. */
export interface ServerOverrides {
  readonly port?: number | undefined;
  readonly logLevel?: ServerSettings["logLevel"] | undefined;
}

/** Chooses each server setting from the command options, else the settings file, else the default. */
export function serverSettings(file: ServerOverrides, options: ServerOverrides): ServerSettings {
  return serverSettingsSchema.parse({
    port: options.port ?? file.port ?? defaultPort,
    logLevel: options.logLevel ?? file.logLevel ?? "info",
  });
}

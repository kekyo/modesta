// modesta - Simplest zero-dependency swagger proxy generator
// Copyright (c) Kouji Matsui (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/modesta/

import type { LogLevel, Logger as ViteLogger } from 'vite';

/**
 * Logger interface used by CLI and Vite integrations.
 */
export interface Logger {
  /**
   * Writes a debug message.
   * @param message Message text.
   */
  readonly debug: (message: string) => void;
  /**
   * Writes an informational message.
   * @param message Message text.
   */
  readonly info: (message: string) => void;
  /**
   * Writes a warning message.
   * @param message Message text.
   */
  readonly warn: (message: string) => void;
  /**
   * Writes an error message.
   * @param message Message text.
   */
  readonly error: (message: string) => void;
}

/**
 * Creates a console-backed logger with a prefix.
 * @param prefix Prefix added to every message.
 * @returns Logger implementation backed by the Node.js console.
 */
export const createConsoleLogger = (prefix: string): Logger => {
  return {
    debug: (message: string) => console.debug(`[${prefix}]: ${message}`),
    info: (message: string) => console.info(`[${prefix}]: ${message}`),
    warn: (message: string) => console.warn(`[${prefix}]: ${message}`),
    error: (message: string) => console.error(`[${prefix}]: ${message}`),
  };
};

/**
 * Creates a Vite logger adapter with a prefix.
 * @param viteLogger Vite logger instance.
 * @param logLevel Effective Vite log level.
 * @param prefix Prefix added to every message.
 * @returns Logger adapter bound to the Vite logger.
 */
export const createViteLoggerAdapter = (
  viteLogger: ViteLogger,
  logLevel: LogLevel,
  prefix: string
): Logger => {
  return {
    debug:
      logLevel === 'silent'
        ? () => {}
        : (message: string) => viteLogger.info(`[${prefix}]: ${message}`),
    info:
      logLevel === 'silent'
        ? () => {}
        : (message: string) => viteLogger.info(`[${prefix}]: ${message}`),
    warn:
      logLevel === 'silent'
        ? () => {}
        : (message: string) => viteLogger.warn(`[${prefix}]: ${message}`),
    error:
      logLevel === 'silent'
        ? () => {}
        : (message: string) => viteLogger.error(`[${prefix}]: ${message}`),
  };
};

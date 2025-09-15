import { clsx } from "clsx";
import { twMerge } from "tailwind-merge"

/**
 * @fileoverview This file contains a utility function for merging CSS classes.
 * @module lib/utils
 */

/**
 * Merges CSS classes.
 * @param {...(string|object|Array<string|object>)} inputs - The CSS classes to merge.
 * @returns {string} The merged CSS classes.
 */
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

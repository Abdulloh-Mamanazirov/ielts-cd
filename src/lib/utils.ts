import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Compares strings with any embedded numbers read as numbers, so "Test 2" sorts
 * before "Test 10" rather than after it. A plain `title: "asc"` in the database
 * is lexicographic, which is what put Test 10 between Test 1 and Test 2 on the
 * practice shelf.
 */
export function naturalCompare(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

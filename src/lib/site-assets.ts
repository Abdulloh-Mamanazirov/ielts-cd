import { existsSync } from "node:fs";
import { join } from "node:path";

const EXTENSIONS = ["webp", "png", "jpg", "jpeg", "svg"];

/**
 * Returns the public URL for an asset if the file has actually been added, or
 * null so the caller can render a placeholder. Lets the real instructor photo
 * and logo drop in later without touching any code.
 */
export function publicAsset(baseName: string): string | null {
  for (const extension of EXTENSIONS) {
    const relative = `${baseName}.${extension}`;
    if (existsSync(join(process.cwd(), "public", relative))) {
      return `/${relative}`;
    }
  }
  return null;
}

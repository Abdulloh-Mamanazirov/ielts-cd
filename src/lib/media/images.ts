/**
 * Where an admin-uploaded image lives and what its URL looks like.
 *
 * Two shapes are in use and both have to keep working:
 *
 *   /media/images/<file>   uploaded through the admin panel, stored outside the
 *                          web root and served by a route
 *   /test-media/<file>     artwork committed to the repo, plus everything
 *                          uploaded before the switch
 *
 * Uploads used to go to `public/test-media/` as well. They cannot: Next reads
 * `public/` once when the server starts, so a file written there afterwards is
 * a 404 to the app — and `next/image` optimises by fetching through the app, so
 * every freshly uploaded picture rendered as a broken image until the next
 * deploy. nginx serving the raw file made it look like the upload had worked.
 */

/** One filename, no directories: what the upload route generates. */
const FILENAME = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

export const IMAGE_URL_PREFIX = "/media/images/";

export function imageUrlFor(filename: string): string {
  return `${IMAGE_URL_PREFIX}${filename}`;
}

/** The filename inside an upload URL, or null if this is not one of ours. */
export function uploadedImageFilename(url: string): string | null {
  if (!url.startsWith(IMAGE_URL_PREFIX)) return null;
  const filename = url.slice(IMAGE_URL_PREFIX.length);
  return FILENAME.test(filename) ? filename : null;
}

/**
 * An image this site is hosting, in either shape. An absolute URL is refused:
 * a chart on someone else's host disappears the day they tidy up.
 */
export function isSiteImageUrl(url: string): boolean {
  if (uploadedImageFilename(url)) return true;
  if (!url.startsWith("/test-media/")) return false;
  return FILENAME.test(url.slice("/test-media/".length));
}

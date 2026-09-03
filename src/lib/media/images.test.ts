import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { imageUrlFor, isSiteImageUrl, uploadedImageFilename } from "./images";

describe("uploadedImageFilename", () => {
  it("reads back the filename the upload route produced", () => {
    const url = imageUrlFor("chart-1fa64e6e.png");
    assert.equal(url, "/media/images/chart-1fa64e6e.png");
    assert.equal(uploadedImageFilename(url), "chart-1fa64e6e.png");
  });

  it("refuses a traversal segment", () => {
    // The route turns this into a storage key, so it must never resolve.
    assert.equal(uploadedImageFilename("/media/images/../../.env"), null);
    assert.equal(uploadedImageFilename("/media/images/..%2F.env"), null);
  });

  it("refuses a nested path", () => {
    assert.equal(uploadedImageFilename("/media/images/audio/lesson.mp3"), null);
  });

  it("ignores a URL that is not an upload", () => {
    assert.equal(uploadedImageFilename("/test-media/writing-mock-1-task1.png"), null);
    assert.equal(uploadedImageFilename("https://example.com/media/images/x.png"), null);
  });
});

describe("isSiteImageUrl", () => {
  it("accepts both shapes this site serves", () => {
    // Uploaded through the admin panel...
    assert.equal(isSiteImageUrl("/media/images/student-story-1fa64e6e.jpg"), true);
    // ...and artwork committed to the repo, which predates the upload route.
    assert.equal(isSiteImageUrl("/test-media/writing-mock-1-task1.png"), true);
  });

  it("rejects an offsite image", () => {
    assert.equal(isSiteImageUrl("https://img.example.com/chart.png"), false);
    assert.equal(isSiteImageUrl("//evil.example.com/chart.png"), false);
  });

  it("rejects a path outside the two image directories", () => {
    assert.equal(isSiteImageUrl("/ielts-certificate-sample.jpg"), false);
    assert.equal(isSiteImageUrl("/test-media/../.env"), false);
  });
});

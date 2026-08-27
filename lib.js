// Pure logic shared by the app and the test suite.
//
// Deliberately not an ES module: index.html is meant to be opened straight
// from disk, and file:// blocks module loading. This exposes globals for the
// browser and module.exports for Node, so both work with no build step.

(function (root) {
  "use strict";

  const DEFAULT_ICON = "💬";

  // Roughly 12 characters a second at rate 1, so this targets ~10s per chunk.
  function chunkSizeFor(rate) {
    const value = Number(rate) || 1;
    return Math.min(220, Math.max(60, Math.round(120 * value)));
  }

  function splitLongSentence(sentence, maxChars) {
    const chunks = [];
    let line = "";

    sentence
      .split(/\s+/)
      .filter(Boolean)
      .forEach((word) => {
        if (line && `${line} ${word}`.length > maxChars) {
          chunks.push(line);
          line = word;
        } else {
          line = line ? `${line} ${word}` : word;
        }
      });

    if (line) chunks.push(line);
    return chunks;
  }

  function splitIntoChunks(text, maxChars) {
    // Every alternative must be able to match, or the segment is dropped and
    // that text is never spoken. The first branch allows an empty run before
    // the terminator so that punctuation on its own — an ellipsis on its own
    // line, say — is still a segment.
    const sentences =
      text.match(/[^.!?\n]*[.!?]+\s*|[^.!?\n]+|\n+/g) || [text];
    const chunks = [];
    let current = "";

    sentences.forEach((sentence) => {
      if ((current + sentence).trim().length <= maxChars) {
        current += sentence;
        return;
      }

      if (current.trim()) chunks.push(current.trim());

      if (sentence.trim().length <= maxChars) {
        current = sentence;
      } else {
        // A single sentence longer than a chunk: fall back to word boundaries.
        chunks.push(...splitLongSentence(sentence.trim(), maxChars));
        current = "";
      }
    });

    if (current.trim()) chunks.push(current.trim());
    return chunks;
  }

  // Where each chunk starts inside the full text, so a boundary offset that is
  // relative to a chunk can be mapped back onto the whole passage.
  function buildTracking(fullText, chunks) {
    const offsets = [];
    let cursor = 0;

    chunks.forEach((chunk) => {
      // Chunks are substrings of the original, so this locates them exactly.
      // splitLongSentence collapses runs of whitespace, so a chunk can fail to
      // match; fall back to the cursor rather than highlighting the wrong words.
      const found = fullText.indexOf(chunk, cursor);
      const start = found === -1 ? cursor : found;
      offsets.push(start);
      cursor = start + chunk.length;
    });

    return { full: fullText, offsets };
  }

  function wordEndFrom(text, start) {
    const match = text.slice(start).match(/^\S+/);
    return start + (match ? match[0].length : 1);
  }

  // Returns the phrase list to use, or null when the stored value is unusable
  // and the caller should fall back to the defaults. An empty array is a
  // deliberately cleared board and is returned as-is.
  function normalizePhrases(saved) {
    if (!Array.isArray(saved)) return null;
    return saved.filter((p) => p && typeof p.text === "string" && p.text.trim());
  }

  const api = {
    DEFAULT_ICON,
    chunkSizeFor,
    splitLongSentence,
    splitIntoChunks,
    buildTracking,
    wordEndFrom,
    normalizePhrases,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  Object.assign(root, api);
})(typeof globalThis !== "undefined" ? globalThis : this);

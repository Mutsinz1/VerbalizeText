// Test suite for the pure logic in lib.js.  Run with: node test.js
//
// No framework and no dependencies, to match the rest of the project. Most of
// these cases exist because the behaviour was actually got wrong at some point.

const assert = require("node:assert/strict");
const {
  chunkSizeFor,
  splitIntoChunks,
  splitLongSentence,
  buildTracking,
  wordEndFrom,
  normalizePhrases,
} = require("./lib.js");

let passed = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    passed += 1;
  } catch (error) {
    failures.push({ name, error });
  }
}

// --- chunkSizeFor ---------------------------------------------------------
// Scales with the rate slider: a chunk that is safely short at rate 1 is back
// over the utterance length limit at rate 0.5.

test("chunk size scales with rate", () => {
  assert.equal(chunkSizeFor(0.5), 60);
  assert.equal(chunkSizeFor(1), 120);
  assert.equal(chunkSizeFor(2), 220);
});

test("chunk size stays within bounds at extremes", () => {
  assert.equal(chunkSizeFor(0.1), 60, "floor");
  assert.equal(chunkSizeFor(10), 220, "ceiling");
});

test("chunk size treats junk input as rate 1", () => {
  assert.equal(chunkSizeFor(undefined), 120);
  assert.equal(chunkSizeFor(""), 120);
  assert.equal(chunkSizeFor("not a number"), 120);
  assert.equal(chunkSizeFor(0), 120);
});

// --- splitIntoChunks ------------------------------------------------------

test("short text stays a single chunk", () => {
  assert.deepEqual(splitIntoChunks("I'm Thirsty", 120), ["I'm Thirsty"]);
});

test("splits at sentence boundaries without exceeding the limit", () => {
  const text =
    "The quick brown fox jumps over the lazy dog. Speech synthesis is capable! Does it work? It should. Another sentence pushes past one chunk.";
  const chunks = splitIntoChunks(text, 120);
  assert.ok(chunks.length > 1, "should split");
  chunks.forEach((c) => assert.ok(c.length <= 120, `chunk too long: ${c.length}`));
});

// The sentence regex used to require a non-punctuation character in every
// segment, so punctuation standing on its own matched nothing and that text
// was silently never spoken. An ellipsis on its own line disappeared.
test("punctuation-only segments are not dropped", () => {
  const cases = [
    "Hello.\n...\nWorld.",
    "Wait. . Next.",
    "Line one.\n?\nLine two.",
    "three!one  a!\n.abc",
    "...",
    "?!",
  ];
  cases.forEach((text) => {
    const rejoined = splitIntoChunks(text, 60).join(" ").replace(/\s+/g, " ").trim();
    const source = text.replace(/\s+/g, " ").trim();
    assert.equal(rejoined, source, `text lost from ${JSON.stringify(text)}`);
  });
});

// A newline is the only separator between two unterminated lines. If the
// segmenter swallows it, the lines are concatenated and "abc\ndef" is spoken
// as "abcdef". Comparing with whitespace normalised would hide this, so this
// checks the word tokens themselves.
test("newlines keep separate lines apart", () => {
  const cases = ["abc\ndef", "one two\nthree four", "Hello.\nthere\nworld"];
  cases.forEach((text) => {
    const chunks = splitIntoChunks(text, 60);
    chunks.forEach((chunk) =>
      assert.ok(
        text.includes(chunk),
        `lines ran together: ${JSON.stringify(chunk)}`
      )
    );
    assert.deepEqual(
      chunks.join(" ").split(/\s+/).filter(Boolean),
      text.split(/\s+/).filter(Boolean),
      `word tokens changed for ${JSON.stringify(text)}`
    );
  });
});

test("no text is lost when chunks are rejoined", () => {
  const text =
    "One two three four. Five six seven eight! Nine ten eleven twelve? Thirteen fourteen.";
  const rejoined = splitIntoChunks(text, 40).join(" ").replace(/\s+/g, " ");
  assert.equal(rejoined, text.replace(/\s+/g, " "));
});

test("a sentence longer than a chunk falls back to word boundaries", () => {
  const runOn = "word ".repeat(80).trim();
  const chunks = splitIntoChunks(runOn, 100);
  assert.ok(chunks.length > 1);
  chunks.forEach((c) => assert.ok(c.length <= 100));
  assert.equal(chunks.join(" "), runOn);
});

test("handles newlines and blank lines", () => {
  const chunks = splitIntoChunks("First line.\n\nSecond line.\n\n\nThird.", 20);
  assert.ok(chunks.length >= 2);
  chunks.forEach((c) => assert.ok(c.trim().length > 0, "no empty chunks"));
});

// splitIntoChunks used to end with a defensive .filter(Boolean). Fuzzing over
// 250k generated inputs never produced a falsy chunk, so the filter was dead
// code and has been removed; this asserts the property it was guarding.
test("never emits an empty chunk", () => {
  const inputs = [
    ".", "...", "!?", "   ", "\n\n\n", "a", "", ". . . .", "\n.\n.\n",
    "?!?!?!", "  \n  \t ", "é", "🎧", "-", ",;-", "a.", ".a", "\n a \n",
  ];
  inputs.forEach((input) => {
    [1, 5, 60, 220].forEach((size) => {
      splitIntoChunks(input, size).forEach((c) =>
        assert.ok(
          c && c.trim().length > 0,
          `empty chunk from ${JSON.stringify(input)} at size ${size}`
        )
      );
    });
  });
});

// The splitter should pack a line as full as it will go. If it started a new
// line when a word merely *reached* the limit rather than exceeding it, every
// chunk would come up a word short and the reading would be choppier than
// necessary — a quiet regression, since the chunks would still be legal.
test("words that exactly fill the limit stay on one line", () => {
  assert.deepEqual(splitLongSentence("abc def ghi", 11), ["abc def ghi"]);
  assert.deepEqual(splitLongSentence("aa bb cc dd", 11), ["aa bb cc dd"]);
});

test("one character over the limit does split", () => {
  assert.deepEqual(splitLongSentence("abc def ghi", 10), ["abc def", "ghi"]);
});

test("chunks use the full width available", () => {
  // 40 words of 4 characters: with a limit of 24, each line should hold as
  // many whole words as fit (4 words = 19 chars, a 5th would make 24).
  const text = Array.from({ length: 40 }, () => "word").join(" ");
  const chunks = splitLongSentence(text, 24);
  chunks.slice(0, -1).forEach((chunk) => {
    assert.ok(chunk.length <= 24, "must respect the limit");
    assert.ok(
      chunk.length + 5 > 24,
      `chunk "${chunk}" (${chunk.length}) had room for another word`
    );
  });
});

// The length limit is measured on trimmed text, so a chunk left untrimmed can
// exceed it — and leading whitespace would shift the highlighted region in the
// reading view.
// Same contract as the word splitter, one level up: a sentence that exactly
// fills the remaining room should be packed in, not pushed to a new chunk.
test("sentences that exactly fill a chunk are packed together", () => {
  assert.deepEqual(splitIntoChunks("Ab cd. Ef gh.", 13), ["Ab cd. Ef gh."]);
  assert.deepEqual(splitIntoChunks("Ab cd. Ef gh.", 12), ["Ab cd.", "Ef gh."]);
});

// A sentence that exactly fits must not be routed through the word splitter,
// which collapses runs of whitespace. The chunk would stop being an exact
// substring of the source, and buildTracking would silently fall back to
// approximate offsets — highlighting the wrong words.
test("chunks stay exact substrings when every sentence fits", () => {
  // Sizes are chosen so no sentence needs the word splitter — that path
  // collapses whitespace by design, and its approximate offsets are covered
  // by the unlocatable-chunk test instead.
  const cases = [
    { text: "three!one  a!\n.abc", sizes: [7, 12, 20, 40] },
    { text: "First   sentence.   Second   one.", sizes: [20, 40] },
    { text: "Tight. Spaced   out.   Tight again.", sizes: [14, 20, 40] },
  ];
  cases.forEach(({ text, sizes }) => {
    sizes.forEach((size) => {
      splitIntoChunks(text, size).forEach((chunk) => {
        assert.ok(
          text.includes(chunk),
          `chunk ${JSON.stringify(chunk)} is not a substring of the source ` +
            `at size ${size} — offset tracking would degrade`
        );
      });
    });
  });
});

test("chunks carry no leading or trailing whitespace", () => {
  const texts = [
    "One two three. Four five six. Seven eight nine ten eleven twelve.",
    "Line one.\n\nLine two is here.\n\n\nLine three ends it.",
    "First   sentence   with   wide   gaps.   Second    sentence     here.",
    "word ".repeat(50).trim(),
    "Trailing space at the end. ",
    "   Leading space at the start.",
  ];
  texts.forEach((text) => {
    [20, 60, 120].forEach((size) => {
      splitIntoChunks(text, size).forEach((chunk) => {
        assert.equal(
          chunk,
          chunk.trim(),
          `stray whitespace in ${JSON.stringify(chunk)} at size ${size}`
        );
      });
    });
  });
});

test("chunks respect the limit unless a single word exceeds it", () => {
  const texts = [
    "One two three. Four five six. Seven eight nine ten eleven twelve.",
    "First   sentence   with   wide   gaps.   Second    sentence     here.",
    "word ".repeat(50).trim(),
    "Café naïve résumé façade. Emoji 🎧 and more text to force more chunks.",
  ];
  texts.forEach((text) => {
    [20, 45, 60, 120].forEach((size) => {
      splitIntoChunks(text, size).forEach((chunk) => {
        const singleWord = !chunk.includes(" ");
        assert.ok(
          chunk.length <= size || singleWord,
          `chunk of ${chunk.length} exceeds limit ${size}: ${JSON.stringify(chunk)}`
        );
      });
    });
  });
});

test("a single word longer than the limit is still emitted", () => {
  const long = "x".repeat(200);
  assert.deepEqual(splitLongSentence(long, 60), [long]);
});

// --- buildTracking --------------------------------------------------------
// This is the mapping that turns a chunk-relative boundary offset into a
// position in the full text. If it drifts, the wrong word gets highlighted.

function assertOffsetsExact(text, size) {
  const chunks = splitIntoChunks(text, size);
  const { offsets } = buildTracking(text, chunks);
  chunks.forEach((chunk, i) => {
    assert.equal(
      text.slice(offsets[i], offsets[i] + chunk.length),
      chunk,
      `chunk ${i} does not sit at its recorded offset`
    );
  });
  offsets.forEach((o, i) => {
    if (i > 0) assert.ok(o >= offsets[i - 1], "offsets must not go backwards");
  });
  return { chunks, offsets };
}

test("offsets are exact for ordinary prose", () => {
  assertOffsetsExact(
    "The quick brown fox jumps over the lazy dog. Speech synthesis is capable of following along word by word.",
    60
  );
});

test("offsets are exact with irregular whitespace", () => {
  assertOffsetsExact(
    "First   sentence   with   wide   gaps.   Second    sentence     here.    Third one.",
    60
  );
});

test("offsets are exact across newlines", () => {
  assertOffsetsExact("Line one.\n\nLine two is here.\n\n\nLine three ends it.", 40);
});

test("offsets are exact for a run-on with no punctuation", () => {
  assertOffsetsExact("word ".repeat(60).trim(), 100);
});

test("offsets are exact with accents and emoji", () => {
  assertOffsetsExact(
    "Café naïve résumé façade. Emoji 🎧 and more text here to force another chunk.",
    50
  );
});

// Without a running cursor, indexOf would find the *first* copy of a repeated
// chunk every time, and the highlight would jump back to the start of the
// passage. Distinct chunks hide this, so the text here deliberately repeats.
test("offsets advance through repeated sentences", () => {
  const text = "Hello there. Hello there. Hello there.";
  const { chunks, offsets } = assertOffsetsExact(text, 15);
  assert.equal(chunks.length, 3, "expected one chunk per repetition");
  assert.equal(
    new Set(offsets).size,
    offsets.length,
    "each repetition must map to its own position"
  );
  assert.deepEqual(offsets, [0, 13, 26]);
  assert.equal(offsets.at(-1) + chunks.at(-1).length, text.length);
});

test("offsets advance through a repeated single word", () => {
  const text = "word ".repeat(40).trim();
  const { chunks, offsets } = assertOffsetsExact(text, 60);
  assert.ok(chunks.length > 1);
  assert.equal(new Set(offsets).size, offsets.length, "offsets must be distinct");
  assert.equal(offsets.at(-1) + chunks.at(-1).length, text.length);
});

// splitLongSentence collapses runs of whitespace, so its chunks are not exact
// substrings of the original and indexOf cannot find them. The offsets are
// then approximate by necessity, but they must still be usable: inside the
// text and never going backwards, so the highlight degrades rather than breaks.
test("an unlocatable chunk falls back to a sane offset", () => {
  const text =
    "alpha   beta   gamma   delta   epsilon   zeta   eta   theta   iota   kappa";
  const chunks = splitIntoChunks(text, 20);
  assert.ok(
    chunks.some((c) => text.indexOf(c) === -1),
    "this fixture is meant to produce chunks indexOf cannot find"
  );

  const { offsets } = buildTracking(text, chunks);
  offsets.forEach((offset, i) => {
    assert.ok(offset >= 0, `offset ${i} must never be negative`);
    assert.ok(offset <= text.length, `offset ${i} must stay inside the text`);
    if (i > 0) assert.ok(offset >= offsets[i - 1], "must not go backwards");
  });
});

test("the last chunk ends exactly at the end of the text", () => {
  const text = "One two three. Four five six. Seven eight nine ten eleven twelve.";
  const { chunks, offsets } = assertOffsetsExact(text, 30);
  assert.equal(offsets.at(-1) + chunks.at(-1).length, text.length);
});

// --- wordEndFrom ----------------------------------------------------------

test("finds the end of the word at an offset", () => {
  const text = "hello world again";
  assert.equal(wordEndFrom(text, 0), 5);
  assert.equal(wordEndFrom(text, 6), 11);
});

test("keeps trailing punctuation with the word", () => {
  assert.equal(wordEndFrom("stop. next", 0), 5);
});

test("advances even when sitting on whitespace", () => {
  assert.ok(wordEndFrom("a  b", 1) > 1, "must not return the same index");
});

// --- normalizePhrases -----------------------------------------------------
// Returns null when the caller should fall back to the defaults. The empty
// case is the bug: a cleared board used to resurrect all twelve on reload.

test("a cleared board stays cleared", () => {
  assert.deepEqual(normalizePhrases([]), [], "empty is a real state, not a fallback");
  assert.notEqual(normalizePhrases([]), null);
});

test("nothing saved falls back to the defaults", () => {
  assert.equal(normalizePhrases(null), null);
  assert.equal(normalizePhrases(undefined), null);
});

test("wrong shapes fall back to the defaults", () => {
  assert.equal(normalizePhrases({ not: "an array" }), null);
  assert.equal(normalizePhrases("a string"), null);
  assert.equal(normalizePhrases(42), null);
});

test("malformed entries are dropped and good ones kept", () => {
  const result = normalizePhrases([
    { text: "keep me" },
    null,
    { nope: 1 },
    { text: "   " },
    { text: "keep me too", icon: "☕" },
  ]);
  assert.deepEqual(result.map((p) => p.text), ["keep me", "keep me too"]);
});

test("valid phrases pass through untouched", () => {
  const input = [
    { text: "I'm Thirsty", image: "drink" },
    { text: "Coffee", icon: "☕" },
  ];
  assert.deepEqual(normalizePhrases(input), input);
});

// --- report ---------------------------------------------------------------

if (failures.length) {
  console.error(`\n${failures.length} failing, ${passed} passing\n`);
  failures.forEach(({ name, error }) => {
    console.error(`  ✕ ${name}`);
    console.error(`    ${error.message.split("\n")[0]}`);
  });
  process.exit(1);
}

console.log(`${passed} passing`);

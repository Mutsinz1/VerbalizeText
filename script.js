const board = document.getElementById("board");
const voicesSelect = document.getElementById("voices");
const textarea = document.getElementById("text");
const readButton = document.getElementById("read");
const toggleButton = document.getElementById("toggle");
const pauseButton = document.getElementById("pause");
const stopButton = document.getElementById("stop");
const dialog = document.getElementById("text-box");
const unsupported = document.getElementById("unsupported");
const statusEl = document.getElementById("status");

const editBoardButton = document.getElementById("edit-board");
const boardTools = document.getElementById("board-tools");
const addPhraseButton = document.getElementById("add-phrase");
const resetBoardButton = document.getElementById("reset-board");
const boardEmpty = document.getElementById("board-empty");
const phraseDialog = document.getElementById("phrase-dialog");
const phraseTitle = document.getElementById("phrase-title");
const phraseTextInput = document.getElementById("phrase-text");
const phraseIconInput = document.getElementById("phrase-icon");
const phraseError = document.getElementById("phrase-error");
const phraseSave = document.getElementById("phrase-save");

const readingEl = document.getElementById("reading");
const readingLabel = document.getElementById("reading-label");
const textLabel = document.getElementById("text-label");
const dialogTransport = document.getElementById("dialog-transport");
const dialogPause = document.getElementById("dialog-pause");
const dialogStop = document.getElementById("dialog-stop");
const dialogEdit = document.getElementById("dialog-edit");

const pauseButtons = [pauseButton, dialogPause];
const stopButtons = [stopButton, dialogStop];

const rateInput = document.getElementById("rate");
const pitchInput = document.getElementById("pitch");
const volumeInput = document.getElementById("volume");
const rateValue = document.getElementById("rate-value");
const pitchValue = document.getElementById("pitch-value");
const volumeValue = document.getElementById("volume-value");

const SUPPORTED =
  "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;

const STORAGE_KEY = "verbalize-text:settings";

const DEFAULT_PHRASES = [
  { text: "I'm Thirsty", image: "drink" },
  { text: "I'm Hungry", image: "food" },
  { text: "I'm Tired", image: "tired" },
  { text: "I'm Hurt", image: "hurt" },
  { text: "I'm Happy", image: "happy" },
  { text: "I'm Angry", image: "angry" },
  { text: "I'm Sad", image: "sad" },
  { text: "I'm Scared", image: "scared" },
  { text: "I Want To Go Outside", image: "outside" },
  { text: "I Want To Go Home", image: "home" },
  { text: "I Want To Go To School", image: "school" },
  { text: "I Want To Go To Grandmas", image: "grandma" },
];

const PHRASES_KEY = "verbalize-text:phrases";
const DEFAULT_ICON = "💬";

// --- Settings persistence -------------------------------------------------
// localStorage throws in some privacy modes, so every access is guarded.

function loadSettings() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

function saveSettings() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        voice: voicesSelect.value,
        rate: rateInput.value,
        pitch: pitchInput.value,
        volume: volumeInput.value,
      })
    );
  } catch {
    // Persistence is a convenience; ignore quota or privacy-mode failures.
  }
}

const settings = loadSettings();

// --- Phrase board ---------------------------------------------------------

let phrases = loadPhrases();
let editing = false;

function loadPhrases() {
  try {
    const saved = JSON.parse(localStorage.getItem(PHRASES_KEY));
    // Nothing saved yet means a first visit; a saved empty list means the
    // board was deliberately cleared, so don't resurrect the defaults.
    if (!Array.isArray(saved)) return [...DEFAULT_PHRASES];
    // Drop anything malformed rather than rendering a broken card.
    return saved.filter((p) => p && typeof p.text === "string" && p.text.trim());
  } catch {
    return [...DEFAULT_PHRASES];
  }
}

function savePhrases() {
  try {
    localStorage.setItem(PHRASES_KEY, JSON.stringify(phrases));
  } catch {
    // Persistence is a convenience; ignore quota or privacy-mode failures.
  }
}

function cardFace(phrase) {
  if (phrase.image) {
    const img = document.createElement("img");
    img.src = `img/${phrase.image}.jpg`;
    img.alt = "";
    img.loading = "lazy";
    return img;
  }
  const icon = document.createElement("span");
  icon.className = "icon";
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = phrase.icon || DEFAULT_ICON;
  return icon;
}

function iconButton(label, symbol, onClick, disabled) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "card-action";
  button.setAttribute("aria-label", label);
  button.textContent = symbol;
  button.disabled = !!disabled;
  button.addEventListener("click", onClick);
  return button;
}

function createCard(phrase, index) {
  const info = document.createElement("span");
  info.className = "info";
  info.textContent = phrase.text;

  if (!editing) {
    const box = document.createElement("button");
    box.type = "button";
    box.className = "box";
    box.append(cardFace(phrase), info);
    box.addEventListener("click", () => handleSpeech(phrase.text, box));
    if (!SUPPORTED) box.disabled = true;
    return box;
  }

  const box = document.createElement("div");
  box.className = "box box-editing";
  box.append(cardFace(phrase), info);

  const actions = document.createElement("div");
  actions.className = "card-actions";
  actions.append(
    iconButton(`Move ${phrase.text} earlier`, "◀", () => movePhrase(index, -1), index === 0),
    iconButton(`Edit ${phrase.text}`, "✎", () => openPhraseDialog(index)),
    iconButton(`Remove ${phrase.text}`, "✕", () => removePhrase(index)),
    iconButton(`Move ${phrase.text} later`, "▶", () => movePhrase(index, 1), index === phrases.length - 1)
  );
  box.append(actions);
  return box;
}

function renderBoard() {
  board.replaceChildren(...phrases.map(createCard));
  boardEmpty.hidden = phrases.length > 0;
  board.setAttribute(
    "aria-label",
    editing ? "Quick phrases, editing" : "Quick phrases"
  );
}

function movePhrase(index, delta) {
  const target = index + delta;
  if (target < 0 || target >= phrases.length) return;
  [phrases[index], phrases[target]] = [phrases[target], phrases[index]];
  savePhrases();
  renderBoard();
  // Keep the moved card's control focused so repeated presses keep working.
  const moved = board.children[target];
  const control = moved && moved.querySelector(
    delta < 0 ? '[aria-label^="Move"]' : '[aria-label$="later"]'
  );
  if (control && !control.disabled) control.focus();
}

function removePhrase(index) {
  phrases.splice(index, 1);
  savePhrases();
  renderBoard();
  const next = board.children[Math.min(index, board.children.length - 1)];
  const control = next && next.querySelector(".card-action");
  if (control) control.focus();
  else addPhraseButton.focus();
}

// --- Add / edit dialog ----------------------------------------------------

let editingIndex = null;

function openPhraseDialog(index) {
  editingIndex = index ?? null;
  const existing = index == null ? null : phrases[index];
  phraseTitle.textContent = existing ? "Edit phrase" : "Add a phrase";
  phraseTextInput.value = existing ? existing.text : "";
  phraseIconInput.value = existing && !existing.image ? existing.icon || "" : "";
  phraseError.hidden = true;
  phraseDialog.showModal();
  phraseTextInput.focus();
}

function savePhraseFromDialog() {
  const text = phraseTextInput.value.trim();
  if (!text) {
    phraseError.textContent = "Give the phrase some words.";
    phraseError.hidden = false;
    phraseTextInput.focus();
    return;
  }

  const icon = phraseIconInput.value.trim();
  if (editingIndex == null) {
    phrases.push({ text, icon: icon || DEFAULT_ICON });
  } else {
    const existing = phrases[editingIndex];
    // Editing the text of a default keeps its picture; setting an icon
    // replaces it.
    phrases[editingIndex] = icon
      ? { text, icon }
      : { ...existing, text };
  }

  savePhrases();
  renderBoard();
  phraseDialog.close();
  addPhraseButton.focus();
}

function setEditing(next) {
  editing = next;
  editBoardButton.textContent = editing ? "Done editing" : "Edit board";
  editBoardButton.setAttribute("aria-pressed", String(editing));
  boardTools.hidden = !editing;
  renderBoard();
}

renderBoard();

// --- Speech ---------------------------------------------------------------

let voices = [];

function populateVoices() {
  voices = speechSynthesis.getVoices();
  if (!voices.length) return;

  voices.sort((a, b) => a.lang.localeCompare(b.lang) || a.name.localeCompare(b.name));

  const previous = voicesSelect.value || settings.voice;
  voicesSelect.replaceChildren();

  voices.forEach((voice) => {
    const option = document.createElement("option");
    option.value = voice.name;
    option.textContent = `${voice.name} (${voice.lang})`;
    voicesSelect.appendChild(option);
  });

  const defaultVoice = voices.find((voice) => voice.default) || voices[0];
  const wanted = voices.some((voice) => voice.name === previous)
    ? previous
    : defaultVoice.name;
  voicesSelect.value = wanted;
}

function selectedVoice() {
  return voices.find((voice) => voice.name === voicesSelect.value) || null;
}

function setStatus(message) {
  statusEl.textContent = message;
}

function updateTransport() {
  // Between chunks speechSynthesis.speaking briefly goes false, so the queue
  // counts as active too — otherwise the controls flicker mid-paragraph.
  const active = SUPPORTED && (speechSynthesis.speaking || queuePending());
  const label = active && speechSynthesis.paused ? "Resume" : "Pause";
  stopButtons.forEach((button) => {
    button.disabled = !active;
  });
  pauseButtons.forEach((button) => {
    button.disabled = !active;
    button.textContent = label;
  });
}

let pendingSpeak = null;

// Chrome silently stops speaking after roughly 15 seconds of a single
// utterance. Splitting the text into short chunks and speaking them back to
// back keeps every utterance well under that ceiling.
let queue = [];
let queueIndex = 0;
// cancel() makes Chrome fire "end" on the utterance it kills, which would
// otherwise look identical to a chunk finishing and advance the queue. Every
// run carries a token, and stale events are ignored.
let speechRun = 0;

function queuePending() {
  return queueIndex < queue.length;
}

// Roughly 12 characters a second at rate 1, so this targets ~10s per chunk.
function chunkSize() {
  const rate = Number(rateInput.value) || 1;
  return Math.min(220, Math.max(60, Math.round(120 * rate)));
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
  const sentences = text.match(/[^.!?\n]+[.!?]*\s*|\n+/g) || [text];
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
  return chunks.filter(Boolean);
}

// --- Word tracking --------------------------------------------------------
// Set when reading from the textarea: the full text plus where each chunk
// starts inside it, so a per-chunk boundary offset maps back to the whole.
let tracking = null;

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

function renderReading(chunkStart, chunkEnd, wordStart, wordEnd) {
  if (!tracking) return;
  const { full } = tracking;

  const chunkEl = document.createElement("span");
  chunkEl.className = "chunk";
  let focusEl = chunkEl;

  if (wordStart == null) {
    chunkEl.textContent = full.slice(chunkStart, chunkEnd);
  } else {
    const wordEl = document.createElement("mark");
    wordEl.className = "word";
    wordEl.textContent = full.slice(wordStart, wordEnd);
    chunkEl.append(
      document.createTextNode(full.slice(chunkStart, wordStart)),
      wordEl,
      document.createTextNode(full.slice(wordEnd, chunkEnd))
    );
    focusEl = wordEl;
  }

  readingEl.replaceChildren(
    document.createTextNode(full.slice(0, chunkStart)),
    chunkEl,
    document.createTextNode(full.slice(chunkEnd))
  );

  // "nearest" only scrolls when the word has actually left the box.
  focusEl.scrollIntoView({ block: "nearest", behavior: "auto" });
}

function enterReadingMode() {
  textarea.hidden = true;
  textLabel.hidden = true;
  readButton.hidden = true;
  readingEl.hidden = false;
  readingLabel.hidden = false;
  dialogTransport.hidden = false;
}

function exitReadingMode() {
  tracking = null;
  textarea.hidden = false;
  textLabel.hidden = false;
  readButton.hidden = false;
  readingEl.hidden = true;
  readingLabel.hidden = true;
  dialogTransport.hidden = true;
  readingEl.replaceChildren();
}

function speakingStatus() {
  return queue.length > 1
    ? `Speaking… (${queueIndex + 1} of ${queue.length})`
    : "Speaking…";
}

function stopSpeech(message) {
  speechRun += 1;
  queue = [];
  queueIndex = 0;
  clearTimeout(pendingSpeak);
  speechSynthesis.cancel();
  // cancel() while paused leaves the engine paused in Chrome, which would
  // silently swallow whatever is spoken next.
  if (speechSynthesis.paused) speechSynthesis.resume();
  setStatus(message);
  exitReadingMode();
  updateTransport();
}

function speakChunk(run) {
  if (run !== speechRun) return;

  if (!queuePending()) {
    setStatus("");
    exitReadingMode();
    updateTransport();
    return;
  }

  const index = queueIndex;
  const chunkText = queue[index];
  const utterance = new SpeechSynthesisUtterance(chunkText);
  utterance.voice = selectedVoice();
  utterance.rate = Number(rateInput.value);
  utterance.pitch = Number(pitchInput.value);
  utterance.volume = Number(volumeInput.value);

  const chunkStart = tracking ? tracking.offsets[index] : null;
  const chunkEnd = chunkStart == null ? null : chunkStart + chunkText.length;

  utterance.addEventListener("start", () => {
    if (run !== speechRun) return;
    setStatus(speakingStatus());
    // Highlight the whole chunk up front, so engines without boundary events
    // still show where the reading is.
    if (chunkStart != null) renderReading(chunkStart, chunkEnd, null, null);
    updateTransport();
  });

  utterance.addEventListener("boundary", (e) => {
    if (run !== speechRun || chunkStart == null) return;
    // Some engines also emit sentence boundaries; only words matter here.
    if (e.name && e.name !== "word") return;
    const wordStart = chunkStart + e.charIndex;
    if (wordStart >= chunkEnd) return;
    const wordEnd = e.charLength
      ? Math.min(wordStart + e.charLength, chunkEnd)
      : Math.min(wordEndFrom(tracking.full, wordStart), chunkEnd);
    renderReading(chunkStart, chunkEnd, wordStart, wordEnd);
  });

  utterance.addEventListener("end", () => {
    if (run !== speechRun) return;
    queueIndex += 1;
    speakChunk(run);
  });

  utterance.addEventListener("error", (e) => {
    if (run !== speechRun) return;
    // "interrupted"/"canceled" just mean we replaced this utterance on purpose.
    if (e.error !== "interrupted" && e.error !== "canceled") {
      queue = [];
      queueIndex = 0;
      setStatus("Sorry, that couldn't be spoken.");
    }
    updateTransport();
  });

  speechSynthesis.speak(utterance);
}

function speak(text, { track = false } = {}) {
  if (!SUPPORTED) return;

  const trimmed = text.trim();
  if (!trimmed) {
    setStatus("Enter some text first.");
    textarea.focus();
    return;
  }

  // Drop anything already queued, including a speak still waiting on the
  // timeout below — otherwise rapid taps stack up a backlog.
  stopSpeech("");

  const run = speechRun;
  queue = splitIntoChunks(trimmed, chunkSize());
  queueIndex = 0;

  if (track) {
    tracking = buildTracking(trimmed, queue);
    enterReadingMode();
  }

  updateTransport();

  // Chrome drops utterances queued in the same tick as cancel(), so yield first.
  pendingSpeak = setTimeout(() => speakChunk(run), 0);
}

function handleSpeech(text, box) {
  speak(text);
  box.classList.add("active");
  setTimeout(() => box.classList.remove("active"), 800);
}

// --- Sliders --------------------------------------------------------------

function syncSliderLabels() {
  rateValue.textContent = `${Number(rateInput.value).toFixed(1)}×`;
  pitchValue.textContent = Number(pitchInput.value).toFixed(1);
  volumeValue.textContent = `${Math.round(Number(volumeInput.value) * 100)}%`;
}

if (settings.rate) rateInput.value = settings.rate;
if (settings.pitch) pitchInput.value = settings.pitch;
if (settings.volume) volumeInput.value = settings.volume;
syncSliderLabels();

[rateInput, pitchInput, volumeInput].forEach((input) => {
  input.addEventListener("input", syncSliderLabels);
  input.addEventListener("change", saveSettings);
});

// --- Event listeners ------------------------------------------------------

toggleButton.addEventListener("click", () => {
  dialog.showModal();
  textarea.focus();
});

// Native <dialog> handles Escape and focus trapping; this adds click-outside.
dialog.addEventListener("click", (e) => {
  if (e.target === dialog) dialog.close();
});

voicesSelect.addEventListener("change", saveSettings);

readButton.addEventListener("click", () => speak(textarea.value, { track: true }));

function togglePause() {
  // speechSynthesis.paused doesn't flip synchronously, so set the label from
  // the action we just took rather than re-reading the flag.
  const resuming = speechSynthesis.paused;
  if (resuming) {
    speechSynthesis.resume();
    setStatus(speakingStatus());
  } else {
    speechSynthesis.pause();
    setStatus("Paused.");
  }
  pauseButtons.forEach((button) => {
    button.textContent = resuming ? "Pause" : "Resume";
  });
}

pauseButtons.forEach((button) => button.addEventListener("click", togglePause));
stopButtons.forEach((button) =>
  button.addEventListener("click", () => stopSpeech("Stopped."))
);

editBoardButton.addEventListener("click", () => setEditing(!editing));
addPhraseButton.addEventListener("click", () => openPhraseDialog(null));
phraseSave.addEventListener("click", savePhraseFromDialog);

phraseTextInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    savePhraseFromDialog();
  }
});

phraseDialog.addEventListener("click", (e) => {
  if (e.target === phraseDialog) phraseDialog.close();
});

resetBoardButton.addEventListener("click", () => {
  phrases = [...DEFAULT_PHRASES];
  savePhrases();
  renderBoard();
  addPhraseButton.focus();
});

// Abandon the reading view and go back to editing, without touching playback
// if it has already finished.
dialogEdit.addEventListener("click", () => {
  stopSpeech("");
  textarea.focus();
});

// --- Boot -----------------------------------------------------------------

if (SUPPORTED) {
  speechSynthesis.addEventListener("voiceschanged", populateVoices);
  populateVoices();
  // Some engines report speaking state without firing utterance events.
  setInterval(updateTransport, 500);
} else {
  unsupported.hidden = false;
  [toggleButton, readButton, ...pauseButtons, ...stopButtons].forEach(
    (button) => {
      button.disabled = true;
    }
  );
  editBoardButton.disabled = true;
}

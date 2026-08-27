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

const rateInput = document.getElementById("rate");
const pitchInput = document.getElementById("pitch");
const volumeInput = document.getElementById("volume");
const rateValue = document.getElementById("rate-value");
const pitchValue = document.getElementById("pitch-value");
const volumeValue = document.getElementById("volume-value");

const SUPPORTED =
  "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;

const STORAGE_KEY = "verbalize-text:settings";

const data = [
  { image: "drink", text: "I'm Thirsty" },
  { image: "food", text: "I'm Hungry" },
  { image: "tired", text: "I'm Tired" },
  { image: "hurt", text: "I'm Hurt" },
  { image: "happy", text: "I'm Happy" },
  { image: "angry", text: "I'm Angry" },
  { image: "sad", text: "I'm Sad" },
  { image: "scared", text: "I'm Scared" },
  { image: "outside", text: "I Want To Go Outside" },
  { image: "home", text: "I Want To Go Home" },
  { image: "school", text: "I Want To Go To School" },
  { image: "grandma", text: "I Want To Go To Grandmas" },
];

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

function createBox({ image, text }) {
  const box = document.createElement("button");
  box.type = "button";
  box.className = "box";

  const img = document.createElement("img");
  img.src = `img/${image}.jpg`;
  img.alt = "";
  img.loading = "lazy";

  const info = document.createElement("span");
  info.className = "info";
  info.textContent = text;

  box.append(img, info);
  box.addEventListener("click", () => handleSpeech(text, box));
  board.appendChild(box);
}

data.forEach(createBox);

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
  const speaking = SUPPORTED && speechSynthesis.speaking;
  stopButton.disabled = !speaking;
  pauseButton.disabled = !speaking;
  pauseButton.textContent = SUPPORTED && speechSynthesis.paused ? "Resume" : "Pause";
}

let pendingSpeak = null;

function speak(text) {
  if (!SUPPORTED) return;

  const trimmed = text.trim();
  if (!trimmed) {
    setStatus("Enter some text first.");
    textarea.focus();
    return;
  }

  // Drop anything already queued, including a speak still waiting on the
  // timeout below — otherwise rapid taps stack up a backlog.
  clearTimeout(pendingSpeak);
  speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(trimmed);
  utterance.voice = selectedVoice();
  utterance.rate = Number(rateInput.value);
  utterance.pitch = Number(pitchInput.value);
  utterance.volume = Number(volumeInput.value);

  utterance.addEventListener("start", () => {
    setStatus("Speaking…");
    updateTransport();
  });
  utterance.addEventListener("end", () => {
    setStatus("");
    updateTransport();
  });
  utterance.addEventListener("error", (e) => {
    // "interrupted"/"canceled" just mean we replaced this utterance on purpose.
    if (e.error !== "interrupted" && e.error !== "canceled") {
      setStatus("Sorry, that couldn't be spoken.");
    }
    updateTransport();
  });

  // Chrome drops utterances queued in the same tick as cancel(), so yield first.
  pendingSpeak = setTimeout(() => speechSynthesis.speak(utterance), 0);
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

readButton.addEventListener("click", () => speak(textarea.value));

pauseButton.addEventListener("click", () => {
  // speechSynthesis.paused doesn't flip synchronously, so set the label from
  // the action we just took rather than re-reading the flag.
  if (speechSynthesis.paused) {
    speechSynthesis.resume();
    setStatus("Speaking…");
    pauseButton.textContent = "Pause";
  } else {
    speechSynthesis.pause();
    setStatus("Paused.");
    pauseButton.textContent = "Resume";
  }
});

stopButton.addEventListener("click", () => {
  speechSynthesis.cancel();
  setStatus("Stopped.");
  updateTransport();
});

// --- Boot -----------------------------------------------------------------

if (SUPPORTED) {
  speechSynthesis.addEventListener("voiceschanged", populateVoices);
  populateVoices();
  // Some engines report speaking state without firing utterance events.
  setInterval(updateTransport, 500);
} else {
  unsupported.hidden = false;
  [toggleButton, pauseButton, stopButton, readButton].forEach((button) => {
    button.disabled = true;
  });
  board.querySelectorAll(".box").forEach((box) => {
    box.disabled = true;
  });
}

# 🗣️ Verbalize Text

**Verbalize Text** — hear your words come to life. An easy-to-use web app that
converts text into natural-sounding speech using the Web Speech API. Ideal for
accessibility, presentations, or simply enjoying your written content aloud.

### ▶️ [Try it live](https://mutsinz1.github.io/VerbalizeText/)

No install, no sign-up — it runs entirely in your browser.

## 🚀 Features

- **Phrase board**: Twelve one-tap cards for common everyday phrases.
- **Type your own text**: Enter anything you like and have it read aloud.
- **Voice options**: Choose from every voice your browser offers, across
  accents and languages.
- **Adjustable speed, pitch and volume**: Tune the delivery from slow narration
  to quick playback.
- **Playback controls**: Pause, resume, or stop speech at any time.
- **Handles long text**: Paragraphs are split at sentence boundaries and
  spoken back to back, with progress shown as "Speaking… (2 of 6)". This also
  guards against the length limit some browsers and voices impose on a single
  long utterance, and lets Stop take effect promptly rather than waiting out
  the whole passage.
- **Remembers your settings**: Your chosen voice and sliders persist between
  visits.
- **Keyboard and screen-reader friendly**: Every control is reachable by Tab,
  the dialog closes with Escape, and focus is always visible.
- **Works offline**: Images ship with the project — no external image host.

## 🛠️ How to Use

The quickest way is the [live demo](https://mutsinz1.github.io/VerbalizeText/).
To run it yourself:

1. Clone the repository:
   ```bash
   git clone https://github.com/Mutsinz1/VerbalizeText.git
   ```
2. Open `index.html` in your browser.
3. Tap any phrase card to hear it, or click **Type your own text**.
4. Pick a voice and adjust speed, pitch, and volume as needed.
5. Click **Read aloud** to hear your text.

> Speech synthesis needs a modern browser. Chrome, Edge, and Safari are
> supported; if the API is unavailable the app says so instead of failing
> silently.

## ⌨️ Accessibility

- Skip link to jump straight to the phrase board.
- Phrase cards and the close control are real buttons — usable with
  Enter/Space, not just a mouse.
- The text dialog uses the native `<dialog>` element, so it traps focus, closes
  on Escape, and hides the background from assistive tech.
- Status messages are announced through a polite live region.
- Motion is reduced automatically when `prefers-reduced-motion` is set.

## 🧰 Technologies Used

- **HTML**: Structure of the application.
- **CSS**: Styling and layout.
- **JavaScript**: Logic for text-to-speech conversion using the Web Speech API.

No build step, no dependencies.

## 🖼️ Credits

Phrase-card images are from Brad Traversy's
[vanillawebprojects](https://github.com/bradtraversy/vanillawebprojects)
speech-text-reader demo, vendored into `img/`.

## 🤝 Contributions

Contributions are welcome! Feel free to fork the repository and create a pull
request with your improvements.

## 📜 License

This project is open-source and available under the [MIT License](LICENSE).

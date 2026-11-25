# Text to Speech

**A modern, browser-based text-to-speech reader with live word highlighting, customizable voices, adjustable reading speeds, and a beautiful glassmorphism interface.**

Turn any text into speech directly in your browser. Choose your preferred voice, adjust the reading speed, and follow along as each word is highlighted in real time.

No accounts. No installations. No backend. Just open the app and start listening.

[**View Repository**](https://github.com/hosseinb1111/text-to-speech) · [Report a Bug](https://github.com/hosseinb1111/text-to-speech/issues) · [Request a Feature](https://github.com/hosseinb1111/text-to-speech/issues)

---

## Overview

Text to Speech Pro is a lightweight text-to-speech application built with vanilla HTML, CSS, and JavaScript.

It uses the browser's built-in **Web Speech API** to convert written text into spoken audio. Its focus is on making the reading experience comfortable, interactive, and easy to control.

Whether you're reading articles, studying, reviewing documents, or simply prefer listening to text, Text to Speech Pro provides a simple environment for doing so.

## Features

### Speech & Playback
- **Voice Selection:** Choose from the voices available through your browser and operating system.
- **Playback Controls:** Play, pause, resume, and stop speech.
- **Adjustable Reading Speed:** Five presets ranging from 0.5× to 1.2×.
- **Long Text Support:** Automatically divides longer passages into manageable speech segments.
- **Sentence Navigation:** Select a sentence to begin reading from that point or jump to another sentence during playback.

### Reading Experience
- **Live Word Highlighting:** Highlights the currently spoken word directly in the text area.
- **Automatic Scrolling:** Keeps the currently highlighted word visible while reading.
- **Reading Progress:** Displays playback progress as the text is being spoken.
- **Speech Visualizer:** Animated visualizer bars provide visual feedback during playback.
- **Boundary Event Fallback:** Uses estimated word timing when the browser's speech engine doesn't provide reliable word-boundary events.

### Appearance & Customization
- **Light & Dark Themes:** Switch between two carefully designed visual themes.
- **Glassmorphism Interface:** Translucent surfaces, subtle borders, and soft shadows.
- **Persistent Preferences:** Remembers your selected theme and reading speed between visits.
- **Responsive Layout:** Designed to work across desktop and mobile screen sizes.

## Preview

Explore the application directly through the repository:

[Open Text to Speech Pro on GitHub](https://github.com/hosseinb1111/text-to-speech)

## Getting Started

You don't need Node.js, a build process, or any external JavaScript libraries.

### Option 1: Run Locally

1. Download or clone the repository.
2. Open the project folder.
3. Open `index.html` in a modern browser.
4. Enter your text, select a voice, and press Play.

### Option 2: Clone with Git

```bash
git clone https://github.com/hosseinb1111/text-to-speech.git

cd text-to-speech
```

Then open `index.html` in your browser.

### Option 3: Deploy to a Static Host

The application is entirely client-side, so it can be hosted on static hosting platforms without requiring a backend.

Compatible hosting options include:

- GitHub Pages
- Cloudflare Pages
- Netlify
- Vercel

Simply deploy the project files while preserving their directory structure.

## Project Structure

```text
text-to-speech/
│
├── index.html    # Application structure and interface
├── style.css     # Themes, layout, and visual styling
├── script.js     # Speech synthesis and application logic
├── LICENSE       # MIT License
└── README.md     # Project documentation
```

## How It Works

Text to Speech Pro uses the browser's native **Web Speech API**, specifically the SpeechSynthesis interface.

The application works through three main parts:

| Component | Responsibility |
|---|---|
| HTML | Application structure and controls |
| CSS | Glassmorphism design, themes, and highlighting |
| JavaScript | Speech synthesis, voice selection, playback, and synchronization |

Speech is generated locally through the browser's speech synthesis engine. Available voices and their quality depend on the browser and operating system.

For word highlighting, the application uses speech-boundary events when available. When those events are unreliable, it falls back to estimated word timing.

## Browser Compatibility

The application relies on the Web Speech API.

It is designed for modern versions of:

- Google Chrome
- Microsoft Edge
- Mozilla Firefox
- Apple Safari

**Important:** Speech synthesis support and voice availability vary between browsers and operating systems. Some voices may not provide reliable word-boundary events, so highlighting accuracy can differ.

An internet connection may be required to load the optional Google Fonts. System fonts are used as fallbacks.

## Privacy

Your text stays in your browser.

- No account registration is required.
- No application backend is needed.
- Text is not uploaded to an application server.
- The application does not require a database.
- Theme and speed preferences are stored locally using browser `localStorage`.

**Note:** The actual speech processing and any voice-related services are provided by your browser and operating system. Their own privacy policies apply.

## Technologies

- HTML5
- CSS3
- Vanilla JavaScript
- Web Speech API
- CSS Custom Properties
- LocalStorage
- Google Fonts (Vazirmatn & JetBrains Mono)

No frontend frameworks or external JavaScript libraries are required.

## Contributing

Suggestions, bug reports, and improvements are welcome.

If you'd like to contribute:

1. Fork the repository.
2. Create a new branch for your changes.
3. Make your improvements.
4. Test your changes in a modern browser.
5. Submit a pull request with a description of your changes.

For bugs or feature suggestions, feel free to [open an issue](https://github.com/hosseinb1111/text-to-speech/issues).

## License

This project is licensed under the **MIT License**.

See the [LICENSE](LICENSE) file for details.

---

## Author

Created with ❤️ & ☕ by **Hossein Seyed Bagheri**

[GitHub Profile](https://github.com/hosseinb1111) · [Project Repository](https://github.com/hosseinb1111/text-to-speech)

Copyright © 2026 Hossein Seyed Bagheri.

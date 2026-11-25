(() => {
      'use strict';

      if (!('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) {
        alert("Your browser doesn't support text-to-speech.");
        return;
      }

      const textInput = document.getElementById('textInput');
      const startHint = document.getElementById('startHint');
      const inputGroup = document.getElementById('inputGroup');
      const highlightBackdrop = document.getElementById('highlightBackdrop');
      const highlightMirror = document.getElementById('highlightMirror');
      const playBtn = document.getElementById('playBtn');
      const playBtnText = document.getElementById('playBtnText');
      const playIcon = document.getElementById('playIcon');
      const pauseBtn = document.getElementById('pauseBtn');
      const pauseBtnText = document.getElementById('pauseBtnText');
      const pauseIcon = document.getElementById('pauseIcon');
      const stopBtn = document.getElementById('stopBtn');
      const visualizer = document.getElementById('visualizer');
      const voiceSelect = document.getElementById('voiceSelect');
      const loaderOverlay = document.getElementById('loaderOverlay');
      const loaderText = document.getElementById('loaderText');
      const progressBarFill = document.getElementById('progressBarFill');
      const themeToggle = document.getElementById('themeToggle');
      const themeToggleText = document.getElementById('themeToggleText');
      const themeIcon = document.getElementById('themeIcon');
      const themeColorMeta = document.querySelector('meta[name="theme-color"]');
      const speedButtons = Array.from(document.querySelectorAll('.speed-btn'));
      const speedCurrentValue = document.getElementById('speedCurrentValue');
      const speedCurrentLabel = document.getElementById('speedCurrentLabel');
      const speedNote = document.getElementById('speedNote');

      const synth = window.speechSynthesis;
      const premiumKeywords = ['premium', 'enhanced', 'neural', 'siri', 'google', 'azure', 'natural', 'wavenet'];

      let voices = [];
      let activeVoice = null;
      let voicesLoaded = false;
      let voiceInitializationComplete = false;
      let initProgress = 0;
      let initProgressInterval = null;
      let voicePollInterval = null;
      let voicePollAttempts = 0;

      let currentUtterance = null;
      let pendingPlayback = null;
      let playbackId = 0;
      let playbackChunks = [];
      let currentChunkIndex = 0;
      let activeChunk = null;
      let nextChunkPending = false;
      let activePlaybackText = '';
      let isPaused = false;
      let playProgress = 0;
      let playProgressInterval = null;
      let selectedStartOffset = 0;
      let playbackSessionActive = false;
      const speedPresets = [
        { rate: 0.5, label: 'Slow' },
        { rate: 0.75, label: 'Gentle' },
        { rate: 1, label: 'Normal' },
        { rate: 1.1, label: 'Brisk' },
        { rate: 1.2, label: 'Quick' }
      ];

      let playbackRate = (() => {
        try {
          const savedRate = Number(localStorage.getItem('tts-speed'));
          return speedPresets.some(preset => preset.rate === savedRate) ? savedRate : 1;
        } catch (error) {
          return 1;
        }
      })();
      let pauseWhenCurrentChunkStarts = false;
      let lastHighlightedRange = null;

      let fallbackWordRanges = [];
      let fallbackWordIndex = 0;
      let fallbackNextWordAt = 0;
      let fallbackLastTickAt = 0;
      let fallbackChunkEnd = 0;
      let lastWordBoundaryAt = 0;
      let hasRecentWordBoundaries = false;
      let fallbackTimer = null;
      let activeSpeechText = '';

      /* -------------------------------------------------------------------
         THEME
      ------------------------------------------------------------------- */
      let themeTransitionTimer = null;

      function applyTheme(theme, persist = true) {
        const normalizedTheme = theme === 'dark' ? 'dark' : 'light';
        document.documentElement.dataset.theme = normalizedTheme;
        const isDark = normalizedTheme === 'dark';

        if (persist) {
          document.documentElement.classList.add('tz');
          window.clearTimeout(themeTransitionTimer);
          themeTransitionTimer = window.setTimeout(() => {
            document.documentElement.classList.remove('tz');
          }, 420);
        }

        themeToggle.setAttribute('aria-pressed', String(isDark));
        themeToggle.setAttribute('aria-label', isDark ? 'Switch to light theme' : 'Switch to dark theme');
        themeToggleText.textContent = isDark ? 'Light mode' : 'Dark mode';
        themeIcon.innerHTML = isDark
          ? '<circle cx="12" cy="12" r="4"></circle><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"></path>'
          : '<path d="M20.2 15.1A8.5 8.5 0 0 1 8.9 3.8 8.6 8.6 0 1 0 20.2 15.1Z"></path>';
        if (themeColorMeta) {
          themeColorMeta.setAttribute('content', isDark ? '#0b0b10' : '#f3f5f9');
        }

        if (persist) {
          try { localStorage.setItem('tts-theme', normalizedTheme); } catch (error) {
            console.warn('Could not save the theme preference:', error);
          }
        }
      }

      let savedTheme = 'light';
      try {
        const storedTheme = localStorage.getItem('tts-theme');
        if (storedTheme === 'dark' || storedTheme === 'light') savedTheme = storedTheme;
      } catch (error) {
        console.warn('Could not read the saved theme preference:', error);
      }
      applyTheme(savedTheme, false);

      themeToggle.addEventListener('click', () => {
        const nextTheme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
        applyTheme(nextTheme);
      });

      /* -------------------------------------------------------------------
         VOICE INITIALIZATION
         The browser does not expose a real voice-download percentage.
         This is a staged progress indicator; completion is tied to the
         actual voiceschanged/getVoices result or the default-voice fallback.
      ------------------------------------------------------------------- */
      function updateVoiceProgress(value, message) {
        initProgress = Math.max(0, Math.min(100, value));
        loaderText.textContent = message || `Initializing ${Math.floor(initProgress)}%`;
        progressBarFill.style.width = `${initProgress}%`;
      }

      function startVoiceProgress() {
        loaderOverlay.style.display = 'flex';
        loaderOverlay.style.opacity = '1';
        updateVoiceProgress(0);

        initProgressInterval = window.setInterval(() => {
          if (initProgress < 92) {
            const increment = initProgress < 55 ? 3 : 1;
            updateVoiceProgress(Math.min(92, initProgress + increment));
          }
        }, 140);
      }

      function finishVoiceInitialization() {
        if (voiceInitializationComplete) return;
        voiceInitializationComplete = true;

        window.clearInterval(initProgressInterval);
        window.clearInterval(voicePollInterval);
        updateVoiceProgress(100, voicesLoaded ? 'Voices ready' : 'Default voice ready');

        if (!voicesLoaded) {
          voiceSelect.innerHTML = '';
          const defaultOption = document.createElement('option');
          defaultOption.value = '';
          defaultOption.textContent = 'Default browser voice';
          voiceSelect.appendChild(defaultOption);
        }

        window.setTimeout(() => {
          loaderOverlay.style.opacity = '0';
          window.setTimeout(() => {
            loaderOverlay.style.display = 'none';
            voiceSelect.disabled = false;
          }, 280);
        }, 280);

        if (pendingPlayback) {
          beginPendingPlayback(pendingPlayback.id);
        }
      }

      function loadVoices() {
        let availableVoices = [];
        try {
          availableVoices = synth.getVoices();
        } catch (error) {
          console.warn('Could not read browser voices:', error);
          return;
        }
        if (!availableVoices || availableVoices.length === 0) return;

        // Preserve the current selection when the browser refreshes its voice list.
        const previousVoice = voiceSelect.value !== '' ? voices[Number(voiceSelect.value)] : null;
        const previousVoiceURI = previousVoice?.voiceURI || null;

        voices = Array.from(availableVoices);
        voices.sort((a, b) => {
          const aName = (a.name || '').toLowerCase();
          const bName = (b.name || '').toLowerCase();
          const aIsPremium = premiumKeywords.some(keyword => aName.includes(keyword));
          const bIsPremium = premiumKeywords.some(keyword => bName.includes(keyword));
          if (aIsPremium !== bIsPremium) return aIsPremium ? -1 : 1;

          const aIsEnglish = (a.lang || '').toLowerCase().startsWith('en');
          const bIsEnglish = (b.lang || '').toLowerCase().startsWith('en');
          if (aIsEnglish !== bIsEnglish) return aIsEnglish ? -1 : 1;
          return aName.localeCompare(bName);
        });

        voiceSelect.innerHTML = '';
        voices.forEach((voice, index) => {
          const option = document.createElement('option');
          option.value = String(index);
          const name = voice.name || `Voice ${index + 1}`;
          const language = voice.lang ? ` (${voice.lang})` : '';
          const isPremium = premiumKeywords.some(keyword => name.toLowerCase().includes(keyword));
          option.textContent = `${name}${language}${isPremium ? ' ✨' : ''}`;
          voiceSelect.appendChild(option);
        });

        const preservedIndex = previousVoiceURI
          ? voices.findIndex(voice => voice.voiceURI === previousVoiceURI)
          : -1;
        voiceSelect.selectedIndex = preservedIndex >= 0 ? preservedIndex : 0;
        voicesLoaded = true;

        if (!voiceInitializationComplete) {
          finishVoiceInitialization();
        } else {
          // A voiceschanged event can arrive after the default-voice fallback.
          // Populate the selector for the next playback without restarting it.
          voiceSelect.disabled = false;
        }
      }

      function startVoiceInitialization() {
        startVoiceProgress();
        try { synth.getVoices(); } catch (error) {
          console.warn('Initial voice discovery failed:', error);
        }
        loadVoices();

        if (typeof synth.addEventListener === 'function') {
          synth.addEventListener('voiceschanged', loadVoices);
        } else {
          synth.onvoiceschanged = loadVoices;
        }

        voicePollInterval = window.setInterval(() => {
          if (voiceInitializationComplete) {
            window.clearInterval(voicePollInterval);
            return;
          }

          loadVoices();
          voicePollAttempts += 1;

          // Some browsers return an empty voice list permanently. In that case,
          // stop waiting and allow the browser's built-in default voice to speak.
          if (!voiceInitializationComplete && voicePollAttempts >= 80) {
            finishVoiceInitialization();
          }
        }, 100);
      }

      /* -------------------------------------------------------------------
         PLAY-BUTTON WAITING INDICATOR
         Web Speech API has no numeric audio-readiness progress event. The
         percentage therefore advances as a visual estimate, never reaches
         100%, and stops only when the utterance really fires onstart/error.
      ------------------------------------------------------------------- */
      function startPlayLoading() {
        stopPlayLoading();
        playProgress = 0;
        playBtn.classList.add('waiting');
        playBtnText.textContent = 'Preparing 0%';

        playProgressInterval = window.setInterval(() => {
          const ceiling = voiceInitializationComplete ? 99 : 84;
          let increment;
          if (playProgress < 60) increment = 2;
          else if (playProgress < 80) increment = 1;
          else increment = 0.35;

          playProgress = Math.min(ceiling, playProgress + increment);
          playBtnText.textContent = `Preparing ${Math.floor(playProgress)}%`;
        }, 100);
      }

      function stopPlayLoading() {
        window.clearInterval(playProgressInterval);
        playProgressInterval = null;
        playBtn.classList.remove('waiting');
      }

      /* -------------------------------------------------------------------
         WORD HIGHLIGHTING
         Real browser boundary events are used when available. Some installed
         voices omit them, so a per-chunk timing fallback keeps the highlight
         moving without letting a long document's timer run away.
      ------------------------------------------------------------------- */
      const wordSegmenter = typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function'
        ? new Intl.Segmenter(undefined, { granularity: 'word' })
        : null;

      function escapeHTML(value) {
        return String(value).replace(/[&<>"']/g, character => ({
          '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        })[character]);
      }

      function buildWordRanges(sourceText) {
        if (!sourceText) return [];

        if (wordSegmenter) {
          return Array.from(wordSegmenter.segment(sourceText))
            .filter(part => part.isWordLike)
            .map(part => ({ start: part.index, end: part.index + part.segment.length }));
        }

        const ranges = [];
        const expression = /[\p{L}\p{M}\p{N}_]+(?:['’\-][\p{L}\p{M}\p{N}_]+)*/gu;
        let match;
        while ((match = expression.exec(sourceText)) !== null) {
          ranges.push({ start: match.index, end: match.index + match[0].length });
        }
        return ranges;
      }

      function findWordRange(sourceText, rawIndex) {
        if (!sourceText.length) return null;
        const index = Math.max(0, Math.min(sourceText.length - 1, Number(rawIndex) || 0));
        const ranges = fallbackWordRanges.length && sourceText === activeSpeechText
          ? fallbackWordRanges
          : buildWordRanges(sourceText);

        for (const range of ranges) {
          if (index >= range.start && index < range.end) return range;
          if (range.start >= index) return range;
        }
        return null;
      }

      function syncHighlightScroll() {
        if (!highlightMirror || !textInput || !highlightBackdrop) return;
        const inputStyle = getComputedStyle(textInput);
        const borderLeft = parseFloat(inputStyle.borderLeftWidth) || 0;
        const borderRight = parseFloat(inputStyle.borderRightWidth) || 0;
        // offsetWidth includes classic scrollbars; clientWidth excludes them.
        // Overlay-scrollbar systems naturally report zero here.
        const scrollbarWidth = Math.max(0, textInput.offsetWidth - textInput.clientWidth - borderLeft - borderRight);
        highlightBackdrop.style.right = `${1 + scrollbarWidth}px`;
        highlightMirror.style.transform = `translate3d(${-textInput.scrollLeft}px, ${-textInput.scrollTop}px, 0)`;
      }

      function autoScrollToHighlightedWord() {
        if (!playbackSessionActive || !inputGroup.classList.contains('is-speaking')) return;
        const highlightedWord = highlightMirror.querySelector('.spoken-word-highlight');
        if (!highlightedWord) return;

        const inputRect = textInput.getBoundingClientRect();
        const wordRect = highlightedWord.getBoundingClientRect();
        const visibleTop = inputRect.top + textInput.clientTop + 38;
        const visibleBottom = inputRect.top + textInput.clientTop + textInput.clientHeight - 38;
        let scrollDelta = 0;

        if (wordRect.top < visibleTop) {
          scrollDelta = wordRect.top - visibleTop;
        } else if (wordRect.bottom > visibleBottom) {
          scrollDelta = wordRect.bottom - visibleBottom;
        }

        if (Math.abs(scrollDelta) > 2) {
          const nextScrollTop = Math.max(0, Math.min(
            textInput.scrollHeight - textInput.clientHeight,
            textInput.scrollTop + scrollDelta
          ));
          textInput.scrollTo({ top: nextScrollTop, behavior: 'smooth' });
        }
      }

      function renderSpokenWord(range, sourceText = activeSpeechText) {
        if (!sourceText) return;
        lastHighlightedRange = range ? { start: range.start, end: range.end } : null;
        if (!range) {
          highlightMirror.textContent = sourceText;
          return;
        }

        const before = sourceText.slice(0, range.start);
        const word = sourceText.slice(range.start, range.end);
        const after = sourceText.slice(range.end);
        highlightMirror.innerHTML = `${escapeHTML(before)}<span class="spoken-word-highlight">${escapeHTML(word)}</span>${escapeHTML(after)}`;

        try { textInput.setSelectionRange(range.start, range.end, 'forward'); } catch (error) {
          console.warn('Could not move the speech highlight:', error);
        }
        syncHighlightScroll();
        window.requestAnimationFrame(() => {
          autoScrollToHighlightedWord();
        });
      }

      function stopWordHighlightFallback() {
        window.clearInterval(fallbackTimer);
        fallbackTimer = null;
      }

      function estimateWordDuration(index, spokenText, rate) {
        const range = fallbackWordRanges[index];
        if (!range) return 300;

        const word = spokenText.slice(range.start, range.end);
        const nextRange = fallbackWordRanges[index + 1];
        const gapEnd = nextRange ? nextRange.start : fallbackChunkEnd;
        const punctuationGap = spokenText.slice(range.end, gapEnd);
        const safeRate = Math.max(0.5, Number(rate) || 1);
        let duration = (145 + word.length * 34) / safeRate;

        if (/[.!?。！？…]/u.test(punctuationGap)) duration += 230 / safeRate;
        else if (/[,;:،؛]/u.test(punctuationGap)) duration += 115 / safeRate;
        else if (/\n/.test(punctuationGap)) duration += 100 / safeRate;

        return Math.max(150, Math.min(1000, duration));
      }

      function startWordHighlightFallback(fullText, chunk, rate, requestId) {
        stopWordHighlightFallback();
        activeSpeechText = fullText;
        fallbackChunkEnd = chunk.end;
        fallbackWordRanges = buildWordRanges(chunk.text).map(range => ({
          start: range.start + chunk.start,
          end: range.end + chunk.start
        }));
        fallbackWordIndex = 0;
        lastWordBoundaryAt = 0;
        hasRecentWordBoundaries = false;

        if (!fallbackWordRanges.length) {
          renderSpokenWord(null, fullText);
          return;
        }

        const now = performance.now();
        renderSpokenWord(fallbackWordRanges[0], fullText);
        fallbackNextWordAt = now + estimateWordDuration(0, fullText, rate);
        fallbackLastTickAt = now;

        fallbackTimer = window.setInterval(() => {
          if (requestId !== playbackId || !currentUtterance) {
            stopWordHighlightFallback();
            return;
          }

          const tickTime = performance.now();
          if (synth.paused || isPaused) {
            const pausedDuration = tickTime - fallbackLastTickAt;
            fallbackNextWordAt += pausedDuration;
            if (hasRecentWordBoundaries) lastWordBoundaryAt += pausedDuration;
            fallbackLastTickAt = tickTime;
            return;
          }

          // Prefer real browser word boundaries while they keep arriving. If
          // they stop unexpectedly, resume the estimate instead of freezing.
          if (hasRecentWordBoundaries) {
            const currentDuration = estimateWordDuration(fallbackWordIndex, fullText, rate);
            const boundaryWatchdog = Math.max(750, currentDuration + 450);
            if (tickTime - lastWordBoundaryAt <= boundaryWatchdog) {
              fallbackLastTickAt = tickTime;
              return;
            }
            hasRecentWordBoundaries = false;
            // The boundary stream stopped. Resume from the word after the
            // last confirmed position instead of rapidly catching up several
            // estimated words in one timer tick.
            if (fallbackWordIndex < fallbackWordRanges.length - 1) {
              fallbackNextWordAt = tickTime + estimateWordDuration(fallbackWordIndex + 1, fullText, rate);
            }
          }

          while (fallbackWordIndex < fallbackWordRanges.length - 1 && tickTime >= fallbackNextWordAt) {
            fallbackWordIndex += 1;
            renderSpokenWord(fallbackWordRanges[fallbackWordIndex], fullText);
            fallbackNextWordAt += estimateWordDuration(fallbackWordIndex, fullText, rate);
          }
          fallbackLastTickAt = tickTime;

          // The final word remains highlighted until this chunk's onend event.
          if (fallbackWordIndex >= fallbackWordRanges.length - 1) stopWordHighlightFallback();
        }, 65);
      }

      function updateHighlightFromBoundary(event, fullText, chunk) {
        if (!Number.isFinite(event.charIndex)) return;
        const localIndex = Math.max(0, Math.min(chunk.text.length - 1, event.charIndex));
        const globalIndex = chunk.start + localIndex;
        const range = findWordRange(fullText, globalIndex);
        if (!range) return;

        renderSpokenWord(range, fullText);

        // Sentence-level and word-level boundaries both resynchronize the
        // estimator. Only repeated word boundaries temporarily suspend it.
        const foundIndex = fallbackWordRanges.findIndex(item => item.start === range.start);
        if (foundIndex >= 0) {
          fallbackWordIndex = foundIndex;
          fallbackNextWordAt = performance.now() + estimateWordDuration(foundIndex, fullText, currentUtterance?.rate || 1);
        }

        if (event.name === 'word' || (!event.name && Number(event.charLength) > 0)) {
          lastWordBoundaryAt = performance.now();
          hasRecentWordBoundaries = true;
        }
      }

      textInput.addEventListener('scroll', syncHighlightScroll, { passive: true });
      textInput.addEventListener('input', () => window.requestAnimationFrame(syncHighlightScroll), { passive: true });
      window.addEventListener('resize', syncHighlightScroll, { passive: true });
      if (typeof ResizeObserver !== 'undefined') {
        new ResizeObserver(syncHighlightScroll).observe(textInput);
      }
      if (document.fonts?.ready) {
        document.fonts.ready.then(() => syncHighlightScroll()).catch(() => {});
      }
      window.requestAnimationFrame(syncHighlightScroll);

      function findSentenceStart(sourceText, caretPosition) {
        if (!sourceText) return 0;
        const caret = Math.max(0, Math.min(sourceText.length, Number(caretPosition) || 0));
        const closingMarks = new Set(['"', "'", '”', '’', '»', ')', ']', '}', '）', '】']);
        let start = 0;

        for (let index = caret - 1; index >= 0; index -= 1) {
          const character = sourceText[index];
          if (character === '\n' || character === '\r') {
            start = index + 1;
            break;
          }

          if (/[.!?؟۔…]/u.test(character)) {
            let afterBoundary = index + 1;
            while (afterBoundary < sourceText.length && closingMarks.has(sourceText[afterBoundary])) {
              afterBoundary += 1;
            }
            const hasFollowingText = sourceText.slice(afterBoundary).trim().length > 0;
            if (afterBoundary < sourceText.length && /\s/u.test(sourceText[afterBoundary]) && hasFollowingText) {
              start = afterBoundary;
              break;
            }
          }
        }

        while (start < sourceText.length && /\s/u.test(sourceText[start])) start += 1;
        return start;
      }

      function updateStartHint() {
        if (selectedStartOffset > 0) {
          startHint.innerHTML = `Starting from your selected sentence. Press <strong>Play from here</strong> when you're ready.`;
          playBtnText.textContent = 'Play from here';
        } else {
          startHint.innerHTML = `Tap a sentence to choose where reading starts, then press <strong>Play</strong>. During playback, tap another sentence to jump there.`;
          if (!playbackSessionActive && !playBtn.disabled) playBtnText.textContent = 'Play';
        }
      }

      textInput.addEventListener('click', () => {
        // Let the browser place the textarea caret before reading selectionStart.
        window.setTimeout(() => {
          const sentenceStart = findSentenceStart(textInput.value, textInput.selectionStart);
          if (playbackSessionActive) {
            // While reading or paused, tapping a sentence immediately jumps to it.
            startSpeech(sentenceStart);
          } else {
            // While idle, remember the chosen sentence and let the user press Play.
            selectedStartOffset = sentenceStart;
            updateStartHint();
          }
        }, 0);
      });

      textInput.addEventListener('input', () => {
        selectedStartOffset = 0;
        updateStartHint();
      });

      /* -------------------------------------------------------------------
         PLAYBACK SPEED
         Changing speed during playback restarts from the currently highlighted
         word, rather than making the user wait until the next chunk.
      ------------------------------------------------------------------- */
      function syncPlaybackSpeedButtons() {
        const selectedPreset = speedPresets.find(preset => preset.rate === playbackRate) || speedPresets[2];
        speedButtons.forEach(button => {
          const isSelected = Number(button.dataset.rate) === playbackRate;
          button.classList.toggle('is-active', isSelected);
          button.setAttribute('aria-pressed', String(isSelected));
        });

        speedCurrentValue.textContent = `${Number.isInteger(playbackRate) ? playbackRate : playbackRate.toFixed(2).replace(/0$/, '')}×`;
        speedCurrentLabel.textContent = selectedPreset.label;

        if (playbackRate >= 1.2) {
          speedNote.textContent = 'A gentle speed boost. If this voice still feels rushed, try 1.1×.';
        } else if (playbackRate > 1) {
          speedNote.textContent = 'Just a little quicker than normal, with clarity as the priority.';
        } else if (playbackRate < 1) {
          speedNote.textContent = 'A slower pace gives you more time to follow each word.';
        } else {
          speedNote.textContent = 'Normal speed is recommended for the clearest, most natural reading.';
        }
      }

      speedButtons.forEach(button => {
        button.addEventListener('click', () => {
          const nextRate = Number(button.dataset.rate);
          if (!speedPresets.some(preset => preset.rate === nextRate) || nextRate === playbackRate) return;

          playbackRate = nextRate;
          try { localStorage.setItem('tts-speed', String(playbackRate)); } catch (error) {
            console.warn('Could not save the reading speed:', error);
          }
          syncPlaybackSpeedButtons();

          // Apply a new speed from the currently highlighted word. This avoids
          // restarting the whole passage or abruptly changing mid-word.
          if (playbackSessionActive && activeChunk) {
            const wasPaused = isPaused || synth.paused;
            const restartOffset = lastHighlightedRange?.start ?? activeChunk.start;
            startSpeech(restartOffset, { startPaused: wasPaused });
          }
        });
      });

      syncPlaybackSpeedButtons();

      /* -------------------------------------------------------------------
         UI STATE
      ------------------------------------------------------------------- */
      function clearTextareaHighlight() {
        activeSpeechText = '';
        fallbackWordRanges = [];
        fallbackWordIndex = 0;
        fallbackChunkEnd = 0;
        lastHighlightedRange = null;
        highlightMirror.textContent = '';
        try { textInput.setSelectionRange(0, 0); } catch (error) {
          console.warn('Could not clear the speech selection:', error);
        }
      }

      function updateUI(state) {
        if (state === 'idle') {
          stopPlayLoading();
          playBtn.disabled = false;
          playBtn.setAttribute('aria-busy', 'false');
          playBtnText.textContent = selectedStartOffset > 0 ? 'Play from here' : 'Play';
          playBtn.classList.remove('is-paused');
          playIcon.style.display = 'block';
          pauseBtn.disabled = true;
          pauseBtn.setAttribute('aria-pressed', 'false');
          pauseIcon.innerHTML = '<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"></path>';
          pauseBtnText.textContent = 'Pause';
          stopBtn.disabled = true;
          visualizer.classList.remove('active', 'paused');
          textInput.readOnly = false;
          inputGroup.classList.remove('is-speaking');
          stopWordHighlightFallback();
          clearTextareaHighlight();
          playbackChunks = [];
          activeChunk = null;
          nextChunkPending = false;
          isPaused = false;
        } else if (state === 'preparing') {
          playBtn.disabled = true;
          playBtn.setAttribute('aria-busy', 'true');
          pauseBtn.disabled = true;
          pauseBtn.setAttribute('aria-pressed', 'false');
          playIcon.style.display = 'none';
          stopBtn.disabled = false;
          visualizer.classList.remove('active', 'paused');
          textInput.readOnly = true;
          inputGroup.classList.remove('is-speaking');
          stopWordHighlightFallback();
          isPaused = false;
        } else if (state === 'speaking') {
          stopPlayLoading();
          playBtn.disabled = true;
          playBtn.setAttribute('aria-busy', 'false');
          playBtn.classList.remove('is-paused');
          playBtnText.textContent = 'Speaking...';
          playIcon.style.display = 'none';
          pauseBtn.disabled = false;
          pauseBtn.setAttribute('aria-pressed', 'false');
          pauseIcon.innerHTML = '<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"></path>';
          pauseBtnText.textContent = 'Pause';
          stopBtn.disabled = false;
          visualizer.classList.add('active');
          visualizer.classList.remove('paused');
          textInput.readOnly = true;
          inputGroup.classList.add('is-speaking');
          syncHighlightScroll();
          isPaused = false;
        } else if (state === 'paused') {
          playBtn.setAttribute('aria-busy', 'false');
          pauseBtn.disabled = false;
          pauseBtn.setAttribute('aria-pressed', 'true');
          playBtnText.textContent = 'Paused';
          playBtn.classList.add('is-paused');
          pauseIcon.innerHTML = '<path d="M8 5v14l11-7z"></path>';
          pauseBtnText.textContent = 'Resume';
          visualizer.classList.add('paused');
          isPaused = true;
        }
      }

      /* -------------------------------------------------------------------
         LONG-TEXT PLAYBACK
         Browsers can stall or silently truncate a single very long utterance.
         Split the source into short sentence/word-aligned pieces and speak
         them sequentially. Offsets are retained so highlighting stays aligned
         with the original textarea across every chunk.
      ------------------------------------------------------------------- */
      function splitTextIntoChunks(sourceText, maxLength = 180) {
        const chunks = [];
        const totalLength = sourceText.length;
        let cursor = 0;

        while (cursor < totalLength) {
          while (cursor < totalLength && /\s/.test(sourceText[cursor])) cursor += 1;
          if (cursor >= totalLength) break;

          const hardEnd = Math.min(cursor + maxLength, totalLength);
          let end = hardEnd;

          if (hardEnd < totalLength) {
            const sentenceSearchFloor = cursor + Math.floor(maxLength * 0.5);
            let sentenceBoundary = -1;

            // Prefer a natural sentence boundary near the end of this chunk.
            for (let index = hardEnd - 1; index >= sentenceSearchFloor; index -= 1) {
              if (!/[.!?…。！？]/u.test(sourceText[index])) continue;
              let afterPunctuation = index + 1;
              while (afterPunctuation < totalLength && ['"', "'", '”', '’', '»', '）', ')', ']'].includes(sourceText[afterPunctuation])) {
                afterPunctuation += 1;
              }
              if (afterPunctuation === totalLength || /\s/.test(sourceText[afterPunctuation])) {
                sentenceBoundary = afterPunctuation;
                break;
              }
            }

            if (sentenceBoundary > cursor) {
              end = sentenceBoundary;
            } else {
              // Otherwise split at whitespace so words are not cut in half.
              let whitespaceBoundary = -1;
              for (let index = hardEnd; index > cursor; index -= 1) {
                if (/\s/.test(sourceText[index - 1])) {
                  whitespaceBoundary = index - 1;
                  break;
                }
              }

              if (whitespaceBoundary > cursor) {
                end = whitespaceBoundary;
              } else {
                // Keep a strict upper size even for long URLs or unbroken
                // tokens; the browser engine is more reliable with small jobs.
                end = hardEnd;
              }
            }
          }

          while (end > cursor && /\s/.test(sourceText[end - 1])) end -= 1;
          if (end <= cursor) end = Math.min(cursor + maxLength, totalLength);

          // Avoid leaving a UTF-16 surrogate pair split across two utterances.
          if (end < totalLength && end > cursor) {
            const lastCodeUnit = sourceText.charCodeAt(end - 1);
            const nextCodeUnit = sourceText.charCodeAt(end);
            if (lastCodeUnit >= 0xD800 && lastCodeUnit <= 0xDBFF && nextCodeUnit >= 0xDC00 && nextCodeUnit <= 0xDFFF) {
              end -= 1;
            }
          }

          chunks.push({ start: cursor, end, text: sourceText.slice(cursor, end) });
          cursor = end;
        }

        return chunks;
      }

      function captureSelectedVoice() {
        const selectedIndex = voiceSelect.value;
        activeVoice = selectedIndex !== '' ? (voices[Number(selectedIndex)] || null) : null;
      }

      function assignSelectedVoice(utteranceToPlay) {
        if (activeVoice) utteranceToPlay.voice = activeVoice;
      }

      voiceSelect.addEventListener('change', () => {
        // A changed voice takes effect on the next chunk without interrupting
        // the utterance that is already being spoken.
        if (playbackSessionActive) captureSelectedVoice();
      });

      function beginPendingPlayback(requestId) {
        if (requestId !== playbackId || !pendingPlayback || pendingPlayback.id !== requestId) return;
        if (!voiceInitializationComplete) return;

        pendingPlayback = null;
        captureSelectedVoice();
        // A short delay after voice initialization/cancel avoids a known
        // browser race where the first queued utterance can be ignored.
        window.setTimeout(() => speakChunk(requestId, 0), 80);
      }

      function finishPlayback(requestId) {
        if (requestId !== playbackId) return;
        currentUtterance = null;
        activeChunk = null;
        nextChunkPending = false;
        playbackSessionActive = false;
        selectedStartOffset = 0;
        stopWordHighlightFallback();
        updateUI('idle');
        updateStartHint();
      }

      function speakChunk(requestId, chunkIndex) {
        if (requestId !== playbackId) return;
        if (isPaused || synth.paused) {
          currentChunkIndex = chunkIndex;
          nextChunkPending = true;
          return;
        }

        if (chunkIndex >= playbackChunks.length) {
          finishPlayback(requestId);
          return;
        }

        currentChunkIndex = chunkIndex;
        nextChunkPending = false;
        const chunk = playbackChunks[chunkIndex];
        activeChunk = chunk;
        stopWordHighlightFallback();

        const utterance = new SpeechSynthesisUtterance(chunk.text);
        utterance.rate = playbackRate;
        utterance.pitch = 1.0;
        assignSelectedVoice(utterance);
        currentUtterance = utterance;

        utterance.onstart = () => {
          if (requestId !== playbackId || currentUtterance !== utterance) return;
          updateUI('speaking');
          startWordHighlightFallback(activePlaybackText, chunk, utterance.rate, requestId);
          if (pauseWhenCurrentChunkStarts) {
            pauseWhenCurrentChunkStarts = false;
            synth.pause();
            updateUI('paused');
          }
        };

        utterance.onboundary = event => {
          if (requestId !== playbackId || currentUtterance !== utterance) return;
          updateHighlightFromBoundary(event, activePlaybackText, chunk);
        };

        utterance.onend = () => {
          if (requestId !== playbackId || currentUtterance !== utterance) return;
          stopWordHighlightFallback();
          currentUtterance = null;

          const nextIndex = chunkIndex + 1;
          if (nextIndex >= playbackChunks.length) {
            finishPlayback(requestId);
            return;
          }

          currentChunkIndex = nextIndex;
          // Give the speech engine a tiny queue gap. This helps Chrome and
          // Safari transition reliably between many short utterances.
          window.setTimeout(() => {
            if (requestId !== playbackId) return;
            if (isPaused || synth.paused) {
              nextChunkPending = true;
              return;
            }
            speakChunk(requestId, nextIndex);
          }, 35);
        };

        utterance.onerror = event => {
          if (requestId !== playbackId || currentUtterance !== utterance) return;
          console.error('Speech synthesis error:', event);
          currentUtterance = null;
          finishPlayback(requestId);
          if (event.error && !['canceled', 'interrupted'].includes(event.error)) {
            console.warn(`Speech stopped while reading chunk ${chunkIndex + 1} of ${playbackChunks.length}:`, event.error);
          }
        };

        try {
          synth.speak(utterance);
        } catch (error) {
          console.error('Speech could not be started:', error);
          finishPlayback(requestId);
          alert('The browser could not start speech. Please try again.');
        }
      }

      function startSpeech(requestedOffset = selectedStartOffset, options = {}) {
        const spokenText = textInput.value;
        if (!spokenText.trim()) {
          textInput.focus();
          return;
        }

        let startOffset = Math.max(0, Math.min(spokenText.length, Number(requestedOffset) || 0));
        while (startOffset < spokenText.length && /\s/u.test(spokenText[startOffset])) startOffset += 1;
        if (startOffset >= spokenText.length) startOffset = 0;

        // Invalidate old utterance callbacks before resetting the browser queue.
        playbackId += 1;
        const requestId = playbackId;
        pauseWhenCurrentChunkStarts = false;
        pendingPlayback = null;
        currentUtterance = null;
        stopWordHighlightFallback();
        inputGroup.classList.remove('is-speaking');
        clearTextareaHighlight();
        synth.cancel();

        activePlaybackText = spokenText;
        activeSpeechText = spokenText;
        selectedStartOffset = startOffset;
        playbackChunks = splitTextIntoChunks(spokenText.slice(startOffset)).map(chunk => ({
          start: chunk.start + startOffset,
          end: chunk.end + startOffset,
          text: chunk.text
        }));
        currentChunkIndex = 0;
        activeChunk = null;
        nextChunkPending = false;
        isPaused = false;
        pauseWhenCurrentChunkStarts = Boolean(options.startPaused);
        playbackSessionActive = true;
        activeVoice = null;
        if (voiceInitializationComplete) captureSelectedVoice();

        startPlayLoading();
        updateUI('preparing');

        if (voiceInitializationComplete) {
          // Let cancel() clear the previous browser utterance before speaking.
          window.setTimeout(() => speakChunk(requestId, 0), 80);
        } else {
          pendingPlayback = { id: requestId };
        }
      }

      playBtn.addEventListener('click', () => startSpeech(selectedStartOffset));
      updateStartHint();
      syncHighlightScroll();

      pauseBtn.addEventListener('click', () => {
        if (!playbackSessionActive) return;

        if (isPaused) {
          isPaused = false;
          if (synth.paused) synth.resume();
          updateUI('speaking');
          if (nextChunkPending) {
            const nextIndex = currentChunkIndex;
            nextChunkPending = false;
            window.setTimeout(() => speakChunk(playbackId, nextIndex), 40);
          }
        } else {
          isPaused = true;
          if (synth.speaking) synth.pause();
          updateUI('paused');
        }
      });

      stopBtn.addEventListener('click', () => {
        // Invalidate any pending start/onstart/boundary callbacks.
        playbackId += 1;
        pendingPlayback = null;
        currentUtterance = null;
        playbackChunks = [];
        activeChunk = null;
        nextChunkPending = false;
        playbackSessionActive = false;
        selectedStartOffset = 0;
        stopWordHighlightFallback();
        synth.cancel();
        updateUI('idle');
        updateStartHint();
      });

      startVoiceInitialization();
    })();

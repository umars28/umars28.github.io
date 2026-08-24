/* Shared chat behaviour.
   Markup contract per page:
     [data-avatar]      the character wrapper (gets .is-speaking)
     [data-bubble]      where replies are written
     [data-form]        the ask form
     [data-input]       the text input
     [data-voice]       optional speaker toggle button
     [data-mic]         optional voice-input button
   Swap Agent.ask() for a real /api/chat call when the backend exists. */
window.Agent = (function () {
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var avatar, bubble, form, input, voiceBtn, micBtn;
  var voiceOn = true, idleTimer, hideTimer, typeTimer, speaker = null;

  // Filled from /api/voice. Sensible defaults until it arrives so the first idle line
  // is never silent while we wait on a network round trip.
  var voiceCfg = {
    preferRecording: true,
    english: ['Samantha', 'Google US English', 'Daniel'],
    indonesian: ['Damayanti', 'Google Bahasa Indonesia'],
    rate: 1.0, pitch: 0.95, muted: false, sttLang: ''
  };

  var idle = [
    "Hi — I'm Umar. Ask me anything about my work.",
    "I cut a VM cold boot down to two seconds.",
    "Jenkins, Terraform, Ansible — and 83% off the pipeline.",
    "DevOps, SRE, platform and cloud. Five years."
  ];
  var idleIndex = 0;
  var GENERIC = ['Siri', 'Natural', 'Neural', 'Premium', 'Enhanced', 'Google'];

  var MIN_SENTENCE = 12;

  function isSpace(c) { return c === ' ' || c === '\n' || c === '\t' || c === '\r'; }

  // Only cuts where a sentence demonstrably ended: a terminator, whitespace, then
  // something that starts a new sentence. Anything less splits "v3.1" and "e.g. the".
  // Returns null when the buffer is not yet conclusive, so the caller waits for more.
  function nextSentence(buf) {
    for (var i = 0; i < buf.length; i++) {
      var c = buf.charAt(i);
      if (c !== '.' && c !== '!' && c !== '?') continue;
      if (i + 1 < MIN_SENTENCE) continue;
      if (i + 1 >= buf.length) return null;
      if (!isSpace(buf.charAt(i + 1))) continue;

      var j = i + 1;
      while (j < buf.length && isSpace(buf.charAt(j))) j++;
      if (j >= buf.length) return null;

      var nxt = buf.charAt(j);
      if (nxt >= '0' && nxt <= '9') continue;
      if (nxt !== nxt.toUpperCase()) continue;

      return { say: buf.slice(0, i + 1), rest: buf.slice(j) };
    }
    return null;
  }

  function loadVoiceConfig(done) {
    if (!window.fetch) { done(); return; }
    fetch('/api/voice')
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (cfg) { if (cfg) voiceCfg = cfg; })
      .catch(function () {})
      .then(done);
  }

  var api = {
    show: function () { if (bubble) bubble.classList.add('is-visible'); },
    hide: function () {
      if (bubble) bubble.classList.remove('is-visible');
      if (avatar) avatar.classList.remove('is-speaking');
    },

    thinking: function () {
      clearTimeout(hideTimer); clearTimeout(typeTimer);
      bubble.innerHTML = '<span class="dots"><i></i><i></i><i></i></span>';
      this.show();
    },

    reply: function (text, opts) {
      var self = this;
      opts = opts || {};
      clearTimeout(hideTimer); clearTimeout(typeTimer);
      this.show();
      avatar.classList.add('is-speaking');

      if (reduced) { bubble.textContent = text; self.finish(text, opts); return; }

      var i = 0;
      bubble.innerHTML = '';
      var body = document.createTextNode('');
      var caret = document.createElement('span');
      caret.className = 'caret';
      bubble.append(body, caret);

      (function step() {
        if (i >= text.length) { caret.remove(); self.finish(text, opts); return; }
        i += 1;
        body.nodeValue = text.slice(0, i);
        typeTimer = setTimeout(step, 18);
      })();
    },

    finish: function (text, opts) {
      var self = this;
      if (!opts.stillSpeaking) avatar.classList.remove('is-speaking');
      if (voiceOn && opts.aloud !== false) {
        if (opts.audioId && voiceCfg.preferRecording) self.playRecording(opts.audioId, text);
        else self.speakAloud(text);
      }
      hideTimer = setTimeout(function () { self.hide(); }, opts.hold || 4200);
    },

    // A real recording beats the synthesiser every time, so it wins when one exists.
    // The mouth is driven by the actual waveform rather than a fixed keyframe loop.
    playRecording: function (id, fallbackText) {
      var self = this;
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();

      var audio = new Audio('/audio/' + id);
      audio.onerror = function () { self.speakAloud(fallbackText); };
      audio.onended = function () { avatar.classList.remove('is-speaking'); };

      audio.play().then(function () {
        avatar.classList.add('is-speaking');
        self.driveMouth(audio);
      }).catch(function () {
        self.speakAloud(fallbackText);
      });
    },

    driveMouth: function (audio) {
      var Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx || reduced) return;

      var mouth = avatar.querySelector('.a-mouth');
      if (!mouth) return;

      try {
        var ctx = new Ctx();
        var src = ctx.createMediaElementSource(audio);
        var analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        src.connect(analyser);
        analyser.connect(ctx.destination);

        var data = new Uint8Array(analyser.frequencyBinCount);
        (function frame() {
          if (audio.paused || audio.ended) {
            mouth.style.transform = '';
            ctx.close();
            return;
          }
          analyser.getByteTimeDomainData(data);
          var peak = 0;
          for (var i = 0; i < data.length; i++) {
            var v = Math.abs(data[i] - 128) / 128;
            if (v > peak) peak = v;
          }
          mouth.style.transform = 'scaleY(' + (1 + Math.min(peak * 5, 1.6)).toFixed(2) + ')';
          requestAnimationFrame(frame);
        })();
      } catch (e) {
        // Amplitude sync is a nicety; if the audio graph is unavailable the clip
        // still plays with the default speaking animation.
      }
    },

    detectLang: function (text) {
      var id = /\b(yang|dan|saya|tidak|dengan|untuk|adalah|bisa|apa|ini|itu|dari|kerja|pengalaman)\b/gi;
      var hits = (text.match(id) || []).length;
      return hits >= 2 ? 'id-ID' : 'en-US';
    },

    // Walks the preference list from the CMS and takes the first voice this device
    // actually has. Names chosen on a Mac mean nothing on Windows, so a miss is normal
    // and must degrade quietly rather than fall silent.
    pickVoice: function (lang) {
      var all = window.speechSynthesis.getVoices();
      if (!all.length) return null;

      var base = lang.split('-')[0];
      var pool = all.filter(function (v) { return v.lang.toLowerCase().indexOf(base) === 0; });
      if (!pool.length) pool = all.filter(function (v) { return v.lang.toLowerCase().indexOf('en') === 0; });
      if (!pool.length) return null;

      var wanted = base === 'id' ? voiceCfg.indonesian : voiceCfg.english;
      for (var i = 0; i < (wanted || []).length; i++) {
        var match = pool.filter(function (v) { return v.name.indexOf(wanted[i]) !== -1; })[0];
        if (match) return match;
      }
      for (var j = 0; j < GENERIC.length; j++) {
        var g = pool.filter(function (v) { return v.name.indexOf(GENERIC[j]) !== -1; })[0];
        if (g) return g;
      }
      var local = pool.filter(function (v) { return v.localService; })[0];
      return local || pool[0];
    },

    utterance: function (text, lang) {
      var u = new SpeechSynthesisUtterance(text);
      u.lang = lang;
      u.rate = voiceCfg.rate || 1.0;
      u.pitch = voiceCfg.pitch || 0.95;
      var voice = this.pickVoice(lang);
      if (voice) u.voice = voice;
      return u;
    },

    newSpeaker: function (lang) {
      if (!('speechSynthesis' in window)) return null;
      window.speechSynthesis.cancel();

      var self = this;
      var outstanding = 0;
      var buffer = '';

      function enqueue(sentence) {
        var text = sentence.trim();
        if (!text) return;

        var u = self.utterance(text, lang);
        outstanding += 1;
        u.onstart = function () { avatar.classList.add('is-speaking'); };
        u.onend = function () {
          outstanding -= 1;
          if (outstanding <= 0) avatar.classList.remove('is-speaking');
        };
        u.onerror = u.onend;
        window.speechSynthesis.speak(u);
      }

      return {
        feed: function (chunk) {
          buffer += chunk;
          var cut;
          while ((cut = nextSentence(buffer)) !== null) {
            enqueue(cut.say);
            buffer = cut.rest;
          }
        },
        flush: function () {
          if (buffer.trim()) enqueue(buffer);
          buffer = '';
        },
        stop: function () {
          buffer = '';
          outstanding = 0;
          window.speechSynthesis.cancel();
          avatar.classList.remove('is-speaking');
        }
      };
    },

    speakAloud: function (text) {
      if (!('speechSynthesis' in window)) return;
      window.speechSynthesis.cancel();

      var self = this;
      var lang = this.detectLang(text);
      var u = new SpeechSynthesisUtterance(text);
      u.lang = lang;
      u.rate = voiceCfg.rate || 1.0;
      u.pitch = voiceCfg.pitch || 0.95;

      var voice = this.pickVoice(lang);
      if (voice) u.voice = voice;

      u.onstart = function () { avatar.classList.add('is-speaking'); };
      u.onend   = function () { avatar.classList.remove('is-speaking'); };

      if (!voice && window.speechSynthesis.getVoices().length === 0) {
        window.speechSynthesis.addEventListener('voiceschanged', function once() {
          window.speechSynthesis.removeEventListener('voiceschanged', once);
          var v = self.pickVoice(lang);
          if (v) u.voice = v;
          window.speechSynthesis.speak(u);
        });
        return;
      }
      window.speechSynthesis.speak(u);
    },

    open: function () {
      clearTimeout(hideTimer); clearTimeout(typeTimer);
      this.show();
      avatar.classList.add('is-speaking');
      bubble.innerHTML = '';
      var body = document.createTextNode('');
      var caret = document.createElement('span');
      caret.className = 'caret';
      bubble.append(body, caret);
      return { body: body, caret: caret };
    },

    ask: function (question) {
      var self = this;
      clearInterval(idleTimer);
      if (speaker) { speaker.stop(); speaker = null; }

      if (!window.fetch || !window.ReadableStream) {
        self.thinking();
        setTimeout(function () { self.reply(self.canned(question), { hold: 7000 }); }, 500);
        return;
      }

      self.thinking();

      var controller = new AbortController();
      var timeout = setTimeout(function () { controller.abort(); }, 60000);

      fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: question }),
        signal: controller.signal
      }).then(function (res) {
        if (!res.ok || !res.body) throw new Error('http ' + res.status);

        var reader = res.body.getReader();
        var decoder = new TextDecoder();
        var buffer = '';
        var started = false;
        var sink = null;
        var full = '';
        var source = '';
        var lang = self.detectLang(question);

        function handleEvent(block) {
          var name = '';
          var dataLines = [];
          block.split('\n').forEach(function (line) {
            if (line.indexOf('event:') === 0) name = line.slice(6).trim();
            else if (line.indexOf('data:') === 0) dataLines.push(line.slice(5).trim());
          });
          if (!dataLines.length) return true;

          var payload;
          try { payload = JSON.parse(dataLines.join('\n')); } catch (e) { return true; }

          if (name === 'error') {
            if (speaker) { speaker.stop(); speaker = null; }
            self.reply(self.canned(question), { hold: 7000 });
            return false;
          }
          if (name === 'meta') {
            source = payload.source || '';
            return true;
          }
          if (name === 'done') {
            if (sink) sink.caret.remove();
            if (speaker) {
              speaker.flush();
              speaker = null;
              self.finish(full, { hold: 8000, aloud: false, stillSpeaking: true });
            } else {
              self.finish(full, {
                hold: 8000,
                audioId: payload.voice ? payload.answerId : 0
              });
            }
            return false;
          }
          if (payload.t) {
            if (!started) {
              started = true;
              sink = self.open();
              if (source === 'model' && voiceOn && !voiceCfg.muted) {
                speaker = self.newSpeaker(lang);
              }
            }
            full += payload.t;
            sink.body.nodeValue = full;
            if (speaker) speaker.feed(payload.t);
          }
          return true;
        }

        return (function pump() {
          return reader.read().then(function (chunk) {
            if (chunk.done) {
              clearTimeout(timeout);
              if (sink) sink.caret.remove();
              if (speaker) {
                speaker.flush();
                speaker = null;
                if (full) self.finish(full, { hold: 8000, aloud: false, stillSpeaking: true });
                return;
              }
              if (full) self.finish(full, { hold: 8000 });
              return;
            }
            buffer += decoder.decode(chunk.value, { stream: true });

            var cut;
            while ((cut = buffer.indexOf('\n\n')) !== -1) {
              var block = buffer.slice(0, cut);
              buffer = buffer.slice(cut + 2);
              if (block.charAt(0) === ':') continue;
              if (!handleEvent(block)) { clearTimeout(timeout); reader.cancel(); return; }
            }
            return pump();
          });
        })();
      }).catch(function () {
        clearTimeout(timeout);
        if (speaker) { speaker.stop(); speaker = null; }
        self.reply(self.canned(question), { hold: 7000 });
      });
    },

    canned: function (q) {
      var s = (q || '').toLowerCase();
      if (/qemu|vm|hypervisor|proxmox|boot/.test(s))
        return "I wrote a Go orchestrator that speaks QMP directly to QEMU/KVM — no libvirt in the path. Cold boot came down to two seconds.";
      if (/pipeline|ci|cd|jenkins|terraform|ansible/.test(s))
        return "Jenkins pipelines for Terraform and Ansible, with lint, test and security gates. Stage time dropped about 83%.";
      if (/go|golang|stream|grpc/.test(s))
        return "Go is my primary language. The biggest thing I built with it multiplexes 19,400+ concurrent gRPC and SSE streams from 194 agents.";
      if (/hire|available|remote|salary|work|role/.test(s))
        return "I'm open to DevOps, SRE, platform and cloud roles — Jakarta area or fully remote, one month notice.";
      return "Demo answer for now — the real one will run through an LLM grounded in Umar's CV. Try asking about QEMU, pipelines, Go, or availability.";
    },

    init: function () {
      avatar  = document.querySelector('[data-avatar-main]') || document.querySelector('[data-avatar]');
      bubble  = document.querySelector('[data-bubble]');
      form    = document.querySelector('[data-form]');
      input   = document.querySelector('[data-input]');
      voiceBtn= document.querySelector('[data-voice]');
      micBtn  = document.querySelector('[data-mic]');
      if (!avatar || !bubble) return;

      var self = this;

      loadVoiceConfig(function () {
        if (voiceCfg.muted) {
          voiceOn = false;
          if (voiceBtn) {
            voiceBtn.setAttribute('aria-pressed', 'false');
            voiceBtn.textContent = '🔇';
          }
        }
      });

      setTimeout(function () { self.reply(idle[0], { aloud: false, hold: 3600 }); }, 900);
      if (!reduced) {
        idleTimer = setInterval(function () {
          if (document.activeElement === input) return;
          idleIndex = (idleIndex + 1) % idle.length;
          self.reply(idle[idleIndex], { aloud: false, hold: 3600 });
        }, 8000);
      }

      if (!reduced && window.matchMedia('(pointer: fine)').matches) {
        var pupils = avatar.querySelectorAll('.a-pupil');
        window.addEventListener('mousemove', function (e) {
          var box = avatar.getBoundingClientRect();
          if (!box.width) return;
          var cx = box.left + box.width / 2, cy = box.top + box.height * 0.42;
          var dx = Math.max(-1, Math.min(1, (e.clientX - cx) / (box.width * 0.7)));
          var dy = Math.max(-1, Math.min(1, (e.clientY - cy) / (box.height * 0.6)));
          pupils.forEach(function (p) {
            p.style.transform = 'translate(' + (dx * 3.4).toFixed(2) + 'px,' + (dy * 2.6).toFixed(2) + 'px)';
          });
        }, { passive: true });
      }

      if (form) {
        form.addEventListener('submit', function (e) {
          e.preventDefault();
          var v = input.value.trim();
          if (!v) { input.focus(); return; }
          self.ask(v);
          input.value = '';
        });
      }

      document.querySelectorAll('[data-suggest]').forEach(function (chip) {
        chip.addEventListener('click', function () {
          self.ask(chip.dataset.suggest || chip.textContent.trim());
        });
      });

      if (voiceBtn) {
        voiceBtn.addEventListener('click', function () {
          voiceOn = !voiceOn;
          voiceBtn.setAttribute('aria-pressed', String(voiceOn));
          voiceBtn.textContent = voiceOn ? '🔊' : '🔇';
          if (!voiceOn) {
            if (speaker) { speaker.stop(); speaker = null; }
            if ('speechSynthesis' in window) window.speechSynthesis.cancel();
          }
        });
      }

      var Recog = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (micBtn) {
        if (!Recog) { micBtn.disabled = true; micBtn.style.opacity = '.3'; micBtn.title = 'Voice input needs Chrome'; }
        else {
          var rec = new Recog();
          rec.lang = voiceCfg.sttLang || navigator.language || 'en-US';
          rec.interimResults = false;
          var listening = false;
          micBtn.addEventListener('click', function () {
            if (listening) { rec.stop(); return; }
            try { rec.start(); } catch (err) {}
          });
          rec.onstart  = function () { listening = true;  micBtn.setAttribute('aria-pressed','true'); };
          rec.onend    = function () { listening = false; micBtn.removeAttribute('aria-pressed'); };
          rec.onresult = function (e) { self.ask(e.results[0][0].transcript); };
        }
      }
    }
  };

  document.addEventListener('DOMContentLoaded', function () { api.init(); });
  return api;
})();

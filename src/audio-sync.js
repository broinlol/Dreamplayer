export class AudioSynchronizer {
  constructor(audio, { onTime, onState, onError } = {}) {
    this.audio = audio;
    this.onTime = onTime || (() => {});
    this.onState = onState || (() => {});
    this.onError = onError || (() => {});
    this.frame = 0;
    this.tick = this.tick.bind(this);
    audio.addEventListener("play", () => { this.onState("playing"); this.tick(); });
    audio.addEventListener("pause", () => { cancelAnimationFrame(this.frame); this.onState(audio.ended ? "ended" : "paused"); this.emit(); });
    audio.addEventListener("seeked", () => this.emit(true));
    audio.addEventListener("loadedmetadata", () => this.emit(true));
    audio.addEventListener("ended", () => { cancelAnimationFrame(this.frame); this.onState("ended"); this.emit(true); });
    audio.addEventListener("error", () => this.onError("The audio file could not be loaded or played. Try MP3 or WAV, then import it again."));
  }

  emit(immediate = false) {
    this.onTime(this.audio.currentTime || 0, Number.isFinite(this.audio.duration) ? this.audio.duration : 0, immediate);
  }

  tick() {
    this.emit();
    if (!this.audio.paused && !this.audio.ended) this.frame = requestAnimationFrame(this.tick);
  }

  load(source, volume = 0.85) {
    this.audio.pause();
    this.audio.removeAttribute("src");
    if (source) this.audio.src = source;
    this.audio.volume = Math.min(1, Math.max(0, Number(volume) || 0));
    this.audio.load();
    this.emit(true);
  }

  async toggle() {
    if (!this.audio.src) throw new Error("This project has no audio file. Open Tiny Director and choose an audio file first.");
    if (this.audio.paused) await this.audio.play(); else this.audio.pause();
  }

  seek(seconds) {
    this.audio.currentTime = Math.max(0, Number(seconds) || 0);
    this.emit(true);
  }

  restart() {
    this.audio.pause();
    this.seek(0);
    this.onState("stopped");
  }
}

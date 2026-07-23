const tracks = [
  { id: 1, title: "Toxicity", artist: "Adam James", bpm: 128, key: "1A", duration: 214, ready: true, color: "#12e6f2", cover: "linear-gradient(135deg,#103e49,#156f76)", cues: [18, 43, 86, 185] },
  { id: 2, title: "Say It Again", artist: "Will Sparks", bpm: 132, key: "9A", duration: 196, ready: true, color: "#ff3c8e", cover: "linear-gradient(135deg,#5a1237,#b92869)", cues: [8, 37, 71, 166] },
  { id: 3, title: "Mercury", artist: "HI-LO, Space 92, Oliver Heldens", bpm: 130, key: "6A", duration: 252, ready: true, color: "#a7f432", cover: "linear-gradient(135deg,#294716,#729f21)", cues: [16, 63, 94, 221] },
  { id: 4, title: "Lose Control", artist: "Marten Hørger", bpm: 126, key: "4A", duration: 228, ready: false, color: "#9277ff", cover: "linear-gradient(135deg,#281d5d,#6049b8)", cues: [12, null, 78, null] },
  { id: 5, title: "Interstellar", artist: "Anna Reusch", bpm: 135, key: "7B", duration: 288, ready: true, color: "#ffcb3d", cover: "linear-gradient(135deg,#6d4a0b,#c18112)", cues: [32, 68, 104, 254] },
  { id: 6, title: "Afterglow", artist: "LUCATI", bpm: 124, key: "2A", duration: 203, ready: false, color: "#ff715b", cover: "linear-gradient(135deg,#562018,#b74534)", cues: [16, null, null, 186] }
];

const cueTypes = [
  { label: "INTRO", color: "#12e6f2" },
  { label: "VOCAL", color: "#ff3c8e" },
  { label: "DROP", color: "#9277ff" },
  { label: "OUTRO", color: "#a7f432" }
];

const state = { filter: "all", query: "", sortAsc: true, selected: null, current: null, position: 0, playing: false, timer: null };
const $ = (selector) => document.querySelector(selector);
const trackList = $("#trackList");

function icon(type) {
  return type === "play"
    ? '<svg viewBox="0 0 24 24"><path d="m8 5 11 7-11 7Z"/></svg>'
    : '<svg viewBox="0 0 24 24"><path d="M4 16v4h4M20 8V4h-4M5 11a7 7 0 0 1 12-4l3 1M19 13a7 7 0 0 1-12 4l-3-1"/></svg>';
}

function time(value) {
  if (value == null) return "Nenastaveno";
  const min = Math.floor(value / 60);
  const sec = (value % 60).toFixed(1).padStart(4, "0");
  return `${String(min).padStart(2, "0")}:${sec}`;
}

function renderTracks() {
  const filtered = tracks
    .filter((track) => state.filter === "all" || (state.filter === "ready" ? track.ready : !track.ready))
    .filter((track) => `${track.title} ${track.artist}`.toLowerCase().includes(state.query.toLowerCase()))
    .sort((a, b) => state.sortAsc ? a.bpm - b.bpm : b.bpm - a.bpm);

  trackList.innerHTML = filtered.map((track) => `
    <article class="track-card" style="--track-color:${track.color}">
      <div class="cover" style="--cover:${track.cover}">${track.title.slice(0, 2).toUpperCase()}</div>
      <div class="track-main">
        <h3 class="track-title">${track.title}</h3>
        <p class="track-artist">${track.artist}</p>
        <div class="track-meta">
          <span class="meta-pill">${track.bpm} BPM</span>
          <span class="meta-pill key-pill">${track.key}</span>
          <span class="cue-dots" aria-label="${track.cues.filter(v => v != null).length} ze 4 cue pointů">
            ${track.cues.map(value => `<i class="${value != null ? "on" : ""}"></i>`).join("")}
          </span>
        </div>
      </div>
      <div class="track-actions">
        <button data-action="play" data-id="${track.id}" aria-label="Přehrát ${track.title}">${icon("play")}</button>
        <button data-action="edit" data-id="${track.id}" aria-label="Upravit cue pointy">${icon("edit")}</button>
      </div>
    </article>
  `).join("");
  $("#emptyState").hidden = filtered.length > 0;
}

function selectTrack(track, autoplay = false) {
  state.current = track;
  state.position = 0;
  $("#nowPlayingTitle").textContent = track.title;
  $("#nowPlayingArtist").textContent = `${track.artist} · ${track.bpm} BPM · ${track.key}`;
  $("#cueShortcut").disabled = false;
  if (autoplay) setPlaying(true);
}

function setPlaying(value) {
  if (!state.current) return;
  state.playing = value;
  $("#player").classList.toggle("playing", value);
  $("#editorPlay").classList.toggle("playing", value);
  clearInterval(state.timer);
  if (value) {
    state.timer = setInterval(() => {
      state.position += .1;
      if (state.position >= state.current.duration) state.position = 0;
      updatePosition();
    }, 100);
  }
}

function updatePosition() {
  if (!state.current) return;
  $("#currentTime").textContent = time(state.position);
  $("#playhead").style.left = `calc(16px + ${(state.position / state.current.duration) * 100}% - ${(state.position / state.current.duration) * 32}px)`;
  document.querySelectorAll(".waveform > i").forEach((bar, index, bars) => {
    bar.classList.toggle("past", index / bars.length < state.position / state.current.duration);
  });
}

function waveformBars(track) {
  let seed = track.id * 113;
  return Array.from({ length: 120 }, (_, index) => {
    seed = (seed * 9301 + 49297) % 233280;
    const noise = seed / 233280;
    const envelope = .42 + Math.abs(Math.sin(index / 10)) * .55;
    return `<i style="height:${Math.max(8, noise * 92 * envelope)}%"></i>`;
  }).join("");
}

function renderCues() {
  const track = state.selected;
  $("#cueGrid").innerHTML = cueTypes.map((cue, index) => `
    <button class="cue-slot" data-cue="${index}" style="--cue-color:${cue.color}">
      <span>${String(index + 1).padStart(2, "0")} · ${cue.label}</span>
      <strong>${time(track.cues[index])}</strong>
      <small>${track.cues[index] == null ? "Kliknutím přidat" : "Kliknutím přepsat"}</small>
    </button>
  `).join("");

  document.querySelectorAll(".cue-marker").forEach((marker) => marker.remove());
  track.cues.forEach((value, index) => {
    if (value == null) return;
    const marker = document.createElement("span");
    marker.className = "cue-marker";
    marker.dataset.label = index + 1;
    marker.style.cssText = `--cue-color:${cueTypes[index].color};left:calc(16px + ${(value / track.duration) * 100}% - ${(value / track.duration) * 32}px)`;
    $(".waveform-wrap").appendChild(marker);
  });
}

function openEditor(track) {
  if (!track) return;
  selectTrack(track);
  state.selected = track;
  $("#sheetTitle").textContent = track.title;
  $("#sheetArtist").textContent = `${track.artist} · ${track.bpm} BPM · ${track.key}`;
  $("#durationTime").textContent = time(track.duration);
  $("#waveform").innerHTML = waveformBars(track);
  renderCues();
  updatePosition();
  document.body.classList.add("sheet-open");
}

function closeEditor() {
  document.body.classList.remove("sheet-open");
}

trackList.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-id]");
  if (!button) return;
  const track = tracks.find((item) => item.id === Number(button.dataset.id));
  if (button.dataset.action === "edit") openEditor(track);
  else selectTrack(track, true);
});

$("#searchInput").addEventListener("input", (event) => { state.query = event.target.value; renderTracks(); });
$("#filters").addEventListener("click", (event) => {
  const button = event.target.closest(".filter");
  if (!button) return;
  state.filter = button.dataset.filter;
  document.querySelectorAll(".filter").forEach((item) => item.classList.toggle("active", item === button));
  renderTracks();
});
$("#sortButton").addEventListener("click", () => { state.sortAsc = !state.sortAsc; renderTracks(); });
$("#playerButton").addEventListener("click", () => setPlaying(!state.playing));
$("#editorPlay").addEventListener("click", () => setPlaying(!state.playing));
$("#cueShortcut").addEventListener("click", () => openEditor(state.current));
$("#closeSheet").addEventListener("click", closeEditor);
$("#sheetBackdrop").addEventListener("click", closeEditor);
$("#backButton").addEventListener("click", () => { state.position = Math.max(0, state.position - 10); updatePosition(); });
$("#forwardButton").addEventListener("click", () => { state.position = Math.min(state.current.duration, state.position + 10); updatePosition(); });
$(".waveform-wrap").addEventListener("click", (event) => {
  if (event.target.closest(".wave-time")) return;
  const rect = $("#waveform").getBoundingClientRect();
  state.position = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)) * state.current.duration;
  updatePosition();
});
$("#cueGrid").addEventListener("click", (event) => {
  const slot = event.target.closest(".cue-slot");
  if (!slot) return;
  state.selected.cues[Number(slot.dataset.cue)] = Math.round(state.position * 10) / 10;
  state.selected.ready = state.selected.cues.every((value) => value != null);
  renderCues();
});
$("#saveCues").addEventListener("click", () => {
  renderTracks();
  closeEditor();
  $("#toast").classList.add("show");
  setTimeout(() => $("#toast").classList.remove("show"), 2200);
});
$("#addTrackButton").addEventListener("click", () => {
  $("#toast").textContent = "Import skladeb bude dostupný po připojení knihovny";
  $("#toast").classList.add("show");
  setTimeout(() => {
    $("#toast").classList.remove("show");
    setTimeout(() => $("#toast").textContent = "Cue pointy byly uloženy", 400);
  }, 2200);
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeEditor();
  if (event.code === "Space" && !event.target.matches("input")) {
    event.preventDefault();
    setPlaying(!state.playing);
  }
});

renderTracks();

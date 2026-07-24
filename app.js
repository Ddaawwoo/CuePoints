const cueTypes = [
  ["INTRO", "#12e6f2"], ["BUILD", "#ffcb3d"], ["VOCAL", "#ff3c8e"], ["DROP 1", "#9277ff"],
  ["BREAK", "#ff715b"], ["DROP 2", "#42d392"], ["MIX OUT", "#58a6ff"], ["OUTRO", "#a7f432"]
];

const tracks = [];

const state = { filter:"all", query:"", sortAsc:true, selected:null, current:null, position:0, playing:false, timer:null, zoom:1 };
const $ = (s) => document.querySelector(s);
const audio = $("#audioElement");

function time(value, decimal=true) {
  if (value == null) return "Nenastaveno";
  const min = Math.floor(value / 60);
  const sec = decimal ? (value % 60).toFixed(1).padStart(4,"0") : String(Math.floor(value % 60)).padStart(2,"0");
  return `${String(min).padStart(2,"0")}:${sec}`;
}

function bars(track, count=120) {
  if (track.wave) return track.wave.slice(0,count).map(h => `<i style="height:${h}%"></i>`).join("");
  let seed = track.id * 113;
  return Array.from({length:count},(_,i) => {
    seed = (seed * 9301 + 49297) % 233280;
    const h = Math.max(8,(seed/233280)*92*(.42+Math.abs(Math.sin(i/10))*.55));
    return `<i style="height:${h}%"></i>`;
  }).join("");
}

function renderTracks() {
  const list = tracks
    .filter(t => state.filter==="all" || (state.filter==="ready" ? t.ready : !t.ready))
    .filter(t => `${t.title} ${t.artist}`.toLowerCase().includes(state.query.toLowerCase()))
    .sort((a,b) => state.sortAsc ? a.bpm-b.bpm : b.bpm-a.bpm);
  $("#trackList").innerHTML = list.map(t => `
    <article class="track-card ${state.selected?.id===t.id?"selected":""}" style="--track-color:${t.color}" data-open="${t.id}">
      <div class="cover" style="--cover:${t.cover}">${t.title.slice(0,2).toUpperCase()}</div>
      <div class="track-main">
        <h3 class="track-title">${t.title}</h3><p class="track-artist">${t.artist}</p>
        <div class="track-meta"><span class="meta-pill">${t.bpm||"—"} BPM</span><span class="meta-pill key-pill">${t.key}</span>
          <span class="cue-dots" aria-label="${t.cues.filter(v=>v!=null).length} z 8 cue pointů">${t.cues.map(v=>`<i class="${v!=null?"on":""}"></i>`).join("")}</span>
        </div>
      </div>
      <div class="track-actions">
        <button data-action="play" data-id="${t.id}" aria-label="Přehrát"><svg viewBox="0 0 24 24"><path d="m8 5 11 7-11 7Z"/></svg></button>
        <button data-action="edit" data-id="${t.id}" aria-label="Upravit cue pointy"><svg viewBox="0 0 24 24"><path d="M4 16v4h4M20 8V4h-4M5 11a7 7 0 0 1 12-4l3 1M19 13a7 7 0 0 1-12 4l-3-1"/></svg></button>
        <button class="delete-track" data-action="delete" data-id="${t.id}" aria-label="Odebrat skladbu"><svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5"/></svg></button>
      </div>
    </article>`).join("");
  $("#emptyState").hidden = list.length > 0;
  const ready=tracks.filter(t=>t.ready).length;
  const bpms=tracks.filter(t=>Number.isFinite(t.bpm)).map(t=>t.bpm);
  $("#trackCount").textContent=tracks.length;
  $("#cueCount").textContent=tracks.reduce((sum,t)=>sum+t.cues.filter(v=>v!=null).length,0);
  $("#readyPercent").textContent=tracks.length?`${Math.round(ready/tracks.length*100)}%`:"0%";
  $("#averageBpm").textContent=bpms.length?Math.round(bpms.reduce((a,b)=>a+b,0)/bpms.length):"—";
  $("#allCount").textContent=tracks.length;
  $("#readyCount").textContent=ready;
  $("#todoCount").textContent=tracks.length-ready;
}

function removeTrack(track) {
  const index=tracks.findIndex(t=>t.id===track.id);
  if(index<0)return;
  if(track.url) URL.revokeObjectURL(track.url);
  tracks.splice(index,1);
  if(state.current?.id===track.id) {
    setPlaying(false); audio.removeAttribute("src"); audio.load();
    state.current=null; state.position=0;
    $("#nowPlayingTitle").textContent="Vyber skladbu";
    $("#nowPlayingArtist").textContent="Knihovna je připravená";
    $("#playerWaveform").innerHTML="";
    $("#cueShortcut").disabled=true;
  }
  if(state.selected?.id===track.id) closeEditor();
  renderTracks(); toast("Skladba byla odebrána");
}

function selectTrack(track, autoplay=false) {
  const changed = state.current?.id !== track.id;
  state.current = track;
  if (changed) {
    state.position = 0;
    audio.pause();
    audio.src = track.url || "";
  }
  $("#nowPlayingTitle").textContent = track.title;
  $("#nowPlayingArtist").textContent = `${track.artist} · ${track.bpm||"—"} BPM · ${track.key}`;
  $("#playerDuration").textContent = time(track.duration,false);
  $("#cueShortcut").disabled = false;
  $("#playerWaveform").innerHTML = bars(track,160);
  updatePosition();
  if (autoplay) setPlaying(true);
}

function setPlaying(value) {
  if (!state.current) return;
  state.playing = value;
  $("#player").classList.toggle("playing",value);
  $("#editorPlay").classList.toggle("playing",value);
  clearInterval(state.timer);
  if (state.current.url) {
    if (value) { audio.currentTime=state.position; audio.play().catch(()=>{}); } else audio.pause();
    return;
  }
  if (value) state.timer=setInterval(()=>{ state.position=(state.position+.1)%state.current.duration; updatePosition(); },100);
}

function updatePosition() {
  if (!state.current) return;
  const ratio = state.position/state.current.duration;
  $("#currentTime").textContent=time(state.position);
  $("#playerCurrent").textContent=time(state.position,false);
  $("#playerProgress").style.left=`${ratio*100}%`;
  $("#playhead").style.left=`${ratio*100}%`;
  document.querySelectorAll("#waveform > i,#playerWaveform > i").forEach((bar,i,all)=>bar.classList.toggle("past",i/all.length<ratio));
}

function renderCues() {
  const t=state.selected;
  $("#cueGrid").innerHTML=cueTypes.map((cue,i)=>`
    <article class="cue-slot" style="--cue-color:${cue[1]}">
      <button class="cue-set" data-cue="${i}">
        <span>${String(i+1).padStart(2,"0")} · ${cue[0]}</span><strong>${time(t.cues[i])}</strong>
        <small>${t.cues[i]==null?"Kliknutím přidat":"Kliknutím přehrát"}</small>
      </button>
      <button class="cue-delete" data-delete-cue="${i}" aria-label="Smazat cue point ${i+1}" ${t.cues[i]==null?"disabled":""}>
        <svg viewBox="0 0 24 24"><path d="M5 7h14M9 7V4h6v3M8 7l1 13h6l1-13M12 10v7"/></svg>
      </button>
    </article>`).join("");
  document.querySelectorAll(".cue-marker").forEach(m=>m.remove());
  t.cues.forEach((v,i)=>{
    if(v==null)return;
    const m=document.createElement("span"); m.className="cue-marker"; m.dataset.label=i+1;
    m.style.cssText=`--cue-color:${cueTypes[i][1]};left:${(v/t.duration)*100}%`;
    $("#waveformStage").appendChild(m);
  });
}

function buildAutomaticCues() {
  const track=state.selected;
  if(!track)return;
  const targets=[.035,.13,.25,.38,.51,.64,.82,.94];
  track.cues=targets.map(ratio=>{
    let selectedRatio=ratio;
    if(track.wave?.length) {
      const center=Math.round(ratio*(track.wave.length-1));
      const radius=Math.max(2,Math.round(track.wave.length*.035));
      let best=center;
      for(let i=Math.max(0,center-radius);i<=Math.min(track.wave.length-1,center+radius);i++) {
        if(track.wave[i]>track.wave[best]) best=i;
      }
      selectedRatio=best/(track.wave.length-1);
    }
    return Math.round(track.duration*selectedRatio*10)/10;
  });
  track.ready=true;
  renderCues();
  renderTracks();
  toast("Cue pointy byly automaticky sestaveny");
}

function openEditor(track) {
  selectTrack(track);
  state.selected=track;
  $("#sheetTitle").textContent=track.title;
  $("#sheetArtist").textContent=`${track.artist} · ${track.bpm||"—"} BPM · ${track.key}`;
  $("#durationTime").textContent=time(track.duration);
  $("#waveform").innerHTML=bars(track);
  setWaveZoom(1);
  $("#cueEditor").hidden=false;
  renderCues(); renderTracks(); updatePosition();
  $("#cueEditor").scrollIntoView({behavior:"smooth",block:"start"});
}

function closeEditor() { $("#cueEditor").hidden=true; state.selected=null; renderTracks(); }
function toast(text) { $("#toast").textContent=text;$("#toast").classList.add("show");setTimeout(()=>$("#toast").classList.remove("show"),2400); }
function openImport(){document.body.classList.add("import-open")}
function closeImport(){document.body.classList.remove("import-open")}
function openSettings(){document.body.classList.add("settings-open")}
function closeSettings(){document.body.classList.remove("settings-open")}

const themes = {
  cyan:{cyan:"#12e6f2",pink:"#ff3c8e",wave:"#12e6f2"},
  lime:{cyan:"#b6ff00",pink:"#ffe600",wave:"#b6ff00"},
  violet:{cyan:"#9d72ff",pink:"#ff62ca",wave:"#9d72ff"},
  orange:{cyan:"#ff713c",pink:"#ffc83d",wave:"#ff713c"}
};
function applyAppearance(settings) {
  const theme=themes[settings.theme]||themes.cyan;
  document.documentElement.style.setProperty("--cyan",theme.cyan);
  document.documentElement.style.setProperty("--pink",theme.pink);
  document.documentElement.style.setProperty("--wave",settings.wave||theme.wave);
  document.body.dataset.bg=settings.bg||"grid";
  if(settings.image) document.body.style.setProperty("--custom-bg",`url("${settings.image}")`);
  $("#waveColor").value=settings.wave||theme.wave;
  document.querySelectorAll(".theme-preset").forEach(b=>b.classList.toggle("active",b.dataset.theme===(settings.theme||"cyan")));
  document.querySelectorAll(".background-preset").forEach(b=>b.classList.toggle("active",b.dataset.bg===(settings.bg||"grid")));
}

function saveAppearance(patch) {
  const current=JSON.parse(localStorage.getItem("cueflowAppearance")||"{}");
  const next={...current,...patch};
  localStorage.setItem("cueflowAppearance",JSON.stringify(next));
  applyAppearance(next);
}

function setWaveZoom(value) {
  state.zoom=Math.max(1,Math.min(8,Number(value)));
  $("#waveZoom").value=state.zoom;
  $("#zoomValue").textContent=`${state.zoom}×`;
  $("#waveformStage").style.setProperty("--zoom",state.zoom);
}

async function analyzeFile(file) {
  const url=URL.createObjectURL(file);
  const duration=await new Promise(resolve=>{const a=new Audio(url);a.onloadedmetadata=()=>resolve(a.duration||180);a.onerror=()=>resolve(180)});
  let wave=null;
  try {
    const context=new AudioContext();
    const buffer=await context.decodeAudioData(await file.arrayBuffer());
    const data=buffer.getChannelData(0), count=160, size=Math.floor(data.length/count);
    wave=Array.from({length:count},(_,i)=>{
      let peak=0; for(let j=0;j<size;j+=Math.max(1,Math.floor(size/80))) peak=Math.max(peak,Math.abs(data[i*size+j]||0));
      return Math.max(8,Math.min(100,peak*115));
    });
    await context.close();
  } catch {}
  const title=file.name.replace(/\.[^.]+$/,"").replace(/[_-]+/g," ");
  const track={id:Date.now()+Math.random(),title,artist:"Import ze zařízení",bpm:null,key:"—",duration,ready:false,color:"#12e6f2",cover:"linear-gradient(135deg,#103e49,#156f76)",cues:Array(8).fill(null),wave,url};
  tracks.unshift(track);
  renderTracks();
}

$("#trackList").addEventListener("click",e=>{
  const button=e.target.closest("button[data-id]");
  const card=e.target.closest("[data-open]");
  const id=Number(button?.dataset.id||card?.dataset.open);
  const track=tracks.find(t=>t.id===id);
  if(!track)return;
  if(button?.dataset.action==="delete") removeTrack(track);
  else if(button?.dataset.action==="play") selectTrack(track,true);
  else openEditor(track);
});
$("#searchInput").addEventListener("input",e=>{state.query=e.target.value;renderTracks()});
$("#filters").addEventListener("click",e=>{const b=e.target.closest(".filter");if(!b)return;state.filter=b.dataset.filter;document.querySelectorAll(".filter").forEach(x=>x.classList.toggle("active",x===b));renderTracks()});
$("#sortButton").addEventListener("click",()=>{state.sortAsc=!state.sortAsc;renderTracks()});
$("#playerButton").addEventListener("click",()=>setPlaying(!state.playing));
$("#editorPlay").addEventListener("click",()=>setPlaying(!state.playing));
$("#cueShortcut").addEventListener("click",()=>openEditor(state.current));
$("#closeEditor").addEventListener("click",closeEditor);
$("#backButton").addEventListener("click",()=>{state.position=Math.max(0,state.position-10);if(state.current.url)audio.currentTime=state.position;updatePosition()});
$("#forwardButton").addEventListener("click",()=>{state.position=Math.min(state.current.duration,state.position+10);if(state.current.url)audio.currentTime=state.position;updatePosition()});
$(".editor-waveform").addEventListener("click",e=>{const r=$("#waveform").getBoundingClientRect();state.position=Math.max(0,Math.min(1,(e.clientX-r.left)/r.width))*state.current.duration;if(state.current.url)audio.currentTime=state.position;updatePosition()});
$("#playerWaveWrap").addEventListener("click",e=>{if(!state.current)return;const r=e.currentTarget.getBoundingClientRect();state.position=((e.clientX-r.left)/r.width)*state.current.duration;if(state.current.url)audio.currentTime=state.position;updatePosition()});
$("#cueGrid").addEventListener("click",e=>{
  const remove=e.target.closest("[data-delete-cue]");
  if(remove) {
    state.selected.cues[Number(remove.dataset.deleteCue)]=null;
    state.selected.ready=false;
    renderCues(); renderTracks(); toast("Cue point byl odstraněn");
    return;
  }
  const set=e.target.closest("[data-cue]");
  if(!set)return;
  const cueIndex=Number(set.dataset.cue);
  const cueTime=state.selected.cues[cueIndex];
  if(cueTime!=null) {
    state.position=cueTime;
    if(state.current.url) audio.currentTime=cueTime;
    updatePosition();
    setPlaying(true);
    return;
  }
  state.selected.cues[cueIndex]=Math.round(state.position*10)/10;
  state.selected.ready=state.selected.cues.every(v=>v!=null);
  renderCues();
});
$("#autoCues").addEventListener("click",buildAutomaticCues);
$("#saveCues").addEventListener("click",()=>{renderTracks();toast("8 cue pointů bylo uloženo")});
$("#addTrackButton").addEventListener("click",openImport);
$("#emptyImportButton").addEventListener("click",openImport);
$("#closeImport").addEventListener("click",closeImport);
$("#importBackdrop").addEventListener("click",closeImport);
$("#deviceImport").addEventListener("click",()=>$("#audioInput").click());
$("#audioInput").addEventListener("change",async e=>{
  const files=[...e.target.files];
  closeImport();
  for(const file of files) await analyzeFile(file);
  if(files.length) toast(files.length===1?"Skladba byla přidána do knihovny":`${files.length} skladeb bylo přidáno do knihovny`);
  e.target.value="";
});
document.querySelectorAll("[data-cloud]").forEach(b=>b.addEventListener("click",()=>{const name=b.dataset.cloud==="mega"?"MEGA":"Dropbox";toast(`${name}: pro ostré připojení vlož API klíč služby`)}));
document.querySelectorAll(".source-button[data-source]").forEach(b=>b.addEventListener("click",()=>{
  const source=b.dataset.source;
  if(source==="device") { openImport(); return; }
  const name=source==="mega"?"MEGA":source==="dropbox"?"Dropbox":"Google Drive";
  toast(`${name}: připojení vyžaduje API klíč služby`);
}));
$("#settingsButton").addEventListener("click",openSettings);
$("#closeSettings").addEventListener("click",closeSettings);
$("#settingsBackdrop").addEventListener("click",closeSettings);
document.querySelectorAll(".theme-preset").forEach(b=>b.addEventListener("click",()=>{
  const theme=b.dataset.theme;
  saveAppearance({theme});
}));
document.querySelectorAll(".background-preset").forEach(b=>b.addEventListener("click",()=>{
  if(b.dataset.bg==="image") { $("#backgroundInput").click(); return; }
  saveAppearance({bg:b.dataset.bg});
}));
$("#backgroundInput").addEventListener("change",e=>{
  const file=e.target.files[0]; if(!file)return;
  const reader=new FileReader();
  reader.onload=()=>{saveAppearance({bg:"image",image:reader.result});toast("Vlastní pozadí bylo nastaveno")};
  reader.readAsDataURL(file); e.target.value="";
});
$("#waveColor").addEventListener("input",e=>saveAppearance({wave:e.target.value}));
$("#resetSettings").addEventListener("click",()=>{localStorage.removeItem("cueflowAppearance");applyAppearance({theme:"cyan",bg:"grid",wave:"#12e6f2"});toast("Vzhled byl obnoven")});
$("#waveZoom").addEventListener("input",e=>setWaveZoom(e.target.value));
$("#zoomOut").addEventListener("click",()=>setWaveZoom(state.zoom-.5));
$("#zoomIn").addEventListener("click",()=>setWaveZoom(state.zoom+.5));
audio.addEventListener("timeupdate",()=>{state.position=audio.currentTime;updatePosition()});
audio.addEventListener("ended",()=>setPlaying(false));
document.addEventListener("keydown",e=>{if(e.key==="Escape"){closeImport();closeSettings();closeEditor()}if(e.code==="Space"&&!e.target.matches("input")){e.preventDefault();setPlaying(!state.playing)}});

applyAppearance(JSON.parse(localStorage.getItem("cueflowAppearance")||"{}"));
renderTracks();

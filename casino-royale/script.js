/* =====================================================
   CASINO ROYALE · Pick a Card
   1. Estado y referencias
   2. Audio (Web Audio API)
   3. Lista de cartas y render
   4. Sorteo y animaciones
   ===================================================== */

/* ---------- 1. Estado y referencias ---------- */

// Cada palo: [símbolo, ¿es rojo?]
const SUITS = [
  ["♠", false],
  ["♥", true],
  ["♦", true],
  ["♣", false],
];

const MIN_CARDS = 2;

let cards = [];          // { id, name, num, el }
let nextId = 0;
let isBusy = false;      // true mientras se reparte
let soundOn = true;
let audioCtx = null;
let ambient = null;      // música de fondo activa

const $ = (id) => document.getElementById(id);
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/* ---------- 2. Audio ---------- */

function getAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  return audioCtx;
}

// Reproduce una nota corta
function playTone(freq, duration = 0.12, type = "sine", volume = 0.15, delay = 0) {
  if (!soundOn) return;

  const audio = getAudio();
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  const start = audio.currentTime + delay;

  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(volume, start);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

  osc.connect(gain).connect(audio.destination);
  osc.start(start);
  osc.stop(start + duration);
}

const playClick = () => playTone(900, 0.05, "square", 0.06);
const playTick = (step) => playTone(500 + step * 18, 0.04, "triangle", 0.09);

function playFanfare() {
  [523, 659, 784, 1047].forEach((freq, i) => {
    playTone(freq, 0.28, "triangle", 0.2, i * 0.14);
  });
  [784, 1047, 1319].forEach((freq) => {
    playTone(freq, 0.9, "sawtooth", 0.07, 0.6);
  });
}

// Ráfaga de ruido filtrado: base del sonido de barajar y voltear
function playNoise(duration = 0.05, volume = 0.12, freq = 3000, delay = 0) {
  if (!soundOn) return;

  const audio = getAudio();
  const buffer = audio.createBuffer(1, Math.ceil(audio.sampleRate * duration), audio.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  }

  const source = audio.createBufferSource();
  const filter = audio.createBiquadFilter();
  const gain = audio.createGain();
  source.buffer = buffer;
  filter.type = "bandpass";
  filter.frequency.value = freq;
  gain.gain.value = volume;

  source.connect(filter).connect(gain).connect(audio.destination);
  source.start(audio.currentTime + delay);
}

// Barajar: muchos "frrt" cortos seguidos
function playShuffle() {
  for (let i = 0; i < 28; i++) {
    playNoise(0.04, 0.1 + Math.random() * 0.06, 2500 + Math.random() * 3000, i * 0.028);
  }
}

// Mostrar carta: "whoosh" + dos notas brillantes
function playReveal() {
  playNoise(0.25, 0.18, 1800);
  playTone(880, 0.4, "triangle", 0.15, 0.15);
  playTone(1319, 0.6, "triangle", 0.12, 0.3);
}

/* ---------- Música de fondo ---------- */
// Usa animal.mp3 (junto al index.html) o el archivo que cargue la persona.
// Si no hay canción, suena un acorde ambiental sintetizado.

const song = new Audio("animal.mp3");
song.loop = true;
song.volume = 0.5;
let songLoaded = false;
let musicWanted = false;

song.addEventListener("canplay", () => {
  songLoaded = true;
  if (musicWanted && soundOn) startMusic();
});

function startMusic() {
  musicWanted = true;
  if (!soundOn) return;

  if (songLoaded) {
    stopAmbient();
    song.play().catch(() => {});
  } else {
    startAmbient();
  }
}

function stopMusic() {
  song.pause();
  stopAmbient();
}

$("song").onclick = () => $("songFile").click();
$("songFile").onchange = (event) => {
  const file = event.target.files[0];
  if (!file) return;
  songLoaded = false;
  song.src = URL.createObjectURL(file);
  song.load();
  musicWanted = true;
  $("song").textContent = "🎵 " + file.name.slice(0, 22);
};

// Acorde suave de respaldo
function startAmbient() {
  if (ambient) return;

  const audio = getAudio();
  const gain = audio.createGain();
  gain.gain.value = 0.025;
  gain.connect(audio.destination);

  const oscillators = [110, 138.6, 164.8, 220].map((freq) => {
    const osc = audio.createOscillator();
    osc.type = "sine";
    osc.frequency.value = freq;
    osc.detune.value = Math.random() * 8 - 4;
    osc.connect(gain);
    osc.start();
    return osc;
  });

  ambient = { gain, oscillators };
}

function stopAmbient() {
  if (!ambient) return;

  ambient.oscillators.forEach((osc) => osc.stop());
  ambient.gain.disconnect();
  ambient = null;
}

$("snd").onclick = () => {
  soundOn = !soundOn;
  $("snd").textContent = soundOn ? "🔊 Sound: on" : "🔇 Sound: off";

  if (soundOn) startMusic();
  else stopMusic();

  playClick();
};

/* ---------- 3. Lista de cartas y render ---------- */

// El palo se asigna según el orden en que se agregó la carta
function getSuit(card) {
  return SUITS[card.id % SUITS.length];
}

// Crea el elemento de carta (dorso + frente)
function createCardElement(card) {
  const [symbol, isRed] = getSuit(card);
  const rank = card.name[0].toUpperCase();

  const el = document.createElement("div");
  el.className = "card";
  el.innerHTML = `
    <div class="face back"></div>
    <div class="face front ${isRed ? "red" : ""}">
      <span class="c">${rank}<br>${symbol}</span>
      <div>
        <div class="s">${symbol}</div>
        <div class="nm"></div>
        <div class="nu"></div>
      </div>
      <span class="c b">${rank}<br>${symbol}</span>
    </div>`;

  // textContent evita que el texto del usuario se interprete como HTML
  el.querySelector(".nm").textContent = card.name;
  el.querySelector(".nu").textContent = "#" + card.num;
  return el;
}

function renderList() {
  const list = $("list");
  list.innerHTML = "";

  if (cards.length === 0) {
    list.innerHTML = '<div class="empty">No cards yet. Add the first one.</div>';
    return;
  }

  cards.forEach((card) => {
    const [symbol, isRed] = getSuit(card);
    const item = document.createElement("li");

    item.innerHTML = `
      <span class="chip ${isRed ? "r" : ""}">${symbol}</span>
      <b></b>
      <span class="n"></span>
      <button class="x" aria-label="Remove">✕</button>`;

    item.querySelector("b").textContent = card.name;
    item.querySelector(".n").textContent = "#" + card.num;
    item.querySelector(".x").onclick = () => {
      if (isBusy) return;
      cards = cards.filter((c) => c !== card);
      playClick();
      render();
    };

    list.appendChild(item);
  });
}

// El mazo es una pila de dorsos (máximo 14 visibles)
const STACK_MAX = 14;

function stackTransform(index) {
  return `translate(${index * -1.2}px, ${index * -1.5}px)`;
}

function renderDeck() {
  const deck = $("deck");
  deck.innerHTML = "";

  for (let i = 0; i < Math.min(cards.length, STACK_MAX); i++) {
    const back = document.createElement("div");
    back.className = "card";
    back.innerHTML = '<div class="face back"></div>';
    back.style.transform = stackTransform(i);
    back.style.animationDelay = i * 0.03 + "s";
    deck.appendChild(back);
  }
}

function render() {
  const enoughCards = cards.length >= MIN_CARDS;

  $("cnt").textContent = cards.length;
  $("deal").disabled = isBusy || !enoughCards;
  $("clr").disabled = isBusy || cards.length === 0;
  $("hint").textContent = enoughCards
    ? "All set. Press “Deal / pick a card”."
    : "Add at least 2 cards to deal.";

  renderList();
  renderDeck();
}

$("f").onsubmit = (event) => {
  event.preventDefault();
  if (isBusy) return;

  const name = $("nm").value.trim();
  const num = $("nu").value;
  if (!name || num === "") return;

  cards.push({ id: nextId++, name, num });
  $("nm").value = "";
  $("nu").value = "";
  $("nm").focus();

  getAudio();
  startMusic();
  playTone(660, 0.1, "triangle", 0.15);
  render();
};

$("clr").onclick = () => {
  if (isBusy) return;
  cards = [];
  playClick();
  render();
};

/* ---------- 4. Barajado, sorteo y revelado ---------- */

let flyingCard = null;   // carta ganadora que sale del mazo

$("deal").onclick = async () => {
  if (isBusy || cards.length < MIN_CARDS) return;

  isBusy = true;
  getAudio();
  $("deal").disabled = true;
  $("clr").disabled = true;

  // El ganador se decide al azar antes de barajar
  const winner = cards[Math.floor(Math.random() * cards.length)];

  $("hint").textContent = "Shuffling the deck…";
  for (let round = 0; round < 3; round++) {
    await shuffleRound();
  }

  $("hint").textContent = "Drawing a card…";
  await wait(300);
  await drawCard(winner);

  $("hint").textContent = "";
  playFanfare();
  launchConfetti();
  await wait(900);   // deja ver la carta antes del modal

  $("wn").textContent = winner.name;
  $("wu").textContent = "Number " + winner.num;
  $("modal").classList.add("on");
  $("again").focus();
};

// Una pasada de barajado: el mazo se parte en dos y se entrelaza
async function shuffleRound() {
  const deck = $("deck");
  const stack = [...deck.children];

  playShuffle();
  stack.forEach((el, i) => {
    const side = i % 2 ? 1 : -1;
    el.animate([
      { transform: el.style.transform },
      { transform: `translate(${side * 90}px, ${i * -1.5}px) rotate(${side * 8}deg)`, offset: 0.45 },
      { transform: el.style.transform },
    ], { duration: 700, delay: i * 25, easing: "ease-in-out" });
  });
  await wait(700 + stack.length * 25 + 80);

  // Reordena las cartas al azar para que el mazo quede mezclado
  stack.sort(() => Math.random() - 0.5).forEach((el, i) => {
    el.style.transform = stackTransform(i);
    deck.appendChild(el);
  });
}

// Saca la carta de arriba, la lleva al centro boca abajo y la voltea
async function drawCard(winner) {
  const stack = $("deck").children;
  const top = stack[stack.length - 1];
  const rect = top.getBoundingClientRect();

  flyingCard = createCardElement(winner);
  flyingCard.classList.add("flyer");
  Object.assign(flyingCard.style, {
    left: rect.left + "px",
    top: rect.top + "px",
    width: rect.width + "px",
    height: rect.height + "px",
    animation: "none",
  });
  document.body.appendChild(flyingCard);
  top.style.visibility = "hidden";

  flyingCard.offsetWidth; // fuerza el reflow para que la transición arranque

  // La carta ganadora crece hasta ocupar ~58% del alto de la pantalla
  const scale = Math.min((innerHeight * 0.58) / rect.height, (innerWidth * 0.8) / rect.width, 4.2);
  const dx = innerWidth / 2 - (rect.left + rect.width / 2);
  const dy = innerHeight * 0.38 - (rect.top + rect.height / 2);
  const move = `perspective(900px) translate(${dx}px, ${dy}px) scale(${scale})`;

  // 1) sale del mazo boca abajo
  playNoise(0.2, 0.15, 1500);
  flyingCard.style.transform = move;
  await wait(1200);

  // 2) se voltea y se ve quién salió
  playReveal();
  flyingCard.style.transform = move + " rotateY(180deg)";
  await wait(1100);
}

function launchConfetti() {
  const colors = ["#e8b84b", "#b8283f", "#0f6b4d", "#f6ecd2"];

  for (let i = 0; i < 60; i++) {
    const piece = document.createElement("i");
    piece.className = "conf";
    piece.style.left = Math.random() * 100 + "vw";
    piece.style.background = colors[i % colors.length];
    piece.style.animationDuration = 2 + Math.random() * 2 + "s";
    piece.style.animationDelay = Math.random() * 0.6 + "s";
    document.body.appendChild(piece);
    setTimeout(() => piece.remove(), 5000);
  }
}

// "Play again": cierra el modal y vuelve a armar el mazo boca abajo
$("again").onclick = () => {
  playClick();
  $("modal").classList.remove("on");

  if (flyingCard) {
    const leaving = flyingCard;
    leaving.style.transition = "opacity .5s";
    leaving.style.opacity = "0";
    setTimeout(() => leaving.remove(), 550);
    flyingCard = null;
  }

  renderDeck();
  isBusy = false;
  $("hint").textContent = "All set. Press “Deal / pick a card”.";
  $("deal").disabled = cards.length < MIN_CARDS;
  $("clr").disabled = cards.length === 0;
};

render();

const canvas = document.querySelector('#gameCanvas');
const ctx = canvas.getContext('2d');
const message = document.querySelector('#message');
const messageTitle = document.querySelector('#messageTitle');
const messageText = document.querySelector('#messageText');
const restartButton = document.querySelector('#restartButton');
const progress = document.querySelector('#progress');
const hint = document.querySelector('#hint');

const W = canvas.width;
const H = canvas.height;
const worldWidth = 7800;
const gravity = 0.65;
const swordRange = 86;
const swordReflectRange = 120;
const slowDuration = 120;
const slowCooldownDuration = 240;
const slowRate = 0.1;
const keys = new Set();
const justPressed = new Set();
let audio;
let game;

const platforms = [
  { x: 0, y: 445, w: 700, h: 95 }, { x: 820, y: 400, w: 500, h: 140 },
  { x: 1440, y: 450, w: 620, h: 90 }, { x: 2180, y: 370, w: 370, h: 170 },
  { x: 2670, y: 440, w: 720, h: 100 }, { x: 3550, y: 390, w: 440, h: 150 },
  { x: 4160, y: 445, w: 1040, h: 95 },
  { x: 460, y: 355, w: 145, h: 18 }, { x: 950, y: 290, w: 150, h: 18 },
  { x: 1660, y: 330, w: 150, h: 18 }, { x: 2300, y: 260, w: 145, h: 18 },
  { x: 3000, y: 330, w: 170, h: 18 }, { x: 3720, y: 275, w: 140, h: 18 },
  { x: 5280, y: 400, w: 300, h: 140 }, { x: 5670, y: 450, w: 430, h: 90 },
  { x: 6200, y: 365, w: 280, h: 175 }, { x: 6580, y: 425, w: 180, h: 115 },
  { x: 6910, y: 445, w: 520, h: 95 }, { x: 7540, y: 390, w: 300, h: 150 },
  { x: 5420, y: 315, w: 130, h: 18 }, { x: 6320, y: 260, w: 145, h: 18 },
  { x: 7040, y: 335, w: 150, h: 18 }, { x: 7680, y: 275, w: 140, h: 18 },
];
const coinSpots = [
  [530, 310], [1015, 245], [1700, 285], [2350, 215], [2800, 400],
  [3050, 285], [3780, 230], [4350, 400], [4630, 400], [4900, 400],
];
const healthSpots = [
  [1260, 345], [2360, 315], [3440, 405], [5050, 405], [6460, 325], [7420, 345],
];
const enemySpots = [
  [260, 400, 'standard'], [620, 400, 'berserk'], [940, 355, 'standard'],
  [1160, 355, 'berserk'], [1550, 405, 'standard'], [1810, 395, 'standard'],
  [1980, 405, 'berserk'], [2240, 325, 'standard'], [2440, 315, 'berserk'],
  [2780, 400, 'standard'], [3190, 395, 'berserk'], [3370, 400, 'standard'],
  [3630, 345, 'standard'], [3820, 335, 'berserk'], [4300, 400, 'standard'],
  [4510, 400, 'berserk'], [4780, 400, 'standard'], [5010, 400, 'berserk'],
  [5360, 355, 'standard'], [5500, 355, 'berserk'], [5800, 405, 'standard'],
  [6300, 310, 'berserk'], [6460, 310, 'standard'], [6650, 385, 'berserk'],
  [7050, 400, 'standard'], [7300, 400, 'berserk'], [7650, 345, 'standard'],
];
function reset() {
  game = {
    player: { x: 100, y: 350, w: 28, h: 42, vx: 0, vy: 0, grounded: false, jumps: 0, airBoosted: false, airDashTimer: 0, facing: 1, attacking: 0, invincible: 0 },
    coins: coinSpots.map(([x, y]) => ({ x, y, taken: false, bob: Math.random() * 6 })),
    healthItems: healthSpots.map(([x, y]) => ({ x, y, taken: false, bob: Math.random() * 6 })),
    enemies: enemySpots.map(([x, y, type]) => {
      const w = 30;
      const h = 38;
      const ground = platforms
        .filter((platform) => x + w / 2 >= platform.x && x + w / 2 <= platform.x + platform.w &&
          platform.y >= y + h)
        .sort((a, b) => a.y - b.y)[0];
      return {
        x: Math.max(ground.x, Math.min(x, ground.x + ground.w - w)),
        y: ground.y - h,
        w, h, type, vx: type === 'berserk' ? 1.55 : 1, alive: true,
        shootTimer: 45 + Math.random() * 60,
        groundY: ground.y,
        patrolLeft: ground.x,
        patrolRight: ground.x + ground.w - w,
      };
    }),
    particles: [], bullets: [],
    camera: 0, bgCamera: 0, score: 0, hp: 100, slowTimer: 0, slowCooldown: 100, slowTrail: [], state: 'playing', time: 0,
  };
  message.classList.add('hidden');
  hint.textContent = 'ネオンシティを駆け抜けよう';
}

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function defeatEnemy(enemy) {
  if (!enemy.alive) return;
  enemy.alive = false;
  for (let i = 0; i < 14; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 1.5 + Math.random() * 4;
    game.particles.push({
      x: enemy.x + enemy.w / 2,
      y: enemy.y + enemy.h / 2,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 1.5,
      size: 2 + Math.random() * 4,
      life: 24 + Math.random() * 18,
      color: i % 3 === 0 ? '#ffe600' : i % 2 ? '#00f5ff' : '#ff3cac',
    });
  }
}

function startAudio() {
  if (audio) {
    if (audio.context.state === 'suspended') audio.context.resume();
    return;
  }
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;
  const context = new AudioContextClass();
  const master = context.createGain();
  master.gain.value = 0.825;
  master.connect(context.destination);
  context.resume();

  const popNotes = [
    261.63, 329.63, 392, 523.25, 493.88, 392, 329.63, 392,
    440, 523.25, 587.33, 659.25, 587.33, 523.25, 440, 392,
  ];
  const counterNotes = [0, 0, 329.63, 0, 392, 0, 329.63, 0, 0, 0, 440, 0, 493.88, 0, 440, 0];
  const popChords = [
    [261.63, 329.63, 392],
    [220, 261.63, 329.63],
    [174.61, 220, 261.63],
    [196, 246.94, 293.66],
  ];
  let beat = 0;
  const playPopBeat = () => {
    const now = context.currentTime;
    const note = context.createOscillator();
    const noteGain = context.createGain();
    note.type = 'square'; note.frequency.value = popNotes[beat % popNotes.length];
    noteGain.gain.setValueAtTime(0.0001, now);
    noteGain.gain.exponentialRampToValueAtTime(0.12, now + 0.02);
    noteGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);
    note.connect(noteGain).connect(master); note.start(now); note.stop(now + 0.28);
    if (counterNotes[beat % counterNotes.length]) {
      const counter = context.createOscillator();
      const counterGain = context.createGain();
      counter.type = 'triangle';
      counter.frequency.value = counterNotes[beat % counterNotes.length];
      counterGain.gain.setValueAtTime(0.0001, now);
      counterGain.gain.exponentialRampToValueAtTime(0.06, now + 0.04);
      counterGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
      counter.connect(counterGain).connect(master);
      counter.start(now); counter.stop(now + 0.24);
    }
    if (beat % 8 === 0) {
      const chord = popChords[(beat / 8) % popChords.length];
      chord.forEach((frequency, index) => {
        const pad = context.createOscillator();
        const padGain = context.createGain();
        pad.type = 'triangle'; pad.frequency.value = frequency;
        padGain.gain.setValueAtTime(0.0001, now);
        padGain.gain.exponentialRampToValueAtTime(0.055, now + 0.06);
        padGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.8);
        pad.connect(padGain).connect(master);
        pad.start(now + index * 0.03); pad.stop(now + 1.9);
      });
    }
    if (beat % 2 === 0) {
      const bass = context.createOscillator();
      const bassGain = context.createGain();
      bass.type = 'sine'; bass.frequency.value = popChords[(beat / 8) % popChords.length][0] / 2;
      bassGain.gain.setValueAtTime(0.0001, now);
      bassGain.gain.exponentialRampToValueAtTime(0.13, now + 0.02);
      bassGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
      bass.connect(bassGain).connect(master); bass.start(now); bass.stop(now + 0.34);
    }
    beat++;
  };
  playPopBeat();
  const popTimer = window.setInterval(playPopBeat, 350);
  audio = { context, popTimer };
}

function endGame(won) {
  game.state = won ? 'won' : 'lost';
  messageTitle.textContent = won ? 'STAGE CLEAR!' : 'GAME OVER';
  messageText.textContent = won ? `データチップ ${game.score} 個を回収した！` : 'システムが停止した。再起動してもう一度。';
  message.classList.remove('hidden');
}

function update() {
  if (game.state !== 'playing') return;
  const p = game.player;
  game.time++;
  const left = keys.has('a');
  const right = keys.has('d');
  p.vx = (right ? 3.8 : 0) - (left ? 3.8 : 0);
  if (p.vx) p.facing = Math.sign(p.vx);
  if (justPressed.has('w')) {
    if (p.grounded || p.jumps < 2) {
      p.vy = p.jumps === 0 ? -12 : -15; p.grounded = false; p.jumps++;
    }
  }
  if (justPressed.has(' ') && !p.grounded && !p.airBoosted) {
    p.airDashTimer = 18;
    p.airBoosted = true;
  }
  if (p.airDashTimer > 0) {
    p.vx = p.facing * 9.75;
    p.airDashTimer--;
  }
  const nearbyEnemy = game.enemies.some((enemy) =>
    enemy.alive &&
    Math.abs(enemy.x + enemy.w / 2 - (p.x + p.w / 2)) < swordRange &&
    Math.abs(enemy.y + enemy.h / 2 - (p.y + p.h / 2)) < 58
  );
  if ((justPressed.has('j') || justPressed.has('Enter')) && p.attacking <= 0 && nearbyEnemy) p.attacking = 18;
  if (game.slowCooldown < 100) {
    game.slowCooldown = Math.min(100, game.slowCooldown + 100 / slowCooldownDuration);
  }
  if (justPressed.has('p') && game.slowCooldown >= 100) {
    game.slowTimer = slowDuration;
    game.slowCooldown = 0;
  }
  if (game.slowTimer > 0) game.slowTimer--;
  if (game.slowTimer > 0) {
    game.slowTrail.unshift({ x: p.x, y: p.y, facing: p.facing });
    game.slowTrail.length = Math.min(game.slowTrail.length, 9);
  } else {
    game.slowTrail.length = 0;
  }
  for (const particle of game.particles) {
    particle.x += particle.vx;
    particle.y += particle.vy;
    particle.vy += 0.16;
    particle.vx *= 0.97;
    particle.life--;
  }
  game.particles = game.particles.filter((particle) => particle.life > 0);
  if (p.attacking > 0) p.attacking--;
  if (p.invincible > 0) p.invincible--;
  p.vy += gravity;
  p.x = Math.max(0, Math.min(worldWidth - p.w, p.x + p.vx));
  p.y += p.vy;
  p.grounded = false;
  for (const platform of platforms) {
    if (p.x + p.w > platform.x && p.x < platform.x + platform.w &&
        p.y + p.h > platform.y && p.y + p.h - p.vy <= platform.y) {
      p.y = platform.y - p.h; p.vy = 0; p.grounded = true; p.jumps = 0; p.airBoosted = false; p.airDashTimer = 0;
    }
  }
  if (p.y > H + 100) endGame(false);

  for (const coin of game.coins) {
    const box = { x: coin.x - 9, y: coin.y - 9 + Math.sin((game.time + coin.bob) / 12) * 3, w: 18, h: 18 };
    if (!coin.taken && rectsOverlap(p, box)) { coin.taken = true; game.score++; }
  }
  for (const item of game.healthItems) {
    const box = { x: item.x - 10, y: item.y - 10, w: 20, h: 20 };
    if (!item.taken && game.hp < 100 && rectsOverlap(p, box)) {
      item.taken = true;
      game.hp = Math.min(100, game.hp + 15);
    }
  }
  for (const enemy of game.enemies) {
    if (!enemy.alive) continue;
    const speedScale = game.slowTimer > 0 ? slowRate : 1;
    const nextX = enemy.x + enemy.vx * speedScale;
    if (nextX <= enemy.patrolLeft || nextX >= enemy.patrolRight) {
      enemy.vx *= -1;
      enemy.x = Math.max(enemy.patrolLeft, Math.min(enemy.patrolRight, nextX));
    } else {
      enemy.x = nextX;
    }
    enemy.y = enemy.groundY - enemy.h;
    if (enemy.type === 'berserk') {
      const timeScale = game.slowTimer > 0 ? slowRate : 1;
      enemy.shootTimer -= timeScale;
      if (enemy.shootTimer <= 0 && Math.abs(enemy.x - p.x) < 560) {
        const originX = enemy.x + enemy.w / 2;
        const originY = enemy.y + 16;
        const direction = Math.sign((p.x + p.w / 2) - originX) || 1;
        game.bullets.push({
          x: originX, y: originY, vx: direction * 3, vy: 0,
          size: 4, life: 110, reflected: false,
        });
        enemy.shootTimer = 100;
      }
    }
    const attackBox = { x: p.facing > 0 ? p.x + p.w : p.x - swordRange, y: p.y - 4, w: swordRange, h: p.h + 8 };
    if (p.attacking > 4 && p.attacking < 14 && rectsOverlap(attackBox, enemy)) defeatEnemy(enemy);
    else if (rectsOverlap(p, enemy) && p.invincible <= 0) {
      if (p.vy > 1 && p.y + p.h - enemy.y < 18) { defeatEnemy(enemy); p.vy = -8; }
      else {
        game.hp = Math.max(0, game.hp - 25);
        p.invincible = 90;
        p.vx = -p.facing * 6;
        if (game.hp === 0) endGame(false);
      }
    }
  }
  const projectileSpeedScale = game.slowTimer > 0 ? slowRate : 1;
  const swordBox = {
    x: p.facing > 0 ? p.x + p.w - 8 : p.x - swordReflectRange + 8,
    y: p.y - 20,
    w: swordReflectRange,
    h: p.h + 40,
  };
  for (const bullet of game.bullets) {
    bullet.x += bullet.vx * projectileSpeedScale;
    bullet.y += bullet.vy * projectileSpeedScale;
    bullet.life--;
    if (!bullet.reflected && p.attacking > 4 && p.attacking < 14 &&
        rectsOverlap(swordBox, { x: bullet.x - bullet.size, y: bullet.y - bullet.size, w: bullet.size * 2, h: bullet.size * 2 })) {
      bullet.vx *= -1;
      bullet.vy *= -1;
      bullet.reflected = true;
      bullet.life = 110;
    }
    if (bullet.reflected) {
      for (const enemy of game.enemies) {
        if (enemy.alive && rectsOverlap({ x: bullet.x - bullet.size, y: bullet.y - bullet.size, w: bullet.size * 2, h: bullet.size * 2 }, enemy)) {
          defeatEnemy(enemy);
          bullet.life = 0;
          break;
        }
      }
    }
    if (bullet.life > 0 && p.invincible <= 0 &&
        rectsOverlap(p, { x: bullet.x - bullet.size, y: bullet.y - bullet.size, w: bullet.size * 2, h: bullet.size * 2 })) {
      game.hp = Math.max(0, game.hp - 25);
      p.invincible = 90;
      bullet.life = 0;
      if (game.hp === 0) endGame(false);
    }
  }
  game.bullets = game.bullets.filter((bullet) =>
    bullet.life > 0 && bullet.x > game.camera - 100 && bullet.x < game.camera + W + 100
  );
  if (p.x > 7600) endGame(true);
  game.camera += ((p.x - W * 0.35) - game.camera) * 0.1;
  game.camera = Math.max(0, Math.min(worldWidth - W, game.camera));
  const backgroundFollowRate = game.slowTimer > 0 ? 0.01 : 0.1;
  game.bgCamera += (game.camera - game.bgCamera) * backgroundFollowRate;
  progress.textContent = `DISTANCE ${Math.min(100, Math.floor(p.x / 78))}%`;
  hint.textContent = game.slowTimer > 0 ? `TIME DILATION // ${Math.ceil(game.slowTimer / 60)}s` : 'P：敵と背景を2秒間スローダウン';
}

function drawBackground() {
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#030817'); sky.addColorStop(1, '#102b42');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
  const bgCamera = game.bgCamera;
  ctx.fillStyle = '#b9f7ff'; ctx.shadowBlur = 20; ctx.shadowColor = '#00f5ff';
  ctx.beginPath(); ctx.arc(790 - bgCamera * 0.08, 92, 34, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
  ctx.fillStyle = '#0b1b2d';
  for (let i = -1; i < 16; i++) {
    const x = i * 92 - (bgCamera * 0.16) % 92;
    const height = 130 + (i % 4) * 34;
    ctx.fillRect(x, 440 - height, 68, height);
    ctx.fillStyle = i % 3 ? '#00f5ff' : '#ff3cac';
    for (let y = 450 - height; y < 425; y += 24) ctx.fillRect(x + 10, y, 9, 4);
    ctx.fillStyle = '#0b1b2d';
  }
  ctx.fillStyle = '#142d3b';
  for (let i = -1; i < 22; i++) {
    const x = i * 74 - (bgCamera * 0.34) % 74;
    ctx.fillRect(x + 29, 300, 10, 145);
    ctx.fillStyle = i % 2 ? '#ff3cac' : '#00f5ff';
    ctx.fillRect(x + 43, 325, 3, 38);
    ctx.fillStyle = '#142d3b';
  }
  ctx.strokeStyle = 'rgb(105 217 255 / 22%)'; ctx.lineWidth = 1;
  for (let i = 0; i < 70; i++) {
    const x = (i * 83 - bgCamera * 0.6) % W;
    const y = (i * 47 + game.time * 5) % 430;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 4, y + 18); ctx.stroke();
  }
}

function draw() {
  drawBackground();
  if (game.slowTimer > 0) {
    const filterAlpha = 0.34 * (game.slowTimer / slowDuration);
    ctx.fillStyle = `rgb(115 255 175 / ${filterAlpha})`;
    ctx.fillRect(0, 0, W, H);
  }
  ctx.save(); ctx.translate(-game.camera, 0);
  for (const platform of platforms) {
    ctx.fillStyle = '#152b3a'; ctx.fillRect(platform.x, platform.y, platform.w, platform.h);
    ctx.fillStyle = '#00f5ff'; ctx.shadowBlur = 12; ctx.shadowColor = '#00f5ff'; ctx.fillRect(platform.x, platform.y, platform.w, 4); ctx.shadowBlur = 0;
    ctx.fillStyle = '#0c1d2b'; for (let x = platform.x + 8; x < platform.x + platform.w; x += 28) ctx.fillRect(x, platform.y + 18, 2, platform.h - 18);
  }
  for (const coin of game.coins) if (!coin.taken) {
    const y = coin.y + Math.sin((game.time + coin.bob) / 12) * 3;
    ctx.fillStyle = '#ffe600'; ctx.shadowBlur = 14; ctx.shadowColor = '#ffe600'; ctx.fillRect(coin.x - 7, y - 7, 14, 14); ctx.shadowBlur = 0;
    ctx.fillStyle = '#fff8a8'; ctx.fillRect(coin.x - 2, y - 5, 3, 8);
  }
  for (const item of game.healthItems) if (!item.taken) {
    const y = item.y + Math.sin((game.time + item.bob) / 12) * 3;
    ctx.save();
    ctx.translate(item.x, y);
    ctx.fillStyle = '#1b4050';
    ctx.shadowBlur = 14;
    ctx.shadowColor = '#68ffb0';
    ctx.fillRect(-10, -10, 20, 20);
    ctx.fillStyle = '#68ffb0';
    ctx.fillRect(-3, -8, 6, 16);
    ctx.fillRect(-8, -3, 16, 6);
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#d5ffe8';
    ctx.strokeRect(-10, -10, 20, 20);
    ctx.restore();
  }
  for (const e of game.enemies) if (e.alive) {
    // Damaged android: exposed chassis, one flickering eye, and a hanging cable.
    const isBerserk = e.type === 'berserk';
    ctx.fillStyle = isBerserk ? '#b52b68' : '#536b7a'; ctx.shadowBlur = isBerserk ? 16 : 10; ctx.shadowColor = isBerserk ? '#ff174f' : '#ff3cac';
    ctx.fillRect(e.x + 3, e.y + 10, 24, 28); ctx.shadowBlur = 0;
    ctx.fillStyle = '#8499a5'; ctx.fillRect(e.x + 6, e.y + 2, 18, 15);
    ctx.fillStyle = '#1a2833'; ctx.fillRect(e.x + 9, e.y + 6, 12, 6);
    ctx.fillStyle = isBerserk ? '#ff174f' : '#ff3cac'; ctx.shadowBlur = 8; ctx.shadowColor = ctx.fillStyle; ctx.fillRect(e.x + 17, e.y + 7, 4, 3); ctx.shadowBlur = 0;
    ctx.fillStyle = '#273945'; ctx.fillRect(e.x + 8, e.y + 20, 14, 5);
    ctx.fillStyle = isBerserk ? '#ff174f' : '#00f5ff'; ctx.fillRect(e.x + 11, e.y + 21, 4, 2);
    ctx.fillStyle = isBerserk ? '#ffe600' : '#ff3cac'; ctx.fillRect(e.x + 4, e.y + 28, 6, 3);
    if (isBerserk) {
      ctx.strokeStyle = '#ff174f'; ctx.lineWidth = 2; ctx.beginPath();
      ctx.moveTo(e.x + 7, e.y + 4); ctx.lineTo(e.x + 2, e.y - 3);
      ctx.moveTo(e.x + 23, e.y + 4); ctx.lineTo(e.x + 28, e.y - 3); ctx.stroke();
    }
    ctx.strokeStyle = '#d3e0e5'; ctx.lineWidth = 2; ctx.beginPath();
    ctx.moveTo(e.x + 8, e.y + 38); ctx.lineTo(e.x + 4, e.y + 45); ctx.lineTo(e.x + 10, e.y + 43); ctx.stroke();
    ctx.fillStyle = '#263b48'; ctx.fillRect(e.x + 5, e.y + 38, 7, 5); ctx.fillRect(e.x + 19, e.y + 38, 7, 5);
  }
  for (const bullet of game.bullets) {
    const angle = Math.atan2(bullet.vy, bullet.vx);
    ctx.save();
    ctx.translate(bullet.x, bullet.y);
    ctx.rotate(angle);
    ctx.fillStyle = bullet.reflected ? '#ffe600' : '#ff174f';
    ctx.shadowBlur = 14;
    ctx.shadowColor = bullet.reflected ? '#ffe600' : '#ff174f';
    ctx.fillRect(-12, -2, 24, 4);
    ctx.fillStyle = '#ffd6de';
    ctx.fillRect(bullet.vx >= 0 ? 5 : -9, -1, 4, 2);
    ctx.shadowBlur = 0;
    ctx.restore();
  }
  for (const particle of game.particles) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, particle.life / 42);
    ctx.fillStyle = particle.color;
    ctx.shadowBlur = 12;
    ctx.shadowColor = particle.color;
    ctx.fillRect(particle.x - particle.size / 2, particle.y - particle.size / 2, particle.size, particle.size);
    ctx.restore();
  }
  const p = game.player;
  const targetInRange = game.enemies.some((enemy) =>
    enemy.alive &&
    Math.abs(enemy.x + enemy.w / 2 - (p.x + p.w / 2)) < swordRange &&
    Math.abs(enemy.y + enemy.h / 2 - (p.y + p.h / 2)) < 58
  );
  const reflectionRangeX = p.facing > 0 ? p.x + p.w - 8 : p.x - swordReflectRange + 8;
  const reflectionRangeY = p.y - 20;
  ctx.save();
  ctx.globalAlpha = 0.1;
  ctx.fillStyle = '#ff3cac';
  ctx.shadowBlur = 10;
  ctx.shadowColor = '#ff3cac';
  ctx.fillRect(reflectionRangeX, reflectionRangeY, swordReflectRange, p.h + 40);
  ctx.globalAlpha = 0.38;
  ctx.strokeStyle = '#ff3cac';
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 5]);
  ctx.strokeRect(reflectionRangeX, reflectionRangeY, swordReflectRange, p.h + 40);
  ctx.restore();
  ctx.save();
  ctx.globalAlpha = targetInRange ? 0.28 : 0.1;
  ctx.fillStyle = targetInRange ? '#ffe600' : '#00f5ff';
  ctx.shadowBlur = 10;
  ctx.shadowColor = ctx.fillStyle;
  ctx.fillRect(p.facing > 0 ? p.x + p.w : p.x - swordRange, p.y + 4, swordRange, p.h - 8);
  ctx.globalAlpha = targetInRange ? 0.8 : 0.32;
  ctx.strokeStyle = ctx.fillStyle;
  ctx.lineWidth = 2;
  ctx.strokeRect(p.facing > 0 ? p.x + p.w : p.x - swordRange, p.y + 4, swordRange, p.h - 8);
  ctx.restore();
  if (game.slowTrail.length > 0) {
    for (let i = game.slowTrail.length - 1; i >= 0; i--) {
      const trail = game.slowTrail[i];
      const alpha = 0.06 + (game.slowTrail.length - i) * 0.025;
      ctx.save();
      ctx.globalAlpha = Math.min(alpha, 0.28);
      ctx.fillStyle = '#68ffb0';
      ctx.shadowBlur = 12;
      ctx.shadowColor = '#68ffb0';
      ctx.fillRect(trail.x + 3, trail.y + 16, 22, 24);
      ctx.fillStyle = '#d5ffe8';
      ctx.fillRect(trail.x + 8, trail.y + 5, 13, 13);
      ctx.fillStyle = '#b7ffd7';
      ctx.fillRect(trail.x + (trail.facing > 0 ? 20 : -7), trail.y + 20, 14, 4);
      ctx.shadowBlur = 0;
      ctx.restore();
    }
  }
  if (p.invincible % 8 < 4) {
    // Stylish cyber-runner: sharp silhouette, long coat, and a neon katana.
    ctx.fillStyle = '#111b2a'; ctx.beginPath();
    ctx.moveTo(p.x + 4, p.y + 8); ctx.lineTo(p.x + 10, p.y - 2); ctx.lineTo(p.x + 23, p.y + 2);
    ctx.lineTo(p.x + 25, p.y + 12); ctx.lineTo(p.x + 4, p.y + 12); ctx.fill();
    ctx.fillStyle = '#e7b09d'; ctx.fillRect(p.x + 8, p.y + 5, 13, 13);
    ctx.fillStyle = '#06111d'; ctx.fillRect(p.x + (p.facing > 0 ? 16 : 7), p.y + 9, 4, 3);
    ctx.fillStyle = '#00d9e8'; ctx.shadowBlur = 14; ctx.shadowColor = '#00f5ff';
    ctx.beginPath(); ctx.moveTo(p.x + 4, p.y + 16); ctx.lineTo(p.x + 24, p.y + 18); ctx.lineTo(p.x + 27, p.y + 40);
    ctx.lineTo(p.x + 16, p.y + 34); ctx.lineTo(p.x + 3, p.y + 41); ctx.closePath(); ctx.fill(); ctx.shadowBlur = 0;
    ctx.fillStyle = '#17293a'; ctx.fillRect(p.x + 8, p.y + 20, 13, 12);
    ctx.fillStyle = '#ff3cac'; ctx.shadowBlur = 8; ctx.shadowColor = '#ff3cac'; ctx.fillRect(p.x + 5, p.y + 17, 3, 22); ctx.shadowBlur = 0;
    ctx.fillStyle = '#17202d'; ctx.fillRect(p.x + 5, p.y + 38, 8, 5); ctx.fillRect(p.x + 18, p.y + 37, 8, 5);
    const swordX = p.facing > 0 ? p.x + 18 : p.x + 10;
    ctx.save(); ctx.translate(swordX, p.y + 23); ctx.scale(p.facing, 1); ctx.rotate(-0.22);
    ctx.fillStyle = '#ff3cac'; ctx.fillRect(0, 5, 10, 3);
    ctx.fillStyle = '#17202d'; ctx.fillRect(7, 3, 4, 7);
    ctx.fillStyle = '#e9fbff'; ctx.shadowBlur = 12; ctx.shadowColor = '#00f5ff';
    ctx.beginPath(); ctx.moveTo(10, 4); ctx.lineTo(47, 0); ctx.lineTo(55, 2); ctx.lineTo(12, 8); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#00f5ff'; ctx.fillRect(19, 3, 30, 2); ctx.shadowBlur = 0; ctx.restore();
    if (p.attacking > 0) {
      const swingProgress = (18 - p.attacking) / 14;
      ctx.strokeStyle = '#ffe600'; ctx.lineWidth = 4; ctx.shadowBlur = 16; ctx.shadowColor = '#ffe600';
      ctx.beginPath(); ctx.arc(p.x + p.w / 2 + p.facing * 27, p.y + 22, 30, p.facing > 0 ? -1.35 + swingProgress * 0.45 : 1.8 - swingProgress * 0.45, p.facing > 0 ? 0.55 + swingProgress * 0.45 : 3.05 - swingProgress * 0.45); ctx.stroke(); ctx.shadowBlur = 0;
    }
  }
  ctx.fillStyle = '#ffe600'; ctx.shadowBlur = 12; ctx.shadowColor = '#ffe600'; ctx.fillRect(7600, 325, 8, 120); ctx.shadowBlur = 0; ctx.fillStyle = '#ff3cac'; ctx.beginPath(); ctx.moveTo(7608, 325); ctx.lineTo(7660, 340); ctx.lineTo(7608, 355); ctx.fill();
  ctx.restore();
  drawHud();
}

function drawHud() {
  const x = 22;
  const y = 20;
  const width = 220;
  const height = 20;
  ctx.save();
  ctx.fillStyle = 'rgb(2 7 13 / 84%)';
  ctx.fillRect(x - 10, y - 10, width + 20, 84);
  ctx.strokeStyle = '#16485b';
  ctx.strokeRect(x - 10, y - 10, width + 20, 58);
  ctx.fillStyle = '#e9fbff';
  ctx.font = 'bold 12px "Press Start 2P", monospace';
  ctx.fillText('HP', x, y + 1);
  ctx.fillStyle = '#253541';
  ctx.fillRect(x, y + 10, width, height);
  ctx.fillStyle = game.hp > 50 ? '#00f5ff' : game.hp > 25 ? '#ffe600' : '#ff174f';
  ctx.shadowBlur = 12;
  ctx.shadowColor = ctx.fillStyle;
  ctx.fillRect(x, y + 10, width * game.hp / 100, height);
  ctx.shadowBlur = 0;
  ctx.strokeStyle = '#e9fbff';
  ctx.strokeRect(x, y + 10, width, height);
  ctx.fillStyle = '#e9fbff';
  ctx.font = 'bold 11px "Zen Kaku Gothic New", sans-serif';
  ctx.fillText(`${game.hp}%`, x + width + 9, y + 26);
  ctx.fillStyle = '#e9fbff';
  ctx.font = 'bold 10px "Zen Kaku Gothic New", sans-serif';
  ctx.fillText('TIME', x, y + 48);
  ctx.fillStyle = '#253541';
  ctx.fillRect(x + 42, y + 40, width - 42, 12);
  ctx.fillStyle = game.slowCooldown >= 100 ? '#68ffb0' : '#7a1cff';
  ctx.shadowBlur = 10;
  ctx.shadowColor = ctx.fillStyle;
  ctx.fillRect(x + 42, y + 40, (width - 42) * game.slowCooldown / 100, 12);
  ctx.shadowBlur = 0;
  ctx.strokeStyle = '#e9fbff';
  ctx.strokeRect(x + 42, y + 40, width - 42, 12);
  ctx.fillStyle = '#e9fbff';
  ctx.font = 'bold 10px "Zen Kaku Gothic New", sans-serif';
  ctx.fillText(game.slowCooldown >= 100 ? 'READY' : `${Math.floor(game.slowCooldown)}%`, x + width + 9, y + 50);
  ctx.restore();
}

function loop() { update(); justPressed.clear(); draw(); requestAnimationFrame(loop); }
window.addEventListener('keydown', (event) => {
  if ([' ', 'w', 'a', 'd', 'j', 'p', 'Enter'].includes(event.key)) event.preventDefault();
  startAudio();
  if (!event.repeat) justPressed.add(event.key);
  keys.add(event.key);
});
window.addEventListener('keyup', (event) => keys.delete(event.key));
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && audio && audio.context.state === 'suspended') audio.context.resume();
});
restartButton.addEventListener('click', reset);
reset();
loop();

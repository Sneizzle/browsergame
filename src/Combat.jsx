import React, { useEffect, useMemo, useRef, useState } from 'react';

const ARENA_SIZE = 2000;
const BOSS_TIME = 90000;

// ---------- helpers ----------
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist2 = (a, b) => {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
};
const withinArc = (center, arc, angle) => {
  const norm = (x) => {
    while (x > Math.PI) x -= Math.PI * 2;
    while (x < -Math.PI) x += Math.PI * 2;
    return x;
  };
  const d = norm(angle - center);
  return Math.abs(d) <= arc / 2;
};

const pickDistinctTargets = (enemies, origin, count) => {
  if (!enemies.length) return [];
  const sorted = [...enemies].sort(
    (a, b) => Math.hypot(a.x - origin.x, a.y - origin.y) - Math.hypot(b.x - origin.x, b.y - origin.y)
  );
  const pool = sorted.slice(0, Math.max(count * 3, count));
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, Math.min(count, pool.length));
};

// ---------- WEAPONS ----------
const WEAPONS = [
  // =========================
  // RIFLE
  // =========================
  {
    id: 'RIFLE',
    name: 'Rifle',
    targeting: 'closest',
    color: '#e9f7ff',
    levels: [
      { title: 'Rifle I', description: 'Precision line-clearing shot.', stats: { cooldown: 520, bulletSpeed: 15.5, damage: 11, pellets: 1, spread: 0.06, width: 12, height: 4, pierce: 1 } },
      { title: 'Rifle II', description: 'Tighter cadence.', stats: { cooldown: 485, damage: 13 } },
      { title: 'Rifle III', description: 'Two-round burst.', stats: { pellets: 2, spread: 0.10, damage: 12, pierce: 2 } },
      { title: 'Rifle IV', description: 'Ricochet calibration.', stats: { ricochets: 1, damage: 13, pierce: 2 } },
      { title: 'Rifle V', description: 'Triple fan burst + ricochet.', stats: { pellets: 3, spread: 0.18, damage: 13, pierce: 3, ricochets: 1 } }
    ]
  },

  // =========================
  // KATANA
  // =========================
  {
    id: 'KATANA',
    name: 'Katana',
    targeting: 'closest',
    color: '#8efaff',
    levels: [
      {
        title: 'Katana I',
        description: 'One shaziiing crescent cut.',
        stats: {
          cooldown: 900,
          damage: 18,
          range: 165,
          slashPattern: [{ delay: 0, offset: 0.0, arc: Math.PI * 0.34, kind: 'crescent', dmgMult: 1.0 }]
        }
      },
      {
        title: 'Katana II',
        description: 'Crescent + simultaneous zig cut.',
        stats: {
          cooldown: 860,
          damage: 19,
          range: 175,
          slashPattern: [
            { delay: 0, offset: 0.0, arc: Math.PI * 0.34, kind: 'crescent', dmgMult: 1.0 },
            { delay: 0, offset: +0.55, arc: Math.PI * 0.24, kind: 'zig', dmgMult: 0.75 },
            { delay: 70, offset: -0.35, arc: Math.PI * 0.22, kind: 'zig', dmgMult: 0.70 }
          ]
        }
      },
      {
        title: 'Katana III',
        description: 'Spin slash x3 + keeps the other cuts.',
        stats: {
          cooldown: 820,
          damage: 21,
          range: 185,
          slashPattern: [
            { delay: 0, offset: 0.0, arc: Math.PI * 0.34, kind: 'crescent', dmgMult: 1.0 },
            { delay: 0, offset: +0.55, arc: Math.PI * 0.24, kind: 'zig', dmgMult: 0.75 },
            { delay: 70, offset: -0.35, arc: Math.PI * 0.22, kind: 'zig', dmgMult: 0.70 },
            { delay: 0, offset: 0.0, arc: Math.PI * 0.42, kind: 'spin', dmgMult: 0.55 },
            { delay: 90, offset: 2.10, arc: Math.PI * 0.42, kind: 'spin', dmgMult: 0.55 },
            { delay: 180, offset: 4.20, arc: Math.PI * 0.42, kind: 'spin', dmgMult: 0.55 }
          ]
        }
      },
      {
        title: 'Katana IV',
        description: 'Bigger cuts + faster rhythm.',
        stats: {
          cooldown: 760,
          damage: 23,
          range: 200,
          slashPattern: [
            { delay: 0, offset: 0.0, arc: Math.PI * 0.38, kind: 'crescent', dmgMult: 1.0 },
            { delay: 0, offset: +0.60, arc: Math.PI * 0.26, kind: 'zig', dmgMult: 0.75 },
            { delay: 60, offset: -0.40, arc: Math.PI * 0.24, kind: 'zig', dmgMult: 0.70 },
            { delay: 0, offset: 0.0, arc: Math.PI * 0.46, kind: 'spin', dmgMult: 0.58 },
            { delay: 80, offset: 2.10, arc: Math.PI * 0.46, kind: 'spin', dmgMult: 0.58 },
            { delay: 160, offset: 4.20, arc: Math.PI * 0.46, kind: 'spin', dmgMult: 0.58 }
          ]
        }
      },
      {
        title: 'Katana V',
        description: 'Carnage: extra crescents + wider spin.',
        stats: {
          cooldown: 700,
          damage: 26,
          range: 220,
          slashPattern: [
            { delay: 0, offset: 0.0, arc: Math.PI * 0.40, kind: 'crescent', dmgMult: 1.0 },
            { delay: 0, offset: +0.62, arc: Math.PI * 0.28, kind: 'zig', dmgMult: 0.78 },
            { delay: 55, offset: -0.42, arc: Math.PI * 0.26, kind: 'zig', dmgMult: 0.72 },
            { delay: 0, offset: 0.0, arc: Math.PI * 0.50, kind: 'spin', dmgMult: 0.62 },
            { delay: 75, offset: 2.10, arc: Math.PI * 0.50, kind: 'spin', dmgMult: 0.62 },
            { delay: 150, offset: 4.20, arc: Math.PI * 0.50, kind: 'spin', dmgMult: 0.62 },
            { delay: 120, offset: +0.25, arc: Math.PI * 0.34, kind: 'crescent', dmgMult: 0.55 },
            { delay: 180, offset: -0.25, arc: Math.PI * 0.34, kind: 'crescent', dmgMult: 0.55 }
          ]
        }
      }
    ]
  },

  // =========================
  // SMG
  // =========================
  {
    id: 'SMG',
    name: 'SMG',
    targeting: 'closest',
    color: '#ffe58f',
    levels: [
      { title: 'SMG I', description: 'Close target bursts.', stats: { cooldown: 120, bulletSpeed: 17, damage: 7, pellets: 1, spread: 0.18, width: 10, height: 4, pierce: 0, slow: 0.08 } },
      { title: 'SMG II', description: 'Improved control.', stats: { cooldown: 112, damage: 8, spread: 0.16, slow: 0.10 } },
      { title: 'SMG III', description: 'Double burst + ricochet.', stats: { pellets: 2, spread: 0.22, damage: 7, ricochets: 1, slow: 0.10 } },
      { title: 'SMG IV', description: 'Rattle fire + more ricochet.', stats: { cooldown: 100, damage: 7, ricochets: 2, slow: 0.12 } },
      { title: 'SMG V', description: 'Wide triple spray + chain zap.', stats: { pellets: 3, spread: 0.34, damage: 6, ricochets: 2, chain: 1, slow: 0.12 } }
    ]
  },

  // =========================
  // SHOTGUN
  // =========================
  {
    id: 'SHOTGUN',
    name: 'Shotgun',
    targeting: 'closest',
    color: '#ffd36b',
    levels: [
      { title: 'Shotgun I', description: 'Close arc blast (knockback).', stats: { cooldown: 860, bulletSpeed: 13, damage: 9, pellets: 7, spread: 0.85, width: 14, height: 5, pierce: 0, knockback: 1.25 } },
      { title: 'Shotgun II', description: 'Denser spread.', stats: { pellets: 8, damage: 9, knockback: 1.30 } },
      { title: 'Shotgun III', description: 'Shrapnel punch (minor pierce).', stats: { pellets: 9, damage: 9, pierce: 1, knockback: 1.35 } },
      { title: 'Shotgun IV', description: 'High density surge.', stats: { pellets: 10, spread: 0.90, damage: 10, pierce: 1, knockback: 1.40 } },
      { title: 'Shotgun V', description: 'Meteor cluster (explosive pellets).', stats: { pellets: 12, spread: 0.98, damage: 10, pierce: 1, knockback: 1.45, explodeRadius: 28, explodeMult: 0.45 } }
    ]
  },

  // =========================
  // LASER
  // =========================
  {
    id: 'LASER',
    name: 'Laser',
    targeting: 'closest',
    color: '#ff8ef6',
    levels: [
      { title: 'Laser I', description: 'Focused beam shot (pierces).', stats: { cooldown: 1100, bulletSpeed: 18, damage: 20, pellets: 1, spread: 0.04, width: 16, height: 4, pierce: 1 } },
      { title: 'Laser II', description: 'Amplified pulse.', stats: { damage: 24, pierce: 1 } },
      { title: 'Laser III', description: 'Twin pulses.', stats: { pellets: 2, spread: 0.08, damage: 22, pierce: 1 } },
      { title: 'Laser IV', description: 'Overcharged arc.', stats: { cooldown: 980, damage: 28, pierce: 2 } },
      { title: 'Laser V', description: 'Tri-beam burst + chain.', stats: { pellets: 3, spread: 0.12, damage: 26, pierce: 2, chain: 1 } }
    ]
  },

  // =========================
  // SNIPER
  // =========================
  {
    id: 'SNIPER',
    name: 'Sniper',
    targeting: 'closest',
    color: '#8fffef',
    levels: [
      { title: 'Sniper I', description: 'Slow, piercing shot (splash).', stats: { cooldown: 1500, bulletSpeed: 22, damage: 60, pellets: 1, spread: 0.02, width: 24, height: 6, pierce: 2, flashy: true, explodeRadius: 52, explodeMult: 0.55 } },
      { title: 'Sniper II', description: 'Improved charge pack.', stats: { damage: 78, explodeRadius: 58, explodeMult: 0.60 } },
      { title: 'Sniper III', description: 'Rail density.', stats: { pierce: 3, damage: 92, explodeRadius: 62, explodeMult: 0.62 } },
      { title: 'Sniper IV', description: 'Faster cycling.', stats: { cooldown: 1320, damage: 108, explodeRadius: 66, explodeMult: 0.65 } },
      { title: 'Sniper V', description: 'Voltaic lance (stun splash).', stats: { damage: 132, pierce: 4, explodeRadius: 72, explodeMult: 0.70, stun: 120 } }
    ]
  },

  // =========================
  // NEW: TESLA COIL
  // =========================
  {
    id: 'TESLA',
    name: 'Tesla Coil',
    targeting: 'closest',
    color: '#a6b7ff',
    levels: [
      { title: 'Tesla I', description: 'Chain lightning (2 jumps).', stats: { cooldown: 720, damage: 14, chain: 2, arcRange: 260, stun: 60 } },
      { title: 'Tesla II', description: 'Bigger arcs + stronger stun.', stats: { damage: 16, chain: 2, arcRange: 290, stun: 100 } },
      { title: 'Tesla III', description: 'More jumps.', stats: { chain: 4, damage: 17 } },
      { title: 'Tesla IV', description: 'Forked discharge.', stats: { chain: 5, damage: 18, fork: 1 } },
      { title: 'Tesla V', description: 'Overload storm.', stats: { cooldown: 620, damage: 20, chain: 6, fork: 2, storm: true } }
    ]
  },

  // =========================
  // NEW: ROCKET LAUNCHER (tuned)
  // =========================
  {
    id: 'ROCKET',
    name: 'Rocket Launcher',
    targeting: 'closest',
    color: '#ff9a8a',
    levels: [
      { title: 'Rocket I', description: 'Slow rocket that accelerates.', stats: { cooldown: 1020, bulletSpeed: 5.0, accel: 0.24, damage: 26, pellets: 1, spread: 0.05, width: 18, height: 8, pierce: 0, explodeRadius: 96, explodeMult: 0.78, homing: false } },
      { title: 'Rocket II', description: 'Bigger blast.', stats: { damage: 30, explodeRadius: 112, explodeMult: 0.80 } },
      { title: 'Rocket III', description: 'Triple salvo (spreads targets).', stats: { pellets: 3, spread: 0.26, damage: 24, explodeRadius: 104, explodeMult: 0.78 } },
      { title: 'Rocket IV', description: 'Heat-seeking guidance.', stats: { homing: true, damage: 26, explodeRadius: 112, explodeMult: 0.80 } },
      { title: 'Rocket V', description: 'Swarm barrage (10 seekers).', stats: { pellets: 10, spread: 0.80, bulletSpeed: 4.6, accel: 0.28, homing: true, damage: 18, explodeRadius: 104, explodeMult: 0.78 } }
    ]
  },

  // =========================
  // NEW: VOID ORB
  // =========================
  {
    id: 'VOID',
    name: 'Void Orb',
    targeting: 'closest',
    color: '#c08bff',
    levels: [
      { title: 'Void I', description: 'Slow orb that pulls enemies.', stats: { cooldown: 900, bulletSpeed: 5.2, damage: 11, pellets: 1, spread: 0.08, width: 18, height: 18, pierce: 8, pull: 0.7, lifeMs: 1200 } },
      { title: 'Void II', description: 'Stronger pull + bigger orb.', stats: { pull: 0.9, width: 22, height: 22 } },
      { title: 'Void III', description: 'Orb splits near end.', stats: { split: 2, damage: 10 } },
      { title: 'Void IV', description: 'More pierce + slow.', stats: { pierce: 12, slow: 0.14 } },
      { title: 'Void V', description: 'Singularity pop (AoE).', stats: { explodeRadius: 84, explodeMult: 0.65, pull: 1.1 } }
    ]
  },

  // =========================
  // NEW: FLAMER
  // =========================
  {
    id: 'FLAMER',
    name: 'Flame Projector',
    targeting: 'closest',
    color: '#ffb36a',
    levels: [
      { title: 'Flame I', description: 'Short-range fire cone.', stats: { cooldown: 180, bulletSpeed: 10, damage: 4, pellets: 1, spread: 0.44, width: 12, height: 6, pierce: 1, burn: 1600 } },
      { title: 'Flame II', description: 'Longer burn + more damage.', stats: { damage: 5, burn: 2000 } },
      { title: 'Flame III', description: 'Wider cone.', stats: { spread: 0.64, pierce: 2 } },
      { title: 'Flame IV', description: 'Ignition burst (small splash).', stats: { explodeRadius: 30, explodeMult: 0.55 } },
      { title: 'Flame V', description: 'Napalm trails.', stats: { burn: 2400, trail: true, damage: 6 } }
    ]
  },

  // =========================
  // NEW: TIME CANNON
  // =========================
  {
    id: 'TIME',
    name: 'Time Cannon',
    targeting: 'closest',
    color: '#7ff2d7',
    levels: [
      { title: 'Time I', description: 'Slow shot that slows enemies.', stats: { cooldown: 620, bulletSpeed: 12, damage: 12, pellets: 1, spread: 0.06, width: 14, height: 6, pierce: 1, slow: 0.22 } },
      { title: 'Time II', description: 'More slow + pierce.', stats: { slow: 0.26, pierce: 2 } },
      { title: 'Time III', description: 'Temporal split.', stats: { split: 2, damage: 11 } },
      { title: 'Time IV', description: 'Stasis pulse (stun on hit).', stats: { stun: 120, damage: 13 } },
      { title: 'Time V', description: 'Chrono fracture (mini freeze wave).', stats: { stun: 170, explodeRadius: 56, explodeMult: 0.45 } }
    ]
  }
];

const UPGRADES = [
  { id: 'REGEN', title: 'Nanite Regen', description: '+0.35 HP/sec', apply: (s) => ({ ...s, regen: s.regen + 0.35 }) },
  { id: 'MAX_HP', title: 'Reinforced Plating', description: '+30 Max HP', apply: (s) => ({ ...s, maxHp: s.maxHp + 30, hp: s.hp + 30 }) },
  { id: 'DAMAGE', title: 'Damage Boost', description: '+10% damage', apply: (s) => ({ ...s, damageMult: s.damageMult * 1.1 }) },
  { id: 'ATTACK_SPEED', title: 'Attack Speed', description: '+10% rate', apply: (s) => ({ ...s, attackSpeed: s.attackSpeed * 1.1 }) },
  { id: 'MOVE_SPEED', title: 'Kinetic Thrusters', description: '+8% move speed', apply: (s) => ({ ...s, moveSpeed: (s.moveSpeed || 1) * 1.08 }) }
];

// ---------- spawners ----------
const spawnEnemy = (difficulty) => {
  const side = Math.floor(Math.random() * 4);
  const margin = 20;
  const edgeX = Math.random() * (ARENA_SIZE - margin * 2) + margin;
  const edgeY = Math.random() * (ARENA_SIZE - margin * 2) + margin;
  const x = side === 0 ? margin : side === 1 ? ARENA_SIZE - margin : edgeX;
  const y = side === 2 ? margin : side === 3 ? ARENA_SIZE - margin : edgeY;

  const hpMult = 1 + difficulty * 0.08;

  const roll = Math.random();
  if (roll > 0.92) {
    const base = 120;
    const hp = Math.round(base * hpMult);
    return { id: Math.random(), type: 'brute', x, y, hp, maxHp: hp, speed: 1.1 + difficulty * 0.04, size: 52, xp: 26, contactDamage: 16, color: '#ff6b6b' };
  }
  if (roll > 0.7) {
    const base = 30;
    const hp = Math.round(base * hpMult);
    return { id: Math.random(), type: 'sprinter', x, y, hp, maxHp: hp, speed: 3.1 + difficulty * 0.1, size: 22, xp: 13, contactDamage: 10, color: '#ff2fd2' };
  }
  const base = 55;
  const hp = Math.round(base * hpMult);
  return { id: Math.random(), type: 'grunt', x, y, hp, maxHp: hp, speed: 1.9 + difficulty * 0.06, size: 28, xp: 14, contactDamage: 12, color: '#ff007a' };
};

const spawnBoss = (player) => ({
  id: 'boss',
  type: 'boss',
  x: Math.min(Math.max(player.x + 380, 100), ARENA_SIZE - 100),
  y: Math.min(Math.max(player.y - 320, 100), ARENA_SIZE - 100),
  hp: 2800,
  maxHp: 2800,
  speed: 1.9,
  size: 130,
  xp: 360,
  contactDamage: 28,
  color: '#ffda6b'
});

const buildWeaponStats = (weapon, level) =>
  weapon.levels.slice(0, level).reduce((acc, entry) => ({ ...acc, ...entry.stats }), {});

// ---------- orb merge ----------
const mergeOrbs = (orbs) => {
  const merged = [];
  orbs.forEach((o) => {
    const target = merged.find((m) => Math.hypot(m.x - o.x, m.y - o.y) < 20);
    if (target) {
      target.value += o.value;
      target.x = (target.x + o.x) / 2;
      target.y = (target.y + o.y) / 2;
      target.elite = target.elite || o.elite;
    } else {
      merged.push({ ...o });
    }
  });
  return merged;
};

// ---------- upgrades ----------
const rollUpgradeOptions = (ownedWeapons, weaponLevels, stats) => {
  const upgrades = [...UPGRADES].map((u) => ({ ...u }));
  const unowned = WEAPONS.filter((w) => !ownedWeapons.includes(w.id));

  if (unowned.length) {
    const weaponPick = unowned[Math.floor(Math.random() * unowned.length)];
    upgrades.push({
      id: `WEAPON_${weaponPick.id}`,
      title: `New Weapon: ${weaponPick.name}`,
      description: 'Adds another weapon to your loadout',
      weaponId: weaponPick.id,
      apply: (s) => ({ ...s })
    });
  }

  ownedWeapons.forEach((id) => {
    const level = weaponLevels[id] || 1;
    if (level < 5) {
      const weapon = WEAPONS.find((w) => w.id === id);
      const nextLevel = level + 1;
      upgrades.push({
        id: `UP_${id}_${nextLevel}`,
        title: `${weapon.name} Level ${nextLevel}`,
        description: weapon.levels[nextLevel - 1].description,
        weaponId: id,
        upgradeLevel: nextLevel,
        apply: (s) => ({ ...s })
      });
    }
  });

  const picks = [];
  while (picks.length < 3 && upgrades.length) {
    const idx = Math.floor(Math.random() * upgrades.length);
    picks.push(upgrades.splice(idx, 1)[0]);
  }
  if (picks.length < 3) {
    picks.push({ id: 'HEAL', title: 'Repair Kit', description: 'Restore 40 HP', apply: (s) => ({ ...s, hp: Math.min(s.maxHp, s.hp + 40) }) });
  }
  return picks.map((option) => ({ ...option, statsSnapshot: stats }));
};

export default function Combat({ crew, onExit, onVictory, tileDifficulty = 1 }) {
  const [player, setPlayer] = useState({ x: 1000, y: 1000 });
  const [stats, setStats] = useState({ hp: 120, maxHp: 120, regen: 0, damageMult: 1, attackSpeed: 1, moveSpeed: 1 });
  const [camera, setCamera] = useState({ x: 0, y: 0 });

  const [enemies, setEnemies] = useState([]);
  const [bullets, setBullets] = useState([]);
  const [slashes, setSlashes] = useState([]);
  const [arcs, setArcs] = useState([]); // tesla/chain visuals
  const [explosions, setExplosions] = useState([]); // visual rings
  const [orbs, setOrbs] = useState([]);

  const [selectedWeapons, setSelectedWeapons] = useState([]);
  const [weaponLevels, setWeaponLevels] = useState({});
  const [xp, setXp] = useState(0);
  const [xpTarget, setXpTarget] = useState(140);
  const [level, setLevel] = useState(1);
  const [upgradeOptions, setUpgradeOptions] = useState([]);
  const [bossSpawned, setBossSpawned] = useState(false);
  const [victory, setVictory] = useState(false);
  const [defeat, setDefeat] = useState(false);
  const [progress, setProgress] = useState(0);

  const [hitFx, setHitFx] = useState({});
  const [deathFx, setDeathFx] = useState([]);

  // minimal juice (NO SCREEN SHAKE)
  const [screenFx, setScreenFx] = useState({ chroma: 0, punch: 0 });

  const keys = useRef({});
  const lastFire = useRef({});
  const lastSpawn = useRef(0);
  const elapsed = useRef(0);
  const lastDamage = useRef(0);

  // counters for SMG "every 5th bullet pierces 1"
  const smgCounter = useRef(0);

  // hitstop + small chroma/punch
  const hitstopUntil = useRef(0);
  const juice = useRef({ chroma: 0, punch: 0 });

  const paused = upgradeOptions.length > 0 || victory || defeat;

  // refs to avoid stale state inside interval
  const pausedRef = useRef(paused);
  const playerRef = useRef(player);
  const statsRef = useRef(stats);
  const enemiesRef = useRef(enemies);
  const bulletsRef = useRef(bullets);
  const slashesRef = useRef(slashes);
  const arcsRef = useRef(arcs);
  const explosionsRef = useRef(explosions);
  const orbsRef = useRef(orbs);
  const xpRef = useRef(xp);
  const xpTargetRef = useRef(xpTarget);
  const selectedWeaponsRef = useRef(selectedWeapons);
  const weaponLevelsRef = useRef(weaponLevels);
  const bossSpawnedRef = useRef(bossSpawned);

  useEffect(() => { pausedRef.current = paused; }, [paused]);
  useEffect(() => { playerRef.current = player; }, [player]);
  useEffect(() => { statsRef.current = stats; }, [stats]);
  useEffect(() => { enemiesRef.current = enemies; }, [enemies]);
  useEffect(() => { bulletsRef.current = bullets; }, [bullets]);
  useEffect(() => { slashesRef.current = slashes; }, [slashes]);
  useEffect(() => { arcsRef.current = arcs; }, [arcs]);
  useEffect(() => { explosionsRef.current = explosions; }, [explosions]);
  useEffect(() => { orbsRef.current = orbs; }, [orbs]);
  useEffect(() => { xpRef.current = xp; }, [xp]);
  useEffect(() => { xpTargetRef.current = xpTarget; }, [xpTarget]);
  useEffect(() => { selectedWeaponsRef.current = selectedWeapons; }, [selectedWeapons]);
  useEffect(() => { weaponLevelsRef.current = weaponLevels; }, [weaponLevels]);
  useEffect(() => { bossSpawnedRef.current = bossSpawned; }, [bossSpawned]);

  const weaponChoices = useMemo(() => WEAPONS, []);
  const crewDamageMult = useMemo(() => crew.reduce((acc, c) => acc * c.trait.dmg, 1), [crew]);
  const crewSpeedMult = useMemo(() => crew.reduce((acc, c) => acc * c.trait.spd, 1), [crew]);

  const juicePunch = (mag = 1, chroma = 1) => {
    // NO SHAKE: only hitstop + slight punch + slight chroma
    const now = Date.now();
    hitstopUntil.current = Math.max(hitstopUntil.current, now + Math.floor(18 * mag));
    juice.current.chroma = Math.max(juice.current.chroma, 0.22 * chroma);
    juice.current.punch = Math.max(juice.current.punch, 0.9 * mag);
  };

  useEffect(() => {
    if (victory) {
      const t = setTimeout(() => onVictory(), 1800);
      return () => clearTimeout(t);
    }
  }, [victory, onVictory]);

  useEffect(() => {
    if (defeat) {
      const t = setTimeout(() => onExit(), 1800);
      return () => clearTimeout(t);
    }
  }, [defeat, onExit]);

  useEffect(() => {
    if (stats.hp <= 0 && !defeat) setDefeat(true);
  }, [stats.hp, defeat]);

  useEffect(() => {
    const handleKey = (e) => { keys.current[e.key.toLowerCase()] = e.type === 'keydown'; };
    window.addEventListener('keydown', handleKey);
    window.addEventListener('keyup', handleKey);
    return () => {
      window.removeEventListener('keydown', handleKey);
      window.removeEventListener('keyup', handleKey);
    };
  }, []);

  // main loop
  useEffect(() => {
    if (!selectedWeapons.length) return;

    const loop = setInterval(() => {
      if (pausedRef.current) return;

      const now = Date.now();
      const inHitstop = now < hitstopUntil.current;

      // decay minimal juice
      juice.current.chroma *= 0.88;
      juice.current.punch *= 0.84;
      if (juice.current.chroma < 0.01) juice.current.chroma = 0;
      if (juice.current.punch < 0.01) juice.current.punch = 0;
      setScreenFx({ chroma: juice.current.chroma, punch: juice.current.punch });

      // always advance progress timer (even during hitstop)
      elapsed.current += 16;
      setProgress(Math.min(1, elapsed.current / BOSS_TIME));

      // decay death fx + arcs + explosions
      setDeathFx((fx) => fx.filter((f) => Date.now() - f.t < 260));
      setArcs((prev) => prev.filter((a) => Date.now() - a.t < a.life));
      setExplosions((prev) => prev.filter((e) => Date.now() - e.t < e.life));

      // regen
      if (!inHitstop && statsRef.current.regen > 0) {
        setStats((prev) => ({ ...prev, hp: Math.min(prev.maxHp, prev.hp + prev.regen * 0.016) }));
      }

      // move player + camera
      if (!inHitstop) {
        setPlayer((prev) => {
          let nx = prev.x;
          let ny = prev.y;

          const baseSpeed = 5.6;
          const speedMult = Math.min(crewSpeedMult, 1.4);
          const finalSpeed = baseSpeed * speedMult * (statsRef.current.moveSpeed || 1);

          if (keys.current.w) ny -= finalSpeed;
          if (keys.current.s) ny += finalSpeed;
          if (keys.current.a) nx -= finalSpeed;
          if (keys.current.d) nx += finalSpeed;

          nx = clamp(nx, 0, ARENA_SIZE);
          ny = clamp(ny, 0, ARENA_SIZE);

          setCamera({ x: nx - window.innerWidth / 2, y: ny - window.innerHeight / 2 });
          return { x: nx, y: ny };
        });
      } else {
        const p = playerRef.current;
        setCamera({ x: p.x - window.innerWidth / 2, y: p.y - window.innerHeight / 2 });
      }

      const p = playerRef.current;

      // Enemy spawn (skip spawn during hitstop; feels punchier)
      const difficulty = tileDifficulty + Math.floor(elapsed.current / 20000);
      const spawnInterval = Math.max(220, 1500 - difficulty * 90);

      let nextEnemies = [...enemiesRef.current];

      if (!inHitstop) {
        if (elapsed.current - lastSpawn.current > spawnInterval) {
          lastSpawn.current = elapsed.current;
          const count = Math.min(2 + Math.floor(difficulty / 2), 12);
          for (let i = 0; i < count; i += 1) nextEnemies.push(spawnEnemy(difficulty));
        }

        if (!bossSpawnedRef.current && elapsed.current > BOSS_TIME) {
          bossSpawnedRef.current = true;
          setBossSpawned(true);
          nextEnemies.push(spawnBoss(p));
          juicePunch(1.2, 1);
        }
      }

      // move enemies (respect stun/slow)
      const movedEnemies = nextEnemies.map((en) => {
        if (en.stunnedUntil && Date.now() < en.stunnedUntil) return en;
        const dx = p.x - en.x;
        const dy = p.y - en.y;
        const d = Math.hypot(dx, dy) || 1;

        const slowMult = en.slowUntil && Date.now() < en.slowUntil ? (en.slowFactor ?? 0.75) : 1;
        const spd = en.speed * slowMult;

        if (inHitstop) return en;
        return { ...en, x: en.x + (dx / d) * spd, y: en.y + (dy / d) * spd };
      });

      // bullets update (incl homing/accel)
      const movedBullets = bulletsRef.current
        .map((b) => {
          if (inHitstop) return { ...b, life: b.life - 16 }; // freeze in place
          let vx = b.vx;
          let vy = b.vy;
          let x = b.x;
          let y = b.y;

          // acceleration (rockets)
          if (b.accel) {
            const sp = Math.hypot(vx, vy) || 1;
            const nsp = sp + b.accel;
            vx = (vx / sp) * nsp;
            vy = (vy / sp) * nsp;
          }

          // homing (LOCKED target if present, softer steering)
          if (b.isHoming) {
            const enemiesNow = movedEnemies;
            if (enemiesNow.length) {
              let t = null;
              if (b.homeTargetId) {
                t = enemiesNow.find((e) => e.id === b.homeTargetId) || null;
              }
              if (!t) {
                t = enemiesNow.reduce((best, en) => {
                  const dd = (en.x - x) * (en.x - x) + (en.y - y) * (en.y - y);
                  if (!best) return en;
                  const bd = (best.x - x) * (best.x - x) + (best.y - y) * (best.y - y);
                  return dd < bd ? en : best;
                }, null);
              }

              if (t) {
                const desired = Math.atan2(t.y - y, t.x - x);
                const cur = Math.atan2(vy, vx);

                let dA = desired - cur;
                while (dA > Math.PI) dA -= Math.PI * 2;
                while (dA < -Math.PI) dA += Math.PI * 2;

                const sp = Math.hypot(vx, vy) || 1;
                const steer = clamp(0.06 + (sp / 26) * 0.05, 0.06, 0.12);
                const newA = cur + dA * steer;

                vx = Math.cos(newA) * sp;
                vy = Math.sin(newA) * sp;
              }
            }
          }

          return { ...b, x: x + vx, y: y + vy, vx, vy, life: b.life - 16 };
        })
        .filter((b) => b.x > -120 && b.x < ARENA_SIZE + 120 && b.y > -120 && b.y < ARENA_SIZE + 120 && b.life > 0);

      // slashes update
      const movedSlashes = slashesRef.current
        .map((sl) => ({ ...sl, age: (sl.age || 0) + (inHitstop ? 0 : 16) }))
        .filter((sl) => (sl.age || 0) <= sl.life);

      // Apply projectile impacts (pierce + ricochet + explosions + status)
      const bulletHits = new Map(); // en.id -> dmg
      const statusHits = new Map(); // en.id -> {slow, stun, burn, knockback...}
      const explosionBursts = []; // {x,y,radius,damage}
      const nextBullets = movedBullets.map((b) => ({ ...b }));

      const pickRicochetTarget = (fromEnemy, allEnemies) => {
        const maxRange2 = 320 * 320;
        let best = null;
        let bestD = Infinity;
        for (const e of allEnemies) {
          if (e.id === fromEnemy.id) continue;
          const d = dist2({ x: fromEnemy.x, y: fromEnemy.y }, e);
          if (d > maxRange2) continue;
          if (d < bestD) { bestD = d; best = e; }
        }
        return best;
      };

      nextBullets.forEach((b) => {
        if (b.hit) return;

        for (const en of movedEnemies) {
          if (b.hit) break;
          const d = Math.hypot(b.x - en.x, b.y - en.y);
          if (d < en.size * 0.7) {
            bulletHits.set(en.id, (bulletHits.get(en.id) || 0) + b.damage);

            const st = statusHits.get(en.id) || {};
            if (b.slow) st.slow = Math.max(st.slow || 0, b.slow);
            if (b.stun) st.stun = Math.max(st.stun || 0, b.stun);
            if (b.burn) st.burn = Math.max(st.burn || 0, b.burn);
            if (b.knockback) st.knockback = Math.max(st.knockback || 0, b.knockback);
            statusHits.set(en.id, st);

            if (b.explodeRadius && b.explodeMult) {
              explosionBursts.push({
                x: en.x,
                y: en.y,
                radius: b.explodeRadius,
                damage: b.damage * b.explodeMult
              });
            }

            // ricochet (visible bounce)
            if (b.ricochets && b.ricochets > 0) {
              const nxt = pickRicochetTarget(en, movedEnemies);
              if (nxt) {
                const ang = Math.atan2(nxt.y - en.y, nxt.x - en.x);
                const sp = Math.hypot(b.vx, b.vy) || (b.bulletSpeed || 12);
                b.x = en.x;
                b.y = en.y;
                b.vx = Math.cos(ang) * sp;
                b.vy = Math.sin(ang) * sp;
                b.ricochets -= 1;

                if ((b.pierce ?? 0) > 0) b.pierce -= 1;
                juicePunch(0.22, 0.35);
                break;
              }
            }

            // pierce
            b.pierce = (b.pierce ?? 0) - 1;
            if (b.pierce < 0) b.hit = true;

            // chain zap
            if (b.chain && b.chain > 0) {
              const maxRange2 = 260 * 260;
              let best = null;
              let bestD = Infinity;
              for (const e2 of movedEnemies) {
                if (e2.id === en.id) continue;
                const dd = dist2(en, e2);
                if (dd < bestD && dd <= maxRange2) { bestD = dd; best = e2; }
              }
              if (best) {
                setArcs((prev) => [
                  ...prev,
                  {
                    id: Math.random(),
                    x1: en.x,
                    y1: en.y,
                    x2: best.x,
                    y2: best.y,
                    t: Date.now(),
                    life: 140,
                    color: b.color
                  }
                ]);
                bulletHits.set(best.id, (bulletHits.get(best.id) || 0) + b.damage * 0.55);
                const st2 = statusHits.get(best.id) || {};
                if (b.stun) st2.stun = Math.max(st2.stun || 0, Math.floor(b.stun * 0.7));
                if (b.slow) st2.slow = Math.max(st2.slow || 0, Math.max(0.06, b.slow * 0.6));
                statusHits.set(best.id, st2);
                juicePunch(0.26, 0.45);
              }
            }
          }
        }
      });

      // explosion damage application
      if (explosionBursts.length) {
        for (const burst of explosionBursts) {
          setExplosions((prev) => [
            ...prev,
            { id: Math.random(), x: burst.x, y: burst.y, r: burst.radius, t: Date.now(), life: 240 }
          ]);
          for (const en of movedEnemies) {
            const d = Math.hypot(en.x - burst.x, en.y - burst.y);
            if (d <= burst.radius) {
              const fall = 1 - d / burst.radius;
              bulletHits.set(en.id, (bulletHits.get(en.id) || 0) + burst.damage * Math.max(0.25, fall));
            }
          }
          juicePunch(0.45, 0.55);
        }
      }

      // apply damage (bullets + sword arcs)
      const withDamage = movedEnemies.map((en0) => {
        let en = en0;
        let totalDamage = bulletHits.get(en.id) || 0;

        movedSlashes.forEach((sl) => {
          const activeStart = sl.delay || 0;
          const activeEnd = activeStart + (sl.activeMs || 120);
          if ((sl.age || 0) < activeStart || (sl.age || 0) > activeEnd) return;

          const d = Math.hypot(en.x - sl.x, en.y - sl.y);
          if (d > sl.range) return;

          const enemyAngle = Math.atan2(en.y - sl.y, en.x - sl.x);
          if (!withinArc(sl.angle, sl.arc, enemyAngle)) return;

          totalDamage += sl.damage;
        });

        // void pull influence
        const pulls = movedBullets.filter((b) => b.pull && Math.hypot(b.x - en.x, b.y - en.y) < 120);
        if (pulls.length && !inHitstop && !(en.stunnedUntil && Date.now() < en.stunnedUntil)) {
          const strongest = pulls.reduce((acc, b) => Math.max(acc, b.pull || 0), 0);
          const cx = pulls.reduce((acc, b) => acc + b.x, 0) / pulls.length;
          const cy = pulls.reduce((acc, b) => acc + b.y, 0) / pulls.length;
          const dx = cx - en.x;
          const dy = cy - en.y;
          const d = Math.hypot(dx, dy) || 1;
          en = { ...en, x: en.x + (dx / d) * strongest * 1.6, y: en.y + (dy / d) * strongest * 1.6 };
        }

        if (totalDamage > 0) {
          setHitFx((prev) => ({ ...prev, [en.id]: Date.now() }));
          juicePunch(Math.min(0.30, totalDamage / 90), 0.25);
          return { ...en, hp: en.hp - totalDamage };
        }
        return en;
      });

      // apply status effects + knockback
      const withStatus = withDamage.map((en) => {
        const st = statusHits.get(en.id);
        if (!st) return en;

        let out = { ...en };

        if (st.slow) {
          out.slowUntil = Date.now() + 450;
          out.slowFactor = clamp(1 - st.slow, 0.55, 0.95);
        }
        if (st.stun) {
          out.stunnedUntil = Math.max(out.stunnedUntil || 0, Date.now() + st.stun);
        }

        if (st.knockback && !inHitstop) {
          const ang = Math.atan2(out.y - p.y, out.x - p.x);
          const push = 4.5 * st.knockback;
          out.x += Math.cos(ang) * push;
          out.y += Math.sin(ang) * push;
        }

        if (st.burn) {
          out.burnUntil = Math.max(out.burnUntil || 0, Date.now() + st.burn);
          out.burnDps = Math.max(out.burnDps || 0, 3.8);
        }

        return out;
      });

      // burn tick
      const burned = withStatus.map((en) => {
        if (en.burnUntil && Date.now() < en.burnUntil && !inHitstop) {
          return { ...en, hp: en.hp - (en.burnDps || 3) * 0.016 };
        }
        return en;
      });

      // deaths -> orbs + death pop + elite orb chance
      const alive = [];
      const newOrbs = [];
      burned.forEach((en) => {
        if (en.hp > 0) {
          alive.push(en);
        } else {
          setDeathFx((fx) => [...fx, { id: Math.random(), x: en.x, y: en.y, t: Date.now(), size: en.size }]);

          const orbCount = Math.max(1, Math.round(en.xp / 10));
          for (let i = 0; i < orbCount; i += 1) {
            newOrbs.push({
              id: Math.random(),
              x: en.x + (Math.random() - 0.5) * 30,
              y: en.y + (Math.random() - 0.5) * 30,
              value: Math.ceil(en.xp / orbCount)
            });
          }

          if (elapsed.current > 18000 && Math.random() < 0.08) {
            newOrbs.push({
              id: Math.random(),
              x: en.x + (Math.random() - 0.5) * 10,
              y: en.y + (Math.random() - 0.5) * 10,
              value: en.xp * 2,
              elite: true
            });
          }

          if (en.type === 'boss') setVictory(true);

          juicePunch(en.type === 'boss' ? 1.2 : 0.42, en.type === 'boss' ? 0.9 : 0.45);
        }
      });

      setEnemies(alive);
      setBullets(nextBullets.filter((b) => !b.hit));
      setSlashes(movedSlashes);
      if (newOrbs.length) setOrbs((prev) => [...prev, ...newOrbs]);

      // orbs: attract + merge + pickup
      setOrbs((prev) => {
        const pp = playerRef.current;
        const drifted = prev.map((o) => {
          const dx = pp.x - o.x;
          const dy = pp.y - o.y;
          const d = Math.hypot(dx, dy);
          if (d > 0 && d < 120) {
            const pull = o.elite ? 3.2 : 2.6;
            return { ...o, x: o.x + (dx / d) * pull, y: o.y + (dy / d) * pull };
          }
          return o;
        });

        const merged = mergeOrbs(drifted);

        const kept = [];
        let gained = 0;
        merged.forEach((o) => {
          const d = Math.hypot(o.x - pp.x, o.y - pp.y);
          if (d < 34) gained += o.value;
          else kept.push(o);
        });

        if (gained > 0) setXp((x) => x + gained);
        return kept;
      });

      // level up
      if (xpRef.current >= xpTargetRef.current) {
        setXp((x) => x - xpTargetRef.current);
        setLevel((l) => l + 1);
        setXpTarget((t) => Math.floor(t * 1.32));
        setUpgradeOptions(rollUpgradeOptions(selectedWeaponsRef.current, weaponLevelsRef.current, statsRef.current));
        juicePunch(0.55, 0.55);
      }

      // contact damage
      if (!inHitstop) {
        const now2 = Date.now();
        if (now2 - lastDamage.current > 260) {
          let totalDamage = 0;
          const pp = playerRef.current;
          alive.forEach((en) => {
            const d = Math.hypot(en.x - pp.x, en.y - pp.y);
            if (d < en.size * 0.55 + 16) totalDamage += en.contactDamage || 8;
          });
          if (totalDamage > 0) {
            lastDamage.current = now2;
            setStats((prev) => ({ ...prev, hp: Math.max(0, prev.hp - totalDamage) }));
            juicePunch(0.55, 0.65);
          }
        }
      }

      // firing (skip during hitstop)
      if (inHitstop) return;

      const now3 = Date.now();
      const pp = playerRef.current;
      const currentEnemies = alive;
      if (!currentEnemies.length) return;

      selectedWeaponsRef.current.forEach((id) => {
        const weapon = WEAPONS.find((w) => w.id === id);
        if (!weapon) return;

        const lvl = weaponLevelsRef.current[id] || 1;
        const wStats = buildWeaponStats(weapon, lvl);

        const last = lastFire.current[id] || 0;
        const fireCooldown = (wStats.cooldown || 600) / (statsRef.current.attackSpeed || 1);
        if (now3 - last < fireCooldown) return;
        lastFire.current[id] = now3;

        const target =
          weapon.targeting === 'random'
            ? currentEnemies[Math.floor(Math.random() * currentEnemies.length)]
            : currentEnemies.reduce((closest, en) => {
                const d = Math.hypot(en.x - pp.x, en.y - pp.y);
                if (!closest) return en;
                const cd = Math.hypot(closest.x - pp.x, closest.y - pp.y);
                return d < cd ? en : closest;
              }, null);

        if (!target) return;

        const baseAngle = Math.atan2(target.y - pp.y, target.x - pp.x);

        // TESLA: no bullets; arc chain with stun
        if (weapon.id === 'TESLA') {
          const baseDamage = (wStats.damage || 12) * (statsRef.current.damageMult || 1) * crewDamageMult;
          const maxJumps = wStats.chain || 2;
          const arcRange = wStats.arcRange || 260;
          const stunMs = wStats.stun || 60;
          const fork = wStats.fork || 0;

          const hit = new Set();
          const arcsToAdd = [];

          const findNext = (from) => {
            let best = null;
            let bestD = Infinity;
            for (const e of currentEnemies) {
              if (hit.has(e.id)) continue;
              const d = Math.hypot(e.x - from.x, e.y - from.y);
              if (d <= arcRange && d < bestD) { bestD = d; best = e; }
            }
            return best;
          };

          let cur = target;
          let origin = { x: pp.x, y: pp.y };

          for (let i = 0; i < maxJumps; i++) {
            if (!cur) break;
            hit.add(cur.id);

            bulletHits.set(cur.id, (bulletHits.get(cur.id) || 0) + baseDamage * (i === 0 ? 1 : 0.72));
            const st = statusHits.get(cur.id) || {};
            st.stun = Math.max(st.stun || 0, stunMs + i * 20);
            st.slow = Math.max(st.slow || 0, 0.10);
            statusHits.set(cur.id, st);

            arcsToAdd.push({
              id: Math.random(),
              x1: origin.x,
              y1: origin.y,
              x2: cur.x,
              y2: cur.y,
              t: Date.now(),
              life: 160,
              color: weapon.color
            });

            origin = { x: cur.x, y: cur.y };
            cur = findNext(origin);
          }

          if (fork > 0) {
            const forkTargets = currentEnemies
              .filter((e) => !hit.has(e.id))
              .sort((a, b) => Math.hypot(a.x - target.x, a.y - target.y) - Math.hypot(b.x - target.x, b.y - target.y))
              .slice(0, fork);

            forkTargets.forEach((ft) => {
              bulletHits.set(ft.id, (bulletHits.get(ft.id) || 0) + baseDamage * 0.55);
              const st = statusHits.get(ft.id) || {};
              st.stun = Math.max(st.stun || 0, Math.floor(stunMs * 0.7));
              statusHits.set(ft.id, st);

              arcsToAdd.push({
                id: Math.random(),
                x1: target.x,
                y1: target.y,
                x2: ft.x,
                y2: ft.y,
                t: Date.now(),
                life: 150,
                color: weapon.color
              });
            });
          }

          if (wStats.storm) {
            setExplosions((prev) => [...prev, { id: Math.random(), x: target.x, y: target.y, r: 86, t: Date.now(), life: 260 }]);
            currentEnemies.forEach((e) => {
              const d = Math.hypot(e.x - target.x, e.y - target.y);
              if (d <= 86) {
                bulletHits.set(e.id, (bulletHits.get(e.id) || 0) + baseDamage * 0.35);
                const st = statusHits.get(e.id) || {};
                st.slow = Math.max(st.slow || 0, 0.16);
                statusHits.set(e.id, st);
              }
            });
          }

          setArcs((prev) => [...prev, ...arcsToAdd]);
          juicePunch(0.55, 0.75);
          return;
        }

        // KATANA
        if (weapon.id === 'KATANA') {
          const pattern =
            wStats.slashPattern && wStats.slashPattern.length
              ? wStats.slashPattern
              : [{ delay: 0, offset: 0, arc: Math.PI * 0.34, kind: 'crescent', dmgMult: 1 }];

          const baseDamage = (wStats.damage || 10) * (statsRef.current.damageMult || 1) * crewDamageMult;
          const baseRange = wStats.range || 165;

          const toAdd = pattern.map((pat) => {
            const dmg = baseDamage * (pat.dmgMult || 1);
            const arc = pat.arc || Math.PI * 0.34;
            const delay = pat.delay || 0;
            const activeMs = pat.kind === 'zig' ? 90 : pat.kind === 'spin' ? 120 : 120;

            return {
              id: Math.random(),
              x: pp.x,
              y: pp.y,
              range: baseRange,
              damage: dmg,
              angle: baseAngle + (pat.offset || 0),
              arc,
              delay,
              activeMs,
              age: 0,
              life: delay + 240,
              kind: pat.kind || 'crescent'
            };
          });

          setSlashes((prev) => [...prev, ...toAdd]);
          juicePunch(0.30, 0.35);
          return;
        }

        // ALL RANGED
        const pellets = wStats.pellets || 1;
        const next = [];

        const isRocket = weapon.id === 'ROCKET';
        const rocketTargets = isRocket ? pickDistinctTargets(currentEnemies, pp, pellets) : null;

        for (let i = 0; i < pellets; i += 1) {
          let a = baseAngle;

          if (isRocket && rocketTargets && rocketTargets[i]) {
            a = Math.atan2(rocketTargets[i].y - pp.y, rocketTargets[i].x - pp.x);
            a += (Math.random() - 0.5) * 0.10;
          } else {
            const spread = (Math.random() - 0.5) * (wStats.spread || 0);
            a = baseAngle + spread;
          }

          // SMG special: every 5th bullet pierces +1 (ONLY SMG)
          let smgPierceBonus = 0;
          if (weapon.id === 'SMG') {
            smgCounter.current += 1;
            if (smgCounter.current % 5 === 0) smgPierceBonus = 1;
          }

          // rockets start slower (then accel + homing feels missile-y)
          const baseSpeed = wStats.bulletSpeed || 12;
          const speed = isRocket ? baseSpeed * 0.78 : baseSpeed;

          const vx = Math.cos(a) * speed;
          const vy = Math.sin(a) * speed;

          next.push({
            id: Math.random(),
            x: pp.x,
            y: pp.y,
            vx,
            vy,
            damage: (wStats.damage || 1) * (statsRef.current.damageMult || 1) * crewDamageMult,
            color: weapon.color,
            life: wStats.lifeMs || 1000,
            width: wStats.width,
            height: wStats.height,
            pierce: (wStats.pierce ?? 0) + smgPierceBonus,
            flashy: wStats.flashy,

            ricochets: wStats.ricochets || 0,
            chain: wStats.chain || 0,
            slow: wStats.slow || 0,
            stun: wStats.stun || 0,
            knockback: wStats.knockback || 0,
            explodeRadius: wStats.explodeRadius || 0,
            explodeMult: wStats.explodeMult || 0,
            burn: wStats.burn || 0,

            // rocket behaviors
            isHoming: !!wStats.homing,
            accel: wStats.accel || 0,
            homeTargetId: isRocket && rocketTargets && rocketTargets[i] ? rocketTargets[i].id : null,

            // void behaviors
            pull: wStats.pull || 0,
            split: wStats.split || 0,
            trail: !!wStats.trail
          });
        }

        setBullets((prev) => [...prev, ...next]);
      });
    }, 16);

    return () => clearInterval(loop);
  }, [crew, selectedWeapons.length, tileDifficulty, crewDamageMult, crewSpeedMult]);

  const chooseUpgrade = (option) => {
    setStats((s) => option.apply(s));
    if (option.weaponId) {
      if (option.upgradeLevel) {
        setWeaponLevels((levels) => ({ ...levels, [option.weaponId]: option.upgradeLevel }));
      } else {
        setSelectedWeapons((w) => [...w, option.weaponId]);
        setWeaponLevels((levels) => ({ ...levels, [option.weaponId]: 1 }));
      }
    }
    setUpgradeOptions([]);
    juicePunch(0.40, 0.60);
  };

  const selectWeapon = (weaponId) => {
    setSelectedWeapons([weaponId]);
    setWeaponLevels({ [weaponId]: 1 });
    juicePunch(0.40, 0.55);
  };

  // world transform + juice (NO SHAKE)
  const worldTransform = `translate(${-camera.x}px,${-camera.y}px) scale(${1 + (screenFx.punch || 0) * 0.012})`;

  const chroma = clamp(screenFx.chroma || 0, 0, 0.6);
  const worldFilter =
    chroma > 0.02
      ? `drop-shadow(${Math.round(2 * chroma)}px 0 0 rgba(255,0,100,0.35)) drop-shadow(${Math.round(-2 * chroma)}px 0 0 rgba(0,220,255,0.25)) saturate(${1 + chroma * 0.15}) contrast(${1 + chroma * 0.10})`
      : '';

  return (
    <div className="combat-world">
      {!selectedWeapons.length && (
        <div className="ui-layer" style={{ background: 'rgba(0,0,0,0.95)' }}>
          <h1>SELECT TECH</h1>
          <div className="weapon-grid">
            {weaponChoices.map((w) => (
              <button key={w.id} className="weapon-card" onClick={() => selectWeapon(w.id)}>
                <span>{w.name}</span>
                <small>{w.id === 'KATANA' ? 'Directional sword cuts' : w.id === 'TESLA' ? 'Chain lightning stuns' : 'Ranged weapon'}</small>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="combat-hud">
        <div className="xp-bar">
          <div className="xp-bar-fill" style={{ width: `${Math.min(100, (xp / xpTarget) * 100)}%` }} />
          <span>LVL {level}</span>
        </div>
        <div className="hp-bar">
          <div className="hp-bar-fill" style={{ width: `${clamp((stats.hp / stats.maxHp) * 100, 0, 100)}%` }} />
          <span>HP {Math.max(0, Math.round((stats.hp / stats.maxHp) * 100))}%</span>
        </div>
        <div className="progress-bar">
          <div className="progress-bar-fill" style={{ width: `${progress * 100}%` }} />
          <span>Boss {Math.floor(progress * 100)}%</span>
        </div>
        {bossSpawned && !victory && <div className="boss-warning">BOSS ENGAGED</div>}
      </div>

      <div className="world-container" style={{ transform: worldTransform, filter: worldFilter }}>
        <div className="world-border" />
        <div className="player-tracer" style={{ left: player.x - 60, top: player.y - 60 }} />
        <div className="player-sprite" style={{ left: player.x, top: player.y }} />

        {/* explosions (rings) */}
        {explosions.map((e) => (
          <div
            key={e.id}
            style={{
              position: 'absolute',
              left: e.x,
              top: e.y,
              width: e.r * 2,
              height: e.r * 2,
              marginLeft: -e.r,
              marginTop: -e.r,
              borderRadius: '50%',
              border: '2px solid rgba(255,255,255,0.35)',
              boxShadow: '0 0 18px rgba(255,255,255,0.25)',
              opacity: Math.max(0, 1 - (Date.now() - e.t) / e.life),
              transform: `scale(${1 + (Date.now() - e.t) / e.life})`
            }}
          />
        ))}

        {/* death pop */}
        {deathFx.map((f) => (
          <div
            key={f.id}
            className="death-pop"
            style={{ left: f.x, top: f.y, width: f.size * 1.6, height: f.size * 1.6 }}
          />
        ))}

        {/* tesla / chain arcs */}
        {arcs.map((a) => {
          const dx = a.x2 - a.x1;
          const dy = a.y2 - a.y1;
          const len = Math.hypot(dx, dy);
          const ang = Math.atan2(dy, dx);
          const lifeP = Math.max(0, 1 - (Date.now() - a.t) / a.life);
          return (
            <div
              key={a.id}
              style={{
                position: 'absolute',
                left: a.x1,
                top: a.y1,
                width: len,
                height: 3,
                transformOrigin: '0 50%',
                transform: `rotate(${ang}rad)`,
                background: `linear-gradient(90deg, rgba(255,255,255,0), ${a.color || 'rgba(170,220,255,0.9)'}, rgba(255,255,255,0))`,
                boxShadow: `0 0 10px ${a.color || 'rgba(170,220,255,0.9)'}, 0 0 22px rgba(255,255,255,0.35)`,
                opacity: lifeP
              }}
            />
          );
        })}

        {/* katana arcs */}
        {slashes.map((s) => {
          const size = Math.max(200, s.range * 2);
          const visible = (s.age || 0) >= (s.delay || 0);
          const arcSize = s.arc || Math.PI * 0.34;
          const arcStart = -arcSize / 2;

          return (
            <div
              key={s.id}
              className={`katana-arc ${s.kind || 'crescent'}`}
              style={{
                left: s.x,
                top: s.y,
                opacity: visible ? 1 : 0,
                '--rot': `${s.angle}rad`,
                '--size': `${size}px`,
                '--arcStart': `${arcStart}rad`,
                '--arcSize': `${arcSize}rad`
              }}
            />
          );
        })}

        {/* bullets / rockets / orbs */}
        {bullets.map((b) => (
          <div
            key={b.id}
            className={`bullet ${b.flashy ? 'sniper' : ''}`}
            style={{
              left: b.x,
              top: b.y,
              background: b.color,
              width: b.width,
              height: b.height,
              borderRadius: b.isHoming ? 6 : undefined,
              boxShadow:
                b.isHoming
                  ? '0 0 10px rgba(255,200,170,0.85), 0 0 26px rgba(255,90,40,0.35)'
                  : b.pull
                    ? '0 0 14px rgba(190,120,255,0.55), 0 0 28px rgba(120,40,255,0.25)'
                    : b.burn
                      ? '0 0 14px rgba(255,160,70,0.65), 0 0 26px rgba(255,70,0,0.20)'
                      : ''
            }}
          />
        ))}

        {orbs.map((o) => (
          <div
            key={o.id}
            className="xp-orb"
            style={{
              left: o.x,
              top: o.y,
              width: 10 + Math.min(36, Math.sqrt(o.value) * 5),
              height: 10 + Math.min(36, Math.sqrt(o.value) * 5),
              background: o.elite ? 'rgba(160, 110, 255, 0.95)' : o.value >= 20 ? 'rgba(255, 80, 80, 0.95)' : 'rgba(0, 255, 160, 0.9)',
              boxShadow: o.elite
                ? '0 0 12px rgba(160, 110, 255, 0.9), 0 0 28px rgba(160, 110, 255, 0.7)'
                : o.value >= 20
                  ? '0 0 12px rgba(255, 80, 80, 0.9), 0 0 28px rgba(255, 80, 80, 0.7)'
                  : '0 0 12px rgba(0, 255, 160, 0.9), 0 0 28px rgba(0, 255, 160, 0.7)'
            }}
          />
        ))}

        {enemies.map((e) => {
          const t = hitFx[e.id] || 0;
          const recentlyHit = Date.now() - t < 85;
          const stunned = e.stunnedUntil && Date.now() < e.stunnedUntil;
          const slowed = e.slowUntil && Date.now() < e.slowUntil;

          return (
            <div
              key={e.id}
              className={`enemy-sprite ${e.type} ${recentlyHit ? 'hit' : ''}`}
              style={{
                left: e.x,
                top: e.y,
                width: e.size,
                height: e.size,
                background: e.color,
                filter: stunned ? 'brightness(1.4) saturate(1.2)' : slowed ? 'saturate(0.85)' : '',
                boxShadow: stunned ? '0 0 12px rgba(170,220,255,0.75)' : ''
              }}
            />
          );
        })}
      </div>

      {upgradeOptions.length > 0 && (
        <div className="ui-layer" style={{ background: 'rgba(1,2,6,0.92)' }}>
          <h1>CHOOSE UPGRADE</h1>
          <div className="upgrade-grid">
            {upgradeOptions.map((option) => (
              <button key={option.id} className="upgrade-card" onClick={() => chooseUpgrade(option)}>
                <strong>{option.title}</strong>
                <span>{option.description}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {victory && (
        <div className="victory-overlay">
          <div className="victory-blast" />
          <h1>MAP CLEARED</h1>
          <p>Explosion propagated across the zone.</p>
        </div>
      )}

      {defeat && (
        <div className="victory-overlay">
          <div className="victory-blast" />
          <h1>CORE BREACH</h1>
          <p>Systems offline. Retreating to orbit.</p>
        </div>
      )}

      <button className="scifi-btn" style={{ position: 'absolute', bottom: 20, right: 20 }} onClick={onExit}>
        SURRENDER
      </button>
    </div>
  );
}

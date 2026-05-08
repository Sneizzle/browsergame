import React, { useEffect, useMemo, useRef, useState } from 'react';
import thornsIcon from './components/t1.PNG';
import decoyIcon from './components/t3.PNG';
import turretIcon from './components/t8.PNG';
import spriteAttackSpeed from './gunsprite/attackspeedupgrade.png';
import spriteAxe from './gunsprite/axe.png';
import spriteDamage from './gunsprite/damageupgrade.png';
import spriteHealthRegen from './gunsprite/healthregenupgrade.png';
import spriteHealth from './gunsprite/healthupgrade.png';
import spriteKatana from './gunsprite/katana.png';
import spriteLaser from './gunsprite/laser.png';
import spriteRifle from './gunsprite/rifle.png';
import spriteRocket from './gunsprite/rocketlauncher.png';
import spriteShotgun from './gunsprite/shotgun.png';
import spriteSmg from './gunsprite/smg.png';
import spriteSniper from './gunsprite/sniper.png';
import spriteTesla from './gunsprite/tesla.png';
import spriteTimegun from './gunsprite/timegun.png';
import spriteVoid from './gunsprite/voidorb.png';

const SPRITES = {
  RIFLE: spriteRifle,
  KATANA: spriteKatana,
  AXES: spriteAxe,
  SMG: spriteSmg,
  SHOTGUN: spriteShotgun,
  LASER: spriteLaser,
  SNIPER: spriteSniper,
  TESLA: spriteTesla,
  ROCKET: spriteRocket,
  VOID: spriteVoid,
  TIME: spriteTimegun,
  REGEN: spriteHealthRegen,
  MAX_HP: spriteHealth,
  DAMAGE: spriteDamage,
  ATTACK_SPEED: spriteAttackSpeed
};

const ARENA_SIZE = 2800; // +40%
const BOSS_TIME = 120000;

// -------------------- DIFFICULTY TUNING (BASE) --------------------
const TRASH_HP_MULT = 0.95;           // trash HP slightly up (less one-shot mid/late)
const ELITE_HP_MULT = 1.05;           // elites keep their identity late
const MINI_HP_MULT = 1.15;            // mini-bosses a bit sturdier
const BOSS_HP_MULT = 2.23;            // bosses need to survive late-game burst builds
// Slightly softer early-game spawn density (prevents guaranteed wall encroach / early overwhelm)
const SPAWN_INTERVAL_MULT = 0.90;

// -------------------- LATE GAME FIX (45% -> 100%) --------------------
// Add HP nerf for "adds" ramps from -40% to -60% (mult 0.60 -> 0.40)
const LATE_ADD_HP_MIN_MULT = 1.00;
const LATE_ADD_HP_MAX_NERF_MULT = 0.85;

// XP boost ramps in late game so builds come online
const LATE_XP_MIN_MULT = 1.25;  // at 45%
const LATE_XP_MAX_MULT = 1.85;  // at 100%

// Spawns: reduce density late game, and reduce more during boss
const LATE_SPAWN_INTERVAL_BOOST = 0.78; // late game: faster spawns (was slower)
const LATE_SPAWN_COUNT_REDUCE = -0.35;   // late game: MORE spawns (+35% at end)

const BOSS_ADD_INTERVAL_MULT = 1.25;    // boss fight should stay populated
const BOSS_ADD_COUNT_MULT = 1.0;        // keep pressure during boss
// -------------------- PLAYER FEEDBACK TWEAKS --------------------
const AFTER40_ENEMY_MULT = 1.50;     // +50% enemies after 40% progress
const WALL_HP_MULT = 0.67;           // thicker pressure walls, still breakable
const RAM_HP_MULT = 0.21;            // RAM should be about 35% of the previous tuned HP
const RELIEF_SPAWN_INTERVAL_MULT = 1.00; // keep pressure; avoid dead-air breaks

const DEFAULT_WEAPON_CAP = 5;
const PERF_EFFECT_CAP = 54;
const PERF_ARC_CAP = 52;
const PERF_DEATH_FX_CAP = 58;
const PERF_ENEMY_SEPARATION_CAP = 150;
const PERF_ORB_SOFT_CAP = 220;
const PERF_NORMAL_ENEMY_CAP = 148;
const PERF_WALL_ENEMY_CAP = 112;
const PERF_BULLET_CAP = 130;


// -------------------- helpers --------------------
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * clamp(t, 0, 1);
const norm01 = (x, a, b) => (b <= a ? 0 : clamp((x - a) / (b - a), 0, 1));
const stableUnitRoll = (value = '') => {
  const s = String(value || '');
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
};

const tileDifficultyRank = (difficulty) => clamp(Math.round(Number(difficulty) || 1), 1, 5);
const difficultyHpMult = (difficulty) => {
  const d = tileDifficultyRank(difficulty);
  return [0, 0.62, 0.95, 1.45, 2.18, 4.25][d] || 1;
};
const difficultyPressureMult = (difficulty) => {
  const d = tileDifficultyRank(difficulty);
  return [0, 0.62, 0.92, 1.30, 1.72, 3.10][d] || 1;
};
const bossMilestonesForDifficulty = (difficulty) => {
  const d = tileDifficultyRank(difficulty);
  if (d >= 5) return [0.20, 0.40, 0.60, 0.80, 1.00];
  if (d >= 4) return [0.70, 1.00];
  if (d >= 3) return [0.50, 1.00];
  return [1.00];
};

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

// Keep enemies from perfectly stacking on top of each other.
// Allows clumping, but applies a small separation when their hitboxes overlap.
const applyEnemySeparation = (list) => {
  const enemies = Array.isArray(list) ? list.map((e) => ({ ...e })) : [];
  const n = enemies.length;
  if (n <= 1) return enemies;
  if (n > 180) return enemies;

  for (let i = 0; i < n; i += 1) {
    if (n > PERF_ENEMY_SEPARATION_CAP && i % 2 !== 0) continue;
    const a = enemies[i];
    if (!a || a.despawn) continue;
    if (a.type === 'wall') continue;

    const jLimit = n > 170 ? Math.min(n, i + 18) : n;
    for (let j = i + 1; j < jLimit; j += 1) {
      const b = enemies[j];
      if (!b || b.despawn) continue;
      if (b.type === 'wall') continue;

      // Keep minis from overlapping each other more aggressively (RAM stacking complaint)
      const aMini = String(a.type || '').startsWith('mini_');
      const bMini = String(b.type || '').startsWith('mini_');

      const min = (Number(a.size) + Number(b.size)) * (aMini || bMini ? 0.62 : 0.52);
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy) || 0.0001;
      if (d >= min) continue;

      const overlap = (min - d);
      const nx = dx / d;
      const ny = dy / d;
      const push = overlap * (aMini || bMini ? 0.55 : 0.40);

      // push both away (bounded)
      a.x = clamp(a.x - nx * push, 0, ARENA_SIZE);
      a.y = clamp(a.y - ny * push, 0, ARENA_SIZE);
      b.x = clamp(b.x + nx * push, 0, ARENA_SIZE);
      b.y = clamp(b.y + ny * push, 0, ARENA_SIZE);
    }
  }
  return enemies;
};

const isEliteType = (type) => {
  const t = String(type || '');
  return (
    t === 'boss' ||
    t === 'boss_split' ||
    t === 'abomination' ||
    t === 'merge_brute' ||
    t === 'lane_elite' ||
    t === 'brute' ||
    t === 'juggernaut' ||
    t === 'wall' ||
    t.startsWith('mini_')
  );
};

const isControlImmune = (type) => {
  const t = String(type || '');
  return (
    t === 'boss' ||
    t === 'boss_split' ||
    t === 'juggernaut' ||
    t === 'wall' ||
    t === 'turret' ||
    t === 'abomination' ||
    t === 'merge_brute' ||
    t === 'lane_elite' ||
    t === 'pylon' ||
    t === 'grab_ghost' ||
    t === 'splitter_boss' ||
    t.startsWith('mini_')
  );
};

const isKnockbackImmune = (type) => {
  const t = String(type || '');
  return isControlImmune(t) || t === 'splitter' || t === 'splitter_boss';
};

const appendCapped = (prev, items, cap = PERF_EFFECT_CAP) => {
  const base = Array.isArray(prev) ? prev : [];
  const add = Array.isArray(items) ? items : [items];
  if (!add.length) return base;
  return [...base, ...add].slice(-cap);
};

const buildSpatialGrid = (items, cellSize = 180) => {
  const grid = new Map();
  for (const item of items || []) {
    const cx = Math.floor(item.x / cellSize);
    const cy = Math.floor(item.y / cellSize);
    const key = `${cx}:${cy}`;
    const bucket = grid.get(key) || [];
    bucket.push(item);
    grid.set(key, bucket);
  }
  return { grid, cellSize };
};

const querySpatialGrid = (spatial, x, y, radius) => {
  if (!spatial?.grid) return [];
  const { grid, cellSize } = spatial;
  const minX = Math.floor((x - radius) / cellSize);
  const maxX = Math.floor((x + radius) / cellSize);
  const minY = Math.floor((y - radius) / cellSize);
  const maxY = Math.floor((y + radius) / cellSize);
  const out = [];
  for (let gx = minX; gx <= maxX; gx += 1) {
    for (let gy = minY; gy <= maxY; gy += 1) {
      const bucket = grid.get(`${gx}:${gy}`);
      if (bucket) out.push(...bucket);
    }
  }
  return out;
};

const capEnemyBudget = (list, playerPos) => {
  const src = Array.isArray(list) ? list : [];
  const walls = [];
  const specials = [];
  const normals = [];
  for (const e of src) {
    if (!e || e.hp <= 0) continue;
    if (e.type === 'wall') walls.push(e);
    else if (e.type === 'boss' || e.type === 'boss_split' || e.type === 'pylon' || String(e.type || '').startsWith('mini_') || e.type === 'tiny_ram' || e.type === 'turret') specials.push(e);
    else normals.push(e);
  }
  const score = (e) => {
    const dx = e.x - playerPos.x;
    const dy = e.y - playerPos.y;
    return dx * dx + dy * dy;
  };
  if (walls.length > PERF_WALL_ENEMY_CAP) walls.sort((a, b) => score(a) - score(b)).length = PERF_WALL_ENEMY_CAP;
  if (normals.length > PERF_NORMAL_ENEMY_CAP) normals.sort((a, b) => score(a) - score(b)).length = PERF_NORMAL_ENEMY_CAP;
  return [...specials, ...walls, ...normals];
};

// -------------------- WEAPONS (RANK 3-5: MORE CC + EXPLOSIVITY + EFFECTS) --------------------
const WEAPONS = [
  {
    id: 'RIFLE',
    name: 'Rifle',
    targeting: 'closest',
    color: '#e9f7ff',
    levels: [
      { title: 'Rifle I', description: 'Clean precision shot.', stats: { cooldown: 540, bulletSpeed: 15.5, damage: 11, pellets: 1, spread: 0.04, width: 12, height: 4, pierce: 1 } },
      { title: 'Rifle II', description: 'Tighter cadence and a bit more punch.', stats: { cooldown: 480, damage: 14, pierce: 1 } },
      // Rank 3+: crowd control + mild splash to help late swarms
      { title: 'Rifle III', description: 'Two-round burst + suppression slow.', stats: { pellets: 2, spread: 0.10, damage: 14, pierce: 3, ricochets: 1, slow: 0.18, slowDuration: 820 } },
      { title: 'Rifle IV', description: 'Smart bounces + micro-stun shock.', stats: { ricochets: 3, damage: 16, pierce: 4, microFreeze: 180, chain: 1, explodeRadius: 28, explodeMult: 0.22 } },
      { title: 'Rifle V', description: 'Triple fan burst + shrapnel pop.', stats: { pellets: 3, spread: 0.18, damage: 15, pierce: 5, ricochets: 2, chain: 2, explodeRadius: 42, explodeMult: 0.30, slow: 0.18, slowDuration: 900 } }
    ]
  },
  {
    id: 'KATANA',
    name: 'Katana',
    targeting: 'closest',
    color: '#8efaff',
    levels: [
      {
        title: 'Katana I',
        description: 'Neon cut. Tight forward arc.',
        stats: {
          cooldown: 820,
          damage: 18,
          range: 155,
          slashPattern: [
            { delay: 0, offset: 0.0, arc: Math.PI * 0.34, kind: 'crescent', dmgMult: 1.0,
              color: 'rgba(0,242,255,1)', glowColor: 'rgba(0,242,255,0.75)', glowBlur: 18, lineWidth: 12, activeMs: 120 }
          ]
        }
      },
      {
        title: 'Katana II',
        description: 'Twin cut: left-right.',
        stats: {
          cooldown: 840,
          damage: 17,
          range: 165,
          slashPattern: [
            { delay: 0,   offset: -0.22, arc: Math.PI * 0.34, kind: 'crescent', dmgMult: 0.95,
              color: 'rgba(0,255,136,1)', glowColor: 'rgba(0,255,136,0.70)', glowBlur: 18, lineWidth: 12, activeMs: 115 },
            { delay: 140, offset:  0.22, arc: Math.PI * 0.34, kind: 'crescent', dmgMult: 0.95,
              color: 'rgba(0,242,255,1)', glowColor: 'rgba(0,242,255,0.70)', glowBlur: 18, lineWidth: 12, activeMs: 115 }
          ]
        }
      },
      // Rank 3+: apply slow + micro-stun on contact to keep mobs off you
      {
        title: 'Katana III',
        description: 'Triple combo with a wide finisher (NOT full circle).',
        stats: {
          cooldown: 820,
          damage: 18,
          range: 178,
          slashPattern: [
            { delay: 0,   offset: -0.26, arc: Math.PI * 0.32, kind: 'crescent', dmgMult: 0.85,
              color: 'rgba(255,0,122,1)', glowColor: 'rgba(255,0,122,0.70)', glowBlur: 18, lineWidth: 12, activeMs: 110,
              slow: 0.18, slowDuration: 820, microFreeze: 90 },
            { delay: 120, offset:  0.26, arc: Math.PI * 0.32, kind: 'crescent', dmgMult: 0.85,
              color: 'rgba(255,80,210,1)', glowColor: 'rgba(255,80,210,0.65)', glowBlur: 18, lineWidth: 12, activeMs: 110,
              slow: 0.18, slowDuration: 820, microFreeze: 90 },
            { delay: 260, offset:  0.0,  arc: Math.PI * 0.62, kind: 'crescent', dmgMult: 1.05,
              color: 'rgba(255,180,80,1)', glowColor: 'rgba(255,180,80,0.60)', glowBlur: 20, lineWidth: 13, activeMs: 140,
              stun: 140 }
          ]
        }
      },
      {
        title: 'Katana IV',
        description: 'Cross cut + short sweep finisher.',
        stats: {
          cooldown: 780,
          damage: 20,
          range: 190,
          slashPattern: [
            { delay: 0,   offset:  0.35, arc: Math.PI * 0.30, kind: 'crescent', dmgMult: 0.95,
              color: 'rgba(255,40,70,1)', glowColor: 'rgba(255,40,70,0.75)', glowBlur: 22, lineWidth: 14, activeMs: 115,
              slow: 0.20, slowDuration: 900, microFreeze: 110 },
            { delay: 110, offset: -0.35, arc: Math.PI * 0.30, kind: 'crescent', dmgMult: 0.95,
              color: 'rgba(255,40,70,1)', glowColor: 'rgba(255,40,70,0.75)', glowBlur: 22, lineWidth: 14, activeMs: 115,
              slow: 0.20, slowDuration: 900, microFreeze: 110 },
            { delay: 250, offset:  Math.PI, arc: Math.PI * 0.55, kind: 'crescent', dmgMult: 1.0,
              color: 'rgba(255,120,210,1)', glowColor: 'rgba(255,120,210,0.65)', glowBlur: 20, lineWidth: 13, activeMs: 145,
              stun: 180 }
          ]
        }
      },
      {
        title: 'Katana V',
        description: 'Blade dance: 4-hit chain, still directional.',
        stats: {
          cooldown: 720,
          damage: 22,
          range: 205,
          slashPattern: [
            { delay: 0,   offset: -0.28, arc: Math.PI * 0.30, kind: 'crescent', dmgMult: 0.75,
              color: 'rgba(0,242,255,1)', glowColor: 'rgba(0,242,255,0.65)', glowBlur: 18, lineWidth: 12, activeMs: 105,
              slow: 0.22, slowDuration: 980, microFreeze: 120 },
            { delay: 90,  offset:  0.28, arc: Math.PI * 0.30, kind: 'crescent', dmgMult: 0.75,
              color: 'rgba(0,255,136,1)', glowColor: 'rgba(0,255,136,0.60)', glowBlur: 18, lineWidth: 12, activeMs: 105,
              slow: 0.22, slowDuration: 980, microFreeze: 120 },
            { delay: 190, offset:  0.0,  arc: Math.PI * 0.48, kind: 'crescent', dmgMult: 0.95,
              color: 'rgba(255,0,122,1)', glowColor: 'rgba(255,0,122,0.60)', glowBlur: 20, lineWidth: 13, activeMs: 130,
              stun: 160 },
            { delay: 320, offset:  0.0,  arc: Math.PI * 0.72, kind: 'crescent', dmgMult: 1.15,
              color: 'rgba(255,218,107,1)', glowColor: 'rgba(255,218,107,0.55)', glowBlur: 22, lineWidth: 14, activeMs: 155,
              stun: 220, knockback: 1.0 }
          ]
        }
      }
    ]
  },

  {
    id: 'AXES',
    name: 'Axes',
    targeting: 'closest',
    color: '#ff3f2f',
    levels: [
      { title: 'Axes I', description: 'Left cleave, right cleave, then alternating bladestorm and axe toss. All hits bleed.', stats: { cooldown: 980, damage: 11, range: 168, bleed: 10500, stormMult: 0.58, stormRangeMult: 0.94, throwMult: 0.95, throwBounces: 7, throwCount: 1 } },
      { title: 'Axes II', description: 'Harder cleaves, longer bleed, sharper finishers.', stats: { cooldown: 950, damage: 12, range: 178, bleed: 12800, stormMult: 0.60, stormRangeMult: 0.98, throwMult: 1.00, throwBounces: 8, throwCount: 2 } },
      { title: 'Axes III', description: 'Blood axes: kills can burst while the rhythm keeps carving.', stats: { cooldown: 920, damage: 13, range: 188, bleed: 15400, stormMult: 0.62, stormRangeMult: 1.02, throwMult: 1.05, throwBounces: 9, throwCount: 3, deathBurstRadius: 60, deathBurstMult: 0.18 } },
      { title: 'Axes IV', description: 'Execution rhythm: bigger cleaves and stronger blood bursts.', stats: { cooldown: 890, damage: 14, range: 198, bleed: 18400, stormMult: 0.64, stormRangeMult: 1.06, throwMult: 1.10, throwBounces: 10, throwCount: 4, deathBurstRadius: 76, deathBurstMult: 0.22 } },
      { title: 'Axes V', description: 'Twinfall: brutal finishers with heavy bleed and death bursts.', stats: { cooldown: 860, damage: 15, range: 210, bleed: 22000, stormMult: 0.66, stormRangeMult: 1.10, throwMult: 1.15, throwBounces: 11, throwCount: 5, deathBurstRadius: 92, deathBurstMult: 0.26 } }
    ]
  },

  {
    id: 'SMG',
    name: 'SMG',
    targeting: 'closest',
    color: '#ffe58f',
    levels: [
      { title: 'SMG I', description: 'Close target bursts.', stats: { cooldown: 126, bulletSpeed: 17, damage: 7, pellets: 1, spread: 0.18, width: 10, height: 4, pierce: 0 } },
      { title: 'SMG II', description: 'Improved control and steadier spray.', stats: { cooldown: 116, damage: 8, spread: 0.14 } },
      // Rank 3+: more control, chain and burn at higher ranks
      { title: 'SMG III', description: 'Double burst + ricochet + stronger slow.', stats: { pellets: 2, spread: 0.22, damage: 7, ricochets: 1, slow: 0.14, slowDuration: 820 } },
      { title: 'SMG IV', description: 'Rattle fire + electrified rounds (micro-stun).', stats: { cooldown: 100, damage: 7, ricochets: 2, slow: 0.16, slowDuration: 920, microFreeze: 90, chain: 1 } },
      { title: 'SMG V', description: 'Wide triple spray + chain zap + light tracer bleed.', stats: { pellets: 3, spread: 0.34, damage: 5.5, ricochets: 2, chain: 2, slow: 0.14, slowDuration: 900, burn: 700 } }
    ]
  },

  {
    id: 'SHOTGUN',
    name: 'Shotgun',
    targeting: 'closest',
    color: '#ffd36b',
    levels: [
      { title: 'Shotgun I', description: 'Arc blast (knockback).', stats: { cooldown: 820, bulletSpeed: 13, damage: 10, pellets: 7, spread: 0.85, width: 14, height: 5, pierce: 0, knockback: 1.55 } },
      { title: 'Shotgun II', description: 'Denser spread + harder shove.', stats: { pellets: 8, damage: 9, knockback: 1.55 } },
      // Rank 3+: crowd control + pops
      { title: 'Shotgun III', description: 'Ricochet shrapnel (chaos) + micro-stun.', stats: { pellets: 9, damage: 9, pierce: 1, knockback: 1.65, ricochets: 1, microFreeze: 120 } },
      { title: 'Shotgun IV', description: 'Impact pops (mini-blast on hit) + slow.', stats: { pellets: 10, spread: 0.92, damage: 10, pierce: 1, knockback: 1.75, explodeRadius: 30, explodeMult: 0.22, slow: 0.16, slowDuration: 820 } },
      { title: 'Shotgun V', description: 'Meteor cluster (explosive pellets) + stun shock.', stats: { pellets: 12, spread: 1.02, damage: 10, pierce: 1, knockback: 1.85, explodeRadius: 46, explodeMult: 0.36, stun: 120 } }
    ]
  },

  {
    id: 'LASER',
    name: 'Laser',
    targeting: 'closest',
    color: '#ff8ef6',
    levels: [
      { title: 'Laser I', description: 'Fat beam that carves crowds.', stats: { cooldown: 1060, beamMs: 150, beamWidth: 32, damage: 6.5, tickMs: 18, pierce: 999, eliteDmgMult: 0.58 } },
      { title: 'Laser II', description: 'Hotter cut.', stats: { damage: 8, beamWidth: 36, eliteDmgMult: 0.60 } },
      // Rank 3+: apply slow/burn to keep lanes open
      { title: 'Laser III', description: 'Twin beam fan + scorch.', stats: { beams: 2, fan: 0.12, damage: 8, burn: 1000, eliteDmgMult: 0.62 } },
      { title: 'Laser IV', description: 'Overcharged slice + drag slow.', stats: { cooldown: 920, damage: 10, beamWidth: 42, slow: 0.14, slowDuration: 620, eliteDmgMult: 0.66 } },
      { title: 'Laser V', description: 'Tri-beam + chain burn + micro-stun ticks.', stats: { beams: 3, fan: 0.18, damage: 9, beamWidth: 46, burn: 1350, microFreeze: 60, eliteDmgMult: 0.68 } }
    ]
  },

  {
    id: 'SNIPER',
    name: 'Sniper',
    targeting: 'closest',
    color: '#8fffef',
    levels: [
      { title: 'Sniper I', description: 'Railcannon (tear-through + shockwave).', stats: { cooldown: 1600, bulletSpeed: 26, damage: 44, pellets: 1, spread: 0.01, width: 26, height: 6, pierce: 2, flashy: true, explodeRadius: 54, explodeMult: 0.42, rail: true, railWidth: 16, railMs: 90, eliteDmgMult: 0.62 } },
      { title: 'Sniper II', description: 'More rupture.', stats: { damage: 58, pierce: 3, explodeRadius: 62, explodeMult: 0.48, railWidth: 18, eliteDmgMult: 0.66 } },
      // Rank 3-5: stronger utility & waveclear; slightly less oppressive vs elites
      { title: 'Sniper III', description: 'Lance density + concussive slow.', stats: { damage: 76, pierce: 4, explodeRadius: 78, explodeMult: 0.62, railWidth: 20, slow: 0.18, slowDuration: 780, eliteDmgMult: 0.70 } },
      { title: 'Sniper IV', description: 'Faster cycling + stun shockwave.', stats: { cooldown: 1380, damage: 88, explodeRadius: 88, explodeMult: 0.66, railWidth: 22, stun: 110, eliteDmgMult: 0.70 } },
      { title: 'Sniper V', description: 'Annihilator (stun shock) + bigger rupture (but fair vs elites).', stats: { damage: 102, pierce: 5, explodeRadius: 102, explodeMult: 0.70, stun: 145, railWidth: 24, eliteDmgMult: 0.70 } }
    ]
  },

  {
    id: 'TESLA',
    name: 'Tesla Coil',
    targeting: 'closest',
    color: '#a6b7ff',
    levels: [
      { title: 'Tesla I', description: 'Longer chain lightning that heavily slows zapped targets.', stats: { cooldown: 820, damage: 15, chain: 4, arcRange: 300, stun: 95, chainFalloff: 0.90, zapSlow: 0.58, zapSlowDuration: 1750 } },
      { title: 'Tesla II', description: 'Bigger arcs, longer reach.', stats: { cooldown: 790, damage: 16, chain: 5, arcRange: 360, stun: 120, zapSlow: 0.66, zapSlowDuration: 2100 } },
      { title: 'Tesla III', description: 'Deep temporal lock on chained targets.', stats: { cooldown: 760, chain: 6, damage: 17, arcRange: 420, zapSlow: 0.78, zapSlowDuration: 2550, fork: 1 } },
      { title: 'Tesla IV', description: 'Wide forked discharge.', stats: { cooldown: 720, chain: 7, damage: 18, arcRange: 480, zapSlow: 0.86, zapSlowDuration: 3000, fork: 2 } },
      { title: 'Tesla V', description: 'Overload storm: huge arcs, lower damage, brutal slow.', stats: { cooldown: 680, damage: 19, chain: 9, arcRange: 560, zapSlow: 0.92, zapSlowDuration: 3400, fork: 4, storm: true } }
    ]
  },

  {
    id: 'ROCKET',
    name: 'Rocket Launcher',
    targeting: 'closest',
    color: '#ff9a8a',
    levels: [
      { title: 'Rocket I', description: 'One real missile, then reload.', stats: { cooldown: 2100, bulletSpeed: 6.5, accel: 0.12, damage: 62, pellets: 1, burstDelay: 150, burstArc: 0.08, spread: 0.03, width: 34, height: 14, pierce: 0, explodeRadius: 150, explodeMult: 1.05, homing: false, aoeBurn: false, rocketVisual: true } },
      { title: 'Rocket II', description: 'Two-missile salvo in the same firing lane.', stats: { cooldown: 2450, pellets: 2, burstDelay: 170, burstArc: 0.13, damage: 56, explodeRadius: 164, explodeMult: 1.02, aoeBurn: false, rocketVisual: true } },
      { title: 'Rocket III', description: 'Three-missile salvo with concussive slow.', stats: { cooldown: 2850, pellets: 3, burstDelay: 160, burstArc: 0.15, damage: 50, explodeRadius: 178, explodeMult: 0.98, burn: 1000, aoeBurn: false, slow: 0.12, slowDuration: 720, rocketVisual: true } },
      { title: 'Rocket IV', description: 'Quad salvo: pew, pew, pew, pew.', stats: { cooldown: 3250, pellets: 4, burstDelay: 150, burstArc: 0.17, damage: 46, explodeRadius: 190, explodeMult: 0.98, burn: 1250, aoeBurn: false, stun: 95, rocketVisual: true } },
      { title: 'Rocket V', description: 'Eight-missile magazine. Big lane barrage, then long reload.', stats: { cooldown: 4200, pellets: 8, burstDelay: 110, burstArc: 0.20, bulletSpeed: 6.1, accel: 0.15, damage: 38, explodeRadius: 204, explodeMult: 0.92, burn: 1500, aoeBurn: false, slow: 0.14, slowDuration: 760, rocketVisual: true } }
    ]
  },

  {
    id: 'VOID',
    name: 'Void Orb',
    targeting: 'closest',
    color: '#c08bff',
    levels: [
      { title: 'Void I', description: 'Shoots out, stops, then grows into a pulling maelstrom.', stats: { cooldown: 900, bulletSpeed: 5.8, damage: 9, pellets: 1, spread: 0.04, width: 24, height: 24, pierce: 8, pull: 1.45, pullRadius: 210, vortexDps: 5, maxRange: 305, anchorOnMaxRange: true, lifeMs: 2550, singularity: false } },
      { title: 'Void II', description: 'Bigger maelstrom + stronger pull.', stats: { pull: 1.75, pullRadius: 245, width: 30, height: 30, damage: 10, vortexDps: 6, maxRange: 330 } },
      // Rank 3+: more vacuum + slow field
      { title: 'Void III', description: 'Anchored maelstrom lasts longer + slow field.', stats: { lifeMs: 2900, pull: 2.05, pullRadius: 285, vortexDps: 8, damage: 11, slow: 0.18, slowDuration: 650, maxRange: 350 } },
      { title: 'Void IV', description: 'Vortex slows harder + secondary orb.', stats: { pierce: 14, slow: 0.26, slowDuration: 900, pull: 2.35, split: 2 } },
      { title: 'Void V', description: 'Singularity maelstrom with implosion pop.', stats: { singularity: true, explodeRadius: 130, explodeMult: 0.55, pull: 2.70, pullRadius: 330, vortexDps: 10, maxRange: 385, lifeMs: 3200, stun: 100 } }
    ]
  },

  {
    id: 'TIME',
    name: 'Time Cannon',
    targeting: 'closest',
    color: '#7ff2d7',
    levels: [
      { title: 'Time I', description: 'Temporal slug: leaves a stasis scar that slows enemies crossing it.', stats: { cooldown: 880, bulletSpeed: 11.5, damage: 14, pellets: 1, spread: 0.02, width: 30, height: 11, pierce: 3, slow: 0.58, slowDuration: 1550, microFreeze: 130, timeBolt: true, timeScar: true, scarRadius: 92, scarMs: 1800 } },
      { title: 'Time II', description: 'Longer stasis scar and deeper slow.', stats: { cooldown: 820, damage: 16, pierce: 4, slow: 0.68, slowDuration: 1900, microFreeze: 165, scarRadius: 112, scarMs: 2100, timeBolt: true, timeScar: true } },
      { title: 'Time III', description: 'Forked chrono slug with visible time-ripple fields.', stats: { cooldown: 780, pellets: 2, spread: 0.10, damage: 15, explodeRadius: 62, explodeMult: 0.24, stun: 170, scarRadius: 132, scarMs: 2400, timeBolt: true, timeScar: true } },
      { title: 'Time IV', description: 'Temporal latch: bolts chain once and freeze longer.', stats: { cooldown: 720, chain: 1, damage: 16, slow: 0.76, slowDuration: 2500, microFreeze: 230, explodeRadius: 78, explodeMult: 0.30, scarRadius: 152, scarMs: 2850, timeBolt: true, timeScar: true } },
      { title: 'Time V', description: 'Chrono fracture: triple slugs that paint stasis lanes.', stats: { cooldown: 660, pellets: 3, spread: 0.16, chain: 2, damage: 15, stun: 320, slow: 0.82, slowDuration: 3100, explodeRadius: 96, explodeMult: 0.34, scarRadius: 174, scarMs: 3300, timeBolt: true, timeScar: true } }
    ]
  }
];

// -------------------- UPGRADES --------------------
const UPGRADES = [
  { id: 'REGEN', title: 'Nanite Regen', description: '+0.90 HP/sec (max 4)', apply: (s) => ({ ...s, regen: s.regen + 0.90, regenRank: Math.min(4, (s.regenRank || 0) + 1) }) },
  { id: 'MAX_HP', title: 'Reinforced Plating', description: '+30 Max HP', apply: (s) => ({ ...s, maxHp: s.maxHp + 30, hp: s.hp + 30 }) },
  { id: 'DAMAGE', title: 'Damage Boost', description: '+10% damage', apply: (s) => ({ ...s, damageMult: s.damageMult * 1.1 }) },
  { id: 'ATTACK_SPEED', title: 'Attack Speed', description: '+10% rate', apply: (s) => ({ ...s, attackSpeed: s.attackSpeed * 1.1 }) },
  { id: 'MOVE_SPEED', title: 'Kinetic Thrusters', description: '+8% move speed', apply: (s) => ({ ...s, moveSpeed: (s.moveSpeed || 1) * 1.08 }) }
];

// -------------------- EVENTS / PICKUPS --------------------
const EVENT_GHOST_WAVE = 'GHOST_WAVE';
const EVENT_ABOMINATION = 'ABOMINATION';
const EVENT_ELITE_WALL = 'ELITE_WALL';
const EVENT_PYLON = 'PYLON';
const EVENT_GRAB_GHOST = 'GRAB_GHOST';

const EVENT_DEFS = {
  SWARM: { id: 'SWARM', duration: 16000 },
  TINY_RAMS: { id: 'TINY_RAMS', duration: 12500 },
  WALL: { id: 'WALL', duration: 26000 },
  TURRET: { id: 'TURRET', duration: 17000 },
  SPLITTER: { id: 'SPLITTER', duration: 14500 },
  GHOST_WAVE: { id: EVENT_GHOST_WAVE, duration: 10000 },
  ABOMINATION: { id: EVENT_ABOMINATION, duration: 26000 },
  ELITE_WALL: { id: EVENT_ELITE_WALL, duration: 11000 },
  PYLON: { id: EVENT_PYLON, duration: 25000 },
  GRAB_GHOST: { id: EVENT_GRAB_GHOST, duration: 8500 },
  RELIEF: { id: 'RELIEF', duration: 5200 }
};

const PICKUP_DEFS = {
  MAGNET: { id: 'MAGNET', title: 'XP Magnet', life: 9200 },
  FREEZE: { id: 'FREEZE', title: 'Time Freeze', life: 3200 },
  OVERDRIVE: { id: 'OVERDRIVE', title: 'Overdrive', life: 8200 },
  DOUBLE_DAMAGE: { id: 'DOUBLE_DAMAGE', title: 'Double Damage', life: 9000 },
  LEVELUP: { id: 'LEVELUP', title: 'Level Core', life: 60000 }
};

// ---------- spawners ----------
const lateAddHpMultFromT = (t) => {
  if (t < 0.45) return 1.0;
  const late = norm01(t, 0.45, 1.0);
  return lerp(LATE_ADD_HP_MIN_MULT, LATE_ADD_HP_MAX_NERF_MULT, late); // 0.60 -> 0.40
};

const spawnEnemyBase = (difficulty, t = 0) => {
  const side = Math.floor(Math.random() * 4);
  const margin = 20;
  const edgeX = Math.random() * (ARENA_SIZE - margin * 2) + margin;
  const edgeY = Math.random() * (ARENA_SIZE - margin * 2) + margin;
  const x = side === 0 ? margin : side === 1 ? ARENA_SIZE - margin : edgeX;
  const y = side === 2 ? margin : side === 3 ? ARENA_SIZE - margin : edgeY;

  const baseScale = (0.9 + difficulty * 0.004);
  const diffHp = difficultyHpMult(difficulty);
  const trashHpMult = baseScale * TRASH_HP_MULT * lateAddHpMultFromT(t) * diffHp;
  const eliteHpMult = baseScale * ELITE_HP_MULT * diffHp;
  const hpRoll = (amount = 0.18) => 1 + (Math.random() * 2 - 1) * amount;

  const roll = Math.random();

  if (t > 0.16 && roll > 0.56 && roll <= 0.62) {
    const hp = Math.max(18, Math.round(62 * trashHpMult * hpRoll(0.18)));
    return {
      id: Math.random(),
      type: 'ghost',
      x,
      y,
      hp,
      maxHp: hp,
      speed: 1.65 + difficulty * 0.035,
      size: 28,
      xp: 18,
      contactDamage: 11,
      color: '#b8bcc8',
      revivedOnce: false
    };
  }

  if (t > 0.18 && roll > 0.955 && roll < 0.978) {
    const tier = t > 0.55 ? 4 : 3;
    const hp = Math.round((138 + difficulty * 22) * TRASH_HP_MULT * lateAddHpMultFromT(t) * diffHp * hpRoll(0.16));
    return { id: Math.random(), type: 'splitter', x, y, splitTier: tier, hp, maxHp: hp, speed: 0.76 + difficulty * 0.018, size: 58, xp: 19, contactDamage: 11, color: '#b6ff4a' };
  }

  if (t > 0.22 && roll > 0.885 && roll <= 0.905) {
    const hp = Math.round((70 + difficulty * 10) * TRASH_HP_MULT * lateAddHpMultFromT(t) * diffHp);
    return { id: Math.random(), type: 'spitter', x, y, hp, maxHp: hp, speed: 1.18 + difficulty * 0.025, size: 34, xp: 20, contactDamage: 9, color: '#64ff7a', nextSpitAt: Date.now() + 900 + Math.random() * 1000 };
  }

  if (t > 0.32 && roll > 0.905 && roll <= 0.920) {
    const hp = Math.round((720 + difficulty * 96) * ELITE_HP_MULT * diffHp);
    return { id: Math.random(), type: 'grab_ghost', x, y, hp: Math.round(hp * 5.95), maxHp: Math.round(hp * 5.95), speed: 2.42 + difficulty * 0.038, size: 64, xp: 120, contactDamage: 0, color: '#b9f2ff', grabUntil: 0 };
  }

  if (t > 0.42 && roll > 0.920 && roll <= 0.935) {
    const hp = Math.round((68 + difficulty * 9) * TRASH_HP_MULT * lateAddHpMultFromT(t) * diffHp);
    return { id: Math.random(), type: 'burrower', x, y, hp, maxHp: hp, speed: 1.35 + difficulty * 0.025, size: 32, xp: 24, contactDamage: 13, color: '#c08bff', nextBurrowAt: Date.now() + 1600 + Math.random() * 1400 };
  }

  // Late-game fairness: reduce elite frequency a bit after ~60% progress
  const eliteT = norm01(t, 0.60, 1.0);
  const jugThresh = 0.985 + eliteT * 0.010;   // 1.5% -> ~0.5%
  const bruteThresh = 0.92 + eliteT * 0.040;  // 8% -> ~4%

  // Rare juggernaut (~1.5%): immune to slow/stun/knockback/pull
  if (roll > jugThresh) {
    const base = 1100;
    const hp = Math.round(base * eliteHpMult * (1 + difficulty * 0.10));
    return { id: Math.random(), type: 'juggernaut', x, y, hp, maxHp: hp, speed: 0.88 + difficulty * 0.02, size: 100, xp: 42, contactDamage: 22, color: '#ff3b3b' };
  }
  if (roll > bruteThresh) {
    const base = 120;
    const hp = Math.round(base * eliteHpMult);
    return { id: Math.random(), type: 'brute', x, y, hp, maxHp: hp, speed: 1.1 + difficulty * 0.04, size: 52, xp: 26, contactDamage: 16, color: '#ff6b6b' };
  }
  if (roll > 0.7) {
    const base = 30;
   const hp = Math.max(8, Math.round(base * trashHpMult * hpRoll(0.22)));
    return { id: Math.random(), type: 'sprinter', x, y, hp, maxHp: hp, speed: 3.1 + difficulty * 0.1, size: 22, xp: 13, contactDamage: 10, color: '#ff2fd2' };
  }
  if (roll > 0.62) {
    const base = 42;
    const hp = Math.max(10, Math.round(base * trashHpMult * hpRoll(0.20)));
    return {
      id: Math.random(),
      type: 'dancer',
      x,
      y,
      hp,
      maxHp: hp,
      speed: 2.25 + difficulty * 0.05,
      size: 24,
      xp: 18,
      contactDamage: 13,
      color: '#ff774a',
      circleDir: Math.random() < 0.5 ? -1 : 1,
      circleUntil: Date.now() + 1400 + Math.random() * 850,
      diveUntil: 0,
      nextDiveAt: Date.now() + 1600 + Math.random() * 900
    };
  }
  const base = 55;
  const hp = Math.max(12, Math.round(base * trashHpMult * hpRoll(0.22)));
  return { id: Math.random(), type: 'grunt', x, y, hp, maxHp: hp, speed: 1.9 + difficulty * 0.06, size: 28, xp: 14, contactDamage: 12, color: '#ff007a' };
};

const spawnEnemy = (difficulty, forcedType = null, t = 0) => {
  if (!forcedType) return spawnEnemyBase(difficulty, t);

  const base = spawnEnemyBase(difficulty, t);
  const diffHp = difficultyHpMult(difficulty);

  if (forcedType === 'swarm') {
    const late = norm01(t, 0.45, 1.0);
    const hp = Math.round((12 + difficulty * 2.1) * TRASH_HP_MULT * lerp(1.0, 1.18, late) * diffHp);
    return { ...base, type: 'swarm', hp, maxHp: hp, speed: 2.15 + difficulty * 0.05, size: 17, xp: 3, contactDamage: 5, color: '#ff4aa8' };
  }
  if (forcedType === 'wall') {
    // WALL units are intentionally chunky; still respect late adds HP nerf
    const addHpMult = lateAddHpMultFromT(t);
    const hp = Math.round((((320 + difficulty * 26) * (1 + difficulty * 0.06)) * TRASH_HP_MULT * addHpMult) * WALL_HP_MULT * diffHp);
    return { ...base, type: 'wall', hp, maxHp: hp, speed: 0.70 + difficulty * 0.01, size: 46, xp: 9, contactDamage: 0, blocksPlayer: true, color: '#ff2a4b' };
  }
  if (forcedType === 'turret') {
    const hp = Math.round((520 + difficulty * 80) * ELITE_HP_MULT * diffHp);
    return { ...base, type: 'turret', hp, maxHp: hp, speed: 0, size: 72, xp: 70, contactDamage: 10, color: '#ffb84a', nextShotAt: Date.now() + 950 + Math.random() * 900 };
  }
  if (forcedType === 'splitter') {
    const tier = 4;
    const hp = Math.round((190 + difficulty * 28) * TRASH_HP_MULT * lateAddHpMultFromT(t) * diffHp);
    return { ...base, type: 'splitter', splitTier: tier, hp, maxHp: hp, speed: 0.78 + difficulty * 0.022, size: 66, xp: 26, contactDamage: 13, color: '#b6ff4a' };
  }
  if (forcedType === 'splitter_boss') {
    const tier = 7;
    const hp = Math.round((2150 + difficulty * 320) * ELITE_HP_MULT * diffHp);
    return { ...base, type: 'splitter_boss', splitTier: tier, hp, maxHp: hp, speed: 0.54 + difficulty * 0.010, size: 148, xp: 360, contactDamage: 28, color: '#7dff4a' };
  }
  if (forcedType === 'ghost') {
    const hp = Math.round((48 + difficulty * 7) * TRASH_HP_MULT * diffHp);
    return { ...base, type: 'ghost', hp, maxHp: hp, speed: 2.05 + difficulty * 0.04, size: 30, xp: 15, contactDamage: 10, color: '#c6cad6', revivedOnce: false };
  }
  if (forcedType === 'spitter') {
    const hp = Math.round((85 + difficulty * 12) * TRASH_HP_MULT * lateAddHpMultFromT(t) * diffHp);
    return { ...base, type: 'spitter', hp, maxHp: hp, speed: 1.18 + difficulty * 0.025, size: 34, xp: 20, contactDamage: 9, color: '#64ff7a', nextSpitAt: Date.now() + 800 + Math.random() * 900 };
  }
  if (forcedType === 'grab_ghost') {
    const hp = Math.round((980 + difficulty * 135) * ELITE_HP_MULT * diffHp);
    return { ...base, type: 'grab_ghost', hp: Math.round(hp * 5.95), maxHp: Math.round(hp * 5.95), speed: 2.50 + difficulty * 0.040, size: 66, xp: 140, contactDamage: 0, color: '#b9f2ff', grabUntil: 0 };
  }
  if (forcedType === 'burrower') {
    const hp = Math.round((78 + difficulty * 10) * TRASH_HP_MULT * lateAddHpMultFromT(t) * diffHp);
    return { ...base, type: 'burrower', hp, maxHp: hp, speed: 1.35 + difficulty * 0.025, size: 32, xp: 24, contactDamage: 13, color: '#c08bff', nextBurrowAt: Date.now() + 1600 + Math.random() * 1400 };
  }
  if (forcedType === 'pylon') {
    const hp = Math.round((6750 + difficulty * 1150) * ELITE_HP_MULT * diffHp);
    return {
      ...base,
      type: 'pylon',
      hp,
      maxHp: hp,
      speed: 0,
      size: 112,
      xp: 240,
      contactDamage: 0,
      color: '#7ff2d7',
      pylonStartedAt: Date.now(),
      pylonChargeMs: 42000,
      pylonAbsorbed: 0,
      pylonPullRadius: 680,
      pylonMonster: false
    };
  }
  if (forcedType === 'merge_brute') {
    const hp = Math.round((1400 + difficulty * 260) * ELITE_HP_MULT * diffHp);
    return { ...base, type: 'merge_brute', hp, maxHp: hp, speed: 1.05, size: 96, xp: 160, contactDamage: 24, color: '#83ff76', mergeGroup: true };
  }
  if (forcedType === 'lane_elite') {
    const hp = Math.round((420 + difficulty * 80) * ELITE_HP_MULT * diffHp);
    return { ...base, type: 'lane_elite', hp, maxHp: hp, speed: 2.20, size: 58, xp: 34, contactDamage: 18, color: '#ffb36b', laneDir: 1 };
  }
  return base;
};

// FIX: allow explicit spawn position so RAM chargers don’t stack/clamp into the same spot
const spawnMiniBoss = (player, difficulty, kind = 'charger', pos = null) => {
  const baseHp =
    (kind === 'charger' ? 4000 : 1400) +
    difficulty * (kind === 'charger' ? 360 : 160);

  const hp = Math.round(baseHp * MINI_HP_MULT * (kind === 'charger' ? RAM_HP_MULT : 1.0) * difficultyHpMult(difficulty));
  const tileD = tileDifficultyRank(difficulty);
  const tunedHp = Math.round(hp * (tileD <= 1 ? 0.36 : tileD === 2 ? 0.55 : 0.72));

  const spawnX = pos?.x ?? Math.min(Math.max(player.x + 460, 120), ARENA_SIZE - 120);
  const spawnY = pos?.y ?? Math.min(Math.max(player.y - 380, 120), ARENA_SIZE - 120);

  const base = {
    id: `mini_${kind}_${Math.random()}`,
    type: `mini_${kind}`,
    x: spawnX,
    y: spawnY,
    hp: tunedHp,
    maxHp: tunedHp,
    speed: kind === 'assassin' ? 2.75 : 2.15,
    size: kind === 'charger' ? 96 : 92,
    xp: kind === 'charger' ? 90 : 140,
    contactDamage: kind === 'charger' ? 22 : 22,
    color: kind === 'assassin' ? '#c9ff6b' : '#ffda6b'
  };

  if (kind === 'charger') {
    const stagger = Math.random() * 1000;
    return {
      ...base,
      dashCd: 2500 + Math.random() * 900, dashWindup: 760 + Math.random() * 420, dashMs: 860, dashSpd: 12.5,
      dashUntil: 0, windupUntil: 0, dashDir: 0,
      nextDashAt: Date.now() + 950 + stagger,
      chargeSequenceLeft: 7,
      damageReductionUntil: Date.now() + 1700, damageReductionMult: 0.40
    };
  }
  // assassin: short teleports if you stand still
  return { ...base, blinkCd: 1600, blinkUntil: 0, damageReductionUntil: Date.now() + 650, damageReductionMult: 0.70 };
};

const spawnTinyRamsPack = (player, difficulty, count) => {
  const out = [];
  const radius = 620;
  const margin = 150;
  const cx = clamp(player.x, radius + margin, ARENA_SIZE - (radius + margin));
  const cy = clamp(player.y, radius + margin, ARENA_SIZE - (radius + margin));
  const base = Math.random() * Math.PI * 2;
  for (let i = 0; i < count; i += 1) {
    const a = base + (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.18;
    const ram = spawnMiniBoss(player, difficulty, 'charger', {
      x: cx + Math.cos(a) * radius,
      y: cy + Math.sin(a) * radius
    });
    const hp = Math.max(38, Math.round((52 + difficulty * 8) * TRASH_HP_MULT * difficultyHpMult(difficulty)));
    out.push({
      ...ram,
      id: `tiny_ram_${Math.random()}`,
      type: 'tiny_ram',
      hp,
      maxHp: hp,
      size: 42,
      speed: 2.35 + difficulty * 0.025,
      xp: 16,
      contactDamage: 10,
      color: '#ffd46b',
      dashCd: 3200 + Math.random() * 800,
      dashWindup: 560 + Math.random() * 260,
      dashMs: 520,
      dashSpd: 8.5,
      nextDashAt: Date.now() + 900 + Math.random() * 1400,
      chargeSequenceLeft: 1,
      damageReductionUntil: 0,
      damageReductionMult: 1
    });
  }
  return out;
};

// FIX: keep the ring fully in-bounds so clamp doesn’t collapse multiple spawns into the same edge pixels
const spawnRamsRing = (player, difficulty, count) => {
  const out = [];
  const radius = 520;
  const margin = 140;

  const cx = clamp(player.x, radius + margin, ARENA_SIZE - (radius + margin));
  const cy = clamp(player.y, radius + margin, ARENA_SIZE - (radius + margin));

  const base = Math.random() * Math.PI * 2;
  for (let i = 0; i < count; i += 1) {
    const a = base + (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.10; // less jitter = less overlap
    const x = cx + Math.cos(a) * radius;
    const y = cy + Math.sin(a) * radius;
    out.push(spawnMiniBoss(player, difficulty, 'charger', { x, y }));
  }
  return out;
};

const spawnAssassinsRing = (player, difficulty, count) => {
  const out = [];
  const radius = 560;
  const margin = 180;

  const cx = clamp(player.x, radius + margin, ARENA_SIZE - (radius + margin));
  const cy = clamp(player.y, radius + margin, ARENA_SIZE - (radius + margin));

  const base = Math.random() * Math.PI * 2;
  for (let i = 0; i < count; i += 1) {
    const a = base + (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.14;
    const x = cx + Math.cos(a) * radius;
    const y = cy + Math.sin(a) * radius;
    out.push(spawnMiniBoss(player, difficulty, 'assassin', { x, y }));
  }
  return out;
};

const spawnWallRing = (pp, difficulty, meta, t = 0) => {
  const ringN = meta.ringN ?? 30;
  const radiusStart = meta.radiusStart ?? 2000;
  const encroachSpeed = meta.encroachSpeed ?? 1.5;
  const minRadius = meta.minRadius ?? 10;
  const hpMult = meta.hpMult ?? 1.0;
  const size = meta.size ?? 52;

  const baseRot = Math.random() * Math.PI * 2;
  const out = [];

  for (let i = 0; i < ringN; i++) {
    const a = baseRot + (i / ringN) * Math.PI * 2;

    const enBase = spawnEnemy(difficulty, 'wall', t);
    const hp = Math.round(enBase.maxHp * hpMult);

    const x = clamp(pp.x + Math.cos(a) * radiusStart, -160, ARENA_SIZE + 160);
    const y = clamp(pp.y + Math.sin(a) * radiusStart, -160, ARENA_SIZE + 160);

    out.push({
      ...enBase,
      hp,
      maxHp: hp,
      size,
      x,
      y,
      wallA: a,
      wallR: radiusStart,
      wallEncroach: encroachSpeed,
      wallMinR: minRadius,
      wallCx: pp.x,
      wallCy: pp.y,
      wallArrivedAt: 0
    });
  }

  return out;
};

const spawnWallSweep = (pp, difficulty, meta, t = 0) => {
  const fromLeft = meta.fromLeft ?? Math.random() < 0.5;
  const count = meta.count ?? 38;
  const size = meta.size ?? 74;
  const hpMult = meta.hpMult ?? 1.0;
  const step = ARENA_SIZE / (count - 1);
  const x = fromLeft ? 44 : ARENA_SIZE - 44;
  const out = [];
  for (let i = 0; i < count; i += 1) {
    const enBase = spawnEnemy(difficulty, 'wall', t);
    const hp = Math.round(enBase.maxHp * hpMult);
    out.push({
      ...enBase,
      id: `wall_sweep_${i}_${Math.random()}`,
      hp,
      maxHp: hp,
      size,
      x,
      y: clamp(i * step, 22, ARENA_SIZE - 22),
      laneDir: fromLeft ? 1 : -1,
      speed: meta.speed ?? 0.82,
      sweepArrivedAt: 0,
      contactDamage: 0,
      blocksPlayer: true,
      color: '#ff3154'
    });
  }
  return out;
};

const spawnBoss = (player, difficulty, opts = {}) => {
  const finalBoost = opts.finalForm ? 1.22 : 1;
  const milestoneBoost = opts.milestonePct && opts.milestonePct < 1 ? 0.78 + opts.milestonePct * 0.34 : 1;
  const tileD = tileDifficultyRank(opts.tileDifficulty || difficulty);
  const bossTileMult = tileD <= 1 ? 0.44 : tileD === 2 ? (opts.isFinalBoss ? 0.36 : 0.64) : tileD === 3 ? 0.96 : 1.08;
  const hp = Math.round((5400 + difficulty * 220) * BOSS_HP_MULT * difficultyHpMult(difficulty) * finalBoost * milestoneBoost * (opts.hpMult || 1) * bossTileMult);
  const sizeMult = opts.sizeMult || (opts.finalForm ? 1.18 : 1);
  return {
    id: opts.id || `boss_${Date.now()}_${Math.random()}`,
    type: 'boss',
    x: Math.min(Math.max(player.x + 380, 140), ARENA_SIZE - 140),
    y: Math.min(Math.max(player.y - 320, 140), ARENA_SIZE - 140),
    hp,
    maxHp: hp,
    speed: 1.6 + difficulty * 0.03,
    nextRamPct: 0.82,
    chargesDone: 0,
    split50Done: false,
    split20Done: false,
    bossPhase: 'main',
    originalMaxHp: hp,
    ramPhaseDone: false,
    zergPhaseDone: false,
    isFinalBoss: !!opts.isFinalBoss,
    milestonePct: opts.milestonePct || 1,
    cloneMult: opts.cloneMult || (tileDifficultyRank(difficulty) >= 5 ? 2.2 : 1.6),
    size: Math.round(150 * sizeMult),
    xp: 520,
    contactDamage: Math.round(34 * (opts.finalForm ? 1.15 : 1)),
    color: opts.finalForm ? '#ffb13b' : '#ffda6b',
    phase: 1,
    nextAddAt: Date.now() + 1400,
    nextAoEAt: Date.now() + 2200
  };
};

const buildWeaponStats = (weapon, level) =>
  weapon.levels.slice(0, level).reduce((acc, entry) => ({ ...acc, ...entry.stats }), {});

// ---------- orb merge + clustering ----------
const ORB_TIERS = [
  { min: 0, color: '#00ff88', r: 6.0, ring: false },
  { min: 20, color: '#00f2ff', r: 7.2, ring: false },
  { min: 55, color: '#bf00ff', r: 9.0, ring: false },
  { min: 120, color: '#ff007a', r: 11.0, ring: true },
  { min: 220, color: '#ffae00', r: 13.0, ring: true },
  { min: 360, color: '#ffe16b', r: 15.8, ring: true },
  { min: 560, color: '#ffffff', r: 20.8, ring: true },
  { min: 820, color: '#7cffd9', r: 22.2, ring: true },
  { min: 1200, color: '#ff6bff', r: 30.0, ring: true }
];

const orbRankFromValue = (v) => {
  for (let i = ORB_TIERS.length - 1; i >= 0; i -= 1) {
    if (v >= ORB_TIERS[i].min) return i;
  }
  return 0;
};

const orbVisualFromValue = (v) => {
  const rank = orbRankFromValue(v);
  const t = ORB_TIERS[rank] || ORB_TIERS[0];
  return { rank, color: t.color, r: t.r, ring: !!t.ring };
};

const mergeOrbs = (orbs) => {
  const input = Array.isArray(orbs) && orbs.length > PERF_ORB_SOFT_CAP
    ? [...orbs]
        .sort((a, b) => (b.value || 0) - (a.value || 0))
        .slice(0, PERF_ORB_SOFT_CAP)
    : (orbs || []);
  const merged = [];
  const mergeDist = 36; // more merging = fewer pickups
  const mergeDist2 = mergeDist * mergeDist;
  const cell = mergeDist;
  const buckets = new Map();

  input.forEach((o) => {
    const cx = Math.floor(o.x / cell);
    const cy = Math.floor(o.y / cell);
    let target = null;
    for (let gx = cx - 1; gx <= cx + 1 && !target; gx += 1) {
      for (let gy = cy - 1; gy <= cy + 1 && !target; gy += 1) {
        const bucket = buckets.get(`${gx}:${gy}`) || [];
        for (const idx of bucket) {
          const m = merged[idx];
          const dx = m.x - o.x;
          const dy = m.y - o.y;
          if (dx * dx + dy * dy < mergeDist2) {
            target = m;
            break;
          }
        }
      }
    }
    if (target) {
      target.value += o.value;
      target.x = (target.x + o.x) / 2;
      target.y = (target.y + o.y) / 2;
    } else {
      const idx = merged.length;
      merged.push({ ...o });
      const key = `${cx}:${cy}`;
      const bucket = buckets.get(key) || [];
      bucket.push(idx);
      buckets.set(key, bucket);
    }
  });

  // FPS-safe: compute tier/radius/color only on spawn/merge
  return merged.map((o) => {
    const vis = orbVisualFromValue(o.value);
    return { ...o, ...vis };
  });
};

// ---------- upgrades: guarantee 3 distinct guns early, then bias toward upgrading ----------
const rollUpgradeOptions = (ownedWeapons, weaponLevels, stats, maxWeapons = DEFAULT_WEAPON_CAP) => {
  const MAX_GUNS = maxWeapons;
  const canAddWeapon = ownedWeapons.length < MAX_GUNS;

  const unowned = WEAPONS.filter((w) => !ownedWeapons.includes(w.id));
  const want3GunsFast = ownedWeapons.length < 3;

  const candidates = [];

  const push = (opt, weight = 1) => {
    const key = opt.key || opt.id;
    candidates.push({ ...opt, key, weight });
  };

  if (canAddWeapon && unowned.length) {
    const weaponChance = want3GunsFast ? 1.0 : ownedWeapons.length === 3 ? 0.12 : 0.18;
    if (Math.random() < weaponChance) {
      unowned.forEach((w) => {
        push(
          {
            id: `WEAPON_${w.id}`,
            key: `WEAPON_${w.id}`,
            title: `New Weapon: ${w.name}`,
            description: ownedWeapons.length >= 3 ? `Adds final weapon slot (cap ${MAX_GUNS})` : 'Adds another weapon to your loadout',
            weaponId: w.id,
            apply: (s) => ({ ...s })
          },
          want3GunsFast ? 6 : 2
        );
      });
    }
  }

  ownedWeapons.forEach((id) => {
    const level = weaponLevels[id] || 1;
    if (level < 5) {
      const weapon = WEAPONS.find((w) => w.id === id);
      const nextLevel = level + 1;
      const weight = want3GunsFast ? 2 : level === 1 ? 4 : level === 2 ? 5 : 6;

      push(
        {
          id: `UP_${id}_${nextLevel}`,
          key: `UP_${id}_${nextLevel}`,
          title: `${weapon.name} Level ${nextLevel}`,
          description: weapon.levels[nextLevel - 1].description,
          weaponId: id,
          upgradeLevel: nextLevel,
          apply: (s) => ({ ...s })
        },
        weight
      );
    }
  });

  UPGRADES.forEach((u) => {
    if (u.id === 'REGEN' && (stats.regenRank || 0) >= 4) return;
    push(
      { ...u, key: u.id },
      want3GunsFast ? 1 : 2
    );
  });

  const picked = [];
  const used = new Set();

  const takeWeighted = () => {
    const pool = candidates.filter((c) => !used.has(c.key));
    if (!pool.length) return null;
    const total = pool.reduce((acc, c) => acc + (c.weight || 1), 0);
    let r = Math.random() * total;
    for (const c of pool) {
      r -= (c.weight || 1);
      if (r <= 0) return c;
    }
    return pool[pool.length - 1];
  };

  if (want3GunsFast && canAddWeapon && unowned.length) {
    const w = unowned[Math.floor(Math.random() * unowned.length)];
    picked.push({
      id: `WEAPON_${w.id}`,
      title: `New Weapon: ${w.name}`,
      description: ownedWeapons.length >= 3 ? `Adds final weapon slot (cap ${MAX_GUNS})` : 'Adds another weapon to your loadout',
      weaponId: w.id,
      apply: (s) => ({ ...s })
    });
    used.add(`WEAPON_${w.id}`);
  }

  while (picked.length < 3) {
    const c = takeWeighted();
    if (!c) break;
    used.add(c.key);
    picked.push(c);
  }

  while (picked.length < 3) {
    picked.push({ id: 'HEAL', title: 'Repair Kit', description: 'Restore 40 HP', apply: (s) => ({ ...s, hp: Math.min(s.maxHp, s.hp + 40) }) });
  }

  return picked.map((o) => {
    const { weight, key, ...rest } = o;
    return { ...rest, statsSnapshot: stats };
  });
};

export default function Combat({ crew, onExit, onVictory, tileDifficulty = 1, selectedHero, runBuild, runTimeMs, requiresExtraction = false, playerName = '' }) {


  const progElapsedRef = useRef(0); // progression clock (pauses during events)
  const [player, setPlayer] = useState({ x: 1400, y: 1400 });
  const [stats, setStats] = useState(() => {
    // --- baseline stats, then apply Military talent start bonuses ---
    const base = { hp: 120, maxHp: 120, regen: 0, regenRank: 0, damageMult: 1, attackSpeed: 1, moveSpeed: 1 };
    const p = (runBuild && runBuild.purchased) ? runBuild.purchased : {};
    const fieldArmorRank = Number(p.MIL_FIELD_ARMOR || 0);
    const maxHpBonus = fieldArmorRank * 25; // +25 max HP per rank (5 ranks = +60)
    return { ...base, hp: base.hp + maxHpBonus, maxHp: base.maxHp + maxHpBonus };
  });
  const cameraRef = useRef({ x: 0, y: 0 });
  const worldRef = useRef(null);
  const playerSpriteRef = useRef(null);
  const playerTracerRef = useRef(null);
  const canvasRef = useRef(null);
  const dragMoveRef = useRef({
    active: false,
    pointerId: null,
    startX: 0,
    startY: 0,
    vecX: 0,
    vecY: 0
  });

  const ctxRef = useRef(null);
  const [enemies, setEnemies] = useState([]);
  const [bullets, setBullets] = useState([]);
  const [beams, setBeams] = useState([]); // LASER beams
  const [railLines, setRailLines] = useState([]); // SNIPER tear visuals
  const [slashes, setSlashes] = useState([]);
  const [arcs, setArcs] = useState([]);
  const [explosions, setExplosions] = useState([]);
  const [orbs, setOrbs] = useState([]);
  const [pickups, setPickups] = useState([]);
  const enemyProjectilesRef = useRef([]);

  // Lightweight "expired" popups for buffs/pickups (Danish clarity request)
  const [toasts, setToasts] = useState([]);
  const pushToast = (text) => {
    const id = (crypto?.randomUUID?.() ?? Math.random().toString(16).slice(2));
    const until = Date.now() + 1700;
    setToasts((prev) => [...(prev || []).filter((t) => (t.until || 0) > Date.now()), { id, text, until }]);
  };
  const addToast = pushToast;
  const prevBuffsRef = useRef({});

  const [selectedWeapons, setSelectedWeapons] = useState([]);
  const [weaponLevels, setWeaponLevels] = useState({});
  const [xp, setXp] = useState(0);
  const [xpTarget, setXpTarget] = useState(78);
  const [level, setLevel] = useState(1);
  const [upgradeOptions, setUpgradeOptions] = useState([]);
  const [bossSpawned, setBossSpawned] = useState(false);
  const [extractionUI, setExtractionUI] = useState({ active: false, progress: 0, x: 0, y: 0 });
  const [matchSummary, setMatchSummary] = useState(null);
  const [victory, setVictory] = useState(false);
  const [defeat, setDefeat] = useState(false);
  const [progress, setProgress] = useState(0);
  const hitFxRef = useRef({});
  const deathFxRef = useRef([]);
  const keys = useRef({});
  const lastFire = useRef({});
  const lastSpawn = useRef(0);
  const elapsed = useRef(0);
  const lastDamage = useRef(0);

  // -------------------- MILITARY TALENTS (Left Tree) --------------------
  // runBuild?.purchased contains ranks keyed by MIL_* ids from GalaxyShop.
  const talentsRef = useRef({
    thornsUnlocked: false,
    thornsDurationMs: 5600,
    thornsCooldownMs: 15000,
    thornsRamDamage: 34,
    quickRearmRank: 0,

    fieldArmorRank: 0,
    plateCarrierRank: 0,
    damageReduction: 0,

    ghostRank: 0,
    ghostCooldownMs: 60000,
    ghostRadius: 240,
    ghostDamage: 60,

    adrenalUnlocked: false,
    katanaBackup: false,
    discharge: false,

    titaniumRank: 0,
    platesMax: 0,

    activeSpaceAbility: null,
    onboardProduction: false,
    decoyUnlocked: false,
    deployTurretUnlocked: false,
    extraWeaponSlot: false,
    turretDetonate: false,
    turretBomb: false,
    turretFortify: false,
    turretFlamePillar: false,
    combustion: false,
    gravPickup: false,
    droneOrbit: false,
    slowPulse: false,
  });

  const thornsActiveUntilRef = useRef(0);
  const thornsCooldownUntilRef = useRef(0);
  const thornsWasActiveRef = useRef(false);
  const spaceWasDownRef = useRef(false);
  const abilityWasDownRef = useRef({ one: false, two: false });

  const milGhostCdUntilRef = useRef(0);
  const milAdrenalCdUntilRef = useRef(0);
  const milAdrenalMoveUntilRef = useRef(0);

  const platesStacksRef = useRef(0);
  const platesLastGenAtRef = useRef(Date.now());
  const axeComboRef = useRef(0);
  const killCountRef = useRef(0);
  const killsByTypeRef = useRef({});
  const damageTakenRef = useRef(0);
  const damageDealtRef = useRef(0);
  const damageSourcesRef = useRef({});
  const decoyRef = useRef(null);
  const decoyCooldownUntilRef = useRef(0);
  const playerTurretCooldownUntilRef = useRef(0);
  const playerTurretsRef = useRef([]);
  const playerGrabRef = useRef(null);
  const grabGhostsSpawnedRef = useRef(0);
  const pylonSpawnedRef = useRef(false);
  const playerBombsRef = useRef([]);
  const fleetNextAtRef = useRef(Date.now() + 40000);
  const fleetUntilRef = useRef(0);
  const droneNextAtRef = useRef(Date.now() + 60000);
  const droneUntilRef = useRef(0);
  const droneLastFireRef = useRef(0);
  const droneBurstToastRef = useRef(0);
  const slowPulseNextAtRef = useRef(Date.now() + 20000);
  const bossReturnPendingRef = useRef([]);
  const bossMilestoneIdxRef = useRef(0);
  const combustionNextAtRef = useRef(0);
  const pendingUpgradeCountRef = useRef(0);
  const extractionRef = useRef({ active: false, progress: 0, x: 0, y: 0 });
  const timelineRef = useRef([]);
  const matchStartedAtRef = useRef(0);

  useEffect(() => {
    const p = (runBuild && runBuild.purchased) ? runBuild.purchased : {};

    const thornsUnlocked = Number(p.MIL_THORNS || 0) > 0;
    const quickRearmRank = Number(p.MIL_QUICK_REARM || 0);

    const fieldArmorRank = Number(p.MIL_FIELD_ARMOR || 0);
    const plateCarrierRank = Number(p.MIL_PLATE_CARRIER || 0);
    const damageReduction = clamp(plateCarrierRank * 0.07, 0, 0.35); // 7% per rank, max 35%

    const ghostRank = Number(p.MIL_GHOST_PROTOCOL || 0);
    const ghostCooldownMs = ghostRank > 0 ? Math.max(18000, Math.round((60000 - (ghostRank - 1) * 8000) * 0.70)) : 999999999;
    const ghostRadius = 210 + ghostRank * 10;
    const ghostDamage = 34 + ghostRank * 14;

    const adrenalUnlocked = Number(p.MIL_ADRENAL || 0) > 0;
    const katanaBackup = Number(p.MIL_KATANA_BACKUP || 0) > 0;
    const discharge = Number(p.MIL_THRONS_DISCHARGE || 0) > 0;

    const titaniumRank = Number(p.MIL_TITANIUM_PLATES || 0);
    const platesMax = clamp(titaniumRank, 0, 3);
    talentsRef.current = {
      thornsUnlocked,
      thornsDurationMs: (2800 + quickRearmRank * 600) * 2,
      thornsCooldownMs: Math.max(10000, 25000 - quickRearmRank * 3500),
      thornsRamDamage: (58 + tileDifficulty * 8) * 1.55,
      quickRearmRank,

      fieldArmorRank,
      plateCarrierRank,
      damageReduction,

      ghostRank,
      ghostCooldownMs,
      ghostRadius,
      ghostDamage,

      adrenalUnlocked,
      katanaBackup,
      discharge,

      titaniumRank,
      platesMax,

      onboardProduction: Number(p.RES_ONBOARD_PROD || 0) > 0,
      decoyUnlocked: Number(p.RES_DECOY_HOLO || 0) > 0,
      deployTurretUnlocked: Number(p.ENG_DEPLOY_TURRET || 0) > 0,
      extraWeaponSlot: Number(p.ENG_EXTRA_WEAPON || 0) > 0,
      turretDetonate: Number(p.ENG_TURRET_DETONATE || 0) > 0,
      turretBomb: Number(p.ENG_TURRET_BOMB || 0) > 0,
      turretFortify: Number(p.ENG_TURRET_FORTIFY || 0) > 0,
      turretFlamePillar: Number(p.ENG_TURRET_FLAME || 0) > 0,
      combustion: Number(p.RES_COMBUSTION || 0) > 0,
      gravPickup: Number(p.RES_GRAV_PICKUP || 0) > 0,
      droneOrbit: Number(p.RES_DRONE_ORBIT || 0) > 0 || Number(p.RES_FLEET_ASSIST || 0) > 0,
      slowPulse: Number(p.RES_SLOW_PULSE || 0) > 0,
    };

    // reset per-combat talent runtime state
    thornsActiveUntilRef.current = 0;
    thornsCooldownUntilRef.current = 0;
    thornsWasActiveRef.current = false;
    spaceWasDownRef.current = false;

    milGhostCdUntilRef.current = 0;
    milAdrenalCdUntilRef.current = 0;
    milAdrenalMoveUntilRef.current = 0;

    platesStacksRef.current = 0;
    platesLastGenAtRef.current = Date.now();
    axeComboRef.current = 0;
    killCountRef.current = 0;
    killsByTypeRef.current = {};
    damageTakenRef.current = 0;
    damageDealtRef.current = 0;
    damageSourcesRef.current = {};
    combustionNextAtRef.current = 0;
    decoyRef.current = null;
    decoyCooldownUntilRef.current = 0;
    playerTurretCooldownUntilRef.current = 0;
    playerTurretsRef.current = [];
    playerBombsRef.current = [];
    playerBombsRef.current = [];
    fleetNextAtRef.current = 9999999999999;
    fleetUntilRef.current = 0;
    droneNextAtRef.current = Date.now() + 4500;
    droneUntilRef.current = 0;
    droneLastFireRef.current = 0;
    droneBurstToastRef.current = 0;
    slowPulseNextAtRef.current = Date.now() + 20000;
    bossReturnPendingRef.current = [];
  }, [runBuild, tileDifficulty]);

  // per-run duration (random 25–100% longer)
    const runTimeRef = useRef(runTimeMs || (BOSS_TIME * (0.38 + Math.random() * 0.17) * (tileDifficultyRank(tileDifficulty) <= 2 ? 1.6 : 1)));

  // BEAT PLAN: randomized sequence each run (matches desired arc)
  const beatPlanRef = useRef({ ready: false, idx: 0, beats: [] });
  const randomSwarmCooldownUntilRef = useRef(0);

  // relief bookkeeping
  const reliefWasActiveRef = useRef(false);

  // SMG: every 5th bullet pierces 1
  const smgCounter = useRef(0);

  // hitstop + chroma/punch
  const hitstopUntil = useRef(0);
  const juice = useRef({ chroma: 0, punch: 0 });

  // scripted map beats
  const flagsRef = useRef({ reliefLock: false });
  const activeEventRef = useRef(null); // {id, endsAt, meta}
  const reliefUntilRef = useRef(0);
  const reliefStartedAtRef = useRef(0);
  const eventCooldownUntilRef = useRef(0);
  const progressLastSyncRef = useRef(0);

  // power pickups
  const magnetUntil = useRef(0);
  const freezeUntil = useRef(0);
  const overdriveUntil = useRef(0);
  const shieldUntil = useRef(0);
  const doubleDamageUntil = useRef(0);

  const selectingWeapon = selectedWeapons.length === 0;
  const liveUpgradeSelect = false;
  const paused = selectingWeapon || upgradeOptions.length > 0 || victory || defeat;

  const pausedRef = useRef(paused);
  const pauseStartedAtRef = useRef(0);
  const playerRef = useRef(player);
  const statsRef = useRef(stats);
  const enemiesRef = useRef(enemies);
  const bulletsRef = useRef(bullets);
  const beamsRef = useRef(beams);
  const railLinesRef = useRef(railLines);
  const slashesRef = useRef(slashes);
  const arcsRef = useRef(arcs);
  const explosionsRef = useRef(explosions);
  const orbsRef = useRef(orbs);
  const pickupsRef = useRef(pickups);
  const xpRef = useRef(xp);
  const xpTargetRef = useRef(xpTarget);
  const selectedWeaponsRef = useRef(selectedWeapons);
  const weaponLevelsRef = useRef(weaponLevels);
  const upgradeOptionsRef = useRef(upgradeOptions);
  const bossSpawnedRef = useRef(bossSpawned);

  // Perf: keep simulation values in refs; sync React UI at low Hz
  const levelRef = useRef(level);
  const uiLastSyncRef = useRef(0);

  useEffect(() => {
    const now = Date.now();
    if (paused && !pausedRef.current) {
      pauseStartedAtRef.current = now;
    } else if (!paused && pausedRef.current && pauseStartedAtRef.current) {
      const delta = now - pauseStartedAtRef.current;
      const bump = (ref) => { if (ref.current && ref.current > pauseStartedAtRef.current) ref.current += delta; };
      [
        thornsActiveUntilRef,
        thornsCooldownUntilRef,
        milGhostCdUntilRef,
        milAdrenalCdUntilRef,
        milAdrenalMoveUntilRef,
        magnetUntil,
        freezeUntil,
        overdriveUntil,
        shieldUntil,
        doubleDamageUntil,
        decoyCooldownUntilRef,
        playerTurretCooldownUntilRef,
        fleetNextAtRef,
        fleetUntilRef,
        droneNextAtRef,
        droneUntilRef,
        slowPulseNextAtRef,
        eventCooldownUntilRef,
        reliefUntilRef,
      ].forEach(bump);
      if (activeEventRef.current?.endsAt) activeEventRef.current.endsAt += delta;
      enemiesRef.current = (enemiesRef.current || []).map((e) => ({
        ...e,
        stunnedUntil: e.stunnedUntil ? e.stunnedUntil + delta : e.stunnedUntil,
        slowUntil: e.slowUntil ? e.slowUntil + delta : e.slowUntil,
        burnUntil: e.burnUntil ? e.burnUntil + delta : e.burnUntil,
        damageReductionUntil: e.damageReductionUntil ? e.damageReductionUntil + delta : e.damageReductionUntil,
        windupUntil: e.windupUntil ? e.windupUntil + delta : e.windupUntil,
        dashUntil: e.dashUntil ? e.dashUntil + delta : e.dashUntil,
        nextDashAt: e.nextDashAt ? e.nextDashAt + delta : e.nextDashAt,
        nextBlinkAt: e.nextBlinkAt ? e.nextBlinkAt + delta : e.nextBlinkAt,
        nextShotAt: e.nextShotAt ? e.nextShotAt + delta : e.nextShotAt,
        circleUntil: e.circleUntil ? e.circleUntil + delta : e.circleUntil,
        diveUntil: e.diveUntil ? e.diveUntil + delta : e.diveUntil,
        nextDiveAt: e.nextDiveAt ? e.nextDiveAt + delta : e.nextDiveAt,
        reviveAt: e.reviveAt ? e.reviveAt + delta : e.reviveAt,
      }));
      pickupsRef.current = (pickupsRef.current || []).map((p) => ({ ...p, t: p.t + delta }));
      enemyProjectilesRef.current = (enemyProjectilesRef.current || []).map((p) => ({ ...p, t: p.t + delta }));
      playerTurretsRef.current = (playerTurretsRef.current || []).map((t) => ({ ...t, until: t.until + delta, nextShotAt: t.nextShotAt + delta }));
      playerBombsRef.current = (playerBombsRef.current || []).map((b) => ({ ...b, detonateAt: b.detonateAt + delta }));
      pauseStartedAtRef.current = 0;
    }
    pausedRef.current = paused;
  }, [paused]);
  useEffect(() => { playerRef.current = player; }, [player]);
  useEffect(() => { statsRef.current = stats; }, [stats]);
  useEffect(() => { xpRef.current = xp; }, [xp]);
  useEffect(() => { xpTargetRef.current = xpTarget; }, [xpTarget]);
  useEffect(() => { selectedWeaponsRef.current = selectedWeapons; }, [selectedWeapons]);
  useEffect(() => { weaponLevelsRef.current = weaponLevels; }, [weaponLevels]);
  useEffect(() => { upgradeOptionsRef.current = upgradeOptions; }, [upgradeOptions]);
  useEffect(() => { bossSpawnedRef.current = bossSpawned; }, [bossSpawned]);
  useEffect(() => { levelRef.current = level; }, [level]);

  const syncUI = (force = false) => {
    const now = Date.now();
    if (!force && now - uiLastSyncRef.current < 120) return; // ~8Hz
    uiLastSyncRef.current = now;

    setStats({ ...statsRef.current });
    setXp(xpRef.current);
    setXpTarget(xpTargetRef.current);
    setLevel(levelRef.current);
    setPickups([...(pickupsRef.current || [])]);
  };

  const weaponChoices = useMemo(() => WEAPONS, []);
  const crewDamageMult = useMemo(() => crew.reduce((acc, c) => acc * c.trait.dmg, 1), [crew]);
  const crewSpeedMult = useMemo(() => crew.reduce((acc, c) => acc * c.trait.spd, 1), [crew]);

  const syncPlayerCameraDom = (pos = playerRef.current) => {
    if (!pos) return;
    const nc = { x: pos.x - window.innerWidth / 2, y: pos.y - window.innerHeight / 2 };
    cameraRef.current = nc;

    if (playerSpriteRef.current) {
      playerSpriteRef.current.style.left = '0px';
      playerSpriteRef.current.style.top = '0px';
      playerSpriteRef.current.style.transform = `translate3d(${pos.x}px,${pos.y}px,0) translate(-50%, -50%) scale(1.8)`;
    }
    if (playerTracerRef.current) {
      playerTracerRef.current.style.left = '0px';
      playerTracerRef.current.style.top = '0px';
      playerTracerRef.current.style.transform = `translate3d(${pos.x - 60}px,${pos.y - 60}px,0)`;
    }
    if (worldRef.current) {
      worldRef.current.style.transform = `translate3d(${-nc.x}px,${-nc.y}px,0)`;
    }
  };

  const juicePunch = (mag = 1, chroma = 1) => {
    const now = Date.now();
    const maxC = Math.max(juice.current.maxChroma || 0, 0.20 * chroma);
    const maxP = Math.max(juice.current.maxPunch || 0, 0.90 * mag);

    juice.current.maxChroma = maxC;
    juice.current.maxPunch = maxP;
    juice.current.until = Math.max(juice.current.until || 0, now + 140);
    juice.current.dur = 140;
  };

  // -------------------- MILITARY TALENTS: runtime procs --------------------
  const tryProcAdrenal = (now, reason = 'damage') => {
    const t = talentsRef.current;
    if (!t.adrenalUnlocked) return false;
    if (now < milAdrenalCdUntilRef.current) return false;

    milAdrenalCdUntilRef.current = now + 30000; // 30s cooldown

    // Adrenal is pure Overdrive now: 6 seconds, 30 second cooldown.
    overdriveUntil.current = Math.max(overdriveUntil.current, now + 6000);
    milAdrenalMoveUntilRef.current = Math.max(milAdrenalMoveUntilRef.current, now + 6000);

    // VFX pulse
    explosionsRef.current = [...(explosionsRef.current || []), { id: Math.random(), x: playerRef.current.x, y: playerRef.current.y, r: 150, t: now, life: 280, color: 'rgba(255,218,107,1)', glow: 26, fill: true, alpha: 0.28 }];
    juicePunch(0.55, 0.65);
    return true;
  };

  const tryProcGhost = (now) => {
    const t = talentsRef.current;
    if (t.ghostRank <= 0) return false;
    if (now < milGhostCdUntilRef.current) return false;

    milGhostCdUntilRef.current = now + t.ghostCooldownMs;

    // Freeze world (uses existing FREEZE mechanic)
    freezeUntil.current = Math.max(freezeUntil.current, now + 2000);

    // Explosion around player (VISIBILITY BOOST: multi-ring + glow)
    const p = playerRef.current;
    const r = t.ghostRadius || 240;
    explosionsRef.current = [
      ...(explosionsRef.current || []),
      // bright core flash
      { id: Math.random(), x: p.x, y: p.y, r: r * 0.72, t: now, life: 260, kind: 'ghost', fill: true, alpha: 0.18, color: 'rgba(0,242,255,1)', glow: 32, lineWidth: 2 },
      // main ring
      { id: Math.random(), x: p.x, y: p.y, r, t: now, life: 640, kind: 'ghost', alpha: 0.95, color: 'rgba(0,242,255,1)', glow: 38, lineWidth: 6 },
      // outer ring
      { id: Math.random(), x: p.x, y: p.y, r: r * 1.55, t: now, life: 820, kind: 'ghost', alpha: 0.55, color: 'rgba(255,0,122,1)', glow: 28, lineWidth: 4 },
    ];

    pushToast('👻 GHOST PROTOCOL');

    // Deal AoE damage; bosses/minibosses keep their control immunity.
    enemiesRef.current = (enemiesRef.current || []).map((en) => {
      if (en.hp <= 0) return en;
      const d = Math.hypot(en.x - p.x, en.y - p.y);
      if (d <= t.ghostRadius) {
        const fall = 1 - d / t.ghostRadius;
        const dmg = t.ghostDamage * Math.max(0.25, fall);
        const ang = Math.atan2(en.y - p.y, en.x - p.x);
        const push = isKnockbackImmune(en.type) ? 0 : (12 * Math.max(0.3, fall));
        return {
          ...en,
          hp: en.hp - dmg,
          x: clamp(en.x + Math.cos(ang) * push, 0, ARENA_SIZE),
          y: clamp(en.y + Math.sin(ang) * push, 0, ARENA_SIZE),
          stunnedUntil: isControlImmune(en.type) ? en.stunnedUntil : Math.max(en.stunnedUntil || 0, now + 220),
        };
      }
      return en;
    });

    juicePunch(1.05, 1.0);
    return true;
  };

  const applyPlayerDamage = (rawDamage, source = 'contact') => {
    if (!rawDamage || rawDamage <= 0) return 0;

    const now = Date.now();
    lastDamage.current = now; // respects the built-in hit gate windows

    const t = talentsRef.current;

    // Thorns: true invuln
    if (now < thornsActiveUntilRef.current) return 0;

    // Shield pickup: already invuln
    if (now < shieldUntil.current) return 0;

    // Titanium Plates: block the entire next instance
    if (t.titaniumRank > 0 && platesStacksRef.current > 0) {
      platesStacksRef.current = Math.max(0, platesStacksRef.current - 1);
      explosionsRef.current = [
        ...(explosionsRef.current || []),
        { id: Math.random(), x: playerRef.current.x, y: playerRef.current.y, r: 92, t: now, life: 260, color: 'rgba(0,242,255,1)', glow: 26, fill: true, alpha: 0.34 },
        { id: Math.random(), x: playerRef.current.x, y: playerRef.current.y, r: 130, t: now, life: 340, color: 'rgba(255,255,255,1)', glow: 18 }
      ];
      addToast('PLATING BLOCKED');
      juicePunch(0.52, 0.70);
      syncUI();
      return 0;
    }

    // Plate Carrier DR
    const dr = clamp(t.damageReduction || 0, 0, 0.75);
    const dmg = Math.max(0, rawDamage * (1 - dr));
    if (dmg <= 0) return 0;

    const s = statsRef.current;
    s.hp = Math.max(0, (s.hp || 0) - dmg);
    damageTakenRef.current += dmg;
    const src = String(source || 'contact');
    damageSourcesRef.current[src] = (damageSourcesRef.current[src] || 0) + dmg;

    // procs (only if damage actually went through)
    tryProcGhost(now);
    tryProcAdrenal(now, source);

    syncUI();
    return dmg;
  };

  const onPlayerKill = (enemy) => {
    const now = Date.now();
    if (enemy?.type !== 'ghost_spirit') {
      killCountRef.current += 1;
      const type = String(enemy?.type || 'unknown');
      killsByTypeRef.current[type] = (killsByTypeRef.current[type] || 0) + 1;
    }
    // Adrenal triggers on kill too
    tryProcAdrenal(now, 'kill');

    const t = talentsRef.current;
    if (t.combustion && now >= combustionNextAtRef.current) {
      combustionNextAtRef.current = now + 30000;
      const radius = 165;
      const damage = 240 + tileDifficulty * 24;
      let origin = { x: enemy.x, y: enemy.y, id: enemy.id };
      const hit = new Set([enemy.id]);
      const blasts = [{ x: enemy.x, y: enemy.y }];

      for (let hop = 0; hop < 6; hop += 1) {
        let next = null;
        let bestD2 = 620 * 620;
        for (const en of (enemiesRef.current || [])) {
          if (en.hp <= 0 || hit.has(en.id)) continue;
          const dx = en.x - origin.x;
          const dy = en.y - origin.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < bestD2) {
            bestD2 = d2;
            next = en;
          }
        }
        if (!next) break;
        arcsRef.current = appendCapped(arcsRef.current, {
          id: Math.random(),
          x1: origin.x,
          y1: origin.y,
          x2: next.x,
          y2: next.y,
          t: now + hop * 30,
          life: 420,
          color: 'rgba(255,218,107,0.95)'
        }, PERF_ARC_CAP);
        blasts.push({ x: next.x, y: next.y });
        hit.add(next.id);
        origin = next;
      }

      explosionsRef.current = appendCapped(
        explosionsRef.current,
        blasts.map((b, i) => ({
          id: Math.random(),
          x: b.x,
          y: b.y,
          r: radius + i * 4,
          t: now + i * 35,
          life: 520,
          color: i % 2 ? 'rgba(255,218,107,1)' : 'rgba(255,84,18,1)',
          glow: 34,
          fill: true,
          alpha: 0.40
        })),
        PERF_EFFECT_CAP
      );

      enemiesRef.current = (enemiesRef.current || []).map((en) => {
        let total = 0;
        let checked = 0;
        for (const b of blasts) {
          checked += 1;
          if (checked > 7) break;
          const d = Math.hypot(en.x - b.x, en.y - b.y);
          if (d <= radius) total += damage * Math.max(0.38, 1 - d / radius);
        }
        return total > 0 ? { ...en, hp: en.hp - total } : en;
      });
      juicePunch(1.0, 0.95);
      pushToast('COMBUSTION CHAIN');
    }
  };

  useEffect(() => {
    if (victory) {
      setMatchSummary((prev) => prev || buildMatchSummary('CLEARED'));
    }
  }, [victory, onVictory]);

  useEffect(() => {
    if (defeat) {
      setMatchSummary((prev) => prev || buildMatchSummary('DEFEATED'));
    }
  }, [defeat, onExit]);

  useEffect(() => {
    if (stats.hp <= 0 && !defeat) setDefeat(true);
  }, [stats.hp, defeat]);

  useEffect(() => {
    const handleResize = () => {
      if (!canvasRef.current) return;
      canvasRef.current.width = window.innerWidth;
      canvasRef.current.height = window.innerHeight;
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const handleKey = (e) => {
      const down = e.type === 'keydown';
      const k = (e.key || '').toLowerCase();
      if (k) keys.current[k] = down;

    // normalize spacebar so we can reliably read keys.current.space
      if (e.code === 'Space') keys.current.space = down;
      if (k === ' ') keys.current.space = down;
      if (e.code === 'Digit1' || k === '1') keys.current.one = down;
      if (e.code === 'Digit2' || k === '2') keys.current.two = down;
      if (e.code === 'Digit3' || k === '3') keys.current.three = down;
    };
    window.addEventListener('keydown', handleKey);
    window.addEventListener('keyup', handleKey);
    const blockCtrlWheel = (e) => {
      if (e.ctrlKey) e.preventDefault();
    };
    window.addEventListener('wheel', blockCtrlWheel, { passive: false });
    return () => {
      window.removeEventListener('keydown', handleKey);
      window.removeEventListener('keyup', handleKey);
      window.removeEventListener('wheel', blockCtrlWheel);
    };
  }, []);

  const shouldIgnorePointer = (e) => {
    if (pausedRef.current) return true;
    const el = e.target;
    if (el && typeof el.closest === 'function') {
      if (el.closest('button') || el.closest('.ui-layer') || el.closest('.combat-hud')) return true;
    }
    return false;
  };

  const beginDragMove = (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (shouldIgnorePointer(e)) return;

    dragMoveRef.current.active = true;
    dragMoveRef.current.pointerId = e.pointerId;
    dragMoveRef.current.startX = e.clientX;
    dragMoveRef.current.startY = e.clientY;
    dragMoveRef.current.vecX = 0;
    dragMoveRef.current.vecY = 0;

    try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
  };

  const updateDragMove = (e) => {
    const d = dragMoveRef.current;
    if (!d.active || d.pointerId !== e.pointerId) return;

    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;

    const dead = 8;
    const maxR = 78;
    const dist = Math.hypot(dx, dy);

    if (dist < dead) {
      d.vecX = 0;
      d.vecY = 0;
      return;
    }

    const scale = Math.min(1, dist / maxR);
    d.vecX = (dx / dist) * scale;
    d.vecY = (dy / dist) * scale;
  };

  const endDragMove = (e) => {
    const d = dragMoveRef.current;
    if (d.pointerId !== e.pointerId) return;

    d.active = false;
    d.pointerId = null;
    d.vecX = 0;
    d.vecY = 0;

    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {}
  };

  const getRunT = () => (runTimeRef.current || BOSS_TIME);
  const getProgressT = () => clamp(progElapsedRef.current / getRunT(), 0, 1);
  const getLateT = () => norm01(getProgressT(), 0.45, 1.0);
  const fmtClock = (ms) => {
    const total = Math.max(0, Math.floor((ms || 0) / 1000));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };
  const logTimeline = (type, label) => {
    timelineRef.current = [
      ...(timelineRef.current || []),
      { t: elapsed.current || 0, type, label }
    ].slice(-80);
  };
  const buildMatchSummary = (result) => ({
    result,
    playerName: playerName || selectedHero?.name || 'UNKNOWN',
    hero: selectedHero?.name || '',
    elapsedMs: elapsed.current || 0,
    progress: getProgressT(),
    kills: killCountRef.current || 0,
    killsByType: { ...(killsByTypeRef.current || {}) },
    damageTaken: Math.round(damageTakenRef.current || 0),
    killedByMost: Object.entries(damageSourcesRef.current || {}).sort((a, b) => Number(b[1]) - Number(a[1]))[0]?.[0] || '',
    damageDealt: Math.round(damageDealtRef.current || 0),
    dps: Math.round(((damageDealtRef.current || 0) / Math.max(1, (elapsed.current || 0) / 1000)) * 10) / 10,
    level: levelRef.current || 1,
    weapons: (selectedWeaponsRef.current || []).map((id) => ({ id, level: weaponLevelsRef.current?.[id] || 1 })),
    mvpWeapon: [...(selectedWeaponsRef.current || [])]
      .sort((a, b) => (weaponLevelsRef.current?.[b] || 1) - (weaponLevelsRef.current?.[a] || 1))[0] || '',
    timeline: [...(timelineRef.current || [])],
    talents: Object.entries(runBuild?.purchased || {})
      .filter(([, rank]) => Number(rank || 0) > 0)
      .map(([id, rank]) => ({ id, rank: Number(rank || 0) })),
  });

  const computeDifficulty = (eProg) => {
    const runT = getRunT();
    const t = clamp(eProg / runT, 0, 1);
    const d = tileDifficultyRank(tileDifficulty);
    const maxRamp = d <= 1 ? 1 : d === 2 ? 1 : d === 3 ? 2 : d === 4 ? 3 : 4;
    return tileDifficulty + Math.floor(Math.pow(t, 1.12) * maxRamp);
  };

  const buildBeatPlanIfNeeded = () => {
    if (beatPlanRef.current.ready) return;

    const beats = [];
    const r = (a, b) => a + Math.random() * (b - a);

    // Arc: frequent action, no empty mid/late.
    //  - events are shorter (see EVENT_DEFS) so we can schedule more of them.
    //  - ONLY RAM (mini_charger) as miniboss.
    const firstEventPct = r(0.08, 0.14);
    const firstMiniPct  = tileDifficulty <= 1 ? r(0.50, 0.62) : r(0.30, 0.40);
    const secondEventPct = r(0.24, 0.34);
    const midMiniPct     = r(0.60, 0.72);
    const thirdEventPct  = r(0.48, 0.60);
    const lateMiniPct    = r(0.76, 0.86);
    const fourthEventPct = r(0.72, 0.84);
    const turretPct = r(0.28, 0.52);
    const turretLatePct = r(0.70, 0.84);
    const splitterPct = r(0.24, 0.42);
    const splitterBossPct = r(0.50, 0.68);
    const wallPct = r(0.42, 0.58);
    const wall2Pct = r(0.66, 0.82);
    const ghostGrabPct = r(0.22, 0.36);
    const ghostGrabLatePct = r(0.58, 0.74);

    // Mostly swarms; walls are *late* and rare "shape change" beats.
    // Danish feedback: early WALL was happening too often / too punishing with fast early spawn ramp.
    const pickLateEventId = (swarmBias = 0.45) => (Math.random() < swarmBias ? 'SWARM' : 'WALL');
    const addExtraPressure = (from, to, count) => {
      const ids = ['SWARM', 'TINY_RAMS', 'WALL', EVENT_ELITE_WALL, EVENT_GRAB_GHOST, 'SPLITTER'];
      for (let i = 0; i < count; i += 1) {
        const band = (to - from) / Math.max(1, count);
        const atPct = from + band * i + r(0.02, Math.max(0.03, band * 0.72));
        const id = ids[Math.floor(Math.random() * ids.length)];
        beats.push({ kind: 'EVENT', atPct: clamp(atPct, from, to), id });
      }
    };

    // Force early beats to be swarms for readability + fairness.
    beats.push({ kind: 'EVENT', atPct: firstEventPct, id: 'SWARM' });
    if (tileDifficulty >= 2) beats.push({ kind: 'EVENT', atPct: r(0.18, 0.30), id: EVENT_GHOST_WAVE });
    beats.push({ kind: 'EVENT', atPct: r(0.16, 0.24), id: 'TINY_RAMS' });
    beats.push({ kind: 'EVENT', atPct: ghostGrabPct, id: EVENT_GRAB_GHOST });
    if (tileDifficulty >= 2) beats.push({ kind: 'MINI', atPct: firstMiniPct, count: 1, mix: 'charger' });

    beats.push({ kind: 'EVENT', atPct: secondEventPct, id: 'SWARM' });
    beats.push({ kind: 'EVENT', atPct: turretPct, id: 'TURRET' });
    beats.push({ kind: 'EVENT', atPct: r(0.18, 0.28), id: Math.random() < 0.34 ? EVENT_ELITE_WALL : 'WALL' });
    beats.push({ kind: 'EVENT', atPct: r(0.30, 0.42), id: Math.random() < 0.45 ? EVENT_ELITE_WALL : 'WALL' });
    beats.push({ kind: 'EVENT', atPct: r(0.36, 0.52), id: EVENT_PYLON });

    if (tileDifficulty >= 3) beats.push({ kind: 'MINI', atPct: midMiniPct, count: 1 + Math.floor(Math.random() * 2), mix: 'charger' });
    else beats.push({ kind: 'EVENT', atPct: midMiniPct, id: 'TINY_RAMS' });

    beats.push({ kind: 'EVENT', atPct: thirdEventPct, id: 'SWARM' });
    beats.push({ kind: 'EVENT', atPct: r(0.44, 0.56), id: Math.random() < 0.5 ? 'SWARM' : EVENT_GHOST_WAVE });
    beats.push({ kind: 'EVENT', atPct: ghostGrabLatePct, id: EVENT_GRAB_GHOST });
    beats.push({ kind: 'EVENT', atPct: splitterPct, id: 'SPLITTER' });
    beats.push({ kind: 'EVENT', atPct: wallPct, id: Math.random() < 0.66 ? 'WALL' : EVENT_ELITE_WALL });
    beats.push({ kind: 'EVENT', atPct: r(0.52, 0.64), id: Math.random() < 0.62 ? 'WALL' : EVENT_ELITE_WALL });
    beats.push({ kind: 'EVENT', atPct: wall2Pct, id: Math.random() < 0.50 ? EVENT_ELITE_WALL : 'WALL' });
    if (tileDifficulty >= 2) beats.push({ kind: 'EVENT', atPct: splitterBossPct, id: 'SPLITTER_BOSS' });
    if (tileDifficulty >= 4) beats.push({ kind: 'EVENT', atPct: r(0.58, 0.78), id: EVENT_ABOMINATION });

    // Late: 3–5 RAMs at once
    if (tileDifficulty >= 4) beats.push({ kind: 'MINI', atPct: lateMiniPct, count: 2, mix: 'charger' });
    else beats.push({ kind: 'EVENT', atPct: lateMiniPct, id: 'TINY_RAMS' });

    beats.push({ kind: 'EVENT', atPct: turretLatePct, id: 'TURRET' });
    beats.push({ kind: 'EVENT', atPct: fourthEventPct, id: Math.random() < 0.28 ? EVENT_GHOST_WAVE : pickLateEventId(0.45) });
    beats.push({ kind: 'EVENT', atPct: r(0.82, 0.90), id: Math.random() < 0.5 ? 'WALL' : EVENT_ELITE_WALL });
    beats.push({ kind: 'EVENT', atPct: r(0.86, 0.94), id: 'SWARM' });
    if (tileDifficulty >= 3) beats.push({ kind: 'EVENT', atPct: r(0.78, 0.90), id: EVENT_GRAB_GHOST });
    if (tileDifficulty >= 5) {
      beats.push({ kind: 'EVENT', atPct: r(0.14, 0.22), id: 'SWARM' });
      beats.push({ kind: 'EVENT', atPct: r(0.60, 0.74), id: Math.random() < 0.55 ? 'WALL' : EVENT_ELITE_WALL });
      beats.push({ kind: 'EVENT', atPct: r(0.72, 0.88), id: 'SPLITTER_BOSS' });
      beats.push({ kind: 'MINI', atPct: r(0.82, 0.94), count: 2, mix: 'charger' });
    }

    const pressureMult = tileDifficulty <= 1 ? 1.5 : tileDifficulty === 2 ? 2 : tileDifficulty === 3 ? 2.5 : tileDifficulty === 4 ? 3 : 5;
    addExtraPressure(0.40, 0.80, Math.max(1, Math.round(pressureMult)));
    addExtraPressure(0.80, 0.96, Math.max(1, Math.round(pressureMult * 0.72)));

    beats.sort((a, b) => a.atPct - b.atPct);

    beatPlanRef.current = { ready: true, idx: 0, beats };
  };

  const startEvent = (id, meta = {}) => {
    const now = Date.now();
    if (activeEventRef.current && now < activeEventRef.current.endsAt) return false;
    if (now < reliefUntilRef.current) return false;
    if (now < eventCooldownUntilRef.current) return false;

    const dur = meta?.duration ?? EVENT_DEFS[id].duration;
    activeEventRef.current = { id, endsAt: now + dur, meta };

    // Small cooldown after the event ends
    eventCooldownUntilRef.current = Math.max(eventCooldownUntilRef.current, activeEventRef.current.endsAt + 250);
    return true;
  };

  const isEventActive = (id) => activeEventRef.current && activeEventRef.current.id === id && Date.now() < activeEventRef.current.endsAt;

  const pruneEnemiesForRelief = (list, pp, keepMax = 8) => {
    if (!Array.isArray(list) || !list.length) return list;
    const specials = [];
    const normals = [];

    for (const e of list) {
      if (
        e.type === 'boss' ||
        e.type === 'boss_split' ||
        String(e.type).startsWith('mini_') ||
        e.type === 'wall'
      ) specials.push(e);
      else normals.push(e);
    }

    normals.sort((a, b) => Math.hypot(a.x - pp.x, a.y - pp.y) - Math.hypot(b.x - pp.x, b.y - pp.y));
    const kept = normals.slice(0, Math.max(0, keepMax - specials.length));
    return [...specials, ...kept];
  };

  const triggerRelief = (ms = 6500) => {
    const now = Date.now();
    const wasActive = now < reliefUntilRef.current;
    if (!wasActive) reliefStartedAtRef.current = now;
    reliefUntilRef.current = Math.max(reliefUntilRef.current, now + ms);

    // Relief now throttles new pressure without deleting living enemies.
  };

  const triggerReliefSoft = (ms = 2600, keepMax = 22) => {
    const now = Date.now();
    const wasActive = now < reliefUntilRef.current;
    if (!wasActive) reliefStartedAtRef.current = now;
    reliefUntilRef.current = Math.max(reliefUntilRef.current, now + ms);

    // Relief now throttles new pressure without deleting living enemies.
  };

  const triggerReliefEmpty = (ms = 8200) => {
    const now = Date.now();
    const wasActive = now < reliefUntilRef.current;
    if (!wasActive) reliefStartedAtRef.current = now;
    reliefUntilRef.current = Math.max(reliefUntilRef.current, now + ms);

    // Do not delete living enemies; just stop adding pressure for a moment.
  };

  const spawnMiniPack = (pp, difficulty, count) => {
    // Only RAMs (mini_charger). No assassins.
    return spawnRamsRing(pp, difficulty, count);
  };

  const getEnemyFamily = (type) => {
    const t = String(type || '');
    if (t === 'swarm' || t === 'sprinter' || t === 'grunt' || t === 'dancer') return 'SWARM';
    if (t === 'brute' || t === 'juggernaut' || t === 'abomination' || t === 'merge_brute') return 'BRUTE';
    if (t === 'mini_charger' || t === 'tiny_ram') return 'RAM';
    if (t === 'spitter') return 'SPITTER';
    if (t === 'grab_ghost') return 'GHOST';
    if (t === 'splitter' || t === 'splitter_boss' || t === 'boss_split') return 'SPLITTER';
    if (t === 'burrower' || t === 'ghost' || t === 'ghost_spirit') return 'BURROWER';
    if (t === 'wall') return 'BLOCKER';
    if (t === 'boss') return 'BOSS';
    return 'XENO';
  };

  const makeTurretWallSquare = (p, difficulty, turretId = '') => {
    const wallHp = Math.round((320 + difficulty * 58) * difficultyHpMult(difficulty));
    const out = [];
    const half = 132;
    const step = 44;
    const size = 58;
    let idx = 0;
    for (let x = -half; x <= half; x += step) {
      for (const y of [-half, half]) {
        out.push({
          id: `turret_wall_${idx++}_${Math.random()}`,
          type: 'wall',
          x: clamp(p.x + x, 40, ARENA_SIZE - 40),
          y: clamp(p.y + y, 40, ARENA_SIZE - 40),
          hp: wallHp,
          maxHp: wallHp,
          speed: 0,
          size,
          xp: 0,
          contactDamage: 0,
          blocksPlayer: false,
          blocksEnemies: true,
          turretWall: true,
          turretId,
          color: '#ffcf6b'
        });
      }
    }
    for (let y = -half + step; y <= half - step; y += step) {
      for (const x of [-half, half]) {
        out.push({
          id: `turret_wall_${idx++}_${Math.random()}`,
          type: 'wall',
          x: clamp(p.x + x, 40, ARENA_SIZE - 40),
          y: clamp(p.y + y, 40, ARENA_SIZE - 40),
          hp: wallHp,
          maxHp: wallHp,
          speed: 0,
          size,
          xp: 0,
          contactDamage: 0,
          blocksPlayer: false,
          blocksEnemies: true,
          turretWall: true,
          turretId,
          color: '#ffcf6b'
        });
      }
    }
    return out;
  };

  const scheduleBeats = () => {
    buildBeatPlanIfNeeded();

    const e = progElapsedRef.current;
    const runT = getRunT();
    const p = clamp(e / runT, 0, 1);
    const now = Date.now();

    // Don't schedule beats during boss fight (keeps it readable and reduces spike chaos)
      const bossAlive = (enemiesRef.current || []).some((x) => (x.type === 'boss' || x.type === 'boss_split') && x.hp > 0);
      if (bossAlive && tileDifficultyRank(tileDifficulty) <= 2) return;

    // End-of-event: auto-relief
    if (activeEventRef.current && now >= activeEventRef.current.endsAt) {
      const endedId = activeEventRef.current.id;
      activeEventRef.current = null;
      triggerReliefSoft(endedId === 'WALL' ? 650 : 900 + Math.floor(Math.random() * 500), endedId === 'WALL' ? 60 : 48);
    }

    if (activeEventRef.current && now < activeEventRef.current.endsAt) return;
    if (now < reliefUntilRef.current) return;
    if (now < eventCooldownUntilRef.current) return;

    const plan = beatPlanRef.current;
    if (!plan.ready) return;

    // If we've exhausted the scripted beats, still sprinkle swarms late-game
if (plan.idx >= plan.beats.length) {
  if (p >= 0.40 && !activeEventRef.current && now > randomSwarmCooldownUntilRef.current && now > eventCooldownUntilRef.current) {
    // Roughly ~1 swarm every 15–25s on average, but only late-game.
    if (Math.random() < 0.28) {
      const dur = 6500 + Math.floor(Math.random() * 2200);
      startEvent('SWARM', { duration: dur });
      randomSwarmCooldownUntilRef.current = now + 9000 + Math.floor(Math.random() * 8000);
    }
  }
  return;
}

const beat = plan.beats[plan.idx];
    if (!beat) return;

    if (p < beat.atPct) return;

    const pp = playerRef.current;
    const difficulty = computeDifficulty(progElapsedRef.current);
    const t = getProgressT();

    if (beat.kind === 'EVENT') {
      const id = beat.id;

      if (id === 'SWARM') {
        const safeAngle = Math.random() * Math.PI * 2;
        const safeArc = Math.PI * (0.78 + Math.random() * 0.20);
        const variant = Math.random() < 0.52 ? 'encircle' : 'three_sides';

        const dur = Math.round((EVENT_DEFS.SWARM.duration * (0.95 + Math.random() * 0.35)) * (p < 0.30 ? 1.15 : 1.0));
        if (startEvent('SWARM', { variant, safeAngle, safeArc, duration: dur })) {
          juicePunch(0.70, 0.70);
          plan.idx += 1;
          return;
        }
      }

      if (id === EVENT_GHOST_WAVE) {
        const meta = { duration: EVENT_DEFS.GHOST_WAVE.duration };
        if (startEvent(EVENT_GHOST_WAVE, meta)) {
          const n = clamp(30 + tileDifficulty * 6 + Math.floor(Math.random() * 12), 30, 60);
          const a0 = Math.random() * Math.PI * 2;
          const spawned = [];
          for (let i = 0; i < n; i += 1) {
            const row = i % 10;
            const col = Math.floor(i / 10);
            const side = (row - 4.5) * 42;
            const back = col * 38;
            const baseDist = 850 + back;
            const gx = clamp(pp.x + Math.cos(a0) * baseDist + Math.cos(a0 + Math.PI / 2) * side, 30, ARENA_SIZE - 30);
            const gy = clamp(pp.y + Math.sin(a0) * baseDist + Math.sin(a0 + Math.PI / 2) * side, 30, ARENA_SIZE - 30);
            const gh = spawnEnemy(difficulty, 'ghost', t);
            spawned.push({ ...gh, x: gx, y: gy, speed: (gh.speed || 2) * 1.18 });
          }
          enemiesRef.current = [...(enemiesRef.current || []), ...spawned];
          pushToast('GHOST WAVE');
          juicePunch(0.80, 0.75);
          plan.idx += 1;
          return;
        }
      }

      if (id === 'TINY_RAMS') {
        const meta = { duration: EVENT_DEFS.TINY_RAMS.duration };
        if (startEvent('TINY_RAMS', meta)) {
          const n = clamp(7 + tileDifficulty * 2 + Math.floor(Math.random() * 5), 8, 18);
          enemiesRef.current = [
            ...(enemiesRef.current || []),
            ...spawnTinyRamsPack(pp, difficulty, n)
          ];
          pushToast('RAMLINGS');
          juicePunch(0.85, 0.8);
          plan.idx += 1;
          return;
        }
      }

      if (id === EVENT_ABOMINATION) {
        const meta = { duration: EVENT_DEFS.ABOMINATION.duration };
        if (startEvent(EVENT_ABOMINATION, meta)) {
          const hp = Math.round((980 + difficulty * 150) * ELITE_HP_MULT * difficultyHpMult(difficulty));
          const spawned = [{
            ...spawnEnemy(difficulty + 1, 'brute', t),
            id: `abomination_${Math.random()}`,
            type: 'abomination',
            x: clamp(pp.x + 560, 160, ARENA_SIZE - 160),
            y: clamp(pp.y - 360, 160, ARENA_SIZE - 160),
            hp,
            maxHp: hp,
            speed: 0.92,
            size: 142,
            xp: 220,
            contactDamage: 25,
            color: '#d7b6a0',
            healthSegments: 4,
            ghostOnDeath: false
          }];
          enemiesRef.current = [...(enemiesRef.current || []), ...spawned];
          pushToast('ABOMINATION');
          juicePunch(1.0, 0.9);
          plan.idx += 1;
          return;
        }
      }

      if (id === EVENT_ELITE_WALL) {
            const meta = { duration: EVENT_DEFS.ELITE_WALL.duration };
            if (startEvent(EVENT_ELITE_WALL, meta)) {
          const lateWallHp = t >= 0.60 ? 0.60 : 1;
          enemiesRef.current = [...(enemiesRef.current || []), ...spawnWallSweep(pp, difficulty, { hpMult: 3.225 * lateWallHp, speed: 0.92, count: 58, size: 124 }, t)];
          pushToast('WALL SWEEP');
          juicePunch(0.85, 0.8);
          plan.idx += 1;
          return;
        }
      }

      if (id === 'WALL') {
        const meta = {
          ringN: 76 + Math.floor(Math.random() * 10),
          radiusStart: 920 + Math.floor(Math.random() * 180),
          encroachSpeed: 0.72 + Math.random() * 0.26,
          minRadius: 135,
          hpMult: (3.825 + Math.random() * 2.325) * (t >= 0.60 ? 0.60 : 1),
          size: 132,
          spawned: true
        };

        if (startEvent('WALL', meta)) {
          juicePunch(0.85, 0.80);
          enemiesRef.current = [
            ...(enemiesRef.current || []),
            ...spawnWallRing(pp, difficulty, meta, t)
          ];
          plan.idx += 1;
          return;
        }
      }

      if (id === EVENT_PYLON) {
        const meta = { duration: EVENT_DEFS.PYLON.duration };
        if (!pylonSpawnedRef.current && startEvent(EVENT_PYLON, meta)) {
          const a = Math.random() * Math.PI * 2;
          const d = 420 + Math.random() * 260;
          const pyl = spawnEnemy(difficulty + 1, 'pylon', t);
          pylonSpawnedRef.current = true;
          enemiesRef.current = [
            ...(enemiesRef.current || []),
            { ...pyl, x: clamp(pp.x + Math.cos(a) * d, 100, ARENA_SIZE - 100), y: clamp(pp.y + Math.sin(a) * d, 100, ARENA_SIZE - 100) }
          ];
          pushToast('GRAVITY PYLON');
          juicePunch(0.9, 0.9);
          plan.idx += 1;
          return;
        }
        if (pylonSpawnedRef.current) {
          plan.idx += 1;
          return;
        }
      }

      if (id === EVENT_GRAB_GHOST) {
        const meta = { duration: EVENT_DEFS.GRAB_GHOST.duration };
        if (grabGhostsSpawnedRef.current < 3 && startEvent(EVENT_GRAB_GHOST, meta)) {
          const a = Math.random() * Math.PI * 2;
          const d = 620 + Math.random() * 160;
          const gh = spawnEnemy(difficulty + 1, 'grab_ghost', t);
          grabGhostsSpawnedRef.current += 1;
          enemiesRef.current = [
            ...(enemiesRef.current || []),
            { ...gh, x: clamp(pp.x + Math.cos(a) * d, 60, ARENA_SIZE - 60), y: clamp(pp.y + Math.sin(a) * d, 60, ARENA_SIZE - 60) }
          ];
          pushToast('GHOST GRABBER');
          juicePunch(0.75, 0.75);
          plan.idx += 1;
          return;
        }
        if (grabGhostsSpawnedRef.current >= 3) {
          plan.idx += 1;
          return;
        }
      }

      if (id === 'TURRET') {
        const meta = { duration: EVENT_DEFS.TURRET.duration };
        if (startEvent('TURRET', meta)) {
          const n = 2 + Math.floor(difficulty / 4);
          const spawned = [];
          for (let i = 0; i < n; i += 1) {
            const a = Math.random() * Math.PI * 2;
            const d = 520 + Math.random() * 430;
            const turret = spawnEnemy(difficulty, 'turret', t);
            spawned.push({ ...turret, x: clamp(pp.x + Math.cos(a) * d, 80, ARENA_SIZE - 80), y: clamp(pp.y + Math.sin(a) * d, 80, ARENA_SIZE - 80) });
          }
          enemiesRef.current = [...(enemiesRef.current || []), ...spawned];
          juicePunch(0.85, 0.75);
          plan.idx += 1;
          return;
        }
      }

      if (id === 'SPLITTER') {
        const meta = { duration: EVENT_DEFS.SPLITTER.duration };
        if (startEvent('SPLITTER', meta)) {
          const n = 5 + Math.floor(difficulty / 2);
          const spawned = [];
          for (let i = 0; i < n; i += 1) {
            const a = Math.random() * Math.PI * 2;
            const d = 560 + Math.random() * 360;
            const spl = spawnEnemy(difficulty, 'splitter', t);
            spawned.push({ ...spl, x: clamp(pp.x + Math.cos(a) * d, 80, ARENA_SIZE - 80), y: clamp(pp.y + Math.sin(a) * d, 80, ARENA_SIZE - 80) });
          }
          enemiesRef.current = [...(enemiesRef.current || []), ...spawned];
          juicePunch(0.75, 0.70);
          plan.idx += 1;
          return;
        }
      }

      if (id === 'SPLITTER_BOSS') {
        const meta = { duration: EVENT_DEFS.SPLITTER.duration + 8000 };
        if (startEvent('SPLITTER', meta)) {
          const spl = spawnEnemy(difficulty + 2, 'splitter_boss', t);
          enemiesRef.current = [
            ...(enemiesRef.current || []),
            { ...spl, x: clamp(pp.x + 520, 120, ARENA_SIZE - 120), y: clamp(pp.y - 300, 120, ARENA_SIZE - 120) }
          ];
          juicePunch(1.0, 0.9);
          plan.idx += 1;
          return;
        }
      }

      // failed to start due to constraints, try next tick
      return;
    }

    if (beat.kind === 'MINI') {
      // Don't stack RAM packs on top of each other.
      // We pause progression during RAM, but this also ensures we never spawn a new pack while one is alive.
      const anyRamAlive = (enemiesRef.current || []).some((e) => e.type === 'mini_charger' && e.hp > 0);
      if (anyRamAlive) return;

      enemiesRef.current = [
        ...(enemiesRef.current || []),
        ...spawnMiniPack(pp, difficulty, beat.count || 1)
      ];
      juicePunch(1.0, 0.92);
      // Don’t empty the arena after minis; keep pressure + a short breather.
      triggerReliefSoft(1600 + Math.floor(Math.random() * 900), 46);
      plan.idx += 1;
      return;
    }

    if (beat.kind === 'RELIEF_EMPTY') {
      triggerReliefEmpty(beat.ms || 8200);
      juicePunch(0.55, 0.65);
      plan.idx += 1;
      return;
    }
  };

  const maybeDropPickup = (x, y, source = 'elite') => {
    const tNow = getProgressT();
    const late = norm01(tNow, 0.60, 1.0);

    // Late-game stabilizers: slightly higher drop chance + more freeze/damage tempo.
    const base = source === 'boss' ? 0.35 : source === 'mini' ? 0.18 : 0.08;
    const chance = base * lerp(1.0, 1.55, late);
    if (Math.random() > chance) return;

    // Weighted roll. Shield pickup removed; Overdrive and Double Damage now last +3s.
    const wMag = lerp(0.28, 0.20, late);
    const wOvr = lerp(0.28, 0.30, late);
    const wFrz = lerp(0.20, 0.25, late);
    const wDbl = lerp(0.20, 0.25, late);

    const total = wMag + wOvr + wFrz + wDbl;
    let r = Math.random() * total;

    let type = 'MAGNET';
    if ((r -= wMag) <= 0) type = 'MAGNET';
    else if ((r -= wOvr) <= 0) type = 'OVERDRIVE';
    else if ((r -= wFrz) <= 0) type = 'FREEZE';
    else type = 'DOUBLE_DAMAGE';

    pickupsRef.current = [...(pickupsRef.current || []), { id: Math.random(), type, x, y, t: Date.now(), life: 24000 }];
  };

  const activatePickup = (type) => {
    const now = Date.now();
    if (type === 'LEVELUP') {
      pendingUpgradeCountRef.current += 1;
      if ((upgradeOptionsRef.current || []).length === 0) {
        const nextOptions = rollUpgradeOptions(selectedWeaponsRef.current, weaponLevelsRef.current, statsRef.current, talentsRef.current.extraWeaponSlot ? 6 : DEFAULT_WEAPON_CAP);
        upgradeOptionsRef.current = nextOptions;
        setUpgradeOptions(nextOptions);
      }
      juicePunch(1.1, 1.0);
      pushToast('LEVEL CORE');
      return;
    }
    if (type === 'MAGNET') magnetUntil.current = Math.max(magnetUntil.current, now + PICKUP_DEFS.MAGNET.life);
    if (type === 'FREEZE') freezeUntil.current = Math.max(freezeUntil.current, now + PICKUP_DEFS.FREEZE.life);
    if (type === 'OVERDRIVE') overdriveUntil.current = Math.max(overdriveUntil.current, now + PICKUP_DEFS.OVERDRIVE.life);
    if (type === 'DOUBLE_DAMAGE') doubleDamageUntil.current = Math.max(doubleDamageUntil.current, now + PICKUP_DEFS.DOUBLE_DAMAGE.life);
    juicePunch(0.95, 0.95);
  };

  const distPointToSeg = (px, py, x1, y1, x2, y2) => {
    const vx = x2 - x1;
    const vy = y2 - y1;
    const wx = px - x1;
    const wy = py - y1;
    const c1 = vx * wx + vy * wy;
    if (c1 <= 0) return Math.hypot(px - x1, py - y1);
    const c2 = vx * vx + vy * vy;
    if (c2 <= c1) return Math.hypot(px - x2, py - y2);
    const b = c1 / c2;
    const bx = x1 + b * vx;
    const by = y1 + b * vy;
    return Math.hypot(px - bx, py - by);
  };

  // -------------------- MAIN LOOP --------------------
  useEffect(() => {
    if (!selectedWeapons.length) return;

    if (canvasRef.current) {
      ctxRef.current = canvasRef.current.getContext('2d');
      canvasRef.current.width = window.innerWidth;
      canvasRef.current.height = window.innerHeight;
    }
    syncPlayerCameraDom(playerRef.current);

    const stepPlayerCamera = (dtScale = 1) => {
      const prev = playerRef.current;
      const nowMove = Date.now();
      const grab = playerGrabRef.current;
      if (grab && nowMove < (grab.until || 0)) {
        const holderAlive = (enemiesRef.current || []).some((e) => e.id === grab.enemyId && e.hp > 0);
        if (holderAlive) {
          syncPlayerCameraDom(prev);
          return;
        }
      }
      if (grab) playerGrabRef.current = null;

      let nx = prev.x;
      let ny = prev.y;

      const baseSpeed = 5.8;
      const speedMult = Math.min(crewSpeedMult, 1.45);
      const finalSpeed = baseSpeed * speedMult * (statsRef.current.moveSpeed || 1);

      let inputX = 0;
      let inputY = 0;
      if (keys.current.w) inputY -= 1;
      if (keys.current.s) inputY += 1;
      if (keys.current.a) inputX -= 1;
      if (keys.current.d) inputX += 1;
      if (dragMoveRef.current.active) {
        inputX += dragMoveRef.current.vecX;
        inputY += dragMoveRef.current.vecY;
      }
      const inputLen = Math.hypot(inputX, inputY);
      if (inputLen > 0) {
        const scale = inputLen > 1 ? 1 / inputLen : 1;
        nx += inputX * scale * finalSpeed * dtScale;
        ny += inputY * scale * finalSpeed * dtScale;
      }

      nx = clamp(nx, 0, ARENA_SIZE);
      ny = clamp(ny, 0, ARENA_SIZE);

      let checkedWalls = 0;
      for (const wall of (enemiesRef.current || [])) {
        if (wall.type !== 'wall' || wall.hp <= 0 || wall.blocksPlayer === false) continue;
        if (wall.turretWall) continue;
        checkedWalls += 1;
        if (checkedWalls > 48) break;
        const minD = (wall.size || 46) * 0.5 + 20;
        const dx = nx - wall.x;
        const dy = ny - wall.y;
        const d = Math.hypot(dx, dy);
        if (d > 0 && d < minD) {
          const push = minD - d;
          nx = clamp(nx + (dx / d) * push, 0, ARENA_SIZE);
          ny = clamp(ny + (dy / d) * push, 0, ARENA_SIZE);
        }
      }

      const np = { x: nx, y: ny };
      playerRef.current = np;
      syncPlayerCameraDom(np);
    };

    const syncWorldFeedback = () => {
      const worldEl = worldRef.current;
      if (!worldEl) return;
      const nowFx = Date.now();
      const until = juice.current.until || 0;
      const dur = juice.current.dur || 140;
      const t = until > nowFx ? (until - nowFx) / dur : 0;
      const chroma = (juice.current.maxChroma || 0) * t;

      worldEl.style.filter = chroma > 0.02 ? `saturate(${1 + chroma * 0.10}) brightness(${1 + chroma * 0.05})` : '';
      if (t <= 0) {
        juice.current.maxPunch = 0;
        juice.current.maxChroma = 0;
      }
    };

    let rafId = 0;
    let lastFrameTs = 0;

    const loop = (frameTs = 0) => {
      rafId = requestAnimationFrame(loop);
      if (pausedRef.current) return;
      const frameDelta = lastFrameTs ? clamp(frameTs - lastFrameTs, 8, 34) : 16;
      const dtScale = frameDelta / 16;
      lastFrameTs = frameTs;

      const now = Date.now();

      // -------------------- MILITARY TALENTS: per-frame updates --------------------
      {
        const t = talentsRef.current;

        const freezeWorldNow = now < freezeUntil.current;

        // Titanium Plates regen (every 20s, max stacks by rank)
        if (t.titaniumRank > 0 && !freezeWorldNow) {
          const maxStacks = t.platesMax || 0;

          // while full, timer can still tick so when you spend one, you may instantly regen if enough time passed
          while (now - (platesLastGenAtRef.current || now) >= 20000) {
            platesLastGenAtRef.current += 20000;
            if (platesStacksRef.current < maxStacks) {
              platesStacksRef.current += 1;
              const p = playerRef.current;
              explosionsRef.current = [
                ...(explosionsRef.current || []),
                { id: Math.random(), x: p.x, y: p.y, r: 78, t: now, life: 260, color: 'rgba(0,242,255,1)', glow: 22, fill: true, alpha: 0.28 },
                { id: Math.random(), x: p.x, y: p.y, r: 118, t: now, life: 420, color: 'rgba(0,242,255,1)', glow: 18 }
              ];
              addToast('PLATING READY');
              juicePunch(0.22, 0.35);
            }
          }
        }

        // Active abilities: 1 = Thorns, 2 = Decoy, 3 = Deploy Turret. Space still triggers Thorns as a fallback.
        const oneDown = !!keys.current.one || !!keys.current.space;
        const twoDown = !!keys.current.two;
        const threeDown = !!keys.current.three;
        const pressedOne = oneDown && !abilityWasDownRef.current.one;
        const pressedTwo = twoDown && !abilityWasDownRef.current.two;
        const pressedThree = threeDown && !abilityWasDownRef.current.three;
        abilityWasDownRef.current.one = oneDown;
        abilityWasDownRef.current.two = twoDown;
        abilityWasDownRef.current.three = threeDown;
        spaceWasDownRef.current = !!keys.current.space;

        if (t.decoyUnlocked && pressedTwo && now >= decoyCooldownUntilRef.current) {
          const p = playerRef.current;
          decoyRef.current = { x: p.x, y: p.y, until: now + 8000 };
          decoyCooldownUntilRef.current = now + 18000;
          explosionsRef.current = [
            ...(explosionsRef.current || []),
            { id: Math.random(), x: p.x, y: p.y, r: 140, t: now, life: 340, color: 'rgba(0,242,255,1)', glow: 22, fill: true, alpha: 0.45 },
            { id: Math.random(), x: p.x, y: p.y, r: 64, t: now, life: 520, color: 'rgba(255,255,255,1)', glow: 18 }
          ];
          juicePunch(0.70, 0.85);
        }

        if (t.deployTurretUnlocked && pressedThree && now >= playerTurretCooldownUntilRef.current) {
          const p = playerRef.current;
          const turretHp = Math.round((520 + tileDifficulty * 72 + (t.turretFortify ? 220 : 0)) * 2.5);
          const turretId = `player_turret_${Math.random()}`;
          playerTurretsRef.current = [
            ...(playerTurretsRef.current || []),
            {
              id: turretId,
              x: p.x,
              y: p.y,
              hp: turretHp,
              maxHp: turretHp,
              until: now + (t.turretFortify ? 12500 : 10000),
              nextShotAt: now + 180,
              nextBombAt: now + 900,
              flameAt: t.turretFlamePillar ? now + 1150 : 0,
              flameDone: false,
              shockReady: !!t.turretBomb,
              size: 48
            }
          ].slice(-3);
          if (t.turretFortify) {
            enemiesRef.current = [
              ...(enemiesRef.current || []),
              ...makeTurretWallSquare(p, tileDifficulty, turretId)
            ];
          }
          playerTurretCooldownUntilRef.current = now + 45000;
          explosionsRef.current = appendCapped(explosionsRef.current, [
            { id: Math.random(), x: p.x, y: p.y, r: 122, t: now, life: 300, color: 'rgba(255,218,107,1)', glow: 24, fill: true, alpha: 0.34 },
            { id: Math.random(), x: p.x, y: p.y, r: 56, t: now, life: 520, color: 'rgba(255,255,255,1)', glow: 16 }
          ]);
          pushToast('TURRET DEPLOYED');
          juicePunch(0.70, 0.85);
        }

        if (t.thornsUnlocked && pressedOne && now >= thornsCooldownUntilRef.current) {
          thornsActiveUntilRef.current = now + t.thornsDurationMs;
          thornsCooldownUntilRef.current = now + t.thornsCooldownMs;

          const p = playerRef.current;
          explosionsRef.current = [
            ...(explosionsRef.current || []),
            { id: Math.random(), x: p.x, y: p.y, r: 185, t: now, life: 280, color: 'rgba(0,255,160,1)', glow: 30, fill: true, alpha: 0.45 },
            { id: Math.random(), x: p.x, y: p.y, r: 92, t: now, life: 440, color: 'rgba(255,255,255,1)', glow: 18 }
          ];
          juicePunch(0.75, 0.8);
        }

        // Thorns expiry shockwave (if unlocked)
        const thornsActive = now < thornsActiveUntilRef.current;
        if (thornsWasActiveRef.current && !thornsActive && t.discharge) {
          const p = playerRef.current;
          const radius = 520;
          const damage = 180 + tileDifficulty * 22;
          explosionsRef.current = [
            ...(explosionsRef.current || []),
            { id: Math.random(), x: p.x, y: p.y, r: radius, t: now, life: 520, color: 'rgba(0,255,160,1)', glow: 52, fill: true, alpha: 0.34, lineWidth: 9 },
            { id: Math.random(), x: p.x, y: p.y, r: radius * 0.55, t: now, life: 360, color: 'rgba(255,255,255,1)', glow: 30, fill: true, alpha: 0.22 }
          ];

          enemiesRef.current = (enemiesRef.current || []).map((en) => {
            if (en.hp <= 0) return en;
            const d = Math.hypot(en.x - p.x, en.y - p.y);
            if (d <= radius) {
              const fall = 1 - d / radius;
              const ang = Math.atan2(en.y - p.y, en.x - p.x);
              const push = isKnockbackImmune(en.type) ? 0 : 120 * Math.max(0.22, fall);
              return {
                ...en,
                hp: en.hp - damage * Math.max(0.28, fall),
                x: clamp(en.x + Math.cos(ang) * push, 0, ARENA_SIZE),
                y: clamp(en.y + Math.sin(ang) * push, 0, ARENA_SIZE),
                stunnedUntil: isControlImmune(en.type) ? en.stunnedUntil : Math.max(en.stunnedUntil || 0, now + 380),
              };
            }
            return en;
          });

          juicePunch(1.45, 1.0);
          pushToast('THORNS DISCHARGE');
        }
        thornsWasActiveRef.current = thornsActive;

        if (decoyRef.current && now >= decoyRef.current.until) decoyRef.current = null;

        if (t.fleetAssist && now >= fleetNextAtRef.current) {
          fleetUntilRef.current = now + 10000;
          fleetNextAtRef.current = now + 90000;
          juicePunch(0.45, 0.65);
        }

        if (t.droneOrbit && now >= droneNextAtRef.current && now >= droneUntilRef.current) {
          droneUntilRef.current = now + 7000;
          droneNextAtRef.current = now + 45000;
          droneBurstToastRef.current = now;
          pushToast('DRONE SUPPORT INBOUND');
          juicePunch(0.45, 0.65);
        }

        if (t.slowPulse && now >= slowPulseNextAtRef.current) {
          slowPulseNextAtRef.current = now + 20000;
          const p = playerRef.current;
          explosionsRef.current = [...(explosionsRef.current || []), { id: Math.random(), x: p.x, y: p.y, r: 520, t: now, life: 640, color: 'rgba(0,242,255,1)', glow: 26, lineWidth: 5, alpha: 0.55 }];
          enemiesRef.current = (enemiesRef.current || []).map((en) => {
            if (isControlImmune(en.type)) return en;
            const d = Math.hypot(en.x - p.x, en.y - p.y);
            if (d > 520) return en;
            return { ...en, slowUntil: Math.max(en.slowUntil || 0, now + 5000), slowFactor: Math.min(en.slowFactor || 1, 0.55) };
          });
        }
      }

      stepPlayerCamera(dtScale);
      syncWorldFeedback();

      // --- CANVAS DRAWING START ---
      const ctx = ctxRef.current;
      const cam = cameraRef.current;
      if (ctx && canvasRef.current) {
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

        const w = canvasRef.current.width;
        const h = canvasRef.current.height;
        const pad = 120;
        const viewL = cam.x - pad;
        const viewR = cam.x + w + pad;
        const viewT = cam.y - pad;
        const viewB = cam.y + h + pad;
        const visibleEnemyCount = (enemiesRef.current || []).reduce((n, e) => (
          e.x < viewL || e.x > viewR || e.y < viewT || e.y > viewB ? n : n + 1
        ), 0);
        const perfCrowded = visibleEnemyCount > 70 || (explosionsRef.current || []).length > 34 || (orbsRef.current || []).length > 180;

        // Orbs
        orbsRef.current.forEach(orb => {
          if (orb.x < viewL || orb.x > viewR || orb.y < viewT || orb.y > viewB) return;

          const r = orb.r ?? (6 + (orb.rank || 0) * 2.0);
          const col = orb.color || '#ffffff';

          if ((orb.rank || 0) >= 4 && !perfCrowded) {
            ctx.save();
            ctx.shadowColor = col;
            ctx.shadowBlur = 14 + (orb.rank || 0) * 2;
            ctx.globalAlpha = 0.95;
            ctx.fillStyle = col;
            ctx.beginPath();
            ctx.arc(orb.x - cam.x, orb.y - cam.y, r, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          } else {
            ctx.fillStyle = col;
            ctx.beginPath();
            ctx.arc(orb.x - cam.x, orb.y - cam.y, r, 0, Math.PI * 2);
            ctx.fill();
          }

          if (orb.ring && !perfCrowded) {
            ctx.save();
            ctx.globalAlpha = 0.55;
            ctx.strokeStyle = col;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(orb.x - cam.x, orb.y - cam.y, r + 4, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
          }
        });

        // Bullets
        bulletsRef.current.forEach(b => {
          if (b.x < viewL || b.x > viewR || b.y < viewT || b.y > viewB) return;

        // Void Orbs: render as circles (enemies are squares) for readability.
          if (b.delay && (b.age || 0) < b.delay) return;
          const isVoid = !!(b.pullRadius || b.vortexDps || b.singularity || b.anchorOnMaxRange);
          if (isVoid) {
            const r = Math.max(10, (b.width || 20) * 0.5);
            const col = b.color || '#c08bff';
            const anchoredAge = b.anchored ? Math.max(0, Date.now() - (b.anchoredAt || Date.now())) : 0;
            const grow = b.anchored ? clamp(anchoredAge / 760, 0, 1) : 0;
            const fieldR = (b.pullRadius || 190) * grow;

            ctx.save();
            ctx.translate(b.x - cam.x, b.y - cam.y);

            ctx.globalAlpha = 0.85;
            ctx.shadowColor = col;
            ctx.shadowBlur = b.singularity ? 28 : 18;

            ctx.fillStyle = col;
            ctx.beginPath();
            ctx.arc(0, 0, r, 0, Math.PI * 2);
            ctx.fill();

            ctx.globalAlpha = 0.55;
            ctx.lineWidth = 3;
            ctx.strokeStyle = 'rgba(255,255,255,0.75)';
            ctx.beginPath();
            ctx.arc(0, 0, r + 4, 0, Math.PI * 2);
            ctx.stroke();

            if (b.anchored) {
              ctx.globalAlpha = 0.18 + grow * 0.22;
              ctx.strokeStyle = col;
              ctx.lineWidth = 5;
              ctx.beginPath();
              ctx.arc(0, 0, Math.max(14, fieldR), 0, Math.PI * 2);
              ctx.stroke();

              ctx.globalAlpha = 0.50;
              ctx.lineWidth = 3;
              for (let i = 0; i < 4; i += 1) {
                const rot = Date.now() / (420 + i * 70) + i * Math.PI * 0.5;
                ctx.beginPath();
                ctx.arc(0, 0, Math.max(18, fieldR * (0.30 + i * 0.17)), rot, rot + Math.PI * 1.15);
                ctx.stroke();
              }
            }

            ctx.restore();
            return;
          }

          if (b.axeThrow) {
            const ang = Number.isFinite(b.angle) ? b.angle : Math.atan2(b.vy || 0, b.vx || 0);
            const spin = (Date.now() / 70) * (b.spinDir || 1);
            ctx.save();
            ctx.translate(b.x - cam.x, b.y - cam.y);
            ctx.rotate(ang + spin);
            ctx.globalAlpha = 0.95;
            ctx.shadowColor = 'rgba(255,28,0,0.90)';
            ctx.shadowBlur = 22;

            ctx.strokeStyle = 'rgba(92,42,26,1)';
            ctx.lineWidth = 7;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(-26, 0);
            ctx.lineTo(26, 0);
            ctx.stroke();

            ctx.fillStyle = 'rgba(255,54,24,0.98)';
            ctx.strokeStyle = 'rgba(255,230,205,0.88)';
            ctx.lineWidth = 2.5;
            [-1, 1].forEach((side) => {
              ctx.beginPath();
              ctx.moveTo(side * 6, -16);
              ctx.lineTo(side * 32, -30);
              ctx.quadraticCurveTo(side * 46, 0, side * 32, 30);
              ctx.lineTo(side * 6, 16);
              ctx.quadraticCurveTo(side * 18, 0, side * 6, -16);
              ctx.closePath();
              ctx.fill();
              ctx.stroke();
            });

            ctx.globalAlpha = 0.32;
            ctx.strokeStyle = 'rgba(255,90,35,0.95)';
            ctx.lineWidth = 5;
            ctx.beginPath();
            ctx.arc(0, 0, 38, spin, spin + Math.PI * 1.35);
            ctx.stroke();
            ctx.restore();
            return;
          }

          if (b.swordThrow) {
            const ang = Number.isFinite(b.angle) ? b.angle : Math.atan2(b.vy || 0, b.vx || 0);
            ctx.save();
            ctx.translate(b.x - cam.x, b.y - cam.y);
            ctx.rotate(ang);
            ctx.globalAlpha = 0.92;
            ctx.shadowColor = 'rgba(120,230,255,0.95)';
            ctx.shadowBlur = 18;
            ctx.strokeStyle = 'rgba(190,250,255,0.98)';
            ctx.lineWidth = 5;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(-30, 0);
            ctx.lineTo(30, 0);
            ctx.stroke();
            ctx.fillStyle = 'rgba(120,230,255,0.95)';
            ctx.beginPath();
            ctx.moveTo(34, 0);
            ctx.lineTo(18, -8);
            ctx.lineTo(20, 8);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = 'rgba(255,255,255,0.80)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(-18, -8);
            ctx.lineTo(-18, 8);
            ctx.stroke();
            ctx.restore();
            return;
          }

          ctx.fillStyle = b.color || '#fff';
          ctx.save();
          ctx.translate(b.x - cam.x, b.y - cam.y);
          const ang = Number.isFinite(b.angle) ? b.angle : Math.atan2(b.vy || 0, b.vx || 0);
          const bw = b.width || 10;
          const bh = b.height || 4;
          ctx.rotate(ang);
          if (b.timeBolt) {
            ctx.shadowColor = 'rgba(127,242,215,0.95)';
            ctx.shadowBlur = 18;
            ctx.fillStyle = 'rgba(127,242,215,0.96)';
            ctx.beginPath();
            ctx.ellipse(0, 0, bw * 0.55, Math.max(4, bh * 0.9), 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = 'rgba(255,255,255,0.88)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(-bw * 0.9, 0);
            ctx.lineTo(bw * 0.9, 0);
            ctx.stroke();
          } else if (b.rocketVisual) {
            ctx.shadowColor = 'rgba(255,140,70,0.95)';
            ctx.shadowBlur = 20;
            ctx.fillStyle = 'rgba(255,120,50,0.95)';
            ctx.beginPath();
            ctx.moveTo(bw / 2, 0);
            ctx.lineTo(-bw / 2, -bh / 2);
            ctx.lineTo(-bw * 0.35, 0);
            ctx.lineTo(-bw / 2, bh / 2);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = 'rgba(255,235,180,0.95)';
            ctx.fillRect(-bw * 0.56, -bh * 0.22, bw * 0.25, bh * 0.44);
            ctx.strokeStyle = 'rgba(255,255,255,0.75)';
            ctx.lineWidth = 2;
            ctx.stroke();
          } else {
            ctx.fillRect(-bw / 2, -bh / 2, bw, bh);
          }
          ctx.restore();
        });

        (enemyProjectilesRef.current || []).forEach((p) => {
          if (p.x < viewL || p.x > viewR || p.y < viewT || p.y > viewB) return;
          const sx = p.x - cam.x;
          const sy = p.y - cam.y;
          ctx.save();
          ctx.globalAlpha = 0.94;
          ctx.shadowColor = p.acid ? 'rgba(100,255,122,1)' : 'rgba(255,82,28,1)';
          ctx.shadowBlur = perfCrowded ? 0 : 24;
          ctx.fillStyle = p.acid ? 'rgba(100,255,122,0.95)' : 'rgba(255,92,28,0.95)';
          ctx.beginPath();
          ctx.arc(sx, sy, p.r || 13, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = p.acid ? 'rgba(220,255,210,0.95)' : 'rgba(255,235,190,0.95)';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(sx, sy, (p.r || 13) + 5, 0, Math.PI * 2);
          ctx.stroke();
          const speed = Math.hypot(p.vx || 0, p.vy || 0) || 1;
          ctx.strokeStyle = p.acid ? 'rgba(100,255,122,0.42)' : 'rgba(255,92,28,0.45)';
          ctx.lineWidth = 7;
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(sx - ((p.vx || 0) / speed) * 44, sy - ((p.vy || 0) / speed) * 44);
          ctx.stroke();
          ctx.restore();
        });

        // Enemies
        enemiesRef.current.forEach(e => {
          if (e.x < viewL || e.x > viewR || e.y < viewT || e.y > viewB) return;

          const sx = e.x - cam.x;
          const sy = e.y - cam.y;

          if (e.hidden) {
            ctx.save();
            ctx.globalAlpha = 0.34 + Math.abs(Math.sin(now / 90)) * 0.22;
            ctx.strokeStyle = 'rgba(192,139,255,0.95)';
            ctx.lineWidth = 4;
            ctx.setLineDash([12, 10]);
            ctx.beginPath();
            ctx.arc(sx, sy, e.size * 1.1, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
            return;
          }

          ctx.fillStyle = e.color || '#ff007a';
          if (e.type === 'boss' || e.type === 'boss_split') {
            const a = (Date.now() / 900) % (Math.PI * 2);
            ctx.save();
            ctx.translate(sx, sy);
            ctx.rotate(a * (e.type === 'boss_split' ? 0.42 : 0.16));
            ctx.shadowColor = e.type === 'boss_split' ? 'rgba(166,255,72,0.92)' : 'rgba(255,218,107,0.8)';
            ctx.shadowBlur = 26;
            ctx.fillStyle = e.type === 'boss_split' ? (e.color || '#a7ff48') : (e.color || '#ffda6b');
            ctx.beginPath();
            const points = e.type === 'boss_split' ? 12 : 10;
            for (let i = 0; i < points; i += 1) {
              const rr = (e.size * (i % 2 ? (e.type === 'boss_split' ? 0.30 : 0.42) : 0.62));
              const aa = -Math.PI / 2 + (Math.PI * 2 * i) / points;
              const x = Math.cos(aa) * rr;
              const y = Math.sin(aa) * rr;
              if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
            }
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = 'rgba(255,255,255,0.85)';
            ctx.lineWidth = 4;
            ctx.stroke();
            ctx.restore();
          } else if (e.type === 'abomination') {
            ctx.save();
            ctx.translate(sx, sy);
            const pulse = 0.92 + Math.sin(Date.now() / 180) * 0.04;
            ctx.scale(pulse, pulse);
            ctx.shadowColor = 'rgba(255,120,80,0.55)';
            ctx.shadowBlur = 20;
            ctx.fillStyle = '#b98a78';
            ctx.fillRect(-e.size * 0.24, -e.size * 0.44, e.size * 0.48, e.size * 0.62);
            ctx.fillStyle = '#d7b6a0';
            ctx.beginPath();
            ctx.arc(0, -e.size * 0.63, e.size * 0.18, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#7cff76';
            ctx.fillRect(-e.size * 0.35, -e.size * 0.22, e.size * 0.18, e.size * 0.24);
            ctx.fillStyle = '#ff7a5c';
            ctx.fillRect(e.size * 0.16, -e.size * 0.32, e.size * 0.20, e.size * 0.32);
            ctx.fillStyle = '#6c4dff';
            ctx.fillRect(-e.size * 0.52, -e.size * 0.26, e.size * 0.20, e.size * 0.52);
            ctx.fillStyle = '#ffd36b';
            ctx.fillRect(e.size * 0.32, -e.size * 0.18, e.size * 0.20, e.size * 0.50);
            ctx.fillStyle = '#83584f';
            ctx.fillRect(-e.size * 0.18, e.size * 0.14, e.size * 0.14, e.size * 0.42);
            ctx.fillStyle = '#4a7cff';
            ctx.fillRect(e.size * 0.04, e.size * 0.14, e.size * 0.14, e.size * 0.42);
            ctx.strokeStyle = 'rgba(255,255,255,0.82)';
            ctx.lineWidth = 3;
            ctx.strokeRect(-e.size * 0.24, -e.size * 0.44, e.size * 0.48, e.size * 0.62);
            ctx.restore();
          } else if (e.type === 'spitter') {
            ctx.save();
            ctx.translate(sx, sy);
            ctx.shadowColor = perfCrowded ? 'transparent' : 'rgba(100,255,122,0.55)';
            ctx.shadowBlur = perfCrowded ? 0 : 16;
            ctx.fillStyle = '#64ff7a';
            ctx.beginPath();
            ctx.moveTo(0, -e.size * 0.62);
            ctx.lineTo(e.size * 0.56, e.size * 0.42);
            ctx.lineTo(0, e.size * 0.22);
            ctx.lineTo(-e.size * 0.56, e.size * 0.42);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = 'rgba(8,40,18,0.95)';
            ctx.beginPath();
            ctx.arc(0, -e.size * 0.05, e.size * 0.18, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          } else if (e.type === 'grab_ghost') {
            ctx.save();
            ctx.translate(sx, sy);
            const pulse = 0.86 + Math.abs(Math.sin(Date.now() / 120)) * 0.14;
            ctx.shadowColor = 'rgba(185,242,255,0.85)';
            ctx.shadowBlur = perfCrowded ? 8 : 22;
            ctx.scale(pulse, pulse);
            ctx.fillStyle = '#b9f2ff';
            ctx.beginPath();
            ctx.moveTo(0, -e.size * 0.68);
            ctx.quadraticCurveTo(e.size * 0.62, -e.size * 0.26, e.size * 0.34, e.size * 0.38);
            ctx.quadraticCurveTo(e.size * 0.12, e.size * 0.14, 0, e.size * 0.64);
            ctx.quadraticCurveTo(-e.size * 0.12, e.size * 0.14, -e.size * 0.34, e.size * 0.38);
            ctx.quadraticCurveTo(-e.size * 0.62, -e.size * 0.26, 0, -e.size * 0.68);
            ctx.fill();
            ctx.strokeStyle = 'rgba(255,255,255,0.82)';
            ctx.lineWidth = 3;
            ctx.stroke();
            ctx.strokeStyle = 'rgba(185,242,255,0.72)';
            ctx.lineWidth = 4;
            for (const off of [-0.4, 0, 0.4]) {
              ctx.beginPath();
              ctx.moveTo(off * e.size, e.size * 0.18);
              ctx.quadraticCurveTo(off * e.size * 1.8, e.size * 0.72, off * e.size * 0.7, e.size * 1.05);
              ctx.stroke();
            }
            if (playerGrabRef.current?.enemyId === e.id && Date.now() < (playerGrabRef.current.until || 0)) {
              ctx.globalAlpha = 0.28;
              ctx.lineWidth = 8;
              ctx.beginPath();
              ctx.arc(0, 0, e.size * 1.55, 0, Math.PI * 2);
              ctx.stroke();
            }
            ctx.restore();
          } else if (e.type === 'splitter' || e.type === 'splitter_boss') {
            ctx.save();
            ctx.translate(sx, sy);
            ctx.fillStyle = e.color || '#b6ff4a';
            ctx.strokeStyle = 'rgba(255,255,255,0.76)';
            ctx.lineWidth = e.type === 'splitter_boss' ? 4 : 2;
            ctx.beginPath();
            const points = e.type === 'splitter_boss' ? 8 : 6;
            for (let i = 0; i < points; i += 1) {
              const a = -Math.PI / 2 + (i / points) * Math.PI * 2;
              const r = e.size * (i % 2 ? 0.32 : 0.58);
              const x = Math.cos(a) * r;
              const y = Math.sin(a) * r;
              if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
            }
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            ctx.restore();
          } else if (e.type === 'burrower') {
            ctx.save();
            ctx.translate(sx, sy);
            ctx.fillStyle = '#c08bff';
            ctx.strokeStyle = 'rgba(255,255,255,0.74)';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.ellipse(0, 0, e.size * 0.65, e.size * 0.42, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = 'rgba(35,16,65,0.95)';
            ctx.fillRect(-e.size * 0.15, -e.size * 0.42, e.size * 0.30, e.size * 0.84);
            ctx.restore();
          } else if (e.type === 'pylon') {
            const charge = e.pylonMonster ? 1 : clamp(e.pylonCharge || 0, 0, 1);
            ctx.save();
            ctx.translate(sx, sy);
            ctx.shadowColor = perfCrowded ? 'transparent' : 'rgba(127,242,215,0.86)';
            ctx.shadowBlur = perfCrowded ? 0 : 28;
            ctx.strokeStyle = 'rgba(127,242,215,0.9)';
            ctx.lineWidth = 5;
            if (e.pylonMonster) {
              ctx.strokeStyle = 'rgba(53,255,213,0.92)';
              ctx.lineWidth = 12;
              for (const side of [-1, 1]) {
                ctx.beginPath();
                ctx.moveTo(side * e.size * 0.20, -e.size * 0.15);
                ctx.quadraticCurveTo(side * e.size * 0.72, -e.size * 0.02, side * e.size * 0.80, e.size * 0.40);
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(side * e.size * 0.10, e.size * 0.10);
                ctx.quadraticCurveTo(side * e.size * 0.62, e.size * 0.32, side * e.size * 0.52, e.size * 0.70);
                ctx.stroke();
              }
              ctx.strokeStyle = 'rgba(255,255,255,0.76)';
              ctx.lineWidth = 5;
            }
            ctx.fillStyle = e.pylonMonster ? 'rgba(53,255,213,0.92)' : 'rgba(20,65,78,0.92)';
            ctx.beginPath();
            const pts = e.pylonMonster ? 9 : 6;
            for (let i = 0; i < pts; i += 1) {
              const a = -Math.PI / 2 + (i / pts) * Math.PI * 2 + Date.now() / (e.pylonMonster ? 500 : 900);
              const r = e.size * (i % 2 ? 0.34 : 0.58);
              const x = Math.cos(a) * r;
              const y = Math.sin(a) * r;
              if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
            }
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            if (!e.pylonMonster) {
              ctx.globalAlpha = 0.12 + charge * 0.18;
              ctx.fillStyle = 'rgba(127,242,215,0.34)';
              ctx.beginPath();
              ctx.arc(0, 0, (e.pylonPullRadius || 680) * (0.9 + charge * 0.35), 0, Math.PI * 2);
              ctx.fill();
              ctx.globalAlpha = 0.24 + charge * 0.24;
              ctx.strokeStyle = 'rgba(127,242,215,1)';
              ctx.lineWidth = 8;
              ctx.beginPath();
              ctx.arc(0, 0, (e.pylonPullRadius || 680) * (0.9 + charge * 0.35), 0, Math.PI * 2);
              ctx.stroke();
              ctx.globalAlpha = 0.9;
              ctx.fillStyle = '#ffffff';
              ctx.font = 'bold 12px sans-serif';
              ctx.textAlign = 'center';
              ctx.fillText(`${Math.floor(charge * 100)}%`, 0, -e.size * 0.78);
            }
            ctx.restore();
          } else if (e.type === 'ghost' || e.type === 'ghost_spirit') {
            ctx.save();
            ctx.translate(sx, sy);
            ctx.globalAlpha = e.type === 'ghost_spirit' ? 0.46 : 0.86;
            ctx.shadowColor = 'rgba(205,215,255,0.70)';
            ctx.shadowBlur = e.type === 'ghost_spirit' ? 18 : 12;
            ctx.fillStyle = e.type === 'ghost_spirit' ? 'rgba(150,154,168,0.62)' : (e.color || '#c6cad6');
            ctx.beginPath();
            ctx.moveTo(0, -e.size * 0.62);
            ctx.quadraticCurveTo(e.size * 0.52, -e.size * 0.18, e.size * 0.34, e.size * 0.44);
            ctx.quadraticCurveTo(e.size * 0.10, e.size * 0.28, 0, e.size * 0.58);
            ctx.quadraticCurveTo(-e.size * 0.10, e.size * 0.28, -e.size * 0.34, e.size * 0.44);
            ctx.quadraticCurveTo(-e.size * 0.52, -e.size * 0.18, 0, -e.size * 0.62);
            ctx.fill();
            if (e.type === 'ghost_spirit') {
              ctx.strokeStyle = 'rgba(255,255,255,0.42)';
              ctx.lineWidth = 2;
              ctx.stroke();
              const reviveLeft = (e.reviveAt || 0) - Date.now();
              if (reviveLeft > 0 && reviveLeft <= 2200) {
                const pulse = 0.55 + 0.45 * Math.abs(Math.sin(Date.now() / 110));
                ctx.globalAlpha = pulse;
                ctx.strokeStyle = 'rgba(255,255,255,0.9)';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(0, 0, e.size * (0.9 + (2200 - reviveLeft) / 2200 * 0.45), 0, Math.PI * 2);
                ctx.stroke();
                ctx.fillStyle = 'rgba(255,255,255,0.95)';
                ctx.font = 'bold 12px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('REVIVE', 0, -e.size - 10);
              }
            }
            ctx.restore();
          } else {
            ctx.fillRect(sx - e.size / 2, sy - e.size / 2, e.size, e.size);
          }

          const isMini = String(e.type || '').startsWith('mini_');

          if (e.type === 'mini_charger' && Array.isArray(e.ramPath) && e.ramPath.length) {
            ctx.save();
            const windup = e.ramPathWindupUntil && Date.now() < e.ramPathWindupUntil;
            ctx.globalAlpha = windup ? 0.78 : 0.48;
            e.ramPath.forEach((seg, idx) => {
              const x1 = seg.x1 - cam.x;
              const y1 = seg.y1 - cam.y;
              const x2 = seg.x2 - cam.x;
              const y2 = seg.y2 - cam.y;
              ctx.strokeStyle = idx === (e.ramPathDashIndex || 0) && !windup ? 'rgba(255,255,255,0.92)' : 'rgba(255,54,86,0.82)';
              ctx.lineWidth = windup ? 12 : 8;
              ctx.beginPath();
              ctx.moveTo(x1, y1);
              ctx.lineTo(x2, y2);
              ctx.stroke();
              ctx.strokeStyle = 'rgba(255,222,92,0.72)';
              ctx.lineWidth = windup ? 3 : 2;
              ctx.beginPath();
              ctx.moveTo(x1, y1);
              ctx.lineTo(x2, y2);
              ctx.stroke();
              ctx.fillStyle = idx === e.ramPath.length - 1 ? 'rgba(255,255,255,0.95)' : 'rgba(255,54,86,0.92)';
              ctx.beginPath();
              ctx.arc(x2, y2, 8, 0, Math.PI * 2);
              ctx.fill();
            });
            ctx.restore();
          }

          // RAM telegraph lane (only during windup)
          if ((e.type === 'mini_charger' || e.type === 'tiny_ram') && !e.ramPath && e.windupUntil && Date.now() < e.windupUntil) {
            const ang = e.dashDir || 0;
            const len = e.dashLen ?? 420;

            ctx.save();
            ctx.globalAlpha = 0.55;

            ctx.strokeStyle = e.secondDashTelegraph ? 'rgba(255,70,70,0.82)' : 'rgba(255,255,255,0.55)';
            ctx.lineWidth = 10;
            ctx.beginPath();
            ctx.moveTo(sx, sy);
            ctx.lineTo(sx + Math.cos(ang) * len, sy + Math.sin(ang) * len);
            ctx.stroke();

            ctx.globalAlpha = 0.35;
            ctx.strokeStyle = e.secondDashTelegraph ? 'rgba(255,40,40,0.95)' : 'rgba(255,220,107,0.9)';
            ctx.lineWidth = 18;
            ctx.beginPath();
            ctx.moveTo(sx, sy);
            ctx.lineTo(sx + Math.cos(ang) * len, sy + Math.sin(ang) * len);
            ctx.stroke();

            ctx.globalAlpha = 0.8;
            ctx.fillStyle = e.secondDashTelegraph ? 'rgba(255,70,70,0.98)' : 'rgba(255,220,107,0.95)';
            ctx.beginPath();
            ctx.arc(sx + Math.cos(ang) * len, sy + Math.sin(ang) * len, 9, 0, Math.PI * 2);
            ctx.fill();

            ctx.restore();
          }

          if (isMini) {
            ctx.save();
            ctx.lineWidth = 4;
            ctx.strokeStyle = '#ffffff';
            ctx.strokeRect(sx - e.size / 2 - 2, sy - e.size / 2 - 2, e.size + 4, e.size + 4);

            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.moveTo(sx, sy - e.size / 2 - 18);
            ctx.lineTo(sx - 10, sy - e.size / 2 - 2);
            ctx.lineTo(sx + 10, sy - e.size / 2 - 2);
            ctx.closePath();
            ctx.fill();

            ctx.font = '12px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(e.type === 'tiny_ram' ? 'ram' : e.type === 'mini_charger' ? 'RAM' : 'MINI', sx, sy - e.size / 2 - 26);
            ctx.restore();
          }

          if (e.hp < e.maxHp) {
            const barW = isMini ? Math.max(90, e.size) : e.size;
            const barX = sx - barW / 2;
            const barY = sy - e.size / 2 - (isMini ? 14 : 8);
            ctx.fillStyle = '#222';
            ctx.fillRect(barX, barY, barW, 5);
            ctx.fillStyle = isMini ? '#ffe16b' : '#ff007a';
            ctx.fillRect(barX, barY, barW * (e.hp / e.maxHp), 5);
            if (e.healthSegments) {
              for (let si = 0; si < e.healthSegments; si += 1) {
                const y = barY + 8 + si * 7;
                const segPct = clamp((e.hp / e.maxHp) * e.healthSegments - si, 0, 1);
                ctx.fillStyle = 'rgba(10,20,12,0.85)';
                ctx.fillRect(barX, y, barW, 4);
                ctx.fillStyle = si % 2 ? '#83ff76' : '#ffda6b';
                ctx.fillRect(barX, y, barW * segPct, 4);
              }
            }
          }

          if (e.burnUntil && Date.now() < e.burnUntil) {
            const bleedSeed = Number(String(e.id).replace(/\D/g, '').slice(-3)) || 0;
            const bleedT = Math.abs(Math.sin(Date.now() / 115 + bleedSeed));
            ctx.save();
            ctx.globalAlpha = 0.55 + bleedT * 0.35;
            ctx.fillStyle = 'rgba(255,20,20,0.95)';
            ctx.shadowColor = 'rgba(255,0,0,0.85)';
            ctx.shadowBlur = 14;
            for (let i = 0; i < 3; i += 1) {
              const ox = ((i - 1) * 7) + Math.sin(Date.now() / (170 + i * 31)) * 4;
              const oy = e.size * 0.24 + i * 5 + bleedT * 7;
              ctx.beginPath();
              ctx.arc(sx + ox, sy + oy, 3 + i * 0.8, 0, Math.PI * 2);
              ctx.fill();
            }
            ctx.restore();
          }

          if (e.shieldedBy && Date.now() < (e.shieldedUntil || 0)) {
            const pulse = 0.55 + 0.45 * Math.abs(Math.sin(Date.now() / 120));
            ctx.save();
            ctx.globalAlpha = 0.28 + pulse * 0.24;
            ctx.strokeStyle = 'rgba(102,217,255,0.98)';
            ctx.lineWidth = 4;
            ctx.shadowColor = perfCrowded ? 'transparent' : 'rgba(102,217,255,0.95)';
            ctx.shadowBlur = perfCrowded ? 0 : 20;
            ctx.beginPath();
            ctx.arc(sx, sy, e.size * 0.78 + pulse * 7, 0, Math.PI * 2);
            ctx.stroke();
            ctx.globalAlpha = 0.12;
            ctx.fillStyle = 'rgba(102,217,255,0.98)';
            ctx.beginPath();
            ctx.arc(sx, sy, e.size * 0.82 + pulse * 7, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }

          if (e.type === 'boss' && e.bossWindupUntil && Date.now() < e.bossWindupUntil) {
            const ang = e.bossRamDir || 0;
            const len = e.bossDashLen ?? 760;
            const pulse = 0.55 + Math.sin(Date.now() / 55) * 0.25;
            ctx.save();
            ctx.globalAlpha = 0.46 + pulse * 0.22;
            ctx.strokeStyle = 'rgba(255,255,255,0.70)';
            ctx.lineWidth = 14;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(sx, sy);
            ctx.lineTo(sx + Math.cos(ang) * len, sy + Math.sin(ang) * len);
            ctx.stroke();

            ctx.globalAlpha = 0.32 + pulse * 0.18;
            ctx.strokeStyle = 'rgba(255,40,20,0.95)';
            ctx.lineWidth = 34;
            ctx.beginPath();
            ctx.moveTo(sx, sy);
            ctx.lineTo(sx + Math.cos(ang) * len, sy + Math.sin(ang) * len);
            ctx.stroke();

            ctx.fillStyle = 'rgba(255,70,30,0.96)';
            ctx.beginPath();
            ctx.arc(sx + Math.cos(ang) * len, sy + Math.sin(ang) * len, 14, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }
        });

        // VFX
        const nowV = now;

        (deathFxRef.current || []).forEach((f) => {
          const a = clamp(1 - (nowV - f.t) / 280, 0, 1);
          if (a <= 0) return;
          const r = (f.size || 40) * (0.9 + (1 - a) * 0.8);
          ctx.save();
          ctx.globalAlpha = a * 0.55;
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(f.x - cam.x, f.y - cam.y, r, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        });

        (explosionsRef.current || []).forEach((e) => {
          const a = clamp(1 - (nowV - e.t) / (e.life || 300), 0, 1);
          if (a <= 0) return;
          const p = 1 + (nowV - e.t) / (e.life || 300);
          const rr = (e.r || 80) * p;

          const col = e.color || (e.hazard ? 'rgba(255,120,120,1)' : 'rgba(255,255,255,1)');
          const lw = Math.max(1, e.lineWidth || (e.hazard ? 3 : 2));
          const alphaMult = typeof e.alpha === 'number' ? e.alpha : (e.hazard ? 0.35 : 0.45);

          ctx.save();

          // glow for big procs (ghost/thorns/etc.)
          if (e.glow && !perfCrowded) {
            ctx.shadowColor = col;
            ctx.shadowBlur = e.glow;
          }

          // optional fill flash
          if (e.fill && !perfCrowded) {
            const gx = e.x - cam.x;
            const gy = e.y - cam.y;
            const grad = ctx.createRadialGradient(gx, gy, 0, gx, gy, rr);
            grad.addColorStop(0, col);
            grad.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.globalAlpha = a * (alphaMult * 0.55);
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(gx, gy, rr, 0, Math.PI * 2);
            ctx.fill();
          }

          ctx.globalAlpha = a * alphaMult;
          ctx.strokeStyle = col;
          ctx.lineWidth = lw;
          ctx.beginPath();
          ctx.arc(e.x - cam.x, e.y - cam.y, rr, 0, Math.PI * 2);
          ctx.stroke();

          ctx.restore();
        });

        const drawAxeCleave = (s) => {
          const age = s.age || 0;
          if (age < (s.delay || 0)) return;
          const activeMs = s.activeMs || 180;
          if (age > (s.delay || 0) + activeMs) return;
          const pct = clamp((age - (s.delay || 0)) / activeMs, 0, 1);
          const fade = 1 - pct;
          const side = s.side || 1;
          const swing = (side < 0 ? -0.18 : 0.18) * (1 - pct);
          const ang = (s.angle || 0) + swing;
          const r = s.range || 190;
          const sx = s.x - cam.x;
          const sy = s.y - cam.y;
          const col = s.color || 'rgba(255,70,30,1)';

          ctx.save();
          ctx.translate(sx, sy);
          ctx.rotate(ang);
          ctx.globalAlpha = 0.25 + fade * 0.55;
          ctx.shadowColor = s.glowColor || col;
          ctx.shadowBlur = s.glowBlur || 28;

          ctx.strokeStyle = 'rgba(85,28,20,0.96)';
          ctx.lineWidth = 10;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(r * 0.10, side * 8);
          ctx.lineTo(r * 0.70, side * 24);
          ctx.stroke();

          ctx.fillStyle = col;
          ctx.strokeStyle = 'rgba(255,235,210,0.78)';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(r * 0.42, side * -18);
          ctx.lineTo(r * 0.98, side * -74);
          ctx.quadraticCurveTo(r * 1.10, side * 0, r * 0.98, side * 74);
          ctx.lineTo(r * 0.42, side * 18);
          ctx.quadraticCurveTo(r * 0.58, side * 0, r * 0.42, side * -18);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          ctx.globalAlpha = fade * 0.36;
          ctx.strokeStyle = col;
          ctx.lineWidth = 10;
          ctx.beginPath();
          ctx.moveTo(r * 0.15, 0);
          ctx.lineTo(r * 0.98, side * 86);
          ctx.stroke();
          ctx.restore();
        };

        const drawAxeSlam = (s) => {
          const age = s.age || 0;
          if (age < (s.delay || 0)) return;
          const activeMs = s.activeMs || 220;
          if (age > (s.delay || 0) + activeMs) return;
          const pct = clamp((age - (s.delay || 0)) / activeMs, 0, 1);
          const fade = 1 - pct;
          const sx = s.x - cam.x;
          const sy = s.y - cam.y;
          const ang = s.angle || 0;
          const r = s.range || 220;

          ctx.save();
          ctx.translate(sx, sy);
          ctx.rotate(ang);
          ctx.globalAlpha = 0.35 + fade * 0.50;
          ctx.shadowColor = 'rgba(255,20,0,0.95)';
          ctx.shadowBlur = 42;
          ctx.fillStyle = 'rgba(255,42,18,0.95)';
          ctx.strokeStyle = 'rgba(255,235,210,0.85)';
          ctx.lineWidth = 4;

          [-1, 1].forEach((side) => {
            ctx.beginPath();
            ctx.moveTo(r * 0.12, side * 14);
            ctx.lineTo(r * 0.84, side * 84);
            ctx.quadraticCurveTo(r * 1.18, side * 24, r * 0.94, side * -42);
            ctx.lineTo(r * 0.22, side * -16);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
          });

          ctx.globalAlpha = fade * 0.65;
          ctx.strokeStyle = 'rgba(255,80,30,0.92)';
          ctx.lineWidth = 8;
          ctx.beginPath();
          ctx.arc(0, 0, (s.shockwaveRadius || 180) * (0.65 + pct * 0.55), 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        };

        const drawAxeStorm = (s) => {
          const age = s.age || 0;
          if (age < (s.delay || 0)) return;
          const activeMs = s.activeMs || 520;
          if (age > (s.delay || 0) + activeMs) return;
          const pct = clamp((age - (s.delay || 0)) / activeMs, 0, 1);
          const fade = 1 - pct;
          const r = s.range || 190;
          const sx = s.x - cam.x;
          const sy = s.y - cam.y;
          const rot = Date.now() / 95;

          ctx.save();
          ctx.translate(sx, sy);
          ctx.globalAlpha = 0.24 + fade * 0.58;
          ctx.shadowColor = 'rgba(255,28,0,0.92)';
          ctx.shadowBlur = 34;

          ctx.strokeStyle = 'rgba(255,48,18,0.95)';
          ctx.lineWidth = 14;
          ctx.lineCap = 'round';
          for (let i = 0; i < 3; i += 1) {
            const start = rot + i * Math.PI * 0.67;
            ctx.beginPath();
            ctx.arc(0, 0, r * (0.70 + i * 0.10), start, start + Math.PI * 0.92);
            ctx.stroke();
          }

          ctx.globalAlpha = 0.86;
          ctx.rotate(rot);
          [-1, 1].forEach((side) => {
            ctx.save();
            ctx.rotate(side * Math.PI * 0.72);
            ctx.strokeStyle = 'rgba(92,42,26,1)';
            ctx.lineWidth = 8;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(-18, 0);
            ctx.lineTo(r * 0.58, 0);
            ctx.stroke();

            ctx.fillStyle = side < 0 ? 'rgba(255,48,20,0.98)' : 'rgba(255,118,40,0.98)';
            ctx.strokeStyle = 'rgba(255,230,205,0.82)';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(r * 0.42, -26);
            ctx.lineTo(r * 0.76, -44);
            ctx.quadraticCurveTo(r * 0.92, 0, r * 0.76, 44);
            ctx.lineTo(r * 0.42, 26);
            ctx.quadraticCurveTo(r * 0.56, 0, r * 0.42, -26);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            ctx.restore();
          });

          ctx.globalAlpha = fade * 0.28;
          ctx.strokeStyle = 'rgba(255,245,220,0.86)';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(0, 0, r * 0.98, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        };

        if (nowV < thornsActiveUntilRef.current) {
          const p = playerRef.current;
          const pulse = 0.5 + Math.sin(nowV / 85) * 0.5;
          ctx.save();
          ctx.translate(p.x - cam.x, p.y - cam.y);
          ctx.shadowColor = 'rgba(0,255,160,0.95)';
          ctx.shadowBlur = 28 + pulse * 18;
          ctx.strokeStyle = 'rgba(0,255,160,0.88)';
          ctx.lineWidth = 5;
          ctx.beginPath();
          ctx.arc(0, 0, 48 + pulse * 10, 0, Math.PI * 2);
          ctx.stroke();
          ctx.strokeStyle = 'rgba(255,255,255,0.70)';
          ctx.lineWidth = 2;
          for (let i = 0; i < 16; i += 1) {
            const a = (i / 16) * Math.PI * 2 + nowV / 170;
            ctx.beginPath();
            ctx.moveTo(Math.cos(a) * 54, Math.sin(a) * 54);
            ctx.lineTo(Math.cos(a) * (78 + pulse * 12), Math.sin(a) * (78 + pulse * 12));
            ctx.stroke();
          }
          ctx.restore();
        }

        if (decoyRef.current && nowV < decoyRef.current.until) {
          const d = decoyRef.current;
          const a = clamp((d.until - nowV) / 8000, 0, 1);
          ctx.save();
          ctx.globalAlpha = 0.35 + a * 0.35;
          ctx.translate(d.x - cam.x, d.y - cam.y);
          ctx.shadowColor = 'rgba(0,242,255,0.95)';
          ctx.shadowBlur = 26;
          ctx.strokeStyle = 'rgba(0,242,255,0.95)';
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.arc(0, 0, 36 + Math.sin(nowV / 120) * 5, 0, Math.PI * 2);
          ctx.stroke();
          ctx.fillStyle = 'rgba(255,255,255,0.78)';
          ctx.fillRect(-12, -12, 24, 24);
          ctx.restore();
        }

        if (talentsRef.current.droneOrbit && nowV < droneUntilRef.current) {
          const p = playerRef.current;
          const left = nowV / 185;
          const entry = clamp((nowV - (droneBurstToastRef.current || nowV)) / 700, 0, 1);
          [-1, 1].forEach((side) => {
            const a = left + side * Math.PI * 0.88;
            const r = 92 + Math.sin(nowV / 140 + side) * 10;
            const x = p.x + Math.cos(a) * r;
            const y = p.y + Math.sin(a) * r;
            ctx.save();
            ctx.translate(x - cam.x, y - cam.y);
            ctx.rotate(a + Math.PI / 2);
            ctx.globalAlpha = 0.72 + entry * 0.28;
            ctx.shadowColor = 'rgba(255,218,107,0.90)';
            ctx.shadowBlur = 20;
            ctx.fillStyle = 'rgba(35,42,48,0.98)';
            ctx.strokeStyle = 'rgba(255,218,107,0.95)';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.roundRect(-18, -12, 36, 24, 8);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = 'rgba(0,242,255,0.95)';
            ctx.fillRect(-7, -6, 14, 12);
            ctx.strokeStyle = 'rgba(255,255,255,0.85)';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(-26, -8);
            ctx.lineTo(-40, -8);
            ctx.moveTo(26, -8);
            ctx.lineTo(40, -8);
            ctx.stroke();
            ctx.restore();
          });
        }

        (arcsRef.current || []).forEach((aObj) => {
          const a = clamp(1 - (nowV - aObj.t) / (aObj.life || 150), 0, 1);
          if (a <= 0) return;
          ctx.save();
          ctx.globalAlpha = a * 0.9;
          ctx.strokeStyle = aObj.color || 'rgba(170,220,255,1)';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(aObj.x1 - cam.x, aObj.y1 - cam.y);
          ctx.lineTo(aObj.x2 - cam.x, aObj.y2 - cam.y);
          ctx.stroke();
          ctx.restore();
        });

        (railLinesRef.current || []).forEach((l) => {
          const a = clamp(1 - (nowV - l.t) / (l.life || 120), 0, 1);
          if (a <= 0) return;
          ctx.save();
          ctx.globalAlpha = a * 0.75;
          ctx.strokeStyle = l.color || 'rgba(180,255,245,1)';
          ctx.lineWidth = Math.max(2, (l.width || 10) * 0.45);
          ctx.beginPath();
          ctx.moveTo(l.x1 - cam.x, l.y1 - cam.y);
          ctx.lineTo(l.x2 - cam.x, l.y2 - cam.y);
          ctx.stroke();
          ctx.restore();
        });

        (beamsRef.current || []).forEach((b) => {
          const a = clamp(1 - (nowV - b.t) / (b.life || 120), 0, 1);
          if (a <= 0) return;
          ctx.save();
          ctx.globalAlpha = a * 0.55;
          ctx.strokeStyle = 'rgba(255,160,245,1)';
          ctx.lineWidth = Math.max(4, b.width || 18);
          ctx.beginPath();
          ctx.moveTo(b.x1 - cam.x, b.y1 - cam.y);
          ctx.lineTo(b.x2 - cam.x, b.y2 - cam.y);
          ctx.stroke();
          ctx.restore();
        });

        (slashesRef.current || []).forEach((s) => {
          if (s.kind === 'axeCleave') {
            drawAxeCleave(s);
            return;
          }
          if (s.kind === 'axeSlam') {
            drawAxeSlam(s);
            return;
          }
          if (s.kind === 'axeStorm') {
            drawAxeStorm(s);
            return;
          }
          const age = s.age || 0;
          if (age < (s.delay || 0)) return;
          const activeMs = s.activeMs || 120;
          if (age > (s.delay || 0) + activeMs) return;

          const a = 1 - (age - (s.delay || 0)) / activeMs;
          ctx.save();
          ctx.globalAlpha = clamp(a, 0, 1) * 0.85;
          const col = s.color || 'rgba(255,255,255,1)';
          const lw = s.lineWidth || 10;
          ctx.strokeStyle = col;
          ctx.lineWidth = lw;

          if (s.glowColor) {
            ctx.shadowColor = s.glowColor;
            ctx.shadowBlur = s.glowBlur || 14;
          }

          const r = s.range || 160;
          const start = (s.angle || 0) - (s.arc || 0) / 2;
          const end = (s.angle || 0) + (s.arc || 0) / 2;
          ctx.beginPath();
          ctx.arc(s.x - cam.x, s.y - cam.y, r, start, end);
          ctx.stroke();
          ctx.restore();
        });
      }
      // --- CANVAS DRAWING END ---

      // advance clocks
      elapsed.current += frameDelta;

      // Progress is time-based. Events and RAMs are pressure spikes, not hidden blockers.
      progElapsedRef.current += frameDelta;


      if (now - progressLastSyncRef.current > 33) {
        progressLastSyncRef.current = now;
        setProgress(Math.min(1, progElapsedRef.current / (runTimeRef.current || BOSS_TIME)));
      }

      if (extractionRef.current.active) {
        const ex = extractionRef.current;
        const ppEx = playerRef.current;
        const dEx = Math.hypot(ppEx.x - ex.x, ppEx.y - ex.y);
        const extractionRadius = ex.radius || 172;
        const inside = dEx <= extractionRadius;
        ex.progress = clamp((ex.progress || 0) + (inside ? frameDelta / 9000 : -frameDelta / 17000), 0, 1);
        if (now - progressLastSyncRef.current < 18) setExtractionUI({ ...ex });
        if (ex.progress >= 1) {
          ex.active = false;
          setExtractionUI({ ...ex, active: false, progress: 1 });
          setVictory(true);
          juicePunch(1.25, 1.0);
        }
      }

      // randomized beats
      scheduleBeats();

      // decay VFX (throttled)
      if (elapsed.current % 160 === 0) {
        const nowV = Date.now();
        deathFxRef.current = (deathFxRef.current || []).filter((f) => nowV - f.t < 280);
        arcsRef.current = (arcsRef.current || []).filter((a) => nowV - a.t < (a.life || 150)).slice(-PERF_ARC_CAP);
        explosionsRef.current = (explosionsRef.current || []).filter((e) => nowV - e.t < (e.life || 280)).slice(-PERF_EFFECT_CAP);
        railLinesRef.current = (railLinesRef.current || []).filter((l) => nowV - l.t < (l.life || 120));
        beamsRef.current = (beamsRef.current || []).filter((b) => nowV - b.t < (b.life || 120));
        slashesRef.current = (slashesRef.current || []).filter((s) => nowV - (s.t || (nowV - (s.age || 0))) < (s.life || 260)).slice(-48);
        {
          const before = (pickupsRef.current || []);
          const kept = before.filter((p) => nowV - p.t < p.life);
          if (kept.length !== before.length) {
            const expired = before.filter((p) => nowV - p.t >= p.life);
            const counts = {};
            for (const p of expired) {
              const k = String(p.type || '');
              counts[k] = (counts[k] || 0) + 1;
            }
            for (const [k, n] of Object.entries(counts)) {
              const label = PICKUP_DEFS[k]?.title || k || 'Pickup';
              pushToast(`${label} expired${n > 1 ? ` (${n})` : ''}`);
            }
          }
          pickupsRef.current = kept;
        }

        // Buff expiration popups
        {
          const cur = {
            thorns: nowV < thornsActiveUntilRef.current,
            magnet: nowV < magnetUntil.current,
            freeze: nowV < freezeUntil.current,
            overdrive: nowV < overdriveUntil.current,
            doubleDamage: nowV < doubleDamageUntil.current,
            shield: nowV < shieldUntil.current,
            adrenal: nowV < milAdrenalMoveUntilRef.current,
          };

          const prev = prevBuffsRef.current || {};
          const labels = {
            thorns: '🌵 THORNS',
            magnet: '🧲 MAGNET',
            freeze: '❄ FREEZE',
            overdrive: '⚡ OVERDRIVE',
            shield: '🛡 SHIELD',
            adrenal: '💉 ADRENAL',
          };
          for (const k of Object.keys(labels)) {
            if (prev[k] && !cur[k] && k !== 'thorns') {
              pushToast(`${labels[k]} expired`);
            }
          }
          prevBuffsRef.current = cur;
        }
      }

      // regen
      if (statsRef.current.regen > 0) {
        const s = statsRef.current;
        s.hp = Math.min(s.maxHp, s.hp + s.regen * 0.016);
      }

      const pPos = playerRef.current;
      const freezeWorld = Date.now() < freezeUntil.current;

      if (!freezeWorld) {
        const ppShot = playerRef.current;
        enemyProjectilesRef.current = (enemyProjectilesRef.current || [])
          .map((p) => ({ ...p, x: p.x + (p.vx || 0) * dtScale, y: p.y + (p.vy || 0) * dtScale, life: (p.life || 0) - frameDelta }))
          .filter((p) => {
            if (p.life <= 0 || p.x < -80 || p.x > ARENA_SIZE + 80 || p.y < -80 || p.y > ARENA_SIZE + 80) return false;
            const d = Math.hypot(p.x - ppShot.x, p.y - ppShot.y);
            if (d < (p.r || 12) + 18) {
              applyPlayerDamage(p.damage || 12, 'turret');
              explosionsRef.current = appendCapped(explosionsRef.current, {
                id: Math.random(),
                x: p.x,
                y: p.y,
                r: p.acid ? 78 : 54,
                t: Date.now(),
                life: p.acid ? 1300 : 260,
                color: p.acid ? 'rgba(100,255,122,1)' : 'rgba(255,92,28,1)',
                glow: p.acid ? 10 : 18,
                hazard: !!p.acid,
                alpha: p.acid ? 0.18 : undefined
              }, PERF_EFFECT_CAP);
              return false;
            }
            return true;
          })
          .slice(-80);
      }

      // -------------------- SPAWNING --------------------
      const runT = getRunT();
      const progT = getProgressT();
      const lateT = getLateT();

      const difficulty = computeDifficulty(progElapsedRef.current);

      const panicRamp = Math.pow(norm01(progT, 0.76, 1.0), 1.10); // progress-based endgame ramp (capped)
      const spawnIntervalBase = Math.max(190, 1250 - difficulty * 80 - panicRamp * 120);

      // Danish feedback: early ramp was too steep. Slow the first 25% a bit.
      const earlySlow = lerp(1.02, 0.92, clamp(progT / 0.25, 0, 1));

      const inRelief = Date.now() < reliefUntilRef.current;
      const bossAlive = (enemiesRef.current || []).some((x) => (x.type === 'boss' || x.type === 'boss_split') && x.hp > 0);
      const extractionActive = !!extractionRef.current.active;
      const tilePressure = difficultyPressureMult(tileDifficulty);

      // base: fewer enemies
      let spawnInterval = spawnIntervalBase * SPAWN_INTERVAL_MULT * earlySlow * (inRelief ? RELIEF_SPAWN_INTERVAL_MULT : 1.0);
      spawnInterval *= 1 / tilePressure;

      // late game: progressively fewer spawns
      spawnInterval *= lerp(1.0, LATE_SPAWN_INTERVAL_BOOST, lateT);

      // boss: MUCH fewer adds (and no events schedule while boss alive)
      if (bossAlive) spawnInterval *= 1.05;
      if (extractionActive) spawnInterval *= 1.05;

      // event modifiers
      if (isEventActive('SWARM')) spawnInterval *= 0.60;
      if (isEventActive('WALL')) spawnInterval *= 0.85; // keep enemies present during encirclement

      let nextEnemies = [...enemiesRef.current];

      const nowSpawn = Date.now();
      const reliefHard = (nowSpawn < reliefUntilRef.current) && (nowSpawn - (reliefStartedAtRef.current || 0) < 650);

      if (!freezeWorld && !reliefHard) {
        if (elapsed.current - lastSpawn.current > spawnInterval) {
          lastSpawn.current = elapsed.current;

          const countBase = Math.min(2 + Math.floor(difficulty / 2), 12);
          let count = Math.max(1, Math.round(countBase + panicRamp * 2));
          count = Math.max(1, Math.round(count * tilePressure));
          count = Math.max(1, Math.round(count * 1.20));
          if (progT >= 0.20) count = Math.max(2, Math.round(count * 2.0));

          // late: scale count smoothly (negative LATE_SPAWN_COUNT_REDUCE increases count)
          count = Math.max(1, Math.round(count * lerp(1.0, 1.0 - LATE_SPAWN_COUNT_REDUCE, lateT)));

          // after 40%: keep the arena busy
          const after40 = norm01(progT, 0.40, 0.60);
          count = Math.max(1, Math.round(count * lerp(1.0, AFTER40_ENEMY_MULT, after40)));
          const lateDifficultyBonus = 1 + lateT * Math.max(0, tileDifficultyRank(tileDifficulty) - 1) * 0.20;
          count = Math.max(1, Math.round(count * lateDifficultyBonus));

          // boss: reduce count hard
          if (bossAlive) count = Math.max(2, Math.round(count * 0.90));
          if (extractionActive) count = Math.max(2, Math.round(count * 0.85));

          // soft cap late-game trash so density can't spiral (keeps difficulty high but fair)
        {
            const isSpecial = (x) => x.type === 'boss' || x.type === 'boss_split' || String(x.type).startsWith('mini_') || x.type === 'wall';
            const trashCount = nextEnemies.filter((e) => !isSpecial(e)).length;
          const maxTrash = Math.round((lerp(70, 132, norm01(tileDifficulty, 1, 5)) + progT * lerp(20, 56, norm01(tileDifficulty, 1, 5))) * lateDifficultyBonus);
            const room = maxTrash - trashCount;
            if (room <= 0) count = 0;
            else count = Math.min(count, room);
          }

          if (isEventActive('SWARM')) {
            const meta = activeEventRef.current?.meta || {};
            const variant = meta.variant || 'encircle';
            const safeAngle = meta.safeAngle ?? 0;
            const safeArc = meta.safeArc ?? (Math.PI * 0.55);

            // swarm is still intense, but softened late so it doesn't become impossible
            let swarmCount = Math.max(5, Math.round((14 + Math.floor(difficulty * 0.45)) * (1 / SPAWN_INTERVAL_MULT)));
            swarmCount = Math.max(5, Math.round(swarmCount * tilePressure));
            swarmCount = Math.max(5, Math.round(swarmCount * 1.20));
            if (progT >= 0.20) swarmCount = Math.max(12, Math.round(swarmCount * 1.7));
            swarmCount = Math.max(5, Math.round(swarmCount * lerp(1.0, 1.18, lateT)));
            swarmCount = Math.max(5, Math.round(swarmCount * lateDifficultyBonus));
            const after40s = norm01(progT, 0.40, 0.60);
            swarmCount = Math.max(8, Math.round(swarmCount * lerp(1.0, 1.20, after40s)));
            if (bossAlive) swarmCount = Math.max(8, Math.round(swarmCount * 0.82));
            if (extractionActive) swarmCount = Math.max(7, Math.round(swarmCount * 0.72));

            // cap swarm spawns if we're already at/over late trash budget
            if (!bossAlive && progT > 0.68) {
              const isSpecial = (x) => x.type === 'boss' || x.type === 'boss_split' || String(x.type).startsWith('mini_') || x.type === 'wall';
              const trashCount = nextEnemies.filter((e) => !isSpecial(e)).length;
              const maxTrash = Math.round((lerp(82, 150, norm01(tileDifficulty, 1, 5)) + progT * lerp(22, 62, norm01(tileDifficulty, 1, 5))) * lateDifficultyBonus);
              const room = maxTrash - trashCount;
              swarmCount = Math.max(0, Math.min(swarmCount, room));
            }

            for (let i = 0; i < swarmCount; i += 1) {
              const en = spawnEnemy(difficulty, 'swarm', progT);

              if (variant === 'three_sides') {
                const centers = [
                  safeAngle + Math.PI,
                  safeAngle + Math.PI + (Math.PI * 2 / 3),
                  safeAngle + Math.PI - (Math.PI * 2 / 3)
                ];

                const c = centers[Math.floor(Math.random() * centers.length)];
                const a = c + (Math.random() - 0.5) * 0.55;
                const dist = 760 + Math.random() * 180;

                const x = clamp(pPos.x + Math.cos(a) * dist, 40, ARENA_SIZE - 40);
                const y = clamp(pPos.y + Math.sin(a) * dist, 40, ARENA_SIZE - 40);
                nextEnemies.push({ ...en, x, y });
              } else {
                let placed = null;
                for (let tries = 0; tries < 6; tries++) {
                  const cand = spawnEnemy(difficulty, 'swarm', progT);
                  const ang = Math.atan2(cand.y - pPos.y, cand.x - pPos.x);
                  let v = ang - safeAngle;
                  while (v > Math.PI) v -= Math.PI * 2;
                  while (v < -Math.PI) v += Math.PI * 2;
                  const dA = Math.abs(v);
                  if (dA > safeArc * 0.5) { placed = cand; break; }
                }
                nextEnemies.push(placed || en);
              }
            }
          } else {
            // During WALL events, keep a steady trickle of normal enemies (prevents "empty" feeling).
            const wallTrickle = isEventActive('WALL');
            const n = wallTrickle ? Math.max(2, Math.round(count * 0.85)) : count;
            for (let i = 0; i < n; i += 1) nextEnemies.push(spawnEnemy(difficulty, null, progT));
          }
        }

        const milestones = bossMilestonesForDifficulty(tileDifficulty);
        const bossIdx = bossMilestoneIdxRef.current || 0;
        const nextMilestone = milestones[bossIdx];
        const ramAliveForBoss = (nextEnemies || []).some((e) => e.type === 'mini_charger' && e.hp > 0);
        if (Number.isFinite(nextMilestone) && progT >= nextMilestone && !ramAliveForBoss) {
          const isLastBoss = bossIdx >= milestones.length - 1;
          bossMilestoneIdxRef.current = bossIdx + 1;
          bossSpawnedRef.current = true;
          setBossSpawned(true);

          triggerReliefSoft(1500 + Math.floor(Math.random() * 700), tileDifficulty >= 5 ? 42 : 34);

          const cloneMult = tileDifficulty >= 5 ? 2.35 : tileDifficulty >= 4 ? 1.9 : 1.65;
          const bossDiff = difficulty + Math.round(tileDifficulty * (isLastBoss ? 1.2 : 0.55));
          nextEnemies.push(spawnBoss(pPos, bossDiff, {
            isFinalBoss: isLastBoss,
            finalForm: isLastBoss || tileDifficulty >= 5,
            milestonePct: nextMilestone,
            tileDifficulty,
            cloneMult,
            hpMult: isLastBoss ? 1.18 : 0.92,
            sizeMult: isLastBoss ? 1.22 : 0.96 + nextMilestone * 0.18
          }));
          juicePunch(1.25, 1);
        }
      }

      nextEnemies = capEnemyBudget(nextEnemies, pPos);

      // -------------------- ENEMY MOVE / AI --------------------
      const movedEnemiesRaw = nextEnemies.map((en) => {
        if (freezeWorld && !isControlImmune(en.type)) return en;
        if (en.stunnedUntil && Date.now() < en.stunnedUntil) return en;
        const decoy = decoyRef.current && Date.now() < decoyRef.current.until ? decoyRef.current : null;
        const liveTurrets = (playerTurretsRef.current || []).filter((t) => t.hp > 0 && Date.now() < t.until);
        let targetPoint = decoy ? decoy : pPos;
        if (!decoy && liveTurrets.length) {
          let bestTurret = null;
          let bestTurretD = Infinity;
          for (const t of liveTurrets) {
            const dT = Math.hypot(t.x - en.x, t.y - en.y);
            if (dT < bestTurretD) { bestTurretD = dT; bestTurret = t; }
          }
          const family = getEnemyFamily(en.type);
          const aggroChance = family === 'BOSS' ? 0.15 : family === 'RAM' ? 0.35 : 0.50;
          const wantsTurret = stableUnitRoll(en.id) < aggroChance;
          if (bestTurret && wantsTurret && bestTurretD < 900) targetPoint = bestTurret;
        }

        if (en.type === 'grab_ghost') {
          const now2 = Date.now();
          const activeGrab = playerGrabRef.current;
          if (activeGrab?.enemyId === en.id && now2 < (activeGrab.until || 0)) {
            const grabA = Math.atan2(pPos.y - en.y, pPos.x - en.x);
            return {
              ...en,
              x: clamp(pPos.x - Math.cos(grabA) * 34, 0, ARENA_SIZE),
              y: clamp(pPos.y - Math.sin(grabA) * 34, 0, ARENA_SIZE),
              grabUntil: activeGrab.until
            };
          }

          if (activeGrab?.enemyId === en.id && now2 >= (activeGrab.until || 0)) playerGrabRef.current = null;

          const dx = pPos.x - en.x;
          const dy = pPos.y - en.y;
          const d = Math.hypot(dx, dy) || 1;
          if (d < (en.size || 36) * 0.5 + 30 && (!playerGrabRef.current || now2 >= (playerGrabRef.current.until || 0))) {
            const until = now2 + 3000;
            playerGrabRef.current = { enemyId: en.id, until };
            pushToast('GHOST HOLD');
            return { ...en, grabUntil: until, stunnedUntil: Math.max(en.stunnedUntil || 0, until) };
          }
          const spd = (en.speed || 2.55) * dtScale;
          return { ...en, x: clamp(en.x + (dx / d) * spd, 0, ARENA_SIZE), y: clamp(en.y + (dy / d) * spd, 0, ARENA_SIZE) };
        }

        if (en.type === 'ghost_spirit') {
          const now2 = Date.now();
          if (now2 >= (en.reviveAt || 0)) {
            const hp = en.reviveHp || en.maxHp || 42;
            explosionsRef.current = [...(explosionsRef.current || []), { id: Math.random(), x: en.x, y: en.y, r: 62, t: now2, life: 300, color: 'rgba(190,195,210,1)', glow: 18, fill: true, alpha: 0.28 }];
            return { ...en, type: 'ghost', hp, maxHp: hp, contactDamage: 12, color: '#c6cad6', speed: Math.max(1.45, en.speed || 1.6), revivedOnce: true };
          }
          const dx = pPos.x - en.x;
          const dy = pPos.y - en.y;
          const d = Math.hypot(dx, dy) || 1;
          const spd = (en.speed || 1.25) * 1.08 * dtScale;
          return { ...en, contactDamage: 0, x: en.x + (dx / d) * spd, y: en.y + (dy / d) * spd };
        }

        if (en.type === 'lane_elite') {
          const dir = en.laneDir || 1;
          return { ...en, x: clamp(en.x + dir * (en.speed || 2.2) * dtScale, 0, ARENA_SIZE) };
        }

        if (en.type === 'wall' && Number.isFinite(en.laneDir)) {
          const dir = en.laneDir || 1;
          const nx = clamp(en.x + dir * (en.speed || 0.8) * dtScale, 0, ARENA_SIZE);
          const edgeX = dir > 0 ? ARENA_SIZE - 44 : 44;
          const arrived = dir > 0 ? nx >= edgeX : nx <= edgeX;
          const arrivedAt = en.sweepArrivedAt || (arrived ? Date.now() : 0);
          if (arrivedAt && Date.now() - arrivedAt > 10000) return { ...en, despawn: true };
          return { ...en, x: nx, sweepArrivedAt: arrivedAt };
        }

        if (en.type === 'merge_brute') {
          const now2 = Date.now();
          const otherMergers = (nextEnemies || []).filter((x) => x.type === 'merge_brute' && x.id !== en.id);
          const close = otherMergers.some((x) => Math.hypot(x.x - en.x, x.y - en.y) < 145);
          if (close && !en.mergingAt) return { ...en, mergingAt: now2 };
          if (en.mergingAt && now2 - en.mergingAt > 650) {
            const group = [en, ...otherMergers.filter((x) => Math.hypot(x.x - en.x, x.y - en.y) < 210)];
            if (group.length >= 2) {
              const hp = group.reduce((sum, x) => sum + (x.hp || 0), 0) * 1.18;
              const maxHp = group.reduce((sum, x) => sum + (x.maxHp || 0), 0) * 1.18;
              group.forEach((x) => { if (x.id !== en.id) x.despawn = true; });
              return {
                ...en,
                id: `abomination_${Math.random()}`,
                type: 'abomination',
                hp,
                maxHp,
                speed: 0.72,
                size: 176,
                xp: 380,
                contactDamage: 34,
                color: '#6dff6d',
                healthSegments: 6,
                ghostOnDeath: true,
                mergingAt: 0
              };
            }
          }
        }

        if (en.type === 'abomination') {
          const dx = targetPoint.x - en.x;
          const dy = targetPoint.y - en.y;
          const d = Math.hypot(dx, dy) || 1;
          const spd = (en.speed || 0.72) * dtScale;
          return { ...en, x: en.x + (dx / d) * spd, y: en.y + (dy / d) * spd };
        }

        if (en.type === 'turret') {
          const now2 = Date.now();
          if (now2 >= (en.nextShotAt || 0)) {
            const dx = targetPoint.x - en.x;
            const dy = targetPoint.y - en.y;
            const d = Math.hypot(dx, dy) || 1;
            const shotX = en.x + (dx / d) * Math.min(d, 520);
            const shotY = en.y + (dy / d) * Math.min(d, 520);
            const spd = 3.2;
            enemyProjectilesRef.current = [
              ...(enemyProjectilesRef.current || []),
              {
                id: Math.random(),
                x: en.x,
                y: en.y,
                vx: (dx / d) * spd,
                vy: (dy / d) * spd,
                r: 14,
                damage: 13 + tileDifficulty * 1.5,
                t: now2,
                life: 4200
              }
            ];
            return { ...en, nextShotAt: now2 + 1650 + Math.random() * 650 };
          }
          return en;
        }

        if (en.type === 'spitter') {
          const now2 = Date.now();
          const dx = targetPoint.x - en.x;
          const dy = targetPoint.y - en.y;
          const d = Math.hypot(dx, dy) || 1;
          if (now2 >= (en.nextSpitAt || 0) && d < 720) {
            const spd = 4.4;
            enemyProjectilesRef.current = appendCapped(enemyProjectilesRef.current, {
              id: Math.random(),
              x: en.x,
              y: en.y,
              vx: (dx / d) * spd,
              vy: (dy / d) * spd,
              r: 12,
              damage: 10 + tileDifficulty * 1.2,
              t: now2,
              life: 2800,
              acid: true
            }, 80);
            return { ...en, nextSpitAt: now2 + 2100 + Math.random() * 900 };
          }
          const desired = d < 340 ? -1 : 0.7;
          const spd = (en.speed || 1.1) * desired * dtScale;
          return { ...en, x: clamp(en.x + (dx / d) * spd, 0, ARENA_SIZE), y: clamp(en.y + (dy / d) * spd, 0, ARENA_SIZE) };
        }

        if (en.type === 'shielder') {
          const now2 = Date.now();
          const liveIds = new Set((nextEnemies || []).filter((ally) => ally && ally.hp > 0).map((ally) => ally.id));
          const targets = (en.shieldTargets || []).filter((id) => liveIds.has(id)).slice(0, 4);
          if (targets.length < 4) {
            const candidates = (nextEnemies || [])
              .filter((ally) => {
                if (!ally || ally.id === en.id || ally.hp <= 0 || ally.type === 'boss' || ally.type === 'wall') return false;
                if (targets.includes(ally.id)) return false;
                return Math.hypot(ally.x - en.x, ally.y - en.y) <= (en.shieldRadius || 190);
              })
              .sort((a, b) => Math.hypot(a.x - en.x, a.y - en.y) - Math.hypot(b.x - en.x, b.y - en.y));
            for (const ally of candidates) {
              if (targets.length >= 4) break;
              targets.push(ally.id);
            }
          }
          for (const ally of nextEnemies || []) {
            if (!ally || !targets.includes(ally.id)) continue;
            ally.damageReductionUntil = Math.max(ally.damageReductionUntil || 0, now2 + 180);
            ally.damageReductionMult = 0;
            ally.shieldedBy = en.id;
            ally.shieldedUntil = now2 + 180;
          }
          return { ...en, shieldTargets: targets, buffCount: targets.length };
        }

        if (en.type === 'burrower') {
          const now2 = Date.now();
          if (en.burrowUntil && now2 < en.burrowUntil) return { ...en, hidden: true };
          if (en.burrowUntil && now2 >= en.burrowUntil) {
            const a = Math.atan2(targetPoint.y - en.y, targetPoint.x - en.x) + (Math.random() - 0.5) * 1.4;
            const dist = 190 + Math.random() * 120;
            return {
              ...en,
              hidden: false,
              burrowUntil: 0,
              x: clamp(targetPoint.x - Math.cos(a) * dist, 60, ARENA_SIZE - 60),
              y: clamp(targetPoint.y - Math.sin(a) * dist, 60, ARENA_SIZE - 60),
              nextBurrowAt: now2 + 3600 + Math.random() * 1400,
              stunnedUntil: now2 + 180
            };
          }
          if (now2 >= (en.nextBurrowAt || 0)) {
            return { ...en, hidden: true, burrowUntil: now2 + 620 };
          }
        }

        if (en.type === 'pylon') {
          const now2 = Date.now();
          if (en.pylonMonster) {
            const dx = targetPoint.x - en.x;
            const dy = targetPoint.y - en.y;
            const d = Math.hypot(dx, dy) || 1;
            const spd = (en.speed || 0.62) * dtScale;
            return { ...en, x: en.x + (dx / d) * spd, y: en.y + (dy / d) * spd };
          }
          const age = now2 - (en.pylonStartedAt || now2);
          const timeCharge = clamp(age / (en.pylonChargeMs || 42000), 0, 1);
          let absorbed = en.pylonAbsorbed || 0;
          const absorbNeed = 24 + tileDifficulty * 6;
          const charge = clamp(Math.max(timeCharge * 0.45, absorbed / absorbNeed), 0, 1);
          const pullRadius = (en.pylonPullRadius || 680) * (0.9 + charge * 0.35);
          for (const victim of nextEnemies || []) {
            if (!victim || victim.id === en.id || victim.hp <= 0 || victim.type === 'wall' || victim.type === 'boss' || victim.type === 'pylon' || victim.type === 'boss_split') continue;
            const dx = en.x - victim.x;
            const dy = en.y - victim.y;
            const d = Math.hypot(dx, dy) || 1;
            if (d > pullRadius) continue;
            const pull = (5.8 + charge * 4.4) * (isControlImmune(victim.type) ? 0.20 : 1);
            victim.x = clamp(victim.x + (dx / d) * pull * dtScale, 0, ARENA_SIZE);
            victim.y = clamp(victim.y + (dy / d) * pull * dtScale, 0, ARENA_SIZE);
            if (d < (en.size || 112) * 0.55 + (victim.size || 28) * 0.42) {
              victim.hp = 0;
              victim.absorbedByPylon = true;
              absorbed += victim.type === 'swarm' ? 0.75 : 1.25;
              explosionsRef.current = appendCapped(explosionsRef.current, { id: Math.random(), x: victim.x, y: victim.y, r: 42, t: now2, life: 240, color: 'rgba(127,242,215,1)', glow: 16, fill: true, alpha: 0.25 }, PERF_EFFECT_CAP);
            }
          }
          if (charge >= 1) {
            const hp = Math.round((36000 + tileDifficulty * 6200) * difficultyHpMult(tileDifficulty));
            explosionsRef.current = appendCapped(explosionsRef.current, { id: Math.random(), x: en.x, y: en.y, r: 460, t: now2, life: 720, color: 'rgba(127,242,215,1)', glow: 42, fill: true, alpha: 0.25 }, PERF_EFFECT_CAP);
            pushToast('PYLON BEAST AWAKENED');
            return { ...en, pylonMonster: true, hp, maxHp: hp, speed: 0.62 + tileDifficulty * 0.015, size: 535, contactDamage: 42, xp: 700, color: '#35ffd5', pylonCharge: 1, pylonAbsorbed: absorbed };
          }
          return { ...en, speed: 0, size: 108 + charge * 34, pylonCharge: charge, pylonAbsorbed: absorbed };
        }

        if (en.type === 'boss') {
          const now2 = Date.now();
          const hpPct = en.hp / Math.max(1, en.maxHp || en.hp);
          const phaseMarks = en.phaseMarks || {};
          const triggerBossPhase = (key, threshold, fn) => {
            if (hpPct > threshold || phaseMarks[key]) return null;
            fn();
            return { ...en, phaseMarks: { ...phaseMarks, [key]: true } };
          };
          const phase90 = triggerBossPhase('p90', 0.90, () => {
            const burst = [];
            for (let i = 0; i < 14 + tileDifficulty * 3; i += 1) {
              const a = (Math.PI * 2 * i) / (14 + tileDifficulty * 3);
              const z = spawnEnemy(tileDifficulty + 1, 'swarm', getProgressT());
              burst.push({ ...z, x: clamp(en.x + Math.cos(a) * 130, 30, ARENA_SIZE - 30), y: clamp(en.y + Math.sin(a) * 130, 30, ARENA_SIZE - 30), color: '#ff9a3d' });
            }
            enemiesRef.current = [...(enemiesRef.current || []), ...burst];
            pushToast('BOSS: ZERG WAVE');
          });
          if (phase90) return phase90;
          const phase80 = triggerBossPhase('p80', 0.80, () => {
            explosionsRef.current = [...(explosionsRef.current || []), { id: Math.random(), x: en.x, y: en.y, r: 300, t: now2, life: 620, color: 'rgba(255,218,107,1)', glow: 40, fill: true, alpha: 0.20 }];
            pushToast('BOSS: SHOCK RING');
          });
          if (phase80) return phase80;
          const phase70 = triggerBossPhase('p70', 0.70, () => {
            pushToast('BOSS: RAM CHARGE');
          });
          if (phase70) return { ...phase70, bossWindupUntil: now2 + 820, bossRamDir: Math.atan2(targetPoint.y - en.y, targetPoint.x - en.x), bossDashLen: 960, chargesDone: Math.max(en.chargesDone || 0, 1), nextRamPct: 0.52, ramPhaseDone: true };
          const phase30 = triggerBossPhase('p30', 0.30, () => {
            const ghosts = [];
            for (let i = 0; i < 18 + tileDifficulty * 4; i += 1) {
              const a = Math.random() * Math.PI * 2;
              const gh = spawnEnemy(tileDifficulty + 1, 'ghost', getProgressT());
              ghosts.push({ ...gh, x: clamp(en.x + Math.cos(a) * (170 + Math.random() * 90), 30, ARENA_SIZE - 30), y: clamp(en.y + Math.sin(a) * (170 + Math.random() * 90), 30, ARENA_SIZE - 30) });
            }
            enemiesRef.current = [...(enemiesRef.current || []), ...ghosts];
            pushToast('BOSS: HAUNTING');
          });
          if (phase30) return phase30;
          const phase10 = triggerBossPhase('p10', 0.10, () => {
            en.speed = (en.speed || 1.6) * 1.18;
            explosionsRef.current = [...(explosionsRef.current || []), { id: Math.random(), x: en.x, y: en.y, r: 420, t: now2, life: 720, color: 'rgba(255,0,122,1)', glow: 46, fill: true, alpha: 0.24 }];
            pushToast('BOSS: LAST STAND');
          });
          if (phase10) return { ...phase10, speed: (en.speed || 1.6) * 1.18, contactDamage: Math.round((en.contactDamage || 34) * 1.12) };
          if (hpPct <= (en.nextRamPct ?? 0.82) && (en.chargesDone || 0) < 2 && !en.bossWindupUntil && !en.bossRamUntil) {
            return {
              ...en,
              bossWindupUntil: now2 + 850,
              bossRamDir: Math.atan2(targetPoint.y - en.y, targetPoint.x - en.x),
              bossDashLen: 860,
              chargesDone: (en.chargesDone || 0) + 1,
              nextRamPct: (en.chargesDone || 0) === 0 ? 0.62 : -1,
              ramPhaseDone: true
            };
          }
          if (en.bossWindupUntil && now2 < en.bossWindupUntil) return en;
          if (en.bossWindupUntil && now2 >= en.bossWindupUntil && !en.bossRamUntil) {
            return { ...en, bossWindupUntil: 0, bossRamUntil: now2 + 2100 };
          }
          if (en.bossRamUntil && now2 < en.bossRamUntil) {
            const spd = 13.8;
            return { ...en, x: clamp(en.x + Math.cos(en.bossRamDir || 0) * spd * dtScale, 0, ARENA_SIZE), y: clamp(en.y + Math.sin(en.bossRamDir || 0) * spd * dtScale, 0, ARENA_SIZE) };
          }
          if (en.bossRamUntil && now2 >= en.bossRamUntil) return { ...en, bossRamUntil: 0 };
          if ((en.bossPhase || 'main') === 'main' && hpPct <= 0.40 && !en.zergPhaseDone) {
            const burst = [];
            for (let i = 0; i < 28; i += 1) {
              const a = (Math.PI * 2 * i) / 28;
              const z = spawnEnemy(tileDifficulty + 3, 'swarm', getProgressT());
              burst.push({ ...z, x: clamp(en.x + Math.cos(a) * 72, 30, ARENA_SIZE - 30), y: clamp(en.y + Math.sin(a) * 72, 30, ARENA_SIZE - 30), speed: (z.speed || 2) * 1.18, color: '#b6ff4a' });
            }
            enemiesRef.current = [...(enemiesRef.current || []), ...burst];
            explosionsRef.current = [...(explosionsRef.current || []), { id: Math.random(), x: en.x, y: en.y, r: 280, t: now2, life: 520, color: 'rgba(182,255,74,1)', glow: 34, fill: true, alpha: 0.22 }];
            juicePunch(1.05, 0.9);
            return { ...en, zergPhaseDone: true };
          }
        }

        // mini-boss behaviors
        if (en.type === 'mini_charger' || en.type === 'tiny_ram') {
          const now2 = Date.now();
          const dx = targetPoint.x - en.x;
          const dy = targetPoint.y - en.y;
          const angToPlayer = Math.atan2(dy, dx);

          if (en.type === 'mini_charger') {
            const path = Array.isArray(en.ramPath) ? en.ramPath : null;
            if (path && path.length && en.ramPathWindupUntil && now2 < en.ramPathWindupUntil) return en;

            if (path && path.length && en.ramPathWindupUntil && now2 >= en.ramPathWindupUntil && !en.ramPathDashUntil) {
              const first = path[0];
              return { ...en, x: first.x1, y: first.y1, ramPathDashIndex: 0, ramPathDashStartedAt: now2, ramPathDashUntil: now2 + 115, ramPathWindupUntil: 0 };
            }

            if (path && path.length && en.ramPathDashUntil) {
              const idx = clamp(en.ramPathDashIndex || 0, 0, path.length - 1);
              const seg = path[idx];
              const dur = Math.max(55, (en.ramPathDashUntil || now2) - (en.ramPathDashStartedAt || now2));
              const pct = clamp((now2 - (en.ramPathDashStartedAt || now2)) / dur, 0, 1);
              const nx = clamp(lerp(seg.x1, seg.x2, pct), 0, ARENA_SIZE);
              const ny = clamp(lerp(seg.y1, seg.y2, pct), 0, ARENA_SIZE);

              if (now2 < en.ramPathDashUntil) return { ...en, x: nx, y: ny };

              if (idx < path.length - 1) {
                const next = path[idx + 1];
                return {
                  ...en,
                  x: next.x1,
                  y: next.y1,
                  ramPathDashIndex: idx + 1,
                  ramPathDashStartedAt: now2,
                  ramPathDashUntil: now2 + 95
                };
              }

              const last = path[path.length - 1];
              return {
                ...en,
                x: last.x2,
                y: last.y2,
                ramPath: null,
                ramPathDashUntil: 0,
                ramPathDashIndex: 0,
                nextDashAt: now2 + (en.dashCd || 1850) + Math.random() * 700
              };
            }

            if (!path && now2 > (en.nextDashAt || 0)) {
              const segCount = 3 + Math.floor(Math.random() * 5);
              const pathOut = [];
              let sx0 = en.x;
              let sy0 = en.y;
              let aimX = targetPoint.x;
              let aimY = targetPoint.y;
              for (let i = 0; i < segCount; i += 1) {
                const pull = i === 0 ? 1 : 0.58;
                const a = Math.atan2(aimY - sy0, aimX - sx0) + (Math.random() - 0.5) * (i === 0 ? 0.22 : 0.72);
                const len = 360 + Math.random() * 240;
                const ex = clamp(sx0 + Math.cos(a) * len * pull, 55, ARENA_SIZE - 55);
                const ey = clamp(sy0 + Math.sin(a) * len * pull, 55, ARENA_SIZE - 55);
                pathOut.push({ x1: sx0, y1: sy0, x2: ex, y2: ey });
                sx0 = ex;
                sy0 = ey;
                aimX = targetPoint.x + (Math.random() - 0.5) * 420;
                aimY = targetPoint.y + (Math.random() - 0.5) * 420;
              }
              return {
                ...en,
                ramPath: pathOut,
                ramPathWindupUntil: now2 + 820 + segCount * 210,
                ramPathDashIndex: 0,
                ramPathDashUntil: 0,
                nextDashAt: now2 + 999999
              };
            }
          }

          if (!en.dashUntil && now2 > (en.nextDashAt || 0) && !en.windupUntil) {
            const dashMs = en.dashMs || 360;
            const dashSpd = en.dashSpd || 11.2;

            const dashTicks = Math.ceil(dashMs / 16);
            const dashLen = Math.min(dashSpd * dashTicks * 1.2, 560);

            return {
              ...en,
              windupUntil: now2 + (en.dashWindup || 700),
              dashDir: angToPlayer,
              dashLen,
              dashTicks,
              doubleDashQueued: Math.random() < 0.72,
              didDoubleDash: false,
              nextDashAt: now2 + (en.dashCd || 1800) + Math.random() * 1000
            };
          }

          if (en.windupUntil && now2 < en.windupUntil) return en;

          if (en.windupUntil && now2 >= en.windupUntil && !en.dashUntil) {
            return { ...en, dashUntil: now2 + (en.dashMs || 360), windupUntil: 0 };
          }

          if (en.dashUntil && now2 < en.dashUntil) {
            const totalTicks = en.dashTicks || Math.ceil((en.dashMs || 360) / 16);
            const dashLen = en.dashLen ?? ((en.dashSpd || 10.5) * totalTicks);
            const perTick = (dashLen / totalTicks) * dtScale;

            const nx = clamp(en.x + Math.cos(en.dashDir || 0) * perTick, 0, ARENA_SIZE);
            const ny = clamp(en.y + Math.sin(en.dashDir || 0) * perTick, 0, ARENA_SIZE);
            return { ...en, x: nx, y: ny };
          }

          if (en.dashUntil && now2 >= en.dashUntil) {
            const seqLeft = Number.isFinite(en.chargeSequenceLeft) ? en.chargeSequenceLeft : (en.type === 'mini_charger' ? 7 : 0);
            if (seqLeft > 0) {
              const dx2 = targetPoint.x - en.x;
              const dy2 = targetPoint.y - en.y;
              const fastPhase = seqLeft <= 4;
              const dashMs = fastPhase ? 420 : (en.dashMs || 360);
              const dashSpd = fastPhase ? 15.8 : (en.dashSpd || 11.2);
              const dashTicks = Math.ceil(dashMs / 16);
              const dashLen = Math.min(dashSpd * dashTicks * (fastPhase ? 1.05 : 1.18), fastPhase ? 720 : 600);
              return {
                ...en,
                dashUntil: 0,
                windupUntil: now2 + (fastPhase ? 210 : 620 + Math.random() * 280),
                dashDir: Math.atan2(dy2, dx2),
                dashLen,
                dashTicks,
                chargeSequenceLeft: seqLeft - 1,
                secondDashTelegraph: fastPhase
              };
            }
            return { ...en, dashUntil: 0 };
          }
        }

        // assassin blink: punish standing still, but still fair
        if (en.type === 'mini_assassin') {
          const now2 = Date.now();
          if (now2 > (en.nextBlinkAt || 0)) {
            const dx = pPos.x - en.x;
            const dy = pPos.y - en.y;
            const d = Math.hypot(dx, dy) || 1;
            const jump = clamp(220 + Math.random() * 140, 220, 360);
            const nx = clamp(pPos.x - (dx / d) * jump + (Math.random() - 0.5) * 60, 80, ARENA_SIZE - 80);
            const ny = clamp(pPos.y - (dy / d) * jump + (Math.random() - 0.5) * 60, 80, ARENA_SIZE - 80);
            return { ...en, x: nx, y: ny, nextBlinkAt: now2 + (en.blinkCd || 1600) };
          }
        }

        // WALL ring behavior
        if (en.type === 'wall' && Number.isFinite(en.wallA)) {
          const now2 = Date.now();
          const spd = en.wallEncroach ?? 2.0;
          const minR = en.wallMinR ?? 180;

          const curR = en.wallR ?? 1300;
          const nr = Math.max(minR, curR - spd);
          const arrivedAt = en.wallArrivedAt || (nr <= minR + 0.5 ? now2 : 0);
          if (arrivedAt && now2 - arrivedAt > 10000) return { ...en, despawn: true };

          const cx = Number.isFinite(en.wallCx) ? en.wallCx : en.x;
          const cy = Number.isFinite(en.wallCy) ? en.wallCy : en.y;

          const orbitA = en.wallA;
          const nx = clamp(cx + Math.cos(orbitA) * nr, -120, ARENA_SIZE + 120);
          const ny = clamp(cy + Math.sin(orbitA) * nr, -120, ARENA_SIZE + 120);

          return { ...en, wallA: orbitA, wallR: nr, wallArrivedAt: arrivedAt, x: nx, y: ny };
        }

        if (en.type === 'dancer') {
          const now2 = Date.now();
          const dx0 = targetPoint.x - en.x;
          const dy0 = targetPoint.y - en.y;
          const d0 = Math.hypot(dx0, dy0) || 1;
          if (now2 > (en.nextDiveAt || 0) && !en.diveUntil) {
            return { ...en, diveUntil: now2 + 520, diveDir: Math.atan2(dy0, dx0), nextDiveAt: now2 + 2800 + Math.random() * 1200 };
          }
          if (en.diveUntil && now2 < en.diveUntil) {
            const spd = (en.speed || 2.4) * 3.2 * dtScale;
            return { ...en, x: clamp(en.x + Math.cos(en.diveDir || 0) * spd, 0, ARENA_SIZE), y: clamp(en.y + Math.sin(en.diveDir || 0) * spd, 0, ARENA_SIZE) };
          }
          if (en.diveUntil && now2 >= en.diveUntil) return { ...en, diveUntil: 0 };
          const orbit = (en.circleDir || 1) * Math.PI / 2;
          const desired = d0 > 260 ? 0.55 : 1.0;
          const ang = Math.atan2(dy0, dx0) + orbit * desired;
          const spd = (en.speed || 2.3) * (d0 > 300 ? 1.1 : 0.9) * dtScale;
          return { ...en, x: en.x + Math.cos(ang) * spd, y: en.y + Math.sin(ang) * spd };
        }

        // default chase
        const dx = targetPoint.x - en.x;
        const dy = targetPoint.y - en.y;
        const d = Math.hypot(dx, dy) || 1;

        const slowMult = en.slowUntil && Date.now() < en.slowUntil ? (en.slowFactor ?? 0.75) : 1;
        const spd = en.speed * slowMult * dtScale;
        return { ...en, x: en.x + (dx / d) * spd, y: en.y + (dy / d) * spd };
      });

      // Filter despawned and apply a small separation force so enemies don't stack perfectly.
      let movedEnemies = movedEnemiesRaw.filter((e) => !e.despawn);
      movedEnemies = applyEnemySeparation(movedEnemies);
      {
        const enemyBlocks = movedEnemies.filter((e) => e.type === 'wall' && e.blocksEnemies && e.hp > 0);
        if (enemyBlocks.length) {
          movedEnemies = movedEnemies.map((en) => {
            if (en.type === 'wall' || en.hidden || en.hp <= 0) return en;
            let out = en;
            for (const wall of enemyBlocks) {
              const dx = out.x - wall.x;
              const dy = out.y - wall.y;
              const d = Math.hypot(dx, dy) || 0.0001;
              const minD = (out.size || 28) * 0.5 + (wall.size || 54) * 0.5;
              if (d >= minD) continue;
              const nx = dx / d;
              const ny = dy / d;
              out = {
                ...out,
                x: clamp(wall.x + nx * minD, 0, ARENA_SIZE),
                y: clamp(wall.y + ny * minD, 0, ARENA_SIZE),
                stunnedUntil: isControlImmune(out.type) ? out.stunnedUntil : Math.max(out.stunnedUntil || 0, now + 80)
              };
              wall.hp -= Math.max(0.8, (out.contactDamage || 8) * 0.32);
            }
            return out;
          }).filter((e) => e.hp > 0);
        }
      }
      const enemySpatial = buildSpatialGrid(movedEnemies, 190);
      {
        const tNow = talentsRef.current;
        const liveTurrets = (playerTurretsRef.current || []).filter((t) => (t.hp > 0 && now < t.until) || (tNow.turretDetonate && !t.didDeathBoom));
        if (liveTurrets.length) {
          const nextTurrets = liveTurrets.map((t) => ({ ...t }));
          for (const turret of nextTurrets) {
            if (turret.hp <= 0) continue;
            const candidates = querySpatialGrid(enemySpatial, turret.x, turret.y, 140);
            for (const en of candidates) {
              const d = Math.hypot(en.x - turret.x, en.y - turret.y);
              if (d < (en.size || 28) * 0.5 + (turret.size || 48) * 0.5) {
                turret.hp -= (Number.isFinite(en.contactDamage) ? en.contactDamage : 8) * 0.18;
                if (tNow.turretBomb && turret.shockReady) {
                  turret.shockReady = false;
                  explosionsRef.current = appendCapped(explosionsRef.current, { id: Math.random(), x: turret.x, y: turret.y, r: 360, t: now, life: 520, color: 'rgba(255,218,107,1)', glow: 38, fill: true, alpha: 0.18 }, PERF_EFFECT_CAP);
                  for (const e2 of querySpatialGrid(enemySpatial, turret.x, turret.y, 380)) {
                    const d2 = Math.hypot(e2.x - turret.x, e2.y - turret.y);
                    if (d2 > 360) continue;
                    const fall = 1 - d2 / 360;
                    if (!isKnockbackImmune(e2.type)) {
                      const a2 = Math.atan2(e2.y - turret.y, e2.x - turret.x);
                      e2.x = clamp(e2.x + Math.cos(a2) * (145 * Math.max(0.25, fall)), 0, ARENA_SIZE);
                      e2.y = clamp(e2.y + Math.sin(a2) * (145 * Math.max(0.25, fall)), 0, ARENA_SIZE);
                    }
                    if (!isControlImmune(e2.type)) {
                      e2.slowUntil = Math.max(e2.slowUntil || 0, now + 3200);
                      e2.slowFactor = Math.min(e2.slowFactor || 1, 0.48);
                    }
                  }
                }
                const ang = Math.atan2(en.y - turret.y, en.x - turret.x);
                if (!isKnockbackImmune(en.type)) {
                  en.x = clamp(en.x + Math.cos(ang) * 4, 0, ARENA_SIZE);
                  en.y = clamp(en.y + Math.sin(ang) * 4, 0, ARENA_SIZE);
                }
              }
            }
          }
          if (tNow.turretDetonate) {
            for (const turret of nextTurrets) {
              if ((turret.hp <= 0 || now >= turret.until) && !turret.didDeathBoom) {
                turret.didDeathBoom = true;
                const radius = 430;
                explosionsRef.current = appendCapped(explosionsRef.current, { id: Math.random(), x: turret.x, y: turret.y, r: radius, t: now, life: 620, color: 'rgba(255,112,36,1)', glow: 42, fill: true, alpha: 0.30 }, PERF_EFFECT_CAP);
                for (const e2 of querySpatialGrid(enemySpatial, turret.x, turret.y, radius + 40)) {
                  const d2 = Math.hypot(e2.x - turret.x, e2.y - turret.y);
                  if (d2 <= radius) e2.hp -= (155 + tileDifficulty * 24) * Math.max(0.34, 1 - d2 / radius);
                }
              }
            }
          }
          playerTurretsRef.current = nextTurrets.filter((t) => t.hp > 0 && now < t.until);
          {
            const liveTurretIds = new Set(playerTurretsRef.current.map((t) => t.id));
            enemiesRef.current = (enemiesRef.current || []).filter((e) => !e.turretWall || !e.turretId || liveTurretIds.has(e.turretId));
            movedEnemies = movedEnemies.filter((e) => !e.turretWall || !e.turretId || liveTurretIds.has(e.turretId));
          }
        } else {
          playerTurretsRef.current = [];
          enemiesRef.current = (enemiesRef.current || []).filter((e) => !e.turretWall);
          movedEnemies = movedEnemies.filter((e) => !e.turretWall);
        }
      }

      // -------------------- BULLETS UPDATE (homing/accel) --------------------
      const movedBullets = bulletsRef.current
        .map((b) => {
          let vx = b.vx;
          let vy = b.vy;
          let x = b.x;
          let y = b.y;

          if (b.delay && (b.age || 0) < b.delay) {
            return { ...b, age: (b.age || 0) + frameDelta, life: b.life - frameDelta };
          }

          if (b.accel) {
            const sp = Math.hypot(vx, vy) || 1;
            const nsp = sp + b.accel;
            vx = (vx / sp) * nsp;
            vy = (vy / sp) * nsp;
          }

          if (b.isHoming) {
            const enemiesNow = movedEnemies;
            if (enemiesNow.length) {
              let tEn = null;
              if (b.homeTargetId) tEn = enemiesNow.find((e) => e.id === b.homeTargetId) || null;
              if (!tEn) {
                tEn = enemiesNow.reduce((best, en) => {
                  const dd = (en.x - x) * (en.x - x) + (en.y - y) * (en.y - y);
                  if (!best) return en;
                  const bd = (best.x - x) * (best.x - x) + (best.y - y) * (best.y - y);
                  return dd < bd ? en : best;
                }, null);
              }

              if (tEn) {
                const desired = Math.atan2(tEn.y - y, tEn.x - x);
                const cur = Math.atan2(vy, vx);

                let dA = desired - cur;
                while (dA > Math.PI) dA -= Math.PI * 2;
                while (dA < -Math.PI) dA += Math.PI * 2;

                const sp = Math.hypot(vx, vy) || 1;
                const steer = clamp(0.06 + (sp / 26) * 0.05, 0.06, 0.13);
                const newA = cur + dA * steer;

                vx = Math.cos(newA) * sp;
                vy = Math.sin(newA) * sp;
              }
            }
          }

          let nx = x + vx * dtScale;
          let ny = y + vy * dtScale;

          if (b.anchorOnMaxRange && b.maxRange > 0 && !b.anchored) {
            const dd = Math.hypot(nx - b.originX, ny - b.originY);
            if (dd >= b.maxRange) {
              nx = b.originX + Math.cos(b.dirAngle || 0) * b.maxRange;
              ny = b.originY + Math.sin(b.dirAngle || 0) * b.maxRange;
              vx = 0;
              vy = 0;
              return { ...b, x: nx, y: ny, vx, vy, anchored: true, anchoredAt: Date.now(), life: b.life - frameDelta };
            }
          }

          if (b.anchored) {
            vx = 0;
            vy = 0;
          }

          // split projectiles (TIME / VOID upgrades)
          if (b.split && b.split > 0 && !b.didSplit && b.life < (b.lifeStart || 1000) * 0.68) {
            const sp = Math.hypot(vx, vy) || 1;
            const created = [];
            const n = b.split;
            for (let i = 0; i < n; i++) {
              const off = (i - (n - 1) / 2) * 0.18 + (Math.random() - 0.5) * 0.08;
              const a = Math.atan2(vy, vx) + off;
              created.push({
                ...b,
                id: Math.random(),
                vx: Math.cos(a) * sp,
                vy: Math.sin(a) * sp,
                life: Math.max(260, b.life - 120),
                didSplit: true,
                split: 0
              });
            }
            bulletsRef.current = [...(bulletsRef.current || []), ...created];
            return { ...b, didSplit: true };
          }

          return { ...b, x: nx, y: ny, vx, vy, age: (b.age || 0) + frameDelta, life: b.life - frameDelta };
        })
        .filter((b) => b.x > -140 && b.x < ARENA_SIZE + 140 && b.y > -140 && b.y < ARENA_SIZE + 140 && b.life > 0);

      // slashes update
      const movedSlashes = slashesRef.current
        .map((sl) => ({ ...sl, age: (sl.age || 0) + frameDelta }))
        .filter((sl) => (sl.age || 0) <= sl.life);

      // beams tick damage (LASER) + status
      const beamHits = new Map();
      const statusHits = new Map();
      {
        const now2 = Date.now();
        for (const bm of beamsRef.current) {
          const lifeP = 1 - (now2 - bm.t) / bm.life;
          if (lifeP <= 0) continue;

          if (now2 - (bm.lastTick || 0) < (bm.tickMs || 16)) continue;
          bm.lastTick = now2;

          for (const en of movedEnemies) {
            const d = distPointToSeg(en.x, en.y, bm.x1, bm.y1, bm.x2, bm.y2);
            if (d <= (bm.width || 30) * 0.55) {
              const eliteMult = isEliteType(en.type) ? (bm.eliteDmgMult ?? 1) : 1;
              beamHits.set(en.id, (beamHits.get(en.id) || 0) + bm.damage * eliteMult);

              const st = statusHits.get(en.id) || {};
              if (bm.burn) st.burn = Math.max(st.burn || 0, bm.burn);
              if (bm.slow) {
                st.slow = Math.max(st.slow || 0, bm.slow);
                st.slowDuration = Math.max(st.slowDuration || 0, bm.slowDuration || 520);
              }
              if (bm.microFreeze) st.stun = Math.max(st.stun || 0, bm.microFreeze);
              if (bm.stun) st.stun = Math.max(st.stun || 0, bm.stun);
              statusHits.set(en.id, st);
            }
          }
        }
      }

      // -------------------- PROJECTILE IMPACTS --------------------
      const bulletHits = new Map(); // en.id -> dmg
      const explosionBursts = [];
      const nextBullets = movedBullets.map((b) => ({ ...b }));

      const spawnedBullets = [];
      const spawnedSlashes = [];

      const pickRicochetTarget = (fromEnemy, allEnemies, maxRange = 360) => {
        const maxRange2 = maxRange * maxRange;
        let best = null;
        let bestD = Infinity;
        const pool = enemySpatial ? querySpatialGrid(enemySpatial, fromEnemy.x, fromEnemy.y, maxRange) : allEnemies;
        for (const e of pool) {
          if (e.id === fromEnemy.id) continue;
          const d = dist2({ x: fromEnemy.x, y: fromEnemy.y }, e);
          if (d > maxRange2) continue;
          if (d < bestD) { bestD = d; best = e; }
        }
        return best;
      };

      const applyMicroFreeze = (en, ms) => {
        const st = statusHits.get(en.id) || {};
        st.stun = Math.max(st.stun || 0, ms);
        statusHits.set(en.id, st);
      };

      nextBullets.forEach((b) => {
        if (b.hit) return;
        if (b.delay && (b.age || 0) < b.delay) return;

          const searchRadius = Math.max(90, (b.width || 12) + (b.axeThrow ? 80 : b.swordThrow ? 55 : 42));
          const collisionCandidates = querySpatialGrid(enemySpatial, b.x, b.y, searchRadius);
          for (const en of collisionCandidates) {
            if (b.hit) break;
            if (en.hidden) continue;
            if (en.type === 'ghost_spirit') continue;
            if (en.turretWall) continue;

            const d = Math.hypot(b.x - en.x, b.y - en.y);
            const hitRadius = en.size * 0.7 + (b.axeThrow ? 34 : b.swordThrow ? 16 : 0);
            if (d < hitRadius) {
            const eliteMult = isEliteType(en.type) ? (b.eliteDmgMult ?? 1) : 1;
            const dmgHit = (b.damage || 0) * eliteMult;

            bulletHits.set(en.id, (bulletHits.get(en.id) || 0) + dmgHit);

            const st = statusHits.get(en.id) || {};
            if (b.slow) {
              st.slow = Math.max(st.slow || 0, b.slow);
              if (b.slowDuration) st.slowDuration = Math.max(st.slowDuration || 0, b.slowDuration);
            }
            if (b.stun) st.stun = Math.max(st.stun || 0, b.stun);
            if (b.burn) st.burn = Math.max(st.burn || 0, b.burn);
            if (b.knockback) st.knockback = Math.max(st.knockback || 0, b.knockback);
            statusHits.set(en.id, st);

            if (b.microFreeze) applyMicroFreeze(en, b.microFreeze);

            if (b.timeScar) {
              explosionBursts.push({
                x: en.x,
                y: en.y,
                radius: b.scarRadius || 90,
                damage: 0,
                slow: Math.max(b.slow || 0, 0.55),
                slowDuration: b.scarMs || b.slowDuration || 1600,
                stun: Math.floor((b.microFreeze || 0) * 0.5),
                burn: 0,
                color: 'rgba(127,242,215,1)',
                life: b.scarMs || 1600
              });
            }

            if (b.explodeRadius && b.explodeMult) {
              explosionBursts.push({
                x: en.x,
                y: en.y,
                radius: b.explodeRadius,
                damage: dmgHit * b.explodeMult,
                slow: b.slow || 0,
                slowDuration: b.slowDuration || 0,
                stun: b.stun || 0,
                burn: b.aoeBurn === false ? 0 : (b.burn || 0)
              });
            }

            // SNIPER tear-through visuals + shock
            if (b.rail) {
              railLinesRef.current = appendCapped(railLinesRef.current, {
                id: Math.random(),
                x1: b.originX,
                y1: b.originY,
                x2: en.x,
                y2: en.y,
                width: b.railWidth || 18,
                t: Date.now(),
                life: b.railMs || 90,
                color: b.color
              }, 42);

              const railCandidates = querySpatialGrid(enemySpatial, (b.originX + en.x) * 0.5, (b.originY + en.y) * 0.5, Math.hypot(en.x - b.originX, en.y - b.originY) * 0.5 + (b.railWidth || 18));
              for (const e2 of railCandidates) {
                const dd = distPointToSeg(e2.x, e2.y, b.originX, b.originY, en.x, en.y);
                if (dd <= (b.railWidth || 18) * 0.65) {
                  const eliteMult2 = isEliteType(e2.type) ? (b.eliteDmgMult ?? 1) : 1;
                  bulletHits.set(e2.id, (bulletHits.get(e2.id) || 0) + (b.damage || 0) * eliteMult2 * 0.22);
                }
              }
            }

            // ricochet
            if (b.ricochets && b.ricochets > 0) {
              const nxt = pickRicochetTarget(en, movedEnemies, b.axeThrow ? 780 : 360);
              if (nxt) {
                const ang = Math.atan2(nxt.y - en.y, nxt.x - en.x);
                const sp = Math.hypot(b.vx, b.vy) || (b.bulletSpeed || 12);
                b.x = en.x;
                b.y = en.y;
                b.vx = Math.cos(ang) * sp;
                b.vy = Math.sin(ang) * sp;
                b.angle = ang;
                b.ricochets -= 1;

                if ((b.pierce ?? 0) > 0) b.pierce -= 1;
                juicePunch(0.24, 0.38);
                break;
              }
            }

            // pierce
            b.pierce = (b.pierce ?? 0) - 1;
            if (b.pierce < 0) b.hit = true;

            // chain zap
            if (b.chain && b.chain > 0) {
              const maxRange2 = 280 * 280;
              let best = null;
              let bestD = Infinity;
              for (const e2 of querySpatialGrid(enemySpatial, en.x, en.y, 280)) {
                if (e2.id === en.id) continue;
                const dd = dist2(en, e2);
                if (dd < bestD && dd <= maxRange2) { bestD = dd; best = e2; }
              }
              if (best) {
                arcsRef.current = appendCapped(arcsRef.current, { id: Math.random(), x1: en.x, y1: en.y, x2: best.x, y2: best.y, t: Date.now(), life: 150, color: b.color }, PERF_ARC_CAP);

                const eliteMult2 = isEliteType(best.type) ? (b.eliteDmgMult ?? 1) : 1;
                bulletHits.set(best.id, (bulletHits.get(best.id) || 0) + (b.damage || 0) * eliteMult2 * 0.60);

                const st2 = statusHits.get(best.id) || {};
                if (b.stun) st2.stun = Math.max(st2.stun || 0, Math.floor(b.stun * 0.7));
                if (b.microFreeze) st2.stun = Math.max(st2.stun || 0, Math.floor(b.microFreeze * 0.75));
                if (b.slow) st2.slow = Math.max(st2.slow || 0, Math.max(0.06, b.slow * 0.6));
                if (b.slowDuration) st2.slowDuration = Math.max(st2.slowDuration || 0, Math.floor(b.slowDuration * 0.85));
                if (b.burn) st2.burn = Math.max(st2.burn || 0, Math.floor(b.burn * 0.8));
                statusHits.set(best.id, st2);

                juicePunch(0.28, 0.5);
              }
            }
          }
        }
      });

      // explosion damage + status
      if (explosionBursts.length) {
        for (const burst of explosionBursts.slice(0, 22)) {
          explosionsRef.current = appendCapped(explosionsRef.current, { id: Math.random(), x: burst.x, y: burst.y, r: burst.radius, t: Date.now(), life: burst.life || 260, color: burst.color, glow: burst.color ? 22 : undefined, fill: !!burst.color, alpha: burst.color ? 0.16 : undefined }, PERF_EFFECT_CAP);
          for (const en of querySpatialGrid(enemySpatial, burst.x, burst.y, burst.radius + 64)) {
            const d = Math.hypot(en.x - burst.x, en.y - burst.y);
            if (d <= burst.radius) {
              const fall = 1 - d / burst.radius;
              const dmg = burst.damage * Math.max(0.25, fall);
              if (dmg > 0) bulletHits.set(en.id, (bulletHits.get(en.id) || 0) + dmg);

              const st = statusHits.get(en.id) || {};
              if (burst.slow) {
                st.slow = Math.max(st.slow || 0, burst.slow);
                if (burst.slowDuration) st.slowDuration = Math.max(st.slowDuration || 0, burst.slowDuration);
              }
              if (burst.stun) st.stun = Math.max(st.stun || 0, burst.stun);
              if (burst.burn) st.burn = Math.max(st.burn || 0, burst.burn);
              statusHits.set(en.id, st);
            }
          }
          juicePunch(0.48, 0.6);
        }
      }

      // combine bullet + beam hits
      for (const [id, dmg] of beamHits.entries()) {
        bulletHits.set(id, (bulletHits.get(id) || 0) + dmg);
      }

      // -------------------- FIRING --------------------
      const now3 = Date.now();
      const pp = playerRef.current;
      const currentEnemies = movedEnemies.filter((e) => e.type !== 'ghost_spirit');

      if (currentEnemies.length) {
        const overdrive = now3 < overdriveUntil.current;
        const doubleDamage = now3 < doubleDamageUntil.current;
        const overdriveMult = overdrive ? 1.5 : 1.0;
        const tNow = talentsRef.current;

        const fireSupportShot = (origin, target, damage, color, speed = 18, width = 10, height = 4) => {
          if (!target) return;
          const a = Math.atan2(target.y - origin.y, target.x - origin.x);
          spawnedBullets.push({
            id: Math.random(),
            x: origin.x,
            y: origin.y,
            originX: origin.x,
            originY: origin.y,
            vx: Math.cos(a) * speed,
            vy: Math.sin(a) * speed,
            damage: damage * (statsRef.current.damageMult || 1) * crewDamageMult * (doubleDamage ? 2 : 1),
            color,
            life: 780,
            lifeStart: 780,
            width,
            height,
            pierce: 1,
            ricochets: 0,
            chain: 0,
            slow: 0,
            slowDuration: 0,
            stun: 0,
            knockback: 0,
            explodeRadius: 0,
            explodeMult: 0,
            burn: 0,
            microFreeze: 0,
            eliteDmgMult: 0.85
          });
        };

        playerTurretsRef.current = (playerTurretsRef.current || []).filter((t) => t.hp > 0 && now3 < t.until);
        for (const turret of playerTurretsRef.current) {
          if (tNow.turretFlamePillar && turret.flameAt && !turret.flameDone && now3 >= turret.flameAt) {
            turret.flameDone = true;
            const radius = 245;
            explosionsRef.current = appendCapped(explosionsRef.current, {
              id: `turret_flame_${Math.random()}`,
              x: turret.x,
              y: turret.y,
              r: radius,
              t: now3,
              life: 1500,
              color: 'rgba(255,104,28,1)',
              glow: 24,
              fill: true,
              alpha: 0.24
            }, PERF_EFFECT_CAP);
            for (const en of querySpatialGrid(enemySpatial, turret.x, turret.y, radius + 70)) {
              if (en.turretWall) continue;
              const d = Math.hypot(en.x - turret.x, en.y - turret.y);
              if (d > radius) continue;
              const fall = Math.max(0.25, 1 - d / radius);
              bulletHits.set(en.id, (bulletHits.get(en.id) || 0) + (120 + tileDifficulty * 18) * fall);
              const st = statusHits.get(en.id) || {};
              st.burn = Math.max(st.burn || 0, 5200);
              st.slow = Math.max(st.slow || 0, 0.12);
              st.slowDuration = Math.max(st.slowDuration || 0, 1200);
              statusHits.set(en.id, st);
            }
            pushToast('TURRET FLAME PILLAR');
          }
          if (now3 < (turret.nextShotAt || 0)) continue;
          const target = currentEnemies.reduce((closest, en) => {
            if (en.turretWall) return closest;
            const d = Math.hypot(en.x - turret.x, en.y - turret.y);
            if (d > 760) return closest;
            if (!closest) return en;
            return d < Math.hypot(closest.x - turret.x, closest.y - turret.y) ? en : closest;
          }, null);
          if (target) {
            fireSupportShot(turret, target, 22, '#ffda6b', 22, 13, 5);
            turret.nextShotAt = now3 + 155;
            if (tNow.turretBomb && now3 >= (turret.nextBombAt || 0)) {
              turret.nextBombAt = now3 + 2300;
              const a = Math.atan2(target.y - turret.y, target.x - turret.x);
              const dist = Math.min(520, Math.hypot(target.x - turret.x, target.y - turret.y));
              playerBombsRef.current = appendCapped(playerBombsRef.current, {
                id: `turret_bomb_${Math.random()}`,
                x: turret.x + Math.cos(a) * dist,
                y: turret.y + Math.sin(a) * dist,
                detonateAt: now3 + 2000,
                radius: 185,
                damage: 85 + tileDifficulty * 12
              }, 18);
            }
          } else {
            turret.nextShotAt = now3 + 180;
          }
        }

        if (now3 < fleetUntilRef.current && now3 - (lastFire.current.__fleet || 0) > 190) {
          lastFire.current.__fleet = now3;
          const a = (now3 / 820) % (Math.PI * 2);
          const origin = { x: pp.x + Math.cos(a) * 210, y: pp.y + Math.sin(a) * 210 };
          fireSupportShot(origin, currentEnemies[Math.floor(Math.random() * currentEnemies.length)], 9.5, '#9bffef', 20, 11, 4);
          arcsRef.current = [...(arcsRef.current || []), { id: Math.random(), x1: pp.x, y1: pp.y, x2: origin.x, y2: origin.y, t: now3, life: 120, color: '#9bffef' }];
        }

        if (tNow.droneOrbit && now3 < droneUntilRef.current && now3 - droneLastFireRef.current > 145) {
          droneLastFireRef.current = now3;
          const sortedByAngle = [...currentEnemies].sort((a, b) => Math.atan2(a.y - pp.y, a.x - pp.x) - Math.atan2(b.y - pp.y, b.x - pp.x));
          const a = (now3 / 185) % (Math.PI * 2);
          const targetA = sortedByAngle[0] || currentEnemies[0];
          const targetB = sortedByAngle[Math.floor(sortedByAngle.length * 0.55)] || currentEnemies[currentEnemies.length - 1] || targetA;
          [
            { side: -1, target: targetA, color: '#ffd36b' },
            { side: 1, target: targetB, color: '#9bffef' }
          ].forEach((shot) => {
            const origin = { x: pp.x + Math.cos(a + shot.side * Math.PI * 0.88) * 92, y: pp.y + Math.sin(a + shot.side * Math.PI * 0.88) * 92 };
            fireSupportShot(origin, shot.target, 6.2, shot.color, 22, 10, 4);
          });
        }

        if (tNow.onboardProduction && now3 - (lastFire.current.__talentPistol || 0) > 980) {
          lastFire.current.__talentPistol = now3;
          const target = currentEnemies.reduce((closest, en) => {
            const d = Math.hypot(en.x - pp.x, en.y - pp.y);
            if (!closest) return en;
            return d < Math.hypot(closest.x - pp.x, closest.y - pp.y) ? en : closest;
          }, null);
          fireSupportShot(pp, target, 8.5, '#fff2a6', 13.5, 12, 4);
        }

        if (tNow.katanaBackup && now3 - (lastFire.current.__talentKnife || 0) > 15000) {
          lastFire.current.__talentKnife = now3;
          const target = currentEnemies.reduce((closest, en) => {
            const d = Math.hypot(en.x - pp.x, en.y - pp.y);
            if (!closest) return en;
            return d < Math.hypot(closest.x - pp.x, closest.y - pp.y) ? en : closest;
          }, null);
          if (target) {
            const angle = Math.atan2(target.y - pp.y, target.x - pp.x);
            const combo = [
              { delay: 0, off: -0.34, color: 'rgba(120,230,255,1)' },
              { delay: 110, off: 0.34, color: 'rgba(0,255,180,1)' },
              { delay: 230, off: -0.18, color: 'rgba(120,230,255,1)' },
              { delay: 360, off: 0.18, color: 'rgba(0,255,180,1)' },
              { delay: 500, off: -0.06, color: 'rgba(255,255,255,1)' },
              { delay: 650, off: 0.06, color: 'rgba(120,230,255,1)' }
            ];
            combo.forEach((cut) => {
              spawnedSlashes.push({
                id: Math.random(),
                x: pp.x,
                y: pp.y,
                range: 122,
                damage: 9.2 * crewDamageMult * (doubleDamage ? 2 : 1),
                angle: angle + cut.off,
                arc: Math.PI * 0.24,
                delay: cut.delay,
                activeMs: 110,
                age: 0,
                life: cut.delay + 180,
                kind: 'crescent',
                color: cut.color,
                glowColor: 'rgba(0,242,255,0.60)',
                glowBlur: 18,
                lineWidth: 9,
                side: 1,
                knockback: 0.18,
                burn: 2600
              });
            });
            const speed = 20;
            spawnedBullets.push({
              id: Math.random(),
              x: pp.x,
              y: pp.y,
              originX: pp.x,
              originY: pp.y,
              vx: Math.cos(angle) * speed,
              vy: Math.sin(angle) * speed,
              angle,
              damage: 6.5 * crewDamageMult * (doubleDamage ? 2 : 1),
              color: '#8efaff',
              life: 2400,
              lifeStart: 2400,
              delay: 830,
              age: 0,
              width: 58,
              height: 10,
              pierce: 999,
              ricochets: 0,
              burn: 5200,
              knockback: 0.22,
              eliteDmgMult: 0.65,
              swordThrow: true
            });
            arcsRef.current = [...(arcsRef.current || []), { id: Math.random(), x1: pp.x, y1: pp.y, x2: pp.x + Math.cos(angle) * 190, y2: pp.y + Math.sin(angle) * 190, t: now3 + 830, life: 360, color: 'rgba(120,230,255,0.95)' }];
            juicePunch(0.55, 0.50);
          }
        }

        selectedWeaponsRef.current.forEach((id) => {
          const weapon = WEAPONS.find((w) => w.id === id);
          if (!weapon) return;

          const lvl = weaponLevelsRef.current[id] || 1;
          let wStats = buildWeaponStats(weapon, lvl);

          // Late game (rank 3–5): scale utility/CC/AoE so builds feel like they come online
          if (lvl >= 3) {
            const fxT = norm01(progT, 0.55, 1.0);
            if (fxT > 0) {
              const rankBoost = (lvl - 2) / 3; // 0.33..1
              const fx = fxT * rankBoost;

              if (wStats.slow) wStats.slow = clamp(wStats.slow * (1 + fx * 0.55), 0, 0.65);
              if (wStats.slowDuration) wStats.slowDuration = Math.round(wStats.slowDuration * (1 + fx * 0.70));
              if (wStats.zapSlow) wStats.zapSlow = clamp(wStats.zapSlow * (1 + fx * 0.45), 0, 0.55);
              if (wStats.zapSlowDuration) wStats.zapSlowDuration = Math.round(wStats.zapSlowDuration * (1 + fx * 0.60));
              if (wStats.stun) wStats.stun = Math.round(wStats.stun * (1 + fx * 0.55));
              if (wStats.microFreeze) wStats.microFreeze = Math.round(wStats.microFreeze * (1 + fx * 0.60));

              if (wStats.explodeRadius) wStats.explodeRadius = Math.round(wStats.explodeRadius * (1 + fx * 0.45));
              if (wStats.explodeMult) wStats.explodeMult = wStats.explodeMult * (1 + fx * 0.22);

              if (wStats.pull) wStats.pull = wStats.pull * (1 + fx * 0.50);
              if (wStats.pullRadius) wStats.pullRadius = Math.round(wStats.pullRadius * (1 + fx * 0.30));
              if (wStats.vortexDps) wStats.vortexDps = wStats.vortexDps * (1 + fx * 0.30);

              if (wStats.knockback) wStats.knockback = wStats.knockback * (1 + fx * 0.40);

              // tasteful extra proc counts very late (kept small so it doesn't break balance)
              if (fxT > 0.78 && lvl >= 4) {
                if (wStats.chain) wStats.chain = Math.min(10, (wStats.chain || 0) + 1);
                if (wStats.ricochets) wStats.ricochets = Math.min(4, (wStats.ricochets || 0) + 1);
                if (wStats.fork) wStats.fork = Math.min(4, (wStats.fork || 0) + 1);
                if (wStats.split) wStats.split = Math.min(3, (wStats.split || 0) + 1);
              }
            }
          }

          const last = lastFire.current[id] || 0;
          let fireCooldownBase = (wStats.cooldown || 600) / (statsRef.current.attackSpeed || 1);
          if (weapon.id === 'AXES') {
            const nextAxeStep = (axeComboRef.current % 3) + 1;
            const rhythmMult = nextAxeStep === 1 ? 0.86 : nextAxeStep === 2 ? 1.02 : 1.36;
            fireCooldownBase *= rhythmMult;
          }
          const fireCooldown = fireCooldownBase / overdriveMult;

          if (now3 - last < fireCooldown) return;
          lastFire.current[id] = now3;

          // ---- target selection ----
          let target = null;

          if (weapon.id === 'TESLA') {
            const startLeash = clamp(150 + (lvl - 1) * 35, 150, 320);

            const pickClosest = (list) =>
              list.reduce((closest, en) => {
                if (!closest) return en;
                const d = Math.hypot(en.x - pp.x, en.y - pp.y);
                const cd = Math.hypot(closest.x - pp.x, closest.y - pp.y);
                return d < cd ? en : closest;
              }, null);

            const near = currentEnemies.filter((e) => Math.hypot(e.x - pp.x, e.y - pp.y) <= startLeash);
            target = pickClosest(near);

            if (!target) return;
          } else {
            target =
              weapon.targeting === 'random'
                ? currentEnemies[Math.floor(Math.random() * currentEnemies.length)]
                : currentEnemies.reduce((closest, en) => {
                    const d = Math.hypot(en.x - pp.x, en.y - pp.y);
                    if (!closest) return en;
                    const cd = Math.hypot(closest.x - pp.x, closest.y - pp.y);
                    return d < cd ? en : closest;
                  }, null);
          }

          if (!target) return;

          const baseAngle = Math.atan2(target.y - pp.y, target.x - pp.x);

          // TESLA
          if (weapon.id === 'TESLA') {
            const baseDamage = (wStats.damage || 12) * (statsRef.current.damageMult || 1) * crewDamageMult * (doubleDamage ? 2 : 1);
            const maxJumps = wStats.chain || 3;
            const arcRange = wStats.arcRange || 300;
            const leash = clamp(190 + (lvl - 1) * 45, 190, 420);

            const stunMs = wStats.stun || 90;
            const fork = wStats.fork || 0;
            const falloff = wStats.chainFalloff || 0.90;

            const hit = new Set();
            const arcsToAdd = [];

            const findNext = (from) => {
              let best = null;
              let bestD = Infinity;
              for (const e of currentEnemies) {
                if (hit.has(e.id)) continue;

                const dp = Math.hypot(e.x - pp.x, e.y - pp.y);
                if (dp > leash) continue;

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

              const dmg = baseDamage * (i === 0 ? 1 : falloff);
              bulletHits.set(cur.id, (bulletHits.get(cur.id) || 0) + dmg);

              const st = statusHits.get(cur.id) || {};
              st.stun = Math.max(st.stun || 0, stunMs + i * 15);
              const zapSlow = (wStats.zapSlow ?? 0.14);
              const zapSlowDur = (wStats.zapSlowDuration ?? 720);
              st.slow = Math.max(st.slow || 0, zapSlow);
              st.slowDuration = Math.max(st.slowDuration || 0, zapSlowDur);
              statusHits.set(cur.id, st);

              arcsToAdd.push({ id: Math.random(), x1: origin.x, y1: origin.y, x2: cur.x, y2: cur.y, t: Date.now(), life: 180, color: weapon.color });

              origin = { x: cur.x, y: cur.y };
              cur = findNext(origin);
            }

            if (fork > 0) {
              const forkTargets = currentEnemies
                .filter((e) => !hit.has(e.id))
                .sort((a, b) => Math.hypot(a.x - target.x, a.y - target.y) - Math.hypot(b.x - target.x, b.y - target.y))
                .slice(0, fork);

              forkTargets.forEach((ft) => {
                bulletHits.set(ft.id, (bulletHits.get(ft.id) || 0) + baseDamage * 0.65);
                const st = statusHits.get(ft.id) || {};
                st.stun = Math.max(st.stun || 0, Math.floor(stunMs * 0.7));
                const zapSlow = (wStats.zapSlow ?? 0.12);
                const zapSlowDur = (wStats.zapSlowDuration ?? 650);
                st.slow = Math.max(st.slow || 0, zapSlow);
                st.slowDuration = Math.max(st.slowDuration || 0, zapSlowDur);
                statusHits.set(ft.id, st);

                arcsToAdd.push({ id: Math.random(), x1: target.x, y1: target.y, x2: ft.x, y2: ft.y, t: Date.now(), life: 170, color: weapon.color });
              });
            }

            if (wStats.storm) {
              explosionsRef.current = [...(explosionsRef.current || []), { id: Math.random(), x: target.x, y: target.y, r: 110, t: Date.now(), life: 320 }];
              currentEnemies.forEach((e) => {
                const d = Math.hypot(e.x - target.x, e.y - target.y);
                if (d <= 110) {
                  bulletHits.set(e.id, (bulletHits.get(e.id) || 0) + baseDamage * 0.42);
                  const st = statusHits.get(e.id) || {};
                  st.slow = Math.max(st.slow || 0, 0.22);
                  st.slowDuration = Math.max(st.slowDuration || 0, 900);
                  statusHits.set(e.id, st);
                }
              });
            }

            arcsRef.current = [...(arcsRef.current || []), ...arcsToAdd];
            juicePunch(0.7, 0.8);
            return;
          }

          // Directional melee weapons
          if (weapon.id === 'KATANA' || weapon.id === 'AXES') {
            if (weapon.id === 'AXES') {
              axeComboRef.current += 1;
              const combo = axeComboRef.current;
              const step = ((combo - 1) % 3) + 1;
              const cycle = Math.floor((combo - 1) / 3);
              const baseDamage = (wStats.damage || 10) * (statsRef.current.damageMult || 1) * crewDamageMult * (doubleDamage ? 2 : 1);
              const baseRange = wStats.range || 170;
              const bleed = wStats.bleed || 0;

              if (step === 3 && cycle % 2 === 1) {
                const speed = 18.5;
                const throwCount = wStats.throwCount || 1;
                for (let ti = 0; ti < throwCount; ti += 1) {
                  const off = throwCount === 1 ? 0 : (ti - (throwCount - 1) / 2) * 0.30;
                  const aThrow = baseAngle + off;
                  const sideOffset = throwCount === 1 ? 0 : (ti - (throwCount - 1) / 2) * 18;
                  const sx = pp.x + Math.cos(aThrow + Math.PI / 2) * sideOffset;
                  const sy = pp.y + Math.sin(aThrow + Math.PI / 2) * sideOffset;
                  spawnedBullets.push({
                    id: Math.random(),
                    x: sx,
                    y: sy,
                    originX: sx,
                    originY: sy,
                    vx: Math.cos(aThrow) * speed,
                    vy: Math.sin(aThrow) * speed,
                    angle: aThrow,
                    damage: baseDamage * (wStats.throwMult || 1.15),
                    color: weapon.color,
                    life: 2100,
                    lifeStart: 2100,
                    width: 66,
                    height: 32,
                    pierce: 0,
                    ricochets: wStats.throwBounces || 5,
                    burn: bleed,
                    knockback: 1.20,
                    eliteDmgMult: 0.92,
                    axeThrow: true,
                    spinDir: ti % 2 === 0 ? 1 : -1
                  });
                }
                arcsRef.current = [...(arcsRef.current || []), {
                  id: Math.random(),
                  x1: pp.x,
                  y1: pp.y,
                  x2: pp.x + Math.cos(baseAngle) * 115,
                  y2: pp.y + Math.sin(baseAngle) * 115,
                  t: Date.now(),
                  life: 140,
                  color: 'rgba(255,64,24,0.95)'
                }];
                juicePunch(0.58, 0.75);
                return;
              }

              const pattern = step === 3
                ? [{
                    delay: 0,
                    offset: 0,
                    arc: Math.PI * 2,
                    kind: 'axeStorm',
                    side: 1,
                    dmgMult: wStats.stormMult || 0.75,
                    color: 'rgba(255,54,20,1)',
                    glowColor: 'rgba(255,0,0,0.90)',
                    glowBlur: 34,
                    lineWidth: 24,
                    activeMs: 540,
                    rangeMult: wStats.stormRangeMult || 1,
                    knockback: 0.62
                  }]
                : [{
                    delay: 0,
                    offset: 0,
                    arc: Math.PI * 0.48,
                    kind: 'axeCleave',
                    side: step === 1 ? -1 : 1,
                    dmgMult: 1,
                    color: step === 1 ? 'rgba(255,54,24,1)' : 'rgba(255,132,42,1)',
                    glowColor: 'rgba(255,16,0,0.82)',
                    glowBlur: 26,
                    lineWidth: 24,
                    activeMs: 250,
                    rangeMult: 1,
                    knockback: 1.02
                  }];

              const toAdd = pattern.map((pat) => {
                const dmg = baseDamage * (pat.dmgMult || 1);
                const delay = pat.delay || 0;
                const activeMs = Number.isFinite(pat.activeMs) ? pat.activeMs : 160;
                const rangeMult = Number.isFinite(pat.rangeMult) ? pat.rangeMult : 1;

                return {
                  id: Math.random(),
                  x: pp.x,
                  y: pp.y,
                  range: baseRange * rangeMult,
                  damage: dmg,
                  angle: pat.kind === 'axeCleave' ? baseAngle + (pat.side || 1) * 0.44 : baseAngle,
                  arc: pat.arc || Math.PI * 0.48,
                  delay,
                  activeMs,
                  age: 0,
                  life: delay + activeMs + 40,
                  kind: pat.kind,
                  color: pat.color,
                  lineWidth: pat.lineWidth,
                  glowColor: pat.glowColor,
                  glowBlur: pat.glowBlur,
                  side: pat.side || 1,
                  slow: 0,
                  slowDuration: 0,
                  stun: 0,
                  microFreeze: 0,
                  knockback: pat.knockback || 0,
                  burn: bleed,
                  deathBurstRadius: wStats.deathBurstRadius || 0,
                  deathBurstMult: wStats.deathBurstMult || 0
                };
              });

              spawnedSlashes.push(...toAdd);
              juicePunch(step === 3 ? 0.55 : 0.34, step === 3 ? 0.68 : 0.42);
              return;
            }

            const pattern =
              wStats.slashPattern && wStats.slashPattern.length
                ? wStats.slashPattern
                : [{ delay: 0, offset: 0, arc: Math.PI * 0.34, kind: 'crescent', dmgMult: 1 }];

            const baseDamage = (wStats.damage || 10) * (statsRef.current.damageMult || 1) * crewDamageMult * (doubleDamage ? 2 : 1);
            const baseRange = wStats.range || 165;

            const toAdd = pattern.map((pat) => {
              const dmg = baseDamage * (pat.dmgMult || 1);
              const arc = pat.arc || Math.PI * 0.34;
              const delay = pat.delay || 0;
              const activeMs = Number.isFinite(pat.activeMs) ? pat.activeMs : 120;
              const rangeMult = Number.isFinite(pat.rangeMult) ? pat.rangeMult : 1;

              return {
                id: Math.random(),
                x: pp.x,
                y: pp.y,
                range: baseRange * rangeMult,
                damage: dmg,
                angle: weapon.id === 'AXES' && pat.kind === 'axeCleave' ? baseAngle + (pat.side || 1) * 0.46 : baseAngle + (pat.offset || 0),
                arc: weapon.id === 'AXES' && pat.kind === 'axeCleave' ? Math.max(arc, Math.PI * 0.30) : arc,
                delay,
                activeMs,
                age: 0,
                life: delay + 240,
                kind: pat.kind || 'crescent',
                color: pat.color,
                lineWidth: pat.lineWidth,
                glowColor: pat.glowColor,
                glowBlur: pat.glowBlur,
                side: pat.side || 1,
                shockwaveRadius: pat.shockwaveRadius || 0,

                // NEW: rank 3-5 effects
                slow: pat.slow || 0,
                slowDuration: pat.slowDuration || 0,
                stun: pat.stun || 0,
                microFreeze: pat.microFreeze || 0,
                knockback: pat.knockback || 0,
                burn: Math.max(pat.burn || 0, wStats.bleed || 0),
                deathBurstRadius: wStats.deathBurstRadius || 0,
                deathBurstMult: wStats.deathBurstMult || 0
              };
            });

            spawnedSlashes.push(...toAdd);
            juicePunch(0.30, 0.35);
            return;
          }

          // LASER
          if (weapon.id === 'LASER') {
            const beamsN = wStats.beams || 1;
            const fan = wStats.fan || 0;
            const beamLen = 980;
            const width = wStats.beamWidth || 34;
            const beamMs = wStats.beamMs || 160;
            const tickMs = wStats.tickMs || 16;
            const burn = wStats.burn || 0;

            for (let i = 0; i < beamsN; i++) {
              const off = beamsN === 1 ? 0 : (i - (beamsN - 1) / 2) * fan;
              const ang = baseAngle + off;
              beamsRef.current = [...(beamsRef.current || []), {
                id: Math.random(),
                x1: pp.x,
                y1: pp.y,
                x2: pp.x + Math.cos(ang) * beamLen,
                y2: pp.y + Math.sin(ang) * beamLen,
                width,
                damage: (wStats.damage || 8) * (statsRef.current.damageMult || 1) * crewDamageMult * (doubleDamage ? 2 : 1),
                eliteDmgMult: wStats.eliteDmgMult ?? 1,
                tickMs,
                burn,

                // NEW: beam control
                slow: wStats.slow || 0,
                slowDuration: wStats.slowDuration || 0,
                microFreeze: wStats.microFreeze || 0,
                stun: wStats.stun || 0,

                t: Date.now(),
                life: beamMs
              }];
            }

            juicePunch(0.65, 0.8);
            return;
          }

          // ALL RANGED
          const pellets = wStats.pellets || 1;
          const next = [];

          const isRocket = weapon.id === 'ROCKET';

          for (let i = 0; i < pellets; i += 1) {
            let a = baseAngle;

            if (isRocket) {
              const arc = wStats.burstArc ?? 0.12;
              const jitter = (Math.random() - 0.5) * (wStats.spread || 0.04);
              a = baseAngle + (pellets === 1 ? 0 : (i - (pellets - 1) / 2) * arc) + jitter;
            } else {
              const spread = (Math.random() - 0.5) * (wStats.spread || 0);
              a = baseAngle + spread;
            }

            let smgPierceBonus = 0;
            if (weapon.id === 'SMG') {
              smgCounter.current += 1;
              if (smgCounter.current % 5 === 0) smgPierceBonus = 1;
            }

            const baseSpeed = wStats.bulletSpeed || 12;
            const speed = isRocket ? baseSpeed : baseSpeed;

            const vx = Math.cos(a) * speed;
            const vy = Math.sin(a) * speed;

            const isSniper = weapon.id === 'SNIPER';

            next.push({
              id: Math.random(),
              x: pp.x,
              y: pp.y,
              originX: pp.x,
              originY: pp.y,
              vx,
              vy,
              damage: (wStats.damage || 1) * (statsRef.current.damageMult || 1) * crewDamageMult * (doubleDamage ? 2 : 1),
              color: weapon.color,
              life: wStats.lifeMs || (isSniper ? 900 : 1000),
              lifeStart: wStats.lifeMs || (isSniper ? 900 : 1000),
              width: wStats.width,
              height: wStats.height,
              delay: isRocket ? i * (wStats.burstDelay || 120) : 0,
              age: 0,
              pierce: (wStats.pierce ?? 0) + smgPierceBonus,
              flashy: wStats.flashy,
              rocketVisual: !!wStats.rocketVisual || isRocket,

              ricochets: wStats.ricochets || 0,
              chain: wStats.chain || 0,
              slow: wStats.slow || 0,
              slowDuration: wStats.slow ? (wStats.slowDuration || (weapon.id === 'TIME' ? 1100 : 520)) : 0,
              stun: wStats.stun || 0,
              knockback: wStats.knockback || 0,
              explodeRadius: wStats.explodeRadius || 0,
              explodeMult: wStats.explodeMult || 0,
              burn: wStats.burn || 0,
              aoeBurn: wStats.aoeBurn !== false,
              microFreeze: wStats.microFreeze || 0,

              // Sniper fairness vs elites
              eliteDmgMult: wStats.eliteDmgMult || 1,

              isHoming: !!wStats.homing,
              accel: wStats.accel || 0,
              homeTargetId: null,

              pull: wStats.pull || 0,
              pullRadius: wStats.pullRadius || 0,
              vortexDps: wStats.vortexDps || 0,
              maxRange: wStats.maxRange || 0,
              anchorOnMaxRange: !!wStats.anchorOnMaxRange,
              anchored: false,
              dirAngle: a,
              split: wStats.split || 0,
              singularity: !!wStats.singularity,

              rail: !!wStats.rail,
              railWidth: wStats.railWidth || 18,
              railMs: wStats.railMs || 90,
              timeBolt: !!wStats.timeBolt || weapon.id === 'TIME'
            });
          }

          spawnedBullets.push(...next);
        });
      }

      // -------------------- APPLY DAMAGE (bullets + sword arcs) --------------------
      {
        const pendingBombs = playerBombsRef.current || [];
        if (pendingBombs.length) {
          const keptBombs = [];
          for (const bomb of pendingBombs) {
            if (now3 < bomb.detonateAt) {
              keptBombs.push(bomb);
              continue;
            }
            const radius = bomb.radius || 185;
            explosionsRef.current = appendCapped(explosionsRef.current, { id: Math.random(), x: bomb.x, y: bomb.y, r: radius, t: now3, life: 360, color: 'rgba(255,218,107,1)', glow: 26, fill: true, alpha: 0.18 }, PERF_EFFECT_CAP);
            for (const en of querySpatialGrid(enemySpatial, bomb.x, bomb.y, radius + 64)) {
              const d = Math.hypot(en.x - bomb.x, en.y - bomb.y);
              if (d > radius) continue;
              const fall = Math.max(0.28, 1 - d / radius);
              bulletHits.set(en.id, (bulletHits.get(en.id) || 0) + (bomb.damage || 80) * fall);
              const st = statusHits.get(en.id) || {};
              st.slow = Math.max(st.slow || 0, 0.32);
              st.slowDuration = Math.max(st.slowDuration || 0, 1800);
              st.stun = Math.max(st.stun || 0, 90);
              st.burn = Math.max(st.burn || 0, 600);
              statusHits.set(en.id, st);
            }
          }
          playerBombsRef.current = keptBombs;
        }
      }
      const allSlashes = [...movedSlashes, ...spawnedSlashes];
      const voidDamageHits = new Map();
      const voidPullHits = new Map();
      const anchoredVoids = movedBullets
        .filter((b) => b.vortexDps && b.anchored)
        .map((b) => {
          const grow = clamp((now3 - (b.anchoredAt || now3)) / 760, 0, 1);
          return { ...b, fieldRadius: Math.max(28, (b.pullRadius || 200) * grow) };
        })
        .filter((b) => b.fieldRadius > 0)
        .slice(-12);
      for (const v of anchoredVoids) {
        for (const en of querySpatialGrid(enemySpatial, v.x, v.y, v.fieldRadius + 64)) {
          if (en.type === 'ghost_spirit') continue;
          const d = Math.hypot(v.x - en.x, v.y - en.y);
          if (d >= v.fieldRadius) continue;
          voidDamageHits.set(en.id, (voidDamageHits.get(en.id) || 0) + (v.vortexDps || 0) * 0.016);
          if (!freezeWorld && !isControlImmune(en.type) && (v.pull || 0) > (voidPullHits.get(en.id)?.pull || 0)) {
            voidPullHits.set(en.id, v);
          }
          if ((v.slow || 0) > 0 && !isControlImmune(en.type)) {
            const st = statusHits.get(en.id) || {};
            st.slow = Math.max(st.slow || 0, v.slow || 0);
            st.slowDuration = Math.max(st.slowDuration || 0, v.slowDuration || 650);
            statusHits.set(en.id, st);
          }
        }
      }
      const withDamage = movedEnemies.map((en0) => {
        let en = en0;
        if (en.hidden) return en;
        if (en.type === 'ghost_spirit') return en;
        if (en.turretWall) return en;
        let totalDamage = (bulletHits.get(en.id) || 0) + (voidDamageHits.get(en.id) || 0);

        if (en.damageReductionUntil && Date.now() < en.damageReductionUntil) {
          totalDamage *= (en.damageReductionMult ?? 0.7);
        }

        allSlashes.forEach((sl) => {
          const activeStart = sl.delay || 0;
          const activeEnd = activeStart + (sl.activeMs || 120);
          if ((sl.age || 0) < activeStart || (sl.age || 0) > activeEnd) return;

          const d = Math.hypot(en.x - sl.x, en.y - sl.y);
          if (d > sl.range) return;

          const enemyAngle = Math.atan2(en.y - sl.y, en.x - sl.x);
          if (!withinArc(sl.angle, sl.arc, enemyAngle)) return;

          totalDamage += sl.damage;

          // NEW: katana CC on hit (rank 3-5)
          const st = statusHits.get(en.id) || {};
          if (sl.slow) {
            st.slow = Math.max(st.slow || 0, sl.slow);
            st.slowDuration = Math.max(st.slowDuration || 0, sl.slowDuration || 780);
          }
          if (sl.microFreeze) st.stun = Math.max(st.stun || 0, sl.microFreeze);
          if (sl.stun) st.stun = Math.max(st.stun || 0, sl.stun);
          if (sl.knockback) st.knockback = Math.max(st.knockback || 0, sl.knockback);
          if (sl.burn) st.burn = Math.max(st.burn || 0, sl.burn);
          if (sl.deathBurstRadius) {
            st.deathBurstRadius = Math.max(st.deathBurstRadius || 0, sl.deathBurstRadius);
            st.deathBurstDamage = Math.max(st.deathBurstDamage || 0, sl.damage * (sl.deathBurstMult || 0.45));
          }
          statusHits.set(en.id, st);
        });

        const strongestVoid = voidPullHits.get(en.id);
        if (strongestVoid && !freezeWorld && !isControlImmune(en.type)) {
          const dx = strongestVoid.x - en.x;
          const dy = strongestVoid.y - en.y;
          const d = Math.hypot(dx, dy) || 1;
          en = { ...en, x: en.x + (dx / d) * (strongestVoid.pull || 1) * 1.65, y: en.y + (dy / d) * (strongestVoid.pull || 1) * 1.65 };
        }

        if (totalDamage > 0) {
          damageDealtRef.current += totalDamage;
          juicePunch(Math.min(0.34, totalDamage / 90), 0.28);
          return { ...en, hp: en.hp - totalDamage };
        }
        return en;
      });

      // -------------------- APPLY STATUS + KNOCKBACK --------------------
      const withStatus = withDamage.map((en) => {
        const st = statusHits.get(en.id);
        if (!st) return en;

        let out = { ...en };

        const isMini = String(out.type || '').startsWith('mini_');
        const isCharging = out.type === 'mini_charger' && ((out.windupUntil && Date.now() < out.windupUntil) || (out.dashUntil && Date.now() < out.dashUntil));

        // Don't let slow/knockback/stun trivialize RAM chargers while they're charging.
        if (st.slow && !isControlImmune(out.type)) {
          out.slowUntil = Date.now() + (st.slowDuration || 520);
          out.slowFactor = clamp(1 - st.slow, 0.45, 0.95);
        }

        if (st.stun && !isControlImmune(out.type) && !isCharging) {
          const stunMs = isMini ? Math.min(st.stun, 180) : st.stun;
          out.stunnedUntil = Math.max(out.stunnedUntil || 0, Date.now() + stunMs);
        }

        if (st.knockback && !freezeWorld && !isKnockbackImmune(out.type)) {
          const ang = Math.atan2(out.y - pPos.y, out.x - pPos.x);
          const push = 5.0 * st.knockback;
          out.x += Math.cos(ang) * push;
          out.y += Math.sin(ang) * push;
        }

          if (st.burn) {
            out.burnUntil = Math.max(out.burnUntil || 0, Date.now() + st.burn);
          out.burnDps = Math.max(out.burnDps || 0, 13.5);
          }

        if (st.deathBurstRadius) {
          out.deathBurstRadius = Math.max(out.deathBurstRadius || 0, st.deathBurstRadius);
          out.deathBurstDamage = Math.max(out.deathBurstDamage || 0, st.deathBurstDamage || 0);
        }

        return out;
      });

      const shieldHeld = withStatus;

      // burn tick
      const burned = shieldHeld.map((en) => {
        if (en.burnUntil && Date.now() < en.burnUntil) {
          const hp = en.hp - (en.burnDps || 3.2) * 0.016;
          return { ...en, hp };
        }
        return en;
      });

      // VOID singularity pop on expire
      const expiredVoids = bulletsRef.current.filter((b) => b.singularity && b.life <= 16);
      if (expiredVoids.length) {
        expiredVoids.slice(0, 8).forEach((v) => {
          explosionsRef.current = appendCapped(explosionsRef.current, { id: Math.random(), x: v.x, y: v.y, r: v.explodeRadius || 120, t: Date.now(), life: 320 }, PERF_EFFECT_CAP);
          for (const en of querySpatialGrid(enemySpatial, v.x, v.y, (v.explodeRadius || 120) + 64)) {
            const d = Math.hypot(en.x - v.x, en.y - v.y);
            if (d <= (v.explodeRadius || 120)) {
              const fall = 1 - d / (v.explodeRadius || 120);
              bulletHits.set(en.id, (bulletHits.get(en.id) || 0) + (v.damage || 14) * (v.explodeMult || 0.95) * Math.max(0.35, fall));
              const st = statusHits.get(en.id) || {};
              st.stun = Math.max(st.stun || 0, v.stun || 140);
              st.slow = Math.max(st.slow || 0, 0.18);
              st.slowDuration = Math.max(st.slowDuration || 0, 820);
              statusHits.set(en.id, st);
            }
          }
          juicePunch(0.9, 0.95);
        });
      }

      // -------------------- DEATHS -> ORBS + PICKUPS --------------------
      let alive = [];
      const newOrbs = [];
      const deathBursts = [];
      let twinBossDeath = null;

      let deathInput = burned;
      const phaseAdds = [];
      deathInput = deathInput.flatMap((en) => {
        if (en.type !== 'boss') return [en];
        const originalMax = en.originalMaxHp || en.maxHp || en.hp || 1;
        const hpPctOriginal = en.hp / Math.max(1, originalMax);

        if ((en.bossPhase || 'main') === 'main' && !en.split50Done && hpPctOriginal <= 0.50) {
          const twinMax = Math.round(originalMax * 0.32);
          const baseA = Math.random() * Math.PI * 2;
          for (let i = 0; i < 2; i += 1) {
            const a = baseA + i * Math.PI;
            phaseAdds.push({
              ...en,
              id: `boss_twin50_${i}_${Math.random()}`,
              bossPhase: 'twin50',
              split50Done: true,
              hp: twinMax,
              maxHp: twinMax,
              originalMaxHp: originalMax,
              x: clamp(en.x + Math.cos(a) * 150, 80, ARENA_SIZE - 80),
              y: clamp(en.y + Math.sin(a) * 150, 80, ARENA_SIZE - 80),
              size: 126,
              speed: (en.speed || 1.5) * 1.10,
              color: '#ff9f3a',
              xp: 160,
              nextRamPct: -1,
              bossWindupUntil: 0,
              bossRamUntil: 0
            });
          }
          explosionsRef.current = [...(explosionsRef.current || []), { id: Math.random(), x: en.x, y: en.y, r: 360, t: Date.now(), life: 620, color: 'rgba(255,170,50,1)', glow: 44, fill: true, alpha: 0.26 }];
          juicePunch(1.25, 1.0);
          return [];
        }

        if ((en.bossPhase || 'main') === 'main' && en.split50Done && !en.split20Done && hpPctOriginal <= 0.20) {
          const firstMax = Math.round(originalMax * 0.13);
          const baseA = Math.random() * Math.PI * 2;
          const initialPieces = Math.max(4, Math.round(2 * (en.cloneMult || 2)));
          const pendingReturns = Array.isArray(bossReturnPendingRef.current)
            ? [...bossReturnPendingRef.current]
            : bossReturnPendingRef.current
              ? [bossReturnPendingRef.current]
              : [];
          pendingReturns.push({
            x: en.x,
            y: en.y,
            originalMaxHp: originalMax,
            difficulty: tileDifficulty,
            chargesDone: en.chargesDone || 2,
            isFinalBoss: !!en.isFinalBoss,
            cloneMult: en.cloneMult || 2
          });
          bossReturnPendingRef.current = pendingReturns;
          for (let i = 0; i < initialPieces; i += 1) {
            const a = baseA + (i / initialPieces) * Math.PI * 2;
            phaseAdds.push({
              ...en,
              id: `boss_split_0_${i}_${Math.random()}`,
              type: 'boss_split',
              bossSplitStage: 0,
              hp: firstMax,
              maxHp: firstMax,
              x: clamp(en.x + Math.cos(a) * 130, 60, ARENA_SIZE - 60),
              y: clamp(en.y + Math.sin(a) * 130, 60, ARENA_SIZE - 60),
              size: 96,
              speed: 1.15,
              xp: 0,
              contactDamage: 20,
              color: '#a7ff48',
              bossWindupUntil: 0,
              bossRamUntil: 0
            });
          }
          explosionsRef.current = [...(explosionsRef.current || []), { id: Math.random(), x: en.x, y: en.y, r: 420, t: Date.now(), life: 700, color: 'rgba(166,255,72,1)', glow: 46, fill: true, alpha: 0.28 }];
          juicePunch(1.35, 1.0);
          return [];
        }

        return [en];
      });
      deathInput = [...deathInput, ...phaseAdds];

      deathInput.forEach((en) => {
        if (en.hp > 0) {
          alive.push(en);
          return;
        }

        if (en.type === 'ghost' && !en.revivedOnce) {
          deathFxRef.current = appendCapped(deathFxRef.current, { id: Math.random(), x: en.x, y: en.y, t: Date.now(), size: en.size }, PERF_DEATH_FX_CAP);
          alive.push({
            ...en,
            id: `ghost_spirit_${Math.random()}`,
            type: 'ghost_spirit',
            hp: 1,
            reviveHp: Math.max(18, Math.round((en.maxHp || 50) * 0.72)),
            maxHp: Math.max(18, Math.round((en.maxHp || 50) * 0.72)),
            reviveAt: Date.now() + 10000,
            speed: Math.max(1.2, (en.speed || 1.6) * 0.88),
            size: Math.max(24, en.size || 28),
            contactDamage: 0,
            xp: 0,
            color: '#8e929d',
            revivedOnce: true
          });
          return;
        }

        if (en.absorbedByPylon) {
          return;
        }

        deathFxRef.current = appendCapped(deathFxRef.current, { id: Math.random(), x: en.x, y: en.y, t: Date.now(), size: en.size }, PERF_DEATH_FX_CAP);
        if (playerGrabRef.current?.enemyId === en.id) playerGrabRef.current = null;
        onPlayerKill(en);

        if (en.deathBurstRadius && en.deathBurstDamage) {
          const radius = en.deathBurstRadius;
          explosionsRef.current = appendCapped(explosionsRef.current, { id: Math.random(), x: en.x, y: en.y, r: radius, t: Date.now(), life: 320, color: 'rgba(255,50,20,1)', glow: 24, fill: true, alpha: 0.42 }, PERF_EFFECT_CAP);
          deathBursts.push({ x: en.x, y: en.y, radius, damage: en.deathBurstDamage });
        }

        if (en.type === 'boss_split') {
          const stage = en.bossSplitStage || 0;
          const pieces = stage === 0 ? 4 : stage < 3 ? 2 : 0;
          for (let i = 0; i < pieces; i += 1) {
            const a = Math.random() * Math.PI * 2;
            const nextStage = stage + 1;
            const hp = Math.max(18, Math.round((en.maxHp || 80) * (nextStage === 1 ? 0.38 : 0.58)));
            alive.push({
              ...en,
              id: `boss_split_${nextStage}_${i}_${Math.random()}`,
              bossSplitStage: nextStage,
              x: clamp(en.x + Math.cos(a) * (42 + nextStage * 8), 20, ARENA_SIZE - 20),
              y: clamp(en.y + Math.sin(a) * (42 + nextStage * 8), 20, ARENA_SIZE - 20),
              hp,
              maxHp: hp,
              size: Math.max(24, (en.size || 70) * (nextStage === 1 ? 0.62 : 0.72)),
              speed: Math.min(1.65, (en.speed || 1.0) * 1.08),
              contactDamage: Math.max(7, Math.round((en.contactDamage || 16) * 0.78)),
              color: nextStage >= 3 ? '#eaff9b' : '#a7ff48',
              xp: 0
            });
          }
        }

        if ((en.type === 'splitter' || en.type === 'splitter_boss') && (en.splitTier || 0) > 0) {
          const pieces = en.type === 'splitter_boss' ? 10 : 3;
          for (let i = 0; i < pieces; i += 1) {
            const a = Math.random() * Math.PI * 2;
            const tier = (en.splitTier || 0) - 1;
            const hp = Math.max(14, Math.round((en.maxHp || 60) * (en.type === 'splitter_boss' ? 0.22 : 0.44)));
            alive.push({
              ...en,
              id: `splitter_${tier}_${Math.random()}`,
              type: 'splitter',
              splitTier: tier,
              x: clamp(en.x + Math.cos(a) * 38, 20, ARENA_SIZE - 20),
              y: clamp(en.y + Math.sin(a) * 38, 20, ARENA_SIZE - 20),
              hp,
              maxHp: hp,
              size: Math.max(22, (en.size || 42) * (en.type === 'splitter_boss' ? 0.48 : 0.74)),
              speed: Math.max(0.55, (en.speed || 0.9) * 0.96),
              xp: Math.max(2, Math.round((en.xp || 8) * 0.55)),
              contactDamage: Math.max(4, Math.round((en.contactDamage || 8) * 0.72)),
              color: tier === 0 ? '#eaff9b' : '#b6ff4a'
            });
          }
        }

        if (en.ghostOnDeath || en.type === 'abomination') {
          for (let i = 0; i < 10; i += 1) {
            const a = (Math.PI * 2 * i) / 10;
            const gh = spawnEnemy(tileDifficulty + 2, 'ghost', getProgressT());
            alive.push({
              ...gh,
              x: clamp(en.x + Math.cos(a) * 95, 30, ARENA_SIZE - 30),
              y: clamp(en.y + Math.sin(a) * 95, 30, ARENA_SIZE - 30),
              size: 34,
              color: '#d8dbe6'
            });
          }
          explosionsRef.current = [...(explosionsRef.current || []), { id: Math.random(), x: en.x, y: en.y, r: 260, t: Date.now(), life: 720, color: 'rgba(180,190,210,1)', glow: 40, fill: true, alpha: 0.26 }];
        }

        const total = en.type === 'boss_split' ? 0 : Math.max(2, Math.floor(en.xp * 0.90));
        const pack = Math.max(1, Math.round(total / 14));

        for (let i = 0; i < (total > 0 ? pack : 0); i += 1) {
          const skew = pack >= 2 && Math.random() < 0.35 ? 1.25 : 1.0;
          const v = Math.round((total / pack) * (0.85 + Math.random() * 0.35) * skew);
          const vis = orbVisualFromValue(v);
          newOrbs.push({
            id: Math.random(),
            x: en.x + (Math.random() - 0.5) * 22,
            y: en.y + (Math.random() - 0.5) * 22,
            value: v,
            ...vis
          });
        }

        if (elapsed.current > 45000 && Math.random() < 0.06) {
          const v = en.xp * 3;
          const vis2 = orbVisualFromValue(v);
          newOrbs.push({
            id: Math.random(),
            x: en.x + (Math.random() - 0.5) * 10,
            y: en.y + (Math.random() - 0.5) * 10,
            value: v,
            ...vis2
          });
        }

        if (en.type === 'boss' && en.bossPhase === 'twin50') {
          twinBossDeath = en;
        } else if (en.type === 'boss') {
          maybeDropPickup(en.x, en.y, 'boss');
          if (en.isFinalBoss) {
            if (requiresExtraction) {
              extractionRef.current = { active: true, progress: 0, x: en.x, y: en.y, radius: 172 };
              setExtractionUI({ active: true, progress: 0, x: en.x, y: en.y, radius: 172 });
              pushToast('EXTRACTION ZONE DEPLOYED');
              juicePunch(1.35, 1.0);
            } else {
              setVictory(true);
            }
          } else {
            pushToast('BOSS DOWN');
          }
        } else if (String(en.type).startsWith('mini_')) {
          maybeDropPickup(en.x, en.y, 'mini');
        } else if (Math.random() < 0.06) {
          maybeDropPickup(en.x, en.y, 'elite');
        }

        juicePunch(en.type === 'boss' ? 1.2 : 0.44, en.type === 'boss' ? 0.9 : 0.5);
      });

      if (twinBossDeath) {
        const originalMax = twinBossDeath.originalMaxHp || Math.round((twinBossDeath.maxHp || 1) / 0.32);
        const otherTwin = alive.find((en) => en.type === 'boss' && en.bossPhase === 'twin50');
        if (otherTwin) {
          alive = alive.map((en) => en.id === otherTwin.id ? {
            ...en,
            id: 'boss',
            bossPhase: 'main',
            split50Done: true,
            split20Done: false,
            hp: Math.round(originalMax * 0.49),
            maxHp: originalMax,
            originalMaxHp: originalMax,
            size: 150,
            speed: 1.55 + tileDifficulty * 0.03,
            color: '#ffda6b',
            xp: 520,
            nextRamPct: 0.32,
            chargesDone: Math.max(1, en.chargesDone || 1)
          } : en);
        } else {
          alive.push({
            ...spawnBoss({ x: twinBossDeath.x - 380, y: twinBossDeath.y + 320 }, tileDifficulty, {
              isFinalBoss: !!twinBossDeath.isFinalBoss,
              finalForm: !!twinBossDeath.isFinalBoss,
              tileDifficulty,
              cloneMult: twinBossDeath.cloneMult || 2,
            }),
            x: twinBossDeath.x,
            y: twinBossDeath.y,
            split50Done: true,
            split20Done: false,
            hp: Math.round(originalMax * 0.49),
            maxHp: originalMax,
            originalMaxHp: originalMax,
            nextRamPct: 0.32,
            chargesDone: 1
          });
        }
        explosionsRef.current = [...(explosionsRef.current || []), { id: Math.random(), x: twinBossDeath.x, y: twinBossDeath.y, r: 330, t: Date.now(), life: 620, color: 'rgba(255,218,107,1)', glow: 42, fill: true, alpha: 0.25 }];
        juicePunch(1.2, 1.0);
      }

      {
        const pendingList = Array.isArray(bossReturnPendingRef.current)
          ? bossReturnPendingRef.current
          : bossReturnPendingRef.current
            ? [bossReturnPendingRef.current]
            : [];
        if (pendingList.length > 0 && !alive.some((en) => en.type === 'boss_split')) {
          pendingList.forEach((pending) => {
            const originalMax = pending.originalMaxHp || Math.round((5400 + tileDifficulty * 220) * BOSS_HP_MULT);
            alive.push({
              ...spawnBoss({ x: pending.x - 380, y: pending.y + 320 }, pending.difficulty || tileDifficulty, {
                isFinalBoss: !!pending.isFinalBoss,
                finalForm: !!pending.isFinalBoss,
                tileDifficulty,
                cloneMult: pending.cloneMult || 2,
              }),
              x: pending.x,
              y: pending.y,
              hp: Math.round(originalMax * 0.19),
              maxHp: originalMax,
              originalMaxHp: originalMax,
              split50Done: true,
              split20Done: true,
              chargesDone: Math.max(2, pending.chargesDone || 2),
              nextRamPct: -1,
              zergPhaseDone: true
            });
            explosionsRef.current = [...(explosionsRef.current || []), { id: Math.random(), x: pending.x, y: pending.y, r: 520, t: Date.now(), life: 760, color: 'rgba(255,218,107,1)', glow: 52, fill: true, alpha: 0.30 }];
          });
          bossReturnPendingRef.current = [];
          juicePunch(1.45, 1.0);
        }
      }

      if (deathBursts.length) {
        const cappedDeathBursts = deathBursts.slice(0, 28);
        alive = alive.map((en) => {
          let dmg = 0;
          for (const burst of cappedDeathBursts) {
            const d = Math.hypot(en.x - burst.x, en.y - burst.y);
            if (d <= burst.radius) dmg += burst.damage * Math.max(0.30, 1 - d / burst.radius);
          }
          return dmg > 0 ? { ...en, hp: en.hp - dmg } : en;
        }).filter((en) => en.hp > 0);
      }

      enemiesRef.current = alive;
      bulletsRef.current = [...nextBullets.filter((b) => !b.hit), ...spawnedBullets].slice(-PERF_BULLET_CAP);
      slashesRef.current = allSlashes;
      if (newOrbs.length) orbsRef.current = [...(orbsRef.current || []), ...newOrbs];

      // -------------------- ORBS: attract + cluster + merge + pickup --------------------
      orbsRef.current = (() => {
        const prev = orbsRef.current || [];
        const pp2 = playerRef.current;
        const magnet = Date.now() < magnetUntil.current;
        const gravPickup = !!talentsRef.current.gravPickup;

        const clustered = prev.length > 120 ? prev : prev.map((o, idx) => {
          let ax = 0;
          let ay = 0;
          let n = 0;
          const start = Math.max(0, idx - 12);
          const end = Math.min(prev.length, idx + 13);
          for (let j = start; j < end; j += 1) {
            const o2 = prev[j];
            if (!o2 || o2.id === o.id) continue;
            const d = Math.hypot(o2.x - o.x, o2.y - o.y);
            if (d > 0 && d < 110) {
              ax += (o2.x - o.x) / d;
              ay += (o2.y - o.y) / d;
              n++;
            }
          }
          if (n > 0) {
            const pull = 0.38;
            return { ...o, x: o.x + (ax / n) * pull, y: o.y + (ay / n) * pull };
          }
          return o;
        });

        const drifted = clustered.map((o) => {
          const dx = pp2.x - o.x;
          const dy = pp2.y - o.y;
          const d = Math.hypot(dx, dy);
          const range = magnet ? 1500 : gravPickup ? 360 : 240;
          if (d > 0 && d < range) {
            const basePull = magnet ? 18.0 : gravPickup ? 10.5 : 6.2;
            const rankPull = 1 + (o.rank || 0) * 0.18;
            return { ...o, x: o.x + (dx / d) * basePull * rankPull, y: o.y + (dy / d) * basePull * rankPull };
          }
          return o;
        });

        const merged = mergeOrbs(drifted);

        const kept = [];
        let gained = 0;
        merged.forEach((o) => {
          const d = Math.hypot(o.x - pp2.x, o.y - pp2.y);
          if (d < 36) gained += o.value;
          else kept.push(o);
        });

        // XP feels stronger late so builds actually reach rank 3-5 reliably
        const tNow = clamp(elapsed.current / (runTimeRef.current || BOSS_TIME), 0, 1);
        const late = norm01(tNow, 0.45, 1.0);
        const kick = norm01(tNow, 0.58, 0.72);
        const xpMult = lerp(LATE_XP_MIN_MULT, LATE_XP_MAX_MULT, late) * lerp(1.0, 1.12, kick);

        if (gained > 0) xpRef.current += gained * xpMult;

        return kept;
      })();

      // -------------------- PICKUPS --------------------
      {
        const pp2 = playerRef.current;
        const prev = pickupsRef.current || [];
        const kept = [];
        for (const pk of prev) {
          const d = Math.hypot(pk.x - pp2.x, pk.y - pp2.y);
          if (d < 44) activatePickup(pk.type);
          else kept.push(pk);
        }
        pickupsRef.current = kept;
      }

      syncUI();

      // -------------------- LEVEL UP --------------------
      if (xpRef.current >= xpTargetRef.current) {
        let gainedLevels = 0;
        xpRef.current = xpRef.current - xpTargetRef.current;
        levelRef.current = (levelRef.current || 1) + 1;

        // Slightly easier XP curve so you reach higher ranks by late game
        while (true) {
          gainedLevels += 1;
          const t = getProgressT();
          const late = norm01(t, 0.45, 1.0);
          const earlyLevel = (levelRef.current || 1) <= 3;
          const growth = earlyLevel ? 1.10 : lerp(1.24, 1.18, late);
          xpTargetRef.current = Math.floor(xpTargetRef.current * growth);
          if (xpRef.current < xpTargetRef.current || gainedLevels >= 12) break;
          xpRef.current -= xpTargetRef.current;
          levelRef.current = (levelRef.current || 1) + 1;
        }

        for (let i = 0; i < gainedLevels; i += 1) {
          const a = Math.random() * Math.PI * 2;
          const viewportMin = typeof window !== 'undefined' ? Math.min(window.innerWidth, window.innerHeight) : 900;
          const minD = Math.max(220, viewportMin * 0.24);
          const maxD = Math.max(minD + 80, Math.min(820, viewportMin * 0.46));
          const d = minD + Math.random() * (maxD - minD);
          pickupsRef.current = [
            ...(pickupsRef.current || []),
            {
              id: `level_core_${Date.now()}_${i}_${Math.random()}`,
              type: 'LEVELUP',
              x: clamp(pPos.x + Math.cos(a) * d, 20, ARENA_SIZE - 20),
              y: clamp(pPos.y + Math.sin(a) * d, 20, ARENA_SIZE - 20),
              t: Date.now(),
              life: PICKUP_DEFS.LEVELUP.life,
              value: 1
            }
          ];
        }
        syncUI(true);
        juicePunch(0.55, 0.55);
        pushToast(gainedLevels > 1 ? `${gainedLevels} LEVEL CORES` : 'LEVEL CORE SPAWNED');
      }

      // -------------------- CONTACT DAMAGE + HAZARDS --------------------
      if (!freezeWorld) {
        const now2 = Date.now();
        const shielded = now2 < shieldUntil.current;

        const t = talentsRef.current;
        const thornsActive = now2 < thornsActiveUntilRef.current;

        // Thorns: invuln + ram damage
        if (thornsActive) {
          const pp2 = playerRef.current;
          const ramDmg = (t.thornsRamDamage || 80) * (statsRef.current.damageMult || 1) * crewDamageMult;
          enemiesRef.current = (enemiesRef.current || []).map((en) => {
            if (en.hp <= 0) return en;
            const d = Math.hypot(en.x - pp2.x, en.y - pp2.y);
            if (d < en.size * 0.55 + 18) {
              const last = en._ramHitAt || 0;
              if (now2 - last < 120) return en;

              const ang = Math.atan2(en.y - pp2.y, en.x - pp2.x);
              const immune = isControlImmune(en.type);
              const blockDist = en.size * 0.55 + 34;
              const push = immune ? 4.5 : 12.0;
              return {
                ...en,
                _ramHitAt: now2,
                hp: en.hp - ramDmg,
                burnUntil: Math.max(en.burnUntil || 0, now2 + 2600),
                burnDps: Math.max(en.burnDps || 0, 18 + tileDifficulty * 2),
                x: clamp(pp2.x + Math.cos(ang) * blockDist + Math.cos(ang) * push, 0, ARENA_SIZE),
                y: clamp(pp2.y + Math.sin(ang) * blockDist + Math.sin(ang) * push, 0, ARENA_SIZE),
                dashUntil: (en.type === 'mini_charger' || en.type === 'tiny_ram') ? 0 : en.dashUntil,
                stunnedUntil: immune ? en.stunnedUntil : Math.max(en.stunnedUntil || 0, now2 + 120),
              };
            }
            return en;
          });

          // while Thorns is active, also ignore hazards (0 damage)
        } else {
          // Hazards
          let hazardDamage = 0;
          explosionsRef.current.forEach((e) => {
            if (!e.hazard) return;
            const d = Math.hypot(pPos.x - e.x, pPos.y - e.y);
            if (d <= e.r) hazardDamage += 7;
          });

          if (hazardDamage > 0 && now2 - lastDamage.current > 240) {
            const did = applyPlayerDamage(hazardDamage, 'hazard');
            if (did > 0) juicePunch(0.6, 0.7);
            else juicePunch(0.22, 0.42);
          }

          // Contact damage (enemies)
          if (now2 - lastDamage.current > 260) {
            let totalDamage = 0;
            const pp2 = playerRef.current;
            alive.forEach((en) => {
              const d = Math.hypot(en.x - pp2.x, en.y - pp2.y);
              if (!en.hidden && d < en.size * 0.55 + 16) totalDamage += Number.isFinite(en.contactDamage) ? en.contactDamage : 8;
            });

            if (totalDamage > 0) {
              const did = applyPlayerDamage(totalDamage, 'contact');
              if (did > 0) {
                juicePunch(Math.min(0.55, totalDamage / 90), 0.65);
              } else {
                // shielded / plated / thorns etc.
                juicePunch(shielded ? 0.35 : 0.22, shielded ? 0.55 : 0.45);
              }
            }
          }
        }
      }

      if (!defeat && statsRef.current.hp <= 0) {
        statsRef.current.hp = 0;
        setDefeat(true);
        syncUI(true);
        return;
      }
    };

    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [selectedWeapons.length, tileDifficulty, crewDamageMult, crewSpeedMult, requiresExtraction]);

  const chooseUpgrade = (option) => {
    const next = option.apply(statsRef.current);
    statsRef.current = next;
    setStats(next);
    if (option.weaponId) {
      if (option.upgradeLevel) {
        const nextLevels = { ...weaponLevelsRef.current, [option.weaponId]: option.upgradeLevel };
        weaponLevelsRef.current = nextLevels;
        setWeaponLevels(nextLevels);
        logTimeline('upgrade', `${WEAPONS.find((w) => w.id === option.weaponId)?.name || option.weaponId} rank ${option.upgradeLevel}`);
      } else {
        const curWeapons = selectedWeaponsRef.current || [];
        const weaponCap = talentsRef.current.extraWeaponSlot ? 6 : DEFAULT_WEAPON_CAP;
        const nextWeapons = curWeapons.length >= weaponCap || curWeapons.includes(option.weaponId)
          ? curWeapons
          : [...curWeapons, option.weaponId];
        selectedWeaponsRef.current = nextWeapons;
        setSelectedWeapons(nextWeapons);
        const nextLevels = { ...weaponLevelsRef.current, [option.weaponId]: 1 };
        weaponLevelsRef.current = nextLevels;
        setWeaponLevels(nextLevels);
        logTimeline('weapon', `Added ${WEAPONS.find((w) => w.id === option.weaponId)?.name || option.weaponId}`);
      }
    } else {
      logTimeline('upgrade', option.title || option.id || 'Upgrade');
    }
    pendingUpgradeCountRef.current = Math.max(0, (pendingUpgradeCountRef.current || 0) - 1);
    if (pendingUpgradeCountRef.current > 0) {
      const nextOptions = rollUpgradeOptions(selectedWeaponsRef.current, weaponLevelsRef.current, statsRef.current, talentsRef.current.extraWeaponSlot ? 6 : DEFAULT_WEAPON_CAP);
      upgradeOptionsRef.current = nextOptions;
      setUpgradeOptions(nextOptions);
    } else {
      upgradeOptionsRef.current = [];
      setUpgradeOptions([]);
    }
    juicePunch(0.40, 0.60);
  };

  const selectWeapon = (weaponId) => {
    // reset run state
    progElapsedRef.current = 0;
    elapsed.current = 0;
    matchStartedAtRef.current = Date.now();
    timelineRef.current = [];
    setMatchSummary(null);

    flagsRef.current = { reliefLock: false };
    activeEventRef.current = null;
    eventCooldownUntilRef.current = 0;
    reliefUntilRef.current = 0;
    reliefStartedAtRef.current = 0;
    progressLastSyncRef.current = 0;
    bossReturnPendingRef.current = [];
    bossMilestoneIdxRef.current = 0;
    extractionRef.current = { active: false, progress: 0, x: 0, y: 0 };
    setExtractionUI({ active: false, progress: 0, x: 0, y: 0 });
    pendingUpgradeCountRef.current = 0;
    upgradeOptionsRef.current = [];

    beatPlanRef.current = { ready: false, idx: 0, beats: [] };

    enemiesRef.current = [];
    bulletsRef.current = [];
    beamsRef.current = [];
    railLinesRef.current = [];
    slashesRef.current = [];
    arcsRef.current = [];
    explosionsRef.current = [];
    orbsRef.current = [];
    pickupsRef.current = [];
    enemyProjectilesRef.current = [];
    playerTurretsRef.current = [];
    playerGrabRef.current = null;
    grabGhostsSpawnedRef.current = 0;
    pylonSpawnedRef.current = false;

    bossSpawnedRef.current = false;
    setBossSpawned(false);
    setVictory(false);
    setDefeat(false);
    setProgress(0);
    pausedRef.current = false;
    pauseStartedAtRef.current = 0;

    xpRef.current = 0;
    xpTargetRef.current = 78;
    levelRef.current = 1;
    setXp(0);
    setXpTarget(78);
    setLevel(1);

    const initialWeapons = [weaponId];
    const initialLevels = initialWeapons.reduce((acc, id) => ({ ...acc, [id]: 1 }), {});

    setSelectedWeapons(initialWeapons);
    setWeaponLevels(initialLevels);
    setUpgradeOptions([]);
    logTimeline('weapon', `Started with ${WEAPONS.find((w) => w.id === weaponId)?.name || weaponId}`);
    juicePunch(0.40, 0.55);
  };

  const nowHUD = paused && pauseStartedAtRef.current ? pauseStartedAtRef.current : Date.now();
  const tHUD = talentsRef.current;
  const showShield = nowHUD < shieldUntil.current;
  const showOverdrive = nowHUD < overdriveUntil.current;
  const showDoubleDamage = nowHUD < doubleDamageUntil.current;
  const showMagnet = nowHUD < magnetUntil.current;
  const showFreeze = nowHUD < freezeUntil.current;
  const showThorns = nowHUD < thornsActiveUntilRef.current;
  const showDecoy = !!(decoyRef.current && nowHUD < decoyRef.current.until);
  const showAdrenalMove = nowHUD < milAdrenalMoveUntilRef.current;

  const fmtS = (ms) => `${Math.max(0, ms) / 1000 < 10 ? (Math.max(0, ms) / 1000).toFixed(1) : Math.ceil(Math.max(0, ms) / 1000)}s`;
  const remThorns = thornsActiveUntilRef.current - nowHUD;
  const remDecoy = decoyRef.current ? decoyRef.current.until - nowHUD : 0;
  const remDecoyCd = decoyCooldownUntilRef.current - nowHUD;
  const remTurretCd = playerTurretCooldownUntilRef.current - nowHUD;
  const remThornsCd = thornsCooldownUntilRef.current - nowHUD;
  const remGhostCd = milGhostCdUntilRef.current - nowHUD;
  const remMagnet = magnetUntil.current - nowHUD;
  const remFreeze = freezeUntil.current - nowHUD;
  const remOverdrive = overdriveUntil.current - nowHUD;
  const remDoubleDamage = doubleDamageUntil.current - nowHUD;
  const remShield = shieldUntil.current - nowHUD;
  const remAdrenal = milAdrenalMoveUntilRef.current - nowHUD;
  const platesStacks = platesStacksRef.current || 0;
  const platesMax = tHUD.platesMax || 0;
  const remPlateCharge = platesMax > 0 && platesStacks < platesMax
    ? Math.max(0, 20000 - (nowHUD - (platesLastGenAtRef.current || nowHUD)))
    : 0;

  const thornsUnlockedHUD = !!tHUD.thornsUnlocked;
  const decoyUnlockedHUD = !!tHUD.decoyUnlocked;
  const turretUnlockedHUD = !!tHUD.deployTurretUnlocked;
  const ghostUnlockedHUD = Number(tHUD.ghostRank || 0) > 0;
  const thornsReadyHUD = thornsUnlockedHUD && !showThorns && remThornsCd <= 0;
  const thornsOnCdHUD = thornsUnlockedHUD && !showThorns && remThornsCd > 0;
  const ghostReadyHUD = ghostUnlockedHUD && remGhostCd <= 0;
  const ghostOnCdHUD = ghostUnlockedHUD && remGhostCd > 0;
  const decoyReadyHUD = decoyUnlockedHUD && !showDecoy && remDecoyCd <= 0;
  const decoyOnCdHUD = decoyUnlockedHUD && !showDecoy && remDecoyCd > 0;
  const turretOnCdHUD = turretUnlockedHUD && remTurretCd > 0;
  const matchPassiveHud = [
    stats.regenRank > 0 ? { id: 'REGEN', name: 'Regen', value: `${stats.regenRank}/4` } : null,
  ].filter(Boolean);
  const loadoutHud = [
    ...selectedWeapons.map((id) => {
      const w = WEAPONS.find((x) => x.id === id);
      return { id, name: w?.name || id, value: `LV ${weaponLevels[id] || 1}`, icon: SPRITES[id] };
    }),
    ...matchPassiveHud.map((item) => ({ ...item, icon: SPRITES[item.id] }))
  ];
  const matchClock = fmtClock(elapsed.current || 0);
  const renderPlayerPos = playerRef.current || player;
  const renderViewportW = typeof window !== 'undefined' ? window.innerWidth : 0;
  const renderViewportH = typeof window !== 'undefined' ? window.innerHeight : 0;
  const renderCamX = renderPlayerPos.x - renderViewportW / 2;
  const renderCamY = renderPlayerPos.y - renderViewportH / 2;
  const renderRunReport = (accent = 'rgba(0,242,255,0.25)') => {
    if (!matchSummary) return null;
    const killRows = Object.entries(matchSummary.killsByType || {})
      .sort((a, b) => Number(b[1]) - Number(a[1]))
      .slice(0, 8);
    const maxKills = Math.max(1, ...killRows.map(([, n]) => Number(n || 0)));
    const mvpName = WEAPONS.find((w) => w.id === matchSummary.mvpWeapon)?.name || matchSummary.mvpWeapon || 'N/A';
    return (
      <div className="run-report" style={{ borderColor: accent }}>
        <div className="run-stat-grid">
          <div><span>KILLS</span><b>{matchSummary.kills || 0}</b></div>
          <div><span>DPS</span><b>{matchSummary.dps || 0}</b></div>
          <div><span>DAMAGE TAKEN</span><b>{matchSummary.damageTaken || 0}</b></div>
          <div><span>MVP TECH</span><b>{mvpName}</b></div>
        </div>
        <div className="run-report-columns">
          <div>
            <strong>WEAPONS</strong>
            {(matchSummary.weapons || []).map((w) => {
              const name = WEAPONS.find((x) => x.id === w.id)?.name || w.id;
              return <div key={w.id} className="summary-row"><span>{name}</span><b>LV {w.level}</b></div>;
            })}
          </div>
          <div>
            <strong>KILLS BY TYPE</strong>
            {killRows.length === 0 ? <div className="summary-row"><span>No kills recorded</span></div> : killRows.map(([type, n]) => (
              <div key={type} className="kill-bar">
                <span>{getEnemyFamily(type)}</span>
                <div><i style={{ width: `${(Number(n || 0) / maxKills) * 100}%` }} /></div>
                <b>{n}</b>
              </div>
            ))}
          </div>
        </div>
        <strong className="timeline-title">UPGRADE TIMELINE</strong>
        <div className="timeline-list">
          {(matchSummary.timeline || []).length === 0 ? <div className="summary-row"><span>No upgrades recorded.</span></div> : (matchSummary.timeline || []).map((row, i) => (
            <div key={`${row.t}-${i}`} className="timeline-row">
              <span>{fmtClock(row.t)}</span><em>{String(row.type || '').toUpperCase()}</em><b>{row.label}</b>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div
      className="combat-world"
      style={{ touchAction: 'none' }}
      onPointerDown={beginDragMove}
      onPointerMove={updateDragMove}
      onPointerUp={endDragMove}
      onPointerCancel={endDragMove}
    >
      {!selectedWeapons.length && (
        <div className="ui-layer" style={{ background: 'rgba(0,0,0,0.95)' }}>
          <h1>SELECT TECH</h1>
          <div className="weapon-grid">
            {weaponChoices.map((w) => (
              <button key={w.id} className="weapon-card" onClick={() => selectWeapon(w.id)}>
                {SPRITES[w.id] && <img className="weapon-card-icon" src={SPRITES[w.id]} alt="" draggable={false} />}
                <span>{w.name}</span>
                <small>
                  {w.id === 'KATANA'
                    ? 'Directional sword cuts'
                    : w.id === 'TESLA'
                      ? 'Crowd chain lightning'
                      : w.id === 'LASER'
                        ? 'Fat carving beam'
                        : w.id === 'VOID'
                          ? 'Gravity + singularity'
                          : 'Ranged weapon'}
                </small>
              </button>
            ))}
          </div>
        </div>
      )}

      {loadoutHud.length > 0 && !matchSummary && !victory && !defeat && (
        <div className="loadout-hud">
          <div className="loadout-title">TIME {matchClock} / KILLS {killCountRef.current || 0}</div>
          <div className="loadout-title">LOADOUT</div>
          {loadoutHud.map((item) => (
            <div key={item.id} className="loadout-item">
              {item.icon && <img src={item.icon} alt="" draggable={false} />}
              <span>{item.name}</span>
              <b>{item.value}</b>
            </div>
          ))}
        </div>
      )}

      {!matchSummary && !victory && !defeat && <div className="combat-hud">
        <div className="ability-row">
          {thornsUnlockedHUD && (
            <div className={`ability-slot ${showThorns ? 'active' : thornsOnCdHUD ? 'cooldown' : 'ready'}`}>
              <b>1</b>
              <img src={thornsIcon} alt="" draggable={false} />
              <small>{showThorns ? fmtS(remThorns) : thornsOnCdHUD ? fmtS(remThornsCd) : 'READY'}</small>
            </div>
          )}
          {decoyUnlockedHUD && (
            <div className={`ability-slot ${showDecoy ? 'active' : decoyOnCdHUD ? 'cooldown' : 'ready'}`}>
              <b>2</b>
              <img src={decoyIcon} alt="" draggable={false} />
              <small>{showDecoy ? fmtS(remDecoy) : decoyOnCdHUD ? fmtS(remDecoyCd) : 'READY'}</small>
            </div>
          )}
          {turretUnlockedHUD && (
            <div className={`ability-slot ${turretOnCdHUD ? 'cooldown' : 'ready'}`}>
              <b>3</b>
              <img src={turretIcon} alt="" draggable={false} />
              <small>{turretOnCdHUD ? fmtS(remTurretCd) : 'READY'}</small>
            </div>
          )}
        </div>

        <div className="hud-main">
          <div className="side-bars">
            <div className="progress-bar">
              <div className="progress-bar-fill" style={{ width: `${progress * 100}%` }} />
              <span>PROGRESSION {Math.floor(progress * 100)}%</span>
            </div>
            <div className="xp-bar">
              <div className="xp-bar-fill" style={{ width: `${Math.min(100, (xp / xpTarget) * 100)}%` }} />
              <span>XP LVL {level} - {xp}/{xpTarget}</span>
            </div>
          </div>
          <div className="core-bars">
            <div className="hp-bar">
              <div className="hp-bar-fill" style={{ width: `${clamp((stats.hp / stats.maxHp) * 100, 0, 100)}%` }} />
              <span>HP {Math.ceil(stats.hp)}/{stats.maxHp}</span>
            </div>
          </div>
        </div>

        {bossSpawned && !victory && <div className="boss-warning">BOSS ENGAGED</div>}

        {extractionUI.active && (
          <div
            style={{
              width: 'min(520px, calc(100vw - 40px))',
              height: 20,
              marginTop: 10,
              border: '1px solid rgba(0,255,160,0.65)',
              background: 'rgba(0,0,0,0.58)',
              boxShadow: '0 0 24px rgba(0,255,160,0.16)',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div style={{ height: '100%', width: `${Math.round((extractionUI.progress || 0) * 100)}%`, background: 'linear-gradient(90deg, rgba(0,255,160,0.92), rgba(255,218,107,0.92))' }} />
            <span style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 900, letterSpacing: 2 }}>
              EXTRACTION {Math.floor((extractionUI.progress || 0) * 100)}%
            </span>
          </div>
        )}

        <div className="status-row" style={{ display: 'flex', gap: 10, marginTop: 10, opacity: 0.98, flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Buff/ability chips (DO NOT use .boss-warning here; it has margin-left:auto and was causing the bottom-right jump) */}
          {platesMax > 0 && (
            <div
              style={{
                padding: '6px 10px',
                fontSize: 12,
                borderRadius: 12,
                border: `1px solid ${platesStacks > 0 ? 'rgba(0,242,255,0.55)' : 'rgba(120,120,120,0.35)'}`,
                color: platesStacks > 0 ? 'rgba(0,242,255,0.95)' : 'rgba(190,190,190,0.8)',
                background: 'rgba(0,0,0,0.35)',
                boxShadow: platesStacks > 0 ? '0 0 16px rgba(0,242,255,0.18)' : undefined,
                letterSpacing: 2,
                textTransform: 'uppercase',
              }}
            >
              PLATING {platesStacks}/{platesMax} {platesStacks >= platesMax ? 'READY' : `CHARGE ${fmtS(remPlateCharge)}`}
            </div>
          )}

          {thornsUnlockedHUD && (
            <div
              style={{
                padding: '8px 10px',
                fontSize: 12,
                borderRadius: 12,
                border: `1px solid ${showThorns ? 'rgba(0,255,160,0.65)' : thornsOnCdHUD ? 'rgba(255,120,120,0.55)' : 'rgba(0,255,160,0.35)'}`,
                color: showThorns ? 'rgba(0,255,160,0.95)' : thornsOnCdHUD ? 'rgba(255,170,170,0.95)' : 'rgba(220,255,240,0.95)',
                background: 'rgba(0,0,0,0.40)',
                boxShadow: showThorns ? '0 0 18px rgba(0,255,160,0.22)' : thornsOnCdHUD ? '0 0 12px rgba(255,120,120,0.12)' : undefined,
                minWidth: 220,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, letterSpacing: 2, textTransform: 'uppercase' }}>
                <span>🌵 Thorns</span>
                <span>
                  {showThorns ? `ACTIVE ${fmtS(remThorns)}` : thornsOnCdHUD ? `CD ${fmtS(remThornsCd)}` : 'READY (1)'}
                </span>
              </div>
              <div style={{ marginTop: 6, height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${clamp(
                      showThorns
                        ? ((remThorns / Math.max(1, tHUD.thornsDurationMs || 1)) * 100)
                        : thornsOnCdHUD
                          ? ((remThornsCd / Math.max(1, tHUD.thornsCooldownMs || 1)) * 100)
                          : 0,
                      0,
                      100
                    )}%`,
                    background: showThorns ? 'rgba(0,255,160,0.85)' : 'rgba(255,120,120,0.75)',
                  }}
                />
              </div>
            </div>
          )}

          {decoyUnlockedHUD && (
            <div
              style={{
                padding: '8px 10px',
                fontSize: 12,
                borderRadius: 12,
                border: `1px solid ${showDecoy ? 'rgba(0,242,255,0.65)' : decoyOnCdHUD ? 'rgba(255,120,120,0.55)' : 'rgba(0,242,255,0.35)'}`,
                color: showDecoy ? 'rgba(0,242,255,0.95)' : decoyOnCdHUD ? 'rgba(255,170,170,0.95)' : 'rgba(220,250,255,0.95)',
                background: 'rgba(0,0,0,0.40)',
                boxShadow: showDecoy ? '0 0 18px rgba(0,242,255,0.22)' : undefined,
                minWidth: 220,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, letterSpacing: 2, textTransform: 'uppercase' }}>
                <span>Decoy</span>
                <span>{showDecoy ? `ACTIVE ${fmtS(remDecoy)}` : decoyOnCdHUD ? `CD ${fmtS(remDecoyCd)}` : 'READY (2)'}</span>
              </div>
              <div style={{ marginTop: 6, height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${clamp(showDecoy ? (remDecoy / 8000) * 100 : decoyOnCdHUD ? (remDecoyCd / 18000) * 100 : 0, 0, 100)}%`,
                    background: showDecoy ? 'rgba(0,242,255,0.85)' : 'rgba(255,120,120,0.75)',
                  }}
                />
              </div>
            </div>
          )}

          {ghostUnlockedHUD && (
            <div
              style={{
                padding: '8px 10px',
                fontSize: 12,
                borderRadius: 12,
                border: `1px solid ${ghostOnCdHUD ? 'rgba(255,0,122,0.55)' : 'rgba(0,242,255,0.55)'}`,
                color: ghostOnCdHUD ? 'rgba(255,170,205,0.95)' : 'rgba(0,242,255,0.95)',
                background: 'rgba(0,0,0,0.40)',
                boxShadow: ghostOnCdHUD ? '0 0 12px rgba(255,0,122,0.10)' : '0 0 16px rgba(0,242,255,0.16)',
                minWidth: 220,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, letterSpacing: 2, textTransform: 'uppercase' }}>
                <span>👻 Ghost</span>
                <span>{ghostOnCdHUD ? `CD ${fmtS(remGhostCd)}` : 'READY (AUTO)'}</span>
              </div>
              <div style={{ marginTop: 6, height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${clamp(
                      ghostOnCdHUD ? ((remGhostCd / Math.max(1, tHUD.ghostCooldownMs || 1)) * 100) : 0,
                      0,
                      100
                    )}%`,
                    background: 'rgba(255,0,122,0.75)',
                  }}
                />
              </div>
            </div>
          )}

          {showAdrenalMove && (
            <div
              style={{
                padding: '6px 10px',
                fontSize: 12,
                borderRadius: 12,
                border: '1px solid rgba(255,218,107,0.45)',
                color: 'rgba(255,218,107,0.95)',
                background: 'rgba(0,0,0,0.35)',
                letterSpacing: 2,
                textTransform: 'uppercase',
              }}
            >
              💉 Adrenal {fmtS(remAdrenal)}
            </div>
          )}

          {showMagnet && (
            <div style={{ padding: '6px 10px', fontSize: 12, borderRadius: 12, border: '1px solid rgba(255,255,255,0.18)', background: 'rgba(0,0,0,0.35)', letterSpacing: 2, textTransform: 'uppercase' }}>
              🧲 Magnet {fmtS(remMagnet)}
            </div>
          )}
          {showFreeze && (
            <div style={{ padding: '6px 10px', fontSize: 12, borderRadius: 12, border: '1px solid rgba(255,255,255,0.18)', background: 'rgba(0,0,0,0.35)', letterSpacing: 2, textTransform: 'uppercase' }}>
              ❄ Freeze {fmtS(remFreeze)}
            </div>
          )}
          {showOverdrive && (
            <div style={{ padding: '6px 10px', fontSize: 12, borderRadius: 12, border: '1px solid rgba(255,255,255,0.18)', background: 'rgba(0,0,0,0.35)', letterSpacing: 2, textTransform: 'uppercase' }}>
              ⚡ Overdrive {fmtS(remOverdrive)}
            </div>
          )}
          {showDoubleDamage && (
            <div style={{ padding: '8px 12px', fontSize: 14, borderRadius: 12, border: '1px solid rgba(255,70,70,0.48)', background: 'rgba(55,0,0,0.48)', color: 'rgba(255,220,220,0.98)', boxShadow: '0 0 18px rgba(255,0,0,0.22)', letterSpacing: 2, textTransform: 'uppercase' }}>
              x2 Damage {fmtS(remDoubleDamage)}
            </div>
          )}
          {showShield && (
            <div style={{ padding: '6px 10px', fontSize: 12, borderRadius: 12, border: '1px solid rgba(255,255,255,0.18)', background: 'rgba(0,0,0,0.35)', letterSpacing: 2, textTransform: 'uppercase' }}>
              🛡 Shield {fmtS(remShield)}
            </div>
          )}
        </div>
      </div>}

      {/* Expiration toasts */}
      {toasts.length > 0 && (
        <div
          style={{
            position: 'fixed',
            left: '50%',
            top: 110,
            transform: 'translateX(-50%)',
            zIndex: 50,
            pointerEvents: 'none',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            alignItems: 'center',
            width: 'min(520px, calc(100vw - 40px))'
          }}
        >
          {toasts
            .filter((t) => (t.until || 0) > nowHUD)
            .slice(-4)
            .map((t) => (
              <div
                key={t.id}
                style={{
                  width: '100%',
                  textAlign: 'center',
                  padding: '10px 12px',
                  borderRadius: 14,
                  background: 'rgba(0,0,0,0.68)',
                  border: '1px solid rgba(255,255,255,0.18)',
                  boxShadow: '0 0 24px rgba(0,242,255,0.08)',
                  fontWeight: 900,
                  letterSpacing: 1.5,
                  fontSize: 12,
                  opacity: 0.95,
                }}
              >
                {String(t.text || '').toUpperCase()}
              </div>
            ))}
        </div>
      )}

      <div className="world-container" ref={worldRef} style={{ willChange: 'transform', transform: `translate3d(${-renderCamX}px,${-renderCamY}px,0)` }}>
        <div className="world-border" />
        <div className="player-tracer" ref={playerTracerRef} />
        <div
  className="player-sprite"
  ref={playerSpriteRef}
  style={{
    left: 0,
    top: 0,
    transform: `translate3d(${renderPlayerPos.x}px,${renderPlayerPos.y}px,0) translate(-50%, -50%) scale(1.8)`,
    willChange: 'transform, filter',
    // ✅ show selected hero portrait instead of the blue square
    backgroundImage: selectedHero?.portrait ? `url(${selectedHero.portrait})` : undefined,
    backgroundSize: selectedHero?.portrait ? "cover" : undefined,
    backgroundPosition: selectedHero?.portrait ? "center" : undefined,
    backgroundRepeat: selectedHero?.portrait ? "no-repeat" : undefined,
    backgroundColor: selectedHero?.portrait ? "transparent" : undefined,

    boxShadow: showShield
      ? "0 0 16px rgba(120,220,255,0.75), 0 0 36px rgba(120,220,255,0.55)"
      : showThorns
        ? "0 0 18px rgba(0,242,255,0.65), 0 0 42px rgba(0,242,255,0.35)"
        : undefined,
    filter: showOverdrive ? "brightness(1.15) saturate(1.2)" : undefined,
  }}
/>

        {Array.from({ length: Math.min(3, platesStacks) }).map((_, i) => (
          <div
            key={`plate-ring-${i}`}
            className="plate-ring"
            style={{
              left: renderPlayerPos.x,
              top: renderPlayerPos.y,
              width: 66 + i * 18,
              height: 66 + i * 18,
              marginLeft: -(66 + i * 18) / 2,
              marginTop: -(66 + i * 18) / 2,
              opacity: 0.92 - i * 0.14
            }}
          />
        ))}

        {extractionUI.active && (
          <div
            style={{
              position: 'absolute',
              left: extractionUI.x,
              top: extractionUI.y,
              width: (extractionUI.radius || 172) * 2,
              height: (extractionUI.radius || 172) * 2,
              marginLeft: -(extractionUI.radius || 172),
              marginTop: -(extractionUI.radius || 172),
              borderRadius: 999,
              border: '4px solid rgba(0,255,160,0.72)',
              background: 'radial-gradient(circle, rgba(0,255,160,0.18) 0%, rgba(0,255,160,0.08) 48%, rgba(0,0,0,0) 70%)',
              boxShadow: '0 0 34px rgba(0,255,160,0.34), inset 0 0 30px rgba(0,255,160,0.18)',
              zIndex: 3,
              pointerEvents: 'none',
            }}
          >
            <div
              style={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                transform: 'translate(-50%, -50%)',
                fontSize: 13,
                fontWeight: 900,
                letterSpacing: 3,
                color: 'rgba(220,255,235,0.96)',
                textShadow: '0 0 12px rgba(0,255,160,0.9)',
              }}
            >
              EXTRACT
            </div>
          </div>
        )}

        {(playerTurretsRef.current || []).map((t) => {
          const pct = clamp((t.hp || 0) / Math.max(1, t.maxHp || 1), 0, 1);
          return (
            <div
              key={t.id}
              style={{
                position: 'absolute',
                left: t.x,
                top: t.y,
                width: 48,
                height: 48,
                marginLeft: -24,
                marginTop: -24,
                border: '3px solid rgba(255,218,107,0.92)',
                background: 'rgba(30,24,12,0.88)',
                boxShadow: '0 0 18px rgba(255,218,107,0.34)',
                transform: `rotate(${((nowHUD / 520) % 360)}deg)`,
                zIndex: 4,
                pointerEvents: 'none'
              }}
            >
              <div style={{ position: 'absolute', left: 5, right: 5, bottom: -10, height: 4, background: 'rgba(0,0,0,0.72)' }}>
                <div style={{ width: `${pct * 100}%`, height: '100%', background: 'rgba(255,218,107,0.95)' }} />
              </div>
            </div>
          );
        })}

        {(playerBombsRef.current || []).map((b) => {
          const left = Math.max(0, (b.detonateAt || nowHUD) - nowHUD);
          const pulse = 0.5 + 0.5 * Math.abs(Math.sin(nowHUD / 90));
          return (
            <div
              key={b.id}
              style={{
                position: 'absolute',
                left: b.x,
                top: b.y,
                width: 28,
                height: 28,
                marginLeft: -14,
                marginTop: -14,
                borderRadius: 999,
                border: '2px solid rgba(255,218,107,0.9)',
                background: 'rgba(255,90,28,0.72)',
                boxShadow: `0 0 ${12 + pulse * 16}px rgba(255,90,28,0.55)`,
                opacity: 0.72 + pulse * 0.28,
                zIndex: 4,
                pointerEvents: 'none'
              }}
              title={`${Math.ceil(left / 1000)}s`}
            />
          );
        })}

        {pickups.map((pk) => (
          (() => {
            const nowP = Date.now();
            const ttl = (pk.t || 0) + (pk.life || 0) - nowP;
            const danger = ttl < 4000;
            const blink = danger ? (0.35 + 0.65 * Math.abs(Math.sin(nowP / 120))) : 1;
            const ring = danger ? `0 0 0 2px rgba(255,82,119,0.55), 0 0 18px rgba(255,82,119,0.25)` : undefined;
            return (
          <div
            key={pk.id}
            className={`pickup pickup--${String(pk.type || '').toLowerCase()}`}
            style={{
              position: 'absolute',
              left: pk.x,
              top: pk.y,
              width: 34,
              height: 34,
              marginLeft: -17,
              marginTop: -17,
              borderRadius: 999,
              background:
                pk.type === 'LEVELUP' ? 'rgba(255,236,120,0.96)' :
                pk.type === 'MAGNET' ? 'rgba(180,255,200,0.9)' :
                  pk.type === 'FREEZE' ? 'rgba(160,220,255,0.9)' :
                    pk.type === 'OVERDRIVE' ? 'rgba(255,220,140,0.92)' :
                      'rgba(200,170,255,0.92)',
              boxShadow: pk.type === 'LEVELUP'
                ? '0 0 0 3px rgba(255,255,255,0.78), 0 0 18px rgba(255,218,107,0.78), 0 0 42px rgba(255,218,107,0.42)'
                : ring ? `${ring}, 0 0 12px rgba(255,255,255,0.45), 0 0 28px rgba(255,255,255,0.25)` : '0 0 12px rgba(255,255,255,0.45), 0 0 28px rgba(255,255,255,0.25)',
              opacity: blink,
            }}
            title={`${PICKUP_DEFS[pk.type]?.title || pk.type}${ttl > 0 ? ` • ${Math.ceil(ttl / 1000)}s` : ''}`}
          />
            );
          })()
        ))}
      </div>

      {/* Canvas render layer */}
      <canvas
        ref={canvasRef}
        style={{
          position: 'fixed',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 5
        }}
      />

      {upgradeOptions.length > 0 && !matchSummary && !victory && !defeat && (
        <div className={liveUpgradeSelect ? 'live-upgrade-panel' : 'ui-layer'} style={liveUpgradeSelect ? undefined : { background: 'rgba(1,2,6,0.92)' }}>
          <h1>CHOOSE UPGRADE</h1>
          <div className="upgrade-grid">
            {upgradeOptions.map((option) => (
              <button key={option.id} className="upgrade-card" onClick={() => chooseUpgrade(option)}>
                {(SPRITES[option.weaponId] || SPRITES[option.id]) && (
                  <img className="weapon-card-icon" src={SPRITES[option.weaponId] || SPRITES[option.id]} alt="" draggable={false} />
                )}
                <strong>{option.title}</strong>
                <span>{option.description}</span>
              </button>
            ))}
          </div>
          <div style={{ opacity: 0.8, marginTop: 10, fontSize: 12 }}>
            Tip: Builds want contrast. Events + mini-bosses + pickups create beats.
          </div>
        </div>
      )}

      {victory && (
        <div className="victory-overlay">
          <div className="victory-blast" />
          <h1>MAP CLEARED</h1>
          <p>{matchSummary?.playerName || playerName || 'Operator'} survived {fmtClock(matchSummary?.elapsedMs || elapsed.current)} with {matchSummary?.kills ?? killCountRef.current} kills.</p>
          {renderRunReport('rgba(0,242,255,0.35)')}
          <button className="scifi-btn" style={{ marginTop: 16 }} onClick={() => onVictory(matchSummary || buildMatchSummary('CLEARED'))}>CONTINUE</button>
        </div>
      )}

      {defeat && (
        <div className="victory-overlay">
          <div className="victory-blast" />
          <h1>CORE BREACH</h1>
          <p>{matchSummary?.playerName || playerName || 'Operator'} fell at {Math.floor((matchSummary?.progress || getProgressT()) * 100)}% after {fmtClock(matchSummary?.elapsedMs || elapsed.current)}.</p>
          {renderRunReport('rgba(255,0,122,0.35)')}
          <button className="scifi-btn" style={{ marginTop: 16 }} onClick={() => onExit(matchSummary || buildMatchSummary('DEFEATED'))}>CONTINUE</button>
        </div>
      )}

      {!matchSummary && !victory && !defeat && <button className="scifi-btn" style={{ position: 'absolute', bottom: 20, right: 20 }} onClick={() => onExit(buildMatchSummary('SURRENDERED'))}>
        SURRENDER
      </button>}
    </div>
  );
}

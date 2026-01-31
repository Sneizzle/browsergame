import React, { useEffect, useMemo, useRef, useState } from 'react';

const ARENA_SIZE = 2800; // +40%
const BOSS_TIME = 160000; // longer run (was 90s)

// -------------------- DIFFICULTY TUNING (15% EASIER) --------------------
const ENEMY_HP_MULT = 0.85;            // enemies have 15% less HP
const SPAWN_INTERVAL_MULT = 1.15;      // ~15% fewer enemies over time (slower spawns)

// -------------------- helpers --------------------
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

// -------------------- WEAPONS (BUFFED / REWORKED) --------------------
const WEAPONS = [
  {
    id: 'RIFLE',
    name: 'Rifle',
    targeting: 'closest',
    color: '#e9f7ff',
    levels: [
      { title: 'Rifle I', description: 'Precision shot with guaranteed ricochet.', stats: { cooldown: 520, bulletSpeed: 15.5, damage: 11, pellets: 1, spread: 0.06, width: 12, height: 4, pierce: 2, ricochets: 1 } },
      { title: 'Rifle II', description: 'Tighter cadence.', stats: { cooldown: 475, damage: 13 } },
      { title: 'Rifle III', description: 'Two-round burst.', stats: { pellets: 2, spread: 0.10, damage: 12, pierce: 3 } },
      { title: 'Rifle IV', description: 'Smarter bounces.', stats: { ricochets: 2, damage: 13, pierce: 3 } },
      { title: 'Rifle V', description: 'Triple fan burst + violent bounce.', stats: { pellets: 3, spread: 0.18, damage: 13, pierce: 4, ricochets: 2 } }
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
          cooldown: 880,
          damage: 16,
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
      {
        title: 'Katana III',
        description: 'Triple combo with a wide finisher (NOT full circle).',
        stats: {
          cooldown: 820,
          damage: 18,
          range: 178,
          slashPattern: [
            { delay: 0,   offset: -0.26, arc: Math.PI * 0.32, kind: 'crescent', dmgMult: 0.85,
              color: 'rgba(255,0,122,1)', glowColor: 'rgba(255,0,122,0.70)', glowBlur: 18, lineWidth: 12, activeMs: 110 },
            { delay: 120, offset:  0.26, arc: Math.PI * 0.32, kind: 'crescent', dmgMult: 0.85,
              color: 'rgba(255,80,210,1)', glowColor: 'rgba(255,80,210,0.65)', glowBlur: 18, lineWidth: 12, activeMs: 110 },
            { delay: 260, offset:  0.0,  arc: Math.PI * 0.62, kind: 'crescent', dmgMult: 1.05,
              color: 'rgba(255,180,80,1)', glowColor: 'rgba(255,180,80,0.60)', glowBlur: 20, lineWidth: 13, activeMs: 140 }
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
              color: 'rgba(255,40,70,1)', glowColor: 'rgba(255,40,70,0.75)', glowBlur: 22, lineWidth: 14, activeMs: 115 },
            { delay: 110, offset: -0.35, arc: Math.PI * 0.30, kind: 'crescent', dmgMult: 0.95,
              color: 'rgba(255,40,70,1)', glowColor: 'rgba(255,40,70,0.75)', glowBlur: 22, lineWidth: 14, activeMs: 115 },
            { delay: 250, offset:  Math.PI, arc: Math.PI * 0.55, kind: 'crescent', dmgMult: 1.0,
              color: 'rgba(255,120,210,1)', glowColor: 'rgba(255,120,210,0.65)', glowBlur: 20, lineWidth: 13, activeMs: 145 }
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
              color: 'rgba(0,242,255,1)', glowColor: 'rgba(0,242,255,0.65)', glowBlur: 18, lineWidth: 12, activeMs: 105 },
            { delay: 90,  offset:  0.28, arc: Math.PI * 0.30, kind: 'crescent', dmgMult: 0.75,
              color: 'rgba(0,255,136,1)', glowColor: 'rgba(0,255,136,0.60)', glowBlur: 18, lineWidth: 12, activeMs: 105 },
            { delay: 190, offset:  0.0,  arc: Math.PI * 0.48, kind: 'crescent', dmgMult: 0.95,
              color: 'rgba(255,0,122,1)', glowColor: 'rgba(255,0,122,0.60)', glowBlur: 20, lineWidth: 13, activeMs: 130 },
            { delay: 320, offset:  0.0,  arc: Math.PI * 0.72, kind: 'crescent', dmgMult: 1.15,
              color: 'rgba(255,218,107,1)', glowColor: 'rgba(255,218,107,0.55)', glowBlur: 22, lineWidth: 14, activeMs: 155 }
          ]
        }
      }
    ]
  },

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

  {
    id: 'SHOTGUN',
    name: 'Shotgun',
    targeting: 'closest',
    color: '#ffd36b',
    levels: [
      { title: 'Shotgun I', description: 'Arc blast (knockback).', stats: { cooldown: 820, bulletSpeed: 13, damage: 9, pellets: 7, spread: 0.85, width: 14, height: 5, pierce: 0, knockback: 1.35 } },
      { title: 'Shotgun II', description: 'Denser spread + harder shove.', stats: { pellets: 8, damage: 9, knockback: 1.55 } },
      { title: 'Shotgun III', description: 'Ricochet shrapnel (chaos).', stats: { pellets: 9, damage: 9, pierce: 1, knockback: 1.65, ricochets: 1 } },
      { title: 'Shotgun IV', description: 'Impact pops (mini-blast on hit).', stats: { pellets: 10, spread: 0.92, damage: 10, pierce: 1, knockback: 1.75, explodeRadius: 26, explodeMult: 0.18 } },
      { title: 'Shotgun V', description: 'Meteor cluster (explosive pellets).', stats: { pellets: 12, spread: 1.02, damage: 10, pierce: 1, knockback: 1.85, explodeRadius: 42, explodeMult: 0.34 } }
    ]
  },

  {
    id: 'LASER',
    name: 'Laser',
    targeting: 'closest',
    color: '#ff8ef6',
    levels: [
      { title: 'Laser I', description: 'Fat beam that carves crowds.', stats: { cooldown: 980, beamMs: 160, beamWidth: 34, damage: 8, tickMs: 16, pierce: 999 } },
      { title: 'Laser II', description: 'Hotter cut.', stats: { damage: 10, beamWidth: 38 } },
      { title: 'Laser III', description: 'Twin beam fan.', stats: { beams: 2, fan: 0.12, damage: 9 } },
      { title: 'Laser IV', description: 'Overcharged slice.', stats: { cooldown: 860, damage: 12, beamWidth: 44 } },
      { title: 'Laser V', description: 'Tri-beam + chain burn.', stats: { beams: 3, fan: 0.18, damage: 11, beamWidth: 48, burn: 1600 } }
    ]
  },

  {
    id: 'SNIPER',
    name: 'Sniper',
    targeting: 'closest',
    color: '#8fffef',
    levels: [
      { title: 'Sniper I', description: 'Railcannon (tear-through + shockwave).', stats: { cooldown: 1450, bulletSpeed: 26, damage: 60, pellets: 1, spread: 0.01, width: 26, height: 6, pierce: 3, flashy: true, explodeRadius: 70, explodeMult: 0.65, rail: true, railWidth: 18, railMs: 90 } },
      { title: 'Sniper II', description: 'More rupture.', stats: { damage: 80, pierce: 4, explodeRadius: 78, explodeMult: 0.70, railWidth: 20 } },
      { title: 'Sniper III', description: 'Lance density.', stats: { damage: 96, pierce: 5, explodeRadius: 84, explodeMult: 0.72, railWidth: 22 } },
      { title: 'Sniper IV', description: 'Faster cycling.', stats: { cooldown: 1250, damage: 112, explodeRadius: 90, explodeMult: 0.76, railWidth: 24 } },
      { title: 'Sniper V', description: 'Annihilator (stun shock).', stats: { damage: 140, pierce: 6, explodeRadius: 98, explodeMult: 0.80, stun: 140, railWidth: 26 } }
    ]
  },

  {
    id: 'TESLA',
    name: 'Tesla Coil',
    targeting: 'closest',
    color: '#a6b7ff',
    levels: [
      { title: 'Tesla I', description: 'Chain lightning (closer, snappier zap).', stats: { cooldown: 650, damage: 18, chain: 3, arcRange: 175, stun: 170, chainFalloff: 0.90, zapSlow: 0.18, zapSlowDuration: 820 } },
      { title: 'Tesla II', description: 'Bigger arcs + stronger stun.', stats: { damage: 20, chain: 4, arcRange: 220, stun: 220, zapSlow: 0.20, zapSlowDuration: 900 } },
      { title: 'Tesla III', description: 'More jumps.', stats: { chain: 6, damage: 21 } },
      { title: 'Tesla IV', description: 'Forked discharge.', stats: { chain: 7, damage: 22, fork: 2 } },
      { title: 'Tesla V', description: 'Overload storm.', stats: { cooldown: 560, damage: 24, chain: 8, fork: 3, storm: true } }
    ]
  },

  {
    id: 'ROCKET',
    name: 'Rocket Launcher',
    targeting: 'closest',
    color: '#ff9a8a',
    levels: [
      { title: 'Rocket I', description: 'Missile with big early boom.', stats: { cooldown: 1080, bulletSpeed: 4.6, accel: 0.22, damage: 26, pellets: 1, spread: 0.05, width: 18, height: 8, pierce: 0, explodeRadius: 120, explodeMult: 0.85, homing: false } },
      { title: 'Rocket II', description: 'Bigger blast.', stats: { cooldown: 1120, damage: 30, explodeRadius: 140, explodeMult: 0.88 } },
      { title: 'Rocket III', description: 'Triple salvo (spreads targets).', stats: { cooldown: 1450, pellets: 3, spread: 0.26, damage: 25, explodeRadius: 240, explodeMult: 0.84 } },
      { title: 'Rocket IV', description: 'Heat-seeking guidance.', stats: { cooldown: 1650, homing: true, damage: 28, explodeRadius: 280, explodeMult: 0.88 } },
      { title: 'Rocket V', description: 'Swarm barrage (12 seekers).', stats: { cooldown: 1950, pellets: 12, spread: 0.95, bulletSpeed: 4.2, accel: 0.26, homing: true, damage: 18, explodeRadius: 340, explodeMult: 0.84 } }
    ]
  },

  {
    id: 'VOID',
    name: 'Void Orb',
    targeting: 'closest',
    color: '#c08bff',
    levels: [
      { title: 'Void I', description: 'Gravity shot that anchors and becomes a vortex.', stats: { cooldown: 820, bulletSpeed: 5.6, damage: 14, pellets: 1, spread: 0.04, width: 24, height: 24, pierce: 8, pull: 1.35, pullRadius: 190, vortexDps: 12, maxRange: 440, anchorOnMaxRange: true, lifeMs: 1900, singularity: false } },
      { title: 'Void II', description: 'Bigger vortex + stronger pull.', stats: { pull: 1.65, pullRadius: 215, width: 30, height: 30, damage: 15, vortexDps: 14, maxRange: 470 } },
      { title: 'Void III', description: 'Anchored vortex lasts longer (crowd vacuum).', stats: { lifeMs: 2300, pull: 1.95, pullRadius: 240, vortexDps: 16, damage: 15 } },
      { title: 'Void IV', description: 'Vortex slows + secondary orb (late upgrade).', stats: { pierce: 14, slow: 0.22, pull: 2.15, split: 2 } },
      { title: 'Void V', description: 'Singularity (anchored implosion + pop).', stats: { singularity: true, explodeRadius: 140, explodeMult: 0.95, pull: 2.55, pullRadius: 260, vortexDps: 20, maxRange: 500, lifeMs: 2400 } }
    ]
  },

  {
    id: 'TIME',
    name: 'Time Cannon',
    targeting: 'closest',
    color: '#7ff2d7',
    levels: [
      { title: 'Time I', description: 'Stutter-freeze + heavy slow.', stats: { cooldown: 560, bulletSpeed: 12, damage: 16, pellets: 1, spread: 0.05, width: 16, height: 7, pierce: 1, slow: 0.40, microFreeze: 200 } },
      { title: 'Time II', description: 'More slow + pierce.', stats: { slow: 0.46, pierce: 2, damage: 17 } },
      { title: 'Time III', description: 'Temporal split.', stats: { split: 2, damage: 16 } },
      { title: 'Time IV', description: 'Stasis (stun on hit).', stats: { stun: 380, damage: 18, explodeRadius: 36, explodeMult: 0.25 } },
      { title: 'Time V', description: 'Chrono fracture (freeze wave).', stats: { stun: 520, explodeRadius: 76, explodeMult: 0.55 } }
    ]
  }
];

// -------------------- UPGRADES --------------------
const UPGRADES = [
  { id: 'REGEN', title: 'Nanite Regen', description: '+0.35 HP/sec', apply: (s) => ({ ...s, regen: s.regen + 0.35 }) },
  { id: 'MAX_HP', title: 'Reinforced Plating', description: '+30 Max HP', apply: (s) => ({ ...s, maxHp: s.maxHp + 30, hp: s.hp + 30 }) },
  { id: 'DAMAGE', title: 'Damage Boost', description: '+10% damage', apply: (s) => ({ ...s, damageMult: s.damageMult * 1.1 }) },
  { id: 'ATTACK_SPEED', title: 'Attack Speed', description: '+10% rate', apply: (s) => ({ ...s, attackSpeed: s.attackSpeed * 1.1 }) },
  { id: 'MOVE_SPEED', title: 'Kinetic Thrusters', description: '+8% move speed', apply: (s) => ({ ...s, moveSpeed: (s.moveSpeed || 1) * 1.08 }) }
];

// -------------------- EVENTS / PICKUPS --------------------
const EVENT_DEFS = {
  SWARM: { id: 'SWARM', duration: 25000 },
  WALL: { id: 'WALL', duration: 20000 },
  RELIEF: { id: 'RELIEF', duration: 5200 }
};

const PICKUP_DEFS = {
  MAGNET: { id: 'MAGNET', title: 'XP Magnet', life: 9200 },
  FREEZE: { id: 'FREEZE', title: 'Time Freeze', life: 3200 },
  OVERDRIVE: { id: 'OVERDRIVE', title: 'Overdrive', life: 5200 },
  SHIELD: { id: 'SHIELD', title: 'Emergency Shield', life: 5200 }
};

// ---------- spawners ----------
const spawnEnemyBase = (difficulty) => {
  const side = Math.floor(Math.random() * 4);
  const margin = 20;
  const edgeX = Math.random() * (ARENA_SIZE - margin * 2) + margin;
  const edgeY = Math.random() * (ARENA_SIZE - margin * 2) + margin;
  const x = side === 0 ? margin : side === 1 ? ARENA_SIZE - margin : edgeX;
  const y = side === 2 ? margin : side === 3 ? ARENA_SIZE - margin : edgeY;

  // 15% easier overall HP
  const hpMult = (0.9 + difficulty * 0.004) * ENEMY_HP_MULT;

  const roll = Math.random();

  // Rare juggernaut (~1.5%): immune to slow/stun/knockback/pull
  if (roll > 0.985) {
    const base = 1100;
    const hp = Math.round(base * hpMult * (1 + difficulty * 0.10));
    return { id: Math.random(), type: 'juggernaut', x, y, hp, maxHp: hp, speed: 0.88 + difficulty * 0.02, size: 100, xp: 42, contactDamage: 22, color: '#ff3b3b' };
  }
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

const spawnEnemy = (difficulty, forcedType = null) => {
  if (!forcedType) return spawnEnemyBase(difficulty);

  // scripted variants
  const base = spawnEnemyBase(difficulty);
  if (forcedType === 'swarm') {
    const hp = Math.round((8 + difficulty * 1.6) * ENEMY_HP_MULT);
    return { ...base, type: 'swarm', hp, maxHp: hp, speed: 2.15 + difficulty * 0.05, size: 17, xp: 3, contactDamage: 5, color: '#ff4aa8' };
  }
  if (forcedType === 'wall') {
    // WALL units are intentionally chunky; still respect global 15% easier HP
    const hp = Math.round(((320 + difficulty * 26) * (1 + difficulty * 0.06)) * ENEMY_HP_MULT);
    return { ...base, type: 'wall', hp, maxHp: hp, speed: 0.70 + difficulty * 0.01, size: 46, xp: 26, contactDamage: 13, color: '#ff2a4b' };
  }
  return base;
};

// FIX: allow explicit spawn position so RAM chargers don’t stack/clamp into the same spot
const spawnMiniBoss = (player, difficulty, kind = 'charger', pos = null) => {
  const baseHp =
    (kind === 'charger' ? 4000 : 1400) +
    difficulty * (kind === 'charger' ? 360 : 160);

  const hp = Math.round(baseHp * ENEMY_HP_MULT);

  const spawnX = pos?.x ?? Math.min(Math.max(player.x + 460, 120), ARENA_SIZE - 120);
  const spawnY = pos?.y ?? Math.min(Math.max(player.y - 380, 120), ARENA_SIZE - 120);

  const base = {
    id: `mini_${kind}_${Math.random()}`,
    type: `mini_${kind}`,
    x: spawnX,
    y: spawnY,
    hp,
    maxHp: hp,
    speed: kind === 'assassin' ? 2.6 : 2.1,
    size: kind === 'charger' ? 104 : 92,
    xp: 140,
    contactDamage: kind === 'charger' ? 28 : 22,
    color: kind === 'assassin' ? '#c9ff6b' : '#ffda6b'
  };

  if (kind === 'charger') {
    return {
      ...base,
      dashCd: 1800, dashWindup: 700, dashMs: 1200, dashSpd: 15.0,
      dashUntil: 0, windupUntil: 0, dashDir: 0,
      damageReductionUntil: Date.now() + 1700, damageReductionMult: 0.40
    };
  }
  // assassin: short teleports if you stand still
  return { ...base, blinkCd: 1600, blinkUntil: 0, damageReductionUntil: Date.now() + 650, damageReductionMult: 0.70 };
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

const spawnWallRing = (pp, difficulty, meta) => {
  const ringN = meta.ringN ?? 30;
  const radiusStart = meta.radiusStart ?? 2000;
  const encroachSpeed = meta.encroachSpeed ?? 1.5;
  const minRadius = meta.minRadius ?? 10;
  const hpMult = meta.hpMult ?? 3.0;
  const size = meta.size ?? 52;

  const baseRot = Math.random() * Math.PI * 2;
  const out = [];

  for (let i = 0; i < ringN; i++) {
    const a = baseRot + (i / ringN) * Math.PI * 2;

    const enBase = spawnEnemy(difficulty, 'wall');
    // meta HP multiplier still applies; ENEMY_HP_MULT already applied inside spawnEnemy('wall')
    const hp = Math.round(enBase.maxHp * hpMult);

    const x = clamp(pp.x + Math.cos(a) * radiusStart, 40, ARENA_SIZE - 40);
    const y = clamp(pp.y + Math.sin(a) * radiusStart, 40, ARENA_SIZE - 40);

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
      // lock ring center at spawn moment
      wallCx: pp.x,
      wallCy: pp.y
    });
  }

  return out;
};

const spawnBoss = (player, difficulty) => {
  const hp = Math.round((5400 + difficulty * 220) * ENEMY_HP_MULT);
  return {
    id: 'boss',
    type: 'boss',
    x: Math.min(Math.max(player.x + 380, 140), ARENA_SIZE - 140),
    y: Math.min(Math.max(player.y - 320, 140), ARENA_SIZE - 140),
    hp,
    maxHp: hp,
    speed: 1.6 + difficulty * 0.03,
    nextRamPct: 0.9,
    size: 150,
    xp: 520,
    contactDamage: 34,
    color: '#ffda6b',
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
  const merged = [];
  const mergeDist = 36; // more merging = fewer pickups

  orbs.forEach((o) => {
    const target = merged.find((m) => Math.hypot(m.x - o.x, m.y - o.y) < mergeDist);
    if (target) {
      target.value += o.value;
      target.x = (target.x + o.x) / 2;
      target.y = (target.y + o.y) / 2;
    } else {
      merged.push({ ...o });
    }
  });

  // FPS-safe: compute tier/radius/color only on spawn/merge
  return merged.map((o) => {
    const vis = orbVisualFromValue(o.value);
    return { ...o, ...vis };
  });
};

// ---------- upgrades: guarantee 3 distinct guns early, then bias toward upgrading (cap 4) ----------
const rollUpgradeOptions = (ownedWeapons, weaponLevels, stats) => {
  const MAX_GUNS = 4;
  const canAddWeapon = ownedWeapons.length < MAX_GUNS;

  const unowned = WEAPONS.filter((w) => !ownedWeapons.includes(w.id));
  const want3GunsFast = ownedWeapons.length < 3;

  // Build UNIQUE candidate options with weights (no duplicates in the final 3).
  const candidates = [];

  const push = (opt, weight = 1) => {
    const key = opt.key || opt.id;
    candidates.push({ ...opt, key, weight });
  };

  // 1) New weapons: guarantee at least one option until you have 3 weapons (if available).
  if (canAddWeapon && unowned.length) {
    const weaponChance = want3GunsFast ? 1.0 : ownedWeapons.length === 3 ? 0.12 : 0.18;
    if (Math.random() < weaponChance) {
      unowned.forEach((w) => {
        push(
          {
            id: `WEAPON_${w.id}`,
            key: `WEAPON_${w.id}`,
            title: `New Weapon: ${w.name}`,
            description: ownedWeapons.length >= 3 ? 'Adds final weapon slot (cap 4)' : 'Adds another weapon to your loadout',
            weaponId: w.id,
            apply: (s) => ({ ...s })
          },
          want3GunsFast ? 6 : 2
        );
      });
    }
  }

  // 2) Existing weapon upgrades (unique per weapon/next-level)
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

  // 3) Stat upgrades
  UPGRADES.forEach((u) => {
    push(
      { ...u, key: u.id },
      want3GunsFast ? 1 : 2
    );
  });

  // Helper: weighted sample without replacement by key
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

  // Guarantee: until you have 3 weapons, force at least 1 new-weapon option if possible.
  if (want3GunsFast && canAddWeapon && unowned.length) {
    const w = unowned[Math.floor(Math.random() * unowned.length)];
    picked.push({
      id: `WEAPON_${w.id}`,
      title: `New Weapon: ${w.name}`,
      description: ownedWeapons.length >= 3 ? 'Adds final weapon slot (cap 4)' : 'Adds another weapon to your loadout',
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

  // Strip internal fields + attach snapshot
  return picked.map((o) => {
    const { weight, key, ...rest } = o;
    return { ...rest, statsSnapshot: stats };
  });
};

export default function Combat({ crew, onExit, onVictory, tileDifficulty = 1 }) {

  const progElapsedRef = useRef(0); // progression clock (pauses during events)
  const [player, setPlayer] = useState({ x: 1400, y: 1400 });
  const [stats, setStats] = useState({ hp: 120, maxHp: 120, regen: 0, damageMult: 1, attackSpeed: 1, moveSpeed: 1 });
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
  const hitFxRef = useRef({});
  const deathFxRef = useRef([]);
  const keys = useRef({});
  const lastFire = useRef({});
  const lastSpawn = useRef(0);
  const elapsed = useRef(0);
  const lastDamage = useRef(0);

  // per-run duration (random 25–100% longer)
  const runTimeRef = useRef(BOSS_TIME * (1.25 + Math.random() * 0.75));

  // swarm scheduling: 1–4 random swarms, later in the run
  const swarmPlanRef = useRef({ total: 0, done: 0, nextAt: 0, variant: 'encircle' });

  // relief bookkeeping
  const reliefWasActiveRef = useRef(false);

  // SMG: every 5th bullet pierces 1
  const smgCounter = useRef(0);

  // hitstop + chroma/punch
  const hitstopUntil = useRef(0);
  const juice = useRef({ chroma: 0, punch: 0 });

  // scripted map beats
  const flagsRef = useRef({ swarm1: false, wall1: false, mini25: false, mini50: false, mini75: false, reliefLock: false });
  const activeEventRef = useRef(null); // {id, endsAt, meta}
  const reliefUntilRef = useRef(0);
  const reliefStartedAtRef = useRef(0);
  const eventCooldownUntilRef = useRef(0);

  // power pickups
  const magnetUntil = useRef(0);
  const freezeUntil = useRef(0);
  const overdriveUntil = useRef(0);
  const shieldUntil = useRef(0);

  // FIX: “Weapon select” counts as paused so everything is consistent
  const selectingWeapon = selectedWeapons.length === 0;
  const paused = selectingWeapon || upgradeOptions.length > 0 || victory || defeat;

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

  // refs to avoid stale inside interval
  const pausedRef = useRef(paused);
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
  const bossSpawnedRef = useRef(bossSpawned);

  // Perf: keep simulation values in refs; sync React UI at low Hz
  const levelRef = useRef(level);
  const uiLastSyncRef = useRef(0);

  useEffect(() => { pausedRef.current = paused; }, [paused]);
  useEffect(() => { playerRef.current = player; }, [player]);
  useEffect(() => { statsRef.current = stats; }, [stats]);
  useEffect(() => { xpRef.current = xp; }, [xp]);
  useEffect(() => { xpTargetRef.current = xpTarget; }, [xpTarget]);
  useEffect(() => { selectedWeaponsRef.current = selectedWeapons; }, [selectedWeapons]);
  useEffect(() => { weaponLevelsRef.current = weaponLevels; }, [weaponLevels]);
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

  const juicePunch = (mag = 1, chroma = 1) => {
    const now = Date.now();
    const maxC = Math.max(juice.current.maxChroma || 0, 0.20 * chroma);
    const maxP = Math.max(juice.current.maxPunch || 0, 0.90 * mag);

    juice.current.maxChroma = maxC;
    juice.current.maxPunch = maxP;
    juice.current.until = Math.max(juice.current.until || 0, now + 140);
    juice.current.dur = 140;
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
    const handleKey = (e) => { keys.current[e.key.toLowerCase()] = e.type === 'keydown'; };
    window.addEventListener('keydown', handleKey);
    window.addEventListener('keyup', handleKey);
    return () => {
      window.removeEventListener('keydown', handleKey);
      window.removeEventListener('keyup', handleKey);
    };
  }, []);

  const startEvent = (id, meta = {}) => {
    const now = Date.now();
    // Prevent event overlap. Also don't start events during relief.
    if (activeEventRef.current && now < activeEventRef.current.endsAt) return false;
    if (now < reliefUntilRef.current) return false;
    // Global cooldown so events don't chain immediately
    if (now < eventCooldownUntilRef.current) return false;

    const dur = meta?.duration ?? EVENT_DEFS[id].duration;
    activeEventRef.current = { id, endsAt: now + dur, meta };

    // Small cooldown after the event ends
    eventCooldownUntilRef.current = Math.max(eventCooldownUntilRef.current, activeEventRef.current.endsAt + 5500);
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
        String(e.type).startsWith('mini_') ||
        e.type === 'wall' // keep wall units
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

    const pp = playerRef.current;
    enemiesRef.current = pruneEnemiesForRelief(enemiesRef.current || [], pp, 9);
  };

  const scheduleBeats = () => {
    const e = progElapsedRef.current; // progression time (pauses during events)
    const now = Date.now();

    // init swarm plan once per run
    if (swarmPlanRef.current.total === 0) {
      swarmPlanRef.current.total = 1 + Math.floor(Math.random() * 4); // 1–4
      swarmPlanRef.current.done = 0;
      swarmPlanRef.current.nextAt = 60000 + Math.floor(Math.random() * 20000); // 60–80s
      swarmPlanRef.current.variant = 'encircle';
    }

    // random swarms
    if (
      swarmPlanRef.current.done < swarmPlanRef.current.total &&
      e > swarmPlanRef.current.nextAt &&
      !isEventActive('SWARM') &&
      !isEventActive('WALL') &&
      (!activeEventRef.current || now >= activeEventRef.current.endsAt) &&
      now >= reliefUntilRef.current && now >= eventCooldownUntilRef.current
    ) {
      const r = Math.random();
      const variant = r < 0.55 ? 'encircle' : 'three_sides';

      const safeAngle = Math.random() * Math.PI * 2;
      const safeArc = Math.PI * 0.55;

      const isFirstSwarm = swarmPlanRef.current.done === 0;
      const dur = isFirstSwarm ? 32000 : EVENT_DEFS.SWARM.duration;

      if (startEvent('SWARM', { variant, safeAngle, safeArc, duration: dur })) {
        swarmPlanRef.current.variant = variant;
        swarmPlanRef.current.done += 1;
        swarmPlanRef.current.nextAt = e + (25000 + Math.floor(Math.random() * 30000)); // +25–55s
        juicePunch(0.65, 0.65);
      }
    }

    // -------------------- FIXED WALL EVENT --------------------
    // Spawn ONCE: ring enemies lock to the center point and encroach until despawn.
    // No duplicates, no extra spawns while active.
    if (
      e > 72000 &&
      !flagsRef.current.wall1 &&
      (!activeEventRef.current || now >= activeEventRef.current.endsAt) &&
      now >= reliefUntilRef.current && now >= eventCooldownUntilRef.current
    ) {
      const meta = {
        ringN: 30,
        radiusStart: 2000,
        encroachSpeed: 1.5,
        minRadius: 10,
        hpMult: 3.0,
        size: 52,
        spawned: true // important: mark as spawned at start
      };

      if (startEvent('WALL', meta)) {
        flagsRef.current.wall1 = true;
        juicePunch(0.85, 0.8);

        // Spawn immediately (ONCE)
        const pp = playerRef.current;
        const difficulty = tileDifficulty + Math.floor(progElapsedRef.current / 20000);
        enemiesRef.current = [
          ...(enemiesRef.current || []),
          ...spawnWallRing(pp, difficulty, activeEventRef.current.meta)
        ];
      }
    }

    // rams at 25/50/75% of run time (1 → 2 → 5)
    const runT = runTimeRef.current || BOSS_TIME;
    const p = e / runT;
    const pp = playerRef.current;
    const difficulty = tileDifficulty + Math.floor(e / 20000);

    if (p > 0.25 && !flagsRef.current.mini25) {
      flagsRef.current.mini25 = true;
      enemiesRef.current = [...(enemiesRef.current || []), ...spawnRamsRing(pp, difficulty, 1)];
      juicePunch(1.0, 0.9);
      triggerRelief(6500 + Math.floor(Math.random() * 2500));
    }
    if (p > 0.50 && !flagsRef.current.mini50) {
      flagsRef.current.mini50 = true;
      enemiesRef.current = [...(enemiesRef.current || []), ...spawnRamsRing(pp, difficulty, 2)];
      juicePunch(1.0, 0.9);
      triggerRelief(6500 + Math.floor(Math.random() * 2500));
    }
    if (p > 0.75 && !flagsRef.current.mini75) {
      flagsRef.current.mini75 = true;
      enemiesRef.current = [...(enemiesRef.current || []), ...spawnRamsRing(pp, difficulty, 5)];
      juicePunch(1.0, 0.95);
      triggerRelief(6500 + Math.floor(Math.random() * 2500));
    }

    // end-of-event relief beat
    if (activeEventRef.current && now >= activeEventRef.current.endsAt) {
      activeEventRef.current = null;
      triggerRelief(5500 + Math.floor(Math.random() * 3500)); // 5.5–9.0s
    }
  };

  const maybeDropPickup = (x, y, source = 'elite') => {
    const base = source === 'boss' ? 0.35 : source === 'mini' ? 0.18 : 0.08;
    if (Math.random() > base) return;

    const r = Math.random();
    const type = r < 0.32 ? 'MAGNET' : r < 0.56 ? 'OVERDRIVE' : r < 0.78 ? 'SHIELD' : 'FREEZE';
    pickupsRef.current = [...(pickupsRef.current || []), { id: Math.random(), type, x, y, t: Date.now(), life: 24000 }];
  };

  const activatePickup = (type) => {
    const now = Date.now();
    if (type === 'MAGNET') magnetUntil.current = Math.max(magnetUntil.current, now + PICKUP_DEFS.MAGNET.life);
    if (type === 'FREEZE') freezeUntil.current = Math.max(freezeUntil.current, now + PICKUP_DEFS.FREEZE.life);
    if (type === 'OVERDRIVE') overdriveUntil.current = Math.max(overdriveUntil.current, now + PICKUP_DEFS.OVERDRIVE.life);
    if (type === 'SHIELD') shieldUntil.current = Math.max(shieldUntil.current, now + PICKUP_DEFS.SHIELD.life);
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

    // Initialize Canvas
    if (canvasRef.current) {
      ctxRef.current = canvasRef.current.getContext('2d');
      canvasRef.current.width = window.innerWidth;
      canvasRef.current.height = window.innerHeight;
    }

    const loop = setInterval(() => {
      if (pausedRef.current) return;

      const now = Date.now();

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

        // Orbs
        orbsRef.current.forEach(orb => {
          if (orb.x < viewL || orb.x > viewR || orb.y < viewT || orb.y > viewB) return;

          const r = orb.r ?? (6 + (orb.rank || 0) * 2.0);
          const col = orb.color || '#ffffff';

          if ((orb.rank || 0) >= 4) {
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

          // core
          ctx.fillStyle = col;
          ctx.beginPath();
          ctx.arc(orb.x - cam.x, orb.y - cam.y, r, 0, Math.PI * 2);
          ctx.fill();

          if (orb.ring) {
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

          ctx.fillStyle = b.color || '#fff';
          ctx.save();
          ctx.translate(b.x - cam.x, b.y - cam.y);
          const ang = Number.isFinite(b.angle) ? b.angle : Math.atan2(b.vy || 0, b.vx || 0);
          const bw = b.width || 10;
          const bh = b.height || 4;
          ctx.rotate(ang);
          ctx.fillRect(-bw / 2, -bh / 2, bw, bh);
          ctx.restore();
        });

        // Enemies
        enemiesRef.current.forEach(e => {
          if (e.x < viewL || e.x > viewR || e.y < viewT || e.y > viewB) return;

          const sx = e.x - cam.x;
          const sy = e.y - cam.y;

          ctx.fillStyle = e.color || '#ff007a';
          ctx.fillRect(sx - e.size / 2, sy - e.size / 2, e.size, e.size);

          const isMini = String(e.type || '').startsWith('mini_');

          // RAM telegraph lane (only during windup)
          if (e.type === 'mini_charger' && e.windupUntil && Date.now() < e.windupUntil) {
            const ang = e.dashDir || 0;
            const len = e.dashLen ?? 420;

            ctx.save();
            ctx.globalAlpha = 0.55;

            ctx.strokeStyle = 'rgba(255,255,255,0.55)';
            ctx.lineWidth = 10;
            ctx.beginPath();
            ctx.moveTo(sx, sy);
            ctx.lineTo(sx + Math.cos(ang) * len, sy + Math.sin(ang) * len);
            ctx.stroke();

            ctx.globalAlpha = 0.35;
            ctx.strokeStyle = 'rgba(255,220,107,0.9)';
            ctx.lineWidth = 18;
            ctx.beginPath();
            ctx.moveTo(sx, sy);
            ctx.lineTo(sx + Math.cos(ang) * len, sy + Math.sin(ang) * len);
            ctx.stroke();

            ctx.globalAlpha = 0.8;
            ctx.fillStyle = 'rgba(255,220,107,0.95)';
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
            ctx.fillText(e.type === 'mini_charger' ? 'RAM' : 'MINI', sx, sy - e.size / 2 - 26);
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

          ctx.save();
          ctx.globalAlpha = a * (e.hazard ? 0.35 : 0.45);
          ctx.strokeStyle = e.hazard ? 'rgba(255,120,120,1)' : 'rgba(255,255,255,1)';
          ctx.lineWidth = e.hazard ? 3 : 2;
          ctx.beginPath();
          ctx.arc(e.x - cam.x, e.y - cam.y, rr, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        });

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
      elapsed.current += 16;

      // FIX: progression pauses while ANY event is active (SWARM/WALL) so no new events/boss triggers
      const eventActive = !!(activeEventRef.current && Date.now() < activeEventRef.current.endsAt);
      if (!eventActive) progElapsedRef.current += 16;

      if (elapsed.current % 160 === 0) {
        setProgress(Math.min(1, progElapsedRef.current / (runTimeRef.current || BOSS_TIME)));
      }

      // scripted beats
      scheduleBeats();

      // decay VFX (throttled)
      if (elapsed.current % 160 === 0) {
        const nowV = Date.now();
        deathFxRef.current = (deathFxRef.current || []).filter((f) => nowV - f.t < 280);
        arcsRef.current = (arcsRef.current || []).filter((a) => nowV - a.t < (a.life || 150));
        explosionsRef.current = (explosionsRef.current || []).filter((e) => nowV - e.t < (e.life || 280));
        railLinesRef.current = (railLinesRef.current || []).filter((l) => nowV - l.t < (l.life || 120));
        beamsRef.current = (beamsRef.current || []).filter((b) => nowV - b.t < (b.life || 120));
        slashesRef.current = (slashesRef.current || []).filter((s) => nowV - (s.t || (nowV - (s.age || 0))) < (s.life || 260));
        pickupsRef.current = (pickupsRef.current || []).filter((p) => nowV - p.t < p.life);
      }

      // regen
      if (statsRef.current.regen > 0) {
        const s = statsRef.current;
        s.hp = Math.min(s.maxHp, s.hp + s.regen * 0.016);
      }

      // move player + camera
      {
        const prev = playerRef.current;
        let nx = prev.x;
        let ny = prev.y;

        const baseSpeed = 5.8;
        const speedMult = Math.min(crewSpeedMult, 1.45);
        const finalSpeed = baseSpeed * speedMult * (statsRef.current.moveSpeed || 1);

        if (keys.current.w) ny -= finalSpeed;
        if (keys.current.s) ny += finalSpeed;
        if (keys.current.a) nx -= finalSpeed;
        if (keys.current.d) nx += finalSpeed;
        if (dragMoveRef.current.active) {
          nx += dragMoveRef.current.vecX * finalSpeed;
          ny += dragMoveRef.current.vecY * finalSpeed;
        }

        nx = clamp(nx, 0, ARENA_SIZE);
        ny = clamp(ny, 0, ARENA_SIZE);

        const nc = { x: nx - window.innerWidth / 2, y: ny - window.innerHeight / 2 };
        cameraRef.current = nc;

        const np = { x: nx, y: ny };
        playerRef.current = np;

        if (playerSpriteRef.current) {
          playerSpriteRef.current.style.left = `${nx}px`;
          playerSpriteRef.current.style.top = `${ny}px`;
        }
        if (playerTracerRef.current) {
          playerTracerRef.current.style.left = `${nx - 60}px`;
          playerTracerRef.current.style.top = `${ny - 60}px`;
        }

        const worldEl = worldRef.current;
        if (worldEl) {
          const nowFx = Date.now();
          const until = juice.current.until || 0;
          const dur = juice.current.dur || 140;
          const t = until > nowFx ? (until - nowFx) / dur : 0;
          const chroma = (juice.current.maxChroma || 0) * t;

          worldEl.style.transform = `translate(${-nc.x}px,${-nc.y}px)`;
          worldEl.style.filter = chroma > 0.02 ? `saturate(${1 + chroma * 0.10}) brightness(${1 + chroma * 0.05})` : '';
          if (t <= 0) {
            juice.current.maxPunch = 0;
            juice.current.maxChroma = 0;
          }
        }
      }

      const p = playerRef.current;
      const freezeWorld = Date.now() < freezeUntil.current;

      // -------------------- SPAWNING --------------------
      const difficulty = tileDifficulty + Math.floor(progElapsedRef.current / 20000);

      const lateRamp = Math.max(0, (progElapsedRef.current - 90000) / 30000);
      const spawnIntervalBase = Math.max(140, 1250 - difficulty * 80 - lateRamp * 260);

      const inRelief = Date.now() < reliefUntilRef.current;

      // 15% fewer enemies over time
      let spawnInterval = spawnIntervalBase * SPAWN_INTERVAL_MULT * (inRelief ? 2.2 : 1.0);

      // scripted event modifiers
      if (isEventActive('SWARM')) spawnInterval *= 0.60;
      if (isEventActive('WALL')) spawnInterval *= 999; // FIX: NO spawns during WALL (ring is the event)

      let nextEnemies = [...enemiesRef.current];

      const nowSpawn = Date.now();
      const reliefHard = (nowSpawn < reliefUntilRef.current) && (nowSpawn - (reliefStartedAtRef.current || 0) < 1800);

      if (!freezeWorld && !reliefHard) {
        if (elapsed.current - lastSpawn.current > spawnInterval) {
          lastSpawn.current = elapsed.current;

          const countBase = Math.min(2 + Math.floor(difficulty / 2), 12);
          const count = Math.max(1, Math.round(countBase + lateRamp * 4));

          if (isEventActive('SWARM')) {
            const swarmCount = Math.max(6, Math.round((14 + Math.floor(difficulty * 0.45)) * (1 / SPAWN_INTERVAL_MULT)));
            const variant = (activeEventRef.current && activeEventRef.current.meta && activeEventRef.current.meta.variant) || swarmPlanRef.current.variant || 'encircle';

            for (let i = 0; i < swarmCount; i += 1) {
              const en = spawnEnemy(difficulty, 'swarm');

              if (variant === 'three_sides') {
                const meta = activeEventRef.current?.meta || {};
                const safeAngle = meta.safeAngle ?? 0;
                const safeArc = meta.safeArc ?? (Math.PI * 0.55);

                const centers = [
                  safeAngle + Math.PI,
                  safeAngle + Math.PI + (Math.PI * 2 / 3),
                  safeAngle + Math.PI - (Math.PI * 2 / 3)
                ];

                const c = centers[Math.floor(Math.random() * centers.length)];
                const a = c + (Math.random() - 0.5) * 0.55;
                const dist = 760 + Math.random() * 180;

                const x = clamp(p.x + Math.cos(a) * dist, 40, ARENA_SIZE - 40);
                const y = clamp(p.y + Math.sin(a) * dist, 40, ARENA_SIZE - 40);
                nextEnemies.push({ ...en, x, y });
              } else {
                const meta = activeEventRef.current?.meta || {};
                const safeAngle = meta.safeAngle ?? 0;
                const safeArc = meta.safeArc ?? (Math.PI * 0.55);

                let placed = null;
                for (let tries = 0; tries < 6; tries++) {
                  const cand = spawnEnemy(difficulty, 'swarm');
                  const ang = Math.atan2(cand.y - p.y, cand.x - p.x);
                  let v = ang - safeAngle;
                  while (v > Math.PI) v -= Math.PI * 2;
                  while (v < -Math.PI) v += Math.PI * 2;
                  const dA = Math.abs(v);
                  if (dA > safeArc * 0.5) { placed = cand; break; }
                }
                nextEnemies.push(placed || en);
              }
            }
          } else if (!isEventActive('WALL')) {
            for (let i = 0; i < count; i += 1) nextEnemies.push(spawnEnemy(difficulty));
          }
        }

        // FIX: boss spawn depends on progElapsedRef (paused during events)
        if (!bossSpawnedRef.current && progElapsedRef.current > (runTimeRef.current || BOSS_TIME)) {
          bossSpawnedRef.current = true;
          setBossSpawned(true);
          nextEnemies.push(spawnBoss(p, difficulty));
          juicePunch(1.25, 1);
        }
      }

      // -------------------- ENEMY MOVE / AI --------------------
      const movedEnemiesRaw = nextEnemies.map((en) => {
        if (freezeWorld) return en;
        if (en.stunnedUntil && Date.now() < en.stunnedUntil) return en;

        // mini-boss behaviors
        if (en.type === 'mini_charger') {
          const now2 = Date.now();
          const dx = p.x - en.x;
          const dy = p.y - en.y;
          const angToPlayer = Math.atan2(dy, dx);

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
              nextDashAt: now2 + (en.dashCd || 1800)
            };
          }

          if (en.windupUntil && now2 < en.windupUntil) return en;

          if (en.windupUntil && now2 >= en.windupUntil && !en.dashUntil) {
            return { ...en, dashUntil: now2 + (en.dashMs || 360), windupUntil: 0 };
          }

          if (en.dashUntil && now2 < en.dashUntil) {
            const totalTicks = en.dashTicks || Math.ceil((en.dashMs || 360) / 16);
            const dashLen = en.dashLen ?? ((en.dashSpd || 10.5) * totalTicks);
            const perTick = dashLen / totalTicks;

            const nx = clamp(en.x + Math.cos(en.dashDir || 0) * perTick, 0, ARENA_SIZE);
            const ny = clamp(en.y + Math.sin(en.dashDir || 0) * perTick, 0, ARENA_SIZE);
            return { ...en, x: nx, y: ny };
          }

          if (en.dashUntil && now2 >= en.dashUntil) {
            return { ...en, dashUntil: 0 };
          }
        }

        // WALL ring behavior: fixed angle, radius shrinks, fixed center
        if (en.type === 'wall' && Number.isFinite(en.wallA)) {
          const spd = en.wallEncroach ?? 2.0;
          const minR = en.wallMinR ?? 180;

          const curR = en.wallR ?? 1300;
          const nr = curR - spd;

          if (nr <= minR + 1) return { ...en, despawn: true };

          const cx = Number.isFinite(en.wallCx) ? en.wallCx : en.x;
          const cy = Number.isFinite(en.wallCy) ? en.wallCy : en.y;

          const nx = clamp(cx + Math.cos(en.wallA) * nr, 40, ARENA_SIZE - 40);
          const ny = clamp(cy + Math.sin(en.wallA) * nr, 40, ARENA_SIZE - 40);

          return { ...en, wallR: nr, x: nx, y: ny };
        }

        // default chase
        const dx = p.x - en.x;
        const dy = p.y - en.y;
        const d = Math.hypot(dx, dy) || 1;

        const slowMult = en.slowUntil && Date.now() < en.slowUntil ? (en.slowFactor ?? 0.75) : 1;
        const spd = en.speed * slowMult;
        return { ...en, x: en.x + (dx / d) * spd, y: en.y + (dy / d) * spd };
      });

      const movedEnemies = movedEnemiesRaw.filter((e) => !e.despawn);

      // -------------------- BULLETS UPDATE (homing/accel) --------------------
      const movedBullets = bulletsRef.current
        .map((b) => {
          let vx = b.vx;
          let vy = b.vy;
          let x = b.x;
          let y = b.y;

          if (b.accel) {
            const sp = Math.hypot(vx, vy) || 1;
            const nsp = sp + b.accel;
            vx = (vx / sp) * nsp;
            vy = (vy / sp) * nsp;
          }

          if (b.isHoming) {
            const enemiesNow = movedEnemies;
            if (enemiesNow.length) {
              let t = null;
              if (b.homeTargetId) t = enemiesNow.find((e) => e.id === b.homeTargetId) || null;
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
                const steer = clamp(0.06 + (sp / 26) * 0.05, 0.06, 0.13);
                const newA = cur + dA * steer;

                vx = Math.cos(newA) * sp;
                vy = Math.sin(newA) * sp;
              }
            }
          }

          let nx = x + vx;
          let ny = y + vy;

          if (b.anchorOnMaxRange && b.maxRange > 0 && !b.anchored) {
            const dd = Math.hypot(nx - b.originX, ny - b.originY);
            if (dd >= b.maxRange) {
              nx = b.originX + Math.cos(b.dirAngle || 0) * b.maxRange;
              ny = b.originY + Math.sin(b.dirAngle || 0) * b.maxRange;
              vx = 0;
              vy = 0;
              return { ...b, x: nx, y: ny, vx, vy, anchored: true, life: b.life - 16 };
            }
          }

          if (b.anchored) {
            vx = 0;
            vy = 0;
          }

          return { ...b, x: nx, y: ny, vx, vy, life: b.life - 16 };
        })
        .filter((b) => b.x > -140 && b.x < ARENA_SIZE + 140 && b.y > -140 && b.y < ARENA_SIZE + 140 && b.life > 0);

      // slashes update
      const movedSlashes = slashesRef.current
        .map((sl) => ({ ...sl, age: (sl.age || 0) + 16 }))
        .filter((sl) => (sl.age || 0) <= sl.life);

      // beams tick damage (LASER)
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
              beamHits.set(en.id, (beamHits.get(en.id) || 0) + bm.damage);
              const st = statusHits.get(en.id) || {};
              if (bm.burn) st.burn = Math.max(st.burn || 0, bm.burn);
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

      const pickRicochetTarget = (fromEnemy, allEnemies) => {
        const maxRange2 = 360 * 360;
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

      const applyMicroFreeze = (en, ms) => {
        const st = statusHits.get(en.id) || {};
        st.stun = Math.max(st.stun || 0, ms);
        statusHits.set(en.id, st);
      };

      nextBullets.forEach((b) => {
        if (b.hit) return;

        for (const en of movedEnemies) {
          if (b.hit) break;
          const d = Math.hypot(b.x - en.x, b.y - en.y);
          if (d < en.size * 0.7) {
            bulletHits.set(en.id, (bulletHits.get(en.id) || 0) + b.damage);

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

            if (b.explodeRadius && b.explodeMult) {
              explosionBursts.push({
                x: en.x,
                y: en.y,
                radius: b.explodeRadius,
                damage: b.damage * b.explodeMult
              });
            }

            // SNIPER tear-through visuals + shock
            if (b.rail) {
              railLinesRef.current = [...(railLinesRef.current || []), {
                id: Math.random(),
                x1: b.originX,
                y1: b.originY,
                x2: en.x,
                y2: en.y,
                width: b.railWidth || 18,
                t: Date.now(),
                life: b.railMs || 90,
                color: b.color
              }];

              for (const e2 of movedEnemies) {
                const dd = distPointToSeg(e2.x, e2.y, b.originX, b.originY, en.x, en.y);
                if (dd <= (b.railWidth || 18) * 0.65) {
                  bulletHits.set(e2.id, (bulletHits.get(e2.id) || 0) + b.damage * 0.22);
                }
              }
            }

            // ricochet
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
              for (const e2 of movedEnemies) {
                if (e2.id === en.id) continue;
                const dd = dist2(en, e2);
                if (dd < bestD && dd <= maxRange2) { bestD = dd; best = e2; }
              }
              if (best) {
                arcsRef.current = [...(arcsRef.current || []), { id: Math.random(), x1: en.x, y1: en.y, x2: best.x, y2: best.y, t: Date.now(), life: 150, color: b.color }];
                bulletHits.set(best.id, (bulletHits.get(best.id) || 0) + b.damage * 0.60);
                const st2 = statusHits.get(best.id) || {};
                if (b.stun) st2.stun = Math.max(st2.stun || 0, Math.floor(b.stun * 0.7));
                if (b.slow) st2.slow = Math.max(st2.slow || 0, Math.max(0.06, b.slow * 0.6));
                statusHits.set(best.id, st2);
                juicePunch(0.28, 0.5);
              }
            }
          }
        }
      });

      // explosion damage
      if (explosionBursts.length) {
        for (const burst of explosionBursts) {
          explosionsRef.current = [...(explosionsRef.current || []), { id: Math.random(), x: burst.x, y: burst.y, r: burst.radius, t: Date.now(), life: 260 }];
          for (const en of movedEnemies) {
            const d = Math.hypot(en.x - burst.x, en.y - burst.y);
            if (d <= burst.radius) {
              const fall = 1 - d / burst.radius;
              bulletHits.set(en.id, (bulletHits.get(en.id) || 0) + burst.damage * Math.max(0.25, fall));
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
      const currentEnemies = movedEnemies;

      if (currentEnemies.length) {
        const overdrive = now3 < overdriveUntil.current;
        const overdriveMult = overdrive ? 1.5 : 1.0;

        selectedWeaponsRef.current.forEach((id) => {
          const weapon = WEAPONS.find((w) => w.id === id);
          if (!weapon) return;

          const lvl = weaponLevelsRef.current[id] || 1;
          const wStats = buildWeaponStats(weapon, lvl);

          const last = lastFire.current[id] || 0;
          const fireCooldownBase = (wStats.cooldown || 600) / (statsRef.current.attackSpeed || 1);
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
            const baseDamage = (wStats.damage || 12) * (statsRef.current.damageMult || 1) * crewDamageMult;
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
              const activeMs = Number.isFinite(pat.activeMs) ? pat.activeMs : 120;
              const rangeMult = Number.isFinite(pat.rangeMult) ? pat.rangeMult : 1;

              return {
                id: Math.random(),
                x: pp.x,
                y: pp.y,
                range: baseRange * rangeMult,
                damage: dmg,
                angle: baseAngle + (pat.offset || 0),
                arc,
                delay,
                activeMs,
                age: 0,
                life: delay + 240,
                kind: pat.kind || 'crescent',
                color: pat.color,
                lineWidth: pat.lineWidth,
                glowColor: pat.glowColor,
                glowBlur: pat.glowBlur
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
                damage: (wStats.damage || 8) * (statsRef.current.damageMult || 1) * crewDamageMult,
                tickMs,
                burn,
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

            let smgPierceBonus = 0;
            if (weapon.id === 'SMG') {
              smgCounter.current += 1;
              if (smgCounter.current % 5 === 0) smgPierceBonus = 1;
            }

            const baseSpeed = wStats.bulletSpeed || 12;
            const speed = isRocket ? baseSpeed * 0.78 : baseSpeed;

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
              damage: (wStats.damage || 1) * (statsRef.current.damageMult || 1) * crewDamageMult,
              color: weapon.color,
              life: wStats.lifeMs || (isSniper ? 900 : 1000),
              width: wStats.width,
              height: wStats.height,
              pierce: (wStats.pierce ?? 0) + smgPierceBonus,
              flashy: wStats.flashy,

              ricochets: wStats.ricochets || 0,
              chain: wStats.chain || 0,
              slow: wStats.slow || 0,
              slowDuration: wStats.slow ? (wStats.slowDuration || (weapon.id === 'TIME' ? 1100 : 520)) : 0,
              stun: wStats.stun || 0,
              knockback: wStats.knockback || 0,
              explodeRadius: wStats.explodeRadius || 0,
              explodeMult: wStats.explodeMult || 0,
              burn: wStats.burn || 0,
              microFreeze: wStats.microFreeze || 0,

              isHoming: !!wStats.homing,
              accel: wStats.accel || 0,
              homeTargetId: isRocket && rocketTargets && rocketTargets[i] ? rocketTargets[i].id : null,

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
              railMs: wStats.railMs || 90
            });
          }

          spawnedBullets.push(...next);
        });
      }

      // -------------------- APPLY DAMAGE (bullets + sword arcs) --------------------
      const allSlashes = [...movedSlashes, ...spawnedSlashes];
      const withDamage = movedEnemies.map((en0) => {
        let en = en0;
        let totalDamage = bulletHits.get(en.id) || 0;

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
        });

        // VOID pull
        const pulls = movedBullets.filter((b) => {
          if (!b.pull) return false;
          if (Math.hypot(b.x - en.x, b.y - en.y) >= (b.pullRadius || 190)) return false;
          const dToPlayer = Math.hypot(b.x - p.x, b.y - p.y);
          return dToPlayer > 140;
        });

        const isBossy = en.type === 'boss' || String(en.type).startsWith('mini_');
        if (
          pulls.length &&
          !freezeWorld &&
          en.type !== 'juggernaut' &&
          !isBossy &&
          !(en.stunnedUntil && Date.now() < en.stunnedUntil)
        ) {
          const strongest = pulls.reduce((acc, b) => Math.max(acc, b.pull || 0), 0);
          const cx = pulls.reduce((acc, b) => acc + b.x, 0) / pulls.length;
          const cy = pulls.reduce((acc, b) => acc + b.y, 0) / pulls.length;
          const dx = cx - en.x;
          const dy = cy - en.y;
          const d = Math.hypot(dx, dy) || 1;
          en = { ...en, x: en.x + (dx / d) * strongest * 2.2, y: en.y + (dy / d) * strongest * 2.2 };
        }

        const voidFields = movedBullets.filter((b) => b.vortexDps && b.pull && Math.hypot(b.x - en.x, b.y - en.y) < (b.pullRadius || 200));
        if (voidFields.length) {
          const dps = voidFields.reduce((acc, b) => acc + (b.vortexDps || 0), 0);
          totalDamage += dps * 0.016;
        }

        if (totalDamage > 0) {
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

        if (st.slow && out.type !== 'juggernaut') {
          out.slowUntil = Date.now() + (st.slowDuration || 520);
          out.slowFactor = clamp(1 - st.slow, 0.45, 0.95);
        }
        if (st.stun && out.type !== 'juggernaut') {
          out.stunnedUntil = Math.max(out.stunnedUntil || 0, Date.now() + st.stun);
        }

        if (st.knockback && !freezeWorld && out.type !== 'juggernaut') {
          const ang = Math.atan2(out.y - p.y, out.x - p.x);
          const push = 5.0 * st.knockback;
          out.x += Math.cos(ang) * push;
          out.y += Math.sin(ang) * push;
        }

        if (st.burn) {
          out.burnUntil = Math.max(out.burnUntil || 0, Date.now() + st.burn);
          out.burnDps = Math.max(out.burnDps || 0, 4.2);
        }

        return out;
      });

      // burn tick
      const burned = withStatus.map((en) => {
        if (en.burnUntil && Date.now() < en.burnUntil) {
          return { ...en, hp: en.hp - (en.burnDps || 3.2) * 0.016 };
        }
        return en;
      });

      // VOID singularity pop on expire
      const expiredVoids = bulletsRef.current.filter((b) => b.singularity && b.life <= 16);
      if (expiredVoids.length) {
        expiredVoids.forEach((v) => {
          explosionsRef.current = [...(explosionsRef.current || []), { id: Math.random(), x: v.x, y: v.y, r: v.explodeRadius || 120, t: Date.now(), life: 320 }];
          movedEnemies.forEach((en) => {
            const d = Math.hypot(en.x - v.x, en.y - v.y);
            if (d <= (v.explodeRadius || 120)) {
              const fall = 1 - d / (v.explodeRadius || 120);
              bulletHits.set(en.id, (bulletHits.get(en.id) || 0) + (v.damage || 14) * (v.explodeMult || 0.95) * Math.max(0.35, fall));
              const st = statusHits.get(en.id) || {};
              st.stun = Math.max(st.stun || 0, 120);
              statusHits.set(en.id, st);
            }
          });
          juicePunch(0.9, 0.95);
        });
      }

      // -------------------- DEATHS -> ORBS + PICKUPS --------------------
      const alive = [];
      const newOrbs = [];

      burned.forEach((en) => {
        if (en.hp > 0) {
          alive.push(en);
          return;
        }

        deathFxRef.current = [...(deathFxRef.current || []), { id: Math.random(), x: en.x, y: en.y, t: Date.now(), size: en.size }];

        const total = Math.max(2, Math.floor(en.xp * 0.80));
        const pack = Math.max(1, Math.round(total / 14));

        for (let i = 0; i < pack; i += 1) {
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

        if (en.type === 'boss') {
          maybeDropPickup(en.x, en.y, 'boss');
          setVictory(true);
        } else if (String(en.type).startsWith('mini_')) {
          maybeDropPickup(en.x, en.y, 'mini');
        } else if (Math.random() < 0.06) {
          maybeDropPickup(en.x, en.y, 'elite');
        }

        juicePunch(en.type === 'boss' ? 1.2 : 0.44, en.type === 'boss' ? 0.9 : 0.5);
      });

      enemiesRef.current = alive;
      bulletsRef.current = [...nextBullets.filter((b) => !b.hit), ...spawnedBullets];
      slashesRef.current = allSlashes;
      if (newOrbs.length) orbsRef.current = [...(orbsRef.current || []), ...newOrbs];

      // -------------------- ORBS: attract + cluster + merge + pickup --------------------
      orbsRef.current = (() => {
        const prev = orbsRef.current || [];
        const pp = playerRef.current;
        const magnet = Date.now() < magnetUntil.current;

        const clustered = prev.map((o) => {
          let ax = 0;
          let ay = 0;
          let n = 0;
          for (const o2 of prev) {
            if (o2.id === o.id) continue;
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
          const dx = pp.x - o.x;
          const dy = pp.y - o.y;
          const d = Math.hypot(dx, dy);
          const range = magnet ? 1250 : 170;
          if (d > 0 && d < range) {
            const basePull = magnet ? 12.0 : 3.6;
            const rankPull = 1 + (o.rank || 0) * 0.15;
            return { ...o, x: o.x + (dx / d) * basePull * rankPull, y: o.y + (dy / d) * basePull * rankPull };
          }
          return o;
        });

        const merged = mergeOrbs(drifted);

        const kept = [];
        let gained = 0;
        merged.forEach((o) => {
          const d = Math.hypot(o.x - pp.x, o.y - pp.y);
          if (d < 36) gained += o.value;
          else kept.push(o);
        });

        const t = elapsed.current / (runTimeRef.current || BOSS_TIME);
        const xpMult = 1.22 * (t > 0.65 ? 1.25 : 1.0);
        if (gained > 0) xpRef.current += gained * xpMult;

        return kept;
      })();

      // -------------------- PICKUPS --------------------
      {
        const pp = playerRef.current;
        const prev = pickupsRef.current || [];
        const kept = [];
        for (const pk of prev) {
          const d = Math.hypot(pk.x - pp.x, pk.y - pp.y);
          if (d < 44) activatePickup(pk.type);
          else kept.push(pk);
        }
        pickupsRef.current = kept;
      }

      syncUI();

      // -------------------- LEVEL UP --------------------
      if (xpRef.current >= xpTargetRef.current) {
        xpRef.current = xpRef.current - xpTargetRef.current;
        levelRef.current = (levelRef.current || 1) + 1;
        xpTargetRef.current = Math.floor(xpTargetRef.current * 1.30);
        setUpgradeOptions(rollUpgradeOptions(selectedWeaponsRef.current, weaponLevelsRef.current, statsRef.current));
        syncUI(true);
        juicePunch(0.55, 0.55);
      }

      // -------------------- CONTACT DAMAGE + HAZARDS --------------------
      if (!freezeWorld) {
        const now2 = Date.now();
        const shielded = now2 < shieldUntil.current;

        let hazardDamage = 0;
        explosionsRef.current.forEach((e) => {
          if (!e.hazard) return;
          const d = Math.hypot(p.x - e.x, p.y - e.y);
          if (d <= e.r) hazardDamage += 7;
        });

        if (!shielded && hazardDamage > 0 && now2 - lastDamage.current > 240) {
          lastDamage.current = now2;
          statsRef.current.hp = Math.max(0, statsRef.current.hp - hazardDamage);
          syncUI();
          juicePunch(0.6, 0.7);
        }

        if (now2 - lastDamage.current > 260) {
          let totalDamage = 0;
          const pp = playerRef.current;
          alive.forEach((en) => {
            const d = Math.hypot(en.x - pp.x, en.y - pp.y);
            if (d < en.size * 0.55 + 16) totalDamage += en.contactDamage || 8;
          });
          if (totalDamage > 0) {
            lastDamage.current = now2;
            if (!shielded) {
              statsRef.current.hp = Math.max(0, statsRef.current.hp - totalDamage);
              syncUI();
              juicePunch(0.55, 0.65);
            } else {
              juicePunch(0.35, 0.55);
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
    }, 16);

    return () => clearInterval(loop);
  }, [selectedWeapons.length, tileDifficulty, crewDamageMult, crewSpeedMult]);

  const chooseUpgrade = (option) => {
    const next = option.apply(statsRef.current);
    statsRef.current = next;
    setStats(next);
    if (option.weaponId) {
      if (option.upgradeLevel) {
        setWeaponLevels((levels) => ({ ...levels, [option.weaponId]: option.upgradeLevel }));
      } else {
        setSelectedWeapons((w) => (w.length >= 4 ? w : [...w, option.weaponId]));
        setWeaponLevels((levels) => ({ ...levels, [option.weaponId]: 1 }));
      }
    }
    setUpgradeOptions([]);
    juicePunch(0.40, 0.60);
  };

  const selectWeapon = (weaponId) => {
    // reset run state
    progElapsedRef.current = 0;
    elapsed.current = 0;

    flagsRef.current = { swarm1: false, wall1: false, mini25: false, mini50: false, mini75: false, reliefLock: false };
    activeEventRef.current = null;
    eventCooldownUntilRef.current = 0;
    reliefUntilRef.current = 0;
    reliefStartedAtRef.current = 0;
    swarmPlanRef.current = { total: 0, done: 0, nextAt: 0, variant: 'encircle' };

    enemiesRef.current = [];
    bulletsRef.current = [];
    beamsRef.current = [];
    railLinesRef.current = [];
    slashesRef.current = [];
    arcsRef.current = [];
    explosionsRef.current = [];
    orbsRef.current = [];
    pickupsRef.current = [];

    bossSpawnedRef.current = false;
    setBossSpawned(false);
    setVictory(false);
    setDefeat(false);
    setProgress(0);

    xpRef.current = 0;
    xpTargetRef.current = 140;
    levelRef.current = 1;
    setXp(0);
    setXpTarget(140);
    setLevel(1);

    setSelectedWeapons([weaponId]);
    setWeaponLevels({ [weaponId]: 1 });
    setUpgradeOptions([]);
    juicePunch(0.40, 0.55);
  };

  const showShield = Date.now() < shieldUntil.current;
  const showOverdrive = Date.now() < overdriveUntil.current;
  const showMagnet = Date.now() < magnetUntil.current;
  const showFreeze = Date.now() < freezeUntil.current;

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

        <div style={{ display: 'flex', gap: 10, marginTop: 10, opacity: 0.95 }}>
          {showMagnet && <div className="boss-warning" style={{ padding: '6px 10px', fontSize: 12 }}>🧲 MAGNET</div>}
          {showFreeze && <div className="boss-warning" style={{ padding: '6px 10px', fontSize: 12 }}>❄ FREEZE</div>}
          {showOverdrive && <div className="boss-warning" style={{ padding: '6px 10px', fontSize: 12 }}>⚡ OVERDRIVE</div>}
          {showShield && <div className="boss-warning" style={{ padding: '6px 10px', fontSize: 12 }}>🛡 SHIELD</div>}
        </div>
      </div>

      <div className="world-container" ref={worldRef} style={{ willChange: 'transform' }}>
        <div className="world-border" />
        <div className="player-tracer" ref={playerTracerRef} />
        <div
          className="player-sprite"
          ref={playerSpriteRef}
          style={{
            boxShadow: showShield ? '0 0 16px rgba(120,220,255,0.75), 0 0 36px rgba(120,220,255,0.55)' : undefined,
            filter: showOverdrive ? 'brightness(1.15) saturate(1.2)' : undefined
          }}
        />

        {pickups.map((pk) => (
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
                pk.type === 'MAGNET' ? 'rgba(180,255,200,0.9)' :
                  pk.type === 'FREEZE' ? 'rgba(160,220,255,0.9)' :
                    pk.type === 'OVERDRIVE' ? 'rgba(255,220,140,0.92)' :
                      'rgba(200,170,255,0.92)',
              boxShadow: '0 0 12px rgba(255,255,255,0.45), 0 0 28px rgba(255,255,255,0.25)'
            }}
            title={PICKUP_DEFS[pk.type]?.title || pk.type}
          />
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
          <div style={{ opacity: 0.8, marginTop: 10, fontSize: 12 }}>
            Tip: Builds want contrast. Events + mini-bosses + pickups create beats.
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

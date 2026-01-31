import React, { useEffect, useMemo, useRef, useState } from 'react';

const ARENA_SIZE = 2800; // +40%
const BOSS_TIME = 80000; // shorter run (~80s to boss)

// -------------------- DIFFICULTY TUNING (BASE) --------------------
const TRASH_HP_MULT = 0.95;           // trash HP slightly up (less one-shot mid/late)
const ELITE_HP_MULT = 1.05;           // elites keep their identity late
const MINI_HP_MULT = 1.15;            // mini-bosses a bit sturdier
const BOSS_HP_MULT = 1.65;            // boss much sturdier (was dying too fast)
const SPAWN_INTERVAL_MULT = 0.78;     // faster spawns overall (~+28% density)

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

const BOSS_ADD_INTERVAL_MULT = 1.6;     // fewer adds during boss, but not empty
const BOSS_ADD_COUNT_MULT = 0.85;       // keep pressure during boss
// -------------------- PLAYER FEEDBACK TWEAKS --------------------
const AFTER40_ENEMY_MULT = 1.65;     // +65% enemies after 40% progress
const WALL_HP_MULT = 0.70;           // -30% wall unit HP
const RAM_HP_MULT = 0.60;            // ~15% faster RAM kill (was 0.70)
const RELIEF_SPAWN_INTERVAL_MULT = 1.15; // relief slows spawns slightly


// -------------------- helpers --------------------
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * clamp(t, 0, 1);
const norm01 = (x, a, b) => (b <= a ? 0 : clamp((x - a) / (b - a), 0, 1));

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

const isEliteType = (type) => {
  const t = String(type || '');
  return (
    t === 'boss' ||
    t === 'brute' ||
    t === 'juggernaut' ||
    t === 'wall' ||
    t.startsWith('mini_')
  );
};

// -------------------- WEAPONS (RANK 3-5: MORE CC + EXPLOSIVITY + EFFECTS) --------------------
const WEAPONS = [
  {
    id: 'RIFLE',
    name: 'Rifle',
    targeting: 'closest',
    color: '#e9f7ff',
    levels: [
      { title: 'Rifle I', description: 'Precision shot with guaranteed ricochet.', stats: { cooldown: 520, bulletSpeed: 15.5, damage: 11, pellets: 1, spread: 0.06, width: 12, height: 4, pierce: 2, ricochets: 1 } },
      { title: 'Rifle II', description: 'Tighter cadence.', stats: { cooldown: 475, damage: 13 } },
      // Rank 3+: crowd control + mild splash to help late swarms
      { title: 'Rifle III', description: 'Two-round burst + suppression slow.', stats: { pellets: 2, spread: 0.10, damage: 12, pierce: 3, slow: 0.14, slowDuration: 720 } },
      { title: 'Rifle IV', description: 'Smarter bounces + micro-stun on hit.', stats: { ricochets: 2, damage: 13, pierce: 3, microFreeze: 160, chain: 1 } },
      { title: 'Rifle V', description: 'Triple fan burst + shrapnel pop.', stats: { pellets: 3, spread: 0.18, damage: 13, pierce: 4, ricochets: 2, explodeRadius: 34, explodeMult: 0.28, slow: 0.16, slowDuration: 860 } }
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
    id: 'SMG',
    name: 'SMG',
    targeting: 'closest',
    color: '#ffe58f',
    levels: [
      { title: 'SMG I', description: 'Close target bursts.', stats: { cooldown: 120, bulletSpeed: 17, damage: 7, pellets: 1, spread: 0.18, width: 10, height: 4, pierce: 0, slow: 0.08 } },
      { title: 'SMG II', description: 'Improved control.', stats: { cooldown: 112, damage: 8, spread: 0.16, slow: 0.10 } },
      // Rank 3+: more control, chain and burn at higher ranks
      { title: 'SMG III', description: 'Double burst + ricochet + stronger slow.', stats: { pellets: 2, spread: 0.22, damage: 7, ricochets: 1, slow: 0.14, slowDuration: 820 } },
      { title: 'SMG IV', description: 'Rattle fire + electrified rounds (micro-stun).', stats: { cooldown: 100, damage: 7, ricochets: 2, slow: 0.16, slowDuration: 920, microFreeze: 90, chain: 1 } },
      { title: 'SMG V', description: 'Wide triple spray + chain zap + ignite.', stats: { pellets: 3, spread: 0.34, damage: 6, ricochets: 2, chain: 2, slow: 0.16, slowDuration: 980, burn: 1600 } }
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
      { title: 'Laser I', description: 'Fat beam that carves crowds.', stats: { cooldown: 980, beamMs: 160, beamWidth: 34, damage: 8, tickMs: 16, pierce: 999 } },
      { title: 'Laser II', description: 'Hotter cut.', stats: { damage: 10, beamWidth: 38 } },
      // Rank 3+: apply slow/burn to keep lanes open
      { title: 'Laser III', description: 'Twin beam fan + scorch.', stats: { beams: 2, fan: 0.12, damage: 9, burn: 1300 } },
      { title: 'Laser IV', description: 'Overcharged slice + drag slow.', stats: { cooldown: 860, damage: 12, beamWidth: 44, slow: 0.14, slowDuration: 620 } },
      { title: 'Laser V', description: 'Tri-beam + chain burn + micro-stun ticks.', stats: { beams: 3, fan: 0.18, damage: 11, beamWidth: 48, burn: 1800, microFreeze: 70 } }
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
      // Rank 3-5: stronger utility & waveclear; slightly less oppressive vs elites
      { title: 'Sniper III', description: 'Lance density + concussive slow.', stats: { damage: 92, pierce: 5, explodeRadius: 92, explodeMult: 0.78, railWidth: 22, slow: 0.18, slowDuration: 780, eliteDmgMult: 0.82 } },
      { title: 'Sniper IV', description: 'Faster cycling + stun shockwave.', stats: { cooldown: 1250, damage: 104, explodeRadius: 104, explodeMult: 0.82, railWidth: 24, stun: 120, eliteDmgMult: 0.78 } },
      { title: 'Sniper V', description: 'Annihilator (stun shock) + bigger rupture (but fair vs elites).', stats: { damage: 122, pierce: 6, explodeRadius: 120, explodeMult: 0.88, stun: 160, railWidth: 26, eliteDmgMult: 0.74 } }
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
      { title: 'Tesla III', description: 'More jumps + fork.', stats: { chain: 6, damage: 21, fork: 1 } },
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
      // Rank 3+: more crowd clear / control
      { title: 'Rocket III', description: 'Triple salvo (spreads targets) + flame wash.', stats: { cooldown: 1450, pellets: 3, spread: 0.26, damage: 25, explodeRadius: 260, explodeMult: 0.90, burn: 1400, slow: 0.12, slowDuration: 780 } },
      { title: 'Rocket IV', description: 'Heat-seeking guidance + concussive stun.', stats: { cooldown: 1650, homing: true, damage: 28, explodeRadius: 300, explodeMult: 0.92, stun: 110 } },
      { title: 'Rocket V', description: 'Swarm barrage (12 seekers) + napalm storm.', stats: { cooldown: 1950, pellets: 12, spread: 0.95, bulletSpeed: 4.2, accel: 0.26, homing: true, damage: 18, explodeRadius: 360, explodeMult: 0.90, burn: 2000, slow: 0.14, slowDuration: 860 } }
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
      // Rank 3+: more vacuum + slow field
      { title: 'Void III', description: 'Anchored vortex lasts longer (crowd vacuum) + slow field.', stats: { lifeMs: 2300, pull: 1.95, pullRadius: 240, vortexDps: 16, damage: 15, slow: 0.16, slowDuration: 650 } },
      { title: 'Void IV', description: 'Vortex slows harder + secondary orb.', stats: { pierce: 14, slow: 0.24, slowDuration: 900, pull: 2.15, split: 2 } },
      { title: 'Void V', description: 'Singularity (anchored implosion + pop) + stun pulse.', stats: { singularity: true, explodeRadius: 150, explodeMult: 1.0, pull: 2.55, pullRadius: 270, vortexDps: 22, maxRange: 510, lifeMs: 2450, stun: 120 } }
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
      // Rank 3+: more split + small pop for waveclear
      { title: 'Time III', description: 'Temporal split + ripple pop.', stats: { split: 2, damage: 16, explodeRadius: 28, explodeMult: 0.20 } },
      { title: 'Time IV', description: 'Stasis (stun on hit) + bigger ripple.', stats: { stun: 380, damage: 18, explodeRadius: 44, explodeMult: 0.30 } },
      { title: 'Time V', description: 'Chrono fracture (freeze wave) + huge ripple.', stats: { stun: 520, explodeRadius: 86, explodeMult: 0.60 } }
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
  SWARM: { id: 'SWARM', duration: 16000 },
  WALL: { id: 'WALL', duration: 14000 },
  RELIEF: { id: 'RELIEF', duration: 5200 }
};

const PICKUP_DEFS = {
  MAGNET: { id: 'MAGNET', title: 'XP Magnet', life: 9200 },
  FREEZE: { id: 'FREEZE', title: 'Time Freeze', life: 3200 },
  OVERDRIVE: { id: 'OVERDRIVE', title: 'Overdrive', life: 5200 },
  SHIELD: { id: 'SHIELD', title: 'Emergency Shield', life: 5200 }
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
  const trashHpMult = baseScale * TRASH_HP_MULT * lateAddHpMultFromT(t);
  const eliteHpMult = baseScale * ELITE_HP_MULT;

  const roll = Math.random();

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
   const hp = Math.round(base * trashHpMult);
    return { id: Math.random(), type: 'sprinter', x, y, hp, maxHp: hp, speed: 3.1 + difficulty * 0.1, size: 22, xp: 13, contactDamage: 10, color: '#ff2fd2' };
  }
  const base = 55;
  const hp = Math.round(base * trashHpMult);
  return { id: Math.random(), type: 'grunt', x, y, hp, maxHp: hp, speed: 1.9 + difficulty * 0.06, size: 28, xp: 14, contactDamage: 12, color: '#ff007a' };
};

const spawnEnemy = (difficulty, forcedType = null, t = 0) => {
  if (!forcedType) return spawnEnemyBase(difficulty, t);

  const base = spawnEnemyBase(difficulty, t);

  if (forcedType === 'swarm') {
    const late = norm01(t, 0.45, 1.0);
    const hp = Math.round((12 + difficulty * 2.1) * TRASH_HP_MULT * lerp(1.0, 1.18, late));
    return { ...base, type: 'swarm', hp, maxHp: hp, speed: 2.15 + difficulty * 0.05, size: 17, xp: 3, contactDamage: 5, color: '#ff4aa8' };
  }
  if (forcedType === 'wall') {
    // WALL units are intentionally chunky; still respect late adds HP nerf
    const addHpMult = lateAddHpMultFromT(t);
    const hp = Math.round((((320 + difficulty * 26) * (1 + difficulty * 0.06)) * TRASH_HP_MULT * addHpMult) * WALL_HP_MULT);
    return { ...base, type: 'wall', hp, maxHp: hp, speed: 0.70 + difficulty * 0.01, size: 46, xp: 26, contactDamage: 13, color: '#ff2a4b' };
  }
  return base;
};

// FIX: allow explicit spawn position so RAM chargers don’t stack/clamp into the same spot
const spawnMiniBoss = (player, difficulty, kind = 'charger', pos = null) => {
  const baseHp =
    (kind === 'charger' ? 4000 : 1400) +
    difficulty * (kind === 'charger' ? 360 : 160);

  const hp = Math.round(baseHp * MINI_HP_MULT * (kind === 'charger' ? RAM_HP_MULT : 1.0));

  const spawnX = pos?.x ?? Math.min(Math.max(player.x + 460, 120), ARENA_SIZE - 120);
  const spawnY = pos?.y ?? Math.min(Math.max(player.y - 380, 120), ARENA_SIZE - 120);

  const base = {
    id: `mini_${kind}_${Math.random()}`,
    type: `mini_${kind}`,
    x: spawnX,
    y: spawnY,
    hp,
    maxHp: hp,
    speed: kind === 'assassin' ? 2.75 : 2.15,
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
  const hpMult = meta.hpMult ?? 2.8;
  const size = meta.size ?? 52;

  const baseRot = Math.random() * Math.PI * 2;
  const out = [];

  for (let i = 0; i < ringN; i++) {
    const a = baseRot + (i / ringN) * Math.PI * 2;

    const enBase = spawnEnemy(difficulty, 'wall', t);
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
      wallCx: pp.x,
      wallCy: pp.y
    });
  }

  return out;
};

const spawnBoss = (player, difficulty) => {
  const hp = Math.round((5400 + difficulty * 220) * BOSS_HP_MULT);
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
            description: ownedWeapons.length >= 3 ? 'Adds final weapon slot (cap 4)' : 'Adds another weapon to your loadout',
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

  return picked.map((o) => {
    const { weight, key, ...rest } = o;
    return { ...rest, statsSnapshot: stats };
  });
};

export default function Combat({ crew, onExit, onVictory, tileDifficulty = 1, selectedHero }) {


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
    const runTimeRef = useRef(BOSS_TIME * (1.10 + Math.random() * 0.35));

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

  // power pickups
  const magnetUntil = useRef(0);
  const freezeUntil = useRef(0);
  const overdriveUntil = useRef(0);
  const shieldUntil = useRef(0);

  const selectingWeapon = selectedWeapons.length === 0;
  const paused = selectingWeapon || upgradeOptions.length > 0 || victory || defeat;

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

  const computeDifficulty = (eProg) => {
    const runT = getRunT();
    const t = clamp(eProg / runT, 0, 1);

    // Before 45%: normal ramp. After 45%: slower ramp so scaling doesn't brick runs.
    const earlyTicks = Math.floor((Math.min(eProg, runT * 0.45)) / 14000);
    const latePart = Math.max(0, eProg - runT * 0.45);
    const lateTicks = Math.floor(latePart / 20000); // faster late scaling (shorter run)
    return tileDifficulty + earlyTicks + lateTicks;
  };

  const buildBeatPlanIfNeeded = () => {
    if (beatPlanRef.current.ready) return;

    const beats = [];
    const r = (a, b) => a + Math.random() * (b - a);

    // Arc: frequent action, no empty mid/late.
    //  - events are shorter (see EVENT_DEFS) so we can schedule more of them.
    //  - ONLY RAM (mini_charger) as miniboss.
    const firstEventPct = r(0.10, 0.18);
    const firstMiniPct  = r(0.24, 0.32);
    const secondEventPct = r(0.36, 0.46);
    const midMiniPct     = r(0.50, 0.60);
    const thirdEventPct  = r(0.62, 0.74);
    const lateMiniPct    = r(0.70, 0.82);
    const fourthEventPct = r(0.80, 0.90);

    // Mostly swarms; walls are rarer "shape change" beats.
    const pickEventId = (swarmBias = 0.85) => (Math.random() < swarmBias ? 'SWARM' : 'WALL');

    beats.push({ kind: 'EVENT', atPct: firstEventPct, id: pickEventId(0.92) });
    beats.push({ kind: 'MINI', atPct: firstMiniPct, count: 2, mix: 'charger' });

    beats.push({ kind: 'EVENT', atPct: secondEventPct, id: pickEventId(0.88) });

    // Midgame: multiple rams WHILE trash keeps coming.
    beats.push({ kind: 'MINI', atPct: midMiniPct, count: 2 + Math.floor(Math.random() * 2), mix: 'charger' });

    beats.push({ kind: 'EVENT', atPct: thirdEventPct, id: 'SWARM' });

    // Late: 3–5 RAMs at once
    beats.push({ kind: 'MINI', atPct: lateMiniPct, count: 3 + Math.floor(Math.random() * 3), mix: 'charger' });

    beats.push({ kind: 'EVENT', atPct: fourthEventPct, id: pickEventId(0.86) });

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

    const pp = playerRef.current;
    enemiesRef.current = pruneEnemiesForRelief(enemiesRef.current || [], pp, 9);
  };

  const triggerReliefSoft = (ms = 2600, keepMax = 22) => {
    const now = Date.now();
    const wasActive = now < reliefUntilRef.current;
    if (!wasActive) reliefStartedAtRef.current = now;
    reliefUntilRef.current = Math.max(reliefUntilRef.current, now + ms);

    const pp = playerRef.current;
    enemiesRef.current = pruneEnemiesForRelief(enemiesRef.current || [], pp, keepMax);
  };

  const triggerReliefEmpty = (ms = 8200) => {
    const now = Date.now();
    const wasActive = now < reliefUntilRef.current;
    if (!wasActive) reliefStartedAtRef.current = now;
    reliefUntilRef.current = Math.max(reliefUntilRef.current, now + ms);

    // TRUE EMPTY RELIEF: delete all non-specials
    const prev = enemiesRef.current || [];
    enemiesRef.current = prev.filter((e) => e.type === 'boss' || String(e.type).startsWith('mini_') || e.type === 'wall');
  };

  const spawnMiniPack = (pp, difficulty, count) => {
    // Only RAMs (mini_charger). No assassins.
    return spawnRamsRing(pp, difficulty, count);
  };

  const scheduleBeats = () => {
    buildBeatPlanIfNeeded();

    const e = progElapsedRef.current;
    const runT = getRunT();
    const p = clamp(e / runT, 0, 1);
    const now = Date.now();

    // Don't schedule beats during boss fight (keeps it readable and reduces spike chaos)
    const bossAlive = (enemiesRef.current || []).some((x) => x.type === 'boss' && x.hp > 0);
    if (bossAlive) return;

    // End-of-event: auto-relief
    if (activeEventRef.current && now >= activeEventRef.current.endsAt) {
      activeEventRef.current = null;
      triggerReliefSoft(2100 + Math.floor(Math.random() * 900), 40); // short soft relief (keeps arena populated)
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
    if (Math.random() < 0.20) {
      const dur = 6500 + Math.floor(Math.random() * 2200);
      startEvent('SWARM', { duration: dur });
      randomSwarmCooldownUntilRef.current = now + 14000 + Math.floor(Math.random() * 11000);
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
        const safeArc = Math.PI * (0.50 + Math.random() * 0.16);
        const variant = Math.random() < 0.52 ? 'encircle' : 'three_sides';

        const dur = Math.round((EVENT_DEFS.SWARM.duration * (0.95 + Math.random() * 0.35)) * (p < 0.30 ? 1.15 : 1.0));
        if (startEvent('SWARM', { variant, safeAngle, safeArc, duration: dur })) {
          juicePunch(0.70, 0.70);
          plan.idx += 1;
          return;
        }
      }

      if (id === 'WALL') {
        const meta = {
          ringN: 26 + Math.floor(Math.random() * 10),
          radiusStart: 1850 + Math.floor(Math.random() * 450),
          encroachSpeed: 1.35 + Math.random() * 0.55,
          minRadius: 12,
          hpMult: 2.4 + Math.random() * 0.7,
          size: 52,
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

      // failed to start due to constraints, try next tick
      return;
    }

    if (beat.kind === 'MINI') {
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

    // Late-game stabilizers: slightly higher drop chance + more shield/freeze bias
    const base = source === 'boss' ? 0.35 : source === 'mini' ? 0.18 : 0.08;
    const chance = base * lerp(1.0, 1.55, late);
    if (Math.random() > chance) return;

    // Weighted roll (early: magnet/overdrive heavier; late: shield/freeze heavier)
    const wMag = lerp(0.32, 0.22, late);
    const wOvr = lerp(0.24, 0.20, late);
    const wShd = lerp(0.22, 0.30, late);
    const wFrz = lerp(0.22, 0.28, late);

    const total = wMag + wOvr + wShd + wFrz;
    let r = Math.random() * total;

    let type = 'MAGNET';
    if ((r -= wMag) <= 0) type = 'MAGNET';
    else if ((r -= wOvr) <= 0) type = 'OVERDRIVE';
    else if ((r -= wShd) <= 0) type = 'SHIELD';
    else type = 'FREEZE';

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

      // progression pauses while ANY event is active (SWARM/WALL)
      const eventActive = !!(activeEventRef.current && Date.now() < activeEventRef.current.endsAt);
      if (!eventActive) progElapsedRef.current += 16;

      if (elapsed.current % 160 === 0) {
        setProgress(Math.min(1, progElapsedRef.current / (runTimeRef.current || BOSS_TIME)));
      }

      // randomized beats
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

      const pPos = playerRef.current;
      const freezeWorld = Date.now() < freezeUntil.current;

      // -------------------- SPAWNING --------------------
      const runT = getRunT();
      const progT = getProgressT();
      const lateT = getLateT();

      const difficulty = computeDifficulty(progElapsedRef.current);

      const panicRamp = Math.pow(norm01(progT, 0.76, 1.0), 1.10); // progress-based endgame ramp (capped)
      const spawnIntervalBase = Math.max(190, 1250 - difficulty * 80 - panicRamp * 120);

      const inRelief = Date.now() < reliefUntilRef.current;
      const bossAlive = (enemiesRef.current || []).some((x) => x.type === 'boss' && x.hp > 0);

      // base: fewer enemies
      let spawnInterval = spawnIntervalBase * SPAWN_INTERVAL_MULT * (inRelief ? RELIEF_SPAWN_INTERVAL_MULT : 1.0);

      // late game: progressively fewer spawns
      spawnInterval *= lerp(1.0, LATE_SPAWN_INTERVAL_BOOST, lateT);

      // boss: MUCH fewer adds (and no events schedule while boss alive)
      if (bossAlive) spawnInterval *= BOSS_ADD_INTERVAL_MULT;

      // event modifiers
      if (isEventActive('SWARM')) spawnInterval *= 0.60;
      if (isEventActive('WALL')) spawnInterval *= 1.25; // allow trickle spawns during wall event

      let nextEnemies = [...enemiesRef.current];

      const nowSpawn = Date.now();
      const reliefHard = (nowSpawn < reliefUntilRef.current) && (nowSpawn - (reliefStartedAtRef.current || 0) < 1800);

      if (!freezeWorld && !reliefHard) {
        if (elapsed.current - lastSpawn.current > spawnInterval) {
          lastSpawn.current = elapsed.current;

          const countBase = Math.min(2 + Math.floor(difficulty / 2), 12);
          let count = Math.max(1, Math.round(countBase + panicRamp * 2));

          // late: scale count smoothly (negative LATE_SPAWN_COUNT_REDUCE increases count)
          count = Math.max(1, Math.round(count * lerp(1.0, 1.0 - LATE_SPAWN_COUNT_REDUCE, lateT)));

          // after 40%: keep the arena busy
          const after40 = norm01(progT, 0.40, 0.60);
          count = Math.max(1, Math.round(count * lerp(1.0, AFTER40_ENEMY_MULT, after40)));

          // boss: reduce count hard
          if (bossAlive) count = Math.max(1, Math.round(count * BOSS_ADD_COUNT_MULT));

          // soft cap late-game trash so density can't spiral (keeps difficulty high but fair)
          if (!bossAlive && progT > 0.68 && !isEventActive('WALL') && !isEventActive('SWARM')) {
            const isSpecial = (x) => x.type === 'boss' || String(x.type).startsWith('mini_') || x.type === 'wall';
            const trashCount = nextEnemies.filter((e) => !isSpecial(e)).length;
            const maxTrash = Math.round(lerp(110, 90, norm01(progT, 0.68, 1.0)));
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
            let swarmCount = Math.max(8, Math.round((18 + Math.floor(difficulty * 0.55)) * (1 / SPAWN_INTERVAL_MULT)));
            swarmCount = Math.max(8, Math.round(swarmCount * lerp(1.0, 1.18, lateT)));
            const after40s = norm01(progT, 0.40, 0.60);
            swarmCount = Math.max(8, Math.round(swarmCount * lerp(1.0, 1.20, after40s)));
            if (bossAlive) swarmCount = Math.max(6, Math.round(swarmCount * 0.70));

            // cap swarm spawns if we're already at/over late trash budget
            if (!bossAlive && progT > 0.68) {
              const isSpecial = (x) => x.type === 'boss' || String(x.type).startsWith('mini_') || x.type === 'wall';
              const trashCount = nextEnemies.filter((e) => !isSpecial(e)).length;
              const maxTrash = Math.round(lerp(125, 105, norm01(progT, 0.68, 1.0)));
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
            const n = wallTrickle ? Math.max(1, Math.round(count * 0.35)) : count;
            for (let i = 0; i < n; i += 1) nextEnemies.push(spawnEnemy(difficulty, null, progT));
          }
        }

        // boss spawn depends on progElapsedRef (paused during events)
        if (!bossSpawnedRef.current && progElapsedRef.current > (runTimeRef.current || BOSS_TIME)) {
          bossSpawnedRef.current = true;
          setBossSpawned(true);

          // boss intro relief: clear adds so it feels fair + satisfying
          triggerReliefSoft(2200 + Math.floor(Math.random() * 900), 34);

          nextEnemies.push(spawnBoss(pPos, difficulty));
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
          const dx = pPos.x - en.x;
          const dy = pPos.y - en.y;
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
        const dx = pPos.x - en.x;
        const dy = pPos.y - en.y;
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

          return { ...b, x: nx, y: ny, vx, vy, life: b.life - 16 };
        })
        .filter((b) => b.x > -140 && b.x < ARENA_SIZE + 140 && b.y > -140 && b.y < ARENA_SIZE + 140 && b.life > 0);

      // slashes update
      const movedSlashes = slashesRef.current
        .map((sl) => ({ ...sl, age: (sl.age || 0) + 16 }))
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
              beamHits.set(en.id, (beamHits.get(en.id) || 0) + bm.damage);

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

            if (b.explodeRadius && b.explodeMult) {
              explosionBursts.push({
                x: en.x,
                y: en.y,
                radius: b.explodeRadius,
                damage: dmgHit * b.explodeMult,
                slow: b.slow || 0,
                slowDuration: b.slowDuration || 0,
                stun: b.stun || 0,
                burn: b.burn || 0
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
                  const eliteMult2 = isEliteType(e2.type) ? (b.eliteDmgMult ?? 1) : 1;
                  bulletHits.set(e2.id, (bulletHits.get(e2.id) || 0) + (b.damage || 0) * eliteMult2 * 0.22);
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
        for (const burst of explosionBursts) {
          explosionsRef.current = [...(explosionsRef.current || []), { id: Math.random(), x: burst.x, y: burst.y, r: burst.radius, t: Date.now(), life: 260 }];
          for (const en of movedEnemies) {
            const d = Math.hypot(en.x - burst.x, en.y - burst.y);
            if (d <= burst.radius) {
              const fall = 1 - d / burst.radius;
              const dmg = burst.damage * Math.max(0.25, fall);
              bulletHits.set(en.id, (bulletHits.get(en.id) || 0) + dmg);

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
      const currentEnemies = movedEnemies;

      if (currentEnemies.length) {
        const overdrive = now3 < overdriveUntil.current;
        const overdriveMult = overdrive ? 1.5 : 1.0;

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
                glowBlur: pat.glowBlur,

                // NEW: rank 3-5 effects
                slow: pat.slow || 0,
                slowDuration: pat.slowDuration || 0,
                stun: pat.stun || 0,
                microFreeze: pat.microFreeze || 0,
                knockback: pat.knockback || 0
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
              lifeStart: wStats.lifeMs || (isSniper ? 900 : 1000),
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

              // Sniper fairness vs elites
              eliteDmgMult: wStats.eliteDmgMult || 1,

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

          // NEW: katana CC on hit (rank 3-5)
          const st = statusHits.get(en.id) || {};
          if (sl.slow) {
            st.slow = Math.max(st.slow || 0, sl.slow);
            st.slowDuration = Math.max(st.slowDuration || 0, sl.slowDuration || 780);
          }
          if (sl.microFreeze) st.stun = Math.max(st.stun || 0, sl.microFreeze);
          if (sl.stun) st.stun = Math.max(st.stun || 0, sl.stun);
          if (sl.knockback) st.knockback = Math.max(st.knockback || 0, sl.knockback);
          statusHits.set(en.id, st);
        });

        // VOID pull
        const pulls = movedBullets.filter((b) => {
          if (!b.pull) return false;
          if (Math.hypot(b.x - en.x, b.y - en.y) >= (b.pullRadius || 190)) return false;
          const dToPlayer = Math.hypot(b.x - pPos.x, b.y - pPos.y);
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

          // Void slow field support
          const bestSlow = voidFields.reduce((acc, b) => Math.max(acc, b.slow || 0), 0);
          const bestSlowDur = voidFields.reduce((acc, b) => Math.max(acc, b.slowDuration || 0), 0);
          if (bestSlow > 0 && en.type !== 'juggernaut' && !isBossy) {
            const st = statusHits.get(en.id) || {};
            st.slow = Math.max(st.slow || 0, bestSlow);
            st.slowDuration = Math.max(st.slowDuration || 0, bestSlowDur || 650);
            statusHits.set(en.id, st);
          }
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

        const isMini = String(out.type || '').startsWith('mini_');
        const isCharging = out.type === 'mini_charger' && ((out.windupUntil && Date.now() < out.windupUntil) || (out.dashUntil && Date.now() < out.dashUntil));

        // Don't let slow/knockback/stun trivialize RAM chargers while they're charging.
        if (st.slow && out.type !== 'juggernaut' && !(out.type === 'mini_charger')) {
          out.slowUntil = Date.now() + (st.slowDuration || 520);
          out.slowFactor = clamp(1 - st.slow, 0.45, 0.95);
        }

        if (st.stun && out.type !== 'juggernaut' && !isCharging) {
          const stunMs = isMini ? Math.min(st.stun, 180) : st.stun;
          out.stunnedUntil = Math.max(out.stunnedUntil || 0, Date.now() + stunMs);
        }

        if (st.knockback && !freezeWorld && out.type !== 'juggernaut' && !isMini) {
          const ang = Math.atan2(out.y - pPos.y, out.x - pPos.x);
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
              st.stun = Math.max(st.stun || 0, v.stun || 140);
              st.slow = Math.max(st.slow || 0, 0.18);
              st.slowDuration = Math.max(st.slowDuration || 0, 820);
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
        const pp2 = playerRef.current;
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
          const dx = pp2.x - o.x;
          const dy = pp2.y - o.y;
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
        xpRef.current = xpRef.current - xpTargetRef.current;
        levelRef.current = (levelRef.current || 1) + 1;

        // Slightly easier XP curve so you reach higher ranks by late game
        const t = getProgressT();
        const late = norm01(t, 0.45, 1.0);
        const growth = lerp(1.27, 1.20, late); // late: slower requirement increase
        xpTargetRef.current = Math.floor(xpTargetRef.current * growth);

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
          const d = Math.hypot(pPos.x - e.x, pPos.y - e.y);
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
          const pp2 = playerRef.current;
          alive.forEach((en) => {
            const d = Math.hypot(en.x - pp2.x, en.y - pp2.y);
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

    flagsRef.current = { reliefLock: false };
    activeEventRef.current = null;
    eventCooldownUntilRef.current = 0;
    reliefUntilRef.current = 0;
    reliefStartedAtRef.current = 0;

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
    // ✅ show selected hero portrait instead of the blue square
    backgroundImage: selectedHero?.portrait ? `url(${selectedHero.portrait})` : undefined,
    backgroundSize: selectedHero?.portrait ? "cover" : undefined,
    backgroundPosition: selectedHero?.portrait ? "center" : undefined,
    backgroundRepeat: selectedHero?.portrait ? "no-repeat" : undefined,
    backgroundColor: selectedHero?.portrait ? "transparent" : undefined,

    boxShadow: showShield
      ? "0 0 16px rgba(120,220,255,0.75), 0 0 36px rgba(120,220,255,0.55)"
      : undefined,
    filter: showOverdrive ? "brightness(1.15) saturate(1.2)" : undefined,
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

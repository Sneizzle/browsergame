// Combat.jsx (FULL FILE - COPY/PASTE)
// Fixes: illegal hooks, duplicated hitFx, katana visuals, SMG strength/targeting, cleaner VFX.

import React, { useEffect, useMemo, useRef, useState } from 'react';

const ARENA_SIZE = 2000;
const BOSS_TIME = 140000;

// ---------- angle helpers ----------
const normAngle = a => {
  let x = a;
  while (x <= -Math.PI) x += Math.PI * 2;
  while (x > Math.PI) x -= Math.PI * 2;
  return x;
};
const angleDiff = (a, b) => Math.abs(normAngle(a - b));
const withinArc = (centerAngle, arcSize, enemyAngle) => angleDiff(enemyAngle, centerAngle) <= arcSize / 2;

const WEAPONS = [
  {
    id: 'RIFLE',
    name: 'Rifle',
    targeting: 'closest',
    color: '#e9f7ff',
    levels: [
      { title: 'Rifle I', description: 'Single precision shot.', stats: { cooldown: 520, bulletSpeed: 15.5, damage: 11, pellets: 1, spread: 0.06, width: 12, height: 4, pierce: 0 } },
      { title: 'Rifle II', description: 'Tighter cadence.', stats: { cooldown: 490, damage: 13 } },
      { title: 'Rifle III', description: 'Two-round burst.', stats: { pellets: 2, spread: 0.10, damage: 12, pierce: 1 } },
      { title: 'Rifle IV', description: 'Piercing calibration.', stats: { pierce: 2, damage: 14 } },
      { title: 'Rifle V', description: 'Triple fan burst.', stats: { pellets: 3, spread: 0.18, damage: 13, pierce: 3 } }
    ]
  },

  // =========================
  // KATANA: REAL SWORD CUTS
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
          slashPattern: [
            // single sharp directional crescent
            { delay: 0, offset: 0.00, arc: Math.PI * 0.34, kind: 'crescent', dmgMult: 1.0 }
          ]
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
            { delay: 0, offset: 0.00, arc: Math.PI * 0.34, kind: 'crescent', dmgMult: 1.0 },
            // zig: two tight slashes that feel like a “Z” flick
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
            // keep crescent + zig package
            { delay: 0, offset: 0.00, arc: Math.PI * 0.34, kind: 'crescent', dmgMult: 1.0 },
            { delay: 0, offset: +0.55, arc: Math.PI * 0.24, kind: 'zig', dmgMult: 0.75 },
            { delay: 70, offset: -0.35, arc: Math.PI * 0.22, kind: 'zig', dmgMult: 0.70 },

            // spin trio (low dmg each, huge feel)
            { delay: 0, offset: 0.00, arc: Math.PI * 0.42, kind: 'spin', dmgMult: 0.55 },
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
            { delay: 0, offset: 0.00, arc: Math.PI * 0.38, kind: 'crescent', dmgMult: 1.0 },
            { delay: 0, offset: +0.60, arc: Math.PI * 0.26, kind: 'zig', dmgMult: 0.75 },
            { delay: 60, offset: -0.40, arc: Math.PI * 0.24, kind: 'zig', dmgMult: 0.70 },
            { delay: 0, offset: 0.00, arc: Math.PI * 0.46, kind: 'spin', dmgMult: 0.58 },
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
            { delay: 0, offset: 0.00, arc: Math.PI * 0.40, kind: 'crescent', dmgMult: 1.0 },
            { delay: 0, offset: +0.62, arc: Math.PI * 0.28, kind: 'zig', dmgMult: 0.78 },
            { delay: 55, offset: -0.42, arc: Math.PI * 0.26, kind: 'zig', dmgMult: 0.72 },

            // spin
            { delay: 0, offset: 0.00, arc: Math.PI * 0.50, kind: 'spin', dmgMult: 0.62 },
            { delay: 75, offset: 2.10, arc: Math.PI * 0.50, kind: 'spin', dmgMult: 0.62 },
            { delay: 150, offset: 4.20, arc: Math.PI * 0.50, kind: 'spin', dmgMult: 0.62 },

            // extra “follow-through” crescents (big feel, modest dmg)
            { delay: 120, offset: +0.25, arc: Math.PI * 0.34, kind: 'crescent', dmgMult: 0.55 },
            { delay: 180, offset: -0.25, arc: Math.PI * 0.34, kind: 'crescent', dmgMult: 0.55 }
          ]
        }
      }
    ]
  },

  {
    id: 'SMG',
    name: 'SMG',
    targeting: 'closest', // ✅ FIX: closest, not random
    color: '#ffe58f',
    levels: [
      // ✅ FIX: lvl1 no longer trash
      { title: 'SMG I', description: 'Close target bursts.', stats: { cooldown: 120, bulletSpeed: 17, damage: 7, pellets: 1, spread: 0.22, width: 10, height: 4, pierce: 0 } },
      { title: 'SMG II', description: 'Improved control.', stats: { cooldown: 110, damage: 8, spread: 0.20 } },
      { title: 'SMG III', description: 'Double burst.', stats: { pellets: 2, spread: 0.28, damage: 6 } },
      { title: 'SMG IV', description: 'Rattle fire.', stats: { cooldown: 98, damage: 7 } },
      { title: 'SMG V', description: 'Wide triple spray.', stats: { pellets: 3, spread: 0.40, damage: 6 } }
    ]
  },

  {
    id: 'SHOTGUN',
    name: 'Shotgun',
    targeting: 'closest',
    color: '#ffd36b',
    levels: [
      { title: 'Shotgun I', description: 'Close arc blast.', stats: { cooldown: 900, bulletSpeed: 13, damage: 9, pellets: 6, spread: 0.70, width: 14, height: 5, pierce: 0 } },
      { title: 'Shotgun II', description: 'Denser spread.', stats: { pellets: 7, damage: 9 } },
      { title: 'Shotgun III', description: 'Shrapnel punch.', stats: { pellets: 8, damage: 9 } },
      { title: 'Shotgun IV', description: 'High density surge.', stats: { pellets: 9, spread: 0.78, damage: 10 } },
      { title: 'Shotgun V', description: 'Meteor cluster.', stats: { pellets: 12, spread: 0.90, damage: 10 } }
    ]
  },

  {
    id: 'LASER',
    name: 'Laser',
    targeting: 'closest',
    color: '#ff8ef6',
    levels: [
      { title: 'Laser I', description: 'Focused beam shot.', stats: { cooldown: 1100, bulletSpeed: 18, damage: 20, pellets: 1, spread: 0.04, width: 16, height: 4, pierce: 0 } },
      { title: 'Laser II', description: 'Amplified pulse.', stats: { damage: 24 } },
      { title: 'Laser III', description: 'Twin pulses.', stats: { pellets: 2, spread: 0.08, damage: 22 } },
      { title: 'Laser IV', description: 'Overcharged arc.', stats: { cooldown: 980, damage: 28 } },
      { title: 'Laser V', description: 'Tri-beam burst.', stats: { pellets: 3, spread: 0.12, damage: 26 } }
    ]
  },

  {
    id: 'SNIPER',
    name: 'Sniper',
    targeting: 'closest',
    color: '#8fffef',
    levels: [
      { title: 'Sniper I', description: 'Slow, piercing shot.', stats: { cooldown: 1650, bulletSpeed: 22, damage: 65, pellets: 1, spread: 0.02, width: 24, height: 6, pierce: 2, flashy: true } },
      { title: 'Sniper II', description: 'Improved charge pack.', stats: { damage: 80 } },
      { title: 'Sniper III', description: 'Rail density.', stats: { pierce: 3, damage: 90 } },
      { title: 'Sniper IV', description: 'Faster cycling.', stats: { cooldown: 1450, damage: 105 } },
      { title: 'Sniper V', description: 'Voltaic lance.', stats: { damage: 130, pierce: 4 } }
    ]
  }
];

const UPGRADES = [
  { id: 'REGEN', title: 'Nanite Regen', description: '+0.35 HP/sec', apply: s => ({ ...s, regen: s.regen + 0.35 }) },
  { id: 'MAX_HP', title: 'Reinforced Plating', description: '+30 Max HP', apply: s => ({ ...s, maxHp: s.maxHp + 30, hp: s.hp + 30 }) },
  { id: 'DAMAGE', title: 'Damage Boost', description: '+10% damage', apply: s => ({ ...s, damageMult: s.damageMult * 1.1 }) },
  { id: 'ATTACK_SPEED', title: 'Attack Speed', description: '+10% rate', apply: s => ({ ...s, attackSpeed: s.attackSpeed * 1.1 }) },
  { id: 'MOVE_SPEED', title: 'Kinetic Thrusters', description: '+8% move speed', apply: s => ({ ...s, moveSpeed: (s.moveSpeed || 1) * 1.08 }) }
];

const spawnEnemy = (difficulty) => {
  const side = Math.floor(Math.random() * 4);
  const margin = 20;
  const edgeX = Math.random() * (ARENA_SIZE - margin * 2) + margin;
  const edgeY = Math.random() * (ARENA_SIZE - margin * 2) + margin;
  const x = side === 0 ? margin : side === 1 ? ARENA_SIZE - margin : edgeX;
  const y = side === 2 ? margin : side === 3 ? ARENA_SIZE - margin : edgeY;

  const roll = Math.random();
  if (roll > 0.92) {
    return { id: Math.random(), type: 'brute', x, y, hp: 120 + difficulty * 14, maxHp: 120 + difficulty * 14, speed: 1.1 + difficulty * 0.04, size: 52, xp: 24, contactDamage: 16, color: '#ff6b6b' };
  }
  if (roll > 0.7) {
    return { id: Math.random(), type: 'sprinter', x, y, hp: 30 + difficulty * 5, maxHp: 30 + difficulty * 5, speed: 3.1 + difficulty * 0.1, size: 22, xp: 12, contactDamage: 10, color: '#ff2fd2' };
  }
  return { id: Math.random(), type: 'grunt', x, y, hp: 55 + difficulty * 9, maxHp: 55 + difficulty * 9, speed: 1.9 + difficulty * 0.06, size: 28, xp: 14, contactDamage: 12, color: '#ff007a' };
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
  xp: 320,
  contactDamage: 28,
  color: '#ffda6b'
});

const buildWeaponStats = (weapon, level) =>
  weapon.levels.slice(0, level).reduce((acc, entry) => ({ ...acc, ...entry.stats }), {});

const rollUpgradeOptions = (ownedWeapons, weaponLevels, stats) => {
  const upgrades = [...UPGRADES].map(u => ({ ...u }));
  const unowned = WEAPONS.filter(w => !ownedWeapons.includes(w.id));

  if (unowned.length) {
    const weaponPick = unowned[Math.floor(Math.random() * unowned.length)];
    upgrades.push({
      id: `WEAPON_${weaponPick.id}`,
      title: `New Weapon: ${weaponPick.name}`,
      description: 'Adds another weapon to your loadout',
      weaponId: weaponPick.id,
      apply: s => ({ ...s })
    });
  }

  ownedWeapons.forEach(id => {
    const level = weaponLevels[id] || 1;
    if (level < 5) {
      const weapon = WEAPONS.find(w => w.id === id);
      const nextLevel = level + 1;
      upgrades.push({
        id: `UP_${id}_${nextLevel}`,
        title: `${weapon.name} Level ${nextLevel}`,
        description: weapon.levels[nextLevel - 1].description,
        weaponId: id,
        upgradeLevel: nextLevel,
        apply: s => ({ ...s })
      });
    }
  });

  const picks = [];
  while (picks.length < 3 && upgrades.length) {
    const idx = Math.floor(Math.random() * upgrades.length);
    picks.push(upgrades.splice(idx, 1)[0]);
  }
  if (picks.length < 3) {
    picks.push({ id: 'HEAL', title: 'Repair Kit', description: 'Restore 40 HP', apply: s => ({ ...s, hp: Math.min(s.maxHp, s.hp + 40) }) });
  }
  return picks.map(option => ({ ...option, statsSnapshot: stats }));
};

const mergeOrbs = (orbs) => {
  const merged = [];
  orbs.forEach(o => {
    const target = merged.find(m => Math.hypot(m.x - o.x, m.y - o.y) < 20);
    if (target) {
      target.value += o.value;
      target.x = (target.x + o.x) / 2;
      target.y = (target.y + o.y) / 2;
    } else {
      merged.push({ ...o });
    }
  });
  return merged;
};

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export default function Combat({ crew, onExit, onVictory, tileDifficulty = 1 }) {
  const [player, setPlayer] = useState({ x: 1000, y: 1000 });
  const [stats, setStats] = useState({ hp: 120, maxHp: 120, regen: 0, damageMult: 1, attackSpeed: 1, moveSpeed: 1 });
  const [camera, setCamera] = useState({ x: 0, y: 0 });

  const [enemies, setEnemies] = useState([]);
  const [bullets, setBullets] = useState([]);
  const [slashes, setSlashes] = useState([]);
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

  // ✅ ONLY ONE hitFx state, INSIDE component
  const [hitFx, setHitFx] = useState({});
  const [deathFx, setDeathFx] = useState([]);

  const keys = useRef({});
  const lastFire = useRef({});
  const lastSpawn = useRef(0);
  const elapsed = useRef(0);
  const lastDamage = useRef(0);

  const paused = upgradeOptions.length > 0 || victory || defeat;

  // ---- refs to avoid stale state inside interval ----
  const pausedRef = useRef(paused);
  const playerRef = useRef(player);
  const statsRef = useRef(stats);
  const enemiesRef = useRef(enemies);
  const bulletsRef = useRef(bullets);
  const slashesRef = useRef(slashes);
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
  useEffect(() => { orbsRef.current = orbs; }, [orbs]);
  useEffect(() => { xpRef.current = xp; }, [xp]);
  useEffect(() => { xpTargetRef.current = xpTarget; }, [xpTarget]);
  useEffect(() => { selectedWeaponsRef.current = selectedWeapons; }, [selectedWeapons]);
  useEffect(() => { weaponLevelsRef.current = weaponLevels; }, [weaponLevels]);
  useEffect(() => { bossSpawnedRef.current = bossSpawned; }, [bossSpawned]);

  const weaponChoices = useMemo(() => WEAPONS, []);
  const crewDamageMult = useMemo(() => crew.reduce((acc, c) => acc * c.trait.dmg, 1), [crew]);
  const crewSpeedMult = useMemo(() => crew.reduce((acc, c) => acc * c.trait.spd, 1), [crew]);

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
    const handleKey = e => { keys.current[e.key.toLowerCase()] = e.type === 'keydown'; };
    window.addEventListener('keydown', handleKey);
    window.addEventListener('keyup', handleKey);
    return () => {
      window.removeEventListener('keydown', handleKey);
      window.removeEventListener('keyup', handleKey);
    };
  }, []);

  useEffect(() => {
    if (!selectedWeapons.length) return;

    const loop = setInterval(() => {
      if (pausedRef.current) return;

      elapsed.current += 16;
      setProgress(Math.min(1, elapsed.current / BOSS_TIME));

      // decay death fx
      setDeathFx(fx => fx.filter(f => Date.now() - f.t < 260));

      // regen
      if (statsRef.current.regen > 0) {
        setStats(prev => ({ ...prev, hp: Math.min(prev.maxHp, prev.hp + prev.regen * 0.016) }));
      }

      // move player + camera
      setPlayer(prev => {
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

      const p = playerRef.current;

      // Enemy spawn
      const difficulty = tileDifficulty + Math.floor(elapsed.current / 20000);
      const spawnInterval = Math.max(200, 1500 - difficulty * 90);

      let nextEnemies = [...enemiesRef.current];

      if (elapsed.current - lastSpawn.current > spawnInterval) {
        lastSpawn.current = elapsed.current;
        const count = Math.min(2 + Math.floor(difficulty / 2), 12);
        for (let i = 0; i < count; i += 1) nextEnemies.push(spawnEnemy(difficulty));
      }

      if (!bossSpawnedRef.current && elapsed.current > BOSS_TIME) {
        bossSpawnedRef.current = true;
        setBossSpawned(true);
        nextEnemies.push(spawnBoss(p));
      }

      // move enemies
      const movedEnemies = nextEnemies.map(en => {
        const dx = p.x - en.x;
        const dy = p.y - en.y;
        const dist = Math.hypot(dx, dy) || 1;
        return { ...en, x: en.x + (dx / dist) * en.speed, y: en.y + (dy / dist) * en.speed };
      });

      // bullets
      const movedBullets = bulletsRef.current
        .map(b => ({ ...b, x: b.x + b.vx, y: b.y + b.vy, life: b.life - 16 }))
        .filter(b => b.x > 0 && b.x < ARENA_SIZE && b.y > 0 && b.y < ARENA_SIZE && b.life > 0);

      // slashes (age-based for delayed hits)
      const movedSlashes = slashesRef.current
        .map(sl => ({ ...sl, age: (sl.age || 0) + 16 }))
        .filter(sl => (sl.age || 0) <= sl.life);

      // bullet hits (pierce)
      const bulletHits = new Map();
      const nextBullets = movedBullets.map(b => ({ ...b }));

      nextBullets.forEach(b => {
        if (b.hit) return;
        movedEnemies.forEach(en => {
          if (b.hit) return;
          const dist = Math.hypot(b.x - en.x, b.y - en.y);
          if (dist < en.size * 0.7) {
            bulletHits.set(en.id, (bulletHits.get(en.id) || 0) + b.damage);
            b.pierce = (b.pierce ?? 0) - 1;
            if (b.pierce < 0) b.hit = true;
          }
        });
      });

      // apply damage (bullets + sword arcs)
      const withDamage = movedEnemies.map(en => {
        let totalDamage = bulletHits.get(en.id) || 0;

        movedSlashes.forEach(sl => {
          const activeStart = sl.delay || 0;
          const activeEnd = activeStart + (sl.activeMs || 120);
          if ((sl.age || 0) < activeStart || (sl.age || 0) > activeEnd) return;

          const dist = Math.hypot(en.x - sl.x, en.y - sl.y);
          if (dist > sl.range) return;

          const enemyAngle = Math.atan2(en.y - sl.y, en.x - sl.x);
          if (!withinArc(sl.angle, sl.arc, enemyAngle)) return;

          totalDamage += sl.damage;
        });

        if (totalDamage > 0) {
          setHitFx(prev => ({ ...prev, [en.id]: Date.now() }));
          return { ...en, hp: en.hp - totalDamage };
        }
        return en;
      });

      // deaths -> orbs + death pop
      const alive = [];
      const newOrbs = [];
      withDamage.forEach(en => {
        if (en.hp > 0) {
          alive.push(en);
        } else {
          setDeathFx(fx => [...fx, { id: Math.random(), x: en.x, y: en.y, t: Date.now(), size: en.size }]);
          const orbCount = Math.max(1, Math.round(en.xp / 10));
          for (let i = 0; i < orbCount; i += 1) {
            newOrbs.push({
              id: Math.random(),
              x: en.x + (Math.random() - 0.5) * 30,
              y: en.y + (Math.random() - 0.5) * 30,
              value: Math.ceil(en.xp / orbCount)
            });
          }
          if (en.type === 'boss') setVictory(true);
        }
      });

      setEnemies(alive);
      setBullets(nextBullets.filter(b => !b.hit));
      setSlashes(movedSlashes);
      if (newOrbs.length) setOrbs(prev => [...prev, ...newOrbs]);

      // orbs: attract + merge + pickup
      setOrbs(prev => {
        const pp = playerRef.current;
        const drifted = prev.map(o => {
          const dx = pp.x - o.x;
          const dy = pp.y - o.y;
          const dist = Math.hypot(dx, dy);
          if (dist > 0 && dist < 110) {
            return { ...o, x: o.x + (dx / dist) * 2.6, y: o.y + (dy / dist) * 2.6 };
          }
          return o;
        });

        const merged = mergeOrbs(drifted);

        const kept = [];
        let gained = 0;
        merged.forEach(o => {
          const dist = Math.hypot(o.x - pp.x, o.y - pp.y);
          if (dist < 34) gained += o.value;
          else kept.push(o);
        });

        if (gained > 0) setXp(x => x + gained);
        return kept;
      });

      // level up
      if (xpRef.current >= xpTargetRef.current) {
        setXp(x => x - xpTargetRef.current);
        setLevel(l => l + 1);
        setXpTarget(t => Math.floor(t * 1.4));
        setUpgradeOptions(rollUpgradeOptions(selectedWeaponsRef.current, weaponLevelsRef.current, statsRef.current));
      }

      // contact damage
      const now = Date.now();
      if (now - lastDamage.current > 260) {
        let totalDamage = 0;
        const pp = playerRef.current;
        alive.forEach(en => {
          const dist = Math.hypot(en.x - pp.x, en.y - pp.y);
          if (dist < en.size * 0.55 + 16) totalDamage += en.contactDamage || 8;
        });
        if (totalDamage > 0) {
          lastDamage.current = now;
          setStats(prev => ({ ...prev, hp: Math.max(0, prev.hp - totalDamage) }));
        }
      }

      // firing
      const now2 = Date.now();
      const pp = playerRef.current;
      const currentEnemies = alive;
      if (!currentEnemies.length) return;

      selectedWeaponsRef.current.forEach(id => {
        const weapon = WEAPONS.find(w => w.id === id);
        if (!weapon) return;

        const lvl = weaponLevelsRef.current[id] || 1;
        const wStats = buildWeaponStats(weapon, lvl);

        const last = lastFire.current[id] || 0;
        const fireCooldown = (wStats.cooldown || 600) / (statsRef.current.attackSpeed || 1);
        if (now2 - last < fireCooldown) return;
        lastFire.current[id] = now2;

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

        if (weapon.id === 'KATANA') {
          const pattern = (wStats.slashPattern && wStats.slashPattern.length)
            ? wStats.slashPattern
            : [{ delay: 0, offset: 0, arc: Math.PI * 0.34, kind: 'crescent', dmgMult: 1 }];

          const baseDamage = (wStats.damage || 10) * (statsRef.current.damageMult || 1) * crewDamageMult;
          const baseRange = wStats.range || 165;

          const toAdd = pattern.map(pat => {
            const dmg = baseDamage * (pat.dmgMult || 1);
            const arc = pat.arc || Math.PI * 0.34;
            const delay = pat.delay || 0;

            const activeMs =
              pat.kind === 'zig' ? 90 :
              pat.kind === 'spin' ? 120 :
              120;

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

          setSlashes(prev => [...prev, ...toAdd]);
        } else {
          const pellets = wStats.pellets || 1;
          const next = [];
          for (let i = 0; i < pellets; i += 1) {
            const spread = (Math.random() - 0.5) * (wStats.spread || 0);
            const a = baseAngle + spread;
            next.push({
              id: Math.random(),
              x: pp.x,
              y: pp.y,
              vx: Math.cos(a) * wStats.bulletSpeed,
              vy: Math.sin(a) * wStats.bulletSpeed,
              damage: (wStats.damage || 1) * (statsRef.current.damageMult || 1) * crewDamageMult,
              color: weapon.color,
              life: 1000,
              width: wStats.width,
              height: wStats.height,
              pierce: wStats.pierce ?? 0,
              flashy: wStats.flashy
            });
          }
          setBullets(prev => [...prev, ...next]);
        }
      });
    }, 16);

    return () => clearInterval(loop);
  }, [crew, selectedWeapons.length, tileDifficulty, crewDamageMult, crewSpeedMult]);

  const chooseUpgrade = option => {
    setStats(s => option.apply(s));
    if (option.weaponId) {
      if (option.upgradeLevel) {
        setWeaponLevels(levels => ({ ...levels, [option.weaponId]: option.upgradeLevel }));
      } else {
        setSelectedWeapons(w => [...w, option.weaponId]);
        setWeaponLevels(levels => ({ ...levels, [option.weaponId]: 1 }));
      }
    }
    setUpgradeOptions([]);
  };

  const selectWeapon = weaponId => {
    setSelectedWeapons([weaponId]);
    setWeaponLevels({ [weaponId]: 1 });
  };

  return (
    <div className="combat-world">
      {!selectedWeapons.length && (
        <div className="ui-layer" style={{ background: 'rgba(0,0,0,0.95)' }}>
          <h1>SELECT TECH</h1>
          <div className="weapon-grid">
            {weaponChoices.map(w => (
              <button key={w.id} className="weapon-card" onClick={() => selectWeapon(w.id)}>
                <span>{w.name}</span>
                <small>{w.id === 'KATANA' ? 'Directional sword cuts' : 'Ranged weapon'}</small>
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

      <div className="world-container" style={{ transform: `translate(${-camera.x}px,${-camera.y}px)` }}>
        <div className="world-border" />
        <div className="player-tracer" style={{ left: player.x - 60, top: player.y - 60 }} />
        <div className="player-sprite" style={{ left: player.x, top: player.y }} />

        {/* death pop */}
        {deathFx.map(f => (
          <div
            key={f.id}
            className="death-pop"
            style={{ left: f.x, top: f.y, width: f.size * 1.6, height: f.size * 1.6 }}
          />
        ))}

        {/* katana arcs */}
        {slashes.map(s => {
          const size = Math.max(200, s.range * 2);
          const visible = (s.age || 0) >= (s.delay || 0);
          const arcSize = s.arc || (Math.PI * 0.34);
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

        {bullets.map(b => (
          <div
            key={b.id}
            className={`bullet ${b.flashy ? 'sniper' : ''}`}
            style={{ left: b.x, top: b.y, background: b.color, width: b.width, height: b.height }}
          />
        ))}

        {orbs.map(o => (
          <div
            key={o.id}
            className="xp-orb"
            style={{
              left: o.x,
              top: o.y,
              width: 10 + Math.min(34, Math.sqrt(o.value) * 5),
              height: 10 + Math.min(34, Math.sqrt(o.value) * 5),
              background: o.value >= 20 ? 'rgba(255, 80, 80, 0.95)' : 'rgba(0, 255, 160, 0.9)',
              boxShadow: o.value >= 20
                ? '0 0 12px rgba(255, 80, 80, 0.9), 0 0 28px rgba(255, 80, 80, 0.7)'
                : '0 0 12px rgba(0, 255, 160, 0.9), 0 0 28px rgba(0, 255, 160, 0.7)'
            }}
          />
        ))}

        {enemies.map(e => {
          const t = hitFx[e.id] || 0;
          const recentlyHit = Date.now() - t < 85;
          return (
            <div
              key={e.id}
              className={`enemy-sprite ${e.type} ${recentlyHit ? 'hit' : ''}`}
              style={{ left: e.x, top: e.y, width: e.size, height: e.size, background: e.color }}
            />
          );
        })}
      </div>

      {upgradeOptions.length > 0 && (
        <div className="ui-layer" style={{ background: 'rgba(1,2,6,0.92)' }}>
          <h1>CHOOSE UPGRADE</h1>
          <div className="upgrade-grid">
            {upgradeOptions.map(option => (
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

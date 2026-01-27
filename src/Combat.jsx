import React, { useEffect, useMemo, useRef, useState } from 'react';

const ARENA_SIZE = 2000;
const BOSS_TIME = 140000;

const WEAPONS = [
  {
    id: 'RIFLE',
    name: 'Rifle',
    targeting: 'closest',
    color: '#e9f7ff',
    levels: [
      { title: 'Rifle I', description: 'Single precision shot.', stats: { cooldown: 560, bulletSpeed: 15, damage: 9, pellets: 1, spread: 0.08, width: 12, height: 4, pierce: 0 } },
      { title: 'Rifle II', description: 'Tighter burst cadence.', stats: { cooldown: 520, damage: 11 } },
      { title: 'Rifle III', description: 'Two-round burst.', stats: { pellets: 2, spread: 0.14, damage: 10 } },
      { title: 'Rifle IV', description: 'Piercing calibration.', stats: { pierce: 1, damage: 13 } },
      { title: 'Rifle V', description: 'Triple fan burst.', stats: { pellets: 3, spread: 0.22, damage: 12 } }
    ]
  },
  {
    id: 'KATANA',
    name: 'Katana',
    targeting: 'closest',
    color: '#8efaff',
    levels: [
      { title: 'Katana I', description: 'Single arc slash.', stats: { cooldown: 820, damage: 20, range: 135, slashCount: 1 } },
      { title: 'Katana II', description: 'Twin patterned slashes.', stats: { slashCount: 2, damage: 22 } },
      { title: 'Katana III', description: 'Extended arc reach.', stats: { range: 165, damage: 24 } },
      { title: 'Katana IV', description: 'Triple spin strike.', stats: { slashCount: 3, damage: 26 } },
      { title: 'Katana V', description: 'Rifted dual ring.', stats: { slashCount: 4, range: 190, damage: 30 } }
    ]
  },
  {
    id: 'SMG',
    name: 'SMG',
    targeting: 'random',
    color: '#ffe58f',
    levels: [
      { title: 'SMG I', description: 'Short random bursts.', stats: { cooldown: 170, bulletSpeed: 16, damage: 5, pellets: 1, spread: 0.32, width: 10, height: 4, pierce: 0 } },
      { title: 'SMG II', description: 'Improved control.', stats: { cooldown: 150, damage: 6 } },
      { title: 'SMG III', description: 'Double burst.', stats: { pellets: 2, spread: 0.38, damage: 5 } },
      { title: 'SMG IV', description: 'Rattle fire.', stats: { cooldown: 130, damage: 6 } },
      { title: 'SMG V', description: 'Wide strafing spray.', stats: { pellets: 3, spread: 0.46, damage: 6 } }
    ]
  },
  {
    id: 'SHOTGUN',
    name: 'Shotgun',
    targeting: 'random',
    color: '#ffd36b',
    levels: [
      { title: 'Shotgun I', description: 'Close arc blast.', stats: { cooldown: 980, bulletSpeed: 13, damage: 7, pellets: 5, spread: 0.72, width: 14, height: 5, pierce: 0 } },
      { title: 'Shotgun II', description: 'Denser spread.', stats: { pellets: 6, damage: 7 } },
      { title: 'Shotgun III', description: 'Shrapnel punch.', stats: { pellets: 7, damage: 8 } },
      { title: 'Shotgun IV', description: 'High density surge.', stats: { pellets: 8, spread: 0.78, damage: 8 } },
      { title: 'Shotgun V', description: 'Meteor cluster.', stats: { pellets: 10, spread: 0.9, damage: 9 } }
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
  {
    id: 'REGEN',
    title: 'Nanite Regen',
    description: '+0.35 HP/sec',
    apply: stats => ({ ...stats, regen: stats.regen + 0.35 })
  },
  {
    id: 'MAX_HP',
    title: 'Reinforced Plating',
    description: '+30 Max HP',
    apply: stats => ({ ...stats, maxHp: stats.maxHp + 30, hp: stats.hp + 30 })
  },
  {
    id: 'DAMAGE',
    title: 'Damage Boost',
    description: '+10% damage',
    apply: stats => ({ ...stats, damageMult: stats.damageMult * 1.1 })
  },
  {
    id: 'ATTACK_SPEED',
    title: 'Attack Speed',
    description: '+10% rate',
    apply: stats => ({ ...stats, attackSpeed: stats.attackSpeed * 1.1 })
  },
  {
    id: 'MOVE_SPEED',
    title: 'Kinetic Thrusters',
    description: '+8% move speed',
    apply: stats => ({ ...stats, moveSpeed: stats.moveSpeed * 1.08 })
  }
];

const spawnEnemy = (player, difficulty) => {
  const side = Math.floor(Math.random() * 4);
  const margin = 20;
  const edgeX = Math.random() * (ARENA_SIZE - margin * 2) + margin;
  const edgeY = Math.random() * (ARENA_SIZE - margin * 2) + margin;
  const x = side === 0 ? margin : side === 1 ? ARENA_SIZE - margin : edgeX;
  const y = side === 2 ? margin : side === 3 ? ARENA_SIZE - margin : edgeY;
  const roll = Math.random();
  if (roll > 0.92) {
    return {
      id: Math.random(),
      type: 'brute',
      x,
      y,
      hp: 120 + difficulty * 14,
      maxHp: 120 + difficulty * 14,
      speed: 1.1 + difficulty * 0.04,
      size: 52,
      xp: 24,
      contactDamage: 16,
      color: '#ff6b6b'
    };
  }
  if (roll > 0.7) {
    return {
      id: Math.random(),
      type: 'sprinter',
      x,
      y,
      hp: 30 + difficulty * 5,
      maxHp: 30 + difficulty * 5,
      speed: 3.1 + difficulty * 0.1,
      size: 22,
      xp: 12,
      contactDamage: 10,
      color: '#ff2fd2'
    };
  }
  return {
    id: Math.random(),
    type: 'grunt',
    x,
    y,
    hp: 55 + difficulty * 9,
    maxHp: 55 + difficulty * 9,
    speed: 1.9 + difficulty * 0.06,
    size: 28,
    xp: 14,
    contactDamage: 12,
    color: '#ff007a'
  };
};

const spawnBoss = player => ({
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

const buildWeaponStats = (weapon, level) => {
  return weapon.levels
    .slice(0, level)
    .reduce((acc, entry) => ({ ...acc, ...entry.stats }), {});
};

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
    picks.push({
      id: 'HEAL',
      title: 'Repair Kit',
      description: 'Restore 40 HP',
      apply: s => ({ ...s, hp: Math.min(s.maxHp, s.hp + 40) })
    });
  }
  return picks.map(option => ({ ...option, statsSnapshot: stats }));
};

const mergeOrbs = orbs => {
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

  const keys = useRef({});
  const lastFire = useRef({});
  const lastSpawn = useRef(0);
  const elapsed = useRef(0);
  const lastDamage = useRef(0);
  const paused = upgradeOptions.length > 0 || victory || defeat;

  const weaponChoices = useMemo(() => WEAPONS, []);
  const crewDamageMult = useMemo(() => crew.reduce((acc, c) => acc * c.trait.dmg, 1), [crew]);

  useEffect(() => {
    if (victory) {
      const timer = setTimeout(() => onVictory(), 1800);
      return () => clearTimeout(timer);
    }
  }, [victory, onVictory]);

  useEffect(() => {
    if (defeat) {
      const timer = setTimeout(() => onExit(), 1800);
      return () => clearTimeout(timer);
    }
  }, [defeat, onExit]);

  useEffect(() => {
    if (stats.hp <= 0 && !defeat) {
      setDefeat(true);
    }
  }, [stats.hp, defeat]);

  useEffect(() => {
    const handleKey = e => {
      keys.current[e.key.toLowerCase()] = e.type === 'keydown';
    };
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
      if (paused) return;
      elapsed.current += 16;
      setProgress(Math.min(1, elapsed.current / BOSS_TIME));
      setStats(s => {
        if (s.regen <= 0) return s;
        return { ...s, hp: Math.min(s.maxHp, s.hp + s.regen * 0.016) };
      });

      setPlayer(p => {
        let nx = p.x;
        let ny = p.y;
        const baseSpeed = 5.6;
        const speedMult = crew.reduce((acc, c) => acc * c.trait.spd, 1);
        const finalSpeed = baseSpeed * Math.min(speedMult, 1.4) * stats.moveSpeed;
        if (keys.current.w) ny -= finalSpeed;
        if (keys.current.s) ny += finalSpeed;
        if (keys.current.a) nx -= finalSpeed;
        if (keys.current.d) nx += finalSpeed;
        nx = Math.max(0, Math.min(ARENA_SIZE, nx));
        ny = Math.max(0, Math.min(ARENA_SIZE, ny));
        setCamera({ x: nx - window.innerWidth / 2, y: ny - window.innerHeight / 2 });
        return { x: nx, y: ny };
      });

      const difficulty = tileDifficulty + Math.floor(elapsed.current / 20000);
      const spawnInterval = Math.max(200, 1500 - difficulty * 90);
      if (elapsed.current - lastSpawn.current > spawnInterval) {
        lastSpawn.current = elapsed.current;
        setEnemies(e => {
          const count = Math.min(2 + Math.floor(difficulty / 2), 12);
          const next = [...e];
          for (let i = 0; i < count; i += 1) {
            next.push(spawnEnemy(player, difficulty));
          }
          return next;
        });
      }

      if (!bossSpawned && elapsed.current > BOSS_TIME) {
        setBossSpawned(true);
        setEnemies(e => [...e, spawnBoss(player)]);
      }

      const movedEnemies = enemies.map(en => {
        const dx = player.x - en.x;
        const dy = player.y - en.y;
        const dist = Math.hypot(dx, dy) || 1;
        return {
          ...en,
          x: en.x + (dx / dist) * en.speed,
          y: en.y + (dy / dist) * en.speed
        };
      });

      const movedBullets = bullets
        .map(b => ({ ...b, x: b.x + b.vx, y: b.y + b.vy, life: b.life - 16 }))
        .filter(b => b.x > 0 && b.x < ARENA_SIZE && b.y > 0 && b.y < ARENA_SIZE && b.life > 0);

      const movedSlashes = slashes.filter(sl => sl.life > 0).map(sl => ({ ...sl, life: sl.life - 16 }));

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
            if (b.pierce < 0) {
              b.hit = true;
            }
          }
        });
      });

      const withDamage = movedEnemies.map(en => {
        let totalDamage = bulletHits.get(en.id) || 0;
        movedSlashes.forEach(sl => {
          const dist = Math.hypot(sl.x - en.x, sl.y - en.y);
          if (dist < sl.range) totalDamage += sl.damage;
        });
        if (totalDamage <= 0) return en;
        return { ...en, hp: en.hp - totalDamage };
      });
      const alive = [];
      const newOrbs = [];
      withDamage.forEach(en => {
        if (en.hp > 0) {
          alive.push(en);
        } else {
          const orbCount = Math.max(1, Math.round(en.xp / 10));
          for (let i = 0; i < orbCount; i += 1) {
            newOrbs.push({
              id: Math.random(),
              x: en.x + (Math.random() - 0.5) * 30,
              y: en.y + (Math.random() - 0.5) * 30,
              value: Math.ceil(en.xp / orbCount)
            });
          }
          if (en.type === 'boss') {
            setVictory(true);
          }
        }
      });
      if (newOrbs.length) setOrbs(o => [...o, ...newOrbs]);
      setEnemies(alive);

      setBullets(nextBullets.filter(b => !b.hit));
      setSlashes(movedSlashes);

      setOrbs(prev => {
        const drifted = prev.map(o => {
          const dx = player.x - o.x;
          const dy = player.y - o.y;
          const dist = Math.hypot(dx, dy);
          if (dist < 110) {
            return { ...o, x: o.x + (dx / dist) * 2.6, y: o.y + (dy / dist) * 2.6 };
          }
          return o;
        });
        const merged = mergeOrbs(drifted);
        return merged.filter(o => {
          const dist = Math.hypot(o.x - player.x, o.y - player.y);
          if (dist < 34) {
            setXp(x => x + o.value);
            return false;
          }
          return true;
        });
      });

      if (xp >= xpTarget) {
        setXp(x => x - xpTarget);
        setLevel(l => l + 1);
        setXpTarget(t => Math.floor(t * 1.4));
        setUpgradeOptions(rollUpgradeOptions(selectedWeapons, weaponLevels, stats));
      }

      const now = Date.now();
      if (now - lastDamage.current > 260) {
        let totalDamage = 0;
        movedEnemies.forEach(en => {
          const dist = Math.hypot(en.x - player.x, en.y - player.y);
          if (dist < en.size * 0.55 + 16) {
            totalDamage += en.contactDamage || 8;
          }
        });
        if (totalDamage > 0) {
          lastDamage.current = now;
          setStats(s => ({ ...s, hp: Math.max(0, s.hp - totalDamage) }));
        }
      }

      selectedWeapons.forEach(id => {
        const weapon = WEAPONS.find(w => w.id === id);
        if (!weapon) return;
        const level = weaponLevels[id] || 1;
        const weaponStats = buildWeaponStats(weapon, level);
        const last = lastFire.current[id] || 0;
        const fireCooldown = weaponStats.cooldown / stats.attackSpeed;
        if (now - last < fireCooldown) return;
        lastFire.current[id] = now;
        if (!movedEnemies.length) return;
        const target =
          weapon.targeting === 'random'
            ? movedEnemies[Math.floor(Math.random() * movedEnemies.length)]
            : movedEnemies.reduce((closest, en) => {
                const dist = Math.hypot(en.x - player.x, en.y - player.y);
                if (!closest) return en;
                const prevDist = Math.hypot(closest.x - player.x, closest.y - player.y);
                return dist < prevDist ? en : closest;
              }, null);
        if (!target) return;
        const angle = Math.atan2(target.y - player.y, target.x - player.x);
        if (weapon.id === 'KATANA') {
          const slashesToAdd = [];
          for (let i = 0; i < weaponStats.slashCount; i += 1) {
            slashesToAdd.push({
              id: Math.random(),
              x: player.x,
              y: player.y,
              range: weaponStats.range,
              damage: weaponStats.damage * stats.damageMult * crewDamageMult,
              life: 220
            });
          }
          setSlashes(s => [...s, ...slashesToAdd]);
        } else {
          const pellets = weaponStats.pellets || 1;
          const nextBullets = [];
          for (let i = 0; i < pellets; i += 1) {
            const spread = (Math.random() - 0.5) * weaponStats.spread;
            const a = angle + spread;
            nextBullets.push({
              id: Math.random(),
              x: player.x,
              y: player.y,
              vx: Math.cos(a) * weaponStats.bulletSpeed,
              vy: Math.sin(a) * weaponStats.bulletSpeed,
              damage: weaponStats.damage * stats.damageMult * crewDamageMult,
              color: weapon.color,
              life: 1000,
              width: weaponStats.width,
              height: weaponStats.height,
              pierce: weaponStats.pierce ?? 0,
              flashy: weaponStats.flashy
            });
          }
          setBullets(b => [...b, ...nextBullets]);
        }
      });
    }, 16);

    return () => clearInterval(loop);
  }, [crew, paused, player, selectedWeapons, enemies, bullets, slashes, stats, xp, xpTarget, bossSpawned, weaponLevels, crewDamageMult, tileDifficulty]);

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
                <small>{w.id === 'KATANA' ? 'Melee strike' : 'Ranged weapon'}</small>
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
          <div className="hp-bar-fill" style={{ width: `${(stats.hp / stats.maxHp) * 100}%` }} />
          <span>HP {Math.max(0, Math.round((stats.hp / stats.maxHp) * 100))}%</span>
        </div>
        <div className="progress-bar">
          <div className="progress-bar-fill" style={{ width: `${progress * 100}%` }} />
          <span>Boss {Math.floor(progress * 100)}%</span>
        </div>
        {bossSpawned && !victory && (
          <div className="boss-warning">BOSS ENGAGED</div>
        )}
      </div>

      <div className="world-container" style={{ transform: `translate(${-camera.x}px,${-camera.y}px)` }}>
        <div className="world-border" />
        <div className="player-tracer" style={{ left: player.x - 60, top: player.y - 60 }} />
        <div className="player-sprite" style={{ left: player.x, top: player.y }} />
        {slashes.map(s => (
          <div key={s.id} className="katana-slash" style={{ left: s.x, top: s.y }} />
        ))}
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
        {enemies.map(e => (
          <div
            key={e.id}
            className={`enemy-sprite ${e.type}`}
            style={{ left: e.x, top: e.y, width: e.size, height: e.size, background: e.color }}
          />
        ))}
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

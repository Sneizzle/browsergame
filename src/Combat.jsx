import React, { useEffect, useMemo, useRef, useState } from 'react';

const ARENA_SIZE = 2000;
const BOSS_TIME = 110000;

const WEAPONS = [
  {
    id: 'RIFLE',
    name: 'Rifle',
    cooldown: 350,
    bulletSpeed: 15,
    damage: 12,
    pellets: 1,
    spread: 0.05,
    color: '#e9f7ff'
  },
  {
    id: 'KATANA',
    name: 'Katana',
    cooldown: 650,
    damage: 22,
    range: 150,
    color: '#8efaff'
  },
  {
    id: 'SMG',
    name: 'SMG',
    cooldown: 120,
    bulletSpeed: 16,
    damage: 6,
    pellets: 1,
    spread: 0.2,
    color: '#ffe58f'
  },
  {
    id: 'SHOTGUN',
    name: 'Shotgun',
    cooldown: 800,
    bulletSpeed: 13,
    damage: 8,
    pellets: 5,
    spread: 0.6,
    color: '#ffd36b'
  },
  {
    id: 'LASER',
    name: 'Laser',
    cooldown: 900,
    bulletSpeed: 18,
    damage: 28,
    pellets: 1,
    spread: 0.02,
    color: '#ff8ef6'
  }
];

const UPGRADES = [
  {
    id: 'REGEN',
    title: 'Health Regen',
    description: '+0.4 HP/sec',
    apply: stats => ({ ...stats, regen: stats.regen + 0.4 })
  },
  {
    id: 'MAX_HP',
    title: 'Max HP',
    description: '+25 Max HP',
    apply: stats => ({ ...stats, maxHp: stats.maxHp + 25, hp: stats.hp + 25 })
  },
  {
    id: 'DAMAGE',
    title: 'Damage Boost',
    description: '+12% damage',
    apply: stats => ({ ...stats, damageMult: stats.damageMult * 1.12 })
  },
  {
    id: 'ATTACK_SPEED',
    title: 'Attack Speed',
    description: '+12% rate',
    apply: stats => ({ ...stats, attackSpeed: stats.attackSpeed * 1.12 })
  }
];

const spawnEnemy = (player, difficulty) => {
  const angle = Math.random() * Math.PI * 2;
  const dist = 650 + Math.random() * 400;
  const x = Math.min(Math.max(player.x + Math.cos(angle) * dist, 40), ARENA_SIZE - 40);
  const y = Math.min(Math.max(player.y + Math.sin(angle) * dist, 40), ARENA_SIZE - 40);
  const roll = Math.random();
  if (roll > 0.92) {
    return {
      id: Math.random(),
      type: 'brute',
      x,
      y,
      hp: 90 + difficulty * 10,
      maxHp: 90 + difficulty * 10,
      speed: 1.2 + difficulty * 0.05,
      size: 46,
      xp: 28,
      color: '#ff6b6b'
    };
  }
  if (roll > 0.7) {
    return {
      id: Math.random(),
      type: 'sprinter',
      x,
      y,
      hp: 24 + difficulty * 4,
      maxHp: 24 + difficulty * 4,
      speed: 3.6 + difficulty * 0.08,
      size: 22,
      xp: 10,
      color: '#ff2fd2'
    };
  }
  return {
    id: Math.random(),
    type: 'grunt',
    x,
    y,
    hp: 40 + difficulty * 6,
    maxHp: 40 + difficulty * 6,
    speed: 2.2 + difficulty * 0.05,
    size: 28,
    xp: 14,
    color: '#ff007a'
  };
};

const spawnBoss = player => ({
  id: 'boss',
  type: 'boss',
  x: Math.min(Math.max(player.x + 380, 100), ARENA_SIZE - 100),
  y: Math.min(Math.max(player.y - 320, 100), ARENA_SIZE - 100),
  hp: 1200,
  maxHp: 1200,
  speed: 1.4,
  size: 110,
  xp: 180,
  color: '#ffda6b'
});

const rollUpgradeOptions = (ownedWeapons, stats) => {
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

export default function Combat({ crew, onExit, onVictory }) {
  const [player, setPlayer] = useState({ x: 1000, y: 1000 });
  const [stats, setStats] = useState({ hp: 100, maxHp: 100, regen: 0, damageMult: 1, attackSpeed: 1 });
  const [camera, setCamera] = useState({ x: 0, y: 0 });
  const [enemies, setEnemies] = useState([]);
  const [bullets, setBullets] = useState([]);
  const [slashes, setSlashes] = useState([]);
  const [orbs, setOrbs] = useState([]);
  const [selectedWeapons, setSelectedWeapons] = useState([]);
  const [xp, setXp] = useState(0);
  const [xpTarget, setXpTarget] = useState(70);
  const [level, setLevel] = useState(1);
  const [upgradeOptions, setUpgradeOptions] = useState([]);
  const [bossSpawned, setBossSpawned] = useState(false);
  const [victory, setVictory] = useState(false);

  const keys = useRef({});
  const lastFire = useRef({});
  const lastSpawn = useRef(0);
  const elapsed = useRef(0);
  const paused = upgradeOptions.length > 0 || victory;

  const weaponChoices = useMemo(() => WEAPONS, []);

  useEffect(() => {
    if (victory) {
      const timer = setTimeout(() => onVictory(), 1800);
      return () => clearTimeout(timer);
    }
  }, [victory, onVictory]);

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
      setStats(s => {
        if (s.regen <= 0) return s;
        return { ...s, hp: Math.min(s.maxHp, s.hp + s.regen * 0.016) };
      });

      setPlayer(p => {
        let nx = p.x;
        let ny = p.y;
        const baseSpeed = 7;
        const speedMult = crew.reduce((acc, c) => acc * c.trait.spd, 1);
        const finalSpeed = baseSpeed * Math.min(speedMult, 1.4);
        if (keys.current.w) ny -= finalSpeed;
        if (keys.current.s) ny += finalSpeed;
        if (keys.current.a) nx -= finalSpeed;
        if (keys.current.d) nx += finalSpeed;
        nx = Math.max(0, Math.min(ARENA_SIZE, nx));
        ny = Math.max(0, Math.min(ARENA_SIZE, ny));
        setCamera({ x: nx - window.innerWidth / 2, y: ny - window.innerHeight / 2 });
        return { x: nx, y: ny };
      });

      const difficulty = 1 + Math.floor(elapsed.current / 22000);
      const spawnInterval = Math.max(420, 1200 - difficulty * 70);
      if (elapsed.current - lastSpawn.current > spawnInterval) {
        lastSpawn.current = elapsed.current;
        setEnemies(e => {
          const count = Math.min(1 + Math.floor(difficulty / 2), 4);
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

      setEnemies(prev =>
        prev
          .map(en => {
            if (en.type === 'boss') return en;
            const dx = player.x - en.x;
            const dy = player.y - en.y;
            const dist = Math.hypot(dx, dy) || 1;
            return {
              ...en,
              x: en.x + (dx / dist) * en.speed,
              y: en.y + (dy / dist) * en.speed
            };
          })
          .map(en => {
            if (en.type !== 'boss') return en;
            const dx = player.x - en.x;
            const dy = player.y - en.y;
            const dist = Math.hypot(dx, dy) || 1;
            return {
              ...en,
              x: en.x + (dx / dist) * en.speed,
              y: en.y + (dy / dist) * en.speed
            };
          })
      );

      setBullets(prev =>
        prev
          .map(b => ({ ...b, x: b.x + b.vx, y: b.y + b.vy, life: b.life - 16 }))
          .filter(b => b.x > 0 && b.x < ARENA_SIZE && b.y > 0 && b.y < ARENA_SIZE && b.life > 0)
      );

      setSlashes(s => s.filter(sl => sl.life > 0).map(sl => ({ ...sl, life: sl.life - 16 })));

      setEnemies(prev => {
        const bulletHits = new Map();
        bullets.forEach(b => {
          prev.forEach(en => {
            const dist = Math.hypot(b.x - en.x, b.y - en.y);
            if (dist < en.size * 0.7) {
              bulletHits.set(en.id, (bulletHits.get(en.id) || 0) + b.damage);
              b.hit = true;
            }
          });
        });
        const slashesNow = slashes;
        const withDamage = prev.map(en => {
          let totalDamage = bulletHits.get(en.id) || 0;
          slashesNow.forEach(sl => {
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
            const orbCount = Math.max(1, Math.round(en.xp / 8));
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
        return alive;
      });

      setBullets(prev => prev.filter(b => !b.hit));

      setOrbs(prev =>
        prev
          .map(o => {
            const dx = player.x - o.x;
            const dy = player.y - o.y;
            const dist = Math.hypot(dx, dy);
            if (dist < 90) {
              return { ...o, x: o.x + (dx / dist) * 3.2, y: o.y + (dy / dist) * 3.2 };
            }
            return o;
          })
          .filter(o => {
            const dist = Math.hypot(o.x - player.x, o.y - player.y);
            if (dist < 35) {
              setXp(x => x + o.value);
              return false;
            }
            return true;
          })
      );

      if (xp >= xpTarget) {
        setXp(x => x - xpTarget);
        setLevel(l => l + 1);
        setXpTarget(t => Math.floor(t * 1.25));
        setUpgradeOptions(rollUpgradeOptions(selectedWeapons, stats));
      }

      const target = enemies[0];
      if (target) {
        selectedWeapons.forEach(id => {
          const weapon = WEAPONS.find(w => w.id === id);
          if (!weapon) return;
          const last = lastFire.current[id] || 0;
          const now = Date.now();
          const cooldown = weapon.cooldown / stats.attackSpeed;
          if (now - last < cooldown) return;
          lastFire.current[id] = now;
          const angle = Math.atan2(target.y - player.y, target.x - player.x);
          if (weapon.id === 'KATANA') {
            setSlashes(s => [
              ...s,
              {
                id: Math.random(),
                x: player.x,
                y: player.y,
                range: weapon.range,
                damage: weapon.damage * stats.damageMult,
                life: 220
              }
            ]);
          } else {
            const pellets = weapon.pellets || 1;
            const nextBullets = [];
            for (let i = 0; i < pellets; i += 1) {
              const spread = (Math.random() - 0.5) * weapon.spread;
              const a = angle + spread;
              nextBullets.push({
                id: Math.random(),
                x: player.x,
                y: player.y,
                vx: Math.cos(a) * weapon.bulletSpeed,
                vy: Math.sin(a) * weapon.bulletSpeed,
                damage: weapon.damage * stats.damageMult,
                color: weapon.color,
                life: 900
              });
            }
            setBullets(b => [...b, ...nextBullets]);
          }
        });
      }
    }, 16);

    return () => clearInterval(loop);
  }, [crew, paused, player, selectedWeapons, enemies, bullets, slashes, stats, xp, xpTarget, bossSpawned]);

  const chooseUpgrade = option => {
    setStats(s => option.apply(s));
    if (option.weaponId) {
      setSelectedWeapons(w => [...w, option.weaponId]);
    }
    setUpgradeOptions([]);
  };

  const selectWeapon = weaponId => {
    setSelectedWeapons([weaponId]);
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
          <span>{Math.ceil(stats.hp)} / {stats.maxHp}</span>
        </div>
        {bossSpawned && !victory && (
          <div className="boss-warning">BOSS ENGAGED</div>
        )}
      </div>

      <div className="world-container" style={{ transform: `translate(${-camera.x}px,${-camera.y}px)` }}>
        <div className="world-border" />
        <div className="player-sprite" style={{ left: player.x, top: player.y }} />
        {slashes.map(s => (
          <div key={s.id} className="katana-slash" style={{ left: s.x, top: s.y }} />
        ))}
        {bullets.map(b => (
          <div
            key={b.id}
            className="bullet"
            style={{ left: b.x, top: b.y, background: b.color }}
          />
        ))}
        {orbs.map(o => (
          <div key={o.id} className="xp-orb" style={{ left: o.x, top: o.y }} />
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

      <button className="scifi-btn" style={{ position: 'absolute', bottom: 20, right: 20 }} onClick={onExit}>
        SURRENDER
      </button>
    </div>
  );
}

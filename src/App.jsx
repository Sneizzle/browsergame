import React, { useState, useEffect, useRef } from 'react';
import './App.css';

// Project endpoint from
const API_URL = "https://69787eb6cd4fe130e3d91a96.mockapi.io/sessions";

const PLANETS = [
  { id: 1, name: 'Zog-Jungle', color: '#00ff88', x: -400, y: -150 },
  { id: 2, name: 'Dune-9', color: '#ffcc00', x: 300, y: -250 },
  { id: 3, name: 'Inferno', color: '#ff4400', x: 500, y: 180 },
  { id: 4, name: 'Cryo-X', color: '#00f2ff', x: -450, y: 300 },
  { id: 5, name: 'Void-Prime', color: '#ff007a', x: 0, y: 400 },
];

const TRAITS = [
  { id: 'gunner', label: 'GUNNER', color: '#ff9d00', dmg: 1.2, spd: 1 },
  { id: 'scout', label: 'SCOUT', color: '#00f2ff', dmg: 1, spd: 1.4 },
  { id: 'tank', label: 'TANK', color: '#ff007a', dmg: 1, spd: 0.8 }
];

const genCrew = () => ({
  id: Math.random(),
  name: ["Axel", "Kira", "Voss", "Nyx", "Zane"][Math.floor(Math.random()*5)] + "-" + Math.floor(Math.random()*99),
  trait: TRAITS[Math.floor(Math.random()*TRAITS.length)]
});

export default function App() {
  const [view, setView] = useState('menu');
  const [lives, setLives] = useState(5);
  const [crew, setCrew] = useState([]);
  const [draftOptions, setDraftOptions] = useState([genCrew(), genCrew(), genCrew()]);
  const [focusPlanet, setFocusPlanet] = useState(null);
  const [selectedHex, setSelectedHex] = useState(null);
  const [weapon, setWeapon] = useState(null);

  // Combat State
  const [player, setPlayer] = useState({ x: 1000, y: 1000 });
  const [enemies, setEnemies] = useState([]);
  const [bullets, setBullets] = useState([]);
  const [slashes, setSlashes] = useState([]);
  const [camera, setCamera] = useState({ x: 0, y: 0 });
  
  const keys = useRef({});
  const lastFire = useRef(0);

  // --- PERFECT HEX TILING MATH ---
  const hexGrid = focusPlanet ? (() => {
    const arr = [];
    const hexWidth = 50; 
    const hexHeight = 58;
    const rows = 15;
    const cols = 15;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        // Pointy-top hex math for seamless tiling
        const x = (c * hexWidth) + (r % 2 === 0 ? 0 : hexWidth / 2) - (cols * hexWidth / 2);
        const y = (r * hexHeight * 0.75) - (rows * hexHeight * 0.38);
        arr.push({ id: `${r}-${c}`, x, y });
      }
    }
    return arr;
  })() : [];

  // --- SURVIVORS ENGINE ---
  useEffect(() => {
    if (view !== 'combat' || !weapon) return;

    const gameLoop = setInterval(() => {
      // Movement with Scout Bonus
      setPlayer(p => {
        let nx = p.x; let ny = p.y;
        const baseSpeed = 7;
        const speedMult = crew.reduce((acc, c) => acc * c.trait.spd, 1);
        const finalSpeed = baseSpeed * (speedMult > 1.4 ? 1.4 : speedMult); 

        if (keys.current['w']) ny -= finalSpeed; if (keys.current['s']) ny += finalSpeed;
        if (keys.current['a']) nx -= finalSpeed; if (keys.current['d']) nx += finalSpeed;
        
        nx = Math.max(0, Math.min(2000, nx)); ny = Math.max(0, Math.min(2000, ny));
        setCamera({ x: nx - window.innerWidth/2, y: ny - window.innerHeight/2 });
        return { x: nx, y: ny };
      });

      // Auto-Fire
      const now = Date.now();
      if (now - lastFire.current > (weapon === 'RIFLE' ? 400 : 700)) {
        if (weapon === 'KATANA') {
          setSlashes(s => [...s, { id: Math.random(), x: player.x, y: player.y }]);
          setEnemies(en => en.filter(e => Math.sqrt((e.x - player.x)**2 + (e.y - player.y)**2) > 135));
        } else if (enemies.length > 0) {
          const target = enemies[0];
          const angle = Math.atan2(target.y - player.y, target.x - player.x);
          setBullets(b => [...b, { id: Math.random(), x: player.x, y: player.y, vx: Math.cos(angle)*15, vy: Math.sin(angle)*15 }]);
        }
        lastFire.current = now;
      }

      // Cleanup & Physics
      setBullets(b => b.map(bb => ({ ...bb, x: bb.x + bb.vx, y: bb.y + bb.vy })).filter(bb => bb.x > 0 && bb.x < 2000));
      setEnemies(en => en.map(e => {
        const dx = player.x - e.x, dy = player.y - e.y, d = Math.sqrt(dx*dx + dy*dy);
        return { ...e, x: e.x + (dx/d)*2.6, y: e.y + (dy/d)*2.6 };
      }).filter(e => !bullets.some(b => Math.sqrt((b.x - e.x)**2 + (b.y - e.y)**2) < 30)));

      if (Math.random() > 0.975) setEnemies(e => [...e, { id: Math.random(), x: player.x + (Math.random()-0.5)*1300, y: player.y + (Math.random()-0.5)*1300 }]);
      setSlashes(s => s.slice(-1));
    }, 16);

    const handleKey = (e) => keys.current[e.key.toLowerCase()] = e.type === 'keydown';
    window.addEventListener('keydown', handleKey); window.addEventListener('keyup', handleKey);
    return () => { clearInterval(gameLoop); window.removeEventListener('keydown', handleKey); };
  }, [view, weapon, player, enemies, bullets, crew]);

  const dropToHex = async () => {
    try { await fetch(API_URL, { method: 'POST', body: JSON.stringify({ planet: focusPlanet.name, hex: selectedHex, squadSize: crew.length }) }); } catch(e){}
    setView('combat');
  };

  return (
    <div className="game-container">
      {/* PHASE 1: CREW DRAFT */}
      {view === 'crew_draft' && (
        <div className="ui-layer" style={{background: 'rgba(0,0,0,0.85)'}}>
          <h1 style={{fontSize: '2.5rem'}}>RECRUIT EXPEDITION TEAM ({crew.length}/5)</h1>
          <div style={{display:'flex', gap:'20px', margin:'40px 0'}}>
            {draftOptions.map((opt, i) => (
              <div key={opt.id} className="crew-card" onClick={() => {
                if(crew.length < 5) { setCrew([...crew, opt]); const n = [...draftOptions]; n[i] = genCrew(); setDraftOptions(n); }
              }}>
                <div style={{fontWeight:'bold'}}>{opt.name}</div>
                <div className="trait-tag" style={{background: opt.trait.color}}>{opt.trait.label}</div>
              </div>
            ))}
          </div>
          <div style={{display:'flex', gap:'10px'}}>
             {crew.map((m, i) => <div key={i} style={{border:`1px solid ${m.trait.color}`, padding:'10px'}}>{m.name}</div>)}
          </div>
          <button className="scifi-btn" disabled={crew.length < 5} onClick={() => setView('galaxy')}>LAUNCH TO SECTOR</button>
        </div>
      )}

      {/* PHASE 2: GALAXY & PERFECT HEX SPHERE */}
      {view === 'galaxy' && (
        <div className="galaxy-container" onClick={() => { setFocusPlanet(null); setSelectedHex(null); }}>
          <div className="hud">LIVES REMAINING: {lives}</div>
          {PLANETS.map(p => (
            <div key={p.id} className={`planet ${focusPlanet?.id === p.id ? 'focused' : ''}`}
                 style={{
                   width: focusPlanet?.id === p.id ? '620px' : '100px',
                   height: focusPlanet?.id === p.id ? '620px' : '100px',
                   left: focusPlanet?.id === p.id ? '50%' : `calc(50% + ${p.x}px)`,
                   top: focusPlanet?.id === p.id ? '50%' : `calc(50% + ${p.y}px)`,
                   transform: focusPlanet?.id === p.id ? 'translate(-50%, -50%)' : 'none',
                   background: focusPlanet?.id === p.id ? '#050a15' : p.color,
                   border: focusPlanet?.id === p.id ? `4px solid ${p.color}` : 'none'
                 }}
                 onClick={(e) => { e.stopPropagation(); if(!focusPlanet) setFocusPlanet(p); }}>
              <div className="hex-grid-container">
                 {hexGrid.map(h => (
                   <div key={h.id} className={`hex-unit ${selectedHex === h.id ? 'active' : ''}`}
                        style={{ left: `calc(50% + ${h.x}px)`, top: `calc(50% + ${h.y}px)`, transform: 'translate(-50%, -50%)' }}
                        onClick={(e) => { e.stopPropagation(); setSelectedHex(h.id); }} />
                 ))}
              </div>
            </div>
          ))}
          {focusPlanet && selectedHex && (
            <div style={{position:'absolute', bottom:60, left:'50%', transform:'translateX(-50%)', zIndex:1000}}>
              <button className="scifi-btn" onClick={dropToHex}>DEPLOY TO HEX {selectedHex}</button>
            </div>
          )}
        </div>
      )}

      {/* PHASE 3: COMBAT */}
      {view === 'combat' && (
        <div className="combat-world">
          {!weapon && (
            <div className="ui-layer" style={{background:'rgba(0,0,0,0.95)', pointerEvents:'auto'}}>
              <h1>SELECT DEPLOYMENT TECH</h1>
              <div style={{display:'flex'}}>
                <button className="scifi-btn" onClick={() => setWeapon('RIFLE')}>RIFLE (AUTO-TARGET)</button>
                <button className="scifi-btn" onClick={() => setWeapon('KATANA')}>KATANA (MELEE AOE)</button>
              </div>
            </div>
          )}
          <div className="world-container" style={{ transform: `translate(${-camera.x}px, ${-camera.y}px)` }}>
             <div className="world-border" />
             <div className="player-sprite" style={{left: player.x, top: player.y}} />
             {slashes.map(s => <div key={s.id} className="katana-slash" style={{left: s.x, top: s.y}} />)}
             {bullets.map(b => <div key={b.id} style={{position:'absolute', left:b.x, top:b.y, width:12, height:4, background:'#fff'}} />)}
             {enemies.map(en => <div key={en.id} className="enemy-sprite" style={{left: en.x, top: en.y}} />)}
          </div>
          <button className="scifi-btn" style={{position:'absolute', bottom:20, right:20}} 
                  onClick={() => { setLives(l => l-1); setWeapon(null); setView('galaxy'); }}>SURRENDER (-1 LIFE)</button>
        </div>
      )}

      {view === 'menu' && (
        <div className="ui-layer">
          <h1 style={{fontSize:'4rem', letterSpacing:'15px'}}>ASTRA <span style={{color:'var(--neon-pink)'}}>VS</span> ALIEN</h1>
          <button className="scifi-btn" onClick={() => setView('crew_draft')}>INITIALIZE</button>
        </div>
      )}
    </div>
  );
}
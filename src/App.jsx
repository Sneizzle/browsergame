import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import MainMenu from "./MainMenu.jsx";

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

  const [player, setPlayer] = useState({ x: 1000, y: 1000 });
  const [enemies, setEnemies] = useState([]);
  const [bullets, setBullets] = useState([]);
  const [slashes, setSlashes] = useState([]);
  const [camera, setCamera] = useState({ x: 0, y: 0 });

  const keys = useRef({});
  const lastFire = useRef(0);

  const hexGrid = focusPlanet ? (() => {
    const arr = [];
    const hexWidth = 50; 
    const hexHeight = 58;
    const rows = 15;
    const cols = 15;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = (c * hexWidth) + (r % 2 ? hexWidth / 2 : 0) - (cols * hexWidth / 2);
        const y = (r * hexHeight * 0.75) - (rows * hexHeight * 0.38);
        arr.push({ id: `${r}-${c}`, x, y });
      }
    }
    return arr;
  })() : [];

  useEffect(() => {
    if (view !== 'combat' || !weapon) return;

    const gameLoop = setInterval(() => {
      setPlayer(p => {
        let nx = p.x, ny = p.y;
        const baseSpeed = 7;
        const speedMult = crew.reduce((acc, c) => acc * c.trait.spd, 1);
        const finalSpeed = baseSpeed * Math.min(speedMult, 1.4);

        if (keys.current.w) ny -= finalSpeed;
        if (keys.current.s) ny += finalSpeed;
        if (keys.current.a) nx -= finalSpeed;
        if (keys.current.d) nx += finalSpeed;

        nx = Math.max(0, Math.min(2000, nx));
        ny = Math.max(0, Math.min(2000, ny));
        setCamera({ x: nx - window.innerWidth/2, y: ny - window.innerHeight/2 });
        return { x: nx, y: ny };
      });

      const now = Date.now();
      if (now - lastFire.current > (weapon === 'RIFLE' ? 400 : 700)) {
        if (weapon === 'KATANA') {
          setSlashes(s => [...s, { id: Math.random(), x: player.x, y: player.y }]);
          setEnemies(e => e.filter(en => Math.hypot(en.x-player.x, en.y-player.y) > 135));
        } else if (enemies.length) {
          const t = enemies[0];
          const a = Math.atan2(t.y-player.y, t.x-player.x);
          setBullets(b => [...b, { id: Math.random(), x: player.x, y: player.y, vx: Math.cos(a)*15, vy: Math.sin(a)*15 }]);
        }
        lastFire.current = now;
      }

      setBullets(b => b.map(bb => ({ ...bb, x: bb.x+bb.vx, y: bb.y+bb.vy })).filter(bb => bb.x>0 && bb.x<2000));
      setEnemies(e => e.map(en => {
        const dx = player.x-en.x, dy = player.y-en.y, d = Math.hypot(dx,dy);
        return { ...en, x: en.x+dx/d*2.6, y: en.y+dy/d*2.6 };
      }).filter(en => !bullets.some(b => Math.hypot(b.x-en.x,b.y-en.y) < 30)));

      if (Math.random()>0.975)
        setEnemies(e => [...e,{id:Math.random(),x:player.x+(Math.random()-0.5)*1300,y:player.y+(Math.random()-0.5)*1300}]);

      setSlashes(s => s.slice(-1));
    }, 16);

    const k = e => keys.current[e.key.toLowerCase()] = e.type === 'keydown';
    window.addEventListener('keydown', k);
    window.addEventListener('keyup', k);
    return () => { clearInterval(gameLoop); window.removeEventListener('keydown', k); };
  }, [view, weapon, player, enemies, bullets, crew]);

  const dropToHex = async () => {
    try {
      await fetch(API_URL, {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({ planet: focusPlanet.name, hex: selectedHex, squadSize: crew.length })
      });
    } catch {}
    setView('combat');
  };

  return (
    <div className="game-container">

      {view === 'menu' && (
        <MainMenu onStart={() => setView('crew_draft')} />
      )}

      {view === 'crew_draft' && (
        <div className="ui-layer" style={{background:'rgba(0,0,0,0.85)'}}>
          <h1>RECRUIT ({crew.length}/5)</h1>
          <div style={{display:'flex',gap:20}}>
            {draftOptions.map((o,i)=>(
              <div key={o.id} className="crew-card" onClick={()=>{
                if(crew.length<5){
                  setCrew([...crew,o]);
                  const n=[...draftOptions]; n[i]=genCrew(); setDraftOptions(n);
                }
              }}>
                <b>{o.name}</b>
                <div className="trait-tag" style={{background:o.trait.color}}>{o.trait.label}</div>
              </div>
            ))}
          </div>
          <button className="scifi-btn" disabled={crew.length<5} onClick={()=>setView('galaxy')}>LAUNCH</button>
        </div>
      )}

      {view === 'galaxy' && (
        <div className="galaxy-container" onClick={()=>{setFocusPlanet(null);setSelectedHex(null);}}>
          <div className="hud">LIVES: {lives}</div>
          {PLANETS.map(p=>(
            <div key={p.id} className={`planet ${focusPlanet?.id===p.id?'focused':''}`}
              style={{
                width:focusPlanet?.id===p.id?'620px':'100px',
                height:focusPlanet?.id===p.id?'620px':'100px',
                left:focusPlanet?.id===p.id?'50%':`calc(50% + ${p.x}px)`,
                top:focusPlanet?.id===p.id?'50%':`calc(50% + ${p.y}px)`,
                transform:focusPlanet?.id===p.id?'translate(-50%,-50%)':'none',
                background:focusPlanet?.id===p.id?'#050a15':p.color,
                border:focusPlanet?.id===p.id?`4px solid ${p.color}`:'none'
              }}
              onClick={e=>{e.stopPropagation();if(!focusPlanet)setFocusPlanet(p);}}
            >
              <div className="hex-grid-container">
                {hexGrid.map(h=>(
                  <div key={h.id} className={`hex-unit ${selectedHex===h.id?'active':''}`}
                    style={{left:`calc(50% + ${h.x}px)`,top:`calc(50% + ${h.y}px)`,transform:'translate(-50%,-50%)'}}
                    onClick={e=>{e.stopPropagation();setSelectedHex(h.id);}}
                  />
                ))}
              </div>
            </div>
          ))}
          {focusPlanet && selectedHex && (
            <button className="scifi-btn" style={{position:'absolute',bottom:60,left:'50%',transform:'translateX(-50%)'}} onClick={dropToHex}>
              DEPLOY {selectedHex}
            </button>
          )}
        </div>
      )}

      {view === 'combat' && (
        <div className="combat-world">
          {!weapon && (
            <div className="ui-layer" style={{background:'rgba(0,0,0,0.95)'}}>
              <h1>SELECT TECH</h1>
              <button className="scifi-btn" onClick={()=>setWeapon('RIFLE')}>RIFLE</button>
              <button className="scifi-btn" onClick={()=>setWeapon('KATANA')}>KATANA</button>
            </div>
          )}
          <div className="world-container" style={{transform:`translate(${-camera.x}px,${-camera.y}px)`}}>
            <div className="world-border" />
            <div className="player-sprite" style={{left:player.x,top:player.y}} />
            {slashes.map(s=><div key={s.id} className="katana-slash" style={{left:s.x,top:s.y}} />)}
            {bullets.map(b=><div key={b.id} style={{position:'absolute',left:b.x,top:b.y,width:12,height:4,background:'#fff'}} />)}
            {enemies.map(e=><div key={e.id} className="enemy-sprite" style={{left:e.x,top:e.y}} />)}
          </div>
          <button className="scifi-btn" style={{position:'absolute',bottom:20,right:20}} onClick={()=>{setLives(l=>l-1);setWeapon(null);setView('galaxy');}}>
            SURRENDER
          </button>
        </div>
      )}

    </div>
  );
}

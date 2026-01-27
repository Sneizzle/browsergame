import React, { useState } from 'react';
import './App.css';
import MainMenu from "./MainMenu.jsx";
import Combat from "./Combat.jsx";

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
  name: ["Axel", "Kira", "Voss", "Nyx", "Zane"][Math.floor(Math.random() * 5)] + "-" + Math.floor(Math.random() * 99),
  trait: TRAITS[Math.floor(Math.random() * TRAITS.length)]
});

export default function App() {
  const [view, setView] = useState('menu');
  const [lives, setLives] = useState(5);
  const [crew, setCrew] = useState([]);
  const [draftOptions, setDraftOptions] = useState([genCrew(), genCrew(), genCrew()]);
  const [focusPlanet, setFocusPlanet] = useState(null);
  const [selectedHex, setSelectedHex] = useState(null);
  const [clearedHexes, setClearedHexes] = useState({});

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

  const dropToHex = async () => {
    try {
      await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planet: focusPlanet.name, hex: selectedHex, squadSize: crew.length })
      });
    } catch {}
    setView('combat');
  };

  const handleVictory = () => {
    if (focusPlanet && selectedHex) {
      setClearedHexes(prev => {
        const current = new Set(prev[focusPlanet.id] || []);
        current.add(selectedHex);
        return { ...prev, [focusPlanet.id]: Array.from(current) };
      });
    }
    setView('galaxy');
  };

  return (
    <div className="game-container">

      {view === 'menu' && (
        <MainMenu onStart={() => setView('crew_draft')} />
      )}

      {view === 'crew_draft' && (
        <div className="ui-layer" style={{ background: 'rgba(0,0,0,0.85)' }}>
          <h1>RECRUIT ({crew.length}/5)</h1>
          <div style={{ display: 'flex', gap: 20 }}>
            {draftOptions.map((o, i) => (
              <div key={o.id} className="crew-card" onClick={() => {
                if (crew.length < 5) {
                  setCrew([...crew, o]);
                  const n = [...draftOptions];
                  n[i] = genCrew();
                  setDraftOptions(n);
                }
              }}>
                <b>{o.name}</b>
                <div className="trait-tag" style={{ background: o.trait.color }}>{o.trait.label}</div>
              </div>
            ))}
          </div>
          <button className="scifi-btn" disabled={crew.length < 5} onClick={() => setView('galaxy')}>LAUNCH</button>
        </div>
      )}

      {view === 'galaxy' && (
        <div className="galaxy-container" onClick={() => { setFocusPlanet(null); setSelectedHex(null); }}>
          <div className="hud">LIVES: {lives}</div>
          {PLANETS.map(p => (
            <div key={p.id} className={`planet ${focusPlanet?.id === p.id ? 'focused' : ''}`}
              style={{
                width: focusPlanet?.id === p.id ? '620px' : '100px',
                height: focusPlanet?.id === p.id ? '620px' : '100px',
                left: focusPlanet?.id === p.id ? '50%' : `calc(50% + ${p.x}px)`,
                top: focusPlanet?.id === p.id ? '50%' : `calc(50% + ${p.y}px)`,
                transform: focusPlanet?.id === p.id ? 'translate(-50%,-50%)' : 'none',
                background: focusPlanet?.id === p.id ? '#050a15' : p.color,
                border: focusPlanet?.id === p.id ? `4px solid ${p.color}` : 'none'
              }}
              onClick={e => { e.stopPropagation(); if (!focusPlanet) setFocusPlanet(p); }}
            >
              <div className="hex-grid-container">
                {hexGrid.map(h => {
                  const cleared = (clearedHexes[p.id] || []).includes(h.id);
                  return (
                    <div key={h.id} className={`hex-unit ${selectedHex === h.id ? 'active' : ''} ${cleared ? 'cleared' : ''}`}
                      style={{ left: `calc(50% + ${h.x}px)`, top: `calc(50% + ${h.y}px)`, transform: 'translate(-50%,-50%)' }}
                      onClick={e => { e.stopPropagation(); setSelectedHex(h.id); }}
                    />
                  );
                })}
              </div>
            </div>
          ))}
          {focusPlanet && selectedHex && (
            <button className="scifi-btn" style={{ position: 'absolute', bottom: 60, left: '50%', transform: 'translateX(-50%)' }} onClick={dropToHex}>
              DEPLOY {selectedHex}
            </button>
          )}
        </div>
      )}

      {view === 'combat' && (
        <Combat
          crew={crew}
          onExit={() => {
            setLives(l => l - 1);
            setView('galaxy');
          }}
          onVictory={handleVictory}
        />
      )}

    </div>
  );
}

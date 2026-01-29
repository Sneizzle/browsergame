// App.jsx
import React, { useState } from 'react';
import './App.css';
import MainMenu from "./MainMenu.jsx";
import Combat from "./Combat.jsx";

import droppod from "./assets/droppod.mp4";
import missionsuccess from "./assets/missionsucess.mp4";

// hero portraits
import hero1 from "./assets/hero/hero1.png";
import hero2 from "./assets/hero/hero2.png";
import hero3 from "./assets/hero/hero3.png";
import hero4 from "./assets/hero/hero4.png";
import hero5 from "./assets/hero/hero5.png";
import hero6 from "./assets/hero/hero6.png";
import hero7 from "./assets/hero/hero7.png";
import hero8 from "./assets/hero/hero8.png";
import hero9 from "./assets/hero/hero9.png";
const API_URL = "https://69787eb6cd4fe130e3d91a96.mockapi.io/sessions";

const PLANETS = [
  { id: 1, name: 'Zog-Jungle', color: '#00ff88', x: -400, y: -150, difficulty: 1 },
  { id: 2, name: 'Dune-9', color: '#ffcc00', x: 300, y: -250, difficulty: 2 },
  { id: 3, name: 'Inferno', color: '#ff4400', x: 500, y: 180, difficulty: 3 },
  { id: 4, name: 'Cryo-X', color: '#00f2ff', x: -450, y: 300, difficulty: 2 },
  { id: 5, name: 'Void-Prime', color: '#ff007a', x: 0, y: 400, difficulty: 4 },
];

// kept for Combat prop compatibility
const TRAITS = [
  { id: 'gunner', label: 'GUNNER', color: '#ff9d00', dmg: 1.2, spd: 1 },
  { id: 'scout', label: 'SCOUT', color: '#00f2ff', dmg: 1, spd: 1.4 },
  { id: 'tank', label: 'TANK', color: '#ff007a', dmg: 1, spd: 0.8 }
];

// --- HERO SELECTION (placeholder only) ---
const HERO_FIRST = ["Nyx", "Orion", "Vega", "Kira", "Zane", "Sable", "Riven", "Astra", "Voss", "Kael"];
const HERO_LAST  = ["Drayke", "Voidrunner", "Starborn", "Quell", "Kestrel", "Nightfall", "Xarn", "Solari", "Nebulus", "Ashen"];
const HERO_TRAITS = [
  { id: "gunner", label: "GUNNER", color: "#ff9d00" },
  { id: "scout",  label: "SCOUT",  color: "#00f2ff" },
  { id: "tank",   label: "TANK",   color: "#ff007a" },
];
const HERO_PORTRAITS = [hero1, hero2, hero3, hero4, hero5, hero6, hero7, hero8, hero9];

const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ✅ ALWAYS returns 5 options with UNIQUE portraits (no duplicate pictures)
function genUniqueHeroOptions(count = 5) {
  if (HERO_PORTRAITS.length < count) {
    console.warn(`Need at least ${count} hero portraits for uniqueness. Currently: ${HERO_PORTRAITS.length}`);
  }
  const picks = shuffle(HERO_PORTRAITS).slice(0, Math.min(count, HERO_PORTRAITS.length));
  return picks.map((portrait) => ({
    id: crypto?.randomUUID?.() ?? Math.random().toString(16).slice(2),
    name: `${rand(HERO_FIRST)} ${rand(HERO_LAST)}`,
    trait: rand(HERO_TRAITS),
    portrait,
  }));
}

export default function App() {
  const [view, setView] = useState('menu');
  const [lives, setLives] = useState(5);

  const [crew, setCrew] = useState([]); // kept for Combat prop compatibility
  const [focusPlanet, setFocusPlanet] = useState(null);
  const [selectedHex, setSelectedHex] = useState(null);
  const [selectedHexInfo, setSelectedHexInfo] = useState(null);
  const [clearedHexes, setClearedHexes] = useState({});

  // ✅ This is your "my xp" (reward for defeating a tile)
  const [crewXp, setCrewXp] = useState(0);

  const [resources, setResources] = useState(0);
  const [combatCtx, setCombatCtx] = useState(null);

  // hero selection screen state
  const [heroOptions, setHeroOptions] = useState(() => genUniqueHeroOptions(5));
  const [selectedHero, setSelectedHero] = useState(null);

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
        const dist = Math.hypot(r - rows / 2, c - cols / 2);
        const difficulty = Math.min(5, Math.max(1, Math.ceil(dist / 4)));
        arr.push({ id: `${r}-${c}`, x, y, difficulty });
      }
    }
    return arr;
  })() : [];

  const dropToHex = async () => {
    setCombatCtx({
      planetId: focusPlanet?.id,
      hexId: selectedHex,
      reward: selectedHexInfo?.reward || 0
    });

    try {
      await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // crew draft removed; treat hero as squad size 1
        body: JSON.stringify({ planet: focusPlanet.name, hex: selectedHex, squadSize: 1 })
      });
    } catch {}

    setView('deploy_video');
  };

  const handleVictory = () => {
    if (combatCtx?.planetId && combatCtx?.hexId) {
      setClearedHexes(prev => {
        const current = new Set(prev[combatCtx.planetId] || []);
        const already = current.has(combatCtx.hexId);

        if (!already) {
          current.add(combatCtx.hexId);

          const reward = combatCtx.reward || 0;
          if (reward > 0) {
            setCrewXp(xp => xp + reward);
            setResources(r => r + reward);
          }
        }

        return { ...prev, [combatCtx.planetId]: Array.from(current) };
      });
    }

    setView('mission_success');
  };

  return (
    <div className="game-container">

      {view === 'menu' && (
        <MainMenu
          onStart={() => {
            setHeroOptions(genUniqueHeroOptions(5)); // ✅ unique
            setSelectedHero(null);
            setView('hero_select');
          }}
        />
      )}

      {/* Hero selection screen */}
      {view === 'hero_select' && (
        <div className="ui-layer" style={{ background: "rgba(0,0,0,0.85)", padding: 24 }}>
          <h1 style={{ marginTop: 0, letterSpacing: 6 }}>CHOOSE YOUR OPERATIVE</h1>
          <p style={{ opacity: 0.85, marginTop: 6 }}>Pick one. Traits are placeholder only.</p>

          <div
            style={{
              width: "min(1100px, 100%)",
              margin: "18px auto 0",
              display: "grid",
              gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
              gap: 14,
            }}
          >
            {heroOptions.map((h) => {
              const active = selectedHero?.id === h.id;

              return (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => setSelectedHero(h)}
                  style={{
                    cursor: "pointer",
                    padding: 12,
                    borderRadius: 14,
                    border: active ? "2px solid var(--neon-pink)" : "1px solid rgba(255,255,255,0.22)",
                    background: active ? "rgba(255,0,122,0.12)" : "rgba(0,0,0,0.45)",
                    color: "white",
                    textAlign: "left",
                    outline: "none",
                    boxShadow: active ? "0 0 16px rgba(255,0,122,0.35)" : "none",
                  }}
                >
                  <div
                    style={{
                      width: "100%",
                      aspectRatio: "1 / 1",
                      borderRadius: 12,
                      background: "#fff",
                      border: "1px solid rgba(0,0,0,0.25)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      overflow: "hidden",
                      marginBottom: 10,
                    }}
                  >
                    <img
                      src={h.portrait}
                      alt=""
                      draggable={false}
                      style={{
                        width: "92%",
                        height: "92%",
                        objectFit: "contain",
                        imageRendering: "auto",
                      }}
                    />
                  </div>

                  <div style={{ fontWeight: 800 }}>{h.name}</div>

                  <div
                    style={{
                      marginTop: 8,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "6px 10px",
                      borderRadius: 999,
                      border: "1px solid rgba(255,255,255,0.18)",
                      background: "rgba(0,0,0,0.35)",
                      fontSize: 12,
                    }}
                  >
                    <span style={{ width: 10, height: 10, borderRadius: 999, background: h.trait.color }} />
                    <span>{h.trait.label}</span>
                  </div>
                </button>
              );
            })}
          </div>

          <div style={{ marginTop: 18, display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <button className="scifi-btn" onClick={() => setView("menu")}>
              BACK
            </button>

            {/* ✅ REROLL (unique portraits) */}
            <button
              className="scifi-btn"
              onClick={() => {
                setHeroOptions(genUniqueHeroOptions(5));
                setSelectedHero(null);
              }}
            >
              REROLL
            </button>

            <button
              className="scifi-btn"
              disabled={!selectedHero}
              onClick={() => {
                setCrew([]); // optional
                setView("galaxy");
              }}
            >
              CONFIRM
            </button>
          </div>

          <div style={{ marginTop: 10, opacity: 0.8, fontSize: 12, textAlign: "center" }}>
            Lives remain {lives}. (No changes)
          </div>
        </div>
      )}

      {view === 'galaxy' && (
        <div
          className="galaxy-container"
          onClick={() => { setFocusPlanet(null); setSelectedHex(null); setSelectedHexInfo(null); }}
        >
          {/* ✅ HUD changed to: My Name + My XP + Resources */}
          <div className="hud">
            <div>NAME: {selectedHero?.name || "UNKNOWN"}</div>
            <div>XP: {crewXp}</div>
            <div>RES: {resources}</div>
          </div>

          {/* ✅ Show-all / unfocus button ONLY when focused */}
          {focusPlanet && (
            <button
              className="scifi-btn"
              style={{
                position: "fixed",
                left: 24,
                top: 110,     // sits under HUD
                zIndex: 9100,
                padding: "10px 14px",
                letterSpacing: 2,
              }}
              onClick={(e) => {
                e.stopPropagation();
                setFocusPlanet(null);
                setSelectedHex(null);
                setSelectedHexInfo(null);
              }}
            >
              SHOW ALL
            </button>
          )}

          {PLANETS.map(p => (
            <div
              key={p.id}
              className={`planet ${focusPlanet?.id === p.id ? 'focused' : ''}`}
              style={{
                width: focusPlanet?.id === p.id ? '620px' : '100px',
                height: focusPlanet?.id === p.id ? '620px' : '100px',
                left: focusPlanet?.id === p.id ? '50%' : `calc(50% + ${p.x}px)`,
                top: focusPlanet?.id === p.id ? '50%' : `calc(50% + ${p.y}px)`,
                transform: focusPlanet?.id === p.id ? 'translate(-50%,-50%)' : 'none',
                background: focusPlanet?.id === p.id ? '#050a15' : p.color,
                border: focusPlanet?.id === p.id ? `4px solid ${p.color}` : 'none'
              }}
              onClick={e => {
                e.stopPropagation();

                if (focusPlanet?.id === p.id) {
                  setFocusPlanet(null);
                  setSelectedHex(null);
                  setSelectedHexInfo(null);
                  return;
                }

                setFocusPlanet(p);
                setSelectedHex(null);
                setSelectedHexInfo(null);
              }}
            >
              <div className="hex-grid-container">
                {hexGrid.map(h => {
                  const cleared = (clearedHexes[p.id] || []).includes(h.id);
                  return (
                    <div
                      key={h.id}
                      className={`hex-unit ${selectedHex === h.id ? 'active' : ''} ${cleared ? 'cleared' : ''}`}
                      style={{
                        left: `calc(50% + ${h.x}px)`,
                        top: `calc(50% + ${h.y}px)`,
                        transform: 'translate(-50%,-50%)'
                      }}
                      onClick={e => {
                        e.stopPropagation();
                        setSelectedHex(h.id);
                        setSelectedHexInfo({
                          difficulty: h.difficulty + (p.difficulty - 1),
                          reward: (h.difficulty + (p.difficulty - 1)) * 20
                        });
                      }}
                    />
                  );
                })}
              </div>
            </div>
          ))}

          {/* Sci-fi info panel with DEPLOY button inside it */}
          {focusPlanet && selectedHexInfo && (
            <div
              className="tile-panel"
              onClick={e => e.stopPropagation()}
              style={{
                position: "fixed",
                right: 60,
                top: 120,
                width: 360,
                zIndex: 9000,
                border: "1px solid rgba(0,242,255,0.35)",
                background: "rgba(0,0,0,0.65)",
                boxShadow: "0 0 30px rgba(0,242,255,0.08)",
                padding: 18
              }}
            >
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
                <h3 style={{ margin: 0, letterSpacing: 2 }}>
                  {focusPlanet.name} / TILE {selectedHex}
                </h3>
                <div style={{ fontSize: 12, opacity: 0.8 }}>SCAN</div>
              </div>

              <div style={{ height: 1, background: "rgba(0,242,255,0.18)", margin: "12px 0" }} />

              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                <span style={{ opacity: 0.8 }}>Difficulty</span>
                <strong>{selectedHexInfo.difficulty}</strong>
              </div>

              {(() => {
                const reward = selectedHexInfo.reward || 0;

                let rewardColor = "rgba(255,255,255,0.65)"; // meh
                if (reward >= 200) rewardColor = "#ff007a";      // huge
                else if (reward >= 140) rewardColor = "#ff9d00"; // big
                else if (reward >= 80) rewardColor = "#00f2ff";  // solid

                return (
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                    <span style={{ opacity: 0.8 }}>Rewards</span>
                    <strong style={{ color: rewardColor, letterSpacing: 1 }}>
                      +{reward}
                    </strong>
                  </div>
                );
              })()}

              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
                <span style={{ opacity: 0.8 }}>Resources</span>
                <strong>{resources}</strong>
              </div>

              <div style={{ height: 1, background: "rgba(0,242,255,0.18)", margin: "14px 0" }} />

              <button
                className="scifi-btn"
                style={{ width: "100%", padding: "14px 16px", letterSpacing: 3 }}
                onClick={dropToHex}
                disabled={!selectedHex}
              >
                DEPLOY {selectedHex}
              </button>

              <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75 }}>
                Confirm drop coordinates and deploy.
              </div>
            </div>
          )}
        </div>
      )}

      {/* droppod.mp4 interstitial */}
      {view === 'deploy_video' && (
        <div
          className="video-layer"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "black"
          }}
        >
          <video
            src={droppod}
            autoPlay
            muted
            playsInline
            onEnded={() => setView('combat')}
            style={{ width: "100%", height: "100%", objectFit: "contain" }}
          />
          <button
            className="scifi-btn"
            style={{ position: "absolute", right: 20, bottom: 20 }}
            onClick={() => setView('combat')}
          >
            SKIP
          </button>
        </div>
      )}

      {/* mission success video */}
      {view === 'mission_success' && (
        <div
          className="video-layer"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "black"
          }}
        >
          <video
            src={missionsuccess}
            autoPlay
            muted
            playsInline
            onEnded={() => setView('galaxy')}
            style={{ width: "100%", height: "100%", objectFit: "contain" }}
          />
          <button
            className="scifi-btn"
            style={{ position: "absolute", right: 20, bottom: 20 }}
            onClick={() => setView('galaxy')}
          >
            CONTINUE
          </button>
        </div>
      )}

      {view === 'combat' && (
        <Combat
          crew={crew}
          tileDifficulty={(selectedHexInfo?.difficulty || 1)}
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

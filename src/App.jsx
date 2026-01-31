// App.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import MainMenu from "./MainMenu.jsx";
import Combat from "./Combat.jsx";

import droppod from "./assets/droppod.mp4";
import missionsuccess from "./assets/missionsucess.mp4";

// tutorial portrait
import tubbe from "./assets/hero/tubbe.png";

// ✅ adjust if your file is elsewhere (common alternatives: ../components/GalaxyShop.jsx or ./GalaxyShop.jsx)
import GalaxyShop from "./components/GalaxyShop.jsx";

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
import hero10 from "./assets/hero/hero10.png";
import hero11 from "./assets/hero/hero11.png";
import hero12 from "./assets/hero/hero12.png";
import hero13 from "./assets/hero/hero13.png";
import hero14 from "./assets/hero/hero14.png";
import hero15 from "./assets/hero/hero15.png";
import hero16 from "./assets/hero/hero16.png";
import hero17 from "./assets/hero/hero17.png";
import hero18 from "./assets/hero/hero18.png";
import hero19 from "./assets/hero/hero19.png";
import hero20 from "./assets/hero/hero20.png";
import hero21 from "./assets/hero/hero21.png";
import hero22 from "./assets/hero/hero22.png";
import hero23 from "./assets/hero/hero23.png";
import hero24 from "./assets/hero/hero24.png";
import hero25 from "./assets/hero/hero25.png";
import hero26 from "./assets/hero/hero26.png";

const API_URL = "https://69787eb6cd4fe130e3d91a96.mockapi.io/sessions";

const PLANETS = [
  { id: 1, name: "Zog-Jungle", color: "#00ff88", x: -400, y: -150, difficulty: 1 }, // tutorial target
  { id: 2, name: "Dune-9", color: "#ffcc00", x: 300, y: -250, difficulty: 2 },
  { id: 3, name: "Inferno", color: "#ff4400", x: 500, y: 180, difficulty: 3 },
  { id: 4, name: "Cryo-X", color: "#00f2ff", x: -450, y: 300, difficulty: 2 },
  { id: 5, name: "Void-Prime", color: "#ff007a", x: 0, y: 400, difficulty: 4 },
];

// kept for Combat prop compatibility (not used here)
const TRAITS = [
  { id: "gunner", label: "GUNNER", color: "#ff9d00", dmg: 1.2, spd: 1 },
  { id: "scout", label: "SCOUT", color: "#00f2ff", dmg: 1, spd: 1.4 },
  { id: "tank", label: "TANK", color: "#ff007a", dmg: 1, spd: 0.8 },
];

// --- HERO SELECTION (placeholder only) ---
const HERO_FIRST = ["Nyx", "Orion", "Vega", "Kira", "Zane", "Sable", "Riven", "Astra", "Voss", "Kael", "Freya", "Miti", "Sonia", "Andra"];
const HERO_LAST = ["Drayke", "Voidrunner", "Starborn", "Quell", "Kestrel", "Nightfall", "Xarn", "Solari", "Nebulus", "Ashen", "Biju", "Sandu"];
const HERO_TRAITS = [
  { id: "gunner", label: "GUNNER", color: "#ff9d00" },
  { id: "scout", label: "SCOUT", color: "#00f2ff" },
  { id: "tank", label: "TANK", color: "#ff007a" },
];

const HERO_PORTRAITS = [
  hero1, hero2, hero3, hero4, hero5, hero6, hero7, hero8, hero9, hero10, hero11,
  hero12, hero13, hero14, hero15, hero16, hero17, hero18, hero19, hero20, hero21,
  hero22, hero23, hero24, hero25, hero26,
];

const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function genUniqueHeroOptions(count = 5) {
  const picks = shuffle(HERO_PORTRAITS).slice(0, Math.min(count, HERO_PORTRAITS.length));
  return picks.map((portrait) => ({
    id: crypto?.randomUUID?.() ?? Math.random().toString(16).slice(2),
    name: `${rand(HERO_FIRST)} ${rand(HERO_LAST)}`,
    trait: rand(HERO_TRAITS),
    portrait,
  }));
}

// ✅ forced tile id for the tutorial (exists in your 15x15 grid)
const TUTORIAL_TILE_ID = "7-7";

export default function App() {
  const [view, setView] = useState("menu");
  const [lives, setLives] = useState(5);

  const [crew, setCrew] = useState([]); // kept for Combat prop compatibility
  const [focusPlanet, setFocusPlanet] = useState(null);
  const [selectedHex, setSelectedHex] = useState(null);
  const [selectedHexInfo, setSelectedHexInfo] = useState(null);
  const [clearedHexes, setClearedHexes] = useState({});

  // Roguelite run + shop
  const [runId, setRunId] = useState(1);
  const [shopOpen, setShopOpen] = useState(false);
  const [shopUnlocked, setShopUnlocked] = useState(false); // ✅ locked until first win this run
  const [runBuild, setRunBuild] = useState({ purchased: {}, abilities: [], passives: [] });

  // XP + resources
  const [crewXp, setCrewXp] = useState(0);
  const [resources, setResources] = useState(0);
  const [talentPills, setTalentPills] = useState(0); // 1 per mission (roguelite talent currency)
  const [combatCtx, setCombatCtx] = useState(null);

  // hero selection
  const [heroOptions, setHeroOptions] = useState(() => genUniqueHeroOptions(5));
  const [selectedHero, setSelectedHero] = useState(null);

  // ✅ tutorial (in-memory only; refresh wipes it)
  const [tutorialShownThisSession, setTutorialShownThisSession] = useState(false);
  const [tutorialVisible, setTutorialVisible] = useState(false);

  // tutorial steps:
  // 1 = click green planet
  // 2 = click forced tile
  // (ends only when player DEPLOYS tutorial tile)
  const [tutorialStep, setTutorialStep] = useState(0);

  // anchors
  const planetRefs = useRef({});
  const [arrowPos, setArrowPos] = useState(null);
  const [tileArrowPos, setTileArrowPos] = useState(null);

  // ✅ show tutorial when arriving to galaxy (first time per refresh)
  useEffect(() => {
    if (view === "galaxy" && !tutorialShownThisSession) {
      setTutorialVisible(true);
      setTutorialStep(1);
      setTutorialShownThisSession(true);
    }

    if (view !== "galaxy") {
      setTutorialVisible(false);
    }
  }, [view, tutorialShownThisSession]);

  // ✅ subtle pulse animation (no movement)
  const tutorialPulseStyle = tutorialVisible ? (
    <style>
      {`
        @keyframes xenoPulse {
          0%, 100% { transform: scale(1); opacity: 0.75; }
          50% { transform: scale(1.06); opacity: 1; }
        }
      `}
    </style>
  ) : null;

  // ✅ planet arrow position (step 1)
  useEffect(() => {
    if (!(view === "galaxy" && tutorialVisible && tutorialStep === 1)) return;

    const targetId = 1;
    let raf = 0;

    const update = () => {
      const el = planetRefs.current[targetId];
      if (!el) {
        setArrowPos(null);
        return;
      }
      const r = el.getBoundingClientRect();
      setArrowPos({
        left: r.left - 56,
        top: r.top + r.height / 2 - 22,
      });
    };

    const tick = () => {
      update();
      raf = requestAnimationFrame(tick);
    };

    tick();
    window.addEventListener("resize", update);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", update);
    };
  }, [view, tutorialVisible, tutorialStep]);

  // ✅ tile arrow position (step 2) — only when planet is focused
  useEffect(() => {
    if (!(view === "galaxy" && tutorialVisible && tutorialStep === 2 && focusPlanet?.id === 1)) return;

    let raf = 0;
    const update = () => {
      const el = document.querySelector(`[data-hex-id="${TUTORIAL_TILE_ID}"]`);
      if (!el) {
        setTileArrowPos(null);
        return;
      }
      const r = el.getBoundingClientRect();
      setTileArrowPos({
        left: r.left + r.width / 2 - 22,
        top: r.top - 56,
      });
    };

    const tick = () => {
      update();
      raf = requestAnimationFrame(tick);
    };

    tick();
    window.addEventListener("resize", update);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", update);
    };
  }, [view, tutorialVisible, tutorialStep, focusPlanet?.id]);

  const gameOver = lives <= 0;

  // Roguelite hard reset after 5 deaths (auto-refresh)
  useEffect(() => {
    if (!gameOver) return;
    const t = setTimeout(() => {
      window.location.reload();
    }, 1400);
    return () => clearTimeout(t);
  }, [gameOver]);

  const hexGrid = focusPlanet
    ? (() => {
        const arr = [];
        const hexWidth = 50;
        const hexHeight = 58;
        const rows = 15;
        const cols = 15;
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const x = c * hexWidth + (r % 2 ? hexWidth / 2 : 0) - (cols * hexWidth) / 2;
            const y = r * hexHeight * 0.75 - rows * hexHeight * 0.38;
            const dist = Math.hypot(r - rows / 2, c - cols / 2);
            const difficulty = Math.min(5, Math.max(1, Math.ceil(dist / 4)));
            arr.push({ id: `${r}-${c}`, x, y, difficulty });
          }
        }
        return arr;
      })()
    : [];

  const selectedIsCleared = useMemo(() => {
    if (!focusPlanet?.id || !selectedHex) return false;
    return (clearedHexes[focusPlanet.id] || []).includes(selectedHex);
  }, [focusPlanet?.id, selectedHex, clearedHexes]);

  const dropToHex = async () => {
    if (!focusPlanet?.id || !selectedHex) return;

    // ✅ Tutorial hard-lock: must deploy from planet 1 + tutorial tile
    if (tutorialVisible) {
      if (focusPlanet.id !== 1) return;
      if (selectedHex !== TUTORIAL_TILE_ID) return;

      // ✅ end tutorial ONLY when deploying the correct tile
      setTutorialVisible(false);
      setTutorialStep(0);
    }

    if ((clearedHexes[focusPlanet.id] || []).includes(selectedHex)) return;

    setShopOpen(false);

    setCombatCtx({
      planetId: focusPlanet?.id,
      hexId: selectedHex,
      reward: selectedHexInfo?.reward || 0,
    });

    try {
      await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planet: focusPlanet.name, hex: selectedHex, squadSize: 1 }),
      });
    } catch {}

    setView("deploy_video");
  };

  const handleVictory = () => {
    if (combatCtx?.planetId && combatCtx?.hexId) {
      setClearedHexes((prev) => {
        const current = new Set(prev[combatCtx.planetId] || []);
        const already = current.has(combatCtx.hexId);

        if (!already) {
          current.add(combatCtx.hexId);

          const reward = combatCtx.reward || 0;
          if (reward > 0) {
            setCrewXp((xp) => xp + reward);
            setResources((r) => r + reward);
    // Roguelite talent point: +1 pill per cleared mission
    setTalentPills((p) => p + 1);
          }

          // ✅ unlock shop after first win of run
          setShopUnlocked(true);
        }

        return { ...prev, [combatCtx.planetId]: Array.from(current) };
      });
    }

    setShopOpen(false);
    setView("mission_success");
  };

  // ✅ tutorial deploy restriction for UI button
  const tutorialDeployLocked =
    tutorialVisible && (focusPlanet?.id !== 1 || selectedHex !== TUTORIAL_TILE_ID);

  return (
    <div className="game-container">
      {/* GAME OVER */}
      {gameOver && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 20000,
            background: "rgba(0,0,0,0.92)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            padding: 24,
          }}
          onClick={() => window.location.reload()}
        >
          <div style={{ maxWidth: 720 }}>
            <h1 style={{ margin: 0, letterSpacing: 6 }}>GAME OVER</h1>
            <p style={{ marginTop: 12, opacity: 0.85, lineHeight: 1.5 }}>
              Your squad has been overrun. The Xenos don’t negotiate—only multiply.
              <br />
              Click to reboot the campaign.
            </p>
            <div style={{ marginTop: 18, opacity: 0.6, fontSize: 12 }}>(Click anywhere)</div>
          </div>
        </div>
      )}

      {view === "menu" && (
        <MainMenu
          onStart={() => {
            setHeroOptions(genUniqueHeroOptions(5));
            setSelectedHero(null);
            setView("hero_select");
          }}
        />
      )}

      {/* HERO SELECT */}
      {view === "hero_select" && (
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
                // NEW RUN RESET
                setRunId((n) => n + 1);

                setLives(5);
                setCrewXp(0);
                setResources(0);
    setTalentPills(0);
                setClearedHexes({});
                setFocusPlanet(null);
                setSelectedHex(null);
                setSelectedHexInfo(null);

                // shop/build
                setShopOpen(false);
                setShopUnlocked(false);
                setRunBuild({ purchased: {}, abilities: [], passives: [] });

                setCrew([]);

                // ✅ tutorial should appear when entering galaxy (first time this refresh),
                // but if player returns here without refreshing, ensure it can re-trigger:
                setTutorialShownThisSession(false);
                setTutorialVisible(false);
                setTutorialStep(0);

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

      {/* GALAXY */}
      {view === "galaxy" && (
        <div
          className="galaxy-container"
          onClick={() => {
            if (tutorialVisible) return; // ✅ no misclick unfocus during tutorial
            if (shopOpen) return;
            setFocusPlanet(null);
            setSelectedHex(null);
            setSelectedHexInfo(null);
          }}
        >
          {tutorialPulseStyle}

          {/* HUD */}
          <div className="hud" onClick={(e) => e.stopPropagation()}>
            <div>NAME: {selectedHero?.name || "UNKNOWN"}</div>
            <div>XP: {crewXp}</div>
            <div>RES: {resources}</div>
            <div>HP: {Math.max(0, lives)}</div>
          </div>

          {/* ✅ DISTINCT SHOP BUTTON (top-right), only after first win */}
          {shopUnlocked && (
            <button
              className="scifi-btn"
              onClick={(e) => {
                e.stopPropagation();
                setShopOpen((o) => !o);
              }}
              style={{
                position: "fixed",
                right: 24,
                top: 24,
                zIndex: 9200,
                padding: "14px 18px",
                letterSpacing: 3,
                borderRadius: 14,
                border: "2px solid rgba(255,0,122,0.55)",
                boxShadow: "0 0 18px rgba(255,0,122,0.25)",
                background: "rgba(255,0,122,0.14)",
                fontWeight: 900,
              }}
            >
              {shopOpen ? "CLOSE ARMORY" : "OPEN ARMORY"}
            </button>
          )}

          {/* SHOP PANEL */}
          {shopOpen && (
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                position: "fixed",
                left: 20,
                right: 20,
                top: 80,
                bottom: 20,
                zIndex: 9050,
                overflow: "auto",
                padding: 12,
                borderRadius: 18,
                background: "rgba(0,0,0,0.55)",
                border: "1px solid rgba(0,242,255,0.18)",
                boxShadow: "0 0 30px rgba(0,242,255,0.10)",
                backdropFilter: "blur(6px)",
              }}
            >
              <GalaxyShop
                title="GALAXY SHOP"
                credits={talentPills}
                onSpend={(amount) => setTalentPills((p) => Math.max(0, p - amount))}
                resetToken={runId}
                storageKey={null}
                onBuildChange={setRunBuild}
              />
            </div>
          )}

          {/* Tutorial arrows */}
          {tutorialVisible && tutorialStep === 1 && arrowPos && (
            <div
              style={{
                position: "fixed",
                left: arrowPos.left,
                top: arrowPos.top,
                zIndex: 9500,
                pointerEvents: "none",
                filter: "drop-shadow(0 0 10px rgba(0,255,136,0.45))",
                fontSize: 46,
                lineHeight: 1,
                animation: "xenoPulse 1.2s ease-in-out infinite",
              }}
            >
              ➜
            </div>
          )}

          {tutorialVisible && tutorialStep === 2 && tileArrowPos && (
            <div
              style={{
                position: "fixed",
                left: tileArrowPos.left,
                top: tileArrowPos.top,
                zIndex: 9500,
                pointerEvents: "none",
                filter: "drop-shadow(0 0 10px rgba(0,242,255,0.45))",
                fontSize: 46,
                lineHeight: 1,
                animation: "xenoPulse 1.2s ease-in-out infinite",
              }}
            >
              ⬇
            </div>
          )}

          {/* Tutorial panel */}
          {tutorialVisible && (
            <div
              style={{
                position: "fixed",
                left: "50%",
                bottom: 40,
                transform: "translateX(-50%)",
                width: "min(860px, calc(100vw - 80px))",
                zIndex: 9600,
                pointerEvents: "none",
              }}
            >
              <div
                style={{
                  display: "flex",
                  gap: 16,
                  alignItems: "stretch",
                  borderRadius: 18,
                  border: "1px solid rgba(0,242,255,0.35)",
                  background: "rgba(0,0,0,0.72)",
                  boxShadow: "0 0 30px rgba(0,242,255,0.10)",
                  padding: 16,
                }}
              >
                <div
                  style={{
                    width: 160,
                    minWidth: 160,
                    borderRadius: 14,
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    overflow: "hidden",
                  }}
                >
                  <img src={tubbe} alt="" draggable={false} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </div>

                <div style={{ flex: 1 }}>
                  <div style={{ letterSpacing: 3, fontWeight: 900, marginBottom: 6 }}>
                    ADMIRAL TOBIAS — XENO PURGE BRIEFING
                  </div>

                  <div style={{ opacity: 0.92, lineHeight: 1.45, fontSize: 16 }}>
                    {tutorialStep === 1 ? (
                      <>
                        Ohh… you don’t look like I expected. Listen—these Xenos breed faster than a bad rumor.
                        <br /><br />
                        Click the <strong>green world</strong>. That’s your first sterilization target.
                      </>
                    ) : (
                      <>
                        Good. Now I want one clean Zone.
                        <br /><br />
                        Click the <strong>marked tile</strong> and hit <strong>DEPLOY</strong>. No sightseeing. No detours.
                        <br /><br />
                        Come back alive and Command will authorize your first upgrades.
                      </>
                    )}

                    <div style={{ marginTop: 10, opacity: 0.75, fontSize: 12 }}>
                      (Tutorial shows on first galaxy entry each refresh.)
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SHOW ALL button */}
          {focusPlanet && (
            <button
              className="scifi-btn"
              style={{
                position: "fixed",
                left: 24,
                top: 110,
                zIndex: 9100,
                padding: "10px 14px",
                letterSpacing: 2,
              }}
              onClick={(e) => {
                e.stopPropagation();
                if (tutorialVisible) return; // ✅ locked during tutorial
                setFocusPlanet(null);
                setSelectedHex(null);
                setSelectedHexInfo(null);
              }}
            >
              SHOW ALL
            </button>
          )}

          {/* PLANETS */}
          {PLANETS.map((p) => (
            <div
              key={p.id}
              ref={(el) => {
                if (el) planetRefs.current[p.id] = el;
              }}
              className={`planet ${focusPlanet?.id === p.id ? "focused" : ""}`}
              style={{
                width: focusPlanet?.id === p.id ? "620px" : "100px",
                height: focusPlanet?.id === p.id ? "620px" : "100px",
                left: focusPlanet?.id === p.id ? "50%" : `calc(50% + ${p.x}px)`,
                top: focusPlanet?.id === p.id ? "50%" : `calc(50% + ${p.y}px)`,
                transform: focusPlanet?.id === p.id ? "translate(-50%,-50%)" : "none",
                background: focusPlanet?.id === p.id ? "#050a15" : p.color,
                border: focusPlanet?.id === p.id ? `4px solid ${p.color}` : "none",
              }}
              onClick={(e) => {
                e.stopPropagation();

                // ✅ Tutorial step 1: ONLY allow clicking the green planet
                if (tutorialVisible && tutorialStep === 1) {
                  if (p.id !== 1) return;
                  setFocusPlanet(p);
                  setSelectedHex(null);
                  setSelectedHexInfo(null);
                  setTutorialStep(2);
                  return;
                }

                // ✅ Tutorial step 2: keep player on green planet (no swapping / unfocus)
                if (tutorialVisible && tutorialStep === 2) {
                  if (p.id !== 1) return;
                  setFocusPlanet(p);
                  return;
                }

                // normal behavior
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
                {hexGrid.map((h) => {
                  const cleared = (clearedHexes[p.id] || []).includes(h.id);

                  return (
                    <div
                      key={h.id}
                      data-hex-id={h.id}
                      className={`hex-unit ${selectedHex === h.id ? "active" : ""} ${cleared ? "cleared" : ""}`}
                      style={{
                        left: `calc(50% + ${h.x}px)`,
                        top: `calc(50% + ${h.y}px)`,
                        transform: "translate(-50%,-50%)",
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (cleared) return;

                        // ✅ Tutorial step 2: ONLY allow selecting the forced tile
                        if (tutorialVisible && tutorialStep === 2 && h.id !== TUTORIAL_TILE_ID) return;

                        setSelectedHex(h.id);
                        setSelectedHexInfo({
                          difficulty: h.difficulty + (p.difficulty - 1),
                          reward: (h.difficulty + (p.difficulty - 1)) * 20,
                        });

                        // ✅ DO NOT end tutorial here — ends on DEPLOY
                      }}
                    />
                  );
                })}
              </div>
            </div>
          ))}

          {/* Tile info panel */}
          {focusPlanet && selectedHexInfo && (
            <div
              className="tile-panel"
              onClick={(e) => e.stopPropagation()}
              style={{
                position: "fixed",
                right: 60,
                top: 120,
                width: 360,
                zIndex: 9000,
                border: "1px solid rgba(0,242,255,0.35)",
                background: "rgba(0,0,0,0.65)",
                boxShadow: "0 0 30px rgba(0,242,255,0.08)",
                padding: 18,
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
                let rewardColor = "rgba(255,255,255,0.65)";
                if (reward >= 200) rewardColor = "#ff007a";
                else if (reward >= 140) rewardColor = "#ff9d00";
                else if (reward >= 80) rewardColor = "#00f2ff";

                return (
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                    <span style={{ opacity: 0.8 }}>Rewards</span>
                    <strong style={{ color: rewardColor, letterSpacing: 1 }}>+{reward}</strong>
                  </div>
                );
              })()}

              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                <span style={{ opacity: 0.8 }}>HP</span>
                <strong>{Math.max(0, lives)}</strong>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
                <span style={{ opacity: 0.8 }}>Resources</span>
                <strong>{resources}</strong>
              </div>

              <div style={{ height: 1, background: "rgba(0,242,255,0.18)", margin: "14px 0" }} />

              <button
                className="scifi-btn"
                style={{ width: "100%", padding: "14px 16px", letterSpacing: 3 }}
                onClick={dropToHex}
                disabled={!selectedHex || selectedIsCleared || tutorialDeployLocked}
              >
                {selectedIsCleared ? "CLEARED" : "DEPLOY"}
              </button>

              <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75 }}>
                {tutorialDeployLocked
                  ? "Training lock: deploy the marked Zone."
                  : selectedIsCleared
                    ? "Zone already sterilized. Choose a new tile."
                    : "Confirm drop coordinates and deploy."}
              </div>
            </div>
          )}
        </div>
      )}

      {/* droppod.mp4 interstitial */}
      {view === "deploy_video" && (
        <div className="video-layer" style={{ position: "fixed", inset: 0, zIndex: 9999, background: "black" }}>
          <video
            src={droppod}
            autoPlay
            muted
            playsInline
            onEnded={() => setView("combat")}
            style={{ width: "100%", height: "100%", objectFit: "contain" }}
          />
          <button className="scifi-btn" style={{ position: "absolute", right: 20, bottom: 20 }} onClick={() => setView("combat")}>
            SKIP
          </button>
        </div>
      )}

      {/* mission success video */}
      {view === "mission_success" && (
        <div className="video-layer" style={{ position: "fixed", inset: 0, zIndex: 9999, background: "black" }}>
          <video
            src={missionsuccess}
            autoPlay
            muted
            playsInline
            onEnded={() => setView("galaxy")}
            style={{ width: "100%", height: "100%", objectFit: "contain" }}
          />
          <button className="scifi-btn" style={{ position: "absolute", right: 20, bottom: 20 }} onClick={() => setView("galaxy")}>
            CONTINUE
          </button>
        </div>
      )}

      {/* COMBAT */}
{view === "combat" && (
  <Combat
    crew={crew}
    tileDifficulty={selectedHexInfo?.difficulty || 1}
    selectedHero={selectedHero}   // ✅ add this
    runBuild={runBuild}
    onExit={() => {
      setLives((l) => l - 1);
      setShopOpen(false);
      setView("galaxy");
    }}
    onVictory={handleVictory}
  />
)}
    </div>
  );
}

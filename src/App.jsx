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
const LEADERBOARD_URL = "https://69787eb6cd4fe130e3d91a96.mockapi.io/Leaderboard";
const BASE_MATCH_MS = 240000;

const rollMatchLengthMs = (difficulty = 1) => {
  const d = Math.max(1, Math.min(5, Math.round(difficulty || 1)));
  const ranges = {
    1: [175000, 230000],
    2: [255000, 340000],
    3: [420000, 560000],
    4: [720000, 900000],
    5: [1320000, 1680000],
  };
  const [min, max] = ranges[d] || ranges[3];
  return Math.round(min + Math.random() * (max - min));
};
const matchLengthLabel = (ms = BASE_MATCH_MS) => {
  if (ms <= 100000) return "SHORT";
  if (ms <= 160000) return "MEDIUM";
  if (ms <= 300000) return "LONG";
  if (ms <= 600000) return "EXTRA LONG";
  return "INSANE";
};

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

const hashString = (value = "") => {
  let h = 0;
  const s = String(value || "");
  for (let i = 0; i < s.length; i += 1) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
};

const leaderboardPortraitFor = (row = {}) => {
  if (row.characterPortrait) return row.characterPortrait;
  return HERO_PORTRAITS[hashString(row.characterName || row.name || row.id || "operator") % HERO_PORTRAITS.length];
};

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
  const [leaderboardPoints, setLeaderboardPoints] = useState(0);
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const [leaderboardRows, setLeaderboardRows] = useState([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [selectedLeaderboardPlayer, setSelectedLeaderboardPlayer] = useState(null);
  const [leaderboardDeaths, setLeaderboardDeaths] = useState(0);
  const [leaderboardTilesCleared, setLeaderboardTilesCleared] = useState(0);
  const [leaderboardKills, setLeaderboardKills] = useState(0);
  const [leaderboardRecordId, setLeaderboardRecordId] = useState(null);
  const [combatCtx, setCombatCtx] = useState(null);

  // hero selection
  const [heroOptions, setHeroOptions] = useState(() => genUniqueHeroOptions(5));
  const [selectedHero, setSelectedHero] = useState(null);
  const [playerName, setPlayerName] = useState("");

  // Perks/talents persist for the session (until browser restart) per character.
  const shopStorageKey = selectedHero?.id ? `hero:${selectedHero.id}` : null;

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

  const cleanPlayerName = () => playerName.trim().slice(0, 24) || selectedHero?.name || "UNKNOWN";

  const normalizeName = (name) => String(name || "").trim().toLowerCase();

  const mergeLeaderboardRows = async (rows) => {
    const groups = new Map();
    (Array.isArray(rows) ? rows : []).forEach((row) => {
      const key = normalizeName(row.name);
      if (!key) return;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(row);
    });

    const merged = [];
    for (const group of groups.values()) {
      const [primary, ...dupes] = group.sort((a, b) => Number(a.id || 0) - Number(b.id || 0));
      const combined = {
        ...primary,
        points: Math.max(...group.map((r) => Number(r.points || 0))),
        tilesCleared: Math.max(...group.map((r) => Number(r.tilesCleared || r.tiles || 0))),
        deaths: Math.max(...group.map((r) => Number(r.deaths || 0))),
        kills: Math.max(...group.map((r) => Number(r.kills || 0))),
      };
      merged.push(combined);
      if (dupes.length && primary?.id) {
        try {
          await fetch(`${LEADERBOARD_URL}/${primary.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(combined),
          });
          await Promise.all(dupes.map((d) => d?.id ? fetch(`${LEADERBOARD_URL}/${d.id}`, { method: "DELETE" }).catch(() => {}) : null));
        } catch {}
      }
    }
    return merged;
  };

  const submitLeaderboard = async (snapshot = {}) => {
    const name = String(snapshot.name || cleanPlayerName()).trim().slice(0, 24);
    const score = Math.max(0, Math.round(snapshot.points ?? leaderboardPoints ?? 0));
    const tilesCleared = Math.max(0, Math.round(snapshot.tilesCleared ?? leaderboardTilesCleared ?? 0));
    const deaths = Math.max(0, Math.round(snapshot.deaths ?? leaderboardDeaths ?? 0));
    const kills = Math.max(0, Math.round(snapshot.kills ?? leaderboardKills ?? 0));
    if (!name) return;
    try {
      const res = await fetch(LEADERBOARD_URL);
      const rows = res.ok ? await res.json() : [];
      const mergedRows = await mergeLeaderboardRows(rows);
      const existing = mergedRows.find((r) => normalizeName(r.name) === normalizeName(name)) || null;
      const pickedWeapons = (snapshot.lastRunSummary?.weapons || []).map((w) => w.id).filter(Boolean);
      const weaponPickCounts = { ...(existing?.weaponPickCounts || {}) };
      if (snapshot.lastRunSummary?.result) {
        pickedWeapons.forEach((id) => { weaponPickCounts[id] = Number(weaponPickCounts[id] || 0) + 1; });
      }
      const payload = {
        name,
        characterName: snapshot.characterName || selectedHero?.name || existing?.characterName || "",
        characterPortrait: snapshot.characterPortrait || selectedHero?.portrait || existing?.characterPortrait || "",
        points: Math.max(score, Number(existing?.points || 0)),
        tilesCleared: Math.max(tilesCleared, Number(existing?.tilesCleared || existing?.tiles || 0)),
        deaths: Math.max(deaths, Number(existing?.deaths || 0)),
        kills: Math.max(kills, Number(existing?.kills || 0)),
        lastRunPoints: score,
        lastRunKills: Math.max(0, Math.round(snapshot.lastRunKills ?? 0)),
        lastRunSummary: snapshot.lastRunSummary || existing?.lastRunSummary || null,
        runs: Number(existing?.runs || 0) + (snapshot.lastRunSummary?.result ? 1 : 0),
        wins: Number(existing?.wins || 0) + (String(snapshot.lastRunSummary?.result || "").toUpperCase() === "CLEARED" ? 1 : 0),
        losses: Number(existing?.losses || 0) + (String(snapshot.lastRunSummary?.result || "").toUpperCase() === "DEFEATED" ? 1 : 0),
        weaponPickCounts,
        updatedAt: new Date().toISOString()
      };
      if (existing?.id) {
        setLeaderboardRecordId(existing.id);
        await fetch(`${LEADERBOARD_URL}/${existing.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        const created = await fetch(LEADERBOARD_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (created.ok) {
          const row = await created.json().catch(() => null);
          if (row?.id) setLeaderboardRecordId(row.id);
        }
      }
    } catch {}
  };

  useEffect(() => {
    const raw = localStorage.getItem("browsergame_pending_leaderboard");
    if (!raw) return;
    try {
      const pending = JSON.parse(raw);
      if (pending?.name) {
        const prevName = playerName;
        if (!prevName && pending.name) setPlayerName(pending.name);
        submitLeaderboard(pending);
      }
      localStorage.removeItem("browsergame_pending_leaderboard");
    } catch {
      localStorage.removeItem("browsergame_pending_leaderboard");
    }
  }, []);

  const loadLeaderboard = async () => {
    setLeaderboardLoading(true);
    try {
      const res = await fetch(LEADERBOARD_URL);
      const rows = res.ok ? await res.json() : [];
      const mergedRows = await mergeLeaderboardRows(rows);
      setLeaderboardRows(
        mergedRows
          .sort((a, b) => Number(b.points || 0) - Number(a.points || 0))
          .slice(0, 50)
      );
    } catch {
      setLeaderboardRows([]);
    } finally {
      setLeaderboardLoading(false);
    }
  };

  const statsOverview = useMemo(() => {
    const rows = Array.isArray(leaderboardRows) ? leaderboardRows : [];
    const totalRuns = rows.reduce((sum, r) => sum + Math.max(1, Number(r.runs || 1)), 0);
    const wins = rows.filter((r) => String(r.lastRunSummary?.result || "").toUpperCase() === "CLEARED").length;
    const losses = rows.filter((r) => String(r.lastRunSummary?.result || "").toUpperCase() === "DEFEATED").length;
    const weaponMap = new Map();
    const enemyMap = new Map();
    rows.forEach((row) => {
      const s = row.lastRunSummary || {};
      (s.weapons || []).forEach((w) => {
        const key = w.id || "UNKNOWN";
        const cur = weaponMap.get(key) || { id: key, runs: 0, levels: 0, kills: 0 };
        cur.runs += 1;
        cur.levels += Number(w.level || 0);
        cur.kills += Number(s.kills || 0);
        weaponMap.set(key, cur);
      });
      Object.entries(s.killsByType || {}).forEach(([type, count]) => {
        enemyMap.set(type, (enemyMap.get(type) || 0) + Number(count || 0));
      });
    });
    return {
      players: rows.length,
      totalRuns,
      wins,
      losses,
      successRate: rows.length ? Math.round((wins / rows.length) * 100) : 0,
      failRate: rows.length ? Math.round((losses / rows.length) * 100) : 0,
      weapons: [...weaponMap.values()].sort((a, b) => b.kills - a.kills).slice(0, 12),
      enemies: [...enemyMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12),
    };
  }, [leaderboardRows]);

  const mostKillsChampion = useMemo(() => {
    const rows = Array.isArray(leaderboardRows) ? leaderboardRows : [];
    return rows
      .filter((row) => Number(row.kills || 0) > 0)
      .sort((a, b) => Number(b.kills || 0) - Number(a.kills || 0))[0] || null;
  }, [leaderboardRows]);

  const getPlayerStats = (row = {}) => {
    const s = row.lastRunSummary || {};
    const weapons = Array.isArray(s.weapons) ? s.weapons : [];
    const favorite = weapons[0]?.id || s.mvpWeapon || "N/A";
    const allWeapons = ["RIFLE", "SMG", "SHOTGUN", "LASER", "SNIPER", "TESLA", "ROCKET", "VOID", "TIME", "AXE", "KATANA"];
    const counts = row.weaponPickCounts || {};
    const hated = [...allWeapons].sort((a, b) => Number(counts[a] || 0) - Number(counts[b] || 0))[0] || "N/A";
    return {
      summary: s,
      weapons,
      talents: Array.isArray(s.talents) ? s.talents.filter((t) => Number(t.rank || 0) > 1) : [],
      favorite,
      hated,
      runs: Number(row.runs || 0),
      wins: Number(row.wins || 0),
      losses: Number(row.losses || 0),
      killsByType: Object.entries(s.killsByType || {}).sort((a, b) => Number(b[1]) - Number(a[1])),
      killedByMost: Number(row.deaths || 0) > 0 ? (row.killedByMost || s.killedByMost || "Unknown") : "N/A",
    };
  };

  const startWithoutTutorial = () => {
    submitLeaderboard({ points: leaderboardPoints, tilesCleared: leaderboardTilesCleared, deaths: leaderboardDeaths, kills: leaderboardKills });
    setTutorialShownThisSession(true);
    setTutorialVisible(false);
    setTutorialStep(0);
    setShopUnlocked(true);
    setTalentPills(1);
    setView("galaxy");
  };

  const startTutorial = () => {
    submitLeaderboard({ points: leaderboardPoints, tilesCleared: leaderboardTilesCleared, deaths: leaderboardDeaths, kills: leaderboardKills });
    setShopUnlocked(false);
    setTalentPills(0);
    setTutorialShownThisSession(false);
    setTutorialVisible(false);
    setTutorialStep(0);
    setView("galaxy");
  };

  // Roguelite hard reset after 5 deaths (auto-refresh)
  useEffect(() => {
    if (!gameOver) return;
    submitLeaderboard({ points: leaderboardPoints, tilesCleared: leaderboardTilesCleared, deaths: leaderboardDeaths, kills: leaderboardKills });
    const t = setTimeout(() => {
      window.location.reload();
    }, 1400);
    return () => clearTimeout(t);
  }, [gameOver]);

  useEffect(() => {
    const onUnload = () => {
      const name = cleanPlayerName();
      if (!name) return;
      const payload = JSON.stringify({
        name,
        points: Math.max(0, Math.round(leaderboardPoints || 0)),
        tilesCleared: Math.max(0, Math.round(leaderboardTilesCleared || 0)),
        deaths: Math.max(0, Math.round(leaderboardDeaths || 0)),
        kills: Math.max(0, Math.round(leaderboardKills || 0)),
        characterName: selectedHero?.name || "",
        characterPortrait: selectedHero?.portrait || "",
        lastRunPoints: Math.max(0, Math.round(leaderboardPoints || 0)),
        updatedAt: new Date().toISOString(),
      });
      try {
        if (leaderboardRecordId) {
          fetch(`${LEADERBOARD_URL}/${leaderboardRecordId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: payload, keepalive: true });
        } else {
          localStorage.setItem("browsergame_pending_leaderboard", payload);
        }
      } catch {}
    };
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, [leaderboardPoints, leaderboardTilesCleared, leaderboardDeaths, leaderboardKills, leaderboardRecordId, playerName, selectedHero?.name]);

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

  const highestUnlockedDifficulty = useMemo(() => {
    let highestCleared = 0;
    for (const p of PLANETS) {
      const cleared = new Set(clearedHexes[p.id] || []);
      if (!cleared.size) continue;
      for (const h of hexGrid) {
        if (!cleared.has(h.id)) continue;
        highestCleared = Math.max(highestCleared, Math.min(5, h.difficulty + (p.difficulty - 1)));
      }
    }
    return Math.min(5, Math.max(1, highestCleared + 1));
  }, [clearedHexes, hexGrid]);

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
    if ((selectedHexInfo?.difficulty || 1) > highestUnlockedDifficulty) return;
    setShopOpen(false);

    setCombatCtx({
      planetId: focusPlanet?.id,
      hexId: selectedHex,
      reward: selectedHexInfo?.reward || 0,
      difficulty: selectedHexInfo?.difficulty || 1,
      runTimeMs: selectedHexInfo?.runTimeMs || rollMatchLengthMs(selectedHexInfo?.difficulty || 1),
      requiresExtraction: !!selectedHexInfo?.requiresExtraction,
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

  const handleVictory = (summary = {}) => {
    const runKills = Math.max(0, Math.round(summary.kills || 0));
    if (runKills > 0) setLeaderboardKills((k) => k + runKills);
    if (combatCtx?.planetId && combatCtx?.hexId) {
      setClearedHexes((prev) => {
        const current = new Set(prev[combatCtx.planetId] || []);
        const already = current.has(combatCtx.hexId);

        if (!already) {
          current.add(combatCtx.hexId);

          // Roguelite talent points: up to 3 based on cleared map difficulty.
          const earnedPills = Math.min(3, Math.max(1, Math.ceil((combatCtx.difficulty || 1) / 2)));
          setTalentPills((p) => p + earnedPills);

          const reward = combatCtx.reward || 0;
          if (reward > 0) {
            setCrewXp((xp) => xp + reward);
            setResources((r) => r + reward);
          }

          const earnedScore = 5 + (combatCtx.difficulty || 1);
          setLeaderboardPoints((pts) => {
            const next = pts + earnedScore;
            const nextTiles = leaderboardTilesCleared + 1;
            setLeaderboardTilesCleared(nextTiles);
            submitLeaderboard({
              points: next,
              tilesCleared: nextTiles,
              deaths: leaderboardDeaths,
              kills: leaderboardKills + runKills,
              characterName: selectedHero?.name || "",
              characterPortrait: selectedHero?.portrait || "",
              lastRunKills: runKills,
              lastRunSummary: summary,
            });
            return next;
          });

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
            setPlayerName("");
            setView("hero_select");
          }}
        />
      )}

      {/* HERO SELECT */}
      {view === "hero_select" && (
        <div className="ui-layer" style={{ background: "rgba(0,0,0,0.85)", padding: 24 }}>
          <h1 style={{ marginTop: 0, letterSpacing: 6 }}>CHOOSE YOUR OPERATIVE</h1>

          <input
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value.slice(0, 24))}
            placeholder="Enter Name"
            style={{
              width: "min(420px, calc(100vw - 48px))",
              marginTop: 12,
              padding: "14px 16px",
              border: "1px solid rgba(0,242,255,0.45)",
              background: "rgba(0,0,0,0.55)",
              color: "white",
              fontFamily: "inherit",
              letterSpacing: 2,
              textAlign: "center",
              outline: "none",
            }}
          />

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
              disabled={!selectedHero || !playerName.trim()}
              onClick={() => {
                // NEW RUN RESET
                setRunId((n) => n + 1);

                setLives(5);
                setCrewXp(0);
                setResources(0);
                setTalentPills(0);
                setLeaderboardPoints(0);
                setLeaderboardDeaths(0);
                setLeaderboardTilesCleared(0);
                setLeaderboardRecordId(null);
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

                setView("start_choice");
              }}
            >
              CONFIRM
            </button>
          </div>

        </div>
      )}

      {view === "start_choice" && (
        <div className="ui-layer" style={{ background: "rgba(0,0,0,0.90)", padding: 24 }}>
          <div
            style={{
              width: "min(560px, calc(100vw - 40px))",
              border: "1px solid rgba(0,242,255,0.35)",
              background: "rgba(3,8,18,0.94)",
              boxShadow: "0 0 34px rgba(0,242,255,0.16), inset 0 0 24px rgba(255,0,122,0.08)",
              padding: 24,
              textAlign: "center",
            }}
          >
            <h1 style={{ margin: 0, letterSpacing: 5 }}>MISSION START</h1>
            <p style={{ opacity: 0.82, margin: "12px 0 20px", lineHeight: 1.45 }}>
              Choose how this operative enters the campaign.
            </p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
              <button className="scifi-btn" onClick={startWithoutTutorial}>
                Lets kill some Zenos
              </button>
              <button className="scifi-btn" onClick={startTutorial}>
                Tutorial
              </button>
            </div>
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
            <div>NAME: {cleanPlayerName()}</div>
            <div>LIVES: {Math.max(0, lives)}</div>
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

          {view === "galaxy" && (
            <button
              className="scifi-btn"
              onClick={(e) => {
                e.stopPropagation();
                const next = !leaderboardOpen;
                setLeaderboardOpen(next);
                setStatsOpen(false);
                if (next) loadLeaderboard();
              }}
              style={{
                position: "fixed",
                right: shopUnlocked ? 245 : 24,
                top: 24,
                zIndex: 9200,
                padding: "14px 18px",
                letterSpacing: 3,
                borderRadius: 14,
                border: "2px solid rgba(0,242,255,0.50)",
                boxShadow: "0 0 18px rgba(0,242,255,0.18)",
                background: "rgba(0,242,255,0.10)",
                fontWeight: 900,
              }}
            >
              LEADERBOARD
            </button>
          )}

          {view === "galaxy" && (
            <button
              className="scifi-btn"
              onClick={(e) => {
                e.stopPropagation();
                const next = !statsOpen;
                setStatsOpen(next);
                setLeaderboardOpen(false);
                if (next && leaderboardRows.length === 0) loadLeaderboard();
              }}
              style={{
                position: "fixed",
                right: shopUnlocked ? 475 : 255,
                top: 24,
                zIndex: 9200,
                padding: "14px 18px",
                letterSpacing: 3,
                borderRadius: 14,
                border: "2px solid rgba(255,218,107,0.55)",
                boxShadow: "0 0 18px rgba(255,218,107,0.18)",
                background: "rgba(255,218,107,0.10)",
                color: "#ffe16b",
                fontWeight: 900,
              }}
            >
              STATS
            </button>
          )}

          {leaderboardOpen && (
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                position: "fixed",
                inset: 0,
                zIndex: 9400,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 24,
                background: "rgba(0,0,0,0.64)",
                backdropFilter: "blur(5px)",
              }}
            >
              <div
                style={{
                  width: "min(1280px, calc(100vw - 48px))",
                  maxHeight: "82vh",
                  overflow: "auto",
                  border: "1px solid rgba(0,242,255,0.42)",
                  background: "linear-gradient(180deg, rgba(5,12,22,0.96), rgba(0,0,0,0.94))",
                  boxShadow: "0 0 42px rgba(0,242,255,0.20), inset 0 0 28px rgba(0,242,255,0.05)",
                  padding: 18,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, marginBottom: 14 }}>
                  <div>
                    <h2 style={{ margin: 0, letterSpacing: 5, fontSize: 24 }}>LEADERBOARD</h2>
                    <div style={{ opacity: 0.72, fontSize: 12, letterSpacing: 2, marginTop: 4 }}>RUNS ENGRAVED FOREVER</div>
                  </div>
                  <button
                    className="scifi-btn"
                    onClick={() => setLeaderboardOpen(false)}
                    style={{ minWidth: 48, padding: "10px 14px", borderColor: "rgba(255,255,255,0.28)" }}
                  >
                    X
                  </button>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "300px minmax(720px, 1fr)", gap: 18, alignItems: "start" }}>
                  <div
                    style={{
                      border: "1px solid rgba(255,55,80,0.50)",
                      background: "radial-gradient(circle at 50% 18%, rgba(255,0,45,0.30), rgba(20,0,5,0.82) 58%, rgba(0,0,0,0.92))",
                      boxShadow: "0 0 36px rgba(255,0,45,0.28), inset 0 0 30px rgba(255,0,45,0.12)",
                      padding: 16,
                      minHeight: 430,
                      textAlign: "center",
                    }}
                  >
                    <div style={{ color: "#ff3958", letterSpacing: 4, fontWeight: 900, fontSize: 14 }}>MOST KILLS</div>
                    {mostKillsChampion ? (() => {
                      const portraitSrc = leaderboardPortraitFor(mostKillsChampion);
                      const portraitFallback = HERO_PORTRAITS[hashString(mostKillsChampion.characterName || mostKillsChampion.name || mostKillsChampion.id || "operator") % HERO_PORTRAITS.length];
                      return (
                        <>
                          <div
                            style={{
                              width: 210,
                              height: 210,
                              margin: "18px auto 14px",
                              borderRadius: 12,
                              overflow: "hidden",
                              border: "2px solid rgba(255,57,88,0.70)",
                              background: "rgba(255,255,255,0.08)",
                              boxShadow: "0 0 32px rgba(255,0,45,0.52)",
                              position: "relative",
                              display: "grid",
                              placeItems: "center",
                            }}
                          >
                            <span style={{ position: "absolute", color: "rgba(255,57,88,0.70)", fontSize: 74, fontWeight: 900 }}>{String(mostKillsChampion.name || "?").slice(0, 1).toUpperCase()}</span>
                            <img
                              src={portraitSrc}
                              alt=""
                              onError={(e) => {
                                if (e.currentTarget.dataset.fallback !== "1") {
                                  e.currentTarget.dataset.fallback = "1";
                                  e.currentTarget.src = portraitFallback;
                                } else {
                                  e.currentTarget.style.display = "none";
                                }
                              }}
                              style={{ width: "100%", height: "100%", objectFit: "cover", position: "relative", zIndex: 1 }}
                            />
                          </div>
                          <h3 style={{ margin: "0 auto", maxWidth: 250, fontSize: 23, letterSpacing: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{mostKillsChampion.name || "UNKNOWN"}</h3>
                          <div style={{ marginTop: 6, opacity: 0.78, fontSize: 12, letterSpacing: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{mostKillsChampion.characterName || "Unlisted Operator"}</div>
                          <strong style={{ display: "block", marginTop: 18, color: "#ff3958", fontSize: 34, letterSpacing: 2 }}>{Number(mostKillsChampion.kills || 0).toLocaleString()}</strong>
                          <div style={{ marginTop: 4, letterSpacing: 3, color: "rgba(255,230,235,0.88)", fontWeight: 900 }}>ZENOS SLAIN</div>
                        </>
                      );
                    })() : (
                      <div style={{ marginTop: 120, opacity: 0.72, letterSpacing: 2, lineHeight: 1.5 }}>NO KILL CHAMPION YET</div>
                    )}
                  </div>

                  <div style={{ minWidth: 0, overflowX: "auto" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "58px minmax(240px, 1fr) 120px 120px 120px 120px", gap: 12, padding: "10px 12px", color: "rgba(190,235,255,0.82)", fontSize: 11, letterSpacing: 2, borderBottom: "1px solid rgba(255,255,255,0.12)" }}>
                      <b>RANK</b><b>PLAYER</b><b style={{ textAlign: "right" }}>POINTS</b><b style={{ textAlign: "right" }}>TILES</b><b style={{ textAlign: "right" }}>DEATHS</b><b style={{ textAlign: "right" }}>KILLS</b>
                    </div>

                    {leaderboardLoading && <div style={{ opacity: 0.75, padding: 18 }}>LOADING...</div>}
                    {!leaderboardLoading && leaderboardRows.length === 0 && <div style={{ opacity: 0.75, padding: 18 }}>NO SCORES YET</div>}
                    {!leaderboardLoading && leaderboardRows.map((row, i) => {
                      const topColors = ["rgba(255,218,107,0.20)", "rgba(210,230,255,0.16)", "rgba(255,154,82,0.15)"];
                      const rankColor = i === 0 ? "#ffe16b" : i === 1 ? "#d9ecff" : i === 2 ? "#ffb36b" : "rgba(255,255,255,0.72)";
                      const portraitSrc = leaderboardPortraitFor(row);
                      const portraitFallback = HERO_PORTRAITS[hashString(row.characterName || row.name || row.id || "operator") % HERO_PORTRAITS.length];
                      return (
                        <div
                          key={row.id || `${row.name}-${i}`}
                          role="button"
                          tabIndex={0}
                          onClick={() => setSelectedLeaderboardPlayer(row)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") setSelectedLeaderboardPlayer(row);
                          }}
                          style={{
                            display: "grid",
                            gridTemplateColumns: "58px minmax(240px, 1fr) 120px 120px 120px 120px",
                            gap: 12,
                            padding: "12px",
                            borderBottom: "1px solid rgba(255,255,255,0.08)",
                            alignItems: "center",
                            background: topColors[i] || "rgba(255,255,255,0.025)",
                            boxShadow: i < 3 ? `inset 3px 0 0 ${rankColor}` : undefined,
                            cursor: "pointer",
                          }}
                        >
                          <b style={{ color: rankColor, fontSize: 18 }}>{i + 1}</b>
                          <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                            <div style={{ width: 46, height: 46, borderRadius: 8, overflow: "hidden", border: "1px solid rgba(0,242,255,0.35)", background: "rgba(0,242,255,0.08)", flex: "0 0 auto", position: "relative", display: "grid", placeItems: "center" }}>
                              <span style={{ position: "absolute", color: "rgba(0,242,255,0.85)", fontWeight: 900 }}>{String(row.name || "?").slice(0, 1).toUpperCase()}</span>
                              <img
                                src={portraitSrc}
                                alt=""
                                onError={(e) => {
                                  if (e.currentTarget.dataset.fallback !== "1") {
                                    e.currentTarget.dataset.fallback = "1";
                                    e.currentTarget.src = portraitFallback;
                                  } else {
                                    e.currentTarget.style.display = "none";
                                  }
                                }}
                                style={{ width: "100%", height: "100%", objectFit: "cover", position: "relative", zIndex: 1 }}
                              />
                            </div>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontWeight: 900, letterSpacing: 1.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.name || "UNKNOWN"}</div>
                              <div style={{ opacity: 0.72, fontSize: 12, marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.characterName || "Unlisted Operator"}</div>
                            </div>
                          </div>
                          <strong style={{ color: "#ffe16b", textAlign: "right", fontSize: 18 }}>{Number(row.points || 0)}</strong>
                          <span style={{ opacity: 0.88, textAlign: "right" }}>{Number(row.tilesCleared || row.tiles || 0)} cleared</span>
                          <span style={{ opacity: 0.88, textAlign: "right" }}>{Number(row.deaths || 0)} deaths</span>
                          <span style={{ opacity: 0.88, textAlign: "right" }}>{Number(row.kills || 0).toLocaleString()} kills</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {selectedLeaderboardPlayer && (() => {
            const row = selectedLeaderboardPlayer;
            const ps = getPlayerStats(row);
            const portraitSrc = leaderboardPortraitFor(row);
            return (
              <div
                onClick={(e) => e.stopPropagation()}
                style={{
                  position: "fixed",
                  inset: 0,
                  zIndex: 9600,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 24,
                  background: "rgba(0,0,0,0.68)",
                  backdropFilter: "blur(5px)",
                }}
              >
                <div
                  style={{
                    width: "min(880px, calc(100vw - 48px))",
                    maxHeight: "84vh",
                    overflow: "auto",
                    border: "1px solid rgba(0,242,255,0.42)",
                    background: "linear-gradient(180deg, rgba(5,12,22,0.97), rgba(0,0,0,0.95))",
                    boxShadow: "0 0 42px rgba(0,242,255,0.20), inset 0 0 28px rgba(0,242,255,0.05)",
                    padding: 18,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center", marginBottom: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
                      <img src={portraitSrc} alt="" style={{ width: 64, height: 64, borderRadius: 8, objectFit: "cover", border: "1px solid rgba(0,242,255,0.42)" }} />
                      <div style={{ minWidth: 0 }}>
                        <h2 style={{ margin: 0, letterSpacing: 4, fontSize: 22, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.name || "UNKNOWN"}</h2>
                        <div style={{ opacity: 0.72, fontSize: 12, letterSpacing: 2, marginTop: 4 }}>{row.characterName || "Unlisted Operator"}</div>
                      </div>
                    </div>
                    <button className="scifi-btn" onClick={() => setSelectedLeaderboardPlayer(null)} style={{ minWidth: 48, padding: "10px 14px", borderColor: "rgba(255,255,255,0.28)" }}>X</button>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10, marginBottom: 14 }}>
                    {[
                      ["POINTS", Number(row.points || 0)],
                      ["KILLS", Number(row.kills || 0).toLocaleString()],
                      ["DEATHS", Number(row.deaths || 0)],
                      ["TILES", Number(row.tilesCleared || row.tiles || 0)],
                      ["RUNS", ps.runs || "N/A"],
                      ["WINS", ps.wins || 0],
                      ["FAILS", ps.losses || 0],
                      ["SUCCESS", ps.runs ? `${Math.round((ps.wins / Math.max(1, ps.runs)) * 100)}%` : "N/A"],
                      ["KILLED BY", ps.killedByMost],
                    ].map(([label, value]) => (
                      <div key={label} style={{ border: "1px solid rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.04)", padding: 12 }}>
                        <div style={{ fontSize: 11, opacity: 0.72, letterSpacing: 2 }}>{label}</div>
                        <strong style={{ display: "block", marginTop: 6, fontSize: 20, color: "#ffe16b" }}>{value}</strong>
                      </div>
                    ))}
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                    <div style={{ border: "1px solid rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.035)", padding: 14 }}>
                      <strong style={{ letterSpacing: 3 }}>LOADOUT READ</strong>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
                        <div><span style={{ opacity: 0.7 }}>Favorite</span><b style={{ display: "block", color: "#ffe16b" }}>{ps.favorite}</b></div>
                        <div><span style={{ opacity: 0.7 }}>Most hated</span><b style={{ display: "block", color: "#ff7a7a" }}>{ps.hated}</b></div>
                      </div>
                    </div>

                    <div style={{ border: "1px solid rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.035)", padding: 14 }}>
                      <strong style={{ letterSpacing: 3 }}>TALENTS</strong>
                      {ps.talents.map((t) => (
                        <div key={t.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "9px 0", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                          <span>{t.id}</span><b>Rank {t.rank}</b>
                        </div>
                      ))}
                      {ps.talents.length === 0 && <div style={{ opacity: 0.72, paddingTop: 10 }}>No rank 2+ talent data yet.</div>}
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {statsOpen && (
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                position: "fixed",
                inset: 0,
                zIndex: 9400,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 24,
                background: "rgba(0,0,0,0.64)",
                backdropFilter: "blur(5px)",
              }}
            >
              <div
                style={{
                  width: "min(1120px, calc(100vw - 48px))",
                  maxHeight: "84vh",
                  overflow: "auto",
                  border: "1px solid rgba(255,218,107,0.42)",
                  background: "linear-gradient(180deg, rgba(12,10,5,0.96), rgba(0,0,0,0.94))",
                  boxShadow: "0 0 42px rgba(255,218,107,0.16), inset 0 0 28px rgba(255,218,107,0.05)",
                  padding: 18,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, marginBottom: 16 }}>
                  <div>
                    <h2 style={{ margin: 0, letterSpacing: 5, fontSize: 24 }}>STATS</h2>
                    <div style={{ opacity: 0.72, fontSize: 12, letterSpacing: 2, marginTop: 4 }}>PLAYER RUN INTELLIGENCE</div>
                  </div>
                  <button className="scifi-btn" onClick={() => setStatsOpen(false)} style={{ minWidth: 48, padding: "10px 14px", borderColor: "rgba(255,255,255,0.28)" }}>X</button>
                </div>

                {leaderboardLoading && <div style={{ opacity: 0.75, padding: 18 }}>LOADING...</div>}
                {!leaderboardLoading && (
                  <>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(0, 1fr))", gap: 10, marginBottom: 16 }}>
                      {[
                        ["PLAYERS", statsOverview.players],
                        ["RUNS", statsOverview.totalRuns],
                        ["WINS", statsOverview.wins],
                        ["FAILS", statsOverview.losses],
                        ["SUCCESS", `${statsOverview.successRate}%`],
                        ["FAIL RATE", `${statsOverview.failRate}%`],
                      ].map(([label, value]) => (
                        <div key={label} style={{ border: "1px solid rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.04)", padding: 12 }}>
                          <div style={{ fontSize: 11, opacity: 0.72, letterSpacing: 2 }}>{label}</div>
                          <strong style={{ display: "block", marginTop: 6, fontSize: 22, color: "#ffe16b" }}>{value}</strong>
                        </div>
                      ))}
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 16 }}>
                      <div style={{ border: "1px solid rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.035)", padding: 14 }}>
                        <strong style={{ letterSpacing: 3 }}>WEAPON PERFORMANCE</strong>
                        {statsOverview.weapons.length === 0 && <div style={{ opacity: 0.72, padding: "12px 0" }}>No weapon stats yet. Finish a run to seed this panel.</div>}
                        {statsOverview.weapons.map((w) => (
                          <div key={w.id} style={{ display: "grid", gridTemplateColumns: "1fr 80px 90px 90px", gap: 10, padding: "9px 0", borderTop: "1px solid rgba(255,255,255,0.08)", alignItems: "center" }}>
                            <b>{w.id}</b>
                            <span>{w.runs} runs</span>
                            <span>{Math.round(w.levels / Math.max(1, w.runs) * 10) / 10} avg lvl</span>
                            <strong style={{ textAlign: "right", color: "#ffe16b" }}>{w.kills} kills</strong>
                          </div>
                        ))}
                      </div>

                      <div style={{ border: "1px solid rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.035)", padding: 14 }}>
                        <strong style={{ letterSpacing: 3 }}>KILLS BY ENEMY</strong>
                        {statsOverview.enemies.length === 0 && <div style={{ opacity: 0.72, padding: "12px 0" }}>No kill type data yet.</div>}
                        {statsOverview.enemies.map(([type, count]) => (
                          <div key={type} style={{ display: "grid", gridTemplateColumns: "1fr 90px", gap: 10, padding: "9px 0", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                            <b>{String(type).toUpperCase()}</b>
                            <strong style={{ textAlign: "right", color: "#ffe16b" }}>{count}</strong>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div style={{ marginTop: 16, border: "1px solid rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.035)", padding: 14 }}>
                      <strong style={{ letterSpacing: 3 }}>PLAYER SNAPSHOTS</strong>
                      {leaderboardRows.slice(0, 20).map((row) => {
                        const s = row.lastRunSummary || {};
                        const runs = Number(row.runs || 0);
                        const wins = Number(row.wins || 0);
                        const losses = Number(row.losses || 0);
                        const rate = runs ? Math.round((wins / runs) * 100) : (String(s.result || "").toUpperCase() === "CLEARED" ? 100 : 0);
                        return (
                          <div key={row.id || row.name} style={{ display: "grid", gridTemplateColumns: "minmax(180px,1fr) 100px 100px 100px 120px minmax(180px,1fr)", gap: 10, padding: "9px 0", borderTop: "1px solid rgba(255,255,255,0.08)", alignItems: "center" }}>
                            <b>{row.name || "UNKNOWN"}</b>
                            <span>{Number(row.kills || 0)} kills</span>
                            <span>{wins}W / {losses}F</span>
                            <span>{rate}% success</span>
                            <span>{s.mvpWeapon || "N/A"} MVP</span>
                            <span style={{ opacity: 0.78, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{(s.weapons || []).map((w) => `${w.id} ${w.level}`).join(" / ") || "No loadout data"}</span>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* SHOP PANEL */}
          {shopOpen && (
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                position: "fixed",
                left: "50%",
                transform: "translateX(-50%)",
                width: "min(1440px, calc(100vw - 28px))",
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
                storageKey={shopStorageKey}
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
                top: 86,
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

          {!focusPlanet && Object.keys(clearedHexes || {}).length === 0 && (
            <div className="first-planet-arrow" aria-hidden="true" />
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
                  const difficulty = Math.min(5, h.difficulty + (p.difficulty - 1));
                  const locked = difficulty > highestUnlockedDifficulty && !cleared;
                  const tileColors = {
                    1: { bg: "rgba(0,145,255,0.34)", glow: "rgba(0,190,255,0.62)" },
                    2: { bg: "rgba(166,75,255,0.34)", glow: "rgba(190,105,255,0.62)" },
                    3: { bg: "rgba(255,142,36,0.36)", glow: "rgba(255,176,64,0.66)" },
                    4: { bg: "rgba(255,38,58,0.38)", glow: "rgba(255,64,86,0.70)" },
                    5: { bg: "rgba(0,0,0,0.88)", glow: "rgba(255,255,255,0.82)" },
                  };
                  const tileColor = tileColors[difficulty] || tileColors[5];

                  return (
                    <div
                      key={h.id}
                      data-hex-id={h.id}
                      className={`hex-unit hex-d${difficulty} ${selectedHex === h.id ? "active" : ""} ${cleared ? "cleared" : ""} ${locked ? "locked" : "unlocked"}`}
                      style={{
                        left: `calc(50% + ${h.x}px)`,
                        top: `calc(50% + ${h.y}px)`,
                        transform: "translate(-50%,-50%)",
                        background: cleared ? undefined : locked ? "rgba(16,18,24,0.18)" : tileColor.bg,
                        boxShadow: locked
                          ? "inset 0 0 10px rgba(0,0,0,0.78)"
                          : `inset 0 0 16px ${tileColor.glow}, 0 0 10px ${tileColor.glow}`,
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (cleared) return;

                        // ✅ Tutorial step 2: ONLY allow selecting the forced tile
                        if (tutorialVisible && tutorialStep === 2 && h.id !== TUTORIAL_TILE_ID) return;

                        if (locked) {
                          setSelectedHex(null);
                          setSelectedHexInfo(null);
                          return;
                        }
                        setSelectedHex(h.id);
                        setSelectedHexInfo({
                          difficulty,
                          reward: difficulty * 20,
                          runTimeMs: rollMatchLengthMs(difficulty),
                          requiresExtraction: Math.random() < 0.30,
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

              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
                <span style={{ opacity: 0.8 }}>Operation</span>
                <strong>{matchLengthLabel(selectedHexInfo.runTimeMs)}</strong>
              </div>

              {selectedHexInfo.requiresExtraction && (
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
                  <span style={{ opacity: 0.8 }}>Objective</span>
                  <strong>EXTRACT</strong>
                </div>
              )}

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
    tileDifficulty={combatCtx?.difficulty || selectedHexInfo?.difficulty || 1}
    selectedHero={selectedHero}   // ✅ add this
    runBuild={runBuild}
    runTimeMs={combatCtx?.runTimeMs}
    requiresExtraction={!!combatCtx?.requiresExtraction}
    playerName={cleanPlayerName()}
    onExit={(summary = {}) => {
      const runKills = Math.max(0, Math.round(summary.kills || 0));
      if (runKills > 0) setLeaderboardKills((k) => k + runKills);
      setLeaderboardDeaths((d) => {
        const nextDeaths = d + 1;
        submitLeaderboard({
          points: leaderboardPoints,
          tilesCleared: leaderboardTilesCleared,
          deaths: nextDeaths,
          kills: leaderboardKills + runKills,
          characterName: selectedHero?.name || "",
          characterPortrait: selectedHero?.portrait || "",
          lastRunKills: runKills,
          lastRunSummary: summary,
        });
        return nextDeaths;
      });
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

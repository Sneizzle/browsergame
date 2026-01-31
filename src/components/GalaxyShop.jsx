import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import t1 from "./t1.PNG";
import t2 from "./t2.PNG";
import t3 from "./t3.PNG";
import t4 from "./t4.PNG";
import t5 from "./t5.PNG";
import t6 from "./t6.PNG";
import t7 from "./t7.PNG";
import t8 from "./t8.PNG";
import t9 from "./t9.PNG";

/**
 * GalaxyShop (MILITARY DOCTRINE) — WoW-classic style talent tree (left tree)
 *
 * - 1 "Doctrine Pill" per mission (App grants it).
 * - Spend 1 pill per rank.
 * - You can only pick ONE talent per row (row-exclusive).
 * - Tier gate: to unlock row N (N>=2), you must have spent (N-1)*5 points in this tree.
 *   (Row 0 and 1 are available after prerequisites.)
 *
 * This component intentionally does NOT persist to localStorage to match roguelite "refresh wipes run".
 */

const ICON_BASE =
  "https://raw.githubusercontent.com/itsrealfarhan/xenowarfare-assets/main/talent-icons/";
const LOCAL_ICON_MAP = {
  25: t1, // THORNS
  15: t2, // FIELD ARMOR
  21: t3, // GHOST PROTOCOL
  3:  t4, // QUICK REARM
  12: t5, // PLATE CARRIER
  7:  t6, // ADRENAL
  2:  t7, // KATANA
  20: t8, // THORNS: DISCHARGE
  9:  t9, // TITANIUM PLATES
};

function iconUrl(n) {
  return LOCAL_ICON_MAP[n] || `${ICON_BASE}${n}.png`;
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const NODES = [
  // Row 0
  {
    id: "MIL_THORNS",
    name: "DEFENSIVE COUNTERMEASURE",
    type: "ability",
    rarity: "major",
    row: 0,
    col: 1,
    maxRank: 1,
    icon: 25,
    desc:
  "Press SPACEBAR to activate.\n" +
  "ACTIVE: 5.6s\n" +
  "COOLDOWN: 15.0s (reduced by Quick Rearm)\n" +
  "RAM: 34 impact damage per hit\n" +
  "\n" +
  "EFFECT:\n" +
  "• Ignore all incoming damage while active\n" +
  "• Slam through enemies and break their line",
  },

  // Row 1 (pick ONE)
  {
    id: "MIL_FIELD_ARMOR",
    name: "FIELD ARMOR",
    type: "passive",
    rarity: "stat",
    row: 1,
    col: 0,
    maxRank: 5,
    icon: 15,
    prereq: ["MIL_THORNS"],
    desc:
      "Passive / Stat\n" +
      "• +Max HP per rank\n" +
      "Your **Vanguard Spine**.",
  },
  {
    id: "MIL_GHOST_PROTOCOL",
    name: "GHOST PROTOCOL",
    type: "passive",
    rarity: "major",
    row: 1,
    col: 2,
    maxRank: 5,
    icon: 21,
    prereq: ["MIL_THORNS"],
    desc:
      "Major Passive\n" +
      "When you take damage:\n" +
      "• Freeze time for 2s\n" +
      "• Blast an explosion around you\n" +
      "Cooldown starts at ~60s and improves with ranks.",
  },

  // Row 2 (pick ONE) — Tier gate starts here: need 5 points spent
  {
    id: "MIL_QUICK_REARM",
    name: "THORNS: QUICK REARM",
    type: "passive",
    rarity: "stat",
    row: 2,
    col: 0,
    maxRank: 2,
    icon: 3,
    prereq: ["MIL_THORNS"],
    desc:
      "Stat\n" +
      "• +Thorns duration\n" +
      "• -Thorns cooldown",
  },
  {
    id: "MIL_PLATE_CARRIER",
    name: "PLATE CARRIER",
    type: "passive",
    rarity: "stat",
    row: 2,
    col: 2,
    maxRank: 5,
    icon: 12,
    prereq: ["MIL_FIELD_ARMOR"],
    desc:
      "Stat (requires Field Armor)\n" +
      "• Damage reduction per rank\n" +
      "Small, consistent mitigation.",
  },

  // Row 3 — Tier gate: need 10 points spent
  {
    id: "MIL_ADRENAL",
    name: "ADRENAL OVERDRIVE",
    type: "passive",
    rarity: "major",
    row: 3,
    col: 1,
    maxRank: 1,
    icon: 7,
    prereq: [],
    desc:
      "Major Passive\n" +
      "After taking damage OR getting a kill:\n" +
      "• 4s Overdrive (+move speed, +melee/attack speed)\n" +
      "• Heal 8% of missing HP\n" +
      "30s cooldown.",
  },

  // Row 4 (pick ONE) — Tier gate: need 15 points spent
  {
    id: "MIL_KATANA_BACKUP",
    name: "KATANA: BACKUP BLADE",
    type: "passive",
    rarity: "major",
    row: 4,
    col: 0,
    maxRank: 1,
    icon: 2,
    prereq: ["MIL_ADRENAL"],
    desc:
      "Passive\n" +
      "Always start the match with an extra **Rank 1 Katana**.\n" +
      "Cyan-blue slash.",
  },
  {
    id: "MIL_THRONS_DISCHARGE",
    name: "THORNS: DISCHARGE",
    type: "passive",
    rarity: "major",
    row: 4,
    col: 2,
    maxRank: 1,
    icon: 20,
    prereq: ["MIL_THORNS"],
    desc:
      "Passive\n" +
      "When Thorns expires:\n" +
      "• Shockwave knocks back enemies in a wide radius.",
  },

  // Row 5 — Tier gate: need 20 points spent
  {
    id: "MIL_TITANIUM_PLATES",
    name: "TITANIUM PLATES",
    type: "passive",
    rarity: "capstone",
    row: 5,
    col: 1,
    maxRank: 3,
    icon: 9,
    prereq: ["MIL_ADRENAL"],
    desc:
      "Capstone\n" +
      "Every 20s, generate a Plating.\n" +
      "• Completely blocks the next instance of damage\n" +
      "• Max stacks: 1/2/3 (by rank)\n" +
      "After 60s without hits, you're stacked.",
  },
];

const LINES = [
  ["MIL_THORNS", "MIL_FIELD_ARMOR"],
  ["MIL_THORNS", "MIL_GHOST_PROTOCOL"],
  ["MIL_THORNS", "MIL_QUICK_REARM"],
  ["MIL_FIELD_ARMOR", "MIL_PLATE_CARRIER"],
  ["MIL_QUICK_REARM", "MIL_ADRENAL"],
  ["MIL_PLATE_CARRIER", "MIL_ADRENAL"],
  ["MIL_ADRENAL", "MIL_KATANA_BACKUP"],
  ["MIL_THORNS", "MIL_THRONS_DISCHARGE"],
  ["MIL_ADRENAL", "MIL_TITANIUM_PLATES"],
];

function tierRequirementPoints(row) {
  // Row 0: 0, Row 1: 0, Row 2: 5, Row 3: 10, Row 4: 15, Row 5: 20 ...
  return Math.max(0, (row - 1) * 5);
}

function sumRanks(purchased) {
  return Object.values(purchased || {}).reduce((a, b) => a + (Number(b) || 0), 0);
}

export default function GalaxyShop({
  title = "MILITARY // DOCTRINE",
  credits = 0,
  onSpend = () => {},
  resetToken = 0,
  storageKey = null, // if provided, we persist to sessionStorage (until browser/tab closes)
  onBuildChange = () => {},
}) {
  const storageNs = useMemo(() => (storageKey ? `xeno:shop:${storageKey}` : null), [storageKey]);
  const [purchased, setPurchased] = useState(() => {
    if (!storageNs) return {};
    try {
      const raw = sessionStorage.getItem(storageNs);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });

  // reset between runs / characters
  useEffect(() => {
    // resetToken is used by App to wipe a run; storageKey change indicates new character.
    if (!storageNs) {
      setPurchased({});
      return;
    }
    try {
      // if resetToken changes, wipe the current session build for this character
      sessionStorage.removeItem(storageNs);
    } catch {}
    setPurchased({});
  }, [resetToken, storageNs]);

  // when storageKey changes, load (or clear) that character's build
  useEffect(() => {
    if (!storageNs) return;
    try {
      const raw = sessionStorage.getItem(storageNs);
      setPurchased(raw ? JSON.parse(raw) : {});
    } catch {
      setPurchased({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageNs]);

  useEffect(() => {
    if (storageNs) {
      try {
        sessionStorage.setItem(storageNs, JSON.stringify(purchased || {}));
      } catch {}
    }
    onBuildChange({ purchased: purchased || {} });
  }, [purchased, onBuildChange, storageNs]);

  const grid = useMemo(() => {
    const maxRow = Math.max(...NODES.map((n) => n.row));
    const maxCol = Math.max(...NODES.map((n) => n.col));
    return { rows: maxRow + 1, cols: maxCol + 1 };
  }, []);

  const pointsSpent = useMemo(() => sumRanks(purchased), [purchased]);

  const nodeById = useMemo(() => {
    const m = new Map();
    for (const n of NODES) m.set(n.id, n);
    return m;
  }, []);

  const rowPickedId = useMemo(() => {
    const byRow = new Map();
    for (const n of NODES) {
      const r = Number(purchased[n.id] || 0);
      if (r > 0) byRow.set(n.row, n.id);
    }
    return byRow; // row -> chosen id
  }, [purchased]);

  function prereqOk(node) {
    const prereq = node.prereq || [];
    if (!prereq.length) return true;
    return prereq.every((pid) => (purchased?.[pid] || 0) > 0);
  }

  function tierOk(node) {
    const req = tierRequirementPoints(node.row);
    return pointsSpent >= req;
  }

  function rowExclusiveOk(node) {
    const chosen = rowPickedId.get(node.row);
    return !chosen || chosen === node.id;
  }

  function canBuy(node) {
    const r = Number(purchased[node.id] || 0);
    if (r >= node.maxRank) return false;
    if (!prereqOk(node)) return false;
    if (!tierOk(node)) return false;
    if (!rowExclusiveOk(node)) return false;
    return credits >= 1;
  }

  function nodeState(node) {
    const r = Number(purchased[node.id] || 0);
    if (r >= node.maxRank) return "maxed";
    if (!prereqOk(node) || !tierOk(node) || !rowExclusiveOk(node)) return "locked";
    if (credits < 1) return "unaffordable";
    return "available";
  }

  function lockReason(node) {
    if (!prereqOk(node)) {
      const need = (node.prereq || []).filter((pid) => (purchased?.[pid] || 0) <= 0);
      return `Requires: ${need.map((id) => nodeById.get(id)?.name || id).join(", ")}`;
    }
    if (!tierOk(node)) {
      const req = tierRequirementPoints(node.row);
      return `Requires ${req} points spent in tree`;
    }
    if (!rowExclusiveOk(node)) {
      const chosenId = rowPickedId.get(node.row);
      return `Row locked by: ${nodeById.get(chosenId)?.name || chosenId}`;
    }
    return "";
  }

  function buy(node) {
    if (!canBuy(node)) return;
    onSpend(1);
    setPurchased((prev) => {
      const next = { ...(prev || {}) };
      next[node.id] = Number(next[node.id] || 0) + 1;
      return next;
    });
  }

  // --- layout (narrower window) ---
  const cellW = 84;
  const cellH = 82;

  const padX = 16;
  const padY = 16;

  const width = padX * 2 + grid.cols * cellW;
  const height = padY * 2 + grid.rows * cellH;

  const nodePos = (node) => ({
    x: padX + node.col * cellW + cellW / 2,
    y: padY + node.row * cellH + cellH / 2,
  });

  return (
    <div className="xshop">
      <style>{`
        .xshop{
          --bg0:#070a12;
          --bg1:#0b1021;
          --line:#223056;
          --line2:#1a2342;
          --txt:#d8e6ff;
          --muted:#91a5d6;
          --good:#4CFF9A;
          --bad:#FF5277;
          --locked:#6c7899;
          --major:#b691ff;
          --cap:#ffd16a;
          font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji","Segoe UI Emoji";
          color:var(--txt);
          width:100%;
        }
        .xshop-top{
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap:16px;
          padding:14px 16px;
          border:1px solid rgba(120,170,255,0.18);
          background:
            radial-gradient(1200px 600px at 20% 0%, rgba(86,120,255,0.12), transparent 60%),
            linear-gradient(180deg, rgba(14,18,36,0.96), rgba(6,8,18,0.96));
          border-radius:14px;
          box-shadow: 0 12px 28px rgba(0,0,0,0.45);
          margin-bottom:14px;
        }
        .xshop-title{
          font-weight:900;
          letter-spacing:0.18em;
          text-transform:uppercase;
          font-size:14px;
          opacity:0.92;
        }
        .xshop-sub{
          font-size:12px;
          color:var(--muted);
          opacity:0.9;
          margin-top:2px;
        }
        .xshop-pill{
          display:flex;
          align-items:center;
          gap:10px;
          padding:10px 14px;
          border-radius:999px;
          border:1px solid rgba(120,170,255,0.22);
          background:
            radial-gradient(120px 60px at 30% 30%, rgba(0,242,255,0.15), transparent 70%),
            linear-gradient(180deg, rgba(18,26,52,0.92), rgba(8,10,20,0.92));
          box-shadow:
            0 0 0 1px rgba(0,242,255,0.10) inset,
            0 14px 26px rgba(0,0,0,0.38);
        }
        .xshop-pillIcon{
          filter: drop-shadow(0 0 10px rgba(0,242,255,0.35));
          font-size:16px;
        }
        .xshop-pillNum{
          font-weight:900;
          font-size:16px;
          color:#00f2ff;
          text-shadow: 0 0 18px rgba(0,242,255,0.45), 0 0 26px rgba(0,242,255,0.22);
          letter-spacing:0.04em;
          min-width:28px;
          text-align:right;
        }

        .xshop-wrap{
          display:flex;
          gap:14px;
          align-items:flex-start;
          flex-wrap:wrap;
          max-width: 980px;
        }

        .xshop-tree{
          border:1px solid rgba(120,170,255,0.18);
          background:
            radial-gradient(1200px 680px at 0% 0%, rgba(182,145,255,0.08), transparent 55%),
            linear-gradient(180deg, rgba(12,16,34,0.94), rgba(6,8,18,0.94));
          border-radius:14px;
          padding:12px;
          box-shadow: 0 12px 28px rgba(0,0,0,0.45);
        }

        .xshop-help{
          max-width:420px;
          border:1px dashed rgba(120,170,255,0.18);
          border-radius:14px;
          padding:12px 14px;
          background: rgba(8,10,20,0.65);
        }
        .xshop-help h3{
          margin:0 0 6px 0;
          font-size:12px;
          letter-spacing:0.14em;
          text-transform:uppercase;
          opacity:0.9;
        }
        .xshop-help p{
          margin:6px 0;
          font-size:12px;
          color:var(--muted);
          line-height:1.35;
        }
        .xshop-kbd{
          display:inline-flex;
          align-items:center;
          gap:8px;
          padding:2px 10px;
          border-radius:999px;
          border:1px solid rgba(255,255,255,0.12);
          background: rgba(255,255,255,0.06);
          color:var(--txt);
          font-weight:800;
          letter-spacing:0.04em;
        }

        .xshop-grid{
          position:relative;
          width:${width}px;
          height:${height}px;
          border-radius:12px;
          overflow:visible;
          background:
            radial-gradient(900px 500px at 50% 0%, rgba(0,242,255,0.06), transparent 60%),
            linear-gradient(180deg, rgba(10,12,24,0.85), rgba(4,6,14,0.85));
        }
        .xshop-grid::before{
          content:"";
          position:absolute; inset:0;
          background-image:
            linear-gradient(to right, rgba(80,120,210,0.12) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(80,120,210,0.10) 1px, transparent 1px);
          background-size:${cellW}px ${cellH}px;
          opacity:0.22;
          pointer-events:none;
        }

        .xshop-line{
          position:absolute;
          height:2px;
          background: linear-gradient(90deg, rgba(0,242,255,0.0), rgba(0,242,255,0.35), rgba(0,242,255,0.0));
          transform-origin:left center;
          opacity:0.55;
          pointer-events:none;
        }

        .xshop-node{
          position:absolute;
          width:66px; height:66px;
          border-radius:14px;
          transform: translate(-50%, -50%);
          display:flex;
          align-items:center;
          justify-content:center;
          cursor:pointer;
          border:1px solid rgba(170,210,255,0.20);
          background:
            radial-gradient(60px 40px at 30% 25%, rgba(180,220,255,0.18), transparent 60%),
            linear-gradient(180deg, rgba(18,22,44,0.95), rgba(8,10,18,0.95));
          box-shadow:
            0 0 0 1px rgba(0,0,0,0.45) inset,
            0 14px 22px rgba(0,0,0,0.45);
          transition: transform 0.12s ease, box-shadow 0.18s ease, border-color 0.18s ease, filter 0.18s ease;
          user-select:none;
        }
        .xshop-node:hover{
          transform: translate(-50%, -50%) scale(1.02);
        }

        .xshop-node.available{
          border-color: rgba(76,255,154,0.42);
          box-shadow:
            0 0 0 1px rgba(76,255,154,0.14) inset,
            0 0 20px rgba(76,255,154,0.18),
            0 18px 26px rgba(0,0,0,0.55);
          filter: saturate(1.08);
        }
        .xshop-node.unaffordable{
          border-color: rgba(255,82,119,0.34);
          opacity:0.96;
        }
        .xshop-node.locked{
          border-color: rgba(108,120,153,0.30);
          opacity:0.55;
          cursor:not-allowed;
          filter: grayscale(0.35);
        }
        .xshop-node.maxed{
          border-color: rgba(255,209,106,0.48);
          box-shadow:
            0 0 0 1px rgba(255,209,106,0.16) inset,
            0 0 22px rgba(255,209,106,0.16),
            0 18px 26px rgba(0,0,0,0.55);
        }

        .xshop-node.major:not(.locked):not(.maxed){
          border-color: rgba(182,145,255,0.44);
          box-shadow:
            0 0 0 1px rgba(182,145,255,0.16) inset,
            0 0 22px rgba(182,145,255,0.18),
            0 18px 26px rgba(0,0,0,0.55);
        }
        .xshop-node.capstone:not(.locked){
          border-color: rgba(255,209,106,0.55);
        }

        .xshop-icon{
          width:46px; height:46px;
          border-radius:12px;
          background: rgba(255,255,255,0.06);
          display:flex;
          align-items:center;
          justify-content:center;
          overflow:hidden;
          box-shadow: 0 0 0 1px rgba(255,255,255,0.10) inset;
        }
        .xshop-icon img{
          width:100%; height:100%;
          object-fit:cover;
          filter: saturate(1.05) contrast(1.05);
        }

        .xshop-rank{
          position:absolute;
          bottom:6px; left:8px;
          font-size:11px;
          color: rgba(216,230,255,0.9);
          background: rgba(0,0,0,0.38);
          border:1px solid rgba(255,255,255,0.10);
          border-radius:999px;
          padding:2px 8px;
        }
        .xshop-cost{
          position:absolute;
          top:6px; right:7px;
          font-size:11px;
          font-weight:900;
          border-radius:999px;
          padding:2px 8px;
          border:1px solid rgba(255,255,255,0.10);
          background: rgba(0,0,0,0.35);
          box-shadow: 0 0 0 1px rgba(0,0,0,0.35) inset;
        }

        .xshop-node.available .xshop-cost{
          background: rgba(76,255,154,0.14);
          border-color: rgba(76,255,154,0.28);
          color: var(--good);
          box-shadow: 0 0 16px rgba(76,255,154,0.20);
        }
        .xshop-node.unaffordable .xshop-cost{
          background: rgba(255,82,119,0.12);
          border-color: rgba(255,82,119,0.26);
          color: var(--bad);
        }
        .xshop-node.locked .xshop-cost{
          background: rgba(108,120,153,0.14);
          border-color: rgba(108,120,153,0.20);
          color: rgba(108,120,153,1);
        }
        .xshop-node.major .xshop-cost{
          background: rgba(182,145,255,0.14);
          border-color: rgba(182,145,255,0.28);
          color: #d6c1ff;
        }
        .xshop-node.capstone .xshop-cost{
          background: rgba(255,209,106,0.14);
          border-color: rgba(255,209,106,0.30);
          color: #ffe2a3;
        }

        .xshop-tip{
          position:fixed;
          z-index:100000;
          min-width:260px;
          max-width:340px;
          padding:10px 12px;
          border-radius:12px;
          border:1px solid rgba(120,170,255,0.22);
          background:
            radial-gradient(420px 220px at 30% 0%, rgba(0,242,255,0.12), transparent 70%),
            linear-gradient(180deg, rgba(14,18,38,0.96), rgba(6,8,18,0.96));
          box-shadow: 0 20px 40px rgba(0,0,0,0.55);
          pointer-events:none;
        }
        .xshop-tip h4{
          margin:0;
          font-size:12px;
          letter-spacing:0.12em;
          text-transform:uppercase;
        }
        .xshop-tip .meta{
          font-size:11px;
          color: var(--muted);
          margin-top:4px;
        }
        .xshop-tip pre{
          margin:8px 0 0 0;
          white-space:pre-wrap;
          font-family:inherit;
          font-size:12px;
          line-height:1.3;
          color: rgba(216,230,255,0.92);
        }
      `}</style>

      <div className="xshop-top">
        <div>
          <div className="xshop-title">{title}</div>
          <div className="xshop-sub">
            Spend 5 points to unlock deeper rows • Pick 1 talent per row • Spacebar activates Thorns
          </div>
        </div>

        <div className="xshop-pill" title="Doctrine Pills (1 per mission)">
          <span className="xshop-pillIcon">💠</span>
          <span className="xshop-pillNum">{credits}</span>
        </div>
      </div>

      <div className="xshop-wrap">
        <div className="xshop-tree">
          <div style={{ fontWeight: 900, letterSpacing: "0.16em", textTransform: "uppercase", fontSize: 12, opacity: 0.9, margin: "2px 4px 10px" }}>
            Military Doctrine // Left Tree
          </div>

          <TalentGrid
            width={width}
            height={height}
            nodes={NODES}
            lines={LINES}
            nodePos={nodePos}
            purchased={purchased}
            pointsSpent={pointsSpent}
            nodeState={nodeState}
            lockReason={lockReason}
            buy={buy}
          />
        </div>

        <div className="xshop-help">
          <h3>Run Rules</h3>
          <p>
            You earn <span className="xshop-kbd">💠 1</span> pill per cleared mission. Spend pills to buy ranks.
            Refreshing the browser wipes the run (roguelite).
          </p>
          <p>
            Tier gates: Row 2 needs <span className="xshop-kbd">5</span> points spent, Row 3 needs{" "}
            <span className="xshop-kbd">10</span>, Row 4 needs <span className="xshop-kbd">15</span>, Row 5 needs{" "}
            <span className="xshop-kbd">20</span>.
          </p>
          <p>
            <span className="xshop-kbd">SPACE</span> activates <b>Thorns</b> in combat (invulnerable ramming window).
          </p>
        </div>
      </div>
    </div>
  );
}

function TalentGrid({
  width,
  height,
  nodes,
  lines,
  nodePos,
  purchased,
  nodeState,
  lockReason,
  buy,
}) {
  const [tip, setTip] = useState(null);
  const lastTipRef = useRef(null);

  function onEnter(e, node) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = clamp(rect.right + 10, 10, window.innerWidth - 360);
    const y = clamp(rect.top - 10, 10, window.innerHeight - 220);
    const next = { node, x, y };
    lastTipRef.current = next;
    setTip(next);
  }

  function onLeave() {
    setTip(null);
  }

  useEffect(() => {
    if (!tip) return;
    const onMove = () => {
      // keep tooltip in-bounds even if the user scrolls the panel
      const t = lastTipRef.current;
      if (!t) return;
      setTip((prev) => (prev ? { ...prev, x: clamp(prev.x, 10, window.innerWidth - 360), y: clamp(prev.y, 10, window.innerHeight - 220) } : prev));
    };
    window.addEventListener('resize', onMove);
    window.addEventListener('scroll', onMove, true);
    return () => {
      window.removeEventListener('resize', onMove);
      window.removeEventListener('scroll', onMove, true);
    };
  }, [tip]);

  return (
    <div className="xshop-grid" style={{ width, height }}>
      {/* lines */}
      {lines.map(([a, b]) => {
        const na = nodes.find((n) => n.id === a);
        const nb = nodes.find((n) => n.id === b);
        if (!na || !nb) return null;
        const pa = nodePos(na);
        const pb = nodePos(nb);
        const dx = pb.x - pa.x;
        const dy = pb.y - pa.y;
        const len = Math.hypot(dx, dy);
        const ang = (Math.atan2(dy, dx) * 180) / Math.PI;
        return (
          <div
            key={`${a}-${b}`}
            className="xshop-line"
            style={{
              left: pa.x,
              top: pa.y,
              width: len,
              transform: `rotate(${ang}deg)`,
            }}
          />
        );
      })}

      {/* nodes */}
      {nodes.map((node) => {
        const pos = nodePos(node);
        const r = Number(purchased?.[node.id] || 0);
        const st = nodeState(node);

        return (
          <div
            key={node.id}
            className={[
              "xshop-node",
              st,
              node.rarity === "major" ? "major" : "",
              node.rarity === "capstone" ? "capstone" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            style={{ left: pos.x, top: pos.y }}
            role="button"
            tabIndex={0}
            onClick={() => buy(node)}
            onMouseEnter={(e) => onEnter(e, node)}
            onMouseLeave={onLeave}
            title= {undefined}
          >
            <div className="xshop-icon">
              <img src={iconUrl(node.icon)} alt="" />
            </div>

            <div className="xshop-cost">💠 1</div>
            <div className="xshop-rank">
              {r}/{node.maxRank}
            </div>
          </div>
        );
      })}

      {tip &&
        createPortal(
          <div className="xshop-tip" style={{ left: tip.x, top: tip.y }}>
            <h4>{tip.node.name}</h4>
            <div className="meta">
              {tip.node.type.toUpperCase()} • Rank {Number(purchased?.[tip.node.id] || 0)}/{tip.node.maxRank}
              {lockReason(tip.node) ? ` • ${lockReason(tip.node)}` : ""}
            </div>
            <pre>{tip.node.desc}</pre>
          </div>,
          document.body
        )}
    </div>
  );
}

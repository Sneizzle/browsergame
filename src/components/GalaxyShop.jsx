import React, { useEffect, useMemo, useState } from "react";
import t1 from "./t1.PNG";
import t2 from "./t2.PNG";
import t3 from "./t3.PNG";
import t4 from "./t4.PNG";
import t5 from "./t5.PNG";
import t6 from "./t6.PNG";
import t7 from "./t7.PNG";
import t8 from "./t8.PNG";
import t9 from "./t9.PNG";

function iconUrl(node) {
  return node.iconPath; // direct string url/path
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const NODES = [
  {
    id: "MIL_THORNS",
    name: "THORNS",
    type: "ability",
    rarity: "major",
    row: 0,
    col: 1,
    maxRank: 1,
    iconPath: t1,
    desc: "...",
  },

  {
    id: "MIL_FIELD_ARMOR",
    name: "FIELD ARMOR",
    type: "passive",
    rarity: "stat",
    row: 1,
    col: 0,
    maxRank: 5,
    iconPath: t2,
    prereq: ["MIL_THORNS"],
    desc: "...",
  },

  {
    id: "MIL_GHOST_PROTOCOL",
    name: "GHOST PROTOCOL",
    type: "passive",
    rarity: "major",
    row: 1,
    col: 2,
    maxRank: 5,
    iconPath: t3,
    prereq: ["MIL_THORNS"],
    desc: "...",
  },

  {
    id: "MIL_QUICK_REARM",
    name: "THORNS: QUICK REARM",
    type: "passive",
    rarity: "stat",
    row: 2,
    col: 0,
    maxRank: 2,
    iconPath: t4,
    prereq: ["MIL_THORNS"],
    desc: "...",
  },

  {
    id: "MIL_PLATE_CARRIER",
    name: "PLATE CARRIER",
    type: "passive",
    rarity: "stat",
    row: 2,
    col: 2,
    maxRank: 5,
    iconPath: t5,
    prereq: ["MIL_FIELD_ARMOR"],
    desc: "...",
  },

  {
    id: "MIL_ADRENAL",
    name: "ADRENAL OVERDRIVE",
    type: "passive",
    rarity: "major",
    row: 3,
    col: 1,
    maxRank: 1,
    iconPath: t6,
    prereq: [],
    desc: "...",
  },

  {
    id: "MIL_KATANA_BACKUP",
    name: "KATANA: BACKUP BLADE",
    type: "passive",
    rarity: "major",
    row: 4,
    col: 0,
    maxRank: 1,
    iconPath: t7,
    prereq: ["MIL_ADRENAL"],
    desc: "...",
  },

  {
    id: "MIL_THRONS_DISCHARGE",
    name: "THORNS: DISCHARGE",
    type: "passive",
    rarity: "major",
    row: 4,
    col: 2,
    maxRank: 1,
    iconPath: t8,
    prereq: ["MIL_THORNS"],
    desc: "...",
  },

  {
    id: "MIL_TITANIUM_PLATES",
    name: "TITANIUM PLATES",
    type: "passive",
    rarity: "capstone",
    row: 5,
    col: 1,
    maxRank: 3,
    iconPath: t9,
    prereq: ["MIL_ADRENAL"],
    desc: "...",
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
  storageKey = null, // ignored by design for roguelite wipe-on-refresh
  onBuildChange = () => {},
}) {
  const [purchased, setPurchased] = useState({});

  // roguelite: reset between runs / characters
  useEffect(() => {
    setPurchased({});
  }, [resetToken]);

  useEffect(() => {
    onBuildChange({ purchased });
  }, [purchased, onBuildChange]);

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

  // --- layout ---
  const cellW = 98;
  const cellH = 92;

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
          overflow:hidden;
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
          width:74px; height:74px;
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
          width:52px; height:52px;
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
          position:absolute;
          z-index:20;
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

  function onEnter(e, node) {
    const rect = e.currentTarget.parentElement.getBoundingClientRect();
    const p = nodePos(node);
    const sx = rect.left + p.x;
    const sy = rect.top + p.y;
    setTip({
      node,
      x: clamp(sx + 42, 10, window.innerWidth - 360),
      y: clamp(sy - 20, 10, window.innerHeight - 220),
    });
  }

  function onLeave() {
    setTip(null);
  }

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
            title={st === "locked" ? lockReason(node) : undefined}
          >
            <div className="xshop-icon">
              <img src={iconUrl(node)} alt="" />
            </div>

            <div className="xshop-cost">💠 1</div>
            <div className="xshop-rank">
              {r}/{node.maxRank}
            </div>
          </div>
        );
      })}

      {tip && (
        <div className="xshop-tip" style={{ left: tip.x, top: tip.y }}>
          <h4>{tip.node.name}</h4>
          <div className="meta">
            {tip.node.type.toUpperCase()} • Rank {Number(purchased?.[tip.node.id] || 0)}/{tip.node.maxRank}
            {lockReason(tip.node) ? ` • ${lockReason(tip.node)}` : ""}
          </div>
          <pre>{tip.node.desc}</pre>
        </div>
      )}
    </div>
  );
}

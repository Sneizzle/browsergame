
import React, { useEffect, useMemo, useRef, useState } from "react";
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
 * fix.jsx — Galaxy Shop v2 (Talents)
 *
 * What changed vs old shop:
 * - NO “spend 10/15 points to unlock rows” gates. Unlocking is by arrows/prereqs.
 * - You can buy multiple talents per row (unless a talent is maxed).
 * - Pills are a roguelite currency (App should award pills = mission difficulty).
 * - SPACEBAR ability is exclusive at runtime: choose either Thorns OR Decoy.
 *   (You may buy both nodes, but you must pick ONE as the active SPACE ability.)
 * - Added a second tree: Research Vessel (middle tree).
 * - Added a RESET button that refunds spent pills and clears both trees (lets you respend).
 *
 * Notes for integration:
 * - This component pushes build data to `onBuildChange({ purchased, meta })`.
 *   `meta.activeSpaceAbility` is either "THORNS" or "DECOY" (or null if none).
 * - Combat should use `meta.activeSpaceAbility` to decide what SPACE does.
 */

const ICON_BASE =
  "https://raw.githubusercontent.com/itsrealfarhan/xenowarfare-assets/main/talent-icons/";

/** Reuse your existing 9 local images first, fallback to remote icons if needed. */
const LOCAL_ICON_MAP = {
  25: t1, // Thorns
  15: t2, // Field Armor
  21: t3, // Ghost Protocol
  3: t4,  // Quick Rearm
  12: t5, // Plate Carrier
  7: t6,  // Adrenal
  2: t7,  // Katana
  20: t8, // Thorns Discharge
  9: t9,  // Titanium Plates
};

function iconUrl(n) {
  return LOCAL_ICON_MAP[n] || `${ICON_BASE}${n}.png`;
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const sumRanks = (purchased) =>
  Object.values(purchased || {}).reduce((a, b) => a + (Number(b) || 0), 0);

function prereqOk(node, purchased) {
  const all = node.prereqAll || [];
  const any = node.prereqAny || [];
  const has = (id) => (Number(purchased?.[id] || 0) > 0);

  if (all.length && !all.every(has)) return false;
  if (any.length && !any.some(has)) return false;
  return true;
}

function lockReason(node, purchased, nodeById) {
  const all = node.prereqAll || [];
  const any = node.prereqAny || [];
  const has = (id) => (Number(purchased?.[id] || 0) > 0);

  const missingAll = all.filter((id) => !has(id));
  if (missingAll.length) {
    return `Requires: ${missingAll.map((id) => nodeById.get(id)?.name || id).join(", ")}`;
  }

  if (any.length && !any.some(has)) {
    return `Requires one of: ${any.map((id) => nodeById.get(id)?.name || id).join(" / ")}`;
  }

  return "";
}

/**
 * Tree definitions
 * - row/col are for layout only.
 * - prereqAll: AND requirements
 * - prereqAny: OR requirements
 */

// -------------------- TREE 1: COMBAT TALENTS (keeps MIL_* keys for Combat.jsx) --------------------
// Flow: Rank 1 (Thorns/Katana) -> pick left/right -> pick left/right -> Adrenal -> pick left/right
const MIL_NODES = [
  // Rank 1: Thorns OR Katana (or both)
  {
    id: "MIL_THORNS",
    name: "THORNS",
    type: "ability",
    rarity: "major",
    row: 0,
    col: 0,
    maxRank: 1,
    icon: 25,
    tags: ["SPACE ability"],
    desc:
      "ACTIVE - Key 1\n" +
      "Cooldown: 25s base, reduced by Quick Rearm.\n" +
      "Duration: 5.6s base, increased by Quick Rearm.\n" +
      "Damage: 89.9 + 12.4 per map difficulty before bonuses.\n" +
      "While active: invulnerable, body-blocks ram enemies, and makes touching enemies bleed.",
  },
  {
    // IMPORTANT: Combat.jsx expects this key for the Katana talent.
    id: "MIL_KATANA_BACKUP",
    name: "KATANA MODULE",
    type: "passive",
    rarity: "major",
    row: 0,
    col: 2,
    maxRank: 1,
    icon: 2,
    tags: ["auto perk"],
    desc:
      "PASSIVE - lesser knife module.\n" +
      "Every 15s: six quick sword slices, then a straight sword throw.\n" +
      "Slices: 9.2 damage each before bonuses. Throw: low damage, pierces all enemies, inflicts long bleed, flies off-map.\n" +
      "This is not the Katana weapon, has no upgrades, and never unlocks Katana levels.",
  },

  // Branch 1
  {
    id: "MIL_FIELD_ARMOR",
    name: "FIELD ARMOR",
    type: "passive",
    rarity: "stat",
    row: 1,
    col: 0,
    maxRank: 5,
    icon: 15,
    prereqAny: ["MIL_THORNS", "MIL_KATANA_BACKUP"],
    desc: "PASSIVE STAT\n+25 max HP per rank. Max rank 5 = +125 max HP.",
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
    prereqAny: ["MIL_THORNS", "MIL_KATANA_BACKUP"],
    desc:
      "PASSIVE EMERGENCY\nWhen damage gets through: freeze time for 2.0s and explode around you.\n" +
      "Radius: 220/230/240/250/260px. Damage: 48/62/76/90/104.\n" +
      "Cooldown: 42/36.4/30.8/25.2/19.6s.",
  },

  // Branch 2
  {
    id: "MIL_QUICK_REARM",
    name: "THORNS: QUICK REARM",
    type: "passive",
    rarity: "stat",
    row: 2,
    col: 2,
    maxRank: 2,
    icon: 3,
    prereqAll: ["MIL_THORNS"],
    prereqAny: ["MIL_FIELD_ARMOR", "MIL_GHOST_PROTOCOL"],
    desc: "THORNS UPGRADE\nRank 1: +0.6s duration, -3.5s cooldown. Rank 2: +1.2s duration, -7.0s cooldown.",
  },
  {
    id: "MIL_PLATE_CARRIER",
    name: "PLATE CARRIER",
    type: "passive",
    rarity: "stat",
    row: 2,
    col: 0,
    maxRank: 5,
    icon: 12,
    prereqAny: ["MIL_FIELD_ARMOR", "MIL_GHOST_PROTOCOL"],
    desc: "PASSIVE STAT\n+7% damage reduction per rank. Max rank 5 = 35% damage reduction.",
  },

  // Merge: Adrenal
  {
    id: "MIL_ADRENAL",
    name: "ADRENAL OVERDRIVE",
    type: "passive",
    rarity: "major",
    row: 3,
    col: 1,
    maxRank: 1,
    icon: 7,
    prereqAny: ["MIL_QUICK_REARM", "MIL_PLATE_CARRIER"],
    desc:
      "PASSIVE CLUTCH\nAfter taking damage or getting a kill: 6.0s Overdrive. Cooldown: 30s. No heal, no move speed.",
  },

  // Pick either left or right, then bottom
  {
    id: "MIL_THRONS_DISCHARGE",
    name: "THORNS: DISCHARGE",
    type: "passive",
    rarity: "major",
    row: 4,
    col: 0,
    maxRank: 1,
    icon: 20,
    prereqAll: ["MIL_THORNS", "MIL_ADRENAL"],
    desc:
      "THORNS FINISHER\nWhen Thorns expires: 520px detonation, big damage, huge knockback on normal enemies, and a clear vulnerable-again boom.",
  },
  {
    id: "MIL_TITANIUM_PLATES",
    name: "TITANIUM PLATES",
    type: "passive",
    rarity: "capstone",
    row: 4,
    col: 2,
    maxRank: 3,
    icon: 9,
    prereqAll: ["MIL_ADRENAL"],
    desc:
      "CAPSTONE PLATING\nEvery 20s: gain 1 plate. A plate blocks the next damage hit completely. Rank 1/2/3: max 1/2/3 stored plates.",
  },
];

const MIL_LINES = [
  ["MIL_THORNS", "MIL_FIELD_ARMOR"],
  ["MIL_THORNS", "MIL_QUICK_REARM"],
  ["MIL_KATANA_BACKUP", "MIL_GHOST_PROTOCOL"],
  ["MIL_FIELD_ARMOR", "MIL_PLATE_CARRIER"],
  ["MIL_PLATE_CARRIER", "MIL_ADRENAL"],
  ["MIL_QUICK_REARM", "MIL_ADRENAL"],
  ["MIL_ADRENAL", "MIL_THRONS_DISCHARGE"],
  ["MIL_ADRENAL", "MIL_TITANIUM_PLATES"],
];

// -------------------- TREE 2: RESEARCH VESSEL --------------------
const RES_NODES = [
  // Row 1: A or B (or both), but SPACE ability is exclusive at runtime
  {
    id: "RES_ONBOARD_PROD",
    name: "SIDEARM PISTOL",
    type: "passive",
    rarity: "major",
    row: 0,
    col: 0,
    maxRank: 1,
    icon: 12,
    tags: ["auto perk"],
    desc:
      "PASSIVE SIDEARM\nStarts every match with a small pistol. Fire rate: 0.98s. Damage: 8.5. Bullet speed: 13.5. No upgrades or weapon slot.",
  },
  {
    id: "RES_DECOY_HOLO",
    name: "DECOY HOLOGRAM",
    type: "ability",
    rarity: "major",
    row: 0,
    col: 2,
    maxRank: 1,
    icon: 21,
    tags: ["SPACE ability"],
    desc:
      "ACTIVE - Key 2\nCooldown: 18s. Duration: 8s. Drops a hologram. Normal enemies, ram enemies, turrets, and bosses target it while it exists.",
  },

  // Row 2: both can be bought
  {
    id: "RES_COMBUSTION",
    name: "SPONTANEOUS COMBUSTION",
    type: "passive",
    rarity: "major",
    row: 1,
    col: 0,
    maxRank: 1,
    icon: 20,
    prereqAny: ["RES_ONBOARD_PROD", "RES_DECOY_HOLO"],
    desc: "PASSIVE CHAIN REACTION\nEvery 30s, your next kill triggers a bomb chain: 10 lightning hops, each causing a large explosion at the target.",
  },
  {
    id: "RES_DRONE_ORBIT",
    name: "COVER BIRD",
    type: "passive",
    rarity: "major",
    row: 1,
    col: 2,
    maxRank: 1,
    icon: 9,
    prereqAny: ["RES_ONBOARD_PROD", "RES_DECOY_HOLO"],
    desc:
      "PASSIVE HELPER DRONE\nEvery 45s, an untargetable combat drone arrives for 7s and fires twin SMGs at different targets. Damage: 6.2 per shot before bonuses.",
  },

  // Row 3: big ability
  {
    id: "RES_GRAV_PICKUP",
    name: "GRAVITIC VACUUM",
    type: "passive",
    rarity: "capstone",
    row: 2,
    col: 1,
    maxRank: 1,
    icon: 3,
    prereqAny: ["RES_COMBUSTION", "RES_DRONE_ORBIT"],
    desc: "PASSIVE VACUUM\nXP pickup range x2. XP orb flight speed x2.",
  },

  // Row 5
  {
    id: "RES_SLOW_PULSE",
    name: "WAVE DAMPENER PULSE",
    type: "passive",
    rarity: "major",
    row: 3,
    col: 1,
    maxRank: 1,
    icon: 25,
    prereqAll: ["RES_GRAV_PICKUP"],
    desc:
      "PASSIVE PULSE\nEvery 20s: 520px pulse slows normal enemies by 45% for 5.0s. Bosses and minibosses resist it.",
  },
];

const RES_LINES = [
  ["RES_ONBOARD_PROD", "RES_COMBUSTION"],
  ["RES_DECOY_HOLO", "RES_DRONE_ORBIT"],
  ["RES_COMBUSTION", "RES_GRAV_PICKUP"],
  ["RES_DRONE_ORBIT", "RES_GRAV_PICKUP"],
  ["RES_GRAV_PICKUP", "RES_SLOW_PULSE"],
];

// -------------------- TREE 3: ENGINEERING BAY --------------------
const ENG_NODES = [
  {
    id: "ENG_DEPLOY_TURRET",
    name: "DEPLOY TURRET",
    type: "ability",
    rarity: "major",
    row: 0,
    col: 1,
    maxRank: 1,
    icon: 20,
    tags: ["KEY 3 ability"],
    desc:
      "ACTIVE - Key 3\n" +
      "Cooldown: 45s. Duration: 10s.\n" +
      "Drops a high-HP static turret. It draws enemies and fires heavy support shots.",
  },
  {
    id: "ENG_TURRET_DETONATE",
    name: "DEATH CHARGE",
    type: "passive",
    rarity: "major",
    row: 1,
    col: 0,
    maxRank: 1,
    icon: 7,
    prereqAll: ["ENG_DEPLOY_TURRET"],
    desc: "TURRET UPGRADE\nWhen the turret dies or expires, it detonates in a large damaging blast.",
  },
  {
    id: "ENG_TURRET_BOMB",
    name: "SIEGE PACKAGE",
    type: "passive",
    rarity: "major",
    row: 1,
    col: 2,
    maxRank: 1,
    icon: 3,
    prereqAll: ["ENG_DEPLOY_TURRET"],
    desc:
      "TURRET UPGRADE\nTurret throws bombs that detonate after 2s.\n" +
      "The first time each turret takes damage, it releases a huge knockback and slow circle.",
  },
  {
    id: "ENG_TURRET_FORTIFY",
    name: "FORTIFIED DROP",
    type: "passive",
    rarity: "major",
    row: 2,
    col: 0,
    maxRank: 1,
    icon: 15,
    prereqAll: ["ENG_DEPLOY_TURRET"],
    desc:
      "TURRET UPGRADE\nTurret gains more HP, lasts longer, and deploys a square of blocker walls around itself.",
  },
  {
    id: "ENG_TURRET_FLAME",
    name: "FLAME PILLAR",
    type: "passive",
    rarity: "major",
    row: 2,
    col: 2,
    maxRank: 1,
    icon: 20,
    prereqAny: ["ENG_TURRET_DETONATE", "ENG_TURRET_BOMB"],
    desc:
      "TURRET UPGRADE\nOnce per deployment, the turret vents a large flame pillar that burns enemies in the area.",
  },
  {
    id: "ENG_EXTRA_WEAPON",
    name: "EXPANDED HARNESS",
    type: "passive",
    rarity: "capstone",
    row: 3,
    col: 1,
    maxRank: 1,
    icon: 12,
    prereqAny: ["ENG_TURRET_FORTIFY", "ENG_TURRET_FLAME"],
    desc: "PASSIVE LOADOUT\nMatch weapon cap +1 again. Base cap is 5, with this talent you can carry 6 weapons.",
  },
];

const ENG_LINES = [
  ["ENG_DEPLOY_TURRET", "ENG_TURRET_DETONATE"],
  ["ENG_DEPLOY_TURRET", "ENG_TURRET_BOMB"],
  ["ENG_TURRET_DETONATE", "ENG_TURRET_FORTIFY"],
  ["ENG_TURRET_BOMB", "ENG_TURRET_FLAME"],
  ["ENG_TURRET_FORTIFY", "ENG_EXTRA_WEAPON"],
  ["ENG_TURRET_FLAME", "ENG_EXTRA_WEAPON"],
];

function Tree({
  treeId,
  title,
  subtitle,
  nodes,
  lines,
  credits,
  purchased,
  setPurchased,
  onSpend,
}) {
  const grid = useMemo(() => {
    const maxRow = Math.max(...nodes.map((n) => n.row));
    const maxCol = Math.max(...nodes.map((n) => n.col));
    return { rows: maxRow + 1, cols: maxCol + 1 };
  }, [nodes]);

  const nodeById = useMemo(() => {
    const m = new Map();
    for (const n of nodes) m.set(n.id, n);
    return m;
  }, [nodes]);

  const pointsSpent = useMemo(() => sumRanks(purchased), [purchased]);

  function canBuy(node) {
    const r = Number(purchased[node.id] || 0);
    if (r >= node.maxRank) return false;
    if (!prereqOk(node, purchased)) return false;
    return credits >= 1;
  }

  function nodeState(node) {
    const r = Number(purchased[node.id] || 0);
    if (r >= node.maxRank) return "maxed";
    if (!prereqOk(node, purchased)) return "locked";
    if (credits < 1) return "unaffordable";
    return "available";
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

  // layout
  const cellW = 126;
  const cellH = 106;
  const padX = 18;
  const padY = 18;
  const width = padX * 2 + grid.cols * cellW;
  const height = padY * 2 + grid.rows * cellH;

  const nodePos = (node) => ({
    x: padX + node.col * cellW + cellW / 2,
    y: padY + node.row * cellH + cellH / 2,
  });

  const spaceOwned = {
    thorns: Number(purchased["MIL_THORNS"] || 0) > 0,
    decoy: Number(purchased["RES_DECOY_HOLO"] || 0) > 0,
    turret: Number(purchased["ENG_DEPLOY_TURRET"] || 0) > 0,
  };

  const showAbilityKeys = spaceOwned.thorns || spaceOwned.decoy || spaceOwned.turret;

  return (
    <div className="xshop-tree">
      <div className="xshop-treeHeader">
        <div>
          <div className="xshop-title">{title}</div>
          {subtitle && <div className="xshop-subtitle">{subtitle}</div>}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div className="xshop-points">
            <span>💠 Pills</span>
            <strong>{credits}</strong>
            <span style={{ opacity: 0.6, marginLeft: 8 }}>spent: {pointsSpent}</span>
          </div>
        </div>
      </div>

      {showAbilityKeys && (
        <div className="xshop-spacePick">
          <div style={{ fontWeight: 900, letterSpacing: 1.2 }}>Unlocked Active Abilities</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            {spaceOwned.thorns && <span className="xshop-radio"><b>1</b> Thorns</span>}
            {spaceOwned.decoy && <span className="xshop-radio"><b>2</b> Decoy Hologram</span>}
            {spaceOwned.turret && <span className="xshop-radio"><b>3</b> Deploy Turret</span>}
            <div style={{ opacity: 0.78, fontSize: 12 }}>No mutual exclusion. Buy both, use both.</div>
          </div>
        </div>
      )}

      <div className="xshop-gridWrap">
        <svg
          width={width}
          height={height}
          className="xshop-lines"
          style={{ overflow: "visible" }}
        >
          {lines.map(([a, b], i) => {
            const na = nodeById.get(a);
            const nb = nodeById.get(b);
            if (!na || !nb) return null;

            const A = nodePos(na);
            const B = nodePos(nb);

            const hasA = Number(purchased[a] || 0) > 0;
            const hasB = Number(purchased[b] || 0) > 0;
            const lineOn = hasA && (hasB || prereqOk(nb, purchased));
            const c1y = A.y + Math.max(36, Math.abs(B.y - A.y) * 0.42);
            const c2y = B.y - Math.max(36, Math.abs(B.y - A.y) * 0.42);
            const d = `M ${A.x} ${A.y + 38} C ${A.x} ${c1y}, ${B.x} ${c2y}, ${B.x} ${B.y - 38}`;

            return (
              <path
                key={i}
                d={d}
                fill="none"
                stroke={lineOn ? "rgba(0,242,255,0.55)" : "rgba(34,48,86,0.9)"}
                strokeWidth={lineOn ? 2.2 : 1.2}
                strokeLinecap="round"
              />
            );
          })}
        </svg>

        <div
          className="xshop-grid"
          style={{
            width,
            height,
            gridTemplateColumns: `repeat(${grid.cols}, ${cellW}px)`,
            gridTemplateRows: `repeat(${grid.rows}, ${cellH}px)`,
            padding: `${padY}px ${padX}px`,
          }}
        >
          {nodes.map((node) => {
            const rank = Number(purchased[node.id] || 0);
            const state = nodeState(node);
            const lockedText = state === "locked" ? lockReason(node, purchased, nodeById) : "";
            const isSpace = (node.tags || []).includes("SPACE ability") || (node.tags || []).includes("KEY 3 ability");


            return (
              <button
                key={node.id}
                className={`xshop-node ${state} ${node.rarity || ""} ${isSpace ? "space" : ""}`}
                style={{
                  gridColumn: node.col + 1,
                  gridRow: node.row + 1,
                }}
                onClick={() => buy(node)}
                title={
                  `${node.name}\n\n${node.desc}` +
                  (lockedText ? `\n\nLOCKED: ${lockedText}` : "") +
                  `\n\nRank: ${rank}/${node.maxRank}` +
                  (isSpace ? `\n\nCombat key: ${node.id === "MIL_THORNS" ? "1" : node.id === "RES_DECOY_HOLO" ? "2" : "3"}` : "")
                }
              >
                <div className="xshop-icon">
                  <img src={iconUrl(node.icon)} alt="" draggable={false} />
                  {isSpace && <div className="xshop-badge">{node.id === "ENG_DEPLOY_TURRET" ? "KEY 3" : "KEY"}</div>}
                </div>
                <div className="xshop-name">{node.name}</div>
                <div className="xshop-stat">{String(node.desc || "").split("\n").slice(0, 3).join(" ")}</div>
                <div className="xshop-rank">
                  <span>{rank}/{node.maxRank}</span>
                  {state === "available" ? <em>BUY</em> : state === "maxed" ? <em>MAX</em> : <em>{state.toUpperCase()}</em>}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function GalaxyShopV2({
  title = "GALAXY SHOP",
  credits = 0,
  onSpend = () => {},
  resetToken = 0,
  storageKey = null, // if provided, persists to sessionStorage until tab closes
  onBuildChange = () => {},
}) {
  const storageNs = useMemo(() => (storageKey ? `xeno:shopv2:${storageKey}` : null), [storageKey]);
  const lastResetTokenRef = useRef(resetToken);

  const [purchased, setPurchased] = useState(() => {
    if (!storageNs) return {};
    try {
      const raw = sessionStorage.getItem(storageNs);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });

  const [meta, setMeta] = useState(() => {
    if (!storageNs) return { activeSpaceAbility: null };
    try {
      const raw = sessionStorage.getItem(`${storageNs}:meta`);
      return raw ? JSON.parse(raw) : { activeSpaceAbility: null };
    } catch {
      return { activeSpaceAbility: null };
    }
  });

  // Reset between runs
  useEffect(() => {
    if (!storageNs) {
      setPurchased({});
      setMeta({ activeSpaceAbility: null });
      lastResetTokenRef.current = resetToken;
      return;
    }
    if (lastResetTokenRef.current === resetToken) return;
    lastResetTokenRef.current = resetToken;

    try {
      sessionStorage.removeItem(storageNs);
      sessionStorage.removeItem(`${storageNs}:meta`);
    } catch {}
    setPurchased({});
    setMeta({ activeSpaceAbility: null });
  }, [resetToken, storageNs]);

  // Load when key changes
  useEffect(() => {
    if (!storageNs) return;
    try {
      const raw = sessionStorage.getItem(storageNs);
      setPurchased(raw ? JSON.parse(raw) : {});
    } catch {
      setPurchased({});
    }
    try {
      const raw = sessionStorage.getItem(`${storageNs}:meta`);
      setMeta(raw ? JSON.parse(raw) : { activeSpaceAbility: null });
    } catch {
      setMeta({ activeSpaceAbility: null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageNs]);

  // Persist + notify
  useEffect(() => {
    if (storageNs) {
      try {
        sessionStorage.setItem(storageNs, JSON.stringify(purchased || {}));
        sessionStorage.setItem(`${storageNs}:meta`, JSON.stringify(meta || {}));
      } catch {}
    }
    onBuildChange({ purchased: purchased || {}, meta: meta || {} });
  }, [purchased, meta, onBuildChange, storageNs]);

  const pointsSpent = useMemo(() => sumRanks(purchased), [purchased]);

  const [activeSpaceAbility, setActiveSpaceAbility] = useState(meta?.activeSpaceAbility || null);

  // keep meta in sync with picker
  useEffect(() => {
    setMeta((m) => ({ ...(m || {}), activeSpaceAbility: activeSpaceAbility || null }));
  }, [activeSpaceAbility]);

  // auto-pick if they only have one owned ability
  useEffect(() => {
    const hasThorns = Number(purchased["MIL_THORNS"] || 0) > 0;
    const hasDecoy = Number(purchased["RES_DECOY_HOLO"] || 0) > 0;

    if (!hasThorns && !hasDecoy) {
      if (activeSpaceAbility !== null) setActiveSpaceAbility(null);
      return;
    }
    if (hasThorns && !hasDecoy && activeSpaceAbility !== "THORNS") setActiveSpaceAbility("THORNS");
    if (!hasThorns && hasDecoy && activeSpaceAbility !== "DECOY") setActiveSpaceAbility("DECOY");
  }, [purchased, activeSpaceAbility]);

  // Split purchased state by tree (we store it all in one object, but render in two)
  const milPurchased = useMemo(() => {
    const out = {};
    for (const n of MIL_NODES) out[n.id] = purchased[n.id] || 0;
    return out;
  }, [purchased]);
  const resPurchased = useMemo(() => {
    const out = {};
    for (const n of RES_NODES) out[n.id] = purchased[n.id] || 0;
    return out;
  }, [purchased]);
  const engPurchased = useMemo(() => {
    const out = {};
    for (const n of ENG_NODES) out[n.id] = purchased[n.id] || 0;
    return out;
  }, [purchased]);

  const setMilPurchased = (updater) => {
    setPurchased((prev) => {
      const base = { ...(prev || {}) };
      const nextMil = typeof updater === "function" ? updater(milPurchased) : updater;
      for (const k of Object.keys(nextMil || {})) base[k] = nextMil[k];
      return base;
    });
  };

  const setResPurchased = (updater) => {
    setPurchased((prev) => {
      const base = { ...(prev || {}) };
      const nextRes = typeof updater === "function" ? updater(resPurchased) : updater;
      for (const k of Object.keys(nextRes || {})) base[k] = nextRes[k];
      return base;
    });
  };

  const setEngPurchased = (updater) => {
    setPurchased((prev) => {
      const base = { ...(prev || {}) };
      const nextEng = typeof updater === "function" ? updater(engPurchased) : updater;
      for (const k of Object.keys(nextEng || {})) base[k] = nextEng[k];
      return base;
    });
  };

  function resetAll() {
    // Refund everything you spent, then clear.
    const refund = pointsSpent;
    if (refund > 0) onSpend(-refund);
    setPurchased({});
    setMeta({ activeSpaceAbility: null });
    setActiveSpaceAbility(null);
  }

  return (
    <div className="xshopV2">
      <style>{`
        .xshopV2{
          --bg0:#070a12;
          --bg1:#0b1021;
          --line:#223056;
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

        .xshopTop{
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap:16px;
          padding: 12px 14px;
          border-radius: 12px;
          background: linear-gradient(180deg, rgba(10,16,34,0.75), rgba(6,8,18,0.65));
          border: 1px solid rgba(0,242,255,0.15);
          margin-bottom: 12px;
        }
        .xshopTop h2{
          margin:0;
          font-size:18px;
          letter-spacing:4px;
          font-weight:900;
        }
        .xshopRules{ display:none; }
        .xshopRules b{ color:#fff; }

        .xshopActions{
          display:flex;
          flex-direction:column;
          gap:10px;
          align-items:flex-end;
        }
        .xshopBtn{
          cursor:pointer;
          user-select:none;
          border-radius: 14px;
          padding: 10px 12px;
          letter-spacing: 2px;
          font-weight: 900;
          border: 1px solid rgba(255,82,119,0.45);
          background: rgba(255,0,122,0.16);
          color: rgba(255,220,240,0.95);
          box-shadow: 0 0 18px rgba(255,0,122,0.14);
        }
        .xshopBtn:hover{
          filter: brightness(1.07);
          box-shadow: 0 0 22px rgba(255,0,122,0.22);
        }
        .xshopBtn:active{ transform: translateY(1px); }

        .xshopTrees{
          display:grid;
          grid-template-columns: repeat(3, minmax(330px, 1fr));
          gap: 12px;
          align-items:start;
        }
        @media (max-width: 1180px){
          .xshopTrees{ grid-template-columns: 1fr; }
        }

        .xshop-tree{
          border-radius: 12px;
          border: 1px solid rgba(255,255,255,0.10);
          background: radial-gradient(1200px 900px at 30% 10%, rgba(0,242,255,0.10), transparent 60%),
                      radial-gradient(1200px 900px at 70% 0%, rgba(255,0,122,0.08), transparent 55%),
                      linear-gradient(180deg, rgba(7,10,18,0.70), rgba(4,6,12,0.62));
          box-shadow: 0 0 28px rgba(0,242,255,0.06);
          overflow:hidden;
        }

        .xshop-treeHeader{
          display:flex;
          justify-content:space-between;
          align-items:flex-start;
          gap: 10px;
          padding: 10px 12px 8px;
          border-bottom: 1px solid rgba(255,255,255,0.08);
          background: rgba(0,0,0,0.18);
        }
        .xshop-title{
          font-weight: 900;
          letter-spacing: 4px;
          font-size: 14px;
        }
        .xshop-subtitle{
          margin-top: 4px;
          font-size: 11px;
          color: rgba(145,165,214,0.95);
          letter-spacing: 1px;
        }
        .xshop-points{
          display:flex;
          align-items:baseline;
          gap: 8px;
          padding: 8px 10px;
          border-radius: 14px;
          border: 1px solid rgba(0,242,255,0.20);
          background: rgba(0,0,0,0.22);
          font-size: 12px;
          letter-spacing: 1px;
        }
        .xshop-points strong{
          font-size: 18px;
          letter-spacing: 0;
        }

        .xshop-spacePick{
          padding: 10px 14px 12px;
          border-bottom: 1px solid rgba(255,255,255,0.08);
          background: rgba(0,0,0,0.16);
          display:flex;
          flex-direction:column;
          gap: 10px;
        }
        .xshop-radio{
          display:flex;
          gap:8px;
          align-items:center;
          padding: 6px 10px;
          border-radius: 999px;
          border: 1px solid rgba(255,255,255,0.14);
          background: rgba(0,0,0,0.25);
          cursor:pointer;
          user-select:none;
        }
        .xshop-radio input{ accent-color: #00f2ff; }
        .xshop-radio.disabled{
          opacity: 0.45;
          cursor:not-allowed;
        }

        .xshop-gridWrap{
          position:relative;
          padding: 10px 10px 12px;
          overflow:hidden;
        }
        .xshop-lines{
          position:absolute;
          left: 10px;
          top: 10px;
          pointer-events:none;
          opacity: 0.95;
        }
        .xshop-grid{
          position:relative;
          display:grid;
          gap: 0px;
        }

        .xshop-node{
          width: 112px;
          height: 94px;
          border-radius: 8px;
          border: 1px solid rgba(255,255,255,0.12);
          background: rgba(0,0,0,0.26);
          box-shadow: 0 0 0 rgba(0,0,0,0);
          padding: 7px 8px 6px;
          text-align:left;
          cursor:pointer;
          transition: transform 120ms ease, filter 120ms ease, box-shadow 120ms ease, border-color 120ms ease;
        }
        .xshop-node:hover{
          transform: translateY(-1px);
          filter: brightness(1.06);
          box-shadow: 0 0 22px rgba(0,242,255,0.12);
          border-color: rgba(0,242,255,0.30);
        }
        .xshop-node:active{ transform: translateY(0px); }

        .xshop-node.locked{
          opacity: 0.42;
          cursor:not-allowed;
          filter: grayscale(0.2);
        }
        .xshop-node.unaffordable{
          opacity: 0.78;
          border-color: rgba(255,82,119,0.35);
          box-shadow: 0 0 14px rgba(255,82,119,0.10);
        }
        .xshop-node.maxed{
          border-color: rgba(76,255,154,0.35);
          box-shadow: 0 0 18px rgba(76,255,154,0.10);
        }

        .xshop-node.major{ border-color: rgba(182,145,255,0.30); }
        .xshop-node.capstone{ border-color: rgba(255,209,106,0.32); }

        .xshop-node.space{
          border-color: rgba(0,242,255,0.32);
        }
        .xshop-node.activeSpace{
          box-shadow: 0 0 22px rgba(0,242,255,0.18);
          border-color: rgba(0,242,255,0.55);
          background: rgba(0,242,255,0.08);
        }

        .xshop-icon{
          position:relative;
          width: 28px;
          height: 28px;
          border-radius: 8px;
          overflow:hidden;
          border: 1px solid rgba(255,255,255,0.14);
          background: rgba(255,255,255,0.06);
          box-shadow: 0 0 18px rgba(0,0,0,0.25);
        }
        .xshop-icon img{
          width:100%;
          height:100%;
          object-fit:cover;
          display:block;
        }
        .xshop-badge{
          position:absolute;
          right: -6px;
          top: -6px;
          padding: 2px 6px;
          border-radius: 999px;
          font-size: 9px;
          font-weight: 900;
          letter-spacing: 1px;
          color: rgba(230,255,255,0.95);
          border: 1px solid rgba(0,242,255,0.40);
          background: rgba(0,0,0,0.55);
          box-shadow: 0 0 14px rgba(0,242,255,0.12);
        }

        .xshop-name{
          margin-top: 5px;
          font-size: 8.8px;
          font-weight: 900;
          letter-spacing: 0.4px;
          line-height: 1.15;
          text-transform: uppercase;
          min-height: 20px;
        }
        .xshop-stat{
          font-size: 8px;
          line-height: 1.15;
          color: rgba(190,208,240,0.82);
          height: 26px;
          overflow: hidden;
          margin-top: 2px;
          letter-spacing: 0;
        }
        .xshop-rank{
          display:flex;
          align-items:baseline;
          justify-content:space-between;
          gap: 8px;
          margin-top: 4px;
          font-size: 10px;
          opacity: 0.9;
        }
        .xshop-rank em{
          font-style: normal;
          font-weight: 900;
          letter-spacing: 1px;
          opacity: 0.9;
        }
      `}</style>

      <div className="xshopTop">
        <div>
          <h2>{title}</h2>

          <div className="xshopRules">
            <b>Run Rules</b><br />
            • You earn <b>💠 pills equal to the mission difficulty</b> when you clear a tile (example: difficulty 5 → +5 pills).<br />
            • Spend pills to buy ranks. Talents apply automatically (you don’t “pick” them in the match lobby).<br />
            • Refreshing the browser wipes the run (roguelite).<br />
            • Unlocking is by arrows / prerequisites — no “row gates”.<br />
            • <b>SPACE</b> uses your chosen SPACE ability: <b>Thorns</b> or <b>Decoy</b> (only one can be active).<br />
            • Use <b>RESET TALENTS</b> to refund spent pills and respend.
          </div>
        </div>

        <div className="xshopActions">
          <button className="xshopBtn" onClick={resetAll}>
            RESET TALENTS
          </button>
          <div style={{ fontSize: 12, opacity: 0.75, textAlign: "right" }}>
            Spent: <b>{pointsSpent}</b><br />
            Abilities: <b>1 Thorns / 2 Decoy / 3 Turret</b>
          </div>
        </div>
      </div>

      <div className="xshopTrees">
        <Tree
          treeId="mil"
          title="COMBAT TALENTS"
          subtitle="Defense, Thorns, armor, and close-range starter perks."
          nodes={MIL_NODES}
          lines={MIL_LINES}
          credits={credits}
          purchased={milPurchased}
          setPurchased={setMilPurchased}
          onSpend={onSpend}
        />

        <Tree
          treeId="res"
          title="RESEARCH VESSEL"
          subtitle="Sidearms, holograms, cleanup tools, and utility."
          nodes={RES_NODES}
          lines={RES_LINES}
          credits={credits}
          purchased={resPurchased}
          setPurchased={setResPurchased}
          onSpend={onSpend}
        />

        <Tree
          treeId="eng"
          title="ENGINEERING BAY"
          subtitle="Deployables and expanded match loadouts."
          nodes={ENG_NODES}
          lines={ENG_LINES}
          credits={credits}
          purchased={engPurchased}
          setPurchased={setEngPurchased}
          onSpend={onSpend}
        />
      </div>
    </div>
  );
}

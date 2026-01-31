import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * GalaxyShop.jsx (Xeno Purge Roguelite Shop / Talent Trees)
 *
 * What it does:
 * - 3 Trees (side-by-side)
 * - Each tree is 8 tiers deep (rows 0..7)
 * - Up to 3 nodes per row (grid 3 columns)
 * - Click node to buy:
 *    - requires prerequisites
 *    - requires currency
 *    - supports multi-rank nodes (e.g., XP Pull Range x5)
 * - Ability & Passive selection limits:
 *    - max 2 abilities
 *    - max 2 passives
 *   (Buying an ability/passive will attempt to equip it; if full, it prompts to replace.)
 * - SVG dependency lines: grey when locked; bright when path is active.
 * - Optional persistence:
 *    - provide `storageKey` to persist until resetToken changes (game over / restart).
 *
 * How to use:
 * <GalaxyShop
 *   credits={runCredits}
 *   onSpend={(amount) => setRunCredits(c => c - amount)}
 *   resetToken={runIdOrDeathCounter}
 *   storageKey={`xenopurge_run_${runId}`}
 *   onBuildChange={(build) => setBuild(build)} // { abilities:[], passives:[], purchased:{} }
 * />
 */

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function makeIconUrl(n) {
  // Adjust relative path if you place this file elsewhere
  // This expects: src/assets/shop/t(1).png etc
  return new URL(`../assets/shop/t(${n}).png`, import.meta.url).href;
}

const TREE_LAYOUT = {
  cols: 3,
  rows: 8,
  // Compact, WoW-classic-ish layout
  cellW: 74,
  cellH: 74,
};

const BUILD_LIMITS = {
  abilities: 2,
  passives: 2,
};

const TYPE_LABEL = {
  stat: "Upgrade",
  passive: "Passive",
  ability: "Ability",
  capstone: "Capstone",
};

const RARITY = {
  minor: { badge: "MINOR" },
  major: { badge: "MAJOR" },
  capstone: { badge: "CAPSTONE" },
};

function defaultTrees() {
  /**
   * DESIGN RULES:
   * - 3 trees with Xeno-Purge flavor.
   * - Early ability: THORNS (SPACEBAR) on Tree B (defense).
   * - Early passive: TURRET (shitty Rifle rank 1 you always start with) on Tree A (weapons).
   * - XP pull range node is multi-rank x5.
   * - Double HP upgrade exists.
   *
   * Node schema:
   * {
   *   id, treeId,
   *   row, col, iconN,
   *   name, desc,
   *   type: 'stat'|'passive'|'ability'|'capstone'
   *   rarity: 'minor'|'major'|'capstone'
   *   cost: number (base cost)
   *   maxRank: number (default 1)
   *   prereq: [nodeId...]
   *   tags: [ 'hp', 'xp', 'weapon', ... ] // for your later effect mapping
   * }
   */

  const trees = [
    {
      id: "arsenal",
      title: "ARSENAL GRAFTS",
      subtitle: "weapon mods • drones • ammo logic",
      theme: "arsenal",
      nodes: [
        // ROW 0 (Start choices)
        {
          id: "arsenal_start_turret",
          treeId: "arsenal",
          row: 0,
          col: 0,
          iconN: 1,
          name: "SENTRY SEED",
          desc:
            "Passive. Start each planet with a weak micro-turret (Rifle Rank 1 vibe). Auto-fires at nearest xeno. (Placeholder: set turret DPS / range).",
          type: "passive",
          rarity: "minor",
          cost: 25,
          maxRank: 1,
          prereq: [],
          tags: ["passive", "turret", "starter"],
        },
        {
          id: "arsenal_start_reload",
          treeId: "arsenal",
          row: 0,
          col: 1,
          iconN: 2,
          name: "MAG LATCH",
          desc:
            "Upgrade. +8% reload speed per rank. After reloading, your next shot deals +10% damage.",
          type: "stat",
          rarity: "minor",
          cost: 25,
          maxRank: 2,
          prereq: [],
          tags: ["weapon", "reload"],
        },
        {
          id: "arsenal_start_shrapnel",
          treeId: "arsenal",
          row: 0,
          col: 2,
          iconN: 3,
          name: "SHRAPNEL JACKETS",
          desc:
            "Upgrade. Bullets have +10% proc chance per rank to fracture into 2 shards dealing 35% damage.",
          type: "stat",
          rarity: "minor",
          cost: 25,
          maxRank: 3,
          prereq: [],
          tags: ["weapon", "aoe"],
        },

        // ROW 1
        {
          id: "arsenal_r1_drone",
          treeId: "arsenal",
          row: 1,
          col: 0,
          iconN: 4,
          name: "DRONE CRADLE",
          desc:
            "Passive. Gain a companion drone that fires at the nearest enemy (0.8s, 35% weapon damage).",
          type: "passive",
          rarity: "minor",
          cost: 40,
          maxRank: 1,
          prereq: ["arsenal_start_turret"],
          tags: ["passive", "drone"],
        },
        {
          id: "arsenal_r1_pierce",
          treeId: "arsenal",
          row: 1,
          col: 1,
          iconN: 5,
          name: "PIERCE RAILS",
          desc:
            "Upgrade. +1 pierce per rank. Pierced hits deal 80% damage.",
          type: "stat",
          rarity: "minor",
          cost: 40,
          maxRank: 2,
          prereq: ["arsenal_start_reload", "arsenal_start_shrapnel"],
          tags: ["weapon", "pierce"],
        },
        {
          id: "arsenal_r1_heat",
          treeId: "arsenal",
          row: 1,
          col: 2,
          iconN: 6,
          name: "HEAT SINK PLATES",
          desc:
            "Upgrade. Continuous hits build Heat; at 12 hits, your next shot ignites for 60% weapon damage over 2s.",
          type: "stat",
          rarity: "minor",
          cost: 40,
          maxRank: 1,
          prereq: ["arsenal_start_shrapnel"],
          tags: ["weapon", "burn"],
        },

        // ROW 2 (BIG talent placeholder)
        {
          id: "arsenal_big_overclock",
          treeId: "arsenal",
          row: 2,
          col: 1,
          iconN: 7,
          name: "OVERKILL OVERCLOCK",
          desc:
            "MAJOR. After a kill, gain OVERCLOCK for 3s: +25% fire rate (refresh on kill).\nEvery 5th shot becomes a RAIL shot: +2 pierce and heavy knockback.",
          type: "ability",
          rarity: "major",
          cost: 85,
          maxRank: 1,
          prereq: ["arsenal_r1_pierce", "arsenal_r1_heat"],
          tags: ["ability", "weapon", "major"],
        },
        {
          id: "arsenal_r2_ammo",
          treeId: "arsenal",
          row: 2,
          col: 0,
          iconN: 8,
          name: "AMMO PRINTER",
          desc:
            "Upgrade. +20% ammo per rank. 6% chance on hit to refund 1 ammo.",
          type: "stat",
          rarity: "minor",
          cost: 60,
          maxRank: 2,
          prereq: ["arsenal_r1_drone"],
          tags: ["weapon", "ammo"],
        },
        {
          id: "arsenal_r2_crit",
          treeId: "arsenal",
          row: 2,
          col: 2,
          iconN: 9,
          name: "CRIT CALIBRATOR",
          desc:
            "Upgrade. +3% crit chance per rank. Crits splash 30% damage in a small radius.",
          type: "stat",
          rarity: "minor",
          cost: 60,
          maxRank: 3,
          prereq: ["arsenal_r1_heat"],
          tags: ["weapon", "crit"],
        },

        // ROW 3
        {
          id: "arsenal_r3_turret2",
          treeId: "arsenal",
          row: 3,
          col: 0,
          iconN: 10,
          name: "SENTRY PATCH v2",
          desc:
            "Passive upgrade. Turret gains tracking + slightly better DPS. (Placeholder: turret rank 2 stats).",
          type: "passive",
          rarity: "minor",
          cost: 80,
          maxRank: 1,
          prereq: ["arsenal_start_turret"],
          tags: ["passive", "turret"],
        },
        {
          id: "arsenal_r3_spread",
          treeId: "arsenal",
          row: 3,
          col: 1,
          iconN: 11,
          name: "PATTERN SPLITTER",
          desc:
            "Upgrade. Every 6/5 shots, fire a 3-round fan at 60% damage.",
          type: "stat",
          rarity: "minor",
          cost: 80,
          maxRank: 2,
          prereq: ["arsenal_big_overclock"],
          tags: ["weapon", "multishot"],
        },
        {
          id: "arsenal_r3_scrap",
          treeId: "arsenal",
          row: 3,
          col: 2,
          iconN: 12,
          name: "SCRAP HARVEST",
          desc:
            "Upgrade. +8% / +15% rewards from kills.",
          type: "stat",
          rarity: "minor",
          cost: 80,
          maxRank: 2,
          prereq: ["arsenal_r2_crit"],
          tags: ["economy"],
        },

        // ROW 4
        {
          id: "arsenal_r4_drone_laser",
          treeId: "arsenal",
          row: 4,
          col: 0,
          iconN: 13,
          name: "DRONE: NEEDLE LASER",
          desc:
            "Passive. Drone swaps to a piercing beam (ticks every 0.25s, 18% damage, pierces).",
          type: "passive",
          rarity: "minor",
          cost: 110,
          maxRank: 1,
          prereq: ["arsenal_r1_drone"],
          tags: ["passive", "drone", "laser"],
        },
        {
          id: "arsenal_r4_combo",
          treeId: "arsenal",
          row: 4,
          col: 1,
          iconN: 14,
          name: "COMBO COUNTER",
          desc:
            "Upgrade. Hitting enemies grants COMBO stacks (+2/+3/+4% damage each) up to 10. Lose 1 stack every 0.6s without a hit.",
          type: "stat",
          rarity: "minor",
          cost: 110,
          maxRank: 3,
          prereq: ["arsenal_r3_spread"],
          tags: ["weapon", "damage"],
        },
        {
          id: "arsenal_r4_knock",
          treeId: "arsenal",
          row: 4,
          col: 2,
          iconN: 15,
          name: "KNOCKBACK SERVOS",
          desc:
            "Upgrade. +20% / +35% knockback. First hit on an Elite every 4s mini-stuns (0.25s).",
          type: "stat",
          rarity: "minor",
          cost: 110,
          maxRank: 2,
          prereq: ["arsenal_r3_scrap"],
          tags: ["control"],
        },

        // ROW 5 (BIG)
        {
          id: "arsenal_big_saturation",
          treeId: "arsenal",
          row: 5,
          col: 1,
          iconN: 16,
          name: "SATURATION DOCTRINE",
          desc:
            "MAJOR. Your shots duplicate (+1 projectile) but base damage is -12%. Duplicates prefer new targets.",
          type: "ability",
          rarity: "major",
          cost: 160,
          maxRank: 1,
          prereq: ["arsenal_r4_combo", "arsenal_r4_knock"],
          tags: ["ability", "major"],
        },

        // ROW 6
        {
          id: "arsenal_r6_armor_pierce",
          treeId: "arsenal",
          row: 6,
          col: 0,
          iconN: 17,
          name: "ARMOR PUNCTURE",
          desc:
            "Upgrade. Shots apply BREACH for 2s: target takes +6% / +12% damage (refreshes).",
          type: "stat",
          rarity: "minor",
          cost: 180,
          maxRank: 2,
          prereq: ["arsenal_big_saturation"],
          tags: ["debuff"],
        },
        {
          id: "arsenal_r6_drone_swarm",
          treeId: "arsenal",
          row: 6,
          col: 2,
          iconN: 18,
          name: "DRONE SWARM BUS",
          desc:
            "Passive. Your drone splits into 2 drones at 65% power each.",
          type: "passive",
          rarity: "minor",
          cost: 180,
          maxRank: 1,
          prereq: ["arsenal_r4_drone_laser"],
          tags: ["passive", "drone"],
        },
        {
          id: "arsenal_r6_ricochet",
          treeId: "arsenal",
          row: 6,
          col: 1,
          iconN: 19,
          name: "RICOCHET LOGIC",
          desc:
            "Upgrade. Your shots ricochet once to a nearby target.",
          type: "stat",
          rarity: "minor",
          cost: 180,
          maxRank: 1,
          prereq: ["arsenal_big_saturation"],
          tags: ["weapon", "chain"],
        },

        // ROW 7 (Capstones — 3 bottom choices)
        {
          id: "arsenal_cap_murderclock",
          treeId: "arsenal",
          row: 7,
          col: 0,
          iconN: 20,
          name: "CAPSTONE: MURDERCLOCK",
          desc:
            "CAPSTONE. On a 10-kill streak, spawn 3 orbiting saws for 6s (each hits for 45% damage). Streak refreshes duration.",
          type: "capstone",
          rarity: "capstone",
          cost: 260,
          maxRank: 1,
          prereq: ["arsenal_r6_armor_pierce"],
          tags: ["capstone", "aoe"],
        },
        {
          id: "arsenal_cap_blackmag",
          treeId: "arsenal",
          row: 7,
          col: 1,
          iconN: 21,
          name: "CAPSTONE: BLACK MAG",
          desc:
            "CAPSTONE. Reloads create a gravity pulse that pulls enemies and empowers your next magazine (+20% damage, +1 pierce).",
          type: "capstone",
          rarity: "capstone",
          cost: 260,
          maxRank: 1,
          prereq: ["arsenal_r6_ricochet"],
          tags: ["capstone", "control"],
        },
        {
          id: "arsenal_cap_hivebreaker",
          treeId: "arsenal",
          row: 7,
          col: 2,
          iconN: 22,
          name: "CAPSTONE: HIVEBREAKER",
          desc:
            "CAPSTONE. Drone/Turret hits mark enemies. Marked enemies explode on death (80% damage in 80px) and spread the mark once.",
          type: "capstone",
          rarity: "capstone",
          cost: 260,
          maxRank: 1,
          prereq: ["arsenal_r6_drone_swarm"],
          tags: ["capstone", "drone"],
        },
      ],
    },

    {
      id: "aegis",
      title: "AEGIS PROTOCOL",
      subtitle: "defense • shields • retaliation",
      theme: "aegis",
      nodes: [
        // ROW 0 (Start choices) — includes THORNS early ability
        {
          id: "aegis_start_thorns",
          treeId: "aegis",
          row: 0,
          col: 0,
          iconN: 23,
          name: "THORNS (SPACE)",
          desc:
            "Ability. SPACE: 2.5s invulnerable. Enemies touching you take 40 damage/s and are pushed back. Cooldown 18s.",
          type: "ability",
          rarity: "minor",
          cost: 35,
          maxRank: 1,
          prereq: [],
          tags: ["ability", "thorns", "invuln"],
        },
        {
          id: "aegis_start_hp",
          treeId: "aegis",
          row: 0,
          col: 1,
          iconN: 24,
          name: "BONEPLATE LINING",
          desc:
            "Upgrade. +15 max HP per rank.",
          type: "stat",
          rarity: "minor",
          cost: 25,
          maxRank: 3,
          prereq: [],
          tags: ["hp"],
        },
        {
          id: "aegis_start_shield",
          treeId: "aegis",
          row: 0,
          col: 2,
          iconN: 25,
          name: "SCRAP SHIELD",
          desc:
            "Passive. Gain a tiny shield that recharges out of combat. (Placeholder: shield value, recharge delay).",
          type: "passive",
          rarity: "minor",
          cost: 25,
          maxRank: 1,
          prereq: [],
          tags: ["passive", "shield"],
        },

        // ROW 1
        {
          id: "aegis_r1_thorns_cooldown",
          treeId: "aegis",
          row: 1,
          col: 0,
          iconN: 26,
          name: "THORNS: QUICK REARM",
          desc:
            "Upgrade. -2s cooldown per rank and +0.3s duration per rank.",
          type: "stat",
          rarity: "minor",
          cost: 55,
          maxRank: 2,
          prereq: ["aegis_start_thorns"],
          tags: ["thorns", "cdr"],
        },
        {
          id: "aegis_r1_regen",
          treeId: "aegis",
          row: 1,
          col: 1,
          iconN: 27,
          name: "FIELD STIM",
          desc:
            "Upgrade. Regenerate 0.6 / 1.0 HP/s if you haven't been hit for 3s.",
          type: "stat",
          rarity: "minor",
          cost: 45,
          maxRank: 2,
          prereq: ["aegis_start_hp"],
          tags: ["hp", "regen"],
        },
        {
          id: "aegis_r1_reflect",
          treeId: "aegis",
          row: 1,
          col: 2,
          iconN: 28,
          name: "REFLEX PLATING",
          desc:
            "Upgrade. Taking damage deals 20/30/40 retaliation damage to nearby enemies (1s internal cooldown).",
          type: "stat",
          rarity: "minor",
          cost: 45,
          maxRank: 3,
          prereq: ["aegis_start_shield"],
          tags: ["retaliation"],
        },

        // ROW 2 (BIG)
        {
          id: "aegis_big_secondskin",
          treeId: "aegis",
          row: 2,
          col: 1,
          iconN: 29,
          name: "SECOND SKIN MATRIX",
          desc:
            "MAJOR. Gain FORTIFY stacks: every 4s without taking damage, gain 1 stack (max 3). A stack reduces the next hit by 35% and emits a 25-damage shock.",
          type: "ability",
          rarity: "major",
          cost: 95,
          maxRank: 1,
          prereq: ["aegis_r1_regen", "aegis_r1_reflect"],
          tags: ["ability", "major", "defense"],
        },
        {
          id: "aegis_r2_hp_double",
          treeId: "aegis",
          row: 2,
          col: 0,
          iconN: 30,
          name: "DOUBLE VITALS",
          desc:
            "Upgrade. +100% Max HP. Move speed -6%.",
          type: "stat",
          rarity: "major",
          cost: 120,
          maxRank: 1,
          prereq: ["aegis_start_hp"],
          tags: ["hp", "major"],
        },
        {
          id: "aegis_r2_shield_burst",
          treeId: "aegis",
          row: 2,
          col: 2,
          iconN: 31,
          name: "SHIELD: BURST RECHARGE",
          desc:
            "Passive upgrade. When shield breaks, it starts recharging 2s sooner and recharges 25% faster.",
          type: "passive",
          rarity: "minor",
          cost: 70,
          maxRank: 1,
          prereq: ["aegis_start_shield"],
          tags: ["passive", "shield"],
        },

        // ROW 3
        {
          id: "aegis_r3_thorns_damage",
          treeId: "aegis",
          row: 3,
          col: 0,
          iconN: 32,
          name: "THORNS: RAZOR CROWN",
          desc:
            "Upgrade. Thorns damage +25% per rank. Final 0.5s deals double.",
          type: "stat",
          rarity: "minor",
          cost: 115,
          maxRank: 2,
          prereq: ["aegis_r1_thorns_cooldown"],
          tags: ["thorns", "damage"],
        },
        {
          id: "aegis_r3_armor",
          treeId: "aegis",
          row: 3,
          col: 1,
          iconN: 33,
          name: "HARDENED WEAVE",
          desc:
            "Upgrade. Take -4% / -6% / -8% damage.",
          type: "stat",
          rarity: "minor",
          cost: 100,
          maxRank: 3,
          prereq: ["aegis_big_secondskin"],
          tags: ["dr"],
        },
        {
          id: "aegis_r3_bleedout",
          treeId: "aegis",
          row: 3,
          col: 2,
          iconN: 34,
          name: "BLEEDOUT FAILSAFE",
          desc:
            "Upgrade. Once per planet: lethal damage leaves you at 1 HP, grants 2s invuln and +30% move for 3s.",
          type: "stat",
          rarity: "minor",
          cost: 120,
          maxRank: 1,
          prereq: ["aegis_r2_shield_burst"],
          tags: ["survival"],
        },

        // ROW 4
        {
          id: "aegis_r4_spike_wave",
          treeId: "aegis",
          row: 4,
          col: 0,
          iconN: 35,
          name: "THORNS: SPIKE WAVE",
          desc:
            "Ability upgrade. Activating Thorns sends a spike ring (90 damage) and strong knockback.",
          type: "ability",
          rarity: "minor",
          cost: 150,
          maxRank: 1,
          prereq: ["aegis_r3_thorns_damage"],
          tags: ["ability", "thorns"],
        },
        {
          id: "aegis_r4_shield_siphon",
          treeId: "aegis",
          row: 4,
          col: 1,
          iconN: 36,
          name: "SHIELD SIPHON",
          desc:
            "Upgrade. XP pickups restore 4 / 7 shield. Large pickups restore double.",
          type: "stat",
          rarity: "minor",
          cost: 140,
          maxRank: 2,
          prereq: ["aegis_r3_armor"],
          tags: ["shield", "xp"],
        },
        {
          id: "aegis_r4_reflect_pop",
          treeId: "aegis",
          row: 4,
          col: 2,
          iconN: 37,
          name: "REFLECT: POPPING SPINES",
          desc:
            "Upgrade. Retaliation can crit and chains to 1 extra target at 60% damage.",
          type: "stat",
          rarity: "minor",
          cost: 140,
          maxRank: 2,
          prereq: ["aegis_r1_reflect"],
          tags: ["retaliation", "chain"],
        },

        // ROW 5 (BIG)
        {
          id: "aegis_big_bastion",
          treeId: "aegis",
          row: 5,
          col: 1,
          iconN: 38,
          name: "BASTION DECISION",
          desc:
            "MAJOR. While shield is up: +15% damage and +25% retaliation radius. While shield is down: +10% move speed and +8% damage reduction.",
          type: "ability",
          rarity: "major",
          cost: 220,
          maxRank: 1,
          prereq: ["aegis_r4_shield_siphon", "aegis_r4_reflect_pop"],
          tags: ["ability", "major"],
        },

        // ROW 6
        {
          id: "aegis_r6_thorns_extend",
          treeId: "aegis",
          row: 6,
          col: 0,
          iconN: 39,
          name: "THORNS: EXTEND + LEECH",
          desc:
            "Upgrade. While Thorns is active, heal 1% max HP per enemy touched (max 6% per use).",
          type: "stat",
          rarity: "minor",
          cost: 240,
          maxRank: 1,
          prereq: ["aegis_r4_spike_wave"],
          tags: ["thorns", "heal"],
        },
        {
          id: "aegis_r6_barrier",
          treeId: "aegis",
          row: 6,
          col: 1,
          iconN: 40,
          name: "BARRIER STACKS",
          desc:
            "Passive. Every 10s gain a Barrier charge (max 2). A charge negates one hit and triggers a 0.3s time-slow.",
          type: "passive",
          rarity: "minor",
          cost: 230,
          maxRank: 1,
          prereq: ["aegis_big_bastion"],
          tags: ["passive", "barrier"],
        },
        {
          id: "aegis_r6_ironheart",
          treeId: "aegis",
          row: 6,
          col: 2,
          iconN: 41,
          name: "IRONHEART ROUTING",
          desc:
            "Upgrade. Convert 20% of your Max HP into Shield strength (or vice versa) based on whichever is lower.",
          type: "stat",
          rarity: "minor",
          cost: 230,
          maxRank: 1,
          prereq: ["aegis_big_bastion"],
          tags: ["hp", "dr"],
        },

        // ROW 7 (Capstones — 3 choices)
        {
          id: "aegis_cap_apex_thorns",
          treeId: "aegis",
          row: 7,
          col: 0,
          iconN: 42,
          name: "CAPSTONE: APEX THORNS",
          desc:
            "CAPSTONE. Thorns cooldown -35% and duration +1s. Enemies killed by Thorns burst into 6 spikes (each 35% damage).",
          type: "capstone",
          rarity: "capstone",
          cost: 320,
          maxRank: 1,
          prereq: ["aegis_r6_thorns_extend"],
          tags: ["capstone", "thorns"],
        },
        {
          id: "aegis_cap_unkillable",
          treeId: "aegis",
          row: 7,
          col: 1,
          iconN: 43,
          name: "CAPSTONE: UNKILLABLE PROTOCOL",
          desc:
            "CAPSTONE. First lethal hit each planet: refill shield, slow time 50% for 2s, and clear debuffs.",
          type: "capstone",
          rarity: "capstone",
          cost: 320,
          maxRank: 1,
          prereq: ["aegis_r6_barrier"],
          tags: ["capstone", "survival"],
        },
        {
          id: "aegis_cap_revenant",
          treeId: "aegis",
          row: 7,
          col: 2,
          iconN: 44,
          name: "CAPSTONE: REVENANT PLATING",
          desc:
            "CAPSTONE. Store 35% of damage taken (cap 200). Using an ability releases it as a nova; cap scales with Max HP.",
          type: "capstone",
          rarity: "capstone",
          cost: 320,
          maxRank: 1,
          prereq: ["aegis_r6_ironheart"],
          tags: ["capstone", "nova"],
        },
      ],
    },

    {
      id: "voidwalk",
      title: "VOIDWALK SYSTEMS",
      subtitle: "mobility • XP vacuum • time tricks",
      theme: "voidwalk",
      nodes: [
        // ROW 0
        {
          id: "void_start_xpvac",
          treeId: "voidwalk",
          row: 0,
          col: 0,
          iconN: 45,
          name: "XP VACUUM COIL",
          desc:
            "Upgrade. +70 XP pull range per rank (max 5).",
          type: "stat",
          rarity: "minor",
          cost: 20,
          maxRank: 5,
          prereq: [],
          tags: ["xp", "vacuum"],
        },
        {
          id: "void_start_dash",
          treeId: "voidwalk",
          row: 0,
          col: 1,
          iconN: 46,
          name: "PHASE STEP",
          desc:
            "Ability. Dash 150px, ignores collision. Cooldown 9s.",
          type: "ability",
          rarity: "minor",
          cost: 35,
          maxRank: 1,
          prereq: [],
          tags: ["ability", "dash"],
        },
        {
          id: "void_start_speed",
          treeId: "voidwalk",
          row: 0,
          col: 2,
          iconN: 47,
          name: "LIGHTWEIGHT RIG",
          desc:
            "Upgrade. +4% move speed per rank.",
          type: "stat",
          rarity: "minor",
          cost: 25,
          maxRank: 3,
          prereq: [],
          tags: ["move"],
        },

        // ROW 1
        {
          id: "void_r1_xpheal",
          treeId: "voidwalk",
          row: 1,
          col: 0,
          iconN: 48,
          name: "ORB MEDICINE",
          desc:
            "Upgrade. XP pickups heal 0.6% / 1.0% max HP.",
          type: "stat",
          rarity: "minor",
          cost: 45,
          maxRank: 2,
          prereq: ["void_start_xpvac"],
          tags: ["xp", "heal"],
        },
        {
          id: "void_r1_dash_i",
          treeId: "voidwalk",
          row: 1,
          col: 1,
          iconN: 49,
          name: "PHASE STEP: I-FRAMES",
          desc:
            "Upgrade. Dash grants 0.20s / 0.35s i-frames.",
          type: "stat",
          rarity: "minor",
          cost: 55,
          maxRank: 2,
          prereq: ["void_start_dash"],
          tags: ["dash", "iframes"],
        },
        {
          id: "void_r1_time",
          treeId: "voidwalk",
          row: 1,
          col: 2,
          iconN: 50,
          name: "CHRONO SENSOR",
          desc:
            "Upgrade. Enemies within 90px are slowed 10% / 16% while you're moving.",
          type: "stat",
          rarity: "minor",
          cost: 45,
          maxRank: 2,
          prereq: ["void_start_speed"],
          tags: ["slow", "control"],
        },

        // ROW 2 (BIG)
        {
          id: "void_big_gravity",
          treeId: "voidwalk",
          row: 2,
          col: 1,
          iconN: 51,
          name: "GRAVITY ENGINE",
          desc:
            "MAJOR. XP orbs and loot are pulled 35% faster. Nearby enemies are gently tugged toward you (no effect on bosses).",
          type: "ability",
          rarity: "major",
          cost: 95,
          maxRank: 1,
          prereq: ["void_r1_dash_i", "void_r1_time"],
          tags: ["ability", "major", "mobility"],
        },
        {
          id: "void_r2_xpbonus",
          treeId: "voidwalk",
          row: 2,
          col: 0,
          iconN: 52,
          name: "XP DIVIDEND",
          desc:
            "Upgrade. +6% XP gained per rank.",
          type: "stat",
          rarity: "minor",
          cost: 60,
          maxRank: 3,
          prereq: ["void_r1_xpheal"],
          tags: ["xp"],
        },
        {
          id: "void_r2_loot",
          treeId: "voidwalk",
          row: 2,
          col: 2,
          iconN: 53,
          name: "SALVAGE MAGNET",
          desc:
            "Upgrade. +12% / +20% pickup radius; pickups drift to you.",
          type: "stat",
          rarity: "minor",
          cost: 60,
          maxRank: 2,
          prereq: ["void_start_xpvac"],
          tags: ["economy"],
        },

        // ROW 3
        {
          id: "void_r3_dash_reset",
          treeId: "voidwalk",
          row: 3,
          col: 1,
          iconN: 54,
          name: "PHASE STEP: RESET ON KILL",
          desc:
            "Upgrade. Kills have a 10% / 18% chance to reset dash cooldown.",
          type: "stat",
          rarity: "minor",
          cost: 115,
          maxRank: 2,
          prereq: ["void_big_gravity"],
          tags: ["dash", "cdr"],
        },
        {
          id: "void_r3_orb_sprint",
          treeId: "voidwalk",
          row: 3,
          col: 0,
          iconN: 55,
          name: "ORBITAL SPRINT",
          desc:
            "Upgrade. Picking up XP grants +10% / +16% move speed for 2.5s.",
          type: "stat",
          rarity: "minor",
          cost: 105,
          maxRank: 2,
          prereq: ["void_r2_xpbonus"],
          tags: ["xp", "move"],
        },
        {
          id: "void_r3_blinkmine",
          treeId: "voidwalk",
          row: 3,
          col: 2,
          iconN: 56,
          name: "BLINK MINE",
          desc:
            "Ability. Drop a mine (14s cd) that blinks enemies 120px away and slows them 30% for 2s.",
          type: "ability",
          rarity: "minor",
          cost: 120,
          maxRank: 1,
          prereq: ["void_r2_loot"],
          tags: ["ability", "control"],
        },

        // ROW 4
        {
          id: "void_r4_vac_rank",
          treeId: "voidwalk",
          row: 4,
          col: 0,
          iconN: 57,
          name: "XP VACUUM: OVERDRIVE",
          desc:
            "Upgrade. At 5 ranks of Vacuum Coil, pull radius doubles and orb travel speed increases.",
          type: "stat",
          rarity: "minor",
          cost: 140,
          maxRank: 1,
          prereq: ["void_start_xpvac"],
          tags: ["xp", "vacuum"],
        },
        {
          id: "void_r4_timeslip",
          treeId: "voidwalk",
          row: 4,
          col: 1,
          iconN: 58,
          name: "TIME SLIP",
          desc:
            "Ability. Slow time in a 220px bubble for 2.5s (22s cd). Your attack speed is unaffected.",
          type: "ability",
          rarity: "minor",
          cost: 150,
          maxRank: 1,
          prereq: ["void_r3_dash_reset"],
          tags: ["ability", "time"],
        },
        {
          id: "void_r4_afterimage",
          treeId: "voidwalk",
          row: 4,
          col: 2,
          iconN: 59,
          name: "AFTERIMAGE ECHO",
          desc:
            "Passive. Dashing leaves an echo for 2s that taunts and absorbs 1 hit.",
          type: "passive",
          rarity: "minor",
          cost: 140,
          maxRank: 1,
          prereq: ["void_r3_blinkmine"],
          tags: ["passive", "taunt"],
        },

        // ROW 5 (BIG)
        {
          id: "void_big_paradox",
          treeId: "voidwalk",
          row: 5,
          col: 1,
          iconN: 60,
          name: "PARADOX ROUTER",
          desc:
            "MAJOR. After using an ability, gain PARADOX for 6s: +20% move speed and your next dash shocks nearby enemies (60 damage, 3s cd).",
          type: "ability",
          rarity: "major",
          cost: 220,
          maxRank: 1,
          prereq: ["void_r4_timeslip", "void_r4_afterimage"],
          tags: ["ability", "major"],
        },

        // ROW 6
        {
          id: "void_r6_telefrag",
          treeId: "voidwalk",
          row: 6,
          col: 0,
          iconN: 61,
          name: "TELEFRAG WINDOW",
          desc:
            "Upgrade. Dashing through enemies deals 85 damage (6s internal cooldown).",
          type: "stat",
          rarity: "minor",
          cost: 240,
          maxRank: 1,
          prereq: ["void_big_paradox"],
          tags: ["dash", "damage"],
        },
        {
          id: "void_r6_orb_frenzy",
          treeId: "voidwalk",
          row: 6,
          col: 1,
          iconN: 62,
          name: "ORB FRENZY",
          desc:
            "Upgrade. Picking up a large XP bundle grants +20% fire rate for 4s.",
          type: "stat",
          rarity: "minor",
          cost: 240,
          maxRank: 1,
          prereq: ["void_big_paradox"],
          tags: ["xp", "weapon"],
        },
        {
          id: "void_r6_voidcloak",
          treeId: "voidwalk",
          row: 6,
          col: 2,
          iconN: 63,
          name: "VOID CLOAK",
          desc:
            "Passive. Every 12s, when you would be hit, become untargetable for 0.4s (shimmer).",
          type: "passive",
          rarity: "minor",
          cost: 250,
          maxRank: 1,
          prereq: ["void_big_paradox"],
          tags: ["passive", "evasion"],
        },

        // ROW 7 capstones (3 choices)
        {
          id: "void_cap_singularity",
          treeId: "voidwalk",
          row: 7,
          col: 0,
          iconN: 64,
          name: "CAPSTONE: SINGULARITY HEART",
          desc:
            "CAPSTONE. Every 14s spawn a mini-singularity for 3s: pulls enemies; you deal +18% damage inside.",
          type: "capstone",
          rarity: "capstone",
          cost: 320,
          maxRank: 1,
          prereq: ["void_r6_telefrag"],
          tags: ["capstone", "control"],
        },
        {
          id: "void_cap_speedgod",
          treeId: "voidwalk",
          row: 7,
          col: 1,
          iconN: 65,
          name: "CAPSTONE: SPEED GOD",
          desc:
            "CAPSTONE. Move speed above 100% converts to damage (+0.6% dmg per 1% speed above base) and leaves a damaging wake (25% dmg).",
          type: "capstone",
          rarity: "capstone",
          cost: 320,
          maxRank: 1,
          prereq: ["void_r6_orb_frenzy"],
          tags: ["capstone", "move", "damage"],
        },
        {
          id: "void_cap_timezero",
          treeId: "voidwalk",
          row: 7,
          col: 2,
          iconN: 66,
          name: "CAPSTONE: TIME ZERO",
          desc:
            "CAPSTONE. Once per planet: freeze time for 2s. During freeze, dash has no cooldown and reload is instant.",
          type: "capstone",
          rarity: "capstone",
          cost: 320,
          maxRank: 1,
          prereq: ["void_r6_voidcloak"],
          tags: ["capstone", "time"],
        },
      ],
    },
  ];

  return trees;
}

function buildNodeIndex(trees) {
  const byId = new Map();
  trees.forEach((t) => t.nodes.forEach((n) => byId.set(n.id, n)));
  return byId;
}

function canBuyNode(node, purchased, credits) {
  const rank = purchased[node.id]?.rank || 0;
  if (rank >= (node.maxRank || 1)) return { ok: false, reason: "MAXED" };

  // prereqs must be purchased (rank >=1)
  for (const pre of node.prereq || []) {
    if (!purchased[pre] || (purchased[pre].rank || 0) < 1) {
      return { ok: false, reason: "LOCKED" };
    }
  }

  const cost = getNodeCost(node, rank);
  if (credits < cost) return { ok: false, reason: "NO_CREDITS" };

  return { ok: true, reason: "OK", cost };
}

function getNodeCost(node, currentRank) {
  // simple scaling: each rank after the first costs +35%
  const base = node.cost || 50;
  const r = currentRank || 0;
  const scaled = base * Math.pow(1.35, r);
  return Math.round(scaled);
}

function isAbility(node) {
  return node.type === "ability" || node.type === "capstone";
}
function isPassive(node) {
  return node.type === "passive";
}

function cx(...parts) {
  return parts.filter(Boolean).join(" ");
}

function usePersistentState(storageKey, resetToken, initial) {
  const [state, setState] = useState(() => {
    if (!storageKey) return initial;
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return initial;
      const parsed = JSON.parse(raw);
      return parsed ?? initial;
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    if (!storageKey) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
    } catch {
      // ignore
    }
  }, [storageKey, state]);

  // reset when resetToken changes
  const prevReset = useRef(resetToken);
  useEffect(() => {
    if (prevReset.current !== resetToken) {
      prevReset.current = resetToken;
      setState(initial);
      if (storageKey) {
        try {
          localStorage.removeItem(storageKey);
        } catch {
          // ignore
        }
      }
    }
  }, [resetToken]); // eslint-disable-line react-hooks/exhaustive-deps

  return [state, setState];
}

export default function GalaxyShop({
  credits = 0,
  onSpend = () => {},
  onBuildChange = () => {},
  storageKey = null,
  resetToken = 0,
  title = "PLANETARY SHOP",
}) {
  const trees = useMemo(() => defaultTrees(), []);
  const nodeIndex = useMemo(() => buildNodeIndex(trees), [trees]);

  const initialBuild = useMemo(
    () => ({
      purchased: {}, // { [nodeId]: { rank:number } }
      abilities: [], // nodeIds
      passives: [], // nodeIds
    }),
    []
  );

  const [build, setBuild] = usePersistentState(storageKey, resetToken, initialBuild);
  const [toast, setToast] = useState(null);

  // Hover tooltip (WoW-style)
  const [hoverNodeId, setHoverNodeId] = useState(null);
  const [hoverXY, setHoverXY] = useState({ x: 0, y: 0 });

  const [replacePrompt, setReplacePrompt] = useState(null);
  // { kind:'ability'|'passive', incomingNodeId, options:[equippedNodeId...] }

  useEffect(() => {
    onBuildChange(build);
  }, [build]); // eslint-disable-line react-hooks/exhaustive-deps

  function showToast(msg) {
    setToast(msg);
    window.clearTimeout(showToast._t);
    showToast._t = window.setTimeout(() => setToast(null), 2000);
  }

  function equip(kind, nodeId) {
    setBuild((prev) => {
      const next = { ...prev };
      const listName = kind === "ability" ? "abilities" : "passives";
      const list = [...(next[listName] || [])];

      if (list.includes(nodeId)) return prev; // already equipped

      const limit = kind === "ability" ? BUILD_LIMITS.abilities : BUILD_LIMITS.passives;

      if (list.length < limit) {
        list.push(nodeId);
        next[listName] = list;
        return next;
      }

      // prompt replace
      setReplacePrompt({
        kind,
        incomingNodeId: nodeId,
        options: list,
      });
      return prev;
    });
  }

  function replaceEquipped(targetId) {
    if (!replacePrompt) return;

    const { kind, incomingNodeId, options } = replacePrompt;
    const listName = kind === "ability" ? "abilities" : "passives";

    setBuild((prev) => {
      const next = { ...prev };
      const list = [...(next[listName] || [])];
      const idx = list.indexOf(targetId);
      if (idx >= 0) list[idx] = incomingNodeId;
      next[listName] = list;
      return next;
    });

    setReplacePrompt(null);
    showToast(`Equipped ${nodeIndex.get(incomingNodeId)?.name || "new item"}`);
  }

  function unequip(kind, nodeId) {
    const listName = kind === "ability" ? "abilities" : "passives";
    setBuild((prev) => {
      const next = { ...prev };
      next[listName] = (next[listName] || []).filter((id) => id !== nodeId);
      return next;
    });
  }

  function buy(node) {
    setBuild((prev) => {
      const purchased = prev.purchased || {};
      const rank = purchased[node.id]?.rank || 0;

      const check = canBuyNode(node, purchased, credits);
      if (!check.ok) {
        if (check.reason === "LOCKED") showToast("Locked: buy prerequisites first.");
        else if (check.reason === "NO_CREDITS") showToast("Not enough rewards.");
        else if (check.reason === "MAXED") showToast("Already maxed.");
        return prev;
      }

      const cost = check.cost;
      onSpend(cost);

      const next = { ...prev, purchased: { ...purchased } };
      next.purchased[node.id] = { rank: rank + 1 };

      // auto-equip on first purchase for abilities/passives
      if (rank === 0) {
        if (isAbility(node)) equip("ability", node.id);
        if (isPassive(node)) equip("passive", node.id);
      }

      showToast(`Purchased: ${node.name} (-${cost})`);
      return next;
    });
  }

  function isPurchased(nodeId) {
    return (build.purchased?.[nodeId]?.rank || 0) > 0;
  }

  function currentRank(nodeId) {
    return build.purchased?.[nodeId]?.rank || 0;
  }

  function nodeIsUnlockable(node) {
    const purchased = build.purchased || {};
    for (const pre of node.prereq || []) {
      if (!purchased[pre] || (purchased[pre].rank || 0) < 1) return false;
    }
    return true;
  }

  function nodeStatus(node) {
    const rank = currentRank(node.id);
    const unlockable = nodeIsUnlockable(node);
    const cost = getNodeCost(node, rank);
    const affordable = credits >= cost;

    if (rank >= (node.maxRank || 1)) return "maxed";
    if (!unlockable) return "locked";
    if (!affordable) return "unaffordable";
    return "available";
  }

  // Build SVG lines per tree
  function computeLines(tree) {
    const nodes = tree.nodes;
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const lines = [];
    for (const child of nodes) {
      for (const parentId of child.prereq || []) {
        const parent = byId.get(parentId);
        if (!parent) continue;
        lines.push({ from: parent, to: child });
      }
    }
    return lines;
  }

  function renderTree(tree, treeIdx) {
    const { cols, rows, cellW, cellH } = TREE_LAYOUT;
    const w = cols * cellW;
    const h = rows * cellH;

    const lines = computeLines(tree);

    // node -> pixel center
    const centerOf = (n) => {
      const x = n.col * cellW + cellW / 2;
      const y = n.row * cellH + cellH / 2;
      return { x, y };
    };

    return (
      <div key={tree.id} className={cx("xshop-tree", `theme-${tree.theme}`)}>
        <div className="xshop-treeHeader">
          <div className="xshop-treeTitle">{tree.title}</div>
          <div className="xshop-treeSub">{tree.subtitle}</div>
        </div>

        <div className="xshop-treeBody" style={{ width: w, height: h }}>
          {/* lines */}
          <svg className="xshop-lines" width={w} height={h}>
            {lines.map((ln, i) => {
              const a = centerOf(ln.from);
              const b = centerOf(ln.to);

              const fromBought = isPurchased(ln.from.id);
              const toUnlockable = nodeIsUnlockable(ln.to);
              const toBought = isPurchased(ln.to.id);

              const active = fromBought && toUnlockable;
              const completed = fromBought && toBought;

              return (
                <line
                  key={i}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  className={cx(
                    "xshop-line",
                    active && "is-active",
                    completed && "is-complete"
                  )}
                />
              );
            })}
          </svg>

          {/* grid */}
          <div
            className="xshop-grid"
            style={{
              gridTemplateColumns: `repeat(${cols}, ${cellW}px)`,
              gridTemplateRows: `repeat(${rows}, ${cellH}px)`,
            }}
          >
            {tree.nodes.map((node) => {
              const status = nodeStatus(node);
              const rank = currentRank(node.id);
              const maxRank = node.maxRank || 1;
              const cost = getNodeCost(node, rank);

              const equippedAbility = build.abilities?.includes(node.id);
              const equippedPassive = build.passives?.includes(node.id);

              const equipped = equippedAbility || equippedPassive;

              return (
                <div
                  key={node.id}
                  className={cx(
                    "xshop-cell",
                    status,
                    node.rarity === "major" && "is-major",
                    node.type === "capstone" && "is-capstone",
                    equipped && "is-equipped"
                  )}
                  style={{ gridColumn: node.col + 1, gridRow: node.row + 1 }}
                >
                  <button
                    className="xshop-node"
                    onClick={() => buy(node)}
                    onMouseEnter={(e) => {
                      setHoverNodeId(node.id);
                      setHoverXY({ x: e.clientX, y: e.clientY });
                    }}
                    onMouseMove={(e) => {
                      if (hoverNodeId === node.id) setHoverXY({ x: e.clientX, y: e.clientY });
                    }}
                    onMouseLeave={() => {
                      if (hoverNodeId === node.id) setHoverNodeId(null);
                    }}
                    onFocus={(e) => {
                      setHoverNodeId(node.id);
                      const r = e.currentTarget.getBoundingClientRect();
                      setHoverXY({ x: r.right, y: r.top + r.height / 2 });
                    }}
                    onBlur={() => {
                      if (hoverNodeId === node.id) setHoverNodeId(null);
                    }}
                  >
                    <img className="xshop-icon" src={makeIconUrl(node.iconN)} alt={node.name} />

                    {status !== "maxed" && (
                      <div className="xshop-costBadge">{cost}</div>
                    )}

                    {maxRank > 1 && (
                      <div className="xshop-rankBadge">
                        {rank}/{maxRank}
                      </div>
                    )}

                    {equipped && <div className="xshop-equipPip" />}
                  </button>

                  {(equippedAbility || equippedPassive) && (
                    <button
                      className="xshop-unequip"
                      onClick={() => unequip(equippedAbility ? "ability" : "passive", node.id)}
                      title="Unequip"
                    >
                      ✕
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  const equippedAbilityNodes = (build.abilities || []).map((id) => nodeIndex.get(id)).filter(Boolean);
  const equippedPassiveNodes = (build.passives || []).map((id) => nodeIndex.get(id)).filter(Boolean);

  const hoverNode = hoverNodeId ? nodeIndex.get(hoverNodeId) : null;
  const hoverRank = hoverNode ? currentRank(hoverNode.id) : 0;
  const hoverMaxRank = hoverNode ? hoverNode.maxRank || 1 : 1;
  const hoverCost = hoverNode ? getNodeCost(hoverNode, hoverRank) : 0;
  const hoverStatus = hoverNode ? nodeStatus(hoverNode) : "locked";
  const hoverPrereqNames = useMemo(() => {
    if (!hoverNode) return [];
    return (hoverNode.prereq || []).map((id) => nodeIndex.get(id)?.name).filter(Boolean);
  }, [hoverNodeId, nodeIndex]);

  const tooltipPos = useMemo(() => {
    if (!hoverNode) return null;
    const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
    const vh = typeof window !== "undefined" ? window.innerHeight : 800;
    const w = 300;
    const h = 220;
    const x = clamp(hoverXY.x + 16, 10, vw - w - 10);
    const y = clamp(hoverXY.y + 16, 10, vh - h - 10);
    return { left: x, top: y, width: w, height: h };
  }, [hoverNodeId, hoverXY.x, hoverXY.y]);

  return (
    <div className="xshop-root">
      <style>{`
        .xshop-root{
          width:100%;
          user-select:none;
          color: rgba(255,255,255,0.92);
          font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;
        }
        .xshop-wrap{
          display:grid;
          grid-template-columns: repeat(3, minmax(260px, 1fr));
          gap:12px;
          align-items:start;
        }
        .xshop-topbar{
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap:12px;
          margin-bottom:10px;
        }
        .xshop-title{
          font-weight:800;
          letter-spacing:0.08em;
          font-size:14px;
          opacity:0.95;
          text-transform:uppercase;
        }
        .xshop-credits{
          display:flex;
          gap:10px;
          align-items:center;
          background: rgba(0,0,0,0.35);
          border:1px solid rgba(255,255,255,0.10);
          border-radius:12px;
          padding:8px 12px;
          box-shadow: 0 10px 25px rgba(0,0,0,0.25);
        }
        .xshop-credits b{ font-size:15px; }
        .xshop-build{
          display:flex;
          flex-wrap:wrap;
          gap:10px;
          align-items:flex-start;
          justify-content:flex-end;
        }
        .xshop-buildBox{
          min-width: 240px;
          background: rgba(0,0,0,0.35);
          border:1px solid rgba(255,255,255,0.10);
          border-radius:16px;
          padding:10px 12px;
          box-shadow: 0 10px 25px rgba(0,0,0,0.25);
        }
        .xshop-buildHdr{
          display:flex;
          align-items:center;
          justify-content:space-between;
          margin-bottom:8px;
          font-size:12px;
          opacity:0.9;
        }
        .xshop-chipRow{
          display:flex;
          flex-wrap:wrap;
          gap:8px;
        }
        .xshop-chip{
          border:1px solid rgba(255,255,255,0.14);
          background: rgba(255,255,255,0.05);
          padding:6px 10px;
          border-radius:999px;
          font-size:12px;
          display:flex;
          gap:8px;
          align-items:center;
        }
        .xshop-chip small{
          opacity:0.75;
        }

        /* (wrap already grid above) */

        .xshop-tree{
          background: rgba(0,0,0,0.35);
          border:1px solid rgba(255,255,255,0.10);
          border-radius:18px;
          padding:10px;
          box-shadow: 0 14px 30px rgba(0,0,0,0.28);
          overflow:hidden;
          position:relative;
        }
        .xshop-treeHeader{
          padding:6px 6px 10px;
        }
        .xshop-treeTitle{
          font-weight:900;
          letter-spacing:0.08em;
          font-size:12px;
          text-transform:uppercase;
          opacity:0.95;
        }
        .xshop-treeSub{
          font-size:11px;
          opacity:0.7;
          margin-top:4px;
        }
        .xshop-treeBody{
          position:relative;
          border-radius:14px;
          background: rgba(255,255,255,0.03);
          border:1px solid rgba(255,255,255,0.06);
          overflow:hidden;
        }
        .xshop-treeBody::before{
          content:"";
          position:absolute;
          inset:-40px;
          background: var(--treeBg, radial-gradient(circle at 30% 20%, rgba(255,255,255,0.08), rgba(0,0,0,0.0) 55%));
          opacity:0.65;
          filter: saturate(1.12);
          z-index:0;
        }
        .xshop-treeBody::after{
          content:"";
          position:absolute;
          inset:0;
          background:
            linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px);
          background-size: 24px 24px;
          opacity:0.16;
          z-index:0;
          pointer-events:none;
        }
        .xshop-lines{
          position:absolute;
          inset:0;
          z-index:1;
          pointer-events:none;
        }
        .xshop-line{
          stroke: rgba(255,255,255,0.10);
          stroke-width: 2.2;
          stroke-linecap: round;
        }
        .xshop-line.is-active{
          stroke: rgba(120,220,255,0.38);
          stroke-width: 2.8;
        }
        .xshop-line.is-complete{
          stroke: rgba(140,255,180,0.60);
          stroke-width: 3.2;
        }

        .xshop-grid{
          position:absolute;
          inset:0;
          display:grid;
          z-index:2;
        }

        .xshop-cell{
          position:relative;
          display:flex;
          align-items:center;
          justify-content:center;
        }

        .xshop-node{
          width: 56px;
          height: 56px;
          border-radius: 12px;
          border: 1px solid rgba(255,255,255,0.12);
          background: rgba(0,0,0,0.25);
          box-shadow: 0 10px 20px rgba(0,0,0,0.22);
          padding: 0;
          cursor:pointer;
          text-align:left;
          transition: transform 120ms ease, border-color 120ms ease, filter 120ms ease;
          position:relative;
          display:flex;
          align-items:center;
          justify-content:center;
          overflow:hidden;
        }
        .xshop-node:hover{
          transform: translateY(-1px);
          border-color: rgba(255,255,255,0.22);
        }
        .xshop-icon{
          width: 100%;
          height: 100%;
          border-radius: 12px;
          border:1px solid rgba(255,255,255,0.14);
          background: rgba(255,255,255,0.04);
          object-fit: cover;
        }

        .xshop-costBadge{
          position:absolute;
          left:4px;
          bottom:4px;
          font-size:10px;
          font-weight:800;
          padding:2px 6px;
          border-radius:999px;
          background: rgba(0,0,0,0.65);
          border:1px solid rgba(255,255,255,0.18);
        }
        .xshop-rankBadge{
          position:absolute;
          right:4px;
          bottom:4px;
          font-size:10px;
          font-weight:800;
          padding:2px 6px;
          border-radius:999px;
          background: rgba(0,0,0,0.65);
          border:1px solid rgba(255,255,255,0.18);
        }
        .xshop-equipPip{
          position:absolute;
          right:6px;
          top:6px;
          width:10px;
          height:10px;
          border-radius:999px;
          background: rgba(140,255,180,0.85);
          box-shadow: 0 0 12px rgba(140,255,180,0.35);
        }
        .xshop-nodeMeta{
          flex: 1 1 auto;
          min-width: 0;
        }
        .xshop-nodeName{
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 0.03em;
          text-transform: uppercase;
          white-space: nowrap;
          overflow:hidden;
          text-overflow: ellipsis;
        }
        .xshop-nodeType{
          font-size: 10px;
          opacity: 0.75;
          margin-top: 2px;
          display:flex;
          align-items:center;
          gap:6px;
        }
        .xshop-badge{
          font-size:9px;
          padding:2px 6px;
          border-radius:999px;
          border:1px solid rgba(255,255,255,0.16);
          opacity:0.85;
        }
        .xshop-nodeDesc{
          font-size: 10px;
          opacity: 0.70;
          margin-top: 4px;
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .xshop-bottomBar{
          position:absolute;
          left:8px;
          right:8px;
          bottom:6px;
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap:6px;
          font-size:10px;
          opacity:0.9;
        }
        .xshop-equippedTag{
          font-size:9px;
          padding:2px 6px;
          border-radius:999px;
          background: rgba(140,255,180,0.12);
          border: 1px solid rgba(140,255,180,0.28);
          white-space:nowrap;
        }

        /* states */
        .xshop-cell.locked .xshop-node{
          filter: grayscale(0.65) brightness(0.75);
          opacity:0.62;
          cursor:not-allowed;
        }
        .xshop-cell.unaffordable .xshop-node{
          filter: grayscale(0.2) brightness(0.85);
          opacity:0.85;
        }
        .xshop-cell.available .xshop-node{
          opacity:1;
        }
        .xshop-cell.maxed .xshop-node{
          border-color: rgba(140,255,180,0.38);
          background: rgba(140,255,180,0.08);
        }
        .xshop-cell.is-major .xshop-node{
          border-color: rgba(120,220,255,0.22);
          box-shadow: 0 14px 24px rgba(0,0,0,0.25);
        }
        .xshop-cell.is-capstone .xshop-node{
          border-color: rgba(255,220,120,0.22);
          background: rgba(255,220,120,0.06);
        }
        .xshop-cell.is-equipped .xshop-node{
          outline: 2px solid rgba(140,255,180,0.30);
        }

        .xshop-unequip{
          position:absolute;
          top:8px;
          right:8px;
          z-index:5;
          width:22px;
          height:22px;
          border-radius:999px;
          border:1px solid rgba(255,255,255,0.18);
          background: rgba(0,0,0,0.40);
          color: rgba(255,255,255,0.85);
          cursor:pointer;
        }
        .xshop-unequip:hover{
          border-color: rgba(255,255,255,0.30);
        }

        /* WoW-ish hover tooltip */
        .xshop-tooltip{
          position:fixed;
          z-index:9999;
          pointer-events:none;
          background: rgba(10,10,14,0.94);
          border:1px solid rgba(255,255,255,0.16);
          border-left:3px solid var(--accent, rgba(255,255,255,0.22));
          border-radius:14px;
          padding:10px;
          box-shadow: 0 18px 50px rgba(0,0,0,0.55);
          backdrop-filter: blur(6px);
        }
        .xshop-tipTop{
          display:flex;
          gap:10px;
          align-items:center;
          margin-bottom:8px;
        }
        .xshop-tipIcon{
          width:52px;
          height:52px;
          border-radius:12px;
          border:1px solid rgba(255,255,255,0.16);
          object-fit:cover;
          background: rgba(255,255,255,0.04);
          flex:0 0 auto;
        }
        .xshop-tipName{
          font-weight:900;
          letter-spacing:0.05em;
          text-transform:uppercase;
          font-size:12px;
        }
        .xshop-tipSub{
          font-size:10px;
          opacity:0.78;
          margin-top:2px;
        }
        .xshop-tipBody{
          font-size:11px;
          opacity:0.88;
          line-height:1.3;
        }
        .xshop-tipFoot{
          margin-top:8px;
          font-size:10px;
          opacity:0.9;
        }
        .xshop-tipWarn{ opacity:0.85; }
        .xshop-tipOk{ opacity:0.92; }
        .xshop-tipReq{ margin-top:4px; opacity:0.82; }

        .xshop-toast{
          position:fixed;
          left:50%;
          transform:translateX(-50%);
          bottom:22px;
          padding:10px 14px;
          border-radius:999px;
          background: rgba(0,0,0,0.72);
          border:1px solid rgba(255,255,255,0.12);
          box-shadow: 0 12px 30px rgba(0,0,0,0.35);
          font-size:12px;
          z-index:9999;
        }

        .xshop-modalBack{
          position:fixed;
          inset:0;
          background: rgba(0,0,0,0.55);
          z-index:9998;
          display:flex;
          align-items:center;
          justify-content:center;
          padding:18px;
        }
        .xshop-modal{
          width:min(560px, 96vw);
          background: rgba(10,10,14,0.92);
          border:1px solid rgba(255,255,255,0.14);
          border-radius:20px;
          box-shadow: 0 18px 50px rgba(0,0,0,0.55);
          padding:14px;
        }
        .xshop-modal h3{
          margin:0 0 6px;
          font-size:14px;
          letter-spacing:0.05em;
          text-transform:uppercase;
        }
        .xshop-modal p{
          margin:0 0 12px;
          font-size:12px;
          opacity:0.8;
          line-height:1.35;
        }
        .xshop-modalRow{
          display:flex;
          gap:10px;
          flex-wrap:wrap;
        }
        .xshop-modalBtn{
          flex: 1 1 240px;
          border-radius:16px;
          border:1px solid rgba(255,255,255,0.14);
          background: rgba(255,255,255,0.05);
          padding:10px;
          color: rgba(255,255,255,0.9);
          cursor:pointer;
          text-align:left;
        }
        .xshop-modalBtn:hover{
          border-color: rgba(255,255,255,0.26);
          background: rgba(255,255,255,0.08);
        }
        .xshop-modalBtn small{ opacity:0.75; display:block; margin-top:4px; }
        .xshop-modalActions{
          display:flex;
          justify-content:flex-end;
          margin-top:12px;
        }
        .xshop-cancel{
          border-radius:12px;
          border:1px solid rgba(255,255,255,0.14);
          background: rgba(0,0,0,0.25);
          padding:8px 12px;
          color: rgba(255,255,255,0.85);
          cursor:pointer;
        }

        /* Theme backgrounds + accents */
        .theme-arsenal{
          --accent: rgba(255,210,120,0.55);
          --treeBg:
            radial-gradient(circle at 20% 18%, rgba(255,210,120,0.22), rgba(0,0,0,0.0) 55%),
            radial-gradient(circle at 80% 70%, rgba(120,220,255,0.12), rgba(0,0,0,0.0) 60%),
            linear-gradient(140deg, rgba(255,120,80,0.10), rgba(0,0,0,0.0) 55%);
        }
        .theme-aegis{
          --accent: rgba(210,120,255,0.55);
          --treeBg:
            radial-gradient(circle at 25% 25%, rgba(210,120,255,0.20), rgba(0,0,0,0.0) 55%),
            radial-gradient(circle at 75% 75%, rgba(255,120,180,0.10), rgba(0,0,0,0.0) 60%),
            linear-gradient(140deg, rgba(120,220,255,0.08), rgba(0,0,0,0.0) 55%);
        }
        .theme-voidwalk{
          --accent: rgba(120,220,255,0.55);
          --treeBg:
            radial-gradient(circle at 30% 20%, rgba(120,220,255,0.20), rgba(0,0,0,0.0) 55%),
            radial-gradient(circle at 70% 80%, rgba(180,140,255,0.12), rgba(0,0,0,0.0) 60%),
            linear-gradient(140deg, rgba(255,120,220,0.07), rgba(0,0,0,0.0) 55%);
        }

        .xshop-tree.theme-arsenal .xshop-treeTitle,
        .xshop-tree.theme-aegis .xshop-treeTitle,
        .xshop-tree.theme-voidwalk .xshop-treeTitle{ text-shadow: 0 0 14px rgba(0,0,0,0.55); }

        .xshop-tree.theme-arsenal{ border-color: rgba(255,210,120,0.18); }
        .xshop-tree.theme-aegis{ border-color: rgba(210,120,255,0.18); }
        .xshop-tree.theme-voidwalk{ border-color: rgba(120,220,255,0.18); }

        .xshop-cell.available .xshop-node{ box-shadow: 0 0 0 1px rgba(255,255,255,0.06), 0 10px 20px rgba(0,0,0,0.22); }

        @media (max-width: 1180px){
          .xshop-wrap{ grid-template-columns: 1fr; }
          .xshop-build{ justify-content:flex-start; }
        }
      `}</style>

      <div className="xshop-topbar">
        <div className="xshop-title">{title}</div>

        <div className="xshop-build">
          <div className="xshop-credits">
            <span style={{ opacity: 0.8 }}>Rewards</span>
            <b>{credits}</b>
          </div>

          <div className="xshop-buildBox">
            <div className="xshop-buildHdr">
              <span>Abilities ({equippedAbilityNodes.length}/{BUILD_LIMITS.abilities})</span>
              <span style={{ opacity: 0.7 }}>max 2</span>
            </div>
            <div className="xshop-chipRow">
              {equippedAbilityNodes.length === 0 ? (
                <span style={{ opacity: 0.6, fontSize: 12 }}>None equipped</span>
              ) : (
                equippedAbilityNodes.map((n) => (
                  <span key={n.id} className="xshop-chip">
                    {n.name} <small>({TYPE_LABEL[n.type]})</small>
                  </span>
                ))
              )}
            </div>
          </div>

          <div className="xshop-buildBox">
            <div className="xshop-buildHdr">
              <span>Passives ({equippedPassiveNodes.length}/{BUILD_LIMITS.passives})</span>
              <span style={{ opacity: 0.7 }}>max 2</span>
            </div>
            <div className="xshop-chipRow">
              {equippedPassiveNodes.length === 0 ? (
                <span style={{ opacity: 0.6, fontSize: 12 }}>None equipped</span>
              ) : (
                equippedPassiveNodes.map((n) => (
                  <span key={n.id} className="xshop-chip">
                    {n.name} <small>({TYPE_LABEL[n.type]})</small>
                  </span>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="xshop-wrap">
        {trees.map((t, i) => renderTree(t, i))}
      </div>

      {hoverNode && tooltipPos && (
        <div
          className={cx("xshop-tooltip", `theme-${hoverNode.treeId}`)}
          style={{ left: tooltipPos.left, top: tooltipPos.top, width: tooltipPos.width }}
        >
          <div className="xshop-tipTop">
            <img className="xshop-tipIcon" src={makeIconUrl(hoverNode.iconN)} alt={hoverNode.name} />
            <div className="xshop-tipMeta">
              <div className="xshop-tipName">{hoverNode.name}</div>
              <div className="xshop-tipSub">
                {TYPE_LABEL[hoverNode.type] || "Upgrade"} · {RARITY[hoverNode.rarity]?.badge || ""}
                {hoverMaxRank > 1 && (
                  <span className="xshop-tipRank"> · Rank {hoverRank}/{hoverMaxRank}</span>
                )}
              </div>
            </div>
          </div>

          <div className="xshop-tipBody" style={{ whiteSpace: "pre-line" }}>
            {hoverNode.desc}
          </div>

          <div className="xshop-tipFoot">
            <div>
              Cost: <b>{hoverStatus === "maxed" ? "—" : hoverCost}</b>
              {hoverStatus === "locked" && <span className="xshop-tipWarn"> · Locked</span>}
              {hoverStatus === "unaffordable" && <span className="xshop-tipWarn"> · Not enough rewards</span>}
              {hoverStatus === "maxed" && <span className="xshop-tipOk"> · Maxed</span>}
            </div>
            {hoverPrereqNames.length > 0 && (
              <div className="xshop-tipReq">
                Requires: <b>{hoverPrereqNames.join(" · ")}</b>
              </div>
            )}
          </div>
        </div>
      )}

      {toast && <div className="xshop-toast">{toast}</div>}

      {replacePrompt && (
        <div className="xshop-modalBack" onClick={() => setReplacePrompt(null)}>
          <div className="xshop-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Build Limit Reached</h3>
            <p>
              You can only equip <b>2 {replacePrompt.kind === "ability" ? "abilities" : "passives"}</b>.
              Replace one with <b>{nodeIndex.get(replacePrompt.incomingNodeId)?.name}</b>?
            </p>

            <div className="xshop-modalRow">
              {replacePrompt.options.map((id) => {
                const n = nodeIndex.get(id);
                return (
                  <button
                    key={id}
                    className="xshop-modalBtn"
                    onClick={() => replaceEquipped(id)}
                  >
                    <b>{n?.name || id}</b>
                    <small>{n?.desc || ""}</small>
                  </button>
                );
              })}
            </div>

            <div className="xshop-modalActions">
              <button className="xshop-cancel" onClick={() => setReplacePrompt(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

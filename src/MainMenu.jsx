import React, { useEffect, useMemo, useState } from "react";

import bg1 from "./assets/bg (1).png";
import bg2 from "./assets/bg (2).png";
import bg3 from "./assets/bg (3).png";
import bg4 from "./assets/bg (4).png";
import bg5 from "./assets/bg (5).png";
import bg6 from "./assets/bg (6).png";
import bg7 from "./assets/bg (7).png";
import bg8 from "./assets/bg (8).png";

function pickNextIndex(prevIdx, total) {
  if (total <= 1) return 0;
  let next = prevIdx;
  while (next === prevIdx) next = Math.floor(Math.random() * total);
  return next;
}

export default function MainMenu({ onStart }) {
  const images = useMemo(() => [bg1, bg2, bg3, bg4, bg5, bg6, bg7, bg8], []);
  const [idx, setIdx] = useState(() => Math.floor(Math.random() * images.length));
  const [prevIdx, setPrevIdx] = useState(null);
  const [fadeIn, setFadeIn] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setPrevIdx(idx);
      setIdx((cur) => pickNextIndex(cur, images.length));
      setFadeIn(false);
      requestAnimationFrame(() => setFadeIn(true));
    }, 10000); // 10s
    return () => clearInterval(interval);
  }, [idx, images.length]);

  const current = images[idx];
  const previous = prevIdx != null ? images[prevIdx] : null;

  return (
    <div
      className="ui-layer"
      style={{
        position: "relative",
        overflow: "hidden",
        minHeight: "100vh",

        // ✅ center your menu content again
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
      }}
    >
      {/* ✅ Background slideshow */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 0,
          pointerEvents: "none",

          // ✅ "tiny black border" / letterbox area to preserve quality
          background: "black",
        }}
      >
        {/* previous */}
        {previous && (
          <img
            src={previous}
            alt=""
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",

              // ✅ do NOT zoom/crop; preserve quality
              objectFit: "contain",
              objectPosition: "center",

              opacity: fadeIn ? 0 : 1,
              transition: "opacity 900ms ease",

              // ✅ slight dim for readability
              filter: "brightness(0.75)",

              // ✅ subtle frame to make letterbox edges intentional
              boxShadow: "inset 0 0 0 2px rgba(0,0,0,0.7)",
            }}
          />
        )}

        {/* current */}
        <img
          src={current}
          alt=""
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "contain",
            objectPosition: "center",

            opacity: fadeIn ? 1 : 0,
            transition: "opacity 900ms ease",

            filter: "brightness(0.75)",
            boxShadow: "inset 0 0 0 2px rgba(0,0,0,0.7)",
          }}
        />

        {/* readability overlay */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(circle at center, rgba(0,0,0,0.10), rgba(0,0,0,0.65))",
          }}
        />
      </div>

      {/* ✅ Foreground UI */}
      <div style={{ position: "relative", zIndex: 1 }}>
        <h1 style={{ fontSize: "4rem", letterSpacing: "15px", margin: 0 }}>
          XENO <span style={{ color: "var(--neon-pink)" }}>PURGE</span>
        </h1>

        <div style={{ marginTop: 24, display: "flex", justifyContent: "center" }}>
          <button className="scifi-btn" onClick={onStart}>
            INITIALIZE
          </button>
        </div>
      </div>
    </div>
  );
}

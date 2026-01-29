import React from "react";

export default function MainMenu({ onStart }) {
  return (
    <div className="ui-layer">
      <h1 style={{ fontSize: "4rem", letterSpacing: "15px" }}>
        XENO <span style={{ color: "var(--neon-pink)" }}>PURGE</span>
      
      </h1>

      <button className="scifi-btn" onClick={onStart}>
        INITIALIZE
      </button>
    </div>
  );
}
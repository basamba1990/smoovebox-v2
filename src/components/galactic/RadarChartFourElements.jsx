import React from "react";

/**
 * Lightweight 4-element radar chart (Air, Eau, Terre, Feu).
 * Reusable for hobby profile display (e.g. Football DISC card).
 */
function RadarChartFourElements({ dominantColor, secondaryColor }) {
  const size = 90;
  const center = size / 2;
  const maxRadius = 28;
  const axes = [
    { label: "Air", angle: -90 },
    { label: "Eau", angle: 0 },
    { label: "Terre", angle: 90 },
    { label: "Feu", angle: 180 },
  ];

  const ELEMENT_AXIS_INDEX = { jaune: 0, bleu: 1, vert: 2, rouge: 3 };

  const values = [0.3, 0.3, 0.3, 0.3];
  if (dominantColor != null && ELEMENT_AXIS_INDEX[dominantColor] != null) {
    values[ELEMENT_AXIS_INDEX[dominantColor]] = 0.9;
  }
  if (secondaryColor != null && ELEMENT_AXIS_INDEX[secondaryColor] != null) {
    values[ELEMENT_AXIS_INDEX[secondaryColor]] = 0.6;
  }

  return (
    <div className="relative">
      <svg width={size} height={size} className="text-white">
        <defs>
          <radialGradient id="radar-bg-galaxy" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(15,23,42,0.0)" />
            <stop offset="100%" stopColor="rgba(15,23,42,0.65)" />
          </radialGradient>
        </defs>
        <circle
          cx={center}
          cy={center}
          r={maxRadius + 4}
          fill="url(#radar-bg-galaxy)"
          stroke="rgba(148, 163, 184, 0.6)"
          strokeWidth={0.6}
        />

        {[0.33, 0.66, 1].map((ratio) => (
          <circle
            key={ratio}
            cx={center}
            cy={center}
            r={maxRadius * ratio}
            stroke="rgba(148, 163, 184, 0.35)"
            strokeWidth={0.6}
            fill="none"
          />
        ))}

        {axes.map((ax) => {
          const rad = (ax.angle * Math.PI) / 180;
          const x = center + maxRadius * Math.cos(rad);
          const y = center + maxRadius * Math.sin(rad);
          return (
            <line
              key={ax.label}
              x1={center}
              y1={center}
              x2={x}
              y2={y}
              stroke="rgba(148, 163, 184, 0.4)"
              strokeWidth={0.6}
            />
          );
        })}

        {(() => {
          const pts = axes.map((ax, i) => {
            const rad = (ax.angle * Math.PI) / 180;
            const r = maxRadius * values[i];
            const x = center + r * Math.cos(rad);
            const y = center + r * Math.sin(rad);
            return { x, y, label: ax.label, value: values[i] };
          });

          const pathD =
            pts.length > 0
              ? `M ${pts[0].x} ${pts[0].y} ` +
                pts
                  .slice(1)
                  .map((p) => `L ${p.x} ${p.y}`)
                  .join(" ") +
                " Z"
              : "";

          return (
            <>
              {pathD && (
                <path
                  d={pathD}
                  fill="none"
                  stroke="white"
                  strokeWidth={1}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  strokeOpacity={0.9}
                />
              )}

              {pts.map((p) => {
                const bubbleRadius = 3 + p.value * 3;
                return (
                  <circle
                    key={`${p.label}-bubble`}
                    cx={p.x}
                    cy={p.y}
                    r={bubbleRadius}
                    fill="white"
                    fillOpacity={0.9}
                    stroke="rgba(56, 189, 248, 0.8)"
                    strokeWidth={0.6}
                  />
                );
              })}
            </>
          );
        })()}

        {axes.map((ax) => {
          const rad = (ax.angle * Math.PI) / 180;
          const r = maxRadius + 10;
          const x = center + r * Math.cos(rad);
          const y = center + r * Math.sin(rad);
          return (
            <text
              key={ax.label}
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="white"
              fontSize={8}
              fontWeight={500}
            >
              {ax.label}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

export default RadarChartFourElements;

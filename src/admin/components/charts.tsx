import React from "react";
import { WEEKDAY_LABELS } from "../format";

const BRAND = "#6c5ce7";
const TEAL = "#1abc9c";

function hasSignal(values: number[]): boolean {
  return values.some((value) => Number.isFinite(value) && value !== 0);
}

function ChartEmpty({ label, isDark }: { label: string; isDark: boolean }) {
  return (
    <div className={`flex h-40 items-center justify-center text-xs ${isDark ? "text-zinc-500" : "text-[#636e72]"}`}>
      {label}
    </div>
  );
}

export function Sparkline({
  values,
  stroke = BRAND,
  isDark,
  width = 72,
  height = 28,
}: {
  values: number[];
  stroke?: string;
  isDark: boolean;
  width?: number;
  height?: number;
}) {
  if (!hasSignal(values)) {
    return (
      <svg width={width} height={height} aria-hidden className="shrink-0 opacity-40">
        <line
          x1={4}
          y1={height / 2}
          x2={width - 4}
          y2={height / 2}
          stroke={isDark ? "#3f3f46" : "#e8ecf0"}
          strokeWidth="1.5"
        />
      </svg>
    );
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const coords = values.map((value, index) => {
    const x = values.length === 1 ? width / 2 : (index / (values.length - 1)) * (width - 4) + 2;
    const y = height - 3 - ((value - min) / span) * (height - 6);
    return `${x},${y}`;
  });
  return (
    <svg width={width} height={height} aria-hidden className="shrink-0">
      <polyline fill="none" stroke={stroke} strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" points={coords.join(" ")} />
    </svg>
  );
}

export type LineSeries = {
  id: string;
  label: string;
  color: string;
  values: number[];
};

export function LineChart({
  labels,
  series,
  isDark,
  height = 220,
}: {
  labels: string[];
  series: LineSeries[];
  isDark: boolean;
  height?: number;
}) {
  const all = series.flatMap((item) => item.values);
  if (labels.length === 0 || !hasSignal(all)) {
    return <ChartEmpty label="Sem dados no período selecionado." isDark={isDark} />;
  }
  const width = 640;
  const pad = { l: 36, r: 12, t: 12, b: 28 };
  const innerW = width - pad.l - pad.r;
  const innerH = height - pad.t - pad.b;
  const max = Math.max(...all, 0);
  const min = 0;
  const span = max - min || 1;
  const pointX = (index: number, count: number) =>
    pad.l + (count <= 1 ? innerW / 2 : (index / (count - 1)) * innerW);
  const pointY = (value: number) => pad.t + innerH - ((value - min) / span) * innerH;
  const grid = isDark ? "#27272a" : "#e8ecf0";
  const axis = isDark ? "#71717a" : "#636e72";

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" role="img">
        {[0, 0.5, 1].map((frac) => {
          const y = pad.t + innerH * (1 - frac);
          return (
            <g key={frac}>
              <line x1={pad.l} x2={width - pad.r} y1={y} y2={y} stroke={grid} />
              <text x={4} y={y + 4} fontSize="10" fill={axis}>
                {Math.round(min + span * frac)}
              </text>
            </g>
          );
        })}
        {series.map((item) => {
          const points = item.values.map((value, index) => `${pointX(index, item.values.length)},${pointY(value)}`).join(" ");
          return (
            <polyline
              key={item.id}
              fill="none"
              stroke={item.color}
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
              points={points}
            />
          );
        })}
        {labels.length <= 14
          ? labels.map((label, index) => (
              <text
                key={label + index}
                x={pointX(index, labels.length)}
                y={height - 8}
                fontSize="9"
                fill={axis}
                textAnchor="middle"
              >
                {label.slice(5)}
              </text>
            ))
          : null}
      </svg>
      <div className="mt-2 flex flex-wrap gap-4 text-xs">
        {series.map((item) => (
          <span key={item.id} className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm" style={{ background: item.color }} />
            {item.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export function BarChart({
  items,
  isDark,
  color = BRAND,
}: {
  items: { label: string; value: number }[];
  isDark: boolean;
  color?: string;
}) {
  const max = Math.max(0, ...items.map((item) => item.value));
  if (items.length === 0 || max === 0) {
    return <ChartEmpty label="Nenhuma instituição no período." isDark={isDark} />;
  }
  return (
    <div className="space-y-2.5">
      {items.map((item) => (
        <div key={item.label} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 text-sm">
          <div className="min-w-0">
            <p className={`mb-1 truncate text-xs ${isDark ? "text-zinc-300" : "text-[#2d3436]"}`}>{item.label}</p>
            <div className={`h-2 rounded-full ${isDark ? "bg-zinc-800" : "bg-[#eef0f3]"}`}>
              <div
                className="h-2 rounded-full"
                style={{ width: `${Math.max(4, (item.value / max) * 100)}%`, background: color }}
              />
            </div>
          </div>
          <span className="tabular-nums text-xs font-semibold">{item.value}</span>
        </div>
      ))}
    </div>
  );
}

export function VerticalBars({
  items,
  isDark,
  color = BRAND,
}: {
  items: { label: string; value: number }[];
  isDark: boolean;
  color?: string;
}) {
  const max = Math.max(0, ...items.map((item) => item.value));
  if (items.length === 0 || max === 0) {
    return <ChartEmpty label="Sem classificação ASA no período." isDark={isDark} />;
  }
  return (
    <div className="flex h-44 items-end gap-2">
      {items.map((item) => (
        <div key={item.label} className="flex min-w-0 flex-1 flex-col items-center gap-1">
          <span className="text-[10px] tabular-nums">{item.value}</span>
          <div
            className="w-full max-w-8 rounded-t-sm"
            style={{
              height: `${Math.max(6, (item.value / max) * 120)}px`,
              background: color,
              opacity: 0.45 + (item.value / max) * 0.55,
            }}
          />
          <span className={`text-[10px] ${isDark ? "text-zinc-500" : "text-[#636e72]"}`}>{item.label}</span>
        </div>
      ))}
    </div>
  );
}

export function DonutChart({
  items,
  isDark,
  centerLabel,
}: {
  items: { label: string; value: number; color?: string }[];
  isDark: boolean;
  centerLabel?: string;
}) {
  const total = items.reduce((sum, item) => sum + (Number.isFinite(item.value) ? item.value : 0), 0);
  if (total <= 0 || items.length === 0) {
    return <ChartEmpty label="Sem técnicas registradas no período." isDark={isDark} />;
  }
  const palette = [BRAND, TEAL, "#00cec9", "#fdcb6e", "#e17055", "#74b9ff", "#a29bfe"];
  const cx = 80;
  const cy = 80;
  const r = 52;
  const ir = 34;
  let angle = -Math.PI / 2;
  const arcs = items.map((item, index) => {
    const frac = item.value / total;
    const start = angle;
    const end = angle + frac * Math.PI * 2;
    angle = end;
    const large = end - start > Math.PI ? 1 : 0;
    const x1 = cx + r * Math.cos(start);
    const y1 = cy + r * Math.sin(start);
    const x2 = cx + r * Math.cos(end);
    const y2 = cy + r * Math.sin(end);
    const ix1 = cx + ir * Math.cos(end);
    const iy1 = cy + ir * Math.sin(end);
    const ix2 = cx + ir * Math.cos(start);
    const iy2 = cy + ir * Math.sin(start);
    const d = `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} L ${ix1} ${iy1} A ${ir} ${ir} 0 ${large} 0 ${ix2} ${iy2} Z`;
    return { d, color: item.color ?? palette[index % palette.length], label: item.label, value: item.value, frac };
  });

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <svg viewBox="0 0 160 160" className="h-40 w-40 shrink-0" role="img">
        {arcs.map((arc) => (
          <path key={arc.label} d={arc.d} fill={arc.color} />
        ))}
        <text x="80" y="76" textAnchor="middle" fontSize="16" fontWeight="700" fill={isDark ? "#fafafa" : "#2d3436"}>
          {centerLabel ?? String(total)}
        </text>
        <text x="80" y="94" textAnchor="middle" fontSize="9" fill={isDark ? "#a1a1aa" : "#636e72"}>
          total
        </text>
      </svg>
      <ul className="min-w-0 flex-1 space-y-1.5 text-xs">
        {arcs.map((arc) => (
          <li key={arc.label} className="flex items-center justify-between gap-3">
            <span className="inline-flex min-w-0 items-center gap-2 truncate">
              <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: arc.color }} />
              {arc.label}
            </span>
            <span className="tabular-nums font-semibold">{Math.round(arc.frac * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Heatmap({
  cells,
  isDark,
}: {
  cells: { dow: number; hour: number; count: number }[];
  isDark: boolean;
}) {
  const hours = Array.from({ length: 17 }, (_, index) => index + 6);
  const map = new Map<string, number>();
  for (const cell of cells) {
    map.set(`${cell.dow}-${cell.hour}`, cell.count);
  }
  const max = Math.max(0, ...cells.map((cell) => cell.count));
  if (max === 0) {
    return <ChartEmpty label="Sem distribuição horária no período." isDark={isDark} />;
  }

  return (
    <div className="overflow-x-auto">
      <div className="inline-grid min-w-full grid-cols-[40px_repeat(17,minmax(18px,1fr))] gap-1">
        <span />
        {hours.map((hour) => (
          <span key={hour} className={`text-center text-[10px] ${isDark ? "text-zinc-500" : "text-[#636e72]"}`}>
            {hour % 2 === 0 ? `${hour}h` : ""}
          </span>
        ))}
        {WEEKDAY_LABELS.map((label, dowIndex) => {
          const dow = dowIndex + 1;
          return (
            <React.Fragment key={label}>
              <span className={`self-center text-[11px] ${isDark ? "text-zinc-400" : "text-[#636e72]"}`}>{label}</span>
              {hours.map((hour) => {
                const count = map.get(`${dow}-${hour}`) ?? 0;
                const t = count / max;
                const bg =
                  count === 0
                    ? isDark
                      ? "#18181b"
                      : "#eef0f3"
                    : `rgba(108, 92, 231, ${0.18 + t * 0.82})`;
                return (
                  <div
                    key={`${dow}-${hour}`}
                    title={`${label} ${hour}h: ${count}`}
                    className="h-4 rounded-sm"
                    style={{ background: bg }}
                  />
                );
              })}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

export const CHART_BRAND = BRAND;
export const CHART_TEAL = TEAL;

"use client";

import { useId, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { niceAxis, summarisePeak, visibleLabelIndexes, type PeakCell } from "@/lib/chart-utils";

const W = 640;
const H = 240;
const PAD = { left: 34, right: 12, top: 14, bottom: 30 };

interface TrendChartProps {
  data: Array<{ label: string; value: number }>;
  title?: string;
  color?: string;
  /** Tooltip / aria text for a value, e.g. "12 richieste". */
  formatValue: (n: number) => string;
  /** Small summary cards above the chart. */
  stats?: Array<{ label: string; value: string }>;
  emptyLabel: string;
}

/** Line + area chart with a y-axis, gridlines, an x-axis that never overlaps and a hover read-out. */
export function TrendChart({ data, title, color = "var(--color-mint)", formatValue, stats, emptyLabel }: TrendChartProps) {
  const [hover, setHover] = useState<number | null>(null);
  const { max, ticks } = useMemo(() => niceAxis(Math.max(...data.map((d) => d.value), 0)), [data]);
  const total = data.reduce((s, d) => s + d.value, 0);

  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const n = data.length;
  const x = (i: number) => PAD.left + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const y = (v: number) => PAD.top + innerH - (v / max) * innerH;

  const line = data.map((d, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(d.value).toFixed(1)}`).join(" ");
  const area = n > 0 ? `${line} L${x(n - 1).toFixed(1)},${y(0)} L${x(0).toFixed(1)},${y(0)} Z` : "";
  const shown = visibleLabelIndexes(n, 8);
  const gradId = `trend-grad-${useId().replace(/:/g, "")}`;

  return (
    <div className="w-full">
      {title ? <h3 className="mb-3 text-left font-semibold text-[var(--color-text)]">{title}</h3> : null}
      {stats && stats.length > 0 ? (
        <div className="mb-3 flex flex-wrap gap-3">
          {stats.map((s) => (
            <div key={s.label} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1.5">
              <div className="text-[11px] uppercase tracking-wide text-[var(--color-text-secondary)]">{s.label}</div>
              <div className="text-sm font-semibold text-[var(--color-text)]">{s.value}</div>
            </div>
          ))}
        </div>
      ) : null}

      {total === 0 ? (
        <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-[var(--color-border)] text-sm text-[var(--color-text-secondary)]">
          {emptyLabel}
        </div>
      ) : (
        <div className="relative" onMouseLeave={() => setHover(null)}>
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="h-auto w-full"
            role="img"
            aria-label={`${title ?? ""} — ${formatValue(total)}`}
          >
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity="0.35" />
                <stop offset="100%" stopColor={color} stopOpacity="0" />
              </linearGradient>
            </defs>

            {ticks.map((t) => (
              <g key={t}>
                <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="var(--color-border)" strokeDasharray={t === 0 ? undefined : "3 4"} />
                <text x={PAD.left - 6} y={y(t) + 3.5} textAnchor="end" fontSize="10" fill="var(--color-text-secondary)">
                  {t}
                </text>
              </g>
            ))}

            <motion.path d={area} fill={`url(#${gradId})`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8, delay: 0.3 }} />
            <motion.path
              d={line}
              fill="none"
              stroke={color}
              strokeWidth={2.5}
              strokeLinejoin="round"
              strokeLinecap="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 1, ease: "easeOut" }}
            />

            {data.map((d, i) => (
              <g key={i}>
                {shown.has(i) ? (
                  <text x={x(i)} y={H - 8} textAnchor="middle" fontSize="10" fill="var(--color-text-secondary)">
                    {d.label}
                  </text>
                ) : null}
                {d.value > 0 && hover !== i ? (
                  <motion.circle cx={x(i)} cy={y(d.value)} r={3} fill={color} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9 }} />
                ) : null}
              </g>
            ))}

            {hover !== null && data[hover] ? (
              <g pointerEvents="none">
                <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={y(0)} stroke={color} strokeDasharray="4 3" opacity={0.6} />
                <circle cx={x(hover)} cy={y(data[hover].value)} r={5} fill={color} stroke="var(--color-bg)" strokeWidth={2} />
              </g>
            ) : null}

            {data.map((_, i) => {
              const left = i === 0 ? PAD.left : (x(i - 1) + x(i)) / 2;
              const right = i === n - 1 ? W - PAD.right : (x(i) + x(i + 1)) / 2;
              return (
                <rect
                  key={i}
                  x={left}
                  y={PAD.top}
                  width={Math.max(right - left, 1)}
                  height={innerH}
                  fill="transparent"
                  onMouseEnter={() => setHover(i)}
                  onFocus={() => setHover(i)}
                />
              );
            })}
          </svg>

          {hover !== null && data[hover] ? (
            <div
              className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md bg-[var(--color-bg-inverse)] px-2.5 py-1.5 text-xs text-[var(--color-text-inverse)] shadow-lg"
              style={{ left: `${(x(hover) / W) * 100}%`, top: `${(y(data[hover].value) / H) * 100}%`, marginTop: -10 }}
            >
              <div className="opacity-70">{data[hover].label}</div>
              <div className="font-semibold">{formatValue(data[hover].value)}</div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

interface PeakHoursChartProps {
  data: PeakCell[];
  title?: string;
  locale: string;
  labels: {
    byHour: string;
    byDay: string;
    peakHour: string;
    peakDay: string;
    empty: string;
  };
  formatValue: (n: number) => string;
}

/** Bar chart of when requests arrive — by hour of day or by weekday — with the peak called out. */
export function PeakHoursChart({ data, title, locale, labels, formatValue }: PeakHoursChartProps) {
  const [mode, setMode] = useState<"hour" | "day">("hour");
  const [hover, setHover] = useState<number | null>(null);
  const summary = useMemo(() => summarisePeak(data), [data]);

  const dayNames = useMemo(() => {
    const short = new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" });
    const long = new Intl.DateTimeFormat(locale, { weekday: "long", timeZone: "UTC" });
    // 2024-01-07 was a Sunday, matching getDay() = 0.
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(Date.UTC(2024, 0, 7 + i, 12));
      return { short: short.format(d), long: long.format(d) };
    });
  }, [locale]);

  const values = mode === "hour" ? summary.byHour : summary.byDay;
  const { max, ticks } = niceAxis(Math.max(...values, 0));
  const peakIndex = mode === "hour" ? summary.peakHour?.hour : summary.peakDay?.day;
  const hourLabel = (h: number) => `${String(h).padStart(2, "0")}:00`;
  const nameOf = (i: number) => (mode === "hour" ? hourLabel(i) : dayNames[i].long);
  const tickOf = (i: number) => (mode === "hour" ? String(i).padStart(2, "0") : dayNames[i].short);

  const insight = [
    summary.peakHour
      ? { label: labels.peakHour, value: `${hourLabel(summary.peakHour.hour)}–${hourLabel((summary.peakHour.hour + 1) % 24)}`, sub: formatValue(summary.peakHour.value) }
      : null,
    summary.peakDay ? { label: labels.peakDay, value: dayNames[summary.peakDay.day].long, sub: formatValue(summary.peakDay.value) } : null,
  ].filter((v): v is { label: string; value: string; sub: string } => v !== null);

  return (
    <div className="w-full">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        {title ? <h3 className="text-left font-semibold text-[var(--color-text)]">{title}</h3> : <span />}
        <div className="inline-flex rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-0.5 text-xs">
          {(["hour", "day"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMode(m);
                setHover(null);
              }}
              aria-pressed={mode === m}
              className={`rounded-md px-3 py-1 font-medium transition-colors ${
                mode === m ? "bg-[var(--color-mint)] text-[var(--color-mint-dark)]" : "text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
              }`}
            >
              {m === "hour" ? labels.byHour : labels.byDay}
            </button>
          ))}
        </div>
      </div>

      {summary.total === 0 ? (
        <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-[var(--color-border)] text-sm text-[var(--color-text-secondary)]">
          {labels.empty}
        </div>
      ) : (
        <>
          {insight.length > 0 ? (
            <div className="mb-4 flex flex-wrap gap-3">
              {insight.map((i) => (
                <div key={i.label} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1.5">
                  <div className="text-[11px] uppercase tracking-wide text-[var(--color-text-secondary)]">{i.label}</div>
                  <div className="text-sm font-semibold capitalize text-[var(--color-text)]">
                    {i.value} <span className="font-normal normal-case text-[var(--color-text-secondary)]">· {i.sub}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          <div className="flex gap-2" key={mode}>
            <div className="relative h-48 w-6 shrink-0 text-right text-[10px] text-[var(--color-text-secondary)]">
              {ticks.map((t) => (
                <span key={t} className="absolute right-0 -translate-y-1/2" style={{ top: `${100 - (t / max) * 100}%` }}>
                  {t}
                </span>
              ))}
            </div>
            <div className="min-w-0 flex-1">
              <div className="relative h-48" onMouseLeave={() => setHover(null)}>
                {ticks.map((t) => (
                  <div
                    key={t}
                    className="absolute inset-x-0 border-t border-dashed border-[var(--color-border)]"
                    style={{ top: `${100 - (t / max) * 100}%`, borderTopStyle: t === 0 ? "solid" : "dashed" }}
                  />
                ))}
                <div className="absolute inset-0 flex items-end gap-[3px]">
                  {values.map((v, i) => {
                    const isPeak = i === peakIndex;
                    return (
                      <div key={i} className="relative flex h-full flex-1 items-end" onMouseEnter={() => setHover(i)}>
                        <motion.div
                          className="w-full rounded-t"
                          style={{
                            background: "var(--color-mint)",
                            opacity: hover === i ? 1 : isPeak ? 1 : 0.5,
                            minHeight: v > 0 ? 3 : 0,
                          }}
                          initial={{ height: 0 }}
                          animate={{ height: `${(v / max) * 100}%` }}
                          transition={{ duration: 0.6, delay: i * (mode === "hour" ? 0.02 : 0.05), ease: "easeOut" }}
                        />
                        {hover === i ? (
                          <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 -translate-x-1/2 whitespace-nowrap rounded-md bg-[var(--color-bg-inverse)] px-2.5 py-1.5 text-xs text-[var(--color-text-inverse)] shadow-lg">
                            <div className="capitalize opacity-70">{nameOf(i)}</div>
                            <div className="font-semibold">{formatValue(v)}</div>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="mt-1.5 flex gap-[3px]">
                {values.map((_, i) => (
                  <span
                    key={i}
                    className={`flex-1 text-center text-[10px] capitalize text-[var(--color-text-secondary)] ${
                      mode === "hour" && i % 3 !== 0 ? "invisible" : ""
                    } ${i === peakIndex ? "font-bold text-[var(--color-text)]" : ""}`}
                  >
                    {tickOf(i)}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

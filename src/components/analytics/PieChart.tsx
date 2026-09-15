"use client";

import { useState } from "react";
import { motion } from "framer-motion";

interface PieChartProps {
  data: Array<{ label: string; value: number; color: string }>;
  title?: string;
  showLegend?: boolean;
  size?: number;
  innerRadius?: number;
  animate?: boolean;
}

/**
 * Builds the outer+inner donut-wedge path(s) for one segment. An SVG
 * elliptical-arc command whose start and end point coincide is defined to
 * render as nothing at all (SVG spec) — that's exactly what happens when a
 * single category holds 100% of the total (every other value is 0): the
 * arc spans a full 2π and its two endpoints land on the same point, so the
 * "pie" silently disappears. Splitting a full-circle sweep into two half
 * sweeps keeps every arc's endpoints distinct and sidesteps the bug.
 */
function wedgePaths(
  cx: number,
  cy: number,
  outerRadius: number,
  innerRadius: number,
  startAngle: number,
  sweepAngle: number,
): string[] {
  const FULL_CIRCLE_EPS = 1e-6;
  if (sweepAngle >= 2 * Math.PI - FULL_CIRCLE_EPS) {
    return [
      singleWedgePath(cx, cy, outerRadius, innerRadius, startAngle, Math.PI),
      singleWedgePath(cx, cy, outerRadius, innerRadius, startAngle + Math.PI, Math.PI),
    ];
  }
  return [singleWedgePath(cx, cy, outerRadius, innerRadius, startAngle, sweepAngle)];
}

function singleWedgePath(
  cx: number,
  cy: number,
  outerRadius: number,
  innerRadius: number,
  startAngle: number,
  sweepAngle: number,
): string {
  const endAngle = startAngle + sweepAngle;
  const x1 = cx + outerRadius * Math.cos(startAngle - Math.PI / 2);
  const y1 = cy + outerRadius * Math.sin(startAngle - Math.PI / 2);
  const x2 = cx + outerRadius * Math.cos(endAngle - Math.PI / 2);
  const y2 = cy + outerRadius * Math.sin(endAngle - Math.PI / 2);
  const largeArcFlag = sweepAngle > Math.PI ? 1 : 0;
  const innerX1 = cx + innerRadius * Math.cos(startAngle - Math.PI / 2);
  const innerY1 = cy + innerRadius * Math.sin(startAngle - Math.PI / 2);
  const innerX2 = cx + innerRadius * Math.cos(endAngle - Math.PI / 2);
  const innerY2 = cy + innerRadius * Math.sin(endAngle - Math.PI / 2);
  return `M ${cx} ${cy} L ${x1} ${y1} A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 1 ${x2} ${y2} L ${innerX2} ${innerY2} A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${innerX1} ${innerY1} Z`;
}

export function PieChart({
  data,
  title,
  showLegend = true,
  size = 200,
  innerRadius = 80,
}: PieChartProps) {
  const [hovered, setHovered] = useState<number | null>(null);
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const segments = data.map((d, i) => {
    const angle = total > 0 ? (d.value / total) * 2 * Math.PI : 0;
    return { ...d, angle, index: i };
  });
  const hoveredSegment = hovered !== null ? segments.find((s) => s.index === hovered) : undefined;
  const hoveredPct = hoveredSegment && total > 0 ? ((hoveredSegment.value / total) * 100).toFixed(1) : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="w-full"
    >
      {title && (
        <h3 className="font-semibold text-[var(--color-text)] mb-4 text-left">{title}</h3>
      )}
      <div className="relative flex justify-center mb-4">
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          role="img"
          aria-label={title || "Pie chart"}
        >
          <defs>
            {segments.map((segment, i) => (
              <linearGradient
                key={i}
                id={`grad-${segment.label.replace(/\s+/g, "-")}`}
                x1="0%"
                y1="0%"
                x2="100%"
                y2="100%"
              >
                <stop offset="0%" stopColor={segment.color} stopOpacity={0.9} />
                <stop offset="100%" stopColor={segment.color} stopOpacity={1} />
              </linearGradient>
            ))}
          </defs>
          {total <= 0 ? (
            <circle
              cx={size / 2}
              cy={size / 2}
              r={(size / 2 - 4 + innerRadius) / 2}
              fill="none"
              stroke="var(--color-border)"
              strokeWidth={(size / 2 - 4 - innerRadius)}
            />
          ) : (
            segments
              .filter((segment) => segment.angle > 0)
              .map((segment, i) => {
                let startAngle = 0;
                for (const s of segments) {
                  if (s.index >= segment.index) break;
                  startAngle += s.angle;
                }
                const cx = size / 2;
                const cy = size / 2;
                const outerRadius = size / 2 - 4;
                const paths = wedgePaths(cx, cy, outerRadius, innerRadius, startAngle, segment.angle);
                const isHovered = hovered === segment.index;
                const isDimmed = hovered !== null && !isHovered;
                // Nudge the wedge outward along its own bisector on hover —
                // reads as "this slice lifted toward you", stronger and more
                // legible at a glance than a uniform scale-up of everything.
                const midAngle = startAngle + segment.angle / 2 - Math.PI / 2;
                const popDistance = isHovered ? 6 : 0;
                const dx = Math.cos(midAngle) * popDistance;
                const dy = Math.sin(midAngle) * popDistance;
                return (
                  <motion.g
                    key={segment.label}
                    tabIndex={0}
                    role="button"
                    aria-label={`${segment.label}: ${((segment.value / total) * 100).toFixed(1)}%`}
                    style={{ cursor: "pointer", outline: "none" }}
                    onMouseEnter={() => setHovered(segment.index)}
                    onMouseLeave={() => setHovered(null)}
                    onFocus={() => setHovered(segment.index)}
                    onBlur={() => setHovered(null)}
                    animate={{ x: dx, y: dy, opacity: isDimmed ? 0.35 : 1 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                  >
                    {paths.map((d, partIndex) => (
                      <motion.path
                        key={partIndex}
                        d={d}
                        fill={`url(#grad-${segment.label.replace(/\s+/g, "-")})`}
                        stroke="var(--color-bg-alt)"
                        initial={{ scale: 0, originX: cx, originY: cy }}
                        animate={{
                          scale: 1,
                          strokeWidth: isHovered ? 3 : 2,
                          filter: isHovered
                            ? "drop-shadow(0 6px 14px rgba(0,0,0,0.22))"
                            : "drop-shadow(0 2px 4px rgba(0,0,0,0.1))",
                        }}
                        transition={{ delay: i * 0.1, duration: 0.6, ease: "easeOut" }}
                      />
                    ))}
                  </motion.g>
                );
              })
          )}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={innerRadius - 4}
            fill="var(--color-bg)"
            stroke="var(--color-border)"
            strokeWidth="1"
          />
        </svg>

        {/* The donut's own hole is otherwise dead space — use it to show
            whichever slice is hovered (or focused via keyboard), instead of
            a floating tooltip that would need its own position tracking. */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          {hoveredSegment ? (
            <motion.div
              key={hoveredSegment.label}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.15 }}
              className="text-center px-2"
            >
              <div
                className="text-xs font-medium truncate"
                style={{ maxWidth: innerRadius * 1.6, color: hoveredSegment.color }}
              >
                {hoveredSegment.label}
              </div>
              <div className="text-xl font-bold text-[var(--color-text)] tabular-nums leading-tight">
                {hoveredPct}%
              </div>
              <div className="text-[11px] text-[var(--color-text-secondary)] tabular-nums">
                {hoveredSegment.value.toLocaleString()}
              </div>
            </motion.div>
          ) : total > 0 ? (
            <div className="text-center">
              <div className="text-xl font-bold text-[var(--color-text)] tabular-nums leading-tight">
                {total.toLocaleString()}
              </div>
              <div className="text-[11px] text-[var(--color-text-secondary)]">Totale</div>
            </div>
          ) : null}
        </div>
      </div>

      {showLegend && (
        <div className="flex flex-wrap justify-center gap-3 mt-4" role="list">
          {segments.map((segment) => {
            const isHovered = hovered === segment.index;
            return (
              <button
                key={segment.label}
                type="button"
                role="listitem"
                onMouseEnter={() => setHovered(segment.index)}
                onMouseLeave={() => setHovered(null)}
                onFocus={() => setHovered(segment.index)}
                onBlur={() => setHovered(null)}
                className={`flex items-center gap-2 text-sm rounded px-1.5 py-0.5 -mx-1.5 transition-colors ${
                  isHovered ? "bg-[var(--color-bg)]" : ""
                }`}
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: isHovered ? 1.25 : 1 }}
                  transition={{ duration: 0.2 }}
                  className="w-3 h-3 rounded shrink-0"
                  style={{ background: segment.color }}
                />
                <span
                  className={`text-[var(--color-text)] ${isHovered ? "font-semibold" : ""}`}
                >
                  {segment.label}
                </span>
                <span className="text-[var(--color-text-secondary)] tabular-nums">
                  {total > 0 ? `${((segment.value / total) * 100).toFixed(1)}%` : "—"}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}

interface FunnelChartProps {
  data: Array<{ label: string; value: number; color: string }>;
  title?: string;
  showPercentages?: boolean;
}

export function FunnelChart({
  data,
  title,
  showPercentages = true,
}: FunnelChartProps) {
  const maxValue = Math.max(...data.map((d) => d.value), 1);
  const baseValue = data[0]?.value ?? 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="w-full"
    >
      {title && (
        <h3 className="font-semibold text-[var(--color-text)] mb-4 text-left">{title}</h3>
      )}
      <div className="space-y-4" role="list">
        {data.map((item, index) => (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1, duration: 0.5, ease: "easeOut" }}
            className="group"
            role="listitem"
          >
            {/* Label + numbers sit outside the fill, on the card background —
                never on top of the colored bar, so contrast never depends on
                the segment's color or how narrow the fill is (was the source
                of the white-on-white bug on short segments in light mode). */}
            <div className="flex items-baseline justify-between gap-3 mb-1.5 text-sm">
              <span className="font-medium text-[var(--color-text)] truncate">{item.label}</span>
              <div className="flex items-center gap-2 shrink-0 tabular-nums">
                <span className="font-semibold text-[var(--color-text)]">
                  {item.value.toLocaleString()}
                </span>
                {showPercentages && index > 0 && (
                  <span className="text-xs text-[var(--color-text-secondary)] w-12 text-right">
                    {baseValue > 0 ? `${((item.value / baseValue) * 100).toFixed(1)}%` : "—"}
                  </span>
                )}
              </div>
            </div>
            <div className="h-3 rounded-full bg-[var(--color-bg)] overflow-hidden">
              <motion.div
                layout
                className="h-full rounded-full transition-shadow duration-300"
                style={{
                  background: item.color,
                  width: `${(item.value / maxValue) * 100}%`,
                }}
                whileHover={{ boxShadow: "0 0 0 2px rgba(0,0,0,0.08) inset" }}
                title={`${item.label}: ${item.value.toLocaleString()}`}
              />
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

interface PeakHoursHeatmapProps {
  data: Array<{ hour: number; day: number; value: number }>;
  title?: string;
}

export function PeakHoursHeatmap({
  data,
  title,
}: PeakHoursHeatmapProps) {
  const days = ["Dom", "Lun", "Mar", "Mer", "Gio", "Ven", "Sab"];
  const hours = Array.from({ length: 24 }, (_, i) => i);

  const maxValue = Math.max(...data.map((d) => d.value), 1);

  const getColor = (value: number) => {
    const intensity = value / maxValue;
    if (intensity === 0) return "var(--color-bg)";
    if (intensity < 0.25) return "rgba(16, 185, 129, 0.2)";
    if (intensity < 0.5) return "rgba(16, 185, 129, 0.4)";
    if (intensity < 0.75) return "rgba(16, 185, 129, 0.6)";
    return "rgba(16, 185, 129, 0.9)";
  };

  // The hover value used the theme's default text color regardless of the
  // cell's own background — on a saturated high-intensity green (dark in
  // both themes) that reads fine, but on a light/empty cell in light mode
  // it needs the normal (dark) text token, not white. Switch at the same
  // 0.5 breakpoint where the green fill turns dark enough to need it.
  const getTextColor = (value: number) => {
    const intensity = value / maxValue;
    return intensity >= 0.5 ? "#ffffff" : "var(--color-text)";
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="w-full overflow-x-auto"
    >
      {title && (
        <h3 className="font-semibold text-[var(--color-text)] mb-4 text-left">{title}</h3>
      )}
      <div className="relative" role="img" aria-label={title || "Heatmap ore di punta"}>
        <div className="flex">
          <div className="w-16 flex-shrink-0">
            <div className="h-8" />
            {hours.map((h) => (
              <div key={h} className="h-8 text-xs text-[var(--color-text-secondary)] text-center flex items-center justify-center">
                {h.toString().padStart(2, "0")}
              </div>
            ))}
          </div>
          <div className="flex-1 overflow-x-auto">
            <table className="border-collapse">
              <thead>
                <tr>
                  {days.map((day, i) => (
                    <th
                      key={day}
                      className="w-20 min-w-[80px] text-xs font-medium text-[var(--color-text-secondary)] pb-2 text-center"
                    >
                      {day}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {hours.map((hour) => (
                  <tr key={hour}>
                    {days.map((_, dayIndex) => {
                      const cellData = data.find((d) => d.hour === hour && d.day === dayIndex);
                      const value = cellData?.value || 0;
                      return (
                        <motion.td
                          key={`${dayIndex}-${hour}`}
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ delay: (dayIndex * 24 + hour) * 0.005, duration: 0.3 }}
                          // A border on every cell (not just the colored ones)
                          // is what makes this read as a grid at all when
                          // most cells have no data — without it, an empty
                          // heatmap is just a blank white rectangle with the
                          // hour labels floating unattached next to it.
                          className="w-20 min-w-[80px] h-8 relative cursor-pointer group border border-[var(--color-border-subtle)] hover:border-[var(--color-mint)] transition-colors"
                          style={{ backgroundColor: getColor(value) }}
                        >
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span
                              // Real values stay dimly legible without a
                              // hover; the "—" empty-cell placeholder is
                              // subtler still so it doesn't read as data.
                              className={`text-xs font-medium transition-opacity ${
                                value > 0 ? "opacity-70 group-hover:opacity-100" : "opacity-0 group-hover:opacity-40"
                              }`}
                              style={{ color: getTextColor(value) }}
                            >
                              {value > 0 ? value : "—"}
                            </span>
                          </div>
                          <title>
                            {days[dayIndex]} {hour.toString().padStart(2, "0")}:00 - {value} richieste
                          </title>
                        </motion.td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-4 text-xs text-[var(--color-text-secondary)]">
          <span>Intensità:</span>
          <span>Basso</span>
          <div className="flex gap-1">
            {[0, 0.25, 0.5, 0.75, 1].map((v) => (
              <div
                key={v}
                className="w-6 h-4 rounded border border-[var(--color-border)]"
                style={{ backgroundColor: getColor(v * maxValue) }}
              />
            ))}
          </div>
          <span>Alto</span>
        </div>
      </div>
    </motion.div>
  );
}

interface TrendChartProps {
  data: Array<{ label: string; value: number }>;
  title?: string;
  color?: string;
}

export function TrendChart({
  data,
  title,
  color = "var(--color-mint)",
}: TrendChartProps) {
  const maxValue = Math.max(...data.map((d) => d.value), 1);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="w-full"
    >
      {title && (
        <h3 className="font-semibold text-[var(--color-text)] mb-4 text-left">{title}</h3>
      )}
      <div className="flex items-end gap-1 h-48 relative" role="img" aria-label={title || "Grafico trend"}>
        {data.map((item, index) => (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, scaleY: 0, originY: 1 }}
            animate={{ opacity: 1, scaleY: 1, originY: 1 }}
            transition={{ delay: index * 0.05, duration: 0.5, ease: "easeOut" }}
            className="flex-1 group relative flex items-end cursor-pointer"
          >
            <div
              className="w-full rounded-t transition-all duration-200"
              style={{
                background: color,
                height: `${Math.max((item.value / maxValue) * 100, item.value > 0 ? 4 : 0)}%`,
              }}
              title={`${item.label}: ${item.value}`}
            />
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-0.5 bg-[var(--color-bg-inverse)] text-[var(--color-text-inverse)] text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10"
            >
              {item.value}
            </motion.div>
          </motion.div>
        ))}
      </div>
      <div className="flex justify-center gap-2 mt-3 overflow-x-auto pb-2">
        {data.map((item, index) => (
          <motion.span
            key={item.label}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: index * 0.05 + 0.3 }}
            className="text-xs text-[var(--color-text-secondary)] whitespace-nowrap"
          >
            {item.label}
          </motion.span>
        ))}
      </div>
    </motion.div>
  );
}

interface StatsGridProps {
  stats: Array<{
    label: string;
    value: string | number;
    delta?: number;
    icon?: React.ReactNode;
    accent?: boolean;
    trend?: "up" | "down" | "neutral";
  }>;
  columns?: number;
}

// Tailwind's build-time scanner only generates a class for a literal
// string it can find in source; `lg:grid-cols-${columns}` interpolated at
// runtime isn't one, so it only "works" today because that exact class
// happens to be written out statically elsewhere on this page. A fixed
// lookup keeps this component correct on its own regardless.
const COLUMN_CLASSES: Record<number, string> = {
  3: "lg:grid-cols-3",
  4: "lg:grid-cols-4",
  5: "lg:grid-cols-5",
  6: "lg:grid-cols-6",
};

export function StatsGrid({
  stats,
  columns = 6,
}: StatsGridProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className={`grid grid-cols-2 sm:grid-cols-3 ${COLUMN_CLASSES[columns] ?? "lg:grid-cols-6"} gap-3`}
    >
      {stats.map((stat, index) => (
        <motion.div
          key={stat.label}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: index * 0.05, duration: 0.4, ease: "easeOut" }}
          className={`rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-4 hover:shadow-lg transition-shadow ${
            stat.accent ? "border-[var(--color-accent)]/30 bg-[var(--color-accent)]/5" : ""
          }`}
        >
          <div className="flex items-start justify-between gap-2 mb-2">
            {stat.icon && (
              <div className={`p-2 rounded-lg ${
                stat.accent ? "bg-[var(--color-accent)]/10 text-[var(--color-accent)]" : "bg-[var(--color-bg)] text-[var(--color-text-secondary)]"
              }`}>
                {stat.icon}
              </div>
            )}
            {stat.trend !== "neutral" && (() => {
              const abs = Math.abs(stat.delta || 0);
              // A previous-period value near zero turns a normal-looking
              // improvement into a meaningless "+8915400%" once divided —
              // past a reasonable ceiling, say "new" instead of the number.
              const isMeaningless = abs > 999;
              return (
                <span className={`text-xs font-medium flex items-center gap-0.5 ${
                  stat.trend === "up" ? "text-emerald-600" : "text-red-600"
                }`}>
                  {isMeaningless ? "Nuovo" : (
                    <>{stat.trend === "up" ? "↑" : "↓"} {abs.toFixed(1)}%</>
                  )}
                </span>
              );
            })()}
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-[var(--color-text)] tabular-nums">
            {typeof stat.value === "number" ? stat.value.toLocaleString() : stat.value}
          </p>
          <p className="text-xs text-[var(--color-text-secondary)] mt-1">{stat.label}</p>
        </motion.div>
      ))}
    </motion.div>
  );
}
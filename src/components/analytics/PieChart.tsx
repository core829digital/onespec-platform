"use client";

import { motion, animate } from "framer-motion";
import { useEffect, useRef } from "react";
import { gsap } from "gsap";

interface PieChartProps {
  data: Array<{ label: string; value: number; color: string }>;
  title?: string;
  showLegend?: boolean;
  size?: number;
  innerRadius?: number;
  animate?: boolean;
}

export function PieChart({
  data,
  title,
  showLegend = true,
  size = 200,
  innerRadius = 80,
  animate = true,
}: PieChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const pathsRef = useRef<SVGPathElement[]>([]);

  const total = data.reduce((sum, d) => sum + d.value, 0);
  const segments = data.map((d, i) => {
    const angle = (d.value / total) * 2 * Math.PI;
    return { ...d, angle, index: i };
  });

  useEffect(() => {
    if (!animate || !svgRef.current) return;

    const paths = pathsRef.current;
    if (paths.length === 0) return;

    gsap.fromTo(
      paths,
      { strokeDashoffset: (i) => paths[i]?.getTotalLength() || 0 },
      {
        strokeDashoffset: 0,
        duration: 1.2,
        ease: "power3.out",
        stagger: 0.1,
        scrollTrigger: {
          trigger: svgRef.current,
          start: "top 80%",
        },
      },
    );
  }, [animate]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="w-full"
    >
      {title && (
        <h3 className="font-semibold text-[var(--color-text)] mb-4 text-center">{title}</h3>
      )}
      <div className="flex justify-center mb-4">
        <svg
          ref={svgRef}
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
          {segments.map((segment, i) => {
            let startAngle = 0;
            for (let j = 0; j < i; j++) startAngle += segments[j].angle;

            const endAngle = startAngle + segment.angle;
            const cx = size / 2;
            const cy = size / 2;
            const outerRadius = size / 2 - 4;

            const x1 = cx + outerRadius * Math.cos(startAngle - Math.PI / 2);
            const y1 = cy + outerRadius * Math.sin(startAngle - Math.PI / 2);
            const x2 = cx + outerRadius * Math.cos(endAngle - Math.PI / 2);
            const y2 = cy + outerRadius * Math.sin(endAngle - Math.PI / 2);

            const largeArcFlag = segment.angle > Math.PI ? 1 : 0;

            const innerX1 = cx + innerRadius * Math.cos(startAngle - Math.PI / 2);
            const innerY1 = cy + innerRadius * Math.sin(startAngle - Math.PI / 2);
            const innerX2 = cx + innerRadius * Math.cos(endAngle - Math.PI / 2);
            const innerY2 = cy + innerRadius * Math.sin(endAngle - Math.PI / 2);

            const path = (
              <motion.path
                key={segment.label}
                d={`M ${cx} ${cy} L ${x1} ${y1} A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 1 ${x2} ${y2} L ${innerX2} ${innerY2} A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${innerX1} ${innerY1} Z`}
                fill={`url(#grad-${segment.label.replace(/\s+/g, "-")})`}
                stroke="white"
                strokeWidth="2"
                style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.1))" }}
                initial={{ scale: 0, originX: cx, originY: cy }}
                animate={{ scale: 1 }}
                transition={{ delay: i * 0.1, duration: 0.6, ease: "easeOut" }}
                whileHover={{ scale: 1.02, originX: cx, originY: cy, filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.15))" }}
              >
                <title>{segment.label}: {((segment.value / total) * 100).toFixed(1)}%</title>
              </motion.path>
            );

            pathsRef.current[i] = null;
            return path;
          })}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={innerRadius - 4}
            fill="var(--color-bg)"
            stroke="var(--color-border)"
            strokeWidth="1"
          />
        </svg>
      </div>

      {showLegend && (
        <div className="flex flex-wrap justify-center gap-3 mt-4" role="list">
          {segments.map((segment) => (
            <div
              key={segment.label}
              className="flex items-center gap-2 text-sm"
              role="listitem"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: segment.index * 0.05, duration: 0.3 }}
                className="w-3 h-3 rounded"
                style={{ background: segment.color }}
              />
              <span className="text-[var(--color-text)]">{segment.label}</span>
              <span className="text-[var(--color-text-secondary)] tabular-nums">
                {((segment.value / total) * 100).toFixed(1)}%
              </span>
            </div>
          ))}
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
  const maxValue = Math.max(...data.map((d) => d.value));

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="w-full"
    >
      {title && (
        <h3 className="font-semibold text-[var(--color-text)] mb-4 text-center">{title}</h3>
      )}
      <div className="space-y-3" role="list">
        {data.map((item, index) => (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, x: -30, height: 0 }}
            animate={{ opacity: 1, x: 0, height: "auto" }}
            transition={{ delay: index * 0.1, duration: 0.5, ease: "easeOut" }}
            className="relative group"
            role="listitem"
          >
            <div className="flex items-center gap-3">
              <span className="w-36 text-sm text-[var(--color-text-secondary)] shrink-0 text-right pr-2">
                {item.label}
              </span>
              <div className="flex-1 relative">
                <motion.div
                  layout
                  className="h-10 rounded-lg flex items-center justify-between px-3 transition-all duration-300"
                  style={{
                    background: item.color,
                    width: `${(item.value / maxValue) * 100}%`,
                  }}
                  whileHover={{ scale: 1.02, boxShadow: "0 4px 12px rgba(0,0,0,0.15)" }}
                >
                  <span className="text-white font-medium text-sm z-10">{item.label}</span>
                  <span className="text-white/90 font-semibold text-sm z-10">
                    {item.value.toLocaleString()}
                  </span>
                </motion.div>
              </div>
              {showPercentages && index > 0 && (
                <span className="w-16 text-right text-sm text-[var(--color-text)] tabular-nums">
                  {((item.value / data[0].value) * 100).toFixed(1)}%
                </span>
              )}
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="w-full overflow-x-auto"
    >
      {title && (
        <h3 className="font-semibold text-[var(--color-text)] mb-4 text-center">{title}</h3>
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
                          className="w-20 min-w-[80px] h-8 relative cursor-pointer group"
                          style={{ backgroundColor: getColor(value) }}
                        >
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-xs font-medium text-[var(--color-text)] opacity-0 group-hover:opacity-100 transition-opacity">
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
        <div className="flex items-center gap-4 mt-4 text-xs text-[var(--color-text-secondary)]">
          <span>Intensità:</span>
          <div className="flex gap-1">
            {[0, 0.25, 0.5, 0.75, 1].map((v) => (
              <div
                key={v}
                className="w-6 h-4 rounded border border-[var(--color-border)]"
                style={{ backgroundColor: getColor(v * maxValue) }}
              />
            ))}
          </div>
          <span>Basso</span>
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
        <h3 className="font-semibold text-[var(--color-text)] mb-4 text-center">{title}</h3>
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
              className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-0.5 bg-black/80 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap"
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

export function StatsGrid({
  stats,
  columns = 6,
}: StatsGridProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className={`grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-${columns} gap-3`}
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
            {stat.trend !== "neutral" && (
              <span className={`text-xs font-medium flex items-center gap-0.5 ${
                stat.trend === "up" ? "text-emerald-600" : "text-red-600"
              }`}>
                {stat.trend === "up" ? "↑" : "↓"} {Math.abs(stat.delta || 0).toFixed(1)}%
              </span>
            )}
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
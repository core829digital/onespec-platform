import { Svg, Rect, Line, Text as SvgText } from "@react-pdf/renderer";

// Static react-pdf port of widget/spec-drawing.tsx — same geometry (per-leaf
// width ratios, opening symbols, finish colour, dimension lines) but with the
// handle-height marker shown on EVERY operable leaf, since a printed drawing has
// no "selected" leaf.

const MATERIAL_COLORS: Record<string, { stroke: string; fill: string }> = {
  pvc: { stroke: "#3E7691", fill: "#DCEAF0" },
  wood: { stroke: "#9C6B3E", fill: "#F1E4D2" },
  aluminum: { stroke: "#6B7378", fill: "#E6E9EA" },
};
const FINISH_COLORS: Record<string, { stroke: string; fill: string }> = {
  white: { stroke: "#C9D3D8", fill: "#FFFFFF" },
  anthracite: { stroke: "#22272B", fill: "#373E48" },
  woodgrain: { stroke: "#5D3A22", fill: "#8B5A2B" },
};

export interface DrawingSash {
  type: "fix" | "classic" | "tiltturn" | "tilt" | "sliding" | "liftslide";
  direction: "left" | "right";
  active: boolean;
  widthRatio?: number;
  handleHeightMm?: number;
}

function normaliseRatios(sashes: DrawingSash[]): number[] {
  const raw = sashes.map((s) => (typeof s.widthRatio === "number" && s.widthRatio > 0 ? s.widthRatio : 0));
  if (!raw.some((r) => r > 0)) return sashes.map(() => 1 / sashes.length);
  const total = raw.reduce((a, b) => a + b, 0) || 1;
  return raw.map((r) => (r > 0 ? r / total : 1 / sashes.length));
}

const DIM = "#6b7280";
const HANDLE = "#2563EB";

export function WindowDrawingPDF({
  width,
  height,
  material,
  color,
  sashes,
  maxWidth = 170,
}: {
  width: number;
  height: number;
  material: string;
  color?: string;
  sashes: DrawingSash[];
  /** Rendered width in PDF points; height follows the drawing's own aspect. */
  maxWidth?: number;
}) {
  const list = sashes.length > 0 ? sashes : [{ type: "fix", direction: "left", active: true } as DrawingSash];
  const boxW = 200;
  const boxH = 150;
  const originX = 66;
  const originY = 22;
  const scale = Math.min(boxW / width, boxH / height);
  const rectW = Math.max(width * scale, 40);
  const rectH = Math.max(height * scale, 40);
  const palette = (color && FINISH_COLORS[color]) || MATERIAL_COLORS[material] || MATERIAL_COLORS.pvc;

  const svgW = 280;
  const svgH = originY + rectH + 46;
  const rectX = originX;
  const rectY = originY;
  const hLineY = rectY + rectH + 22;
  const vLineX = rectX - 22;
  const ratios = normaliseRatios(list);
  const midY = rectY + rectH / 2;

  const leaves = list.map((sash, i) => {
    const sashW = ratios[i] * rectW;
    const sx = rectX + ratios.slice(0, i).reduce((a, b) => a + b, 0) * rectW;
    const sx2 = sx + sashW;
    return { sash, i, sx, sx2, sashW };
  });

  return (
    <Svg viewBox={`0 0 ${svgW} ${svgH}`} style={{ width: maxWidth, height: (maxWidth * svgH) / svgW }}>
      <Rect x={rectX} y={rectY} width={rectW} height={rectH} rx={3} fill={palette.fill} stroke={palette.stroke} strokeWidth={4.5} />
      {leaves.map(({ sash, i, sx, sx2, sashW }) => {
        const active = sash.active !== false;
        const parts: React.ReactNode[] = [];
        if (i > 0) {
          parts.push(<Line key="div" x1={sx} y1={rectY} x2={sx} y2={rectY + rectH} stroke={palette.stroke} strokeWidth={3} />);
        }
        if (!active) {
          parts.push(
            <Line key="hatch" x1={sx + 6} y1={rectY + rectH - 6} x2={sx2 - 6} y2={rectY + 6} stroke="#8A9492" strokeWidth={1} />,
          );
        } else if (sash.type === "tilt") {
          const by = rectY + rectH - 10;
          const cx = sx + sashW / 2;
          parts.push(
            <Line key="t1" x1={sx + 8} y1={by} x2={cx} y2={rectY + 8} stroke={palette.stroke} strokeWidth={2} />,
            <Line key="t2" x1={sx2 - 8} y1={by} x2={cx} y2={rectY + 8} stroke={palette.stroke} strokeWidth={2} />,
          );
        } else if (sash.type === "classic" || sash.type === "tiltturn") {
          const apexX = sash.direction === "left" ? sx2 - 6 : sx + 6;
          const farX = sash.direction === "left" ? sx + 6 : sx2 - 6;
          parts.push(
            <Line key="sw1" x1={farX} y1={rectY + 8} x2={apexX} y2={midY} stroke={palette.stroke} strokeWidth={2} />,
            <Line key="sw2" x1={farX} y1={rectY + rectH - 8} x2={apexX} y2={midY} stroke={palette.stroke} strokeWidth={2} />,
          );
          if (sash.type === "tiltturn") {
            const cx = sx + sashW / 2;
            const by = rectY + rectH - 10;
            parts.push(
              <Line key="tt1" x1={cx - 9} y1={by} x2={cx} y2={by - 10} stroke={palette.stroke} strokeWidth={2.2} />,
              <Line key="tt2" x1={cx + 9} y1={by} x2={cx} y2={by - 10} stroke={palette.stroke} strokeWidth={2.2} />,
            );
          }
        } else if (sash.type === "sliding" || sash.type === "liftslide") {
          const shaftX1 = sx + 10;
          const shaftX2 = sx2 - 10;
          const tipX = sash.direction === "left" ? shaftX2 : shaftX1;
          const tailX = sash.direction === "left" ? shaftX1 : shaftX2;
          const dir = sash.direction === "left" ? 1 : -1;
          parts.push(
            <Line key="sl1" x1={tailX} y1={midY} x2={tipX} y2={midY} stroke={palette.stroke} strokeWidth={2.2} />,
            <Line key="sl2" x1={tipX} y1={midY} x2={tipX - dir * 7} y2={midY - 5} stroke={palette.stroke} strokeWidth={2.2} />,
            <Line key="sl3" x1={tipX} y1={midY} x2={tipX - dir * 7} y2={midY + 5} stroke={palette.stroke} strokeWidth={2.2} />,
            <Line key="sl4" x1={sx + 5} y1={rectY + rectH - 5} x2={sx2 - 5} y2={rectY + rectH - 5} stroke={palette.stroke} strokeWidth={3} />,
          );
        }
        if (active && sash.type !== "fix") {
          const mm = sash.handleHeightMm && sash.handleHeightMm > 0 ? sash.handleHeightMm : Math.round(height / 2);
          const clamp = Math.min(height - 40, Math.max(40, mm));
          const hy = rectY + rectH - (clamp / height) * rectH;
          parts.push(
            <Line key="hh" x1={sx + 3} y1={hy} x2={sx2 - 3} y2={hy} stroke={HANDLE} strokeWidth={1.4} strokeDasharray="4 3" />,
            <SvgText key="hht" x={sx + sashW / 2} y={hy - 4} textAnchor="middle" style={{ fontSize: 9 }} fill={HANDLE}>
              {String(clamp)}
            </SvgText>,
          );
        }
        return parts;
      })}
      <Line x1={rectX} y1={hLineY} x2={rectX + rectW} y2={hLineY} stroke={DIM} strokeWidth={1} />
      <Line x1={rectX} y1={hLineY - 5} x2={rectX} y2={hLineY + 5} stroke={DIM} strokeWidth={1} />
      <Line x1={rectX + rectW} y1={hLineY - 5} x2={rectX + rectW} y2={hLineY + 5} stroke={DIM} strokeWidth={1} />
      <SvgText x={rectX + rectW / 2} y={hLineY + 18} textAnchor="middle" style={{ fontSize: 11 }} fill={DIM}>
        {`${width} mm`}
      </SvgText>
      <Line x1={vLineX} y1={rectY} x2={vLineX} y2={rectY + rectH} stroke={DIM} strokeWidth={1} />
      <Line x1={vLineX - 5} y1={rectY} x2={vLineX + 5} y2={rectY} stroke={DIM} strokeWidth={1} />
      <Line x1={vLineX - 5} y1={rectY + rectH} x2={vLineX + 5} y2={rectY + rectH} stroke={DIM} strokeWidth={1} />
      <SvgText
        x={vLineX - 10}
        y={rectY + rectH / 2}
        textAnchor="middle"
        style={{ fontSize: 11 }}
        fill={DIM}
        transform={`rotate(-90 ${vLineX - 10} ${rectY + rectH / 2})`}
      >
        {`${height} mm`}
      </SvgText>
    </Svg>
  );
}

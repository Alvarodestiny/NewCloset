import Svg, { Defs, Ellipse, LinearGradient, Path, Stop } from 'react-native-svg';
import { FrontFrame } from '../lib/body/frame';
import { BodyModel, ringRadius } from '../lib/body/model';

function shade(hex: string, f: number) {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(v * f)));
  return `rgb(${ch(n >> 16)},${ch((n >> 8) & 255)},${ch(n & 255)})`;
}

/**
 * Lightweight 2D front view of the parametric body (used for thumbnails and as a
 * fallback). Each limb is shaded like a cylinder so it reads as a 3D mannequin.
 */
export function MannequinSilhouette({ model, frame, width, height, skinTone }: {
  model: BodyModel;
  frame: FrontFrame;
  width: number;
  height: number;
  skinTone: string;
}) {
  const paths = model.limbs
    .filter((l) => l.plane === 'xz')
    .map((l, i) => {
      const left = l.rings.map((r) => frame.toScreen(r.c[0] - ringRadius(r, Math.PI), r.c[1]));
      const right = l.rings.map((r) => frame.toScreen(r.c[0] + ringRadius(r, 0), r.c[1]));
      const pts = [...left, ...right.reverse()];
      const d = `M${pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join('L')}Z`;
      return { d, key: `${l.part}-${i}`, arm: l.part === 'arms' };
    });
  const a = model.anchors;
  const feet = [-1, 1].map((side) => {
    const c = frame.toScreen(side * (a.ankleX + 1), a.ankleY * 0.55);
    return { cx: c.x, cy: c.y, rx: a.footWidth * 0.5 * frame.scale, ry: a.ankleY * 0.7 * frame.scale };
  });

  return (
    <Svg width={width} height={height}>
      <Defs>
        <LinearGradient id="limb" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={shade(skinTone, 0.72)} />
          <Stop offset="0.35" stopColor={shade(skinTone, 1.04)} />
          <Stop offset="0.6" stopColor={shade(skinTone, 0.98)} />
          <Stop offset="1" stopColor={shade(skinTone, 0.7)} />
        </LinearGradient>
      </Defs>
      <Ellipse
        cx={frame.toScreen(0, 0).x}
        cy={frame.toScreen(0, 0).y}
        rx={(a.ankleX + a.footLength * 0.6) * frame.scale}
        ry={a.footLength * 0.18 * frame.scale}
        fill="rgba(58,48,39,0.12)"
      />
      {feet.map((f, i) => (
        <Ellipse key={`foot-${i}`} {...f} fill="url(#limb)" />
      ))}
      {paths.filter((p) => !p.arm).map((p) => <Path key={p.key} d={p.d} fill="url(#limb)" />)}
      {paths.filter((p) => p.arm).map((p) => <Path key={p.key} d={p.d} fill="url(#limb)" />)}
    </Svg>
  );
}

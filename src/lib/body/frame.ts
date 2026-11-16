import { BodyModel } from './model';

/**
 * Front-view framing shared by the orthographic 3D camera, the SVG silhouette and
 * the garment overlays, so a point in body space lands on the same pixel everywhere.
 */
export interface FrontFrame {
  left: number;
  right: number;
  bottom: number;
  top: number;
  /** pixels per centimetre */
  scale: number;
  toScreen: (x: number, y: number) => { x: number; y: number };
}

export function frontFrame(model: BodyModel, widthPx: number, heightPx: number): FrontFrame {
  const H = model.anchors.height;
  const bottom = -3;
  const top = H + 4;
  const span = top - bottom;
  const scale = heightPx / span;
  const halfW = widthPx / scale / 2;
  return {
    left: -halfW,
    right: halfW,
    bottom,
    top,
    scale,
    toScreen: (x, y) => ({ x: (x + halfW) * scale, y: (top - y) * scale }),
  };
}

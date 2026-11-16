import { ExpoWebGLRenderingContext, GLView } from 'expo-gl';
import { useEffect, useRef } from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import * as THREE from 'three';
import { buildBodyGeometry, Highlight, paintBody, partCenterY } from '../lib/body/body3d';
import { frontFrame } from '../lib/body/frame';
import { BodyMeasurements } from '../lib/body/measurements';
import { buildBody } from '../lib/body/model';

/** Turntable state shared between gesture handlers and the render loop (changes every frame, so not React state). */
export class Turntable {
  yaw = 0; // radians, 0 = facing the viewer
  autoRotate = false;
  private dragStart = 0;
  setYaw(yaw: number) {
    this.yaw = yaw;
    this.autoRotate = false;
  }
  setAutoRotate(on: boolean) {
    this.autoRotate = on;
  }
  beginDrag() {
    this.dragStart = this.yaw;
    this.autoRotate = false;
  }
  drag(dx: number) {
    this.yaw = this.dragStart + dx * 0.012;
  }
  tick(dt: number) {
    if (this.autoRotate) this.yaw += dt * 0.6;
  }
}

interface Props {
  body: BodyMeasurements;
  skinTone: string;
  background: string;
  width: number;
  height: number;
  /** front: orthographic, aligned with the garment overlays. orbit: 360° turntable view. */
  mode: 'front' | 'orbit';
  highlight?: Highlight;
  controls?: Turntable;
  style?: StyleProp<ViewStyle>;
}

/** Live 3D mannequin rendered with three.js on an expo-gl surface. */
export function MannequinGL({ body, skinTone, background, width, height, mode, highlight = null, controls, style }: Props) {
  const props = useRef({ body, skinTone, background, mode, highlight, width, height });
  useEffect(() => {
    props.current = { body, skinTone, background, mode, highlight, width, height };
  }, [body, skinTone, background, mode, highlight, width, height]);
  const frame = useRef<number | null>(null);

  useEffect(() => () => {
    if (frame.current != null) cancelAnimationFrame(frame.current);
  }, []);

  const onContextCreate = (gl: ExpoWebGLRenderingContext) => {
    const W = gl.drawingBufferWidth;
    const H = gl.drawingBufferHeight;
    // three.js expects a canvas; expo-gl gives us the raw context, so we pass a stub.
    const canvas = {
      width: W,
      height: H,
      style: {},
      addEventListener: () => {},
      removeEventListener: () => {},
      clientHeight: H,
      getContext: () => gl,
    } as unknown as HTMLCanvasElement;
    const renderer = new THREE.WebGLRenderer({ canvas, context: gl as unknown as WebGL2RenderingContext, antialias: true });
    renderer.setPixelRatio(1);
    renderer.setSize(W, H, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;

    const scene = new THREE.Scene();
    const turntable = new THREE.Group();
    scene.add(turntable);

    // Studio lighting: soft sky/ground fill, warm key from the front-left, cool rim from behind.
    scene.add(new THREE.HemisphereLight('#ffffff', '#b8a898', 1.15));
    const key = new THREE.DirectionalLight('#fff4e8', 2.1);
    key.position.set(-120, 260, 220);
    scene.add(key);
    const fill = new THREE.DirectionalLight('#e8f0ff', 0.7);
    fill.position.set(180, 120, 160);
    scene.add(fill);
    const rim = new THREE.DirectionalLight('#ffffff', 1.3);
    rim.position.set(60, 200, -260);
    scene.add(rim);

    const material = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.48, metalness: 0, clearcoat: 0.25, clearcoatRoughness: 0.55, sheen: 0.3, sheenRoughness: 0.8 });
    const mesh = new THREE.Mesh(new THREE.BufferGeometry(), material);
    turntable.add(mesh);

    // Contact shadow: stacked translucent discs fake a soft blur.
    const shadow = new THREE.Group();
    for (let i = 0; i < 6; i++) {
      const disc = new THREE.Mesh(
        new THREE.CircleGeometry(1, 48),
        new THREE.MeshBasicMaterial({ color: '#3a3027', transparent: true, opacity: 0.07, depthWrite: false }),
      );
      const s = 1 - i * 0.14;
      disc.scale.set(s, s, 1);
      disc.rotation.x = -Math.PI / 2;
      disc.position.y = 0.05 + i * 0.01;
      shadow.add(disc);
    }
    turntable.add(shadow);

    const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, -1000, 1000);
    const persp = new THREE.PerspectiveCamera(20, W / H, 10, 3000);
    const view = { targetY: 100, span: 215 };

    let builtKey = '';
    let parts = new Uint8Array();
    let paintedKey = '';
    let last = Date.now();

    const render = () => {
      const p = props.current;
      const bodyKey = JSON.stringify(p.body);
      const model = buildBodyCached(p.body, bodyKey);
      if (bodyKey !== builtKey) {
        const built = buildBodyGeometry(model);
        mesh.geometry.dispose();
        mesh.geometry = built.geo;
        parts = built.parts;
        builtKey = bodyKey;
        paintedKey = '';
        const sw = (model.anchors.ankleX + model.anchors.footLength * 0.5) * 1.6;
        shadow.scale.set(sw, 1, sw * 0.75);
        shadow.position.z = model.anchors.footLength * 0.2;
      }
      const paint = `${p.skinTone}|${p.highlight}`;
      if (paint !== paintedKey) {
        paintBody(mesh.geometry, parts, p.skinTone, p.highlight);
        paintedKey = paint;
      }
      renderer.setClearColor(p.background, 1);

      const now = Date.now();
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;

      let camera: THREE.Camera;
      if (p.mode === 'front') {
        const f = frontFrame(model, W, H);
        ortho.left = f.left;
        ortho.right = f.right;
        ortho.top = f.top;
        ortho.bottom = f.bottom;
        ortho.position.set(0, 0, 500);
        ortho.lookAt(0, 0, 0);
        ortho.updateProjectionMatrix();
        turntable.rotation.y = 0;
        camera = ortho;
      } else {
        controls?.tick(dt);
        turntable.rotation.y = controls?.yaw ?? 0;
        // Zoom towards the selected part.
        const focus = p.highlight && p.highlight !== 'all';
        const goalY = focus ? partCenterY(model, p.highlight) : model.anchors.height / 2;
        const goalSpan = focus ? (p.highlight === 'legs' ? 140 : 95) : Math.max(215, model.anchors.height * 1.15);
        const k = 1 - Math.exp(-dt * 6);
        view.targetY += (goalY - view.targetY) * k;
        view.span += (goalSpan - view.span) * k;
        const dist = view.span / 2 / Math.tan(THREE.MathUtils.degToRad(persp.fov / 2));
        persp.aspect = W / H;
        persp.position.set(0, view.targetY + 8, dist);
        persp.lookAt(0, view.targetY, 0);
        persp.updateProjectionMatrix();
        camera = persp;
      }

      renderer.render(scene, camera);
      gl.endFrameEXP();
      frame.current = requestAnimationFrame(render);
    };
    render();
  };

  return <GLView key={`${width}x${height}`} style={[{ width, height }, style]} onContextCreate={onContextCreate} />;
}

let cacheKey = '';
let cacheModel: ReturnType<typeof buildBody> | null = null;
function buildBodyCached(body: BodyMeasurements, key: string) {
  if (key !== cacheKey || !cacheModel) {
    cacheModel = buildBody(body);
    cacheKey = key;
  }
  return cacheModel;
}

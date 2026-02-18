import * as THREE from 'three';

export interface FocusOptions {
  durationMs?: number;
  viewMode?: 'top' | 'isometric';
  lockLookAt?: boolean;
  easing?: (t: number) => number;
}

export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export async function focusCameraToTarget(
  camera: THREE.PerspectiveCamera,
  controls: { target: THREE.Vector3; update(): void },
  center: THREE.Vector3,
  radius: number,
  options: FocusOptions = {}
): Promise<void> {
  const durationMs = options.durationMs ?? 800;
  const easing = options.easing ?? easeInOutCubic;
  const viewMode = options.viewMode ?? 'isometric';

  const startPos = camera.position.clone();
  const startTarget = controls.target.clone();

  const direction = viewMode === 'top'
    ? new THREE.Vector3(0, 1, 0.001).normalize()
    : new THREE.Vector3(1, 0.8, 1).normalize();

  const distance = Math.max(radius * 2.2, 1.5);
  const endPos = center.clone().add(direction.multiplyScalar(distance));
  const endTarget = center.clone();

  const start = performance.now();
  await new Promise<void>((resolve) => {
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const k = easing(t);

      camera.position.lerpVectors(startPos, endPos, k);
      controls.target.lerpVectors(startTarget, endTarget, k);
      controls.update();

      if (t < 1) requestAnimationFrame(tick);
      else resolve();
    };

    requestAnimationFrame(tick);
  });

  if (options.lockLookAt) {
    controls.target.copy(endTarget);
    controls.update();
  }
}

export const focusPseudoCode = `
focus(target, radius, mode, duration):
  startPos = camera.position
  startLook = controls.target
  endPos = target + direction(mode) * fitDistance(radius)
  endLook = target
  for t in [0..1]:
    k = easeInOutCubic(t)
    camera.position = lerp(startPos, endPos, k)
    controls.target = lerp(startLook, endLook, k)
`;

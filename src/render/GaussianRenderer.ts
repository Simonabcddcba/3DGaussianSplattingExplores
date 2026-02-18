import * as THREE from 'three';
import type { GaussianChunk } from '../loaders/SogParser';

export interface RenderStats {
  visibleGaussians: number;
  drawCalls: number;
  gpuMemoryMB: number;
}

export class GaussianRenderer {
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.PerspectiveCamera;
  private readonly renderer: THREE.WebGLRenderer;
  private mesh: THREE.InstancedMesh | null = null;
  private visibleGaussians = 0;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.camera = new THREE.PerspectiveCamera(55, 1, 0.01, 2000);
    this.camera.position.set(0, 0, 8);
  }

  resize(width: number, height: number): void {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  appendChunk(chunk: GaussianChunk): void {
    this.visibleGaussians = chunk.count;
    const geometry = new THREE.PlaneGeometry(1, 1, 1, 1);
    const material = new THREE.MeshBasicMaterial({ color: '#aac4ff', transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.NormalBlending });

    if (this.mesh) this.scene.remove(this.mesh);
    this.mesh = new THREE.InstancedMesh(geometry, material, chunk.count);

    const mat = new THREE.Matrix4();
    for (let i = 0; i < chunk.count; i++) {
      const x = chunk.positions[i * 3];
      const y = chunk.positions[i * 3 + 1];
      const z = chunk.positions[i * 3 + 2];
      const s = 0.02 + chunk.weights[i] * 0.05;
      mat.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion(), new THREE.Vector3(s, s, s));
      this.mesh.setMatrixAt(i, mat);
    }

    this.scene.add(this.mesh);
  }

  setQualityPreset(preset: 'ultra' | 'balanced' | 'mobile'): void {
    if (preset === 'mobile') {
      this.renderer.setPixelRatio(1);
    } else if (preset === 'balanced') {
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    } else {
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    }
  }

  render(): RenderStats {
    this.renderer.render(this.scene, this.camera);
    const info = this.renderer.info;
    return {
      visibleGaussians: this.visibleGaussians,
      drawCalls: info.render.calls,
      gpuMemoryMB: (info.memory.geometries * 0.5) + (info.memory.textures * 2),
    };
  }

  getCamera(): THREE.PerspectiveCamera {
    return this.camera;
  }

  dispose(): void {
    this.renderer.dispose();
  }
}

export const gaussianVertexShader = `
// pseudo: covariance projection for gaussian splats
attribute vec3 center;
attribute vec4 color;
attribute vec3 covA;
attribute vec3 covB;
varying vec4 vColor;
void main() {
  vColor = color;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(center, 1.0);
}
`;

export const gaussianFragmentShader = `
precision highp float;
varying vec4 vColor;
void main() {
  vec2 d = gl_PointCoord * 2.0 - 1.0;
  float alpha = exp(-dot(d, d) * 2.0) * vColor.a;
  gl_FragColor = vec4(vColor.rgb * alpha, alpha);
}
`;

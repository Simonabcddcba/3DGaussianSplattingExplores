import { SogLoader } from '../loaders/SogLoader';
import { GaussianRenderer } from '../render/GaussianRenderer';
import { PerfMonitor } from '../utils/PerfMonitor';
import { UnifiedInput } from '../controls/UnifiedInput';
import { focusCameraToTarget } from '../camera/CameraFocus';

export class App {
  private readonly loader = new SogLoader();
  private readonly renderer: GaussianRenderer;
  private readonly perf = new PerfMonitor();
  private readonly input: UnifiedInput;
  private running = false;

  constructor(private readonly canvas: HTMLCanvasElement, private readonly overlay: HTMLElement) {
    this.renderer = new GaussianRenderer(canvas);
    this.input = new UnifiedInput(canvas, (g) => {
      // Hook to camera controls; left as integration point.
      if (g.kind === 'pinch') this.overlay.textContent = `Pinch scale ${g.scale?.toFixed(2)}`;
    });
  }

  async init(): Promise<void> {
    this.onResize();
    window.addEventListener('resize', () => this.onResize());

    const queryUrl = SogLoader.getSogUrlFromQuery();
    if (queryUrl) {
      const asset = await this.loader.fromUrl(queryUrl);
      this.renderer.appendChunk(asset.chunks[0]);
    }

    this.bindDragAndDrop();
    this.running = true;
    this.loop();
  }

  async focusDemo(): Promise<void> {
    const cam = this.renderer.getCamera();
    const fakeControls = { target: cam.position.clone().set(0, 0, 0), update: () => void 0 };
    await focusCameraToTarget(cam, fakeControls, fakeControls.target, 3, { durationMs: 800, viewMode: 'isometric', lockLookAt: true });
  }

  private bindDragAndDrop(): void {
    window.addEventListener('dragover', (e) => e.preventDefault());
    window.addEventListener('drop', async (e) => {
      e.preventDefault();
      const file = e.dataTransfer?.files?.[0];
      if (!file || !file.name.endsWith('.sog')) return;
      const asset = await this.loader.fromFile(file);
      this.renderer.appendChunk(asset.chunks[0]);
    });
  }

  private onResize(): void {
    this.renderer.resize(this.canvas.clientWidth, this.canvas.clientHeight);
  }

  private loop = (): void => {
    if (!this.running) return;
    const stats = this.renderer.render();
    const p = this.perf.tick(stats.visibleGaussians, stats.gpuMemoryMB);
    this.overlay.textContent = `FPS ${p.fps} | Splats ${p.visibleGaussians} | Mem ${p.gpuMemoryMB.toFixed(1)} MB`;
    requestAnimationFrame(this.loop);
  };

  dispose(): void {
    this.running = false;
    this.input.dispose();
    this.renderer.dispose();
  }
}

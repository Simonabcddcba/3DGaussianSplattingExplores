export interface PerfSnapshot {
  fps: number;
  visibleGaussians: number;
  gpuMemoryMB: number;
}

export class PerfMonitor {
  private frames = 0;
  private last = performance.now();
  private fps = 0;

  tick(visibleGaussians: number, gpuMemoryMB: number): PerfSnapshot {
    this.frames++;
    const now = performance.now();
    if (now - this.last >= 1000) {
      this.fps = (this.frames * 1000) / (now - this.last);
      this.frames = 0;
      this.last = now;
    }
    return { fps: Math.round(this.fps), visibleGaussians, gpuMemoryMB };
  }
}

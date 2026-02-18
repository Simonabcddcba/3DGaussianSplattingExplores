export type GestureKind = 'rotate' | 'pinch' | 'pan';

export interface GestureEventPayload {
  kind: GestureKind;
  dx?: number;
  dy?: number;
  scale?: number;
}

export class UnifiedInput {
  private pointers = new Map<number, PointerEvent>();
  private raf = 0;
  private pending: GestureEventPayload | null = null;

  constructor(private readonly el: HTMLElement, private readonly onGesture: (g: GestureEventPayload) => void) {
    this.el.style.touchAction = 'none';
    this.bind();
  }

  private bind(): void {
    this.el.addEventListener('pointerdown', this.onDown, { passive: false });
    this.el.addEventListener('pointermove', this.onMove, { passive: false });
    this.el.addEventListener('pointerup', this.onUp, { passive: true });
    this.el.addEventListener('pointercancel', this.onUp, { passive: true });
  }

  private onDown = (e: PointerEvent): void => {
    e.preventDefault();
    this.pointers.set(e.pointerId, e);
  };

  private onMove = (e: PointerEvent): void => {
    if (!this.pointers.has(e.pointerId)) return;
    e.preventDefault();
    const prev = this.pointers.get(e.pointerId)!;
    this.pointers.set(e.pointerId, e);

    const pts = [...this.pointers.values()];
    if (pts.length === 1) {
      this.queue({ kind: 'rotate', dx: e.clientX - prev.clientX, dy: e.clientY - prev.clientY });
    } else if (pts.length === 2) {
      const [a, b] = pts;
      const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      const prevDist = Math.hypot((a.clientX - (e.clientX - prev.clientX)) - b.clientX, (a.clientY - (e.clientY - prev.clientY)) - b.clientY);
      this.queue({ kind: 'pinch', scale: dist / Math.max(prevDist, 1e-3) });
    } else if (pts.length >= 3) {
      this.queue({ kind: 'pan', dx: e.clientX - prev.clientX, dy: e.clientY - prev.clientY });
    }
  };

  private onUp = (e: PointerEvent): void => {
    this.pointers.delete(e.pointerId);
  };

  private queue(payload: GestureEventPayload): void {
    this.pending = payload;
    if (this.raf) return;
    this.raf = requestAnimationFrame(() => {
      this.raf = 0;
      if (this.pending) this.onGesture(this.pending);
      this.pending = null;
    });
  }

  dispose(): void {
    this.el.removeEventListener('pointerdown', this.onDown);
    this.el.removeEventListener('pointermove', this.onMove);
    this.el.removeEventListener('pointerup', this.onUp);
    this.el.removeEventListener('pointercancel', this.onUp);
  }
}

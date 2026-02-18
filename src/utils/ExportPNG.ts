export function exportCanvasPNG(canvas: HTMLCanvasElement, fileName = 'sog-view.png'): void {
  const url = canvas.toDataURL('image/png');
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
}

export interface SogHeader {
  magic: 'SOG0';
  version: number;
  headerSize: number;
  gaussianCount: number;
  chunkCount: number;
  quantization: { posBits: number; colorBits: number; covBits: number; weightBits: number };
  boundsMin: [number, number, number];
  boundsMax: [number, number, number];
  flags: number;
}

export interface GaussianChunk {
  chunkId: number;
  indexOffset: number;
  count: number;
  positions: Float32Array;
  covariances: Float32Array;
  colors: Uint8Array;
  weights: Float32Array;
  lodLevels: Uint8Array;
}

export class SogParser {
  parseHeader(buffer: ArrayBuffer): SogHeader {
    const dv = new DataView(buffer);
    const magic = String.fromCharCode(dv.getUint8(0), dv.getUint8(1), dv.getUint8(2), dv.getUint8(3));
    if (magic !== 'SOG0') {
      throw new Error(`Invalid SOG magic: ${magic}`);
    }

    const version = dv.getUint16(4, true);
    const headerSize = dv.getUint16(6, true);
    const gaussianCount = dv.getUint32(8, true);
    const chunkCount = dv.getUint32(12, true);

    return {
      magic: 'SOG0',
      version,
      headerSize,
      gaussianCount,
      chunkCount,
      quantization: {
        posBits: dv.getUint8(16),
        colorBits: dv.getUint8(17),
        covBits: dv.getUint8(18),
        weightBits: dv.getUint8(19),
      },
      boundsMin: [dv.getFloat32(20, true), dv.getFloat32(24, true), dv.getFloat32(28, true)],
      boundsMax: [dv.getFloat32(32, true), dv.getFloat32(36, true), dv.getFloat32(40, true)],
      flags: dv.getUint32(44, true),
    };
  }

  /**
   * Skeleton only: demonstrates dequantization and typed-array memory layout.
   */
  decodeChunk(chunkId: number, packed: Uint8Array, header: SogHeader, count: number): GaussianChunk {
    // TODO: Replace with bit-reader based implementation for real SOG payload.
    const positions = new Float32Array(count * 3);
    const covariances = new Float32Array(count * 6);
    const colors = new Uint8Array(count * 4);
    const weights = new Float32Array(count);
    const lodLevels = new Uint8Array(count);

    for (let i = 0; i < count; i++) {
      const t = i / Math.max(1, count - 1);
      const base = i * 3;
      positions[base] = lerp(header.boundsMin[0], header.boundsMax[0], t);
      positions[base + 1] = lerp(header.boundsMin[1], header.boundsMax[1], Math.random());
      positions[base + 2] = lerp(header.boundsMin[2], header.boundsMax[2], Math.random());

      const c = i * 6;
      covariances[c] = 0.02;
      covariances[c + 3] = 0.02;
      covariances[c + 5] = 0.02;

      const rgba = i * 4;
      colors[rgba] = packed[i % packed.length] ?? 180;
      colors[rgba + 1] = 160;
      colors[rgba + 2] = 255;
      colors[rgba + 3] = 220;

      weights[i] = 0.8;
      lodLevels[i] = i % 3;
    }

    return {
      chunkId,
      indexOffset: 0,
      count,
      positions,
      covariances,
      colors,
      weights,
      lodLevels,
    };
  }
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

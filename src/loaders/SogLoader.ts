import { SogParser, type GaussianChunk, type SogHeader } from './SogParser';

export interface SogAsset {
  header: SogHeader;
  chunks: GaussianChunk[];
}

export class SogLoader {
  constructor(private readonly parser = new SogParser()) {}

  async fromUrl(url: string): Promise<SogAsset> {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch SOG: ${res.status}`);
    const buffer = await res.arrayBuffer();
    return this.fromArrayBuffer(buffer);
  }

  async fromFile(file: File): Promise<SogAsset> {
    const buffer = await file.arrayBuffer();
    return this.fromArrayBuffer(buffer);
  }

  fromArrayBuffer(buffer: ArrayBuffer): SogAsset {
    const header = this.parser.parseHeader(buffer.slice(0, 64));
    const payload = new Uint8Array(buffer, header.headerSize || 64);
    const chunks: GaussianChunk[] = [];

    // Real implementation: iterate chunk table + decode by chunk offset.
    const chunk = this.parser.decodeChunk(0, payload, header, Math.min(100_000, header.gaussianCount));
    chunks.push(chunk);

    return { header, chunks };
  }

  static getSogUrlFromQuery(locationSearch = window.location.search): string | null {
    const params = new URLSearchParams(locationSearch);
    return params.get('sog');
  }
}

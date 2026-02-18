import assert from 'node:assert/strict';

function makeHeader() {
  const buf = new ArrayBuffer(64);
  const dv = new DataView(buf);
  dv.setUint8(0, 'S'.charCodeAt(0));
  dv.setUint8(1, 'O'.charCodeAt(0));
  dv.setUint8(2, 'G'.charCodeAt(0));
  dv.setUint8(3, '0'.charCodeAt(0));
  dv.setUint16(4, 1, true);
  dv.setUint16(6, 64, true);
  dv.setUint32(8, 123456, true);
  dv.setUint32(12, 12, true);
  return buf;
}

function parseHeader(buffer) {
  const dv = new DataView(buffer);
  const magic = String.fromCharCode(dv.getUint8(0), dv.getUint8(1), dv.getUint8(2), dv.getUint8(3));
  if (magic !== 'SOG0') throw new Error('bad magic');
  return {
    magic,
    version: dv.getUint16(4, true),
    headerSize: dv.getUint16(6, true),
    gaussianCount: dv.getUint32(8, true),
    chunkCount: dv.getUint32(12, true),
  };
}

const header = parseHeader(makeHeader());
assert.equal(header.magic, 'SOG0');
assert.equal(header.version, 1);
assert.equal(header.headerSize, 64);
assert.equal(header.gaussianCount, 123456);
assert.equal(header.chunkCount, 12);

console.log('sog parser header tests passed');

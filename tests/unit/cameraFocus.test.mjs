import assert from 'node:assert/strict';

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - ((-2 * t + 2) ** 3) / 2;
}

assert.equal(easeInOutCubic(0), 0);
assert.equal(easeInOutCubic(1), 1);
assert.ok(easeInOutCubic(0.5) > 0.49 && easeInOutCubic(0.5) < 0.51);
assert.ok(easeInOutCubic(0.8) > easeInOutCubic(0.2));

console.log('cameraFocus easing tests passed');

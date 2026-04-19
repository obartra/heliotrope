import { describe, it, expect } from 'vitest';
import { computeCropRegion } from './imageProcessing';

describe('computeCropRegion', () => {
  it('returns identity for a square image within max', () => {
    const result = computeCropRegion(512, 512, 1024);
    expect(result).toEqual({ sx: 0, sy: 0, sSize: 512, outputSize: 512 });
  });

  it('center-crops a landscape image', () => {
    const result = computeCropRegion(800, 400, 1024);
    expect(result).toEqual({ sx: 200, sy: 0, sSize: 400, outputSize: 400 });
  });

  it('center-crops a portrait image', () => {
    const result = computeCropRegion(400, 800, 1024);
    expect(result).toEqual({ sx: 0, sy: 200, sSize: 400, outputSize: 400 });
  });

  it('downscales a large square image', () => {
    const result = computeCropRegion(2048, 2048, 1024);
    expect(result).toEqual({ sx: 0, sy: 0, sSize: 2048, outputSize: 1024 });
  });

  it('crops and downscales a large landscape image', () => {
    const result = computeCropRegion(3000, 2000, 1024);
    // sSize = min(3000, 2000) = 2000
    // sx = (3000 - 2000) / 2 = 500
    // outputSize = min(2000, 1024) = 1024
    expect(result).toEqual({ sx: 500, sy: 0, sSize: 2000, outputSize: 1024 });
  });

  it('crops and downscales a large portrait image', () => {
    const result = computeCropRegion(2000, 3000, 1024);
    expect(result).toEqual({ sx: 0, sy: 500, sSize: 2000, outputSize: 1024 });
  });

  it('handles an image already at max dimension', () => {
    const result = computeCropRegion(1024, 1024, 1024);
    expect(result).toEqual({ sx: 0, sy: 0, sSize: 1024, outputSize: 1024 });
  });

  it('handles a small square image', () => {
    const result = computeCropRegion(128, 128, 1024);
    expect(result).toEqual({ sx: 0, sy: 0, sSize: 128, outputSize: 128 });
  });

  it('handles odd-dimension center crop', () => {
    const result = computeCropRegion(501, 200, 1024);
    // sSize = 200, sx = floor((501 - 200) / 2) = floor(150.5) = 150
    expect(result).toEqual({ sx: 150, sy: 0, sSize: 200, outputSize: 200 });
  });

  it('uses default maxDimension of 1024', () => {
    const result = computeCropRegion(2000, 2000);
    expect(result.outputSize).toBe(1024);
  });
});

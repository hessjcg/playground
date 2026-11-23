(function (global) {
  'use strict';

  const TinyBooks = (global.TinyBooks = global.TinyBooks || {});

  function componentToHex(value) {
    const clamped = Math.max(0, Math.min(255, Math.round(value)));
    return clamped.toString(16).padStart(2, '0');
  }

  function rgbToHex(r, g, b) {
    return `#${componentToHex(r)}${componentToHex(g)}${componentToHex(b)}`;
  }

  function hexToRgb(hex) {
    const clean = String(hex || '').replace('#', '').trim();
    if (clean.length === 3) {
      return {
        r: parseInt(clean[0] + clean[0], 16),
        g: parseInt(clean[1] + clean[1], 16),
        b: parseInt(clean[2] + clean[2], 16)
      };
    }
    if (clean.length !== 6) {
      return { r: 204, g: 204, b: 204 };
    }
    return {
      r: parseInt(clean.slice(0, 2), 16),
      g: parseInt(clean.slice(2, 4), 16),
      b: parseInt(clean.slice(4, 6), 16)
    };
  }

  /**
   * Computes relative sRGB luminance (0..1) and returns a high-contrast
   * ink color for spine titles.
   */
  function getContrastingTextColor(hexColor) {
    const { r, g, b } = hexToRgb(hexColor);
    const toLinear = (c) => {
      const s = c / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    };
    const luminance =
      0.2126 * toLinear(r) +
      0.7152 * toLinear(g) +
      0.0722 * toLinear(b);
    return luminance > 0.179 ? '#111111' : '#ffffff';
  }

  /**
   * Extracts the dominant opaque color from an HTMLImageElement using
   * quantized RGB bucket frequency on a downsampled 64x64 canvas.
   */
  function extractDominantColor(image) {
    const naturalW = image.naturalWidth || image.width || 64;
    const naturalH = image.naturalHeight || image.height || 64;
    const maxDim = 64;
    const scale = Math.min(1, maxDim / Math.max(naturalW, naturalH));
    const width = Math.max(1, Math.round(naturalW * scale));
    const height = Math.max(1, Math.round(naturalH * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      return '#cccccc';
    }

    ctx.drawImage(image, 0, 0, width, height);
    const { data } = ctx.getImageData(0, 0, width, height);

    const buckets = new Map();
    let bestBucket = null;

    for (let i = 0; i < data.length; i += 4) {
      const alpha = data[i + 3];
      if (alpha < 128) continue;

      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      // 16 levels per channel (4096 total buckets) groups similar tones cleanly.
      const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
      let entry = buckets.get(key);
      if (!entry) {
        entry = { count: 0, rSum: 0, gSum: 0, bSum: 0 };
        buckets.set(key, entry);
      }
      entry.count += 1;
      entry.rSum += r;
      entry.gSum += g;
      entry.bSum += b;

      if (!bestBucket || entry.count > bestBucket.count) {
        bestBucket = entry;
      }
    }

    if (!bestBucket || bestBucket.count === 0) {
      return '#cccccc';
    }

    return rgbToHex(
      bestBucket.rSum / bestBucket.count,
      bestBucket.gSum / bestBucket.count,
      bestBucket.bSum / bestBucket.count
    );
  }

  TinyBooks.Color = {
    rgbToHex,
    hexToRgb,
    getContrastingTextColor,
    extractDominantColor
  };
})(window);

(function (global) {
  'use strict';

  const TinyBooks = (global.TinyBooks = global.TinyBooks || {});

  const MM_PER_INCH = 25.4;

  const PAGE_WIDTH_IN = 8.5;
  const PAGE_HEIGHT_IN = 11;
  const MARGIN_IN = 0.5;
  const BLEED_IN = 0.125;
  const GAP_IN = 0.125;

  TinyBooks.CONSTANTS = Object.freeze({
    MM_PER_INCH,
    PAGE_WIDTH_IN,
    PAGE_HEIGHT_IN,
    PAGE_WIDTH_MM: Number((PAGE_WIDTH_IN * MM_PER_INCH).toFixed(3)),   // 215.9 mm
    PAGE_HEIGHT_MM: Number((PAGE_HEIGHT_IN * MM_PER_INCH).toFixed(3)), // 279.4 mm
    MARGIN_IN,
    MARGIN_MM: Number((MARGIN_IN * MM_PER_INCH).toFixed(3)),           // 12.7 mm
    BLEED_IN,
    BLEED_MM: Number((BLEED_IN * MM_PER_INCH).toFixed(3)),             // 3.175 mm
    GAP_IN,
    GAP_MM: Number((GAP_IN * MM_PER_INCH).toFixed(3)),                 // 3.175 mm
    CUT_OVERHANG_MM: Number((BLEED_IN * MM_PER_INCH).toFixed(3)),      // 3.175 mm overhang past outer bleed
    CUT_STROKE_COLOR: '#d60000',
    CUT_STROKE_WIDTH_MM: 0.22,
    PRINT_DPI: 600,
    MAX_CROP_PX: 1800,
    DEFAULT_PARAMS: Object.freeze({
      coverWidthMm: 28,
      coverHeightMm: 35,
      spineWidthMm: 4,
      imageFit: 'meet', // 'meet' | 'slice' | 'stretch'
      includeCutLines: true
    })
  });
})(window);

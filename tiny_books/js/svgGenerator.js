(function (global) {
  'use strict';

  const TinyBooks = (global.TinyBooks = global.TinyBooks || {});

  let measureCanvasCtx = null;
  function getMeasureContext() {
    if (!measureCanvasCtx) {
      const canvas = document.createElement('canvas');
      measureCanvasCtx = canvas.getContext('2d');
    }
    return measureCanvasCtx;
  }

  function fmt(num) {
    return Number(num.toFixed(3)).toString();
  }

  function escXml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function computeLayoutMetrics(params) {
    const C = TinyBooks.CONSTANTS;
    const coverWidthMm = Math.max(1, Number(params.coverWidthMm) || C.DEFAULT_PARAMS.coverWidthMm);
    const coverHeightMm = Math.max(1, Number(params.coverHeightMm) || C.DEFAULT_PARAMS.coverHeightMm);
    const spineWidthMm = Math.max(0.5, Number(params.spineWidthMm) || C.DEFAULT_PARAMS.spineWidthMm);

    const innerW = 2 * coverWidthMm + spineWidthMm;
    const innerH = coverHeightMm;
    const unitW = innerW + 2 * C.BLEED_MM;
    const unitH = innerH + 2 * C.BLEED_MM;

    const availW = C.PAGE_WIDTH_MM - 2 * C.MARGIN_MM;
    const availH = C.PAGE_HEIGHT_MM - 2 * C.MARGIN_MM;

    const fitsWidth = unitW <= availW + 1e-6;
    const fitsHeight = unitH <= availH + 1e-6;

    const cols = fitsWidth
      ? Math.max(1, Math.floor((availW + C.GAP_MM + 1e-6) / (unitW + C.GAP_MM)))
      : 0;
    const rows = fitsHeight
      ? Math.max(1, Math.floor((availH + C.GAP_MM + 1e-6) / (unitH + C.GAP_MM)))
      : 0;

    return {
      coverWidthMm,
      coverHeightMm,
      spineWidthMm,
      innerW,
      innerH,
      unitW,
      unitH,
      availW,
      availH,
      fitsWidth,
      fitsHeight,
      fitsPage: fitsWidth && fitsHeight,
      cols,
      rows,
      perPage: cols * rows
    };
  }

  /**
   * Produces an aspect-fitted PNG data URL (or returns original when no crop
   * is needed) cached on the book object so exported SVGs clip cleanly in all editors.
   */
  function getPreparedCoverHref(book, metrics, imageFit) {
    if (imageFit !== 'slice') {
      return book.imageDataUrl;
    }

    const C = TinyBooks.CONSTANTS;
    const cacheKey = `${fmt(metrics.coverWidthMm)}x${fmt(metrics.coverHeightMm)}:slice`;
    if (book._cropCache && book._cropCache.key === cacheKey) {
      return book._cropCache.href;
    }

    const img = book.imageEl;
    const srcW = book.imageWidth || img.naturalWidth || 600;
    const srcH = book.imageHeight || img.naturalHeight || 800;

    const targetRatio = metrics.coverWidthMm / metrics.coverHeightMm;
    const srcRatio = srcW / srcH;

    let sx = 0;
    let sy = 0;
    let sWidth = srcW;
    let sHeight = srcH;

    if (srcRatio > targetRatio) {
      sWidth = srcH * targetRatio;
      sx = (srcW - sWidth) / 2;
    } else if (srcRatio < targetRatio) {
      sHeight = srcW / targetRatio;
      sy = (srcH - sHeight) / 2;
    }

    const printW = Math.round((metrics.coverWidthMm / C.MM_PER_INCH) * C.PRINT_DPI);
    const printH = Math.round((metrics.coverHeightMm / C.MM_PER_INCH) * C.PRINT_DPI);

    let outW = Math.min(Math.round(sWidth), printW, C.MAX_CROP_PX);
    let outH = Math.round(outW / targetRatio);
    if (outH > C.MAX_CROP_PX) {
      outH = C.MAX_CROP_PX;
      outW = Math.round(outH * targetRatio);
    }

    // For vector sources or tiny thumbnails, ensure crisp print output
    if (book.isVector) {
      outW = Math.min(printW, C.MAX_CROP_PX);
      outH = Math.round(outW / targetRatio);
    }

    outW = Math.max(1, outW);
    outH = Math.max(1, outH);

    const canvas = document.createElement('canvas');
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return book.imageDataUrl;
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, outW, outH);

    const href = canvas.toDataURL('image/png');
    book._cropCache = { key: cacheKey, href };
    return href;
  }

  function computeSpineFontSize(title, spineWidthMm, coverHeightMm) {
    const maxBySpine = spineWidthMm * 0.68;
    const usableLength = Math.max(2, coverHeightMm - Math.min(4, coverHeightMm * 0.12));

    const ctx = getMeasureContext();
    if (!ctx) {
      return Math.max(0.6, Math.min(maxBySpine, usableLength / Math.max(1, title.length * 0.6)));
    }

    ctx.font = '600 100px Helvetica, Arial, sans-serif';
    const measuredAt100Px = Math.max(1, ctx.measureText(title).width);
    const maxByLength = (usableLength * 100) / measuredAt100Px;

    return Math.max(0.45, Math.min(maxBySpine, maxByLength));
  }

  function buildCoverImageElement(href, boxX, boxY, boxW, boxH, book, imageFit, rotate180) {
    let imgX = boxX;
    let imgY = boxY;
    let imgW = boxW;
    let imgH = boxH;

    if (imageFit === 'meet') {
      const natW = book.imageWidth || 1;
      const natH = book.imageHeight || 1;
      const scale = Math.min(boxW / natW, boxH / natH);
      imgW = natW * scale;
      imgH = natH * scale;
      imgX = boxX + (boxW - imgW) / 2;
      imgY = boxY + (boxH - imgH) / 2;
    }

    const cx = boxX + boxW / 2;
    const cy = boxY + boxH / 2;
    const transformAttr = rotate180 ? ` transform="rotate(180 ${fmt(cx)} ${fmt(cy)})"` : '';

    return `<image x="${fmt(imgX)}" y="${fmt(imgY)}" width="${fmt(imgW)}" height="${fmt(imgH)}" preserveAspectRatio="none" href="${href}" xlink:href="${href}"${transformAttr} />`;
  }

  function expandBooksToPages(books, perPage) {
    const expanded = [];
    for (const book of books) {
      const copies = Math.max(0, Math.floor(Number(book.copies) || 0));
      for (let i = 0; i < copies; i++) {
        expanded.push(book);
      }
    }

    if (expanded.length === 0 || perPage <= 0) {
      return [];
    }

    const pages = [];
    for (let i = 0; i < expanded.length; i += perPage) {
      pages.push(expanded.slice(i, i + perPage));
    }
    return pages;
  }

  function buildPageSvg(pageUnits, metrics, params, options) {
    const C = TinyBooks.CONSTANTS;
    const isPreview = Boolean(options && options.preview);
    const includeCutLines = params.includeCutLines !== false;

    const lines = [];
    if (!isPreview) {
      lines.push('<?xml version="1.0" encoding="UTF-8"?>');
    }
    lines.push(
      `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" width="${C.PAGE_WIDTH_IN}in" height="${C.PAGE_HEIGHT_IN}in" viewBox="0 0 ${fmt(C.PAGE_WIDTH_MM)} ${fmt(C.PAGE_HEIGHT_MM)}">`
    );

    if (isPreview) {
      lines.push(
        `  <rect x="${fmt(C.MARGIN_MM)}" y="${fmt(C.MARGIN_MM)}" width="${fmt(metrics.availW)}" height="${fmt(metrics.availH)}" fill="none" stroke="rgba(28,27,24,0.12)" stroke-width="0.25" stroke-dasharray="1.5 1.5" />`
      );
    }

    // Layer 1: book_images
    lines.push('  <g id="book_images" inkscape:groupmode="layer" inkscape:label="book_images">');

    pageUnits.forEach((book, index) => {
      const col = index % metrics.cols;
      const row = Math.floor(index / metrics.cols);
      const ux = C.MARGIN_MM + col * (metrics.unitW + C.GAP_MM);
      const uy = C.MARGIN_MM + row * (metrics.unitH + C.GAP_MM);

      const bleedColor = book.dominantColor || '#cccccc';
      const textColor = book.textColor || TinyBooks.Color.getContrastingTextColor(bleedColor);
      const href = getPreparedCoverHref(book, metrics, params.imageFit);

      const leftCoverX = ux + C.BLEED_MM;
      const spineX = leftCoverX + metrics.coverWidthMm;
      const rightCoverX = spineX + metrics.spineWidthMm;
      const coverY = uy + C.BLEED_MM;

      const titleAttr = book.title ? ` data-book-title="${escXml(book.title)}"` : '';
      lines.push(`    <g class="book-unit"${titleAttr}>`);
      // Outer bleed background
      lines.push(
        `      <rect x="${fmt(ux)}" y="${fmt(uy)}" width="${fmt(metrics.unitW)}" height="${fmt(metrics.unitH)}" fill="${escXml(bleedColor)}" />`
      );
      // Spine background
      lines.push(
        `      <rect x="${fmt(spineX)}" y="${fmt(coverY)}" width="${fmt(metrics.spineWidthMm)}" height="${fmt(metrics.coverHeightMm)}" fill="${escXml(bleedColor)}" />`
      );
      // Left cover (always rotated 180 degrees)
      lines.push(
        `      ${buildCoverImageElement(
          href,
          leftCoverX,
          coverY,
          metrics.coverWidthMm,
          metrics.coverHeightMm,
          book,
          params.imageFit,
          true
        )}`
      );
      // Right cover (upright)
      lines.push(
        `      ${buildCoverImageElement(
          href,
          rightCoverX,
          coverY,
          metrics.coverWidthMm,
          metrics.coverHeightMm,
          book,
          params.imageFit,
          false
        )}`
      );

      // Spine title text (always Top -> Bottom, +90 degrees)
      const trimmedTitle = (book.title || '').trim();
      if (trimmedTitle.length > 0) {
        const fontSize = computeSpineFontSize(
          trimmedTitle,
          metrics.spineWidthMm,
          metrics.coverHeightMm
        );
        const cx = spineX + metrics.spineWidthMm / 2;
        const cy = coverY + metrics.coverHeightMm / 2;
        lines.push(
          `      <text x="${fmt(cx)}" y="${fmt(cy)}" transform="rotate(90 ${fmt(cx)} ${fmt(cy)})" text-anchor="middle" dy="0.35em" font-family="Helvetica, Arial, sans-serif" font-weight="600" font-size="${fmt(fontSize)}" fill="${escXml(textColor)}">${escXml(trimmedTitle)}</text>`
        );
      }

      lines.push('    </g>');
    });

    lines.push('  </g>');

    // Layer 2: CUT_LINES
    if (includeCutLines) {
      lines.push(
        `  <g id="CUT_LINES" inkscape:groupmode="layer" inkscape:label="CUT_LINES" stroke="${C.CUT_STROKE_COLOR}" stroke-width="${C.CUT_STROKE_WIDTH_MM}" stroke-linecap="butt" fill="none">`
      );

      if (pageUnits.length > 0 && metrics.cols > 0) {
        const actualCols = Math.min(pageUnits.length, metrics.cols);
        const actualRows = Math.ceil(pageUnits.length / metrics.cols);

        const gridLeft = C.MARGIN_MM;
        const gridRight = C.MARGIN_MM + actualCols * metrics.unitW + (actualCols - 1) * C.GAP_MM;
        const gridTop = C.MARGIN_MM;
        const gridBottom = C.MARGIN_MM + actualRows * metrics.unitH + (actualRows - 1) * C.GAP_MM;

        const xStart = gridLeft - C.CUT_OVERHANG_MM;
        const xEnd = gridRight + C.CUT_OVERHANG_MM;
        const yStart = gridTop - C.CUT_OVERHANG_MM;
        const yEnd = gridBottom + C.CUT_OVERHANG_MM;

        for (let c = 0; c < actualCols; c++) {
          const colX = C.MARGIN_MM + c * (metrics.unitW + C.GAP_MM);
          const xLeft = colX + C.BLEED_MM;
          const xRight = colX + C.BLEED_MM + metrics.innerW;
          lines.push(
            `    <line x1="${fmt(xLeft)}" y1="${fmt(yStart)}" x2="${fmt(xLeft)}" y2="${fmt(yEnd)}" />`
          );
          lines.push(
            `    <line x1="${fmt(xRight)}" y1="${fmt(yStart)}" x2="${fmt(xRight)}" y2="${fmt(yEnd)}" />`
          );
        }

        for (let r = 0; r < actualRows; r++) {
          const rowY = C.MARGIN_MM + r * (metrics.unitH + C.GAP_MM);
          const yTop = rowY + C.BLEED_MM;
          const yBottom = rowY + C.BLEED_MM + metrics.innerH;
          lines.push(
            `    <line x1="${fmt(xStart)}" y1="${fmt(yTop)}" x2="${fmt(xEnd)}" y2="${fmt(yTop)}" />`
          );
          lines.push(
            `    <line x1="${fmt(xStart)}" y1="${fmt(yBottom)}" x2="${fmt(xEnd)}" y2="${fmt(yBottom)}" />`
          );
        }
      }

      lines.push('  </g>');
    }

    lines.push('</svg>');
    return lines.join('\n');
  }

  TinyBooks.SvgGenerator = {
    computeLayoutMetrics,
    expandBooksToPages,
    buildPageSvg
  };
})(window);

(function (global) {
  'use strict';

  const TinyBooks = (global.TinyBooks = global.TinyBooks || {});

  const state = {
    books: [],
    params: { ...TinyBooks.CONSTANTS.DEFAULT_PARAMS },
    activePageIndex: 0
  };

  let nextBookId = 1;
  let toastTimer = null;

  const dom = {};

  function cacheDom() {
    dom.bookList = document.getElementById('book-list');
    dom.bookCountBadge = document.getElementById('book-count-badge');
    dom.dropzone = document.getElementById('dropzone');
    dom.fileInput = document.getElementById('file-input');
    dom.statusToast = document.getElementById('status-toast');
    dom.loadSamplesBtn = document.getElementById('load-samples-btn');
    dom.clearBooksBtn = document.getElementById('clear-books-btn');

    dom.coverWidthInput = document.getElementById('input-cover-width');
    dom.coverHeightInput = document.getElementById('input-cover-height');
    dom.spineWidthInput = document.getElementById('input-spine-width');

    dom.imageFitSelect = document.getElementById('select-image-fit');
    dom.cutLinesToggle = document.getElementById('toggle-cut-lines');

    dom.gridMetricsBadge = document.getElementById('grid-metrics-badge');
    dom.pageTabs = document.getElementById('page-tabs');
    dom.layoutWarning = document.getElementById('layout-warning');
    dom.paperSheet = document.getElementById('paper-sheet');
    dom.unitDimSummary = document.getElementById('unit-dim-summary');
    dom.downloadSvgBtn = document.getElementById('download-svg-btn');
    dom.downloadAllBtn = document.getElementById('download-all-btn');
  }

  function showToast(message) {
    if (!dom.statusToast) return;
    dom.statusToast.textContent = message;
    dom.statusToast.hidden = false;
    if (toastTimer) {
      clearTimeout(toastTimer);
    }
    toastTimer = setTimeout(() => {
      dom.statusToast.hidden = true;
    }, 3200);
  }

  function sanitizeTitleFromFilename(filename) {
    if (!filename) return 'Untitled Book';
    return filename.replace(/\.[^/.]+$/, '').replace(/[_-]+/g, ' ').trim() || 'Untitled Book';
  }

  function isLikelyImageFile(file) {
    if (!file) return false;
    if (file.type && file.type.startsWith('image/')) return true;
    return /\.(png|jpe?g|webp|gif|svg|bmp|avif)$/i.test(file.name || '');
  }

  function loadImageFromDataUrl(dataUrl) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Could not decode image'));
      img.src = dataUrl;
    });
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Could not read file'));
      reader.readAsDataURL(file);
    });
  }

  async function addBookFromDataUrl(dataUrl, title, copies, isVector) {
    const img = await loadImageFromDataUrl(dataUrl);
    const dominantColor = TinyBooks.Color.extractDominantColor(img);
    const textColor = TinyBooks.Color.getContrastingTextColor(dominantColor);

    state.books.push({
      id: `book-${nextBookId++}`,
      title: title || 'Untitled Book',
      copies: Math.max(1, Math.floor(Number(copies) || 1)),
      imageDataUrl: dataUrl,
      imageEl: img,
      imageWidth: img.naturalWidth || img.width || 600,
      imageHeight: img.naturalHeight || img.height || 800,
      isVector: Boolean(isVector),
      autoColor: dominantColor,
      dominantColor,
      textColor,
      colorOverridden: false
    });
  }

  async function handleIncomingFiles(fileList) {
    const files = Array.from(fileList || []);
    if (files.length === 0) return;

    let added = 0;
    let skipped = 0;

    for (const file of files) {
      if (!isLikelyImageFile(file)) {
        skipped += 1;
        continue;
      }
      try {
        const dataUrl = await readFileAsDataUrl(file);
        const isVector = file.type === 'image/svg+xml' || /\.svg$/i.test(file.name || '');
        const title = sanitizeTitleFromFilename(file.name);
        await addBookFromDataUrl(dataUrl, title, 1, isVector);
        added += 1;
      } catch (err) {
        skipped += 1;
      }
    }

    if (added > 0) {
      renderAll();
      const suffix = skipped > 0 ? ` (${skipped} unsupported skipped)` : '';
      showToast(`Added ${added} cover${added === 1 ? '' : 's'}${suffix}.`);
    } else if (skipped > 0) {
      showToast('No supported image files found. Try PNG, JPG, WebP, GIF, or SVG.');
    }
  }

  function renderBookList() {
    const totalTitles = state.books.length;
    const totalCopies = state.books.reduce((sum, b) => sum + (Number(b.copies) || 0), 0);
    dom.bookCountBadge.textContent = `${totalTitles} title${totalTitles === 1 ? '' : 's'} · ${totalCopies} cop${totalCopies === 1 ? 'y' : 'ies'}`;
    dom.clearBooksBtn.hidden = totalTitles === 0;

    dom.bookList.innerHTML = '';

    for (const book of state.books) {
      const card = document.createElement('article');
      card.className = 'book-card';
      card.dataset.bookId = book.id;

      // Thumbnail
      const thumbWrap = document.createElement('div');
      thumbWrap.className = 'book-thumb-wrap';
      thumbWrap.style.borderColor = book.dominantColor;
      const thumb = document.createElement('img');
      thumb.className = 'book-thumb';
      thumb.src = book.imageDataUrl;
      thumb.alt = `${book.title} cover preview`;
      thumbWrap.appendChild(thumb);

      // Meta container
      const meta = document.createElement('div');
      meta.className = 'book-meta';

      // Top row: Title input + Remove button
      const topRow = document.createElement('div');
      topRow.className = 'book-top-row';

      const titleInput = document.createElement('input');
      titleInput.type = 'text';
      titleInput.className = 'book-title-input';
      titleInput.value = book.title;
      titleInput.placeholder = 'Spine book title...';
      titleInput.setAttribute('aria-label', 'Book spine title');
      titleInput.addEventListener('input', (e) => {
        book.title = e.target.value;
        renderPreview();
      });

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'book-remove-btn';
      removeBtn.title = 'Remove book';
      removeBtn.setAttribute('aria-label', `Remove ${book.title}`);
      removeBtn.innerHTML =
        '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
      removeBtn.addEventListener('click', () => {
        state.books = state.books.filter((item) => item.id !== book.id);
        renderAll();
      });

      topRow.appendChild(titleInput);
      topRow.appendChild(removeBtn);

      // Controls row: Copies stepper + Dominant Bleed Color picker
      const controlsRow = document.createElement('div');
      controlsRow.className = 'book-controls-row';

      const copiesControl = document.createElement('div');
      copiesControl.className = 'copies-control';

      const stepper = document.createElement('div');
      stepper.className = 'copies-stepper';

      const decBtn = document.createElement('button');
      decBtn.type = 'button';
      decBtn.className = 'stepper-btn';
      decBtn.textContent = '−';
      decBtn.setAttribute('aria-label', 'Decrease copies');
      decBtn.addEventListener('click', () => {
        book.copies = Math.max(1, book.copies - 1);
        copiesInput.value = String(book.copies);
        updateCountsAndPreview();
      });

      const copiesInput = document.createElement('input');
      copiesInput.type = 'number';
      copiesInput.min = '1';
      copiesInput.max = '200';
      copiesInput.className = 'copies-input';
      copiesInput.value = String(book.copies);
      copiesInput.setAttribute('aria-label', 'Copies');
      copiesInput.addEventListener('input', (e) => {
        const parsed = parseInt(e.target.value, 10);
        if (!Number.isNaN(parsed) && parsed >= 1) {
          book.copies = Math.min(200, parsed);
          updateCountsAndPreview();
        }
      });
      copiesInput.addEventListener('blur', (e) => {
        const parsed = parseInt(e.target.value, 10);
        book.copies = Number.isNaN(parsed) || parsed < 1 ? 1 : Math.min(200, parsed);
        e.target.value = String(book.copies);
        updateCountsAndPreview();
      });

      const incBtn = document.createElement('button');
      incBtn.type = 'button';
      incBtn.className = 'stepper-btn';
      incBtn.textContent = '+';
      incBtn.setAttribute('aria-label', 'Increase copies');
      incBtn.addEventListener('click', () => {
        book.copies = Math.min(200, book.copies + 1);
        copiesInput.value = String(book.copies);
        updateCountsAndPreview();
      });

      stepper.appendChild(decBtn);
      stepper.appendChild(copiesInput);
      stepper.appendChild(incBtn);

      const copiesLabel = document.createElement('span');
      copiesLabel.className = 'copies-label';
      copiesLabel.textContent = 'Copies';

      copiesControl.appendChild(stepper);
      copiesControl.appendChild(copiesLabel);

      // Bleed Color picker
      const bleedControl = document.createElement('div');
      bleedControl.className = 'bleed-control';

      const colorLabel = document.createElement('label');
      colorLabel.className = 'color-picker-wrap';
      colorLabel.title = 'Bleed & spine background color (auto-detected from cover)';

      const colorInput = document.createElement('input');
      colorInput.type = 'color';
      colorInput.className = 'color-swatch-input';
      colorInput.value = book.dominantColor;
      colorInput.setAttribute('aria-label', 'Bleed background color');

      const hexSpan = document.createElement('span');
      hexSpan.className = 'bleed-hex';
      hexSpan.textContent = book.dominantColor.toUpperCase();

      colorInput.addEventListener('input', (e) => {
        book.dominantColor = e.target.value;
        book.textColor = TinyBooks.Color.getContrastingTextColor(book.dominantColor);
        book.colorOverridden = book.dominantColor.toLowerCase() !== book.autoColor.toLowerCase();
        hexSpan.textContent = book.dominantColor.toUpperCase();
        thumbWrap.style.borderColor = book.dominantColor;
        resetColorBtn.hidden = !book.colorOverridden;
        renderPreview();
      });

      colorLabel.appendChild(colorInput);
      colorLabel.appendChild(hexSpan);
      bleedControl.appendChild(colorLabel);

      const resetColorBtn = document.createElement('button');
      resetColorBtn.type = 'button';
      resetColorBtn.className = 'reset-color-btn';
      resetColorBtn.textContent = 'Auto';
      resetColorBtn.title = 'Reset to detected dominant cover color';
      resetColorBtn.hidden = !book.colorOverridden;
      resetColorBtn.addEventListener('click', () => {
        book.dominantColor = book.autoColor;
        book.textColor = TinyBooks.Color.getContrastingTextColor(book.autoColor);
        book.colorOverridden = false;
        colorInput.value = book.autoColor;
        hexSpan.textContent = book.autoColor.toUpperCase();
        thumbWrap.style.borderColor = book.autoColor;
        resetColorBtn.hidden = true;
        renderPreview();
      });
      bleedControl.appendChild(resetColorBtn);

      controlsRow.appendChild(copiesControl);
      controlsRow.appendChild(bleedControl);

      meta.appendChild(topRow);
      meta.appendChild(controlsRow);

      card.appendChild(thumbWrap);
      card.appendChild(meta);
      dom.bookList.appendChild(card);
    }
  }

  function updateCountsAndPreview() {
    const totalTitles = state.books.length;
    const totalCopies = state.books.reduce((sum, b) => sum + (Number(b.copies) || 0), 0);
    dom.bookCountBadge.textContent = `${totalTitles} title${totalTitles === 1 ? '' : 's'} · ${totalCopies} cop${totalCopies === 1 ? 'y' : 'ies'}`;
    renderPreview();
  }

  function renderPreview() {
    const Gen = TinyBooks.SvgGenerator;
    const metrics = Gen.computeLayoutMetrics(state.params);

    dom.unitDimSummary.textContent = `Unit: ${metrics.unitW.toFixed(1)} × ${metrics.unitH.toFixed(1)} mm (w/ bleed)`;

    if (!metrics.fitsPage) {
      dom.gridMetricsBadge.textContent = 'Exceeds page bounds';
      dom.layoutWarning.hidden = false;
      dom.layoutWarning.textContent = `Book unit (${metrics.unitW.toFixed(1)} × ${metrics.unitH.toFixed(1)} mm with 0.125" bleed) exceeds the 8.5" × 11" printable area (${metrics.availW.toFixed(1)} × ${metrics.availH.toFixed(1)} mm). Reduce cover or spine dimensions.`;
      dom.pageTabs.hidden = true;
      dom.downloadSvgBtn.disabled = true;
      dom.downloadAllBtn.hidden = true;
      dom.paperSheet.innerHTML = Gen.buildPageSvg([], metrics, state.params, { preview: true });
      return;
    }

    dom.layoutWarning.hidden = true;
    const pages = Gen.expandBooksToPages(state.books, metrics.perPage);
    const totalCopies = state.books.reduce((sum, b) => sum + (Number(b.copies) || 0), 0);

    dom.gridMetricsBadge.textContent =
      pages.length > 0
        ? `${metrics.cols} cols × ${metrics.rows} rows · ${totalCopies} book${totalCopies === 1 ? '' : 's'}`
        : `${metrics.cols} cols × ${metrics.rows} rows (${metrics.perPage}/sheet)`;

    if (pages.length === 0) {
      state.activePageIndex = 0;
      dom.pageTabs.hidden = true;
      dom.downloadSvgBtn.disabled = true;
      dom.downloadAllBtn.hidden = true;
      const emptySvg = Gen.buildPageSvg([], metrics, state.params, { preview: true });
      dom.paperSheet.innerHTML = `
        ${emptySvg}
        <div class="paper-empty-overlay">
          <span class="paper-empty-badge">8.5&Prime; &times; 11&Prime; US Letter</span>
          <p class="paper-empty-text">Add book covers on the left (or click Load Sample Books) to preview the print sheet.</p>
        </div>
      `;
      return;
    }

    if (state.activePageIndex >= pages.length) {
      state.activePageIndex = pages.length - 1;
    }

    // Pagination tabs
    if (pages.length > 1) {
      dom.pageTabs.hidden = false;
      dom.pageTabs.innerHTML = '';
      pages.forEach((_, idx) => {
        const tab = document.createElement('button');
        tab.type = 'button';
        tab.className = `page-tab${idx === state.activePageIndex ? ' is-active' : ''}`;
        tab.textContent = `Page ${idx + 1}`;
        tab.setAttribute('role', 'tab');
        tab.setAttribute('aria-selected', String(idx === state.activePageIndex));
        tab.addEventListener('click', () => {
          state.activePageIndex = idx;
          renderPreview();
        });
        dom.pageTabs.appendChild(tab);
      });
    } else {
      dom.pageTabs.hidden = true;
    }

    const activeUnits = pages[state.activePageIndex] || [];
    dom.paperSheet.innerHTML = Gen.buildPageSvg(activeUnits, metrics, state.params, { preview: true });

    dom.downloadSvgBtn.disabled = false;
    dom.downloadAllBtn.hidden = pages.length <= 1;
    if (pages.length > 1) {
      dom.downloadAllBtn.textContent = `Download All (${pages.length} SVGs)`;
    }
  }

  function renderAll() {
    renderBookList();
    renderPreview();
  }

  function triggerSvgDownload(svgString, filename) {
    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function bindEvents() {
    // Dropzone click & keyboard
    dom.dropzone.addEventListener('click', () => dom.fileInput.click());
    dom.dropzone.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        dom.fileInput.click();
      }
    });

    dom.fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files.length > 0) {
        handleIncomingFiles(e.target.files);
        e.target.value = '';
      }
    });

    // Drag & drop on dropzone and left panel
    ['dragenter', 'dragover'].forEach((evtName) => {
      dom.dropzone.addEventListener(evtName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dom.dropzone.classList.add('is-dragover');
      });
    });

    ['dragleave', 'drop'].forEach((evtName) => {
      dom.dropzone.addEventListener(evtName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dom.dropzone.classList.remove('is-dragover');
      });
    });

    dom.dropzone.addEventListener('drop', (e) => {
      if (e.dataTransfer && e.dataTransfer.files) {
        handleIncomingFiles(e.dataTransfer.files);
      }
    });

    // Prevent browser from navigating away if dropped outside dropzone
    window.addEventListener('dragover', (e) => e.preventDefault());
    window.addEventListener('drop', (e) => {
      e.preventDefault();
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleIncomingFiles(e.dataTransfer.files);
      }
    });

    // Copy / Paste anywhere
    window.addEventListener('paste', (e) => {
      const clipboard = e.clipboardData;
      if (!clipboard) return;

      const imageFiles = [];
      if (clipboard.items) {
        for (const item of clipboard.items) {
          if (item.kind === 'file' && item.type.startsWith('image/')) {
            const file = item.getAsFile();
            if (file) imageFiles.push(file);
          }
        }
      }
      if (imageFiles.length === 0 && clipboard.files) {
        for (const file of clipboard.files) {
          if (isLikelyImageFile(file)) imageFiles.push(file);
        }
      }

      if (imageFiles.length > 0) {
        e.preventDefault();
        handleIncomingFiles(imageFiles);
      }
    });

    // Dimension inputs
    const bindNumberParam = (inputEl, key, minVal, maxVal) => {
      inputEl.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        if (!Number.isNaN(val) && val >= minVal && val <= maxVal) {
          state.params[key] = val;
          renderPreview();
        }
      });
      inputEl.addEventListener('blur', (e) => {
        const val = parseFloat(e.target.value);
        if (Number.isNaN(val) || val < minVal) {
          state.params[key] = minVal;
          e.target.value = String(minVal);
        } else if (val > maxVal) {
          state.params[key] = maxVal;
          e.target.value = String(maxVal);
        }
        renderPreview();
      });
    };

    bindNumberParam(dom.coverWidthInput, 'coverWidthMm', 5, 120);
    bindNumberParam(dom.coverHeightInput, 'coverHeightMm', 5, 240);
    bindNumberParam(dom.spineWidthInput, 'spineWidthMm', 0.5, 40);

    // Layout options
    dom.imageFitSelect.addEventListener('change', (e) => {
      state.params.imageFit = e.target.value;
      renderPreview();
    });
    dom.cutLinesToggle.addEventListener('change', (e) => {
      state.params.includeCutLines = e.target.checked;
      renderPreview();
    });

    // Sample & Clear buttons
    dom.loadSamplesBtn.addEventListener('click', async () => {
      for (const spec of TinyBooks.SampleCovers.SAMPLE_SPECS) {
        const dataUrl = TinyBooks.SampleCovers.renderSampleCoverDataUrl(spec);
        await addBookFromDataUrl(dataUrl, spec.title, spec.copies, false);
      }
      renderAll();
      showToast('Loaded 3 sample books.');
    });

    dom.clearBooksBtn.addEventListener('click', () => {
      state.books = [];
      state.activePageIndex = 0;
      renderAll();
    });

    // Download SVG buttons
    dom.downloadSvgBtn.addEventListener('click', () => {
      const Gen = TinyBooks.SvgGenerator;
      const metrics = Gen.computeLayoutMetrics(state.params);
      const pages = Gen.expandBooksToPages(state.books, metrics.perPage);
      if (pages.length === 0) return;

      const idx = Math.min(state.activePageIndex, pages.length - 1);
      const svgString = Gen.buildPageSvg(pages[idx], metrics, state.params, { preview: false });
      const filename =
        pages.length === 1 ? 'tiny-books.svg' : `tiny-books-page-${idx + 1}.svg`;
      triggerSvgDownload(svgString, filename);
    });

    dom.downloadAllBtn.addEventListener('click', () => {
      const Gen = TinyBooks.SvgGenerator;
      const metrics = Gen.computeLayoutMetrics(state.params);
      const pages = Gen.expandBooksToPages(state.books, metrics.perPage);
      pages.forEach((units, idx) => {
        setTimeout(() => {
          const svgString = Gen.buildPageSvg(units, metrics, state.params, { preview: false });
          triggerSvgDownload(svgString, `tiny-books-page-${idx + 1}.svg`);
        }, idx * 180);
      });
    });
  }

  function init() {
    cacheDom();
    bindEvents();
    renderAll();
  }

  document.addEventListener('DOMContentLoaded', init);
})(window);

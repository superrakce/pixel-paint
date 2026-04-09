const PAGE_MODE = document.body?.dataset?.page || 'all';
const SELECTED_ARTWORK_STORAGE_KEY = 'pixel-paint-selected-artwork';
const MIN_DRAW_ZOOM = 2;
const MAX_DRAW_ZOOM = 64;

function on(el, eventName, handler, options) {
  if (el) el.addEventListener(eventName, handler, options);
}

const state = {
      sourceImage: null,
      processedSourceImage: null,
      sourceName: '',
      backgroundStats: null,
      generated: null,
      gallery: [],
      currentArtwork: null,
      completionCelebrated: false,
      paintedCells: [],
      selectedPaletteIndex: null,
      dragFillLocked: false,
      bucketFillEnabled: false,
      drawTopbarCollapsed: null,
      zoom: 24,
      isPainting: false,
      activePointers: new Map(),
      pinchStartDistance: null,
      pinchStartZoom: null,
      pinchStartCenter: null,
      pinchStartScrollLeft: 0,
      pinchStartScrollTop: 0,
      touchPanPointerId: null,
      touchPanStartX: 0,
      touchPanStartY: 0,
      touchPanStartScrollLeft: 0,
      touchPanStartScrollTop: 0,
      touchPanMoved: false
    };

    const els = {
      navOffline: document.getElementById('navOffline'),
      navOnline: document.getElementById('navOnline'),
      offlineView: document.getElementById('offlineView'),
      onlineView: document.getElementById('onlineView'),
      galleryView: document.getElementById('galleryView'),
      playView: document.getElementById('playView'),
      drawEmpty: document.getElementById('drawEmpty'),
      imageName: document.getElementById('imageName'),
      imageFile: document.getElementById('imageFile'),
      gridWidth: document.getElementById('gridWidth'),
      paletteCount: document.getElementById('paletteCount'),
      exportCellSize: document.getElementById('exportCellSize'),
      removeBackgroundToggle: document.getElementById('removeBackgroundToggle'),
      backgroundTolerance: document.getElementById('backgroundTolerance'),
      backgroundInfo: document.getElementById('backgroundInfo'),
      generateBtn: document.getElementById('generateBtn'),
      loadDemoBtn: document.getElementById('loadDemoBtn'),
      exportJsonBtn: document.getElementById('exportJsonBtn'),
      exportPixelBtn: document.getElementById('exportPixelBtn'),
      exportOutlineBtn: document.getElementById('exportOutlineBtn'),
      offlineStatus: document.getElementById('offlineStatus'),
      palettePreviewBox: document.getElementById('palettePreviewBox'),
      sourceCanvas: document.getElementById('sourceCanvas'),
      pixelCanvas: document.getElementById('pixelCanvas'),
      outlineCanvas: document.getElementById('outlineCanvas'),
      repoOwner: document.getElementById('repoOwner'),
      repoName: document.getElementById('repoName'),
      repoBranch: document.getElementById('repoBranch'),
      repoPath: document.getElementById('repoPath'),
      saveRepoBtn: document.getElementById('saveRepoBtn'),
      loadGalleryBtn: document.getElementById('loadGalleryBtn'),
      galleryGrid: document.getElementById('galleryGrid'),
      galleryStatus: document.getElementById('galleryStatus'),
      playTitle: document.getElementById('playTitle'),
      playSubtitle: document.getElementById('playSubtitle'),
      playTopbar: document.querySelector('.play-topbar'),
      playTopbarToggle: document.getElementById('playTopbarToggle'),
      clearPaintBtn: document.getElementById('clearPaintBtn'),
      backToGalleryBtn: document.getElementById('backToGalleryBtn'),
      exportPaintBtn: document.getElementById('exportPaintBtn'),
      playCanvas: document.getElementById('playCanvas'),
      playStage: document.getElementById('playStage'),
      stageInner: document.querySelector('.stage-inner'),
      paletteBar: document.getElementById('paletteBar'),
      pixelThumbCanvas: document.getElementById('pixelThumbCanvas'),
      progressThumbCanvas: document.getElementById('progressThumbCanvas'),
      celebrationLayer: document.getElementById('celebrationLayer'),
      dragFillLockToggle: document.getElementById('dragFillLockToggle'),
      dragFillLockCheck: document.getElementById('dragFillLockCheck'),
      selectedColorText: document.getElementById('selectedColorText'),
      zoomInBtn: document.getElementById('zoomInBtn'),
      zoomOutBtn: document.getElementById('zoomOutBtn')
    };

    function showView(target) {
      const isOffline = target === 'offline';
      if (els.offlineView) els.offlineView.classList.toggle('hidden', !isOffline);
      if (els.onlineView) els.onlineView.classList.toggle('hidden', isOffline);
      if (els.navOffline) els.navOffline.classList.toggle('active', isOffline);
      if (els.navOnline) els.navOnline.classList.toggle('active', !isOffline);
    }

    function showGallery() {
      if (els.galleryView) els.galleryView.classList.remove('hidden');
      if (els.playView) els.playView.classList.add('hidden');
      if (els.drawEmpty) els.drawEmpty.classList.add('hidden');
    }

    function showPlay() {
      if (els.galleryView) els.galleryView.classList.add('hidden');
      if (els.playView) els.playView.classList.remove('hidden');
      if (els.drawEmpty) els.drawEmpty.classList.add('hidden');
    }

    function syncDrawTopbarState() {
      if (PAGE_MODE !== 'draw' || !els.playTopbarToggle) return;
      const compact = window.matchMedia('(max-width: 980px)').matches;
      if (!compact) {
        state.drawTopbarCollapsed = false;
      } else if (state.drawTopbarCollapsed == null) {
        state.drawTopbarCollapsed = true;
      }
      const collapsed = Boolean(state.drawTopbarCollapsed);
      document.body.classList.toggle('draw-topbar-collapsed', collapsed);
      els.playTopbarToggle.textContent = collapsed ? '打開' : '收合';
      els.playTopbarToggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
      requestAnimationFrame(updateDrawTopbarOffset);
    }

    function toggleDrawTopbar() {
      if (PAGE_MODE !== 'draw' || !els.playTopbarToggle) return;
      const compact = window.matchMedia('(max-width: 980px)').matches;
      if (!compact) return;
      state.drawTopbarCollapsed = !document.body.classList.contains('draw-topbar-collapsed');
      const collapsed = state.drawTopbarCollapsed;
      document.body.classList.toggle('draw-topbar-collapsed', collapsed);
      els.playTopbarToggle.textContent = collapsed ? '打開' : '收合';
      els.playTopbarToggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
      requestAnimationFrame(updateDrawTopbarOffset);
    }

    function updateDrawTopbarOffset() {
      if (PAGE_MODE !== 'draw' || !els.playTopbar) return;
      const topbarHeight = Math.ceil(els.playTopbar.getBoundingClientRect().height);
      if (!topbarHeight) return;
      document.body.style.setProperty('--draw-topbar-offset', `${topbarHeight}px`);
    }

    function showDrawEmpty(message) {
      if (els.galleryView) els.galleryView.classList.add('hidden');
      if (els.playView) els.playView.classList.add('hidden');
      if (els.drawEmpty) els.drawEmpty.classList.remove('hidden');
      if (message && els.drawEmpty) {
        const desc = els.drawEmpty.querySelector('.section-desc');
        if (desc) desc.textContent = message;
      }
    }

    function clamp(value, min, max) {
      return Math.max(min, Math.min(max, value));
    }

    function sanitizeFileName(name) {
      return (name || 'untitled').trim().replace(/[\\/:*?"<>|]/g, '-');
    }

    function isValidArtwork(artwork) {
      return Boolean(
        artwork &&
        Number.isInteger(artwork.width) &&
        Number.isInteger(artwork.height) &&
        Array.isArray(artwork.palette) &&
        Array.isArray(artwork.cells) &&
        artwork.cells.length === artwork.width * artwork.height
      );
    }

    function cloneArtworkForStorage(artwork) {
      return {
        version: artwork.version ?? 1,
        name: artwork.name || artwork.__fileName || 'untitled',
        width: artwork.width,
        height: artwork.height,
        exportCellSize: artwork.exportCellSize || 18,
        palette: artwork.palette,
        cells: artwork.cells,
        meta: artwork.meta || {},
        __fileName: artwork.__fileName,
        __downloadUrl: artwork.__downloadUrl
      };
    }

    function persistSelectedArtwork(artwork) {
      try {
        sessionStorage.setItem(
          SELECTED_ARTWORK_STORAGE_KEY,
          JSON.stringify(cloneArtworkForStorage(artwork))
        );
      } catch (error) {
        console.error('儲存選取圖片失敗', error);
      }
    }

    function readSelectedArtwork() {
      try {
        const raw = sessionStorage.getItem(SELECTED_ARTWORK_STORAGE_KEY);
        if (!raw) return null;
        const artwork = JSON.parse(raw);
        return isValidArtwork(artwork) ? artwork : null;
      } catch (error) {
        console.error('讀取選取圖片失敗', error);
        return null;
      }
    }

    function hexFromRgb(rgb) {
      return '#' + rgb.map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase();
    }

    function rgbFromHex(hex) {
      const raw = hex.replace('#', '');
      return [
        parseInt(raw.slice(0, 2), 16),
        parseInt(raw.slice(2, 4), 16),
        parseInt(raw.slice(4, 6), 16)
      ];
    }

    function distanceSq(a, b) {
      return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
    }

    function drawFittedImage(canvas, image) {
      const maxW = 320;
      const scale = Math.min(1, maxW / image.width);
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    }

    function hasTransparentCells(artwork) {
      return Boolean(
        artwork?.meta?.hasTransparency ||
        artwork?.cells?.some(cell => cell == null || cell < 0)
      );
    }

    function getRemoveBackgroundSettings() {
      return {
        enabled: Boolean(els.removeBackgroundToggle?.checked),
        tolerance: clamp(parseInt(els.backgroundTolerance?.value, 10) || 28, 0, 120)
      };
    }

    function syncBackgroundControls() {
      if (els.backgroundTolerance) {
        els.backgroundTolerance.disabled = !els.removeBackgroundToggle?.checked;
      }
    }

    function updateBackgroundInfo() {
      if (!els.backgroundInfo) return;
      const settings = getRemoveBackgroundSettings();
      if (!state.sourceImage) {
        els.backgroundInfo.textContent = settings.enabled
          ? '匯入圖片後，會先在原圖預覽中顯示去背結果。'
          : '未啟用去背，會保留原圖背景。';
        return;
      }

      if (!settings.enabled) {
        els.backgroundInfo.textContent = '未啟用去背，會保留原圖背景。';
        return;
      }

      const stats = state.backgroundStats;
      if (!stats) {
        els.backgroundInfo.textContent = `已啟用去背，容差 ${settings.tolerance}。`;
        return;
      }

      const percent = stats.totalPixels
        ? ((stats.removedPixels / stats.totalPixels) * 100).toFixed(1)
        : '0.0';
      els.backgroundInfo.textContent = `已移除 ${stats.removedPixels} 個背景像素（${percent}%），容差 ${stats.tolerance}。`;
    }

    function sampleCornerColors(data, width, height) {
      const radius = clamp(Math.floor(Math.min(width, height) * 0.04), 1, 6);
      const corners = [
        [0, 0],
        [width - 1, 0],
        [0, height - 1],
        [width - 1, height - 1]
      ];

      return corners.map(([cornerX, cornerY]) => {
        let sumR = 0;
        let sumG = 0;
        let sumB = 0;
        let count = 0;

        for (let y = Math.max(0, cornerY - radius); y <= Math.min(height - 1, cornerY + radius); y++) {
          for (let x = Math.max(0, cornerX - radius); x <= Math.min(width - 1, cornerX + radius); x++) {
            const offset = (y * width + x) * 4;
            if (data[offset + 3] <= 10) continue;
            sumR += data[offset];
            sumG += data[offset + 1];
            sumB += data[offset + 2];
            count += 1;
          }
        }

        if (!count) return [255, 255, 255];

        return [
          Math.round(sumR / count),
          Math.round(sumG / count),
          Math.round(sumB / count)
        ];
      });
    }

    function matchesBackgroundAtOffset(data, offset, referenceColors, toleranceSq) {
      if (data[offset + 3] <= 10) return true;
      const pixel = [data[offset], data[offset + 1], data[offset + 2]];
      return referenceColors.some(color => distanceSq(pixel, color) <= toleranceSq);
    }

    function removeBackgroundFromImage(image, tolerance) {
      const safeTolerance = clamp(parseInt(tolerance, 10) || 28, 0, 120);
      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const { data } = imageData;
      const width = canvas.width;
      const height = canvas.height;
      const totalPixels = width * height;
      const visited = new Uint8Array(totalPixels);
      const queue = new Int32Array(totalPixels);
      const toleranceSq = safeTolerance ** 2;
      const referenceColors = sampleCornerColors(data, width, height);
      let head = 0;
      let tail = 0;
      let removedPixels = 0;

      function enqueue(x, y) {
        if (x < 0 || y < 0 || x >= width || y >= height) return;
        const index = y * width + x;
        if (visited[index]) return;
        visited[index] = 1;
        const offset = index * 4;
        if (!matchesBackgroundAtOffset(data, offset, referenceColors, toleranceSq)) return;
        queue[tail++] = index;
      }

      for (let x = 0; x < width; x++) {
        enqueue(x, 0);
        enqueue(x, height - 1);
      }
      for (let y = 1; y < height - 1; y++) {
        enqueue(0, y);
        enqueue(width - 1, y);
      }

      while (head < tail) {
        const index = queue[head++];
        const offset = index * 4;
        if (data[offset + 3] !== 0) {
          removedPixels += 1;
          data[offset + 3] = 0;
        }

        const x = index % width;
        const y = (index - x) / width;
        enqueue(x - 1, y);
        enqueue(x + 1, y);
        enqueue(x, y - 1);
        enqueue(x, y + 1);
      }

      ctx.putImageData(imageData, 0, 0);

      return {
        enabled: true,
        tolerance: safeTolerance,
        removedPixels,
        totalPixels,
        canvas
      };
    }

    function refreshSourcePreview(options = {}) {
      const { regenerate = false } = options;
      syncBackgroundControls();

      if (!state.sourceImage) {
        state.processedSourceImage = null;
        state.backgroundStats = null;
        updateBackgroundInfo();
        return;
      }

      const settings = getRemoveBackgroundSettings();
      if (settings.enabled) {
        state.backgroundStats = removeBackgroundFromImage(state.sourceImage, settings.tolerance);
        state.processedSourceImage = state.backgroundStats.canvas;
      } else {
        state.backgroundStats = {
          enabled: false,
          tolerance: settings.tolerance,
          removedPixels: 0,
          totalPixels: state.sourceImage.width * state.sourceImage.height
        };
        state.processedSourceImage = state.sourceImage;
      }

      if (els.sourceCanvas) drawFittedImage(els.sourceCanvas, state.processedSourceImage);
      updateBackgroundInfo();

      if (regenerate && state.generated) {
        void generateArtworkFromCurrentImage();
      }
    }

    function createImageFromFile(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = reject;
          img.src = reader.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    }

    function downsampleImage(image, targetWidth) {
      const width = clamp(parseInt(targetWidth, 10) || 32, 8, 128);
      const ratio = image.height / image.width;
      const height = Math.max(1, Math.round(width * ratio));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(image, 0, 0, width, height);
      const imageData = ctx.getImageData(0, 0, width, height).data;
      const pixels = [];
      for (let i = 0; i < imageData.length; i += 4) {
        const alpha = imageData[i + 3] / 255;
        if (alpha < 0.08) {
          pixels.push(null);
          continue;
        }
        pixels.push([imageData[i], imageData[i + 1], imageData[i + 2]]);
      }
      return { width, height, pixels };
    }

    function kMeansQuantize(pixels, k) {
      const safeK = clamp(parseInt(k, 10) || 8, 5, 12);
      const opaquePixels = [];
      const opaqueIndexes = [];

      pixels.forEach((pixel, index) => {
        if (!pixel) return;
        opaquePixels.push(pixel);
        opaqueIndexes.push(index);
      });

      if (!opaquePixels.length) {
        return {
          palette: [],
          cells: new Array(pixels.length).fill(-1),
          transparentCount: pixels.length
        };
      }

      const unique = [...new Map(opaquePixels.map(pixel => [pixel.join(','), pixel])).values()];
      const centroids = [];
      for (let i = 0; i < safeK; i++) {
        centroids.push(unique[Math.floor((i * unique.length) / safeK)] || unique[0] || [255, 255, 255]);
      }

      let assignments = new Array(opaquePixels.length).fill(0);
      for (let round = 0; round < 10; round++) {
        let moved = false;

        for (let i = 0; i < opaquePixels.length; i++) {
          const pixel = opaquePixels[i];
          let bestIndex = 0;
          let bestDistance = Infinity;
          for (let c = 0; c < centroids.length; c++) {
            const dist = distanceSq(pixel, centroids[c]);
            if (dist < bestDistance) {
              bestDistance = dist;
              bestIndex = c;
            }
          }
          if (assignments[i] !== bestIndex) moved = true;
          assignments[i] = bestIndex;
        }

        const sums = Array.from({ length: centroids.length }, () => [0, 0, 0, 0]);
        for (let i = 0; i < opaquePixels.length; i++) {
          const idx = assignments[i];
          const bucket = sums[idx];
          bucket[0] += opaquePixels[i][0];
          bucket[1] += opaquePixels[i][1];
          bucket[2] += opaquePixels[i][2];
          bucket[3] += 1;
        }

        for (let c = 0; c < centroids.length; c++) {
          const bucket = sums[c];
          if (bucket[3] > 0) {
            centroids[c] = [
              Math.round(bucket[0] / bucket[3]),
              Math.round(bucket[1] / bucket[3]),
              Math.round(bucket[2] / bucket[3])
            ];
          }
        }

        if (!moved) break;
      }

      const counts = centroids.map(() => 0);
      assignments.forEach(i => counts[i]++);

      const order = centroids
        .map((rgb, oldIndex) => ({ rgb, oldIndex, count: counts[oldIndex] }))
        .filter(item => item.count > 0)
        .sort((a, b) => b.count - a.count);

      const remap = new Map(order.map((item, newIndex) => [item.oldIndex, newIndex]));
      const palette = order.map((item, idx) => ({
        id: idx + 1,
        hex: hexFromRgb(item.rgb),
        rgb: item.rgb,
        count: item.count
      }));
      const cells = new Array(pixels.length).fill(-1);
      assignments.forEach((index, opaqueIndex) => {
        cells[opaqueIndexes[opaqueIndex]] = remap.get(index);
      });

      return {
        palette,
        cells,
        transparentCount: pixels.length - opaquePixels.length
      };
    }

    function buildGeneratedArtwork(name, image, options = {}) {
      const baseName = sanitizeFileName(name || image.dataset?.defaultName || 'untitled');
      const width = clamp(parseInt(els.gridWidth.value, 10) || 32, 8, 128);
      const paletteCount = clamp(parseInt(els.paletteCount.value, 10) || 8, 5, 12);
      const exportCellSize = clamp(parseInt(els.exportCellSize.value, 10) || 18, 8, 40);
      const downsampled = downsampleImage(image, width);
      const quantized = kMeansQuantize(downsampled.pixels, paletteCount);
      const transparentCells = quantized.transparentCount || 0;
      const hasTransparency = transparentCells > 0;

      if (!quantized.palette.length) {
        throw new Error('去背後沒有保留任何像素，請降低去背容差或關閉去背。');
      }

      return {
        version: 1,
        name: baseName,
        width: downsampled.width,
        height: downsampled.height,
        exportCellSize,
        palette: quantized.palette,
        cells: quantized.cells,
        meta: {
          createdAt: new Date().toISOString(),
          sourceWidth: image.width,
          sourceHeight: image.height,
          transparentCells,
          hasTransparency,
          backgroundRemoved: Boolean(options.background?.enabled && hasTransparency),
          backgroundTolerance: options.background?.enabled ? options.background.tolerance : null
        }
      };
    }

    function renderPixelArt(canvas, artwork, options = {}) {
      const showNumbers = options.showNumbers ?? false;
      const showGrid = options.showGrid ?? true;
      const showColors = options.showColors ?? true;
      const cellSize = options.cellSize ?? artwork.exportCellSize ?? 18;
      const paintedCells = options.paintedCells ?? null;
      const numberAlpha = options.numberAlpha ?? 1;
      const whiteBackground = options.whiteBackground ?? !hasTransparentCells(artwork);
      const showTransparentGrid = options.showTransparentGrid ?? false;

      canvas.width = artwork.width * cellSize;
      canvas.height = artwork.height * cellSize;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.imageSmoothingEnabled = false;

      if (whiteBackground) {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      for (let y = 0; y < artwork.height; y++) {
        for (let x = 0; x < artwork.width; x++) {
          const idx = y * artwork.width + x;
          const paletteIndex = artwork.cells[idx];
          const transparentCell = paletteIndex == null || paletteIndex < 0;
          if (transparentCell) {
            if (showTransparentGrid) {
              ctx.strokeStyle = '#D7DEE8';
              ctx.lineWidth = Math.max(1, Math.floor(cellSize / 18));
              ctx.strokeRect(x * cellSize, y * cellSize, cellSize, cellSize);
            }
            continue;
          }

          const paletteItem = artwork.palette[paletteIndex];
          if (!paletteItem) continue;

          const fillColor = paintedCells
            ? (paintedCells[idx] != null && artwork.palette[paintedCells[idx]]
              ? artwork.palette[paintedCells[idx]].hex
              : '#FFFFFF')
            : (showColors ? paletteItem.hex : '#FFFFFF');

          ctx.fillStyle = fillColor;
          ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);

          if (showGrid) {
            const hideGrid = paintedCells && paintedCells[idx] != null;
            if (hideGrid) continue;
            ctx.strokeStyle = '#D7DEE8';
            ctx.lineWidth = Math.max(1, Math.floor(cellSize / 18));
            ctx.strokeRect(x * cellSize, y * cellSize, cellSize, cellSize);
          }

          if (showNumbers) {
            const hideNumber = paintedCells && paintedCells[idx] != null;
            if (hideNumber) continue;
            ctx.save();
            ctx.globalAlpha = numberAlpha;
            ctx.fillStyle = '#243042';
            ctx.font = `${Math.max(10, Math.floor(cellSize * 0.42))}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(String(paletteItem.id), x * cellSize + cellSize / 2, y * cellSize + cellSize / 2 + 0.5);
            ctx.restore();
          }
        }
      }
    }

    function updateOfflinePreviews() {
      if (!state.generated) return;
      renderPixelArt(els.pixelCanvas, state.generated, {
        showColors: true,
        showGrid: false,
        showNumbers: false,
        cellSize: state.generated.exportCellSize
      });
      renderPixelArt(els.outlineCanvas, state.generated, {
        showColors: false,
        showGrid: true,
        showNumbers: true,
        cellSize: state.generated.exportCellSize,
        numberAlpha: 0.9
      });
      renderPaletteSummary(state.generated);
    }

    function renderPaletteSummary(artwork) {
      if (!els.palettePreviewBox) return;
      const paletteHtml = artwork.palette.map(item => `
        <span class="pill" style="margin: 0 8px 8px 0; display:inline-flex;">
          <span style="width:18px; height:18px; border-radius:999px; background:${item.hex}; border:1px solid rgba(0,0,0,.08);"></span>
          <strong>${item.id}</strong>
          <span class="muted">${item.hex}</span>
        </span>
      `).join('');
      const transparentCells = artwork.meta?.transparentCells || 0;
      const transparentHtml = transparentCells
        ? `<span class="pill" style="margin: 0 8px 8px 0; display:inline-flex;"><strong>透明</strong><span class="muted">${transparentCells} 格</span></span>`
        : '';
      els.palettePreviewBox.innerHTML = paletteHtml + transparentHtml;
    }

    function setGeneratedReady(ready) {
      if (els.exportJsonBtn) els.exportJsonBtn.disabled = !ready;
      if (els.exportPixelBtn) els.exportPixelBtn.disabled = !ready;
      if (els.exportOutlineBtn) els.exportOutlineBtn.disabled = !ready;
    }

    function downloadBlob(blob, fileName) {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = fileName;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }

    function downloadCanvas(canvas, fileName) {
      canvas.toBlob(blob => downloadBlob(blob, fileName));
    }

    async function generateArtworkFromCurrentImage() {
      if (!state.sourceImage) {
        if (els.offlineStatus) els.offlineStatus.textContent = '請先匯入圖片。';
        return;
      }
      try {
        const name = els.imageName.value.trim() || state.sourceName || 'untitled';
        const workingImage = state.processedSourceImage || state.sourceImage;
        state.generated = buildGeneratedArtwork(name, workingImage, {
          background: state.backgroundStats
        });
        updateOfflinePreviews();
        setGeneratedReady(true);
        const transparentCells = state.generated.meta?.transparentCells || 0;
        const transparentText = transparentCells ? `，透明 ${transparentCells} 格` : '';
        els.offlineStatus.textContent = `已完成：${state.generated.name}，尺寸 ${state.generated.width} × ${state.generated.height}，共 ${state.generated.palette.length} 色${transparentText}。`;
      } catch (error) {
        state.generated = null;
        setGeneratedReady(false);
        if (els.offlineStatus) {
          els.offlineStatus.textContent = error.message || '圖片解析失敗。';
        }
      }
    }

    async function loadDemoImage() {
      const demoCanvas = document.createElement('canvas');
      demoCanvas.width = 128;
      demoCanvas.height = 128;
      const ctx = demoCanvas.getContext('2d');
      ctx.fillStyle = '#FFF6E9';
      ctx.fillRect(0, 0, 128, 128);
      ctx.fillStyle = '#F6B73C';
      ctx.fillRect(24, 24, 80, 80);
      ctx.fillStyle = '#D97A00';
      ctx.fillRect(40, 40, 16, 16);
      ctx.fillRect(72, 40, 16, 16);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(40, 72, 48, 12);
      ctx.fillStyle = '#F25F5C';
      ctx.fillRect(48, 88, 32, 10);
      const img = new Image();
      img.onload = async () => {
        state.sourceImage = img;
        state.sourceName = 'demo-smile';
        if (els.imageName) els.imageName.value = 'demo-smile';
        refreshSourcePreview();
        await generateArtworkFromCurrentImage();
      };
      img.src = demoCanvas.toDataURL('image/png');
    }

    function saveRepoConfig() {
      const config = {
        owner: els.repoOwner?.value?.trim() || '',
        repo: els.repoName?.value?.trim() || '',
        branch: els.repoBranch?.value?.trim() || 'main',
        path: els.repoPath?.value?.trim() || 'data/json'
      };
      localStorage.setItem('pixel-paint-repo-config', JSON.stringify(config));
      if (els.galleryStatus) els.galleryStatus.textContent = 'GitHub 設定已儲存。';
      return config;
    }

    function inferGitHubPagesConfig() {
      const host = window.location.hostname;
      const parts = window.location.pathname.split('/').filter(Boolean);
      if (host.endsWith('.github.io')) {
        const owner = host.replace('.github.io', '');
        const repo = parts[0] || '';
        return { owner, repo, branch: 'main', path: 'data/json' };
      }
      return { owner: '', repo: '', branch: 'main', path: 'data/json' };
    }

    function loadRepoConfigToForm() {
      if (!els.repoOwner || !els.repoName || !els.repoBranch || !els.repoPath) return;
      const stored = JSON.parse(localStorage.getItem('pixel-paint-repo-config') || 'null');
      const inferred = inferGitHubPagesConfig();
      const config = stored || inferred;
      els.repoOwner.value = config.owner || '';
      els.repoName.value = config.repo || '';
      els.repoBranch.value = config.branch || 'main';
      els.repoPath.value = config.path || 'data/json';
    }

    async function fetchJsonListFromGitHub(config) {
      const apiUrl = `https://api.github.com/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}/contents/${config.path}?ref=${encodeURIComponent(config.branch)}`;
      const res = await fetch(apiUrl);
      if (!res.ok) {
        throw new Error(`GitHub 讀取失敗：${res.status}`);
      }
      const items = await res.json();
      return items.filter(item => item.type === 'file' && item.name.toLowerCase().endsWith('.json'));
    }

    async function fetchJsonListFromManifest() {
      const res = await fetch('./data/manifest.json');
      if (!res.ok) {
        throw new Error('找不到本地 manifest.json。');
      }
      const manifest = await res.json();
      return (manifest.files || []).map(path => ({
        name: path.split('/').pop(),
        download_url: path,
        type: 'file'
      }));
    }

    async function loadGallery() {
      if (!els.galleryGrid || !els.galleryStatus) return;
      els.galleryGrid.innerHTML = '';
      els.galleryStatus.textContent = '讀取中…';
      try {
        const config = saveRepoConfig();
        let files = [];
        let sourceText = '';

        if (config.owner && config.repo) {
          files = await fetchJsonListFromGitHub(config);
          sourceText = 'GitHub';
        } else {
          files = await fetchJsonListFromManifest();
          sourceText = '本地 manifest';
        }

        if (!files.length) {
          els.galleryStatus.textContent = '目前找不到任何 JSON 圖片設定檔。';
          els.galleryGrid.innerHTML = '<div class="empty">請把 JSON 上傳到指定資料夾後再重新載入。</div>';
          return;
        }

        const artworks = [];
        for (const file of files) {
          try {
            const res = await fetch(file.download_url);
            const json = await res.json();
            json.__fileName = file.name;
            json.__downloadUrl = file.download_url;
            artworks.push(json);
          } catch (err) {
            console.error('讀取 JSON 失敗', file.name, err);
          }
        }
        state.gallery = artworks;
        renderGallery();
        els.galleryStatus.textContent = `已載入 ${artworks.length} 張圖片（來源：${sourceText}）。`;
      } catch (error) {
        els.galleryStatus.textContent = error.message;
        els.galleryGrid.innerHTML = `<div class="empty">${error.message}</div>`;
      }
    }

    function renderGallery() {
      if (!els.galleryGrid) return;
      if (!state.gallery.length) {
        els.galleryGrid.innerHTML = '<div class="empty">目前沒有圖片可顯示。</div>';
        return;
      }
      els.galleryGrid.innerHTML = '';
      state.gallery.forEach(artwork => {
        const card = document.createElement('div');
        card.className = 'card';
        const previewCanvas = document.createElement('canvas');
        const cellSize = Math.max(6, Math.floor(160 / Math.max(artwork.width, artwork.height)));
        renderPixelArt(previewCanvas, artwork, {
          showColors: true,
          showGrid: false,
          showNumbers: false,
          cellSize
        });
        const title = document.createElement('div');
        title.className = 'card-title';
        title.textContent = artwork.name || artwork.__fileName || '未命名圖片';
        const sub = document.createElement('div');
        sub.className = 'card-sub';
        sub.textContent = `${artwork.width} × ${artwork.height} ｜ ${artwork.palette.length} 色`;
        card.appendChild(previewCanvas);
        card.appendChild(title);
        card.appendChild(sub);
        card.addEventListener('click', () => startPainting(artwork));
        els.galleryGrid.appendChild(card);
      });
    }

    function progressKey(artwork) {
      return `pixel-paint-progress:${artwork.name}`;
    }

    function buildDrawPageUrl(artwork) {
      const url = new URL('./draw.html', window.location.href);
      if (artwork.__downloadUrl) {
        url.searchParams.set('src', artwork.__downloadUrl);
      }
      return url.toString();
    }

    function openArtworkInDrawPage(artwork) {
      persistSelectedArtwork(artwork);
      window.location.href = buildDrawPageUrl(artwork);
    }

    function startPainting(artwork) {
      if (PAGE_MODE === 'paint') {
        openArtworkInDrawPage(artwork);
        return;
      }

      state.currentArtwork = artwork;
      state.zoom = clamp(artwork.exportCellSize || 18, MIN_DRAW_ZOOM, MAX_DRAW_ZOOM);
      state.selectedPaletteIndex = 0;
      state.dragFillLocked = false;
      state.bucketFillEnabled = false;

      const stored = localStorage.getItem(progressKey(artwork));
      state.paintedCells = stored
        ? JSON.parse(stored)
        : new Array(artwork.cells.length).fill(null);
      state.completionCelebrated = getIncompletePaletteIndexes(artwork).length === 0;

      if (els.playTitle) els.playTitle.textContent = artwork.name || '未命名圖片';
      if (els.playSubtitle) els.playSubtitle.textContent = `請先從下方選擇色塊，再點擊底圖上的對應編號。只有相同編號的區塊會被填色。`;
      renderPaletteBar(artwork);
      syncDragFillLockToggle();
      updateSelectedColorText();
      showPlay();
      requestAnimationFrame(() => {
        updateDrawTopbarOffset();
        fitArtworkToViewport();
      });
    }

    async function resolveArtworkForDrawPage() {
      const params = new URLSearchParams(window.location.search);
      const src = params.get('src');

      if (src) {
        try {
          const res = await fetch(src);
          if (!res.ok) {
            throw new Error(`圖片資料讀取失敗：${res.status}`);
          }
          const artwork = await res.json();
          artwork.__downloadUrl = src;
          if (!artwork.__fileName) {
            artwork.__fileName = src.split('/').pop()?.split('?')[0] || '';
          }
          if (isValidArtwork(artwork)) {
            persistSelectedArtwork(artwork);
            return artwork;
          }
        } catch (error) {
          console.error('draw 頁面載入指定圖片失敗', error);
        }
      }

      return readSelectedArtwork();
    }

    function isPaletteIndexComplete(artwork, paletteIndex) {
      if (!artwork || paletteIndex == null) return false;
      let hasAnyCell = false;
      for (let i = 0; i < artwork.cells.length; i++) {
        if (artwork.cells[i] !== paletteIndex) continue;
        hasAnyCell = true;
        if (state.paintedCells[i] !== paletteIndex) {
          return false;
        }
      }
      return hasAnyCell;
    }

    function getIncompletePaletteIndexes(artwork) {
      if (!artwork) return [];
      return artwork.palette
        .map((_, index) => index)
        .filter(index => !isPaletteIndexComplete(artwork, index));
    }

    function syncSelectedPaletteIndex(artwork) {
      const incompleteIndexes = getIncompletePaletteIndexes(artwork);
      if (!incompleteIndexes.length) {
        state.selectedPaletteIndex = null;
        return incompleteIndexes;
      }

      if (!incompleteIndexes.includes(state.selectedPaletteIndex)) {
        state.selectedPaletteIndex = incompleteIndexes[0];
      }

      return incompleteIndexes;
    }

    function renderPaletteBar(artwork) {
      if (!els.paletteBar) return;
      els.paletteBar.innerHTML = '';
      const incompleteIndexes = syncSelectedPaletteIndex(artwork);

      const bucketToggle = document.createElement('button');
      bucketToggle.type = 'button';
      bucketToggle.className = 'palette-tool' + (state.bucketFillEnabled ? ' active' : '');
      bucketToggle.setAttribute('aria-pressed', state.bucketFillEnabled ? 'true' : 'false');
      bucketToggle.setAttribute('title', '油漆桶連續填色');
      bucketToggle.innerHTML = `
        <span class="palette-tool-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" focusable="false">
            <path d="M14.6 3.8 20.2 9.4 9.4 20.2 3.8 14.6 14.6 3.8Zm0 2.8-8 8 2.8 2.8 8-8-2.8-2.8ZM19.8 14.5c.9 1 1.5 2 1.5 3 0 1.9-1.6 3.5-3.5 3.5s-3.5-1.6-3.5-3.5c0-1 .6-2 1.5-3l.7-.8.7.8c.3.4.6.8.9 1.2.3-.4.6-.8.9-1.2l.8-.8Z"></path>
          </svg>
        </span>
        <span class="palette-tool-check" aria-hidden="true">${state.bucketFillEnabled ? '✓' : ''}</span>
      `;
      bucketToggle.addEventListener('click', () => {
        state.bucketFillEnabled = !state.bucketFillEnabled;
        renderPaletteBar(artwork);
      });
      els.paletteBar.appendChild(bucketToggle);

      incompleteIndexes.forEach(index => {
        const item = artwork.palette[index];
        const swatch = document.createElement('button');
        swatch.className = 'swatch' + (state.selectedPaletteIndex === index ? ' active' : '');
        swatch.innerHTML = `
          <div class="swatch-color" style="background:${item.hex};">
            <span class="swatch-no-badge">${item.id}</span>
          </div>
        `;
        swatch.addEventListener('click', () => {
          state.selectedPaletteIndex = index;
          renderPaletteBar(artwork);
          updateSelectedColorText();
        });
        els.paletteBar.appendChild(swatch);
      });
    }

    function syncDragFillLockToggle() {
      if (!els.dragFillLockToggle) return;
      els.dragFillLockToggle.classList.toggle('active', state.dragFillLocked);
      els.dragFillLockToggle.setAttribute('aria-pressed', state.dragFillLocked ? 'true' : 'false');
      if (els.dragFillLockCheck) {
        els.dragFillLockCheck.textContent = state.dragFillLocked ? '✓' : '';
      }
    }

    function updateSelectedColorText() {
      if (!els.selectedColorText) return;
    }

    function playCompletionCelebration() {
      if (!els.celebrationLayer || typeof window.gsap === 'undefined') return;

      els.celebrationLayer.innerHTML = '';
      const colors = ['#315EFB', '#F25F5C', '#F6B73C', '#28C76F', '#111827', '#FFFFFF'];
      const pieces = Array.from({ length: 42 }, (_, index) => {
        const piece = document.createElement('span');
        piece.className = 'confetti-piece';
        piece.style.left = `${(index / 42) * 100}%`;
        piece.style.background = colors[index % colors.length];
        piece.style.transform = `translate3d(0, -40px, 0) rotate(${Math.round(Math.random() * 180)}deg)`;
        els.celebrationLayer.appendChild(piece);
        return piece;
      });

      window.gsap.set(pieces, {
        opacity: 1,
        xPercent: () => window.gsap.utils.random(-120, 120),
        y: -40,
        rotate: () => window.gsap.utils.random(-120, 120),
        scale: () => window.gsap.utils.random(0.7, 1.15)
      });

      const timeline = window.gsap.timeline({
        onComplete: () => {
          els.celebrationLayer.innerHTML = '';
        }
      });

      timeline.to(pieces, {
        duration: 1.8,
        y: () => window.innerHeight + window.gsap.utils.random(80, 180),
        x: () => window.gsap.utils.random(-180, 180),
        rotate: () => window.gsap.utils.random(-540, 540),
        ease: 'power2.out',
        stagger: {
          each: 0.015,
          from: 'random'
        }
      }, 0);

      timeline.to(pieces, {
        duration: 0.45,
        opacity: 0,
        ease: 'power1.out',
        stagger: {
          each: 0.01,
          from: 'random'
        }
      }, 1.2);
    }

    function maybePlayCompletionCelebration() {
      if (!state.currentArtwork || state.completionCelebrated) return;
      if (getIncompletePaletteIndexes(state.currentArtwork).length > 0) return;
      state.completionCelebrated = true;
      fitArtworkToViewport();
      requestAnimationFrame(() => playCompletionCelebration());
    }

    function renderPaletteThumbs() {
      if (!state.currentArtwork) return;

      const thumbOptions = {
        showGrid: false,
        showNumbers: false,
        cellSize: 1,
        whiteBackground: true
      };

      if (els.pixelThumbCanvas) {
        renderPixelArt(els.pixelThumbCanvas, state.currentArtwork, {
          ...thumbOptions,
          showColors: true
        });
      }

      if (els.progressThumbCanvas) {
        renderPixelArt(els.progressThumbCanvas, state.currentArtwork, {
          ...thumbOptions,
          showColors: false,
          paintedCells: state.paintedCells
        });
      }
    }

    function getFittedZoom(artwork) {
      if (!artwork || !els.playStage || !els.stageInner) {
        return clamp(artwork?.exportCellSize || 18, MIN_DRAW_ZOOM, MAX_DRAW_ZOOM);
      }

      const stageWidth = els.playStage.clientWidth;
      const stageHeight = els.playStage.clientHeight;
      if (!stageWidth || !stageHeight) {
        return clamp(artwork.exportCellSize || 18, MIN_DRAW_ZOOM, MAX_DRAW_ZOOM);
      }

      const stageStyle = window.getComputedStyle(els.stageInner);
      const paddingX = (parseFloat(stageStyle.paddingLeft) || 0) + (parseFloat(stageStyle.paddingRight) || 0);
      const paddingY = (parseFloat(stageStyle.paddingTop) || 0) + (parseFloat(stageStyle.paddingBottom) || 0);
      const availableWidth = Math.max(1, stageWidth - paddingX);
      const availableHeight = Math.max(1, stageHeight - paddingY);
      const zoomFromWidth = Math.floor(availableWidth / artwork.width);
      const zoomFromHeight = Math.floor(availableHeight / artwork.height);

      return clamp(Math.min(zoomFromWidth, zoomFromHeight), MIN_DRAW_ZOOM, MAX_DRAW_ZOOM);
    }

    function fitArtworkToViewport() {
      if (!state.currentArtwork) return;
      state.zoom = getFittedZoom(state.currentArtwork);
      renderPlayCanvas();
      if (els.playStage) {
        requestAnimationFrame(() => {
          els.playStage.scrollLeft = 0;
          els.playStage.scrollTop = 0;
        });
      }
    }

    function renderPlayCanvas() {
      if (!state.currentArtwork || !els.playCanvas) return;
      renderPixelArt(els.playCanvas, state.currentArtwork, {
        showColors: false,
        showGrid: true,
        showNumbers: true,
        paintedCells: state.paintedCells,
        cellSize: state.zoom,
        numberAlpha: 0.92
      });
      renderPaletteBar(state.currentArtwork);
      renderPaletteThumbs();
      maybePlayCompletionCelebration();
    }

    function savePaintingProgress() {
      if (!state.currentArtwork) return;
      localStorage.setItem(progressKey(state.currentArtwork), JSON.stringify(state.paintedCells));
    }

    function fillConnectedCells(startIndex, paletteIndex) {
      if (!state.currentArtwork) return false;

      const expected = state.currentArtwork.cells[startIndex];
      if (expected == null || expected < 0 || expected !== paletteIndex) return false;

      const width = state.currentArtwork.width;
      const height = state.currentArtwork.height;
      const total = width * height;
      const visited = new Uint8Array(total);
      const stack = [startIndex];
      let changed = false;

      while (stack.length) {
        const idx = stack.pop();
        if (visited[idx]) continue;
        visited[idx] = 1;

        if (state.currentArtwork.cells[idx] !== expected) continue;

        if (state.paintedCells[idx] !== paletteIndex) {
          state.paintedCells[idx] = paletteIndex;
          changed = true;
        }

        const x = idx % width;
        const y = (idx - x) / width;

        if (x > 0) stack.push(idx - 1);
        if (x < width - 1) stack.push(idx + 1);
        if (y > 0) stack.push(idx - width);
        if (y < height - 1) stack.push(idx + width);
      }

      return changed;
    }

    function trackPointer(event) {
      if (event.pointerType !== 'touch') return;
      state.activePointers.set(event.pointerId, {
        x: event.clientX,
        y: event.clientY
      });
    }

    function untrackPointer(event) {
      if (event.pointerType !== 'touch') return;
      state.activePointers.delete(event.pointerId);
      if (state.activePointers.size < 2) {
        state.pinchStartDistance = null;
        state.pinchStartZoom = null;
        state.pinchStartCenter = null;
      }
      if (state.touchPanPointerId === event.pointerId) {
        state.touchPanPointerId = null;
      }
    }

    function getPinchDistance() {
      if (state.activePointers.size < 2) return null;
      const [a, b] = Array.from(state.activePointers.values());
      return Math.hypot(a.x - b.x, a.y - b.y);
    }

    function getPinchCenter() {
      if (state.activePointers.size < 2) return null;
      const [a, b] = Array.from(state.activePointers.values());
      return {
        x: (a.x + b.x) / 2,
        y: (a.y + b.y) / 2
      };
    }

    function handlePinchZoom() {
      if (!els.playStage) return false;
      const distance = getPinchDistance();
      const center = getPinchCenter();
      if (!distance || !center) return false;

      const stageRect = els.playStage.getBoundingClientRect();
      const centerX = center.x - stageRect.left;
      const centerY = center.y - stageRect.top;

      if (state.pinchStartDistance == null) {
        state.pinchStartDistance = distance;
        state.pinchStartZoom = state.zoom;
        state.pinchStartCenter = { x: centerX, y: centerY };
        state.pinchStartScrollLeft = els.playStage.scrollLeft;
        state.pinchStartScrollTop = els.playStage.scrollTop;
        return true;
      }

      const zoomRatio = distance / state.pinchStartDistance;
      const nextZoom = clamp(
        Math.round(state.pinchStartZoom * zoomRatio),
        MIN_DRAW_ZOOM,
        MAX_DRAW_ZOOM
      );

      if (nextZoom !== state.zoom) {
        state.zoom = nextZoom;
        renderPlayCanvas();
      }

      const nextScrollLeft = ((state.pinchStartScrollLeft + state.pinchStartCenter.x) * (state.zoom / state.pinchStartZoom)) - centerX;
      const nextScrollTop = ((state.pinchStartScrollTop + state.pinchStartCenter.y) * (state.zoom / state.pinchStartZoom)) - centerY;
      els.playStage.scrollLeft = Math.max(0, nextScrollLeft);
      els.playStage.scrollTop = Math.max(0, nextScrollTop);

      return true;
    }

    function startTouchPan(event) {
      if (!els.playStage) return;
      state.touchPanPointerId = event.pointerId;
      state.touchPanStartX = event.clientX;
      state.touchPanStartY = event.clientY;
      state.touchPanStartScrollLeft = els.playStage.scrollLeft;
      state.touchPanStartScrollTop = els.playStage.scrollTop;
      state.touchPanMoved = false;
    }

    function handleTouchPan(event) {
      if (!els.playStage || state.touchPanPointerId !== event.pointerId) return false;

      const deltaX = event.clientX - state.touchPanStartX;
      const deltaY = event.clientY - state.touchPanStartY;
      if (Math.abs(deltaX) > 6 || Math.abs(deltaY) > 6) {
        state.touchPanMoved = true;
      }

      els.playStage.scrollLeft = Math.max(0, state.touchPanStartScrollLeft - deltaX);
      els.playStage.scrollTop = Math.max(0, state.touchPanStartScrollTop - deltaY);
      return true;
    }

    function handleTouchTap(event) {
      if (state.touchPanMoved) return;
      paintAtEvent(event);
    }

    function paintAtEvent(event) {
      if (!state.currentArtwork || state.selectedPaletteIndex == null) return;
      const rect = els.playCanvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const cellX = Math.floor(x / state.zoom);
      const cellY = Math.floor(y / state.zoom);
      if (cellX < 0 || cellY < 0 || cellX >= state.currentArtwork.width || cellY >= state.currentArtwork.height) return;

      const idx = cellY * state.currentArtwork.width + cellX;
      const expected = state.currentArtwork.cells[idx];
      if (expected == null || expected < 0) return;
      const canPaint = expected === state.selectedPaletteIndex;
      if (!canPaint) return;

      const changed = state.bucketFillEnabled
        ? fillConnectedCells(idx, state.selectedPaletteIndex)
        : (() => {
          if (state.paintedCells[idx] === state.selectedPaletteIndex) return false;
          state.paintedCells[idx] = state.selectedPaletteIndex;
          return true;
        })();

      if (changed) {
        renderPlayCanvas();
        savePaintingProgress();
      }
    }

    function clearPainting() {
      if (!state.currentArtwork) return;
      state.paintedCells = new Array(state.currentArtwork.cells.length).fill(null);
      state.completionCelebrated = false;
      localStorage.removeItem(progressKey(state.currentArtwork));
      renderPlayCanvas();
    }

    function exportPainting() {
      if (!state.currentArtwork) return;
      const exportCanvas = document.createElement('canvas');
      renderPixelArt(exportCanvas, state.currentArtwork, {
        showColors: false,
        showGrid: true,
        showNumbers: false,
        paintedCells: state.paintedCells,
        cellSize: state.currentArtwork.exportCellSize || 18
      });
      downloadCanvas(exportCanvas, `${sanitizeFileName(state.currentArtwork.name)}-painted.png`);
    }

    function bindPlayCanvasEvents() {
      if (!els.playCanvas) return;
      const stopPaint = event => {
        if (event?.pointerType === 'touch') {
          if (state.activePointers.size < 2 && state.touchPanPointerId === event.pointerId) {
            handleTouchTap(event);
          }
          untrackPointer(event);
          state.isPainting = false;
          return;
        }

        state.isPainting = false;
        if (event) untrackPointer(event);
      };
      on(els.playCanvas, 'pointerdown', event => {
        trackPointer(event);
        if (event.pointerType === 'touch') {
          if (state.activePointers.size === 1 && !state.dragFillLocked) {
            startTouchPan(event);
          }
          if (handlePinchZoom()) {
            state.isPainting = false;
            state.touchPanMoved = true;
            return;
          }
          if (state.dragFillLocked) {
            state.isPainting = true;
            paintAtEvent(event);
            return;
          }
          state.isPainting = false;
          return;
        }

        if (handlePinchZoom()) {
          state.isPainting = false;
          return;
        }
        state.isPainting = true;
        paintAtEvent(event);
      });
      on(els.playCanvas, 'pointermove', event => {
        trackPointer(event);
        if (event.pointerType === 'touch') {
          if (handlePinchZoom()) {
            state.isPainting = false;
            state.touchPanMoved = true;
            return;
          }
          if (state.dragFillLocked) {
            if (state.isPainting) paintAtEvent(event);
            return;
          }
          handleTouchPan(event);
          return;
        }

        if (handlePinchZoom()) {
          state.isPainting = false;
          return;
        }
        if (state.isPainting) paintAtEvent(event);
      });
      window.addEventListener('pointerup', stopPaint);
      window.addEventListener('pointercancel', stopPaint);
    }

    function attachEvents() {
      on(els.navOffline, 'click', () => showView('offline'));
      on(els.navOnline, 'click', () => showView('online'));

      on(els.imageFile, 'change', async e => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
          const img = await createImageFromFile(file);
          state.sourceImage = img;
          state.generated = null;
          state.sourceName = file.name.replace(/\.[^.]+$/, '');
          if (els.imageName) els.imageName.value = els.imageName.value.trim() || state.sourceName;
          setGeneratedReady(false);
          refreshSourcePreview();
          if (els.offlineStatus) els.offlineStatus.textContent = `已載入圖片：${file.name}`;
        } catch (error) {
          if (els.offlineStatus) els.offlineStatus.textContent = '圖片讀取失敗。';
        }
      });

      on(els.generateBtn, 'click', generateArtworkFromCurrentImage);
      on(els.loadDemoBtn, 'click', loadDemoImage);
      on(els.removeBackgroundToggle, 'change', () => refreshSourcePreview({ regenerate: true }));
      on(els.backgroundTolerance, 'input', () => {
        if (!els.removeBackgroundToggle?.checked) return;
        refreshSourcePreview({ regenerate: true });
      });

      on(els.exportJsonBtn, 'click', () => {
        if (!state.generated) return;
        const blob = new Blob([JSON.stringify(state.generated, null, 2)], { type: 'application/json' });
        downloadBlob(blob, `${sanitizeFileName(state.generated.name)}.json`);
      });

      on(els.exportPixelBtn, 'click', () => {
        if (!state.generated) return;
        const exportCanvas = document.createElement('canvas');
        renderPixelArt(exportCanvas, state.generated, {
          showColors: true,
          showGrid: false,
          showNumbers: false,
          cellSize: state.generated.exportCellSize
        });
        downloadCanvas(exportCanvas, `${sanitizeFileName(state.generated.name)}-pixel.png`);
      });

      on(els.exportOutlineBtn, 'click', () => {
        if (!state.generated) return;
        const exportCanvas = document.createElement('canvas');
        renderPixelArt(exportCanvas, state.generated, {
          showColors: false,
          showGrid: true,
          showNumbers: true,
          cellSize: state.generated.exportCellSize
        });
        downloadCanvas(exportCanvas, `${sanitizeFileName(state.generated.name)}-outline.png`);
      });

      on(els.saveRepoBtn, 'click', saveRepoConfig);
      on(els.loadGalleryBtn, 'click', loadGallery);
      on(els.backToGalleryBtn, 'click', showGallery);
      on(els.clearPaintBtn, 'click', clearPainting);
      on(els.exportPaintBtn, 'click', exportPainting);
      on(els.playTopbarToggle, 'click', toggleDrawTopbar);
      on(els.dragFillLockToggle, 'click', () => {
        state.dragFillLocked = !state.dragFillLocked;
        syncDragFillLockToggle();
      });
      on(els.zoomInBtn, 'click', () => {
        state.zoom = clamp(state.zoom + 4, MIN_DRAW_ZOOM, MAX_DRAW_ZOOM);
        renderPlayCanvas();
      });
      on(els.zoomOutBtn, 'click', () => {
        state.zoom = clamp(state.zoom - 4, MIN_DRAW_ZOOM, MAX_DRAW_ZOOM);
        renderPlayCanvas();
      });

      bindPlayCanvasEvents();
    }

    function bootstrap() {
      attachEvents();
      syncBackgroundControls();
      updateBackgroundInfo();
      syncDrawTopbarState();
      requestAnimationFrame(updateDrawTopbarOffset);
      window.addEventListener('resize', () => {
        syncDrawTopbarState();
        requestAnimationFrame(updateDrawTopbarOffset);
      });

      if (PAGE_MODE === 'offline') {
        setGeneratedReady(false);
        return;
      }

      if (PAGE_MODE === 'paint') {
        loadRepoConfigToForm();
        showGallery();
        loadGallery().catch(console.error);
        return;
      }

      if (PAGE_MODE === 'draw') {
        resolveArtworkForDrawPage()
          .then(artwork => {
            if (!artwork) {
              showDrawEmpty('請先回到圖片清單頁選一張圖片，再進入這個塗鴉頁。');
              return;
            }
            startPainting(artwork);
          })
          .catch(error => {
            console.error(error);
            showDrawEmpty('圖片資料載入失敗，請回到圖片清單重新選擇。');
          });
        return;
      }

      loadRepoConfigToForm();
      setGeneratedReady(false);
      showView('offline');
      showGallery();
      loadGallery().catch(console.error);
    }

    bootstrap();

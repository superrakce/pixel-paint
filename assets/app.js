const PAGE_MODE = document.body?.dataset?.page || 'all';

function on(el, eventName, handler, options) {
  if (el) el.addEventListener(eventName, handler, options);
}

const state = {
      sourceImage: null,
      sourceName: '',
      generated: null,
      gallery: [],
      currentArtwork: null,
      paintedCells: [],
      selectedPaletteIndex: null,
      forceFill: false,
      zoom: 24,
      isPainting: false
    };

    const els = {
      navOffline: document.getElementById('navOffline'),
      navOnline: document.getElementById('navOnline'),
      offlineView: document.getElementById('offlineView'),
      onlineView: document.getElementById('onlineView'),
      galleryView: document.getElementById('galleryView'),
      playView: document.getElementById('playView'),
      imageName: document.getElementById('imageName'),
      imageFile: document.getElementById('imageFile'),
      gridWidth: document.getElementById('gridWidth'),
      paletteCount: document.getElementById('paletteCount'),
      exportCellSize: document.getElementById('exportCellSize'),
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
      clearPaintBtn: document.getElementById('clearPaintBtn'),
      backToGalleryBtn: document.getElementById('backToGalleryBtn'),
      exportPaintBtn: document.getElementById('exportPaintBtn'),
      playCanvas: document.getElementById('playCanvas'),
      playStage: document.getElementById('playStage'),
      paletteBar: document.getElementById('paletteBar'),
      forceFillToggle: document.getElementById('forceFillToggle'),
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
    }

    function showPlay() {
      if (els.galleryView) els.galleryView.classList.add('hidden');
      if (els.playView) els.playView.classList.remove('hidden');
    }

    function clamp(value, min, max) {
      return Math.max(min, Math.min(max, value));
    }

    function sanitizeFileName(name) {
      return (name || 'untitled').trim().replace(/[\\/:*?"<>|]/g, '-');
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
        const rgb = alpha < 0.1
          ? [255, 255, 255]
          : [imageData[i], imageData[i + 1], imageData[i + 2]];
        pixels.push(rgb);
      }
      return { width, height, pixels };
    }

    function kMeansQuantize(pixels, k) {
      const safeK = clamp(parseInt(k, 10) || 8, 5, 12);
      const unique = [...new Map(pixels.map(p => [p.join(','), p])).values()];
      const centroids = [];
      for (let i = 0; i < safeK; i++) {
        centroids.push(unique[Math.floor((i * unique.length) / safeK)] || unique[0] || [255,255,255]);
      }

      let assignments = new Array(pixels.length).fill(0);
      for (let round = 0; round < 10; round++) {
        let moved = false;

        for (let i = 0; i < pixels.length; i++) {
          const pixel = pixels[i];
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
        for (let i = 0; i < pixels.length; i++) {
          const idx = assignments[i];
          const bucket = sums[idx];
          bucket[0] += pixels[i][0];
          bucket[1] += pixels[i][1];
          bucket[2] += pixels[i][2];
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
        .sort((a, b) => b.count - a.count);

      const remap = new Map(order.map((item, newIndex) => [item.oldIndex, newIndex]));
      const palette = order.map((item, idx) => ({
        id: idx + 1,
        hex: hexFromRgb(item.rgb),
        rgb: item.rgb,
        count: item.count
      }));
      const cells = assignments.map(index => remap.get(index));

      return { palette, cells };
    }

    function buildGeneratedArtwork(name, image) {
      const baseName = sanitizeFileName(name || image.dataset?.defaultName || 'untitled');
      const width = clamp(parseInt(els.gridWidth.value, 10) || 32, 8, 128);
      const paletteCount = clamp(parseInt(els.paletteCount.value, 10) || 8, 5, 12);
      const exportCellSize = clamp(parseInt(els.exportCellSize.value, 10) || 18, 8, 40);
      const downsampled = downsampleImage(image, width);
      const quantized = kMeansQuantize(downsampled.pixels, paletteCount);

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
          sourceHeight: image.height
        }
      };
    }

    function renderPixelArt(canvas, artwork, options = {}) {
      const {
        showNumbers = false,
        showGrid = true,
        showColors = true,
        cellSize = artwork.exportCellSize || 18,
        paintedCells = null,
        numberAlpha = 1,
        whiteBackground = true
      } = options;

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
          const paletteItem = artwork.palette[paletteIndex];
          const fillColor = paintedCells
            ? (paintedCells[idx] != null ? artwork.palette[paintedCells[idx]].hex : '#FFFFFF')
            : (showColors ? paletteItem.hex : '#FFFFFF');

          ctx.fillStyle = fillColor;
          ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);

          if (showGrid) {
            ctx.strokeStyle = '#D7DEE8';
            ctx.lineWidth = Math.max(1, Math.floor(cellSize / 18));
            ctx.strokeRect(x * cellSize, y * cellSize, cellSize, cellSize);
          }

          if (showNumbers) {
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
      renderPaletteSummary(state.generated.palette);
    }

    function renderPaletteSummary(palette) {
      if (!els.palettePreviewBox) return;
      els.palettePreviewBox.innerHTML = palette.map(item => `
        <span class="pill" style="margin: 0 8px 8px 0; display:inline-flex;">
          <span style="width:18px; height:18px; border-radius:999px; background:${item.hex}; border:1px solid rgba(0,0,0,.08);"></span>
          <strong>${item.id}</strong>
          <span class="muted">${item.hex}</span>
        </span>
      `).join('');
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
      const name = els.imageName.value.trim() || state.sourceName || 'untitled';
      state.generated = buildGeneratedArtwork(name, state.sourceImage);
      updateOfflinePreviews();
      setGeneratedReady(true);
      els.offlineStatus.textContent = `已完成：${state.generated.name}，尺寸 ${state.generated.width} × ${state.generated.height}，共 ${state.generated.palette.length} 色。`;
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
        if (els.sourceCanvas) drawFittedImage(els.sourceCanvas, img);
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

    function startPainting(artwork) {
      state.currentArtwork = artwork;
      state.zoom = clamp(artwork.exportCellSize || 18, 16, 40);
      state.selectedPaletteIndex = 0;
      state.forceFill = false;
      if (els.forceFillToggle) els.forceFillToggle.checked = false;

      const stored = localStorage.getItem(progressKey(artwork));
      state.paintedCells = stored
        ? JSON.parse(stored)
        : new Array(artwork.cells.length).fill(null);

      if (els.playTitle) els.playTitle.textContent = artwork.name || '未命名圖片';
      if (els.playSubtitle) els.playSubtitle.textContent = `請先從下方選擇色塊，再點擊底圖上的對應編號。相同編號才會填色，除非已勾選「強制填色」。`;
      renderPaletteBar(artwork);
      updateSelectedColorText();
      renderPlayCanvas();
      showPlay();
    }

    function renderPaletteBar(artwork) {
      if (!els.paletteBar) return;
      els.paletteBar.innerHTML = '';
      artwork.palette.forEach((item, index) => {
        const swatch = document.createElement('button');
        swatch.className = 'swatch' + (state.selectedPaletteIndex === index ? ' active' : '');
        swatch.innerHTML = `
          <div class="swatch-color" style="background:${item.hex};"></div>
          <div class="swatch-no">${item.id}</div>
          <div class="swatch-name">${item.hex}</div>
        `;
        swatch.addEventListener('click', () => {
          state.selectedPaletteIndex = index;
          renderPaletteBar(artwork);
          updateSelectedColorText();
        });
        els.paletteBar.appendChild(swatch);
      });
    }

    function updateSelectedColorText() {
      if (!els.selectedColorText) return;
      if (!state.currentArtwork || state.selectedPaletteIndex == null) {
        els.selectedColorText.textContent = '尚未選擇色塊';
        return;
      }
      const item = state.currentArtwork.palette[state.selectedPaletteIndex];
      els.selectedColorText.textContent = `目前顏色：編號 ${item.id} / ${item.hex}`;
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
    }

    function savePaintingProgress() {
      if (!state.currentArtwork) return;
      localStorage.setItem(progressKey(state.currentArtwork), JSON.stringify(state.paintedCells));
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
      const canPaint = state.forceFill || expected === state.selectedPaletteIndex;
      if (!canPaint) return;

      if (state.paintedCells[idx] !== state.selectedPaletteIndex) {
        state.paintedCells[idx] = state.selectedPaletteIndex;
        renderPlayCanvas();
        savePaintingProgress();
      }
    }

    function clearPainting() {
      if (!state.currentArtwork) return;
      state.paintedCells = new Array(state.currentArtwork.cells.length).fill(null);
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
      const stopPaint = () => { state.isPainting = false; };
      on(els.playCanvas, 'pointerdown', event => {
        state.isPainting = true;
        paintAtEvent(event);
      });
      on(els.playCanvas, 'pointermove', event => {
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
          state.sourceName = file.name.replace(/\.[^.]+$/, '');
          if (els.imageName) els.imageName.value = els.imageName.value.trim() || state.sourceName;
          if (els.sourceCanvas) drawFittedImage(els.sourceCanvas, img);
          if (els.offlineStatus) els.offlineStatus.textContent = `已載入圖片：${file.name}`;
        } catch (error) {
          if (els.offlineStatus) els.offlineStatus.textContent = '圖片讀取失敗。';
        }
      });

      on(els.generateBtn, 'click', generateArtworkFromCurrentImage);
      on(els.loadDemoBtn, 'click', loadDemoImage);

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
      on(els.forceFillToggle, 'change', e => {
        state.forceFill = !!e.target.checked;
      });
      on(els.zoomInBtn, 'click', () => {
        state.zoom = clamp(state.zoom + 4, 8, 64);
        renderPlayCanvas();
      });
      on(els.zoomOutBtn, 'click', () => {
        state.zoom = clamp(state.zoom - 4, 8, 64);
        renderPlayCanvas();
      });

      bindPlayCanvasEvents();
    }

    function bootstrap() {
      attachEvents();

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

      loadRepoConfigToForm();
      setGeneratedReady(false);
      showView('offline');
      showGallery();
      loadGallery().catch(console.error);
    }

    bootstrap();
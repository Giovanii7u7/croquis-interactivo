/*
  Hotspot editor utility preserved for future use.

  Expected DOM elements when reintegrating:
  - #toggleEditorBtn
  - #saveLayoutBtn
  - #resetLayoutBtn
  - #editorStatus
  - #mapWrapper
  - #mapImg
  - #hotspotsContainer
  - #overlay

  This module assumes `areas`, `openPanel()` and the map markup already exist.
  It is intentionally not loaded by index.html right now.
*/

function attachHotspotEditor({
  areas,
  mapWrapper,
  mapImg,
  hotspotsContainer,
  overlay,
  toggleBtn,
  saveBtn,
  resetBtn,
  statusNode,
  openPanel
}) {
  const originalAreas = areas.map(area => ({
    ...area,
    info: area.info ? { ...area.info } : undefined
  }));

  const state = {
    enabled: false,
    activePointerId: null,
    activeAreaId: null,
    dragMode: null,
    startPointer: null,
    startArea: null
  };

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function findArea(areaId) {
    return areas.find(area => area.id === areaId);
  }

  function setStatus(message) {
    if (statusNode) statusNode.textContent = message;
  }

  function syncButtons() {
    if (toggleBtn) {
      toggleBtn.classList.toggle('is-active', state.enabled);
      toggleBtn.textContent = state.enabled ? 'Salir de edición' : 'Editar recuadros';
    }
    if (saveBtn) saveBtn.disabled = !state.enabled;
    if (resetBtn) resetBtn.disabled = !state.enabled;
    mapWrapper.classList.toggle('is-editing', state.enabled);
  }

  function renderHotspots() {
    hotspotsContainer.innerHTML = '';

    areas.forEach(area => {
      const hotspot = document.createElement('div');
      hotspot.className = 'hotspot';
      hotspot.style.left = area.x + '%';
      hotspot.style.top = area.y + '%';
      hotspot.style.width = area.w + '%';
      hotspot.style.height = area.h + '%';
      hotspot.setAttribute('title', area.label);

      if (state.enabled) {
        if (state.activeAreaId === area.id) hotspot.classList.add('is-selected');

        const label = document.createElement('span');
        label.className = 'hotspot-label';
        label.textContent = area.label;

        const handle = document.createElement('span');
        handle.className = 'hotspot-handle';
        handle.dataset.handle = 'resize';

        hotspot.appendChild(label);
        hotspot.appendChild(handle);

        hotspot.addEventListener('pointerdown', (event) => {
          event.preventDefault();
          event.stopPropagation();

          state.activeAreaId = area.id;
          state.activePointerId = event.pointerId;
          state.dragMode = event.target.dataset.handle === 'resize' ? 'resize' : 'move';
          state.startPointer = { x: event.clientX, y: event.clientY };
          state.startArea = { x: area.x, y: area.y, w: area.w, h: area.h };

          setStatus(`Editando "${area.label}": arrastra para ${state.dragMode === 'move' ? 'mover' : 'cambiar tamaño'}.`);
          renderHotspots();
        });
      } else {
        hotspot.addEventListener('click', () => openPanel(area));
      }

      hotspotsContainer.appendChild(hotspot);
    });
  }

  function endDrag() {
    state.activePointerId = null;
    state.dragMode = null;
    state.startPointer = null;
    state.startArea = null;
  }

  function updateAreaFromPointer(event) {
    const area = findArea(state.activeAreaId);
    const rect = hotspotsContainer.getBoundingClientRect();
    if (!area || !rect.width || !rect.height || !state.startPointer || !state.startArea) return;

    const deltaX = ((event.clientX - state.startPointer.x) / rect.width) * 100;
    const deltaY = ((event.clientY - state.startPointer.y) / rect.height) * 100;
    const minSize = 1.5;

    if (state.dragMode === 'move') {
      area.x = clamp(state.startArea.x + deltaX, 0, 100 - area.w);
      area.y = clamp(state.startArea.y + deltaY, 0, 100 - area.h);
    } else if (state.dragMode === 'resize') {
      area.w = clamp(state.startArea.w + deltaX, minSize, 100 - area.x);
      area.h = clamp(state.startArea.h + deltaY, minSize, 100 - area.y);
    }
  }

  function toggleMode(forceValue) {
    state.enabled = typeof forceValue === 'boolean' ? forceValue : !state.enabled;
    state.activeAreaId = null;
    endDrag();
    overlay.classList.remove('open');
    syncButtons();
    renderHotspots();

    if (state.enabled) {
      setStatus('Modo edición activo: arrastra un recuadro para moverlo y usa el punto naranja para cambiar su tamaño.');
    } else {
      setStatus('Modo normal: toca cualquier área para ver su información.');
    }
  }

  function downloadLayout() {
    const payload = {
      exportedAt: new Date().toISOString(),
      areas: areas.map(({ id, label, x, y, w, h }) => ({
        id,
        label,
        x: Number(x.toFixed(2)),
        y: Number(y.toFixed(2)),
        w: Number(w.toFixed(2)),
        h: Number(h.toFixed(2))
      }))
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'hotspots-layout.json';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);

    setStatus('Se descargó hotspots-layout.json con las posiciones actuales de los recuadros.');
  }

  function restoreLayout() {
    areas.forEach((area, index) => {
      area.x = originalAreas[index].x;
      area.y = originalAreas[index].y;
      area.w = originalAreas[index].w;
      area.h = originalAreas[index].h;
    });

    renderHotspots();
    setStatus('Se restauraron las coordenadas originales del archivo.');
  }

  window.addEventListener('pointermove', (event) => {
    if (!state.enabled || state.activePointerId !== event.pointerId || !state.activeAreaId) return;
    event.preventDefault();
    updateAreaFromPointer(event);
    renderHotspots();
  });

  window.addEventListener('pointerup', (event) => {
    if (state.activePointerId !== event.pointerId) return;
    endDrag();
  });

  window.addEventListener('pointercancel', (event) => {
    if (state.activePointerId !== event.pointerId) return;
    endDrag();
  });

  if (toggleBtn) toggleBtn.addEventListener('click', () => toggleMode());
  if (saveBtn) saveBtn.addEventListener('click', downloadLayout);
  if (resetBtn) resetBtn.addEventListener('click', restoreLayout);

  if (mapImg.complete) renderHotspots();
  syncButtons();

  return {
    renderHotspots,
    toggleMode,
    downloadLayout,
    restoreLayout
  };
}

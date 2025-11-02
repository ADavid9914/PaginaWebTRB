import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { GLTFLoader } from 'https://unpkg.com/three@0.160.0/examples/jsm/loaders/GLTFLoader.js';

// Fábrica para crear visores independientes
function createViewer(options = {}) {
  const container = document.getElementById(options.containerId || 'escenario3D');
  if (!container) throw new Error('Container no encontrado: ' + (options.containerId || 'escenario3D'));

  // Escena y recursos locales a la instancia
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87ceeb);

  const camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight || 1, 0.1, 1000);
  camera.position.set(5, 3, 5);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio || 1);
  renderer.setSize(container.clientWidth, container.clientHeight);
  container.appendChild(renderer.domElement);

  const ambient = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambient);
  const sun = new THREE.DirectionalLight(0xffffff, 1);
  sun.position.set(5, 10, 5);
  scene.add(sun);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(50, 50),
    new THREE.MeshStandardMaterial({ color: 0x228b22 })
  );
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  const placeholder = new THREE.Mesh(
    new THREE.BoxGeometry(1, 0.2, 1),
    new THREE.MeshStandardMaterial({ color: 0x4f46e5 })
  );
  placeholder.position.y = 1;
  placeholder.visible = false;
  scene.add(placeholder);

  // Estado de la instancia
  let modelo = null;
  let mixer = null;
  let mixerTime = 0;
  let duration = 0;
  const clock = new THREE.Clock();
  // por defecto NO reproducir automáticamente; puede activarse con options.autoPlay = true
  let isPlaying = !!options.autoPlay;
  // control del bucle de render para poder parar por completo (ahorrar GPU)
  // por defecto arrancamos el render loop a menos que autoStart sea false
  let running = (options.autoStart !== false);
  let rafId = null;

  const loader = new GLTFLoader();
  const defaultPaths = options.tryPaths || [
    'cubo2.glb',
    'multimedia/cubo2.glb',
    'multimedia/archivosblender/cubo2.glb'
  ];

  const controlIds = Object.assign({
    play: 'playPause', step: 'step', stepBack: 'stepBack', seek: 'seek', timeLabel: 'timeLabel'
  }, options.controlIds || {});

  function enableControlsForAnimations() {
    const playBtn = document.getElementById(controlIds.play);
    const stepBtn = document.getElementById(controlIds.step);
    const stepBackBtn = document.getElementById(controlIds.stepBack);
    const seekInput = document.getElementById(controlIds.seek);
    const timeLabel = document.getElementById(controlIds.timeLabel);
  if (playBtn) { playBtn.disabled = false; }
    if (stepBtn) stepBtn.disabled = false;
    if (stepBackBtn) stepBackBtn.disabled = false;
    if (seekInput) {
      seekInput.disabled = false;
      seekInput.min = 0;
      seekInput.max = duration || 1;
      seekInput.step = Math.max(0.01, (duration || 1) / 200);
      seekInput.value = 0;
    }
    if (timeLabel) timeLabel.textContent = `0.00 / ${duration.toFixed(2)} s`;
    // Asegurar que el texto del botón refleje el estado actual
    updatePlayButton();
  }

  function tryLoad(paths = defaultPaths, index = 0) {
    if (index >= paths.length) {
      modelo = placeholder; placeholder.visible = true; console.log('Usando placeholder como modelo (fallback)');
      return;
    }
    const path = paths[index];
    loader.load(path, (gltf) => {
      modelo = gltf.scene;
      modelo.scale.set(1,1,1);
      modelo.position.y = 1;
      scene.add(modelo);
      console.log('Modelo cargado desde:', path);
      if (gltf.animations && gltf.animations.length > 0) {
        mixer = new THREE.AnimationMixer(modelo);
        duration = 0;
        // crear acciones; no es necesario dejar que el mixer avance hasta que el usuario pulse play
        gltf.animations.forEach(clip => {
          const action = mixer.clipAction(clip);
          action.reset();
          // dejar action.play() — está bien, pero no avanzará mientras no se llame mixer.update
          action.play();
          if (clip.duration && clip.duration > duration) duration = clip.duration;
        });
        mixerTime = 0;
        enableControlsForAnimations();
        // Solo arrancar el reloj si se solicitó autoplay para esta instancia
        if (options.autoPlay) { isPlaying = true; clock.start(); } else { isPlaying = false; clock.stop(); }
      } else {
        console.log('No se encontraron animaciones en el GLB.');
      }
    }, (xhr) => { if (xhr.total) console.log(path + ' — ' + Math.round(xhr.loaded / xhr.total * 100) + '% cargado'); }, (err) => { console.warn('Error cargando', path, err && err.message ? err.message : err); tryLoad(paths, index+1); });
  }

  // Si options.loadOnCreate (default true) -> cargar ahora; si false, se cargará con loadModel()
  if (options.loadOnCreate !== false) tryLoad();

  // Camera controls state (per instancia)
  const target = new THREE.Vector3(0, 0.5, 0);
  let yaw = 0, pitch = 0.2, distance = 8;
  function updateCameraFromSpherical() {
    const x = target.x + distance * Math.cos(pitch) * Math.sin(yaw);
    const y = target.y + distance * Math.sin(pitch);
    const z = target.z + distance * Math.cos(pitch) * Math.cos(yaw);
    camera.position.set(x,y,z); camera.lookAt(target);
  }
  updateCameraFromSpherical();

  // Pointer controls on this container
  let isPointerDown = false, lastX = 0, lastY = 0;
  container.addEventListener('pointerdown', (e) => { isPointerDown = true; lastX = e.clientX; lastY = e.clientY; container.setPointerCapture?.(e.pointerId); container.focus?.(); });
  container.addEventListener('pointermove', (e) => { if (!isPointerDown) return; const dx = e.clientX - lastX, dy = e.clientY - lastY; lastX = e.clientX; lastY = e.clientY; yaw -= dx * 0.005; pitch -= dy * 0.005; const limit = Math.PI/2 - 0.1; pitch = Math.max(-limit, Math.min(limit, pitch)); updateCameraFromSpherical(); });
  container.addEventListener('pointerup', (e) => { isPointerDown = false; try { container.releasePointerCapture?.(e.pointerId); } catch(_){} });
  container.addEventListener('pointercancel', () => { isPointerDown = false; });
  container.addEventListener('wheel', (e) => { distance += e.deltaY * 0.01; distance = Math.max(2, Math.min(40, distance)); updateCameraFromSpherical(); e.preventDefault(); }, { passive: false });

  // Keyboard movement for the target: only act when this container has focus
  const keys = {};
  container.tabIndex = container.tabIndex || 0;
  container.addEventListener('keydown', e => keys[e.key.toLowerCase()] = true);
  container.addEventListener('keyup', e => keys[e.key.toLowerCase()] = false);

  // Playback controls wiring using controlIds
  const playBtn = document.getElementById(controlIds.play);
  const stepBtn = document.getElementById(controlIds.step);
  const stepBackBtn = document.getElementById(controlIds.stepBack);
  const seekInput = document.getElementById(controlIds.seek);
  const timeLabel = document.getElementById(controlIds.timeLabel);
  if (playBtn) playBtn.disabled = true;
  if (stepBtn) stepBtn.disabled = true;
  if (stepBackBtn) stepBackBtn.disabled = true;
  if (seekInput) seekInput.disabled = true;

  function updatePlayButton() { if (!playBtn) return; playBtn.textContent = isPlaying ? 'Pausa' : 'Reproducir'; }
  function togglePlayPause() { if (!mixer && modelo !== placeholder) return; isPlaying = !isPlaying; if (isPlaying) clock.start(); else clock.stop(); updatePlayButton(); }
  function stepSeconds(seconds) {
    if (mixer) {
      if (isPlaying) { isPlaying = false; clock.stop(); updatePlayButton(); }
      try { mixerTime = Math.max(0, Math.min(duration || 0, mixerTime + seconds)); if (typeof mixer.setTime === 'function') mixer.setTime(mixerTime); else if (seconds >= 0) mixer.update(seconds); else console.warn('Retroceso no soportado por este mixer.'); } catch (err) { console.warn('Error en step:', err); }
    } else { placeholder.rotation.y += seconds * 2; }
  }

  // Attach DOM listeners only when this viewer should bind controls directly.
  // When multiple viewers share the same control IDs we set options.bindControls = false
  // and use a single shared controller (wired outside) to avoid double-binding.
  if (options.bindControls !== false) {
    if (playBtn) playBtn.addEventListener('click', () => togglePlayPause());
    if (stepBtn) stepBtn.addEventListener('click', () => stepSeconds(0.5));
    if (stepBackBtn) stepBackBtn.addEventListener('click', () => stepSeconds(-0.5));
    if (seekInput) {
      seekInput.addEventListener('input', (e) => { const t = parseFloat(e.target.value); if (timeLabel) timeLabel.textContent = `${t.toFixed(2)} / ${duration.toFixed(2)} s`; });
      seekInput.addEventListener('change', (e) => { const t = parseFloat(e.target.value); mixerTime = Math.max(0, Math.min(duration || 0, t)); if (mixer && typeof mixer.setTime === 'function') { try { mixer.setTime(mixerTime); } catch (err) { console.warn('setTime falló:', err); } } });
    }
  }

  // Keyboard shortcuts scoped to this container when focused
  container.addEventListener('keydown', (e) => {
    const tag = (document.activeElement && document.activeElement.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    if (e.code === 'Space') { e.preventDefault(); togglePlayPause(); }
    else if (e.code === 'ArrowRight') { e.preventDefault(); stepSeconds(0.5); }
    else if (e.code === 'ArrowLeft') { e.preventDefault(); stepSeconds(-0.5); }
  });

  // Animación 
  function animate() {
  rafId = requestAnimationFrame(animate);
    const speed = 0.12;
    const forward = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    const left = new THREE.Vector3(Math.sin(yaw - Math.PI / 2), 0, Math.cos(yaw - Math.PI / 2));
    if (keys['w']) target.addScaledVector(forward, speed);
    if (keys['s']) target.addScaledVector(forward, -speed);
    if (keys['a']) target.addScaledVector(left, speed);
    if (keys['d']) target.addScaledVector(left, -speed);
    updateCameraFromSpherical();
    let delta = 0;
    if (isPlaying) {
      delta = clock.getDelta();
      if (mixer) { mixer.update(delta); mixerTime += delta; if (duration && mixerTime > duration) mixerTime = mixerTime % duration; }
    }
    if (seekInput && duration) { seekInput.value = Math.min(duration, mixerTime); if (timeLabel) timeLabel.textContent = `${mixerTime.toFixed(2)} / ${duration.toFixed(2)} s`; }
    if (modelo === placeholder) placeholder.rotation.y += 0.01;
    renderer.render(scene, camera);
  }
  // arrancar loop solo si running
  function startRendering() {
    if (running) return;
    running = true;
    // reset clock to avoid big deltas
    clock.getDelta();
    rafId = requestAnimationFrame(animate);
  }
  function stopRendering() {
    running = false;
    if (rafId != null) { cancelAnimationFrame(rafId); rafId = null; }
  }
  if (running) animate();

  // Resize handling
  window.addEventListener('resize', () => {
    const w = container.clientWidth; const h = container.clientHeight; camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h);
  });

  // API pública de la instancia
  return {
    play: () => { if (!isPlaying) togglePlayPause(); },
    pause: () => { if (isPlaying) togglePlayPause(); },
    toggle: togglePlayPause,
    step: (s) => stepSeconds(s),
    setTime: (t) => { mixerTime = Math.max(0, Math.min(duration || 0, t)); if (mixer && typeof mixer.setTime === 'function') mixer.setTime(mixerTime); },
    getTime: () => mixerTime,
    getDuration: () => duration,
    startRendering,
    stopRendering,
    loadModel: (paths) => tryLoad(paths),
    dispose: () => { /* could free geometrías, texturas y renderer */ }
  };
}

// Crear la instancia por defecto cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
  // Crear dos instancias y wire de pestañas
  let viewer1 = null, viewer2 = null;
  try {
    // Use the shared control bar for all viewers (controls operate on the active viewer)
  viewer1 = createViewer({ containerId: 'escenario3D_v1', controlIds: { play: 'play_shared', step: 'stepForward_shared', stepBack: 'step_shared', seek: 'seek_shared', timeLabel: 'timeLabel_shared' }, autoStart: true, bindControls: false });
  } catch (err) { console.error('No se pudo crear viewer1:', err); }
  // viewer2 lo creamos solo cuando el usuario active la pestaña (lazy load) para ahorrar recursos
  viewer2 = null;
  // cuál viewer está activo ahora (las acciones del shared player lo usarán)
  let activeViewer = viewer1;

  // Wire shared controls to the active viewer
  const playShared = document.getElementById('play_shared');
  const stepShared = document.getElementById('step_shared');
  const stepForwardShared = document.getElementById('stepForward_shared');
  const seekShared = document.getElementById('seek_shared');
  const timeLabelShared = document.getElementById('timeLabel_shared');
  if (playShared) playShared.addEventListener('click', () => { if (activeViewer && typeof activeViewer.toggle === 'function') activeViewer.toggle(); });
  if (stepShared) stepShared.addEventListener('click', () => { if (activeViewer && typeof activeViewer.step === 'function') activeViewer.step(-0.5); });
  if (stepForwardShared) stepForwardShared.addEventListener('click', () => { if (activeViewer && typeof activeViewer.step === 'function') activeViewer.step(0.5); });
  if (seekShared) {
    seekShared.addEventListener('input', (e) => { const t = parseFloat(e.target.value || 0); if (timeLabelShared) timeLabelShared.textContent = `${t.toFixed(2)} / ${((activeViewer && activeViewer.getDuration) ? (activeViewer.getDuration() || 0) : 0).toFixed(2)} s`; });
    seekShared.addEventListener('change', (e) => { const t = parseFloat(e.target.value || 0); if (activeViewer && typeof activeViewer.setTime === 'function') activeViewer.setTime(t); });
  }

  // Tab switching
  const tabs = document.querySelectorAll('.tabs .tab');
  function activateTab(tabButton) {
    tabs.forEach(t => { t.classList.toggle('active', t === tabButton); t.setAttribute('aria-selected', t === tabButton ? 'true' : 'false'); });
    const target = tabButton.dataset.target;
    // hide/show panels
    document.querySelectorAll('.panel').forEach(p => {
      if (p.id === target) { p.classList.add('active'); p.hidden = false; }
      else { p.classList.remove('active'); p.hidden = true; }
    });

    // Move the shared player into the active panel so it sits between the visor and the description
    try {
      const sharedPlayer = document.querySelector('.shared-player');
      const panelEl = document.getElementById(target);
      if (sharedPlayer && panelEl) {
        const desc = panelEl.querySelector('.descripcion');
        if (desc) panelEl.insertBefore(sharedPlayer, desc);
        else panelEl.appendChild(sharedPlayer);
      }
    } catch (err) { console.warn('No se pudo mover shared-player:', err); }
    // Pause non-active viewers and start/stop rendering to save resources
    if (target === 'panel-v1') {
      if (viewer1) { try { viewer1.startRendering(); activeViewer = viewer1; } catch(_){} }
      if (viewer2) { try { viewer2.pause(); viewer2.stopRendering(); } catch(_){} }
    } else if (target === 'panel-v2') {
      // lazy-load viewer2 if needed
      if (!viewer2) {
        try {
          // viewer2 also uses the shared control IDs; we prefer shahed.glb for this instance
          viewer2 = createViewer({
            containerId: 'escenario3D_v2',
            controlIds: { play: 'play_shared', step: 'stepForward_shared', stepBack: 'step_shared', seek: 'seek_shared', timeLabel: 'timeLabel_shared' },
            bindControls: false,
            // preferir shahed.glb en las rutas
            tryPaths: [ 'shahed.glb', 'multimedia/shahed.glb', 'multimedia/archivosblender/shahed.glb' ],
            autoStart: true
          });
        } catch (err) {
          console.error('No se pudo crear viewer2:', err);
        }
      } else {
        try { viewer2.startRendering(); activeViewer = viewer2; } catch(_){ }
      }
      if (viewer1) { try { viewer1.pause(); viewer1.stopRendering(); } catch(_){} }
    }
    // Actualizar la UI compartida para reflejar el viewer activo
    try {
      if (activeViewer) {
        const dur = (typeof activeViewer.getDuration === 'function') ? activeViewer.getDuration() : 0;
        if (seekShared) { seekShared.max = dur || 1; seekShared.step = Math.max(0.01, (dur || 1) / 200); seekShared.value = (typeof activeViewer.getTime === 'function') ? activeViewer.getTime() : 0; seekShared.disabled = !(dur > 0); }
        if (timeLabelShared) { timeLabelShared.textContent = `${((typeof activeViewer.getTime === 'function') ? activeViewer.getTime() : 0).toFixed(2)} / ${(dur || 0).toFixed(2)} s`; }
      }
    } catch (err) { console.warn('Error actualizando UI compartida:', err); }
  }
  tabs.forEach(tab => tab.addEventListener('click', (e) => activateTab(tab)));
  // ensure initial state
  const initial = document.querySelector('.tabs .tab.active') || document.querySelector('.tabs .tab');
  if (initial) activateTab(initial);
});

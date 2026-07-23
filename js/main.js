// HDR 2B Color - Script principal
// Three.js: orquesta un sistema de partículas GPU (GPGPU: sphere/vortex/explosion/waves) y uno legacy en CPU (grid/text)

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { AfterimagePass } from 'three/addons/postprocessing/AfterimagePass.js';
import { createGpuParticleSystem } from './particles-gpu.js';
import { createCpuParticleSystem, buildTextTargets } from './particles-cpu.js';

// Variables globales
let scene, camera, renderer, controls;
let composer, bloomPass, afterimagePass;
let particleTexture; // Textura para las partículas circulares
let clock = new THREE.Clock();
let animationMode = "sphere";

// Modos que corren en el sistema GPU (GPGPU) vs. el sistema legacy en CPU
const MODE_GROUP = { sphere: 'gpu', vortex: 'gpu', explosion: 'gpu', waves: 'gpu', grid: 'cpu', text: 'cpu' };
let gpuSystem, cpuSystem;
let groupTransition = null; // { fromSystem, toSystem, factor, speed } — crossfade de opacidad al cruzar entre grupos

let particleCount = 25000;
let particleSize = 0.05;
let particleSpeed = 0.5;
let bloomStrength = 1.5;
let bloomRadius = 0.75;
let bloomThreshold = 0.2;
let colorCycle = true;
let colorSpeed = 0.5;
let colorPalette = 'rainbow';
let trailsEnabled = false;
let trailAmount = 0.85;
let currentText = 'HDR';
let waveType = 'ripple'; // Variante activa del modo "waves"
let bgColor = '#000000';
let panelWidth = 320;

// Elementos DOM
let loadingScreen;
let settingsPanel;
let rangeParticleCount, rangeParticleSize, rangeParticleSpeed;
let rangeBloomStrength, rangeBloomRadius, rangeBloomThreshold;
let rangeColorSpeed, checkboxColorCycle;
let selectColorPalette, checkboxTrailsEnabled, rangeTrailAmount;
let textInput;
let selectWaveType;
let inputBgColor;
let btnTogglePanel, rightPanel;
let valueParticleCount, valueParticleSize, valueParticleSpeed;
let valueBloomStrength, valueBloomRadius, valueBloomThreshold;
let valueColorSpeed, valueTrailAmount;
let btnSphere, btnVortex, btnExplosion, btnWaves;

// Inicialización cuando el documento esté listo
window.addEventListener('DOMContentLoaded', init);

function init() {
    loadingScreen = document.getElementById('loading');
    settingsPanel = document.getElementById('settingsPanel');

    // Ocultar panel de ajustes inicialmente
    settingsPanel.style.display = 'none';

    // Obtener referencias a elementos del DOM para ajustes
    rangeParticleCount = document.getElementById('particleCount');
    rangeParticleSize = document.getElementById('particleSize');
    rangeParticleSpeed = document.getElementById('particleSpeed');
    rangeBloomStrength = document.getElementById('bloomStrength');
    rangeBloomRadius = document.getElementById('bloomRadius');
    rangeBloomThreshold = document.getElementById('bloomThreshold');
    rangeColorSpeed = document.getElementById('colorSpeed');
    checkboxColorCycle = document.getElementById('colorCycle');
    selectColorPalette = document.getElementById('colorPalette');
    checkboxTrailsEnabled = document.getElementById('trailsEnabled');
    rangeTrailAmount = document.getElementById('trailAmount');
    textInput = document.getElementById('textInput');
    selectWaveType = document.getElementById('waveType');
    inputBgColor = document.getElementById('bgColor');
    btnTogglePanel = document.getElementById('btnTogglePanel');
    rightPanel = document.querySelector('.right-panel');

    valueParticleCount = document.getElementById('valueParticleCount');
    valueParticleSize = document.getElementById('valueParticleSize');
    valueParticleSpeed = document.getElementById('valueParticleSpeed');
    valueBloomStrength = document.getElementById('valueBloomStrength');
    valueBloomRadius = document.getElementById('valueBloomRadius');
    valueBloomThreshold = document.getElementById('valueBloomThreshold');
    valueColorSpeed = document.getElementById('valueColorSpeed');
    valueTrailAmount = document.getElementById('valueTrailAmount');

    btnSphere = document.getElementById('btnSphere');
    btnVortex = document.getElementById('btnVortex');
    btnExplosion = document.getElementById('btnExplosion');
    btnWaves = document.getElementById('btnWaves');

    // Configurar valores iniciales
    rangeParticleCount.value = particleCount;
    rangeParticleSize.value = particleSize;
    rangeParticleSpeed.value = particleSpeed;
    rangeBloomStrength.value = bloomStrength;
    rangeBloomRadius.value = bloomRadius;
    rangeBloomThreshold.value = bloomThreshold;
    rangeColorSpeed.value = colorSpeed;
    checkboxColorCycle.checked = colorCycle;
    selectColorPalette.value = colorPalette;
    checkboxTrailsEnabled.checked = trailsEnabled;
    rangeTrailAmount.value = trailAmount;
    textInput.value = currentText;
    selectWaveType.value = waveType;
    inputBgColor.value = bgColor;

    valueParticleCount.textContent = particleCount;
    valueParticleSize.textContent = particleSize;
    valueParticleSpeed.textContent = particleSpeed;
    valueBloomStrength.textContent = bloomStrength;
    valueBloomRadius.textContent = bloomRadius;
    valueBloomThreshold.textContent = bloomThreshold;
    valueColorSpeed.textContent = colorSpeed;
    valueTrailAmount.textContent = trailAmount;

    // Agregar event listeners a los controles
    btnSphere.addEventListener('click', () => changeMode('sphere'));
    btnVortex.addEventListener('click', () => changeMode('vortex'));
    btnExplosion.addEventListener('click', () => changeMode('explosion'));
    document.getElementById('btnGrid').addEventListener('click', () => changeMode('grid'));
    btnWaves.addEventListener('click', () => changeMode('waves'));
    selectWaveType.addEventListener('change', () => {
        waveType = selectWaveType.value;
        gpuSystem.setWaveType(waveType);
        if (animationMode !== 'waves') changeMode('waves');
    });
    document.getElementById('btnText').addEventListener('click', () => {
        currentText = textInput.value.trim() || 'HDR';
        cpuSystem.setText(currentText);
        changeMode('text');
    });
    document.getElementById('btnSettings').addEventListener('click', toggleSettings);
    document.getElementById('btnClose').addEventListener('click', toggleSettings);
    btnTogglePanel.addEventListener('click', () => {
        const hidden = rightPanel.classList.toggle('panel-hidden');
        document.body.classList.toggle('panel-open', !hidden);
        btnTogglePanel.textContent = hidden ? '☰' : '✕';
        syncCanvasLayout();
    });

    textInput.addEventListener('input', () => {
        if (animationMode === 'text') {
            currentText = textInput.value.trim() || 'HDR';
            cpuSystem.setText(currentText);
        }
    });

    rangeParticleCount.addEventListener('input', () => {
        valueParticleCount.textContent = rangeParticleCount.value;
        particleCount = parseInt(rangeParticleCount.value);
        gpuSystem.setParticleCount(particleCount);
        cpuSystem.setParticleCount(particleCount);
    });
    rangeParticleSize.addEventListener('input', () => {
        valueParticleSize.textContent = rangeParticleSize.value;
        particleSize = parseFloat(rangeParticleSize.value);
        gpuSystem.setParticleSize(particleSize);
        cpuSystem.setParticleSize(particleSize);
    });
    rangeParticleSpeed.addEventListener('input', () => {
        valueParticleSpeed.textContent = rangeParticleSpeed.value;
        particleSpeed = parseFloat(rangeParticleSpeed.value);
        gpuSystem.setParticleSpeed(particleSpeed);
        cpuSystem.setParticleSpeed(particleSpeed);
    });
    rangeBloomStrength.addEventListener('input', () => {
        valueBloomStrength.textContent = rangeBloomStrength.value;
        bloomStrength = parseFloat(rangeBloomStrength.value);
        bloomPass.strength = bloomStrength;
    });
    rangeBloomRadius.addEventListener('input', () => {
        valueBloomRadius.textContent = rangeBloomRadius.value;
        bloomRadius = parseFloat(rangeBloomRadius.value);
        bloomPass.radius = bloomRadius;
    });
    rangeBloomThreshold.addEventListener('input', () => {
        valueBloomThreshold.textContent = rangeBloomThreshold.value;
        bloomThreshold = parseFloat(rangeBloomThreshold.value);
        bloomPass.threshold = bloomThreshold;
    });
    rangeColorSpeed.addEventListener('input', () => {
        valueColorSpeed.textContent = rangeColorSpeed.value;
        colorSpeed = parseFloat(rangeColorSpeed.value);
        gpuSystem.setColorSpeed(colorSpeed);
        cpuSystem.setColorSpeed(colorSpeed);
    });
    checkboxColorCycle.addEventListener('change', () => {
        colorCycle = checkboxColorCycle.checked;
        gpuSystem.setColorCycle(colorCycle);
        cpuSystem.setColorCycle(colorCycle);
    });
    selectColorPalette.addEventListener('change', () => {
        colorPalette = selectColorPalette.value;
        gpuSystem.setColorPalette(colorPalette);
        cpuSystem.setColorPalette(colorPalette);
    });
    checkboxTrailsEnabled.addEventListener('change', () => {
        trailsEnabled = checkboxTrailsEnabled.checked;
        afterimagePass.enabled = trailsEnabled;
    });
    rangeTrailAmount.addEventListener('input', () => {
        valueTrailAmount.textContent = rangeTrailAmount.value;
        trailAmount = parseFloat(rangeTrailAmount.value);
        afterimagePass.uniforms['damp'].value = trailAmount;
    });
    inputBgColor.addEventListener('input', () => {
        bgColor = inputBgColor.value;
        scene.background = new THREE.Color(bgColor);
    });

    // Iniciar Three.js
    initThree();
}

function initThree() {
    // Crear escena
    scene = new THREE.Scene();
    scene.background = new THREE.Color(bgColor);

    // Configurar cámara
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 3;

    // Crear renderizador
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.domElement.style.position = 'fixed';
    renderer.domElement.style.top = '0';
    renderer.domElement.style.left = '0';
    renderer.domElement.style.zIndex = '0';
    document.body.appendChild(renderer.domElement);
    syncCanvasLayout();

    // Controles de órbita
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;

    // Post-procesamiento para efecto HDR
    const renderScene = new RenderPass(scene, camera);
    bloomPass = new UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        bloomStrength,
        bloomRadius,
        bloomThreshold
    );

    afterimagePass = new AfterimagePass(trailAmount);
    afterimagePass.enabled = trailsEnabled;

    composer = new EffectComposer(renderer);
    composer.addPass(renderScene);
    composer.addPass(afterimagePass);
    composer.addPass(bloomPass);

    // Crear textura circular para partículas
    createCircleTexture();

    // Crear los dos sistemas de partículas (GPU y legacy CPU)
    const initialScale = window.innerHeight / 2;
    gpuSystem = createGpuParticleSystem({ renderer, particleTexture, initialScale });
    cpuSystem = createCpuParticleSystem({ particleTexture, initialScale });

    if (!gpuSystem.supported) {
        console.error('Este navegador/GPU no soporta texturas float — los modos Esfera, Vórtice, Explosión y Ondas requieren GPUComputationRenderer y quedan deshabilitados.');
        for (const btn of [btnSphere, btnVortex, btnExplosion, btnWaves]) {
            btn.disabled = true;
            btn.title = 'No disponible: tu navegador/GPU no soporta texturas float (WebGL)';
        }
        selectWaveType.disabled = true;
        animationMode = 'grid';
    }

    if (gpuSystem.object) scene.add(gpuSystem.object);
    scene.add(cpuSystem.object);

    const activeSystem = MODE_GROUP[animationMode] === 'gpu' ? gpuSystem : cpuSystem;
    activeSystem.object.visible = true;

    // Manejo de redimensionamiento de ventana
    window.addEventListener('resize', onWindowResize, false);

    // Ocultar pantalla de carga
    loadingScreen.style.display = 'none';

    // Iniciar bucle de animación
    animate();
}

// Función para crear una textura circular para las partículas
function createCircleTexture() {
    const canvas = document.createElement('canvas');
    const size = 128;
    canvas.width = size;
    canvas.height = size;

    const context = canvas.getContext('2d');

    // Dibujar un círculo con degradado
    const centerX = size / 2;
    const centerY = size / 2;
    const radius = size / 2;

    // Crear un gradiente radial
    const gradient = context.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.3, 'rgba(255, 255, 255, 0.8)');
    gradient.addColorStop(0.7, 'rgba(255, 255, 255, 0.3)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

    // Dibujar el círculo
    context.fillStyle = gradient;
    context.beginPath();
    context.arc(centerX, centerY, radius, 0, Math.PI * 2);
    context.fill();

    // Crear textura a partir del canvas
    particleTexture = new THREE.CanvasTexture(canvas);
    particleTexture.needsUpdate = true;
}

function animate() {
    requestAnimationFrame(animate);

    const delta = clock.getDelta();
    const elapsedTime = clock.getElapsedTime();

    if (gpuSystem.object && gpuSystem.object.visible) gpuSystem.update(delta, elapsedTime);
    if (cpuSystem.object.visible) cpuSystem.update(delta, elapsedTime);

    if (groupTransition) {
        groupTransition.factor = Math.min(1, groupTransition.factor + delta * groupTransition.speed);
        groupTransition.toSystem.setOpacity(groupTransition.factor);
        groupTransition.fromSystem.setOpacity(1 - groupTransition.factor);
        if (groupTransition.factor >= 1) {
            groupTransition.fromSystem.object.visible = false;
            groupTransition.fromSystem.setOpacity(1);
            groupTransition = null;
        }
    }

    controls.update();
    composer.render();
}

function changeMode(mode) {
    // No hacer nada si ya estamos en ese modo
    if (animationMode === mode) return;

    const oldGroup = MODE_GROUP[animationMode];
    const newGroup = MODE_GROUP[mode];
    if (newGroup === 'gpu' && !gpuSystem.supported) return;

    const previousModeForSystem = oldGroup === newGroup ? animationMode : null;
    animationMode = mode;

    const targetSystem = newGroup === 'gpu' ? gpuSystem : cpuSystem;
    const outgoingSystem = newGroup === 'gpu' ? cpuSystem : gpuSystem;

    targetSystem.setMode(mode, previousModeForSystem);
    targetSystem.object.visible = true;

    if (oldGroup !== newGroup) {
        groupTransition = { fromSystem: outgoingSystem, toSystem: targetSystem, factor: 0, speed: 2.0 };
    } else {
        groupTransition = null;
        outgoingSystem.object.visible = false;
    }
}

function toggleSettings() {
    if (settingsPanel.style.display === 'none') {
        settingsPanel.style.display = 'block';
    } else {
        settingsPanel.style.display = 'none';
    }
}

function syncCanvasLayout() {
    const isPanelVisible = !rightPanel.classList.contains('panel-hidden');
    const reservedWidth = isPanelVisible ? panelWidth : 0;
    const usableWidth = Math.max(0, window.innerWidth - reservedWidth);
    const usableHeight = window.innerHeight;

    document.documentElement.style.setProperty('--panel-width', `${panelWidth}px`);
    document.body.classList.toggle('panel-open', isPanelVisible);

    if (!camera || !renderer) return;

    camera.aspect = usableWidth / usableHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(usableWidth, usableHeight);

    if (composer) {
        composer.setSize(usableWidth, usableHeight);
    }

    if (gpuSystem && gpuSystem.object) gpuSystem.setScale(usableHeight / 2);
    if (cpuSystem && cpuSystem.object) cpuSystem.setScale(usableHeight / 2);
}

function onWindowResize() {
    panelWidth = Math.max(280, rightPanel.offsetWidth + 24);
    syncCanvasLayout();
}

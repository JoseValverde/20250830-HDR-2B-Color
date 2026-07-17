// HDR 2B Color - Script principalincipal
// Script basado en Three.js para crear efectos de partículas HDR

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { AfterimagePass } from 'three/addons/postprocessing/AfterimagePass.js';

// Variables globales
let scene, camera, renderer, controls;
let composer, bloomPass, afterimagePass;
let particles;
let particleTexture; // Textura para las partículas circulares
let clock = new THREE.Clock();
let animationMode = "sphere";
let previousMode = "sphere";
let transitionFactor = 1.0; // 0 = posición anterior, 1 = posición nueva
let isTransitioning = false;
let transitionSpeed = 2.0; // Velocidad de transición entre modos

// Arrays para los atributos de las partículas (accesibles globalmente)
let particleSizes;
let particlePositions;
let particleColors;
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
let textTargets = null; // Puntos {x, y} muestreados de la silueta del texto
let waveType = 'ripple'; // Variante activa del modo "waves"
let bgColor = '#000000';

// Paletas de color predefinidas (además de "rainbow", que usa HSL aleatorio)
const PALETTE_STOPS = {
    fuego: ['#3b0000', '#ff2200', '#ff9500', '#ffe600'],
    oceano: ['#001233', '#0074d9', '#39cccc', '#b3fff6'],
    neon: ['#ff00ff', '#7b2ff7', '#00e5ff', '#39ff14'],
    mono: ['#1a1a2e', '#4e4e8f', '#a5a5ff', '#ffffff'],
    pastel: ['#ffd1dc', '#ffe4b5', '#b5ead7', '#c7ceea'],
    atardecer: ['#2d0140', '#ff6b6b', '#ff9f45', '#ffd93d'],
    bosque: ['#0b3d0b', '#2e7d32', '#8bc34a', '#e6ffb3'],
    hielo: ['#001a33', '#0077b6', '#90e0ef', '#ffffff'],
    ultravioleta: ['#1a0033', '#6a0dad', '#c77dff', '#ff00ff'],
    oro: ['#2b1700', '#a67c00', '#ffd700', '#fff8dc'],
};
const PALETTE_COLORS = {};
for (const key in PALETTE_STOPS) {
    PALETTE_COLORS[key] = PALETTE_STOPS[key].map((hex) => new THREE.Color(hex));
}

// Escribe en `target` el color de la paleta activa para el parámetro t (0-1)
function paletteColor(t, target) {
    if (colorPalette === 'rainbow') {
        return target.setHSL(t, 1, 0.5 + Math.random() * 0.4);
    }
    const stops = PALETTE_COLORS[colorPalette] || PALETTE_COLORS.neon;
    const scaled = Math.min(Math.max(t, 0), 1) * (stops.length - 1);
    const idx = Math.min(Math.floor(scaled), stops.length - 2);
    const localT = scaled - idx;
    return target.lerpColors(stops[idx], stops[idx + 1], localT);
}

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
    document.getElementById('btnSphere').addEventListener('click', () => changeMode('sphere'));
    document.getElementById('btnVortex').addEventListener('click', () => changeMode('vortex'));
    document.getElementById('btnExplosion').addEventListener('click', () => changeMode('explosion'));
    document.getElementById('btnGrid').addEventListener('click', () => changeMode('grid'));
    document.getElementById('btnWaves').addEventListener('click', () => changeMode('waves'));
    selectWaveType.addEventListener('change', () => {
        waveType = selectWaveType.value;
        if (animationMode !== 'waves') changeMode('waves');
    });
    document.getElementById('btnText').addEventListener('click', () => {
        currentText = textInput.value.trim() || 'HDR';
        textTargets = buildTextTargets(currentText);
        changeMode('text');
    });
    document.getElementById('btnSettings').addEventListener('click', toggleSettings);
    document.getElementById('btnClose').addEventListener('click', toggleSettings);
    btnTogglePanel.addEventListener('click', () => {
        const hidden = rightPanel.classList.toggle('panel-hidden');
        btnTogglePanel.textContent = hidden ? '☰' : '✕';
    });

    textInput.addEventListener('input', () => {
        if (animationMode === 'text') {
            currentText = textInput.value.trim() || 'HDR';
            textTargets = buildTextTargets(currentText);
        }
    });

    rangeParticleCount.addEventListener('input', () => {
        valueParticleCount.textContent = rangeParticleCount.value;
        particleCount = parseInt(rangeParticleCount.value);
        createParticles();
    });
    rangeParticleSize.addEventListener('input', () => {
        valueParticleSize.textContent = rangeParticleSize.value;
        particleSize = parseFloat(rangeParticleSize.value);
        createParticles();
    });
    rangeParticleSpeed.addEventListener('input', () => {
        valueParticleSpeed.textContent = rangeParticleSpeed.value;
        particleSpeed = parseFloat(rangeParticleSpeed.value);
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
    });
    checkboxColorCycle.addEventListener('change', () => {
        colorCycle = checkboxColorCycle.checked;
    });
    selectColorPalette.addEventListener('change', () => {
        colorPalette = selectColorPalette.value;
        createParticles();
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
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    document.body.appendChild(renderer.domElement);
    
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
    
    // Crear sistema de partículas
    createParticles();
    
    // Manejo de redimensionamiento de ventana
    window.addEventListener('resize', onWindowResize, false);
    
    // Ocultar pantalla de carga
    loadingScreen.style.display = 'none';
    
    // Iniciar bucle de animación
    animate();
}

function createParticles() {
    // Eliminar partículas existentes si las hay
    if (particles) {
        scene.remove(particles);
    }
    
    const geometry = new THREE.BufferGeometry();
    
    // Crear arrays para posición, color y tamaño, y asignarlos a las variables globales
    particlePositions = new Float32Array(particleCount * 3);
    particleColors = new Float32Array(particleCount * 3);
    particleSizes = new Float32Array(particleCount);
    
    const color = new THREE.Color();
    
    for (let i = 0; i < particleCount; i++) {
        // Posición inicial en esfera
        const radius = Math.random() * 2;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.random() * Math.PI;

        particlePositions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
        particlePositions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
        particlePositions[i * 3 + 2] = radius * Math.cos(phi);

        // Color según la paleta activa
        paletteColor(Math.random(), color);
        particleColors[i * 3] = color.r;
        particleColors[i * 3 + 1] = color.g;
        particleColors[i * 3 + 2] = color.b;

        // Tamaño aleatorio dentro de un rango
        particleSizes[i] = particleSize * (0.5 + Math.random() * 0.5);
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(particleColors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(particleSizes, 1));

    const material = new THREE.ShaderMaterial({
        uniforms: {
            pointTexture: { value: particleTexture },
            scale: { value: window.innerHeight / 2 }
        },
        vertexShader: `
            attribute float size;
            attribute vec3 color;
            varying vec3 vColor;
            uniform float scale;
            void main() {
                vColor = color;
                vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                gl_PointSize = size * (scale / -mvPosition.z);
                gl_Position = projectionMatrix * mvPosition;
            }
        `,
        fragmentShader: `
            uniform sampler2D pointTexture;
            varying vec3 vColor;
            void main() {
                vec4 texColor = texture2D(pointTexture, gl_PointCoord);
                if (texColor.a < 0.05) discard;
                gl_FragColor = vec4(vColor, texColor.a * 0.8);
            }
        `,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false // Mejora la renderización de partículas superpuestas
    });

    particles = new THREE.Points(geometry, material);
    scene.add(particles);
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
    
    if (particles) {
        updateParticles(delta, elapsedTime);
    }
    
    controls.update();
    composer.render();
}

// Calcula el desplazamiento {x, y, z} de un punto de la rejilla del modo "waves"
// según la variante de onda activa (tx, tz = posición base en la rejilla; t = tiempo * velocidad)
function computeWaveOffset(type, tx, tz, dist, t) {
    switch (type) {
        case 'interference': {
            // Dos focos emisores cuyas ondas circulares se cruzan y generan un patrón de interferencia
            const d1 = Math.hypot(tx - (-0.9), tz - 0);
            const d2 = Math.hypot(tx - 0.9, tz - 0);
            const y = (Math.sin(d1 * 4.5 - t * 2) + Math.sin(d2 * 4.5 - t * 2)) * 0.22;
            return { x: 0, y, z: 0 };
        }
        case 'ocean': {
            // Suma de ondas Gerstner (distinta dirección/longitud/velocidad) para oleaje realista con cresta
            const waves = [
                { dx: 1.0, dz: 0.2, k: 2.2, speed: 1.2, amp: 0.22, steepness: 0.5 },
                { dx: 0.3, dz: 1.0, k: 3.4, speed: 0.9, amp: 0.12, steepness: 0.4 },
            ];
            let ox = 0, oy = 0, oz = 0;
            for (const w of waves) {
                const len = Math.hypot(w.dx, w.dz);
                const dirX = w.dx / len, dirZ = w.dz / len;
                const phase = (dirX * tx + dirZ * tz) * w.k - t * w.speed;
                oy += w.amp * Math.sin(phase);
                ox += w.steepness * w.amp * dirX * Math.cos(phase);
                oz += w.steepness * w.amp * dirZ * Math.cos(phase);
            }
            return { x: ox, y: oy, z: oz };
        }
        case 'spiral': {
            // La fase depende del ángulo además de la distancia, así el frente de onda gira sobre el centro
            const angle = Math.atan2(tz, tx);
            const y = Math.sin(dist * 3.0 - t * 1.5 + angle * 4) * 0.35;
            return { x: 0, y, z: 0 };
        }
        case 'pulse': {
            // Anillos que laten hacia afuera desde el centro, atenuándose con la distancia
            const pulseSpeed = 2.2, spacing = 1.6;
            const front = ((dist - t * pulseSpeed) % spacing + spacing) % spacing;
            const ring = Math.pow(Math.max(0, Math.cos(front * Math.PI / spacing)), 8);
            const falloff = 1 / (1 + dist * 0.4);
            return { x: 0, y: ring * 0.6 * falloff, z: 0 };
        }
        case 'noise': {
            // Suma de senos con frecuencias y fases incoherentes: movimiento orgánico, no periódico a simple vista
            const y = (
                Math.sin(tx * 2.1 + t * 0.7) +
                Math.sin(tz * 1.7 - t * 0.9 + 1.3) +
                Math.sin((tx + tz) * 1.3 + t * 0.5 + 2.7) +
                Math.sin((tx - tz) * 2.7 - t * 1.1 + 4.1)
            ) * 0.1;
            return { x: 0, y, z: 0 };
        }
        case 'square': {
            // Onda cuadrada (suavizada con tanh, look "digital") combinada con una onda triangular
            const squareWave = Math.tanh(Math.sin(dist * 3.0 - t) * 6) * 0.4;
            const triangleWave = (2 / Math.PI) * Math.asin(Math.sin(tx * 1.5 + t * 0.6)) * 0.15;
            return { x: 0, y: squareWave + triangleWave, z: 0 };
        }
        case 'ripple':
        default: {
            // Ondas radiales concéntricas superpuestas a una ondulación direccional suave
            const y = Math.sin(dist * 3.0 - t) * 0.4 + Math.sin(tx * 1.5 + t * 0.6) * 0.15;
            return { x: 0, y, z: 0 };
        }
    }
}

function updateParticles(delta, elapsedTime) {
    const positions = particles.geometry.attributes.position.array;
    const colors = particles.geometry.attributes.color.array;
    const color = new THREE.Color();
    
    // Actualizar factor de transición si estamos en transición
    if (isTransitioning) {
        transitionFactor += delta * transitionSpeed;
        if (transitionFactor >= 1.0) {
            transitionFactor = 1.0;
            isTransitioning = false;
        }
    }
    
    // Actualizar posiciones según el modo de animación
    for (let i = 0; i < particleCount; i++) {
        const i3 = i * 3;
        const x = particlePositions[i3];
        const y = particlePositions[i3 + 1];
        const z = particlePositions[i3 + 2];
        
        switch (animationMode) {
            case "sphere":
                // Movimiento de esfera pulsante
                const radius = Math.sqrt(x*x + y*y + z*z);
                const targetRadius = 1.0 + 0.5 * Math.sin(elapsedTime * particleSpeed);
                const factor = 1.0 + (targetRadius / radius - 1.0) * delta * particleSpeed * 2;
                
                particlePositions[i3] = x * factor;
                particlePositions[i3 + 1] = y * factor;
                particlePositions[i3 + 2] = z * factor;
                break;
                
            case "vortex":
                // Movimiento de vórtice
                const angle = particleSpeed * delta;
                const cosAngle = Math.cos(angle);
                const sinAngle = Math.sin(angle);
                
                particlePositions[i3] = x * cosAngle - z * sinAngle;
                particlePositions[i3 + 2] = z * cosAngle + x * sinAngle;
                particlePositions[i3 + 1] += Math.sin(elapsedTime * 2 + i * 0.01) * 0.01;
                break;
                
            case "explosion":
                // Movimiento de explosión
                const distance = Math.sqrt(x*x + y*y + z*z);
                const direction = new THREE.Vector3(x, y, z).normalize();
                const speed = particleSpeed * (0.5 + Math.random() * 0.5) * delta;
                
                // Si estamos en transición, mover hacia el centro gradualmente
                if (isTransitioning && previousMode !== "explosion") {
                    // Calcular posición objetivo para explosión (cercana al centro)
                    const targetX = (Math.random() - 0.5) * 0.2;
                    const targetY = (Math.random() - 0.5) * 0.2;
                    const targetZ = (Math.random() - 0.5) * 0.2;
                    
                    // Interpolar entre posición actual y objetivo
                    particlePositions[i3] = x * (1 - transitionFactor * 0.1) + targetX * transitionFactor * 0.1;
                    particlePositions[i3 + 1] = y * (1 - transitionFactor * 0.1) + targetY * transitionFactor * 0.1;
                    particlePositions[i3 + 2] = z * (1 - transitionFactor * 0.1) + targetZ * transitionFactor * 0.1;
                } else {
                    // Comportamiento normal de explosión
                    particlePositions[i3] += direction.x * speed;
                    particlePositions[i3 + 1] += direction.y * speed;
                    particlePositions[i3 + 2] += direction.z * speed;
                    
                    // Resetear partículas que se alejan demasiado
                    if (distance > 10) {
                        particlePositions[i3] = (Math.random() - 0.5) * 0.2;
                        particlePositions[i3 + 1] = (Math.random() - 0.5) * 0.2;
                        particlePositions[i3 + 2] = (Math.random() - 0.5) * 0.2;
                    }
                }
                break;
                
            case "grid":
                // Si estamos en transición, mover gradualmente hacia posiciones de grid
                if (isTransitioning && previousMode !== "grid") {
                    // Transición hacia el nuevo modo de distribución inspirada en la imagen de referencia
                    
                    // Parámetros para controlar la distribución
                    const maxDistance = 3.0; // Distancia máxima desde el centro
                    const coreSize = 0.8; // Tamaño del núcleo central más denso
                    
                    // Dividimos las partículas en diferentes zonas para el efecto visual
                    const zoneIndex = Math.floor(i / particleCount * 4); // 4 zonas diferentes
                    
                    // Calcular posición objetivo para esta partícula
                    let targetX = 0, targetY = 0, targetZ = 0;
                    let distanceFactor, angle, radius, height;
                    
                    // Distribución diferente según la zona para crear el patrón visual de la imagen
                    if (zoneIndex === 0) {
                        // Zona central más densa (núcleo amarillo/verde brillante)
                        distanceFactor = Math.pow(Math.random(), 3) * coreSize; // Concentración en centro
                        angle = Math.random() * Math.PI * 2;
                        radius = distanceFactor * maxDistance;
                        height = (Math.random() * 2 - 1) * distanceFactor * maxDistance;
                        
                        // Asignar colores objetivo para transición suave
                        const colorFactor = transitionFactor * 0.05;
                        particleColors[i3] = particleColors[i3] * (1 - colorFactor) + (0.8 + Math.random() * 0.2) * colorFactor; // R - alto
                        particleColors[i3 + 1] = particleColors[i3 + 1] * (1 - colorFactor) + (0.7 + Math.random() * 0.3) * colorFactor; // G - alto
                        particleColors[i3 + 2] = particleColors[i3 + 2] * (1 - colorFactor) + (0.2 + Math.random() * 0.2) * colorFactor; // B - bajo
                    } 
                    else if (zoneIndex === 1) {
                        // Zona intermedia (transición)
                        distanceFactor = coreSize + (1 - coreSize) * Math.pow(Math.random(), 0.5);
                        angle = Math.random() * Math.PI * 2;
                        radius = distanceFactor * maxDistance;
                        height = (Math.random() * 2 - 1) * maxDistance;
                        
                        // Colores de transición
                        const transitionColorFactor = Math.random();
                        const colorFactor = transitionFactor * 0.05;
                        particleColors[i3] = particleColors[i3] * (1 - colorFactor) + (0.5 + transitionColorFactor * 0.3) * colorFactor; // R - medio-alto
                        particleColors[i3 + 1] = particleColors[i3 + 1] * (1 - colorFactor) + (0.4 + transitionColorFactor * 0.4) * colorFactor; // G - medio
                        particleColors[i3 + 2] = particleColors[i3 + 2] * (1 - colorFactor) + (0.3 + transitionColorFactor * 0.3) * colorFactor; // B - medio-bajo
                    }
                    else if (zoneIndex === 2) {
                        // Zona exterior con distribución lateral (como los rayos en la imagen)
                        distanceFactor = coreSize + (1 - coreSize) * Math.pow(Math.random(), 0.5);
                        // Ángulos limitados para formar "rayos" laterales
                        const angleOffset = Math.PI * 0.5 * Math.floor(Math.random() * 4);
                        angle = angleOffset + (Math.random() * 0.3 - 0.15);
                        radius = distanceFactor * maxDistance;
                        height = (Math.random() * 2 - 1) * maxDistance * 0.5;
                        
                        // Colores tendiendo al morado/rosa
                        const colorFactor = transitionFactor * 0.05;
                        particleColors[i3] = particleColors[i3] * (1 - colorFactor) + (0.4 + Math.random() * 0.3) * colorFactor; // R - medio
                        particleColors[i3 + 1] = particleColors[i3 + 1] * (1 - colorFactor) + (0.1 + Math.random() * 0.2) * colorFactor; // G - bajo
                        particleColors[i3 + 2] = particleColors[i3 + 2] * (1 - colorFactor) + (0.5 + Math.random() * 0.5) * colorFactor; // B - alto
                    }
                    else {
                        // Zona exterior más dispersa (fondo con partículas rosadas/moradas)
                        distanceFactor = 0.7 + Math.random() * 0.3;
                        angle = Math.random() * Math.PI * 2;
                        radius = distanceFactor * maxDistance;
                        height = (Math.random() * 2 - 1) * maxDistance;
                        
                        // Colores tendiendo al morado/rosa/azul
                        const colorFactor = transitionFactor * 0.05;
                        particleColors[i3] = particleColors[i3] * (1 - colorFactor) + (0.3 + Math.random() * 0.3) * colorFactor; // R - medio-bajo
                        particleColors[i3 + 1] = particleColors[i3 + 1] * (1 - colorFactor) + (0.05 + Math.random() * 0.1) * colorFactor; // G - muy bajo
                        particleColors[i3 + 2] = particleColors[i3 + 2] * (1 - colorFactor) + (0.6 + Math.random() * 0.4) * colorFactor; // B - alto
                    }
                    
                    // Calcular posiciones target
                    const time = elapsedTime * 0.3;
                    radius += Math.sin(time + angle * 3) * 0.05 * radius;
                    
                    // Convertir coordenadas polares a cartesianas
                    targetX = Math.cos(angle) * radius;
                    targetZ = Math.sin(angle) * radius;
                    targetY = height;
                    
                    // Interpolar entre posición actual y objetivo
                    particlePositions[i3] = x * (1 - transitionFactor * 0.1) + targetX * transitionFactor * 0.1;
                    particlePositions[i3 + 1] = y * (1 - transitionFactor * 0.1) + targetY * transitionFactor * 0.1;
                    particlePositions[i3 + 2] = z * (1 - transitionFactor * 0.1) + targetZ * transitionFactor * 0.1;
                    
                    // Ajustar tamaño de partícula durante la transición
                    const sizeBase = 0.8;
                    const sizeFactor = (zoneIndex === 0) ? 1.2 : sizeBase;
                    particleSizes[i] = particleSizes[i] * (1 - transitionFactor * 0.1) + (particleSize * (1 - distanceFactor * 0.3) * sizeFactor) * transitionFactor * 0.1;

                    // Hacer visible la partícula si estaba invisible
                    if (particleSizes[i] < particleSize * 0.1) particleSizes[i] = particleSize * 0.1;
                } else {
                    // Nuevo sistema de distribución de partículas inspirado en la imagen de referencia
                    // Creamos un efecto de explosión/vórtice con degradado de colores
                    
                    // Parámetros para controlar la distribución
                    const maxDistance = 3.0; // Distancia máxima desde el centro
                    const coreSize = 0.8; // Tamaño del núcleo central más denso
                    const coreIntensity = 0.8; // Densidad del núcleo central (0-1)
                    
                    // Dividimos las partículas en diferentes zonas para el efecto visual
                    const zoneIndex = Math.floor(i / particleCount * 4); // 4 zonas diferentes
                    
                    // Calcular distancia base desde el centro para esta partícula
                    let distanceFactor;
                    let angle, radius, height;
                    
                    // Distribución diferente según la zona para crear el patrón visual de la imagen
                    if (zoneIndex === 0) {
                        // Zona central más densa (núcleo amarillo/verde brillante)
                        distanceFactor = Math.pow(Math.random(), 3) * coreSize; // Concentración en centro
                        angle = Math.random() * Math.PI * 2;
                        radius = distanceFactor * maxDistance;
                        height = (Math.random() * 2 - 1) * distanceFactor * maxDistance;
                        
                        // Establecer colores para esta zona (amarillo/verde brillante)
                        particleColors[i3] = 0.8 + Math.random() * 0.2; // R - alto
                        particleColors[i3 + 1] = 0.7 + Math.random() * 0.3; // G - alto
                        particleColors[i3 + 2] = 0.2 + Math.random() * 0.2; // B - bajo
                    } 
                    else if (zoneIndex === 1) {
                        // Zona intermedia (transición)
                        distanceFactor = coreSize + (1 - coreSize) * Math.pow(Math.random(), 0.5);
                        angle = Math.random() * Math.PI * 2;
                        radius = distanceFactor * maxDistance;
                        height = (Math.random() * 2 - 1) * maxDistance;
                        
                        // Colores de transición
                        const transitionFactor = Math.random();
                        particleColors[i3] = 0.5 + transitionFactor * 0.3; // R - medio-alto
                        particleColors[i3 + 1] = 0.4 + transitionFactor * 0.4; // G - medio
                        particleColors[i3 + 2] = 0.3 + transitionFactor * 0.3; // B - medio-bajo
                    }
                    else if (zoneIndex === 2) {
                        // Zona exterior con distribución lateral (como los rayos en la imagen)
                        distanceFactor = coreSize + (1 - coreSize) * Math.pow(Math.random(), 0.5);
                        // Ángulos limitados para formar "rayos" laterales
                        const angleOffset = Math.PI * 0.5 * Math.floor(Math.random() * 4);
                        angle = angleOffset + (Math.random() * 0.3 - 0.15);
                        radius = distanceFactor * maxDistance;
                        height = (Math.random() * 2 - 1) * maxDistance * 0.5;
                        
                        // Colores tendiendo al morado/rosa
                        particleColors[i3] = 0.4 + Math.random() * 0.3; // R - medio
                        particleColors[i3 + 1] = 0.1 + Math.random() * 0.2; // G - bajo
                        particleColors[i3 + 2] = 0.5 + Math.random() * 0.5; // B - alto
                    }
                    else {
                        // Zona exterior más dispersa (fondo con partículas rosadas/moradas)
                        distanceFactor = 0.7 + Math.random() * 0.3;
                        angle = Math.random() * Math.PI * 2;
                        radius = distanceFactor * maxDistance;
                        height = (Math.random() * 2 - 1) * maxDistance;
                        
                        // Colores tendiendo al morado/rosa/azul
                        particleColors[i3] = 0.3 + Math.random() * 0.3; // R - medio-bajo
                        particleColors[i3 + 1] = 0.05 + Math.random() * 0.1; // G - muy bajo
                        particleColors[i3 + 2] = 0.6 + Math.random() * 0.4; // B - alto
                    }
                    
                    // Aplicar movimiento radial ondulante
                    const time = elapsedTime * 0.3;
                    const waveSpeed = 0.5;
                    const waveIntensity = 0.05;
                    
                    // Calcular posiciones con ondulaciones
                    radius += Math.sin(time + angle * 3) * waveIntensity * radius;
                    
                    // Convertir coordenadas polares a cartesianas
                    particlePositions[i3] = Math.cos(angle) * radius;
                    particlePositions[i3 + 2] = Math.sin(angle) * radius;
                    particlePositions[i3 + 1] = height;
                    
                    // Añadir movimiento adicional para las partículas
                    const particleMovementSpeed = 0.1;
                    particlePositions[i3] += Math.sin(time * waveSpeed + i * 0.1) * particleMovementSpeed;
                    particlePositions[i3 + 1] += Math.cos(time * waveSpeed + i * 0.2) * particleMovementSpeed;
                    particlePositions[i3 + 2] += Math.sin(time * waveSpeed + i * 0.15) * particleMovementSpeed;
                    
                    // Ajustar tamaño de partícula según la distancia (opcional)
                    const sizeBase = 0.8;
                    const sizeFactor = (zoneIndex === 0) ? 1.2 : sizeBase;
                    particleSizes[i] = particleSize * (1 - distanceFactor * 0.3) * sizeFactor;
                }
                break;

            case "waves": {
                // Rejilla plana en XZ con desplazamiento determinado por la variante de onda activa (waveType)
                const gridSize = Math.max(2, Math.round(Math.sqrt(particleCount)));
                const spacing = 3.5 / gridSize;
                const ix = i % gridSize;
                const iz = Math.floor(i / gridSize) % gridSize;
                const baseX = (ix - gridSize / 2) * spacing;
                const baseZ = (iz - gridSize / 2) * spacing;
                const dist = Math.sqrt(baseX * baseX + baseZ * baseZ);
                const t = elapsedTime * particleSpeed;
                const waveOffset = computeWaveOffset(waveType, baseX, baseZ, dist, t);
                const targetX = baseX + waveOffset.x;
                const targetZ = baseZ + waveOffset.z;
                const targetY = waveOffset.y;

                if (isTransitioning && previousMode !== "waves") {
                    particlePositions[i3] = x * (1 - transitionFactor) + targetX * transitionFactor;
                    particlePositions[i3 + 1] = y * (1 - transitionFactor) + targetY * transitionFactor;
                    particlePositions[i3 + 2] = z * (1 - transitionFactor) + targetZ * transitionFactor;
                } else {
                    particlePositions[i3] = targetX;
                    particlePositions[i3 + 1] = targetY;
                    particlePositions[i3 + 2] = targetZ;
                }
                break;
            }

            case "text": {
                // Posiciones objetivo muestreadas de la silueta del texto (canvas 2D)
                let targetX = 0, targetY = 0, targetZ = 0;
                if (textTargets && textTargets.length > 0) {
                    const p = textTargets[i % textTargets.length];
                    targetX = p.x;
                    targetY = p.y;
                    targetZ = Math.sin(i * 12.9898) * 0.08; // jitter de profundidad determinista
                }

                if (isTransitioning && previousMode !== "text") {
                    particlePositions[i3] = x * (1 - transitionFactor) + targetX * transitionFactor;
                    particlePositions[i3 + 1] = y * (1 - transitionFactor) + targetY * transitionFactor;
                    particlePositions[i3 + 2] = z * (1 - transitionFactor) + targetZ * transitionFactor;
                } else {
                    const wobble = Math.sin(elapsedTime * particleSpeed + i * 0.05) * 0.01;
                    particlePositions[i3] = targetX + wobble;
                    particlePositions[i3 + 1] = targetY + wobble;
                    particlePositions[i3 + 2] = targetZ;
                }
                break;
            }
        }
        
        // Actualizar colores si está activado el ciclo de color
        if (colorCycle) {
            const hue = (elapsedTime * colorSpeed * 0.1 + i * 0.001) % 1.0;
            paletteColor(hue, color);

            particleColors[i3] = particleColors[i3] * 0.95 + color.r * 0.05;
            particleColors[i3 + 1] = particleColors[i3 + 1] * 0.95 + color.g * 0.05;
            particleColors[i3 + 2] = particleColors[i3 + 2] * 0.95 + color.b * 0.05;
        }
    }
    
    particles.geometry.attributes.position.needsUpdate = true;
    particles.geometry.attributes.color.needsUpdate = true;
    particles.geometry.attributes.size.needsUpdate = true;
}

// Muestrea la silueta de un texto dibujado en un canvas 2D y devuelve
// una lista de puntos {x, y} normalizados para usarlos como objetivos de partículas
function buildTextTargets(text) {
    const width = 512;
    const height = 128;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 100px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, width / 2, height / 2);

    const data = ctx.getImageData(0, 0, width, height).data;
    const points = [];
    for (let y = 0; y < height; y += 2) {
        for (let x = 0; x < width; x += 2) {
            const alpha = data[(y * width + x) * 4];
            if (alpha > 128) {
                points.push({
                    x: (x / width - 0.5) * 4,
                    y: -(y / height - 0.5) * 1
                });
            }
        }
    }
    return points.length > 0 ? points : null;
}

function changeMode(mode) {
    // No hacer nada si ya estamos en ese modo
    if (animationMode === mode) return;
    
    // Guardar el modo anterior y establecer el nuevo
    previousMode = animationMode;
    animationMode = mode;
    
    // Iniciar transición
    isTransitioning = true;
    transitionFactor = 0.0;
}

function toggleSettings() {
    if (settingsPanel.style.display === 'none') {
        settingsPanel.style.display = 'block';
    } else {
        settingsPanel.style.display = 'none';
    }
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);

    if (particles) {
        particles.material.uniforms.scale.value = window.innerHeight / 2;
    }
}

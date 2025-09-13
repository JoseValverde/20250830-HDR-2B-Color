// HDR 1B COLORS - Script principal
// Script basado en Three.js para crear efectos de partículas HDR

import * as THREE from 'https://cdn.skypack.dev/three@0.136.0';
import { OrbitControls } from 'https://cdn.skypack.dev/three@0.136.0/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'https://cdn.skypack.dev/three@0.136.0/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'https://cdn.skypack.dev/three@0.136.0/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'https://cdn.skypack.dev/three@0.136.0/examples/jsm/postprocessing/UnrealBloomPass.js';

// Variables globales
let scene, camera, renderer, controls;
let composer, bloomPass;
let particles;
let clock = new THREE.Clock();
let animationMode = "sphere";
let particleCount = 25000;
let particleSize = 0.05;
let particleSpeed = 0.5;
let bloomStrength = 1.5;
let bloomRadius = 0.75;
let bloomThreshold = 0.2;
let colorCycle = true;
let colorSpeed = 0.5;

// Elementos DOM
let loadingScreen;
let settingsPanel;
let rangeParticleCount, rangeParticleSize, rangeParticleSpeed;
let rangeBloomStrength, rangeBloomRadius, rangeBloomThreshold;
let rangeColorSpeed, checkboxColorCycle;
let valueParticleCount, valueParticleSize, valueParticleSpeed;
let valueBloomStrength, valueBloomRadius, valueBloomThreshold;
let valueColorSpeed;

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
    
    valueParticleCount = document.getElementById('valueParticleCount');
    valueParticleSize = document.getElementById('valueParticleSize');
    valueParticleSpeed = document.getElementById('valueParticleSpeed');
    valueBloomStrength = document.getElementById('valueBloomStrength');
    valueBloomRadius = document.getElementById('valueBloomRadius');
    valueBloomThreshold = document.getElementById('valueBloomThreshold');
    valueColorSpeed = document.getElementById('valueColorSpeed');
    
    // Configurar valores iniciales
    rangeParticleCount.value = particleCount;
    rangeParticleSize.value = particleSize;
    rangeParticleSpeed.value = particleSpeed;
    rangeBloomStrength.value = bloomStrength;
    rangeBloomRadius.value = bloomRadius;
    rangeBloomThreshold.value = bloomThreshold;
    rangeColorSpeed.value = colorSpeed;
    checkboxColorCycle.checked = colorCycle;
    
    valueParticleCount.textContent = particleCount;
    valueParticleSize.textContent = particleSize;
    valueParticleSpeed.textContent = particleSpeed;
    valueBloomStrength.textContent = bloomStrength;
    valueBloomRadius.textContent = bloomRadius;
    valueBloomThreshold.textContent = bloomThreshold;
    valueColorSpeed.textContent = colorSpeed;
    
    // Agregar event listeners a los controles
    document.getElementById('btnSphere').addEventListener('click', () => changeMode('sphere'));
    document.getElementById('btnVortex').addEventListener('click', () => changeMode('vortex'));
    document.getElementById('btnExplosion').addEventListener('click', () => changeMode('explosion'));
    document.getElementById('btnGrid').addEventListener('click', () => changeMode('grid'));
    document.getElementById('btnSettings').addEventListener('click', toggleSettings);
    document.getElementById('btnApply').addEventListener('click', applySettings);
    document.getElementById('btnClose').addEventListener('click', toggleSettings);
    
    rangeParticleCount.addEventListener('input', () => {
        valueParticleCount.textContent = rangeParticleCount.value;
    });
    rangeParticleSize.addEventListener('input', () => {
        valueParticleSize.textContent = rangeParticleSize.value;
    });
    rangeParticleSpeed.addEventListener('input', () => {
        valueParticleSpeed.textContent = rangeParticleSpeed.value;
    });
    rangeBloomStrength.addEventListener('input', () => {
        valueBloomStrength.textContent = rangeBloomStrength.value;
    });
    rangeBloomRadius.addEventListener('input', () => {
        valueBloomRadius.textContent = rangeBloomRadius.value;
    });
    rangeBloomThreshold.addEventListener('input', () => {
        valueBloomThreshold.textContent = rangeBloomThreshold.value;
    });
    rangeColorSpeed.addEventListener('input', () => {
        valueColorSpeed.textContent = rangeColorSpeed.value;
    });
    
    // Iniciar Three.js
    initThree();
}

function initThree() {
    // Crear escena
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);
    
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
    
    composer = new EffectComposer(renderer);
    composer.addPass(renderScene);
    composer.addPass(bloomPass);
    
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
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);
    
    const color = new THREE.Color();
    
    for (let i = 0; i < particleCount; i++) {
        // Posición inicial en esfera
        const radius = Math.random() * 2;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.random() * Math.PI;
        
        positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
        positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
        positions[i * 3 + 2] = radius * Math.cos(phi);
        
        // Color vibrante aleatorio
        color.setHSL(Math.random(), 1, 0.5 + Math.random() * 0.5);
        colors[i * 3] = color.r;
        colors[i * 3 + 1] = color.g;
        colors[i * 3 + 2] = color.b;
        
        // Tamaño aleatorio dentro de un rango
        sizes[i] = particleSize * (0.5 + Math.random() * 0.5);
    }
    
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    
    const material = new THREE.PointsMaterial({
        size: particleSize,
        vertexColors: true,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending
    });
    
    particles = new THREE.Points(geometry, material);
    scene.add(particles);
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

function updateParticles(delta, elapsedTime) {
    const positions = particles.geometry.attributes.position.array;
    const colors = particles.geometry.attributes.color.array;
    const color = new THREE.Color();
    
    // Actualizar posiciones según el modo de animación
    for (let i = 0; i < particleCount; i++) {
        const i3 = i * 3;
        const x = positions[i3];
        const y = positions[i3 + 1];
        const z = positions[i3 + 2];
        
        switch (animationMode) {
            case "sphere":
                // Movimiento de esfera pulsante
                const radius = Math.sqrt(x*x + y*y + z*z);
                const targetRadius = 1.0 + 0.5 * Math.sin(elapsedTime * particleSpeed);
                const factor = 1.0 + (targetRadius / radius - 1.0) * delta * particleSpeed * 2;
                
                positions[i3] = x * factor;
                positions[i3 + 1] = y * factor;
                positions[i3 + 2] = z * factor;
                break;
                
            case "vortex":
                // Movimiento de vórtice
                const angle = particleSpeed * delta;
                const cosAngle = Math.cos(angle);
                const sinAngle = Math.sin(angle);
                
                positions[i3] = x * cosAngle - z * sinAngle;
                positions[i3 + 2] = z * cosAngle + x * sinAngle;
                positions[i3 + 1] += Math.sin(elapsedTime * 2 + i * 0.01) * 0.01;
                break;
                
            case "explosion":
                // Movimiento de explosión
                const distance = Math.sqrt(x*x + y*y + z*z);
                const direction = new THREE.Vector3(x, y, z).normalize();
                const speed = particleSpeed * (0.5 + Math.random() * 0.5) * delta;
                
                positions[i3] += direction.x * speed;
                positions[i3 + 1] += direction.y * speed;
                positions[i3 + 2] += direction.z * speed;
                
                // Resetear partículas que se alejan demasiado
                if (distance > 10) {
                    positions[i3] = (Math.random() - 0.5) * 0.2;
                    positions[i3 + 1] = (Math.random() - 0.5) * 0.2;
                    positions[i3 + 2] = (Math.random() - 0.5) * 0.2;
                }
                break;
                
            case "grid":
                // Movimiento de grid
                positions[i3] = Math.round(x * 2) * 0.5 + Math.sin(elapsedTime * particleSpeed + i) * 0.05;
                positions[i3 + 1] = Math.round(y * 2) * 0.5 + Math.cos(elapsedTime * particleSpeed + i) * 0.05;
                positions[i3 + 2] = Math.round(z * 2) * 0.5 + Math.sin(elapsedTime * particleSpeed + i * 2) * 0.05;
                break;
        }
        
        // Actualizar colores si está activado el ciclo de color
        if (colorCycle) {
            const hue = (elapsedTime * colorSpeed * 0.1 + i * 0.001) % 1.0;
            color.setHSL(hue, 1, 0.5 + Math.random() * 0.5);
            
            colors[i3] = colors[i3] * 0.95 + color.r * 0.05;
            colors[i3 + 1] = colors[i3 + 1] * 0.95 + color.g * 0.05;
            colors[i3 + 2] = colors[i3 + 2] * 0.95 + color.b * 0.05;
        }
    }
    
    particles.geometry.attributes.position.needsUpdate = true;
    particles.geometry.attributes.color.needsUpdate = true;
}

function changeMode(mode) {
    animationMode = mode;
    
    // Resetear posiciones para ciertos modos
    if (mode === "explosion" || mode === "grid") {
        const positions = particles.geometry.attributes.position.array;
        
        for (let i = 0; i < particleCount; i++) {
            const i3 = i * 3;
            
            if (mode === "explosion") {
                // Posiciones concentradas para explosión
                positions[i3] = (Math.random() - 0.5) * 0.2;
                positions[i3 + 1] = (Math.random() - 0.5) * 0.2;
                positions[i3 + 2] = (Math.random() - 0.5) * 0.2;
            } else if (mode === "grid") {
                // Posiciones en grid
                positions[i3] = Math.round((Math.random() - 0.5) * 4) * 0.5;
                positions[i3 + 1] = Math.round((Math.random() - 0.5) * 4) * 0.5;
                positions[i3 + 2] = Math.round((Math.random() - 0.5) * 4) * 0.5;
            }
        }
        
        particles.geometry.attributes.position.needsUpdate = true;
    }
}

function applySettings() {
    // Aplicar configuraciones de partículas
    particleCount = parseInt(rangeParticleCount.value);
    particleSize = parseFloat(rangeParticleSize.value);
    particleSpeed = parseFloat(rangeParticleSpeed.value);
    
    // Aplicar configuraciones de bloom
    bloomStrength = parseFloat(rangeBloomStrength.value);
    bloomRadius = parseFloat(rangeBloomRadius.value);
    bloomThreshold = parseFloat(rangeBloomThreshold.value);
    
    // Actualizar bloom pass
    bloomPass.strength = bloomStrength;
    bloomPass.radius = bloomRadius;
    bloomPass.threshold = bloomThreshold;
    
    // Aplicar configuraciones de color
    colorSpeed = parseFloat(rangeColorSpeed.value);
    colorCycle = checkboxColorCycle.checked;
    
    // Recrear partículas
    createParticles();
    
    // Cerrar panel de ajustes
    toggleSettings();
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
}

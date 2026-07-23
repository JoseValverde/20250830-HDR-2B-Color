// Sistema de partículas legacy (CPU): modos "grid" y "text".
// Extraído tal cual del motor original — no migrado a GPU porque no forma parte del alcance de la migración GPGPU.
import * as THREE from 'three';
import { paletteColor } from './palettes.js';

// Muestrea la silueta de un texto dibujado en un canvas 2D y devuelve
// una lista de puntos {x, y} normalizados para usarlos como objetivos de partículas
export function buildTextTargets(text) {
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

export function createCpuParticleSystem({ particleTexture, initialScale }) {
    const state = {
        particleCount: 25000,
        particleSize: 0.05,
        particleSpeed: 0.5,
        colorPalette: 'rainbow',
        colorCycle: true,
        colorSpeed: 0.5,
        mode: 'grid',
        previousMode: 'grid',
        isTransitioning: false,
        transitionFactor: 1.0,
        transitionSpeed: 2.0,
        currentText: 'HDR',
        textTargets: null,
    };

    let points = null;
    let particlePositions, particleColors, particleSizes;

    function rebuild() {
        if (points) {
            points.geometry.dispose();
            points.material.dispose();
        }

        const geometry = new THREE.BufferGeometry();
        particlePositions = new Float32Array(state.particleCount * 3);
        particleColors = new Float32Array(state.particleCount * 3);
        particleSizes = new Float32Array(state.particleCount);

        const color = new THREE.Color();

        for (let i = 0; i < state.particleCount; i++) {
            const radius = Math.random() * 2;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.random() * Math.PI;

            particlePositions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
            particlePositions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
            particlePositions[i * 3 + 2] = radius * Math.cos(phi);

            paletteColor(state.colorPalette, Math.random(), color);
            particleColors[i * 3] = color.r;
            particleColors[i * 3 + 1] = color.g;
            particleColors[i * 3 + 2] = color.b;

            particleSizes[i] = state.particleSize * (0.5 + Math.random() * 0.5);
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(particleColors, 3));
        geometry.setAttribute('size', new THREE.BufferAttribute(particleSizes, 1));

        const material = new THREE.ShaderMaterial({
            uniforms: {
                pointTexture: { value: particleTexture },
                scale: { value: initialScale || 300 },
                uOpacity: { value: 1.0 },
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
                uniform float uOpacity;
                varying vec3 vColor;
                void main() {
                    vec4 texColor = texture2D(pointTexture, gl_PointCoord);
                    if (texColor.a < 0.05) discard;
                    gl_FragColor = vec4(vColor, texColor.a * 0.8 * uOpacity);
                }
            `,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        if (points) {
            points.geometry = geometry;
            points.material = material;
        } else {
            points = new THREE.Points(geometry, material);
            points.visible = false;
        }
    }

    rebuild();

    function setParticleCount(count) {
        state.particleCount = count;
        rebuild();
    }

    function setParticleSize(size) {
        state.particleSize = size;
        rebuild();
    }

    function setParticleSpeed(speed) {
        state.particleSpeed = speed;
    }

    function setColorPalette(name) {
        state.colorPalette = name;
        rebuild();
    }

    function setColorCycle(enabled) {
        state.colorCycle = enabled;
    }

    function setColorSpeed(speed) {
        state.colorSpeed = speed;
    }

    function setText(text) {
        state.currentText = text;
        state.textTargets = buildTextTargets(text);
    }

    function setScale(scale) {
        points.material.uniforms.scale.value = scale;
    }

    function setOpacity(opacity) {
        points.material.uniforms.uOpacity.value = opacity;
    }

    // mode: 'grid' | 'text'. previousModeHint: nombre del modo anterior si venía del mismo sistema, o null si venía de fuera (GPU).
    function setMode(mode, previousModeHint) {
        if (state.mode === mode) return;
        state.previousMode = previousModeHint !== undefined ? previousModeHint : state.mode;
        state.mode = mode;
        state.isTransitioning = true;
        state.transitionFactor = 0.0;
    }

    function update(delta, elapsedTime) {
        if (state.isTransitioning) {
            state.transitionFactor += delta * state.transitionSpeed;
            if (state.transitionFactor >= 1.0) {
                state.transitionFactor = 1.0;
                state.isTransitioning = false;
            }
        }

        const { particleCount, particleSize, particleSpeed, mode, previousMode, isTransitioning, transitionFactor, textTargets } = state;
        const color = new THREE.Color();

        for (let i = 0; i < particleCount; i++) {
            const i3 = i * 3;
            const x = particlePositions[i3];
            const y = particlePositions[i3 + 1];
            const z = particlePositions[i3 + 2];

            if (mode === "grid") {
                if (isTransitioning && previousMode !== "grid") {
                    const maxDistance = 3.0;
                    const coreSize = 0.8;
                    const zoneIndex = Math.floor(i / particleCount * 4);
                    let targetX = 0, targetY = 0, targetZ = 0;
                    let distanceFactor, angle, radius, height;

                    if (zoneIndex === 0) {
                        distanceFactor = Math.pow(Math.random(), 3) * coreSize;
                        angle = Math.random() * Math.PI * 2;
                        radius = distanceFactor * maxDistance;
                        height = (Math.random() * 2 - 1) * distanceFactor * maxDistance;

                        const colorFactor = transitionFactor * 0.05;
                        particleColors[i3] = particleColors[i3] * (1 - colorFactor) + (0.8 + Math.random() * 0.2) * colorFactor;
                        particleColors[i3 + 1] = particleColors[i3 + 1] * (1 - colorFactor) + (0.7 + Math.random() * 0.3) * colorFactor;
                        particleColors[i3 + 2] = particleColors[i3 + 2] * (1 - colorFactor) + (0.2 + Math.random() * 0.2) * colorFactor;
                    }
                    else if (zoneIndex === 1) {
                        distanceFactor = coreSize + (1 - coreSize) * Math.pow(Math.random(), 0.5);
                        angle = Math.random() * Math.PI * 2;
                        radius = distanceFactor * maxDistance;
                        height = (Math.random() * 2 - 1) * maxDistance;

                        const transitionColorFactor = Math.random();
                        const colorFactor = transitionFactor * 0.05;
                        particleColors[i3] = particleColors[i3] * (1 - colorFactor) + (0.5 + transitionColorFactor * 0.3) * colorFactor;
                        particleColors[i3 + 1] = particleColors[i3 + 1] * (1 - colorFactor) + (0.4 + transitionColorFactor * 0.4) * colorFactor;
                        particleColors[i3 + 2] = particleColors[i3 + 2] * (1 - colorFactor) + (0.3 + transitionColorFactor * 0.3) * colorFactor;
                    }
                    else if (zoneIndex === 2) {
                        distanceFactor = coreSize + (1 - coreSize) * Math.pow(Math.random(), 0.5);
                        const angleOffset = Math.PI * 0.5 * Math.floor(Math.random() * 4);
                        angle = angleOffset + (Math.random() * 0.3 - 0.15);
                        radius = distanceFactor * maxDistance;
                        height = (Math.random() * 2 - 1) * maxDistance * 0.5;

                        const colorFactor = transitionFactor * 0.05;
                        particleColors[i3] = particleColors[i3] * (1 - colorFactor) + (0.4 + Math.random() * 0.3) * colorFactor;
                        particleColors[i3 + 1] = particleColors[i3 + 1] * (1 - colorFactor) + (0.1 + Math.random() * 0.2) * colorFactor;
                        particleColors[i3 + 2] = particleColors[i3 + 2] * (1 - colorFactor) + (0.5 + Math.random() * 0.5) * colorFactor;
                    }
                    else {
                        distanceFactor = 0.7 + Math.random() * 0.3;
                        angle = Math.random() * Math.PI * 2;
                        radius = distanceFactor * maxDistance;
                        height = (Math.random() * 2 - 1) * maxDistance;

                        const colorFactor = transitionFactor * 0.05;
                        particleColors[i3] = particleColors[i3] * (1 - colorFactor) + (0.3 + Math.random() * 0.3) * colorFactor;
                        particleColors[i3 + 1] = particleColors[i3 + 1] * (1 - colorFactor) + (0.05 + Math.random() * 0.1) * colorFactor;
                        particleColors[i3 + 2] = particleColors[i3 + 2] * (1 - colorFactor) + (0.6 + Math.random() * 0.4) * colorFactor;
                    }

                    const time = elapsedTime * 0.3;
                    radius += Math.sin(time + angle * 3) * 0.05 * radius;

                    targetX = Math.cos(angle) * radius;
                    targetZ = Math.sin(angle) * radius;
                    targetY = height;

                    particlePositions[i3] = x * (1 - transitionFactor * 0.1) + targetX * transitionFactor * 0.1;
                    particlePositions[i3 + 1] = y * (1 - transitionFactor * 0.1) + targetY * transitionFactor * 0.1;
                    particlePositions[i3 + 2] = z * (1 - transitionFactor * 0.1) + targetZ * transitionFactor * 0.1;

                    const sizeBase = 0.8;
                    const sizeFactor = (zoneIndex === 0) ? 1.2 : sizeBase;
                    particleSizes[i] = particleSizes[i] * (1 - transitionFactor * 0.1) + (particleSize * (1 - distanceFactor * 0.3) * sizeFactor) * transitionFactor * 0.1;

                    if (particleSizes[i] < particleSize * 0.1) particleSizes[i] = particleSize * 0.1;
                } else {
                    const maxDistance = 3.0;
                    const coreSize = 0.8;

                    const zoneIndex = Math.floor(i / particleCount * 4);

                    let distanceFactor;
                    let angle, radius, height;

                    if (zoneIndex === 0) {
                        distanceFactor = Math.pow(Math.random(), 3) * coreSize;
                        angle = Math.random() * Math.PI * 2;
                        radius = distanceFactor * maxDistance;
                        height = (Math.random() * 2 - 1) * distanceFactor * maxDistance;

                        particleColors[i3] = 0.8 + Math.random() * 0.2;
                        particleColors[i3 + 1] = 0.7 + Math.random() * 0.3;
                        particleColors[i3 + 2] = 0.2 + Math.random() * 0.2;
                    }
                    else if (zoneIndex === 1) {
                        distanceFactor = coreSize + (1 - coreSize) * Math.pow(Math.random(), 0.5);
                        angle = Math.random() * Math.PI * 2;
                        radius = distanceFactor * maxDistance;
                        height = (Math.random() * 2 - 1) * maxDistance;

                        const transitionFactorLocal = Math.random();
                        particleColors[i3] = 0.5 + transitionFactorLocal * 0.3;
                        particleColors[i3 + 1] = 0.4 + transitionFactorLocal * 0.4;
                        particleColors[i3 + 2] = 0.3 + transitionFactorLocal * 0.3;
                    }
                    else if (zoneIndex === 2) {
                        distanceFactor = coreSize + (1 - coreSize) * Math.pow(Math.random(), 0.5);
                        const angleOffset = Math.PI * 0.5 * Math.floor(Math.random() * 4);
                        angle = angleOffset + (Math.random() * 0.3 - 0.15);
                        radius = distanceFactor * maxDistance;
                        height = (Math.random() * 2 - 1) * maxDistance * 0.5;

                        particleColors[i3] = 0.4 + Math.random() * 0.3;
                        particleColors[i3 + 1] = 0.1 + Math.random() * 0.2;
                        particleColors[i3 + 2] = 0.5 + Math.random() * 0.5;
                    }
                    else {
                        distanceFactor = 0.7 + Math.random() * 0.3;
                        angle = Math.random() * Math.PI * 2;
                        radius = distanceFactor * maxDistance;
                        height = (Math.random() * 2 - 1) * maxDistance;

                        particleColors[i3] = 0.3 + Math.random() * 0.3;
                        particleColors[i3 + 1] = 0.05 + Math.random() * 0.1;
                        particleColors[i3 + 2] = 0.6 + Math.random() * 0.4;
                    }

                    const time = elapsedTime * 0.3;
                    const waveSpeed = 0.5;
                    const waveIntensity = 0.05;

                    radius += Math.sin(time + angle * 3) * waveIntensity * radius;

                    particlePositions[i3] = Math.cos(angle) * radius;
                    particlePositions[i3 + 2] = Math.sin(angle) * radius;
                    particlePositions[i3 + 1] = height;

                    const particleMovementSpeed = 0.1;
                    particlePositions[i3] += Math.sin(time * waveSpeed + i * 0.1) * particleMovementSpeed;
                    particlePositions[i3 + 1] += Math.cos(time * waveSpeed + i * 0.2) * particleMovementSpeed;
                    particlePositions[i3 + 2] += Math.sin(time * waveSpeed + i * 0.15) * particleMovementSpeed;

                    const sizeBase = 0.8;
                    const sizeFactor = (zoneIndex === 0) ? 1.2 : sizeBase;
                    particleSizes[i] = particleSize * (1 - distanceFactor * 0.3) * sizeFactor;
                }
            } else if (mode === "text") {
                let targetX = 0, targetY = 0, targetZ = 0;
                if (textTargets && textTargets.length > 0) {
                    const p = textTargets[i % textTargets.length];
                    targetX = p.x;
                    targetY = p.y;
                    targetZ = Math.sin(i * 12.9898) * 0.08;
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
            }

            if (state.colorCycle) {
                const hue = (elapsedTime * state.colorSpeed * 0.1 + i * 0.001) % 1.0;
                paletteColor(state.colorPalette, hue, color);

                particleColors[i3] = particleColors[i3] * 0.95 + color.r * 0.05;
                particleColors[i3 + 1] = particleColors[i3 + 1] * 0.95 + color.g * 0.05;
                particleColors[i3 + 2] = particleColors[i3 + 2] * 0.95 + color.b * 0.05;
            }
        }

        points.geometry.attributes.position.needsUpdate = true;
        points.geometry.attributes.color.needsUpdate = true;
        points.geometry.attributes.size.needsUpdate = true;
    }

    return {
        get object() { return points; },
        setParticleCount,
        setParticleSize,
        setParticleSpeed,
        setColorPalette,
        setColorCycle,
        setColorSpeed,
        setText,
        setScale,
        setOpacity,
        setMode,
        update,
        get state() { return state; },
    };
}

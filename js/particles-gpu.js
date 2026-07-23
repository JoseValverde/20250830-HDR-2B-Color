// Sistema de partículas GPU (GPGPU): modos "sphere", "vortex", "explosion" y "waves" (todas las variantes).
// La posición y el color de cada partícula se simulan enteramente en la GPU vía GPUComputationRenderer
// (texturas ping-pong), eliminando el bucle por partícula en JS que existía en el motor original.
import * as THREE from 'three';
import { GPUComputationRenderer } from 'three/addons/misc/GPUComputationRenderer.js';
import { paletteColor, paletteStopsRGB } from './palettes.js';

const MODE_INDEX = { sphere: 0, vortex: 1, explosion: 2, waves: 3 };
const WAVE_TYPE_INDEX = { ripple: 0, interference: 1, ocean: 2, spiral: 3, pulse: 4, noise: 5, square: 6 };

const POSITION_SHADER = `
    precision highp float;
    uniform sampler2D textureSeed;
    uniform float time;
    uniform float delta;
    uniform float particleSpeed;
    uniform float mode;          // 0 sphere, 1 vortex, 2 explosion, 3 waves
    uniform float prevMode;      // -1 si el modo anterior no pertenece a este sistema
    uniform float waveType;      // 0..6, ver WAVE_TYPE_INDEX
    uniform float isTransitioning;
    uniform float transitionFactor;
    uniform float gridSize;

    const float PI = 3.14159265359;

    // GLSL ES 1.00 no trae tanh() built-in; aproximación vía exp()
    float tanhApprox(float x) {
        float e2x = exp(clamp(2.0 * x, -20.0, 20.0));
        return (e2x - 1.0) / (e2x + 1.0);
    }

    vec3 waveOffset(float type, float tx, float tz, float dist, float t) {
        if (type < 0.5) { // ripple
            float y = sin(dist * 3.0 - t) * 0.4 + sin(tx * 1.5 + t * 0.6) * 0.15;
            return vec3(0.0, y, 0.0);
        } else if (type < 1.5) { // interference
            float d1 = length(vec2(tx - (-0.9), tz - 0.0));
            float d2 = length(vec2(tx - 0.9, tz - 0.0));
            float y = (sin(d1 * 4.5 - t * 2.0) + sin(d2 * 4.5 - t * 2.0)) * 0.22;
            return vec3(0.0, y, 0.0);
        } else if (type < 2.5) { // ocean (suma de 2 ondas Gerstner)
            vec2 dir1 = normalize(vec2(1.0, 0.2));
            vec2 dir2 = normalize(vec2(0.3, 1.0));
            float phase1 = (dir1.x * tx + dir1.y * tz) * 2.2 - t * 1.2;
            float phase2 = (dir2.x * tx + dir2.y * tz) * 3.4 - t * 0.9;
            float oy = 0.22 * sin(phase1) + 0.12 * sin(phase2);
            float ox = 0.5 * 0.22 * dir1.x * cos(phase1) + 0.4 * 0.12 * dir2.x * cos(phase2);
            float oz = 0.5 * 0.22 * dir1.y * cos(phase1) + 0.4 * 0.12 * dir2.y * cos(phase2);
            return vec3(ox, oy, oz);
        } else if (type < 3.5) { // spiral
            float angle = atan(tz, tx);
            float y = sin(dist * 3.0 - t * 1.5 + angle * 4.0) * 0.35;
            return vec3(0.0, y, 0.0);
        } else if (type < 4.5) { // pulse
            float pulseSpeed = 2.2;
            float spacing = 1.6;
            float front = mod(mod(dist - t * pulseSpeed, spacing) + spacing, spacing);
            float ring = pow(max(0.0, cos(front * PI / spacing)), 8.0);
            float falloff = 1.0 / (1.0 + dist * 0.4);
            return vec3(0.0, ring * 0.6 * falloff, 0.0);
        } else if (type < 5.5) { // noise
            float y = (sin(tx * 2.1 + t * 0.7) + sin(tz * 1.7 - t * 0.9 + 1.3) + sin((tx + tz) * 1.3 + t * 0.5 + 2.7) + sin((tx - tz) * 2.7 - t * 1.1 + 4.1)) * 0.1;
            return vec3(0.0, y, 0.0);
        } else { // square
            float squareWave = tanhApprox(sin(dist * 3.0 - t) * 6.0) * 0.4;
            float triangleWave = (2.0 / PI) * asin(sin(tx * 1.5 + t * 0.6)) * 0.15;
            return vec3(0.0, squareWave + triangleWave, 0.0);
        }
    }

    void main() {
        vec2 uv = gl_FragCoord.xy / resolution.xy;
        vec4 posData = texture2D(texturePosition, uv);
        vec4 seed = texture2D(textureSeed, uv);
        vec3 pos = posData.xyz;
        float index = floor(uv.y * resolution.y) * resolution.x + floor(uv.x * resolution.x);

        vec3 newPos = pos;

        if (mode < 0.5) {
            // sphere: pulsación radial. max() evita división por cero si una partícula cae en el origen.
            float radius = max(length(pos), 0.0001);
            float targetRadius = 1.0 + 0.5 * sin(time * particleSpeed);
            float factor = 1.0 + (targetRadius / radius - 1.0) * delta * particleSpeed * 2.0;
            newPos = pos * factor;
        } else if (mode < 1.5) {
            // vortex
            float angle = particleSpeed * delta;
            float ca = cos(angle);
            float sa = sin(angle);
            newPos.x = pos.x * ca - pos.z * sa;
            newPos.z = pos.z * ca + pos.x * sa;
            newPos.y = pos.y + sin(time * 2.0 + index * 0.01) * 0.01;
        } else if (mode < 2.5) {
            // explosion
            float dist = length(pos);
            vec3 direction = dist > 0.0001 ? pos / dist : vec3(0.0, 1.0, 0.0);
            float speed = particleSpeed * (0.5 + seed.w * 0.5) * delta;
            vec3 resetTarget = (fract(seed.xyz * 13.37) - 0.5) * 0.2;

            if (isTransitioning > 0.5 && prevMode != 2.0) {
                newPos = pos * (1.0 - transitionFactor * 0.1) + resetTarget * transitionFactor * 0.1;
            } else {
                newPos = pos + direction * speed;
                if (dist > 10.0) {
                    newPos = resetTarget;
                }
            }
        } else {
            // waves
            float spacing = 3.5 / gridSize;
            float ix = mod(index, gridSize);
            float iz = mod(floor(index / gridSize), gridSize);
            float baseX = (ix - gridSize / 2.0) * spacing;
            float baseZ = (iz - gridSize / 2.0) * spacing;
            float dist = length(vec2(baseX, baseZ));
            float t = time * particleSpeed;
            vec3 offset = waveOffset(waveType, baseX, baseZ, dist, t);
            vec3 target = vec3(baseX + offset.x, offset.y, baseZ + offset.z);

            if (isTransitioning > 0.5 && prevMode != 3.0) {
                newPos = mix(pos, target, transitionFactor);
            } else {
                newPos = target;
            }
        }

        gl_FragColor = vec4(newPos, 1.0);
    }
`;

const COLOR_SHADER = `
    precision highp float;
    uniform float time;
    uniform float colorSpeed;
    uniform float colorCycleFlag;
    uniform float paletteMode; // 0 = rainbow (HSL), 1 = paleta de stops
    uniform vec3 stops0;
    uniform vec3 stops1;
    uniform vec3 stops2;
    uniform vec3 stops3;
    uniform sampler2D textureSeed;

    vec3 hsl2rgb(vec3 hsl) {
        float h = hsl.x, s = hsl.y, l = hsl.z;
        float c = (1.0 - abs(2.0 * l - 1.0)) * s;
        float hp = h * 6.0;
        float x = c * (1.0 - abs(mod(hp, 2.0) - 1.0));
        vec3 rgb;
        if (hp < 1.0) rgb = vec3(c, x, 0.0);
        else if (hp < 2.0) rgb = vec3(x, c, 0.0);
        else if (hp < 3.0) rgb = vec3(0.0, c, x);
        else if (hp < 4.0) rgb = vec3(0.0, x, c);
        else if (hp < 5.0) rgb = vec3(x, 0.0, c);
        else rgb = vec3(c, 0.0, x);
        float m = l - c * 0.5;
        return rgb + m;
    }

    void main() {
        vec2 uv = gl_FragCoord.xy / resolution.xy;
        vec4 prevColor = texture2D(textureColor, uv);
        vec4 seed = texture2D(textureSeed, uv);
        float index = floor(uv.y * resolution.y) * resolution.x + floor(uv.x * resolution.x);

        vec3 newColor = prevColor.rgb;
        if (colorCycleFlag > 0.5) {
            float hue = fract(time * colorSpeed * 0.1 + index * 0.001);
            vec3 target;
            if (paletteMode < 0.5) {
                target = hsl2rgb(vec3(hue, 1.0, 0.5 + seed.w * 0.4));
            } else {
                float scaled = clamp(hue, 0.0, 1.0) * 3.0;
                float idxf = min(floor(scaled), 2.0);
                float localT = scaled - idxf;
                vec3 a = idxf < 0.5 ? stops0 : (idxf < 1.5 ? stops1 : stops2);
                vec3 b = idxf < 0.5 ? stops1 : (idxf < 1.5 ? stops2 : stops3);
                target = mix(a, b, localT);
            }
            newColor = prevColor.rgb * 0.95 + target * 0.05;
        }
        gl_FragColor = vec4(newColor, 1.0);
    }
`;

const RENDER_VERTEX_SHADER = `
    attribute vec2 reference;
    uniform sampler2D texturePosition;
    uniform sampler2D textureColor;
    uniform sampler2D textureSeed;
    uniform float scale;
    uniform float particleSize;
    varying vec3 vColor;
    void main() {
        vec4 posData = texture2D(texturePosition, reference);
        vec4 seedData = texture2D(textureSeed, reference);
        vColor = texture2D(textureColor, reference).rgb;
        vec4 mvPosition = modelViewMatrix * vec4(posData.xyz, 1.0);
        float sizeVariance = 0.5 + seedData.w * 0.5;
        gl_PointSize = particleSize * sizeVariance * (scale / -mvPosition.z);
        gl_Position = projectionMatrix * mvPosition;
    }
`;

const RENDER_FRAGMENT_SHADER = `
    precision highp float;
    uniform sampler2D pointTexture;
    uniform float uOpacity;
    varying vec3 vColor;
    void main() {
        vec4 texColor = texture2D(pointTexture, gl_PointCoord);
        if (texColor.a < 0.05) discard;
        gl_FragColor = vec4(vColor, texColor.a * 0.8 * uOpacity);
    }
`;

function checkFloatTextureSupport(renderer) {
    const gl = renderer.getContext();
    if (renderer.capabilities.isWebGL2) {
        return true; // WebGL2 soporta texturas float de forma nativa
    }
    return !!gl.getExtension('OES_texture_float');
}

function buildReferenceGeometry(count, textureSize) {
    const geometry = new THREE.BufferGeometry();
    const references = new Float32Array(count * 2);
    const dummyPositions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
        references[i * 2] = ((i % textureSize) + 0.5) / textureSize;
        references[i * 2 + 1] = (Math.floor(i / textureSize) + 0.5) / textureSize;
    }
    geometry.setAttribute('position', new THREE.BufferAttribute(dummyPositions, 3));
    geometry.setAttribute('reference', new THREE.BufferAttribute(references, 2));
    return geometry;
}

function fillSeedAndInitialTextures(gpuCompute, count, textureSize, colorPaletteName) {
    const seedTexture = gpuCompute.createTexture();
    const dtPosition = gpuCompute.createTexture();
    const dtColor = gpuCompute.createTexture();

    const seedData = seedTexture.image.data;
    const posData = dtPosition.image.data;
    const colData = dtColor.image.data;
    const color = new THREE.Color();
    const total = textureSize * textureSize;

    for (let i = 0; i < total; i++) {
        const i4 = i * 4;
        if (i < count) {
            const radius = Math.random() * 2;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.random() * Math.PI;
            const x = radius * Math.sin(phi) * Math.cos(theta);
            const y = radius * Math.sin(phi) * Math.sin(theta);
            const z = radius * Math.cos(phi);

            seedData[i4] = x;
            seedData[i4 + 1] = y;
            seedData[i4 + 2] = z;
            seedData[i4 + 3] = Math.random();

            posData[i4] = x;
            posData[i4 + 1] = y;
            posData[i4 + 2] = z;
            posData[i4 + 3] = 1.0;

            paletteColor(colorPaletteName, Math.random(), color);
            colData[i4] = color.r;
            colData[i4 + 1] = color.g;
            colData[i4 + 2] = color.b;
            colData[i4 + 3] = 1.0;
        } else {
            // Texels de relleno (textureSize^2 puede exceder particleCount) — no se renderizan, no importa su valor.
            seedData[i4] = 0; seedData[i4 + 1] = 0; seedData[i4 + 2] = 0; seedData[i4 + 3] = 0;
            posData[i4] = 0; posData[i4 + 1] = 0; posData[i4 + 2] = 0; posData[i4 + 3] = 1;
            colData[i4] = 0; colData[i4 + 1] = 0; colData[i4 + 2] = 0; colData[i4 + 3] = 1;
        }
    }

    return { seedTexture, dtPosition, dtColor };
}

function disposeVariableRenderTargets(variable) {
    if (!variable || !variable.renderTargets) return;
    for (const rt of variable.renderTargets) {
        if (rt) rt.dispose();
    }
}

export function createGpuParticleSystem({ renderer, particleTexture, initialScale }) {
    const supported = checkFloatTextureSupport(renderer);

    const state = {
        particleCount: 25000,
        particleSize: 0.05,
        particleSpeed: 0.5,
        colorPalette: 'rainbow',
        colorCycle: true,
        colorSpeed: 0.5,
        waveType: 'ripple',
        mode: 'sphere',
        previousMode: 'sphere',
        isTransitioning: false,
        transitionFactor: 1.0,
        transitionSpeed: 2.0,
    };

    let gpuCompute = null;
    let positionVariable = null;
    let colorVariable = null;
    let points = null;

    function computeGridSize(count) {
        return Math.max(2, Math.round(Math.sqrt(count)));
    }

    function rebuild() {
        if (!supported) return;

        if (gpuCompute) {
            disposeVariableRenderTargets(positionVariable);
            disposeVariableRenderTargets(colorVariable);
        }
        if (points) {
            points.geometry.dispose();
            points.material.dispose();
        }

        const textureSize = Math.max(2, Math.ceil(Math.sqrt(state.particleCount)));
        gpuCompute = new GPUComputationRenderer(textureSize, textureSize, renderer);

        const { seedTexture, dtPosition, dtColor } = fillSeedAndInitialTextures(
            gpuCompute, state.particleCount, textureSize, state.colorPalette
        );

        positionVariable = gpuCompute.addVariable('texturePosition', POSITION_SHADER, dtPosition);
        colorVariable = gpuCompute.addVariable('textureColor', COLOR_SHADER, dtColor);

        gpuCompute.setVariableDependencies(positionVariable, [positionVariable]);
        gpuCompute.setVariableDependencies(colorVariable, [colorVariable]);

        Object.assign(positionVariable.material.uniforms, {
            textureSeed: { value: seedTexture },
            time: { value: 0 },
            delta: { value: 0 },
            particleSpeed: { value: state.particleSpeed },
            mode: { value: MODE_INDEX[state.mode] },
            prevMode: { value: -1 },
            waveType: { value: WAVE_TYPE_INDEX[state.waveType] },
            isTransitioning: { value: 0 },
            transitionFactor: { value: 1 },
            gridSize: { value: computeGridSize(state.particleCount) },
        });

        const stops = paletteStopsRGB(state.colorPalette);
        Object.assign(colorVariable.material.uniforms, {
            textureSeed: { value: seedTexture },
            time: { value: 0 },
            colorSpeed: { value: state.colorSpeed },
            colorCycleFlag: { value: state.colorCycle ? 1 : 0 },
            paletteMode: { value: state.colorPalette === 'rainbow' ? 0 : 1 },
            stops0: { value: new THREE.Vector3(...stops[0]) },
            stops1: { value: new THREE.Vector3(...stops[1]) },
            stops2: { value: new THREE.Vector3(...stops[2]) },
            stops3: { value: new THREE.Vector3(...stops[3]) },
        });

        const error = gpuCompute.init();
        if (error !== null) {
            console.error('GPUComputationRenderer init error:', error);
        }

        const geometry = buildReferenceGeometry(state.particleCount, textureSize);
        const material = new THREE.ShaderMaterial({
            uniforms: {
                texturePosition: { value: null },
                textureColor: { value: null },
                textureSeed: { value: seedTexture },
                pointTexture: { value: particleTexture },
                scale: { value: initialScale || 300 },
                particleSize: { value: state.particleSize },
                uOpacity: { value: 1.0 },
            },
            vertexShader: RENDER_VERTEX_SHADER,
            fragmentShader: RENDER_FRAGMENT_SHADER,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
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
        if (points) points.material.uniforms.particleSize.value = size;
    }

    function setParticleSpeed(speed) {
        state.particleSpeed = speed;
    }

    function setColorPalette(name) {
        state.colorPalette = name;
        if (!colorVariable) return;
        const stops = paletteStopsRGB(name);
        const u = colorVariable.material.uniforms;
        u.paletteMode.value = name === 'rainbow' ? 0 : 1;
        u.stops0.value.set(...stops[0]);
        u.stops1.value.set(...stops[1]);
        u.stops2.value.set(...stops[2]);
        u.stops3.value.set(...stops[3]);
    }

    function setColorCycle(enabled) {
        state.colorCycle = enabled;
    }

    function setColorSpeed(speed) {
        state.colorSpeed = speed;
    }

    function setWaveType(type) {
        state.waveType = type;
        if (positionVariable) positionVariable.material.uniforms.waveType.value = WAVE_TYPE_INDEX[type];
    }

    function setScale(scale) {
        if (points) points.material.uniforms.scale.value = scale;
    }

    function setOpacity(opacity) {
        if (points) points.material.uniforms.uOpacity.value = opacity;
    }

    // mode: 'sphere' | 'vortex' | 'explosion' | 'waves'. previousModeHint: modo anterior si venía de este mismo sistema, o null si venía de fuera (CPU).
    function setMode(mode, previousModeHint) {
        if (state.mode === mode) return;
        const prev = previousModeHint !== undefined ? previousModeHint : state.mode;
        state.previousMode = prev;
        state.mode = mode;
        state.isTransitioning = true;
        state.transitionFactor = 0.0;
        if (positionVariable) {
            positionVariable.material.uniforms.mode.value = MODE_INDEX[mode];
            positionVariable.material.uniforms.prevMode.value = MODE_INDEX[prev] !== undefined ? MODE_INDEX[prev] : -1;
        }
    }

    function update(delta, elapsedTime) {
        if (!supported || !gpuCompute) return;

        if (state.isTransitioning) {
            state.transitionFactor += delta * state.transitionSpeed;
            if (state.transitionFactor >= 1.0) {
                state.transitionFactor = 1.0;
                state.isTransitioning = false;
            }
        }

        const posUniforms = positionVariable.material.uniforms;
        posUniforms.time.value = elapsedTime;
        posUniforms.delta.value = Math.min(delta, 0.1);
        posUniforms.particleSpeed.value = state.particleSpeed;
        posUniforms.isTransitioning.value = state.isTransitioning ? 1 : 0;
        posUniforms.transitionFactor.value = state.transitionFactor;

        const colUniforms = colorVariable.material.uniforms;
        colUniforms.time.value = elapsedTime;
        colUniforms.colorSpeed.value = state.colorSpeed;
        colUniforms.colorCycleFlag.value = state.colorCycle ? 1 : 0;

        gpuCompute.compute();

        points.material.uniforms.texturePosition.value = gpuCompute.getCurrentRenderTarget(positionVariable).texture;
        points.material.uniforms.textureColor.value = gpuCompute.getCurrentRenderTarget(colorVariable).texture;
    }

    return {
        supported,
        get object() { return points; },
        setParticleCount,
        setParticleSize,
        setParticleSpeed,
        setColorPalette,
        setColorCycle,
        setColorSpeed,
        setWaveType,
        setScale,
        setOpacity,
        setMode,
        update,
        get state() { return state; },
    };
}

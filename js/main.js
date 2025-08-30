/**
 * Archivo principal para la animación HDR 1B COLORS
 * Inspirado en patrones de partículas vibrantes con efectos visuales HDR
 */

// Variables globales
let scene, camera, renderer, composer;
let particles, clock, stats;
let particleSystem;
let audioAnalyzer;
let timeElapsed = 0;
let isAudioPlaying = false;

// Configuración de la animación
const config = {
    particleCount: 20000,
    particleSize: 0.05,
    maxDistance: 150,
    speed: 1,
    colorMode: 'pulse', // 'rainbow', 'pulse', 'random'
    particleType: 'vortex', // 'sphere', 'explosion', 'vortex', 'grid'
    bloomStrength: 1.5,
    bloomRadius: 0.75,
    bloomThreshold: 0.1,
    cameraDistance: 150,
    autoRotate: true,
    autoChangeEffect: true,
    effectDuration: 10, // segundos entre cambios automáticos
    audioReactive: true
};

// Secuencia de efectos para la rotación automática
const effectSequence = [
    { particleType: 'sphere', colorMode: 'rainbow', bloomStrength: 1.5 },
    { particleType: 'vortex', colorMode: 'pulse', bloomStrength: 2.0 },
    { particleType: 'explosion', colorMode: 'random', bloomStrength: 2.5 },
    { particleType: 'grid', colorMode: 'rainbow', bloomStrength: 1.8 }
];

let currentEffectIndex = 0;
let lastEffectChangeTime = 0;

// Inicializar la escena
function init() {
    console.log("Inicializando...");
    clock = new THREE.Clock();
    
    // Crear escena
    scene = new THREE.Scene();
    console.log("Escena creada");
    scene.fog = new THREE.FogExp2(0x000000, 0.001);
    
    // Configurar cámara
    const aspect = window.innerWidth / window.innerHeight;
    camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 2000);
    camera.position.z = config.cameraDistance;
    
    // Configurar renderizador
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.5;
    document.body.appendChild(renderer.domElement);
    
    // Configurar post-procesamiento para efectos HDR
    setupPostProcessing();
    
    // Crear sistema de partículas
    particleSystem = new ParticleSystem(scene, {
        count: config.particleCount,
        size: config.particleSize,
        maxDistance: config.maxDistance,
        speed: config.speed,
        colorMode: config.colorMode,
        particleType: config.particleType,
        bloomStrength: config.bloomStrength,
        bloomRadius: config.bloomRadius,
        bloomThreshold: config.bloomThreshold
    });
    
    // Configurar controles de cámara (opcional para interactividad)
    // const controls = new THREE.OrbitControls(camera, renderer.domElement);
    // controls.enableDamping = true;
    // controls.dampingFactor = 0.05;
    
    // Eventos de ventana
    window.addEventListener('resize', onWindowResize);
    
    // Intentar configurar audio (requiere interacción del usuario)
    setupAudio();
    
    // Ocultar pantalla de carga
    document.getElementById('loading').style.display = 'none';
    
    // Iniciar animación
    animate();
}

// Configurar post-procesamiento para efectos HDR
function setupPostProcessing() {
    console.log("Configurando post-procesamiento...");
    // Crear compositor para efectos de post-procesamiento
    composer = new THREE.EffectComposer(renderer);
    
    // Añadir pase de renderizado básico
    const renderPass = new THREE.RenderPass(scene, camera);
    console.log("Render pass creado");
    composer.addPass(renderPass);
    
    // Añadir efecto de bloom para el efecto HDR
    const bloomPass = new THREE.UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        config.bloomStrength,
        config.bloomRadius,
        config.bloomThreshold
    );
    composer.addPass(bloomPass);
    
    // Guardar referencia al bloomPass para poder modificarlo
    composer.bloomPass = bloomPass;
}

// Configurar análisis de audio para reactividad
function setupAudio() {
    try {
        // Crear contexto de audio (requiere interacción del usuario)
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        const audioContext = new AudioContext();
        
        // Crear analizador
        audioAnalyzer = audioContext.createAnalyser();
        audioAnalyzer.fftSize = 256;
        
        // Crear un buffer de datos para el análisis
        const bufferLength = audioAnalyzer.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        
        // Función para analizar audio
        function analyzeAudio() {
            if (!audioAnalyzer) return { bass: 0, mid: 0, treble: 0, average: 0 };
            
            audioAnalyzer.getByteFrequencyData(dataArray);
            
            // Dividir el espectro en rangos
            const bass = getAverageVolume(dataArray, 0, 5);
            const mid = getAverageVolume(dataArray, 6, 20);
            const treble = getAverageVolume(dataArray, 21, 50);
            const average = (bass + mid + treble) / 3;
            
            return { bass, mid, treble, average };
        }
        
        // Función auxiliar para calcular el volumen promedio en un rango
        function getAverageVolume(array, start, end) {
            let sum = 0;
            for (let i = start; i <= end; i++) {
                sum += array[i];
            }
            return sum / (end - start + 1) / 255; // Normalizar a 0-1
        }
        
        // Añadir la función al objeto global para su uso
        window.analyzeAudio = analyzeAudio;
        
        // Intentar obtener entrada de audio
        navigator.mediaDevices.getUserMedia({ audio: true, video: false })
            .then(function(stream) {
                const source = audioContext.createMediaStreamSource(stream);
                source.connect(audioAnalyzer);
                isAudioPlaying = true;
                console.log('Audio input connected');
            })
            .catch(function(err) {
                console.log('Error accessing audio input: ' + err);
                // Fallback a un modo no reactivo al audio
                config.audioReactive = false;
            });
            
    } catch (e) {
        console.log('Web Audio API not supported: ' + e);
        config.audioReactive = false;
    }
}

// Manejar cambio de tamaño de ventana
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
}

// Función de animación principal
function animate() {
    requestAnimationFrame(animate);
    
    const delta = clock.getDelta();
    timeElapsed += delta;
    
    // Actualizar sistema de partículas
    if (particleSystem) {
        particleSystem.update(delta, timeElapsed);
    }
    
    // Manejar entrada de audio si está disponible
    if (config.audioReactive && isAudioPlaying && window.analyzeAudio) {
        const audioData = window.analyzeAudio();
        
        // Ajustar parámetros basados en el audio
        if (composer.bloomPass) {
            composer.bloomPass.strength = config.bloomStrength * (1 + audioData.bass * 2);
        }
        
        // Ajustar velocidad de rotación basado en audio
        if (particleSystem && particleSystem.particles) {
            particleSystem.particles.rotation.y += delta * 0.2 * (1 + audioData.mid);
            particleSystem.particles.rotation.x += delta * 0.1 * audioData.treble;
        }
        
        // Escalar la cámara con el ritmo del audio
        camera.position.z = config.cameraDistance * (1 - audioData.bass * 0.2);
    } else {
        // Animación automática si no hay audio
        if (config.autoRotate && particleSystem && particleSystem.particles) {
            particleSystem.particles.rotation.y += delta * 0.2;
            particleSystem.particles.rotation.x = Math.sin(timeElapsed * 0.1) * 0.2;
        }
    }
    
    // Auto-cambio de efectos
    if (config.autoChangeEffect && timeElapsed - lastEffectChangeTime > config.effectDuration) {
        changeEffect();
        lastEffectChangeTime = timeElapsed;
    }
    
    // Renderizar con post-procesamiento
    composer.render();
}

// Cambiar a un nuevo efecto visual
function changeEffect() {
    currentEffectIndex = (currentEffectIndex + 1) % effectSequence.length;
    const effect = effectSequence[currentEffectIndex];
    
    // Aplicar nueva configuración
    particleSystem.changeParticleType(effect.particleType);
    particleSystem.changeColorMode(effect.colorMode);
    
    if (composer.bloomPass) {
        composer.bloomPass.strength = effect.bloomStrength;
    }
    
    console.log(`Changed effect to: ${effect.particleType}, ${effect.colorMode}`);
}

// Función para cambiar el tipo de partícula manualmente
function setParticleType(type) {
    if (particleSystem) {
        particleSystem.changeParticleType(type);
    }
}

// Función para cambiar el modo de color manualmente
function setColorMode(mode) {
    if (particleSystem) {
        particleSystem.changeColorMode(mode);
    }
}

// Iniciar la aplicación
window.onload = init;

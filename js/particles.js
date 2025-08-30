/**
 * Sistema de partículas para la animación HDR 1B COLORS
 */

class ParticleSystem {
    constructor(scene, options = {}) {
        this.scene = scene;
        
        // Configuración predeterminada
        this.options = Object.assign({
            count: 10000,
            size: 0.5,
            maxDistance: 100,
            speed: 0.01,
            colorMode: 'rainbow', // 'rainbow', 'pulse', 'random'
            particleType: 'sphere', // 'sphere', 'explosion', 'vortex', 'grid'
            bloomStrength: 1.5,
            bloomRadius: 0,
            bloomThreshold: 0.1
        }, options);
        
        this.particles = null;
        this.geometry = null;
        this.material = null;
        this.positions = [];
        this.colors = [];
        this.sizes = [];
        this.velocities = [];
        this.life = [];
        this.time = 0;
        
        this.init();
    }
    
    init() {
        // Crear geometría de partículas
        this.geometry = new THREE.BufferGeometry();
        
        // Arrays para almacenar atributos de partículas
        const positions = new Float32Array(this.options.count * 3);
        const colors = new Float32Array(this.options.count * 3);
        const sizes = new Float32Array(this.options.count);
        
        // Crear velocidades y vida para cada partícula
        this.velocities = [];
        this.life = [];
        
        // Inicializar partículas según el tipo seleccionado
        switch(this.options.particleType) {
            case 'sphere':
                this.initSphereParticles(positions, colors, sizes);
                break;
            case 'explosion':
                this.initExplosionParticles(positions, colors, sizes);
                break;
            case 'vortex':
                this.initVortexParticles(positions, colors, sizes);
                break;
            case 'grid':
                this.initGridParticles(positions, colors, sizes);
                break;
            default:
                this.initSphereParticles(positions, colors, sizes);
        }
        
        // Configurar atributos de geometría
        this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        this.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        this.geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
        
        // Material de partículas
        this.material = new THREE.PointsMaterial({
            size: this.options.size,
            vertexColors: true,
            transparent: true,
            opacity: 0.8,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
        });
        
        // Crear mesh de partículas
        this.particles = new THREE.Points(this.geometry, this.material);
        this.scene.add(this.particles);
        
        // Guardar referencias para la animación
        this.positions = positions;
        this.colors = colors;
        this.sizes = sizes;
    }
    
    initSphereParticles(positions, colors, sizes) {
        for (let i = 0; i < this.options.count; i++) {
            // Posición en esfera
            const point = Utils.randomSpherePoint(this.options.maxDistance * 0.5);
            const i3 = i * 3;
            
            positions[i3] = point.x;
            positions[i3 + 1] = point.y;
            positions[i3 + 2] = point.z;
            
            // Color según el modo
            let color;
            if (this.options.colorMode === 'rainbow') {
                color = new THREE.Color(Utils.getColorFromPalette(i, this.options.count));
            } else if (this.options.colorMode === 'pulse') {
                color = new THREE.Color(Utils.hdrColor());
            } else {
                color = new THREE.Color(Utils.randomColor());
            }
            
            colors[i3] = color.r;
            colors[i3 + 1] = color.g;
            colors[i3 + 2] = color.b;
            
            // Tamaño
            sizes[i] = Math.random() * this.options.size * 2;
            
            // Velocidad
            this.velocities.push({
                x: Utils.random(-0.05, 0.05) * this.options.speed,
                y: Utils.random(-0.05, 0.05) * this.options.speed,
                z: Utils.random(-0.05, 0.05) * this.options.speed
            });
            
            // Vida de la partícula (para partículas que mueren y renacen)
            this.life.push(Math.random());
        }
    }
    
    initExplosionParticles(positions, colors, sizes) {
        for (let i = 0; i < this.options.count; i++) {
            const i3 = i * 3;
            
            // Todas las partículas comienzan en el centro
            positions[i3] = 0;
            positions[i3 + 1] = 0;
            positions[i3 + 2] = 0;
            
            // Color según el modo
            let color;
            if (this.options.colorMode === 'rainbow') {
                color = new THREE.Color(Utils.getColorFromPalette(i, this.options.count));
            } else if (this.options.colorMode === 'pulse') {
                color = new THREE.Color(Utils.hdrColor());
            } else {
                color = new THREE.Color(Utils.randomColor());
            }
            
            colors[i3] = color.r;
            colors[i3 + 1] = color.g;
            colors[i3 + 2] = color.b;
            
            // Tamaño
            sizes[i] = Math.random() * this.options.size * 2;
            
            // Velocidad - Dirección desde el centro
            const angle1 = Math.random() * Math.PI * 2;
            const angle2 = Math.random() * Math.PI;
            
            const speed = Math.random() * 0.2 * this.options.speed;
            
            this.velocities.push({
                x: Math.sin(angle1) * Math.sin(angle2) * speed,
                y: Math.cos(angle2) * speed,
                z: Math.cos(angle1) * Math.sin(angle2) * speed
            });
            
            // Vida de la partícula
            this.life.push(Math.random());
        }
    }
    
    initVortexParticles(positions, colors, sizes) {
        for (let i = 0; i < this.options.count; i++) {
            const i3 = i * 3;
            
            // Crear partículas en forma de vórtice
            const angle = Math.random() * Math.PI * 2;
            const radius = Math.random() * this.options.maxDistance * 0.5;
            const height = Utils.random(-this.options.maxDistance * 0.5, this.options.maxDistance * 0.5);
            
            positions[i3] = Math.cos(angle) * radius;
            positions[i3 + 1] = height;
            positions[i3 + 2] = Math.sin(angle) * radius;
            
            // Color según el modo
            let color;
            if (this.options.colorMode === 'rainbow') {
                color = new THREE.Color(Utils.getColorFromPalette(i, this.options.count));
            } else if (this.options.colorMode === 'pulse') {
                color = new THREE.Color(Utils.hdrColor());
            } else {
                color = new THREE.Color(Utils.randomColor());
            }
            
            colors[i3] = color.r;
            colors[i3 + 1] = color.g;
            colors[i3 + 2] = color.b;
            
            // Tamaño
            sizes[i] = Math.random() * this.options.size * 2;
            
            // Velocidad - movimiento circular
            this.velocities.push({
                x: -Math.sin(angle) * 0.02 * this.options.speed * (1 - radius / (this.options.maxDistance * 0.5)),
                y: 0.001 * this.options.speed,
                z: Math.cos(angle) * 0.02 * this.options.speed * (1 - radius / (this.options.maxDistance * 0.5))
            });
            
            // Vida de la partícula
            this.life.push(Math.random());
        }
    }
    
    initGridParticles(positions, colors, sizes) {
        // Calcular el número de partículas por lado para formar un cubo
        const particlesPerSide = Math.ceil(Math.pow(this.options.count, 1/3));
        const spacing = this.options.maxDistance / particlesPerSide;
        
        let index = 0;
        
        // Crear una cuadrícula 3D de partículas
        for (let x = 0; x < particlesPerSide && index < this.options.count; x++) {
            for (let y = 0; y < particlesPerSide && index < this.options.count; y++) {
                for (let z = 0; z < particlesPerSide && index < this.options.count; z++) {
                    const i3 = index * 3;
                    
                    // Posición en cuadrícula con un poco de variación
                    positions[i3] = (x - particlesPerSide/2) * spacing + Utils.random(-spacing/5, spacing/5);
                    positions[i3 + 1] = (y - particlesPerSide/2) * spacing + Utils.random(-spacing/5, spacing/5);
                    positions[i3 + 2] = (z - particlesPerSide/2) * spacing + Utils.random(-spacing/5, spacing/5);
                    
                    // Color según el modo
                    let color;
                    if (this.options.colorMode === 'rainbow') {
                        color = new THREE.Color(Utils.getColorFromPalette(index, this.options.count));
                    } else if (this.options.colorMode === 'pulse') {
                        color = new THREE.Color(Utils.hdrColor());
                    } else {
                        color = new THREE.Color(Utils.randomColor());
                    }
                    
                    colors[i3] = color.r;
                    colors[i3 + 1] = color.g;
                    colors[i3 + 2] = color.b;
                    
                    // Tamaño
                    sizes[index] = Math.random() * this.options.size * 2;
                    
                    // Velocidad - ondulación
                    this.velocities.push({
                        x: Math.sin(x/2) * 0.01 * this.options.speed,
                        y: Math.cos(y/2) * 0.01 * this.options.speed,
                        z: Math.sin(z/2) * 0.01 * this.options.speed
                    });
                    
                    // Vida de la partícula
                    this.life.push(Math.random());
                    
                    index++;
                }
            }
        }
    }
    
    update(delta, timeElapsed) {
        this.time += delta;
        
        const positions = this.geometry.attributes.position.array;
        const colors = this.geometry.attributes.color.array;
        const sizes = this.geometry.attributes.size.array;
        
        // Actualizar cada partícula
        for (let i = 0; i < this.options.count; i++) {
            const i3 = i * 3;
            
            // Actualizar posición
            positions[i3] += this.velocities[i].x;
            positions[i3 + 1] += this.velocities[i].y;
            positions[i3 + 2] += this.velocities[i].z;
            
            // Límite de distancia para mantener las partículas dentro de un rango
            const distance = Math.sqrt(
                positions[i3] * positions[i3] + 
                positions[i3 + 1] * positions[i3 + 1] + 
                positions[i3 + 2] * positions[i3 + 2]
            );
            
            // Si está muy lejos, reiniciar la partícula
            if (distance > this.options.maxDistance) {
                if (this.options.particleType === 'explosion') {
                    // Para el modo explosión, reiniciar desde el centro
                    positions[i3] = 0;
                    positions[i3 + 1] = 0;
                    positions[i3 + 2] = 0;
                    
                    const angle1 = Math.random() * Math.PI * 2;
                    const angle2 = Math.random() * Math.PI;
                    
                    const speed = Math.random() * 0.2 * this.options.speed;
                    
                    this.velocities[i] = {
                        x: Math.sin(angle1) * Math.sin(angle2) * speed,
                        y: Math.cos(angle2) * speed,
                        z: Math.cos(angle1) * Math.sin(angle2) * speed
                    };
                } else {
                    // Para otros modos, invertir la dirección
                    this.velocities[i].x *= -1;
                    this.velocities[i].y *= -1;
                    this.velocities[i].z *= -1;
                }
                
                // Actualizar color si es necesario
                if (this.options.colorMode === 'pulse' || this.options.colorMode === 'random') {
                    let color;
                    if (this.options.colorMode === 'pulse') {
                        color = new THREE.Color(Utils.hdrColor());
                    } else {
                        color = new THREE.Color(Utils.randomColor());
                    }
                    
                    colors[i3] = color.r;
                    colors[i3 + 1] = color.g;
                    colors[i3 + 2] = color.b;
                }
            }
            
            // Actualizar tamaño con pulsación para efecto HDR
            sizes[i] = (Math.sin(this.time * 2 + i * 0.1) * 0.5 + 0.5) * this.options.size * 3 + this.options.size;
            
            // En modo pulse, actualizar colores gradualmente
            if (this.options.colorMode === 'pulse') {
                // Usar una función de pulso para animar el color
                const hue = (timeElapsed * 0.05 + i * 0.01) % 1;
                const color = new THREE.Color().setHSL(hue, 1, 0.5);
                
                colors[i3] = color.r;
                colors[i3 + 1] = color.g;
                colors[i3 + 2] = color.b;
            }
        }
        
        // Marcar atributos como necesitan actualización
        this.geometry.attributes.position.needsUpdate = true;
        this.geometry.attributes.color.needsUpdate = true;
        this.geometry.attributes.size.needsUpdate = true;
        
        // Rotar todo el sistema de partículas para un efecto más dinámico
        this.particles.rotation.y += delta * 0.1;
        this.particles.rotation.z += delta * 0.05;
    }
    
    // Cambiar el tipo de partícula
    changeParticleType(type) {
        this.options.particleType = type;
        this.scene.remove(this.particles);
        this.init();
    }
    
    // Cambiar el modo de color
    changeColorMode(mode) {
        this.options.colorMode = mode;
    }
    
    // Ajustar los parámetros de bloom
    setBloomParams(strength, radius, threshold) {
        this.options.bloomStrength = strength;
        this.options.bloomRadius = radius;
        this.options.bloomThreshold = threshold;
    }
    
    // Destruir el sistema de partículas
    dispose() {
        if (this.particles) {
            this.scene.remove(this.particles);
            this.geometry.dispose();
            this.material.dispose();
        }
    }
}

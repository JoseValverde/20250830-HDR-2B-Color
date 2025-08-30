/**
 * Utilidades para nuestra animación HDR de partículas
 */

// Funciones de color
const Utils = {
    // Genera un color aleatorio en formato hexadecimal
    randomColor: function() {
        return Math.floor(Math.random() * 16777215);
    },

    // Genera un color vibrante específico para HDR
    hdrColor: function() {
        const colors = [
            0xFF00FF, // Magenta
            0x00FFFF, // Cian
            0xFFFF00, // Amarillo
            0xFF0000, // Rojo
            0x00FF00, // Verde
            0x0000FF, // Azul
            0xFFFFFF  // Blanco
        ];
        return colors[Math.floor(Math.random() * colors.length)];
    },

    // Genera un valor aleatorio entre min y max
    random: function(min, max) {
        return Math.random() * (max - min) + min;
    },

    // Función para añadir animación de pulsación
    pulse: function(value, min, max, speed) {
        return min + (Math.sin(Date.now() * speed * 0.001) * 0.5 + 0.5) * (max - min);
    },

    // Genera una posición aleatoria en una esfera
    randomSpherePoint: function(radius) {
        const u = Math.random();
        const v = Math.random();
        const theta = 2 * Math.PI * u;
        const phi = Math.acos(2 * v - 1);
        
        const x = radius * Math.sin(phi) * Math.cos(theta);
        const y = radius * Math.sin(phi) * Math.sin(theta);
        const z = radius * Math.cos(phi);
        
        return { x, y, z };
    },

    // Mapea un valor de un rango a otro
    map: function(value, inMin, inMax, outMin, outMax) {
        return (value - inMin) * (outMax - outMin) / (inMax - inMin) + outMin;
    },

    // Función para interpolación suave
    lerp: function(a, b, t) {
        return a + (b - a) * t;
    },

    // Función para obtener un color según una paleta HDR
    getColorFromPalette: function(index, totalColors) {
        // Usar HSL para generar colores vibrantes
        const hue = (index / totalColors) * 360;
        const saturation = 100; // Máxima saturación
        const lightness = 50;   // Brillo medio para mantener colores vibrantes
        
        // Convertir HSL a RGB y luego a hexadecimal para Three.js
        return this.hslToHex(hue, saturation, lightness);
    },

    // Convierte HSL a valor hexadecimal
    hslToHex: function(h, s, l) {
        s /= 100;
        l /= 100;

        const c = (1 - Math.abs(2 * l - 1)) * s;
        const x = c * (1 - Math.abs((h / 60) % 2 - 1));
        const m = l - c / 2;

        let r, g, b;

        if (0 <= h && h < 60) {
            r = c; g = x; b = 0;
        } else if (60 <= h && h < 120) {
            r = x; g = c; b = 0;
        } else if (120 <= h && h < 180) {
            r = 0; g = c; b = x;
        } else if (180 <= h && h < 240) {
            r = 0; g = x; b = c;
        } else if (240 <= h && h < 300) {
            r = x; g = 0; b = c;
        } else {
            r = c; g = 0; b = x;
        }

        r = Math.round((r + m) * 255);
        g = Math.round((g + m) * 255);
        b = Math.round((b + m) * 255);

        return (r << 16) | (g << 8) | b;
    }
};

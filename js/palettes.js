// Paletas de color compartidas entre el sistema de partículas GPU (GPGPU) y el legacy (CPU: grid/texto)
import * as THREE from 'three';

export const PALETTE_STOPS = {
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

// Escribe en `target` el color de la paleta indicada para el parámetro t (0-1). 'rainbow' usa HSL aleatorio.
export function paletteColor(paletteName, t, target) {
    if (paletteName === 'rainbow') {
        return target.setHSL(t, 1, 0.5 + Math.random() * 0.4);
    }
    const stops = PALETTE_COLORS[paletteName] || PALETTE_COLORS.neon;
    const scaled = Math.min(Math.max(t, 0), 1) * (stops.length - 1);
    const idx = Math.min(Math.floor(scaled), stops.length - 2);
    const localT = scaled - idx;
    return target.lerpColors(stops[idx], stops[idx + 1], localT);
}

// Los 4 stops [r,g,b] de una paleta, para subir como uniforms al shader de color (usa 'neon' como base visual de 'rainbow',
// que en el shader se calcula aparte vía HSL — este valor no se usa en ese caso pero debe existir para no romper el uniform).
export function paletteStopsRGB(paletteName) {
    const stops = PALETTE_STOPS[paletteName] || PALETTE_STOPS.neon;
    return stops.map((hex) => {
        const c = new THREE.Color(hex);
        return [c.r, c.g, c.b];
    });
}

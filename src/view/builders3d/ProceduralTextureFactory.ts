/**
 * @pattern Factory (Soporte de Vista MVC — Activos Procedurales)
 * @role Procedural Texture Factory
 *
 * Problema de diseño que resuelve:
 * Genera `THREE.CanvasTexture` nítidas completamente en memoria según la temática
 * (`'horror'` o `'scifi'`), evitando depender de imágenes externas y asegurando
 * acabados diferenciados para suelos, paredes, techos, notas legibles, pistas UV/holográficas,
 * etiquetas de interruptores y teclados numéricos.
 */

import * as THREE from 'three';
import type { ThemeColorPalette, ThemeType } from '../../core/interfaces/IThemeFactory';

/**
 * Fábrica de texturas procedurales sobre `<canvas>` en memoria para Three.js.
 */
export class ProceduralTextureFactory {
  /**
   * Genera la textura repetible del suelo: tablones de madera envejecida (`horror`)
   * o placas metálicas hexagonales con rejilla técnica (`scifi`).
   */
  public createFloorTexture(
    theme: ThemeType,
    palette: ThemeColorPalette
  ): THREE.CanvasTexture {
    const canvas = this.createCanvas(512, 512);
    const ctx = this.get2DContext(canvas);
    const baseHex = this.toCssHex(palette.floor);

    ctx.fillStyle = baseHex;
    ctx.fillRect(0, 0, 512, 512);

    if (theme === 'horror') {
      const plankCount = 8;
      const plankHeight = 512 / plankCount;
      for (let i = 0; i < plankCount; i += 1) {
        const y = i * plankHeight;
        const shade = (i % 3) * 7 - 6;
        ctx.fillStyle = this.shiftHex(palette.floor, shade + 10);
        ctx.fillRect(0, y + 2, 512, plankHeight - 4);

        // Vetas de madera
        ctx.strokeStyle = 'rgba(12, 7, 5, 0.35)';
        ctx.lineWidth = 1.5;
        for (let g = 0; g < 6; g += 1) {
          const gy = y + 8 + g * 9;
          ctx.beginPath();
          ctx.moveTo(0, gy);
          ctx.bezierCurveTo(160, gy + ((i + g) % 2 === 0 ? 4 : -4), 340, gy - 3, 512, gy);
          ctx.stroke();
        }

        // Juntas verticales alternadas y clavos
        const jointX = ((i * 193) % 360) + 70;
        ctx.fillStyle = '#0c0806';
        ctx.fillRect(0, y, 512, 3);
        ctx.fillRect(jointX, y, 3, plankHeight);

        ctx.fillStyle = '#3a2c22';
        for (const nx of [jointX - 10, jointX + 12]) {
          ctx.beginPath();
          ctx.arc(nx, y + 14, 2.4, 0, Math.PI * 2);
          ctx.arc(nx, y + plankHeight - 14, 2.4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    } else {
      // Suelo Sci-Fi: placas metálicas hexagonales y rejilla
      ctx.fillStyle = '#0d1520';
      ctx.fillRect(0, 0, 512, 512);

      const radius = 32;
      const hexH = Math.sqrt(3) * radius;
      const colStep = radius * 1.5;
      ctx.lineWidth = 2;

      for (let col = -1; col < 14; col += 1) {
        for (let row = -1; row < 12; row += 1) {
          const cx = col * colStep;
          const cy = row * hexH + (col % 2 === 0 ? 0 : hexH / 2);

          ctx.beginPath();
          for (let k = 0; k < 6; k += 1) {
            const angle = (Math.PI / 3) * k;
            const px = cx + (radius - 2) * Math.cos(angle);
            const py = cy + (radius - 2) * Math.sin(angle);
            if (k === 0) {
              ctx.moveTo(px, py);
            } else {
              ctx.lineTo(px, py);
            }
          }
          ctx.closePath();
          ctx.fillStyle = (col + row) % 3 === 0 ? '#152233' : '#101b29';
          ctx.fill();
          ctx.strokeStyle = 'rgba(0, 210, 255, 0.18)';
          ctx.stroke();
        }
      }

      // Rejilla industrial y pernos en intersecciones
      ctx.strokeStyle = 'rgba(130, 175, 210, 0.2)';
      ctx.lineWidth = 2;
      for (let p = 0; p <= 512; p += 128) {
        ctx.beginPath();
        ctx.moveTo(p, 0);
        ctx.lineTo(p, 512);
        ctx.moveTo(0, p);
        ctx.lineTo(512, p);
        ctx.stroke();
      }
    }

    return this.toRepeatableTexture(canvas, 4, 4);
  }

  /**
   * Genera la textura de paredes: papel tapiz victoriano gastado (`horror`)
   * o mamparos de titanio con franja de advertencia (`scifi`).
   */
  public createWallTexture(
    theme: ThemeType,
    palette: ThemeColorPalette
  ): THREE.CanvasTexture {
    const canvas = this.createCanvas(512, 512);
    const ctx = this.get2DContext(canvas);

    ctx.fillStyle = this.toCssHex(palette.wallPrimary);
    ctx.fillRect(0, 0, 512, 512);

    if (theme === 'horror') {
      // Franjas verticales de papel tapiz victoriano
      for (let x = 0; x < 512; x += 64) {
        ctx.fillStyle = x % 128 === 0 ? 'rgba(59, 38, 33, 0.45)' : 'rgba(22, 14, 13, 0.35)';
        ctx.fillRect(x, 0, 32, 512);

        // Motivo adamascado repetido
        ctx.strokeStyle = 'rgba(139, 108, 66, 0.16)';
        ctx.lineWidth = 1.5;
        for (let y = 32; y < 380; y += 64) {
          ctx.beginPath();
          ctx.moveTo(x + 32, y - 18);
          ctx.quadraticCurveTo(x + 48, y, x + 32, y + 18);
          ctx.quadraticCurveTo(x + 16, y, x + 32, y - 18);
          ctx.stroke();
        }
      }

      // Manchas sutiles de envejecimiento y humedad
      for (const spot of [
        { x: 96, y: 120, r: 58 },
        { x: 340, y: 210, r: 72 },
        { x: 220, y: 360, r: 50 },
      ]) {
        const grad = ctx.createRadialGradient(spot.x, spot.y, 4, spot.x, spot.y, spot.r);
        grad.addColorStop(0, 'rgba(10, 6, 5, 0.38)');
        grad.addColorStop(1, 'rgba(10, 6, 5, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(spot.x - spot.r, spot.y - spot.r, spot.r * 2, spot.r * 2);
      }

      // Zócalo inferior de madera oscura
      ctx.fillStyle = '#18100d';
      ctx.fillRect(0, 412, 512, 100);
      ctx.fillStyle = '#4e3529';
      ctx.fillRect(0, 408, 512, 8);
    } else {
      // Mamparos metálicos de titanio
      for (let x = 0; x < 512; x += 128) {
        ctx.fillStyle = x % 256 === 0 ? '#1b2838' : '#162230';
        ctx.fillRect(x + 2, 16, 124, 398);

        ctx.strokeStyle = '#334e68';
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 6, 20, 116, 390);

        // Remaches técnicos
        ctx.fillStyle = '#486581';
        for (const ry of [32, 200, 395]) {
          ctx.beginPath();
          ctx.arc(x + 16, ry, 3, 0, Math.PI * 2);
          ctx.arc(x + 112, ry, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Línea luminosa cian intermedia
      ctx.fillStyle = 'rgba(0, 210, 255, 0.35)';
      ctx.fillRect(0, 260, 512, 4);

      // Franja de advertencia inferior amarilla/negra
      ctx.fillStyle = '#101822';
      ctx.fillRect(0, 420, 512, 92);
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 424, 512, 24);
      ctx.clip();
      ctx.fillStyle = '#d99b16';
      ctx.fillRect(0, 424, 512, 24);
      ctx.fillStyle = '#11161d';
      for (let sx = -40; sx < 560; sx += 32) {
        ctx.beginPath();
        ctx.moveTo(sx, 448);
        ctx.lineTo(sx + 16, 448);
        ctx.lineTo(sx + 30, 424);
        ctx.lineTo(sx + 14, 424);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }

    return this.toRepeatableTexture(canvas, 4, 1);
  }

  /**
   * Genera la textura repetible del techo.
   */
  public createCeilingTexture(
    theme: ThemeType,
    palette: ThemeColorPalette
  ): THREE.CanvasTexture {
    const canvas = this.createCanvas(256, 256);
    const ctx = this.get2DContext(canvas);
    ctx.fillStyle = this.toCssHex(palette.ceiling);
    ctx.fillRect(0, 0, 256, 256);

    if (theme === 'horror') {
      ctx.strokeStyle = '#241815';
      ctx.lineWidth = 6;
      ctx.strokeRect(10, 10, 236, 236);
      ctx.strokeStyle = 'rgba(74, 47, 36, 0.45)';
      ctx.lineWidth = 2;
      ctx.strokeRect(24, 24, 208, 208);
    } else {
      ctx.strokeStyle = '#1d3247';
      ctx.lineWidth = 3;
      ctx.strokeRect(8, 8, 240, 240);
      ctx.fillStyle = 'rgba(0, 210, 255, 0.14)';
      ctx.fillRect(28, 124, 200, 6);
    }

    return this.toRepeatableTexture(canvas, 3, 3);
  }

  /**
   * Genera una textura de acabado superficial (madera veteada o metal cepillado) para muebles y puertas.
   */
  public createSurfaceDetailTexture(
    theme: ThemeType,
    baseColorHex: number
  ): THREE.CanvasTexture {
    const canvas = this.createCanvas(256, 256);
    const ctx = this.get2DContext(canvas);
    ctx.fillStyle = this.toCssHex(baseColorHex);
    ctx.fillRect(0, 0, 256, 256);

    if (theme === 'horror') {
      ctx.strokeStyle = 'rgba(15, 8, 5, 0.32)';
      ctx.lineWidth = 1.6;
      for (let y = 4; y < 256; y += 7) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.bezierCurveTo(85, y + 3, 170, y - 3, 256, y);
        ctx.stroke();
      }
    } else {
      ctx.strokeStyle = 'rgba(210, 235, 255, 0.09)';
      ctx.lineWidth = 1;
      for (let y = 0; y < 256; y += 3) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(256, y);
        ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(0, 210, 255, 0.25)';
      ctx.lineWidth = 2;
      ctx.strokeRect(6, 6, 244, 244);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    return texture;
  }

  /**
   * Genera la textura legible de la nota o datapad colocado sobre el escritorio (Pista #1).
   */
  public createNoteTexture(
    theme: ThemeType,
    _noteContent: string
  ): THREE.CanvasTexture {
    const canvas = this.createCanvas(512, 512);
    const ctx = this.get2DContext(canvas);

    if (theme === 'horror') {
      ctx.fillStyle = '#ead9b7';
      ctx.fillRect(0, 0, 512, 512);

      const vignette = ctx.createRadialGradient(256, 256, 120, 256, 256, 350);
      vignette.addColorStop(0, 'rgba(0,0,0,0)');
      vignette.addColorStop(1, 'rgba(84, 52, 26, 0.45)');
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, 512, 512);

      ctx.strokeStyle = '#6c492b';
      ctx.lineWidth = 4;
      ctx.strokeRect(20, 20, 472, 472);

      ctx.fillStyle = '#2d1c12';
      ctx.font = 'bold 26px Georgia, serif';
      ctx.fillText('BITÁCORA DEL GUARDIÁN', 48, 72);

      ctx.fillStyle = '#5c3c24';
      ctx.font = 'bold 18px Georgia, serif';
      ctx.fillText('PISTA #1 DE 3 — SECUENCIA DE 5 PULSOS', 48, 108);

      ctx.fillStyle = '#3d2416';
      ctx.font = '22px Georgia, serif';
      ctx.fillText('1° Pulso: Interruptor [ B ]', 52, 166);
      ctx.fillText('2° Pulso: Interruptor [ A ]', 52, 210);

      ctx.fillStyle = '#7d1c1c';
      ctx.font = 'bold 38px Georgia, serif';
      ctx.fillText('INICIO: B → A → ...', 58, 286);

      ctx.fillStyle = '#472d1b';
      ctx.font = '19px Georgia, serif';
      ctx.fillText('Pasos 3 y 4 en el cofre del escritorio.', 52, 354);
      ctx.fillText('Llave pequeña en la estantería (NO).', 52, 388);

      ctx.fillStyle = '#5c3c24';
      ctx.font = 'italic 18px Georgia, serif';
      ctx.fillText('[Presiona E para leer completo]', 96, 452);
    } else {
      ctx.fillStyle = '#071b2b';
      ctx.fillRect(0, 0, 512, 512);
      ctx.strokeStyle = '#00d2ff';
      ctx.lineWidth = 5;
      ctx.strokeRect(18, 18, 476, 476);

      ctx.fillStyle = '#00f5d4';
      ctx.font = 'bold 25px Consolas, monospace';
      ctx.fillText('AETHER-9 // DATAPAD #1', 42, 72);

      ctx.fillStyle = '#8ad8f5';
      ctx.font = '18px Consolas, monospace';
      ctx.fillText('PROTOCOLO 5 CICLOS (FRAGMENTO 1/3)', 42, 108);

      ctx.fillStyle = '#d4f2ff';
      ctx.font = '21px Consolas, monospace';
      ctx.fillText('> 01: PURGAR NODO [ C ]', 42, 166);
      ctx.fillText('> 02: PUENTE TÉRMICO [ B ]', 42, 210);

      ctx.fillStyle = 'rgba(0, 210, 255, 0.16)';
      ctx.fillRect(42, 248, 428, 70);
      ctx.fillStyle = '#00f5d4';
      ctx.font = 'bold 34px Consolas, monospace';
      ctx.fillText('INICIO: C → B → ...', 56, 294);

      ctx.fillStyle = '#bde8ff';
      ctx.font = '18px Consolas, monospace';
      ctx.fillText('Pasos 3-4: Compartimento de consola', 42, 362);
      ctx.fillText('Chip: Estación de carga (NO)', 42, 394);

      ctx.fillStyle = '#7cc6e8';
      ctx.font = '18px Consolas, monospace';
      ctx.fillText('[E] INSPECCIONAR DATAPAD', 110, 452);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    return texture;
  }

  /**
   * Genera la textura legible de la nota arrancada o pantalla dentro de `desk_box` (Pista #2).
   */
  public createDeskBoxNoteTexture(theme: ThemeType): THREE.CanvasTexture {
    const canvas = this.createCanvas(512, 512);
    const ctx = this.get2DContext(canvas);

    if (theme === 'horror') {
      ctx.fillStyle = '#e3cea6';
      ctx.fillRect(0, 0, 512, 512);
      ctx.strokeStyle = '#6c492b';
      ctx.lineWidth = 4;
      ctx.strokeRect(20, 20, 472, 472);

      ctx.fillStyle = '#2d1c12';
      ctx.font = 'bold 26px Georgia, serif';
      ctx.fillText('NOTA ARRANCADA — PISTA #2', 44, 78);

      ctx.fillStyle = '#3d2416';
      ctx.font = '22px Georgia, serif';
      ctx.fillText('3° Pulso: Interruptor [ C ]', 54, 158);
      ctx.fillText('4° Pulso: Interruptor [ B ]', 54, 208);

      ctx.fillStyle = '#7d1c1c';
      ctx.font = 'bold 36px Georgia, serif';
      ctx.fillText('... → C → B → ...', 96, 294);

      ctx.fillStyle = '#472d1b';
      ctx.font = '19px Georgia, serif';
      ctx.fillText('El 5° pulso fue grabado en el muro sur.', 52, 384);
    } else {
      ctx.fillStyle = '#061a29';
      ctx.fillRect(0, 0, 512, 512);
      ctx.strokeStyle = '#00f5d4';
      ctx.lineWidth = 5;
      ctx.strokeRect(18, 18, 476, 476);

      ctx.fillStyle = '#00f5d4';
      ctx.font = 'bold 24px Consolas, monospace';
      ctx.fillText('RESPALDO // FRAGMENTO #2', 48, 78);

      ctx.fillStyle = '#d4f2ff';
      ctx.font = '21px Consolas, monospace';
      ctx.fillText('> 03: ESTABILIZAR FASE [ A ]', 44, 160);
      ctx.fillText('> 04: REALIMENTAR FLUJO [ C ]', 44, 210);

      ctx.fillStyle = 'rgba(0, 245, 212, 0.16)';
      ctx.fillRect(42, 250, 428, 72);
      ctx.fillStyle = '#00f5d4';
      ctx.font = 'bold 34px Consolas, monospace';
      ctx.fillText('... → A → C → ...', 86, 298);

      ctx.fillStyle = '#9be0ff';
      ctx.font = '18px Consolas, monospace';
      ctx.fillText('CICLO 5 EN PANEL MAMPARO SUR', 74, 388);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    return texture;
  }

  /**
   * Genera la textura estilizada de `wall_marking` (Pista #3 en muro sur).
   */
  public createWallMarkingTexture(theme: ThemeType): THREE.CanvasTexture {
    const canvas = this.createCanvas(512, 384);
    const ctx = this.get2DContext(canvas);

    if (theme === 'horror') {
      ctx.fillStyle = '#241816';
      ctx.fillRect(0, 0, 512, 384);

      // Papel tapiz rasgado dejando ver yeso oscuro
      ctx.fillStyle = '#382a24';
      ctx.beginPath();
      ctx.moveTo(46, 36);
      ctx.lineTo(466, 48);
      ctx.lineTo(448, 338);
      ctx.lineTo(54, 344);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = 'rgba(180, 38, 38, 0.5)';
      ctx.lineWidth = 3;
      ctx.strokeRect(24, 24, 464, 336);

      ctx.textAlign = 'center';
      ctx.fillStyle = '#d9b99b';
      ctx.font = 'bold 24px Georgia, serif';
      ctx.fillText('INSCRIPCIÓN EN EL MURO — PISTA #3', 256, 82);

      ctx.fillStyle = '#e5383b';
      ctx.font = 'bold 64px Georgia, serif';
      ctx.fillText('5° PULSO: → A', 256, 200);

      ctx.fillStyle = '#e2cbb0';
      ctx.font = 'italic 20px Georgia, serif';
      ctx.fillText('«Cierra el ciclo donde empezó el 2° pulso»', 256, 278);
      ctx.font = '17px Georgia, serif';
      ctx.fillText('[E] Examinar inscripción', 256, 326);
    } else {
      ctx.fillStyle = '#12202f';
      ctx.fillRect(0, 0, 512, 384);

      ctx.strokeStyle = '#f4a261';
      ctx.lineWidth = 5;
      ctx.strokeRect(16, 16, 480, 352);

      // Franjas de advertencia superiores
      ctx.fillStyle = '#e9c46a';
      ctx.fillRect(22, 22, 468, 22);
      ctx.fillStyle = '#121a24';
      for (let x = 22; x < 480; x += 36) {
        ctx.beginPath();
        ctx.moveTo(x, 44);
        ctx.lineTo(x + 16, 44);
        ctx.lineTo(x + 28, 22);
        ctx.lineTo(x + 12, 22);
        ctx.closePath();
        ctx.fill();
      }

      ctx.textAlign = 'center';
      ctx.fillStyle = '#f4a261';
      ctx.font = 'bold 23px Consolas, monospace';
      ctx.fillText('MAMPARO SUR // REGISTRO #3', 256, 94);

      ctx.fillStyle = '#00f5d4';
      ctx.font = 'bold 62px Consolas, monospace';
      ctx.fillText('PASO 5: → B', 256, 204);

      ctx.fillStyle = '#bde8ff';
      ctx.font = '19px Consolas, monospace';
      ctx.fillText('CIERRE DE CALIBRACIÓN DE 5 CICLOS', 256, 276);
      ctx.fillStyle = '#7cc6e8';
      ctx.font = '17px Consolas, monospace';
      ctx.fillText('[E] INSPECCIONAR PANEL RALLADO', 256, 328);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    return texture;
  }

  /**
   * Genera la textura de alfombra victoriana (`horror`) o plataforma central (`scifi`).
   */
  public createRugOrDeckTexture(
    theme: ThemeType,
    palette: ThemeColorPalette
  ): THREE.CanvasTexture {
    const canvas = this.createCanvas(512, 512);
    const ctx = this.get2DContext(canvas);

    if (theme === 'horror') {
      ctx.fillStyle = '#4c191b';
      ctx.fillRect(0, 0, 512, 512);

      // Cenefas doradas y oscuras
      ctx.strokeStyle = '#9c7840';
      ctx.lineWidth = 14;
      ctx.strokeRect(26, 26, 460, 460);

      ctx.strokeStyle = '#240b0c';
      ctx.lineWidth = 6;
      ctx.strokeRect(48, 48, 416, 416);

      ctx.strokeStyle = '#b08b4f';
      ctx.lineWidth = 4;
      ctx.strokeRect(64, 64, 384, 384);

      // Medallón ornamental central
      ctx.fillStyle = '#331012';
      ctx.beginPath();
      ctx.arc(256, 256, 118, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#9c7840';
      ctx.lineWidth = 5;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(256, 256, 62, 0, Math.PI * 2);
      ctx.stroke();

      // Desgaste sutil
      for (const spot of [
        { x: 140, y: 170, r: 70 },
        { x: 350, y: 340, r: 85 },
      ]) {
        const g = ctx.createRadialGradient(spot.x, spot.y, 4, spot.x, spot.y, spot.r);
        g.addColorStop(0, 'rgba(20, 12, 10, 0.35)');
        g.addColorStop(1, 'rgba(20, 12, 10, 0)');
        ctx.fillStyle = g;
        ctx.fillRect(spot.x - spot.r, spot.y - spot.r, spot.r * 2, spot.r * 2);
      }
    } else {
      ctx.fillStyle = this.toCssHex(palette.wallPrimary);
      ctx.fillRect(0, 0, 512, 512);

      ctx.strokeStyle = 'rgba(0, 210, 255, 0.45)';
      ctx.lineWidth = 6;
      ctx.strokeRect(20, 20, 472, 472);

      ctx.strokeStyle = 'rgba(0, 245, 212, 0.35)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(256, 256, 140, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = 'rgba(0, 210, 255, 0.14)';
      ctx.fill();

      ctx.fillStyle = '#72efdd';
      ctx.textAlign = 'center';
      ctx.font = 'bold 26px Consolas, monospace';
      ctx.fillText('AETHER-9 // CORE', 256, 264);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    return texture;
  }

  /**
   * Genera la vista exterior de la ventana gótica (luna azulada) o ventanal espacial (nebulosa).
   */
  public createWindowBackdropTexture(theme: ThemeType): THREE.CanvasTexture {
    const canvas = this.createCanvas(384, 512);
    const ctx = this.get2DContext(canvas);

    if (theme === 'horror') {
      const grad = ctx.createLinearGradient(0, 0, 0, 512);
      grad.addColorStop(0, '#0b182e');
      grad.addColorStop(0.65, '#193154');
      grad.addColorStop(1, '#0c1522');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 384, 512);

      // Luna llena con halo frío
      const halo = ctx.createRadialGradient(230, 140, 18, 230, 140, 130);
      halo.addColorStop(0, 'rgba(220, 240, 255, 0.95)');
      halo.addColorStop(0.35, 'rgba(130, 180, 245, 0.45)');
      halo.addColorStop(1, 'rgba(25, 49, 84, 0)');
      ctx.fillStyle = halo;
      ctx.fillRect(80, 10, 280, 260);

      ctx.fillStyle = '#eef6ff';
      ctx.beginPath();
      ctx.arc(230, 140, 42, 0, Math.PI * 2);
      ctx.fill();

      // Ramas sombrías
      ctx.strokeStyle = '#070b12';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(0, 470);
      ctx.quadraticCurveTo(130, 370, 210, 260);
      ctx.moveTo(125, 365);
      ctx.lineTo(190, 340);
      ctx.stroke();
    } else {
      const grad = ctx.createLinearGradient(0, 0, 384, 512);
      grad.addColorStop(0, '#040914');
      grad.addColorStop(0.5, '#0b1d36');
      grad.addColorStop(1, '#120f29');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 384, 512);

      // Nebulosa cian/magenta
      const neb = ctx.createRadialGradient(160, 220, 15, 160, 220, 180);
      neb.addColorStop(0, 'rgba(0, 245, 212, 0.35)');
      neb.addColorStop(0.5, 'rgba(58, 134, 255, 0.2)');
      neb.addColorStop(1, 'rgba(4, 9, 20, 0)');
      ctx.fillStyle = neb;
      ctx.fillRect(0, 0, 384, 512);

      // Estrellas deterministas
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 65; i += 1) {
        const sx = (i * 73 + 29) % 374;
        const sy = (i * 137 + 17) % 502;
        const sr = (i % 3) * 0.7 + 0.8;
        ctx.beginPath();
        ctx.arc(sx, sy, sr, 0, Math.PI * 2);
        ctx.fill();
      }

      // Planeta lejano con anillo
      ctx.fillStyle = '#1f4e78';
      ctx.beginPath();
      ctx.arc(265, 160, 46, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(114, 239, 221, 0.55)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.ellipse(265, 160, 82, 18, -0.32, 0, Math.PI * 2);
      ctx.stroke();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    return texture;
  }

  /**
   * Genera cuadros decorativos (retratos góticos en `horror` o diagramas técnicos en `scifi`).
   */
  public createDecorWallArtTexture(
    theme: ThemeType,
    variant: number
  ): THREE.CanvasTexture {
    const canvas = this.createCanvas(256, 320);
    const ctx = this.get2DContext(canvas);

    if (theme === 'horror') {
      ctx.fillStyle = '#1b1412';
      ctx.fillRect(0, 0, 256, 320);
      ctx.strokeStyle = '#6f5430';
      ctx.lineWidth = 8;
      ctx.strokeRect(10, 10, 236, 300);

      // Silueta de retrato sombrío
      ctx.fillStyle = variant % 2 === 0 ? '#2b1f1c' : '#211920';
      ctx.beginPath();
      ctx.ellipse(128, 155, 76, 104, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#0d0908';
      ctx.beginPath();
      ctx.arc(128, 122, 34, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(128, 220, 56, 48, 0, Math.PI, 0, false);
      ctx.fill();
    } else {
      ctx.fillStyle = '#091826';
      ctx.fillRect(0, 0, 256, 320);
      ctx.strokeStyle = '#00d2ff';
      ctx.lineWidth = 4;
      ctx.strokeRect(10, 10, 236, 300);

      ctx.fillStyle = '#00f5d4';
      ctx.font = 'bold 16px Consolas, monospace';
      ctx.fillText(variant % 2 === 0 ? 'SYS // OXYGEN 18%' : 'SYS // HULL LOCK', 28, 46);

      ctx.strokeStyle = 'rgba(0, 210, 255, 0.45)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(128, 168, 64, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(42, 260);
      ctx.lineTo(92, 230);
      ctx.lineTo(148, 248);
      ctx.lineTo(214, 210);
      ctx.stroke();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    return texture;
  }

  /**
   * Genera la textura de `clue_wall`: oculta al inicio y con el PIN real revelado
   * (`4829` en tinta UV violácea para `horror`; `7391` en holograma cian para `scifi`).
   */
  public createClueWallTexture(
    theme: ThemeType,
    secretPin: string,
    isRevealed: boolean
  ): THREE.CanvasTexture {
    const canvas = this.createCanvas(512, 512);
    const ctx = this.get2DContext(canvas);

    if (theme === 'horror') {
      // Lienzo victoriano oscuro
      ctx.fillStyle = isRevealed ? '#1d102a' : '#1c1512';
      ctx.fillRect(0, 0, 512, 512);

      // Silueta arquitectónica sutil del cuadro antiguo
      ctx.strokeStyle = isRevealed ? 'rgba(130, 86, 175, 0.35)' : 'rgba(90, 68, 52, 0.3)';
      ctx.lineWidth = 3;
      ctx.strokeRect(24, 24, 464, 464);

      ctx.fillStyle = isRevealed ? 'rgba(42, 20, 64, 0.6)' : 'rgba(38, 28, 22, 0.7)';
      ctx.beginPath();
      ctx.arc(256, 240, 120, 0, Math.PI * 2);
      ctx.fill();

      if (isRevealed) {
        ctx.save();
        ctx.shadowColor = '#c77dff';
        ctx.shadowBlur = 26;
        ctx.fillStyle = '#e0aaff';
        ctx.textAlign = 'center';
        ctx.font = 'bold 28px Georgia, serif';
        ctx.fillText('TINTA ULTRAVIOLETA', 256, 130);

        ctx.font = 'bold 118px Georgia, serif';
        ctx.fillText(secretPin, 256, 292);

        ctx.font = '22px Georgia, serif';
        ctx.fillText('CLAVE DE LA CAJA FUERTE', 256, 372);
        ctx.restore();
      } else {
        ctx.fillStyle = 'rgba(125, 102, 82, 0.45)';
        ctx.textAlign = 'center';
        ctx.font = 'italic 24px Georgia, serif';
        ctx.fillText('Lienzo en penumbras', 256, 252);
        ctx.font = '18px Georgia, serif';
        ctx.fillText('(Requiere energía UV)', 256, 288);
      }
    } else {
      ctx.fillStyle = isRevealed ? '#041c2c' : '#0b121b';
      ctx.fillRect(0, 0, 512, 512);

      ctx.strokeStyle = isRevealed ? '#00f5d4' : '#243b53';
      ctx.lineWidth = 4;
      ctx.strokeRect(20, 20, 472, 472);

      // Líneas de escaneo
      ctx.strokeStyle = isRevealed ? 'rgba(0, 245, 212, 0.14)' : 'rgba(60, 90, 120, 0.15)';
      ctx.lineWidth = 1;
      for (let y = 32; y < 480; y += 16) {
        ctx.beginPath();
        ctx.moveTo(24, y);
        ctx.lineTo(488, y);
        ctx.stroke();
      }

      ctx.textAlign = 'center';
      if (isRevealed) {
        ctx.save();
        ctx.shadowColor = '#00f5d4';
        ctx.shadowBlur = 28;
        ctx.fillStyle = '#72efdd';
        ctx.font = 'bold 26px Consolas, monospace';
        ctx.fillText('HOLOGRAMA ACTIVO // AETHER-9', 256, 126);

        ctx.fillStyle = '#00f5d4';
        ctx.font = 'bold 120px Consolas, monospace';
        ctx.fillText(secretPin, 256, 295);

        ctx.fillStyle = '#ade8f4';
        ctx.font = '22px Consolas, monospace';
        ctx.fillText('PIN TERMINAL CRIOGÉNICA', 256, 375);
        ctx.restore();
      } else {
        ctx.fillStyle = '#486581';
        ctx.font = 'bold 26px Consolas, monospace';
        ctx.fillText('PROYECTOR EN ESPERA', 256, 248);
        ctx.font = '18px Consolas, monospace';
        ctx.fillText('SIN ENERGÍA DE CIRCUITOS', 256, 286);
      }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    return texture;
  }

  /**
   * Genera la placa de letra ('A', 'B' o 'C') para cada interruptor del panel.
   */
  public createSwitchLabelTexture(
    symbol: 'A' | 'B' | 'C',
    theme: ThemeType
  ): THREE.CanvasTexture {
    const canvas = this.createCanvas(128, 128);
    const ctx = this.get2DContext(canvas);

    ctx.fillStyle = theme === 'horror' ? '#2c2219' : '#0f2336';
    ctx.fillRect(0, 0, 128, 128);
    ctx.strokeStyle = theme === 'horror' ? '#b08b4f' : '#00d2ff';
    ctx.lineWidth = 6;
    ctx.strokeRect(8, 8, 112, 112);

    ctx.fillStyle = theme === 'horror' ? '#f3dfc1' : '#72efdd';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 72px Consolas, monospace';
    ctx.fillText(symbol, 64, 68);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    return texture;
  }

  /**
   * Genera la textura del teclado numérico de la caja fuerte / terminal criogénica.
   */
  public createKeypadTexture(
    theme: ThemeType,
    isUnlocked: boolean
  ): THREE.CanvasTexture {
    const canvas = this.createCanvas(256, 320);
    const ctx = this.get2DContext(canvas);

    ctx.fillStyle = theme === 'horror' ? '#1f1c18' : '#0c1824';
    ctx.fillRect(0, 0, 256, 320);
    ctx.strokeStyle = theme === 'horror' ? '#9e7c47' : '#00d2ff';
    ctx.lineWidth = 4;
    ctx.strokeRect(6, 6, 244, 308);

    // Visor superior
    ctx.fillStyle = isUnlocked ? '#0d3b26' : '#2b1215';
    ctx.fillRect(24, 22, 208, 48);
    ctx.fillStyle = isUnlocked ? '#52ffb8' : '#ff6b6b';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 24px Consolas, monospace';
    ctx.fillText(isUnlocked ? 'OPEN' : 'LOCKED', 128, 46);

    const labels = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'];
    for (let index = 0; index < labels.length; index += 1) {
      const col = index % 3;
      const row = Math.floor(index / 3);
      const bx = 26 + col * 72;
      const by = 88 + row * 54;

      ctx.fillStyle = theme === 'horror' ? '#4a3c2c' : '#1a3248';
      ctx.fillRect(bx, by, 58, 42);
      ctx.strokeStyle = theme === 'horror' ? '#b08b4f' : '#3ea6ff';
      ctx.lineWidth = 2;
      ctx.strokeRect(bx, by, 58, 42);

      ctx.fillStyle = '#f0f6fc';
      ctx.font = 'bold 22px Consolas, monospace';
      ctx.fillText(labels[index], bx + 29, by + 22);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    return texture;
  }

  private createCanvas(width: number, height: number): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }

  private get2DContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('ProceduralTextureFactory: no se pudo inicializar contexto 2D.');
    }
    return ctx;
  }

  private toRepeatableTexture(
    canvas: HTMLCanvasElement,
    repeatX: number,
    repeatY: number
  ): THREE.CanvasTexture {
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(repeatX, repeatY);
    texture.needsUpdate = true;
    return texture;
  }

  private toCssHex(colorValue: number): string {
    return `#${colorValue.toString(16).padStart(6, '0')}`;
  }

  private shiftHex(colorValue: number, delta: number): string {
    const r = THREE.MathUtils.clamp(((colorValue >> 16) & 0xff) + delta, 0, 255);
    const g = THREE.MathUtils.clamp(((colorValue >> 8) & 0xff) + delta, 0, 255);
    const b = THREE.MathUtils.clamp((colorValue & 0xff) + delta, 0, 255);
    return `rgb(${r}, ${g}, ${b})`;
  }
}

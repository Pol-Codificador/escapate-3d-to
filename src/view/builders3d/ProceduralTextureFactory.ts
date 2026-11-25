/**
 * @pattern MVC (Arquitectónico) — Consumidor de Abstract Factory
 * @role Procedural Texture Builder (Vista 3D)
 *
 * Problema de diseño que resuelve:
 * Genera texturas procedurales `THREE.CanvasTexture` en memoria (sin archivos
 * de imagen externos) adaptadas a la temática (`'horror'` o `'scifi'`) y a los
 * datos reales del Modelo (secuencia de interruptores y código PIN oculto).
 */

import * as THREE from 'three';
import type {
  ThemeColorPalette,
  ThemeType,
} from '../../core/interfaces/IThemeFactory';

/**
 * Fábrica de texturas procedurales en `CanvasTexture` para la escena 3D.
 */
export class ProceduralTextureFactory {
  private readonly createdTextures: THREE.CanvasTexture[];

  constructor() {
    this.createdTextures = [];
  }

  /**
   * Genera la textura del suelo: tablones envejecidos (`horror`) o rejilla hexagonal (`scifi`).
   */
  public createFloorTexture(
    theme: ThemeType,
    palette: ThemeColorPalette
  ): THREE.CanvasTexture {
    const canvas = this.createCanvas(512, 512);
    const ctx = this.getContext(canvas);
    const baseHex = this.toCssHex(palette.floor);

    ctx.fillStyle = baseHex;
    ctx.fillRect(0, 0, 512, 512);

    if (theme === 'horror') {
      const plankRows = 8;
      const plankHeight = 512 / plankRows;

      for (let row = 0; row < plankRows; row += 1) {
        const y = row * plankHeight;
        const shade = row % 2 === 0 ? 'rgba(65, 42, 30, 0.45)' : 'rgba(22, 14, 10, 0.4)';
        ctx.fillStyle = shade;
        ctx.fillRect(0, y, 512, plankHeight);

        // Vetas de madera
        ctx.strokeStyle = 'rgba(18, 10, 8, 0.35)';
        ctx.lineWidth = 1.5;
        for (let g = 0; g < 6; g += 1) {
          const gy = y + 8 + g * ((plankHeight - 16) / 6);
          ctx.beginPath();
          ctx.moveTo(0, gy);
          ctx.bezierCurveTo(160, gy + (g % 2 === 0 ? 4 : -4), 340, gy - 3, 512, gy);
          ctx.stroke();
        }

        // Junta horizontal entre tablones
        ctx.fillStyle = 'rgba(8, 5, 4, 0.85)';
        ctx.fillRect(0, y, 512, 3);

        // Junta vertical escalonada y clavos
        const splitX = ((row * 173 + 96) % 420) + 46;
        ctx.fillRect(splitX, y, 3, plankHeight);
        ctx.fillStyle = 'rgba(95, 78, 60, 0.5)';
        ctx.beginPath();
        ctx.arc(splitX - 10, y + 14, 2.5, 0, Math.PI * 2);
        ctx.arc(splitX - 10, y + plankHeight - 14, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      // Suelo metálico hexagonal/rejilla Sci-Fi
      ctx.fillStyle = '#0d1520';
      ctx.fillRect(0, 0, 512, 512);

      const tileSize = 128;
      for (let gx = 0; gx < 512; gx += tileSize) {
        for (let gy = 0; gy < 512; gy += tileSize) {
          ctx.strokeStyle = 'rgba(0, 210, 255, 0.22)';
          ctx.lineWidth = 2;
          ctx.strokeRect(gx + 3, gy + 3, tileSize - 6, tileSize - 6);

          // Patrón hexagonal interior
          this.drawHexagon(ctx, gx + tileSize / 2, gy + tileSize / 2, 38);
          ctx.strokeStyle = 'rgba(86, 134, 178, 0.32)';
          ctx.lineWidth = 1.5;
          ctx.stroke();

          // Remaches en esquinas
          ctx.fillStyle = 'rgba(160, 210, 240, 0.4)';
          const offsets = [12, tileSize - 12];
          for (const ox of offsets) {
            for (const oy of offsets) {
              ctx.beginPath();
              ctx.arc(gx + ox, gy + oy, 3, 0, Math.PI * 2);
              ctx.fill();
            }
          }
        }
      }
    }

    return this.finalizeTexture(canvas, true, 4, 4);
  }

  /**
   * Genera la textura de paredes: papel tapiz victoriano gastado (`horror`) o mamparos (`scifi`).
   */
  public createWallTexture(
    theme: ThemeType,
    palette: ThemeColorPalette
  ): THREE.CanvasTexture {
    const canvas = this.createCanvas(512, 512);
    const ctx = this.getContext(canvas);

    ctx.fillStyle = this.toCssHex(palette.wallPrimary);
    ctx.fillRect(0, 0, 512, 512);

    if (theme === 'horror') {
      // Franjas verticales victorianas
      for (let x = 0; x < 512; x += 64) {
        ctx.fillStyle =
          (x / 64) % 2 === 0
            ? 'rgba(59, 38, 33, 0.5)'
            : 'rgba(24, 15, 13, 0.45)';
        ctx.fillRect(x, 0, 64, 512);

        // Motivos romboidales adamascados
        ctx.strokeStyle = 'rgba(139, 108, 66, 0.16)';
        ctx.lineWidth = 1.5;
        for (let y = 32; y < 512; y += 64) {
          ctx.beginPath();
          ctx.moveTo(x + 32, y - 18);
          ctx.lineTo(x + 48, y);
          ctx.lineTo(x + 32, y + 18);
          ctx.lineTo(x + 16, y);
          ctx.closePath();
          ctx.stroke();
        }
      }

      // Manchas sutiles de humedad y envejecimiento
      for (let i = 0; i < 14; i += 1) {
        const rx = (i * 97 + 41) % 512;
        const ry = (i * 151 + 29) % 512;
        const grad = ctx.createRadialGradient(rx, ry, 4, rx, ry, 65);
        grad.addColorStop(0, 'rgba(10, 7, 6, 0.35)');
        grad.addColorStop(1, 'rgba(10, 7, 6, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(rx - 70, ry - 70, 140, 140);
      }
    } else {
      // Mamparos de titanio con juntas y franjas de advertencia inferiores
      ctx.fillStyle = '#182636';
      ctx.fillRect(0, 0, 512, 512);

      for (let x = 0; x < 512; x += 128) {
        ctx.fillStyle = 'rgba(36, 59, 83, 0.35)';
        ctx.fillRect(x + 6, 20, 116, 380);
        ctx.strokeStyle = 'rgba(0, 210, 255, 0.25)';
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 6, 20, 116, 380);

        // Ranuras de ventilación superior
        ctx.fillStyle = 'rgba(9, 16, 25, 0.7)';
        for (let slot = 0; slot < 4; slot += 1) {
          ctx.fillRect(x + 24, 48 + slot * 14, 80, 6);
        }
      }

      // Franja de advertencia diagonal inferior
      ctx.fillStyle = '#111923';
      ctx.fillRect(0, 424, 512, 88);
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 434, 512, 28);
      ctx.clip();
      ctx.fillStyle = '#e09f24';
      ctx.fillRect(0, 434, 512, 28);
      ctx.fillStyle = '#14191f';
      for (let sx = -40; sx < 560; sx += 36) {
        ctx.beginPath();
        ctx.moveTo(sx, 462);
        ctx.lineTo(sx + 18, 462);
        ctx.lineTo(sx + 36, 434);
        ctx.lineTo(sx + 18, 434);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();

      // Línea luminosa cian
      ctx.fillStyle = 'rgba(0, 245, 212, 0.65)';
      ctx.fillRect(0, 412, 512, 4);
    }

    return this.finalizeTexture(canvas, true, 3, 1);
  }

  /**
   * Genera la textura del techo según la temática.
   */
  public createCeilingTexture(
    theme: ThemeType,
    palette: ThemeColorPalette
  ): THREE.CanvasTexture {
    const canvas = this.createCanvas(256, 256);
    const ctx = this.getContext(canvas);
    ctx.fillStyle = this.toCssHex(palette.ceiling);
    ctx.fillRect(0, 0, 256, 256);

    if (theme === 'horror') {
      ctx.strokeStyle = 'rgba(74, 47, 36, 0.55)';
      ctx.lineWidth = 8;
      ctx.strokeRect(8, 8, 240, 240);
      ctx.lineWidth = 4;
      ctx.strokeRect(28, 28, 200, 200);
    } else {
      ctx.strokeStyle = 'rgba(0, 210, 255, 0.16)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 256; i += 64) {
        ctx.strokeRect(i + 4, 4, 56, 248);
      }
    }

    return this.finalizeTexture(canvas, true, 4, 4);
  }

  /**
   * Genera la textura legible de la nota o datapad colocado sobre el escritorio.
   */
  public createNoteTexture(
    theme: ThemeType,
    sequenceSteps: readonly string[]
  ): THREE.CanvasTexture {
    const canvas = this.createCanvas(512, 512);
    const ctx = this.getContext(canvas);
    const seqText = sequenceSteps.join(' → ');

    if (theme === 'horror') {
      ctx.fillStyle = '#e7d5ad';
      ctx.fillRect(0, 0, 512, 512);

      // Bordes envejecidos
      const borderGrad = ctx.createRadialGradient(256, 256, 120, 256, 256, 360);
      borderGrad.addColorStop(0, 'rgba(139, 98, 52, 0)');
      borderGrad.addColorStop(1, 'rgba(92, 56, 24, 0.55)');
      ctx.fillStyle = borderGrad;
      ctx.fillRect(0, 0, 512, 512);

      ctx.fillStyle = '#2d1c12';
      ctx.font = 'bold 30px Georgia, serif';
      ctx.fillText('Bitácora del Guardián', 44, 72);

      ctx.strokeStyle = '#6f4e37';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(44, 92);
      ctx.lineTo(468, 92);
      ctx.stroke();

      ctx.font = '22px Georgia, serif';
      ctx.fillText('La lámpara UV requiere energía.', 44, 146);
      ctx.fillText('Restaura la caja de fusibles', 44, 184);
      ctx.fillText('en el orden exacto:', 44, 222);

      ctx.fillStyle = '#7a1c1c';
      ctx.font = 'bold 54px Georgia, serif';
      ctx.fillText(seqText, 110, 326);

      ctx.fillStyle = '#3d281a';
      ctx.font = 'italic 20px Georgia, serif';
      ctx.fillText('— Luego examina la pared este.', 44, 424);
    } else {
      ctx.fillStyle = '#071926';
      ctx.fillRect(0, 0, 512, 512);

      ctx.strokeStyle = '#00d2ff';
      ctx.lineWidth = 6;
      ctx.strokeRect(18, 18, 476, 476);

      ctx.fillStyle = 'rgba(0, 210, 255, 0.14)';
      ctx.fillRect(30, 30, 452, 64);

      ctx.fillStyle = '#00f5d4';
      ctx.font = 'bold 26px Consolas, monospace';
      ctx.fillText('DATAPAD // PROTOCOLO AETHER-9', 46, 70);

      ctx.fillStyle = '#ccefff';
      ctx.font = '21px Consolas, monospace';
      ctx.fillText('PROYECTOR ESTE: SIN ENERGÍA', 46, 148);
      ctx.fillText('CALIBRAR CIRCUITOS AUXILIARES:', 46, 192);

      ctx.strokeStyle = '#00f5d4';
      ctx.lineWidth = 2;
      ctx.strokeRect(64, 240, 384, 108);

      ctx.fillStyle = '#00f5d4';
      ctx.font = 'bold 52px Consolas, monospace';
      ctx.fillText(seqText, 118, 312);

      ctx.fillStyle = '#7fd8ff';
      ctx.font = '19px Consolas, monospace';
      ctx.fillText('> ACTIVAR NODOS EN EL PANEL OESTE', 46, 420);
    }

    return this.finalizeTexture(canvas, false, 1, 1);
  }

  /**
   * Genera la textura del cuadro/holograma de pista (`clue_wall`) usando el PIN real del Modelo.
   */
  public createClueWallTexture(
    theme: ThemeType,
    secretCode: string,
    revealed: boolean
  ): THREE.CanvasTexture {
    const canvas = this.createCanvas(512, 384);
    const ctx = this.getContext(canvas);

    if (theme === 'horror') {
      // Lienzo oscuro al óleo
      const bg = ctx.createLinearGradient(0, 0, 0, 384);
      bg.addColorStop(0, '#1e1615');
      bg.addColorStop(1, '#0e0a09');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, 512, 384);

      // Silueta abstracta de mansión/árboles
      ctx.fillStyle = 'rgba(60, 44, 38, 0.45)';
      ctx.fillRect(180, 140, 152, 180);
      ctx.beginPath();
      ctx.moveTo(160, 145);
      ctx.lineTo(256, 75);
      ctx.lineTo(352, 145);
      ctx.closePath();
      ctx.fill();

      if (revealed) {
        // Resplandor de tinta UV violácea con el código real
        const uvGlow = ctx.createRadialGradient(256, 196, 20, 256, 196, 210);
        uvGlow.addColorStop(0, 'rgba(157, 78, 221, 0.42)');
        uvGlow.addColorStop(1, 'rgba(123, 44, 191, 0)');
        ctx.fillStyle = uvGlow;
        ctx.fillRect(0, 0, 512, 384);

        ctx.textAlign = 'center';
        ctx.fillStyle = '#d8b4fe';
        ctx.font = 'bold 24px Georgia, serif';
        ctx.fillText('TINTA ULTRAVIOLETA REVELADA', 256, 98);

        ctx.shadowColor = '#c77dff';
        ctx.shadowBlur = 24;
        ctx.fillStyle = '#f3e8ff';
        ctx.font = 'bold 104px Georgia, serif';
        ctx.fillText(secretCode, 256, 232);
        ctx.shadowBlur = 0;

        ctx.fillStyle = '#c77dff';
        ctx.font = '20px Georgia, serif';
        ctx.fillText('CÓDIGO DE LA CAJA FUERTE', 256, 304);
      } else {
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(150, 125, 105, 0.35)';
        ctx.font = 'italic 20px Georgia, serif';
        ctx.fillText('Superficie oscurecida — requiere luz UV', 256, 336);
      }
    } else {
      ctx.fillStyle = '#06111c';
      ctx.fillRect(0, 0, 512, 384);

      ctx.strokeStyle = revealed ? '#00f5d4' : '#1f364d';
      ctx.lineWidth = 4;
      ctx.strokeRect(16, 16, 480, 352);

      // Rejilla de proyección
      ctx.strokeStyle = revealed
        ? 'rgba(0, 245, 212, 0.16)'
        : 'rgba(40, 70, 95, 0.16)';
      ctx.lineWidth = 1;
      for (let gx = 32; gx < 480; gx += 32) {
        ctx.beginPath();
        ctx.moveTo(gx, 20);
        ctx.lineTo(gx, 364);
        ctx.stroke();
      }
      for (let gy = 32; gy < 364; gy += 32) {
        ctx.beginPath();
        ctx.moveTo(20, gy);
        ctx.lineTo(492, gy);
        ctx.stroke();
      }

      ctx.textAlign = 'center';
      if (revealed) {
        ctx.fillStyle = '#7fffe8';
        ctx.font = 'bold 22px Consolas, monospace';
        ctx.fillText('HOLOGRAMA ACTIVO // AUTORIZACIÓN', 256, 86);

        ctx.shadowColor = '#00f5d4';
        ctx.shadowBlur = 26;
        ctx.fillStyle = '#e0fffb';
        ctx.font = 'bold 108px Consolas, monospace';
        ctx.fillText(secretCode, 256, 224);
        ctx.shadowBlur = 0;

        ctx.fillStyle = '#00d2ff';
        ctx.font = '20px Consolas, monospace';
        ctx.fillText('PIN DE TERMINAL CRIOGÉNICA', 256, 304);
      } else {
        ctx.fillStyle = '#3b5875';
        ctx.font = 'bold 26px Consolas, monospace';
        ctx.fillText('EMISOR OFFLINE', 256, 182);
        ctx.font = '18px Consolas, monospace';
        ctx.fillText('SIN ENERGÍA DE CIRCUITOS', 256, 222);
      }
    }

    return this.finalizeTexture(canvas, false, 1, 1);
  }

  /**
   * Genera la placa de etiqueta (`A`, `B`, `C`) para cada interruptor del panel.
   */
  public createSwitchLabelTexture(
    symbol: string,
    theme: ThemeType
  ): THREE.CanvasTexture {
    const canvas = this.createCanvas(128, 128);
    const ctx = this.getContext(canvas);

    ctx.fillStyle = theme === 'horror' ? '#2c1e16' : '#0f2233';
    ctx.fillRect(0, 0, 128, 128);

    ctx.strokeStyle = theme === 'horror' ? '#b88c52' : '#00d2ff';
    ctx.lineWidth = 6;
    ctx.strokeRect(8, 8, 112, 112);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = theme === 'horror' ? '#f5deb3' : '#7fffe8';
    ctx.font = 'bold 72px Consolas, monospace';
    ctx.fillText(symbol, 64, 68);

    return this.finalizeTexture(canvas, false, 1, 1);
  }

  /**
   * Genera la textura del teclado numérico de la caja fuerte / terminal criogénica.
   */
  public createKeypadTexture(theme: ThemeType): THREE.CanvasTexture {
    const canvas = this.createCanvas(256, 320);
    const ctx = this.getContext(canvas);

    ctx.fillStyle = theme === 'horror' ? '#25211e' : '#0b1824';
    ctx.fillRect(0, 0, 256, 320);

    // Visor superior
    ctx.fillStyle = theme === 'horror' ? '#101912' : '#042636';
    ctx.fillRect(24, 20, 208, 48);
    ctx.strokeStyle = theme === 'horror' ? '#8b6c42' : '#00d2ff';
    ctx.lineWidth = 3;
    ctx.strokeRect(24, 20, 208, 48);

    ctx.textAlign = 'center';
    ctx.fillStyle = theme === 'horror' ? '#95d5b2' : '#00f5d4';
    ctx.font = 'bold 26px Consolas, monospace';
    ctx.fillText('----', 128, 53);

    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'];
    const cellW = 58;
    const cellH = 44;

    keys.forEach((key, index) => {
      const col = index % 3;
      const row = Math.floor(index / 3);
      const x = 26 + col * 72;
      const y = 86 + row * 54;

      ctx.fillStyle = theme === 'horror' ? '#52463a' : '#19354d';
      ctx.fillRect(x, y, cellW, cellH);
      ctx.strokeStyle = theme === 'horror' ? '#9c7d52' : '#00b4d8';
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, cellW, cellH);

      ctx.fillStyle = theme === 'horror' ? '#f5e9d6' : '#d6f8ff';
      ctx.font = 'bold 24px Consolas, monospace';
      ctx.fillText(key, x + cellW / 2, y + 30);
    });

    return this.finalizeTexture(canvas, false, 1, 1);
  }

  /**
   * Libera de GPU todas las texturas creadas por esta instancia.
   */
  public disposeAll(): void {
    for (const texture of this.createdTextures) {
      texture.dispose();
    }
    this.createdTextures.length = 0;
  }

  private createCanvas(width: number, height: number): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }

  private getContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('No se pudo obtener el contexto 2D para generar textura procedural.');
    }
    return ctx;
  }

  private finalizeTexture(
    canvas: HTMLCanvasElement,
    repeat: boolean,
    repeatX: number,
    repeatY: number
  ): THREE.CanvasTexture {
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;

    if (repeat) {
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(repeatX, repeatY);
    }

    texture.needsUpdate = true;
    this.createdTextures.push(texture);
    return texture;
  }

  private drawHexagon(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    radius: number
  ): void {
    ctx.beginPath();
    for (let i = 0; i < 6; i += 1) {
      const angle = (Math.PI / 3) * i;
      const px = cx + Math.cos(angle) * radius;
      const py = cy + Math.sin(angle) * radius;
      if (i === 0) {
        ctx.moveTo(px, py);
      } else {
        ctx.lineTo(px, py);
      }
    }
    ctx.closePath();
  }

  private toCssHex(color: number): string {
    return `#${color.toString(16).padStart(6, '0')}`;
  }
}

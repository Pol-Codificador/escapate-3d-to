# Escápate!! — Escape Room Interactivo 3D

Proyecto académico para el curso de **Tecnología de Objetos**: un **Escape Room Interactivo 3D en primera persona** que se ejecuta directamente en el navegador, construido con **Vite**, **TypeScript en modo estricto**, **Three.js procedural** y **HUD en HTML/CSS puro** (sin frameworks de interfaz).

---

## Créditos Académicos

- **Proyecto:** Escápate!! — Escape Room Interactivo 3D
- **Universidad:** Universidad Nacional de San Agustín de Arequipa (UNSA) — Escuela Profesional de Ingeniería de Sistemas (EPIS)
- **Curso:** Tecnología de Objetos
- **Docente:** Mg. Diego Alonso Iquira Becerra
- **Integrantes:**
  - Ccahua Chise, Elizabeth Karina
  - Chavez Cuno, Deivick Paul Eddi
  - Llave Aguilar, Jafet Martin

---

## Stack Tecnológico

- **Motor 3D:** Three.js (geometrías compuestas `THREE.Group`, `MeshStandardMaterial`, `THREE.CanvasTexture` procedurales, sombras e iluminación dinámica).
- **Lenguaje:** TypeScript (`strict: true`, `verbatimModuleSyntax: true`, `erasableSyntaxOnly: true`).
- **Empaquetador / Dev Server:** Vite (`vanilla-ts`).
- **Interfaz HUD:** HTML5 + CSS3 puro desacoplado de la lógica de juego.

---

## Instalación y Comandos

```bash
# 1. Instalar dependencias
npm install

# 2. Iniciar servidor de desarrollo
npm run dev

# 3. Verificar tipado estricto de TypeScript sin emitir archivos
npx tsc --noEmit

# 4. Compilar versión de producción
npm run build
```

---

## Controles Previstos (Modo Primera Persona)

| Entrada | Acción |
| --- | --- |
| `W` `A` `S` `D` | Desplazamiento libre en primera persona con colisiones |
| `Ratón` (Pointer Lock) | Rotación de cámara y apuntado con mira central |
| `Click izquierdo` / `E` | Interactuar con el objeto apuntado (inspeccionar, recoger, accionar) |
| `1` – `5` | Seleccionar ranura rápida del inventario |
| `Z` | Deshacer última acción reversible (`Command.undo()`) |
| `ESC` | Liberar puntero / cerrar modal activo |

---

## Arquitectura MVC y Mapa de Patrones de Diseño (GoF)

El sistema aplica **MVC estricto**: `src/model/` y `src/core/interfaces/` tienen prohibido importar `three` o acceder al DOM (`document`, `window`). Toda comunicación entre capas se canaliza mediante interfaces y patrones explícitos:

| Categoría | Patrón | Rol / Clases | Ubicación |
| --- | --- | --- | --- |
| Arquitectónico | **MVC** | Separación estricta Model / View / Controller | `src/model/`, `src/view/`, `src/controller/` |
| Comportamental | **Observer** | `IObserver<T>`, `ISubject<T>` (`GameTimer`, `Inventory`, `Puzzle`, `Room`, `GameManager` $\rightarrow$ `ExitDoor`, `AudioManager`, HUD/Vista) | `src/core/interfaces/IObserver.ts`, `src/model/`, `src/core/singletons/` |
| Comportamental | **Strategy** | `IPuzzleValidationStrategy` (`SequenceStrategy`, `PinCodeStrategy`, `ItemUnlockStrategy`) + Contexto `Puzzle` | `src/core/interfaces/IPuzzleValidationStrategy.ts`, `src/model/puzzles/` |
| Comportamental | **Command** | `ICommand` (contrato listo; comandos concretos en Fase 2) | `src/core/interfaces/ICommand.ts`, `src/controller/commands/` |
| Creacional | **Abstract Factory** | `IThemeFactory` (`HorrorThemeFactory`, `SciFiThemeFactory`) | `src/core/interfaces/IThemeFactory.ts`, `src/model/factories/` |
| Creacional | **Builder** | `RoomBuilder`, `RoomDirector`, producto `Room` | `src/model/builders/`, `src/model/entities/Room.ts` |
| Creacional | **Prototype** | `IPrototype<T>` (`Room`, `Puzzle`, `InteractiveObject`, `ExitDoor`, `Inventory`, `InventoryItem`, estrategias) | `src/core/interfaces/IPrototype.ts`, `src/model/` |
| Creacional | **Singleton** | `GameManager`, `AudioManager` | `src/core/singletons/` |

---

## Documentación Viva

- Reglas permanentes de arquitectura: [`.agent/rules/arquitectura-to.md`](.agent/rules/arquitectura-to.md)
- Arquitectura y diagramas UML (Mermaid): [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- Bitácora técnica paso a paso: [`docs/DEVLOG_DETALLADO.md`](docs/DEVLOG_DETALLADO.md)

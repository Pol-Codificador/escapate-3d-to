# Reglas Permanentes de Arquitectura — Proyecto ESCAPA TO

Estas reglas son **obligatorias** en toda tarea, fase o modificación futura dentro de este repositorio. Su propósito es garantizar una arquitectura limpia, evaluable para el curso de **Tecnología de Objetos** y estrictamente desacoplada entre lógica de negocio, representación 3D/DOM y coordinación de comandos.

---

## Regla 1 — MVC Estricto

El código fuente dentro de `src/` debe respetar una separación estricta en tres capas:

1. **Modelo (`src/model/` y contratos base en `src/core/interfaces/`):**
   - Contiene el **100 % de la lógica pura del juego**: entidades de sala, acertijos, estrategias de validación, inventario, temporizador, fábricas temáticas, builders y prototipos.
   - **PROHIBICIÓN ABSOLUTA:** Está estrictamente prohibido importar `three` (`THREE`) o acceder a APIs del navegador / DOM (`document`, `window`, `HTMLElement`, `localStorage`, `AudioContext`, etc.) dentro de `src/model/` y `src/core/interfaces/`.
   - El Modelo solo expone estado y notifica cambios mediante el patrón **Observer** (`ISubject<T>` / `IObserver<T>`).

2. **Vista (`src/view/`):**
   - Maneja exclusivamente **Three.js** (escena, cámara FPS, iluminación, niebla, muebles procedurales, raycasting) y el **HUD en HTML/CSS puro** (sin React, Vue, Angular ni librerías/frameworks de UI).
   - **PROHIBICIÓN:** La Vista **NO modifica** datos ni reglas del Modelo directamente. Se limita a:
     - Observar cambios del Modelo implementando `IObserver<T>` para reflejarlos en el mundo 3D o en el HUD.
     - Capturar interacciones del jugador (clics, teclado, raycast) y reenviarlas al Controlador.

3. **Controlador (`src/controller/`):**
   - Recibe los eventos de interacción procedentes de la Vista.
   - Traduce cada intención del usuario en una instancia concreta de `ICommand` y la ejecuta a través del Invoker (con registro en historial para soporte `undo()`).

---

## Regla 2 — Patrones de Diseño Explícitos y Limpios

Todo archivo que implemente o participe en un patrón de diseño debe cumplir:

1. **Nomenclatura canónica clara:** Los nombres de clases, interfaces y archivos deben reflejar el rol dentro del patrón (ej. `PinCodeStrategy`, `RoomBuilder`, `RoomDirector`, `HorrorThemeFactory`, `InspectCommand`).
2. **Bloque JSDoc obligatorio al inicio del archivo:** Cada archivo de patrón debe incluir en su cabecera JSDoc:
   - `@pattern` — Nombre del patrón y su categoría (ej. `Strategy (GoF Comportamental)`).
   - `@role` — Rol exacto en el patrón (ej. `Subject`, `Observer`, `ConcreteStrategy`, `ConcreteCommand`, `Invoker`, `Receiver`, `AbstractFactory`, `Builder`, `Director`, `Singleton`, `Prototype`).
   - Descripción breve del **problema de diseño que resuelve** en este proyecto.

### Catálogo obligatorio de patrones del proyecto

- **Arquitectónico:**
  - **MVC** (`src/model/`, `src/view/`, `src/controller/`).
- **Comportamentales:**
  - **Observer:** Sujetos (`Timer`, `Inventory`, `Puzzles`) $\rightarrow$ Observadores (`HUD`, `Luces`, `Audio`, `Puerta`).
  - **Strategy:** Validación desacoplada de acertijos mediante `IPuzzleValidationStrategy` (`SequenceStrategy`, `PinCodeStrategy`, `ItemUnlockStrategy`).
  - **Command:** Acciones encapsuladas con historial y soporte `undo()` (`InspectCommand`, `ToggleSwitchCommand`, `InputCodeCommand`, `PickUpItemCommand`, `UseItemCommand`).
- **Creacionales:**
  - **Abstract Factory:** Familias coherentes de configuración visual, lumínica, sonora y narrativa por temática (`HorrorThemeFactory`, `SciFiThemeFactory`) implementando `IThemeFactory`.
  - **Builder:** Construcción paso a paso de salas complejas (`RoomBuilder` + `RoomDirector`).
  - **Prototype:** Clonación profunda del estado inicial para reiniciar la sala (`IPrototype<T>.clone()`).
  - **Singleton:** Puntos de acceso únicos controlados (`GameManager`, `AudioManager`).

---

## Regla 3 — Calidad Visual 3D (Three.js Procedural)

1. **Prohibido usar cubos simples sin detalle:** Todo mueble, puerta, panel o elemento interactivo debe construirse como un `THREE.Group` compuesto por múltiples geometrías (marcos, patas, tiradores, bisagras, pantallas, relieves, etc.).
2. **Materiales y texturas procedurales:**
   - Usar `THREE.MeshStandardMaterial` con valores calibrados de `roughness` y `metalness`.
   - Generar texturas procedurales con `THREE.CanvasTexture` (madera, metal cepillado, baldosas, pantallas, notas con texto legible, paneles de control).
3. **Iluminación, sombras y feedback visual:**
   - Sombras habilitadas (`castShadow` y `receiveShadow`) en escena, luces y mallas relevantes.
   - Resaltado emisivo claro sobre el objeto interactivo apuntado por la mira en primera persona (raycasting desde el centro de cámara).
4. **Controles FPS y Pointer Lock:**
   - Movimiento libre en primera persona (`WASD` + ratón con **Pointer Lock**) con detección de colisiones contra paredes y muebles.
   - Al abrir un modal de acertijo, teclado numérico o nota, se debe **liberar el Pointer Lock automáticamente** (`document.exitPointerLock()`), y **recuperarlo al cerrar** el modal para continuar explorando sin fricción.

---

## Regla 4 — Bitácora Viva Obligatoria (`docs/DEVLOG_DETALLADO.md`)

Después de **CADA** paso, cambio o funcionalidad implementada, es **OBLIGATORIO** agregar una nueva entrada numerada en `docs/DEVLOG_DETALLADO.md`, redactada en español claro y didáctico para que todos los integrantes del equipo puedan comprender y explicar cada decisión técnica.

Cada entrada DEBE incluir exactamente estas 6 secciones:

1. **Paso #XX — Título y Fecha**
2. **Objetivo del paso**
3. **Archivos creados o modificados** (tabla Markdown con columnas: `Ruta`, `Clase/Interfaz Principal`, `Responsabilidad Exacta`)
4. **Análisis de Patrones de Diseño** (indicar explícitamente si se aplicó un patrón o si es código de soporte/infraestructura, qué patrón es, qué clase cumple cada rol y *por qué* se eligió esa solución)
5. **Flujo técnico / Cómo interactúan las piezas**
6. **Cómo probar o verificar este paso**

---

## Regla 5 — Control de Versiones (Git & GitHub)

Al finalizar **cada fase o hito verificado** del proyecto:
1. Actualizar obligatoriamente `docs/DEVLOG_DETALLADO.md` con la entrada correspondiente.
2. Verificar que la compilación estricta pase sin errores (`npx tsc --noEmit`) y que se respeten las fronteras MVC.
3. Realizar un `git commit` con mensaje claro en español siguiendo **Conventional Commits** (`feat:`, `docs:`, `refactor:`, `fix:`, `chore:`).
4. Sincronizar los cambios con el repositorio remoto mediante `git push origin main`.

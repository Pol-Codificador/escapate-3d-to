# Bitácora Viva del Proyecto — ESCAPA TO

## Cómo leer esta bitácora

Este documento registra **de forma cronológica y didáctica** cada paso de construcción del Escape Room 3D (*ESCAPA TO*). Está pensado para que cualquier integrante del equipo pueda entender **qué se construyó, por qué se diseñó así, qué patrón de diseño (GoF / MVC) se aplicó y cómo verificarlo**.

Cada entrada sigue siempre la misma estructura de 6 puntos:
1. **Paso #XX — Título y Fecha**
2. **Objetivo del paso**
3. **Archivos creados o modificados** (tabla con ruta, clase/interfaz principal y responsabilidad)
4. **Análisis de Patrones de Diseño**
5. **Flujo técnico / Cómo interactúan las piezas**
6. **Cómo probar o verificar este paso**

---

## Paso #01 — Inicialización del entorno, reglas de arquitectura y contratos base de patrones (2026-11-24)

### 1. Objetivo del paso
Dejar lista la base técnica, normativa y estructural del proyecto en su **Fase 0**: inicializar el entorno Vite con TypeScript en modo estricto y Three.js, fijar las reglas permanentes de arquitectura MVC + GoF, crear la jerarquía exacta de carpetas y definir los contratos base (`src/core/interfaces/`) sin implementar todavía la escena 3D completa ni los acertijos finales.

### 2. Archivos creados o modificados

| Ruta | Clase / Interfaz Principal | Responsabilidad Exacta |
| --- | --- | --- |
| `package.json` | Configuración de paquete | Define scripts de Vite (`dev`, `build`, `preview`) y dependencias (`three`, `@types/three`, `typescript`, `vite`). |
| `tsconfig.json` | Configuración TypeScript | Activa `strict: true` y verificaciones adicionales (`noUnusedLocals`, `noUnusedParameters`, `forceConsistentCasingInFileNames`) sobre `src/`. |
| `index.html` | Documento raíz | Contenedor HTML mínimo (`#app`) que carga `src/main.ts` sin frameworks de UI. |
| `src/style.css` | Estilos base | Reset mínimo de pantalla completa y tema oscuro inicial para el viewport. |
| `src/main.ts` | Punto de entrada Fase 0 | Punto de arranque mínimo que confirma la inicialización limpia de Fase 0 sin adelantar escena ni acertijos. |
| `.agent/rules/arquitectura-to.md` | Normativa permanente | Documenta las 4 reglas obligatorias: MVC estricto, catálogo y JSDoc de patrones GoF, calidad 3D procedural y bitácora viva. |
| `src/core/interfaces/IObserver.ts` | `IObserver<T>`, `ISubject<T>` | Contratos genéricos del patrón Observer para desacoplar notificaciones del Modelo hacia Vista/Audio/HUD. |
| `src/core/interfaces/ICommand.ts` | `ICommand` | Contrato base del patrón Command con `execute()`, `undo()` y `getDescription()` para acciones del Controlador. |
| `src/core/interfaces/IPuzzleValidationStrategy.ts` | `IPuzzleValidationStrategy`, `ValidationResult`, `PuzzleInput` | Contrato del patrón Strategy y resultado tipado para desacoplar reglas de validación de acertijos. |
| `src/core/interfaces/IPrototype.ts` | `IPrototype<T>` | Contrato del patrón Prototype con `clone(): T` para reiniciar salas o entidades sin reconstrucción manual. |
| `src/core/interfaces/IThemeFactory.ts` | `IThemeFactory`, `ThemeType`, `ThemeColorPalette`, `ThemeLightingConfig`, `ThemeNarrativeConfig`, `ThemeAudioConfig` | Contrato de Abstract Factory y productos abstractos puros (sin `three`) para temáticas `'horror'` y `'scifi'`. |
| `README.md` | Documentación ejecutiva | Resume stack, comandos de ejecución, controles previstos y mapa de arquitectura/patrones. |
| `docs/DEVLOG_DETALLADO.md` | Bitácora viva | Guía de lectura y registro inicial del Paso #01. |
| `src/core/singletons/.gitkeep`, `src/model/**/.gitkeep`, `src/view/**/.gitkeep`, `src/controller/commands/.gitkeep` | Marcadores de estructura | Preservan los directorios vacíos previstos para las siguientes fases del proyecto. |

### 3. Análisis de Patrones de Diseño

En este paso se combinaron **infraestructura de proyecto** y **contratos base de Patrones de Diseño**:

1. **Infraestructura / Soporte (`package.json`, `tsconfig.json`, `index.html`, `src/main.ts`, `src/style.css`, `.agent/rules/arquitectura-to.md`):**
   - No implementan lógica de negocio ni patrones concretos; establecen el entorno estricto de compilación y las fronteras arquitectónicas del repositorio.
2. **Arquitectura MVC (fronteras definidas en `.agent/rules/arquitectura-to.md` y carpetas `model/` / `view/` / `controller/`):**
   - *Por qué se eligió:* Separa la simulación del Escape Room (`src/model/`) de su representación visual 3D/HTML (`src/view/`) y de la coordinación de comandos (`src/controller/`). Así la lógica puede probarse y clonarse sin depender del navegador ni de Three.js.
3. **Observer (`src/core/interfaces/IObserver.ts`):**
   - *Roles definidos:* `ISubject<T>` (contrato para sujetos como `Timer`, `Inventory`, `Puzzle`) e `IObserver<T>` (contrato para observadores como `HUD`, luces, puerta o audio).
   - *Por qué se eligió:* Evita que el Modelo llame directamente al DOM o a objetos `THREE.Light`. Cuando cambia el tiempo o se resuelve un acertijo, el Modelo solo invoca `notify(estado)`.
4. **Command (`src/core/interfaces/ICommand.ts`):**
   - *Rol definido:* Contrato `ICommand` (`execute()`, `undo()`, `getDescription()`).
   - *Por qué se eligió:* Permite encapsular cada acción del jugador como objeto, desacoplar la Vista del Modelo y soportar historial de deshacer (`undo()`).
5. **Strategy (`src/core/interfaces/IPuzzleValidationStrategy.ts`):**
   - *Roles definidos:* Contrato `IPuzzleValidationStrategy` y DTO `ValidationResult`.
   - *Por qué se eligió:* Cada acertijo (secuencia de interruptores, PIN numérico, uso de ítem) cambia únicamente su algoritmo de validación sin modificar la clase contenedora ni usar grandes bloques `switch/if`.
6. **Prototype (`src/core/interfaces/IPrototype.ts`):**
   - *Rol definido:* Contrato `IPrototype<T>` (`clone(): T`).
   - *Por qué se eligió:* Permitirá reiniciar la sala restaurando una instantánea clonada del estado inicial sin repetir lógica de construcción.
7. **Abstract Factory (`src/core/interfaces/IThemeFactory.ts`):**
   - *Roles definidos:* `IThemeFactory` (AbstractFactory) y los productos abstractos `ThemeColorPalette`, `ThemeLightingConfig`, `ThemeNarrativeConfig` y `ThemeAudioConfig`.
   - *Por qué se eligió:* Garantiza que al elegir `'horror'` o `'scifi'`, colores, luces, narrativa y audio pertenezcan a una familia coherente, manteniendo los valores numéricos puros sin acoplar `src/core/interfaces/` a Three.js.

### 4. Flujo técnico / Cómo interactúan las piezas

En la Fase 0 todavía no hay ejecución de partida; la interacción entre piezas queda preparada a nivel de **contratos compilables**:
1. Cualquier sujeto futuro del Modelo implementará `ISubject<T>` y mantendrá referencias únicamente a la interfaz `IObserver<T>`, sin conocer si el observador actualiza un `<div>` del HUD o una luz de Three.js.
2. El Controlador recibirá interacciones desde la Vista y ejecutará implementaciones de `ICommand`.
3. Las entidades de acertijo en `src/model/` recibirán por inyección una implementación de `IPuzzleValidationStrategy` y devolverán un `ValidationResult` uniforme.
4. El Constructor de sala y los gestores temáticos consumirán `IThemeFactory` para obtener paletas, luces, textos y audio puros; la Vista traducirá esos valores numéricos a `THREE.Color` y `THREE.MeshStandardMaterial`.
5. `tsconfig.json` incluye todo `src/`, por lo que TypeScript verifica en estricto todos los contratos incluso antes de que sean instanciados en `src/main.ts`.

### 5. Cómo probar o verificar este paso

1. Ejecutar la verificación estricta de TypeScript:
   ```bash
   npx tsc --noEmit
   ```
   Debe finalizar con código de salida `0` y sin errores.
2. Comprobar que no existan importaciones de `three` ni referencias a `document`/`window` dentro de `src/core/interfaces/` ni `src/model/`.
3. Verificar que todas las carpetas exigidas existan y que `src/core/interfaces/` contenga únicamente los 5 contratos base.
4. Opcionalmente, iniciar `npm run dev` y abrir el navegador para confirmar que Vite sirve el cascarón inicial sin errores en consola.

---

## Paso #02 — Modelo Puro, Patrones del Dominio, Singletons, Diagramas UML y Git/GitHub (2026-11-24)

### 1. Objetivo del paso
Implementar la **Fase 1** completa del proyecto **Escápate!!**: construir todo el Modelo puro (`src/model/`) sin ninguna dependencia hacia Three.js ni APIs del DOM, implementar los Singletons de coordinación (`GameManager` y `AudioManager`), actualizar los metadatos oficiales en `README.md`, documentar los diagramas UML en `docs/ARCHITECTURE.md`, agregar un smoke test verificable en `src/main.ts`, incorporar la Regla 5 de Git/GitHub en `.agent/rules/arquitectura-to.md` y publicar el repositorio en GitHub.

### 2. Archivos creados o modificados

| Ruta | Clase / Interfaz Principal | Responsabilidad Exacta |
| --- | --- | --- |
| `README.md` | Documentación oficial | Actualiza cabecera y créditos académicos (UNSA EPIS, curso Tecnología de Objetos, docente e integrantes) y mapa actualizado de patrones. |
| `.gitignore` | Reglas de exclusión Git | Asegura exclusión de `node_modules/`, `dist/`, `.env*`, `*.log`, `.DS_Store` y `Thumbs.db`. |
| `.agent/rules/arquitectura-to.md` | Regla 5 Git & GitHub | Define el flujo obligatorio de commits en español (Conventional Commits) y `git push origin main` al cerrar cada fase verificada. |
| `src/core/interfaces/IPuzzleValidationStrategy.ts` | `IPuzzleValidationStrategy` | Agrega métodos opcionales `reset?()` y `clone?()` manteniendo intactas las firmas de Fase 0. |
| `src/core/interfaces/IThemeFactory.ts` | `IThemeFactory`, `ThemeGameplayCatalog` | Añade el contrato puro `createGameplayCatalog()` para que cada fábrica entregue sus acertijos, textos e ítem sin condicionales por tema. |
| `src/model/puzzles/strategies/SequenceStrategy.ts` | `SequenceStrategy` | Valida secuencias ordenadas de 3 interruptores, expone `getCurrentSequence()`, `popStep()` (para `Command.undo()`), `reset()` y `clone()`. |
| `src/model/puzzles/strategies/PinCodeStrategy.ts` | `PinCodeStrategy` | Valida códigos PIN numéricos de 4 dígitos configurables por temática y soporta `clone()`. |
| `src/model/puzzles/strategies/ItemUnlockStrategy.ts` | `ItemUnlockStrategy` | Valida si el jugador entregó el `itemId` requerido (`bronze_key` o `access_card_lv5`) y soporta `clone()`. |
| `src/model/puzzles/Puzzle.ts` | `Puzzle`, `PuzzleSnapshot` | Contexto de Strategy con `setStrategy()` en tiempo de ejecución, Subject de Observer e `IPrototype<Puzzle>` profundo. |
| `src/model/entities/InventoryItem.ts` | `InventoryItem` | Entidad coleccionable pura (`id`, `name`, `description`, `iconType`) clonable mediante `IPrototype`. |
| `src/model/entities/Inventory.ts` | `Inventory`, `InventorySnapshot` | Gestiona ítems en 5 ranuras, implementa `ISubject` (notifica agregar/remover/seleccionar/limpiar) e `IPrototype<Inventory>`. |
| `src/model/entities/InteractiveObject.ts` | `InteractiveObject` | Modela elementos interactivos (`note`, `switch_panel`, `clue_wall`, `safe`, `item_pickup`, `exit_door`) con posición, rotación, dimensiones y estado puro. |
| `src/model/entities/ExitDoor.ts` | `ExitDoor` | Extiende `InteractiveObject` e implementa `IObserver<PuzzleSnapshot>` para desbloquearse y abrirse automáticamente al resolverse su acertijo. |
| `src/model/entities/Room.ts` | `Room`, `RoomSnapshot` | Producto construido con dimensiones 10×4×10 m, mapas de objetos/acertijos, `ExitDoor`, efectos encadenados, `ISubject` y `clone()` profundo. |
| `src/model/GameTimer.ts` | `GameTimer`, `TimerSnapshot` | Reloj puro observable sin `setInterval` (`tick()`, `start()`, `pause()`, `reset()`, `penalize()`) con formato `MM:SS`, `isCritical` (`<= 60s`) e `isExpired`. |
| `src/model/factories/HorrorThemeFactory.ts` | `HorrorThemeFactory` | Fábrica concreta "Mansión de Terror" (fusibles `['B','A','C']`, PIN `4829`, `bronze_key`, portón de roble). |
| `src/model/factories/SciFiThemeFactory.ts` | `SciFiThemeFactory` | Fábrica concreta "Nave Sci-Fi" (circuitos `['C','B','A']`, PIN `7391`, `access_card_lv5`, compuerta presurizada). |
| `src/model/builders/RoomBuilder.ts` | `RoomBuilder` | Builder fluido paso a paso para ensamblar y validar la entidad `Room`. |
| `src/model/builders/RoomDirector.ts` | `RoomDirector` | Director que consume polimórficamente cualquier `IThemeFactory` y distribuye los 6 objetos en 10×4×10 m sin superposiciones. |
| `src/core/singletons/AudioManager.ts` | `AudioManager` | Singleton y Observer que sintetiza efectos sonoros Web Audio API con protección `try/catch` (incluyendo latido crítico `<= 60s`). |
| `src/core/singletons/GameManager.ts` | `GameManager`, `GameStateSnapshot` | Singleton y Subject que gestiona el ciclo de vida (`menu`/`playing`/`paused`/`won`/`lost`), conserva `roomPrototype` y reinicia vía `clone()`. |
| `docs/ARCHITECTURE.md` | Documentación UML | Explica MVC estricto e incluye diagramas Mermaid (arquitectura MVC, patrones comportamentales, patrones creacionales) y tabla resumen. |
| `src/main.ts` y `src/style.css` | Smoke test Fase 1 | Prueba automática en consola y DOM de ambas temáticas, `popStep()`, notificaciones Observer, timer crítico y reinicio `Prototype`. |
| `docs/DEVLOG_DETALLADO.md` | Bitácora viva | Registra el presente Paso #02 con trazabilidad completa. |

### 3. Análisis de Patrones de Diseño

1. **MVC Estricto:** Toda la simulación reside en `src/model/` sin una sola referencia a `three`, `document` o `window`. Las notificaciones salen por `IObserver` y las coordinaciones viven en `src/core/singletons/` preparando el terreno para Controlador y Vista en Fase 2.
2. **Strategy (`IPuzzleValidationStrategy`, `SequenceStrategy`, `PinCodeStrategy`, `ItemUnlockStrategy`, `Puzzle`):**
   - *Por qué se eligió:* Permite cambiar la regla de validación de un `Puzzle` incluso en tiempo de ejecución (`setStrategy()`) y encapsular detalles propios como `popStep()` en secuencias sin contaminar `Puzzle` con condicionales por tipo de acertijo.
3. **Observer (`ISubject`, `IObserver`, `Puzzle`, `Inventory`, `GameTimer`, `Room`, `ExitDoor`, `GameManager`, `AudioManager`):**
   - *Por qué se eligió:* Cuando el jugador resuelve el acertijo final, `Puzzle` notifica a `ExitDoor` (se abre sola), `Room` (cambia a `'escaped'`), `AudioManager` (reproduce apertura) y `GameManager` (pasa a `'won'`) sin que `Puzzle` conozca a ninguno de ellos.
4. **Abstract Factory (`IThemeFactory`, `HorrorThemeFactory`, `SciFiThemeFactory`):**
   - *Por qué se eligió:* Al añadir `createGameplayCatalog()`, cada temática entrega una familia 100 % coherente de paleta, iluminación, narrativa, audio, pistas y estrategias, eliminando cualquier `if (theme === ...)` dentro de `RoomDirector`.
5. **Builder (`RoomBuilder`, `RoomDirector`, `Room`):**
   - *Por qué se eligió:* Construir una sala con dimensiones, 3 acertijos, 6 objetos interactivos no solapados y reglas de progresión en un único constructor sería frágil y poco legible; `RoomDirector` estandariza la receta sobre la interfaz fluida de `RoomBuilder`.
6. **Prototype (`IPrototype<T>` en `Room`, `Puzzle`, `InteractiveObject`, `ExitDoor`, `Inventory`, `InventoryItem` y estrategias):**
   - *Por qué se eligió:* `GameManager` conserva `roomPrototype` intacto y cada `startGame()` o `restartGame()` ejecuta `roomPrototype.clone()`. Al clonar la `Room`, se copian profundamente objetos, estrategias y se reconectan los observadores internos de la nueva instancia.
7. **Singleton (`GameManager`, `AudioManager`):**
   - *Por qué se eligió:* Garantiza un único árbitro de ciclo de vida de partida y un único gestor de contexto `AudioContext` compartido por toda la aplicación.

### 4. Flujo técnico / Cómo interactúan las piezas

1. `GameManager.getInstance().startGame(theme)` crea `HorrorThemeFactory` o `SciFiThemeFactory` y llama a `RoomDirector.constructRoom(factory)`.
2. `RoomDirector` consulta `createGameplayCatalog()` y ensambla vía `RoomBuilder` los 3 acertijos (`sequence_puzzle`, `pin_puzzle`, `exit_puzzle`), los 6 objetos (`desk_note`, `switch_panel`, `clue_wall`, `safe`, `reward_item_pickup`, `exit_door`) y los `PuzzleSolvedEffect` que encadenan la progresión.
3. `GameManager` guarda ese resultado como `roomPrototype` y trabaja siempre sobre `roomPrototype.clone()`, conectando `AudioManager` y sus observadores internos al `Room`, `GameTimer` e `Inventory`.
4. Al resolverse `sequence_puzzle`, `Room` desbloquea y activa `clue_wall` revelando el PIN (`4829` u `7391`). Al resolverse `pin_puzzle`, `Room` abre `safe` y vuelve visible/recogible `reward_item_pickup`. Al recoger el ítem en `Inventory` y aplicarlo en `exit_puzzle`, `ExitDoor` se desbloquea por Observer y `GameManager` transiciona a `'won'`.
5. Al ejecutar `restartGame()`, `roomPrototype.clone()` produce una sala idéntica al estado inicial sin referencias compartidas.

### 5. Cómo probar o verificar este paso

1. Ejecutar la verificación estricta de tipos:
   ```bash
   npx tsc --noEmit
   ```
   Debe finalizar con código de salida `0`.
2. Verificar la frontera MVC buscando imports prohibidos (`three`, `document`, `window`, `AudioContext`, `setInterval`) dentro de `src/model/` y `src/core/interfaces/` (0 coincidencias).
3. Compilar con Vite (`npm run build`) o iniciar `npm run dev` y revisar en pantalla y consola del navegador el reporte del smoke test para `'horror'` y `'scifi'`.
4. Revisar los diagramas UML renderizados en [`docs/ARCHITECTURE.md`](ARCHITECTURE.md).

---

## Paso #03 — Patrón Command, Controlador MVC y Escena 3D FPS con Three.js (2026-11-24)

### 1. Objetivo del paso
Implementar la **Fase 2** completa de **Escápate!!**: construir el sistema de acciones encapsuladas bajo el **Patrón Command** (`CommandInvoker` observable + 5 comandos concretos), implementar el **Controlador MVC** (`GameController`) como único puente hacia el Modelo, generar texturas procedurales con `THREE.CanvasTexture` y muebles 3D compuestos para ambas temáticas (`horror` y `scifi`), habilitar exploración en primera persona con Pointer Lock, colisiones AABB y raycasting central (`SceneManager`, `CameraController`, `RaycastSelector`), e integrar una vista previa jugable en `src/main.ts`.

### 2. Archivos creados o modificados

| Ruta | Clase / Interfaz Principal | Responsabilidad Exacta |
| --- | --- | --- |
| `src/controller/commands/CommandInvoker.ts` | `CommandInvoker`, `CommandHistoryEntry`, `CommandHistorySnapshot` | Invoker del patrón Command y `ISubject` del patrón Observer: ejecuta comandos, guarda historial con hora `HH:MM:SS`, soporta `undoLast()` y notifica cambios en vivo. |
| `src/controller/commands/InspectObjectCommand.ts` | `InspectObjectCommand`, `InspectionPayload` | Comando concreto para inspeccionar objetos interactivos por ID y emitir la respuesta adecuada (`read_note`, `open_switch_panel`, `open_pin_keypad`, `show_clue`). |
| `src/controller/commands/ToggleSwitchCommand.ts` | `ToggleSwitchCommand` | Comando concreto que envía `'A' | 'B' | 'C'` al Acertijo 1 (`SequenceStrategy`) y revierte vía `undoLastStep()`/`popStep()` si el acertijo sigue abierto. |
| `src/controller/commands/InputCodeCommand.ts` | `InputCodeCommand` | Comando concreto que valida un PIN numérico de 4 dígitos contra el Acertijo 2 (`PinCodeStrategy`). |
| `src/controller/commands/PickUpItemCommand.ts` | `PickUpItemCommand` | Comando concreto reversible que recoge `bronze_key` o `access_card_lv5` al `Inventory`, oculta `item_pickup` y lo devuelve en `undo()`. |
| `src/controller/commands/UseItemCommand.ts` | `UseItemCommand` | Comando concreto que aplica el ítem del inventario sobre `ExitDoor` (Acertijo 3 `ItemUnlockStrategy`). |
| `src/controller/GameController.ts` | `GameController`, `HoverTargetInfo` | Controlador MVC único entre Vista y Modelo: gestiona `CommandInvoker`, ciclo `requestAnimationFrame` (`GameTimer.tick()` en `'playing'`), reinicio Prototype y despacho de interacciones. |
| `src/view/builders3d/ProceduralTextureFactory.ts` | `ProceduralTextureFactory` | Genera `THREE.CanvasTexture` en memoria para pisos (madera vs hexágonos), paredes (victoriano vs titanio/advertencia), techos, notas legibles, pista UV/holográfica (`4829`/`7391`), placas `A/B/C` y teclado. |
| `src/view/builders3d/RoomMeshFactory.ts` | `RoomMeshFactory`, `BuiltRoomSceneAssets`, `ColliderBox2D` | Construye la habitación `10 × 4 × 10` m y los 6 muebles compuestos en `THREE.Group` con sombras, `userData.interactiveObjectId`, pivotes animados y cajas AABB. |
| `src/view/scene/CameraController.ts` | `CameraController` | Cámara FPS (`1.65` m), Pointer Lock API, `WASD` + flechas, pitch acotado `±80°` y colisiones AABB con deslizamiento independiente por ejes X/Z. |
| `src/view/scene/RaycastSelector.ts` | `RaycastSelector`, `RaycastTargetHit` | Raycaster central de `3.5` m que identifica `interactiveObjectId`/`switchSymbol` y aplica/restaura resaltado emisivo sutil sobre materiales `MeshStandardMaterial`. |
| `src/view/scene/SceneManager.ts` | `SceneManager` | Vista 3D y `ConcreteObserver` de `Puzzle`, `Room`, `GameTimer` y `GameManager`: gestiona `WebGLRenderer`, luces, linterna, animaciones de puerta/caja fuerte/UV y alerta roja crítica (`<= 60s`). |
| `index.html`, `src/style.css`, `src/main.ts` | Vista previa jugable Fase 2 | Sustituye el smoke test por el canvas 3D real controlado por `GameController`, con mira `+`, prompt inferior, cambio en vivo Horror/Sci-Fi y aviso de Pointer Lock. |
| `docs/ARCHITECTURE.md` | Diagramas UML actualizados | Reemplaza el marcador `CommandInvoker_Fase2` por las clases reales de `Controller` y `View` implementadas en Fase 2. |
| `docs/DEVLOG_DETALLADO.md` | Bitácora viva | Registra el presente Paso #03 conforme a la Regla 4. |

### 3. Análisis de Patrones de Diseño

1. **Command (`CommandInvoker`, `InspectObjectCommand`, `ToggleSwitchCommand`, `InputCodeCommand`, `PickUpItemCommand`, `UseItemCommand`):**
   - *Por qué se eligió:* Desacopla totalmente las entradas de la Vista (`E`, clic, teclado numérico, `Z`) de los receptores del Modelo (`Room`, `Puzzle`, `Inventory`), permite auditar cronológicamente cada acción del jugador y habilita `undoLast()` limpio en `ToggleSwitchCommand` y `PickUpItemCommand`.
2. **Observer (`CommandInvoker` como Subject; `SceneManager` como ConcreteObserver):**
   - *Por qué se eligió:* `SceneManager` no recibe llamadas imperativas desde los comandos para encender la luz UV, abrir la caja fuerte o pintar de rojo el cuarto en el último minuto; simplemente observa a `Puzzle`, `Room` y `GameTimer`. Asimismo, `CommandInvoker` ya emite `CommandHistorySnapshot` para alimentar el registro de investigación en vivo de la Fase 3.
3. **MVC Estricto (`GameController`, `SceneManager`, `Room`):**
   - *Por qué se eligió:* `src/view/` no importa ni muta reglas de negocio (`attempt`, `addItem`, `startGame`), mientras `src/model/` conserva 0 referencias a Three.js o al DOM. Toda escritura pasa por `GameController` $\rightarrow$ `CommandInvoker`.
4. **Reutilización de Abstract Factory + Prototype en Vista 3D (`ProceduralTextureFactory`, `RoomMeshFactory`, `GameController.restartCurrentGame()`):**
   - *Por qué se eligió:* Al alternar entre `'horror'` y `'scifi'` o reiniciar con `R`, `RoomMeshFactory` lee polimórficamente la paleta, iluminación y texto de `Room` (sin duplicar lógica), y `restartCurrentGame()` reconstruye la escena desde el clon limpio generado por `GameManager.restartGame()`.

### 4. Flujo técnico / Cómo interactúan las piezas

1. `src/main.ts` instancia `SceneManager` y `GameController`, inicia `'horror'` (`controller.startNewGame('horror')`) y arranca `controller.startLoop()`.
2. En cada `requestAnimationFrame`, `GameController` avanza `GameTimer.tick(deltaSeconds)` (solo en `'playing'`), actualiza `CameraController` + animaciones 3D en `SceneManager.renderFrame()` y consulta `RaycastSelector`.
3. Al apuntar a un objeto a $\le 3.5$ m y pulsar `E` o clic, `main.ts` llama a `controller.handleObjectInteraction(id, switchSymbol)`.
4. `GameController` crea el `ICommand` correspondiente y lo ejecuta mediante `CommandInvoker`. El comando opera sobre `Room`/`Puzzle`/`Inventory`, quienes notifican por Observer a `AudioManager`, `ExitDoor`, `GameManager` y `SceneManager`.
5. `SceneManager` reacciona animando en tiempo real la luz UV/holográfica de `clue_wall` (`4829`/`7391`), la apertura de `safe` (`-105°`), la aparición/ocultamiento de `reward_item_pickup`, la apertura de `exit_door` y el parpadeo rojo si `GameTimer.isCritical()` es `true`.

### 5. Cómo probar o verificar este paso

1. Ejecutar la verificación estricta de tipos y empaquetado de producción:
   ```bash
   npx tsc --noEmit
   npm run build
   ```
   Ambos comandos deben finalizar con código `0`.
2. Confirmar que `src/model/` y `src/core/interfaces/` mantienen **0 imports ni referencias en código** a `three`, `document`, `window`, `AudioContext` o `setInterval`.
3. Ejecutar `npm run dev` y probar en el navegador:
   - Hacer clic para capturar el cursor (Pointer Lock) y explorar con `WASD`/flechas verificando colisión con paredes, escritorio, caja fuerte y pedestal.
   - Apuntar al escritorio (`desk_note`), panel (`switch_panel`, teclas `1/2/3` o clic y tecla `Z` para deshacer), pared (`clue_wall`), caja fuerte (`safe`, tecleando el PIN `4829` en Terror o `7391` en Sci-Fi), recoger la llave/tarjeta (`E`) y usarla en la puerta de salida (`E`).
   - Probar el botón superior derecho **Cambiar a Nave Sci-Fi / Mansión de Terror** y la tecla `R` para reiniciar vía Prototype.

---

## Paso #04 — Acertijos Multi-Pista (4 Encadenados), Iluminación/Decoración 3D Rica, Modales Interactivos y HUD Completo (2026-11-24)

### 1. Objetivo del paso
Ejecutar la **Fase 3** completa de **Escápate!!**: ampliar la progresión del Modelo puro a **4 acertijos encadenados** con pistas repartidas en 3 ubicaciones, reutilizar `ItemUnlockStrategy` en dos contextos (`desk_box` y `exit_door`), extender `SequenceStrategy` a **5 pasos con repeticiones**, enriquecer la escena 3D con iluminación nítida y mobiliario temático detallado, construir la interfaz completa en HTML/CSS puro (**Menú Principal**, **Modales Interactivos**, **HUD** y **Historial de Comandos en vivo**), validar todo con compilación estricta y smoke test funcional, y sincronizar con GitHub.

### 2. Archivos creados o modificados

| Ruta | Clase / Interfaz Principal | Responsabilidad Exacta |
| --- | --- | --- |
| `src/model/entities/InteractiveObject.ts` | `InteractiveObjectKind` | Amplía los tipos interactivos con `'desk_box'` y `'wall_marking'`. |
| `src/model/puzzles/strategies/ItemUnlockStrategy.ts` | `ItemUnlockStrategy` | Expone `getRequiredItemLabel()` para informar en UI qué ítem exige una cerradura sin acoplar reglas. |
| `src/core/interfaces/IThemeFactory.ts` | `ThemeGameplayCatalog` | Incorpora `deskBoxPuzzle`, `initialItem` y especificaciones textuales de `smallKeyPickup`, `deskBox` y `wallMarking`. |
| `src/model/factories/HorrorThemeFactory.ts` | `HorrorThemeFactory` | Configura iluminación cálida equilibrada, niebla sutil (`0.02`), `brass_drawer_key`, secuencia de 5 pasos `['B','A','C','B','A']`, 3 pistas y 4 acertijos. |
| `src/model/factories/SciFiThemeFactory.ts` | `SciFiThemeFactory` | Configura iluminación fría uniforme, niebla sutil (`0.016`), `service_chip`, secuencia de 5 pasos `['C','B','A','C','B']`, 3 pistas y 4 acertijos. |
| `src/model/builders/RoomDirector.ts` | `RoomDirector` | Orquesta 4 acertijos y 9 objetos interactivos en `10 × 4 × 10` m sin superposiciones, añadiendo el efecto encadenado para `desk_box`. |
| `src/core/interfaces/ICommand.ts` y `src/controller/commands/CommandInvoker.ts` | `ICommand`, `CommandInvoker`, `CommandHistoryEntry` | Añaden `commandName` explícito para preservar el nombre canónico en producción minificada dentro del log observable. |
| `src/controller/commands/PickUpItemCommand.ts`, `UseItemCommand.ts`, `InspectObjectCommand.ts`, `ToggleSwitchCommand.ts`, `InputCodeCommand.ts` | Comandos Concretos | Generalizan `PickUpItemCommand` y `UseItemCommand` para `small_key_pickup`/`desk_box` y `reward_item_pickup`/`exit_door`, e integran respuestas de lectura y cerradura en `InspectObjectCommand`. |
| `src/controller/GameController.ts` | `GameController` | Coordina apertura de `desk_box` con lectura inmediata, apertura de modales en `switch_panel`/`safe`, menú principal, linterna (`F`), audio (`M`) e inventario (`1-5`). |
| `src/view/builders3d/ProceduralTextureFactory.ts` | `ProceduralTextureFactory` | Añade `CanvasTexture` para nota arrancada de `desk_box`, inscripción `wall_marking`, alfombra victoriana / plataforma núcleo, ventanal nocturno / espacial y cuadros técnicos/retratos. |
| `src/view/builders3d/RoomMeshFactory.ts` | `RoomMeshFactory`, `BuiltRoomSceneAssets` | Modela `desk_box` hueco con tapa pivotante, `small_key_pickup`, `wall_marking`, candelabro/tiras LED, estantería/estación de carga, ventanal, sillón/racks de servidores, baúl/cajas de carga y cables emisivos. |
| `src/view/scene/SceneManager.ts` | `SceneManager` | Eleva exposición e iluminación base + luces locales por sector, anima apertura de `desk_box`, 5 LEDs de progreso en `switch_panel`, flotación de múltiples ítems y control de linterna (`toggleFlashlight()`). |
| `src/view/ui/MainMenuView.ts` | `MainMenuView` | Pantalla de inicio académica con tarjetas temáticas, guía de controles y vista previa 3D reactiva (`IObserver<GameStateSnapshot>`). |
| `src/view/ui/ModalView.ts` | `ModalView` | Modales en primer plano (Lectura temática, Panel de 5 Palancas con `undo`, Teclado numérico 4 dígitos y Victoria/Derrota) con liberación/recuperación automática de Pointer Lock. |
| `src/view/ui/HudView.ts` | `HudView` | HUD completo: reloj `MM:SS` crítico pulsante, progreso `X / 4`, botones de acción, mira central, inventario de 5 ranuras SVG y notificaciones *toast*. |
| `src/view/ui/CommandLogView.ts` | `CommandLogView` | Panel lateral desplegable (`H`) que observa a `CommandInvoker` y lista cada comando con hora y estado (`Ejecutado`, `Reversible`, `Deshecho`). |
| `index.html`, `src/style.css`, `src/main.ts` | Punto de entrada completo | Elimina los controles provisionales de Fase 2 y conecta el menú, escena 3D, controlador y las 4 vistas UI observadoras. |
| `README.md`, `docs/ARCHITECTURE.md`, `docs/DEVLOG_DETALLADO.md` | Documentación oficial | Actualiza controles, flujo de 4 acertijos, diagramas UML Mermaid con las vistas UI y registra este Paso #04. |

### 3. Análisis de Patrones de Diseño

1. **Reutilización de Strategy (`ItemUnlockStrategy` y `SequenceStrategy` de 5 pasos):**
   - *Por qué se eligió:* `ItemUnlockStrategy` se reutilizó sin duplicar código ni crear subclases nuevas para validar tanto el cofre/compartimento (`desk_box_puzzle`) como la puerta final (`exit_puzzle`). A su vez, `SequenceStrategy` soportó secuencias de 5 pasos con repeticiones (`B→A→C→B→A` y `C→B→A→C→B`) conservando `popStep()` para `Command.undo()`.
2. **Command + Observer (`CommandInvoker` $\rightarrow$ `CommandLogView`, `HudView`, `ModalView`):**
   - *Por qué se eligió:* Al añadir `commandName` explícito y generalizar `UseItemCommand` sobre `targetObjectId`, todas las interacciones (incluido abrir el cofre del escritorio, leer la pared sur, deshacer pasos de secuencia o revertir recolección de la llave pequeña) quedan auditadas en tiempo real en `CommandLogView` sin acoplar el Controlador a la UI.
3. **MVC Estricto en Vistas HTML/CSS (`MainMenuView`, `ModalView`, `HudView`, `CommandLogView`):**
   - *Por qué se eligió:* Ninguna vista UI importa ni modifica directamente entidades de `src/model/`: solo implementan `IObserver<T>` para renderizar instantáneas y delegan cada clic o atajo de teclado en `GameController`.
4. **Abstract Factory + Builder + Prototype (`HorrorThemeFactory`, `SciFiThemeFactory`, `RoomDirector`, `Room.clone()`):**
   - *Por qué se eligió:* Toda la ampliación a 4 acertijos, 9 objetos, iluminación y narrativa se mantuvo encapsulada en las fábricas y el director; `GameManager.restartGame()` continúa reiniciando la sala completa mediante clonación profunda `Prototype`.

### 4. Flujo técnico / Cómo interactúan las piezas

1. Al iniciar la aplicación, `MainMenuView` se muestra sobre una vista previa 3D del cuarto elegible (`horror` o `scifi`). Al pulsar **Entrar a la Sala**, `GameController.startNewGame(theme)` construye la sala, suscribe las vistas UI y activa Pointer Lock.
2. El jugador inspecciona `desk_note` (Pista #1: pasos 1–2 y paradero de `small_key_pickup`), recoge la llave pequeña/chip de la estantería/estación noroeste y la usa con `UseItemCommand` sobre `desk_box` (Acertijo 1), abriendo la tapa en 3D y leyendo la Pista #2 (pasos 3–4).
3. En el muro sur examina `wall_marking` (Pista #3: paso 5) y luego abre el modal de `switch_panel`, donde ingresa los 5 pasos (con soporte de `Z` / `Deshacer paso`) para resolver el Acertijo 2, energizar `clue_wall` y revelar el PIN (`4829` o `7391`).
4. Con el teclado modal de `safe` resuelve el Acertijo 3, recogiendo `bronze_key` o `access_card_lv5` del pedestal para abrir `exit_door` (Acertijo 4). `ExitDoor` y `Room` notifican la victoria a `GameManager`, que abre el modal final en `ModalView` con opciones de reinicio `Prototype` o cambio de temática.

### 5. Cómo probar o verificar este paso

1. Verificar tipado estricto y empaquetado de producción:
   ```bash
   npx tsc --noEmit
   npm run build
   ```
   Ambos deben finalizar con código `0`.
2. Auditar la frontera MVC comprobando `0` referencias ejecutables a `three`, `document`, `window`, `HTMLElement`, `AudioContext` o `setInterval` dentro de `src/model/` y `src/core/interfaces/`.
3. Ejecutar el smoke test funcional (4 acertijos encadenados, secuencia de 5 pasos con repeticiones, `undo()` de recolección y secuencia, y clonación `Prototype`) verificando ambas temáticas (`horror` y `scifi`).
4. Abrir `npm run dev` en el navegador y recorrer el juego completo desde el Menú Principal verificando iluminación nítida, decoración 3D, apertura animada de `desk_box`, modales interactivos, Pointer Lock, inventario SVG, historial lateral (`H`), linterna (`F`) y reinicio `Prototype` (`R`).

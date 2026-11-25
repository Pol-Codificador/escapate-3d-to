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

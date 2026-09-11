# Copilot instructions

## Project overview

NEON RUNNER is a dependency-free browser game implemented as three top-level files:

- `index.html` owns the page shell, control legend, canvas, overlay message, and script/style references.
- `style.css` owns the surrounding UI, responsive layout, colors, typography, and overlay styling. The game world itself is rendered by Canvas.
- `game.js` owns all game state, input, physics, collisions, enemy behavior, rendering, HUD, audio, and the animation loop.

The game is a side-scrolling cyberpunk action platformer. The world is wider than the 960px canvas, so `game.camera` follows the player while `game.bgCamera` independently controls parallax background motion. Gameplay coordinates are world coordinates; only the drawing transform applies camera translation.

## Commands

There is no package manager configuration, build script, test runner, or linter in this repository. Open `index.html` in a browser to run the game. For a lightweight local server, use an available static HTTP server rather than adding a dependency.

Available checks:

```sh
node --check game.js
git diff --check
```

There are currently no automated tests or single-test command. When changing browser behavior, manually exercise the affected keyboard action and the relevant game-over/restart path in a browser.

## Architecture and game flow

- `game` is the single mutable runtime state object. `reset()` recreates the player, coins, enemies, camera, HP, slow-motion state, and timers.
- `update()` runs once per `requestAnimationFrame`, handles edge-triggered actions from `justPressed`, applies player physics, resolves platform landing, updates collectibles and enemies, handles damage/win/loss, and updates camera/UI text.
- `draw()` renders the parallax background, optional slow-motion filter, world entities under `ctx.translate(-game.camera, 0)`, the player/trails/goal, and finally the fixed HUD.
- `platforms`, `coinSpots`, and `enemySpots` are static world data. Ground enemies derive their patrol bounds and `groundY` from the platform data during `reset()`.
- `startAudio()` is intentionally lazy: Web Audio starts on the first keyboard event to satisfy browser autoplay restrictions. Keep audio initialization user-gesture-gated.
- The HTML overlay is the existing terminal state UI. Use `endGame(true/false)` instead of introducing another game-over mechanism.

## Project-specific conventions

- Keep the implementation dependency-free and preserve the three-file split. Do not introduce a framework, bundler, or generated assets for small gameplay changes.
- Use the existing Canvas coordinate system (`960x540`) and world-space numeric constants. New world objects should be added to the appropriate static data array rather than hard-coded into unrelated update logic.
- Use `justPressed` for one-shot actions (`W` jumps, `SPACE` air dash, `J`/`Enter` sword attack, `P` slow motion); use `keys` only for held movement (`A`/`D`). `loop()` clears `justPressed` after each update.
- Preserve the current controls: `A` left, `D` right, `W` double jump, `SPACE` air dash while airborne, `J` or `Enter` close-range sword attack, and `P` slow motion.
- Ground enemies must remain on their assigned platform and reverse at `patrolLeft`/`patrolRight`; do not apply platform physics to them unless the enemy model is deliberately redesigned.
- Player damage is 25 HP per enemy contact, with `p.invincible` preventing repeated damage during the knockback window. Falling below `H + 100` and HP reaching zero both use the existing loss overlay.
- Slow motion uses `slowTimer` for its 2-second effect and `slowCooldown` for its 4-second recharge. Keep the green filter and movement trails tied to `slowTimer`, and require a full cooldown before accepting `P`.
- Keep rendering order intentional: background/filter first, camera-transformed world second, fixed HUD last. Restore Canvas state after temporary transforms or alpha/shadow settings.
- Update the visible controls or status text in `index.html`/`game.js` when changing keyboard behavior. Avoid leaving stale control hints.
- Match the existing compact formatting style in `game.js` and the cyberpunk palette (cyan, magenta, yellow, dark blue) unless a feature specifically requires a new visual treatment.

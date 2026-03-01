# DEV LOG

## 2026-03-01
- **Feature**: Added `refreshBody()` to static objects (safe, npc) in `MapManager.js` to ensure physics bodies are correctly synchronized with sprites.
- **Fix**: Updated `InteractionManager.js` `getDistanceToObj` to use the minimum distance between physics body bounds and sprite center. This solves interaction issues when physics bodies are desynced or when standing "inside" a collision box.
- **Fix**: Resolved "walk through safe" issue by ensuring `refreshBody()` is called after `setSize()`.
- **Feature**: Verified paper doll interaction logic.
- **Feature**: Added room name notification when entering a new map.
- **Content**: Added localized names to all maps in `Maps.js`.

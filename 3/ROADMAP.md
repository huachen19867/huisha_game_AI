# Project: Returns (回煞) - Expansion Roadmap

## Phase 1: Core Architecture Refactor (Current Focus)
- **Scene Management**: Move from hardcoded map to data-driven Map System (`src/data/Maps.js`).
- **Transition System**: Seamless fade-in/out transitions between rooms/scenes.
- **Global State**: Persist inventory, story flags, and player status across scenes.
- **Save/Load System**: Basic `localStorage` implementation.

## Phase 2: Content Expansion
- **Map Design**:
  - Main Hall (Current)
  - Corridor (Spooky, narrow)
  - Backyard (Rainy, stealth section)
  - Bedroom (Puzzle heavy)
  - Kitchen (Chase sequence starter)
- **Narrative**:
  - Deepen the lore (Notes, diaries).
  - Add more dialogue interactions.
  - "Paper Doll" mechanic: The doll follows/teleports when you aren't looking.

## Phase 3: Advanced Gameplay
- **Chase Mechanics**: Enemy AI that patrols and chases line-of-sight.
- **Hiding Spots**: Closets/Under beds (Hold breath mechanic).
- **Puzzles**: Inventory combination puzzles (e.g., Key + Oil = Oiled Key).

## Phase 4: Polish
- **Audio**: Footsteps matching surface, dynamic music intensity.
- **Visuals**: Better lighting, particle effects (dust, rain), post-processing.

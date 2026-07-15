import type { LevelIntel } from './uiTypes';

export type { IntelItem, LevelIntel } from './uiTypes';

export const LEVEL_INTEL: readonly LevelIntel[] = [
  {
    heading: 'Grid Fundamentals',
    summary: 'Identify every signal before entering the extraction grid.',
    items: [
      {
        icon: 'player',
        name: 'Carrier',
        description: 'Your orange remote body. Hold Space plus a direction to consume adjacent soil, Infotrons, or pickup Disks without moving.',
      },
      {
        icon: 'touch',
        name: 'Touch Interface',
        description: 'On touch screens, steer with the joystick or drag outward from the Carrier. Tap a clear cell in the same row or column to travel there; drag the grid to pan and pinch to zoom.',
      },
      {
        icon: 'infotron',
        name: 'Infotron',
        description: 'Bright cyan objective. Move into it or use Space plus a direction to collect it; secure every one to bring the exit online.',
      },
      {
        icon: 'zonk',
        name: 'Zonk',
        description: 'Silver sphere with an orange hazard ring. It rolls sideways off clear rounded supports, then falls.',
        danger: true,
      },
      {
        icon: 'dirt',
        name: 'Matrix Soil',
        description: 'Cracked slate material. The Carrier can excavate it safely.',
      },
      {
        icon: 'wall',
        name: 'Purple Circuit Wall',
        description: 'Rounded violet support. Objects can roll off its clear edges; a Pulse Disk can destroy it.',
      },
      {
        icon: 'steel',
        name: 'Steel Bulkhead',
        description: 'Square bolted boundary. Objects cannot roll off it, and it cannot be mined or destroyed.',
      },
      {
        icon: 'carbon',
        name: 'Carbon Truss',
        description: 'Square graphite brace. Permanent and non-rollable like Steel, with a bronze conduit pattern.',
      },
      {
        icon: 'exit',
        name: 'Exit Gate',
        description: 'Marked E. Red while locked, green when every Infotron is secured; an edge chevron guides you when it is off-screen.',
      },
    ],
  },
  {
    heading: 'Hunter Grid Addendum',
    summary: 'This sector extends beyond one screen and contains autonomous defenses.',
    items: [
      {
        icon: 'enemy',
        name: 'Sentinel',
        description: 'Directional magenta hunter. It keeps to the current visible wall on its right, reroutes when terrain changes, and turns visibly before moving in a new direction.',
        danger: true,
      },
      {
        icon: 'disk',
        name: 'Pulse Disk',
        description: 'Move into the yellow disk or use Space plus a direction to collect it. Hold Space alone for 1.5 seconds to arm it beneath the Carrier; direction input resets the timer.',
        danger: true,
      },
      {
        icon: 'map',
        name: 'Tactical Optics',
        description: 'Use the wheel or touch zoom controls to magnify, pinch around a point, and drag the map with a mouse button or one finger. Moving the Carrier smoothly restores camera follow.',
      },
    ],
  },
  {
    heading: 'Cascade Protocol',
    summary: 'The final vault is a vertical demolition puzzle with multiple steel decks.',
    items: [
      {
        icon: 'cascade',
        name: 'Controlled Cascade',
        description: 'Removing support starts a fall. Stationary objects are safe overhead; moving ones are lethal.',
        danger: true,
      },
      {
        icon: 'chain',
        name: 'Chain Reaction',
        description: 'One blast triggers nearby armed disks. Use the expanding 3×3 blast zones deliberately.',
        danger: true,
      },
      {
        icon: 'steel',
        name: 'Deck Breach',
        description: 'Steel rows are permanent. Locate their purple Circuit Wall weak points and blast through.',
      },
    ],
  },
];

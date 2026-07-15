import { DIRECTION_VECTOR, Tile } from './types';
import type {
  Direction, GameEvent, GamePhase, GameSnapshot,
  InputFrame, LevelDefinition, Point,
} from './types';
import {
  BOMB_FUSE_TICKS,
  clamp01,
  COOLDOWN_EPSILON,
  ENEMY_INTERVAL,
  ENEMY_TWEEN_DURATION,
  EXPLOSION_TICKS,
  FALL_TWEEN_DURATION,
  GRAVITY_INTERVAL,
  MOVE_INTERVAL,
  PLAYER_TWEEN_DURATION,
  PUSH_TWEEN_DURATION,
  REMOTE_DIG_DURATION,
  ROLL_TWEEN_DURATION,
} from './gameTiming';
import type { EnemyWorld, ParsedLevel } from './internalTypes';
import { parseLevel } from './levelParser';
import { MotionTracker } from './MotionTracker';
import { EnemySystem } from './systems/EnemySystem';
import { initializeTiles, isRoundedSupport } from './tileRules';
import { TravelController } from './TravelController';

const isSamePoint = (a: Point, b: Point): boolean => a.x === b.x && a.y === b.y;

export class GameEngine {
  private tiles: Tile[];
  private readonly initial: ParsedLevel;
  private player: Point;
  private previousPlayer: Point;
  private facing: Direction = 'right';
  private phase: GamePhase = 'ready';
  private collected = 0;
  private disks = 0;
  private score = 0;
  private elapsedSeconds = 0;
  private tick = 0;
  private movementCooldown = 0;
  private readonly motion = new MotionTracker();
  private gravityAccumulator = 0;
  private enemyAccumulator = 0;
  private readonly events: GameEvent[] = [];
  private falling = new Set<number>();
  private readonly enemySystem: EnemySystem;
  private readonly enemyWorld: EnemyWorld;
  private bombFuses = new Map<number, number>();
  private explosionTimers = new Map<number, number>();
  private readonly travel: TravelController;

  public constructor(
    private readonly definition: LevelDefinition,
    private readonly levelIndex: number,
  ) {
    this.initial = parseLevel(definition);
    this.tiles = initializeTiles(this.initial.tiles, this.initial.required);
    this.player = { ...this.initial.spawn };
    this.previousPlayer = { ...this.initial.spawn };
    this.travel = new TravelController({
      playerPosition: () => this.player,
      tileAt: (x, y) => this.tileAt(x, y),
      isInside: (x, y) => this.isInside(x, y),
    });
    this.enemySystem = new EnemySystem(this.initial.enemies);
    this.enemyWorld = this.createEnemyWorld();
  }

  public start(): void {
    if (this.phase === 'ready' || this.phase === 'paused') {
      this.phase = 'playing';
    }
  }

  public pause(): void {
    if (this.phase === 'playing') {
      this.phase = 'paused';
      this.travel.clear();
    }
  }

  public reset(): void {
    this.tiles = initializeTiles(this.initial.tiles, this.initial.required);
    this.player = { ...this.initial.spawn };
    this.previousPlayer = { ...this.initial.spawn };
    this.facing = 'right';
    this.phase = 'ready';
    this.collected = 0;
    this.disks = 0;
    this.score = 0;
    this.elapsedSeconds = 0;
    this.tick = 0;
    this.movementCooldown = 0;
    this.motion.reset();
    this.gravityAccumulator = 0;
    this.enemyAccumulator = 0;
    this.events.length = 0;
    this.falling.clear();
    this.enemySystem.reset(this.initial.enemies);
    this.bombFuses.clear();
    this.explosionTimers.clear();
    this.travel.clear();
  }

  public update(deltaSeconds: number, input: InputFrame): void {
    if (this.phase !== 'playing') {
      if (this.phase === 'won' || this.phase === 'lost') {
        this.motion.advance(deltaSeconds);
      }
      return;
    }

    this.tick += 1;
    this.elapsedSeconds += deltaSeconds;
    this.movementCooldown = Math.max(0, this.movementCooldown - deltaSeconds);
    if (this.movementCooldown <= COOLDOWN_EPSILON) this.movementCooldown = 0;
    this.motion.advance(deltaSeconds);
    this.enemySystem.advanceTurns(deltaSeconds);
    this.gravityAccumulator += deltaSeconds;
    this.enemyAccumulator += deltaSeconds;

    const travelDirection = this.travel.directionFor(input);

    if (input.excavate !== null) {
      this.tryRemoteConsume(input.excavate);
    } else {
      if (input.action) this.deployDisk();
      const direction = input.direction ?? travelDirection;
      if (direction !== null && this.movementCooldown <= 0) {
        const moved = this.tryMove(direction);
        if (moved) this.travel.completeStep();
        if (moved) this.movementCooldown = MOVE_INTERVAL;
      }
    }

    while (
      this.gravityAccumulator + COOLDOWN_EPSILON >= GRAVITY_INTERVAL &&
      this.phase === 'playing'
    ) {
      this.gravityAccumulator = Math.max(0, this.gravityAccumulator - GRAVITY_INTERVAL);
      this.updateGravity();
    }
    while (
      this.enemyAccumulator + COOLDOWN_EPSILON >= ENEMY_INTERVAL &&
      this.phase === 'playing'
    ) {
      this.enemyAccumulator = Math.max(0, this.enemyAccumulator - ENEMY_INTERVAL);
      this.enemySystem.update(this.enemyWorld);
    }

    this.updateBombs();
    this.updateExplosions();
  }

  public getSnapshot(): GameSnapshot {
    return {
      width: this.initial.width,
      height: this.initial.height,
      tiles: this.tiles,
      tileMotions: this.motion.visibleTileMotions((x, y) => this.tileAt(x, y)),
      player: this.player,
      previousPlayer: this.previousPlayer,
      playerMotion: this.motion.playerProgress(),
      playerMotionDurationSeconds: PLAYER_TWEEN_DURATION,
      cellConsumptions: this.motion.cellSnapshot(),
      enemies: this.enemySystem.snapshot(this.enemyWorld),
      facing: this.facing,
      collected: this.collected,
      required: this.initial.required,
      disks: this.disks,
      score: this.score,
      elapsedSeconds: this.elapsedSeconds,
      phase: this.phase,
      levelIndex: this.levelIndex,
      levelName: this.definition.name,
      tick: this.tick,
      gravityProgress: clamp01(this.gravityAccumulator / GRAVITY_INTERVAL),
    };
  }

  public consumeEvents(): readonly GameEvent[] {
    if (this.events.length === 0) {
      return [];
    }
    return this.events.splice(0, this.events.length);
  }

  public tileAt(x: number, y: number): Tile {
    if (!this.isInside(x, y)) {
      return Tile.Steel;
    }
    return this.tiles[this.index(x, y)] ?? Tile.Steel;
  }

  private tryMove(direction: Direction): boolean {
    this.facing = direction;
    const vector = DIRECTION_VECTOR[direction];
    const target = { x: this.player.x + vector.x, y: this.player.y + vector.y };
    const targetTile = this.tileAt(target.x, target.y);

    if (targetTile === Tile.Enemy) {
      this.killPlayer(target);
      return false;
    }
    if (targetTile === Tile.Explosion) {
      this.killPlayer(target, true);
      return false;
    }
    if (targetTile === Tile.Zonk && vector.y === 0) {
      return this.tryPushZonk(target, direction);
    }
    if (
      targetTile === Tile.Steel ||
      targetTile === Tile.Carbon ||
      targetTile === Tile.Wall ||
      targetTile === Tile.Zonk ||
      targetTile === Tile.Bomb ||
      targetTile === Tile.ExitClosed
    ) {
      return false;
    }

    if (targetTile === Tile.Dirt) {
      this.setTile(target.x, target.y, Tile.Empty);
      this.score += 5;
      this.emit('dig', target, 0.3);
    } else if (targetTile === Tile.Infotron) {
      this.collectInfotron(target);
    } else if (targetTile === Tile.Disk) {
      this.collectDisk(target);
    } else if (targetTile === Tile.ExitOpen) {
      this.movePlayer(target);
      this.phase = 'won';
      this.travel.clear();
      const timeBonus = Math.max(0, this.definition.parSeconds - Math.floor(this.elapsedSeconds)) * 25;
      this.score += 2000 + timeBonus;
      this.emit('win', target, 1.4);
      return true;
    }

    this.movePlayer(
      target,
      targetTile === Tile.Dirt ? { position: { ...target }, direction } : null,
    );
    return true;
  }

  private movePlayer(
    target: Point,
    dirtConsumption: { readonly position: Point; readonly direction: Direction } | null = null,
  ): void {
    this.previousPlayer = this.player;
    this.player = target;
    this.motion.startPlayerMotion();
    if (dirtConsumption !== null) {
      this.motion.startCellConsumption(
        Tile.Dirt,
        dirtConsumption.position,
        dirtConsumption.direction,
        'traverse',
        PLAYER_TWEEN_DURATION,
      );
    }
    this.emit('move', target, 0.15);
  }

  private tryRemoteConsume(direction: Direction): void {
    if (!this.motion.isPlayerSettled()) return;
    this.facing = direction;
    const vector = DIRECTION_VECTOR[direction];
    const target = { x: this.player.x + vector.x, y: this.player.y + vector.y };
    const targetTile = this.tileAt(target.x, target.y);
    if (
      targetTile !== Tile.Dirt &&
      targetTile !== Tile.Infotron &&
      targetTile !== Tile.Disk
    ) {
      return;
    }
    if (targetTile === Tile.Dirt) {
      this.setTile(target.x, target.y, Tile.Empty);
      this.score += 5;
      this.emit('dig', target, 0.65);
    } else if (targetTile === Tile.Infotron) {
      this.collectInfotron(target);
    } else {
      this.collectDisk(target);
    }
    this.motion.startCellConsumption(
      targetTile,
      target,
      direction,
      'remote',
      REMOTE_DIG_DURATION,
    );
  }

  private collectInfotron(position: Point): void {
    this.setTile(position.x, position.y, Tile.Empty);
    this.collected += 1;
    this.score += 500;
    this.emit('collect', position, 1);
    if (this.collected >= this.initial.required) this.openExit();
  }

  private collectDisk(position: Point): void {
    this.setTile(position.x, position.y, Tile.Empty);
    this.disks += 1;
    this.score += 250;
    this.emit('disk-pickup', position, 0.8);
  }

  private tryPushZonk(position: Point, direction: Direction): boolean {
    const vector = DIRECTION_VECTOR[direction];
    const destination = { x: position.x + vector.x, y: position.y };
    if (this.tileAt(destination.x, destination.y) !== Tile.Empty) {
      return false;
    }
    this.setTile(destination.x, destination.y, Tile.Zonk);
    this.setTile(position.x, position.y, Tile.Empty);
    this.motion.startTileMotion(Tile.Zonk, position, destination, 'push', PUSH_TWEEN_DURATION);
    this.movePlayer(position);
    this.score += 10;
    this.emit('push', destination, 0.55);
    return true;
  }

  private updateGravity(): void {
    const nextFalling = new Set<number>();
    for (let y = this.initial.height - 2; y >= 1; y -= 1) {
      for (let x = 1; x < this.initial.width - 1; x += 1) {
        const sourceIndex = this.index(x, y);
        if (nextFalling.has(sourceIndex)) continue;
        const tile = this.tiles[sourceIndex];
        if (tile !== Tile.Zonk && tile !== Tile.Infotron) {
          continue;
        }
        if (this.motion.hasActivePushTo({ x, y })) continue;

        const below = { x, y: y + 1 };
        if (isSamePoint(below, this.player)) {
          if (this.falling.has(sourceIndex)) {
            this.setTile(x, y, Tile.Empty);
            this.setTile(below.x, below.y, tile);
            this.motion.startTileMotion(tile, { x, y }, below, 'fall', FALL_TWEEN_DURATION);
            this.killPlayer(below);
            this.falling = nextFalling;
            return;
          }
          continue;
        }
        const belowTile = this.tileAt(below.x, below.y);
        if (belowTile === Tile.Enemy) {
          if (this.falling.has(sourceIndex)) this.explode(below);
          continue;
        }
        if (belowTile === Tile.Empty) {
          this.setTile(x, y, Tile.Empty);
          this.setTile(below.x, below.y, tile);
          this.motion.startTileMotion(tile, { x, y }, below, 'fall', FALL_TWEEN_DURATION);
          nextFalling.add(this.index(below.x, below.y));
          continue;
        }

        if (this.falling.has(sourceIndex)) {
          this.emit('impact', { x, y }, 0.45);
        }
        if (isRoundedSupport(belowTile)) {
          const directions = [-1, 1] as const;
          for (const offset of directions) {
            const side = { x: x + offset, y };
            const belowSide = { x: x + offset, y: y + 1 };
            if (
              this.tileAt(side.x, side.y) === Tile.Empty &&
              !isSamePoint(side, this.player) &&
              this.tileAt(belowSide.x, belowSide.y) === Tile.Empty &&
              !isSamePoint(belowSide, this.player)
            ) {
              this.setTile(x, y, Tile.Empty);
              this.setTile(side.x, side.y, tile);
              this.motion.startTileMotion(
                tile,
                { x, y },
                side,
                'roll',
                ROLL_TWEEN_DURATION,
              );
              nextFalling.add(this.index(side.x, side.y));
              break;
            }
          }
        }
      }
    }
    this.falling = nextFalling;
  }

  private deployDisk(): void {
    if (this.disks <= 0) {
      return;
    }
    const target = { ...this.player };
    if (this.tileAt(target.x, target.y) !== Tile.Empty) {
      return;
    }
    const targetIndex = this.index(target.x, target.y);
    this.tiles[targetIndex] = Tile.Bomb;
    this.bombFuses.set(targetIndex, BOMB_FUSE_TICKS);
    this.disks -= 1;
    this.emit('disk-deploy', target, 0.9);
  }

  private updateBombs(): void {
    for (const [index, fuse] of [...this.bombFuses.entries()]) {
      if (this.tiles[index] !== Tile.Bomb) {
        this.bombFuses.delete(index);
        continue;
      }
      if (fuse <= 1) {
        this.bombFuses.delete(index);
        this.explode(this.pointFromIndex(index));
      } else {
        this.bombFuses.set(index, fuse - 1);
      }
    }
  }

  private updateExplosions(): void {
    for (const [index, timer] of [...this.explosionTimers.entries()]) {
      if (timer <= 1) {
        if (this.tiles[index] === Tile.Explosion) {
          this.tiles[index] = Tile.Empty;
        }
        this.explosionTimers.delete(index);
      } else {
        this.explosionTimers.set(index, timer - 1);
      }
    }
  }

  private explode(center: Point): void {
    this.emit('explode', center, 1.5);
    const chainedBombs: Point[] = [];
    for (let y = center.y - 1; y <= center.y + 1; y += 1) {
      for (let x = center.x - 1; x <= center.x + 1; x += 1) {
        if (
          !this.isInside(x, y) ||
          this.tileAt(x, y) === Tile.Steel ||
          this.tileAt(x, y) === Tile.Carbon
        ) {
          continue;
        }
        const index = this.index(x, y);
        if (this.tiles[index] === Tile.Bomb && this.bombFuses.has(index)) {
          this.bombFuses.delete(index);
          if (x !== center.x || y !== center.y) chainedBombs.push({ x, y });
        }
        this.enemySystem.removeAt(index);
        this.tiles[index] = Tile.Explosion;
        this.explosionTimers.set(index, EXPLOSION_TICKS);
        if (isSamePoint({ x, y }, this.player)) {
          this.killPlayer({ x, y }, true);
        }
      }
    }
    for (const bomb of chainedBombs) this.explode(bomb);
  }

  private openExit(): void {
    for (let index = 0; index < this.tiles.length; index += 1) {
      if (this.tiles[index] === Tile.ExitClosed) {
        this.tiles[index] = Tile.ExitOpen;
        this.emit('exit-open', this.pointFromIndex(index), 1);
      }
    }
  }

  private killPlayer(position: Point, explosionAlreadyActive = false): void {
    if (this.phase !== 'playing') {
      return;
    }
    this.phase = 'lost';
    this.travel.clear();
    this.motion.clearCellConsumptions();
    this.emit('death', position, 1.3);
    if (!explosionAlreadyActive) this.explode(position);
  }

  private emit(type: GameEvent['type'], position: Point, intensity: number): void {
    this.events.push({ type, position: { ...position }, intensity });
  }

  private setTile(x: number, y: number, tile: Tile): void {
    this.tiles[this.index(x, y)] = tile;
  }

  private isInside(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.initial.width && y < this.initial.height;
  }

  private index(x: number, y: number): number {
    return y * this.initial.width + x;
  }

  private pointFromIndex(index: number): Point {
    return { x: index % this.initial.width, y: Math.floor(index / this.initial.width) };
  }

  private createEnemyWorld(): EnemyWorld {
    return {
      width: this.initial.width,
      height: this.initial.height,
      tileAt: (x, y) => this.tileAt(x, y),
      tileAtIndex: (index) => this.tiles[index] ?? Tile.Steel,
      setTileAtIndex: (index, tile) => {
        this.tiles[index] = tile;
      },
      playerPosition: () => this.player,
      index: (x, y) => this.index(x, y),
      pointFromIndex: (index) => this.pointFromIndex(index),
      startEnemyMotion: (from, to) => {
        this.motion.startTileMotion(Tile.Enemy, from, to, 'enemy', ENEMY_TWEEN_DURATION);
      },
      killPlayer: (position) => this.killPlayer(position),
      emit: (type, position, intensity) => this.emit(type, position, intensity),
    };
  }
}

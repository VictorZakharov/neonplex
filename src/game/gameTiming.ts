export const MOVE_INTERVAL = 6 / 60;
export const PLAYER_TWEEN_DURATION = MOVE_INTERVAL;
export const COOLDOWN_EPSILON = 0.000001;
export const GRAVITY_INTERVAL = 10 / 60;
export const ENEMY_INTERVAL = 13 / 60;
export const ENEMY_TURN_DURATION = ENEMY_INTERVAL;
export const BOMB_FUSE_TICKS = 52;
export const EXPLOSION_TICKS = 22;
export const FALL_TWEEN_DURATION = GRAVITY_INTERVAL;
export const ROLL_TWEEN_DURATION = GRAVITY_INTERVAL;
export const PUSH_TWEEN_DURATION = MOVE_INTERVAL;
export const ENEMY_TWEEN_DURATION = ENEMY_INTERVAL;
export const REMOTE_DIG_DURATION = 0.3;

export const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

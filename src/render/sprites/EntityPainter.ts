import type { Direction } from '../../game/types';

const TAU = Math.PI * 2;

/** Shared animated gameplay art used by both the board and learning previews. */
export class EntityPainter {
  private time = 0;

  public setTime(time: number): void {
    this.time = time;
  }

  public drawInfotron(
    context: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
    phase: number,
  ): void {
    const cx = x + size * 0.5;
    const cy = y + size * (0.5 + Math.sin(this.time * 3.4 + phase) * 0.05);
    const pulse = 0.92 + Math.sin(this.time * 5 + phase) * 0.08;
    this.drawMovableHalo(context, cx, cy, size, '#51f7ff');
    context.save();
    context.shadowColor = '#51f7ff';
    context.shadowBlur = size * 0.42;
    const glow = context.createRadialGradient(cx, cy, 0, cx, cy, size * 0.38);
    glow.addColorStop(0, 'rgba(255,255,255,1)');
    glow.addColorStop(0.2, '#90fbff');
    glow.addColorStop(0.58, '#27bad9');
    glow.addColorStop(1, 'rgba(25,76,125,0)');
    context.fillStyle = glow;
    context.beginPath();
    context.arc(cx, cy, size * 0.38 * pulse, 0, TAU);
    context.fill();
    context.translate(cx, cy);
    context.rotate(this.time * 1.6 + phase);
    context.strokeStyle = 'rgba(205, 255, 255, 0.8)';
    context.lineWidth = size * 0.035;
    context.strokeRect(-size * 0.2, -size * 0.2, size * 0.4, size * 0.4);
    context.rotate(Math.PI / 4);
    context.strokeStyle = 'rgba(74, 166, 255, 0.65)';
    context.strokeRect(-size * 0.18, -size * 0.18, size * 0.36, size * 0.36);
    context.restore();
  }

  public drawZonk(
    context: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
    phase: number,
  ): void {
    const cx = x + size * 0.5;
    const cy = y + size * 0.5;
    const radius = size * 0.37;
    this.drawMovableHalo(context, cx, cy, size, '#ffad58');
    const gradient = context.createRadialGradient(
      cx - radius * 0.35,
      cy - radius * 0.42,
      radius * 0.05,
      cx,
      cy,
      radius,
    );
    gradient.addColorStop(0, '#eef8ff');
    gradient.addColorStop(0.16, '#8da5b6');
    gradient.addColorStop(0.5, '#344553');
    gradient.addColorStop(0.82, '#111b25');
    gradient.addColorStop(1, '#050a10');
    context.save();
    context.shadowColor = 'rgba(0, 0, 0, 0.8)';
    context.shadowBlur = size * 0.16;
    context.shadowOffsetY = size * 0.08;
    context.fillStyle = gradient;
    context.beginPath();
    context.arc(cx, cy, radius, 0, TAU);
    context.fill();
    context.shadowBlur = 0;
    context.translate(cx, cy);
    context.rotate(this.time * 0.35 + phase * 0.15);
    context.strokeStyle = 'rgba(255, 176, 84, 0.92)';
    context.lineWidth = size * 0.055;
    context.beginPath();
    context.arc(0, 0, radius * 0.7, -1.1, 1.1);
    context.stroke();
    context.rotate(Math.PI);
    context.strokeStyle = 'rgba(210, 224, 232, 0.24)';
    context.beginPath();
    context.arc(0, 0, radius * 0.52, -0.9, 0.9);
    context.stroke();
    context.restore();
  }

  public drawExit(
    context: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
    open: boolean,
  ): void {
    const cx = x + size * 0.5;
    const cy = y + size * 0.5;
    context.save();
    context.fillStyle = '#050812';
    context.fillRect(x + size * 0.08, y + size * 0.08, size * 0.84, size * 0.84);
    context.translate(cx, cy);
    const color = open ? '#5effc6' : '#ff466d';
    context.shadowColor = color;
    context.shadowBlur = open ? size * 0.55 : size * 0.15;
    for (let ring = 0; ring < 3; ring += 1) {
      context.rotate((open ? 1 : -0.25) * this.time * (0.45 + ring * 0.22));
      context.strokeStyle = ring === 0 ? color : `${color}99`;
      context.lineWidth = size * (0.06 - ring * 0.012);
      context.beginPath();
      context.arc(
        0,
        0,
        size * (0.34 - ring * 0.075),
        ring * 0.8,
        Math.PI * 1.65 + ring * 0.8,
      );
      context.stroke();
    }
    if (open) {
      const core = context.createRadialGradient(0, 0, 0, 0, 0, size * 0.24);
      core.addColorStop(0, 'rgba(255,255,255,0.95)');
      core.addColorStop(0.35, 'rgba(93,255,201,0.75)');
      core.addColorStop(1, 'rgba(20,120,100,0)');
      context.fillStyle = core;
      context.beginPath();
      context.arc(0, 0, size * 0.25, 0, TAU);
      context.fill();
    }
    context.restore();

    context.save();
    context.shadowColor = color;
    context.shadowBlur = size * (open ? 0.22 : 0.1);
    context.fillStyle = 'rgba(3, 12, 19, 0.9)';
    context.strokeStyle = color;
    context.lineWidth = Math.max(1, size * 0.035);
    context.beginPath();
    context.arc(cx, cy, size * 0.18, 0, TAU);
    context.fill();
    context.stroke();
    context.shadowBlur = 0;
    context.font = `800 ${size * 0.29}px Bahnschrift, "Arial Narrow", sans-serif`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.lineJoin = 'round';
    context.strokeStyle = '#031019';
    context.lineWidth = Math.max(1.5, size * 0.065);
    context.strokeText('E', cx, cy + size * 0.012);
    context.fillStyle = open ? '#dcfff2' : '#ffd4de';
    context.fillText('E', cx, cy + size * 0.012);
    context.restore();
  }

  public drawEnemy(
    context: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
    phase: number,
    facingAngle: number,
  ): void {
    const cx = x + size * 0.5;
    const cy = y + size * 0.5;
    const rotorRotation = this.time * 2.7 + phase;
    this.drawMovableHalo(context, cx, cy, size, '#ff2bbf');
    context.save();
    context.translate(cx, cy);
    context.rotate(rotorRotation);
    context.shadowColor = '#ff2bbf';
    context.shadowBlur = size * 0.35;
    context.fillStyle = '#9b165f';
    context.strokeStyle = '#ff70d5';
    context.lineWidth = size * 0.04;
    context.beginPath();
    for (let index = 0; index < 16; index += 1) {
      const radius = index % 2 === 0 ? size * 0.43 : size * 0.3;
      const angle = (index / 16) * TAU;
      const px = Math.cos(angle) * radius;
      const py = Math.sin(angle) * radius;
      if (index === 0) context.moveTo(px, py);
      else context.lineTo(px, py);
    }
    context.closePath();
    context.fill();
    context.stroke();
    const core = context.createRadialGradient(
      -size * 0.07,
      -size * 0.08,
      0,
      0,
      0,
      size * 0.24,
    );
    core.addColorStop(0, '#ffffff');
    core.addColorStop(0.18, '#ffb4eb');
    core.addColorStop(0.55, '#e326a7');
    core.addColorStop(1, '#41042c');
    context.fillStyle = core;
    context.beginPath();
    context.arc(0, 0, size * 0.24, 0, TAU);
    context.fill();
    context.restore();

    context.save();
    context.translate(cx, cy);
    context.rotate(facingAngle);
    context.shadowColor = '#ff8cdd';
    context.shadowBlur = size * 0.16;
    context.fillStyle = 'rgba(28, 4, 28, 0.92)';
    context.strokeStyle = '#ffb3e8';
    context.lineWidth = Math.max(1, size * 0.035);
    context.beginPath();
    context.moveTo(-size * 0.12, -size * 0.14);
    context.lineTo(size * 0.34, 0);
    context.lineTo(-size * 0.12, size * 0.14);
    context.lineTo(-size * 0.02, 0);
    context.closePath();
    context.fill();
    context.stroke();
    context.shadowBlur = 0;
    context.fillStyle = '#fff4fd';
    context.beginPath();
    context.arc(size * 0.16, 0, size * 0.045, 0, TAU);
    context.fill();
    context.restore();
  }

  public drawDisk(
    context: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
    armed: boolean,
  ): void {
    const cx = x + size * 0.5;
    const cy = y + size * 0.5;
    const pulse = armed ? 0.55 + Math.sin(this.time * 19) * 0.4 : 0.45;
    context.save();
    context.translate(cx, cy);
    context.shadowColor = armed ? '#ff3c68' : '#ffd84d';
    context.shadowBlur = size * pulse;
    context.fillStyle = armed ? '#5e1028' : '#725c12';
    context.strokeStyle = armed ? '#ff5478' : '#ffe475';
    context.lineWidth = size * 0.055;
    context.beginPath();
    context.arc(0, 0, size * 0.35, 0, TAU);
    context.fill();
    context.stroke();
    context.rotate(this.time * (armed ? -4 : 1));
    for (let index = 0; index < 4; index += 1) {
      context.rotate(Math.PI / 2);
      context.fillStyle = armed ? '#ff8297' : '#fff1a3';
      context.fillRect(-size * 0.035, -size * 0.29, size * 0.07, size * 0.16);
    }
    context.fillStyle = armed ? '#ffffff' : '#fffbd9';
    context.beginPath();
    context.arc(0, 0, size * 0.085, 0, TAU);
    context.fill();
    context.restore();
  }

  public drawExplosion(
    context: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
    phase: number,
  ): void {
    const cx = x + size * 0.5;
    const cy = y + size * 0.5;
    const pulse = 0.65 + Math.sin(this.time * 24 + phase) * 0.22;
    const gradient = context.createRadialGradient(cx, cy, 0, cx, cy, size * 0.52);
    gradient.addColorStop(0, '#ffffff');
    gradient.addColorStop(0.16, '#b8ffff');
    gradient.addColorStop(0.35, '#44dfff');
    gradient.addColorStop(0.64, '#8854ff');
    gradient.addColorStop(1, 'rgba(255, 20, 130, 0)');
    context.save();
    context.globalCompositeOperation = 'lighter';
    context.fillStyle = gradient;
    context.beginPath();
    context.arc(cx, cy, size * pulse, 0, TAU);
    context.fill();
    context.restore();
  }

  public drawCarrier(
    context: CanvasRenderingContext2D,
    centerX: number,
    centerY: number,
    size: number,
    facing: Direction,
    stretchX: number,
    stretchY: number,
  ): void {
    context.save();
    context.translate(centerX, centerY);
    context.scale(stretchX, stretchY);
    context.shadowColor = '#ff9f43';
    context.shadowBlur = size * 0.42;
    const body = context.createRadialGradient(
      -size * 0.12,
      -size * 0.17,
      size * 0.02,
      0,
      0,
      size * 0.43,
    );
    body.addColorStop(0, '#fff5d9');
    body.addColorStop(0.13, '#ffc36c');
    body.addColorStop(0.5, '#f26a2e');
    body.addColorStop(0.83, '#a62a29');
    body.addColorStop(1, '#3d101b');
    context.fillStyle = body;
    context.beginPath();
    context.arc(0, 0, size * 0.39, 0, TAU);
    context.fill();
    context.shadowBlur = 0;
    this.drawPlayerVisor(context, size, facing);
    context.strokeStyle = 'rgba(255, 222, 163, 0.6)';
    context.lineWidth = size * 0.026;
    context.beginPath();
    context.arc(0, 0, size * 0.31, 2.2, 4.95);
    context.stroke();
    context.restore();
  }

  private drawMovableHalo(
    context: CanvasRenderingContext2D,
    centerX: number,
    centerY: number,
    size: number,
    color: string,
  ): void {
    context.save();
    const well = context.createRadialGradient(centerX, centerY, 0, centerX, centerY, size * 0.48);
    well.addColorStop(0, 'rgba(0, 4, 10, 0.1)');
    well.addColorStop(0.62, 'rgba(0, 4, 10, 0.52)');
    well.addColorStop(1, 'rgba(0, 4, 10, 0)');
    context.fillStyle = well;
    context.beginPath();
    context.arc(centerX, centerY, size * 0.48, 0, TAU);
    context.fill();
    context.strokeStyle = color;
    context.globalAlpha = 0.78;
    context.lineWidth = Math.max(1.2, size * 0.028);
    context.setLineDash([size * 0.11, size * 0.065]);
    context.lineDashOffset = -this.time * size * 0.18;
    context.shadowColor = color;
    context.shadowBlur = size * 0.18;
    context.beginPath();
    context.arc(centerX, centerY, size * 0.455, 0, TAU);
    context.stroke();
    context.restore();
  }

  private drawPlayerVisor(
    context: CanvasRenderingContext2D,
    size: number,
    facing: Direction,
  ): void {
    const vector: Readonly<Record<Direction, readonly [number, number]>> = {
      up: [0, -1],
      down: [0, 1],
      left: [-1, 0],
      right: [1, 0],
    };
    const [vx, vy] = vector[facing];
    const perpendicularX = -vy;
    const perpendicularY = vx;
    const offsetX = vx * size * 0.11;
    const offsetY = vy * size * 0.11;
    for (const side of [-1, 1]) {
      const ex = offsetX + perpendicularX * side * size * 0.105;
      const ey = offsetY + perpendicularY * side * size * 0.105;
      context.fillStyle = '#07131d';
      context.beginPath();
      context.arc(ex, ey, size * 0.075, 0, TAU);
      context.fill();
      context.fillStyle = '#74f4ff';
      context.shadowColor = '#42e8ff';
      context.shadowBlur = size * 0.1;
      context.beginPath();
      context.arc(
        ex + vx * size * 0.018,
        ey + vy * size * 0.018,
        size * 0.035,
        0,
        TAU,
      );
      context.fill();
      context.shadowBlur = 0;
    }
  }
}

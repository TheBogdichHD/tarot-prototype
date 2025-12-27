import {
    _decorator,
    Component,
    Graphics,
    UITransform,
    Vec2,
    Vec3,
    math,
} from 'cc';
const { ccclass, property } = _decorator;

export interface LevelConfig {
    rows: number;
    cols: number;
    cellSize: number;
    specialPoints: Vec2[];
}

@ccclass('GridView')
export class GridView extends Component {
    @property rows = 4;
    @property cols = 4;
    @property cellSize = 100;
    @property dotRadius = 6;
    @property({ type: [Vec2] })
    specialPoints: Vec2[] = [];

    get config(): LevelConfig {
        return {
            rows: this.rows,
            cols: this.cols,
            cellSize: this.cellSize,
            specialPoints: this.specialPoints,
        };
    }

    gridToWorld(col: number, row: number, out?: Vec3): Vec3 {
        const cfg = this.config;
        const gridWidth = (cfg.cols - 1) * cfg.cellSize;
        const gridHeight = (cfg.rows - 1) * cfg.cellSize;
        const halfW = gridWidth * 0.5;
        const halfH = gridHeight * 0.5;

        const localX = -halfW + col * cfg.cellSize;
        const localY = -halfH + row * cfg.cellSize;

        const ui = this.getComponent(UITransform)!;
        const local = out || new Vec3();
        local.set(localX, localY, 0);

        return ui.convertToWorldSpaceAR(local, local);
    }

    uiPosToGrid(uiPos: Vec2): { col: number; row: number } | null {
        const ui = this.getComponent(UITransform);
        if (!ui) return null;

        const tmp = new Vec3(uiPos.x, uiPos.y, 0);
        const local = ui.convertToNodeSpaceAR(tmp);

        const cfg = this.config;
        const gridWidth = (cfg.cols - 1) * cfg.cellSize;
        const gridHeight = (cfg.rows - 1) * cfg.cellSize;
        const halfW = gridWidth * 0.5;
        const halfH = gridHeight * 0.5;

        const col = Math.round((local.x + halfW) / cfg.cellSize);
        const row = Math.round((local.y + halfH) / cfg.cellSize);

        if (col < 0 || col >= cfg.cols || row < 0 || row >= cfg.rows) {
            return null;
        }
        return { col, row };
    }

    uiPosToGridWithDistance(uiPos: Vec2): {
        col: number;
        row: number;
        dist: number;
    } | null {
        const ui = this.getComponent(UITransform);
        if (!ui) return null;

        const cfg = this.config;
        const gridWidth = (cfg.cols - 1) * cfg.cellSize;
        const gridHeight = (cfg.rows - 1) * cfg.cellSize;
        const halfW = gridWidth * 0.5;
        const halfH = gridHeight * 0.5;

        const world = new Vec3(uiPos.x, uiPos.y, 0);
        const local = ui.convertToNodeSpaceAR(world);

        const rawCol = (local.x + halfW) / cfg.cellSize;
        const rawRow = (local.y + halfH) / cfg.cellSize;
        const col = Math.round(rawCol);
        const row = Math.round(rawRow);

        if (col < 0 || col >= cfg.cols || row < 0 || row >= cfg.rows) {
            return null;
        }

        const snapX = -halfW + col * cfg.cellSize;
        const snapY = -halfH + row * cfg.cellSize;
        const dx = local.x - snapX;
        const dy = local.y - snapY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        return { col, row, dist };
    }
    start() {
        const g = this.getComponent(Graphics);
        if (!g) {
            return;
        }

        const cfg = this.config;

        const gridWidth = (cfg.cols - 1) * cfg.cellSize;
        const gridHeight = (cfg.rows - 1) * cfg.cellSize;
        const halfW = gridWidth * 0.5;
        const halfH = gridHeight * 0.5;

        g.clear();

        g.fillColor.fromHEX('#666666');
        for (let r = 0; r < cfg.rows; r++) {
            const y = -halfH + r * cfg.cellSize;
            for (let c = 0; c < cfg.cols; c++) {
                const x = -halfW + c * cfg.cellSize;
                g.circle(x, y, this.dotRadius);
                g.fill();
            }
        }

        for (const p of cfg.specialPoints) {
            const col = p.x;
            const row = p.y;

            if (row < 0 || row >= cfg.rows || col < 0 || col >= cfg.cols) {
                continue;
            }

            const sx = -halfW + col * cfg.cellSize;
            const sy = -halfH + row * cfg.cellSize;

            g.fillColor.fromHEX('#ff0000');
            g.circle(sx, sy, this.dotRadius * 1.5);
            g.fill();
        }

        const ui = this.getComponent(UITransform);
        if (ui) {
            ui.setContentSize(gridWidth, gridHeight);
        }
    }
}

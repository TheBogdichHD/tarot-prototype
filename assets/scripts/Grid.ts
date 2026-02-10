import { _decorator, Component, Graphics, Vec2, UITransform } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('Grid')
export class Grid extends Component {
    private graphics: Graphics | null = null;

    @property
    private rows: number = 4;
    @property
    private cols: number = 4;
    @property
    private cellSize: number = 100;

    @property({ type: [Vec2] })
    private specialPoints: Vec2[] = [];

    private gridWidth: number = 0;
    private gridHeight: number = 0;
    private halfW: number = 0;
    private halfH: number = 0;

    start() {
        this.graphics = this.getComponent(Graphics);
        this.calculateGridDimensions();
        this.drawGrid();
    }

    private calculateGridDimensions() {
        this.gridWidth = (this.cols - 1) * this.cellSize;
        this.gridHeight = (this.rows - 1) * this.cellSize;
        this.halfW = this.gridWidth * 0.5;
        this.halfH = this.gridHeight * 0.5;
    }

    private drawGrid() {
        this.graphics.clear();

        this.graphics.fillColor.fromHEX('#666666');
        for (let r = 0; r < this.rows; r++) {
            const y = -this.halfH + r * this.cellSize;
            for (let c = 0; c < this.cols; c++) {
                const x = -this.halfW + c * this.cellSize;
                this.graphics.circle(x, y, this.graphics.lineWidth);
                this.graphics.fill();
            }
        }

        for (const p of this.specialPoints) {
            const col = p.x;
            const row = p.y;

            if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) {
                continue;
            }

            const sx = -this.halfW + col * this.cellSize;
            const sy = -this.halfH + row * this.cellSize;

            this.graphics.fillColor.fromHEX('#ff0000');
            this.graphics.circle(sx, sy, this.graphics.lineWidth * 1.5);
            this.graphics.fill();
        }
    }

    public getGridPoint(local: Vec2): {
        col: number;
        row: number;
        dist: number;
        isSpecial: boolean;
        position: Vec2;
    } | null {
        const rawCol = (local.x + this.halfW) / this.cellSize;
        const rawRow = (local.y + this.halfH) / this.cellSize;
        const col = Math.round(rawCol);
        const row = Math.round(rawRow);

        if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) {
            return null;
        }

        const snapX = -this.halfW + col * this.cellSize;
        const snapY = -this.halfH + row * this.cellSize;
        const dx = local.x - snapX;
        const dy = local.y - snapY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        const isSpecial = this.specialPoints.some(p => p.x === col && p.y === row);

        return {
            col,
            row,
            dist,
            isSpecial,
            position: new Vec2(snapX, snapY)
        };
    }

    public getWorldPosition(col: number, row: number): Vec2 {
        const x = -this.halfW + col * this.cellSize;
        const y = -this.halfH + row * this.cellSize;
        return new Vec2(x, y);
    }

    public updateGrid(rows: number, cols: number, cellSize: number) {
        this.rows = rows;
        this.cols = cols;
        this.cellSize = cellSize;
        this.calculateGridDimensions();
        this.drawGrid();
    }
}
import { _decorator, Component, Vec2, Graphics, Color, CCInteger, JsonAsset } from 'cc';

import { ShapeValidator } from "./ShapeValidator";
import { UI } from "./UI";

const { ccclass, property } = _decorator;

interface Point {
    row: number;
    col: number;
}

interface GridPoint {
    position: Vec2;
    row: number;
    col: number;
    isInteractable: boolean;
    isGoal: boolean;
}

interface Level {
    id: number;
    name: string;
    rows: number;
    cols: number;
    threeStarsThreshold: number;
    twoStarsThreshold: number;
    interactablePoints: { row: number; col: number }[];
    goalPoints: { row: number; col: number }[];
}

interface LevelData {
    levels: Level[];
}

@ccclass('Grid')
export class Grid extends Component {
    @property
    public cellDistance: number = 100;

    @property
    private pointColor: Color = new Color(255, 255, 255, 128);

    @property
    private pointRadius: number = 1;

    @property
    private interactablePointColor: Color = new Color(0, 255, 0, 128);

    @property
    private interactablePointRadius: number = 6;

    @property
    private goalPointColor: Color = new Color(255, 255, 0, 255);

    @property
    private goalPointRadius: number = 8;

    @property(JsonAsset)
    private levelDataAsset: JsonAsset = null;

    @property(UI)
    private ui: UI = null;

    private currentLevel: Level = null;

    private gridPoints: GridPoint[][] = [];
    private interactablePoints: GridPoint[] = [];

    private graphics: Graphics = null;

    private claimedGoalPoints: Set<string> = new Set();

    public get allGoalPoints(): GridPoint[] {
        return this.interactablePoints.filter(p => p.isGoal);
    }

    private get levelData(): LevelData {
        return this.levelDataAsset.json as LevelData;
    }

    start() {
        this.graphics = this.getComponent(Graphics);

        this.loadLevel(1);
    }

    private loadLevel(levelId: number) {
        this.currentLevel = this.levelData.levels.find(level => level.id === levelId);

        this.ui.threeStarsThreshold = this.currentLevel.threeStarsThreshold;
        this.ui.twoStarsThreshold = this.currentLevel.twoStarsThreshold;

        this.generateGrid();
        this.drawGrid();
    }

    private drawGrid() {
        this.graphics.clear();

        for (const point of this.gridPoints) {
            for (const p of point) {
                this.drawPoint(p);
            }
        }

        this.ui.updateGoalLabel(this.claimedGoalPoints.size, this.allGoalPoints.length);
    }

    private drawPoint(point: GridPoint) {
        let color = this.pointColor;
        let radius = this.pointRadius;

        if (point.isGoal) {
            const key = `${point.row},${point.col}`;
            if (this.claimedGoalPoints.has(key)) {
                color = new Color(0, 255, 0, 255);
                radius = this.goalPointRadius + 2;
            } else {
                color = this.goalPointColor;
                radius = this.goalPointRadius;
            }
        } else if (point.isInteractable) {
            color = this.interactablePointColor;
            radius = this.interactablePointRadius;
        }

        this.graphics.fillColor = color;
        this.graphics.circle(point.position.x, point.position.y, radius);
        this.graphics.fill();
    }

    private generateGrid() {
        this.gridPoints = [];
        this.interactablePoints = [];

        const gridWidth = (this.currentLevel.cols - 1) * this.cellDistance;
        const gridHeight = (this.currentLevel.rows - 1) * this.cellDistance;
        const offsetX = gridWidth * 0.5;
        const offsetY = gridHeight * 0.5;

        const isInteractablePoint = (row: number, col: number): boolean => {
            return this.currentLevel.interactablePoints.some(p => p.row === row && p.col === col);
        };

        const isGoalPoint = (row: number, col: number): boolean => {
            return this.currentLevel.goalPoints.some(p => p.row === row && p.col === col);
        };

        for (let row = 0; row < this.currentLevel.rows; row++) {
            this.gridPoints[row] = [];

            for (let col = 0; col < this.currentLevel.cols; col++) {
                const localX = col * this.cellDistance - offsetX;
                const localY = -(row * this.cellDistance) + offsetY;

                const position = new Vec2(localX, localY);
                const isInteractable = isInteractablePoint(row, col);
                const isGoal = isGoalPoint(row, col);

                const point: GridPoint = {
                    position,
                    row,
                    col,
                    isInteractable,
                    isGoal
                };

                this.gridPoints[row][col] = point;

                if (isInteractable) {
                    this.interactablePoints.push(point);
                }
            }
        }
    }

    public getNearestPoint(pos: Vec2): {
        position: Vec2;
        distance: number;
    } {
        if (this.interactablePoints.length === 0) {
            return { position: null, distance: Infinity };
        }

        let nearestPoint: GridPoint | null = null;
        let minDistance = Infinity;

        for (const point of this.interactablePoints) {
            const distance = Vec2.distance(pos, point.position);
            if (distance < minDistance) {
                minDistance = distance;
                nearestPoint = point;
            }
        }

        return {
            position: nearestPoint.position,
            distance: minDistance,
        };
    }

    public getPointAt(pos: Vec2): GridPoint | null {
        if (this.interactablePoints.length === 0) {
            return null;
        }

        for (const point of this.interactablePoints) {
            if (point.position.equals(pos)) {
                return point;
            }
        }
    }

    public getAllinteractablePoints(): GridPoint[] {
        return this.interactablePoints;
    }

    public claimAllGoalPoints(snappedShape: Array<Point>): void {
        for (let i = 0; i < snappedShape.length - 1; i++) {
            const start = snappedShape[i];
            const end = snappedShape[i + 1];
            const edgePoints = this.getAllGoalPointsOnSegment(start, end);

            for (const point of edgePoints)
                this.claimedGoalPoints.add(`${point.row},${point.col}`);
        }

        this.drawGrid();
    }

    private getAllGoalPointsOnSegment(start: Point, end: Point): Array<Point> {
        const points: Array<Point> = [];

        for (const gridPoint of this.allGoalPoints) {
            const point = { row: gridPoint.row, col: gridPoint.col };

            if (ShapeValidator.isPointOnSegment(start, end, point)) {
                points.push(point);
            }
        }

        return points;
    }
}

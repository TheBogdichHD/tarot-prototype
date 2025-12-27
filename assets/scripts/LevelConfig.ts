import { Vec2, v2 } from 'cc';

export interface LevelConfig {
    rows: number;
    cols: number;
    cellSize: number;
    specialPoints: Vec2[];
}

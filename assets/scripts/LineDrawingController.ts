import {
    _decorator,
    Component,
    Node,
    Graphics,
    input,
    Input,
    EventTouch,
    EventMouse,
    UITransform,
    Vec2,
    Vec3,
    Label,
    Color,
    instantiate,
    Prefab,
    v2,
    v3,
} from 'cc';
import { GridView } from './GridView';

const { ccclass, property } = _decorator;
type GridCell = { col: number; row: number };
type Shape = GridCell[];

interface PermittedShape {
    points: Shape;
    closed: boolean;
}

const PERMITTED_SHAPES: PermittedShape[] = [
    {
        closed: true,
        points: [
            { col: 0, row: 0 },
            { col: 1, row: 0 },
            { col: 1, row: 1 },
            { col: 0, row: 0 },
        ],
    },

    {
        closed: true,
        points: [
            { col: -1, row: 0 },
            { col: 0, row: -1 },
            { col: 1, row: 0 },
            { col: 0, row: 1 },
            { col: -1, row: 0 },
        ],
    },
];
type Step = { dc: number; dr: number };

@ccclass('LineDrawingController')
export class LineDrawingController extends Component {
    @property(GridView)
    gridView: GridView | null = null;

    @property(Node)
    lineLayer: Node | null = null;

    @property(Node)
    previewLineLayer: Node | null = null;

    @property(Node)
    zoomContainer: Node | null = null;

    @property(Number)
    minZoom = 0.5;
    @property(Number)
    maxZoom = 3.0;
    @property(Number)
    zoomSensitivity = 0.005;

    @property(Number)
    zoomStep = 0.1;
    private currentEndWorld: Vec3 | null = null;
    private currentPath: { col: number; row: number }[] = [];

    private committedPaths: Shape[] = [];

    @property(Number)
    snapRadiusFactor = 0.3;

    @property(Label)
    specialCoverageLabel: Label | null = null;

    @property(Label)
    shapesLabel: Label | null = null;

    @property
    shapeCount3Stars = 1;

    @property
    shapeCount2Stars = 2;

    @property(Label)
    starsLabel: Label | null = null;

    @property(Label)
    winLabel: Label | null = null;

    private usedShapeCount = 0;
    private coveredSpecialKeys = new Set<string>();
    private rawPoints: Vec3[] = [];
    private readonly MAX_CURVATURE_ANGLE = 60;

    private readonly MAX_RAW_POINTS = 1000;
    private readonly MIN_DIST_SQ = 2;

    @property(Node)
    fxParent: Node | null = null;

    @property(Prefab)
    particlePrefab: Prefab | null = null;

    @property(Prefab)
    particleComittedPrefab: Prefab | null = null;
    private dragParticle: Node | null = null;

    private pinchStartDist = 0;
    private pinchStartScale = v3();
    private pinchStartPos1 = v2();
    private pinchStartPos2 = v2();
    private isPinching = false;
    private isDrawing = false;
    private touchCount = 0;
    private touchIds: Set<number> = new Set();

    onEnable() {
        input.on(Input.EventType.TOUCH_START, this.onTouchStart, this);
        input.on(Input.EventType.TOUCH_MOVE, this.onTouchMove, this);
        input.on(Input.EventType.TOUCH_END, this.onTouchEnd, this);
        input.on(Input.EventType.TOUCH_CANCEL, this.onTouchCancel, this);
        input.on(Input.EventType.MOUSE_DOWN, this.onMouseDown, this);
        input.on(Input.EventType.MOUSE_MOVE, this.onMouseMove, this);
        input.on(Input.EventType.MOUSE_UP, this.onMouseUp, this);
        input.on(Input.EventType.MOUSE_WHEEL, this.onMouseWheel, this);
    }

    onDisable() {
        input.off(Input.EventType.TOUCH_START, this.onTouchStart, this);
        input.off(Input.EventType.TOUCH_MOVE, this.onTouchMove, this);
        input.off(Input.EventType.TOUCH_END, this.onTouchEnd, this);
        input.off(Input.EventType.TOUCH_CANCEL, this.onTouchCancel, this);
        input.off(Input.EventType.MOUSE_DOWN, this.onMouseDown, this);
        input.off(Input.EventType.MOUSE_UP, this.onMouseUp, this);
        input.off(Input.EventType.MOUSE_MOVE, this.onMouseMove, this);
        input.off(Input.EventType.MOUSE_WHEEL, this.onMouseWheel, this);

        this.touchIds.clear();
        this.touchCount = 0;
    }

    protected start(): void {
        this.updateHUD();
    }

    private cellKey(col: number, row: number): string {
        return `${col},${row}`;
    }

    private computeStars(): number {
        if (this.usedShapeCount <= this.shapeCount3Stars) return 3;
        if (this.usedShapeCount <= this.shapeCount2Stars) return 2;
        return 1;
    }

    private updateHUD() {
        if (!this.gridView) return;

        const cfg = this.gridView.config;
        const totalSpecials = cfg.specialPoints.length;
        const covered = this.coveredSpecialKeys.size;

        if (this.specialCoverageLabel) {
            this.specialCoverageLabel.string = `Specials: ${covered} / ${totalSpecials}`;
        }

        if (this.shapesLabel) {
            this.shapesLabel.string = `Shapes: ${this.usedShapeCount} / ${this.shapeCount3Stars}`;
        }

        if (this.starsLabel) {
            const stars = this.computeStars();

            this.starsLabel.string = '★'.repeat(stars);
        }
    }

    private onMouseWheel(e: EventMouse) {
        if (!this.zoomContainer) return;

        const currentScale = this.zoomContainer.scale.x;

        let newScale = currentScale;
        if (e.getScrollY() > 0) {
            newScale = Math.min(this.maxZoom, currentScale + this.zoomStep);
        } else {
            newScale = Math.max(this.minZoom, currentScale - this.zoomStep);
        }

        this.zoomContainer.setScale(newScale, newScale, 1);

        this.redrawAllCommittedLines();
    }

    private registerCommittedShapeCoverage() {
        if (!this.gridView) return;

        this.usedShapeCount++;

        const cfg = this.gridView.config;
        const specials = cfg.specialPoints;

        for (const pt of this.currentPath) {
            for (const sp of specials) {
                if (sp.x === pt.col && sp.y === pt.row) {
                    this.coveredSpecialKeys.add(this.cellKey(pt.col, pt.row));
                }
            }
        }

        this.updateHUD();
    }

    private onTouchStart(e: EventTouch) {
        const touchId = e.getID();
        this.touchIds.add(touchId);
        this.touchCount = this.touchIds.size;

        if (this.touchCount === 1) {
            this.isDrawing = true;
            this.beginAt(e.getUILocation());
        } else if (this.touchCount === 2) {
            this.startPinch(e);
        }
    }

    private onTouchMove(e: EventTouch) {
        if (this.touchCount === 1 && this.isDrawing) {
            this.updatePreview(e.getUILocation());
        } else if (this.touchCount === 2 && this.isPinching) {
            this.updatePinch(e);
        }
    }

    private onTouchEnd(e: EventTouch) {
        const touchId = e.getID();
        this.touchIds.delete(touchId);
        this.touchCount = this.touchIds.size;

        if (
            this.touchCount === 0 &&
            this.isDrawing &&
            this.currentPath.length > 0
        ) {
            this.commitLine(e.getUILocation());
            this.isDrawing = false;
        } else if (this.touchCount === 1) {
            this.endPinch();
        }
    }

    private onTouchCancel(e: EventTouch) {
        const touchId = e.getID();
        this.touchIds.delete(touchId);
        this.touchCount = this.touchIds.size;

        if (this.touchCount === 0) {
            this.isDrawing = false;
            this.endPinch();

            if (this.currentPath.length > 0) {
                this.commitLine(new Vec2(0, 0));
            }
        }
    }

    private endPinch() {
        if (this.isPinching) {
            this.isPinching = false;
        }
    }

    private startPinch(e: EventTouch) {
        this.isPinching = true;
        this.isDrawing = false;

        const touches = e.getAllTouches();
        this.pinchStartPos1.set(touches[0].getUILocation());
        this.pinchStartPos2.set(touches[1].getUILocation());

        this.pinchStartDist = this.pinchStartPos1
            .subtract(this.pinchStartPos2)
            .length();

        if (this.zoomContainer) {
            this.pinchStartScale.set(this.zoomContainer.scale);
        }
    }

    private updatePinch(e: EventTouch) {
        if (!this.isPinching || !this.zoomContainer) return;

        const touches = e.getAllTouches();
        const pos1 = touches[0].getUILocation();
        const pos2 = touches[1].getUILocation();

        const currentDist = pos1.subtract(pos2).length();
        const scaleFactor = currentDist / this.pinchStartDist;

        const newScaleX = this.pinchStartScale.x * scaleFactor;
        const newScaleY = this.pinchStartScale.y * scaleFactor;

        const clampedScale = Math.max(
            this.minZoom,
            Math.min(this.maxZoom, newScaleX)
        );

        this.zoomContainer.setScale(clampedScale, clampedScale, 1);

        this.redrawAllCommittedLines();
    }

    private onMouseDown(e: EventMouse) {
        this.isDrawing = true;
        this.beginAt(e.getUILocation());
    }

    private onMouseMove(e: EventMouse) {
        if (this.currentPath.length != 0 && this.isDrawing) {
            this.updatePreview(e.getUILocation());
        }
    }

    private onMouseUp(e: EventMouse) {
        if (this.isDrawing) {
            this.isDrawing = false;
            this.commitLine(e.getUILocation());
        }
    }

    private addRawPoint(uiPos: Vec2) {
        const p = new Vec3(uiPos.x, uiPos.y, 0);

        const n = this.rawPoints.length;
        if (n > 0) {
            const last = this.rawPoints[n - 1];
            const dx = p.x - last.x;
            const dy = p.y - last.y;
            if (dx * dx + dy * dy < this.MIN_DIST_SQ) {
                return;
            }
        }

        if (this.rawPoints.length >= 2) {
            const a = this.rawPoints[this.rawPoints.length - 2];
            const b = this.rawPoints[this.rawPoints.length - 1];
            const c = p;

            const abx = b.x - a.x;
            const aby = b.y - a.y;
            const bcx = c.x - b.x;
            const bcy = c.y - b.y;

            const abLen = Math.sqrt(abx * abx + aby * aby);
            const bcLen = Math.sqrt(bcx * bcx + bcy * bcy);

            if (abLen > 0.0001 && bcLen > 0.0001) {
                const dot = (abx * bcx + aby * bcy) / (abLen * bcLen);
                const clampedDot = Math.max(-1, Math.min(1, dot));
                const angleRad = Math.acos(clampedDot);
                const angleDeg = (angleRad * 180) / Math.PI;

                if (angleDeg < this.MAX_CURVATURE_ANGLE) {
                    const smoothFactor = 0.5;
                    const smoothed = new Vec3(
                        b.x + (c.x - b.x) * smoothFactor,
                        b.y + (c.y - b.y) * smoothFactor,
                        0
                    );

                    this.rawPoints[this.rawPoints.length - 1] = smoothed;
                    return;
                }
            }
        }

        if (this.rawPoints.length >= this.MAX_RAW_POINTS) {
            this.rawPoints.shift();
        }

        this.rawPoints.push(p);
    }

    private beginAt(uiPos: Vec2) {
        if (!this.gridView) return;

        const snappedInfo = this.gridView.uiPosToGridWithDistance(uiPos);
        if (!snappedInfo) return;

        this.currentPath.length = 0;
        this.currentEndWorld = null;
        this.clearPreview();

        this.currentPath.push({ col: snappedInfo.col, row: snappedInfo.row });
        this.currentEndWorld = this.gridView.gridToWorld(
            snappedInfo.col,
            snappedInfo.row
        );

        this.rawPoints.length = 0;
        this.addRawPoint(uiPos);

        if (this.particlePrefab && !this.dragParticle) {
            const p = instantiate(this.particlePrefab);
            this.fxParent?.addChild(p);
            p.setWorldPosition(this.currentEndWorld);
            console.log(2);
            this.dragParticle = p;
        }

        this.redrawPreview();
    }

    private updatePreview(uiPos: Vec2) {
        if (!this.gridView || !this.previewLineLayer) return;
        if (this.currentPath.length === 0) return;

        const snapInfo = this.gridView.uiPosToGridWithDistance(uiPos);
        const cfg = this.gridView.config;
        const snapRadius = cfg.cellSize * this.snapRadiusFactor;

        let endWorld: Vec3;
        let pointForRaw: Vec2 | null = null;

        if (snapInfo && snapInfo.dist <= snapRadius) {
            const last = this.currentPath[this.currentPath.length - 1];
            if (
                !last ||
                last.col !== snapInfo.col ||
                last.row !== snapInfo.row
            ) {
                this.currentPath.push({ col: snapInfo.col, row: snapInfo.row });
            }

            endWorld = this.gridView.gridToWorld(snapInfo.col, snapInfo.row);
            pointForRaw = new Vec2(endWorld.x, endWorld.y);
        } else {
            endWorld = new Vec3(uiPos.x, uiPos.y, 0);
            pointForRaw = uiPos;
        }

        this.currentEndWorld = endWorld;

        if (this.dragParticle) {
            this.dragParticle.setWorldPosition(endWorld);
        }

        if (pointForRaw) {
            this.addRawPoint(pointForRaw);
        }

        this.redrawPreview();
    }

    private catmullRom(
        p0: Vec3,
        p1: Vec3,
        p2: Vec3,
        p3: Vec3,
        t: number,
        out: Vec3
    ) {
        const t2 = t * t;
        const t3 = t2 * t;

        const x =
            0.5 *
            (2 * p1.x +
                (-p0.x + p2.x) * t +
                (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
                (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3);
        const y =
            0.5 *
            (2 * p1.y +
                (-p0.y + p2.y) * t +
                (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
                (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3);
        const z =
            0.5 *
            (2 * p1.z +
                (-p0.z + p2.z) * t +
                (2 * p0.z - 5 * p1.z + 4 * p2.z - p3.z) * t2 +
                (-p0.z + 3 * p1.z - 3 * p2.z + p3.z) * t3);

        out.set(x, y, z);
        return out;
    }

    private buildCatmullRomPoints(pts: Vec3[], samplesPerSeg = 4): Vec3[] {
        const res: Vec3[] = [];
        if (pts.length < 2) return pts.slice();

        const n = pts.length;
        const tmp = new Vec3();

        for (let i = 0; i < n - 1; i++) {
            const p0 = i === 0 ? pts[0] : pts[i - 1];
            const p1 = pts[i];
            const p2 = pts[i + 1];
            const p3 = i + 2 < n ? pts[i + 2] : pts[n - 1];

            for (let s = 0; s < samplesPerSeg; s++) {
                const t = s / samplesPerSeg;
                this.catmullRom(p0, p1, p2, p3, t, tmp);
                res.push(tmp.clone());
            }
        }
        res.push(pts[n - 1].clone());
        return res;
    }

    private redrawPreview() {
        if (!this.previewLineLayer) return;

        const g = this.previewLineLayer.getComponent(Graphics);
        const ui = this.previewLineLayer.getComponent(UITransform);
        if (!g || !ui) return;

        g.clear();

        if (this.rawPoints.length < 2) return;

        g.strokeColor.fromHEX('#00ffff');
        g.fillColor.fromHEX('#00ffff');

        const pts: Vec3[] = [];
        for (const p of this.rawPoints) {
            const world = new Vec3(p.x, p.y, p.z);
            const local = ui.convertToNodeSpaceAR(world);
            pts.push(local);
        }

        const smooth = this.buildCatmullRomPoints(pts, 4);
        if (smooth.length < 2) return;

        g.moveTo(smooth[0].x, smooth[0].y);
        for (let i = 1; i < smooth.length; i++) {
            g.lineTo(smooth[i].x, smooth[i].y);
        }
        g.stroke();

        const last = smooth[smooth.length - 1];
        g.circle(last.x, last.y, 6);
        g.fill();
    }

    private clearCommittedLines() {
        if (!this.lineLayer) return;
        const g = this.lineLayer.getComponent(Graphics);
        if (g) g.clear();
    }

    private redrawAllCommittedLines() {
        if (!this.lineLayer || this.committedPaths.length === 0) return;

        const g = this.lineLayer.getComponent(Graphics);
        const ui = this.lineLayer.getComponent(UITransform);
        if (!g || !ui) return;

        this.clearCommittedLines();
        g.strokeColor.fromHEX('#ffffff');

        for (const path of this.committedPaths) {
            this.drawCommittedPath(g, ui, path);
        }
    }

    private drawCommittedPath(g: Graphics, ui: UITransform, path: Shape) {
        if (!this.gridView || path.length < 2) return;

        const worldPts: Vec3[] = path.map((p) =>
            this.gridView!.gridToWorld(p.col, p.row)
        );

        const smooth = this.buildCatmullRomPoints(worldPts, 24);

        const localSmooth: Vec3[] = smooth.map((worldPt) => {
            const world = new Vec3(worldPt.x, worldPt.y, worldPt.z);
            return ui.convertToNodeSpaceAR(world);
        });

        if (localSmooth.length < 2) return;

        g.moveTo(localSmooth[0].x, localSmooth[0].y);
        for (let i = 1; i < localSmooth.length; i++) {
            g.lineTo(localSmooth[i].x, localSmooth[i].y);
        }
        g.stroke();
    }

    private shapeToSteps(shape: Shape): Step[] {
        const steps: Step[] = [];
        for (let i = 0; i < shape.length - 1; i++) {
            const a = shape[i];
            const b = shape[i + 1];
            steps.push({ dc: b.col - a.col, dr: b.row - a.row });
        }
        return steps;
    }

    private rotateStep90CW(s: Step): Step {
        return { dc: s.dr, dr: -s.dc };
    }

    private rotateSteps90CW(steps: Step[]): Step[] {
        return steps.map((s) => this.rotateStep90CW(s));
    }

    private stepsEqual(a: Step[], b: Step[]): boolean {
        if (a.length !== b.length) return false;
        for (let i = 0; i < a.length; i++) {
            if (a[i].dc !== b[i].dc || a[i].dr !== b[i].dr) return false;
        }
        return true;
    }

    private reverseSteps(steps: Step[]): Step[] {
        const rev: Step[] = [];
        for (let i = steps.length - 1; i >= 0; i--) {
            const s = steps[i];
            rev.push({ dc: -s.dc, dr: -s.dr });
        }
        return rev;
    }

    private stepsCyclicEqual(a: Step[], b: Step[]): boolean {
        if (a.length !== b.length) return false;
        const n = a.length;
        outer: for (let shift = 0; shift < n; shift++) {
            for (let i = 0; i < n; i++) {
                const j = (i + shift) % n;
                if (a[j].dc !== b[i].dc || a[j].dr !== b[i].dr) {
                    continue outer;
                }
            }
            return true;
        }
        return false;
    }

    private pathMatchesShape(allowed: PermittedShape, path: Shape): boolean {
        if (allowed.points.length !== path.length) return false;

        const baseAllowedSteps = this.shapeToSteps(allowed.points);
        const pathSteps = this.shapeToSteps(path);
        if (baseAllowedSteps.length !== pathSteps.length) return false;

        let rotated = baseAllowedSteps;

        for (let r = 0; r < 4; r++) {
            if (allowed.closed) {
                if (this.stepsCyclicEqual(rotated, pathSteps)) return true;
                const rev = this.reverseSteps(rotated);
                if (this.stepsCyclicEqual(rev, pathSteps)) return true;
            } else {
                if (this.stepsEqual(rotated, pathSteps)) return true;
                const rev = this.reverseSteps(rotated);
                if (this.stepsEqual(rev, pathSteps)) return true;
            }

            rotated = this.rotateSteps90CW(rotated);
        }

        return false;
    }

    private isCurrentPathPermitted(): boolean {
        let path: Shape = this.currentPath.map((p) => ({
            col: p.col,
            row: p.row,
        }));

        path = path.filter(
            (p, i) =>
                i === 0 ||
                p.col !== path[i - 1].col ||
                p.row !== path[i - 1].row
        );

        for (const allowed of PERMITTED_SHAPES) {
            if (this.pathMatchesShape(allowed, path)) {
                return true;
            }
        }
        return false;
    }

    private checkWinAndMaybeShowStars() {
        if (!this.gridView) return;

        const cfg = this.gridView.config;
        const totalSpecials = cfg.specialPoints.length;
        const covered = this.coveredSpecialKeys.size;

        if (totalSpecials > 0 && covered === totalSpecials) {
            const stars = this.computeStars();

            this.updateHUD();

            this.winLabel!.color = Color.WHITE;
        }
    }

    private commitLine(uiPos: Vec2) {
        if (!this.gridView || !this.lineLayer) {
            this.clearPreview();
            this.currentPath.length = 0;
            return;
        }

        const snapped = this.gridView.uiPosToGrid(uiPos);
        if (snapped) {
            const last = this.currentPath[this.currentPath.length - 1];
            if (!last || last.col !== snapped.col || last.row !== snapped.row) {
                this.currentPath.push(snapped);
            }
        }

        if (this.currentPath.length < 2) {
            this.clearPreview();
            this.currentPath.length = 0;
            return;
        }

        if (!this.isCurrentPathPermitted()) {
            this.clearPreview();
            this.currentPath.length = 0;

            if (this.dragParticle) {
                this.dragParticle.destroy();
                this.dragParticle = null;
            }
            return;
        }

        this.committedPaths.push([...this.currentPath]);

        this.registerCommittedShapeCoverage();
        this.checkWinAndMaybeShowStars();

        this.redrawAllCommittedLines();

        if (this.particleComittedPrefab && this.fxParent && this.gridView) {
            const samplesPerSegment = 5;

            for (let i = 0; i < this.currentPath.length - 1; i++) {
                const a = this.currentPath[i];
                const b = this.currentPath[i + 1];

                const aWorld = this.gridView.gridToWorld(a.col, a.row);
                const bWorld = this.gridView.gridToWorld(b.col, b.row);

                for (let s = 0; s <= samplesPerSegment; s++) {
                    const t = s / samplesPerSegment;

                    const x = aWorld.x + (bWorld.x - aWorld.x) * t;
                    const y = aWorld.y + (bWorld.y - aWorld.y) * t;
                    const z = aWorld.z + (bWorld.z - aWorld.z) * t;

                    const p = instantiate(this.particleComittedPrefab);
                    this.fxParent.addChild(p);
                    p.setWorldPosition(x, y, z);

                    this.scheduleOnce(() => {
                        if (p && p.isValid) p.destroy();
                    }, 1.0);
                }
            }
        }

        if (this.dragParticle) {
            this.dragParticle.destroy();
            this.dragParticle = null;
        }

        this.clearPreview();
        this.currentPath.length = 0;
    }

    private clearPreview() {
        if (!this.previewLineLayer) return;
        const g = this.previewLineLayer.getComponent(Graphics);
        if (!g) return;
        g.clear();
    }
}

import {
    _decorator,
    Component,
    Node,
    input,
    Input,
    Graphics,
    Camera,
    Vec2,
    Vec3,
    UITransform,
    EventTouch,
    EventMouse,
    sys,
    Color,
    Prefab,
    instantiate,

} from 'cc';
const { ccclass, property } = _decorator;

import { Grid } from './Grid';
import { ShapeValidator } from "./ShapeValidator";
import { GameCamera } from './GameCamera';

@ccclass('Drawing')
export class Drawing extends Component {
    @property(Camera)
    private camera: Camera = null;

    @property(Grid)
    private grid: Grid = null;

    @property(Graphics)
    private committedLinesGraphics: Graphics = null;


    @property(Node)
    private particlesParent: Node = null;

    @property(Prefab)
    private particlePrefab: Prefab = null;

    @property(Prefab)
    private commitedParticlePrefab: Prefab = null;

    @property
    private snapDistance: number = 20;


    private graphics: Graphics = null;
    private uiTransform: UITransform = null;
    private gameCamera: GameCamera = null;

    private points: Vec2[] = [];
    private isDrawing: boolean = false;
    private currentPosition: Vec2 | null = null;
    private dragParticle: Node | null = null;

    private committedPaths: Vec2[][] = [];

    start() {
        this.graphics = this.getComponent(Graphics);
        this.uiTransform = this.getComponent(UITransform);
        this.gameCamera = this.camera.getComponent(GameCamera);

        if (sys.isMobile) {
            input.on(Input.EventType.TOUCH_START, this.onTouchStart, this);
            input.on(Input.EventType.TOUCH_MOVE, this.onTouchMove, this);
            input.on(Input.EventType.TOUCH_END, this.onTouchEnd, this);
            input.on(Input.EventType.TOUCH_CANCEL, this.onTouchEnd, this);
        } else {
            input.on(Input.EventType.MOUSE_DOWN, this.onMouseDown, this);
            input.on(Input.EventType.MOUSE_MOVE, this.onMouseMove, this);
            input.on(Input.EventType.MOUSE_UP, this.onMouseUp, this);
        }
    }

    private onMouseDown(event: EventMouse) {
        if (event.getButton() !== 0) return;

        this.startDrawingAtScreenPos(event.getLocation());
    }

    private onMouseMove(event: EventMouse) {
        if (!this.isDrawing) return;

        this.updateDrawing(event.getLocation());
    }

    private onMouseUp(event: EventMouse) {
        if (event.getButton() !== 0) return;

        this.finishDrawing();
    }

    private onTouchStart(event: EventTouch) {
        const touches = event.getAllTouches();

        if (touches.length >= 2) return;

        if (this.gameCamera.isPinching) {
            this.cancelDrawing();
            return;
        }

        this.startDrawingAtScreenPos(event.getLocation());
    }

    private onTouchMove(event: EventTouch) {
        if (!this.isDrawing) return;

        if (this.gameCamera.isPinching) {
            this.cancelDrawing();
            return;
        }

        this.updateDrawing(event.getLocation());
    }

    private onTouchEnd(event: EventTouch) {
        this.finishDrawing();
    }

    private getLocalPosFromScreen(screenPos: Vec2): Vec2 {
        const worldPos = this.camera.screenToWorld(screenPos.toVec3());

        const localPos = this.uiTransform.convertToNodeSpaceAR(worldPos);

        return localPos.toVec2();
    }

    private startDrawingAtScreenPos(screenPos: Vec2) {
        const localPos = this.getLocalPosFromScreen(screenPos);
        const snappedPoint = this.grid.getNearestPoint(localPos);

        if (snappedPoint.distance <= this.snapDistance)
            this.points = [snappedPoint.position];

        this.isDrawing = true;
        this.currentPosition = localPos;

        this.drawAll();

        this.createDragParticle();
    }

    private updateDrawing(screenPos: Vec2) {
        const localPos = this.getLocalPosFromScreen(screenPos);
        const snappedPoint = this.grid.getNearestPoint(localPos);

        if (snappedPoint.distance <= this.snapDistance) {
            if (this.points.length === 0 || !this.points[this.points.length - 1].equals(snappedPoint.position)) {
                this.points.push(snappedPoint.position);
            }

            this.currentPosition = snappedPoint.position;
        } else {
            this.currentPosition = localPos;
        }

        this.drawAll();

        this.updateDragParticle();
    }

    private finishDrawing() {
        if (!this.isDrawing || !this.currentPosition) return;

        this.graphics.clear();

        this.deleteDragParticle();

        if (this.points.length > 1) {
            const shape = this.getShape();

            if (ShapeValidator.validateShape(shape)) {
                this.committedPaths.push(this.points);
                this.drawCommittedPaths();
                this.spawnParticlesOnPath(this.points);
            }
        }

        this.isDrawing = false;
        this.currentPosition = null;
        this.points = [];
    }

    private cancelDrawing() {
        this.graphics.clear();
        this.deleteDragParticle();
        this.isDrawing = false;
        this.currentPosition = null;
        this.points = [];
    }

    private drawAll() {
        this.graphics.clear();

        if (this.points.length > 1) {
            this.graphics.moveTo(this.points[0].x, this.points[0].y);

            for (let i = 1; i < this.points.length; i++) {
                this.graphics.lineTo(this.points[i].x, this.points[i].y);
            }

            this.graphics.stroke();
        }

        if (this.isDrawing && this.currentPosition && this.points.length > 0) {
            const lastPoint = this.points[this.points.length - 1];

            this.graphics.moveTo(lastPoint.x, lastPoint.y);
            this.graphics.lineTo(this.currentPosition.x, this.currentPosition.y);
            this.graphics.stroke();
        }

        const pointRadius = this.graphics.lineWidth * 1.18;

        if (this.currentPosition) {
            this.graphics.circle(this.currentPosition.x, this.currentPosition.y, pointRadius);
            this.graphics.fill();
        }
    }

    private createDragParticle() {
        const p = instantiate(this.particlePrefab);
        this.particlesParent.addChild(p);
        p.setPosition(this.currentPosition.toVec3());
        this.dragParticle = p;
    }

    private updateDragParticle() {
        this.dragParticle.setPosition(this.currentPosition.toVec3());
    }

    private deleteDragParticle() {
        this.dragParticle.destroy();
        this.dragParticle = null;
    }

    private spawnParticlesOnPath(path: Vec2[]) {
        const step = 30;

        for (let i = 0; i < path.length - 1; i++) {
            const start = path[i];
            const end = path[i + 1];

            const segment = new Vec2(end.x - start.x, end.y - start.y);
            const segmentLength = segment.length();

            if (segmentLength === 0) {
                continue;
            }

            const dir = segment.normalize();
            let travelled = 0;

            while (travelled <= segmentLength) {
                const pos = new Vec2(
                    start.x + dir.x * travelled,
                    start.y + dir.y * travelled
                );

                const particleNode = instantiate(this.commitedParticlePrefab);
                this.particlesParent.addChild(particleNode);
                particleNode.setPosition(new Vec3(pos.x, pos.y, 0));

                travelled += step;
            }
        }
    }


    public getShape(): Array<{ row: number, col: number }> {
        // TODO: Include points on edges that weren't snapped
        const shape = [];

        for (const point of this.points) {
            const gridPoint = this.grid.getPointAt(point);
            if (gridPoint) {
                shape.push({ row: gridPoint.row, col: gridPoint.col });
            }
        }

        return shape;
    }

    private drawCommittedPaths() {
        this.committedLinesGraphics.clear();

        for (const path of this.committedPaths) {
            if (path.length < 2) continue;

            this.committedLinesGraphics.moveTo(path[0].x, path[0].y);
            for (let i = 1; i < path.length; i++) {
                this.committedLinesGraphics.lineTo(path[i].x, path[i].y);
            }
            this.committedLinesGraphics.stroke();
        }
    }

    onDestroy() {
        input.off(Input.EventType.MOUSE_DOWN, this.onMouseDown, this);
        input.off(Input.EventType.MOUSE_MOVE, this.onMouseMove, this);
        input.off(Input.EventType.MOUSE_UP, this.onMouseUp, this);

        input.off(Input.EventType.TOUCH_START, this.onTouchStart, this);
        input.off(Input.EventType.TOUCH_MOVE, this.onTouchMove, this);
        input.off(Input.EventType.TOUCH_END, this.onTouchEnd, this);
        input.off(Input.EventType.TOUCH_CANCEL, this.onTouchEnd, this);
    }
}

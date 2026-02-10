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

@ccclass('Drawing')
export class Drawing extends Component {
    @property(Camera)
    private camera: Camera | null = null;

    @property(Grid)
    private grid: Grid | null = null;

    @property
    private snapDistance: number = 30;

    @property
    private lineWidth: number = 5;

    @property
    private pointColor: Color = new Color(255, 0, 0, 255);

    @property
    private lineColor: Color = new Color(0, 0, 255, 255);

    @property(Prefab)
    private particlePrefab: Prefab | null = null;

    private graphics: Graphics | null = null;
    private uiTransform: UITransform | null = null;

    private points: Vec2[] = [];
    private isDrawing: boolean = false;
    private currentPosition: Vec2 | null = null;
    private dragParticle: Node | null = null;

    start() {
        this.graphics = this.getComponent(Graphics);
        this.uiTransform = this.getComponent(UITransform);

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

        this.startDrawingAtScreenPos(event.getLocation());
    }

    private onTouchMove(event: EventTouch) {
        if (!this.isDrawing) return;

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
        const snappedPoint = this.grid.getGridPoint(localPos);

        if (!snappedPoint) return;

        if (snappedPoint!.dist <= this.snapDistance)
            this.points.push(snappedPoint.position);

        this.points = [snappedPoint.position];
        this.isDrawing = true;
        this.currentPosition = localPos;

        this.drawAll();

        this.createDragParticle();
    }

    private updateDrawing(screenPos: Vec2) {
        const localPos = this.getLocalPosFromScreen(screenPos);
        const snappedPoint = this.grid.getGridPoint(localPos);

        if (snappedPoint) {
            if (snappedPoint.dist <= this.snapDistance && !this.points[this.points.length - 1].equals(snappedPoint.position)) {
                this.points.push(snappedPoint.position);
            }
        }


        this.currentPosition = localPos;
        this.drawAll();

        this.updateDragParticle();

    }

    private finishDrawing() {
        if (!this.isDrawing || !this.currentPosition) return;

        this.isDrawing = false;
        this.currentPosition = null;
        this.drawAll();

        this.deleteDragParticle();
    }

    private drawAll() {
        this.graphics.clear();

        if (this.points.length > 1) {
            this.graphics.lineWidth = this.lineWidth;
            this.graphics.strokeColor = this.lineColor;

            this.graphics.moveTo(this.points[0].x, this.points[0].y);

            for (let i = 1; i < this.points.length; i++) {
                this.graphics.lineTo(this.points[i].x, this.points[i].y);
            }

            this.graphics.stroke();
        }

        if (this.isDrawing && this.currentPosition && this.points.length > 0) {
            const lastPoint = this.points[this.points.length - 1];

            this.graphics.lineWidth = this.lineWidth;

            this.graphics.moveTo(lastPoint.x, lastPoint.y);
            this.graphics.lineTo(this.currentPosition.x, this.currentPosition.y);
            this.graphics.stroke();
        }

        this.graphics.fillColor = this.pointColor;
        const pointRadius = this.lineWidth * 1.5;

        for (const point of this.points) {
            this.graphics.circle(point.x, point.y, pointRadius);
            this.graphics.fill();
        }

        if (this.currentPosition) {
            this.graphics.circle(this.currentPosition.x, this.currentPosition.y, pointRadius);
            this.graphics.fill();
        }
    }

    private createDragParticle() {
        const p = instantiate(this.particlePrefab);
        this.node.addChild(p);
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


    public clearDrawing() {
        this.points = [];
        this.isDrawing = false;
        this.currentPosition = null;
        if (this.graphics) {
            this.graphics.clear();
        }
    }

    public getDrawnPoints(): Array<{ col: number, row: number }> {
        const result = [];

        for (const point of this.points) {
            const gridPoint = this.grid.getGridPoint(point);
            if (gridPoint) {
                result.push({ col: gridPoint.col, row: gridPoint.row });
            }
        }

        return result;
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

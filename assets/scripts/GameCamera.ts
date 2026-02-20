import {
    _decorator,
    Component,
    Camera,
    input,
    Input,
    Vec2,
    Vec3,
    EventTouch,
    EventMouse,
    sys,
} from 'cc';
const { ccclass, property } = _decorator;

@ccclass('GameCamera')
export class GameCamera extends Component {
    private camera: Camera = null;

    @property
    private minZoom: number = 300;

    @property
    private maxZoom: number = 800;

    @property
    private zoomSpeed: number = 0.05;

    private initialZoom: number = 0;
    private isDragging: boolean = false;
    private lastMousePos: Vec3 = new Vec3();

    private pinchStartDist: number = 0;
    private pinchStartOrtho: number = 0;
    public isPinching: boolean = false;

    private lastPinchMidScreen: Vec2 = new Vec2();

    public get zoomFactor(): number {
        return this.camera.orthoHeight / this.initialZoom;
    }

    start() {
        this.camera = this.getComponent(Camera);
        this.initialZoom = this.camera.orthoHeight;

        if (sys.isMobile) {
            input.on(Input.EventType.TOUCH_START, this.onTouchStart, this);
            input.on(Input.EventType.TOUCH_MOVE, this.onTouchMove, this);
            input.on(Input.EventType.TOUCH_END, this.onTouchEnd, this);
            input.on(Input.EventType.TOUCH_CANCEL, this.onTouchEnd, this);
        } else {
            input.on(Input.EventType.MOUSE_WHEEL, this.onMouseWheel, this);
            input.on(Input.EventType.MOUSE_DOWN, this.onMouseDown, this);
            input.on(Input.EventType.MOUSE_MOVE, this.onMouseMove, this);
            input.on(Input.EventType.MOUSE_UP, this.onMouseUp, this);
        }
    }

    private clampZoom() {
        this.camera.orthoHeight = Math.max(
            this.minZoom,
            Math.min(this.camera.orthoHeight, this.maxZoom)
        );
    }

    private onMouseWheel(event: EventMouse) {
        const delta = event.getScrollY();
        this.camera.orthoHeight -= delta * this.zoomSpeed;
        this.clampZoom();
    }

    private onMouseDown(event: EventMouse) {
        if (event.getButton() !== 1) return;
        this.isDragging = true;
        const screenPos = event.getLocation();
        this.lastMousePos.set(screenPos.x, screenPos.y, 0);
    }

    private onMouseUp(event: EventMouse) {
        if (event.getButton() !== 1) return;
        this.isDragging = false;
    }

    private onMouseMove(event: EventMouse) {
        if (!this.isDragging) return;

        const screenPos = event.getLocation();
        const deltaX = screenPos.x - this.lastMousePos.x;
        const deltaY = screenPos.y - this.lastMousePos.y;

        this.lastMousePos.set(screenPos.x, screenPos.y, 0);

        const worldDelta = new Vec3(-deltaX, -deltaY, 0);
        worldDelta.multiplyScalar(this.zoomFactor);

        this.camera.node.position = this.camera.node.position.add(worldDelta);
    }

    private getTwoTouchesPositions(event: EventTouch): Vec2[] {
        const touches = event.getAllTouches();

        if (touches.length < 2) return [];

        const p1 = touches[0].getLocation();
        const p2 = touches[1].getLocation();
        return [p1, p2];
    }

    private distance(a: Vec2, b: Vec2): number {
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    private onTouchStart(event: EventTouch) {
        const touches = event.getAllTouches();

        if (touches.length === 2) {
            const [p1, p2] = this.getTwoTouchesPositions(event);

            this.pinchStartDist = this.distance(p1, p2);
            this.pinchStartOrtho = this.camera.orthoHeight;

            const midX = (p1.x + p2.x) * 0.5;
            const midY = (p1.y + p2.y) * 0.5;
            this.lastPinchMidScreen.set(midX, midY);

            this.isPinching = true;
        }
    }

    private onTouchMove(event: EventTouch) {
        if (!this.isPinching) return;

        const positions = this.getTwoTouchesPositions(event);
        if (positions.length < 2) return;

        const curDist = this.distance(positions[0], positions[1]);
        if (this.pinchStartDist <= 0) return;

        const scale = curDist / this.pinchStartDist;
        this.camera.orthoHeight = this.pinchStartOrtho / scale;
        this.clampZoom();

        const curMidX = (positions[0].x + positions[1].x) * 0.5;
        const curMidY = (positions[0].y + positions[1].y) * 0.5;

        const screenDeltaX = curMidX - this.lastPinchMidScreen.x;
        const screenDeltaY = curMidY - this.lastPinchMidScreen.y;

        const worldDelta = new Vec3(-screenDeltaX, -screenDeltaY, 0);
        worldDelta.multiplyScalar(this.zoomFactor);

        this.camera.node.position = this.camera.node.position.add(worldDelta);
        this.lastPinchMidScreen.set(curMidX, curMidY);
    }

    private onTouchEnd(event: EventTouch) {
        const touches = event.getAllTouches();

        if (touches.length < 2) {
            this.isPinching = false;
            this.pinchStartDist = 0;
        }
    }

    onDestroy() {
        input.off(Input.EventType.MOUSE_WHEEL, this.onMouseWheel, this);
        input.off(Input.EventType.MOUSE_DOWN, this.onMouseDown, this);
        input.off(Input.EventType.MOUSE_MOVE, this.onMouseMove, this);
        input.off(Input.EventType.MOUSE_UP, this.onMouseUp, this);

        input.off(Input.EventType.TOUCH_START, this.onTouchStart, this);
        input.off(Input.EventType.TOUCH_MOVE, this.onTouchMove, this);
        input.off(Input.EventType.TOUCH_END, this.onTouchEnd, this);
        input.off(Input.EventType.TOUCH_CANCEL, this.onTouchEnd, this);
    }
}

import { _decorator, Component, Label, Node, Widget, director } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('UI')
export class UI extends Component {

    @property(Label)
    public goalCountLabel: Label = null;

    @property(Label)
    public shapeCountLabel: Label = null;

    @property(Label)
    public starCountLabel: Label = null;

    @property(Widget)
    public winPanel: Widget = null;

    @property(Label)
    public winPanelStarCountLabel: Label = null;

    public threeStarsThreshold: number = 2;
    public twoStarsThreshold: number = 3;

    start() {
        //this.updateGoalLabel(0, 0);
        this.updateShapeLabel(0);
        this.updateStarLabel(3);
        this.winPanel.node.active = false;
    }

    public updateShapeLabel(shapeCount: number) {
        let starCount = 0;

        if (shapeCount <= this.threeStarsThreshold) {
            starCount = 3;
            this.shapeCountLabel.string = `Shapes: ${shapeCount} / ${this.threeStarsThreshold}`;
        } else if (shapeCount <= this.twoStarsThreshold) {
            starCount = 2;
            this.shapeCountLabel.string = `Shapes: ${shapeCount} / ${this.twoStarsThreshold}`;
        } else {
            starCount = 1;
            this.shapeCountLabel.string = `Shapes: ${shapeCount}`;
        }

        this.updateStarLabel(starCount);
    }

    public updateGoalLabel(claimed: number, total: number) {
        this.goalCountLabel.string = `Goals: ${claimed} / ${total}`;

        if (claimed === total) {
            this.winPanel.node.active = true;
        }
    }

    public updateStarLabel(starCount: number) {
        this.starCountLabel.string = '★'.repeat(starCount) + '☆'.repeat(3 - starCount);
        this.winPanelStarCountLabel.string = this.starCountLabel.string;
    }

    public reset() {
        const currentScene = director.getScene().name;

        director.loadScene(currentScene, () => {
        });
    }
}



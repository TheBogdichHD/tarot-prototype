interface Point {
    row: number;
    col: number;
}

type Shape = Array<Point>;

type PermittedShape = {
    isClosed: boolean;
    name: string;
    shape: Shape;
};

const PERMITTED_SHAPES: PermittedShape[] = [
    {
        isClosed: true,
        name: "Triangle",
        shape: [
            { row: 0, col: 0 },
            { row: 10, col: 0 },
            { row: 10, col: 10 },
            { row: 0, col: 0 },
        ]
    },
    {
        isClosed: true,
        name: "Rhombus",
        shape: [
            { row: 0, col: 7 },
            { row: 7, col: 0 },
            { row: 14, col: 7 },
            { row: 7, col: 14 },
            { row: 0, col: 7 },
        ]
    },
    {
        isClosed: false,
        name: "M-Shape",
        shape: [
            { row: 29, col: 0 },
            { row: 0, col: 0 },
            { row: 10, col: 10 },
            { row: 0, col: 20 },
            { row: 29, col: 20 },
        ]
    }
];

export class ShapeValidator {
    public static validateShape(shape: Shape): PermittedShape | null {
        const normalized = this.normalizeShape(shape);

        const templateShape = PERMITTED_SHAPES.find((permitted) => {
            if (permitted.shape.length > normalized.length) {
                return false;
            }
            const matched = this.hasValidShapeMatch(normalized, permitted);

            return matched;
        });

        return templateShape;
    }

    private static normalizeShape(shape: Shape): Shape {
        const minRow = Math.min(...shape.map(c => c.row));
        const minCol = Math.min(...shape.map(c => c.col));
        return shape.map(c => ({ row: c.row - minRow, col: c.col - minCol }));
    }

    private static hasValidShapeMatch(shape: Shape, template: PermittedShape): boolean {
        if (template.isClosed) {
            if (shape[0].row !== shape[shape.length - 1].row || shape[0].col !== shape[shape.length - 1].col) {
                return false;
            }

            for (let direction of [1, -1]) {
                const testShape = direction === 1 ? shape : [...shape].reverse();
                for (let shift = 0; shift < testShape.length - 1; shift++) {
                    const rotated = this.rotateShape(testShape, shift);

                    // const matched = this.hasTemplateVerticesInOrder(rotated, template.shape);
                    // const allOnPath = this.hasAllPointsOnEdges(rotated, template.shape);
                    // const validEdges = this.hasAllConsecutiveEdgesValid(rotated, template.shape);

                    // console.log(`Testing ${template.name} with shift ${shift} and direction ${direction === 1 ? "forward" : "reverse"}: matched=${matched}, allOnPath=${allOnPath}, validEdges=${validEdges}`);
                    // console.log("Template shape:", template.shape);
                    // console.log("Rotated shape:", rotated);

                    if (this.hasTemplateVerticesInOrder(rotated, template.shape) && this.hasAllPointsOnEdges(rotated, template.shape) && this.hasAllConsecutiveEdgesValid(rotated, template.shape)) {
                        return true;
                    }
                }
            }
            return false;
        } else {
            const forwardMatch = this.hasTemplateVerticesInOrder(shape, template.shape);
            const reverseMatch = this.hasTemplateVerticesInOrder(shape, [...template.shape].reverse());

            // const allOnPath = this.hasAllPointsOnEdges(shape, template.shape);
            // const validEdges = this.hasAllConsecutiveEdgesValid(shape, template.shape);

            // console.log(`Testing ${template.name} (open): forwardMatch=${forwardMatch}, reverseMatch=${reverseMatch}, allOnPath=${allOnPath}, validEdges=${validEdges}`);
            // console.log("Template shape:", template.shape);
            // console.log("Shape:", shape);

            return (forwardMatch || reverseMatch) && this.hasAllPointsOnEdges(shape, template.shape) && this.hasAllConsecutiveEdgesValid(shape, template.shape);
        }
    }

    private static hasTemplateVerticesInOrder(shape: Shape, template: Shape): boolean {
        let templateIndex = 0;

        for (let i = 0; i < shape.length; i++) {

            if (shape[i].row === template[templateIndex].row && shape[i].col === template[templateIndex].col) {
                templateIndex++;

                if (templateIndex === template.length) {
                    return true;
                }
            }

        }
        return false;
    }

    private static hasAllPointsOnEdges(shape: Shape, template: Shape): boolean {
        if (shape.length === template.length) {
            return true;
        }

        const getSegments = (points: Shape): [Point, Point][] => {
            const segments: [Point, Point][] = [];
            for (let i = 0; i < points.length - 1; i++) {
                segments.push([points[i], points[i + 1]]);
            }
            return segments;
        };

        for (const point of shape) {
            let onAnySegment = false;
            const segments = getSegments(template);

            for (const [start, end] of segments) {
                if (this.isPointOnSegment(start, end, point)) {
                    onAnySegment = true;
                    break;
                }
            }

            if (!onAnySegment) return false;
        }

        return true;
    }

    private static hasAllConsecutiveEdgesValid(shape: Shape, template: Shape): boolean {
        const getSegments = (points: Shape): [Point, Point][] => {
            const segments: [Point, Point][] = [];
            for (let i = 0; i < points.length - 1; i++) {
                segments.push([points[i], points[i + 1]]);
            }
            return segments;
        };

        const shapeSegments = getSegments(shape);
        const templateSegments = getSegments(template);

        for (const [sStart, sEnd] of shapeSegments) {
            let validEdge = false;

            for (const [tStart, tEnd] of templateSegments) {
                if (this.isPointOnSegment(tStart, tEnd, sStart) &&
                    this.isPointOnSegment(tStart, tEnd, sEnd)) {
                    validEdge = true;
                    break;
                }
            }

            if (!validEdge) {
                //console.log(`Invalid edge found: (${sStart.row},${sStart.col}) -> (${sEnd.row},${sEnd.col})`);
                return false;
            }
        }
        return true;
    }

    public static isPointOnSegment(start: Point, end: Point, point: Point): boolean {
        const sx = point.row - start.row;
        const sy = point.col - start.col;
        const ex = end.row - start.row;
        const ey = end.col - start.col;

        if (sx * ey !== sy * ex) return false;

        const dot = sx * ex + sy * ey;
        if (dot < 0) return false;

        const lenSq = ex * ex + ey * ey;
        return dot <= lenSq;
    }

    private static rotateShape(shape: Shape, shift: number): Shape {
        const withoutLast = shape.slice(0, -1);
        const rotated = [...withoutLast.slice(shift), ...withoutLast.slice(0, shift)];
        rotated.push(rotated[0]);
        return rotated;
    }
}

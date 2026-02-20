type Shape = Array<{ row: number; col: number }>;

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
    public static validateShape(shape: Shape): boolean {
        const normalized = this.normalizeShape(shape);
        console.log("Normalized shape:", normalized);

        return PERMITTED_SHAPES.some((permitted) => {
            const matched = this.shapeMatches(normalized, permitted);
            if (matched) console.log(`Matched permitted shape ${permitted.name}`);
            return matched;
        });
    }

    private static normalizeShape(shape: Shape): Shape {
        const minRow = Math.min(...shape.map(c => c.row));
        const minCol = Math.min(...shape.map(c => c.col));
        return shape.map(c => ({ row: c.row - minRow, col: c.col - minCol }));
    }

    private static shapeMatches(shape: Shape, template: PermittedShape): boolean {
        const normalizedTemplate = this.normalizeShape(template.shape);

        if (template.isClosed) {
            for (let direction of [1, -1]) {
                const testShape = direction === 1 ? shape : [...shape].reverse();
                for (let shift = 0; shift < testShape.length - 1; shift++) {
                    const rotated = this.rotateShape(testShape, shift);
                    if (this.sequenceMatchesStrict(rotated, normalizedTemplate) &&
                        this.allPointsOnEdgesStrict(rotated, normalizedTemplate)) {
                        return true;
                    }
                }
            }
            return false;
        } else {
            const forwardMatch = this.sequenceMatchesComplete(shape, normalizedTemplate);
            const reverseMatch = this.sequenceMatchesComplete(shape, [...normalizedTemplate].reverse());
            return (forwardMatch || reverseMatch) && this.allPointsOnPath(shape, normalizedTemplate);
        }
    }

    private static sequenceMatchesStrict(shape: Shape, template: Shape): boolean {
        let shapeIdx = 0;
        const keyPoints = template.slice(0, -1);

        for (const pt of keyPoints) {
            const found = shape.slice(shapeIdx).findIndex(s =>
                s.row === pt.row && s.col === pt.col
            );
            if (found === -1) return false;
            shapeIdx += found + 1;
        }
        return true;
    }

    private static sequenceMatchesComplete(shape: Shape, template: Shape): boolean {
        const keyPoints = template;

        let shapeIdx = 0;
        for (const pt of keyPoints) {
            const found = shape.slice(shapeIdx).findIndex(s =>
                s.row === pt.row && s.col === pt.col
            );
            if (found === -1) return false;
            shapeIdx += found + 1;
        }

        return shape[shape.length - 1].row === keyPoints[keyPoints.length - 1].row &&
            shape[shape.length - 1].col === keyPoints[keyPoints.length - 1].col;
    }

    private static allPointsOnEdgesStrict(shape: Shape, template: Shape): boolean {
        const poly = template.slice(0, -1);
        let currentEdge = 0;

        for (let i = 0; i < shape.length - 1; i++) {
            const p = shape[i];
            let onEdgeFound = false;

            for (let edgeIdx = currentEdge; edgeIdx < poly.length; edgeIdx++) {
                const a = poly[edgeIdx];
                const b = poly[(edgeIdx + 1) % poly.length];
                if (this.pointOnSegment(p, a, b)) {
                    currentEdge = edgeIdx;
                    onEdgeFound = true;
                    break;
                }
            }
            if (!onEdgeFound) return false;
        }
        return true;
    }

    private static allPointsOnPath(shape: Shape, template: Shape): boolean {
        return shape.every(p => {
            for (let i = 0; i < template.length - 1; i++) {
                if (this.pointOnSegment(p, template[i], template[i + 1])) {
                    return true;
                }
            }
            return false;
        });
    }

    private static pointOnSegment(
        p: { row: number; col: number },
        a: { row: number; col: number },
        b: { row: number; col: number }
    ): boolean {
        const cross = (p.col - a.col) * (b.row - a.row) - (p.row - a.row) * (b.col - a.col);
        if (cross !== 0) return false;

        const minX = Math.min(a.col, b.col);
        const maxX = Math.max(a.col, b.col);
        const minY = Math.min(a.row, b.row);
        const maxY = Math.max(a.row, b.row);

        return p.col >= minX && p.col <= maxX && p.row >= minY && p.row <= maxY;
    }

    private static rotateShape(shape: Shape, shift: number): Shape {
        const withoutLast = shape.slice(0, -1);
        const rotated = [...withoutLast.slice(shift), ...withoutLast.slice(0, shift)];
        rotated.push(rotated[0]);
        return rotated;
    }
}

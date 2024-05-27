import Linkable from '../../datastruct/Linkable';

export default class LocTemporary extends Linkable {
    // constructor
    readonly plane: number;
    readonly layer: number;
    x: number;
    z: number;
    locIndex: number;
    angle: number;
    shape: number;
    lastLocIndex: number;
    lastAngle: number;
    lastShape: number;
    delay: number = 0;
    duration: number = -1;

    constructor(plane: number, layer: number, x: number, z: number, locIndex: number, angle: number, shape: number, lastLocIndex: number, lastAngle: number, lastShape: number, delay?: number, duration?: number) {
        super();
        this.plane = plane;
        this.layer = layer;
        this.x = x;
        this.z = z;
        this.locIndex = locIndex;
        this.angle = angle;
        this.shape = shape;
        this.lastLocIndex = lastLocIndex;
        this.lastAngle = lastAngle;
        this.lastShape = lastShape;
        if (delay) {
            this.delay = delay;
        }
        if (duration) {
            this.duration = duration;
        }
    }
}

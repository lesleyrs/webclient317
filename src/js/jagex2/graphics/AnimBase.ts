import Packet from '../io/Packet';

export default class AnimBase {
    static readonly OP_BASE: number = 0;
    static readonly OP_TRANSLATE: number = 1;
    static readonly OP_ROTATE: number = 2;
    static readonly OP_SCALE: number = 3;
    static readonly OP_ALPHA: number = 5;

    public readonly types: Int32Array | null = null;
    public readonly labels: Int32Array[] | null = null;

    constructor(dat: Packet) {
        const length: number = dat.g1;
        this.types = new Int32Array(length);
        this.labels = new Array(length);

        for (let i: number = 0; i < length; i++) {
            this.types[i] = dat.g1;
        }

        for (let i: number = 0; i < length; i++) {
            const labelCount: number = dat.g1;
            this.labels[i] = new Int32Array(labelCount);

            for (let j: number = 0; j < labelCount; j++) {
                this.labels[i][j] = dat.g1;
            }
        }
    }
}

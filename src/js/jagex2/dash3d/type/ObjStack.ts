import Entity from '../entity/Entity';

export default class ObjStack {
    // constructor
    readonly y: number;
    readonly x: number;
    readonly z: number;
    readonly topObj: Entity | null;
    readonly middleObj: Entity | null;
    readonly bottomObj: Entity | null;
    readonly bitset: number;
    readonly offset: number;

    constructor(y: number, x: number, z: number, topObj: Entity | null, middleObj: Entity | null, bottomObj: Entity | null, bitset: number, offset: number) {
        this.y = y;
        this.x = x;
        this.z = z;
        this.topObj = topObj;
        this.middleObj = middleObj;
        this.bottomObj = bottomObj;
        this.bitset = bitset;
        this.offset = offset;
    }
}

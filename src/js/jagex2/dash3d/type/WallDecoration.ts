import Entity from '../entity/Entity';

export default class WallDecoration {
    // constructor
    readonly y: number;
    x: number;
    z: number;
    readonly type: number;
    readonly angle: number;
    entity: Entity;
    readonly bitset: number;
    readonly info: number; // byte

    constructor(y: number, x: number, z: number, type: number, angle: number, entity: Entity, bitset: number, info: number) {
        this.y = y;
        this.x = x;
        this.z = z;
        this.type = type;
        this.angle = angle;
        this.entity = entity;
        this.bitset = bitset;
        this.info = info;
    }
}

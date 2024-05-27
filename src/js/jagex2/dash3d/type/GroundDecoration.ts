import Entity from '../entity/Entity';

export default class GroundDecoration {
    // constructor
    readonly y: number;
    readonly x: number;
    readonly z: number;
    entity: Entity | null;
    readonly bitset: number;
    readonly info: number; // byte

    constructor(y: number, x: number, z: number, entity: Entity | null, bitset: number, info: number) {
        this.y = y;
        this.x = x;
        this.z = z;
        this.entity = entity;
        this.bitset = bitset;
        this.info = info;
    }
}

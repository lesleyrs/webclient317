import Entity from '../entity/Entity';

export default class Wall {
    // constructor
    readonly y: number;
    readonly x: number;
    readonly z: number;
    readonly typeA: number;
    readonly typeB: number;
    entityA: Entity | null;
    entityB: Entity | null;
    readonly bitset: number;
    readonly info: number; // byte

    constructor(y: number, x: number, z: number, typeA: number, typeB: number, entityA: Entity | null, entityB: Entity | null, bitset: number, info: number) {
        this.y = y;
        this.x = x;
        this.z = z;
        this.typeA = typeA;
        this.typeB = typeB;
        this.entityA = entityA;
        this.entityB = entityB;
        this.bitset = bitset;
        this.info = info;
    }
}

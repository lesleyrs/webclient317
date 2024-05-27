import Entity from './Entity';

export default class ObjStackEntity extends Entity {
    // constructor
    readonly index: number;
    count: number;

    constructor(index: number, count: number) {
        super();
        this.index = index;
        this.count = count;
    }
}

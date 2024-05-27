import Hashable from '../../datastruct/Hashable';
import Model, {VertexNormal} from '../../graphics/Model';

export default abstract class Entity extends Hashable {
    vertexNormal?: (VertexNormal | null)[] | null;
    minY: number = 1000;

    constructor() {
        super();
    }

    draw(yaw: number, sinEyePitch: number, cosEyePitch: number, sinEyeYaw: number, cosEyeYaw: number, relativeX: number, relativeY: number, relativeZ: number, bitset: number): void {
        const model: Model | null = this.getModel();

        if (model) {
            this.minY = model.minY;
            model.draw(yaw, sinEyePitch, cosEyePitch, sinEyeYaw, cosEyeYaw, relativeX, relativeY, relativeZ, bitset);
        }
    }

    getModel(): Model | null {
        return null;
    }
}

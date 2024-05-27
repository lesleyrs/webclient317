import Jagfile from '../io/Jagfile';
import AnimBase from './AnimBase';
import Packet from '../io/Packet';

export default class AnimFrame {
    static instances: AnimFrame[] = [];

    static unpack = (src: Uint8Array): void => {
        const offsets: Packet = new Packet(src);
        offsets.pos = src.length - 8;

        const head: Packet = new Packet(src);
        const tran1: Packet = new Packet(src);
        const tran2: Packet = new Packet(src);
        const del: Packet = new Packet(src);
        const skel: Packet = new Packet(src);

        let offset: number = 0;
        head.pos = offset;
        offset += offsets.g2 + 2;

        tran1.pos = offset;
        offset += offsets.g2;

        tran2.pos = offset;
        offset += offsets.g2;

        del.pos = offset;
        offset += offsets.g2;

        skel.pos = offset;

        const skeleton: AnimBase = new AnimBase(skel);

        const frameCount: number = head.g2;
        const bases: Int32Array = new Int32Array(500);
        const x: Int32Array = new Int32Array(500);
        const y: Int32Array = new Int32Array(500);
        const z: Int32Array = new Int32Array(500);

        for (let i: number = 0; i < frameCount; i++) {
            const frame: AnimFrame = (this.instances[head.g2] = new AnimFrame());
            frame.delay = del.g1;
            frame.skeleton = skeleton;

            const baseCount: number = head.g1;
            let lastBase: number = -1;
            let length: number = 0;

            for (let base: number = 0; base < baseCount; base++) {
                const flags: number = tran1.g1;

                if (flags <= 0) {
                    continue;
                }

                if (skeleton.types && skeleton.types[base] != AnimBase.OP_BASE) {
                    for (let cur: number = base - 1; cur > lastBase; cur--) {
                        if (skeleton.types[cur] == AnimBase.OP_BASE) {
                            bases[length] = cur;
                            x[length] = 0;
                            y[length] = 0;
                            z[length] = 0;
                            length++;
                            break;
                        }
                    }
                }
                bases[length] = base;

                let defaultValue: number = 0;

                if (skeleton.types && skeleton.types[base] == AnimBase.OP_SCALE) {
                    defaultValue = 128;
                }

                if ((flags & 1) != 0) {
                    x[length] = tran2.gsmart;
                } else {
                    x[length] = defaultValue;
                }

                if ((flags & 2) != 0) {
                    y[length] = tran2.gsmart;
                } else {
                    y[length] = defaultValue;
                }

                if ((flags & 4) != 0) {
                    z[length] = tran2.gsmart;
                } else {
                    z[length] = defaultValue;
                }

                lastBase = base;
                length++;
            }

            frame.length = length;
            frame.bases = new Int32Array(length);
            frame.x = new Int32Array(length);
            frame.y = new Int32Array(length);
            frame.z = new Int32Array(length);

            for (let j: number = 0; j < length; j++) {
                frame.bases[j] = bases[j];
                frame.x[j] = x[j];
                frame.y[j] = y[j];
                frame.z[j] = z[j];
            }
        }
    };

    // ----

    delay: number = 0;
    skeleton: AnimBase | null = null;
    length: number = 0;
    bases: Int32Array | null = null;
    x: Int32Array | null = null;
    y: Int32Array | null = null;
    z: Int32Array | null = null;
}

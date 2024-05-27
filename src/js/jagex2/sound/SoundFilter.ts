import Packet from '../io/Packet';
import {Int32Array2d, Int32Array3d} from '../util/Arrays';
import SoundEnvelope from './SoundEnvelope';

export default class SoundFilter {
    private static readonly coefficient: Int32Array2d = new Int32Array2d(2, 8);
    public static readonly coefficient16: Int32Array2d = new Int32Array2d(2, 8);
    private static unity: number;
    public static unity16: number;
    public readonly pairs: Int32Array = new Int32Array(2);
    private readonly frequencies: Int32Array3d = new Int32Array3d(2, 2, 4);
    private readonly ranges: Int32Array3d = new Int32Array3d(2, 2, 4);
    private readonly unities: Int32Array = new Int32Array(2);

    gain(direction: number, pair: number, delta: number): number {
        let g: number = this.ranges[direction][0][pair] + (delta * this.ranges[direction][1][pair] - this.ranges[direction][0][pair]);
        g *= 0.001525879;
        return 1 - Math.pow(10, -g / 20);
    }

    normalize(f: number): number {
        return (32.7032 * Math.pow(2, f) * 3.141593) / 11025;
    }

    phase(direction: number, pair: number, delta: number): number {
        let f1: number = this.frequencies[direction][0][pair] + (delta * this.frequencies[direction][1][pair] - this.frequencies[direction][0][pair]);
        f1 *= 0.0001220703;
        return this.normalize(f1);
    }

    evaluate(direction: number, delta: number): number {
        if (direction === 0) {
            let u: number = this.unities[0] + (this.unities[1] - this.unities[0]) * delta;
            u *= 0.003051758;
            SoundFilter.unity = Math.pow(0.10000000000000001, u / 20);
            SoundFilter.unity16 = SoundFilter.unity * 65536;
        }

        if (this.pairs[direction] == 0) {
            return 0;
        }

        const u: number = this.gain(direction, 0, delta);

        SoundFilter.coefficient[direction][0] = -2 * u * Math.cos(this.phase(direction, 0, delta));
        SoundFilter.coefficient[direction][1] = u * u;

        for (let pair: number = 1; pair < this.pairs[direction]; pair++) {
            const g: number = this.gain(direction, pair, delta);
            const a: number = -2 * g * Math.cos(this.phase(direction, pair, delta));
            const b: number = g * g;

            SoundFilter.coefficient[direction][pair * 2 + 1] = SoundFilter.coefficient[direction][pair * 2 - 1] * b;
            SoundFilter.coefficient[direction][pair * 2] = SoundFilter.coefficient[direction][pair * 2 - 1] * a + SoundFilter.coefficient[direction][pair * 2 - 2] * b;

            for (let j: number = pair * 2 - 1; j >= 2; j--) {
                SoundFilter.coefficient[direction][j] += SoundFilter.coefficient[direction][j - 1] * a + SoundFilter.coefficient[direction][j - 2] * b;
            }

            SoundFilter.coefficient[direction][1] += SoundFilter.coefficient[direction][0] * a + b;
            SoundFilter.coefficient[direction][0] += a;
        }

        if (direction == 0) {
            for (let l: number = 0; l < this.pairs[0] * 2; l++) {
                SoundFilter.coefficient[0][l] *= SoundFilter.unity;
            }
        }

        for (let pair: number = 0; pair < this.pairs[direction] * 2; pair++) {
            SoundFilter.coefficient16[direction][pair] = SoundFilter.coefficient[direction][pair] * 65536;
        }

        return this.pairs[direction] * 2;
    }

    read(dat: Packet, envelope: SoundEnvelope): void {
        const count: number = dat.g1;
        this.pairs[0] = count >> 4;
        this.pairs[1] = count & 0xf;

        if (count != 0) {
            this.unities[0] = dat.g2;
            this.unities[1] = dat.g2;

            const migration: number = dat.g1;

            for (let direction: number = 0; direction < 2; direction++) {
                for (let pair: number = 0; pair < this.pairs[direction]; pair++) {
                    this.frequencies[direction][0][pair] = dat.g2;
                    this.ranges[direction][0][pair] = dat.g2;
                }
            }

            for (let direction: number = 0; direction < 2; direction++) {
                for (let pair: number = 0; pair < this.pairs[direction]; pair++) {
                    if ((migration & ((1 << (direction * 4)) << pair)) !== 0) {
                        this.frequencies[direction][1][pair] = dat.g2;
                        this.ranges[direction][1][pair] = dat.g2;
                    } else {
                        this.frequencies[direction][1][pair] = this.frequencies[direction][0][pair];
                        this.ranges[direction][1][pair] = this.ranges[direction][0][pair];
                    }
                }
            }

            if (migration !== 0 || this.unities[1] !== this.unities[0]) {
                envelope.readShape(dat);
            }
        } else {
            this.unities[0] = this.unities[1] = 0;
        }
    }
}

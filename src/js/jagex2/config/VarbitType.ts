import Jagfile from '../io/Jagfile';
import {ConfigType} from './ConfigType';
import Packet from '../io/Packet';

export default class VarbitType extends ConfigType {
    static instances: VarbitType[] = [];

    static unpack = (config: Jagfile): void => {
        const dat: Packet = new Packet(config.read('varbit.dat'));
        const count: number = dat.g2;

        for (let i: number = 0; i < count; i++) {
            this.instances[i] = new VarbitType(i).decodeType(dat);
        }
        if (dat.pos !== dat.data.length) {
            console.log('varbit load mismatch');
        }
    };

    // ----

    varp: number = 0;
    lsb: number = 0;
    msb: number = 0;

    decode(code: number, dat: Packet): void {
        if (code === 1) {
            this.varp = dat.g2;
            this.lsb = dat.g1;
            this.msb = dat.g1;
        } else if (code === 10) {
            dat.gjstr;
        } else if (code === 3 || code === 4) {
            dat.g4;
        } else {
            console.log('Error unrecognised varbit config code: ', code);
        }
    }
}

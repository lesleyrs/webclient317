import Jagfile from '../io/Jagfile';
import {ConfigType} from './ConfigType';
import Packet from '../io/Packet';
import AnimFrame from '../graphics/AnimFrame';

export default class SeqType extends ConfigType {
    static count: number = 0;
    static instances: SeqType[] = [];

    static unpack = (config: Jagfile): void => {
        const dat: Packet = new Packet(config.read('seq.dat'));
        this.count = dat.g2;
        if (!this.instances) {
            this.instances = new Array(this.count);
        }

        for (let i: number = 0; i < this.count; i++) {
            const seq: SeqType = new SeqType(i).decodeType(dat);
            if (seq.frameCount === 0) {
                seq.frameCount = 1;

                seq.frames = new Int16Array(1);
                seq.frames[0] = -1;

                seq.iframes = new Int16Array(1);
                seq.iframes[0] = -1;

                seq.delay = new Int16Array(1);
                seq.delay[0] = -1;
            }
            if (seq.movestyle === -1) {
                if (seq.walkmerge) {
                    seq.movestyle = 2;
                } else {
                    seq.movestyle = 0;
                }
            }
            if (seq.idlestyle === -1) {
                if (seq.walkmerge) {
                    seq.idlestyle = 2;
                }
                seq.idlestyle = 0;
            }
            if (!SeqType.instances[i]) {
                this.instances[i] = seq;
            }
        }
    };

    // ----

    frameCount: number = 0;
    frames: Int16Array | null = null;
    iframes: Int16Array | null = null;
    delay: Int16Array | null = null;
    replayoff: number = -1;
    walkmerge: Int32Array | null = null;
    stretches: boolean = false;
    priority: number = 5;
    righthand: number = -1;
    lefthand: number = -1;
    replaycount: number = 99;
    movestyle: number = -1;
    idlestyle: number = -1;
    replaystyle: number = 2;
    duration: number = 0;

    decode(code: number, dat: Packet): void {
        if (code === 1) {
            this.frameCount = dat.g1;
            this.frames = new Int16Array(this.frameCount);
            this.iframes = new Int16Array(this.frameCount);
            this.delay = new Int16Array(this.frameCount);

            for (let i: number = 0; i < this.frameCount; i++) {
                this.frames[i] = dat.g2;
                this.iframes[i] = dat.g2;
                if (this.iframes[i] === 65535) {
                    this.iframes[i] = -1;
                }

                this.delay[i] = dat.g2;
            }
        } else if (code === 2) {
            this.replayoff = dat.g2;
        } else if (code === 3) {
            const count: number = dat.g1;
            this.walkmerge = new Int32Array(count + 1);

            for (let i: number = 0; i < count; i++) {
                this.walkmerge[i] = dat.g1;
            }

            this.walkmerge[count] = 9999999;
        } else if (code === 4) {
            this.stretches = true;
        } else if (code === 5) {
            this.priority = dat.g1;
        } else if (code === 6) {
            // later RS (think RS3) this becomes mainhand
            this.righthand = dat.g2;
        } else if (code === 7) {
            // later RS (think RS3) this becomes offhand
            this.lefthand = dat.g2;
        } else if (code === 8) {
            this.replaycount = dat.g1;
        } else if (code == 9) {
            this.movestyle = dat.g1;
        } else if (code == 10) {
            this.idlestyle = dat.g1;
        } else if (code == 11) {
            this.replaystyle = dat.g1;
        } else if (code == 12) {
            dat.g4;
        } else {
            console.log('Error unrecognised seq config code: ', code);
        }
    }

    getFrameDuration(frame: number): number {
        let duration: number = 0;
        if (this.delay) {
            duration = this.delay[frame];

            if (duration === 0 && this.frames) {
                const transform: AnimFrame = AnimFrame.instances[this.frames[frame]];
                if (transform && this.delay) {
                    duration = this.delay[frame] = transform.delay;
                }
            }

            if (duration === 0) {
                duration = 1;
            }
        }
        return duration;
    }
}

import SeqType from '../../config/SeqType';
import Model from '../../graphics/Model';
import LocType from '../../config/LocType';
import VarbitType from '../../config/VarbitType';
import Entity from './Entity';
import {Game} from '../../../game';

export default class LocEntity extends Entity {
    // constructor
    static game: Game;
    heightmapSW: number;
    readonly heightmapSE: number;
    readonly heightmapNE: number;
    readonly heightmapNW: number;
    readonly multivarbit: number;
    readonly multivarp: number;
    readonly index: number;
    readonly multiloc: Int32Array | null = null;
    readonly shape: number;
    readonly angle: number;
    seq: SeqType | null = null;
    seqFrame: number = 0;
    seqCycle: number = -0;

    constructor(index: number, shape: number, angle: number, heightmapSW: number, heightmapSE: number, heightmapNE: number, heightmapNW: number, anim: number, randomFrame: boolean) {
        super();
        this.index = index;
        this.shape = shape;
        this.angle = angle;
        this.heightmapSW = heightmapSW;
        this.heightmapSE = heightmapSE;
        this.heightmapNE = heightmapNE;
        this.heightmapNW = heightmapNW;

        if (anim !== -1) {
            this.seq = SeqType.instances[anim];
            this.seqFrame = 0;
            this.seqCycle = Game.loopCycle;

            if (randomFrame && this.seq.replayoff !== -1 && this.seq && this.seq.delay) {
                this.seqFrame = (Math.random() * this.seq.frameCount) | 0;
                this.seqCycle = (Math.random() * this.seq.delay[this.seqFrame]) | 0;
            } else {
                this.seqFrame = -1;
                this.seqCycle = 0;
            }
        }
        const type: LocType = LocType.get(this.index);
        this.multivarbit = type.multivarbit;
        this.multivarp = type.multivarp;
        this.multiloc = type.multiloc;
    }

    getModel(): Model | null {
        let transformId: number = -1;

        if (this.seq) {
            let delta: number = Game.loopCycle - this.seqCycle;

            if (delta > 100 && this.seq.replayoff > 0) {
                delta = 100;
            }

            while (delta > this.seq.getFrameDuration(this.seqFrame)) {
                delta -= this.seq.getFrameDuration(this.seqFrame);
                this.seqFrame++;

                if (this.seqFrame < this.seq.frameCount) {
                    continue;
                }

                this.seqFrame -= this.seq.replayoff;

                if (this.seqFrame >= 0 && this.seqFrame < this.seq.frameCount) {
                    continue;
                }

                this.seq = null;
                break;
            }
            this.seqCycle = Game.loopCycle - delta;

            if (this.seq && this.seq.frames) {
                transformId = this.seq.frames[this.seqFrame];
            }
        }

        let type: LocType | null;
        if (this.multiloc) {
            type = this.getMultiloc();
        } else {
            type = LocType.get(this.index);
        }

        if (!type) {
            return null;
        } else {
            return type.getModel(this.shape, this.angle, this.heightmapSW, this.heightmapSE, this.heightmapNE, this.heightmapNW, transformId);
        }
    }

    getMultiloc(): LocType | null {
        let value: number = -1;

        if (this.multivarbit !== -1) {
            const varbit: VarbitType = VarbitType.instances[this.multivarbit];
            const varp: number = varbit.varp;
            const low: number = varbit.lsb;
            const high: number = varbit.msb;
            const mask: number = Game.BITMASK[high - low];
            value = (LocEntity.game.varps[varp] >> low) & mask;
        } else if (this.multivarp !== -1) {
            value = LocEntity.game.varps[this.multivarp];
        }

        if (!this.multiloc) {
            return null;
        }

        if (value < 0 || value >= this.multiloc.length || this.multiloc[value] === -1) {
            return null;
        } else {
            return LocType.get(this.multiloc[value]);
        }
    }
}

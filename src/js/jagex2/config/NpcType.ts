import Jagfile from '../io/Jagfile';
import {ConfigType} from './ConfigType';
import Packet from '../io/Packet';
import LruCache from '../datastruct/LruCache';
import Model from '../graphics/Model';
import {TypedArray1d} from '../util/Arrays';
import {Client} from '../../client';
import VarbitType from './VarbitType';
import {Game} from '../../game';

export default class NpcType extends ConfigType {
    static count: number = 0;
    static cache: (NpcType | null)[] | null = null;
    static dat: Packet | null = null;
    static offsets: Int32Array | null = null;
    static cachePos: number = 0;
    static modelCache: LruCache | null = new LruCache(30);
    static game: Game;

    static unpack = (config: Jagfile): void => {
        this.dat = new Packet(config.read('npc.dat'));
        const idx: Packet = new Packet(config.read('npc.idx'));

        this.count = idx.g2;
        this.offsets = new Int32Array(this.count);

        let offset: number = 2;
        for (let id: number = 0; id < this.count; id++) {
            this.offsets[id] = offset;
            offset += idx.g2;
        }

        this.cache = new TypedArray1d(20, null);
        for (let id: number = 0; id < 20; id++) {
            this.cache[id] = new NpcType(-1);
        }
    };

    static get = (id: number): NpcType => {
        if (!this.cache || !this.offsets || !this.dat) {
            throw new Error('NpcType not loaded!!!');
        }

        for (let i: number = 0; i < 20; i++) {
            const type: NpcType | null = this.cache[i];
            if (!type) {
                continue;
            }
            if (type.id === id) {
                return type;
            }
        }

        this.cachePos = (this.cachePos + 1) % 20;
        const loc: NpcType = (this.cache[this.cachePos] = new NpcType(id));
        this.dat.pos = this.offsets[id];
        loc.decodeType(this.dat);
        return loc;
    };

    static unload = (): void => {
        this.modelCache = null;
        this.offsets = null;
        this.cache = null;
        this.dat = null;
    };

    // ----

    name: string | null = null;
    desc: string | null = null;
    size: number = 1;
    models: Uint16Array | null = null;
    heads: Uint16Array | null = null;
    readyanim: number = -1;
    walkanim: number = -1;
    walkanim_b: number = -1;
    walkanim_r: number = -1;
    walkanim_l: number = -1;
    recol_s: Uint16Array | null = null;
    recol_d: Uint16Array | null = null;
    op: (string | null)[] | null = null;
    minimap: boolean = true;
    vislevel: number = -1;
    resizeh: number = 128;
    resizev: number = 128;
    interactable: boolean = true;
    overrides: Uint32Array | null = null;
    varpID: number = -1;
    varbitID: number = -1;
    turnSpeed: number = 32;
    headicon: number = -1;
    lightAttenuation: number = 0;
    lightAmbient: number = 0;
    important: boolean = false;
    uid: bigint = -1n;

    decode(code: number, dat: Packet): void {
        if (code === 1) {
            const count: number = dat.g1;
            this.models = new Uint16Array(count);

            for (let i: number = 0; i < count; i++) {
                this.models[i] = dat.g2;
            }
        } else if (code === 2) {
            this.name = dat.gjstr;
        } else if (code === 3) {
            this.desc = dat.gjstr;
        } else if (code === 12) {
            this.size = dat.g1b;
        } else if (code === 13) {
            this.readyanim = dat.g2;
        } else if (code === 14) {
            this.walkanim = dat.g2;
        } else if (code === 17) {
            this.walkanim = dat.g2;
            this.walkanim_b = dat.g2;
            this.walkanim_r = dat.g2;
            this.walkanim_l = dat.g2;
        } else if (code >= 30 && code < 40) {
            if (!this.op) {
                this.op = new TypedArray1d(5, null);
            }

            this.op[code - 30] = dat.gjstr;
            if (this.op[code - 30]?.toLowerCase() === 'hidden') {
                this.op[code - 30] = null;
            }
        } else if (code === 40) {
            const count: number = dat.g1;
            this.recol_s = new Uint16Array(count);
            this.recol_d = new Uint16Array(count);

            for (let i: number = 0; i < count; i++) {
                this.recol_s[i] = dat.g2;
                this.recol_d[i] = dat.g2;
            }
        } else if (code === 60) {
            const count: number = dat.g1;
            this.heads = new Uint16Array(count);

            for (let i: number = 0; i < count; i++) {
                this.heads[i] = dat.g2;
            }
        } else if (code === 90 || code === 91 || code === 92) {
            dat.g2;
        } else if (code === 93) {
            this.minimap = false;
        } else if (code === 95) {
            this.vislevel = dat.g2;
        } else if (code === 97) {
            this.resizeh = dat.g2;
        } else if (code === 98) {
            this.resizev = dat.g2;
        } else if (code === 99) {
            this.important = true;
        } else if (code === 100) {
            this.lightAmbient = dat.g1b;
        } else if (code === 101) {
            this.lightAttenuation = dat.g1b * 5;
        } else if (code === 102) {
            this.headicon = dat.g2;
        } else if (code === 103) {
            this.turnSpeed = dat.g2;
        } else if (code === 106) {
            this.varbitID = dat.g2;

            if (this.varbitID === 65535) {
                this.varbitID = -1;
            }

            this.varpID = dat.g2;

            if (this.varpID === 65535) {
                this.varpID = -1;
            }

            const overrideCount: number = dat.g1;
            this.overrides = new Uint32Array(overrideCount + 1);
            for (let i: number = 0; i <= overrideCount; i++) {
                this.overrides[i] = dat.g2;

                if (this.overrides[i] == 65535) {
                    this.overrides[i] = -1;
                }
            }
        } else if (code == 107) {
            this.interactable = false;
        }
    }

    getSequencedModel(primaryTransformId: number, secondaryTransformId: number, seqMask: Int32Array | null): Model | null {
        if (this.overrides) {
            const override: NpcType | null = this.getOverrideType();
            if (!override) {
                return null;
            } else {
                return override.getSequencedModel(secondaryTransformId, primaryTransformId, seqMask);
            }
        }

        let tmp: Model | null = null;
        let model: Model | null = null;
        if (NpcType.modelCache) {
            model = NpcType.modelCache.get(BigInt(this.id)) as Model | null;

            if (!model && this.models) {
                const models: (Model | null)[] = new TypedArray1d(this.models.length, null);
                for (let i: number = 0; i < this.models.length; i++) {
                    const data: Uint8Array | Jagfile | null = Client.jagStore[1].read(this.models[i]);
                    models[i] = Model.model(data as Uint8Array, this.models[i]);
                }

                if (models.length === 1) {
                    model = models[0];
                } else {
                    model = Model.modelFromModels(models, models.length);
                }

                if (this.recol_s && this.recol_d) {
                    for (let i: number = 0; i < this.recol_s.length; i++) {
                        model?.recolor(this.recol_s[i], this.recol_d[i]);
                    }
                }

                model?.createLabelReferences();
                model?.calculateNormals(64 + this.lightAmbient, 850 + this.lightAttenuation, -30, -50, -30, true);
                if (model) {
                    NpcType.modelCache.put(BigInt(this.id), model);
                }
            }
        }

        if (model) {
            tmp = Model.modelShareAlpha(model, primaryTransformId === -1 && secondaryTransformId === -1);
            if (primaryTransformId !== -1 && secondaryTransformId !== -1) {
                tmp.applyTransforms(primaryTransformId, secondaryTransformId, seqMask);
            } else if (primaryTransformId !== -1) {
                tmp.applyTransform(primaryTransformId);
            }

            if (this.resizeh !== 128 || this.resizev !== 128) {
                tmp.scale(this.resizeh, this.resizev, this.resizeh);
            }

            tmp.calculateBoundsCylinder();
            tmp.labelFaces = null;
            tmp.labelVertices = null;

            if (this.size === 1) {
                tmp.pickable = true;
            }
            return tmp;
        }

        return null;
    }

    getHeadModel(): Model | null {
        if (this.overrides) {
            const type: NpcType | null = this.getOverrideType();
            if (!type) {
                return null;
            } else {
                return type.getHeadModel();
            }
        }

        if (!this.heads) {
            return null;
        }

        // TODO: validate stuff

        const models: (Model | null)[] = new TypedArray1d(this.heads.length, null);
        for (let i: number = 0; i < this.heads.length; i++) {
            const data: Uint8Array | Jagfile | null = Client.jagStore[1].read(this.heads[i]);
            models[i] = Model.model(data as Uint8Array, this.heads[i]);
        }

        let model: Model | null;
        if (models.length === 1) {
            model = models[0];
        } else {
            model = Model.modelFromModels(models, models.length);
        }

        if (this.recol_s && this.recol_d) {
            for (let i: number = 0; i < this.recol_s.length; i++) {
                model?.recolor(this.recol_s[i], this.recol_d[i]);
            }
        }

        return model;
    }

    getOverrideType(): NpcType | null {
        let value: number = -1;

        if (this.varbitID !== -1) {
            const vb: VarbitType = VarbitType.instances[this.varbitID];
            const varp: number = vb.varp;
            const lsb: number = vb.lsb;
            const msb: number = vb.msb;
            const mask: number = Client.BITMASK[msb - lsb];
            value = (NpcType.game.varps[varp] >> lsb) & mask;
        } else if (this.varpID !== -1) {
            value = NpcType.game.varps[this.varpID];
        }

        if (!this.overrides || value < 0 || value >= this.overrides.length || this.overrides[value] === -1) {
            return null;
        } else {
            return NpcType.get(this.overrides[value]);
        }
    }
}

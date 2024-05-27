import CollisionMap from './CollisionMap';
import FloType from '../config/FloType';
import Packet from '../io/Packet';
import Draw3D from '../graphics/Draw3D';
import World3D from './World3D';
import LocType from '../config/LocType';
import Model from '../graphics/Model';
import LocEntity from './entity/LocEntity';
import LocShape from './LocShape';
import LocAngle from './LocAngle';
import Colors from '../graphics/Colors';
import TileOverlayShape from './type/TileOverlayShape';
import {Int32Array2d, Int32Array3d, Uint8Array3d} from '../util/Arrays';
import {Client} from '../../client';
import CollisionFlag from './CollisionFlag';
import Entity from './entity/Entity';

// noinspection JSSuspiciousNameCombination,DuplicatedCode
export default class World {
    static readonly ROTATION_WALL_TYPE: Int8Array = Int8Array.of(1, 2, 4, 8);
    static readonly ROTATION_WALL_CORNER_TYPE: Uint8Array = Uint8Array.of(16, 32, 64, 128);
    static readonly WALL_DECORATION_ROTATION_FORWARD_X: Int8Array = Int8Array.of(1, 0, -1, 0);
    static readonly WALL_DECORATION_ROTATION_FORWARD_Z: Int8Array = Int8Array.of(0, -1, 0, 1);

    static randomHueOffset: number = ((Math.random() * 17.0) | 0) - 8;
    static randomLightnessOffset: number = ((Math.random() * 33.0) | 0) - 16;

    static lowMemory: boolean = true;
    static levelBuilt: number = 0;
    static fullbright: boolean = false;
    static minLevel: number = 99;

    static perlin = (x: number, z: number): number => {
        let value: number = this.perlinScale(x + 45365, z + 91923, 4) + ((this.perlinScale(x + 10294, z + 37821, 2) - 128) >> 1) + ((this.perlinScale(x, z, 1) - 128) >> 2) - 128;
        value = ((value * 0.3) | 0) + 35;
        if (value < 10) {
            value = 10;
        } else if (value > 60) {
            value = 60;
        }
        return value;
    };

    static perlinScale = (x: number, z: number, scale: number): number => {
        const intX: number = (x / scale) | 0;
        const fracX: number = x & (scale - 1);
        const intZ: number = (z / scale) | 0;
        const fracZ: number = z & (scale - 1);
        const v1: number = this.smoothNoise(intX, intZ);
        const v2: number = this.smoothNoise(intX + 1, intZ);
        const v3: number = this.smoothNoise(intX, intZ + 1);
        const v4: number = this.smoothNoise(intX + 1, intZ + 1);
        const i1: number = this.interpolate(v1, v2, fracX, scale);
        const i2: number = this.interpolate(v3, v4, fracX, scale);
        return this.interpolate(i1, i2, fracZ, scale);
    };

    static interpolate = (a: number, b: number, x: number, scale: number): number => {
        const f: number = (65536 - Draw3D.cos[((x * 1024) / scale) | 0]) >> 1;
        return ((a * (65536 - f)) >> 16) + ((b * f) >> 16);
    };

    static smoothNoise = (x: number, y: number): number => {
        const corners: number = this.noise(x - 1, y - 1) + this.noise(x + 1, y - 1) + this.noise(x - 1, y + 1) + this.noise(x + 1, y + 1);
        const sides: number = this.noise(x - 1, y) + this.noise(x + 1, y) + this.noise(x, y - 1) + this.noise(x, y + 1);
        const center: number = this.noise(x, y);
        return ((corners / 16) | 0) + ((sides / 8) | 0) + ((center / 4) | 0);
    };

    static noise = (x: number, y: number): number => {
        const n: number = x + y * 57;
        const n1: bigint = BigInt((n << 13) ^ n);
        return Number(((n1 * (n1 * n1 * 15731n + 789221n) + 1376312589n) & 0x7fffffffn) >> 19n) & 0xff;
    };

    static addLoc = (level: number, x: number, z: number, scene: World3D | null, levelHeightmap: Int32Array[][], collision: CollisionMap | null, locId: number, shape: number, angle: number, trueLevel: number): void => {
        let heightSW: number = levelHeightmap[trueLevel][x][z];
        let heightSE: number = levelHeightmap[trueLevel][x + 1][z];
        let heightNW: number = levelHeightmap[trueLevel][x][z + 1];
        let heightNE: number = levelHeightmap[trueLevel][x + 1][z + 1];
        const y: number = (heightSW + heightSE + heightNW + heightNE) >> 2;

        const loc: LocType = LocType.get(locId);

        let bitset: number = (x + (z << 7) + (locId << 14) + 0x40000000) | 0;
        if (!loc.active) {
            bitset += -0x80000000; // int.min
        }
        bitset |= 0;

        const info: number = ((((angle << 6) + shape) | 0) << 24) >> 24;

        if (shape === LocShape.GROUND_DECOR.id) {
            let entity: Entity | null;

            if (loc.anim === -1 && !loc.multiloc) {
                entity = loc.getModel(LocShape.GROUND_DECOR.id, angle, heightSW, heightSE, heightNE, heightNW, -1);
            } else {
                entity = new LocEntity(locId, angle, LocShape.GROUND_DECOR.id, heightSW, heightSE, heightNE, heightNW, loc.anim, true);
            }

            scene?.addGroundDecoration(entity, level, x, z, y, bitset, info);

            if (loc.blockwalk && loc.active) {
                collision?.addFloor(x, z);
            }
        } else if (shape === LocShape.CENTREPIECE_STRAIGHT.id || shape === LocShape.CENTREPIECE_DIAGONAL.id) {
            let entity: Entity | null;
            if (loc.anim === -1 && !loc.multiloc) {
                entity = loc.getModel(LocShape.CENTREPIECE_STRAIGHT.id, angle, heightSW, heightSE, heightNE, heightNW, -1);
            } else {
                entity = new LocEntity(locId, LocShape.CENTREPIECE_STRAIGHT.id, angle, heightSW, heightSE, heightNE, heightNW, loc.anim, true);
            }

            if (entity) {
                let yaw: number = 0;
                if (shape === LocShape.CENTREPIECE_DIAGONAL.id) {
                    yaw += 256;
                }

                let width: number;
                let height: number;
                if (angle === LocAngle.NORTH || angle === LocAngle.SOUTH) {
                    width = loc.length;
                    height = loc.width;
                } else {
                    width = loc.width;
                    height = loc.length;
                }

                scene?.addLoc(level, x, z, y, entity, bitset, info, width, height, yaw);
            }

            if (loc.blockwalk) {
                collision?.addLoc(x, z, loc.width, loc.length, angle, loc.blockrange);
            }
        } else if (shape >= LocShape.ROOF_STRAIGHT.id) {
            let entity: Entity | null;

            if (loc.anim === -1 && !loc.multiloc) {
                entity = loc.getModel(LocShape.ROOF_STRAIGHT.id, angle, heightSW, heightSE, heightNE, heightNW, -1);
            } else {
                entity = new LocEntity(locId, shape, angle, heightSW, heightSE, heightNE, heightNW, loc.anim, true);
            }

            scene?.addLoc(level, x, z, y, entity, bitset, info, 1, 1, 0);

            if (loc.blockwalk) {
                collision?.addLoc(x, z, loc.width, loc.length, angle, loc.blockrange);
            }
        } else if (shape === LocShape.WALL_STRAIGHT.id) {
            let entity: Entity | null;

            if (loc.anim === -1 && !loc.multiloc) {
                entity = loc.getModel(LocShape.WALL_STRAIGHT.id, angle, heightSW, heightSE, heightNE, heightNW, -1);
            } else {
                entity = new LocEntity(locId, shape, angle, heightSW, heightSE, heightNE, heightNW, loc.anim, true);
            }

            scene?.addWall(level, x, z, y, World.ROTATION_WALL_TYPE[angle], 0, entity, null, bitset, info);

            if (loc.blockwalk) {
                collision?.addWall(x, z, shape, angle, loc.blockrange);
            }
        } else if (shape === LocShape.WALL_DIAGONAL_CORNER.id) {
            let entity: Entity | null;

            if (loc.anim === -1 && !loc.multiloc) {
                entity = loc.getModel(LocShape.WALL_DIAGONAL_CORNER.id, angle, heightSW, heightSE, heightNE, heightNW, -1);
            } else {
                entity = new LocEntity(locId, shape, angle, heightSW, heightSE, heightNE, heightNW, loc.anim, true);
            }

            scene?.addWall(level, x, z, y, World.ROTATION_WALL_CORNER_TYPE[angle], 0, entity, null, bitset, info);

            if (loc.blockwalk) {
                collision?.addWall(x, z, shape, angle, loc.blockrange);
            }
        } else if (shape === LocShape.WALL_L.id) {
            const offset: number = (angle + 1) & 0x3;
            let locA: Entity | null;
            let locB: Entity | null;

            if (loc.anim === -1 && !loc.multiloc) {
                locA = loc.getModel(LocShape.WALL_L.id, angle + 4, heightSW, heightSE, heightNE, heightNW, -1);
                locB = loc.getModel(LocShape.WALL_L.id, offset, heightSW, heightSE, heightNE, heightNW, -1);
            } else {
                locA = new LocEntity(locId, shape, angle + 4, heightSW, heightSE, heightNE, heightNW, loc.anim, true);
                locB = new LocEntity(locId, shape, angle, heightSW, heightSE, heightNE, heightNW, loc.anim, true);
            }

            scene?.addWall(level, x, z, y, World.ROTATION_WALL_TYPE[angle], World.ROTATION_WALL_TYPE[offset], locA, locB, bitset, info);

            if (loc.blockwalk) {
                collision?.addWall(x, z, shape, angle, loc.blockrange);
            }
        } else if (shape === LocShape.WALL_SQUARE_CORNER.id) {
            let entity: Entity | null;
            if (loc.anim === -1 && !loc.multiloc) {
                entity = loc.getModel(LocShape.WALL_SQUARE_CORNER.id, angle, heightSW, heightSE, heightNE, heightNW, -1);
            } else {
                entity = new LocEntity(locId, shape, angle, heightSW, heightSE, heightNE, heightNW, loc.anim, true);
            }

            scene?.addWall(level, x, z, y, World.ROTATION_WALL_CORNER_TYPE[angle], 0, entity, null, bitset, info);

            if (loc.blockwalk) {
                collision?.addWall(x, z, shape, angle, loc.blockrange);
            }
        } else if (shape === LocShape.WALL_DIAGONAL.id) {
            let entity: Entity | null;
            if (loc.anim === -1 && !loc.multiloc) {
                entity = loc.getModel(LocShape.WALL_DIAGONAL.id, angle, heightSW, heightSE, heightNE, heightNW, -1);
            } else {
                entity = new LocEntity(locId, shape, angle, heightSW, heightSE, heightNE, heightNW, loc.anim, true);
            }

            scene?.addLoc(level, x, z, y, entity, bitset, info, 1, 1, 0);

            if (loc.blockwalk) {
                collision?.addLoc(x, z, loc.width, loc.length, angle, loc.blockrange);
            }
        } else {
            if (loc.hillskew) {
                if (angle === 1) {
                    const tmp: number = heightNW;
                    heightNW = heightNE;
                    heightNE = heightSE;
                    heightSE = heightSW;
                    heightSW = tmp;
                } else if (angle === 2) {
                    let tmp: number = heightNW;
                    heightNW = heightSE;
                    heightSE = tmp;
                    tmp = heightNE;
                    heightNE = heightSW;
                    heightSW = tmp;
                } else if (angle === 3) {
                    const tmp: number = heightNW;
                    heightNW = heightSW;
                    heightSW = heightSE;
                    heightSE = heightNE;
                    heightNE = tmp;
                }
            }

            if (shape === LocShape.WALLDECOR_STRAIGHT_NOOFFSET.id) {
                let entity: Entity | null;
                if (loc.anim === -1 && !loc.multiloc) {
                    entity = loc.getModel(LocShape.WALLDECOR_STRAIGHT_NOOFFSET.id, LocAngle.WEST, heightSW, heightSE, heightNE, heightNW, -1);
                } else {
                    entity = new LocEntity(locId, shape, angle, heightSW, heightSE, heightNE, heightNW, loc.anim, true);
                }

                scene?.setWallDecoration(level, x, z, y, 0, 0, bitset, entity, info, angle * 512, World.ROTATION_WALL_TYPE[angle]);
            } else if (shape === LocShape.WALLDECOR_STRAIGHT_OFFSET.id) {
                let offset: number = 16;
                if (scene) {
                    const width: number = scene.getWallBitset(level, x, z);
                    if (width > 0) {
                        offset = LocType.get((width >> 14) & 0x7fff).wallwidth;
                    }
                }

                let entity: Entity | null;
                if (loc.anim === -1 && !loc.multiloc) {
                    entity = loc.getModel(LocShape.WALLDECOR_STRAIGHT_NOOFFSET.id, LocAngle.WEST, heightSW, heightSE, heightNE, heightNW, -1);
                } else {
                    entity = new LocEntity(locId, shape, angle, heightSW, heightSE, heightNE, heightNW, loc.anim, true);
                }

                scene?.setWallDecoration(level, x, z, y, World.WALL_DECORATION_ROTATION_FORWARD_X[angle] * offset, World.WALL_DECORATION_ROTATION_FORWARD_Z[angle] * offset, bitset, entity, info, angle * 512, World.ROTATION_WALL_TYPE[angle]);
            } else if (shape === LocShape.WALLDECOR_DIAGONAL_OFFSET.id) {
                let entity: Entity | null;
                if (loc.anim === -1 && !loc.multiloc) {
                    entity = loc.getModel(LocShape.WALLDECOR_STRAIGHT_NOOFFSET.id, LocAngle.WEST, heightSW, heightSE, heightNE, heightNW, -1);
                } else {
                    entity = new LocEntity(locId, shape, angle, heightSW, heightSE, heightNE, heightNW, loc.anim, true);
                }

                scene?.setWallDecoration(level, x, z, y, 0, 0, bitset, entity, info, angle, 256);
            } else if (shape === LocShape.WALLDECOR_DIAGONAL_NOOFFSET.id) {
                let entity: Entity | null;
                if (loc.anim === -1 && !loc.multiloc) {
                    entity = loc.getModel(LocShape.WALLDECOR_STRAIGHT_NOOFFSET.id, LocAngle.WEST, heightSW, heightSE, heightNE, heightNW, -1);
                } else {
                    entity = new LocEntity(locId, shape, angle, heightSW, heightSE, heightNE, heightNW, loc.anim, true);
                }

                scene?.setWallDecoration(level, x, z, y, 0, 0, bitset, entity, info, angle, 512);
            } else if (shape === LocShape.WALLDECOR_DIAGONAL_BOTH.id) {
                let entity: Entity | null;
                if (loc.anim === -1 && !loc.multiloc) {
                    entity = loc.getModel(LocShape.WALLDECOR_STRAIGHT_NOOFFSET.id, LocAngle.WEST, heightSW, heightSE, heightNE, heightNW, -1);
                } else {
                    entity = new LocEntity(locId, shape, angle, heightSW, heightSE, heightNE, heightNW, loc.anim, true);
                }

                scene?.setWallDecoration(level, x, z, y, 0, 0, bitset, entity, info, angle, 768);
            }
        }
    };

    public readTiles = (data: Int8Array, offsetZ: number, offsetX: number, originX: number, originZ: number, collisionMaps: (CollisionMap | null)[]): void => {
        for (let level: number = 0; level < 4; level++) {
            for (let x: number = 0; x < 64; x++) {
                for (let z: number = 0; z < 64; z++) {
                    if (offsetX + x > 0 && offsetX + x < CollisionMap.SIZE - 1 && offsetZ + z > 0 && offsetZ + z < CollisionMap.SIZE - 1) {
                        if (collisionMaps) {
                            collisionMaps[level]!.flags[CollisionMap.index(offsetX + x, offsetZ + z)] &= ~CollisionFlag.FLAG_UNINITIALIZED;
                        }
                    }
                }
            }
        }

        const buf: Packet = new Packet(data);
        for (let level: number = 0; level < 4; level++) {
            for (let x: number = 0; x < 64; x++) {
                for (let z: number = 0; z < 64; z++) {
                    this.readTiles2(buf, originX, originZ, level, x + offsetX, z + offsetZ, 0);
                }
            }
        }
    };

    private readTiles2 = (buf: Packet, originX: number, originZ: number, level: number, x: number, z: number, mapRotation: number): void => {
        if (x >= 0 && x < CollisionMap.SIZE && z >= 0 && z < CollisionMap.SIZE) {
            this.levelTileFlags[level][x][z] = 0;

            for (;;) {
                const type: number = buf.g1;

                if (type === 0) {
                    if (level === 0) {
                        this.levelHeightmap[0][x][z] = -World.perlin(932731 + x + originX, 556238 + z + originZ) * 8;
                    } else {
                        this.levelHeightmap[level][x][z] = this.levelHeightmap[level - 1][x][z] - 240;
                        break;
                    }
                    break;
                }

                if (type === 1) {
                    let height: number = buf.g1;

                    if (height === 1) {
                        height = 0;
                    }

                    if (level === 0) {
                        this.levelHeightmap[0][x][z] = -height * 8;
                    } else {
                        this.levelHeightmap[level][x][z] = this.levelHeightmap[level - 1][x][z] - height * 8;
                        break;
                    }
                    break;
                }

                if (type <= 49) {
                    this.levelTileOverlayIds[level][x][z] = buf.g1b;
                    this.levelTileOverlayShape[level][x][z] = (type - 2) / 4;
                    this.levelTileOverlayRotation[level][x][z] = (type - 2 + mapRotation) & 0x3;
                } else if (type <= 81) {
                    this.levelTileFlags[level][x][z] = type - 49;
                } else {
                    this.levelTileUnderlayIds[level][x][z] = type - 81;
                }
            }
        } else {
            for (;;) {
                const type: number = buf.g1;
                if (type === 0) {
                    break;
                }
                if (type === 1) {
                    buf.g1;
                    break;
                }
                if (type <= 49) {
                    buf.g1;
                }
            }
        }
    };

    public stitchHeightmap = (tileX: number, tileZ: number, tileSizeX: number, tileSizeZ: number): void => {
        for (let z: number = tileZ; z <= tileZ + tileSizeZ; z++) {
            for (let x: number = tileX; x <= tileX + tileSizeX; x++) {
                if (x < 0 || x >= this.maxTileX || z < 0 || z >= this.maxTileZ) {
                    continue;
                }

                this.levelShademap[0][x][z] = 127;

                if (x === tileX && x > 0) {
                    this.levelHeightmap[0][x][z] = this.levelHeightmap[0][x - 1][z];
                }

                if (x === tileX + tileSizeX && x < this.maxTileX - 1) {
                    this.levelHeightmap[0][x][z] = this.levelHeightmap[0][x + 1][z];
                }

                if (z === tileZ && z > 0) {
                    this.levelHeightmap[0][x][z] = this.levelHeightmap[0][x][z - 1];
                }

                if (z === tileZ + tileSizeZ && z < this.maxTileZ - 1) {
                    this.levelHeightmap[0][x][z] = this.levelHeightmap[0][x][z + 1];
                }
            }
        }
    };

    static validateLocs = (data: Int8Array, originX: number, originZ: number): number => {
        const ok: number = 1;
        const buf: Packet = new Packet(new Uint8Array(data));
        let locID: number = -1;

        for (;;) {
            const deltaID: number = buf.gsmarts;
            if (deltaID === 0) {
                break;
            }

            locID += deltaID;

            let pos: number = 0;
            let skip: boolean = false;

            for (;;) {
                if (skip) {
                    if (buf.gsmarts === 0) {
                        break;
                    }
                    buf.g1;
                } else {
                    const deltaPos: number = buf.gsmarts;

                    if (deltaPos === 0) {
                        break;
                    }

                    pos += deltaPos - 1;

                    const z: number = pos & 0x3f;
                    const x: number = (pos >> 6) & 0x3f;

                    const kind: number = buf.g1 >> 2;
                    const localX: number = x + originX;
                    const localZ: number = z + originZ;

                    if (localX > 0 && localZ > 0 && localX < 103 && localZ < 103) {
                        const type: LocType = LocType.get(locID);

                        if (kind != 22 || !Client.lowMemory || type.active || type.forcedecor) {
                            // ok &= type.validate();
                            skip = true;
                        }
                    }
                }
            }
        }
        return ok;
    };

    private readonly maxTileX: number;
    private readonly maxTileZ: number;
    private readonly levelHeightmap: Int32Array[][];
    private readonly levelTileFlags: Uint8Array[][];
    private readonly levelTileUnderlayIds: Uint8Array[][];
    private readonly levelTileOverlayIds: Uint8Array[][];
    private readonly levelTileOverlayShape: Uint8Array[][];
    private readonly levelTileOverlayRotation: Uint8Array[][];
    private readonly levelShademap: Uint8Array[][];
    private readonly levelLightmap: Int32Array[];
    private readonly blendChroma: Int32Array;
    private readonly blendSaturation: Int32Array;
    private readonly blendLightness: Int32Array;
    private readonly blendLuminance: Int32Array;
    private readonly blendMagnitude: Int32Array;
    private readonly levelOccludemap: Int32Array[][];

    public constructor(maxTileX: number, maxTileZ: number, levelHeightmap: Int32Array[][], levelTileFlags: Uint8Array[][]) {
        World.minLevel = 99;
        this.maxTileX = maxTileX;
        this.maxTileZ = maxTileZ;
        this.levelHeightmap = levelHeightmap;
        this.levelTileFlags = levelTileFlags;

        this.levelTileUnderlayIds = new Uint8Array3d(CollisionMap.LEVELS, maxTileX, maxTileZ);
        this.levelTileOverlayIds = new Uint8Array3d(CollisionMap.LEVELS, maxTileX, maxTileZ);
        this.levelTileOverlayShape = new Uint8Array3d(CollisionMap.LEVELS, maxTileX, maxTileZ);
        this.levelTileOverlayRotation = new Uint8Array3d(CollisionMap.LEVELS, maxTileX, maxTileZ);

        this.levelOccludemap = new Int32Array3d(CollisionMap.LEVELS, maxTileX + 1, maxTileZ + 1);
        this.levelShademap = new Uint8Array3d(CollisionMap.LEVELS, maxTileX + 1, maxTileZ + 1);
        this.levelLightmap = new Int32Array2d(maxTileX + 1, maxTileZ + 1);

        this.blendChroma = new Int32Array(maxTileZ);
        this.blendSaturation = new Int32Array(maxTileZ);
        this.blendLightness = new Int32Array(maxTileZ);
        this.blendLuminance = new Int32Array(maxTileZ);
        this.blendMagnitude = new Int32Array(maxTileZ);
    }

    build = (scene: World3D | null, collision: (CollisionMap | null)[]): void => {
        for (let level: number = 0; level < CollisionMap.LEVELS; level++) {
            for (let x: number = 0; x < CollisionMap.SIZE; x++) {
                for (let z: number = 0; z < CollisionMap.SIZE; z++) {
                    // solid
                    if ((this.levelTileFlags[level][x][z] & 0x1) === 1) {
                        let trueLevel: number = level;

                        // bridge
                        if ((this.levelTileFlags[1][x][z] & 0x2) === 2) {
                            trueLevel--;
                        }

                        if (trueLevel >= 0) {
                            collision[trueLevel]?.addFloor(x, z);
                        }
                    }
                }
            }
        }

        World.randomHueOffset += ((Math.random() * 5.0) | 0) - 2;
        if (World.randomHueOffset < -8) {
            World.randomHueOffset = -8;
        } else if (World.randomHueOffset > 8) {
            World.randomHueOffset = 8;
        }

        World.randomLightnessOffset += ((Math.random() * 5.0) | 0) - 2;
        if (World.randomLightnessOffset < -16) {
            World.randomLightnessOffset = -16;
        } else if (World.randomLightnessOffset > 16) {
            World.randomLightnessOffset = 16;
        }

        for (let level: number = 0; level < CollisionMap.LEVELS; level++) {
            const shademap: Uint8Array[] = this.levelShademap[level];
            const lightAmbient: number = 96;
            const lightAttenuation: number = 768;
            const lightX: number = -50;
            const lightY: number = -10;
            const lightZ: number = -50;
            const lightMag: number = Math.sqrt(lightX * lightX + lightY * lightY + lightZ * lightZ) | 0;
            const lightMagnitude: number = (lightAttenuation * lightMag) >> 8;

            for (let z: number = 1; z < this.maxTileZ - 1; z++) {
                for (let x: number = 1; x < this.maxTileX - 1; x++) {
                    const dx: number = this.levelHeightmap[level][x + 1][z] - this.levelHeightmap[level][x - 1][z];
                    const dz: number = this.levelHeightmap[level][x][z + 1] - this.levelHeightmap[level][x][z - 1];
                    const len: number = Math.sqrt(dx * dx + dz * dz + 65536) | 0;
                    const normalX: number = ((dx << 8) / len) | 0;
                    const normalY: number = (65536 / len) | 0;
                    const normalZ: number = ((dz << 8) / len) | 0;
                    const light: number = lightAmbient + (((lightX * normalX + lightY * normalY + lightZ * normalZ) / lightMagnitude) | 0);
                    const shade: number = (shademap[x - 1][z] >> 2) + (shademap[x + 1][z] >> 3) + (shademap[x][z - 1] >> 2) + (shademap[x][z + 1] >> 3) + (shademap[x][z] >> 1);
                    this.levelLightmap[x][z] = light - shade;
                }
            }

            for (let z: number = 0; z < this.maxTileZ; z++) {
                this.blendChroma[z] = 0;
                this.blendSaturation[z] = 0;
                this.blendLightness[z] = 0;
                this.blendLuminance[z] = 0;
                this.blendMagnitude[z] = 0;
            }

            for (let x0: number = -5; x0 < this.maxTileX + 5; x0++) {
                for (let z0: number = 0; z0 < this.maxTileZ; z0++) {
                    const x1: number = x0 + 5;
                    let debugMag: number;

                    if (x1 >= 0 && x1 < this.maxTileX) {
                        const underlayId: number = this.levelTileUnderlayIds[level][x1][z0] & 0xff;

                        if (underlayId > 0) {
                            const flu: FloType = FloType.instances[underlayId - 1];
                            this.blendChroma[z0] += flu.chroma;
                            this.blendSaturation[z0] += flu.saturation;
                            this.blendLightness[z0] += flu.lightness;
                            this.blendLuminance[z0] += flu.luminance;
                            debugMag = this.blendMagnitude[z0]++;
                        }
                    }

                    const x2: number = x0 - 5;
                    if (x2 >= 0 && x2 < this.maxTileX) {
                        const underlayId: number = this.levelTileUnderlayIds[level][x2][z0] & 0xff;

                        if (underlayId > 0) {
                            const flu: FloType = FloType.instances[underlayId - 1];
                            this.blendChroma[z0] -= flu.chroma;
                            this.blendSaturation[z0] -= flu.saturation;
                            this.blendLightness[z0] -= flu.lightness;
                            this.blendLuminance[z0] -= flu.luminance;
                            debugMag = this.blendMagnitude[z0]--;
                        }
                    }
                }

                if (x0 >= 1 && x0 < this.maxTileX - 1) {
                    let hueAccumulator: number = 0;
                    let saturationAccumulator: number = 0;
                    let lightnessAccumulator: number = 0;
                    let luminanceAccumulator: number = 0;
                    let magnitudeAccumulator: number = 0;

                    for (let z0: number = -5; z0 < this.maxTileZ + 5; z0++) {
                        const dz1: number = z0 + 5;
                        if (dz1 >= 0 && dz1 < this.maxTileZ) {
                            hueAccumulator += this.blendChroma[dz1];
                            saturationAccumulator += this.blendSaturation[dz1];
                            lightnessAccumulator += this.blendLightness[dz1];
                            luminanceAccumulator += this.blendLuminance[dz1];
                            magnitudeAccumulator += this.blendMagnitude[dz1];
                        }

                        const dz2: number = z0 - 5;
                        if (dz2 >= 0 && dz2 < this.maxTileZ) {
                            hueAccumulator -= this.blendChroma[dz2];
                            saturationAccumulator -= this.blendSaturation[dz2];
                            lightnessAccumulator -= this.blendLightness[dz2];
                            luminanceAccumulator -= this.blendLuminance[dz2];
                            magnitudeAccumulator -= this.blendMagnitude[dz2];
                        }

                        if (z0 < 1 || z0 >= this.maxTileZ - 1 || (World.lowMemory && (this.levelTileFlags[0][x0][z0] & 0x2) == 0 && (this.levelTileFlags[level][x0][z0] & 0x10) != 0) || this.getDrawLevel(level, x0, z0) !== World.levelBuilt) {
                            continue;
                        }

                        if (level < World.minLevel) {
                            World.minLevel = level;
                        }

                        const underlayId: number = this.levelTileUnderlayIds[level][x0][z0] & 0xff;
                        const overlayId: number = this.levelTileOverlayIds[level][x0][z0] & 0xff;

                        if (underlayId > 0 || overlayId > 0) {
                            const heightSW: number = this.levelHeightmap[level][x0][z0];
                            const heightSE: number = this.levelHeightmap[level][x0 + 1][z0];
                            const heightNE: number = this.levelHeightmap[level][x0 + 1][z0 + 1];
                            const heightNW: number = this.levelHeightmap[level][x0][z0 + 1];

                            const lightSW: number = this.levelLightmap[x0][z0];
                            const lightSE: number = this.levelLightmap[x0 + 1][z0];
                            const lightNE: number = this.levelLightmap[x0 + 1][z0 + 1];
                            const lightNW: number = this.levelLightmap[x0][z0 + 1];

                            let baseColor: number = -1;
                            let tintColor: number = -1;

                            if (underlayId > 0) {
                                const hue: number = ((hueAccumulator * 256) / luminanceAccumulator) | 0;
                                const saturation: number = (saturationAccumulator / magnitudeAccumulator) | 0;
                                let lightness: number = (lightnessAccumulator / magnitudeAccumulator) | 0;
                                baseColor = FloType.hsl24to16(hue, saturation, lightness);
                                const randomHue: number = (hue + World.randomHueOffset) & 0xff;
                                lightness += World.randomLightnessOffset;
                                if (lightness < 0) {
                                    lightness = 0;
                                } else if (lightness > 255) {
                                    lightness = 255;
                                }
                                tintColor = FloType.hsl24to16(randomHue, saturation, lightness);
                            }

                            if (level > 0) {
                                let occludes: boolean = underlayId !== 0 || this.levelTileOverlayShape[level][x0][z0] === TileOverlayShape.PLAIN;

                                if (overlayId > 0 && !FloType.instances[overlayId - 1].occlude) {
                                    occludes = false;
                                }

                                // occludes && flat
                                if (occludes && heightSW === heightSE && heightSW === heightNE && heightSW === heightNW) {
                                    this.levelOccludemap[level][x0][z0] |= 0x924;
                                }
                            }

                            let shadeColor: number = 0;
                            if (baseColor !== -1) {
                                shadeColor = Draw3D.palette[FloType.mulHSL(tintColor, 96)];
                            }

                            if (overlayId === 0) {
                                scene?.setTile(
                                    level,
                                    x0,
                                    z0,
                                    TileOverlayShape.PLAIN,
                                    LocAngle.WEST,
                                    -1,
                                    heightSW,
                                    heightSE,
                                    heightNE,
                                    heightNW,
                                    FloType.mulHSL(baseColor, lightSW),
                                    FloType.mulHSL(baseColor, lightSE),
                                    FloType.mulHSL(baseColor, lightNE),
                                    FloType.mulHSL(baseColor, lightNW),
                                    Colors.BLACK,
                                    Colors.BLACK,
                                    Colors.BLACK,
                                    Colors.BLACK,
                                    shadeColor,
                                    Colors.BLACK
                                );
                            } else {
                                const shape: number = this.levelTileOverlayShape[level][x0][z0] + 1;
                                const rotation: number = this.levelTileOverlayRotation[level][x0][z0];
                                const flo: FloType = FloType.instances[overlayId - 1];
                                let textureId: number = flo.texture;
                                let hsl: number;
                                let rgb: number;

                                if (textureId >= 0) {
                                    rgb = Draw3D.getAverageTextureRGB(textureId);
                                    hsl = -1;
                                } else if (flo.rgb === Colors.MAGENTA) {
                                    rgb = 0;
                                    hsl = -2;
                                    textureId = -1;
                                } else {
                                    hsl = FloType.hsl24to16(flo.hue, flo.saturation, flo.lightness);
                                    rgb = Draw3D.palette[FloType.adjustLightness(flo.hsl, 96)];
                                }

                                scene?.setTile(
                                    level,
                                    x0,
                                    z0,
                                    shape,
                                    rotation,
                                    textureId,
                                    heightSW,
                                    heightSE,
                                    heightNE,
                                    heightNW,
                                    FloType.mulHSL(baseColor, lightSW),
                                    FloType.mulHSL(baseColor, lightSE),
                                    FloType.mulHSL(baseColor, lightNE),
                                    FloType.mulHSL(baseColor, lightNW),
                                    FloType.adjustLightness(hsl, lightSW),
                                    FloType.adjustLightness(hsl, lightSE),
                                    FloType.adjustLightness(hsl, lightNE),
                                    FloType.adjustLightness(hsl, lightNW),
                                    shadeColor,
                                    rgb
                                );
                            }
                        }
                    }
                }
            }

            for (let stz: number = 1; stz < this.maxTileZ - 1; stz++) {
                for (let stx: number = 1; stx < this.maxTileX - 1; stx++) {
                    scene?.setDrawLevel(level, stx, stz, this.getDrawLevel(level, stx, stz));
                }
            }
        }

        if (!World.fullbright) {
            scene?.buildModels(64, 768, -50, -10, -50);
        }

        for (let x: number = 0; x < this.maxTileX; x++) {
            for (let z: number = 0; z < this.maxTileZ; z++) {
                if ((this.levelTileFlags[1][x][z] & 0x2) === 2) {
                    scene?.setBridge(x, z);
                }
            }
        }

        if (!World.fullbright) {
            let wall0: number = 0x1; // this flag is set by walls with rotation 0 or 2
            let wall1: number = 0x2; // this flag is set by walls with rotation 1 or 3
            let floor: number = 0x4; // this flag is set by floors which are flat

            for (let topLevel: number = 0; topLevel < CollisionMap.LEVELS; topLevel++) {
                if (topLevel > 0) {
                    wall0 <<= 0x3;
                    wall1 <<= 0x3;
                    floor <<= 0x3;
                }

                for (let level: number = 0; level <= topLevel; level++) {
                    for (let tileZ: number = 0; tileZ <= this.maxTileZ; tileZ++) {
                        for (let tileX: number = 0; tileX <= this.maxTileX; tileX++) {
                            if ((this.levelOccludemap[level][tileX][tileZ] & wall0) !== 0) {
                                let minTileZ: number = tileZ;
                                let maxTileZ: number = tileZ;
                                let minLevel: number = level;
                                let maxLevel: number = level;

                                while (minTileZ > 0 && (this.levelOccludemap[level][tileX][minTileZ - 1] & wall0) !== 0) {
                                    minTileZ--;
                                }

                                while (maxTileZ < this.maxTileZ && (this.levelOccludemap[level][tileX][maxTileZ + 1] & wall0) !== 0) {
                                    maxTileZ++;
                                }

                                find_min_level: while (minLevel > 0) {
                                    for (let z: number = minTileZ; z <= maxTileZ; z++) {
                                        if ((this.levelOccludemap[minLevel - 1][tileX][z] & wall0) === 0) {
                                            break find_min_level;
                                        }
                                    }
                                    minLevel--;
                                }

                                find_max_level: while (maxLevel < topLevel) {
                                    for (let z: number = minTileZ; z <= maxTileZ; z++) {
                                        if ((this.levelOccludemap[maxLevel + 1][tileX][z] & wall0) === 0) {
                                            break find_max_level;
                                        }
                                    }
                                    maxLevel++;
                                }

                                const area: number = (maxLevel + 1 - minLevel) * (maxTileZ + 1 - minTileZ);
                                if (area >= 8) {
                                    const minY: number = this.levelHeightmap[maxLevel][tileX][minTileZ] - 240;
                                    const maxX: number = this.levelHeightmap[minLevel][tileX][minTileZ];

                                    World3D.addOccluder(topLevel, 1, tileX * 128, minY, minTileZ * 128, tileX * 128, maxX, maxTileZ * 128 + 128);

                                    for (let l: number = minLevel; l <= maxLevel; l++) {
                                        for (let z: number = minTileZ; z <= maxTileZ; z++) {
                                            this.levelOccludemap[l][tileX][z] &= ~wall0;
                                        }
                                    }
                                }
                            }

                            if ((this.levelOccludemap[level][tileX][tileZ] & wall1) !== 0) {
                                let minTileX: number = tileX;
                                let maxTileX: number = tileX;
                                let minLevel: number = level;
                                let maxLevel: number = level;

                                while (minTileX > 0 && (this.levelOccludemap[level][minTileX - 1][tileZ] & wall1) !== 0) {
                                    minTileX--;
                                }

                                while (maxTileX < this.maxTileX && (this.levelOccludemap[level][maxTileX + 1][tileZ] & wall1) !== 0) {
                                    maxTileX++;
                                }

                                find_min_level2: while (minLevel > 0) {
                                    for (let x: number = minTileX; x <= maxTileX; x++) {
                                        if ((this.levelOccludemap[minLevel - 1][x][tileZ] & wall1) === 0) {
                                            break find_min_level2;
                                        }
                                    }
                                    minLevel--;
                                }

                                find_max_level2: while (maxLevel < topLevel) {
                                    for (let x: number = minTileX; x <= maxTileX; x++) {
                                        if ((this.levelOccludemap[maxLevel + 1][x][tileZ] & wall1) === 0) {
                                            break find_max_level2;
                                        }
                                    }
                                    maxLevel++;
                                }

                                const area: number = (maxLevel + 1 - minLevel) * (maxTileX + 1 - minTileX);

                                if (area >= 8) {
                                    const minY: number = this.levelHeightmap[maxLevel][minTileX][tileZ] - 240;
                                    const maxY: number = this.levelHeightmap[minLevel][minTileX][tileZ];

                                    World3D.addOccluder(topLevel, 2, minTileX * 128, minY, tileZ * 128, maxTileX * 128 + 128, maxY, tileZ * 128);

                                    for (let l: number = minLevel; l <= maxLevel; l++) {
                                        for (let x: number = minTileX; x <= maxTileX; x++) {
                                            this.levelOccludemap[l][x][tileZ] &= ~wall1;
                                        }
                                    }
                                }
                            }
                            if ((this.levelOccludemap[level][tileX][tileZ] & floor) !== 0) {
                                let minTileX: number = tileX;
                                let maxTileX: number = tileX;
                                let minTileZ: number = tileZ;
                                let maxTileZ: number = tileZ;

                                while (minTileZ > 0 && (this.levelOccludemap[level][tileX][minTileZ - 1] & floor) !== 0) {
                                    minTileZ--;
                                }

                                while (maxTileZ < this.maxTileZ && (this.levelOccludemap[level][tileX][maxTileZ + 1] & floor) !== 0) {
                                    maxTileZ++;
                                }

                                find_min_tile_xz: while (minTileX > 0) {
                                    for (let z: number = minTileZ; z <= maxTileZ; z++) {
                                        if ((this.levelOccludemap[level][minTileX - 1][z] & floor) === 0) {
                                            break find_min_tile_xz;
                                        }
                                    }
                                    minTileX--;
                                }

                                find_max_tile_xz: while (maxTileX < this.maxTileX) {
                                    for (let z: number = minTileZ; z <= maxTileZ; z++) {
                                        if ((this.levelOccludemap[level][maxTileX + 1][z] & floor) === 0) {
                                            break find_max_tile_xz;
                                        }
                                    }
                                    maxTileX++;
                                }

                                if ((maxTileX + 1 - minTileX) * (maxTileZ + 1 - minTileZ) >= 4) {
                                    const y: number = this.levelHeightmap[level][minTileX][minTileZ];

                                    World3D.addOccluder(topLevel, 4, minTileX * 128, y, minTileZ * 128, maxTileX * 128 + 128, y, maxTileZ * 128 + 128);

                                    for (let x: number = minTileX; x <= maxTileX; x++) {
                                        for (let z: number = minTileZ; z <= maxTileZ; z++) {
                                            this.levelOccludemap[level][x][z] &= ~floor;
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    };

    readLocs = (scene: World3D | null, collision: (CollisionMap | null)[], src: Int8Array, xOffset: number, zOffset: number): void => {
        const buf: Packet = new Packet(new Uint8Array(src));
        let locId: number = -1;

        // eslint-disable-next-line no-constant-condition
        while (true) {
            const deltaId: number = buf.gsmarts;
            if (deltaId === 0) {
                return;
            }

            locId += deltaId;

            let locPos: number = 0;
            // eslint-disable-next-line no-constant-condition
            while (true) {
                const deltaPos: number = buf.gsmarts;
                if (deltaPos === 0) {
                    break;
                }

                locPos += deltaPos - 1;
                const z: number = locPos & 0x3f;
                const x: number = (locPos >> 6) & 0x3f;
                const level: number = locPos >> 12;

                const info: number = buf.g1;
                const shape: number = info >> 2;
                const rotation: number = info & 0x3;
                const stx: number = x + xOffset;
                const stz: number = z + zOffset;

                if (stx > 0 && stz > 0 && stx < CollisionMap.SIZE - 1 && stz < CollisionMap.SIZE - 1) {
                    let currentLevel: number = level;
                    if ((this.levelTileFlags[1][stx][stz] & 0x2) === 2) {
                        currentLevel = level - 1;
                    }

                    let collisionMap: CollisionMap | null = null;
                    if (currentLevel >= 0) {
                        collisionMap = collision[currentLevel];
                    }

                    this.addLoc(level, stx, stz, scene, collisionMap, locId, shape, rotation);
                }
            }
        }
    };

    private addLoc = (level: number, x: number, z: number, scene: World3D | null, collision: CollisionMap | null, locId: number, shape: number, angle: number): void => {
        if (World.lowMemory && (this.levelTileFlags[level][x][z] & 0x2) === 0) {
            if ((this.levelTileFlags[level][x][z] & 0x10) !== 0) {
                return;
            }

            if (this.getDrawLevel(level, x, z) !== World.levelBuilt) {
                return;
            }
        }

        if (level < World.minLevel) {
            World.minLevel = level;
        }

        let heightSW: number = this.levelHeightmap[level][x][z];
        let heightSE: number = this.levelHeightmap[level][x + 1][z];
        let heightNW: number = this.levelHeightmap[level][x][z + 1];
        let heightNE: number = this.levelHeightmap[level][x + 1][z + 1];
        const y: number = (heightSW + heightSE + heightNW + heightNE) >> 2;

        const loc: LocType = LocType.get(locId);

        let bitset: number = (x + (z << 7) + (locId << 14) + 0x40000000) | 0;
        if (!loc.active) {
            bitset += -0x80000000; // int.min
        }
        bitset |= 0;

        const info: number = ((((angle << 6) + shape) | 0) << 24) >> 24;

        if (shape === LocShape.GROUND_DECOR.id) {
            if (!World.lowMemory || loc.active || loc.forcedecor) {
                let entity: Entity | null;
                if (loc.anim === -1 && !loc.multiloc) {
                    entity = loc.getModel(LocShape.GROUND_DECOR.id, angle, heightSW, heightSE, heightNE, heightNW, -1);
                } else {
                    entity = new LocEntity(locId, shape, angle, heightSW, heightSE, heightNE, heightNW, loc.anim, true);
                }

                scene?.addGroundDecoration(entity, level, x, z, y, bitset, info);

                if (loc.blockwalk && loc.active) {
                    collision?.addFloor(x, z);
                }
            }
        } else if (shape === LocShape.CENTREPIECE_STRAIGHT.id || shape === LocShape.CENTREPIECE_DIAGONAL.id) {
            let entity: Entity | null;
            if (loc.anim === -1 && !loc.multiloc) {
                entity = loc.getModel(LocShape.CENTREPIECE_STRAIGHT.id, angle, heightSW, heightSE, heightNE, heightNW, -1);
            } else {
                entity = new LocEntity(locId, shape, angle, heightSW, heightSE, heightNE, heightNW, loc.anim, true);
            }

            if (entity) {
                let yaw: number = 0;
                if (shape === LocShape.CENTREPIECE_DIAGONAL.id) {
                    yaw += 256;
                }

                let width: number;
                let height: number;
                if (angle === LocAngle.NORTH || angle === LocAngle.SOUTH) {
                    width = loc.length;
                    height = loc.width;
                } else {
                    width = loc.width;
                    height = loc.length;
                }

                if (scene?.addLoc(level, x, z, y, entity, bitset, info, width, height, yaw) && loc.shadow) {
                    let model: Model | null;
                    if (entity instanceof Model) {
                        model = entity;
                    } else {
                        model = loc.getModel(LocShape.CENTREPIECE_STRAIGHT.id, angle, heightSW, heightSE, heightNE, heightNW, -1);
                    }

                    if (model) {
                        for (let dx: number = 0; dx <= width; dx++) {
                            for (let dz: number = 0; dz <= height; dz++) {
                                let shade: number = (model.radius / 4) | 0;
                                if (shade > 30) {
                                    shade = 30;
                                }

                                if (shade > this.levelShademap[level][x + dx][z + dz]) {
                                    this.levelShademap[level][x + dx][z + dz] = (shade << 24) >> 24;
                                }
                            }
                        }
                    }
                }
            }

            if (loc.blockwalk) {
                collision?.addLoc(x, z, loc.width, loc.length, angle, loc.blockrange);
            }
        } else if (shape >= LocShape.ROOF_STRAIGHT.id) {
            let entity: Entity | null;
            if (loc.anim === -1 && !loc.multiloc) {
                entity = loc.getModel(shape, angle, heightSW, heightSE, heightNE, heightNW, -1);
            } else {
                entity = new LocEntity(locId, shape, angle, heightSW, heightSE, heightNE, heightNW, loc.anim, true);
            }

            scene?.addLoc(level, x, z, y, entity, bitset, info, 1, 1, 0);

            if (shape >= LocShape.ROOF_STRAIGHT.id && shape <= LocShape.ROOF_FLAT.id && shape !== LocShape.ROOF_DIAGONAL_WITH_ROOFEDGE.id && level > 0) {
                this.levelOccludemap[level][x][z] |= 0x924;
            }

            if (loc.blockwalk) {
                collision?.addLoc(x, z, loc.width, loc.length, angle, loc.blockrange);
            }
        } else if (shape === LocShape.WALL_STRAIGHT.id) {
            let entity: Entity | null;
            if (loc.anim === -1 && !loc.multiloc) {
                entity = loc.getModel(LocShape.WALL_STRAIGHT.id, angle, heightSW, heightSE, heightNE, heightNW, -1);
            } else {
                entity = new LocEntity(locId, shape, angle, heightSW, heightSE, heightNE, heightNW, loc.anim, true);
            }

            scene?.addWall(level, x, z, y, World.ROTATION_WALL_TYPE[angle], 0, entity, null, bitset, info);

            if (angle === LocAngle.WEST) {
                if (loc.shadow) {
                    this.levelShademap[level][x][z] = 50;
                    this.levelShademap[level][x][z + 1] = 50;
                }

                if (loc.occlude) {
                    this.levelOccludemap[level][x][z] |= 0x249;
                }
            } else if (angle === LocAngle.NORTH) {
                if (loc.shadow) {
                    this.levelShademap[level][x][z + 1] = 50;
                    this.levelShademap[level][x + 1][z + 1] = 50;
                }

                if (loc.occlude) {
                    this.levelOccludemap[level][x][z + 1] |= 0x492;
                }
            } else if (angle === LocAngle.EAST) {
                if (loc.shadow) {
                    this.levelShademap[level][x + 1][z] = 50;
                    this.levelShademap[level][x + 1][z + 1] = 50;
                }

                if (loc.occlude) {
                    this.levelOccludemap[level][x + 1][z] |= 0x249;
                }
            } else if (angle === LocAngle.SOUTH) {
                if (loc.shadow) {
                    this.levelShademap[level][x][z] = 50;
                    this.levelShademap[level][x + 1][z] = 50;
                }

                if (loc.occlude) {
                    this.levelOccludemap[level][x][z] |= 0x492;
                }
            }

            if (loc.blockwalk) {
                collision?.addWall(x, z, shape, angle, loc.blockrange);
            }

            if (loc.wallwidth !== 16) {
                scene?.setWallDecorationOffset(level, x, z, loc.wallwidth);
            }
        } else if (shape === LocShape.WALL_DIAGONAL_CORNER.id) {
            let entity: Entity | null;
            if (loc.anim === -1 && !loc.multiloc) {
                entity = loc.getModel(LocShape.WALL_DIAGONAL_CORNER.id, angle, heightSW, heightSE, heightNE, heightNW, -1);
            } else {
                entity = new LocEntity(locId, shape, angle, heightSW, heightSE, heightNE, heightNW, loc.anim, true);
            }

            scene?.addWall(level, x, z, y, World.ROTATION_WALL_CORNER_TYPE[angle], 0, entity, null, bitset, info);

            if (loc.shadow) {
                if (angle === LocAngle.WEST) {
                    this.levelShademap[level][x][z + 1] = 50;
                } else if (angle === LocAngle.NORTH) {
                    this.levelShademap[level][x + 1][z + 1] = 50;
                } else if (angle === LocAngle.EAST) {
                    this.levelShademap[level][x + 1][z] = 50;
                } else if (angle === LocAngle.SOUTH) {
                    this.levelShademap[level][x][z] = 50;
                }
            }

            if (loc.blockwalk) {
                collision?.addWall(x, z, shape, angle, loc.blockrange);
            }
        } else if (shape === LocShape.WALL_L.id) {
            const offset: number = (angle + 1) & 0x3;
            let entityA: Entity | null;
            let entityB: Entity | null;
            if (loc.anim === -1 && !loc.multiloc) {
                entityA = loc.getModel(LocShape.WALL_L.id, angle + 4, heightSW, heightSE, heightNE, heightNW, -1);
                entityB = loc.getModel(LocShape.WALL_L.id, offset, heightSW, heightSE, heightNE, heightNW, -1);
            } else {
                entityA = new LocEntity(locId, shape, angle + 4, heightSW, heightSE, heightNE, heightNW, loc.anim, true);
                entityB = new LocEntity(locId, shape, angle, heightSW, heightSE, heightNE, heightNW, loc.anim, true);
            }

            scene?.addWall(level, x, z, y, World.ROTATION_WALL_TYPE[angle], World.ROTATION_WALL_TYPE[offset], entityA, entityB, bitset, info);

            if (loc.occlude) {
                if (angle === LocAngle.WEST) {
                    this.levelOccludemap[level][x][z] |= 0x109;
                    this.levelOccludemap[level][x][z + 1] |= 0x492;
                } else if (angle === LocAngle.NORTH) {
                    this.levelOccludemap[level][x][z + 1] |= 0x492;
                    this.levelOccludemap[level][x + 1][z] |= 0x249;
                } else if (angle === LocAngle.EAST) {
                    this.levelOccludemap[level][x + 1][z] |= 0x249;
                    this.levelOccludemap[level][x][z] |= 0x492;
                } else if (angle === LocAngle.SOUTH) {
                    this.levelOccludemap[level][x][z] |= 0x492;
                    this.levelOccludemap[level][x][z] |= 0x249;
                }
            }

            if (loc.blockwalk) {
                collision?.addWall(x, z, shape, angle, loc.blockrange);
            }

            if (loc.wallwidth !== 16) {
                scene?.setWallDecorationOffset(level, x, z, loc.wallwidth);
            }
        } else if (shape === LocShape.WALL_SQUARE_CORNER.id) {
            let entity: Entity | null;
            if (loc.anim === -1 && !loc.multiloc) {
                entity = loc.getModel(LocShape.WALL_SQUARE_CORNER.id, angle, heightSW, heightSE, heightNE, heightNW, -1);
            } else {
                entity = new LocEntity(locId, shape, angle, heightSW, heightSE, heightNE, heightNW, loc.anim, true);
            }

            scene?.addWall(level, x, z, y, World.ROTATION_WALL_CORNER_TYPE[angle], 0, entity, null, bitset, info);

            if (loc.shadow) {
                if (angle === LocAngle.WEST) {
                    this.levelShademap[level][x][z + 1] = 50;
                } else if (angle === LocAngle.NORTH) {
                    this.levelShademap[level][x + 1][z + 1] = 50;
                } else if (angle === LocAngle.EAST) {
                    this.levelShademap[level][x + 1][z] = 50;
                } else if (angle === LocAngle.SOUTH) {
                    this.levelShademap[level][x][z] = 50;
                }
            }

            if (loc.blockwalk) {
                collision?.addWall(x, z, shape, angle, loc.blockrange);
            }
        } else if (shape === LocShape.WALL_DIAGONAL.id) {
            let entity: Entity | null;
            if (loc.anim === -1 && !loc.multiloc) {
                entity = loc.getModel(LocShape.WALL_DIAGONAL.id, angle, heightSW, heightSE, heightNE, heightNW, -1);
            } else {
                entity = new LocEntity(locId, shape, angle, heightSW, heightSE, heightNE, heightNW, loc.anim, true);
            }

            scene?.addLoc(level, x, z, y, entity, bitset, info, 1, 1, 0);

            if (loc.blockwalk) {
                collision?.addLoc(x, z, loc.width, loc.length, angle, loc.blockrange);
            }
        } else {
            if (loc.hillskew) {
                if (angle === 1) {
                    const tmp: number = heightNW;
                    heightNW = heightNE;
                    heightNE = heightSE;
                    heightSE = heightSW;
                    heightSW = tmp;
                } else if (angle === 2) {
                    let tmp: number = heightNW;
                    heightNW = heightSE;
                    heightSE = tmp;
                    tmp = heightNE;
                    heightNE = heightSW;
                    heightSW = tmp;
                } else if (angle === 3) {
                    const tmp: number = heightNW;
                    heightNW = heightSW;
                    heightSW = heightSE;
                    heightSE = heightNE;
                    heightNE = tmp;
                }
            }

            if (shape === LocShape.WALLDECOR_STRAIGHT_NOOFFSET.id) {
                let entity: Entity | null;
                if (loc.anim === -1 && !loc.multiloc) {
                    entity = loc.getModel(LocShape.WALLDECOR_STRAIGHT_NOOFFSET.id, LocAngle.WEST, heightSW, heightSE, heightNE, heightNW, -1);
                } else {
                    entity = new LocEntity(locId, shape, angle, heightSW, heightSE, heightNE, heightNW, loc.anim, true);
                }

                scene?.setWallDecoration(level, x, z, y, 0, 0, bitset, entity, info, angle * 512, World.ROTATION_WALL_TYPE[angle]);
            } else if (shape === LocShape.WALLDECOR_STRAIGHT_OFFSET.id) {
                let entity: Entity | null;
                if (loc.anim === -1 && !loc.multiloc) {
                    entity = loc.getModel(LocShape.WALLDECOR_STRAIGHT_NOOFFSET.id, LocAngle.WEST, heightSW, heightSE, heightNE, heightNW, -1);
                } else {
                    entity = new LocEntity(locId, shape, angle, heightSW, heightSE, heightNE, heightNW, loc.anim, true);
                }

                let offset: number = 16;
                if (scene) {
                    const width: number = scene.getWallBitset(level, x, z);
                    if (width > 0) {
                        offset = LocType.get((width >> 14) & 0x7fff).wallwidth;
                    }
                }

                scene?.setWallDecoration(level, x, z, y, World.WALL_DECORATION_ROTATION_FORWARD_X[angle] * offset, World.WALL_DECORATION_ROTATION_FORWARD_Z[angle] * offset, bitset, entity, info, angle * 512, World.ROTATION_WALL_TYPE[angle]);
            } else if (shape === LocShape.WALLDECOR_DIAGONAL_OFFSET.id) {
                let entity: Entity | null;
                if (loc.anim === -1 && !loc.multiloc) {
                    entity = loc.getModel(LocShape.WALLDECOR_STRAIGHT_NOOFFSET.id, LocAngle.WEST, heightSW, heightSE, heightNE, heightNW, -1);
                } else {
                    entity = new LocEntity(locId, shape, angle, heightSW, heightSE, heightNE, heightNW, loc.anim, true);
                }

                scene?.setWallDecoration(level, x, z, y, 0, 0, bitset, entity, info, angle, 256);
            } else if (shape === LocShape.WALLDECOR_DIAGONAL_NOOFFSET.id) {
                let entity: Entity | null;
                if (loc.anim === -1 && !loc.multiloc) {
                    entity = loc.getModel(LocShape.WALLDECOR_STRAIGHT_NOOFFSET.id, LocAngle.WEST, heightSW, heightSE, heightNE, heightNW, -1);
                } else {
                    entity = new LocEntity(locId, shape, angle, heightSW, heightSE, heightNE, heightNW, loc.anim, true);
                }

                scene?.setWallDecoration(level, x, z, y, 0, 0, bitset, entity, info, angle, 512);
            } else if (shape === LocShape.WALLDECOR_DIAGONAL_BOTH.id) {
                let entity: Entity | null;
                if (loc.anim === -1 && !loc.multiloc) {
                    entity = loc.getModel(LocShape.WALLDECOR_STRAIGHT_NOOFFSET.id, LocAngle.WEST, heightSW, heightSE, heightNE, heightNW, -1);
                } else {
                    entity = new LocEntity(locId, shape, angle, heightSW, heightSE, heightNE, heightNW, loc.anim, true);
                }

                scene?.setWallDecoration(level, x, z, y, 0, 0, bitset, entity, info, angle, 768);
            }
        }
    };

    private getDrawLevel = (level: number, stx: number, stz: number): number => {
        if ((this.levelTileFlags[level][stx][stz] & 0x8) === 0) {
            return level <= 0 || (this.levelTileFlags[1][stx][stz] & 0x2) === 0 ? level : level - 1;
        }
        return 0;
    };
}

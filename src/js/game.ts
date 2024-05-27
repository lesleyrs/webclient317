import SeqType from './jagex2/config/SeqType';
import LocType from './jagex2/config/LocType';
import ObjType from './jagex2/config/ObjType';
import NpcType from './jagex2/config/NpcType';
import IdkType from './jagex2/config/IdkType';
import SpotAnimType from './jagex2/config/SpotAnimType';
import VarpType from './jagex2/config/VarpType';
import Component from './jagex2/config/Component';

import PixMap from './jagex2/graphics/PixMap';
import Draw2D from './jagex2/graphics/Draw2D';
import Draw3D from './jagex2/graphics/Draw3D';
import Pix8 from './jagex2/graphics/Pix8';
import Pix24 from './jagex2/graphics/Pix24';
import PixFont from './jagex2/graphics/PixFont';
import Model from './jagex2/graphics/Model';
import Colors from './jagex2/graphics/Colors';

import Jagfile from './jagex2/io/Jagfile';
import Packet from './jagex2/io/Packet';
import ClientStream from './jagex2/io/ClientStream';
import Protocol from './jagex2/io/Protocol';
import Isaac from './jagex2/io/Isaac';
import Database from './jagex2/io/Database';
import ServerProt from './jagex2/io/ServerProt';
import ClientProt from './jagex2/io/ClientProt';
import DiskStore from './jagex2/io/DiskStore';

import WordFilter from './jagex2/wordenc/WordFilter';
import WordPack from './jagex2/wordenc/WordPack';

import Wave from './jagex2/sound/Wave';

import './vendor/midi.js';
import Bzip from './vendor/bzip';
import Gzip from './vendor/gzip';

import LinkList from './jagex2/datastruct/LinkList';
import JString from './jagex2/datastruct/JString';

import World3D from './jagex2/dash3d/World3D';
import World from './jagex2/dash3d/World';
import LocLayer from './jagex2/dash3d/LocLayer';
import LocShape from './jagex2/dash3d/LocShape';
import LocAngle from './jagex2/dash3d/LocAngle';
import LocTemporary from './jagex2/dash3d/type/LocTemporary';
import CollisionMap from './jagex2/dash3d/CollisionMap';
import CollisionFlag from './jagex2/dash3d/CollisionFlag';
import PlayerEntity from './jagex2/dash3d/entity/PlayerEntity';
import NpcEntity from './jagex2/dash3d/entity/NpcEntity';
import ObjStackEntity from './jagex2/dash3d/entity/ObjStackEntity';
import PathingEntity from './jagex2/dash3d/entity/PathingEntity';
import ProjectileEntity from './jagex2/dash3d/entity/ProjectileEntity';
import SpotAnimEntity from './jagex2/dash3d/entity/SpotAnimEntity';

import {playMidi, playWave, setMidiVolume, setWaveVolume, stopMidi} from './jagex2/util/AudioUtil.js';
import {arraycopy, downloadUrl, sleep} from './jagex2/util/JsUtil';
import {Int32Array3d, TypedArray1d, Uint8Array3d} from './jagex2/util/Arrays';
import {Client} from './client';
import AnimFrame from './jagex2/graphics/AnimFrame';
import FloType from './jagex2/config/FloType';
import {setupConfiguration} from './configuration';
import Tile from './jagex2/dash3d/type/Tile';
import DirectionFlag from './jagex2/dash3d/DirectionFlag';
import ClientWorkerStream from './jagex2/io/ClientWorkerStream';
import OnDemand from './jagex2/io/OnDemand';
import LocEntity from './jagex2/dash3d/entity/LocEntity';
import Wall from './jagex2/dash3d/type/Wall';
import WallDecoration from './jagex2/dash3d/type/WallDecoration';
import GroundDecoration from './jagex2/dash3d/type/GroundDecoration';
import Loc from './jagex2/dash3d/type/Loc';
import VarbitType from './jagex2/config/VarbitType';

// noinspection JSSuspiciousNameCombination
export class Game extends Client {
    load = async (): Promise<void> => {
        if (this.alreadyStarted) {
            this.errorStarted = true;
            return;
        }

        this.alreadyStarted = true;

        try {
            this.initWorkerP2P();

            await this.showProgress(10, 'Connecting to fileserver');

            await Gzip();
            await Bzip.load(await (await fetch('bz2.wasm')).arrayBuffer());
            this.db = new Database(await Database.openDatabase());

            // TODO: loadarchivechecksums() and ondemand
            // const checksums: Packet = new Packet(new Uint8Array(await downloadUrl(`${Client.httpAddress}/crc` + Math.round(Math.random() * 99999999) + '-317')));

            // for (let i: number = 0; i < 9; i++) {
            //     this.archiveChecksums[i] = checksums.g4;
            // }

            const urls: string[] = ['main_file_cache.dat', 'main_file_cache.idx0', 'main_file_cache.idx1', 'main_file_cache.idx2', 'main_file_cache.idx3', 'main_file_cache.idx4'];

            try {
                const responses: Response[] = await Promise.all(urls.map((url: string): Promise<Response> => fetch(`${Client.clientversion}/${url}`, {cache: 'no-cache'})));
                if (responses.some((response: Response): boolean => response.ok === false)) {
                    throw new Error('Failed to fetch cache');
                }
                const dat: ArrayBuffer[] = await Promise.all(responses.map((response: Response): Promise<ArrayBuffer> => response.arrayBuffer()));
                for (let i: number = 0; i < dat.length; i++) {
                    const data: ArrayBuffer = dat[i];
                    await this.db?.cachesave(urls[i], new Int8Array(data));
                }
            } catch (error) {
                console.error('Failed to load cache', error);
            }

            const dat: Int8Array | undefined = await this.db?.cacheload('main_file_cache.dat');

            const idx: (Int8Array | undefined)[] = new Array<Int8Array | undefined>(5);
            for (let i: number = 0; i < idx.length; i++) {
                idx[i] = await this.db?.cacheload(`main_file_cache.idx${i}`);
            }

            if (dat) {
                for (let i: number = 0; i < Game.jagStore.length; i++) {
                    Game.jagStore[i] = new DiskStore(dat, idx[i] as Int8Array, i);
                }
            }

            const title: Jagfile = await this.loadArchive(1, 'title', 'title screen', this.archiveChecksums[1], 25);
            this.titleArchive = title;

            this.fontPlain11 = PixFont.fromArchive(title, 'p11_full', false);
            this.fontPlain12 = PixFont.fromArchive(title, 'p12_full', false);
            this.fontBold12 = PixFont.fromArchive(title, 'b12_full', false);
            this.fontQuill8 = PixFont.fromArchive(title, 'q8_full', true);

            await this.loadTitleBackground();
            this.loadTitleImages();

            const config: Jagfile = await this.loadArchive(2, 'config', 'config', this.archiveChecksums[2], 30);
            const interfaces: Jagfile = await this.loadArchive(3, 'interface', 'interface', this.archiveChecksums[3], 35);
            const media: Jagfile = await this.loadArchive(4, 'media', '2d graphics', this.archiveChecksums[4], 40);
            const textures: Jagfile = await this.loadArchive(6, 'textures', 'textures', this.archiveChecksums[6], 45);
            const wordenc: Jagfile = await this.loadArchive(7, 'wordenc', 'chat system', this.archiveChecksums[7], 50);
            const sounds: Jagfile = await this.loadArchive(8, 'sounds', 'sound effects', this.archiveChecksums[8], 55);

            this.levelTileFlags = new Uint8Array3d(CollisionMap.LEVELS, CollisionMap.SIZE, CollisionMap.SIZE);
            this.levelHeightmap = new Int32Array3d(CollisionMap.LEVELS, CollisionMap.SIZE + 1, CollisionMap.SIZE + 1);
            if (this.levelHeightmap) {
                this.scene = new World3D(this.levelHeightmap, CollisionMap.SIZE, CollisionMap.LEVELS, CollisionMap.SIZE);
            }
            for (let level: number = 0; level < CollisionMap.LEVELS; level++) {
                this.levelCollisionMap[level] = new CollisionMap();
            }
            this.imageMinimap = new Pix24(512, 512);

            const versionlist: Jagfile = await this.loadArchive(5, 'versionlist', 'update list', this.archiveChecksums[5], 60);
            this.ondemand = new OnDemand();
            this.ondemand.load(versionlist);

            // await this.showProgress(65, 'Requesting animations');
            await this.showProgress(65, 'Loading animations');

            for (let i: number = 0; i < Game.jagStore[2].fileCount; i++) {
                const data: Uint8Array | Jagfile | null = Game.jagStore[2].read(i);
                if (data) {
                    AnimFrame.unpack(data as Uint8Array);
                }
            }

            // await this.showProgress(70, 'Requesting models');
            await this.showProgress(70, 'Loading models');
            for (let i: number = 0; i < Game.jagStore[1].fileCount; i++) {
                const data: Uint8Array | Jagfile | null = Game.jagStore[1].read(i);

                if (data) {
                    Model.unpack(data as Uint8Array, i);
                }
            }
            // await this.showProgress(75, "Requesting maps");
            await this.showProgress(75, 'Loading maps');

            // TODO: ondemand sends midisave req
            if (!Client.lowMemory) {
                // await this.setMidi('scape_main', 12345678, 40000, false);

                this.currentMidi = 0;
                await this.setMidi(this.currentMidi, true);
            }

            await this.showProgress(80, 'Unpacking media');
            this.imageInvback = Pix8.fromArchive(media, 'invback', 0);
            this.imageChatback = Pix8.fromArchive(media, 'chatback', 0);
            this.imageMapback = Pix8.fromArchive(media, 'mapback', 0);
            this.imageBackbase1 = Pix8.fromArchive(media, 'backbase1', 0);
            this.imageBackbase2 = Pix8.fromArchive(media, 'backbase2', 0);
            this.imageBackhmid1 = Pix8.fromArchive(media, 'backhmid1', 0);
            for (let i: number = 0; i < 13; i++) {
                this.imageSideicons[i] = Pix8.fromArchive(media, 'sideicons', i);
            }
            this.imageCompass = Pix24.fromArchive(media, 'compass', 0);
            this.imageMapedge = Pix24.fromArchive(media, 'mapedge', 0);
            this.imageMapedge.crop();

            try {
                for (let i: number = 0; i < 100; i++) {
                    if (i === 22) {
                        // weird debug sprite along water
                        continue;
                    }

                    this.imageMapscene[i] = Pix8.fromArchive(media, 'mapscene', i);
                }
            } catch (e) {
                /* empty */
            }

            try {
                for (let i: number = 0; i < 100; i++) {
                    this.imageMapfunction[i] = Pix24.fromArchive(media, 'mapfunction', i);
                }
            } catch (e) {
                /* empty */
            }

            try {
                for (let i: number = 0; i < 20; i++) {
                    this.imageHitmarks[i] = Pix24.fromArchive(media, 'hitmarks', i);
                }
            } catch (e) {
                /* empty */
            }

            try {
                for (let i: number = 0; i < 20; i++) {
                    this.imageHeadicons[i] = Pix24.fromArchive(media, 'headicons', i);
                }
            } catch (e) {
                /* empty */
            }

            this.imageMapflag0 = Pix24.fromArchive(media, 'mapmarker', 0);
            this.imageMapflag1 = Pix24.fromArchive(media, 'mapmarker', 1);
            for (let i: number = 0; i < 8; i++) {
                this.imageCrosses[i] = Pix24.fromArchive(media, 'cross', i);
            }
            this.imageMapdot0 = Pix24.fromArchive(media, 'mapdots', 0);
            this.imageMapdot1 = Pix24.fromArchive(media, 'mapdots', 1);
            this.imageMapdot2 = Pix24.fromArchive(media, 'mapdots', 2);
            this.imageMapdot3 = Pix24.fromArchive(media, 'mapdots', 3);
            this.imageMapdot4 = Pix24.fromArchive(media, 'mapdots', 4);
            this.imageScrollbar0 = Pix8.fromArchive(media, 'scrollbar', 0);
            this.imageScrollbar1 = Pix8.fromArchive(media, 'scrollbar', 1);
            this.imageRedstone1 = Pix8.fromArchive(media, 'redstone1', 0);
            this.imageRedstone2 = Pix8.fromArchive(media, 'redstone2', 0);
            this.imageRedstone3 = Pix8.fromArchive(media, 'redstone3', 0);
            this.imageRedstone1h = Pix8.fromArchive(media, 'redstone1', 0);
            this.imageRedstone1h?.flipHorizontally();
            this.imageRedstone2h = Pix8.fromArchive(media, 'redstone2', 0);
            this.imageRedstone2h?.flipHorizontally();
            this.imageRedstone1v = Pix8.fromArchive(media, 'redstone1', 0);
            this.imageRedstone1v?.flipVertically();
            this.imageRedstone2v = Pix8.fromArchive(media, 'redstone2', 0);
            this.imageRedstone2v?.flipVertically();
            this.imageRedstone3v = Pix8.fromArchive(media, 'redstone3', 0);
            this.imageRedstone3v?.flipVertically();
            this.imageRedstone1hv = Pix8.fromArchive(media, 'redstone1', 0);
            this.imageRedstone1hv?.flipHorizontally();
            this.imageRedstone1hv?.flipVertically();
            this.imageRedstone2hv = Pix8.fromArchive(media, 'redstone2', 0);
            this.imageRedstone2hv?.flipHorizontally();
            this.imageRedstone2hv?.flipVertically();
            for (let i: number = 0; i < 2; i++) {
                this.imageModIcons[i] = Pix8.fromArchive(media, 'mod_icons', i);
            }
            const backleft1: Pix24 = Pix24.fromArchive(media, 'backleft1', 0);
            this.areaBackleft1 = new PixMap(backleft1.width, backleft1.height);
            backleft1.blitOpaque(0, 0);
            const backleft2: Pix24 = Pix24.fromArchive(media, 'backleft2', 0);
            this.areaBackleft2 = new PixMap(backleft2.width, backleft2.height);
            backleft2.blitOpaque(0, 0);
            const backright1: Pix24 = Pix24.fromArchive(media, 'backright1', 0);
            this.areaBackright1 = new PixMap(backright1.width, backright1.height);
            backright1.blitOpaque(0, 0);
            const backright2: Pix24 = Pix24.fromArchive(media, 'backright2', 0);
            this.areaBackright2 = new PixMap(backright2.width, backright2.height);
            backright2.blitOpaque(0, 0);
            const backtop1: Pix24 = Pix24.fromArchive(media, 'backtop1', 0);
            this.areaBacktop1 = new PixMap(backtop1.width, backtop1.height);
            backtop1.blitOpaque(0, 0);
            const backvmid1: Pix24 = Pix24.fromArchive(media, 'backvmid1', 0);
            this.areaBackvmid1 = new PixMap(backvmid1.width, backvmid1.height);
            backvmid1.blitOpaque(0, 0);
            const backvmid2: Pix24 = Pix24.fromArchive(media, 'backvmid2', 0);
            this.areaBackvmid2 = new PixMap(backvmid2.width, backvmid2.height);
            backvmid2.blitOpaque(0, 0);
            const backvmid3: Pix24 = Pix24.fromArchive(media, 'backvmid3', 0);
            this.areaBackvmid3 = new PixMap(backvmid3.width, backvmid3.height);
            backvmid3.blitOpaque(0, 0);
            const backhmid2: Pix24 = Pix24.fromArchive(media, 'backhmid2', 0);
            this.areaBackhmid2 = new PixMap(backhmid2.width, backhmid2.height);
            backhmid2.blitOpaque(0, 0);

            const randR: number = ((Math.random() * 21.0) | 0) - 10;
            const randG: number = ((Math.random() * 21.0) | 0) - 10;
            const randB: number = ((Math.random() * 21.0) | 0) - 10;
            const rand: number = ((Math.random() * 41.0) | 0) - 20;
            for (let i: number = 0; i < 100; i++) {
                if (this.imageMapfunction[i]) {
                    this.imageMapfunction[i]?.translate(randR + rand, randG + rand, randB + rand);
                }

                if (this.imageMapscene[i]) {
                    this.imageMapscene[i]?.translate(randR + rand, randG + rand, randB + rand);
                }
            }

            await this.showProgress(83, 'Unpacking textures');
            Draw3D.unpackTextures(textures);
            Draw3D.setBrightness(0.8);
            Draw3D.initPool(20);

            await this.showProgress(86, 'Unpacking config');
            SeqType.unpack(config);
            LocType.unpack(config);
            FloType.unpack(config);
            ObjType.unpack(config);
            NpcType.unpack(config);
            IdkType.unpack(config);
            SpotAnimType.unpack(config);
            VarpType.unpack(config);
            VarbitType.unpack(config);

            if (!Client.lowMemory) {
                await this.showProgress(90, 'Unpacking sounds');
                Wave.unpack(sounds);
            }

            await this.showProgress(95, 'Unpacking interfaces');
            Component.unpack(interfaces, media, [this.fontPlain11, this.fontPlain12, this.fontBold12, this.fontQuill8]);

            await this.showProgress(100, 'Preparing game engine');
            for (let y: number = 0; y < 33; y++) {
                let left: number = 999;
                let right: number = 0;
                for (let x: number = 0; x < 35; x++) {
                    if (this.imageMapback.pixels[x + y * this.imageMapback.width] === 0) {
                        if (left === 999) {
                            left = x;
                        }
                    } else if (left !== 999) {
                        right = x;
                        break;
                    }
                }
                this.compassMaskLineOffsets[y] = left;
                this.compassMaskLineLengths[y] = right - left;
            }

            for (let y: number = 5; y < 156; y++) {
                let left: number = 999;
                let right: number = 0;
                for (let x: number = 25; x < 172; x++) {
                    if (this.imageMapback.pixels[x + y * this.imageMapback.width] === 0 && (x > 34 || y > 34)) {
                        if (left === 999) {
                            left = x;
                        }
                    } else if (left !== 999) {
                        right = x;
                        break;
                    }
                }
                this.minimapMaskLineOffsets[y - 5] = left - 25;
                this.minimapMaskLineLengths[y - 5] = right - left;
            }

            Draw3D.init3D(479, 96);
            this.areaChatbackOffsets = Draw3D.lineOffset;
            Draw3D.init3D(190, 261);
            this.areaSidebarOffsets = Draw3D.lineOffset;
            Draw3D.init3D(512, 334);
            this.areaViewportOffsets = Draw3D.lineOffset;

            const distance: Int32Array = new Int32Array(9);
            for (let x: number = 0; x < 9; x++) {
                const angle: number = x * 32 + 128 + 15;
                const offset: number = angle * 3 + 600;
                const sin: number = Draw3D.sin[angle];
                distance[x] = (offset * sin) >> 16;
            }

            World3D.init(512, 334, 500, 800, distance);
            WordFilter.unpack(wordenc);
            this.initializeLevelExperience();
            this.initializeBitmask();

            LocEntity.game = this;
            LocType.game = this;
            NpcType.game = this;
        } catch (err) {
            console.error(err);
            this.errorLoading = true;
        }
    };

    update = async (): Promise<void> => {
        if (this.errorStarted || this.errorLoading || this.errorHost) {
            return;
        }
        Game.loopCycle++;
        if (this.ingame) {
            await this.updateGame();
        } else {
            await this.updateTitleScreen();
        }
    };

    draw = async (): Promise<void> => {
        if (this.errorStarted || this.errorLoading || this.errorHost) {
            this.drawError();
            return;
        }
        if (this.ingame) {
            this.drawGame();
        } else {
            await this.drawTitleScreen(false);
        }
        this.dragCycles = 0;
    };

    refresh = (): void => {
        this.redrawTitleBackground = true;
    };

    showProgress = async (progress: number, str: string): Promise<void> => {
        console.log(`${progress}%: ${str}`);

        await this.loadTitle();
        if (!this.titleArchive) {
            await super.showProgress(progress, str);
            return;
        }

        this.imageTitle4?.bind();

        const x: number = 360;
        const y: number = 200;

        const offsetY: number = 20;
        this.fontBold12?.drawStringCenter((x / 2) | 0, ((y / 2) | 0) - offsetY - 26, 'RuneScape is loading - please wait...', Colors.WHITE);
        const midY: number = ((y / 2) | 0) - 18 - offsetY;

        Draw2D.drawRect(((x / 2) | 0) - 152, midY, 304, 34, Colors.PROGRESS_RED);
        Draw2D.drawRect(((x / 2) | 0) - 151, midY + 1, 302, 32, Colors.BLACK);
        Draw2D.fillRect(((x / 2) | 0) - 150, midY + 2, progress * 3, 30, Colors.PROGRESS_RED);
        Draw2D.fillRect(((x / 2) | 0) - 150 + progress * 3, midY + 2, 300 - progress * 3, 30, Colors.BLACK);

        this.fontBold12?.drawStringCenter((x / 2) | 0, ((y / 2) | 0) + 5 - offsetY, str, Colors.WHITE);
        this.imageTitle4?.draw(202, 171);

        if (this.redrawTitleBackground) {
            this.redrawTitleBackground = false;
            if (!this.flameActive) {
                this.imageTitle0?.draw(0, 0);
                this.imageTitle1?.draw(637, 0);
            }
            this.imageTitle2?.draw(128, 0);
            this.imageTitle3?.draw(202, 371);
            this.imageTitle5?.draw(0, 265);
            this.imageTitle6?.draw(562, 265);
            this.imageTitle7?.draw(128, 171);
            this.imageTitle8?.draw(562, 171);
        }

        await sleep(5); // return a slice of time to the main loop so it can update the progress bar
    };

    runFlames = (): void => {
        if (!this.flameActive) {
            return;
        }
        this.updateFlames();
        this.updateFlames();
        this.drawFlames();
    };

    private loadTitle = async (): Promise<void> => {
        if (!this.imageTitle2) {
            this.areaChatback = null;
            this.areaMapback = null;
            this.areaSidebar = null;
            this.areaViewport = null;
            this.areaBackbase1 = null;
            this.areaBackbase2 = null;
            this.areaBackhmid1 = null;

            this.imageTitle0 = new PixMap(128, 265);
            Draw2D.clear();

            this.imageTitle1 = new PixMap(128, 265);
            Draw2D.clear();

            this.imageTitle2 = new PixMap(509, 171);
            Draw2D.clear();

            this.imageTitle3 = new PixMap(360, 132);
            Draw2D.clear();

            this.imageTitle4 = new PixMap(360, 200);
            Draw2D.clear();

            this.imageTitle5 = new PixMap(202, 238);
            Draw2D.clear();

            this.imageTitle6 = new PixMap(203, 238);
            Draw2D.clear();

            this.imageTitle7 = new PixMap(74, 94);
            Draw2D.clear();

            this.imageTitle8 = new PixMap(75, 94);
            Draw2D.clear();

            if (this.titleArchive) {
                await this.loadTitleBackground();
                this.loadTitleImages();
            }
            this.redrawTitleBackground = true;
        }
    };

    private loadTitleBackground = async (): Promise<void> => {
        if (!this.titleArchive) {
            return;
        }
        const background: Pix24 = await Pix24.fromJpeg(this.titleArchive, 'title');

        this.imageTitle0?.bind();
        background.blitOpaque(0, 0);

        this.imageTitle1?.bind();
        background.blitOpaque(-637, 0);

        this.imageTitle2?.bind();
        background.blitOpaque(-128, 0);

        this.imageTitle3?.bind();
        background.blitOpaque(-202, -371);

        this.imageTitle4?.bind();
        background.blitOpaque(-202, -171);

        this.imageTitle5?.bind();
        background.blitOpaque(0, -265);

        this.imageTitle6?.bind();
        background.blitOpaque(-562, -265);

        this.imageTitle7?.bind();
        background.blitOpaque(-128, -171);

        this.imageTitle8?.bind();
        background.blitOpaque(-562, -171);

        // draw right side (mirror image)
        background.flipHorizontally();

        this.imageTitle0?.bind();
        background.blitOpaque(382, 0);

        this.imageTitle1?.bind();
        background.blitOpaque(-255, 0);

        this.imageTitle2?.bind();
        background.blitOpaque(254, 0);

        this.imageTitle3?.bind();
        background.blitOpaque(180, -371);

        this.imageTitle4?.bind();
        background.blitOpaque(180, -171);

        this.imageTitle5?.bind();
        background.blitOpaque(382, -265);

        this.imageTitle6?.bind();
        background.blitOpaque(-180, -265);

        this.imageTitle7?.bind();
        background.blitOpaque(254, -171);

        this.imageTitle8?.bind();
        background.blitOpaque(-180, -171);

        const logo: Pix24 = Pix24.fromArchive(this.titleArchive, 'logo');
        this.imageTitle2?.bind();
        logo.draw(((this.width / 2) | 0) - ((logo.width / 2) | 0) - 128, 18);
    };

    private updateFlameBuffer = (image: Pix8 | null): void => {
        if (!this.flameBuffer0 || !this.flameBuffer1) {
            return;
        }

        const flameHeight: number = 256;

        // Clears the initial flame buffer
        this.flameBuffer0.fill(0);

        // Blends the fire at random
        for (let i: number = 0; i < 5000; i++) {
            const rand: number = (Math.random() * 128.0 * flameHeight) | 0;
            this.flameBuffer0[rand] = (Math.random() * 256.0) | 0;
        }

        // changes color between last few flames
        for (let i: number = 0; i < 20; i++) {
            for (let y: number = 1; y < flameHeight - 1; y++) {
                for (let x: number = 1; x < 127; x++) {
                    const index: number = x + (y << 7);
                    this.flameBuffer1[index] = ((this.flameBuffer0[index - 1] + this.flameBuffer0[index + 1] + this.flameBuffer0[index - 128] + this.flameBuffer0[index + 128]) / 4) | 0;
                }
            }

            const last: Int32Array = this.flameBuffer0;
            this.flameBuffer0 = this.flameBuffer1;
            this.flameBuffer1 = last;
        }

        // Renders the rune images
        if (image) {
            let off: number = 0;

            for (let y: number = 0; y < image.height; y++) {
                for (let x: number = 0; x < image.width; x++) {
                    if (image.pixels[off++] !== 0) {
                        const x0: number = x + image.cropX + 16;
                        const y0: number = y + image.cropY + 16;
                        const index: number = x0 + (y0 << 7);
                        this.flameBuffer0[index] = 0;
                    }
                }
            }
        }
    };

    private loadTitleImages = (): void => {
        if (!this.titleArchive) {
            return;
        }
        this.imageTitlebox = Pix8.fromArchive(this.titleArchive, 'titlebox');
        this.imageTitlebutton = Pix8.fromArchive(this.titleArchive, 'titlebutton');
        for (let i: number = 0; i < 12; i++) {
            this.imageRunes[i] = Pix8.fromArchive(this.titleArchive, 'runes', i);
        }
        this.imageFlamesLeft = new Pix24(128, 265);
        this.imageFlamesRight = new Pix24(128, 265);

        if (this.imageTitle0) arraycopy(this.imageTitle0.pixels, 0, this.imageFlamesLeft.pixels, 0, 33920);
        if (this.imageTitle1) arraycopy(this.imageTitle1.pixels, 0, this.imageFlamesRight.pixels, 0, 33920);

        this.flameGradient0 = new Int32Array(256);
        for (let index: number = 0; index < 64; index++) {
            this.flameGradient0[index] = index * 262144;
        }
        for (let index: number = 0; index < 64; index++) {
            this.flameGradient0[index + 64] = index * 1024 + Colors.RED;
        }
        for (let index: number = 0; index < 64; index++) {
            this.flameGradient0[index + 128] = index * 4 + Colors.YELLOW;
        }
        for (let index: number = 0; index < 64; index++) {
            this.flameGradient0[index + 192] = Colors.WHITE;
        }
        this.flameGradient1 = new Int32Array(256);
        for (let index: number = 0; index < 64; index++) {
            this.flameGradient1[index] = index * 1024;
        }
        for (let index: number = 0; index < 64; index++) {
            this.flameGradient1[index + 64] = index * 4 + Colors.GREEN;
        }
        for (let index: number = 0; index < 64; index++) {
            this.flameGradient1[index + 128] = index * 262144 + Colors.CYAN;
        }
        for (let index: number = 0; index < 64; index++) {
            this.flameGradient1[index + 192] = Colors.WHITE;
        }
        this.flameGradient2 = new Int32Array(256);
        for (let index: number = 0; index < 64; index++) {
            this.flameGradient2[index] = index * 4;
        }
        for (let index: number = 0; index < 64; index++) {
            this.flameGradient2[index + 64] = index * 262144 + Colors.BLUE;
        }
        for (let index: number = 0; index < 64; index++) {
            this.flameGradient2[index + 128] = index * 1024 + Colors.MAGENTA;
        }
        for (let index: number = 0; index < 64; index++) {
            this.flameGradient2[index + 192] = Colors.WHITE;
        }

        this.flameGradient = new Int32Array(256);
        this.flameBuffer0 = new Int32Array(32768);
        this.flameBuffer1 = new Int32Array(32768);
        this.updateFlameBuffer(null);
        this.flameBuffer3 = new Int32Array(32768);
        this.flameBuffer2 = new Int32Array(32768);

        this.showProgress(10, 'Connecting to fileserver').then((): void => {
            if (!this.flameActive) {
                this.flameActive = true;
                this.flamesInterval = setInterval(this.runFlames, 35);
            }
        });
    };

    private updateTitleScreen = async (): Promise<void> => {
        if (this.titleScreenState === 0) {
            let x: number = ((this.width / 2) | 0) - 80;
            let y: number = ((this.height / 2) | 0) + 20;

            y += 20;
            if (this.mouseClickButton === 1 && this.mouseClickX >= x - 75 && this.mouseClickX <= x + 75 && this.mouseClickY >= y - 20 && this.mouseClickY <= y + 20) {
                if (+Client.getParameter('world') >= 998) {
                    this.exchangeSDP();
                    return;
                }

                this.titleScreenState = 3;
                this.titleLoginField = 0;
            }

            x = ((this.width / 2) | 0) + 80;
            if (this.mouseClickButton === 1 && this.mouseClickX >= x - 75 && this.mouseClickX <= x + 75 && this.mouseClickY >= y - 20 && this.mouseClickY <= y + 20) {
                this.loginMessage0 = '';
                this.loginMessage1 = 'Enter your username & password.';
                this.titleScreenState = 2;
                this.titleLoginField = 0;
            }
        } else if (this.titleScreenState === 2) {
            let y: number = ((this.height / 2) | 0) - 40;
            y += 30;
            y += 25;

            if (this.mouseClickButton === 1 && this.mouseClickY >= y - 15 && this.mouseClickY < y) {
                this.titleLoginField = 0;
            }
            y += 15;

            if (this.mouseClickButton === 1 && this.mouseClickY >= y - 15 && this.mouseClickY < y) {
                this.titleLoginField = 1;
            }

            let buttonX: number = ((this.width / 2) | 0) - 80;
            let buttonY: number = ((this.height / 2) | 0) + 50;
            buttonY += 20;

            if (this.mouseClickButton === 1 && this.mouseClickX >= buttonX - 75 && this.mouseClickX <= buttonX + 75 && this.mouseClickY >= buttonY - 20 && this.mouseClickY <= buttonY + 20) {
                this.loginAttempts = 0;
                await this.login(this.username, this.password, false);
            }

            buttonX = ((this.width / 2) | 0) + 80;
            if (this.mouseClickButton === 1 && this.mouseClickX >= buttonX - 75 && this.mouseClickX <= buttonX + 75 && this.mouseClickY >= buttonY - 20 && this.mouseClickY <= buttonY + 20) {
                this.titleScreenState = 0;
                this.username = '';
                this.password = '';
            }

            // eslint-disable-next-line no-constant-condition
            while (true) {
                const key: number = this.pollKey();
                if (key === -1) {
                    return;
                }

                let valid: boolean = false;
                for (let i: number = 0; i < PixFont.CHARSET.length; i++) {
                    if (String.fromCharCode(key) === PixFont.CHARSET.charAt(i)) {
                        valid = true;
                        break;
                    }
                }

                if (this.titleLoginField === 0) {
                    if (key === 8 && this.username.length > 0) {
                        this.username = this.username.substring(0, this.username.length - 1);
                    }

                    if (key === 9 || key === 10 || key === 13) {
                        this.titleLoginField = 1;
                    }

                    if (valid) {
                        this.username = this.username + String.fromCharCode(key);
                    }

                    if (this.username.length > 12) {
                        this.username = this.username.substring(0, 12);
                    }
                } else if (this.titleLoginField === 1) {
                    if (key === 8 && this.password.length > 0) {
                        this.password = this.password.substring(0, this.password.length - 1);
                    }

                    if (key === 9 || key === 10 || key === 13) {
                        this.titleLoginField = 0;
                    }

                    if (valid) {
                        this.password = this.password + String.fromCharCode(key);
                    }

                    if (this.password.length > 20) {
                        this.password = this.password.substring(0, 20);
                    }
                }
            }
        } else if (this.titleScreenState === 3) {
            const x: number = (this.width / 2) | 0;
            let y: number = ((this.height / 2) | 0) + 50;
            y += 20;

            if (this.mouseClickButton === 1 && this.mouseClickX >= x - 75 && this.mouseClickX <= x + 75 && this.mouseClickY >= y - 20 && this.mouseClickY <= y + 20) {
                this.titleScreenState = 0;
            }
        }
    };

    private drawTitleScreen = async (hideButtons: boolean): Promise<void> => {
        await this.loadTitle();
        this.imageTitle4?.bind();
        this.imageTitlebox?.draw(0, 0);

        const w: number = 360;
        const h: number = 200;

        if (this.titleScreenState === 0) {
            let x: number = (w / 2) | 0;
            let y: number = ((h / 2) | 0) - 20;
            this.fontBold12?.drawStringTaggableCenter(x, y, 'Welcome to RuneScape', Colors.YELLOW, true);

            x = ((w / 2) | 0) - 80;
            y = ((h / 2) | 0) + 20;
            this.imageTitlebutton?.draw(x - 73, y - 20);
            this.fontBold12?.drawStringTaggableCenter(x, y + 5, 'New user', Colors.WHITE, true);

            x = ((w / 2) | 0) + 80;
            this.imageTitlebutton?.draw(x - 73, y - 20);
            this.fontBold12?.drawStringTaggableCenter(x, y + 5, 'Existing User', Colors.WHITE, true);
        } else if (this.titleScreenState === 2) {
            let x: number = ((w / 2) | 0) - 80;
            let y: number = ((h / 2) | 0) - 40;
            if (this.loginMessage0.length > 0) {
                this.fontBold12?.drawStringTaggableCenter(w / 2, y - 15, this.loginMessage0, Colors.YELLOW, true);
                this.fontBold12?.drawStringTaggableCenter(w / 2, y, this.loginMessage1, Colors.YELLOW, true);
                y += 30;
            } else {
                this.fontBold12?.drawStringTaggableCenter(w / 2, y - 7, this.loginMessage1, Colors.YELLOW, true);
                y += 30;
            }

            this.fontBold12?.drawStringTaggable(w / 2 - 90, y, `Username: ${this.username}${this.titleLoginField === 0 && Game.loopCycle % 40 < 20 ? '@yel@|' : ''}`, Colors.WHITE, true);
            y += 15;

            this.fontBold12?.drawStringTaggable(w / 2 - 88, y, `Password: ${JString.toAsterisks(this.password)}${this.titleLoginField === 1 && Game.loopCycle % 40 < 20 ? '@yel@|' : ''}`, Colors.WHITE, true);

            if (!hideButtons) {
                // x = w / 2 - 80; dead code
                y = ((h / 2) | 0) + 50;
                this.imageTitlebutton?.draw(x - 73, y - 20);
                this.fontBold12?.drawStringTaggableCenter(x, y + 5, 'Login', Colors.WHITE, true);

                x = ((w / 2) | 0) + 80;
                this.imageTitlebutton?.draw(x - 73, y - 20);
                this.fontBold12?.drawStringTaggableCenter(x, y + 5, 'Cancel', Colors.WHITE, true);
            }
        } else if (this.titleScreenState === 3) {
            this.fontBold12?.drawStringTaggableCenter(w / 2, h / 2 - 60, 'Create a free account', Colors.YELLOW, true);

            const x: number = (w / 2) | 0;
            let y: number = ((h / 2) | 0) - 35;

            this.fontBold12?.drawStringTaggableCenter((w / 2) | 0, y, 'To create a new account you need to', Colors.WHITE, true);
            y += 15;

            this.fontBold12?.drawStringTaggableCenter((w / 2) | 0, y, 'go back to the main RuneScape webpage', Colors.WHITE, true);
            y += 15;

            this.fontBold12?.drawStringTaggableCenter((w / 2) | 0, y, "and choose the red 'create account'", Colors.WHITE, true);
            y += 15;

            this.fontBold12?.drawStringTaggableCenter((w / 2) | 0, y, 'button at the top right of that page.', Colors.WHITE, true);
            // y += 15; dead code

            y = ((h / 2) | 0) + 50;
            this.imageTitlebutton?.draw(x - 73, y - 20);
            this.fontBold12?.drawStringTaggableCenter(x, y + 5, 'Cancel', Colors.WHITE, true);
        }

        this.imageTitle4?.draw(202, 171);
        if (this.redrawTitleBackground) {
            this.redrawTitleBackground = false;
            this.imageTitle2?.draw(128, 0);
            this.imageTitle3?.draw(202, 371);
            this.imageTitle5?.draw(0, 265);
            this.imageTitle6?.draw(562, 265);
            this.imageTitle7?.draw(128, 171);
            this.imageTitle8?.draw(562, 171);
        }
    };

    private login = async (username: string, password: string, reconnect: boolean): Promise<void> => {
        try {
            if (!reconnect) {
                this.loginMessage0 = '';
                this.loginMessage1 = 'Connecting to server...';
                await this.drawTitleScreen(true);
            }
            if (Game.getParameter('world') === '998') {
                if (this.peer && !this.peer.dc) {
                    this.loginMessage0 = 'You are not connected to a host.';
                    this.loginMessage1 = 'Please try using world 999.';
                    return;
                }
                this.stream = new ClientWorkerStream(this.worker!, this.peer!.uniqueId!);
            } else if (Game.getParameter('world') === '999') {
                if (!this.workerReady) {
                    this.loginMessage0 = 'The server is starting up.';
                    this.loginMessage1 = 'Please try again in a moment.';
                    return;
                }
                this.stream = new ClientWorkerStream(this.worker!, this.host!.uniqueId);
            } else {
                this.stream = new ClientStream(await ClientStream.openSocket({host: Client.serverAddress, port: 43594 + Client.portOffset}));
            }

            const name37: bigint = JString.toBase37(username);
            const namePart: number = Number((name37 >> 16n) & 31n);
            this.out.pos = 0;
            this.out.p1(14);
            this.out.p1(namePart);
            this.stream.write(this.out.data, 0, 2);

            for (let j: number = 0; j < 8; j++) {
                await this.stream.read();
            }

            let reply: number = await this.stream.read();
            const lastReply: number = reply;
            if (reply === 0) {
                await this.stream?.readBytes(this.in.data, 0, 8);
                this.in.pos = 0;
                this.serverSeed = this.in.g8;
                const seed: Int32Array = new Int32Array([Math.floor(Math.random() * 99999999), Math.floor(Math.random() * 99999999), Number(this.serverSeed >> 32n), Number(this.serverSeed & BigInt(0xffffffff))]);
                this.out.pos = 0;
                this.out.p1(10);
                this.out.p4(seed[0]);
                this.out.p4(seed[1]);
                this.out.p4(seed[2]);
                this.out.p4(seed[3]);
                this.out.p4(1); // TODO signlink UUID, changed to 1 for avoiding emulous anti flood
                this.out.pjstr(username);
                this.out.pjstr(password);
                this.out.rsaenc(Client.modulus, Client.exponent);
                this.loginout.pos = 0;
                this.loginout.p1(reconnect ? 18 : 16);
                this.loginout.p1(this.out.pos + 36 + 1 + 1 + 2);
                this.loginout.p1(255);
                this.loginout.p2(Client.clientversion);
                this.loginout.p1(Client.lowMemory ? 1 : 0);
                for (let i: number = 0; i < 9; i++) {
                    this.loginout.p4(this.archiveChecksums[i]);
                }

                this.loginout.pdata(this.out.data, this.out.pos, 0);
                this.out.random = new Isaac(seed);
                for (let i: number = 0; i < 4; i++) {
                    seed[i] += 50;
                }

                this.randomIn = new Isaac(seed);
                this.stream?.write(this.loginout.data, 0, this.loginout.pos);
                reply = await this.stream.read();
            }

            if (reply === 1) {
                await sleep(2000);
                await this.login(username, password, reconnect);
                return;
            }
            if (reply === 2 || reply === 18) {
                // TODO: check this
                this.rights = await this.stream.read();
                this.flagged = (await this.stream.read()) === 1;
                this.ingame = true;
                this.out.pos = 0;
                this.in.pos = 0;
                this.packetType = -1;
                this.lastPacketType0 = -1;
                this.lastPacketType1 = -1;
                this.lastPacketType2 = -1;
                this.packetSize = 0;
                this.idleNetCycles = 0;
                this.systemUpdateTimer = 0;
                this.idleTimeout = 0;
                this.hintType = 0;
                this.menuSize = 0;
                this.menuVisible = false;
                this.idleCycles = Date.now();
                for (let i: number = 0; i < 100; i++) {
                    this.messageText[i] = null;
                }
                this.objSelected = 0;
                this.spellSelected = 0;
                this.sceneState = 0;
                this.waveCount = 0;
                this.cameraAnticheatOffsetX = ((Math.random() * 100.0) | 0) - 50;
                this.cameraAnticheatOffsetZ = ((Math.random() * 110.0) | 0) - 55;
                this.cameraAnticheatAngle = ((Math.random() * 80.0) | 0) - 40;
                this.minimapAnticheatAngle = ((Math.random() * 120.0) | 0) - 60;
                this.minimapZoom = ((Math.random() * 30.0) | 0) - 20;
                this.orbitCameraYaw = (((Math.random() * 20.0) | 0) - 10) & 0x7ff;
                this.minimapState = 0;
                this.minimapLevel = -1;
                this.flagSceneTileX = 0;
                this.flagSceneTileZ = 0;
                this.playerCount = 0;
                this.npcCount = 0;
                for (let i: number = 0; i < this.MAX_PLAYER_COUNT; i++) {
                    this.players[i] = null;
                    this.playerAppearanceBuffer[i] = null;
                }
                for (let i: number = 0; i < 16384; i++) {
                    this.npcs[i] = null;
                }
                this.localPlayer = this.players[this.LOCAL_PLAYER_INDEX] = new PlayerEntity();
                this.projectiles.clear();
                this.spotanims.clear();
                for (let level: number = 0; level < CollisionMap.LEVELS; level++) {
                    for (let x: number = 0; x < CollisionMap.SIZE; x++) {
                        for (let z: number = 0; z < CollisionMap.SIZE; z++) {
                            this.levelObjStacks[level][x][z] = null;
                        }
                    }
                }
                this.temporaryLocs = new LinkList();
                this.friendlistStatus = 0;
                this.friendCount = 0;
                this.stickyChatInterfaceId = -1;
                this.chatInterfaceId = -1;
                this.viewportInterfaceId = -1;
                this.sidebarInterfaceId = -1;
                this.viewportOverlayInterfaceId = -1;
                this.pressedContinueOption = false;
                this.selectedTab = 3;
                this.chatbackInputType = 0;
                this.menuVisible = false;
                this.showSocialInput = false;
                this.modalMessage = null;
                this.inMultizone = 0;
                this.flashingTab = -1;
                this.designGenderMale = true;
                this.validateCharacterDesign();
                for (let i: number = 0; i < 5; i++) {
                    this.designColors[i] = 0;
                }
                stopMidi(true); // custom fix :-)
                this.prepareGameScreen();
                return;
            }
            if (reply === 3) {
                this.loginMessage0 = '';
                this.loginMessage1 = 'Invalid username or password.';
                return;
            }
            if (reply === 4) {
                this.loginMessage0 = 'Your account has been disabled.';
                this.loginMessage1 = 'Please check your message-centre for details.';
                return;
            }
            if (reply === 5) {
                this.loginMessage0 = 'Your account is already logged in.';
                this.loginMessage1 = 'Try again in 60 secs...';
                return;
            }
            if (reply === 6) {
                this.loginMessage0 = 'RuneScape has been updated!';
                this.loginMessage1 = 'Please reload this page.';
                return;
            }
            if (reply === 7) {
                this.loginMessage0 = 'This world is full.';
                this.loginMessage1 = 'Please use a different world.';
                return;
            }
            if (reply === 8) {
                this.loginMessage0 = 'Unable to connect.';
                this.loginMessage1 = 'Login server offline.';
                return;
            }
            if (reply === 9) {
                this.loginMessage0 = 'Login limit exceeded.';
                this.loginMessage1 = 'Too many connections from your address.';
                return;
            }
            if (reply === 10) {
                this.loginMessage0 = 'Unable to connect.';
                this.loginMessage1 = 'Bad session id.';
                return;
            }
            if (reply === 11) {
                this.loginMessage1 = 'Login server rejected session.';
                this.loginMessage1 = 'Please try again.';
                return;
            }
            if (reply === 12) {
                this.loginMessage0 = 'You need a members account to login to this world.';
                this.loginMessage1 = 'Please subscribe, or use a different world.';
                return;
            }
            if (reply === 13) {
                this.loginMessage0 = 'Could not complete login.';
                this.loginMessage1 = 'Please try using a different world.';
                return;
            }
            if (reply === 14) {
                this.loginMessage0 = 'The server is being updated.';
                this.loginMessage1 = 'Please wait 1 minute and try again.';
                return;
            }
            if (reply === 15) {
                this.ingame = true;
                this.out.pos = 0;
                this.in.pos = 0;
                this.packetType = -1;
                this.lastPacketType0 = -1;
                this.lastPacketType1 = -1;
                this.lastPacketType2 = -1;
                this.packetSize = 0;
                this.idleNetCycles = 0;
                this.systemUpdateTimer = 0;
                this.menuSize = 0;
                this.menuVisible = false;
                this.sceneLoadStartTime = Date.now();
                return;
            }
            if (reply === 16) {
                this.loginMessage0 = 'Login attempts exceeded.';
                this.loginMessage1 = 'Please wait 1 minute and try again.';
                return;
            }
            if (reply === 17) {
                this.loginMessage0 = 'You are standing in a members-only area.';
                this.loginMessage1 = 'To play on this world move to a free area first';
                return;
            }
            if (reply === 20) {
                this.loginMessage0 = 'Invalid loginserver requested';
                this.loginMessage1 = 'Please try using a different world.';
                return;
            }
            if (reply === 21) {
                for (let remaining: number = await this.stream.read(); remaining >= 0; remaining--) {
                    this.loginMessage0 = 'You have only just left another world';
                    this.loginMessage1 = 'Your profile will be transferred in: ' + remaining + ' seconds';
                    this.drawTitleScreen(true);

                    await sleep(1000);
                }
                this.login(username, password, reconnect);
                return;
            }
            if (reply === -1) {
                if (lastReply == 0) {
                    if (this.loginAttempts < 2) {
                        await sleep(2000);
                        this.loginAttempts++;
                        this.login(username, password, reconnect);
                    } else {
                        this.loginMessage0 = 'No response from loginserver';
                        this.loginMessage1 = 'Please wait 1 minute and try again.';
                    }
                } else {
                    this.loginMessage0 = 'No response from server';
                    this.loginMessage1 = 'Please try using a different world.';
                }
            } else {
                console.log('response:' + reply);
                this.loginMessage0 = 'Unexpected server response';
                this.loginMessage1 = 'Please try using a different world.';
            }
        } catch (err) {
            console.log(err);
            this.loginMessage0 = '';
            this.loginMessage1 = 'Error connecting to server.';
        }
    };

    private updateGame = async (): Promise<void> => {
        if (this.players === null) {
            // client is unloading asynchronously
            return;
        }

        if (this.systemUpdateTimer > 1) {
            this.systemUpdateTimer--;
        }

        if (this.idleTimeout > 0) {
            this.idleTimeout--;
        }

        for (let i: number = 0; i < 5 && (await this.read()); i++) {
            /* empty */
        }

        if (this.ingame) {
            // this.updateAnticheats(); // TODO
            if (Client.lowMemory && this.sceneState === 2 && World.levelBuilt !== this.currentLevel) {
                this.areaViewport?.bind();
                this.fontPlain12?.drawStringCenter(257, 151, 'Loading - please wait.', Colors.BLACK);
                this.fontPlain12?.drawStringCenter(256, 150, 'Loading - please wait.', Colors.WHITE);
                this.areaViewport?.draw(4, 4);
                this.sceneState = 1;
                this.sceneLoadStartTime = Date.now();
            }
            if (this.sceneState === 1) {
                const state: number = this.checkScene();

                if (state !== 0 && Date.now() - this.sceneLoadStartTime > 360000n) {
                    console.error(
                        this.username +
                            ' glcfb ' +
                            this.serverSeed +
                            ',' +
                            this.state +
                            ',' +
                            Client.lowMemory +
                            ',' +
                            Game.jagStore[0] +
                            ',' +
                            this.ondemand?.remaining() +
                            ',' +
                            this.currentLevel +
                            ',' +
                            this.sceneCenterZoneX +
                            ',' +
                            this.sceneCenterZoneZ
                    );
                    this.sceneLoadStartTime = Date.now();
                }
            }
            if (this.currentLevel !== this.minimapLevel && this.sceneState === 2) {
                this.minimapLevel = this.currentLevel;
                this.createMinimap(this.currentLevel);
            }
            this.updateTemporaryLocs();

            for (let wave: number = 0; wave < this.waveCount; wave++) {
                if (this.waveDelay[wave] <= 0) {
                    try {
                        // if (this.waveIds[wave] !== this.lastWaveId || this.waveLoops[wave] !== this.lastWaveLoops) {
                        // TODO: reuse buffer?
                        const buf: Packet | null = Wave.generate(this.waveIds[wave], this.waveLoops[wave]);
                        console.log(buf);
                        if (!buf) {
                            throw new Error();
                        }

                        if (Date.now() + ((buf.pos / 22) | 0) > this.lastWaveStartTime + ((this.lastWaveLength / 22) | 0)) {
                            this.lastWaveLength = buf.pos;
                            this.lastWaveStartTime = Date.now();
                            this.lastWaveId = this.waveIds[wave];
                            this.lastWaveLoops = this.waveLoops[wave];
                            await playWave(buf.data.slice(0, buf.pos), this.waveVolume);
                        }
                        // else if (!this.waveReplay()) { // this logic just re-plays the old buffer
                    } catch (e) {
                        console.error(e);
                        /* empty */
                    }

                    // remove current wave
                    this.waveCount--;
                    for (let i: number = wave; i < this.waveCount; i++) {
                        this.waveIds[i] = this.waveIds[i + 1];
                        this.waveLoops[i] = this.waveLoops[i + 1];
                        this.waveDelay[i] = this.waveDelay[i + 1];
                    }
                    wave--;
                } else {
                    this.waveDelay[wave]--;
                }
            }

            if (this.nextMusicDelay > 0) {
                this.nextMusicDelay -= 20;

                if (this.nextMusicDelay < 0) {
                    this.nextMusicDelay = 0;
                }

                if (this.nextMusicDelay === 0 && this.midiActive && !Client.lowMemory && this.currentMidi) {
                    // TODO
                    // await this.setMidi(this.currentMidi, this.midiCrc, this.midiSize, false);

                    this.currentMidi = this.nextMidi;
                    await this.setMidi(this.currentMidi, true);
                }
            }

            this.idleNetCycles++;
            if (this.idleNetCycles > 750) {
                await this.tryReconnect();
            }

            this.updatePlayers();
            this.updateNpcs();
            this.updateEntityChats();

            this.sceneDelta++;
            if (this.crossMode !== 0) {
                this.crossCycle += 20;
                if (this.crossCycle >= 400) {
                    this.crossMode = 0;
                }
            }

            if (this.selectedArea !== 0) {
                this.selectedCycle++;
                if (this.selectedCycle >= 15) {
                    if (this.selectedArea === 2) {
                        this.redrawSidebar = true;
                    }
                    if (this.selectedArea === 3) {
                        this.redrawChatback = true;
                    }
                    this.selectedArea = 0;
                }
            }

            if (this.objDragArea !== 0) {
                this.objDragCycles++;
                if (this.mouseX > this.objGrabX + 5 || this.mouseX < this.objGrabX - 5 || this.mouseY > this.objGrabY + 5 || this.mouseY < this.objGrabY - 5) {
                    this.objGrabThreshold = true;
                }

                if (this.mouseButton === 0) {
                    if (this.objDragArea === 2) {
                        this.redrawSidebar = true;
                    }
                    if (this.objDragArea === 3) {
                        this.redrawChatback = true;
                    }

                    this.objDragArea = 0;
                    if (this.objGrabThreshold && this.objDragCycles >= 5) {
                        this.hoveredSlotParentId = -1;
                        this.handleInput();
                        if (this.hoveredSlotParentId === this.objDragInterfaceId && this.hoveredSlot !== this.objDragSlot) {
                            const com: Component = Component.instances[this.objDragInterfaceId];

                            let mode: number = 0;
                            if (this.bankArrangeMode === 1 && com.clientCode === 206) {
                                mode = 1;
                            }
                            if (com.invSlotObjId && com.invSlotObjId[this.hoveredSlot] <= 0) {
                                mode = 0;
                            }

                            if (com.invSlotObjId && com.invSlotObjCount && com.moveReplaces) {
                                const src: number = this.objDragSlot;
                                const dst: number = this.hoveredSlot;
                                com.invSlotObjId[dst] = com.invSlotObjId[src];
                                com.invSlotObjCount[dst] = com.invSlotObjCount[src];
                                com.invSlotObjId[src] = -1;
                                com.invSlotObjCount[src] = 0;
                            } else if (mode === 1) {
                                let src: number = this.objDragSlot;
                                for (let dst: number = this.hoveredSlot; src !== dst; ) {
                                    if (src > dst) {
                                        com.inventorySwap(src, src - 1);
                                        src--;
                                    } else {
                                        com.inventorySwap(src, src + 1);
                                        src++;
                                    }
                                }
                            } else {
                                com.inventorySwap(this.objDragSlot, this.hoveredSlot);
                            }

                            this.out.p1isaac(ClientProt.INV_BUTTOND);
                            this.out.p2_alt3(this.objDragInterfaceId);
                            this.out.p1_alt1(mode);
                            this.out.p2_alt3(this.objDragSlot);
                            this.out.p2_alt1(this.hoveredSlot);
                        }
                    } else if ((this.mouseButtonsOption === 1 || this.isAddFriendOption(this.menuSize - 1)) && this.menuSize > 2) {
                        this.showContextMenu();
                    } else if (this.menuSize > 0) {
                        await this.useMenuOption(this.menuSize - 1);
                    }

                    this.selectedCycle = 10;
                    this.mouseClickButton = 0;
                }
            }

            if (World3D.clickTileX !== -1) {
                if (this.localPlayer) {
                    const x: number = World3D.clickTileX;
                    const z: number = World3D.clickTileZ;
                    const success: boolean = this.tryMove(this.localPlayer.pathTileX[0], this.localPlayer.pathTileZ[0], x, z, 0, 0, 0, 0, 0, 0, true);
                    World3D.clickTileX = -1;

                    if (success) {
                        this.crossX = this.mouseClickX;
                        this.crossY = this.mouseClickY;
                        this.crossMode = 1;
                        this.crossCycle = 0;
                    }
                }
            }

            if (this.mouseClickButton === 1 && this.modalMessage) {
                this.modalMessage = null;
                this.redrawChatback = true;
                this.mouseClickButton = 0;
            }

            await this.handleMouseInput(); // this is because of varps that set midi that we have to wait...
            this.handleMinimapInput();
            this.handleTabInput();
            this.handleChatSettingsInput();

            if (this.mouseButton === 1 || this.mouseClickButton === 1) {
                this.dragCycles++;
            }

            if (this.sceneState === 2) {
                if (Client.cameraEditor) {
                    this.updateCameraEditor();
                } else {
                    this.updateOrbitCamera();
                }
            }
            if (this.sceneState === 2 && this.cutscene) {
                this.applyCutscene();
            }

            for (let i: number = 0; i < 5; i++) {
                this.cameraModifierCycle[i]++;
            }

            await this.handleInputKey();
            // idlecycles refactored to use date to circumvent browser throttling the
            // timers when a different tab is active, or the window has been minimized.
            // afk logout has to still happen after 90s of no activity (if allowed).
            // https://developer.chrome.com/blog/timer-throttling-in-chrome-88/
            if (Date.now() - this.idleCycles > 90_000) {
                // 4500 ticks * 20ms = 90000ms
                this.idleTimeout = 250;
                // 500 ticks * 20ms = 10000ms
                this.idleCycles = Date.now() - 10_000;
                this.out.p1isaac(ClientProt.IDLE_TIMER);
            }

            this.heartbeatTimer++;
            if (this.heartbeatTimer > 50) {
                this.out.p1isaac(ClientProt.NO_TIMEOUT);
            }

            try {
                if (this.stream && this.out.pos > 0) {
                    this.stream.write(this.out.data, 0, this.out.pos);
                    this.out.pos = 0;
                    this.heartbeatTimer = 0;
                }
            } catch (e) {
                console.log(e);
                await this.tryReconnect();
                // TODO extra logic for logout??
            }
        }
    };

    private checkScene = (): number => {
        if (this.sceneMapLandData && this.sceneMapLocData && this.sceneMapLandFile && this.sceneMapLocFile) {
            for (let i: number = 0; i < this.sceneMapLandData.length; i++) {
                if (!this.sceneMapLandData[i] && this.sceneMapLandFile[i] !== -1) {
                    return -1;
                }
                if (!this.sceneMapLocData[i] && this.sceneMapLocFile[i] !== -1) {
                    return -2;
                }
            }
        }

        if (!this.isSceneLocsLoaded()) {
            return -3;
        }

        if (this.awaitingSync) {
            return -4;
        }

        this.sceneState = 2;
        World.levelBuilt = this.currentLevel;
        this.buildScene();
        this.out.p1isaac(ClientProt.LOADING_FINISHED);
        return 0;
    };

    private isSceneLocsLoaded = (): number => {
        let ok: number = 1;
        if (this.sceneMapLocData && this.sceneMapIndex) {
            for (let i: number = 0; i < this.sceneMapLocData.length; i++) {
                const data: Int8Array | null = this.sceneMapLocData[i];

                if (data == null) {
                    continue;
                }

                let originX: number = (this.sceneMapIndex[i] >> 8) * 64 - this.sceneBaseTileX;
                let originZ: number = (this.sceneMapIndex[i] & 0xff) * 64 - this.sceneBaseTileZ;

                if (this.sceneInstanced) {
                    originX = 10;
                    originZ = 10;
                }

                ok &= World.validateLocs(data, originX, originZ);
            }
        }
        return ok;
    };

    private drawGame = (): void => {
        if (this.players === null) {
            // client is unloading asynchronously
            return;
        }

        if (this.redrawTitleBackground) {
            this.redrawTitleBackground = false;
            this.areaBackleft1?.draw(0, 4);
            this.areaBackleft2?.draw(0, 357);
            this.areaBackright1?.draw(722, 4);
            this.areaBackright2?.draw(743, 205);
            this.areaBacktop1?.draw(0, 0);
            this.areaBackvmid1?.draw(516, 4);
            this.areaBackvmid2?.draw(516, 205);
            this.areaBackvmid3?.draw(496, 357);
            this.areaBackhmid2?.draw(0, 338);
            this.redrawSidebar = true;
            this.redrawChatback = true;
            this.redrawSideicons = true;
            this.redrawPrivacySettings = true;
            if (this.sceneState !== 2) {
                this.areaViewport?.draw(4, 4);
                this.areaMapback?.draw(550, 4);
            }
        }
        if (this.sceneState === 2) {
            this.drawScene();
        }
        if (this.menuVisible && this.menuArea === 1) {
            this.redrawSidebar = true;
        }
        let redraw: boolean = false;
        if (this.sidebarInterfaceId !== -1) {
            redraw = this.updateInterfaceAnimation(this.sidebarInterfaceId, this.sceneDelta);
            if (redraw) {
                this.redrawSidebar = true;
            }
        }
        if (this.selectedArea === 2) {
            this.redrawSidebar = true;
        }
        if (this.objDragArea === 2) {
            this.redrawSidebar = true;
        }
        if (this.redrawSidebar) {
            this.drawSidebar();
            this.redrawSidebar = false;
        }
        if (this.chatInterfaceId === -1) {
            this.chatInterface.scrollPosition = this.chatScrollHeight - this.chatScrollOffset - 77;
            if (this.mouseX > 448 && this.mouseX < 560 && this.mouseY > 332) {
                this.handleScrollInput(this.mouseX - 17, this.mouseY - 357, this.chatScrollHeight, 77, false, 463, 0, this.chatInterface);
            }

            let offset: number = this.chatScrollHeight - this.chatInterface.scrollPosition - 77;
            if (offset < 0) {
                offset = 0;
            }

            if (offset > this.chatScrollHeight - 77) {
                offset = this.chatScrollHeight - 77;
            }

            if (this.chatScrollOffset !== offset) {
                this.chatScrollOffset = offset;
                this.redrawChatback = true;
            }
        }

        if (this.chatInterfaceId !== -1) {
            redraw = this.updateInterfaceAnimation(this.chatInterfaceId, this.sceneDelta);
            if (redraw) {
                this.redrawChatback = true;
            }
        }

        if (this.selectedArea === 3) {
            this.redrawChatback = true;
        }

        if (this.objDragArea === 3) {
            this.redrawChatback = true;
        }

        if (this.modalMessage) {
            this.redrawChatback = true;
        }

        if (this.menuVisible && this.menuArea === 2) {
            this.redrawChatback = true;
        }

        if (this.redrawChatback) {
            this.drawChatback();
            this.redrawChatback = false;
        }

        if (this.sceneState === 2) {
            this.drawMinimap();
            this.areaMapback?.draw(550, 4);
        }

        if (this.flashingTab !== -1) {
            this.redrawSideicons = true;
        }

        if (this.redrawSideicons) {
            if (this.flashingTab !== -1 && this.flashingTab === this.selectedTab) {
                this.flashingTab = -1;
                this.out.p1isaac(ClientProt.TUTORIAL_CLICKSIDE);
                this.out.p1(this.selectedTab);
            }

            this.redrawSideicons = false;
            this.areaBackhmid1?.bind();
            this.imageBackhmid1?.draw(0, 0);

            if (this.sidebarInterfaceId === -1) {
                if (this.tabInterfaceId[this.selectedTab] !== -1) {
                    if (this.selectedTab === 0) {
                        this.imageRedstone1?.draw(22, 10);
                    } else if (this.selectedTab === 1) {
                        this.imageRedstone2?.draw(54, 8);
                    } else if (this.selectedTab === 2) {
                        this.imageRedstone2?.draw(82, 8);
                    } else if (this.selectedTab === 3) {
                        this.imageRedstone3?.draw(110, 8);
                    } else if (this.selectedTab === 4) {
                        this.imageRedstone2h?.draw(153, 8);
                    } else if (this.selectedTab === 5) {
                        this.imageRedstone2h?.draw(181, 8);
                    } else if (this.selectedTab === 6) {
                        this.imageRedstone1h?.draw(209, 9);
                    }
                }

                if (this.tabInterfaceId[0] !== -1 && (this.flashingTab !== 0 || Game.loopCycle % 20 < 10)) {
                    this.imageSideicons[0]?.draw(29, 13);
                }

                if (this.tabInterfaceId[1] !== -1 && (this.flashingTab !== 1 || Game.loopCycle % 20 < 10)) {
                    this.imageSideicons[1]?.draw(53, 11);
                }

                if (this.tabInterfaceId[2] !== -1 && (this.flashingTab !== 2 || Game.loopCycle % 20 < 10)) {
                    this.imageSideicons[2]?.draw(82, 11);
                }

                if (this.tabInterfaceId[3] !== -1 && (this.flashingTab !== 3 || Game.loopCycle % 20 < 10)) {
                    this.imageSideicons[3]?.draw(115, 12);
                }

                if (this.tabInterfaceId[4] !== -1 && (this.flashingTab !== 4 || Game.loopCycle % 20 < 10)) {
                    this.imageSideicons[4]?.draw(153, 13);
                }

                if (this.tabInterfaceId[5] !== -1 && (this.flashingTab !== 5 || Game.loopCycle % 20 < 10)) {
                    this.imageSideicons[5]?.draw(180, 11);
                }

                if (this.tabInterfaceId[6] !== -1 && (this.flashingTab !== 6 || Game.loopCycle % 20 < 10)) {
                    this.imageSideicons[6]?.draw(208, 13);
                }
            }

            this.areaBackhmid1?.draw(516, 160);
            this.areaBackbase2?.bind();
            this.imageBackbase2?.draw(0, 0);

            if (this.sidebarInterfaceId === -1) {
                if (this.tabInterfaceId[this.selectedTab] !== -1) {
                    if (this.selectedTab === 7) {
                        this.imageRedstone1v?.draw(42, 0);
                    } else if (this.selectedTab === 8) {
                        this.imageRedstone2v?.draw(74, 0);
                    } else if (this.selectedTab === 9) {
                        this.imageRedstone2v?.draw(102, 0);
                    } else if (this.selectedTab === 10) {
                        this.imageRedstone3v?.draw(130, 1);
                    } else if (this.selectedTab === 11) {
                        this.imageRedstone2hv?.draw(173, 0);
                    } else if (this.selectedTab === 12) {
                        this.imageRedstone2hv?.draw(201, 0);
                    } else if (this.selectedTab === 13) {
                        this.imageRedstone1hv?.draw(229, 0);
                    }
                }

                if (this.tabInterfaceId[8] !== -1 && (this.flashingTab !== 8 || Game.loopCycle % 20 < 10)) {
                    this.imageSideicons[7]?.draw(74, 2);
                }

                if (this.tabInterfaceId[9] !== -1 && (this.flashingTab !== 9 || Game.loopCycle % 20 < 10)) {
                    this.imageSideicons[8]?.draw(102, 3);
                }

                if (this.tabInterfaceId[10] !== -1 && (this.flashingTab !== 10 || Game.loopCycle % 20 < 10)) {
                    this.imageSideicons[9]?.draw(137, 4);
                }

                if (this.tabInterfaceId[11] !== -1 && (this.flashingTab !== 11 || Game.loopCycle % 20 < 10)) {
                    this.imageSideicons[10]?.draw(174, 2);
                }

                if (this.tabInterfaceId[12] !== -1 && (this.flashingTab !== 12 || Game.loopCycle % 20 < 10)) {
                    this.imageSideicons[11]?.draw(201, 2);
                }

                if (this.tabInterfaceId[13] !== -1 && (this.flashingTab !== 13 || Game.loopCycle % 20 < 10)) {
                    this.imageSideicons[12]?.draw(226, 2);
                }
            }
            this.areaBackbase2?.draw(496, 466);
            this.areaViewport?.bind();
        }

        if (this.redrawPrivacySettings) {
            this.redrawPrivacySettings = false;
            this.areaBackbase1?.bind();
            this.imageBackbase1?.draw(0, 0);

            this.fontPlain12?.drawStringTaggableCenter(55, 28, 'Public chat', Colors.WHITE, true);
            if (this.publicChatSetting === 0) {
                this.fontPlain12?.drawStringTaggableCenter(55, 41, 'On', Colors.GREEN, true);
            }
            if (this.publicChatSetting === 1) {
                this.fontPlain12?.drawStringTaggableCenter(55, 41, 'Friends', Colors.YELLOW, true);
            }
            if (this.publicChatSetting === 2) {
                this.fontPlain12?.drawStringTaggableCenter(55, 41, 'Off', Colors.RED, true);
            }
            if (this.publicChatSetting === 3) {
                this.fontPlain12?.drawStringTaggableCenter(55, 41, 'Hide', Colors.CYAN, true);
            }

            this.fontPlain12?.drawStringTaggableCenter(184, 28, 'Private chat', Colors.WHITE, true);
            if (this.privateChatSetting === 0) {
                this.fontPlain12?.drawStringTaggableCenter(184, 41, 'On', Colors.GREEN, true);
            }
            if (this.privateChatSetting === 1) {
                this.fontPlain12?.drawStringTaggableCenter(184, 41, 'Friends', Colors.YELLOW, true);
            }
            if (this.privateChatSetting === 2) {
                this.fontPlain12?.drawStringTaggableCenter(184, 41, 'Off', Colors.RED, true);
            }

            this.fontPlain12?.drawStringTaggableCenter(324, 28, 'Trade/compete', Colors.WHITE, true);
            if (this.tradeChatSetting === 0) {
                this.fontPlain12?.drawStringTaggableCenter(324, 41, 'On', Colors.GREEN, true);
            }
            if (this.tradeChatSetting === 1) {
                this.fontPlain12?.drawStringTaggableCenter(324, 41, 'Friends', Colors.YELLOW, true);
            }
            if (this.tradeChatSetting === 2) {
                this.fontPlain12?.drawStringTaggableCenter(324, 41, 'Off', Colors.RED, true);
            }

            this.fontPlain12?.drawStringTaggableCenter(458, 33, 'Report abuse', Colors.WHITE, true);
            this.areaBackbase1?.draw(0, 453);
            this.areaViewport?.bind();
        }

        this.sceneDelta = 0;
    };

    private drawScene = (): void => {
        this.sceneCycle++;
        // TODO local player/npc
        this.pushPlayers();
        this.pushNpcs();
        this.pushProjectiles();
        this.pushSpotanims();

        if (!this.cutscene) {
            let pitch: number = this.orbitCameraPitch;

            if (((this.cameraPitchClamp / 256) | 0) > pitch) {
                pitch = (this.cameraPitchClamp / 256) | 0;
            }

            if (this.cameraModifierEnabled[4] && this.cameraModifierWobbleScale[4] + 128 > pitch) {
                pitch = this.cameraModifierWobbleScale[4] + 128;
            }

            const yaw: number = (this.orbitCameraYaw + this.cameraAnticheatAngle) & 0x7ff;
            if (this.localPlayer) {
                this.orbitCamera(this.orbitCameraX, this.getHeightmapY(this.currentLevel, this.localPlayer.x, this.localPlayer.z) - 50, this.orbitCameraZ, yaw, pitch, pitch * 3 + 600);
            }
        }

        let level: number;
        if (this.cutscene) {
            level = this.getTopLevelCutscene();
        } else {
            level = this.getTopLevel();
        }

        const cameraX: number = this.cameraX;
        const cameraY: number = this.cameraY;
        const cameraZ: number = this.cameraZ;
        const cameraPitch: number = this.cameraPitch;
        const cameraYaw: number = this.cameraYaw;
        let jitter: number;
        for (let type: number = 0; type < 5; type++) {
            if (this.cameraModifierEnabled[type]) {
                jitter =
                    (Math.random() * (this.cameraModifierJitter[type] * 2 + 1) - this.cameraModifierJitter[type] + Math.sin(this.cameraModifierCycle[type] * (this.cameraModifierWobbleSpeed[type] / 100.0)) * this.cameraModifierWobbleScale[type]) | 0;

                if (type === 0) {
                    this.cameraX += jitter;
                }
                if (type === 1) {
                    this.cameraY += jitter;
                }
                if (type === 2) {
                    this.cameraZ += jitter;
                }
                if (type === 3) {
                    this.cameraYaw = (this.cameraYaw + jitter) & 0x7ff;
                }
                if (type === 4) {
                    this.cameraPitch += jitter;
                    if (this.cameraPitch < 128) {
                        this.cameraPitch = 128;
                    }
                    if (this.cameraPitch > 383) {
                        this.cameraPitch = 383;
                    }
                }
            }
        }
        jitter = Draw3D.cycle;
        Model.checkHover = true;
        Model.pickedCount = 0;
        Model.mouseX = this.mouseX - 4;
        Model.mouseY = this.mouseY - 4;
        Draw2D.clear();
        this.scene?.draw(this.cameraX, this.cameraY, this.cameraZ, level, this.cameraYaw, this.cameraPitch);
        this.scene?.clearTemporaryLocs();
        this.draw2DEntityElements();
        this.drawTileHint();
        if (Client.showDebug) {
            this.drawDebug();
        }
        this.updateTextures(jitter);
        this.draw3DEntityElements();
        this.areaViewport?.draw(4, 4);
        this.cameraX = cameraX;
        this.cameraY = cameraY;
        this.cameraZ = cameraZ;
        this.cameraPitch = cameraPitch;
        this.cameraYaw = cameraYaw;
    };

    private clearCaches = (): void => {
        LocType.modelCacheStatic?.clear();
        LocType.modelCacheDynamic?.clear();
        NpcType.modelCache?.clear();
        ObjType.modelCache?.clear();
        ObjType.iconCache?.clear();
        PlayerEntity.modelCache?.clear();
        SpotAnimType.modelCache?.clear();
    };

    private projectFromEntity = (entity: PathingEntity, height: number): void => {
        this.projectFromGround(entity.x, height, entity.z);
    };

    private projectFromGround = (x: number, height: number, z: number): void => {
        if (x < 128 || z < 128 || x > 13056 || z > 13056) {
            this.projectX = -1;
            this.projectY = -1;
            return;
        }

        const y: number = this.getHeightmapY(this.currentLevel, x, z) - height;
        this.project(x, y, z);
    };

    private project = (x: number, y: number, z: number): void => {
        let dx: number = x - this.cameraX;
        let dy: number = y - this.cameraY;
        let dz: number = z - this.cameraZ;

        const sinPitch: number = Draw3D.sin[this.cameraPitch];
        const cosPitch: number = Draw3D.cos[this.cameraPitch];
        const sinYaw: number = Draw3D.sin[this.cameraYaw];
        const cosYaw: number = Draw3D.cos[this.cameraYaw];

        let tmp: number = (dz * sinYaw + dx * cosYaw) >> 16;
        dz = (dz * cosYaw - dx * sinYaw) >> 16;
        dx = tmp;

        tmp = (dy * cosPitch - dz * sinPitch) >> 16;
        dz = (dy * sinPitch + dz * cosPitch) >> 16;
        dy = tmp;

        if (dz >= 50) {
            this.projectX = Draw3D.centerX + (((dx << 9) / dz) | 0);
            this.projectY = Draw3D.centerY + (((dy << 9) / dz) | 0);
        } else {
            this.projectX = -1;
            this.projectY = -1;
        }
    };

    private draw2DEntityElements = (): void => {
        this.chatCount = 0;

        for (let index: number = -1; index < this.playerCount + this.npcCount; index++) {
            let entity: PathingEntity | null = null;
            if (index === -1) {
                entity = this.localPlayer;
            } else if (index < this.playerCount) {
                entity = this.players[this.playerIds[index]];
            } else {
                entity = this.npcs[this.npcIds[index - this.playerCount]];
            }

            if (!entity || !entity.isVisible()) {
                continue;
            }

            if (entity instanceof NpcEntity) {
                let type: NpcType | null = entity.type;
                if (type && type.overrides) {
                    type = type.getOverrideType();
                }
                if (!type) {
                    continue;
                }
            }

            if (index < this.playerCount) {
                let y: number = 30;

                const player: PlayerEntity = entity as PlayerEntity;
                if (player.headicons !== 0) {
                    this.projectFromEntity(entity, entity.height + 15);

                    if (this.projectX > -1) {
                        for (let icon: number = 0; icon < 8; icon++) {
                            if ((player.headicons & (0x1 << icon)) !== 0) {
                                this.imageHeadicons[icon]?.draw(this.projectX - 12, this.projectY - y);
                                y -= 25;
                            }
                        }
                    }
                }

                if (index >= 0 && this.hintType === 10 && this.hintPlayer === this.playerIds[index]) {
                    this.projectFromEntity(entity, entity.height + 15);

                    if (this.projectX > -1) {
                        this.imageHeadicons[7]?.draw(this.projectX - 12, this.projectY - y);
                    }
                }
            } else {
                const type: NpcType | null = (entity as NpcEntity).type;

                if (type && type.headicon >= 0 && type.headicon < this.imageHeadicons.length) {
                    this.projectFromGround(entity.x, entity.height + 15, entity.z);

                    if (this.projectX > -1) {
                        this.imageHeadicons[type.headicon]?.draw(this.projectX - 12, this.projectY - 30);
                    }
                }

                if (this.hintType === 1 && this.hintNpc === this.npcIds[index - this.playerCount] && Game.loopCycle % 20 < 10) {
                    this.projectFromEntity(entity, entity.height + 15);

                    if (this.projectX > -1) {
                        this.imageHeadicons[2]?.draw(this.projectX - 12, this.projectY - 28);
                    }
                }
            }

            if (entity.chat && (index >= this.playerCount || this.publicChatSetting === 0 || this.publicChatSetting === 3 || (this.publicChatSetting === 1 && this.isFriend((entity as PlayerEntity).name)))) {
                this.projectFromEntity(entity, entity.height);

                if (this.projectX > -1 && this.chatCount < Client.MAX_CHATS && this.fontBold12) {
                    this.chatWidth[this.chatCount] = (this.fontBold12.stringWidth(entity.chat) / 2) | 0;
                    this.chatHeight[this.chatCount] = this.fontBold12.height;
                    this.chatX[this.chatCount] = this.projectX;
                    this.chatY[this.chatCount] = this.projectY;

                    this.chatColors[this.chatCount] = entity.chatColor;
                    this.chatStyles[this.chatCount] = entity.chatStyle;
                    this.chatTimers[this.chatCount] = entity.chatTimer;
                    this.chats[this.chatCount++] = entity.chat as string;

                    if (this.chatEffects === 0 && entity.chatStyle >= 1 && entity.chatStyle <= 3) {
                        this.chatHeight[this.chatCount] += 10;
                        this.chatY[this.chatCount] += 5;
                    }

                    if (this.chatEffects === 0 && entity.chatStyle === 4) {
                        this.chatWidth[this.chatCount] = 60;
                    }

                    if (this.chatEffects === 0 && entity.chatStyle === 5) {
                        this.chatHeight[this.chatCount] += 5;
                    }
                }
            }

            if (entity.combatCycle > Game.loopCycle) {
                this.projectFromEntity(entity, entity.height + 15);

                if (this.projectX > -1) {
                    let w: number = ((entity.health * 30) / entity.totalHealth) | 0;
                    if (w > 30) {
                        w = 30;
                    }
                    Draw2D.fillRect(this.projectX - 15, this.projectY - 3, w, 5, Colors.GREEN);
                    Draw2D.fillRect(this.projectX - 15 + w, this.projectY - 3, 30 - w, 5, Colors.RED);
                }
            }

            for (let j: number = 0; j < 4; j++) {
                if (entity.damageCycle[j] <= Game.loopCycle) {
                    continue;
                }

                this.projectFromEntity(entity, (entity.height / 2) | 0);

                if (this.projectX > -1) {
                    if (j == 1) {
                        this.projectY -= 20;
                    }
                    if (j == 2) {
                        this.projectX -= 15;
                        this.projectY -= 10;
                    }
                    if (j == 3) {
                        this.projectX += 15;
                        this.projectY -= 10;
                    }

                    this.imageHitmarks[entity.damageType[j]]?.draw(this.projectX - 12, this.projectY - 12);
                    this.fontPlain11?.drawStringCenter(this.projectX, this.projectY + 4, entity.damage[j].toString(), Colors.BLACK);
                    this.fontPlain11?.drawStringCenter(this.projectX - 1, this.projectY + 3, entity.damage[j].toString(), Colors.WHITE);
                }
            }

            if (Client.showDebug) {
                // true tile overlay
                if (entity.pathLength > 0 || entity.forceMoveEndCycle >= Game.loopCycle || entity.forceMoveStartCycle > Game.loopCycle) {
                    const halfUnit: number = 64 * entity.size;
                    this.debugDrawTileOverlay(entity.pathTileX[0] * 128 + halfUnit, entity.pathTileZ[0] * 128 + halfUnit, this.currentLevel, entity.size, 0x00ffff, false);
                }

                // local tile overlay
                this.debugDrawTileOverlay(entity.x, entity.z, this.currentLevel, entity.size, 0x666666, false);

                let offsetY: number = 0;
                this.projectFromEntity(entity, entity.height + 30);

                if (index < this.playerCount) {
                    const player: PlayerEntity = entity as PlayerEntity;

                    this.fontPlain11?.drawStringCenter(this.projectX, this.projectY + offsetY, player.name, Colors.WHITE);
                    offsetY -= 15;

                    if (player.lastMask !== -1 && Game.loopCycle - player.lastMaskCycle < 30) {
                        if ((player.lastMask & PlayerEntity.APPEARANCE) === PlayerEntity.APPEARANCE) {
                            this.fontPlain11?.drawStringCenter(this.projectX, this.projectY + offsetY, 'Appearance Update', Colors.WHITE);
                            offsetY -= 15;
                        }

                        if ((player.lastMask & PlayerEntity.ANIM) === PlayerEntity.ANIM) {
                            this.fontPlain11?.drawStringCenter(this.projectX, this.projectY + offsetY, 'Play Seq: ' + player.primarySeqId, Colors.WHITE);
                            offsetY -= 15;
                        }

                        if ((player.lastMask & PlayerEntity.FACE_ENTITY) === PlayerEntity.FACE_ENTITY) {
                            let target: number = player.targetId;
                            if (target > 32767) {
                                target -= 32768;
                            }
                            this.fontPlain11?.drawStringCenter(this.projectX, this.projectY + offsetY, 'Face Entity: ' + target, Colors.WHITE);
                            offsetY -= 15;
                        }

                        if ((player.lastMask & PlayerEntity.SAY) === PlayerEntity.SAY) {
                            this.fontPlain11?.drawStringCenter(this.projectX, this.projectY + offsetY, 'Say', Colors.WHITE);
                            offsetY -= 15;
                        }

                        // TODO: which 0 or 1
                        if ((player.lastMask & PlayerEntity.DAMAGE0) === PlayerEntity.DAMAGE0) {
                            this.fontPlain11?.drawStringCenter(this.projectX, this.projectY + offsetY, 'Hit: Type ' + player.damageType + ' Amount ' + player.damage + ' HP ' + player.health + '/' + player.totalHealth, Colors.WHITE);
                            offsetY -= 15;
                        }

                        if ((player.lastMask & PlayerEntity.FACE_COORD) === PlayerEntity.FACE_COORD) {
                            this.fontPlain11?.drawStringCenter(this.projectX, this.projectY + offsetY, 'Face Coord: ' + player.lastFaceX / 2 + ' ' + player.lastFaceZ / 2, Colors.WHITE);
                            offsetY -= 15;
                        }

                        if ((player.lastMask & PlayerEntity.CHAT) === PlayerEntity.CHAT) {
                            this.fontPlain11?.drawStringCenter(this.projectX, this.projectY + offsetY, 'Chat', Colors.WHITE);
                            offsetY -= 15;
                        }

                        if ((player.lastMask & PlayerEntity.SPOTANIM) === PlayerEntity.SPOTANIM) {
                            this.fontPlain11?.drawStringCenter(this.projectX, this.projectY + offsetY, 'Play Spotanim: ' + player.spotanimId, Colors.WHITE);
                            offsetY -= 15;
                        }

                        if ((player.lastMask & PlayerEntity.EXACT_MOVE) === PlayerEntity.EXACT_MOVE) {
                            this.fontPlain11?.drawStringCenter(this.projectX, this.projectY + offsetY, 'Exact Move', Colors.WHITE);
                            offsetY -= 15;
                        }
                    }
                } else {
                    // npc
                    const npc: NpcEntity = entity as NpcEntity;

                    let offsetY: number = 0;
                    this.projectFromEntity(entity, entity.height + 30);

                    this.fontPlain11?.drawStringCenter(this.projectX, this.projectY + offsetY, npc.type?.name ?? null, Colors.WHITE);
                    offsetY -= 15;

                    if (npc.lastMask !== -1 && Game.loopCycle - npc.lastMaskCycle < 30) {
                        if ((npc.lastMask & NpcEntity.ANIM) === NpcEntity.ANIM) {
                            this.fontPlain11?.drawStringCenter(this.projectX, this.projectY + offsetY, 'Play Seq: ' + npc.primarySeqId, Colors.WHITE);
                            offsetY -= 15;
                        }

                        if ((npc.lastMask & NpcEntity.FACE_ENTITY) === NpcEntity.FACE_ENTITY) {
                            let target: number = npc.targetId;
                            if (target > 32767) {
                                target -= 32768;
                            }
                            this.fontPlain11?.drawStringCenter(this.projectX, this.projectY + offsetY, 'Face Entity: ' + target, Colors.WHITE);
                            offsetY -= 15;
                        }

                        if ((npc.lastMask & NpcEntity.SAY) === NpcEntity.SAY) {
                            this.fontPlain11?.drawStringCenter(this.projectX, this.projectY + offsetY, 'Say', Colors.WHITE);
                            offsetY -= 15;
                        }

                        // TODO damage0 or 1
                        if ((npc.lastMask & NpcEntity.DAMAGE0) === NpcEntity.DAMAGE0) {
                            this.fontPlain11?.drawStringCenter(this.projectX, this.projectY + offsetY, 'Hit: Type ' + npc.damageType + ' Amount ' + npc.damage + ' HP ' + npc.health + '/' + npc.totalHealth, Colors.WHITE);
                            offsetY -= 15;
                        }

                        if ((npc.lastMask & NpcEntity.CHANGE_TYPE) === NpcEntity.CHANGE_TYPE) {
                            this.fontPlain11?.drawStringCenter(this.projectX, this.projectY + offsetY, 'Change Type: ' + npc.type?.id ?? null, Colors.WHITE);
                            offsetY -= 15;
                        }

                        if ((npc.lastMask & NpcEntity.SPOTANIM) === NpcEntity.SPOTANIM) {
                            this.fontPlain11?.drawStringCenter(this.projectX, this.projectY + offsetY, 'Play Spotanim: ' + npc.spotanimId, Colors.WHITE);
                            offsetY -= 15;
                        }

                        if ((npc.lastMask & NpcEntity.FACE_COORD) === NpcEntity.FACE_COORD) {
                            this.fontPlain11?.drawStringCenter(this.projectX, this.projectY + offsetY, 'Face Coord: ' + npc.lastFaceX / 2 + ' ' + npc.lastFaceZ / 2, Colors.WHITE);
                            offsetY -= 15;
                        }
                    }
                }
            }
        }

        if (Client.showDebug) {
            for (let i: number = 0; i < this.userTileMarkers.length; i++) {
                const marker: Tile | null = this.userTileMarkers[i];
                if (!marker || marker.level !== this.currentLevel || marker.x < 0 || marker.z < 0 || marker.x >= 104 || marker.z >= 104) {
                    continue;
                }

                this.debugDrawTileOverlay(marker.x * 128 + 64, marker.z * 128 + 64, marker.level, 1, 0xffff00, false);
            }
        }

        for (let i: number = 0; i < this.chatCount; i++) {
            const x: number = this.chatX[i];
            let y: number = this.chatY[i];
            const padding: number = this.chatWidth[i];
            const height: number = this.chatHeight[i];
            let sorting: boolean = true;
            while (sorting) {
                sorting = false;
                for (let j: number = 0; j < i; j++) {
                    if (y + 2 > this.chatY[j] - this.chatHeight[j] && y - height < this.chatY[j] + 2 && x - padding < this.chatX[j] + this.chatWidth[j] && x + padding > this.chatX[j] - this.chatWidth[j] && this.chatY[j] - this.chatHeight[j] < y) {
                        y = this.chatY[j] - this.chatHeight[j];
                        sorting = true;
                    }
                }
            }
            this.projectX = this.chatX[i];
            this.projectY = this.chatY[i] = y;
            const message: string | null = this.chats[i];
            if (this.chatEffects === 0) {
                let color: number = Colors.YELLOW;
                if (this.chatColors[i] < 6) {
                    color = Colors.CHAT_COLORS[this.chatColors[i]];
                }
                if (this.chatColors[i] === 6) {
                    color = this.sceneCycle % 20 < 10 ? Colors.RED : Colors.YELLOW;
                }
                if (this.chatColors[i] === 7) {
                    color = this.sceneCycle % 20 < 10 ? Colors.BLUE : Colors.CYAN;
                }
                if (this.chatColors[i] === 8) {
                    color = this.sceneCycle % 20 < 10 ? 0xb000 : 0x80ff80;
                }
                if (this.chatColors[i] === 9) {
                    const delta: number = 150 - this.chatTimers[i];
                    if (delta < 50) {
                        color = delta * 1280 + Colors.RED;
                    } else if (delta < 100) {
                        color = Colors.YELLOW - (delta - 50) * 327680;
                    } else if (delta < 150) {
                        color = (delta - 100) * 5 + Colors.GREEN;
                    }
                }
                if (this.chatColors[i] === 10) {
                    const delta: number = 150 - this.chatTimers[i];
                    if (delta < 50) {
                        color = delta * 5 + Colors.RED;
                    } else if (delta < 100) {
                        color = Colors.MAGENTA - (delta - 50) * 327680;
                    } else if (delta < 150) {
                        color = (delta - 100) * 327680 + Colors.BLUE - (delta - 100) * 5;
                    }
                }
                if (this.chatColors[i] === 11) {
                    const delta: number = 150 - this.chatTimers[i];
                    if (delta < 50) {
                        color = Colors.WHITE - delta * 327685;
                    } else if (delta < 100) {
                        color = (delta - 50) * 327685 + Colors.GREEN;
                    } else if (delta < 150) {
                        color = Colors.WHITE - (delta - 100) * 327680;
                    }
                }
                if (this.chatStyles[i] === 0) {
                    this.fontBold12?.drawStringCenter(this.projectX, this.projectY + 1, message, Colors.BLACK);
                    this.fontBold12?.drawStringCenter(this.projectX, this.projectY, message, color);
                }
                if (this.chatStyles[i] === 1) {
                    this.fontBold12?.drawCenteredWave(this.projectX, this.projectY + 1, message, Colors.BLACK, this.sceneCycle);
                    this.fontBold12?.drawCenteredWave(this.projectX, this.projectY, message, color, this.sceneCycle);
                }
                if (this.chatStyles[i] === 2) {
                    this.fontBold12?.drawCenteredWave2(this.projectX, this.projectY + 1, message, Colors.BLACK, this.sceneCycle);
                    this.fontBold12?.drawCenteredWave2(this.projectX, this.projectY, message, color, this.sceneCycle);
                }
                if (this.chatStyles[i] === 3) {
                    this.fontBold12?.drawCenteredShake(this.projectX, this.projectY + 1, message, Colors.BLACK, this.sceneCycle, 150 - this.chatTimers[i]);
                    this.fontBold12?.drawCenteredShake(this.projectX, this.projectY, message, color, this.sceneCycle, 150 - this.chatTimers[i]);
                }
                if (this.chatStyles[i] === 4) {
                    const w: number = this.fontBold12?.stringWidth(message) ?? 0;
                    const offsetX: number = ((150 - this.chatTimers[i]) * (w + 100)) / 150;
                    Draw2D.setBounds(this.projectX - 50, 0, this.projectX + 50, 334);
                    this.fontBold12?.drawString(this.projectX + 50 - offsetX, this.projectY + 1, message, Colors.BLACK);
                    this.fontBold12?.drawString(this.projectX + 50 - offsetX, this.projectY, message, color);
                    Draw2D.resetBounds();
                }
                if (this.chatStyles[i] === 5) {
                    const delta: number = 150 - this.chatTimers[i];
                    let slide: number = 0;
                    if (delta < 25) {
                        slide = delta - 25;
                    } else if (delta > 125) {
                        slide = delta - 125;
                    }
                    Draw2D.setBounds(0, this.projectY - (this.fontBold12?.height ?? 0) - 1, 512, this.projectY + 5);
                    this.fontBold12?.drawStringCenter(this.projectX, this.projectY + 1 + slide, message, 0);
                    this.fontBold12?.drawStringCenter(this.projectX, this.projectY + slide, message, color);
                    Draw2D.resetBounds();
                }
            } else {
                this.fontBold12?.drawStringCenter(this.projectX, this.projectY + 1, message, Colors.BLACK);
                this.fontBold12?.drawStringCenter(this.projectX, this.projectY, message, Colors.YELLOW);
            }
        }
    };

    private drawTileHint = (): void => {
        if (this.hintType !== 2 || !this.imageHeadicons[2]) {
            return;
        }

        this.projectFromGround(((this.hintTileX - this.sceneBaseTileX) << 7) + this.hintOffsetX, this.hintHeight * 2, ((this.hintTileZ - this.sceneBaseTileZ) << 7) + this.hintOffsetZ);

        if (this.projectX > -1 && Game.loopCycle % 20 < 10) {
            this.imageHeadicons[2].draw(this.projectX - 12, this.projectY - 28);
        }
    };

    private drawDebug = (): void => {
        // all of this is basically custom code
        const x: number = 507;
        let y: number = 13;
        if (this.lastTickFlag) {
            this.fontPlain11?.drawStringRight(x, y, 'tock', Colors.YELLOW, true);
        } else {
            this.fontBold12?.drawStringRight(x, y, 'tick', Colors.YELLOW, true);
        }
        y += 13;
        this.fontPlain11?.drawStringRight(x, y, `Fps: ${this.fps}, ${this.deltime} ms`, Colors.YELLOW, true);
        y += 13;
        this.fontPlain11?.drawStringRight(x, y, `Draw: ${this.ms.toFixed(1)}, Avg: ${this.msAvg.toFixed(1)}, Slow: ${this.slowestMS.toFixed(1)} ms`, Colors.YELLOW, true);
        y += 13;
        this.fontPlain11?.drawStringRight(x, y, `Occluders: ${World3D.levelOccluderCount[World3D.topLevel]} Active: ${World3D.activeOccluderCount}`, Colors.YELLOW, true);
        y += 13;
        this.fontPlain11?.drawStringRight(x, y, 'Local Pos: ' + (this.localPlayer?.x ?? -1) + ', ' + (this.localPlayer?.z ?? -1) + ', ' + (this.localPlayer?.y ?? -1), Colors.YELLOW, true);
        y += 13;
        this.fontPlain11?.drawStringRight(x, y, 'Camera Pos: ' + this.cameraX + ', ' + this.cameraZ + ', ' + this.cameraY, Colors.YELLOW, true);
        y += 13;
        this.fontPlain11?.drawStringRight(x, y, 'Camera Angle: ' + this.cameraYaw + ', ' + this.cameraPitch, Colors.YELLOW, true);
        y += 13;
        this.fontPlain11?.drawStringRight(
            x,
            y,
            'Cutscene Source: ' + this.cutsceneSrcLocalTileX + ', ' + this.cutsceneSrcLocalTileZ + ' ' + this.cutsceneSrcHeight + '; ' + this.cutsceneMoveSpeed + ', ' + this.cutsceneMoveAcceleration,
            Colors.YELLOW,
            true
        );
        y += 13;
        this.fontPlain11?.drawStringRight(
            x,
            y,
            'Cutscene Destination: ' + this.cutsceneDstLocalTileX + ', ' + this.cutsceneDstLocalTileZ + ' ' + this.cutsceneDstHeight + '; ' + this.cutsceneRotateSpeed + ', ' + this.cutsceneRotateAcceleration,
            Colors.YELLOW,
            true
        );
        if (Client.cameraEditor) {
            y += 13;
            this.fontPlain11?.drawStringRight(x, y, 'Instructions:', Colors.YELLOW, true);
            y += 13;
            this.fontPlain11?.drawStringRight(x, y, '- Arrows to move Camera', Colors.YELLOW, true);
            y += 13;
            this.fontPlain11?.drawStringRight(x, y, '- Shift to control Source or Dest', Colors.YELLOW, true);
            y += 13;
            this.fontPlain11?.drawStringRight(x, y, '- Alt to control Height', Colors.YELLOW, true);
            y += 13;
            this.fontPlain11?.drawStringRight(x, y, '- Ctrl to control Modifier', Colors.YELLOW, true);
        }
    };

    private debugDrawTileOverlay = (x: number, z: number, level: number, size: number, color: number, crossed: boolean): void => {
        const height: number = this.getHeightmapY(level, x, z);

        // x/z should be the center of a tile which is 128 client-units large, so +/- 64 puts us at the edges
        const halfUnit: number = 64 * size;
        this.project(x - halfUnit, height, z - halfUnit);
        const x0: number = this.projectX;
        const y0: number = this.projectY;
        this.project(x + halfUnit, height, z - halfUnit);
        const x1: number = this.projectX;
        const y1: number = this.projectY;
        this.project(x - halfUnit, height, z + halfUnit);
        const x2: number = this.projectX;
        const y2: number = this.projectY;
        this.project(x + halfUnit, height, z + halfUnit);
        const x3: number = this.projectX;
        const y3: number = this.projectY;

        // one of our points failed to project
        if (x0 === -1 || x1 === -1 || x2 === -1 || x3 === -1) {
            return;
        }

        if (crossed) {
            Draw2D.drawLine(x0, y0, x3, y3, (color & 0xfefefe) >> 1);
            Draw2D.drawLine(x1, y1, x2, y2, (color & 0xfefefe) >> 1);
        }
        Draw2D.drawLine(x0, y0, x1, y1, color);
        Draw2D.drawLine(x0, y0, x2, y2, color);
        Draw2D.drawLine(x1, y1, x3, y3, color);
        Draw2D.drawLine(x2, y2, x3, y3, color);
    };

    updateCameraEditor(): void {
        // holding ctrl
        const modifier: number = this.actionKey[5] == 1 ? 2 : 1;

        if (this.actionKey[6] == 1) {
            // holding shift
            if (this.actionKey[1] == 1) {
                // left
                this.cutsceneDstLocalTileX -= modifier;
                if (this.cutsceneDstLocalTileX < 1) {
                    this.cutsceneDstLocalTileX = 1;
                }
            } else if (this.actionKey[2] == 1) {
                // right
                this.cutsceneDstLocalTileX += modifier;
                if (this.cutsceneDstLocalTileX > 102) {
                    this.cutsceneDstLocalTileX = 102;
                }
            }

            if (this.actionKey[3] == 1) {
                // up
                if (this.actionKey[7] == 1) {
                    // holding alt
                    this.cutsceneDstHeight += 2 * modifier;
                } else {
                    this.cutsceneDstLocalTileZ += 1;
                    if (this.cutsceneDstLocalTileZ > 102) {
                        this.cutsceneDstLocalTileZ = 102;
                    }
                }
            } else if (this.actionKey[4] == 1) {
                // down
                if (this.actionKey[7] == 1) {
                    // holding alt
                    this.cutsceneDstHeight -= 2 * modifier;
                } else {
                    this.cutsceneDstLocalTileZ -= 1;
                    if (this.cutsceneDstLocalTileZ < 1) {
                        this.cutsceneDstLocalTileZ = 1;
                    }
                }
            }
        } else {
            if (this.actionKey[1] == 1) {
                // left
                this.cutsceneSrcLocalTileX -= modifier;
                if (this.cutsceneSrcLocalTileX < 1) {
                    this.cutsceneSrcLocalTileX = 1;
                }
            } else if (this.actionKey[2] == 1) {
                // right
                this.cutsceneSrcLocalTileX += modifier;
                if (this.cutsceneSrcLocalTileX > 102) {
                    this.cutsceneSrcLocalTileX = 102;
                }
            }

            if (this.actionKey[3] == 1) {
                // up
                if (this.actionKey[7] == 1) {
                    // holding alt
                    this.cutsceneSrcHeight += 2 * modifier;
                } else {
                    this.cutsceneSrcLocalTileZ += modifier;
                    if (this.cutsceneSrcLocalTileZ > 102) {
                        this.cutsceneSrcLocalTileZ = 102;
                    }
                }
            } else if (this.actionKey[4] == 1) {
                // down
                if (this.actionKey[7] == 1) {
                    // holding alt
                    this.cutsceneSrcHeight -= 2 * modifier;
                } else {
                    this.cutsceneSrcLocalTileZ -= modifier;
                    if (this.cutsceneSrcLocalTileZ < 1) {
                        this.cutsceneSrcLocalTileZ = 1;
                    }
                }
            }
        }

        this.cameraX = this.cutsceneSrcLocalTileX * 128 + 64;
        this.cameraZ = this.cutsceneSrcLocalTileZ * 128 + 64;
        this.cameraY = this.getHeightmapY(this.currentLevel, this.cutsceneSrcLocalTileX, this.cutsceneSrcLocalTileZ) - this.cutsceneSrcHeight;

        const sceneX: number = this.cutsceneDstLocalTileX * 128 + 64;
        const sceneZ: number = this.cutsceneDstLocalTileZ * 128 + 64;
        const sceneY: number = this.getHeightmapY(this.currentLevel, this.cutsceneDstLocalTileX, this.cutsceneDstLocalTileZ) - this.cutsceneDstHeight;
        const deltaX: number = sceneX - this.cameraX;
        const deltaY: number = sceneY - this.cameraY;
        const deltaZ: number = sceneZ - this.cameraZ;
        const distance: number = Math.sqrt(deltaX * deltaX + deltaZ * deltaZ) | 0;

        this.cameraPitch = ((Math.atan2(deltaY, distance) * 325.949) | 0) & 0x7ff;
        this.cameraYaw = ((Math.atan2(deltaX, deltaZ) * -325.949) | 0) & 0x7ff;
        if (this.cameraPitch < 128) {
            this.cameraPitch = 128;
        }

        if (this.cameraPitch > 383) {
            this.cameraPitch = 383;
        }
    }

    private draw3DEntityElements = (): void => {
        this.drawPrivateMessages();
        if (this.crossMode === 1) {
            this.imageCrosses[(this.crossCycle / 100) | 0]?.draw(this.crossX - 8 - 4, this.crossY - 8 - 4);
        }

        if (this.crossMode === 2) {
            this.imageCrosses[((this.crossCycle / 100) | 0) + 4]?.draw(this.crossX - 8 - 4, this.crossY - 8 - 4);
        }

        if (this.viewportOverlayInterfaceId !== -1) {
            this.updateInterfaceAnimation(this.viewportOverlayInterfaceId, this.sceneDelta);
            this.drawInterface(Component.instances[this.viewportOverlayInterfaceId], 0, 0, 0);
        }

        if (this.viewportInterfaceId !== -1) {
            this.updateInterfaceAnimation(this.viewportInterfaceId, this.sceneDelta);
            this.drawInterface(Component.instances[this.viewportInterfaceId], 0, 0, 0);
        }

        // TODO: sort these out
        // this.drawWildyLevel();
        this.updateChatOverride();

        if (!this.menuVisible) {
            this.handleInput();
            this.drawTooltip();
        } else if (this.menuArea === 0) {
            this.drawMenu();
        }

        if (this.inMultizone === 1) {
            // if (this.wildernessLevel > 0 || this.worldLocationState === 1) {
            //     this.imageHeadicons[1]?.draw(472, 258);
            // } else {
            this.imageHeadicons[1]?.draw(472, 296);
            // }
        }

        // if (this.wildernessLevel > 0) {
        //     this.imageHeadicons[0]?.draw(472, 296);
        //     this.fontPlain12?.drawStringCenter(484, 329, 'Level: ' + this.wildernessLevel, Colors.YELLOW);
        // }

        // if (this.worldLocationState === 1) {
        //     this.imageHeadicons[6]?.draw(472, 296);
        //     this.fontPlain12?.drawStringCenter(484, 329, 'Arena', Colors.YELLOW);
        // }

        if (this.systemUpdateTimer !== 0) {
            let seconds: number = (this.systemUpdateTimer / 50) | 0;
            const minutes: number = (seconds / 60) | 0;
            seconds %= 60;

            if (seconds < 10) {
                this.fontPlain12?.drawString(4, 329, 'System update in: ' + minutes + ':0' + seconds, Colors.YELLOW);
            } else {
                this.fontPlain12?.drawString(4, 329, 'System update in: ' + minutes + ':' + seconds, Colors.YELLOW);
            }
        }
    };

    private drawPrivateMessages = (): void => {
        if (this.splitPrivateChat === 0) {
            return;
        }

        const font: PixFont | null = this.fontPlain12;
        let lineOffset: number = 0;
        if (this.systemUpdateTimer !== 0) {
            lineOffset = 1;
        }

        for (let i: number = 0; i < 100; i++) {
            if (!this.messageText[i]) {
                continue;
            }

            const type: number = this.messageType[i];
            let sender: string | null = this.messageSender[i];
            let staffModLevel: number = 0;
            if (sender && sender.startsWith('@cr1@')) {
                sender = sender.substring(5);
                staffModLevel = 1;
            }
            if (sender && sender.startsWith('@cr2@')) {
                sender = sender.substring(5);
                staffModLevel = 2;
            }
            let y: number;
            if ((type === 3 || type === 7) && (type === 7 || this.privateChatSetting === 0 || (this.privateChatSetting === 1 && this.isFriend(sender)))) {
                y = 329 - lineOffset * 13;
                const x: number = 4;
                font?.drawString(x, y, 'From ' + sender + ': ' + this.messageText[i], Colors.BLACK);
                font?.drawString(x, y - 1, 'From ' + sender + ': ' + this.messageText[i], Colors.CYAN);
                // TODO: Need to fix this all
                // x += font?.stringwidthtaggable('From ');
                // if (staffModLevel === 1) {
                //     this.imageModIcons[0]?.blit(x, y - 12);
                //     y += 14;
                // }
                // if (staffModLevel === 2) {
                //     this.imageModIcons[1]?.blit(x, y - 12);
                //     y += 14;
                // }
                font?.drawString(x, y, sender + ': ' + this.messageText[i], Colors.BLACK);
                font?.drawString(x, y - 1, sender + ': ' + this.messageText[i], Colors.CYAN);
                if (++lineOffset >= 5) {
                    return;
                }
            }

            if (type === 5 && this.privateChatSetting < 2) {
                y = 329 - lineOffset * 13;
                font?.drawString(4, y, this.messageText[i], Colors.BLACK);
                font?.drawString(4, y - 1, this.messageText[i], Colors.CYAN);

                if (++lineOffset >= 5) {
                    return;
                }
            }

            if (type === 6 && this.privateChatSetting < 2) {
                y = 329 - lineOffset * 13;
                font?.drawString(4, y, 'To ' + sender + ': ' + this.messageText[i], Colors.BLACK);
                font?.drawString(4, y - 1, 'To ' + sender + ': ' + this.messageText[i], Colors.CYAN);

                if (++lineOffset >= 5) {
                    return;
                }
            }
        }
    };

    private drawWildyLevel = (): void => {
        // if (!this.localPlayer) {
        //     return;
        // }
        // const x: number = (this.localPlayer.x >> 7) + this.sceneBaseTileX;
        // const z: number = (this.localPlayer.z >> 7) + this.sceneBaseTileZ;
        // if (x >= 2944 && x < 3392 && z >= 3520 && z < 6400) {
        //     this.wildernessLevel = (((z - 3520) / 8) | 0) + 1;
        // } else if (x >= 2944 && x < 3392 && z >= 9920 && z < 12800) {
        //     this.wildernessLevel = (((z - 9920) / 8) | 0) + 1;
        // } else {
        //     this.wildernessLevel = 0;
        // }
        // this.worldLocationState = 0;
        // if (x >= 3328 && x < 3392 && z >= 3200 && z < 3264) {
        //     const localX: number = x & 63;
        //     const localZ: number = z & 63;
        //     if (localX >= 4 && localX <= 29 && localZ >= 44 && localZ <= 58) {
        //         this.worldLocationState = 1;
        //     } else if (localX >= 36 && localX <= 61 && localZ >= 44 && localZ <= 58) {
        //         this.worldLocationState = 1;
        //     } else if (localX >= 4 && localX <= 29 && localZ >= 25 && localZ <= 39) {
        //         this.worldLocationState = 1;
        //     } else if (localX >= 36 && localX <= 61 && localZ >= 25 && localZ <= 39) {
        //         this.worldLocationState = 1;
        //     } else if (localX >= 4 && localX <= 29 && localZ >= 6 && localZ <= 20) {
        //         this.worldLocationState = 1;
        //     } else if (localX >= 36 && localX <= 61 && localZ >= 6 && localZ <= 20) {
        //         this.worldLocationState = 1;
        //     }
        // }
        // if (this.worldLocationState === 0 && x >= 3328 && x <= 3393 && z >= 3203 && z <= 3325) {
        //     this.worldLocationState = 2;
        // }
    };

    private updateChatOverride = (): void => {
        if (!this.localPlayer) {
            return;
        }

        this.overrideChat = 0;
        const x: number = (this.localPlayer.x >> 7) + this.sceneBaseTileX;
        const z: number = (this.localPlayer.z >> 7) + this.sceneBaseTileZ;

        if (x >= 3053 && x <= 3156 && z >= 3056 && z <= 3136) {
            this.overrideChat = 1;
        } else if (x >= 3072 && x <= 3118 && z >= 9492 && z <= 9535) {
            this.overrideChat = 1;
        }

        if (this.overrideChat === 1 && x >= 3139 && x <= 3199 && z >= 3008 && z <= 3062) {
            this.overrideChat = 0;
        }
    };

    private drawSidebar = (): void => {
        this.areaSidebar?.bind();
        if (this.areaSidebarOffsets) {
            Draw3D.lineOffset = this.areaSidebarOffsets;
        }
        this.imageInvback?.draw(0, 0);
        if (this.sidebarInterfaceId !== -1) {
            this.drawInterface(Component.instances[this.sidebarInterfaceId], 0, 0, 0);
        } else if (this.tabInterfaceId[this.selectedTab] !== -1) {
            this.drawInterface(Component.instances[this.tabInterfaceId[this.selectedTab]], 0, 0, 0);
        }
        if (this.menuVisible && this.menuArea === 1) {
            this.drawMenu();
        }
        this.areaSidebar?.draw(553, 205);
        this.areaViewport?.bind();
        if (this.areaViewportOffsets) {
            Draw3D.lineOffset = this.areaViewportOffsets;
        }
    };

    private drawChatback = (): void => {
        this.areaChatback?.bind();
        if (this.areaChatbackOffsets) {
            Draw3D.lineOffset = this.areaChatbackOffsets;
        }
        this.imageChatback?.draw(0, 0);
        if (this.showSocialInput) {
            this.fontBold12?.drawStringCenter(239, 40, this.socialMessage, Colors.BLACK);
            this.fontBold12?.drawStringCenter(239, 60, this.socialInput + '*', Colors.DARKBLUE);
        } else if (this.chatbackInputType === 1) {
            this.fontBold12?.drawStringCenter(239, 40, 'Enter amount:', Colors.BLACK);
            this.fontBold12?.drawStringCenter(239, 60, this.chatbackInput + '*', Colors.DARKBLUE);
        } else if (this.chatbackInputType === 2) {
            this.fontBold12?.drawStringCenter(239, 40, 'Enter name:', Colors.BLACK);
            this.fontBold12?.drawStringCenter(239, 60, this.chatbackInput + '*', Colors.DARKBLUE);
        } else if (this.modalMessage) {
            this.fontBold12?.drawStringCenter(239, 40, this.modalMessage, Colors.BLACK);
            this.fontBold12?.drawStringCenter(239, 60, 'Click to continue', Colors.DARKBLUE);
        } else if (this.chatInterfaceId !== -1) {
            this.drawInterface(Component.instances[this.chatInterfaceId], 0, 0, 0);
        } else if (this.stickyChatInterfaceId === -1) {
            let font: PixFont | null = this.fontPlain12;
            if (Client.chatEra === 0) {
                font = this.fontQuill8;
            }
            let line: number = 0;
            Draw2D.setBounds(0, 0, 463, 77);
            for (let i: number = 0; i < 100; i++) {
                const message: string | null = this.messageText[i];
                if (!message) {
                    continue;
                }
                const type: number = this.messageType[i];
                const offset: number = this.chatScrollOffset + 70 - line * 14;
                let sender: string | null = this.messageSender[i];
                let icon: number = 0;

                if (sender && sender.startsWith('@cr1@')) {
                    sender = sender.substring(5);
                    icon = 1;
                }

                if (sender && sender.startsWith('@cr2@')) {
                    sender = sender.substring(5);
                    icon = 2;
                }

                if (type === 0) {
                    if (offset > 0 && offset < 110) {
                        font?.drawString(4, offset, message, Colors.BLACK);
                    }
                    line++;
                }
                if (type === 1 || (type === 2 && (this.publicChatSetting === 0 || (this.publicChatSetting === 1 && this.isFriend(sender))))) {
                    if (offset > 0 && offset < 110) {
                        let x: number = 4;
                        if (icon == 1) {
                            this.imageModIcons[0]?.draw(x, offset - 12);
                            x += 14;
                        }
                        if (icon == 2) {
                            this.imageModIcons[1]?.draw(x, offset - 12);
                            x += 14;
                        }
                        font?.drawString(x, offset, sender + ':', Colors.BLACK);
                        if (font) x += font.stringWidth(sender) + 8;
                        font?.drawString(x, offset, message, Colors.BLUE);
                    }
                    line++;
                }
                if ((type === 3 || type === 7) && this.splitPrivateChat === 0 && (type === 7 || this.privateChatSetting === 0 || (this.privateChatSetting === 1 && this.isFriend(sender)))) {
                    if (offset > 0 && offset < 110) {
                        let x: number = 4;
                        font?.drawString(4, offset, 'From ' + sender + ':', Colors.BLACK);
                        font?.drawString(font.stringWidth('From ' + sender) + 12, offset, message, Colors.DARKRED);

                        if (icon == 1) {
                            this.imageModIcons[0]?.draw(x, offset - 12);
                            x += 14;
                        }
                        if (icon == 2) {
                            this.imageModIcons[1]?.draw(x, offset - 12);
                            x += 14;
                        }
                        font?.drawString(x, offset, sender + ':', Colors.BLACK);
                        if (font) x += font.stringWidth(sender) + 8;
                        font?.drawString(x, offset, message, Colors.DARKRED);
                    }
                    line++;
                }
                if (type === 4 && (this.tradeChatSetting === 0 || (this.tradeChatSetting === 1 && this.isFriend(sender)))) {
                    if (offset > 0 && offset < 110) {
                        font?.drawString(4, offset, sender + ' ' + this.messageText[i], Colors.TRADE_MESSAGE);
                    }
                    line++;
                }
                if (type === 5 && this.splitPrivateChat === 0 && this.privateChatSetting < 2) {
                    if (offset > 0 && offset < 110) {
                        font?.drawString(4, offset, message, Colors.DARKRED);
                    }
                    line++;
                }
                if (type === 6 && this.splitPrivateChat === 0 && this.privateChatSetting < 2) {
                    if (offset > 0 && offset < 110) {
                        font?.drawString(4, offset, 'To ' + sender + ':', Colors.BLACK);
                        font?.drawString(font.stringWidth('To ' + sender) + 12, offset, message, Colors.DARKRED);
                    }
                    line++;
                }
                if (type === 8 && (this.tradeChatSetting === 0 || (this.tradeChatSetting === 1 && this.isFriend(sender)))) {
                    if (offset > 0 && offset < 110) {
                        font?.drawString(4, offset, sender + ' ' + this.messageText[i], Colors.DUEL_MESSAGE);
                    }
                    line++;
                }
            }
            Draw2D.resetBounds();
            this.chatScrollHeight = line * 14 + 7;
            if (this.chatScrollHeight < 78) {
                this.chatScrollHeight = 78;
            }
            this.drawScrollbar(463, 0, this.chatScrollHeight - this.chatScrollOffset - 77, this.chatScrollHeight, 77);
            if (Client.chatEra == 0) {
                // 186-194?
                font?.drawString(3, 90, this.chatTyped + '*', Colors.BLACK);
            } else if (Client.chatEra == 1) {
                // <204
                font?.drawString(3, 90, this.chatTyped + '*', Colors.BLUE);
            } else {
                // 204+
                font?.drawString(4, 90, JString.formatName(this.username) + ':', Colors.BLACK);
                font?.drawString(font.stringWidth(this.username + ': ') + 6, 90, this.chatTyped + '*', Colors.BLUE);
            }
            Draw2D.drawHorizontalLine(0, 77, Colors.BLACK, 479);
        } else {
            this.drawInterface(Component.instances[this.stickyChatInterfaceId], 0, 0, 0);
        }
        if (this.menuVisible && this.menuArea === 2) {
            this.drawMenu();
        }
        this.areaChatback?.draw(17, 357);
        this.areaViewport?.bind();
        if (this.areaViewportOffsets) {
            Draw3D.lineOffset = this.areaViewportOffsets;
        }
    };

    private drawMinimap = (): void => {
        this.areaMapback?.bind();

        if (this.minimapState === 2 && this.imageMapback) {
            const mapback: Int8Array = this.imageMapback.pixels;
            const pixels: Int32Array = Draw2D.pixels;
            for (let i: number = 0; i < mapback.length; i++) {
                if (mapback[i] === 0) {
                    pixels[i] = 0;
                }
            }
            this.imageCompass?.drawRotatedMasked(0, 0, 33, 33, this.compassMaskLineOffsets, this.compassMaskLineLengths, 25, 25, this.orbitCameraYaw, 256);
            this.areaViewport?.bind();
        }

        if (!this.localPlayer) {
            return;
        }

        const angle: number = (this.orbitCameraYaw + this.minimapAnticheatAngle) & 0x7ff;
        let anchorX: number = ((this.localPlayer.x / 32) | 0) + 48;
        let anchorY: number = 464 - ((this.localPlayer.z / 32) | 0);

        this.imageMinimap?.drawRotatedMasked(25, 5, 146, 151, this.minimapMaskLineOffsets, this.minimapMaskLineLengths, anchorX, anchorY, angle, this.minimapZoom + 256);
        this.imageCompass?.drawRotatedMasked(0, 0, 33, 33, this.compassMaskLineOffsets, this.compassMaskLineLengths, 25, 25, this.orbitCameraYaw, 256);
        for (let i: number = 0; i < this.activeMapFunctionCount; i++) {
            anchorX = this.activeMapFunctionX[i] * 4 + 2 - ((this.localPlayer.x / 32) | 0);
            anchorY = this.activeMapFunctionZ[i] * 4 + 2 - ((this.localPlayer.z / 32) | 0);
            this.drawOnMinimap(anchorY, this.activeMapFunctions[i], anchorX);
        }

        for (let ltx: number = 0; ltx < CollisionMap.SIZE; ltx++) {
            for (let ltz: number = 0; ltz < CollisionMap.SIZE; ltz++) {
                const stack: LinkList | null = this.levelObjStacks[this.currentLevel][ltx][ltz];
                if (stack) {
                    anchorX = ltx * 4 + 2 - ((this.localPlayer.x / 32) | 0);
                    anchorY = ltz * 4 + 2 - ((this.localPlayer.z / 32) | 0);
                    this.drawOnMinimap(anchorY, this.imageMapdot0, anchorX);
                }
            }
        }

        for (let i: number = 0; i < this.npcCount; i++) {
            const npc: NpcEntity | null = this.npcs[this.npcIds[i]];
            if (npc && npc.isVisible() && npc.type && npc.type.minimap) {
                let type: NpcType | null = npc.type;
                if (type.overrides) {
                    type = type.getOverrideType();
                }

                anchorX = ((npc.x / 32) | 0) - ((this.localPlayer.x / 32) | 0);
                anchorY = ((npc.z / 32) | 0) - ((this.localPlayer.z / 32) | 0);
                this.drawOnMinimap(anchorY, this.imageMapdot1, anchorX);
            }
        }

        for (let i: number = 0; i < this.playerCount; i++) {
            const player: PlayerEntity | null = this.players[this.playerIds[i]];
            if (player && player.isVisible() && player.name) {
                anchorX = ((player.x / 32) | 0) - ((this.localPlayer.x / 32) | 0);
                anchorY = ((player.z / 32) | 0) - ((this.localPlayer.z / 32) | 0);

                let friend: boolean = false;
                const name37: bigint = JString.toBase37(player.name);
                for (let j: number = 0; j < this.friendCount; j++) {
                    if (name37 === this.friendName37[j] && this.friendWorld[j] !== 0) {
                        friend = true;
                        break;
                    }
                }

                const team: boolean = player.team != 0 && this.localPlayer.team == player.team;

                if (friend) {
                    this.drawOnMinimap(anchorY, this.imageMapdot3, anchorX);
                } else if (team) {
                    this.drawOnMinimap(anchorY, this.imageMapdot4, anchorX);
                } else {
                    this.drawOnMinimap(anchorY, this.imageMapdot2, anchorX);
                }
            }
        }

        this.drawMinimapHint();

        if (this.flagSceneTileX !== 0) {
            anchorX = this.flagSceneTileX * 4 + 2 - ((this.localPlayer.x / 32) | 0);
            anchorY = this.flagSceneTileZ * 4 + 2 - ((this.localPlayer.z / 32) | 0);
            this.drawOnMinimap(anchorY, this.imageMapflag0, anchorX);
        }
        // the white square local player position in the center of the minimap.
        Draw2D.fillRect(97, 78, 3, 3, Colors.WHITE);
        this.areaViewport?.bind();
    };

    private drawOnMinimap = (dy: number, image: Pix24 | null, dx: number): void => {
        if (!image) {
            return;
        }

        const angle: number = (this.orbitCameraYaw + this.minimapAnticheatAngle) & 0x7ff;
        const distance: number = dx * dx + dy * dy;
        if (distance > 6400) {
            return;
        }

        let sinAngle: number = Draw3D.sin[angle];
        let cosAngle: number = Draw3D.cos[angle];

        sinAngle = ((sinAngle * 256) / (this.minimapZoom + 256)) | 0;
        cosAngle = ((cosAngle * 256) / (this.minimapZoom + 256)) | 0;

        const x: number = (dy * sinAngle + dx * cosAngle) >> 16;
        const y: number = (dy * cosAngle - dx * sinAngle) >> 16;

        if (distance > 2500 && this.imageMapback) {
            image.drawMasked(x + 94 - ((image.cropW / 2) | 0) + 4, 83 - y - ((image.cropH / 2) | 0) - 4, this.imageMapback);
        } else {
            image.draw(x + 94 - ((image.cropW / 2) | 0) + 4, 83 - y - ((image.cropH / 2) | 0) - 4);
        }
    };

    private createMinimap = (level: number): void => {
        if (!this.imageMinimap) {
            return;
        }

        const pixels: Int32Array = this.imageMinimap.pixels;
        const length: number = pixels.length;
        for (let i: number = 0; i < length; i++) {
            pixels[i] = 0;
        }

        for (let z: number = 1; z < CollisionMap.SIZE - 1; z++) {
            let offset: number = (CollisionMap.SIZE - 1 - z) * 512 * 4 + 24628;

            for (let x: number = 1; x < CollisionMap.SIZE - 1; x++) {
                if (this.levelTileFlags && (this.levelTileFlags[level][x][z] & 0x18) === 0) {
                    this.scene?.drawMinimapTile(level, x, z, pixels, offset, 512);
                }

                if (level < 3 && this.levelTileFlags && (this.levelTileFlags[level + 1][x][z] & 0x8) !== 0) {
                    this.scene?.drawMinimapTile(level + 1, x, z, pixels, offset, 512);
                }

                offset += 4;
            }
        }

        const wallRgb: number = ((((Math.random() * 20.0) | 0) + 238 - 10) << 16) + ((((Math.random() * 20.0) | 0) + 238 - 10) << 8) + ((Math.random() * 20.0) | 0) + 238 - 10;
        const doorRgb: number = (((Math.random() * 20.0) | 0) + 238 - 10) << 16;

        this.imageMinimap.bind();

        for (let z: number = 1; z < CollisionMap.SIZE - 1; z++) {
            for (let x: number = 1; x < CollisionMap.SIZE - 1; x++) {
                if (this.levelTileFlags && (this.levelTileFlags[level][x][z] & 0x18) === 0) {
                    this.drawMinimapLoc(x, z, level, wallRgb, doorRgb);
                }

                if (level < 3 && this.levelTileFlags && (this.levelTileFlags[level + 1][x][z] & 0x8) !== 0) {
                    this.drawMinimapLoc(x, z, level + 1, wallRgb, doorRgb);
                }
            }
        }

        this.areaViewport?.bind();
        this.activeMapFunctionCount = 0;

        for (let x: number = 0; x < CollisionMap.SIZE; x++) {
            for (let z: number = 0; z < CollisionMap.SIZE; z++) {
                let bitset: number = this.scene?.getGroundDecorationBitset(this.currentLevel, x, z) ?? 0;
                if (bitset === 0) {
                    continue;
                }

                bitset = (bitset >> 14) & 0x7fff;

                const func: number = LocType.get(bitset).mapfunction;
                if (func < 0) {
                    continue;
                }

                let stx: number = x;
                let stz: number = z;

                if (func !== 22 && func !== 29 && func !== 34 && func !== 36 && func !== 46 && func !== 47 && func !== 48) {
                    const maxX: number = CollisionMap.SIZE;
                    const maxZ: number = CollisionMap.SIZE;
                    const collisionmap: CollisionMap | null = this.levelCollisionMap[this.currentLevel];
                    if (collisionmap) {
                        const flags: Int32Array = collisionmap.flags;

                        for (let i: number = 0; i < 10; i++) {
                            const rand: number = (Math.random() * 4.0) | 0;
                            if (rand === 0 && stx > 0 && stx > x - 3 && (flags[CollisionMap.index(stx - 1, stz)] & CollisionFlag.BLOCK_WEST) === CollisionFlag.OPEN) {
                                stx--;
                            }

                            if (rand === 1 && stx < maxX - 1 && stx < x + 3 && (flags[CollisionMap.index(stx + 1, stz)] & CollisionFlag.BLOCK_EAST) === CollisionFlag.OPEN) {
                                stx++;
                            }

                            if (rand === 2 && stz > 0 && stz > z - 3 && (flags[CollisionMap.index(stx, stz - 1)] & CollisionFlag.BLOCK_SOUTH) === CollisionFlag.OPEN) {
                                stz--;
                            }

                            if (rand === 3 && stz < maxZ - 1 && stz < z + 3 && (flags[CollisionMap.index(stx, stz + 1)] & CollisionFlag.BLOCK_NORTH) === CollisionFlag.OPEN) {
                                stz++;
                            }
                        }
                    }
                }

                this.activeMapFunctions[this.activeMapFunctionCount] = this.imageMapfunction[func];
                this.activeMapFunctionX[this.activeMapFunctionCount] = stx;
                this.activeMapFunctionZ[this.activeMapFunctionCount] = stz;
                this.activeMapFunctionCount++;
            }
        }
    };

    private drawMinimapLoc = (tileX: number, tileZ: number, level: number, wallRgb: number, doorRgb: number): void => {
        if (!this.scene || !this.imageMinimap) {
            return;
        }
        let bitset: number = this.scene.getWallBitset(level, tileX, tileZ);
        if (bitset !== 0) {
            const info: number = this.scene.getInfo(level, tileX, tileZ, bitset);
            const angle: number = (info >> 6) & 0x3;
            const shape: number = info & 0x1f;
            let rgb: number = wallRgb;
            if (bitset > 0) {
                rgb = doorRgb;
            }

            const dst: Int32Array = this.imageMinimap.pixels;
            const offset: number = tileX * 4 + (103 - tileZ) * 512 * 4 + 24624;
            const locId: number = (bitset >> 14) & 0x7fff;

            const loc: LocType = LocType.get(locId);
            if (loc.mapscene === -1) {
                if (shape === LocShape.WALL_STRAIGHT.id || shape === LocShape.WALL_L.id) {
                    if (angle === LocAngle.WEST) {
                        dst[offset] = rgb;
                        dst[offset + 512] = rgb;
                        dst[offset + 1024] = rgb;
                        dst[offset + 1536] = rgb;
                    } else if (angle === LocAngle.NORTH) {
                        dst[offset] = rgb;
                        dst[offset + 1] = rgb;
                        dst[offset + 2] = rgb;
                        dst[offset + 3] = rgb;
                    } else if (angle === LocAngle.EAST) {
                        dst[offset + 3] = rgb;
                        dst[offset + 3 + 512] = rgb;
                        dst[offset + 3 + 1024] = rgb;
                        dst[offset + 3 + 1536] = rgb;
                    } else if (angle === LocAngle.SOUTH) {
                        dst[offset + 1536] = rgb;
                        dst[offset + 1536 + 1] = rgb;
                        dst[offset + 1536 + 2] = rgb;
                        dst[offset + 1536 + 3] = rgb;
                    }
                }

                if (shape === LocShape.WALL_SQUARE_CORNER.id) {
                    if (angle === LocAngle.WEST) {
                        dst[offset] = rgb;
                    } else if (angle === LocAngle.NORTH) {
                        dst[offset + 3] = rgb;
                    } else if (angle === LocAngle.EAST) {
                        dst[offset + 3 + 1536] = rgb;
                    } else if (angle === LocAngle.SOUTH) {
                        dst[offset + 1536] = rgb;
                    }
                }

                if (shape === LocShape.WALL_L.id) {
                    if (angle === LocAngle.SOUTH) {
                        dst[offset] = rgb;
                        dst[offset + 512] = rgb;
                        dst[offset + 1024] = rgb;
                        dst[offset + 1536] = rgb;
                    } else if (angle === LocAngle.WEST) {
                        dst[offset] = rgb;
                        dst[offset + 1] = rgb;
                        dst[offset + 2] = rgb;
                        dst[offset + 3] = rgb;
                    } else if (angle === LocAngle.NORTH) {
                        dst[offset + 3] = rgb;
                        dst[offset + 3 + 512] = rgb;
                        dst[offset + 3 + 1024] = rgb;
                        dst[offset + 3 + 1536] = rgb;
                    } else if (angle === LocAngle.EAST) {
                        dst[offset + 1536] = rgb;
                        dst[offset + 1536 + 1] = rgb;
                        dst[offset + 1536 + 2] = rgb;
                        dst[offset + 1536 + 3] = rgb;
                    }
                }
            } else {
                const scene: Pix8 | null = this.imageMapscene[loc.mapscene];
                if (scene) {
                    const offsetX: number = ((loc.width * 4 - scene.width) / 2) | 0;
                    const offsetY: number = ((loc.length * 4 - scene.height) / 2) | 0;
                    scene.draw(tileX * 4 + 48 + offsetX, (CollisionMap.SIZE - tileZ - loc.length) * 4 + offsetY + 48);
                }
            }
        }

        bitset = this.scene.getLocBitset(level, tileX, tileZ);
        if (bitset !== 0) {
            const info: number = this.scene.getInfo(level, tileX, tileZ, bitset);
            const angle: number = (info >> 6) & 0x3;
            const shape: number = info & 0x1f;
            const locId: number = (bitset >> 14) & 0x7fff;
            const loc: LocType = LocType.get(locId);

            if (loc.mapscene !== -1) {
                const scene: Pix8 | null = this.imageMapscene[loc.mapscene];
                if (scene) {
                    const offsetX: number = ((loc.width * 4 - scene.width) / 2) | 0;
                    const offsetY: number = ((loc.length * 4 - scene.height) / 2) | 0;
                    scene.draw(tileX * 4 + 48 + offsetX, (CollisionMap.SIZE - tileZ - loc.length) * 4 + offsetY + 48);
                }
            } else if (shape === LocShape.WALL_DIAGONAL.id) {
                let rgb: number = 0xeeeeee;
                if (bitset > 0) {
                    rgb = 0xee0000;
                }

                const dst: Int32Array = this.imageMinimap.pixels;
                const offset: number = tileX * 4 + (CollisionMap.SIZE - 1 - tileZ) * 512 * 4 + 24624;

                if (angle === LocAngle.WEST || angle === LocAngle.EAST) {
                    dst[offset + 1536] = rgb;
                    dst[offset + 1024 + 1] = rgb;
                    dst[offset + 512 + 2] = rgb;
                    dst[offset + 3] = rgb;
                } else {
                    dst[offset] = rgb;
                    dst[offset + 512 + 1] = rgb;
                    dst[offset + 1024 + 2] = rgb;
                    dst[offset + 1536 + 3] = rgb;
                }
            }
        }

        bitset = this.scene.getGroundDecorationBitset(level, tileX, tileZ);
        if (bitset !== 0) {
            const loc: LocType = LocType.get((bitset >> 14) & 0x7fff);
            if (loc.mapscene !== -1) {
                const scene: Pix8 | null = this.imageMapscene[loc.mapscene];
                if (scene) {
                    const offsetX: number = ((loc.width * 4 - scene.width) / 2) | 0;
                    const offsetY: number = ((loc.length * 4 - scene.height) / 2) | 0;
                    scene.draw(tileX * 4 + 48 + offsetX, (CollisionMap.SIZE - tileZ - loc.length) * 4 + offsetY + 48);
                }
            }
        }
    };

    private drawTooltip = (): void => {
        if (this.menuSize < 2 && this.objSelected === 0 && this.spellSelected === 0) {
            return;
        }

        let tooltip: string;
        if (this.objSelected === 1 && this.menuSize < 2) {
            tooltip = 'Use ' + this.objSelectedName + ' with...';
        } else if (this.spellSelected === 1 && this.menuSize < 2) {
            tooltip = this.spellCaption + '...';
        } else {
            tooltip = this.menuOption[this.menuSize - 1];
        }

        if (this.menuSize > 2) {
            tooltip = tooltip + '@whi@ / ' + (this.menuSize - 2) + ' more options';
        }

        this.fontBold12?.drawStringTooltip(4, 15, tooltip, Colors.WHITE, true, (Game.loopCycle / 1000) | 0);
    };

    private drawMenu = (): void => {
        const x: number = this.menuX;
        const y: number = this.menuY;
        const w: number = this.menuWidth;
        const h: number = this.menuHeight;
        const background: number = Colors.OPTIONS_MENU;

        // the menu area square.
        Draw2D.fillRect(x, y, w, h, background);
        Draw2D.fillRect(x + 1, y + 1, w - 2, 16, Colors.BLACK);
        Draw2D.drawRect(x + 1, y + 18, w - 2, h - 19, Colors.BLACK);

        // the menu title header at the top.
        this.fontBold12?.drawString(x + 3, y + 14, 'Choose Option', background);
        let mouseX: number = this.mouseX;
        let mouseY: number = this.mouseY;
        if (this.menuArea === 0) {
            mouseX -= 4;
            mouseY -= 4;
        }
        if (this.menuArea === 1) {
            mouseX -= 553;
            mouseY -= 205;
        }
        if (this.menuArea === 2) {
            mouseX -= 17;
            mouseY -= 357;
        }

        for (let i: number = 0; i < this.menuSize; i++) {
            const optionY: number = y + (this.menuSize - 1 - i) * 15 + 31;
            let rgb: number = Colors.WHITE;
            if (mouseX > x && mouseX < x + w && mouseY > optionY - 13 && mouseY < optionY + 3) {
                rgb = Colors.YELLOW;
            }
            this.fontBold12?.drawStringTaggable(x + 3, optionY, this.menuOption[i], rgb, true);
        }
    };

    private handleMouseInput = async (): Promise<void> => {
        if (this.objDragArea !== 0) {
            return;
        }

        let button: number = this.mouseClickButton;
        if (this.spellSelected === 1 && this.mouseClickX >= 516 && this.mouseClickY >= 160 && this.mouseClickX <= 765 && this.mouseClickY <= 205) {
            button = 0;
        }

        if (this.menuVisible) {
            if (button !== 1) {
                let x: number = this.mouseX;
                let y: number = this.mouseY;

                if (this.menuArea === 0) {
                    x -= 4;
                    y -= 4;
                } else if (this.menuArea === 1) {
                    x -= 553;
                    y -= 205;
                } else if (this.menuArea === 2) {
                    x -= 17;
                    y -= 357;
                }

                if (x < this.menuX - 10 || x > this.menuX + this.menuWidth + 10 || y < this.menuY - 10 || y > this.menuY + this.menuHeight + 10) {
                    this.menuVisible = false;
                    if (this.menuArea === 1) {
                        this.redrawSidebar = true;
                    }
                    if (this.menuArea === 2) {
                        this.redrawChatback = true;
                    }
                }
            }

            if (button === 1) {
                const menuX: number = this.menuX;
                const menuY: number = this.menuY;
                const menuWidth: number = this.menuWidth;

                let clickX: number = this.mouseClickX;
                let clickY: number = this.mouseClickY;

                if (this.menuArea === 0) {
                    clickX -= 4;
                    clickY -= 4;
                } else if (this.menuArea === 1) {
                    clickX -= 553;
                    clickY -= 205;
                } else if (this.menuArea === 2) {
                    clickX -= 17;
                    clickY -= 357;
                }

                let option: number = -1;
                for (let i: number = 0; i < this.menuSize; i++) {
                    const optionY: number = menuY + (this.menuSize - 1 - i) * 15 + 31;
                    if (clickX > menuX && clickX < menuX + menuWidth && clickY > optionY - 13 && clickY < optionY + 3) {
                        option = i;
                    }
                }

                if (option !== -1) {
                    await this.useMenuOption(option);
                }

                this.menuVisible = false;
                if (this.menuArea === 1) {
                    this.redrawSidebar = true;
                } else if (this.menuArea === 2) {
                    this.redrawChatback = true;
                }
            }
        } else {
            if (button === 1 && this.menuSize > 0) {
                const action: number = this.menuAction[this.menuSize - 1];

                if (action === 632 || action === 78 || action === 867 || action === 431 || action === 53 || action === 74 || action === 454 || action === 539 || action === 493 || action === 847 || action === 447 || action === 1125) {
                    const slot: number = this.menuParamB[this.menuSize - 1];
                    const comId: number = this.menuParamC[this.menuSize - 1];
                    const com: Component = Component.instances[comId];

                    if (com.draggable || com.moveReplaces) {
                        this.objGrabThreshold = false;
                        this.objDragCycles = 0;
                        this.objDragInterfaceId = comId;
                        this.objDragSlot = slot;
                        this.objDragArea = 2;
                        this.objGrabX = this.mouseClickX;
                        this.objGrabY = this.mouseClickY;

                        if (Component.instances[comId].layer === this.viewportInterfaceId) {
                            this.objDragArea = 1;
                        }

                        if (Component.instances[comId].layer === this.chatInterfaceId) {
                            this.objDragArea = 3;
                        }

                        return;
                    }
                }
            }

            if (button === 1 && (this.mouseButtonsOption === 1 || this.isAddFriendOption(this.menuSize - 1)) && this.menuSize > 2) {
                button = 2;
            }

            if (button === 1 && this.menuSize > 0) {
                await this.useMenuOption(this.menuSize - 1);
            }

            if (button !== 2 || this.menuSize <= 0) {
                return;
            }

            this.showContextMenu();
        }
    };

    handleMinimapInput = (): void => {
        if (this.minimapState !== 0) {
            return;
        }

        if (this.mouseClickButton === 1 && this.localPlayer) {
            let x: number = this.mouseClickX - 25 - 550;
            let y: number = this.mouseClickY - 5 - 4;

            if (x >= 0 && y >= 0 && x < 146 && y < 151) {
                x -= 73;
                y -= 75;

                const yaw: number = (this.orbitCameraYaw + this.minimapAnticheatAngle) & 0x7ff;
                let sinYaw: number = Draw3D.sin[yaw];
                let cosYaw: number = Draw3D.cos[yaw];

                sinYaw = (sinYaw * (this.minimapZoom + 256)) >> 8;
                cosYaw = (cosYaw * (this.minimapZoom + 256)) >> 8;

                const relX: number = (y * sinYaw + x * cosYaw) >> 11;
                const relY: number = (y * cosYaw - x * sinYaw) >> 11;

                const tileX: number = (this.localPlayer.x + relX) >> 7;
                const tileZ: number = (this.localPlayer.z - relY) >> 7;

                if (this.tryMove(this.localPlayer.pathTileX[0], this.localPlayer.pathTileZ[0], tileX, tileZ, 1, 0, 0, 0, 0, 0, true)) {
                    // the additional 14-bytes in MOVE_MINIMAPCLICK
                    this.out.p1(x);
                    this.out.p1(y);
                    this.out.p2(this.orbitCameraYaw);
                    this.out.p1(57);
                    this.out.p1(this.minimapAnticheatAngle);
                    this.out.p1(this.minimapZoom);
                    this.out.p1(89);
                    this.out.p2(this.localPlayer.x);
                    this.out.p2(this.localPlayer.z);
                    this.out.p1(this.tryMoveNearest);
                    this.out.p1(63);
                }
            }
        }
    };

    private isAddFriendOption = (option: number): boolean => {
        if (option < 0) {
            return false;
        }
        let action: number = this.menuAction[option];
        if (action >= 2000) {
            action -= 2000;
        }
        return action === 337;
    };

    private useMenuOption = async (optionId: number): Promise<void> => {
        if (optionId < 0) {
            return;
        }

        if (this.chatbackInputType != 0) {
            this.chatbackInputType = 0;
            this.redrawChatback = true;
        }

        let action: number = this.menuAction[optionId];
        const a: number = this.menuParamA[optionId];
        const b: number = this.menuParamB[optionId];
        const c: number = this.menuParamC[optionId];

        if (action >= 2000) {
            action -= 2000;
        }

        if (action === 484 || action === 6) {
            let option: string = this.menuOption[optionId];
            const tag: number = option.indexOf('@whi@');

            if (tag !== -1) {
                option = option.substring(tag + 5).trim();
                const name: string = JString.formatName(JString.fromBase37(JString.toBase37(option)));
                let found: boolean = false;

                for (let i: number = 0; i < this.playerCount; i++) {
                    const player: PlayerEntity | null = this.players[this.playerIds[i]];

                    if (player && player.name && player.name.toLowerCase() === name.toLowerCase() && this.localPlayer) {
                        this.tryMove(this.localPlayer.pathTileX[0], this.localPlayer.pathTileZ[0], player.pathTileX[0], player.pathTileZ[0], 2, 1, 1, 0, 0, 0, false);

                        if (action === 484) {
                            // OPPLAYER4
                            this.out.p1isaac(ClientProt.OPPLAYER4);
                            this.out.p2_alt1(this.playerIds[i]);
                        } else if (action === 6) {
                            // OPPLAYER1
                            this.out.p1isaac(ClientProt.OPPLAYER1);
                            this.out.p2(this.playerIds[i]);
                        }

                        found = true;
                        break;
                    }
                }

                if (!found) {
                    this.addMessage(0, 'Unable to find ' + name, '');
                }
            }
        } else if (action === 62 && this.interactWithLoc(b, c, a)) {
            // OPLOCU
            this.out.p1isaac(ClientProt.OPLOCU);
            this.out.p2(this.objSelectedInterface);
            this.out.p2_alt1((a >> 14) & 0x7fff);
            this.out.p2_alt3(c + this.sceneBaseTileZ);
            this.out.p2_alt1(this.objSelectedSlot);
            this.out.p2_alt3(b + this.sceneBaseTileX);
            this.out.p2(this.objInterface);
        } else if (action === 74 || action === 454 || action === 539 || action === 493 || action === 847) {
            if (action === 493) {
                // OPHELD4
                this.out.p1isaac(ClientProt.OPHELD4);
                this.out.p2_alt3(c);
                this.out.p2_alt1(b);
                this.out.p2_alt2(a);
            } else if (action === 847) {
                // OPHELD5
                this.out.p1isaac(ClientProt.OPHELD5);
                this.out.p2_alt2(a);
                this.out.p2(c);
                this.out.p2_alt2(b);
            } else if (action === 539) {
                // OPHELD3
                this.out.p1isaac(ClientProt.OPHELD3);
                this.out.p2_alt2(a);
                this.out.p2_alt3(b);
                this.out.p2_alt3(c);
            } else if (action === 74) {
                // OPHELD1
                this.out.p1isaac(ClientProt.OPHELD1);
                this.out.p2_alt3(c);
                this.out.p2_alt2(b);
                this.out.p2_alt1(a);
            } else if (action === 454) {
                // OPHELD2
                this.out.p1isaac(ClientProt.OPHELD2);
                this.out.p2(a);
                this.out.p2_alt2(b);
                this.out.p2_alt2(c);
            }

            this.selectedCycle = 0;
            this.selectedInterface = c;
            this.selectedItem = b;
            this.selectedArea = 2;

            if (Component.instances[c].layer === this.viewportInterfaceId) {
                this.selectedArea = 1;
            }

            if (Component.instances[c].layer === this.chatInterfaceId) {
                this.selectedArea = 3;
            }
        } else if (action === 20 || action === 412 || action === 225 || action === 965 || action === 478) {
            const npc: NpcEntity | null = this.npcs[a];
            if (npc && this.localPlayer) {
                this.tryMove(this.localPlayer.pathTileX[0], this.localPlayer.pathTileZ[0], npc.pathTileX[0], npc.pathTileZ[0], 2, 1, 1, 0, 0, 0, false);

                this.crossX = this.mouseClickX;
                this.crossY = this.mouseClickY;
                this.crossMode = 2;
                this.crossCycle = 0;

                if (action === 412) {
                    // OPNPC2
                    this.out.p1isaac(ClientProt.OPNPC2);
                    this.out.p2_alt2(a);
                } else if (action === 225) {
                    // OPNPC3
                    this.out.p1isaac(ClientProt.OPNPC3);
                    this.out.p2_alt3(a);
                } else if (action === 965) {
                    // OPNPC4
                    this.out.p1isaac(ClientProt.OPNPC4);
                    this.out.p2(a);
                } else if (action === 20) {
                    // OPNPC1
                    this.out.p1isaac(ClientProt.OPNPC1);
                    this.out.p2_alt1(a);
                } else if (action === 478) {
                    // OPNPC5
                    this.out.p1isaac(ClientProt.OPNPC5);
                    this.out.p2_alt1(a);
                }
            }
        } else if (action === 511) {
            if (this.localPlayer) {
                const success: boolean = this.tryMove(this.localPlayer.pathTileX[0], this.localPlayer.pathTileZ[0], b, c, 2, 0, 0, 0, 0, 0, false);
                if (!success) {
                    this.tryMove(this.localPlayer.pathTileX[0], this.localPlayer.pathTileZ[0], b, c, 2, 1, 1, 0, 0, 0, false);
                }

                this.crossX = this.mouseClickX;
                this.crossY = this.mouseClickY;
                this.crossMode = 2;
                this.crossCycle = 0;

                // OPOBJU
                this.out.p1isaac(ClientProt.OPOBJU);
                this.out.p2_alt1(this.objSelectedInterface);
                this.out.p2_alt2(this.objInterface);
                this.out.p2(a);
                this.out.p2_alt2(c + this.sceneBaseTileZ);
                this.out.p2_alt3(this.objSelectedSlot);
                this.out.p2(b + this.sceneBaseTileX);
            }
        } else if (action === 1226) {
            // loc examine
            const locId: number = (a >> 14) & 0x7fff;
            const loc: LocType = LocType.get(locId);

            let examine: string;
            if (!loc.desc) {
                examine = "It's a " + loc.name + '.';
            } else {
                examine = loc.desc;
            }

            this.addMessage(0, examine, '');
        } else if (action === 502) {
            // OPLOC1
            this.interactWithLoc(b, c, a);
            this.out.p1isaac(ClientProt.OPLOC1);
            this.out.p2_alt3(b + this.sceneBaseTileX);
            this.out.p2((a >> 14) & 0x7fff);
            this.out.p2_alt2(c + this.sceneBaseTileZ);
        } else if (action === 870) {
            // OPHELDU
            this.out.p1isaac(ClientProt.OPHELDU);
            this.out.p2(a);
            this.out.p2_alt2(this.objSelectedSlot);
            this.out.p2_alt3(b);
            this.out.p2(this.objSelectedInterface);
            this.out.p2_alt1(this.objInterface);
            this.out.p2(c);

            this.selectedCycle = 0;
            this.selectedInterface = c;
            this.selectedItem = b;
            this.selectedArea = 2;

            if (Component.instances[c].layer === this.viewportInterfaceId) {
                this.selectedArea = 1;
            }

            if (Component.instances[c].layer === this.chatInterfaceId) {
                this.selectedArea = 3;
            }
        } else if (action === 543) {
            // OPHELDT
            this.out.p1isaac(ClientProt.OPHELDT);
            this.out.p2(b);
            this.out.p2_alt2(a);
            this.out.p2(c);
            this.out.p2_alt2(this.activeSpellId);

            this.selectedCycle = 0;
            this.selectedInterface = c;
            this.selectedItem = b;
            this.selectedArea = 2;

            if (Component.instances[c].layer === this.viewportInterfaceId) {
                this.selectedArea = 1;
            }

            if (Component.instances[c].layer === this.chatInterfaceId) {
                this.selectedArea = 3;
            }
        } else if (action === 516) {
            if (this.menuVisible) {
                this.scene?.click(b - 4, c - 4);
            } else {
                this.scene?.click(this.mouseClickX - 4, this.mouseClickY - 4);
            }
        } else if (action === 447) {
            // select obj interface
            this.objSelected = 1;
            this.objSelectedSlot = b;
            this.objSelectedInterface = c;
            this.objInterface = a;
            this.objSelectedName = ObjType.get(a).name;
            this.spellSelected = 0;
            this.redrawSidebar = true;
            return;
        } else if (action === 679) {
            // RESUME_PAUSEBUTTON
            if (!this.pressedContinueOption) {
                this.out.p1isaac(ClientProt.RESUME_PAUSEBUTTON);
                this.out.p2(c);
                this.pressedContinueOption = true;
            }
        } else if (action === 1125) {
            // inv obj examine
            const obj: ObjType = ObjType.get(a);
            let examine: string;

            if (c >= 100000) {
                examine = c + ' x ' + obj.name;
            } else if (!obj.desc) {
                examine = "It's a " + obj.name + '.';
            } else {
                examine = obj.desc;
            }
            this.addMessage(0, examine, '');
        } else if (action === 582) {
            const npc: NpcEntity | null = this.npcs[a];

            if (npc && this.localPlayer) {
                this.tryMove(this.localPlayer.pathTileX[0], this.localPlayer.pathTileZ[0], npc.pathTileX[0], npc.pathTileZ[0], 2, 1, 1, 0, 0, 0, false);
                this.crossX = this.mouseClickX;
                this.crossY = this.mouseClickY;
                this.crossMode = 2;
                this.crossCycle = 0;
                // OPNPCU
                this.out.p1isaac(ClientProt.OPNPCU);
                this.out.p2(this.objInterface);
                this.out.p2(a);
                this.out.p2(this.objSelectedSlot);
                this.out.p2(this.objSelectedInterface);
            }
        } else if (action === 577 || action === 27 || action === 779 || action === 561 || action === 729) {
            const player: PlayerEntity | null = this.players[a];
            if (player && this.localPlayer) {
                this.tryMove(this.localPlayer.pathTileX[0], this.localPlayer.pathTileZ[0], player.pathTileX[0], player.pathTileZ[0], 2, 1, 1, 0, 0, 0, false);

                this.crossX = this.mouseClickX;
                this.crossY = this.mouseClickY;
                this.crossMode = 2;
                this.crossCycle = 0;

                if (action === 561) {
                    // OPPLAYER1
                    this.out.p1isaac(ClientProt.OPPLAYER1);
                    this.out.p2(a);
                } else if (action === 779) {
                    // OPPLAYER2
                    this.out.p1isaac(ClientProt.OPPLAYER2);
                    this.out.p2_alt1(a);
                } else if (action === 577) {
                    // OPPLAYER4
                    this.out.p1isaac(ClientProt.OPPLAYER4);
                    this.out.p2_alt1(a);
                } else if (action === 27) {
                    // OPPLAYER3
                    this.out.p1isaac(ClientProt.OPPLAYER3);
                    this.out.p2_alt1(a);
                } else if (action === 729) {
                    // OPPLAYER5
                    this.out.p1isaac(ClientProt.OPPLAYER5);
                    this.out.p2_alt1(a);
                }
            }
        } else if (action === 413) {
            const npc: NpcEntity | null = this.npcs[a];
            if (npc && this.localPlayer) {
                this.tryMove(this.localPlayer.pathTileX[0], this.localPlayer.pathTileZ[0], npc.pathTileX[0], npc.pathTileZ[0], 2, 1, 1, 0, 0, 0, false);

                this.crossX = this.mouseClickX;
                this.crossY = this.mouseClickY;
                this.crossMode = 2;
                this.crossCycle = 0;

                // OPNPCT
                this.out.p1isaac(ClientProt.OPNPCT);
                this.out.p2_alt3(a);
                this.out.p2_alt2(this.activeSpellId);
            }
        } else if (action === 639) {
            const option: string = this.menuOption[optionId];
            const tag: number = option.indexOf('@whi@');

            if (tag !== -1) {
                const name37: bigint = JString.toBase37(option.substring(tag + 5).trim());
                let friend: number = -1;
                for (let i: number = 0; i < this.friendCount; i++) {
                    if (this.friendName37[i] === name37) {
                        friend = i;
                        break;
                    }
                }

                if (friend !== -1 && this.friendWorld[friend] > 0) {
                    this.redrawChatback = true;
                    this.chatbackInputType = 0;
                    this.showSocialInput = true;
                    this.socialInput = '';
                    this.socialAction = 3;
                    this.socialName37 = this.friendName37[friend];
                    this.socialMessage = 'Enter message to send to ' + this.friendName[friend];
                }
            }
        } else if (action === 956) {
            // OPLOCT
            if (this.interactWithLoc(b, c, a)) {
                this.out.p1isaac(ClientProt.OPLOCT);
                this.out.p2_alt1(b + this.sceneBaseTileX);
                this.out.p2_alt2(this.activeSpellId);
                this.out.p2_alt2(c + this.sceneBaseTileZ);
                this.out.p2_alt1((a >> 14) & 0x7fff);
            }
        } else if (action === 652 || action === 567 || action === 234 || action === 244 || action === 213) {
            if (this.localPlayer) {
                const success: boolean = this.tryMove(this.localPlayer.pathTileX[0], this.localPlayer.pathTileZ[0], b, c, 2, 0, 0, 0, 0, 0, false);
                if (!success) {
                    this.tryMove(this.localPlayer.pathTileX[0], this.localPlayer.pathTileZ[0], b, c, 2, 1, 1, 0, 0, 0, false);
                }

                this.crossX = this.mouseClickX;
                this.crossY = this.mouseClickY;
                this.crossMode = 2;
                this.crossCycle = 0;

                if (action === 652) {
                    // OPOBJ1
                    this.out.p1isaac(ClientProt.OPOBJ1);
                    this.out.p2_alt2(b + this.sceneBaseTileX);
                    this.out.p2_alt1(c + this.sceneBaseTileZ);
                    this.out.p2_alt3(a);
                } else if (action === 244) {
                    // OPOBJ4
                    this.out.p1isaac(ClientProt.OPOBJ4);
                    this.out.p2_alt1(b + this.sceneBaseTileX);
                    this.out.p2_alt3(c + this.sceneBaseTileZ);
                    this.out.p2_alt2(a);
                } else if (action === 213) {
                    // OPOBJ5
                    this.out.p1isaac(ClientProt.OPOBJ5);
                    this.out.p2_alt1(c + this.sceneBaseTileZ);
                    this.out.p2(a);
                    this.out.p2_alt2(b + this.sceneBaseTileX);
                } else if (action === 234) {
                    // OPOBJ3
                    this.out.p1isaac(ClientProt.OPOBJ3);
                    this.out.p2_alt1(c + this.sceneBaseTileZ);
                    this.out.p2(a);
                    this.out.p2_alt1(b + this.sceneBaseTileX);
                } else if (action === 567) {
                    // OPOBJ2
                    this.out.p1isaac(ClientProt.OPOBJ2);
                    this.out.p2_alt1(c + this.sceneBaseTileZ);
                    this.out.p2_alt1(a);
                    this.out.p2_alt1(b + this.sceneBaseTileX);
                }
            }
        } else if (action === 1025) {
            // npc examine
            const npc: NpcEntity | null = this.npcs[a];

            if (npc) {
                let type: NpcType | null = npc.type;

                if (type && type.overrides) {
                    type = type.getOverrideType();
                }

                let examine: string;
                if (type) {
                    if (!type.desc) {
                        examine = "It's a " + type.name + '.';
                    } else {
                        examine = type.desc;
                    }

                    this.addMessage(0, examine, '');
                }
            }
        } else if (action === 900) {
            // OPLOC2
            this.interactWithLoc(b, c, a);
            this.out.p1isaac(ClientProt.OPLOC2);
            this.out.p2_alt3((a >> 14) & 0x7fff);
            this.out.p2_alt1(c + this.sceneBaseTileZ);
            this.out.p2_alt2(b + this.sceneBaseTileX);
        } else if (action === 626) {
            const com: Component = Component.instances[c];
            this.spellSelected = 1;
            this.activeSpellId = c;
            this.activeSpellFlags = com.actionTarget;
            this.objSelected = 0;
            this.redrawSidebar = true;

            let prefix: string | null = com.actionVerb;
            if (prefix && prefix.indexOf(' ') !== -1) {
                prefix = prefix.substring(0, prefix.indexOf(' '));
            }

            let suffix: string | null = com.actionVerb;
            if (suffix && suffix.indexOf(' ') !== -1) {
                suffix = suffix.substring(suffix.indexOf(' ') + 1);
            }

            this.spellCaption = prefix + ' ' + com.action + ' ' + suffix;
            if (this.activeSpellFlags === 16) {
                this.redrawSidebar = true;
                this.selectedTab = 3;
                this.redrawSideicons = true;
            }

            return;
        } else if (action === 315) {
            const com: Component = Component.instances[c];
            let notify: boolean = true;

            if (com.clientCode > 0) {
                notify = this.handleInterfaceAction(com);
            }

            if (notify) {
                // IF_BUTTON
                this.out.p1isaac(ClientProt.IF_BUTTON);
                this.out.p2(c);
            }
        } else if (action === 632 || action === 78 || action === 867 || action === 431 || action === 53) {
            if (action === 867) {
                // INV_BUTTON3
                this.out.p1isaac(ClientProt.INV_BUTTON3);
                this.out.p2_alt1(c);
                this.out.p2_alt2(b);
                this.out.p2_alt2(a);
            } else if (action === 53) {
                // INV_BUTTON5
                this.out.p1isaac(ClientProt.INV_BUTTON5);
                this.out.p2_alt1(a);
                this.out.p2_alt2(b);
                this.out.p2_alt1(c);
            } else if (action === 632) {
                // INV_BUTTON1
                this.out.p1isaac(ClientProt.INV_BUTTON1);
                this.out.p2_alt2(c);
                this.out.p2_alt2(b);
                this.out.p2_alt2(a);
            } else if (action === 431) {
                // INV_BUTTON4
                this.out.p1isaac(ClientProt.INV_BUTTON4);
                this.out.p2_alt2(b);
                this.out.p2(c);
                this.out.p2_alt2(a);
            } else if (action === 78) {
                // INV_BUTTON2
                this.out.p1isaac(ClientProt.INV_BUTTON2);
                this.out.p2_alt3(b);
                this.out.p2_alt3(c);
                this.out.p2_alt1(a);
            }

            this.selectedCycle = 0;
            this.selectedInterface = c;
            this.selectedItem = b;
            this.selectedArea = 2;

            if (Component.instances[c].layer === this.viewportInterfaceId) {
                this.selectedArea = 1;
            }

            if (Component.instances[c].layer === this.chatInterfaceId) {
                this.selectedArea = 3;
            }
        } else if (action === 872) {
            // OPLOC4
            this.interactWithLoc(b, c, a);
            this.out.p1isaac(ClientProt.OPLOC4);
            this.out.p2_alt3(b + this.sceneBaseTileX);
            this.out.p2_alt2((a >> 14) & 0x7fff);
            this.out.p2_alt3(c + this.sceneBaseTileZ);
        } else if (action === 94) {
            if (this.localPlayer) {
                const success: boolean = this.tryMove(this.localPlayer.pathTileX[0], this.localPlayer.pathTileZ[0], b, c, 2, 0, 0, 0, 0, 0, false);
                if (!success) {
                    this.tryMove(this.localPlayer.pathTileX[0], this.localPlayer.pathTileZ[0], b, c, 2, 1, 1, 0, 0, 0, false);
                }
                this.crossX = this.mouseClickX;
                this.crossY = this.mouseClickY;
                this.crossMode = 2;
                this.crossCycle = 0;

                // OPOBJT
                this.out.p1isaac(ClientProt.OPOBJT);
                this.out.p2_alt1(b + this.sceneBaseTileX);
                this.out.p2(c + this.sceneBaseTileZ);
                this.out.p2_alt1(a);
                this.out.p2_alt2(this.activeSpellId);
            }
        } else if (action === 1062) {
            // OPLOC5
            this.interactWithLoc(b, c, a);
            this.out.p1isaac(ClientProt.OPLOC5);
            this.out.p2_alt2((a >> 14) & 0x7fff);
            this.out.p2_alt2(c + this.sceneBaseTileZ);
            this.out.p2(b + this.sceneBaseTileX);
        } else if (action === 113) {
            // OPLOC3
            this.interactWithLoc(b, c, a);
            this.out.p1isaac(ClientProt.OPLOC3);
            this.out.p2_alt1(b + this.sceneBaseTileX);
            this.out.p2(c + this.sceneBaseTileZ);
            this.out.p2_alt3((a >> 14) & 0x7fff);
        } else if (action === 1448) {
            // obj examine
            const obj: ObjType = ObjType.get(a);
            let examine: string;

            if (!obj.desc) {
                examine = "It's a " + obj.name + '.';
            } else {
                examine = obj.desc;
            }
            this.addMessage(0, examine, '');
        } else if (action === 646) {
            // IF_BUTTON
            this.out.p1isaac(ClientProt.IF_BUTTON);
            this.out.p2(c);

            const com: Component = Component.instances[c];
            if (com.scripts && com.scripts[0] && com.scripts[0][0] === 5) {
                const varp: number = com.scripts[0][1];
                if (com.scriptOperand && this.varps[varp] !== com.scriptOperand[0]) {
                    this.varps[varp] = com.scriptOperand[0];
                    await this.updateVarp(varp);
                    this.redrawSidebar = true;
                }
            }
        } else if (action === 606) {
            // reportabuse input
            const option: string = this.menuOption[optionId];
            const tag: number = option.indexOf('@whi@');

            if (tag !== -1) {
                if (this.viewportInterfaceId === -1) {
                    this.closeInterfaces();

                    this.reportAbuseInput = option.substring(tag + 5).trim();
                    this.reportAbuseMuteOption = false;

                    for (let i: number = 0; i < Component.instances.length; i++) {
                        if (Component.instances[i] && Component.instances[i].clientCode === Component.CC_REPORT_INPUT) {
                            this.reportAbuseInterfaceID = this.viewportInterfaceId = Component.instances[i].layer;
                            break;
                        }
                    }
                } else {
                    this.addMessage(0, "Please close the interface you have open before using 'report abuse'", '');
                }
            }
        } else if (action === 200) {
            // close interfaces
            this.closeInterfaces();
        } else if (action === 491) {
            const player: PlayerEntity | null = this.players[a];
            if (player && this.localPlayer) {
                this.tryMove(this.localPlayer.pathTileX[0], this.localPlayer.pathTileZ[0], player.pathTileX[0], player.pathTileZ[0], 2, 1, 1, 0, 0, 0, false);

                this.crossX = this.mouseClickX;
                this.crossY = this.mouseClickY;
                this.crossMode = 2;
                this.crossCycle = 0;

                // OPPLAYERU
                this.out.p1isaac(ClientProt.OPPLAYERU);
                this.out.p2_alt2(this.objSelectedInterface);
                this.out.p2(a);
                this.out.p2(this.objInterface);
                this.out.p2_alt1(this.objSelectedSlot);
            }
        } else if (action === 169) {
            // IF_BUTTON
            this.out.p1isaac(ClientProt.IF_BUTTON);
            this.out.p2(c);

            const com: Component = Component.instances[c];
            if (com.scripts && com.scripts[0] && com.scripts[0][0] === 5) {
                const varp: number = com.scripts[0][1];
                this.varps[varp] = 1 - this.varps[varp];
                await this.updateVarp(varp);
                this.redrawSidebar = true;
            }
        } else if (action === 337 || action === 42 || action === 792 || action === 322) {
            const option: string = this.menuOption[optionId];
            const tag: number = option.indexOf('@whi@');

            if (tag !== -1) {
                const username: bigint = JString.toBase37(option.substring(tag + 5).trim());
                if (action === 337) {
                    this.addFriend(username);
                } else if (action === 42) {
                    this.addIgnore(username);
                } else if (action === 792) {
                    this.removeFriend(username);
                } else if (action === 322) {
                    this.removeIgnore(username);
                }
            }
        } else if (action === 365) {
            const player: PlayerEntity | null = this.players[a];

            if (player && this.localPlayer) {
                this.tryMove(this.localPlayer.pathTileX[0], this.localPlayer.pathTileZ[0], player.pathTileX[0], player.pathTileZ[0], 2, 1, 1, 0, 0, 0, false);

                this.crossX = this.mouseClickX;
                this.crossY = this.mouseClickY;
                this.crossMode = 2;
                this.crossCycle = 0;

                // OPPLAYERT
                this.out.p1isaac(ClientProt.OPPLAYERT);
                this.out.p2_alt2(a);
                this.out.p2_alt1(this.activeSpellId);
            }
        }

        this.objSelected = 0;
        this.spellSelected = 0;
        this.redrawSidebar = true;
    };

    private handleInterfaceAction = (com: Component): boolean => {
        const clientCode: number = com.clientCode;
        console.log('clicked clientcode: ', clientCode);
        if (this.friendlistStatus == 2) {
            if (clientCode === Component.CC_ADD_FRIEND) {
                this.redrawChatback = true;
                this.chatbackInputType = 0;
                this.showSocialInput = true;
                this.socialInput = '';
                this.socialAction = 1;
                this.socialMessage = 'Enter name of friend to add to list';
            }

            if (clientCode === Component.CC_DEL_FRIEND) {
                this.redrawChatback = true;
                this.chatbackInputType = 0;
                this.showSocialInput = true;
                this.socialInput = '';
                this.socialAction = 2;
                this.socialMessage = 'Enter name of friend to delete from list';
            }
        }

        if (clientCode === Component.CC_LOGOUT) {
            this.idleTimeout = 250;
            return true;
        }

        if (clientCode === Component.CC_ADD_IGNORE) {
            this.redrawChatback = true;
            this.chatbackInputType = 0;
            this.showSocialInput = true;
            this.socialInput = '';
            this.socialAction = 4;
            this.socialMessage = 'Enter name of player to add to list';
        }

        if (clientCode === Component.CC_DEL_IGNORE) {
            this.redrawChatback = true;
            this.chatbackInputType = 0;
            this.showSocialInput = true;
            this.socialInput = '';
            this.socialAction = 5;
            this.socialMessage = 'Enter name of player to delete from list';
        }

        // physical parts
        if (clientCode >= Component.CC_CHANGE_HEAD_L && clientCode <= Component.CC_CHANGE_FEET_R) {
            const part: number = ((clientCode - 300) / 2) | 0;
            const direction: number = clientCode & 0x1;
            let kit: number = this.designIdentikits[part];

            if (kit !== -1) {
                // eslint-disable-next-line no-constant-condition
                while (true) {
                    if (direction === 0) {
                        kit--;
                        if (kit < 0) {
                            kit = IdkType.count - 1;
                        }
                    }

                    if (direction === 1) {
                        kit++;
                        if (kit >= IdkType.count) {
                            kit = 0;
                        }
                    }

                    if (!IdkType.instances[kit].disable && IdkType.instances[kit].type === part + (this.designGenderMale ? 0 : 7)) {
                        this.designIdentikits[part] = kit;
                        this.updateDesignModel = true;
                        break;
                    }
                }
            }
        }

        // recoloring parts
        if (clientCode >= Component.CC_RECOLOUR_HAIR_L && clientCode <= Component.CC_RECOLOUR_SKIN_R) {
            const part: number = ((clientCode - 314) / 2) | 0;
            const direction: number = clientCode & 0x1;
            let color: number = this.designColors[part];

            if (direction === 0) {
                color--;
                if (color < 0) {
                    color = PlayerEntity.DESIGN_IDK_COLORS[part].length - 1;
                }
            }

            if (direction === 1) {
                color++;
                if (color >= PlayerEntity.DESIGN_IDK_COLORS[part].length) {
                    color = 0;
                }
            }

            this.designColors[part] = color;
            this.updateDesignModel = true;
        }

        if (clientCode === Component.CC_SWITCH_TO_MALE && !this.designGenderMale) {
            this.designGenderMale = true;
            this.validateCharacterDesign();
        }

        if (clientCode === Component.CC_SWITCH_TO_FEMALE && this.designGenderMale) {
            this.designGenderMale = false;
            this.validateCharacterDesign();
        }

        if (clientCode === Component.CC_ACCEPT_DESIGN) {
            this.out.p1isaac(ClientProt.IF_PLAYERDESIGN);
            this.out.p1(this.designGenderMale ? 0 : 1);
            for (let i: number = 0; i < 7; i++) {
                this.out.p1(this.designIdentikits[i]);
            }
            for (let i: number = 0; i < 5; i++) {
                this.out.p1(this.designColors[i]);
            }
            return true;
        }

        if (clientCode === Component.CC_MOD_MUTE) {
            this.reportAbuseMuteOption = !this.reportAbuseMuteOption;
        }

        // reportabuse rules options
        if (clientCode >= Component.CC_REPORT_RULE1 && clientCode <= Component.CC_REPORT_RULE12) {
            this.closeInterfaces();

            if (this.reportAbuseInput.length > 0) {
                this.out.p1isaac(ClientProt.BUG_REPORT);
                this.out.p8(JString.toBase37(this.reportAbuseInput));
                this.out.p1(clientCode - 601);
                this.out.p1(this.reportAbuseMuteOption ? 1 : 0);
            }
        }
        return false;
    };

    private validateCharacterDesign = (): void => {
        this.updateDesignModel = true;

        for (let i: number = 0; i < 7; i++) {
            this.designIdentikits[i] = -1;

            for (let j: number = 0; j < IdkType.count; j++) {
                if (!IdkType.instances[j].disable && IdkType.instances[j].type === i + (this.designGenderMale ? 0 : 7)) {
                    this.designIdentikits[i] = j;
                    break;
                }
            }
        }
    };

    private interactWithLoc = (x: number, z: number, bitset: number): boolean => {
        if (!this.localPlayer || !this.scene) {
            return false;
        }

        const locId: number = (bitset >> 14) & 0x7fff;
        const info: number = this.scene.getInfo(this.currentLevel, x, z, bitset);
        if (info === -1) {
            return false;
        }

        const shape: number = info & 0x1f;
        const angle: number = (info >> 6) & 0x3;
        if (shape === LocShape.CENTREPIECE_STRAIGHT.id || shape === LocShape.CENTREPIECE_DIAGONAL.id || shape === LocShape.GROUND_DECOR.id) {
            const loc: LocType = LocType.get(locId);
            let width: number;
            let height: number;

            if (angle === LocAngle.WEST || angle === LocAngle.EAST) {
                width = loc.width;
                height = loc.length;
            } else {
                width = loc.length;
                height = loc.width;
            }

            let forceapproach: number = loc.forceapproach;
            if (angle !== 0) {
                forceapproach = ((forceapproach << angle) & 0xf) + (forceapproach >> (4 - angle));
            }

            this.tryMove(this.localPlayer.pathTileX[0], this.localPlayer.pathTileZ[0], x, z, 2, width, height, 0, 0, forceapproach, false);
        } else {
            this.tryMove(this.localPlayer.pathTileX[0], this.localPlayer.pathTileZ[0], x, z, 2, 0, 0, angle, shape + 1, 0, false);
        }

        this.crossX = this.mouseClickX;
        this.crossY = this.mouseClickY;
        this.crossMode = 2;
        this.crossCycle = 0;
        return true;
    };

    private handleTabInput = (): void => {
        if (this.mouseClickButton === 1) {
            if (this.mouseClickX >= 539 && this.mouseClickX <= 573 && this.mouseClickY >= 169 && this.mouseClickY < 205 && this.tabInterfaceId[0] !== -1) {
                this.redrawSidebar = true;
                this.selectedTab = 0;
                this.redrawSideicons = true;
            } else if (this.mouseClickX >= 569 && this.mouseClickX <= 599 && this.mouseClickY >= 168 && this.mouseClickY < 205 && this.tabInterfaceId[1] !== -1) {
                this.redrawSidebar = true;
                this.selectedTab = 1;
                this.redrawSideicons = true;
            } else if (this.mouseClickX >= 597 && this.mouseClickX <= 627 && this.mouseClickY >= 168 && this.mouseClickY < 205 && this.tabInterfaceId[2] !== -1) {
                this.redrawSidebar = true;
                this.selectedTab = 2;
                this.redrawSideicons = true;
            } else if (this.mouseClickX >= 625 && this.mouseClickX <= 669 && this.mouseClickY >= 168 && this.mouseClickY < 203 && this.tabInterfaceId[3] !== -1) {
                this.redrawSidebar = true;
                this.selectedTab = 3;
                this.redrawSideicons = true;
            } else if (this.mouseClickX >= 666 && this.mouseClickX <= 696 && this.mouseClickY >= 168 && this.mouseClickY < 205 && this.tabInterfaceId[4] !== -1) {
                this.redrawSidebar = true;
                this.selectedTab = 4;
                this.redrawSideicons = true;
            } else if (this.mouseClickX >= 694 && this.mouseClickX <= 724 && this.mouseClickY >= 168 && this.mouseClickY < 205 && this.tabInterfaceId[5] !== -1) {
                this.redrawSidebar = true;
                this.selectedTab = 5;
                this.redrawSideicons = true;
            } else if (this.mouseClickX >= 722 && this.mouseClickX <= 756 && this.mouseClickY >= 169 && this.mouseClickY < 205 && this.tabInterfaceId[6] !== -1) {
                this.redrawSidebar = true;
                this.selectedTab = 6;
                this.redrawSideicons = true;
            } else if (this.mouseClickX >= 540 && this.mouseClickX <= 574 && this.mouseClickY >= 466 && this.mouseClickY < 502 && this.tabInterfaceId[7] !== -1) {
                this.redrawSidebar = true;
                this.selectedTab = 7;
                this.redrawSideicons = true;
            } else if (this.mouseClickX >= 572 && this.mouseClickX <= 602 && this.mouseClickY >= 466 && this.mouseClickY < 503 && this.tabInterfaceId[8] !== -1) {
                this.redrawSidebar = true;
                this.selectedTab = 8;
                this.redrawSideicons = true;
            } else if (this.mouseClickX >= 599 && this.mouseClickX <= 629 && this.mouseClickY >= 466 && this.mouseClickY < 503 && this.tabInterfaceId[9] !== -1) {
                this.redrawSidebar = true;
                this.selectedTab = 9;
                this.redrawSideicons = true;
            } else if (this.mouseClickX >= 627 && this.mouseClickX <= 671 && this.mouseClickY >= 467 && this.mouseClickY < 502 && this.tabInterfaceId[10] !== -1) {
                this.redrawSidebar = true;
                this.selectedTab = 10;
                this.redrawSideicons = true;
            } else if (this.mouseClickX >= 669 && this.mouseClickX <= 699 && this.mouseClickY >= 466 && this.mouseClickY < 503 && this.tabInterfaceId[11] !== -1) {
                this.redrawSidebar = true;
                this.selectedTab = 11;
                this.redrawSideicons = true;
            } else if (this.mouseClickX >= 696 && this.mouseClickX <= 726 && this.mouseClickY >= 466 && this.mouseClickY < 503 && this.tabInterfaceId[12] !== -1) {
                this.redrawSidebar = true;
                this.selectedTab = 12;
                this.redrawSideicons = true;
            } else if (this.mouseClickX >= 724 && this.mouseClickX <= 758 && this.mouseClickY >= 466 && this.mouseClickY < 502 && this.tabInterfaceId[13] !== -1) {
                this.redrawSidebar = true;
                this.selectedTab = 13;
                this.redrawSideicons = true;
            }
        }
    };

    private handleInputKey = async (): Promise<void> => {
        // eslint-disable-next-line no-constant-condition
        while (true) {
            let key: number;
            do {
                // eslint-disable-next-line no-constant-condition
                while (true) {
                    key = this.pollKey();
                    if (key === -1) {
                        return;
                    }

                    if (this.viewportInterfaceId !== -1 && this.viewportInterfaceId === this.reportAbuseInterfaceID) {
                        if (key === 8 && this.reportAbuseInput.length > 0) {
                            this.reportAbuseInput = this.reportAbuseInput.substring(0, this.reportAbuseInput.length - 1);
                        }
                        break;
                    }

                    if (this.showSocialInput) {
                        if (key >= 32 && key <= 122 && this.socialInput.length < 80) {
                            this.socialInput = this.socialInput + String.fromCharCode(key);
                            this.redrawChatback = true;
                        }

                        if (key === 8 && this.socialInput.length > 0) {
                            this.socialInput = this.socialInput.substring(0, this.socialInput.length - 1);
                            this.redrawChatback = true;
                        }

                        if (key === 13 || key === 10) {
                            this.showSocialInput = false;
                            this.redrawChatback = true;

                            let username: bigint;
                            if (this.socialAction === 1) {
                                username = JString.toBase37(this.socialInput);
                                this.addFriend(username);
                            }

                            if (this.socialAction === 2 && this.friendCount > 0) {
                                username = JString.toBase37(this.socialInput);
                                this.removeFriend(username);
                            }

                            if (this.socialAction === 3 && this.socialInput.length > 0 && this.socialName37) {
                                // MESSAGE_PRIVATE
                                this.out.p1isaac(ClientProt.MESSAGE_PRIVATE);
                                this.out.p1(0);
                                const start: number = this.out.pos;
                                this.out.p8(this.socialName37);
                                WordPack.pack(this.out, this.socialInput);
                                this.out.psize1(this.out.pos - start);
                                this.socialInput = JString.toSentenceCase(this.socialInput);
                                this.socialInput = WordFilter.filter(this.socialInput);
                                this.addMessage(6, this.socialInput, JString.formatName(JString.fromBase37(this.socialName37)));
                                if (this.privateChatSetting === 2) {
                                    this.privateChatSetting = 1;
                                    this.redrawPrivacySettings = true;
                                    // CHAT_SETMODE
                                    this.out.p1isaac(ClientProt.CHAT_SETMODE);
                                    this.out.p1(this.publicChatSetting);
                                    this.out.p1(this.privateChatSetting);
                                    this.out.p1(this.tradeChatSetting);
                                }
                            }

                            if (this.socialAction === 4 && this.ignoreCount < 100) {
                                username = JString.toBase37(this.socialInput);
                                this.addIgnore(username);
                            }

                            if (this.socialAction === 5 && this.ignoreCount > 0) {
                                username = JString.toBase37(this.socialInput);
                                this.removeIgnore(username);
                            }
                        }
                    } else if (this.chatbackInputType === 1) {
                        if (key >= 48 && key <= 57 && this.chatbackInput.length < 10) {
                            this.chatbackInput = this.chatbackInput + String.fromCharCode(key);
                            this.redrawChatback = true;
                        }

                        if (key === 8 && this.chatbackInput.length > 0) {
                            this.chatbackInput = this.chatbackInput.substring(0, this.chatbackInput.length - 1);
                            this.redrawChatback = true;
                        }

                        if (key === 13 || key === 10) {
                            if (this.chatbackInput.length > 0) {
                                let value: number = 0;
                                try {
                                    value = parseInt(this.chatbackInput, 10);
                                } catch (e) {
                                    /* empty */
                                }
                                // RESUME_P_COUNTDIALOG
                                this.out.p1isaac(ClientProt.RESUME_P_COUNTDIALOG);
                                this.out.p4(value);
                            }
                            this.chatbackInputType = 0;
                            this.redrawChatback = true;
                        }
                    } else if (this.chatbackInputType === 2) {
                        if (key >= 32 && key <= 122 && this.chatbackInput.length < 12) {
                            this.chatbackInput = this.chatbackInput + String.fromCharCode(key);
                            this.redrawChatback = true;
                        }

                        if (key === 8 && this.chatbackInput.length > 0) {
                            this.chatbackInput = this.chatbackInput.substring(0, this.chatbackInput.length - 1);
                            this.redrawChatback = true;
                        }

                        if (key === 13 || key === 10) {
                            if (this.chatbackInput.length > 0) {
                                // INTERFACE_TYPING
                                this.out.p1isaac(ClientProt.INTERFACE_TYPING);
                                this.out.p8(JString.toBase37(this.chatbackInput));
                            }
                            this.chatbackInputType = 0;
                            this.redrawChatback = true;
                        }
                    } else if (this.chatInterfaceId === -1) {
                        if (key >= 32 && key <= 122 && this.chatTyped.length < 80) {
                            this.chatTyped = this.chatTyped + String.fromCharCode(key);
                            this.redrawChatback = true;
                        }

                        if (key === 8 && this.chatTyped.length > 0) {
                            this.chatTyped = this.chatTyped.substring(0, this.chatTyped.length - 1);
                            this.redrawChatback = true;
                        }

                        // TODO: missing commands
                        if ((key === 13 || key === 10) && this.chatTyped.length > 0) {
                            if (this.chatTyped === '::clientdrop' /* && super.frame*/) {
                                await this.tryReconnect();
                            } else if (this.rights && this.chatTyped === '::noclip') {
                                for (let level: number = 0; level < CollisionMap.LEVELS; level++) {
                                    for (let x: number = 1; x < CollisionMap.SIZE - 1; x++) {
                                        for (let z: number = 1; z < CollisionMap.SIZE - 1; z++) {
                                            const collisionMap: CollisionMap | null = this.levelCollisionMap[level];
                                            if (collisionMap) {
                                                collisionMap.flags[CollisionMap.index(x, z)] = 0;
                                            }
                                        }
                                    }
                                }
                            } else if (this.chatTyped === '::debug') {
                                Client.showDebug = !Client.showDebug;
                            } else if (this.chatTyped === '::chat') {
                                Client.chatEra = (Client.chatEra + 1) % 3;
                            } else if (this.chatTyped === '::peer') {
                                if (+Client.getParameter('world') === 999) {
                                    this.exchangeSDP();
                                }
                            } else if (this.chatTyped.startsWith('::fps ')) {
                                try {
                                    this.setTargetedFramerate(parseInt(this.chatTyped.substring(6), 10));
                                } catch (e) {
                                    /* empty */
                                }
                            } else if (this.chatTyped.startsWith('::camera')) {
                                Client.cameraEditor = !Client.cameraEditor;
                                this.cutscene = Client.cameraEditor;
                                this.cutsceneDstLocalTileX = 52;
                                this.cutsceneDstLocalTileZ = 52;
                                this.cutsceneSrcLocalTileX = 52;
                                this.cutsceneSrcLocalTileZ = 52;
                                this.cutsceneSrcHeight = 1000;
                                this.cutsceneDstHeight = 1000;
                            } else if (this.chatTyped.startsWith('::camsrc ')) {
                                const args: string[] = this.chatTyped.split(' ');
                                if (args.length === 3) {
                                    this.cutsceneSrcLocalTileX = parseInt(args[1], 10);
                                    this.cutsceneSrcLocalTileZ = parseInt(args[2], 10);
                                } else if (args.length === 4) {
                                    this.cutsceneSrcLocalTileX = parseInt(args[1], 10);
                                    this.cutsceneSrcLocalTileZ = parseInt(args[2], 10);
                                    this.cutsceneSrcHeight = parseInt(args[3], 10);
                                }
                            } else if (this.chatTyped.startsWith('::camdst ')) {
                                const args: string[] = this.chatTyped.split(' ');
                                if (args.length === 3) {
                                    this.cutsceneDstLocalTileX = parseInt(args[1], 10);
                                    this.cutsceneDstLocalTileZ = parseInt(args[2], 10);
                                } else if (args.length === 4) {
                                    this.cutsceneDstLocalTileX = parseInt(args[1], 10);
                                    this.cutsceneDstLocalTileZ = parseInt(args[2], 10);
                                    this.cutsceneDstHeight = parseInt(args[3], 10);
                                }
                            }

                            if (this.chatTyped.startsWith('::')) {
                                // CLIENT_CHEAT
                                this.out.p1isaac(ClientProt.CLIENT_CHEAT);
                                this.out.p1(this.chatTyped.length - 1);
                                this.out.pjstr(this.chatTyped.substring(2));
                            } else {
                                let color: number = 0;
                                if (this.chatTyped.startsWith('yellow:')) {
                                    color = 0;
                                    this.chatTyped = this.chatTyped.substring(7);
                                } else if (this.chatTyped.startsWith('red:')) {
                                    color = 1;
                                    this.chatTyped = this.chatTyped.substring(4);
                                } else if (this.chatTyped.startsWith('green:')) {
                                    color = 2;
                                    this.chatTyped = this.chatTyped.substring(6);
                                } else if (this.chatTyped.startsWith('cyan:')) {
                                    color = 3;
                                    this.chatTyped = this.chatTyped.substring(5);
                                } else if (this.chatTyped.startsWith('purple:')) {
                                    color = 4;
                                    this.chatTyped = this.chatTyped.substring(7);
                                } else if (this.chatTyped.startsWith('white:')) {
                                    color = 5;
                                    this.chatTyped = this.chatTyped.substring(6);
                                } else if (this.chatTyped.startsWith('flash1:')) {
                                    color = 6;
                                    this.chatTyped = this.chatTyped.substring(7);
                                } else if (this.chatTyped.startsWith('flash2:')) {
                                    color = 7;
                                    this.chatTyped = this.chatTyped.substring(7);
                                } else if (this.chatTyped.startsWith('flash3:')) {
                                    color = 8;
                                    this.chatTyped = this.chatTyped.substring(7);
                                } else if (this.chatTyped.startsWith('glow1:')) {
                                    color = 9;
                                    this.chatTyped = this.chatTyped.substring(6);
                                } else if (this.chatTyped.startsWith('glow2:')) {
                                    color = 10;
                                    this.chatTyped = this.chatTyped.substring(6);
                                } else if (this.chatTyped.startsWith('glow3:')) {
                                    color = 11;
                                    this.chatTyped = this.chatTyped.substring(6);
                                }

                                let effect: number = 0;
                                if (this.chatTyped.startsWith('wave:')) {
                                    effect = 1;
                                    this.chatTyped = this.chatTyped.substring(5);
                                } else if (this.chatTyped.startsWith('wave2:')) {
                                    effect = 2;
                                    this.chatTyped = this.chatTyped.substring(6);
                                } else if (this.chatTyped.startsWith('shake:')) {
                                    effect = 3;
                                    this.chatTyped = this.chatTyped.substring(6);
                                } else if (this.chatTyped.startsWith('scroll:')) {
                                    effect = 4;
                                    this.chatTyped = this.chatTyped.substring(7);
                                } else if (this.chatTyped.startsWith('slide:')) {
                                    effect = 5;
                                    this.chatTyped = this.chatTyped.substring(6);
                                }

                                // MESSAGE_PUBLIC
                                this.out.p1isaac(ClientProt.MESSAGE_PUBLIC);
                                this.out.p1(0);
                                const start: number = this.out.pos;
                                this.out.p1_alt2(effect);
                                this.out.p1_alt2(color);
                                this.chatBuffer.pos = 0;
                                WordPack.pack(this.chatBuffer, this.chatTyped);
                                this.out.pdata_alt3(this.chatBuffer.data, this.chatBuffer.pos, 0);
                                this.out.psize1(this.out.pos - start);

                                this.chatTyped = JString.toSentenceCase(this.chatTyped);
                                this.chatTyped = WordFilter.filter(this.chatTyped);

                                if (this.localPlayer && this.localPlayer.name) {
                                    this.localPlayer.chat = this.chatTyped;
                                    this.localPlayer.chatColor = color;
                                    this.localPlayer.chatStyle = effect;
                                    this.localPlayer.chatTimer = 150;
                                    if (this.rights === 2) {
                                        this.addMessage(2, this.localPlayer.chat, '@cr2@' + this.localPlayer.name);
                                    } else if (this.rights === 1) {
                                        this.addMessage(2, this.localPlayer.chat, '@cr1@' + this.localPlayer.name);
                                    } else {
                                        this.addMessage(2, this.localPlayer.chat, this.localPlayer.name);
                                    }
                                }

                                if (this.publicChatSetting === 2) {
                                    this.publicChatSetting = 3;
                                    this.redrawPrivacySettings = true;
                                    // CHAT_SETMODE
                                    this.out.p1isaac(ClientProt.CHAT_SETMODE);
                                    this.out.p1(this.publicChatSetting);
                                    this.out.p1(this.privateChatSetting);
                                    this.out.p1(this.tradeChatSetting);
                                }
                            }

                            this.chatTyped = '';
                            this.redrawChatback = true;
                        }
                    }
                }
            } while ((key < 97 || key > 122) && (key < 65 || key > 90) && (key < 48 || key > 57) && key !== 32);

            if (this.reportAbuseInput.length < 12) {
                this.reportAbuseInput = this.reportAbuseInput + String.fromCharCode(key);
            }
        }
    };

    private handleChatSettingsInput = (): void => {
        if (this.mouseClickButton === 1) {
            if (this.mouseClickX >= 6 && this.mouseClickX <= 106 && this.mouseClickY >= 467 && this.mouseClickY <= 499) {
                this.publicChatSetting = (this.publicChatSetting + 1) % 4;
                this.redrawPrivacySettings = true;
                this.redrawChatback = true;

                this.out.p1isaac(ClientProt.CHAT_SETMODE);
                this.out.p1(this.publicChatSetting);
                this.out.p1(this.privateChatSetting);
                this.out.p1(this.tradeChatSetting);
            } else if (this.mouseClickX >= 135 && this.mouseClickX <= 235 && this.mouseClickY >= 467 && this.mouseClickY <= 499) {
                this.privateChatSetting = (this.privateChatSetting + 1) % 3;
                this.redrawPrivacySettings = true;
                this.redrawChatback = true;

                this.out.p1isaac(ClientProt.CHAT_SETMODE);
                this.out.p1(this.publicChatSetting);
                this.out.p1(this.privateChatSetting);
                this.out.p1(this.tradeChatSetting);
            } else if (this.mouseClickX >= 273 && this.mouseClickX <= 373 && this.mouseClickY >= 467 && this.mouseClickY <= 499) {
                this.tradeChatSetting = (this.tradeChatSetting + 1) % 3;
                this.redrawPrivacySettings = true;
                this.redrawChatback = true;

                this.out.p1isaac(ClientProt.CHAT_SETMODE);
                this.out.p1(this.publicChatSetting);
                this.out.p1(this.privateChatSetting);
                this.out.p1(this.tradeChatSetting);
            } else if (this.mouseClickX >= 412 && this.mouseClickX <= 512 && this.mouseClickY >= 467 && this.mouseClickY <= 499) {
                if (this.viewportInterfaceId === -1) {
                    this.closeInterfaces();

                    this.reportAbuseInput = '';
                    this.reportAbuseMuteOption = false;

                    for (let i: number = 0; i < Component.instances.length; i++) {
                        if (Component.instances[i] && Component.instances[i].clientCode === 600) {
                            this.reportAbuseInterfaceID = this.viewportInterfaceId = Component.instances[i].layer;
                            return;
                        }
                    }
                } else {
                    this.addMessage(0, "Please close the interface you have open before using 'report abuse'", '');
                }
            }
        }
    };

    private handleScrollInput = (mouseX: number, mouseY: number, scrollableHeight: number, height: number, redraw: boolean, left: number, top: number, component: Component): void => {
        if (this.scrollGrabbed) {
            this.scrollInputPadding = 32;
        } else {
            this.scrollInputPadding = 0;
        }

        this.scrollGrabbed = false;

        if (mouseX >= left && mouseX < left + 16 && mouseY >= top && mouseY < top + 16) {
            component.scrollPosition -= this.dragCycles * 4;
            if (redraw) {
                this.redrawSidebar = true;
            }
        } else if (mouseX >= left && mouseX < left + 16 && mouseY >= top + height - 16 && mouseY < top + height) {
            component.scrollPosition += this.dragCycles * 4;
            if (redraw) {
                this.redrawSidebar = true;
            }
        } else if (mouseX >= left - this.scrollInputPadding && mouseX < left + this.scrollInputPadding + 16 && mouseY >= top + 16 && mouseY < top + height - 16 && this.dragCycles > 0) {
            let gripSize: number = (((height - 32) * height) / scrollableHeight) | 0;
            if (gripSize < 8) {
                gripSize = 8;
            }
            const gripY: number = mouseY - top - ((gripSize / 2) | 0) - 16;
            const maxY: number = height - gripSize - 32;
            component.scrollPosition = (((scrollableHeight - height) * gripY) / maxY) | 0;
            if (redraw) {
                this.redrawSidebar = true;
            }
            this.scrollGrabbed = true;
        }
    };

    private prepareGameScreen = (): void => {
        if (this.areaChatback) {
            return;
        }
        this.unloadTitle();
        this.drawArea = null;
        this.imageTitle2 = null;
        this.imageTitle3 = null;
        this.imageTitle4 = null;
        this.imageTitle0 = null;
        this.imageTitle1 = null;
        this.imageTitle5 = null;
        this.imageTitle6 = null;
        this.imageTitle7 = null;
        this.imageTitle8 = null;
        this.areaChatback = new PixMap(479, 96);
        this.areaMapback = new PixMap(172, 156);
        Draw2D.clear();
        this.imageMapback?.draw(0, 0);
        this.areaSidebar = new PixMap(190, 261);
        this.areaViewport = new PixMap(512, 334);
        Draw2D.clear();
        this.areaBackbase1 = new PixMap(496, 50);
        this.areaBackbase2 = new PixMap(269, 37);
        this.areaBackhmid1 = new PixMap(249, 45);
        this.redrawTitleBackground = true;
    };

    private drawMinimapHint = (image?: Pix24, x?: number, y?: number): void => {
        if (image && x != undefined && y != undefined) {
            const distance2: number = x * x + y * y;
            if (distance2 > 4225 && distance2 < 90000) {
                const angle: number = (this.orbitCameraYaw + this.minimapAnticheatAngle) & 0x7ff;
                let sinAngle: number = Model.sin[angle];
                let cosAngle: number = Model.cos[angle];
                sinAngle = (sinAngle * 256) / (this.minimapZoom + 256);
                cosAngle = (cosAngle * 256) / (this.minimapZoom + 256);
                const directionX: number = (y * sinAngle + x * cosAngle) >> 16;
                const directionY: number = (y * cosAngle - x * sinAngle) >> 16;
                const directionAngle: number = Math.atan2(directionX, directionY);
                const hintX: number = Math.sin(directionAngle) * 63;
                const hintY: number = Math.cos(directionAngle) * 57;
                this.imageMapedge?.drawRotated(94 + hintX + 4 - 10, 83 - hintY - 20, 20, 20, 15, 15, directionAngle, 256);
            } else {
                this.drawOnMinimap(y, image, x);
            }
        } else {
            if (this.localPlayer && this.imageMapflag1 && this.hintType != 0 && Game.loopCycle % 20 < 10) {
                if (this.hintType == 1 && this.hintNpc >= 0 && this.hintNpc < this.npcs.length) {
                    const npc: NpcEntity | null = this.npcs[this.hintNpc];

                    if (npc) {
                        const x: number = npc.x / 32 - this.localPlayer.x / 32;
                        const y: number = npc.z / 32 - this.localPlayer.z / 32;
                        this.drawMinimapHint(this.imageMapflag1, x, y);
                    }
                }

                if (this.hintType == 2) {
                    const x: number = (this.hintTileX - this.sceneBaseTileX) * 4 + 2 - this.localPlayer.x / 32;
                    const y: number = (this.hintTileZ - this.sceneBaseTileZ) * 4 + 2 - this.localPlayer.z / 32;
                    this.drawMinimapHint(this.imageMapflag1, x, y);
                }

                if (this.hintType == 10 && this.hintPlayer >= 0 && this.hintPlayer < this.players.length) {
                    const player: PlayerEntity | null = this.players[this.hintPlayer];
                    if (player) {
                        const x: number = player.x / 32 - this.localPlayer.x / 32;
                        const z: number = player.z / 32 - this.localPlayer.z / 32;
                        this.drawMinimapHint(this.imageMapflag1, x, z);
                    }
                }
            }
        }
    };

    private isFriend = (username: string | null): boolean => {
        if (!username) {
            return false;
        }

        for (let i: number = 0; i < this.friendCount; i++) {
            if (username.toLowerCase() === this.friendName[i]?.toLowerCase()) {
                return true;
            }
        }

        if (!this.localPlayer) {
            return false;
        }

        return username.toLowerCase() === this.localPlayer.name?.toLowerCase();
    };

    private addFriend = (username: bigint): void => {
        if (username === 0n) {
            return;
        }

        if (this.friendCount >= 100 && this.isMember !== 1) {
            this.addMessage(0, 'Your friendlist is full. Max of 100 for free users, and 200 for members', '');
            return;
        }
        if (this.friendCount >= 200) {
            this.addMessage(0, 'Your friendlist is full. Max of 100 for free users, and 200 for members', '');
            return;
        }

        const displayName: string = JString.formatName(JString.fromBase37(username));
        for (let i: number = 0; i < this.friendCount; i++) {
            if (this.friendName37[i] === username) {
                this.addMessage(0, displayName + ' is already on your friend list', '');
                return;
            }
        }

        for (let i: number = 0; i < this.ignoreCount; i++) {
            if (this.ignoreName37[i] === username) {
                this.addMessage(0, 'Please remove ' + displayName + ' from your ignore list first', '');
                return;
            }
        }

        if (!this.localPlayer || !this.localPlayer.name) {
            return;
        }
        if (displayName !== this.localPlayer.name) {
            this.friendName[this.friendCount] = displayName;
            this.friendName37[this.friendCount] = username;
            this.friendWorld[this.friendCount] = 0;
            this.friendCount++;
            this.redrawSidebar = true;

            // FRIENDLIST_ADD
            this.out.p1isaac(ClientProt.FRIENDLIST_ADD);
            this.out.p8(username);
        }
    };

    private removeFriend = (username: bigint): void => {
        if (username === 0n) {
            return;
        }

        for (let i: number = 0; i < this.friendCount; i++) {
            if (this.friendName37[i] === username) {
                this.friendCount--;
                this.redrawSidebar = true;
                for (let j: number = i; j < this.friendCount; j++) {
                    this.friendName[j] = this.friendName[j + 1];
                    this.friendWorld[j] = this.friendWorld[j + 1];
                    this.friendName37[j] = this.friendName37[j + 1];
                }
                // FRIENDLIST_DEL
                this.out.p1isaac(ClientProt.FRIENDLIST_DEL);
                this.out.p8(username);
                return;
            }
        }
    };

    private addIgnore = (username: bigint): void => {
        if (username === 0n) {
            return;
        }

        if (this.ignoreCount >= 100) {
            this.addMessage(0, 'Your ignore list is full. Max of 100 hit', '');
            return;
        }

        const displayName: string = JString.formatName(JString.fromBase37(username));
        for (let i: number = 0; i < this.ignoreCount; i++) {
            if (this.ignoreName37[i] === username) {
                this.addMessage(0, displayName + ' is already on your ignore list', '');
                return;
            }
        }

        for (let i: number = 0; i < this.friendCount; i++) {
            if (this.friendName37[i] === username) {
                this.addMessage(0, 'Please remove ' + displayName + ' from your friend list first', '');
                return;
            }
        }

        this.ignoreName37[this.ignoreCount++] = username;
        this.redrawSidebar = true;
        // IGNORELIST_ADD
        this.out.p1isaac(ClientProt.IGNORELIST_ADD);
        this.out.p8(username);
    };

    private removeIgnore = (username: bigint): void => {
        if (username === 0n) {
            return;
        }

        for (let i: number = 0; i < this.ignoreCount; i++) {
            if (this.ignoreName37[i] === username) {
                this.ignoreCount--;
                this.redrawSidebar = true;
                for (let j: number = i; j < this.ignoreCount; j++) {
                    this.ignoreName37[j] = this.ignoreName37[j + 1];
                }
                // IGNORELIST_DEL
                this.out.p1isaac(ClientProt.IGNORELIST_DEL);
                this.out.p8(username);
                return;
            }
        }
    };

    private sortObjStacks = (x: number, z: number): void => {
        const objStacks: LinkList | null = this.levelObjStacks[this.currentLevel][x][z];
        if (!objStacks) {
            this.scene?.removeObjStack(this.currentLevel, x, z);
            return;
        }

        let topCost: number = -99999999;
        let topObj: ObjStackEntity | null = null;

        for (let obj: ObjStackEntity | null = objStacks.head() as ObjStackEntity | null; obj; obj = objStacks.next() as ObjStackEntity | null) {
            const type: ObjType = ObjType.get(obj.index);
            let cost: number = type.cost;

            if (type.stackable) {
                cost *= obj.count + 1;
            }

            if (cost > topCost) {
                topCost = cost;
                topObj = obj;
            }
        }

        if (!topObj) {
            return; // custom
        }

        objStacks.addHead(topObj);

        let bottomObj: ObjStackEntity | null = null;
        let middleObj: ObjStackEntity | null = null;
        for (let obj: ObjStackEntity | null = objStacks.head() as ObjStackEntity | null; obj; obj = objStacks.next() as ObjStackEntity | null) {
            if (obj.index !== topObj.index && !bottomObj) {
                bottomObj = obj;
            }

            if (obj.index !== topObj.index && obj.index !== bottomObj?.index && !middleObj) {
                middleObj = obj;
            }
        }

        const bitset: number = (x + (z << 7) + 0x60000000) | 0;
        this.scene?.addObjStack(x, z, this.getHeightmapY(this.currentLevel, x * 128 + 64, z * 128 + 64), this.currentLevel, bitset, topObj, middleObj, bottomObj);
    };

    private addLoc = (level: number, x: number, z: number, id: number, angle: number, shape: number, layer: number): void => {
        if (x < 1 || z < 1 || x > 102 || z > 102) {
            return;
        }

        if (Client.lowMemory && level !== this.currentLevel) {
            return;
        }

        if (!this.scene) {
            return;
        }

        let bitset: number = 0;

        if (layer === LocLayer.WALL) {
            bitset = this.scene.getWallBitset(level, x, z);
        }

        if (layer === LocLayer.WALL_DECOR) {
            bitset = this.scene.getWallDecorationBitset(level, z, x);
        }

        if (layer === LocLayer.GROUND) {
            bitset = this.scene.getLocBitset(level, x, z);
        }

        if (layer === LocLayer.GROUND_DECOR) {
            bitset = this.scene.getGroundDecorationBitset(level, x, z);
        }

        if (bitset !== 0) {
            const otherInfo: number = this.scene.getInfo(level, x, z, bitset);
            const otherId: number = (bitset >> 14) & 0x7fff;
            const otherShape: number = otherInfo & 0x1f;
            const otherRotation: number = otherInfo >> 6;

            if (layer === LocLayer.WALL) {
                this.scene?.removeWall(level, x, z, 1);
                const type: LocType = LocType.get(otherId);

                if (type.blockwalk) {
                    this.levelCollisionMap[level]?.removeWall(x, z, otherShape, otherRotation, type.blockrange);
                }
            }

            if (layer === LocLayer.WALL_DECOR) {
                this.scene?.removeWallDecoration(level, x, z);
            }

            if (layer === LocLayer.GROUND) {
                this.scene.removeLoc(level, x, z);
                const type: LocType = LocType.get(otherId);

                if (x + type.width > CollisionMap.SIZE - 1 || z + type.width > CollisionMap.SIZE - 1 || x + type.length > CollisionMap.SIZE - 1 || z + type.length > CollisionMap.SIZE - 1) {
                    return;
                }

                if (type.blockwalk) {
                    this.levelCollisionMap[level]?.removeLoc(x, z, type.width, type.length, otherRotation, type.blockrange);
                }
            }

            if (layer === LocLayer.GROUND_DECOR) {
                this.scene?.removeGroundDecoration(level, x, z);
                const type: LocType = LocType.get(otherId);

                if (type.blockwalk && type.active) {
                    this.levelCollisionMap[level]?.removeFloor(x, z);
                }
            }
        }

        if (id >= 0) {
            let tileLevel: number = level;

            if (this.levelTileFlags && level < 3 && (this.levelTileFlags[1][x][z] & 0x2) === 2) {
                tileLevel = level + 1;
            }

            if (this.levelHeightmap) {
                World.addLoc(level, x, z, this.scene, this.levelHeightmap, this.levelCollisionMap[level], id, shape, angle, tileLevel);
            }
        }
    };

    private closeInterfaces = (): void => {
        this.out.p1isaac(ClientProt.CLOSE_MODAL);

        if (this.sidebarInterfaceId !== -1) {
            this.sidebarInterfaceId = -1;
            this.redrawSidebar = true;
            this.pressedContinueOption = false;
            this.redrawSideicons = true;
        }

        if (this.chatInterfaceId !== -1) {
            this.chatInterfaceId = -1;
            this.redrawChatback = true;
            this.pressedContinueOption = false;
        }

        this.viewportInterfaceId = -1;
    };

    private tryReconnect = async (): Promise<void> => {
        if (this.idleTimeout > 0) {
            await this.logout();
        } else {
            this.areaViewport?.bind();
            this.fontPlain12?.drawStringCenter(257, 144, 'Connection lost', Colors.BLACK);
            this.fontPlain12?.drawStringCenter(256, 143, 'Connection lost', Colors.WHITE);
            this.fontPlain12?.drawStringCenter(257, 159, 'Please wait - attempting to reestablish', Colors.BLACK);
            this.fontPlain12?.drawStringCenter(256, 158, 'Please wait - attempting to reestablish', Colors.WHITE);
            this.areaViewport?.draw(4, 4);
            this.minimapState = 0;
            this.flagSceneTileX = 0;
            this.stream?.close();
            this.ingame = false;
            this.loginAttempts = 0;
            await this.login(this.username, this.password, true);
            if (!this.ingame) {
                await this.logout();
            }
        }
    };

    private logout = async (): Promise<void> => {
        if (this.stream) {
            this.stream.close();
        }

        this.stream = null;
        this.ingame = false;
        this.titleScreenState = 0;
        this.username = '';
        this.password = '';

        this.clearCaches();
        this.scene?.reset();

        for (let level: number = 0; level < CollisionMap.LEVELS; level++) {
            this.levelCollisionMap[level]?.reset();
        }

        stopMidi(false);
        this.nextMidi = -1;
        this.currentMidi = -1;
        this.nextMusicDelay = 0;
        // TODO: no setmidi here?
        if (!Client.lowMemory) {
            // await this.setMidi('scape_main', 12345678, 40000, false);
            await this.setMidi(0, false);
        }
    };

    private read = async (): Promise<boolean> => {
        if (!this.stream) {
            return false;
        }

        try {
            let available: number = this.stream.available;
            if (available === 0) {
                return false;
            }

            if (this.packetType === -1) {
                await this.stream.readBytes(this.in.data, 0, 1);
                this.packetType = this.in.data[0] & 0xff;
                if (this.randomIn) {
                    this.packetType = (this.packetType - this.randomIn.nextInt) & 0xff;
                }
                this.packetSize = Protocol.SERVERPROT_SIZES[this.packetType];
                available--;
            }

            if (this.packetSize === -1) {
                if (available <= 0) {
                    return false;
                }

                await this.stream.readBytes(this.in.data, 0, 1);
                this.packetSize = this.in.data[0] & 0xff;
                available--;
            }

            if (this.packetSize === -2) {
                if (available <= 1) {
                    return false;
                }

                await this.stream.readBytes(this.in.data, 0, 2);
                this.in.pos = 0;
                this.packetSize = this.in.g2;
                available -= 2;
            }

            if (available < this.packetSize) {
                return false;
            }

            this.in.pos = 0;
            await this.stream.readBytes(this.in.data, 0, this.packetSize);
            this.idleNetCycles = 0;
            this.lastPacketType2 = this.lastPacketType1;
            this.lastPacketType1 = this.lastPacketType0;
            this.lastPacketType0 = this.packetType;

            // console.log(`Incoming packet: ${this.packetType}`);

            if (this.packetType === ServerProt.VARP_SMALL) {
                // VARP_SMALL
                const varp: number = this.in.g2_alt1;
                const value: number = this.in.g1b;
                this.varCache[varp] = value;
                if (this.varps[varp] !== value) {
                    this.varps[varp] = value;
                    await this.updateVarp(varp);
                    this.redrawSidebar = true;
                    if (this.stickyChatInterfaceId !== -1) {
                        this.redrawChatback = true;
                    }
                }
                this.packetType = -1;
                return true;
            }
            if (this.packetType === ServerProt.UPDATE_FRIENDLIST) {
                // UPDATE_FRIENDLIST
                const username: bigint = this.in.g8;
                const world: number = this.in.g1;
                let displayName: string | null = JString.formatName(JString.fromBase37(username));
                for (let i: number = 0; i < this.friendCount; i++) {
                    if (username === this.friendName37[i]) {
                        if (this.friendWorld[i] !== world) {
                            this.friendWorld[i] = world;
                            this.redrawSidebar = true;
                            if (world > 0) {
                                this.addMessage(5, displayName + ' has logged in.', '');
                            }
                            if (world === 0) {
                                this.addMessage(5, displayName + ' has logged out.', '');
                            }
                        }
                        displayName = null;
                        break;
                    }
                }
                if (displayName && this.friendCount < 200) {
                    this.friendName37[this.friendCount] = username;
                    this.friendName[this.friendCount] = displayName;
                    this.friendWorld[this.friendCount] = world;
                    this.friendCount++;
                    this.redrawSidebar = true;
                }
                let sorted: boolean = false;
                while (!sorted) {
                    sorted = true;
                    for (let i: number = 0; i < this.friendCount - 1; i++) {
                        if ((this.friendWorld[i] !== Client.nodeId && this.friendWorld[i + 1] === Client.nodeId) || (this.friendWorld[i] === 0 && this.friendWorld[i + 1] !== 0)) {
                            const oldWorld: number = this.friendWorld[i];
                            this.friendWorld[i] = this.friendWorld[i + 1];
                            this.friendWorld[i + 1] = oldWorld;

                            const oldName: string | null = this.friendName[i];
                            this.friendName[i] = this.friendName[i + 1];
                            this.friendName[i + 1] = oldName;

                            const oldName37: bigint = this.friendName37[i];
                            this.friendName37[i] = this.friendName37[i + 1];
                            this.friendName37[i + 1] = oldName37;
                            this.redrawSidebar = true;
                            sorted = false;
                        }
                    }
                }
                this.packetType = -1;
                return true;
            }
            if (this.packetType === ServerProt.UPDATE_REBOOT_TIMER) {
                // UPDATE_REBOOT_TIMER
                this.systemUpdateTimer = this.in.g2_alt1 * 30;
                this.packetType = -1;
                return true;
            }
            if (this.packetType === ServerProt.NPC_INFO) {
                // NPC_INFO
                this.readNpcInfo(this.in, this.packetSize);
                this.packetType = -1;
                return true;
            }
            if (this.packetType === ServerProt.REBUILD_NORMAL || this.packetType === ServerProt.REBUILD_INSTANCE) {
                // LOAD_AREA
                // TODO instances
                let zoneX: number = this.sceneCenterZoneX;
                let zoneZ: number = this.sceneCenterZoneZ;

                if (this.packetType === ServerProt.REBUILD_NORMAL) {
                    zoneX = this.in.g2_alt2;
                    zoneZ = this.in.g2;
                    this.sceneInstanced = false;
                }

                if (this.packetType === ServerProt.REBUILD_INSTANCE) {
                    zoneZ = this.in.g2_alt2;
                    this.in.bits;

                    for (let level: number = 0; level < 4; level++) {
                        for (let cx: number = 0; cx < 13; cx++) {
                            for (let cz: number = 0; cz < 13; cz++) {
                                if (this.in.gBit(1) == 1) {
                                    this.in.gBit(26);
                                    // levelChunkBitset[level][cx][cz] = this.in.gBit(26);
                                } else {
                                    // levelChunkBitset[level][cx][cz] = -1;
                                }
                            }
                        }
                    }

                    this.in.bytes;
                    zoneX = this.in.g2;
                    this.sceneInstanced = true;
                }

                if (this.sceneCenterZoneX === zoneX && this.sceneCenterZoneZ === zoneZ && this.sceneState === 2) {
                    this.packetType = -1;
                    return true;
                }
                this.sceneCenterZoneX = zoneX;
                this.sceneCenterZoneZ = zoneZ;
                this.sceneBaseTileX = (this.sceneCenterZoneX - 6) * 8;
                this.sceneBaseTileZ = (this.sceneCenterZoneZ - 6) * 8;
                this.withinTutorialIsland = (this.sceneCenterZoneX / 8 === 48 || this.sceneCenterZoneX / 8 === 49) && this.sceneCenterZoneZ / 8 === 48;

                if (this.sceneCenterZoneX / 8 === 48 && this.sceneCenterZoneZ / 8 === 148) {
                    this.withinTutorialIsland = true;
                }

                this.sceneState = 1;
                this.sceneLoadStartTime = Date.now();

                this.areaViewport?.bind();
                this.fontPlain12?.drawStringCenter(257, 151, 'Loading - please wait.', Colors.BLACK);
                this.fontPlain12?.drawStringCenter(256, 150, 'Loading - please wait.', Colors.WHITE);
                this.areaViewport?.draw(4, 4);

                if (this.packetType == ServerProt.REBUILD_NORMAL) {
                    let mapCount: number = 0;

                    for (let x: number = ((this.sceneCenterZoneX - 6) / 8) | 0; x <= (this.sceneCenterZoneX + 6) / 8; x++) {
                        for (let z: number = ((this.sceneCenterZoneZ - 6) / 8) | 0; z <= (this.sceneCenterZoneZ + 6) / 8; z++) {
                            mapCount++;
                        }
                    }

                    this.sceneMapLandData = new TypedArray1d(mapCount, null);
                    this.sceneMapLocData = new TypedArray1d(mapCount, null);
                    this.sceneMapIndex = new Int32Array(mapCount);
                    this.sceneMapLandFile = new Int32Array(mapCount);
                    this.sceneMapLocFile = new Int32Array(mapCount);

                    mapCount = 0;

                    for (let mx: number = ((this.sceneCenterZoneX - 6) / 8) | 0; mx <= (this.sceneCenterZoneX + 6) / 8; mx++) {
                        for (let mz: number = ((this.sceneCenterZoneZ - 6) / 8) | 0; mz <= (this.sceneCenterZoneZ + 6) / 8; mz++) {
                            if (this.sceneMapIndex) {
                                this.sceneMapIndex[mapCount] = (mx << 8) + mz;
                            }

                            if (this.withinTutorialIsland && (mz == 49 || mz == 149 || mz == 147 || mx == 50 || (mx == 49 && mz == 47))) {
                                if (this.sceneMapLandFile && this.sceneMapLocFile) {
                                    this.sceneMapLandFile[mapCount] = -1;
                                    this.sceneMapLocFile[mapCount] = -1;
                                }
                            } else {
                                if (this.sceneMapLandFile && this.sceneMapLocFile && this.ondemand) {
                                    const landFile: number = (this.sceneMapLandFile[mapCount] = this.ondemand.getMapFile(0, mx, mz));
                                    if (landFile !== -1) {
                                        if (this.sceneState === 1) {
                                            for (let i: number = 0; i < this.sceneMapLandData.length; i++) {
                                                if (this.sceneMapLandFile[i] === landFile) {
                                                    const data: Uint8Array | Jagfile | null = Game.jagStore[4].read(landFile);
                                                    this.sceneMapLandData[i] = new Int8Array(data as Uint8Array);

                                                    if (!data) {
                                                        this.sceneMapLandFile[i] = -1;
                                                    }
                                                    break;
                                                }
                                            }
                                        }
                                    }

                                    const locFile: number = (this.sceneMapLocFile[mapCount] = this.ondemand.getMapFile(1, mx, mz));
                                    if (locFile !== -1) {
                                        if (this.sceneState == 1) {
                                            for (let i: number = 0; i < this.sceneMapLandData.length; i++) {
                                                if (this.sceneMapLocFile[i] == locFile) {
                                                    const data: Uint8Array | Jagfile | null = Game.jagStore[4].read(locFile);
                                                    this.sceneMapLocData[i] = new Int8Array(data as Uint8Array);

                                                    if (!data) {
                                                        this.sceneMapLocFile[i] = -1;
                                                    }
                                                    break;
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                            mapCount++;
                        }
                    }
                }

                // if (this.packetType == ServerProt.REBUILD_INSTANCE) {
                // }

                const dx: number = this.sceneBaseTileX - this.mapLastBaseX;
                const dz: number = this.sceneBaseTileZ - this.mapLastBaseZ;
                this.mapLastBaseX = this.sceneBaseTileX;
                this.mapLastBaseZ = this.sceneBaseTileZ;
                for (let i: number = 0; i < 16384; i++) {
                    const npc: NpcEntity | null = this.npcs[i];
                    if (npc) {
                        for (let j: number = 0; j < 10; j++) {
                            npc.pathTileX[j] -= dx;
                            npc.pathTileZ[j] -= dz;
                        }
                        npc.x -= dx * 128;
                        npc.z -= dz * 128;
                    }
                }
                for (let i: number = 0; i < this.MAX_PLAYER_COUNT; i++) {
                    const player: PlayerEntity | null = this.players[i];
                    if (player) {
                        for (let j: number = 0; j < 10; j++) {
                            player.pathTileX[j] -= dx;
                            player.pathTileZ[j] -= dz;
                        }
                        player.x -= dx * 128;
                        player.z -= dz * 128;
                    }
                }

                this.awaitingSync = true;

                let startTileX: number = 0;
                let endTileX: number = CollisionMap.SIZE;
                let dirX: number = 1;
                if (dx < 0) {
                    startTileX = CollisionMap.SIZE - 1;
                    endTileX = -1;
                    dirX = -1;
                }
                let startTileZ: number = 0;
                let endTileZ: number = CollisionMap.SIZE;
                let dirZ: number = 1;
                if (dz < 0) {
                    startTileZ = CollisionMap.SIZE - 1;
                    endTileZ = -1;
                    dirZ = -1;
                }
                for (let x: number = startTileX; x !== endTileX; x += dirX) {
                    for (let z: number = startTileZ; z !== endTileZ; z += dirZ) {
                        const lastX: number = x + dx;
                        const lastZ: number = z + dz;
                        for (let level: number = 0; level < CollisionMap.LEVELS; level++) {
                            if (lastX >= 0 && lastZ >= 0 && lastX < CollisionMap.SIZE && lastZ < CollisionMap.SIZE) {
                                this.levelObjStacks[level][x][z] = this.levelObjStacks[level][lastX][lastZ];
                            } else {
                                this.levelObjStacks[level][x][z] = null;
                            }
                        }
                    }
                }
                for (let loc: LocTemporary | null = this.temporaryLocs.head() as LocTemporary | null; loc; loc = this.temporaryLocs.next() as LocTemporary | null) {
                    loc.x -= dx;
                    loc.z -= dz;
                    if (loc.x < 0 || loc.z < 0 || loc.x >= CollisionMap.SIZE || loc.z >= CollisionMap.SIZE) {
                        loc.unlink();
                    }
                }
                if (this.flagSceneTileX !== 0) {
                    this.flagSceneTileX -= dx;
                    this.flagSceneTileZ -= dz;
                }
                this.cutscene = false;
                this.packetType = -1;
                return true;
            }
            if (this.packetType === ServerProt.IF_SETPLAYERHEAD) {
                // IF_SETPLAYERHEAD
                const ifaceID: number = this.in.g2_alt3;
                Component.instances[ifaceID].type = Component.MODEL_TYPE_PLAYER;
                if (this.localPlayer) {
                    if (!this.localPlayer.transmogrify) {
                        Component.instances[ifaceID].modelID =
                            (this.localPlayer?.colors[0] << 25) +
                            (this.localPlayer?.colors[4] << 20) +
                            (this.localPlayer?.appearances[0] << 15) +
                            (this.localPlayer?.appearances[8] << 10) +
                            (this.localPlayer?.appearances[11] << 5) +
                            this.localPlayer?.appearances[1];
                    } else {
                        Component.instances[ifaceID].modelID = Number(0x12345678n + this.localPlayer.transmogrify.uid);
                    }
                }
                // TODO: transmogrify stuff and what:?
                // Component.instances[ifaceID].model = this.localPlayer?.getHeadModel() || null;
                this.packetType = -1;
                return true;
            }
            if (this.packetType === ServerProt.HINT_ARROW) {
                this.hintType = this.in.g1;
                if (this.hintType === 1) {
                    this.hintNpc = this.in.g2;
                }
                if (this.hintType >= 2 && this.hintType <= 6) {
                    if (this.hintType === 2) {
                        this.hintOffsetX = 64;
                        this.hintOffsetZ = 64;
                    }
                    if (this.hintType === 3) {
                        this.hintOffsetX = 0;
                        this.hintOffsetZ = 64;
                    }
                    if (this.hintType === 4) {
                        this.hintOffsetX = 128;
                        this.hintOffsetZ = 64;
                    }
                    if (this.hintType === 5) {
                        this.hintOffsetX = 64;
                        this.hintOffsetZ = 0;
                    }
                    if (this.hintType === 6) {
                        this.hintOffsetX = 64;
                        this.hintOffsetZ = 128;
                    }
                    this.hintType = 2;
                    this.hintTileX = this.in.g2;
                    this.hintTileZ = this.in.g2;
                    this.hintHeight = this.in.g1;
                }
                if (this.hintType === 10) {
                    this.hintPlayer = this.in.g2;
                }
                this.packetType = -1;
                return true;
            }
            if (this.packetType === ServerProt.MIDI_SONG) {
                // MIDI_SONG
                let next: number = this.in.g2_alt1;
                if (next == 65535) {
                    next = -1;
                }
                if (next !== this.nextMidi && this.midiActive && !Client.lowMemory && this.nextMusicDelay === 0) {
                    this.currentMidi = next;
                    await this.setMidi(this.currentMidi, true);
                }
                this.nextMidi = next;
                this.packetType = -1;
                return true;
            }
            if (this.packetType === ServerProt.LOGOUT) {
                // LOGOUT
                await this.logout();
                this.packetType = -1;
                return false;
            }
            if (this.packetType === ServerProt.UNSET_MAP_FLAG) {
                // CLEAR_WALKING_QUEUE
                this.flagSceneTileX = 0;
                this.packetType = -1;
                return true;
            }
            if (this.packetType === ServerProt.UPDATE_UID192) {
                // UPDATE_UID192
                this.isMember = this.in.g1_alt3;
                this.localPid = this.in.g2_alt3;
                this.packetType = -1;
                return true;
            }
            if (
                this.packetType === ServerProt.OBJ_ADD ||
                this.packetType === ServerProt.OBJ_REVEAL ||
                this.packetType === ServerProt.OBJ_COUNT ||
                this.packetType === ServerProt.OBJ_DEL ||
                this.packetType === ServerProt.LOC_ADD ||
                this.packetType === ServerProt.LOC_CHANGE ||
                this.packetType === ServerProt.LOC_DEL ||
                this.packetType === ServerProt.LOC_MERGE ||
                this.packetType === ServerProt.MAP_ANIM ||
                this.packetType === ServerProt.MAP_SOUND ||
                this.packetType === ServerProt.MAP_PROJANIM
            ) {
                // Zone Protocol
                this.readZonePacket(this.in, this.packetType);
                this.packetType = -1;
                return true;
            }
            if (this.packetType === ServerProt.IF_OPENMAINSIDEMODAL) {
                // IF_OPENMAINMODALSIDEOVERLAY
                const main: number = this.in.g2_alt2;
                const side: number = this.in.g2;
                if (this.chatInterfaceId !== -1) {
                    this.chatInterfaceId = -1;
                    this.redrawChatback = true;
                }
                if (this.chatbackInputType != 0) {
                    this.chatbackInputType = 0;
                    this.redrawChatback = true;
                }
                this.viewportInterfaceId = main;
                this.sidebarInterfaceId = side;
                this.redrawSidebar = true;
                this.redrawSideicons = true;
                this.pressedContinueOption = false;
                this.packetType = -1;
                return true;
            }
            if (this.packetType === ServerProt.IF_SETSCROLLPOS) {
                const comID: number = this.in.g2_alt1;
                let scrollPos: number = this.in.g2_alt2;

                const com: Component = Component.instances[comID];
                if (com !== null && com.type === Component.TYPE_LAYER)
                    if (scrollPos < 0) {
                        scrollPos = 0;
                    }
                if (scrollPos > com.scrollableHeight - com.height) {
                    scrollPos = com.scrollableHeight - com.height;
                }
                com.scrollPosition = scrollPos;
                this.packetType = -1;
                return true;
            }
            if (this.packetType === ServerProt.VARP_LARGE) {
                // VARP_LARGE
                const varp: number = this.in.g2_alt1;
                const value: number = this.in.g4_alt3;
                this.varCache[varp] = value;
                if (this.varps[varp] !== value) {
                    this.varps[varp] = value;
                    await this.updateVarp(varp);
                    this.redrawSidebar = true;
                    if (this.stickyChatInterfaceId !== -1) {
                        this.redrawChatback = true;
                    }
                }
                this.packetType = -1;
                return true;
            }
            if (this.packetType === ServerProt.IF_SETANIM) {
                // IF_SETANIM
                const comID: number = this.in.g2;
                const seqID: number = this.in.g2b;
                const com: Component = Component.instances[comID];
                com.anim = seqID;
                if (seqID == -1) {
                    com.seqFrame = 0;
                    com.seqCycle = 0;
                }
                this.packetType = -1;
                return true;
            }
            if (this.packetType === ServerProt.IF_OPENSIDEOVERLAY) {
                // IF_SETTAB
                let com: number = this.in.g2;
                const tab: number = this.in.g1_alt3;
                if (com === 65535) {
                    com = -1;
                }
                this.tabInterfaceId[tab] = com;
                this.redrawSidebar = true;
                this.redrawSideicons = true;
                this.packetType = -1;
                return true;
            }
            if (this.packetType === ServerProt.UPDATE_INV_FULL) {
                // UPDATE_INV_FULL
                this.redrawSidebar = true;
                const com: number = this.in.g2;
                const inv: Component = Component.instances[com];
                const size: number = this.in.g2;
                if (inv.invSlotObjId && inv.invSlotObjCount) {
                    for (let i: number = 0; i < size; i++) {
                        let count: number = this.in.g1;
                        if (count === 255) {
                            count = this.in.g4_alt2;
                        }
                        inv.invSlotObjId[i] = this.in.g2_alt3;
                        inv.invSlotObjCount[i] = count;
                    }
                    for (let i: number = size; i < inv.invSlotObjId.length; i++) {
                        inv.invSlotObjId[i] = 0;
                        inv.invSlotObjCount[i] = 0;
                    }
                } else {
                    for (let i: number = 0; i < size; i++) {
                        this.in.g2;
                        if (this.in.g1 === 255) {
                            this.in.g4;
                        }
                    }
                }
                this.packetType = -1;
                return true;
            }
            if (this.packetType === ServerProt.IF_SETANGLE) {
                const zoom: number = this.in.g2_alt2;
                const com: number = this.in.g2;
                const pitch: number = this.in.g2;
                const yaw: number = this.in.g2_alt3;

                Component.instances[com].xan = pitch;
                Component.instances[com].yan = yaw;
                Component.instances[com].zoom = zoom;
                this.packetType = -1;
                return true;
            }
            if (this.packetType === ServerProt.FRIENDLIST_LOADED) {
                this.friendlistStatus = this.in.g1;
                this.redrawSidebar;
                this.packetType = -1;
                return true;
            }
            if (this.packetType === ServerProt.P_COUNTDIALOG) {
                // IF_IAMOUNT
                this.openChatInput(1);
                return true;
            }
            if (this.packetType === ServerProt.P_NAMEDIALOG) {
                this.openChatInput(2);
                return true;
            }
            if (this.packetType === ServerProt.UPDATE_INV_STOP_TRANSMIT) {
                // UPDATE_INV_STOP_TRANSMIT
                const inv: Component = Component.instances[this.in.g2_alt1];
                if (inv.invSlotObjId) {
                    for (let i: number = 0; i < inv.invSlotObjId.length; i++) {
                        inv.invSlotObjId[i] = -1;
                        inv.invSlotObjId[i] = 0;
                    }
                }
                this.packetType = -1;
                return true;
            }
            if (this.packetType === ServerProt.LAST_LOGIN_INFO) {
                // LAST_LOGIN_INFO
                this.daysSinceRecoveriesChanged = this.in.g1_alt1;
                this.unreadMessages = this.in.g2_alt2;
                this.warnMembersInNonMembers = this.in.g1;
                this.lastAddress = this.in.g4_alt2;
                this.daysSinceLastLogin = this.in.g2;
                if (this.lastAddress !== 0 && this.viewportInterfaceId === -1) {
                    // signlink.dnslookup(JString.formatIPv4(this.lastAddress)); // TODO?
                    this.closeInterfaces();
                    let contentType: number = 650;
                    if (this.daysSinceRecoveriesChanged !== 201 || this.warnMembersInNonMembers === 1) {
                        contentType = 655;
                    }
                    this.reportAbuseInput = '';
                    this.reportAbuseMuteOption = false;
                    for (let i: number = 0; i < Component.instances.length; i++) {
                        if (Component.instances[i] && Component.instances[i].clientCode === contentType) {
                            this.viewportInterfaceId = Component.instances[i].layer;
                            break;
                        }
                    }
                }
                this.packetType = -1;
                return true;
            }
            if (this.packetType === ServerProt.TUTORIAL_FLASHSIDE) {
                // IF_SETTAB_FLASH
                this.flashingTab = this.in.g1_alt2;
                if (this.flashingTab === this.selectedTab) {
                    if (this.flashingTab === 3) {
                        this.selectedTab = 1;
                    } else {
                        this.selectedTab = 3;
                    }
                    this.redrawSidebar = true;
                }
                this.packetType = -1;
                return true;
            }
            if (this.packetType === ServerProt.MIDI_JINGLE) {
                // MIDI_JINGLE
                const next: number = this.in.g2_alt3;
                const delay: number = this.in.g2_alt2;
                if (this.midiActive && !Client.lowMemory) {
                    // playMidi(uncompressed, this.midiVolume, false);
                    // TODO CHECK
                    // const length: number = this.in.g4;
                    // const remaining: number = this.packetSize - 6;
                    // const uncompressed: Int8Array = Bzip.read(length, Int8Array.from(this.in.data), remaining, this.in.pos);
                    this.currentMidi = next;
                    this.setMidi(this.currentMidi, false);
                    this.nextMusicDelay = delay;
                }
                this.packetType = -1;
                return true;
            }
            if (this.packetType === ServerProt.SET_MULTIWAY) {
                // IF_MULTIZONE
                this.inMultizone = this.in.g1;
                this.packetType = -1;
                return true;
            }
            if (this.packetType === ServerProt.SYNTH_SOUND) {
                // SYNTH_SOUND
                const id: number = this.in.g2;
                const loop: number = this.in.g1;
                const delay: number = this.in.g2;
                if (this.waveEnabled && !Client.lowMemory && this.waveCount < 50) {
                    this.waveIds[this.waveCount] = id;
                    this.waveLoops[this.waveCount] = loop;
                    this.waveDelay[this.waveCount] = delay + Wave.delays[id];
                    this.waveCount++;
                }
                this.packetType = -1;
                return true;
            }
            if (this.packetType === ServerProt.SET_PLAYER_OP) {
                const option: number = this.in.g1_alt1;
                const priority: number = this.in.g1_alt3;
                let text: string | null = this.in.gjstr;
                if (option >= 1 && option <= 5) {
                    if (text.toLowerCase() === 'null') {
                        text = null;
                    }
                    // TODO:
                    // playerOptions[option - 1] = text;
                    // playerOptionPushDown[option - 1] = priority === 0;
                }
                this.packetType = -1;
                return true;
            }
            if (this.packetType === ServerProt.IF_OPENMAINOVERLAY) {
                const com: number = this.in.g2b_alt1;
                if (com >= 0) {
                    this.resetInterfaceAnimation(com);
                }
                this.viewportOverlayInterfaceId = com;
                this.packetType = -1;
                return true;
            }
            if (this.packetType === ServerProt.MINIMAP_TOGGLE) {
                this.minimapState = this.in.g1;
                this.packetType = -1;
                return true;
            }
            if (this.packetType === ServerProt.IF_SETNPCHEAD) {
                // IF_SETNPCHEAD
                const npcId: number = this.in.g2_alt3;
                const com: number = this.in.g2_alt3;
                Component.instances[com].type = Component.MODEL_TYPE_NPC;
                Component.instances[com].modelID = npcId;
                this.packetType = -1;
                return true;
            }
            if (this.packetType === ServerProt.UPDATE_ZONE_PARTIAL_FOLLOWS) {
                // UPDATE_ZONE_PARTIAL_FOLLOWS
                this.baseX = this.in.g1_alt1;
                this.baseZ = this.in.g1_alt1;
                this.packetType = -1;
                return true;
            }
            if (this.packetType === ServerProt.CHAT_FILTER_SETTINGS) {
                // CHAT_FILTER_SETTINGS
                this.publicChatSetting = this.in.g1;
                this.privateChatSetting = this.in.g1;
                this.tradeChatSetting = this.in.g1;
                this.redrawPrivacySettings = true;
                this.redrawChatback = true;
                this.packetType = -1;
                return true;
            }
            if (this.packetType === ServerProt.IF_OPENSIDEMODAL) {
                // IF_OPENSIDEOVERLAY
                const com: number = this.in.g2_alt1;
                this.resetInterfaceAnimation(com);
                if (this.chatInterfaceId !== -1) {
                    this.chatInterfaceId = -1;
                    this.redrawChatback = true;
                }
                if (this.chatbackInputType != 0) {
                    this.chatbackInputType = 0;
                    this.redrawChatback = true;
                }
                this.sidebarInterfaceId = com;
                this.redrawSidebar = true;
                this.redrawSideicons = true;
                this.viewportInterfaceId = -1;
                this.pressedContinueOption = false;
                this.packetType = -1;
                return true;
            }
            if (this.packetType === ServerProt.IF_OPENCHATMODAL) {
                // IF_OPENCHAT
                const com: number = this.in.g2_alt1;
                this.resetInterfaceAnimation(com);
                if (this.sidebarInterfaceId !== -1) {
                    this.sidebarInterfaceId = -1;
                    this.redrawSidebar = true;
                    this.redrawSideicons = true;
                }
                this.chatInterfaceId = com;
                this.redrawChatback = true;
                this.viewportInterfaceId = -1;
                this.pressedContinueOption = false;
                this.packetType = -1;
                return true;
            }
            if (this.packetType === ServerProt.IF_SETPOSITION) {
                // IF_SETPOSITION
                const com: number = this.in.g2b;
                const x: number = this.in.g2b_alt1;
                const z: number = this.in.g2_alt1;
                const inter: Component = Component.instances[com];
                inter.x = x;
                inter.y = z;
                this.packetType = -1;
                return true;
            }
            if (this.packetType === ServerProt.CAM_MOVETO) {
                // CAM_MOVETO
                this.cutscene = true;
                this.cutsceneSrcLocalTileX = this.in.g1;
                this.cutsceneSrcLocalTileZ = this.in.g1;
                this.cutsceneSrcHeight = this.in.g2;
                this.cutsceneMoveSpeed = this.in.g1;
                this.cutsceneMoveAcceleration = this.in.g1;
                if (this.cutsceneMoveAcceleration >= 100) {
                    this.cameraX = this.cutsceneSrcLocalTileX * 128 + 64;
                    this.cameraZ = this.cutsceneSrcLocalTileZ * 128 + 64;
                    this.cameraY = this.getHeightmapY(this.currentLevel, this.cutsceneSrcLocalTileX, this.cutsceneSrcLocalTileZ) - this.cutsceneSrcHeight;
                }
                this.packetType = -1;
                return true;
            }
            if (this.packetType === ServerProt.UPDATE_ZONE_FULL_FOLLOWS) {
                // UPDATE_ZONE_FULL_FOLLOWS
                this.baseX = this.in.g1_alt1;
                this.baseZ = this.in.g1_alt2;
                for (let x: number = this.baseX; x < this.baseX + 8; x++) {
                    for (let z: number = this.baseZ; z < this.baseZ + 8; z++) {
                        if (this.levelObjStacks[this.currentLevel][x][z]) {
                            this.levelObjStacks[this.currentLevel][x][z] = null;
                            this.sortObjStacks(x, z);
                        }
                    }
                }
                for (let loc: LocTemporary | null = this.temporaryLocs.head() as LocTemporary | null; loc; loc = this.temporaryLocs.next() as LocTemporary | null) {
                    if (loc.x >= this.baseX && loc.x < this.baseX + 8 && loc.z >= this.baseZ && loc.z < this.baseZ + 8 && loc.plane === this.currentLevel) {
                        loc.duration = 0;
                    }
                }
                this.packetType = -1;
                return true;
            }
            if (this.packetType === ServerProt.MESSAGE_PRIVATE) {
                // MESSAGE_PRIVATE
                const from: bigint = this.in.g8;
                const messageId: number = this.in.g4;
                const staffModLevel: number = this.in.g1;
                let ignored: boolean = false;
                for (let i: number = 0; i < 100; i++) {
                    if (this.messageIds[i] === messageId) {
                        ignored = true;
                        break;
                    }
                }
                if (staffModLevel <= 1) {
                    for (let i: number = 0; i < this.ignoreCount; i++) {
                        if (this.ignoreName37[i] === from) {
                            ignored = true;
                            break;
                        }
                    }
                }
                if (!ignored && this.overrideChat === 0) {
                    try {
                        this.messageIds[this.privateMessageCount] = messageId;
                        this.privateMessageCount = (this.privateMessageCount + 1) % 100;
                        let message: string = WordPack.unpack(this.in, this.packetSize - 13);

                        if (staffModLevel !== 3) {
                            message = WordFilter.filter(message);
                        }

                        if (staffModLevel === 2 || staffModLevel === 3) {
                            this.addMessage(7, message, '@crc2@' + JString.formatName(JString.fromBase37(from)));
                        } else if (staffModLevel === 1) {
                            this.addMessage(3, message, '@crc1@' + JString.formatName(JString.fromBase37(from)));
                        } else {
                            this.addMessage(3, message, JString.formatName(JString.fromBase37(from)));
                        }
                    } catch (e) {
                        // signlink.reporterror("cde1"); TODO?
                    }
                }
                this.packetType = -1;
                return true;
            }
            if (this.packetType === ServerProt.RESET_CLIENT_VARCACHE) {
                // RESET_CLIENT_VARCACHE
                for (let i: number = 0; i < this.varps.length; i++) {
                    if (this.varps[i] !== this.varCache[i]) {
                        this.varps[i] = this.varCache[i];
                        await this.updateVarp(i);
                        this.redrawSidebar = true;
                    }
                }
                this.packetType = -1;
                return true;
            }
            if (this.packetType === ServerProt.IF_SETMODEL) {
                // IF_SETMODEL
                const com: number = this.in.g2_alt3;
                const model: number = this.in.g2;
                Component.instances[com].type = Component.MODEL_TYPE_NORMAL;
                Component.instances[com].modelID = model;
                this.packetType = -1;
                return true;
            }
            if (this.packetType === ServerProt.TUTORIAL_OPENCHAT) {
                // IF_OPENCHATSTICKY
                this.stickyChatInterfaceId = this.in.g2b_alt3;
                this.redrawChatback = true;
                this.packetType = -1;
                return true;
            }
            if (this.packetType === ServerProt.UPDATE_RUNENERGY) {
                // UPDATE_RUNENERGY
                if (this.selectedTab === 12) {
                    this.redrawSidebar = true;
                }
                this.energy = this.in.g1;
                this.packetType = -1;
                return true;
            }
            if (this.packetType === ServerProt.CAM_LOOKAT) {
                // CAM_LOOKAT
                this.cutscene = true;
                this.cutsceneDstLocalTileX = this.in.g1;
                this.cutsceneDstLocalTileZ = this.in.g1;
                this.cutsceneDstHeight = this.in.g2;
                this.cutsceneRotateSpeed = this.in.g1;
                this.cutsceneRotateAcceleration = this.in.g1;
                if (this.cutsceneRotateAcceleration >= 100) {
                    const sceneX: number = this.cutsceneDstLocalTileX * 128 + 64;
                    const sceneZ: number = this.cutsceneDstLocalTileZ * 128 + 64;
                    const sceneY: number = this.getHeightmapY(this.currentLevel, this.cutsceneDstLocalTileX, this.cutsceneDstLocalTileZ) - this.cutsceneDstHeight;
                    const deltaX: number = sceneX - this.cameraX;
                    const deltaY: number = sceneY - this.cameraY;
                    const deltaZ: number = sceneZ - this.cameraZ;
                    const distance: number = Math.sqrt(deltaX * deltaX + deltaZ * deltaZ) | 0;
                    this.cameraPitch = ((Math.atan2(deltaY, distance) * 325.949) | 0) & 0x7ff;
                    this.cameraYaw = ((Math.atan2(deltaX, deltaZ) * -325.949) | 0) & 0x7ff;
                    if (this.cameraPitch < 128) {
                        this.cameraPitch = 128;
                    }
                    if (this.cameraPitch > 383) {
                        this.cameraPitch = 383;
                    }
                }
                this.packetType = -1;
                return true;
            }
            if (this.packetType === ServerProt.IF_SHOWSIDE) {
                // IF_SETTAB_ACTIVE
                this.selectedTab = this.in.g1_alt1;
                this.redrawSidebar = true;
                this.redrawSideicons = true;
                this.packetType = -1;
                return true;
            }
            if (this.packetType === ServerProt.MESSAGE_GAME) {
                // MESSAGE_GAME
                const message: string = this.in.gjstr;
                let username: bigint;
                if (message.endsWith(':tradereq:')) {
                    const player: string = message.substring(0, message.indexOf(':'));
                    username = JString.toBase37(player);
                    let ignored: boolean = false;
                    for (let i: number = 0; i < this.ignoreCount; i++) {
                        if (this.ignoreName37[i] === username) {
                            ignored = true;
                            break;
                        }
                    }
                    if (!ignored && this.overrideChat === 0) {
                        this.addMessage(4, 'wishes to trade with you.', player);
                    }
                } else if (message.endsWith(':duelreq:')) {
                    const player: string = message.substring(0, message.indexOf(':'));
                    username = JString.toBase37(player);
                    let ignored: boolean = false;
                    for (let i: number = 0; i < this.ignoreCount; i++) {
                        if (this.ignoreName37[i] === username) {
                            ignored = true;
                            break;
                        }
                    }
                    if (!ignored && this.overrideChat === 0) {
                        this.addMessage(8, 'wishes to duel with you.', player);
                    }
                } else if (message.endsWith(':chalreq:')) {
                    const player: string = message.substring(0, message.indexOf(':'));
                    username = JString.toBase37(player);
                    let ignored: boolean = false;
                    for (let i: number = 0; i < this.ignoreCount; i++) {
                        if (this.ignoreName37[i] === username) {
                            ignored = true;
                            break;
                        }
                    }
                    if (!ignored && this.overrideChat === 0) {
                        const str: string = message.substring(message.indexOf(':') + 1, message.length - 9);
                        this.addMessage(8, str, player);
                    }
                } else {
                    this.addMessage(0, message, '');
                }
                this.packetType = -1;
                return true;
            }
            if (this.packetType === ServerProt.IF_SETOBJECT) {
                // IF_SETOBJECT
                const com: number = this.in.g2_alt1;
                const zoom: number = this.in.g2;
                const objId: number = this.in.g2;

                if (objId != 65535) {
                    const obj: ObjType = ObjType.get(objId);
                    Component.instances[com].type = Component.MODEL_TYPE_OBJ;
                    Component.instances[com].modelID = objId;
                    Component.instances[com].xan = obj.xan2d;
                    Component.instances[com].yan = obj.yan2d;
                    Component.instances[com].zoom = ((obj.zoom2d * 100) / zoom) | 0;
                } else {
                    Component.instances[com].type = Component.MODEL_TYPE_NONE;
                }
                this.packetType = -1;
                return true;
            }
            if (this.packetType === ServerProt.IF_OPENMAINMODAL) {
                // IF_OPENMAIN
                const com: number = this.in.g2;
                this.resetInterfaceAnimation(com);
                if (this.sidebarInterfaceId !== -1) {
                    this.sidebarInterfaceId = -1;
                    this.redrawSidebar = true;
                    this.redrawSideicons = true;
                }
                if (this.chatInterfaceId !== -1) {
                    this.chatInterfaceId = -1;
                    this.redrawChatback = true;
                }
                if (this.chatbackInputType != 0) {
                    this.chatbackInputType = 0;
                    this.redrawChatback = true;
                }
                this.viewportInterfaceId = com;
                this.pressedContinueOption = false;
                this.packetType = -1;
                return true;
            }
            if (this.packetType === ServerProt.IF_SETCOLOUR) {
                // IF_SETCOLOUR
                const com: number = this.in.g2_alt3;
                const color: number = this.in.g2_alt3;
                const r: number = (color >> 10) & 0x1f;
                const g: number = (color >> 5) & 0x1f;
                const b: number = color & 0x1f;
                Component.instances[com].colour = (r << 19) + (g << 11) + (b << 3);
                this.packetType = -1;
                return true;
            }
            if (this.packetType === ServerProt.RESET_ANIMS) {
                // RESET_ANIMS
                for (let i: number = 0; i < this.players.length; i++) {
                    const player: PlayerEntity | null = this.players[i];
                    if (!player) {
                        continue;
                    }
                    player.primarySeqId = -1;
                }
                for (let i: number = 0; i < this.npcs.length; i++) {
                    const npc: NpcEntity | null = this.npcs[i];
                    if (!npc) {
                        continue;
                    }
                    npc.primarySeqId = -1;
                }
                this.packetType = -1;
                return true;
            }
            if (this.packetType === ServerProt.IF_SETHIDE) {
                // IF_SETHIDE
                const hide: boolean = this.in.g1 === 1;
                const com: number = this.in.g2;
                Component.instances[com].hide = hide;
                this.packetType = -1;
                return true;
            }
            if (this.packetType === ServerProt.UPDATE_IGNORELIST) {
                // UPDATE_IGNORELIST
                this.ignoreCount = (this.packetSize / 8) | 0;
                for (let i: number = 0; i < this.ignoreCount; i++) {
                    this.ignoreName37[i] = this.in.g8;
                }
                this.packetType = -1;
                return true;
            }
            if (this.packetType === ServerProt.CAM_RESET) {
                // CAM_RESET
                this.cutscene = false;
                for (let i: number = 0; i < 5; i++) {
                    this.cameraModifierEnabled[i] = false;
                }
                this.packetType = -1;
                return true;
            }
            if (this.packetType === ServerProt.IF_CLOSE) {
                // IF_CLOSE
                if (this.sidebarInterfaceId !== -1) {
                    this.sidebarInterfaceId = -1;
                    this.redrawSidebar = true;
                    this.redrawSideicons = true;
                }
                if (this.chatInterfaceId !== -1) {
                    this.chatInterfaceId = -1;
                    this.redrawChatback = true;
                }
                if (this.chatbackInputType != 0) {
                    this.chatbackInputType = 0;
                    this.redrawChatback = true;
                }
                this.viewportInterfaceId = -1;
                this.pressedContinueOption = false;
                this.packetType = -1;
                return true;
            }
            if (this.packetType === ServerProt.IF_SETTEXT) {
                // IF_SETTEXT
                const text: string = this.in.gjstr;
                const comID: number = this.in.g2;
                if (comID >= 0 && comID < Component.instances.length) {
                    const com: Component = Component.instances[comID];
                    if (com) {
                        com.text = text;
                        if (Component.instances[comID].layer === this.tabInterfaceId[this.selectedTab]) {
                            this.redrawSidebar = true;
                        }
                    }
                }
                this.packetType = -1;
                return true;
            }
            if (this.packetType === ServerProt.UPDATE_STAT) {
                // UPDATE_STAT
                this.redrawSidebar = true;
                const stat: number = this.in.g1;
                const xp: number = this.in.g4_alt3;
                const level: number = this.in.g1;
                this.skillExperience[stat] = xp;
                this.skillLevel[stat] = level;
                this.skillBaseLevel[stat] = 1;
                for (let i: number = 0; i < 98; i++) {
                    if (xp >= this.levelExperience[i]) {
                        this.skillBaseLevel[stat] = i + 2;
                    }
                }
                this.packetType = -1;
                return true;
            }
            if (this.packetType === ServerProt.UPDATE_ZONE_PARTIAL_ENCLOSED) {
                // UPDATE_ZONE_PARTIAL_ENCLOSED
                this.baseX = this.in.g1;
                this.baseZ = this.in.g1_alt1;
                while (this.in.pos < this.packetSize) {
                    const opcode: number = this.in.g1;
                    this.readZonePacket(this.in, opcode);
                }
                this.packetType = -1;
                return true;
            }
            if (this.packetType === ServerProt.UPDATE_RUNWEIGHT) {
                // UPDATE_RUNWEIGHT
                if (this.selectedTab === 12) {
                    this.redrawSidebar = true;
                }
                this.weightCarried = this.in.g2b;
                this.packetType = -1;
                return true;
            }
            if (this.packetType === ServerProt.CAM_SHAKE) {
                // CAM_SHAKE
                const type: number = this.in.g1;
                const jitter: number = this.in.g1;
                const wobbleScale: number = this.in.g1;
                const wobbleSpeed: number = this.in.g1;
                this.cameraModifierEnabled[type] = true;
                this.cameraModifierJitter[type] = jitter;
                this.cameraModifierWobbleScale[type] = wobbleScale;
                this.cameraModifierWobbleSpeed[type] = wobbleSpeed;
                this.cameraModifierCycle[type] = 0;
                this.packetType = -1;
                return true;
            }
            if (this.packetType === ServerProt.UPDATE_INV_PARTIAL) {
                // UPDATE_INV_PARTIAL
                this.redrawSidebar = true;
                const com: number = this.in.g2;
                const inv: Component = Component.instances[com];
                while (this.in.pos < this.packetSize) {
                    const slot: number = this.in.gsmarts;
                    const id: number = this.in.g2;
                    let count: number = this.in.g1;
                    if (count === 255) {
                        count = this.in.g4;
                    }
                    if (inv.invSlotObjId && inv.invSlotObjCount && slot >= 0 && slot < inv.invSlotObjId.length) {
                        inv.invSlotObjId[slot] = id;
                        inv.invSlotObjCount[slot] = count;
                    }
                }
                this.packetType = -1;
                return true;
            }
            if (this.packetType === ServerProt.PLAYER_INFO) {
                this.lastTickFlag = !this.lastTickFlag; // custom
                // PLAYER_INFO
                this.readPlayerInfo(this.in, this.packetSize);
                this.packetType = -1;
                return true;
            }
            await this.logout();
        } catch (e) {
            console.log(e);
            await this.tryReconnect();
            // TODO extra logic for logout??
        }
        return true;
    };

    private openChatInput = (type: number): void => {
        this.showSocialInput = false;
        this.chatbackInputType = type;
        this.chatbackInput = '';
        this.redrawChatback = true;
        this.packetType = -1;
    };

    private clearTileFlags = (): void => {
        for (let level: number = 0; level < 4; level++) {
            for (let x: number = 0; x < 104; x++) {
                for (let z: number = 0; z < 104; z++) {
                    if (this.levelTileFlags) {
                        this.levelTileFlags[level][x][z] = 0;
                    }
                }
            }
        }
    };

    private buildSceneStandard = (world: World): void => {
        if (this.sceneMapLandData && this.sceneMapIndex) {
            const mapCount: number = this.sceneMapLandData.length;

            for (let i: number = 0; i < mapCount; i++) {
                const data: Int8Array | null = this.sceneMapLandData[i];

                if (data) {
                    const originX: number = (this.sceneMapIndex[i] >> 8) * 64 - this.sceneBaseTileX;
                    const originZ: number = (this.sceneMapIndex[i] & 0xff) * 64 - this.sceneBaseTileZ;
                    world.readTiles(data, originZ, originX, (this.sceneCenterZoneX - 6) * 8, (this.sceneCenterZoneZ - 6) * 8, this.levelCollisionMap);
                }
            }

            for (let i: number = 0; i < mapCount; i++) {
                const data: Int8Array | null = this.sceneMapLandData[i];
                if (!data && this.sceneCenterZoneZ < 800) {
                    const originX: number = (this.sceneMapIndex[i] >> 8) * 64 - this.sceneBaseTileX;
                    const originZ: number = (this.sceneMapIndex[i] & 0xff) * 64 - this.sceneBaseTileZ;
                    world.stitchHeightmap(originX, originZ, 64, 64);
                }
            }

            // NO_TIMEOUT
            this.out.p1isaac(ClientProt.NO_TIMEOUT);

            if (this.sceneMapLocData) {
                for (let i: number = 0; i < mapCount; i++) {
                    const data: Int8Array | null = this.sceneMapLocData[i];
                    if (data) {
                        const originX: number = (this.sceneMapIndex[i] >> 8) * 64 - this.sceneBaseTileX;
                        const originZ: number = (this.sceneMapIndex[i] & 0xff) * 64 - this.sceneBaseTileZ;
                        world.readLocs(this.scene, this.levelCollisionMap, data, originX, originZ);
                    }
                }
            }
        }
    };

    private buildScene = (): void => {
        try {
            this.minimapLevel = -1;
            this.spotanims.clear();
            this.projectiles.clear();
            Draw3D.clearTexels();
            this.clearCaches();
            this.scene?.reset();
            for (let level: number = 0; level < CollisionMap.LEVELS; level++) {
                this.levelCollisionMap[level]?.reset();
            }

            this.clearTileFlags();

            const world: World = new World(CollisionMap.SIZE, CollisionMap.SIZE, this.levelHeightmap!, this.levelTileFlags!); // has try catch here

            this.out.p1isaac(ClientProt.NO_TIMEOUT);

            if (this.sceneInstanced) {
                // buildSceneInstanced(world);
            } else {
                this.buildSceneStandard(world);
            }

            // NO_TIMEOUT
            this.out.p1isaac(ClientProt.NO_TIMEOUT);
            world.build(this.scene, this.levelCollisionMap);
            this.areaViewport?.bind();

            // NO_TIMEOUT
            this.out.p1isaac(ClientProt.NO_TIMEOUT);

            if (Client.lowMemory) {
                this.scene?.setMinLevel(World.minLevel);
            } else {
                this.scene?.setMinLevel(0);
            }

            for (let x: number = 0; x < CollisionMap.SIZE; x++) {
                for (let z: number = 0; z < CollisionMap.SIZE; z++) {
                    this.sortObjStacks(x, z);
                }
            }

            this.temporaryLocs.clear();
        } catch (e) {
            console.log(e);
            /* empty */
        }
        if (this.hasFocus) {
            this.out.p1isaac(ClientProt.REGION_CHANGE);
            this.out.p4(0x3f008edd);
        }

        // if (lowmem && Signlink.cache_dat) {
        //     int count = ondemand.getFileCount(0);
        //     for (int i = 0; i < count; i++) {
        //         if ((ondemand.getModelFlags(i) & 0x79) == 0) {
        //             Model.unload(i);
        //         }
        //     }
        // }

        Draw3D.initPool(20);
        // ondemand.clearPrefetches();

        let minMapX: number = (this.sceneCenterZoneX - 6) / 8 - 1;
        let maxMapX: number = (this.sceneCenterZoneX + 6) / 8 + 1;
        let minMapZ: number = (this.sceneCenterZoneZ - 6) / 8 - 1;
        let maxMapZ: number = (this.sceneCenterZoneZ + 6) / 8 + 1;

        if (this.withinTutorialIsland) {
            minMapX = 49;
            maxMapX = 50;
            minMapZ = 49;
            maxMapZ = 50;
        }

        for (let mapX: number = minMapX; mapX <= maxMapX; mapX++) {
            for (let mapZ: number = minMapZ; mapZ <= maxMapZ; mapZ++) {
                if (mapX == minMapX || mapX == maxMapX || mapZ == minMapZ || mapZ == maxMapZ) {
                    // int mapFile = ondemand.getMapFile(0, mapX, mapZ);
                    // if (mapFile != -1) {
                    //     ondemand.prefetch(mapFile, 3);
                    // }
                    // int locFile = ondemand.getMapFile(1, mapX, mapZ);
                    // if (locFile != -1) {
                    //     ondemand.prefetch(locFile, 3);
                    // }
                }
            }
        }
    };

    private resetInterfaceAnimation = (id: number): void => {
        const parent: Component = Component.instances[id];
        if (!parent.childId) {
            return;
        }
        for (let i: number = 0; i < parent.childId.length && parent.childId[i] !== -1; i++) {
            const child: Component = Component.instances[parent.childId[i]];
            if (child.type === 1) {
                this.resetInterfaceAnimation(child.id);
            }
            child.seqFrame = 0;
            child.seqCycle = 0;
        }
    };

    private initializeLevelExperience = (): void => {
        let acc: number = 0;
        for (let i: number = 0; i < 99; i++) {
            const level: number = i + 1;
            const delta: number = (level + Math.pow(2.0, level / 7.0) * 300.0) | 0;
            acc += delta;
            this.levelExperience[i] = (acc / 4) | 0;
        }
    };

    private initializeBitmask = (): void => {
        let acc: number = 2;
        for (let k: number = 0; k < 32; k++) {
            Client.BITMASK[k] = (acc - 1) | 0;
            acc += acc;
        }
    };

    private addMessage = (type: number, text: string, sender: string): void => {
        if (type === 0 && this.stickyChatInterfaceId !== -1) {
            this.modalMessage = text;
            this.mouseClickButton = 0;
        }
        if (this.chatInterfaceId === -1) {
            this.redrawChatback = true;
        }
        for (let i: number = 99; i > 0; i--) {
            this.messageType[i] = this.messageType[i - 1];
            this.messageSender[i] = this.messageSender[i - 1];
            this.messageText[i] = this.messageText[i - 1];
        }
        if (Client.showDebug && type === 0) {
            text = '[' + ((Game.loopCycle / 30) | 0) + ']: ' + text;
        }
        this.messageType[0] = type;
        this.messageSender[0] = sender;
        this.messageText[0] = text;
    };

    private updateVarp = async (id: number): Promise<void> => {
        const clientcode: number = VarpType.instances[id].clientcode;
        if (clientcode !== 0) {
            const value: number = this.varps[id];
            if (clientcode === 1) {
                if (value === 1) {
                    Draw3D.setBrightness(0.9);
                }
                if (value === 2) {
                    Draw3D.setBrightness(0.8);
                }
                if (value === 3) {
                    Draw3D.setBrightness(0.7);
                }
                if (value === 4) {
                    Draw3D.setBrightness(0.6);
                }
                ObjType.iconCache?.clear();
                this.redrawTitleBackground = true;
            }
            if (clientcode === 3) {
                const lastMidiActive: boolean = this.midiActive;
                if (value === 0) {
                    this.midiVolume = 256;
                    setMidiVolume(256);
                    this.midiActive = true;
                }
                if (value === 1) {
                    this.midiVolume = 192;
                    setMidiVolume(192);
                    this.midiActive = true;
                }
                if (value === 2) {
                    this.midiVolume = 128;
                    setMidiVolume(128);
                    this.midiActive = true;
                }
                if (value === 3) {
                    this.midiVolume = 64;
                    setMidiVolume(64);
                    this.midiActive = true;
                }
                if (value === 4) {
                    this.midiActive = false;
                }
                if (this.midiActive !== lastMidiActive && !Client.lowMemory) {
                    if (this.midiActive && this.currentMidi) {
                        this.currentMidi = this.nextMidi;
                        await this.setMidi(this.currentMidi, true);
                    } else {
                        stopMidi(false);
                    }
                    this.nextMusicDelay = 0;
                }
            }
            if (clientcode === 4) {
                if (value === 0) {
                    this.waveVolume = 256;
                    setWaveVolume(256);
                    this.waveEnabled = true;
                }
                if (value === 1) {
                    this.waveVolume = 192;
                    setWaveVolume(192);
                    this.waveEnabled = true;
                }
                if (value === 2) {
                    this.waveVolume = 128;
                    setWaveVolume(128);
                    this.waveEnabled = true;
                }
                if (value === 3) {
                    this.waveVolume = 64;
                    setWaveVolume(64);
                    this.waveEnabled = true;
                }
                if (value === 4) {
                    this.waveEnabled = false;
                }
            }
            if (clientcode === 5) {
                this.mouseButtonsOption = value;
            }
            if (clientcode === 6) {
                this.chatEffects = value;
            }
            if (clientcode === 8) {
                this.splitPrivateChat = value;
                this.redrawChatback = true;
            }
            if (clientcode === 9) {
                this.bankArrangeMode = value;
            }
        }
    };

    private handleChatMouseInput = (mouseY: number): void => {
        let line: number = 0;
        for (let i: number = 0; i < 100; i++) {
            if (!this.messageText[i]) {
                continue;
            }

            const type: number = this.messageType[i];
            const y: number = this.chatScrollOffset + 70 + 4 - line * 14;
            if (y < -20) {
                break;
            }

            if (type === 0) {
                line++;
            }

            if ((type === 1 || type === 2) && (type === 1 || this.publicChatSetting === 0 || (this.publicChatSetting === 1 && this.isFriend(this.messageSender[i])))) {
                if (mouseY > y - 14 && mouseY <= y && this.localPlayer && this.messageSender[i] !== this.localPlayer.name) {
                    if (this.rights) {
                        this.menuOption[this.menuSize] = 'Report abuse @whi@' + this.messageSender[i];
                        this.menuAction[this.menuSize] = 606;
                        this.menuSize++;
                    }

                    this.menuOption[this.menuSize] = 'Add ignore @whi@' + this.messageSender[i];
                    this.menuAction[this.menuSize] = 42;
                    this.menuSize++;
                    this.menuOption[this.menuSize] = 'Add friend @whi@' + this.messageSender[i];
                    this.menuAction[this.menuSize] = 337;
                    this.menuSize++;
                }

                line++;
            }

            if ((type === 3 || type === 7) && this.splitPrivateChat === 0 && (type === 7 || this.privateChatSetting === 0 || (this.privateChatSetting === 1 && this.isFriend(this.messageSender[i])))) {
                if (mouseY > y - 14 && mouseY <= y) {
                    if (this.rights) {
                        this.menuOption[this.menuSize] = 'Report abuse @whi@' + this.messageSender[i];
                        this.menuAction[this.menuSize] = 606;
                        this.menuSize++;
                    }

                    this.menuOption[this.menuSize] = 'Add ignore @whi@' + this.messageSender[i];
                    this.menuAction[this.menuSize] = 42;
                    this.menuSize++;
                    this.menuOption[this.menuSize] = 'Add friend @whi@' + this.messageSender[i];
                    this.menuAction[this.menuSize] = 337;
                    this.menuSize++;
                }

                line++;
            }

            if (type === 4 && (this.tradeChatSetting === 0 || (this.tradeChatSetting === 1 && this.isFriend(this.messageSender[i])))) {
                if (mouseY > y - 14 && mouseY <= y) {
                    this.menuOption[this.menuSize] = 'Accept trade @whi@' + this.messageSender[i];
                    this.menuAction[this.menuSize] = 484;
                    this.menuSize++;
                }

                line++;
            }

            if ((type === 5 || type === 6) && this.splitPrivateChat === 0 && this.privateChatSetting < 2) {
                line++;
            }

            if (type === 8 && (this.tradeChatSetting === 0 || (this.tradeChatSetting === 1 && this.isFriend(this.messageSender[i])))) {
                if (mouseY > y - 14 && mouseY <= y) {
                    this.menuOption[this.menuSize] = 'Accept duel @whi@' + this.messageSender[i];
                    this.menuAction[this.menuSize] = 363;
                    this.menuSize++;
                }

                line++;
            }
        }
    };

    private handlePrivateChatInput = (): void => {
        if (this.splitPrivateChat === 0) {
            return;
        }

        let lineOffset: number = 0;
        if (this.systemUpdateTimer !== 0) {
            lineOffset = 1;
        }

        for (let i: number = 0; i < 100; i++) {
            if (this.messageText[i] !== null) {
                const type: number = this.messageType[i];

                let sender: string | null = this.messageSender[i];
                if (sender !== null && sender.startsWith('@cr1@')) {
                    sender = sender.substring(5);
                }
                if (sender !== null && sender.startsWith('@cr2@')) {
                    sender = sender.substring(5);
                }
                if ((type === 3 || type === 7) && (type === 7 || this.privateChatSetting === 0 || (this.privateChatSetting === 1 && this.isFriend(sender)))) {
                    const y: number = 329 - lineOffset * 13;
                    if (this.mouseX > 4 && this.mouseY - 4 > y - 10 && this.mouseY - 4 <= y + 3) {
                        let w: number = this.fontPlain12!.stringWidth('From:  ' + sender + this.messageText[i]) + 25;

                        if (w > 450) {
                            w = 450;
                        }

                        if (this.mouseX < 4 + w) {
                            if (this.rights) {
                                this.menuOption[this.menuSize] = 'Report abuse @whi@' + sender;
                                this.menuAction[this.menuSize] = 2606;
                                this.menuSize++;
                            }
                            this.menuOption[this.menuSize] = 'Add ignore @whi@' + sender;
                            this.menuAction[this.menuSize] = 2042;
                            this.menuSize++;
                            this.menuOption[this.menuSize] = 'Add friend @whi@' + sender;
                            this.menuAction[this.menuSize] = 2337;
                            this.menuSize++;
                        }
                    }

                    lineOffset++;
                    if (lineOffset >= 5) {
                        return;
                    }
                }

                if ((type === 5 || type === 6) && this.privateChatSetting < 2) {
                    lineOffset++;
                    if (lineOffset >= 5) {
                        return;
                    }
                }
            }
        }
    };

    private handleInterfaceInput = (com: Component, x: number, y: number, scrollPosition: number): void => {
        const mx: number = this.mouseX;
        const my: number = this.mouseY;

        if (com.type !== Component.TYPE_LAYER || !com.childId || com.hide || mx < x || my < y || mx > x + com.width || my > y + com.height || !com.childX || !com.childY) {
            return;
        }

        const children: number = com.childId.length;
        for (let i: number = 0; i < children; i++) {
            let childX: number = com.childX[i] + x;
            let childY: number = com.childY[i] + y - scrollPosition;
            const child: Component = Component.instances[com.childId[i]];

            childX += child.x;
            childY += child.y;

            if ((child.overLayer >= 0 || child.overColour !== 0) && mx >= childX && my >= childY && mx < childX + child.width && my < childY + child.height) {
                if (child.overLayer >= 0) {
                    this.lastHoveredInterfaceId = child.overLayer;
                } else {
                    this.lastHoveredInterfaceId = child.id;
                }
            }

            if (child.type === 0) {
                this.handleInterfaceInput(child, childX, childY, child.scrollPosition);

                if (child.scroll > child.height) {
                    this.handleScrollInput(mx, my, child.scroll, child.height, true, childX + child.width, childY, child);
                }
            } else if (child.type === 2) {
                let slot: number = 0;

                for (let row: number = 0; row < child.height; row++) {
                    for (let col: number = 0; col < child.width; col++) {
                        let slotX: number = childX + col * (child.marginX + 32);
                        let slotY: number = childY + row * (child.marginY + 32);

                        if (slot < 20 && child.invSlotOffsetX && child.invSlotOffsetY) {
                            slotX += child.invSlotOffsetX[slot];
                            slotY += child.invSlotOffsetY[slot];
                        }

                        if (mx < slotX || my < slotY || mx >= slotX + 32 || my >= slotY + 32) {
                            slot++;
                            continue;
                        }

                        this.hoveredSlot = slot;
                        this.hoveredSlotParentId = child.id;

                        if (!child.invSlotObjId || child.invSlotObjId[slot] <= 0) {
                            slot++;
                            continue;
                        }

                        const obj: ObjType = ObjType.get(child.invSlotObjId[slot] - 1);

                        if (this.objSelected === 1 && child.interactable) {
                            if (child.id !== this.objSelectedInterface || slot !== this.objSelectedSlot) {
                                this.menuOption[this.menuSize] = 'Use ' + this.objSelectedName + ' with @lre@' + obj.name;
                                this.menuAction[this.menuSize] = 870;
                                this.menuParamA[this.menuSize] = obj.id;
                                this.menuParamB[this.menuSize] = slot;
                                this.menuParamC[this.menuSize] = child.id;
                                this.menuSize++;
                            }
                        } else if (this.spellSelected === 1 && child.interactable) {
                            if ((this.activeSpellFlags & 0x10) === 16) {
                                this.menuOption[this.menuSize] = this.spellCaption + ' @lre@' + obj.name;
                                this.menuAction[this.menuSize] = 543;
                                this.menuParamA[this.menuSize] = obj.id;
                                this.menuParamB[this.menuSize] = slot;
                                this.menuParamC[this.menuSize] = child.id;
                                this.menuSize++;
                            }
                        } else {
                            if (child.interactable) {
                                for (let op: number = 4; op >= 3; op--) {
                                    if (obj.iop && obj.iop[op]) {
                                        this.menuOption[this.menuSize] = obj.iop[op] + ' @lre@' + obj.name;
                                        this.menuAction[this.menuSize] = this.OBJ_IOP_ACTION[op];
                                        this.menuParamA[this.menuSize] = obj.id;
                                        this.menuParamB[this.menuSize] = slot;
                                        this.menuParamC[this.menuSize] = child.id;
                                        this.menuSize++;
                                    } else if (op === 4) {
                                        this.menuOption[this.menuSize] = 'Drop @lre@' + obj.name;
                                        this.menuAction[this.menuSize] = 847;
                                        this.menuParamA[this.menuSize] = obj.id;
                                        this.menuParamB[this.menuSize] = slot;
                                        this.menuParamC[this.menuSize] = child.id;
                                        this.menuSize++;
                                    }
                                }
                            }

                            if (child.usable) {
                                this.menuOption[this.menuSize] = 'Use @lre@' + obj.name;
                                this.menuAction[this.menuSize] = 447;
                                this.menuParamA[this.menuSize] = obj.id;
                                this.menuParamB[this.menuSize] = slot;
                                this.menuParamC[this.menuSize] = child.id;
                                this.menuSize++;
                            }

                            if (child.interactable && obj.iop) {
                                for (let op: number = 2; op >= 0; op--) {
                                    if (obj.iop[op]) {
                                        this.menuOption[this.menuSize] = obj.iop[op] + ' @lre@' + obj.name;
                                        this.menuAction[this.menuSize] = this.OBJ_IOP_ACTION[op];
                                        this.menuParamA[this.menuSize] = obj.id;
                                        this.menuParamB[this.menuSize] = slot;
                                        this.menuParamC[this.menuSize] = child.id;
                                        this.menuSize++;
                                    }
                                }
                            }

                            if (child.iops) {
                                for (let op: number = 4; op >= 0; op--) {
                                    if (child.iops[op]) {
                                        this.menuOption[this.menuSize] = child.iops[op] + ' @lre@' + obj.name;
                                        this.menuAction[this.menuSize] = this.INV_OP_ACTION[op];
                                        this.menuParamA[this.menuSize] = obj.id;
                                        this.menuParamB[this.menuSize] = slot;
                                        this.menuParamC[this.menuSize] = child.id;
                                        this.menuSize++;
                                    }
                                }
                            }

                            this.menuOption[this.menuSize] = 'Examine @lre@' + obj.name;
                            if (Client.showDebug) {
                                this.menuOption[this.menuSize] += '@whi@ (' + obj.id + ')';
                            }
                            this.menuAction[this.menuSize] = 1125;
                            this.menuParamA[this.menuSize] = obj.id;
                            if (child.invSlotObjCount) {
                                this.menuParamC[this.menuSize] = child.invSlotObjCount[slot];
                            }
                            this.menuSize++;
                        }

                        slot++;
                    }
                }
            } else if (mx >= childX && my >= childY && mx < childX + child.width && my < childY + child.height) {
                if (child.buttonType === Component.BUTTON_OK) {
                    let override: boolean = false;
                    if (child.clientCode !== 0) {
                        override = this.handleSocialMenuOption(child);
                    }

                    if (!override && child.option) {
                        this.menuOption[this.menuSize] = child.option;
                        this.menuAction[this.menuSize] = 315;
                        this.menuParamC[this.menuSize] = child.id;
                        this.menuSize++;
                    }
                } else if (child.buttonType === Component.BUTTON_TARGET && this.spellSelected === 0) {
                    let prefix: string | null = child.actionVerb;
                    if (prefix && prefix.indexOf(' ') !== -1) {
                        prefix = prefix.substring(0, prefix.indexOf(' '));
                    }

                    this.menuOption[this.menuSize] = prefix + ' @gre@' + child.action;
                    this.menuAction[this.menuSize] = 626;
                    this.menuParamC[this.menuSize] = child.id;
                    this.menuSize++;
                } else if (child.buttonType === Component.BUTTON_CLOSE) {
                    this.menuOption[this.menuSize] = 'Close';
                    this.menuAction[this.menuSize] = 200;
                    this.menuParamC[this.menuSize] = child.id;
                    this.menuSize++;
                } else if (child.buttonType === Component.BUTTON_TOGGLE && child.option) {
                    this.menuOption[this.menuSize] = child.option;
                    this.menuAction[this.menuSize] = 169;
                    this.menuParamC[this.menuSize] = child.id;
                    this.menuSize++;
                } else if (child.buttonType === Component.BUTTON_SELECT && child.option) {
                    this.menuOption[this.menuSize] = child.option;
                    this.menuAction[this.menuSize] = 646;
                    this.menuParamC[this.menuSize] = child.id;
                    this.menuSize++;
                } else if (child.buttonType === Component.BUTTON_CONTINUE && !this.pressedContinueOption && child.option) {
                    this.menuOption[this.menuSize] = child.option;
                    this.menuAction[this.menuSize] = 679;
                    this.menuParamC[this.menuSize] = child.id;
                    this.menuSize++;
                }
            }
        }
    };

    private handleSocialMenuOption = (component: Component): boolean => {
        let type: number = component.clientCode;
        // TODO: this is different
        if (type >= Component.CC_FRIENDS_START && type <= Component.CC_FRIENDS_UPDATE_END) {
            if (type >= Component.CC_FRIENDS_UPDATE_START) {
                type -= Component.CC_FRIENDS_UPDATE_START;
            } else {
                type--;
            }
            this.menuOption[this.menuSize] = 'Remove @whi@' + this.friendName[type];
            this.menuAction[this.menuSize] = 557;
            this.menuSize++;
            this.menuOption[this.menuSize] = 'Message @whi@' + this.friendName[type];
            this.menuAction[this.menuSize] = 679;
            this.menuSize++;
            return true;
        } else if (type >= Component.CC_IGNORES_START && type <= Component.CC_IGNORES_END) {
            this.menuOption[this.menuSize] = 'Remove @whi@' + component.text;
            this.menuAction[this.menuSize] = 556;
            this.menuSize++;
            return true;
        }
        return false;
    };

    // TODO: make addmenuoption function
    private handleViewportOptions = (): void => {
        if (this.objSelected === 0 && this.spellSelected === 0) {
            this.menuOption[this.menuSize] = 'Walk here';
            this.menuAction[this.menuSize] = 516;
            this.menuParamB[this.menuSize] = this.mouseX;
            this.menuParamC[this.menuSize] = this.mouseY;
            this.menuSize++;
        }

        let lastBitset: number = -1;
        for (let picked: number = 0; picked < Model.pickedCount; picked++) {
            const bitset: number = Model.pickedBitsets[picked];
            const x: number = bitset & 0x7f;
            const z: number = (bitset >> 7) & 0x7f;
            const entityType: number = (bitset >> 29) & 0x3;
            const typeId: number = (bitset >> 14) & 0x7fff;

            if (bitset === lastBitset) {
                continue;
            }

            lastBitset = bitset;

            if (entityType === 2 && this.scene && this.scene.getInfo(this.currentLevel, x, z, bitset) >= 0) {
                let loc: LocType | null = LocType.get(typeId);

                if (loc.multiloc) {
                    loc = loc.getMultiloc();
                }

                if (!loc) {
                    return;
                }

                if (this.objSelected === 1) {
                    this.menuOption[this.menuSize] = 'Use ' + this.objSelectedName + ' with @cya@' + loc.name;
                    this.menuAction[this.menuSize] = 62;
                    this.menuParamA[this.menuSize] = bitset;
                    this.menuParamB[this.menuSize] = x;
                    this.menuParamC[this.menuSize] = z;
                    this.menuSize++;
                } else if (this.spellSelected !== 1) {
                    if (loc.op) {
                        for (let op: number = 4; op >= 0; op--) {
                            if (loc.op[op]) {
                                this.menuOption[this.menuSize] = loc.op[op] + ' @cya@' + loc.name;
                                this.menuAction[this.menuSize] = this.LOC_OP_ACTION[op];

                                this.menuParamA[this.menuSize] = bitset;
                                this.menuParamB[this.menuSize] = x;
                                this.menuParamC[this.menuSize] = z;
                                this.menuSize++;
                            }
                        }
                    }

                    this.menuOption[this.menuSize] = 'Examine @cya@' + loc.name;
                    if (Client.showDebug) {
                        this.menuOption[this.menuSize] += '@whi@ (' + loc.id + ')';
                    }
                    this.menuAction[this.menuSize] = 1226;
                    this.menuParamA[this.menuSize] = bitset;
                    this.menuParamB[this.menuSize] = x;
                    this.menuParamC[this.menuSize] = z;
                    this.menuSize++;
                } else if ((this.activeSpellFlags & 0x4) === 4) {
                    this.menuOption[this.menuSize] = this.spellCaption + ' @cya@' + loc.name;
                    this.menuAction[this.menuSize] = 956;
                    this.menuParamA[this.menuSize] = bitset;
                    this.menuParamB[this.menuSize] = x;
                    this.menuParamC[this.menuSize] = z;
                    this.menuSize++;
                }
            }

            if (entityType === 1) {
                const npc: NpcEntity | null = this.npcs[typeId];
                if (npc && npc.type && npc.type.size === 1 && (npc.x & 0x7f) === 64 && (npc.z & 0x7f) === 64) {
                    for (let i: number = 0; i < this.npcCount; i++) {
                        const other: NpcEntity | null = this.npcs[this.npcIds[i]];

                        if (other && other !== npc && other.type && other.type.size === 1 && other.x === npc.x && other.z === npc.z) {
                            this.addNpcOptions(other.type, this.npcIds[i], x, z);
                        }
                    }
                }

                if (npc && npc.type) {
                    this.addNpcOptions(npc.type, typeId, x, z);
                }
            }

            if (entityType === 0) {
                const player: PlayerEntity | null = this.players[typeId];
                if (player && (player.x & 0x7f) === 64 && (player.z & 0x7f) === 64) {
                    for (let i: number = 0; i < this.npcCount; i++) {
                        const other: NpcEntity | null = this.npcs[this.npcIds[i]];

                        if (other && other.type && other.type.size === 1 && other.x === player.x && other.z === player.z) {
                            this.addNpcOptions(other.type, this.npcIds[i], x, z);
                        }
                    }

                    for (let i: number = 0; i < this.playerCount; i++) {
                        const other: PlayerEntity | null = this.players[this.playerIds[i]];

                        if (other && other !== player && other.x === player.x && other.z === player.z) {
                            this.addPlayerOptions(other, this.playerIds[i], x, z);
                        }
                    }
                }

                if (player) {
                    this.addPlayerOptions(player, typeId, x, z);
                }
            }

            if (entityType === 3) {
                const objs: LinkList | null = this.levelObjStacks[this.currentLevel][x][z];
                if (!objs) {
                    continue;
                }

                for (let obj: ObjStackEntity | null = objs.tail() as ObjStackEntity | null; obj; obj = objs.prev() as ObjStackEntity | null) {
                    const type: ObjType = ObjType.get(obj.index);
                    if (this.objSelected === 1) {
                        this.menuOption[this.menuSize] = 'Use ' + this.objSelectedName + ' with @lre@' + type.name;
                        this.menuAction[this.menuSize] = 511;
                        this.menuParamA[this.menuSize] = obj.index;
                        this.menuParamB[this.menuSize] = x;
                        this.menuParamC[this.menuSize] = z;
                        this.menuSize++;
                    } else if (this.spellSelected !== 1) {
                        for (let op: number = 4; op >= 0; op--) {
                            if (type.op && type.op[op]) {
                                this.menuOption[this.menuSize] = type.op[op] + ' @lre@' + type.name;
                                this.menuAction[this.menuSize] = this.OBJ_OP_ACTION[op];
                                this.menuParamA[this.menuSize] = obj.index;
                                this.menuParamB[this.menuSize] = x;
                                this.menuParamC[this.menuSize] = z;
                                this.menuSize++;
                            } else if (op === 2) {
                                this.menuOption[this.menuSize] = 'Take @lre@' + type.name;
                                this.menuAction[this.menuSize] = 234;
                                this.menuParamA[this.menuSize] = obj.index;
                                this.menuParamB[this.menuSize] = x;
                                this.menuParamC[this.menuSize] = z;
                                this.menuSize++;
                            }
                        }

                        this.menuOption[this.menuSize] = 'Examine @lre@' + type.name;
                        if (Client.showDebug) {
                            this.menuOption[this.menuSize] += '@whi@ (' + obj.index + ')';
                        }
                        this.menuAction[this.menuSize] = 1448;
                        this.menuParamA[this.menuSize] = obj.index;
                        this.menuParamB[this.menuSize] = x;
                        this.menuParamC[this.menuSize] = z;
                        this.menuSize++;
                    } else if ((this.activeSpellFlags & 0x1) === 1) {
                        this.menuOption[this.menuSize] = this.spellCaption + ' @lre@' + type.name;
                        this.menuAction[this.menuSize] = 94;
                        this.menuParamA[this.menuSize] = obj.index;
                        this.menuParamB[this.menuSize] = x;
                        this.menuParamC[this.menuSize] = z;
                        this.menuSize++;
                    }
                }
            }
        }
    };

    private addNpcOptions = (npc: NpcType | null, a: number, b: number, c: number): void => {
        if (this.menuSize >= 400) {
            return;
        }

        if (npc && npc.overrides) {
            npc = npc.getOverrideType();
        }

        if (!npc) {
            return;
        }

        if (!npc.interactable) {
            return;
        }

        let tooltip: string | null = npc.name;
        if (npc.vislevel !== 0 && this.localPlayer) {
            tooltip = tooltip + this.getCombatLevelColorTag(this.localPlayer.combatLevel, npc.vislevel) + ' (level-' + npc.vislevel + ')';
        }

        if (this.objSelected === 1) {
            this.menuOption[this.menuSize] = 'Use ' + this.objSelectedName + ' with @yel@' + tooltip;
            this.menuAction[this.menuSize] = 582;
            this.menuParamA[this.menuSize] = a;
            this.menuParamB[this.menuSize] = b;
            this.menuParamC[this.menuSize] = c;
            this.menuSize++;
        } else if (this.spellSelected !== 1) {
            let type: number;
            if (npc.op) {
                for (type = 4; type >= 0; type--) {
                    if (npc.op[type] && npc.op[type]?.toLowerCase() !== 'attack') {
                        this.menuOption[this.menuSize] = npc.op[type] + ' @yel@' + tooltip;
                        this.menuAction[this.menuSize] = this.NPC_OP_ACTION[type];
                        this.menuParamA[this.menuSize] = a;
                        this.menuParamB[this.menuSize] = b;
                        this.menuParamC[this.menuSize] = c;
                        this.menuSize++;
                    }
                }
            }

            if (npc.op) {
                for (type = 4; type >= 0; type--) {
                    if (npc.op[type] && npc.op[type]?.toLowerCase() === 'attack') {
                        let action: number = 0;
                        if (this.localPlayer && npc.vislevel > this.localPlayer.combatLevel) {
                            action = 2000;
                        }

                        this.menuOption[this.menuSize] = npc.op[type] + ' @yel@' + tooltip;
                        this.menuAction[this.menuSize] = this.NPC_OP_ACTION[type] + action;
                        this.menuParamA[this.menuSize] = a;
                        this.menuParamB[this.menuSize] = b;
                        this.menuParamC[this.menuSize] = c;
                        this.menuSize++;
                    }
                }
            }

            this.menuOption[this.menuSize] = 'Examine @yel@' + tooltip;
            if (Client.showDebug) {
                this.menuOption[this.menuSize] += '@whi@ (' + npc.id + ')';
            }
            this.menuAction[this.menuSize] = 1025;
            this.menuParamA[this.menuSize] = a;
            this.menuParamB[this.menuSize] = b;
            this.menuParamC[this.menuSize] = c;
            this.menuSize++;
        } else if ((this.activeSpellFlags & 0x2) === 2) {
            this.menuOption[this.menuSize] = this.spellCaption + ' @yel@' + tooltip;
            this.menuAction[this.menuSize] = 413;
            this.menuParamA[this.menuSize] = a;
            this.menuParamB[this.menuSize] = b;
            this.menuParamC[this.menuSize] = c;
            this.menuSize++;
        }
    };

    // TODO everything, no sortmenuoptions()/addmenuoption?
    private addPlayerOptions = (player: PlayerEntity, a: number, b: number, c: number): void => {
        if (player === this.localPlayer || this.menuSize >= 400) {
            return;
        }

        let tooltip: string | null = null;
        if (this.localPlayer) {
            if (player.skillLevel === 0) {
                tooltip = player.name + this.getCombatLevelColorTag(this.localPlayer.combatLevel, player.combatLevel) + ' (level-' + player.combatLevel + ')';
            } else {
                tooltip = player.name + ' (skill-' + player.skillLevel + ')';
            }
        }
        if (this.objSelected === 1) {
            this.menuOption[this.menuSize] = 'Use ' + this.objSelectedName + ' with @whi@' + tooltip;
            this.menuAction[this.menuSize] = 491;
            this.menuParamA[this.menuSize] = a;
            this.menuParamB[this.menuSize] = b;
            this.menuParamC[this.menuSize] = c;
            this.menuSize++;
        } else if (this.spellSelected !== 1) {
            this.menuOption[this.menuSize] = 'Follow @whi@' + tooltip;
            this.menuAction[this.menuSize] = 1544;
            this.menuParamA[this.menuSize] = a;
            this.menuParamB[this.menuSize] = b;
            this.menuParamC[this.menuSize] = c;
            this.menuSize++;

            if (this.overrideChat === 0) {
                this.menuOption[this.menuSize] = 'Trade with @whi@' + tooltip;
                this.menuAction[this.menuSize] = 1373;
                this.menuParamA[this.menuSize] = a;
                this.menuParamB[this.menuSize] = b;
                this.menuParamC[this.menuSize] = c;
                this.menuSize++;
            }

            if (this.wildernessLevel > 0) {
                this.menuOption[this.menuSize] = 'Attack @whi@' + tooltip;
                // TODO: > instead of >=? or what
                if (this.localPlayer && this.localPlayer.combatLevel >= player.combatLevel) {
                    this.menuAction[this.menuSize] = 151;
                } else {
                    this.menuAction[this.menuSize] = 2151;
                }
                this.menuParamA[this.menuSize] = a;
                this.menuParamB[this.menuSize] = b;
                this.menuParamC[this.menuSize] = c;
                this.menuSize++;
            }

            if (this.worldLocationState === 1) {
                this.menuOption[this.menuSize] = 'Fight @whi@' + tooltip;
                this.menuAction[this.menuSize] = 151;
                this.menuParamA[this.menuSize] = a;
                this.menuParamB[this.menuSize] = b;
                this.menuParamC[this.menuSize] = c;
                this.menuSize++;
            }

            if (this.worldLocationState === 2) {
                this.menuOption[this.menuSize] = 'Duel-with @whi@' + tooltip;
                this.menuAction[this.menuSize] = 1101;
                this.menuParamA[this.menuSize] = a;
                this.menuParamB[this.menuSize] = b;
                this.menuParamC[this.menuSize] = c;
                this.menuSize++;
            }
        } else if ((this.activeSpellFlags & 0x8) === 8) {
            this.menuOption[this.menuSize] = this.spellCaption + ' @whi@' + tooltip;
            this.menuAction[this.menuSize] = 365;
            this.menuParamA[this.menuSize] = a;
            this.menuParamB[this.menuSize] = b;
            this.menuParamC[this.menuSize] = c;
            this.menuSize++;
        }

        for (let i: number = 0; i < this.menuSize; i++) {
            if (this.menuAction[i] === 516) {
                this.menuOption[i] = 'Walk here @whi@' + tooltip;
                return;
            }
        }
    };

    private getCombatLevelColorTag = (viewerLevel: number, otherLevel: number): string => {
        const diff: number = viewerLevel - otherLevel;
        if (diff < -9) {
            return '@red@';
        } else if (diff < -6) {
            return '@or3@';
        } else if (diff < -3) {
            return '@or2@';
        } else if (diff < 0) {
            return '@or1@';
        } else if (diff > 9) {
            return '@gre@';
        } else if (diff > 6) {
            return '@gr3@';
        } else if (diff > 3) {
            return '@gr2@';
        } else if (diff > 0) {
            return '@gr1@';
        } else {
            return '@yel@';
        }
    };

    private handleInput = (): void => {
        if (this.objDragArea === 0) {
            this.menuOption[0] = 'Cancel';
            this.menuAction[0] = 1107;
            this.menuSize = 1;
            this.handlePrivateChatInput();
            this.lastHoveredInterfaceId = 0;

            // the main viewport area
            if (this.mouseX > 4 && this.mouseY > 4 && this.mouseX < 516 && this.mouseY < 338) {
                if (this.viewportInterfaceId === -1) {
                    this.handleViewportOptions();
                } else {
                    this.handleInterfaceInput(Component.instances[this.viewportInterfaceId], 4, 4, 0);
                }
            }

            if (this.lastHoveredInterfaceId !== this.viewportHoveredInterfaceIndex) {
                this.viewportHoveredInterfaceIndex = this.lastHoveredInterfaceId;
            }

            this.lastHoveredInterfaceId = 0;

            // the sidebar/tabs area
            if (this.mouseX > 553 && this.mouseY > 205 && this.mouseX < 743 && this.mouseY < 466) {
                if (this.sidebarInterfaceId !== -1) {
                    this.handleInterfaceInput(Component.instances[this.sidebarInterfaceId], 553, 205, 0);
                } else if (this.tabInterfaceId[this.selectedTab] !== -1) {
                    this.handleInterfaceInput(Component.instances[this.tabInterfaceId[this.selectedTab]], 553, 205, 0);
                }
            }

            if (this.lastHoveredInterfaceId !== this.sidebarHoveredInterfaceIndex) {
                this.redrawSidebar = true;
                this.sidebarHoveredInterfaceIndex = this.lastHoveredInterfaceId;
            }

            this.lastHoveredInterfaceId = 0;

            // the chatbox area
            if (this.mouseX > 17 && this.mouseY > 357 && this.mouseX < 496 && this.mouseY < 453) {
                if (this.chatInterfaceId === -1) {
                    this.handleChatMouseInput(this.mouseY - 357);
                } else {
                    this.handleInterfaceInput(Component.instances[this.chatInterfaceId], 17, 357, 0);
                }
            }

            if (this.chatInterfaceId !== -1 && this.lastHoveredInterfaceId !== this.chatHoveredInterfaceIndex) {
                this.redrawChatback = true;
                this.chatHoveredInterfaceIndex = this.lastHoveredInterfaceId;
            }

            let done: boolean = false;
            while (!done) {
                done = true;

                for (let i: number = 0; i < this.menuSize - 1; i++) {
                    if (this.menuAction[i] < 1000 && this.menuAction[i + 1] > 1000) {
                        const tmp0: string = this.menuOption[i];
                        this.menuOption[i] = this.menuOption[i + 1];
                        this.menuOption[i + 1] = tmp0;

                        const tmp1: number = this.menuAction[i];
                        this.menuAction[i] = this.menuAction[i + 1];
                        this.menuAction[i + 1] = tmp1;

                        const tmp2: number = this.menuParamB[i];
                        this.menuParamB[i] = this.menuParamB[i + 1];
                        this.menuParamB[i + 1] = tmp2;

                        const tmp3: number = this.menuParamC[i];
                        this.menuParamC[i] = this.menuParamC[i + 1];
                        this.menuParamC[i + 1] = tmp3;

                        const tmp4: number = this.menuParamA[i];
                        this.menuParamA[i] = this.menuParamA[i + 1];
                        this.menuParamA[i + 1] = tmp4;

                        done = false;
                    }
                }
            }
        }
    };

    private showContextMenu = (): void => {
        let width: number = 0;
        if (this.fontBold12) {
            width = this.fontBold12.stringWidth('Choose Option');
            let maxWidth: number;
            for (let i: number = 0; i < this.menuSize; i++) {
                maxWidth = this.fontBold12.stringWidth(this.menuOption[i]);
                if (maxWidth > width) {
                    width = maxWidth;
                }
            }
        }
        width += 8;

        const height: number = this.menuSize * 15 + 21;

        let x: number;
        let y: number;

        // the main viewport area
        if (this.mouseClickX > 4 && this.mouseClickY > 4 && this.mouseClickX < 516 && this.mouseClickY < 338) {
            x = this.mouseClickX - ((width / 2) | 0) - 4;
            if (x + width > 512) {
                x = 512 - width;
            } else if (x < 0) {
                x = 0;
            }

            y = this.mouseClickY - 4;
            if (y + height > 334) {
                y = 334 - height;
            } else if (y < 0) {
                y = 0;
            }

            this.menuVisible = true;
            this.menuArea = 0;
            this.menuX = x;
            this.menuY = y;
            this.menuWidth = width;
            this.menuHeight = this.menuSize * 15 + 22;
        }

        // the sidebar/tabs area
        if (this.mouseClickX > 553 && this.mouseClickY > 205 && this.mouseClickX < 743 && this.mouseClickY < 466) {
            x = this.mouseClickX - ((width / 2) | 0) - 553;
            if (x < 0) {
                x = 0;
            } else if (x + width > 190) {
                x = 190 - width;
            }

            y = this.mouseClickY - 205;
            if (y < 0) {
                y = 0;
            } else if (y + height > 261) {
                y = 261 - height;
            }

            this.menuVisible = true;
            this.menuArea = 1;
            this.menuX = x;
            this.menuY = y;
            this.menuWidth = width;
            this.menuHeight = this.menuSize * 15 + 22;
        }

        // the chatbox area
        if (this.mouseClickX > 17 && this.mouseClickY > 357 && this.mouseClickX < 496 && this.mouseClickY < 453) {
            x = this.mouseClickX - ((width / 2) | 0) - 17;
            if (x < 0) {
                x = 0;
            } else if (x + width > 479) {
                x = 479 - width;
            }

            y = this.mouseClickY - 357;
            if (y < 0) {
                y = 0;
            } else if (y + height > 96) {
                y = 96 - height;
            }

            this.menuVisible = true;
            this.menuArea = 2;
            this.menuX = x;
            this.menuY = y;
            this.menuWidth = width;
            this.menuHeight = this.menuSize * 15 + 22;
        }
    };

    private tryMove = (srcX: number, srcZ: number, dx: number, dz: number, type: number, locWidth: number, locLength: number, locAngle: number, locShape: number, forceapproach: number, tryNearest: boolean): boolean => {
        const collisionMap: CollisionMap | null = this.levelCollisionMap[this.currentLevel];
        if (!collisionMap) {
            return false;
        }

        const sceneWidth: number = CollisionMap.SIZE;
        const sceneLength: number = CollisionMap.SIZE;

        for (let x: number = 0; x < sceneWidth; x++) {
            for (let z: number = 0; z < sceneLength; z++) {
                const index: number = CollisionMap.index(x, z);
                this.bfsDirection[index] = 0;
                this.bfsCost[index] = 99999999;
            }
        }

        let x: number = srcX;
        let z: number = srcZ;

        const srcIndex: number = CollisionMap.index(srcX, srcZ);
        this.bfsDirection[srcIndex] = 99;
        this.bfsCost[srcIndex] = 0;

        let steps: number = 0;
        let length: number = 0;

        this.bfsStepX[steps] = srcX;
        this.bfsStepZ[steps++] = srcZ;

        let arrived: boolean = false;
        let bufferSize: number = this.bfsStepX.length;
        const flags: Int32Array = collisionMap.flags;

        while (length !== steps) {
            x = this.bfsStepX[length];
            z = this.bfsStepZ[length];
            length = (length + 1) % bufferSize;

            if (x === dx && z === dz) {
                arrived = true;
                break;
            }

            if (locShape !== LocShape.WALL_STRAIGHT.id) {
                if ((locShape < LocShape.WALLDECOR_STRAIGHT_OFFSET.id || locShape === LocShape.CENTREPIECE_STRAIGHT.id) && collisionMap.reachedWall(x, z, dx, dz, locShape - 1, locAngle)) {
                    arrived = true;
                    break;
                }

                if (locShape < LocShape.CENTREPIECE_STRAIGHT.id && collisionMap.reachedWallDecoration(x, z, dx, dz, locShape - 1, locAngle)) {
                    arrived = true;
                    break;
                }
            }

            if (locWidth !== 0 && locLength !== 0 && collisionMap.reachedLoc(x, z, dx, dz, locWidth, locLength, forceapproach)) {
                arrived = true;
                break;
            }

            const nextCost: number = this.bfsCost[CollisionMap.index(x, z)] + 1;
            let index: number = CollisionMap.index(x - 1, z);
            if (x > 0 && this.bfsDirection[index] === 0 && (flags[index] & CollisionFlag.BLOCK_WEST) === CollisionFlag.OPEN) {
                this.bfsStepX[steps] = x - 1;
                this.bfsStepZ[steps] = z;
                steps = (steps + 1) % bufferSize;
                this.bfsDirection[index] = 2;
                this.bfsCost[index] = nextCost;
            }

            index = CollisionMap.index(x + 1, z);
            if (x < sceneWidth - 1 && this.bfsDirection[index] === 0 && (flags[index] & CollisionFlag.BLOCK_EAST) === CollisionFlag.OPEN) {
                this.bfsStepX[steps] = x + 1;
                this.bfsStepZ[steps] = z;
                steps = (steps + 1) % bufferSize;
                this.bfsDirection[index] = 8;
                this.bfsCost[index] = nextCost;
            }

            index = CollisionMap.index(x, z - 1);
            if (z > 0 && this.bfsDirection[index] === 0 && (flags[index] & CollisionFlag.BLOCK_SOUTH) === CollisionFlag.OPEN) {
                this.bfsStepX[steps] = x;
                this.bfsStepZ[steps] = z - 1;
                steps = (steps + 1) % bufferSize;
                this.bfsDirection[index] = 1;
                this.bfsCost[index] = nextCost;
            }

            index = CollisionMap.index(x, z + 1);
            if (z < sceneLength - 1 && this.bfsDirection[index] === 0 && (flags[index] & CollisionFlag.BLOCK_NORTH) === CollisionFlag.OPEN) {
                this.bfsStepX[steps] = x;
                this.bfsStepZ[steps] = z + 1;
                steps = (steps + 1) % bufferSize;
                this.bfsDirection[index] = 4;
                this.bfsCost[index] = nextCost;
            }

            index = CollisionMap.index(x - 1, z - 1);
            if (
                x > 0 &&
                z > 0 &&
                this.bfsDirection[index] === 0 &&
                (flags[index] & CollisionFlag.BLOCK_SOUTH_WEST) === 0 &&
                (flags[CollisionMap.index(x - 1, z)] & CollisionFlag.BLOCK_WEST) === CollisionFlag.OPEN &&
                (flags[CollisionMap.index(x, z - 1)] & CollisionFlag.BLOCK_SOUTH) === CollisionFlag.OPEN
            ) {
                this.bfsStepX[steps] = x - 1;
                this.bfsStepZ[steps] = z - 1;
                steps = (steps + 1) % bufferSize;
                this.bfsDirection[index] = 3;
                this.bfsCost[index] = nextCost;
            }

            index = CollisionMap.index(x + 1, z - 1);
            if (
                x < sceneWidth - 1 &&
                z > 0 &&
                this.bfsDirection[index] === 0 &&
                (flags[index] & CollisionFlag.BLOCK_SOUTH_EAST) === 0 &&
                (flags[CollisionMap.index(x + 1, z)] & CollisionFlag.BLOCK_EAST) === CollisionFlag.OPEN &&
                (flags[CollisionMap.index(x, z - 1)] & CollisionFlag.BLOCK_SOUTH) === CollisionFlag.OPEN
            ) {
                this.bfsStepX[steps] = x + 1;
                this.bfsStepZ[steps] = z - 1;
                steps = (steps + 1) % bufferSize;
                this.bfsDirection[index] = 9;
                this.bfsCost[index] = nextCost;
            }

            index = CollisionMap.index(x - 1, z + 1);
            if (
                x > 0 &&
                z < sceneLength - 1 &&
                this.bfsDirection[index] === 0 &&
                (flags[index] & CollisionFlag.BLOCK_NORTH_WEST) === 0 &&
                (flags[CollisionMap.index(x - 1, z)] & CollisionFlag.BLOCK_WEST) === CollisionFlag.OPEN &&
                (flags[CollisionMap.index(x, z + 1)] & CollisionFlag.BLOCK_NORTH) === CollisionFlag.OPEN
            ) {
                this.bfsStepX[steps] = x - 1;
                this.bfsStepZ[steps] = z + 1;
                steps = (steps + 1) % bufferSize;
                this.bfsDirection[index] = 6;
                this.bfsCost[index] = nextCost;
            }

            index = CollisionMap.index(x + 1, z + 1);
            if (
                x < sceneWidth - 1 &&
                z < sceneLength - 1 &&
                this.bfsDirection[index] === 0 &&
                (flags[index] & CollisionFlag.BLOCK_NORTH_EAST) === 0 &&
                (flags[CollisionMap.index(x + 1, z)] & CollisionFlag.BLOCK_EAST) === CollisionFlag.OPEN &&
                (flags[CollisionMap.index(x, z + 1)] & CollisionFlag.BLOCK_NORTH) === CollisionFlag.OPEN
            ) {
                this.bfsStepX[steps] = x + 1;
                this.bfsStepZ[steps] = z + 1;
                steps = (steps + 1) % bufferSize;
                this.bfsDirection[index] = 12;
                this.bfsCost[index] = nextCost;
            }
        }

        this.tryMoveNearest = 0;

        if (!arrived) {
            if (tryNearest) {
                let min: number = 100;
                for (let padding: number = 1; padding < 2; padding++) {
                    for (let px: number = dx - padding; px <= dx + padding; px++) {
                        for (let pz: number = dz - padding; pz <= dz + padding; pz++) {
                            const index: number = CollisionMap.index(px, pz);
                            if (px >= 0 && pz >= 0 && px < CollisionMap.SIZE && pz < CollisionMap.SIZE && this.bfsCost[index] < min) {
                                min = this.bfsCost[index];
                                x = px;
                                z = pz;
                                this.tryMoveNearest = 1;
                                arrived = true;
                            }
                        }
                    }

                    if (arrived) {
                        break;
                    }
                }
            }

            if (!arrived) {
                return false;
            }
        }

        length = 0;
        this.bfsStepX[length] = x;
        this.bfsStepZ[length++] = z;

        let dir: number = this.bfsDirection[CollisionMap.index(x, z)];
        let next: number = dir;
        while (x !== srcX || z !== srcZ) {
            if (next !== dir) {
                dir = next;
                this.bfsStepX[length] = x;
                this.bfsStepZ[length++] = z;
            }

            if ((next & DirectionFlag.EAST) !== 0) {
                x++;
            } else if ((next & DirectionFlag.WEST) !== 0) {
                x--;
            }

            if ((next & DirectionFlag.NORTH) !== 0) {
                z++;
            } else if ((next & DirectionFlag.SOUTH) !== 0) {
                z--;
            }

            next = this.bfsDirection[CollisionMap.index(x, z)];
        }

        if (length > 0) {
            bufferSize = Math.min(length, 25); // max number of turns in a single pf request
            length--;

            const startX: number = this.bfsStepX[length];
            const startZ: number = this.bfsStepZ[length];

            if (Client.showDebug && this.actionKey[6] === 1 && this.actionKey[7] === 1) {
                // check if tile is already added, if so remove it
                for (let i: number = 0; i < this.userTileMarkers.length; i++) {
                    const marker: Tile | null = this.userTileMarkers[i];
                    if (marker && marker.x === World3D.clickTileX && marker.z === World3D.clickTileZ) {
                        this.userTileMarkers[i] = null;
                        return false;
                    }
                }

                // add new
                this.userTileMarkers[this.userTileMarkerIndex] = new Tile(this.currentLevel, World3D.clickTileX, World3D.clickTileZ);
                this.userTileMarkerIndex = (this.userTileMarkerIndex + 1) & (this.userTileMarkers.length - 1);
                return false;
            }

            if (type === 0) {
                this.out.p1isaac(ClientProt.MOVE_GAMECLICK);
                this.out.p1(bufferSize + bufferSize + 3);
            } else if (type === 1) {
                this.out.p1isaac(ClientProt.MOVE_MINIMAPCLICK);
                this.out.p1(bufferSize + bufferSize + 3 + 14);
            } else if (type === 2) {
                this.out.p1isaac(ClientProt.MOVE_OPCLICK);
                this.out.p1(bufferSize + bufferSize + 3);
            }

            this.out.p2_alt3(startX + this.sceneBaseTileX);

            this.flagSceneTileX = this.bfsStepX[0];
            this.flagSceneTileZ = this.bfsStepZ[0];

            for (let i: number = 1; i < bufferSize; i++) {
                length--;
                this.out.p1(this.bfsStepX[length] - startX);
                this.out.p1(this.bfsStepZ[length] - startZ);
            }

            this.out.p2_alt1(startZ + this.sceneBaseTileZ);
            this.out.p1_alt1(this.actionKey[5] !== 1 ? 0 : 1);
            return true;
        }

        return type !== 1;
    };

    private readPlayerInfo = (buf: Packet, size: number): void => {
        this.entityRemovalCount = 0;
        this.entityUpdateCount = 0;

        this.readLocalPlayer(buf);
        this.readPlayers(buf);
        this.readNewPlayers(buf, size);
        this.readPlayerUpdates(buf);

        for (let i: number = 0; i < this.entityRemovalCount; i++) {
            const index: number = this.entityRemovalIds[i];
            const player: PlayerEntity | null = this.players[index];
            if (!player) {
                continue;
            }
            if (player.cycle !== Game.loopCycle) {
                this.players[index] = null;
            }
        }

        if (buf.pos !== size) {
            throw new Error(`eek! Error packet size mismatch in getplayer pos:${buf.pos} psize:${size}`);
        }
        for (let index: number = 0; index < this.playerCount; index++) {
            if (!this.players[this.playerIds[index]]) {
                throw new Error(`eek! ${this.username} null entry in pl list - pos:${index} size:${this.playerCount}`);
            }
        }

        this.awaitingSync = false;
    };

    private readLocalPlayer = (buf: Packet): void => {
        buf.bits();

        const hasUpdate: number = buf.gBit(1);
        if (hasUpdate !== 0) {
            const updateType: number = buf.gBit(2);

            if (updateType === 0) {
                this.entityUpdateIds[this.entityUpdateCount++] = this.LOCAL_PLAYER_INDEX;
            } else if (updateType === 1) {
                const walkDir: number = buf.gBit(3);
                this.localPlayer?.step(false, walkDir);

                const hasMaskUpdate: number = buf.gBit(1);
                if (hasMaskUpdate === 1) {
                    this.entityUpdateIds[this.entityUpdateCount++] = this.LOCAL_PLAYER_INDEX;
                }
            } else if (updateType === 2) {
                const walkDir: number = buf.gBit(3);
                this.localPlayer?.step(true, walkDir);
                const runDir: number = buf.gBit(3);
                this.localPlayer?.step(true, runDir);

                const hasMaskUpdate: number = buf.gBit(1);
                if (hasMaskUpdate === 1) {
                    this.entityUpdateIds[this.entityUpdateCount++] = this.LOCAL_PLAYER_INDEX;
                }
            } else if (updateType === 3) {
                this.currentLevel = buf.gBit(2);
                const jump: number = buf.gBit(1);

                const hasMaskUpdate: number = buf.gBit(1);
                if (hasMaskUpdate === 1) {
                    this.entityUpdateIds[this.entityUpdateCount++] = this.LOCAL_PLAYER_INDEX;
                }

                const localZ: number = buf.gBit(7);
                const localX: number = buf.gBit(7);
                this.localPlayer?.move(jump === 1, localX, localZ);
            }
        }
    };

    private readPlayers = (buf: Packet): void => {
        const count: number = buf.gBit(8);

        if (count < this.playerCount) {
            for (let i: number = count; i < this.playerCount; i++) {
                this.entityRemovalIds[this.entityRemovalCount++] = this.playerIds[i];
            }
        }

        if (count > this.playerCount) {
            throw new Error(`eek! ${this.username} Too many players`);
        }

        this.playerCount = 0;
        for (let i: number = 0; i < count; i++) {
            const index: number = this.playerIds[i];
            const player: PlayerEntity | null = this.players[index];

            const hasUpdate: number = buf.gBit(1);
            if (hasUpdate === 0) {
                this.playerIds[this.playerCount++] = index;
                if (player) {
                    player.cycle = Game.loopCycle;
                }
            } else {
                const updateType: number = buf.gBit(2);

                if (updateType === 0) {
                    this.playerIds[this.playerCount++] = index;
                    if (player) {
                        player.cycle = Game.loopCycle;
                    }
                    this.entityUpdateIds[this.entityUpdateCount++] = index;
                } else if (updateType === 1) {
                    this.playerIds[this.playerCount++] = index;
                    if (player) {
                        player.cycle = Game.loopCycle;
                    }

                    const walkDir: number = buf.gBit(3);
                    player?.step(false, walkDir);

                    const hasMaskUpdate: number = buf.gBit(1);
                    if (hasMaskUpdate === 1) {
                        this.entityUpdateIds[this.entityUpdateCount++] = index;
                    }
                } else if (updateType === 2) {
                    this.playerIds[this.playerCount++] = index;
                    if (player) {
                        player.cycle = Game.loopCycle;
                    }

                    const walkDir: number = buf.gBit(3);
                    player?.step(true, walkDir);
                    const runDir: number = buf.gBit(3);
                    player?.step(true, runDir);

                    const hasMaskUpdate: number = buf.gBit(1);
                    if (hasMaskUpdate === 1) {
                        this.entityUpdateIds[this.entityUpdateCount++] = index;
                    }
                } else if (updateType === 3) {
                    this.entityRemovalIds[this.entityRemovalCount++] = index;
                }
            }
        }
    };

    private readNewPlayers = (buf: Packet, size: number): void => {
        let index: number;
        while (buf.bitPos + 10 < size * 8) {
            index = buf.gBit(11);
            if (index === 2047) {
                break;
            }

            if (!this.players[index]) {
                this.players[index] = new PlayerEntity();
                const appearance: Packet | null = this.playerAppearanceBuffer[index];
                if (appearance) {
                    this.players[index]?.read(appearance);
                }
            }

            this.playerIds[this.playerCount++] = index;
            const player: PlayerEntity | null = this.players[index];
            if (player) {
                player.cycle = Game.loopCycle;
            }
            const hasMaskUpdate: number = buf.gBit(1);
            if (hasMaskUpdate === 1) {
                this.entityUpdateIds[this.entityUpdateCount++] = index;
            }
            const jump: number = buf.gBit(1);
            let dz: number = buf.gBit(5);
            if (dz > 15) {
                dz -= 32;
            }
            let dx: number = buf.gBit(5);
            if (dx > 15) {
                dx -= 32;
            }
            if (this.localPlayer) {
                player?.move(jump === 1, this.localPlayer.pathTileX[0] + dx, this.localPlayer.pathTileZ[0] + dz);
            }
        }

        buf.bytes();
    };

    private readPlayerUpdates = (buf: Packet): void => {
        for (let i: number = 0; i < this.entityUpdateCount; i++) {
            const index: number = this.entityUpdateIds[i];
            const player: PlayerEntity | null = this.players[index];
            if (!player) {
                continue; // its fine cos buffer gets out of pos and throws error which is ok
            }
            let mask: number = buf.g1;
            if ((mask & PlayerEntity.BIG_UPDATE) !== 0) {
                mask += buf.g1 << 8;
            }
            this.readPlayerUpdatesBlocks(player, index, mask, buf);
        }
    };

    private readPlayerUpdatesBlocks = (player: PlayerEntity, index: number, mask: number, buf: Packet): void => {
        player.lastMask = mask;
        player.lastMaskCycle = Game.loopCycle;

        if ((mask & PlayerEntity.EXACT_MOVE) !== 0) {
            player.forceMoveStartSceneTileX = buf.g1_alt2;
            player.forceMoveStartSceneTileZ = buf.g1_alt2;
            player.forceMoveEndSceneTileX = buf.g1_alt2;
            player.forceMoveEndSceneTileZ = buf.g1_alt2;
            player.forceMoveEndCycle = buf.g2_alt3 + Game.loopCycle;
            player.forceMoveStartCycle = buf.g2_alt2 + Game.loopCycle;
            player.forceMoveFaceDirection = buf.g1_alt2;
            player.resetPath();
        }
        if ((mask & PlayerEntity.SPOTANIM) !== 0) {
            player.spotanimId = buf.g2_alt1;
            player.spotanimOffset = buf.g2;
            player.spotanimLastCycle = Game.loopCycle + buf.g2;
            player.spotanimFrame = 0;
            player.spotanimCycle = 0;
            if (player.spotanimLastCycle > Game.loopCycle) {
                player.spotanimFrame = -1;
            }
            if (player.spotanimId === 65535) {
                player.spotanimId = -1;
            }
        }
        if ((mask & PlayerEntity.ANIM) !== 0) {
            let seqId: number = buf.g2_alt1;
            if (seqId === 65535) {
                seqId = -1;
            }
            const delay: number = buf.g1_alt1;
            if (seqId === player.primarySeqId && seqId !== -1) {
                const style: number = SeqType.instances[seqId].replaystyle;
                if (style == 1) {
                    player.primarySeqFrame = 0;
                    player.primarySeqCycle = 0;
                    player.primarySeqDelay = delay;
                    player.primarySeqLoop = 0;
                }

                if (style == 2) {
                    player.primarySeqLoop = 0;
                }
            } else if (seqId === -1 || player.primarySeqId === -1 || SeqType.instances[seqId].priority >= SeqType.instances[player.primarySeqId].priority) {
                player.primarySeqId = seqId;
                player.primarySeqFrame = 0;
                player.primarySeqCycle = 0;
                player.primarySeqDelay = delay;
                player.primarySeqLoop = 0;
                player.seqPathLength = player.pathLength;
            }
        }
        if ((mask & PlayerEntity.SAY) !== 0) {
            player.chat = buf.gjstr;
            if (player.name) {
                if (player.chat.charAt(0) === '~') {
                    player.chat = player.chat.substring(1);
                    this.addMessage(2, player.chat, player.name);
                } else if (player === this.localPlayer) {
                    this.addMessage(2, player.chat, player.name);
                }
            }
            player.chatColor = 0;
            player.chatStyle = 0;
            player.chatTimer = 150;
        }
        if ((mask & PlayerEntity.CHAT) !== 0) {
            const colorEffect: number = buf.g2_alt1;
            const type: number = buf.g1;
            const length: number = buf.g1_alt1;
            const start: number = buf.pos;

            if (player.name && player.visible) {
                const username: bigint = JString.toBase37(player.name);
                let ignored: boolean = false;
                if (type <= 1) {
                    for (let i: number = 0; i < this.ignoreCount; i++) {
                        if (this.ignoreName37[i] === username) {
                            ignored = true;
                            break;
                        }
                    }
                }
                if (!ignored && this.overrideChat === 0) {
                    try {
                        this.chatBuffer.pos = 0;
                        this.in.gdata_alt1(length, 0, this.chatBuffer.data);
                        this.chatBuffer.pos = 0;
                        const uncompressed: string = WordPack.unpack(this.chatBuffer, length);
                        const filtered: string = WordFilter.filter(uncompressed);
                        player.chat = filtered;
                        player.chatColor = colorEffect >> 8;
                        player.chatStyle = colorEffect & 0xff;
                        player.chatTimer = 150;
                        if (type === 2 || type === 3) {
                            this.addMessage(1, filtered, '@cr2@' + player.name);
                        } else if (type === 1) {
                            this.addMessage(1, filtered, '@cr1@' + player.name);
                        } else {
                            this.addMessage(2, filtered, player.name);
                        }
                    } catch (e) {
                        // signlink.reporterror("cde2");
                    }
                }
            }
            buf.pos = start + length;
        }
        if ((mask & PlayerEntity.FACE_ENTITY) !== 0) {
            player.targetId = buf.g2_alt1;
            if (player.targetId === 65535) {
                player.targetId = -1;
            }
        }
        if ((mask & PlayerEntity.APPEARANCE) !== 0) {
            const length: number = buf.g1_alt1;
            const data: Uint8Array = new Uint8Array(length);
            const appearance: Packet = new Packet(data);
            buf.gdata(length, 0, data);
            this.playerAppearanceBuffer[index] = appearance;
            player.read(appearance);
        }
        if ((mask & PlayerEntity.FACE_COORD) !== 0) {
            player.targetTileX = buf.g2_alt3;
            player.targetTileZ = buf.g2_alt1;
            player.lastFaceX = player.targetTileX;
            player.lastFaceZ = player.targetTileZ;
        }
        if ((mask & PlayerEntity.DAMAGE0) !== 0) {
            const damage: number = buf.g1;
            const type: number = buf.g1_alt3;
            player.hit(type, damage);
            player.combatCycle = Game.loopCycle + 300;
            player.health = buf.g1_alt1;
            player.totalHealth = buf.g1;
        }
        if ((mask & PlayerEntity.DAMAGE1) !== 0) {
            const damage: number = buf.g1;
            const type: number = buf.g1_alt2;
            player.hit(type, damage);
            player.combatCycle = Game.loopCycle + 300;
            player.health = buf.g1;
            player.totalHealth = buf.g1_alt1;
        }
    };

    private readNpcInfo = (buf: Packet, size: number): void => {
        this.entityRemovalCount = 0;
        this.entityUpdateCount = 0;

        this.readNpcs(buf);
        this.readNewNpcs(buf, size);
        this.readNpcUpdates(buf);

        for (let i: number = 0; i < this.entityRemovalCount; i++) {
            const index: number = this.entityRemovalIds[i];
            const npc: NpcEntity | null = this.npcs[index];
            if (!npc) {
                continue;
            }
            if (npc.cycle !== Game.loopCycle) {
                npc.type = null;
                this.npcs[index] = null;
            }
        }

        if (buf.pos !== size) {
            throw new Error(`eek! ${this.username} size mismatch in getnpcpos - pos:${buf.pos} psize:${size}`);
        }

        for (let i: number = 0; i < this.npcCount; i++) {
            if (!this.npcs[this.npcIds[i]]) {
                throw new Error(`eek! ${this.username} null entry in npc list - pos:${i} size:${this.npcCount}`);
            }
        }
    };

    private readNpcs = (buf: Packet): void => {
        buf.bits();

        const count: number = buf.gBit(8);
        if (count < this.npcCount) {
            for (let i: number = count; i < this.npcCount; i++) {
                this.entityRemovalIds[this.entityRemovalCount++] = this.npcIds[i];
            }
        }

        if (count > this.npcCount) {
            throw new Error(`eek! ${this.username} Too many npcs`);
        }

        this.npcCount = 0;
        for (let i: number = 0; i < count; i++) {
            const index: number = this.npcIds[i];
            const npc: NpcEntity | null = this.npcs[index];

            const hasUpdate: number = buf.gBit(1);
            if (hasUpdate === 0) {
                this.npcIds[this.npcCount++] = index;
                if (npc) {
                    npc.cycle = Game.loopCycle;
                }
            } else {
                const updateType: number = buf.gBit(2);

                if (updateType === 0) {
                    this.npcIds[this.npcCount++] = index;
                    if (npc) {
                        npc.cycle = Game.loopCycle;
                    }
                    this.entityUpdateIds[this.entityUpdateCount++] = index;
                } else if (updateType === 1) {
                    this.npcIds[this.npcCount++] = index;
                    if (npc) {
                        npc.cycle = Game.loopCycle;
                    }

                    const walkDir: number = buf.gBit(3);
                    npc?.step(false, walkDir);

                    const hasMaskUpdate: number = buf.gBit(1);
                    if (hasMaskUpdate === 1) {
                        this.entityUpdateIds[this.entityUpdateCount++] = index;
                    }
                } else if (updateType === 2) {
                    this.npcIds[this.npcCount++] = index;
                    if (npc) {
                        npc.cycle = Game.loopCycle;
                    }

                    const walkDir: number = buf.gBit(3);
                    npc?.step(true, walkDir);
                    const runDir: number = buf.gBit(3);
                    npc?.step(true, runDir);

                    const hasMaskUpdate: number = buf.gBit(1);
                    if (hasMaskUpdate === 1) {
                        this.entityUpdateIds[this.entityUpdateCount++] = index;
                    }
                } else if (updateType === 3) {
                    this.entityRemovalIds[this.entityRemovalCount++] = index;
                }
            }
        }
    };

    private readNewNpcs = (buf: Packet, size: number): void => {
        while (buf.bitPos + 21 < size * 8) {
            const index: number = buf.gBit(14);
            if (index === 16383) {
                break;
            }
            if (!this.npcs[index]) {
                this.npcs[index] = new NpcEntity();
            }
            const npc: NpcEntity | null = this.npcs[index];
            this.npcIds[this.npcCount++] = index;
            let dx: number = buf.gBit(5);
            if (dx > 15) {
                dx -= 32;
            }
            let dz: number = buf.gBit(5);
            if (dz > 15) {
                dz -= 32;
            }

            const jump: number = buf.gBit(1);
            const type: NpcType = NpcType.get(buf.gBit(12));

            const update: number = buf.gBit(1);
            if (update === 1) {
                this.entityUpdateIds[this.entityUpdateCount++] = index;
            }

            if (npc) {
                npc.cycle = Game.loopCycle;
                npc.type = type;
                npc.size = npc.type.size;
                npc.turnSpeed = npc.type.turnSpeed;
                npc.seqWalkId = npc.type.walkanim;
                npc.seqTurnAroundId = npc.type.walkanim_b;
                npc.seqTurnLeftId = npc.type.walkanim_r;
                npc.seqTurnRightId = npc.type.walkanim_l;
                npc.seqStandId = npc.type.readyanim;
                if (this.localPlayer) {
                    npc.move(jump === 1, this.localPlayer.pathTileX[0] + dx, this.localPlayer.pathTileZ[0] + dz);
                }
            }
        }
    };

    private readNpcUpdates = (buf: Packet): void => {
        buf.bytes();

        for (let i: number = 0; i < this.entityUpdateCount; i++) {
            const id: number = this.entityUpdateIds[i];
            const npc: NpcEntity | null = this.npcs[id];
            if (!npc) {
                continue; // its fine cos buffer gets out of pos and throws error which is ok
            }
            const mask: number = buf.g1;

            if ((mask & NpcEntity.ANIM) === NpcEntity.ANIM) {
                let seqId: number = buf.g2_alt1;
                if (seqId === 65535) {
                    seqId = -1;
                }
                const delay: number = buf.g1;
                if (seqId === npc.primarySeqId && seqId != -1) {
                    const style: number = SeqType.instances[seqId].replaystyle;
                    if (style === 1) {
                        npc.primarySeqFrame = 0;
                        npc.primarySeqCycle = 0;
                        npc.primarySeqDelay = delay;
                        npc.primarySeqLoop = 0;
                    }

                    if (style === 2) {
                        npc.primarySeqLoop = 0;
                    }
                }
                if (seqId === -1 || npc.primarySeqId === -1 || SeqType.instances[seqId].priority >= SeqType.instances[npc.primarySeqId].priority) {
                    npc.primarySeqId = seqId;
                    npc.primarySeqFrame = 0;
                    npc.primarySeqCycle = 0;
                    npc.primarySeqDelay = delay;
                    npc.primarySeqLoop = 0;
                    npc.seqPathLength = npc.pathLength;
                }
            }
            if ((mask & NpcEntity.DAMAGE0) === NpcEntity.DAMAGE0) {
                const damage: number = buf.g1_alt3;
                const type: number = buf.g1_alt1;
                npc.hit(type, damage);
                npc.combatCycle = Game.loopCycle + 300;
                npc.health = buf.g1_alt3;
                npc.totalHealth = buf.g1;
            }
            if ((mask & NpcEntity.SPOTANIM) === NpcEntity.SPOTANIM) {
                npc.spotanimId = buf.g2;
                const info: number = buf.g4;
                npc.spotanimOffset = info >> 16;
                npc.spotanimLastCycle = Game.loopCycle + (info & 0xffff);
                npc.spotanimFrame = 0;
                npc.spotanimCycle = 0;
                if (npc.spotanimLastCycle > Game.loopCycle) {
                    npc.spotanimFrame = -1;
                }
                if (npc.spotanimId === 65535) {
                    npc.spotanimId = -1;
                }
            }
            if ((mask & NpcEntity.FACE_ENTITY) === NpcEntity.FACE_ENTITY) {
                npc.targetId = buf.g2;
                if (npc.targetId === 65535) {
                    npc.targetId = -1;
                }
            }
            if ((mask & NpcEntity.SAY) === NpcEntity.SAY) {
                npc.chat = buf.gjstr;
                npc.chatTimer = 100;
            }
            if ((mask & NpcEntity.DAMAGE1) === NpcEntity.DAMAGE1) {
                const damage: number = buf.g1_alt1;
                const type: number = buf.g1_alt2;
                npc.hit(type, damage);
                npc.combatCycle = Game.loopCycle + 300;
                npc.health = buf.g1_alt2;
                npc.totalHealth = buf.g1_alt1;
            }
            if ((mask & NpcEntity.CHANGE_TYPE) === NpcEntity.CHANGE_TYPE) {
                npc.type = NpcType.get(buf.g2_alt3);
                npc.size = npc.type.size;
                npc.turnSpeed = npc.type.turnSpeed;
                npc.seqWalkId = npc.type.walkanim;
                npc.seqTurnAroundId = npc.type.walkanim_b;
                npc.seqTurnLeftId = npc.type.walkanim_r;
                npc.seqTurnRightId = npc.type.walkanim_l;
                npc.seqStandId = npc.type.readyanim;
            }
            if ((mask & NpcEntity.FACE_COORD) === NpcEntity.FACE_COORD) {
                npc.targetTileX = buf.g2;
                npc.targetTileZ = buf.g2;
                npc.lastFaceX = npc.targetTileX;
                npc.lastFaceZ = npc.targetTileZ;
            }
        }
    };

    private updatePlayers = (): void => {
        for (let i: number = -1; i < this.playerCount; i++) {
            let index: number;
            if (i === -1) {
                index = this.LOCAL_PLAYER_INDEX;
            } else {
                index = this.playerIds[i];
            }

            const player: PlayerEntity | null = this.players[index];
            if (player) {
                this.updateEntity(player);
            }
        }
    };

    private updateEntity = (entity: PathingEntity): void => {
        if (entity.x < 128 || entity.z < 128 || entity.x >= 13184 || entity.z >= 13184) {
            entity.primarySeqId = -1;
            entity.spotanimId = -1;
            entity.forceMoveEndCycle = 0;
            entity.forceMoveStartCycle = 0;
            entity.x = entity.pathTileX[0] * 128 + entity.size * 64;
            entity.z = entity.pathTileZ[0] * 128 + entity.size * 64;
            entity.resetPath();
        }

        if (entity === this.localPlayer && (entity.x < 1536 || entity.z < 1536 || entity.x >= 11776 || entity.z >= 11776)) {
            entity.primarySeqId = -1;
            entity.spotanimId = -1;
            entity.forceMoveEndCycle = 0;
            entity.forceMoveStartCycle = 0;
            entity.x = entity.pathTileX[0] * 128 + entity.size * 64;
            entity.z = entity.pathTileZ[0] * 128 + entity.size * 64;
            entity.resetPath();
        }

        if (entity.forceMoveEndCycle > Game.loopCycle) {
            this.updateForceMovement(entity);
        } else if (entity.forceMoveStartCycle >= Game.loopCycle) {
            this.startForceMovement(entity);
        } else {
            this.updateMovement(entity);
        }

        this.updateFacingDirection(entity);
        this.updateSequences(entity);
    };

    private pushPlayers = (): void => {
        if (!this.localPlayer) {
            return;
        }

        if (this.localPlayer.x >> 7 === this.flagSceneTileX && this.localPlayer.z >> 7 === this.flagSceneTileZ) {
            this.flagSceneTileX = 0;
        }

        for (let i: number = -1; i < this.playerCount; i++) {
            let player: PlayerEntity | null;
            let id: number;
            if (i === -1) {
                player = this.localPlayer;
                id = this.LOCAL_PLAYER_INDEX << 14;
            } else {
                player = this.players[this.playerIds[i]];
                id = this.playerIds[i] << 14;
            }

            if (!player || !player.isVisible()) {
                continue;
            }

            player.lowMemory = ((Client.lowMemory && this.playerCount > 50) || this.playerCount > 200) && i !== -1 && player.secondarySeqId === player.seqStandId;
            const stx: number = player.x >> 7;
            const stz: number = player.z >> 7;

            if (stx < 0 || stx >= CollisionMap.SIZE || stz < 0 || stz >= CollisionMap.SIZE) {
                continue;
            }

            if (!player.locModel || Game.loopCycle < player.locStartCycle || Game.loopCycle >= player.locStopCycle) {
                if ((player.x & 0x7f) === 64 && (player.z & 0x7f) === 64) {
                    if (this.tileLastOccupiedCycle[stx][stz] === this.sceneCycle) {
                        continue;
                    }

                    this.tileLastOccupiedCycle[stx][stz] = this.sceneCycle;
                }

                player.y = this.getHeightmapY(this.currentLevel, player.x, player.z);
                this.scene?.addTemporary(this.currentLevel, player.x, player.y, player.z, null, player, id, player.yaw, 60, player.seqStretches);
            } else {
                player.lowMemory = false;
                player.y = this.getHeightmapY(this.currentLevel, player.x, player.z);
                this.scene?.addTemporary2(this.currentLevel, player.x, player.y, player.z, player.minTileX, player.minTileZ, player.maxTileX, player.maxTileZ, null, player, id, player.yaw);
            }
        }
    };
    private updateNpcs = (): void => {
        for (let i: number = 0; i < this.npcCount; i++) {
            const id: number = this.npcIds[i];
            const npc: NpcEntity | null = this.npcs[id];
            if (npc && npc.type) {
                this.updateEntity(npc);
            }
        }
    };

    private pushNpcs = (): void => {
        for (let i: number = 0; i < this.npcCount; i++) {
            const npc: NpcEntity | null = this.npcs[this.npcIds[i]];
            let bitset: number = ((this.npcIds[i] << 14) + 0x20000000) | 0;

            if (!npc || !npc.isVisible()) {
                continue;
            }

            const x: number = npc.x >> 7;
            const z: number = npc.z >> 7;

            if (x < 0 || x >= CollisionMap.SIZE || z < 0 || z >= CollisionMap.SIZE) {
                continue;
            }

            if (npc.size === 1 && (npc.x & 0x7f) === 64 && (npc.z & 0x7f) === 64) {
                if (this.tileLastOccupiedCycle[x][z] === this.sceneCycle) {
                    continue;
                }

                this.tileLastOccupiedCycle[x][z] = this.sceneCycle;
            }

            if (npc.type && !npc.type.interactable) {
                bitset += -0x80000000;
            }

            this.scene?.addTemporary(this.currentLevel, npc.x, this.getHeightmapY(this.currentLevel, npc.x, npc.z), npc.z, null, npc, bitset, npc.yaw, (npc.size - 1) * 64 + 60, npc.seqStretches);
        }
    };

    private pushProjectiles = (): void => {
        for (let proj: ProjectileEntity | null = this.projectiles.head() as ProjectileEntity | null; proj; proj = this.projectiles.next() as ProjectileEntity | null) {
            if (proj.level !== this.currentLevel || Game.loopCycle > proj.lastCycle) {
                proj.unlink();
            } else if (Game.loopCycle >= proj.startCycle) {
                if (proj.target > 0) {
                    const npc: NpcEntity | null = this.npcs[proj.target - 1];
                    if (npc) {
                        proj.updateVelocity(npc.x, this.getHeightmapY(proj.level, npc.x, npc.z) - proj.offsetY, npc.z, Game.loopCycle);
                    }
                }

                if (proj.target < 0) {
                    const index: number = -proj.target - 1;
                    let player: PlayerEntity | null;
                    if (index === this.localPid) {
                        player = this.localPlayer;
                    } else {
                        player = this.players[index];
                    }
                    if (player) {
                        proj.updateVelocity(player.x, this.getHeightmapY(proj.level, player.x, player.z) - proj.offsetY, player.z, Game.loopCycle);
                    }
                }

                proj.update(this.sceneDelta);
                this.scene?.addTemporary(this.currentLevel, proj.x | 0, proj.y | 0, proj.z | 0, null, proj, -1, proj.yaw, 60, false);
            }
        }
    };

    private pushSpotanims = (): void => {
        for (let entity: SpotAnimEntity | null = this.spotanims.head() as SpotAnimEntity | null; entity; entity = this.spotanims.next() as SpotAnimEntity | null) {
            if (entity.level !== this.currentLevel || entity.seqComplete) {
                entity.unlink();
            } else if (Game.loopCycle >= entity.startCycle) {
                entity.update(this.sceneDelta);
                if (entity.seqComplete) {
                    entity.unlink();
                } else {
                    this.scene?.addTemporary(entity.level, entity.x, entity.y, entity.z, null, entity, -1, 0, 60, false);
                }
            }
        }
    };

    private storeLoc = (loc: LocTemporary): void => {
        let bitset: number = 0;
        let otherId: number = -1;
        let otherShape: number = 0;
        let otherAngle: number = 0;
        if (this.scene) {
            if (loc.layer === LocLayer.WALL) {
                bitset = this.scene.getWallBitset(this.currentLevel, loc.x, loc.z);
            } else if (loc.layer === LocLayer.WALL_DECOR) {
                bitset = this.scene.getWallDecorationBitset(this.currentLevel, loc.z, loc.x);
            } else if (loc.layer === LocLayer.GROUND) {
                bitset = this.scene.getLocBitset(this.currentLevel, loc.x, loc.z);
            } else if (loc.layer === LocLayer.GROUND_DECOR) {
                bitset = this.scene.getGroundDecorationBitset(this.currentLevel, loc.x, loc.z);
            }
        }
        if (bitset !== 0 && this.scene) {
            const otherInfo: number = this.scene.getInfo(this.currentLevel, loc.x, loc.z, bitset);
            otherId = (bitset >> 14) & 0x7fff;
            otherShape = otherInfo & 0x1f;
            otherAngle = otherInfo >> 6;
        }
        loc = new LocTemporary(this.currentLevel, loc.layer, loc.x, loc.z, 0, LocAngle.WEST, LocShape.WALL_STRAIGHT.id, otherId, otherAngle, otherShape);
        this.temporaryLocs.addTail(loc);

        if (loc) {
            loc.lastLocIndex = loc.locIndex;
            loc.lastShape = loc.shape;
            loc.lastAngle = loc.angle;
        }
    };

    private pushLocs = (id: number, angle: number, shape: number, layer: number, x: number, z: number, plane: number, start?: number, end?: number): void => {
        let loc: LocTemporary | null = null;
        for (let other: LocTemporary = this.temporaryLocs.head() as LocTemporary; other; other = this.temporaryLocs.next() as LocTemporary) {
            if (other.plane != plane || other.x != x || other.z != z || other.layer != layer) {
                continue;
            }
            loc = other;
            break;
        }
        if (!loc) {
            loc = new LocTemporary(plane, layer, x, z, id, angle, shape, 0, 0, 0, start, end);
            this.storeLoc(loc);
            this.temporaryLocs.addTail(loc);
        }
    };

    private updateEntityChats = (): void => {
        for (let i: number = -1; i < this.playerCount; i++) {
            let index: number;
            if (i === -1) {
                index = this.LOCAL_PLAYER_INDEX;
            } else {
                index = this.playerIds[i];
            }

            const player: PlayerEntity | null = this.players[index];
            if (player && player.chatTimer > 0) {
                player.chatTimer--;

                if (player.chatTimer === 0) {
                    player.chat = null;
                }
            }
        }

        for (let i: number = 0; i < this.npcCount; i++) {
            const index: number = this.npcIds[i];
            const npc: NpcEntity | null = this.npcs[index];

            if (npc && npc.chatTimer > 0) {
                npc.chatTimer--;

                if (npc.chatTimer === 0) {
                    npc.chat = null;
                }
            }
        }
    };

    private updateTemporaryLocs = (): void => {
        if (this.sceneState === 2) {
            for (let loc: LocTemporary | null = this.temporaryLocs.head() as LocTemporary | null; loc; loc = this.temporaryLocs.next() as LocTemporary | null) {
                if (loc.duration > 0) {
                    loc.duration--;
                }
                // TODO: validate
                if (loc.duration === 0) {
                    // if ((loc.lastLocIndex < 0) || World3D.isLocReady(loc.lastLocIndex, loc.lastShape)) {
                    this.addLoc(loc.plane, loc.x, loc.z, loc.lastLocIndex, loc.lastAngle, loc.lastShape, loc.layer);
                    loc.unlink();
                    // }
                } else {
                    if (loc.delay > 0) {
                        loc.delay--;
                    }
                    if (loc.delay == 0 && loc.x >= 1 && loc.z >= 1 && loc.x <= 102 && loc.z <= 102) {
                        // if (loc.delay == 0 && loc.x >= 1 && loc.z >= 1 && loc.x <= 102 && loc.z <= 102 && (loc.locIndex < 0 || World3D.isLocReady(loc.locIndex, loc.shape))) {
                        this.addLoc(loc.plane, loc.x, loc.z, loc.locIndex, loc.angle, loc.shape, loc.layer);
                        loc.delay = -1;
                        if (loc.locIndex === loc.lastLocIndex && loc.lastLocIndex === -1) {
                            loc.unlink();
                        } else if (loc.locIndex === loc.lastLocIndex && loc.angle === loc.lastAngle && loc.shape === loc.lastAngle) {
                            loc.unlink();
                        }
                    }
                }
            }
        }
    };

    private updateForceMovement = (entity: PathingEntity): void => {
        const delta: number = entity.forceMoveEndCycle - Game.loopCycle;
        const dstX: number = entity.forceMoveStartSceneTileX * 128 + entity.size * 64;
        const dstZ: number = entity.forceMoveStartSceneTileZ * 128 + entity.size * 64;

        entity.x += ((dstX - entity.x) / delta) | 0;
        entity.z += ((dstZ - entity.z) / delta) | 0;

        entity.seqTrigger = 0;

        if (entity.forceMoveFaceDirection === 0) {
            entity.dstYaw = 1024;
        }

        if (entity.forceMoveFaceDirection === 1) {
            entity.dstYaw = 1536;
        }

        if (entity.forceMoveFaceDirection === 2) {
            entity.dstYaw = 0;
        }

        if (entity.forceMoveFaceDirection === 3) {
            entity.dstYaw = 512;
        }
    };

    private startForceMovement = (entity: PathingEntity): void => {
        if (entity.forceMoveStartCycle === Game.loopCycle || entity.primarySeqId === -1 || entity.primarySeqDelay !== 0 || entity.primarySeqCycle + 1 > SeqType.instances[entity.primarySeqId].delay![entity.primarySeqFrame]) {
            const duration: number = entity.forceMoveStartCycle - entity.forceMoveEndCycle;
            const delta: number = Game.loopCycle - entity.forceMoveEndCycle;
            const dx0: number = entity.forceMoveStartSceneTileX * 128 + entity.size * 64;
            const dz0: number = entity.forceMoveStartSceneTileZ * 128 + entity.size * 64;
            const dx1: number = entity.forceMoveEndSceneTileX * 128 + entity.size * 64;
            const dz1: number = entity.forceMoveEndSceneTileZ * 128 + entity.size * 64;
            entity.x = ((dx0 * (duration - delta) + dx1 * delta) / duration) | 0;
            entity.z = ((dz0 * (duration - delta) + dz1 * delta) / duration) | 0;
        }

        entity.seqTrigger = 0;

        if (entity.forceMoveFaceDirection === 0) {
            entity.dstYaw = 1024;
        }

        if (entity.forceMoveFaceDirection === 1) {
            entity.dstYaw = 1536;
        }

        if (entity.forceMoveFaceDirection === 2) {
            entity.dstYaw = 0;
        }

        if (entity.forceMoveFaceDirection === 3) {
            entity.dstYaw = 512;
        }

        entity.yaw = entity.dstYaw;
    };

    private updateFacingDirection = (e: PathingEntity): void => {
        if (e.turnSpeed === 0) {
            return;
        }

        if (e.targetId !== -1 && e.targetId < 32768) {
            const npc: NpcEntity | null = this.npcs[e.targetId];
            if (npc) {
                const dstX: number = e.x - npc.x;
                const dstZ: number = e.z - npc.z;

                if (dstX !== 0 || dstZ !== 0) {
                    e.dstYaw = ((Math.atan2(dstX, dstZ) * 325.949) | 0) & 0x7ff;
                }
            }
        }

        if (e.targetId >= 32768) {
            let index: number = e.targetId - 32768;
            if (index === this.localPid) {
                index = this.LOCAL_PLAYER_INDEX;
            }

            const player: PlayerEntity | null = this.players[index];
            if (player) {
                const dstX: number = e.x - player.x;
                const dstZ: number = e.z - player.z;

                if (dstX !== 0 || dstZ !== 0) {
                    e.dstYaw = ((Math.atan2(dstX, dstZ) * 325.949) | 0) & 0x7ff;
                }
            }
        }

        if ((e.targetTileX !== 0 || e.targetTileZ !== 0) && (e.pathLength === 0 || e.seqTrigger > 0)) {
            const dstX: number = e.x - (e.targetTileX - this.sceneBaseTileX - this.sceneBaseTileX) * 64;
            const dstZ: number = e.z - (e.targetTileZ - this.sceneBaseTileZ - this.sceneBaseTileZ) * 64;

            if (dstX !== 0 || dstZ !== 0) {
                e.dstYaw = ((Math.atan2(dstX, dstZ) * 325.949) | 0) & 0x7ff;
            }

            e.targetTileX = 0;
            e.targetTileZ = 0;
        }

        const remainingYaw: number = (e.dstYaw - e.yaw) & 0x7ff;

        if (remainingYaw !== 0) {
            if (remainingYaw < e.turnSpeed || remainingYaw > 2048 - e.turnSpeed) {
                e.yaw = e.dstYaw;
            } else if (remainingYaw > 1024) {
                e.yaw -= e.turnSpeed;
            } else {
                e.yaw += e.turnSpeed;
            }

            e.yaw &= 0x7ff;

            if (e.secondarySeqId === e.seqStandId && e.yaw !== e.dstYaw) {
                if (e.seqTurnId !== -1) {
                    e.secondarySeqId = e.seqTurnId;
                    return;
                }

                e.secondarySeqId = e.seqWalkId;
            }
        }
    };

    private updateSequences = (e: PathingEntity): void => {
        e.seqStretches = false;

        let seq: SeqType | null;
        if (e.secondarySeqId !== -1) {
            seq = SeqType.instances[e.secondarySeqId];
            e.secondarySeqCycle++;
            if (seq) {
                if (e.secondarySeqFrame < seq.frameCount && e.secondarySeqCycle > seq.getFrameDuration(e.secondarySeqFrame)) {
                    e.secondarySeqCycle = 0;
                    e.secondarySeqFrame++;
                }
                if (e.secondarySeqFrame >= seq.frameCount) {
                    e.secondarySeqCycle = 0;
                    e.secondarySeqFrame = 0;
                }
            }
        }

        if (e.spotanimId !== -1 && Game.loopCycle >= e.spotanimLastCycle) {
            if (e.spotanimFrame < 0) {
                e.spotanimFrame = 0;
            }

            seq = SpotAnimType.instances[e.spotanimId].seq;
            e.spotanimCycle++;
            while (seq && e.spotanimFrame < seq.frameCount && e.spotanimCycle > seq.getFrameDuration(e.spotanimFrame)) {
                e.spotanimCycle -= seq.getFrameDuration(e.spotanimFrame);
                e.spotanimFrame++;
            }

            if (seq && e.spotanimFrame >= seq.frameCount) {
                if (e.spotanimFrame < 0 || e.spotanimFrame >= seq.frameCount) {
                    e.spotanimId = -1;
                }
            }
        }

        if (e.primarySeqId !== -1 && e.primarySeqDelay <= 1) {
            const seq: SeqType = SeqType.instances[e.primarySeqId];

            if (seq.movestyle === 1 && e.seqPathLength > 0 && e.forceMoveEndCycle <= Game.loopCycle && e.forceMoveStartCycle < Game.loopCycle) {
                e.primarySeqDelay = 1;
                return;
            }
        }

        if (e.primarySeqId !== -1 && e.primarySeqDelay === 0) {
            seq = SeqType.instances[e.primarySeqId];
            e.primarySeqCycle++;
            while (e.primarySeqFrame < seq.frameCount && e.primarySeqCycle > seq.getFrameDuration(e.primarySeqFrame)) {
                e.primarySeqCycle -= seq.getFrameDuration(e.primarySeqFrame);
                e.primarySeqFrame++;
            }

            if (e.primarySeqFrame >= seq.frameCount) {
                e.primarySeqFrame -= seq.replayoff;
                e.primarySeqLoop++;
                if (e.primarySeqLoop >= seq.replaycount) {
                    e.primarySeqId = -1;
                }
                if (e.primarySeqFrame < 0 || e.primarySeqFrame >= seq.frameCount) {
                    e.primarySeqId = -1;
                }
            }

            e.seqStretches = seq.stretches;
        }

        if (e.primarySeqDelay > 0) {
            e.primarySeqDelay--;
        }
    };

    private updateMovement = (entity: PathingEntity): void => {
        entity.secondarySeqId = entity.seqStandId;

        if (entity.pathLength === 0) {
            entity.seqTrigger = 0;
            return;
        }

        if (entity.primarySeqId !== -1 && entity.primarySeqDelay === 0) {
            const seq: SeqType = SeqType.instances[entity.primarySeqId];

            if (entity.seqPathLength > 0 && seq.movestyle === 0) {
                entity.seqTrigger++;
                return;
            }

            if (entity.seqPathLength <= 0 && seq.idlestyle === 0) {
                entity.seqTrigger++;
                return;
            }
        }

        const x: number = entity.x;
        const z: number = entity.z;
        const dstX: number = entity.pathTileX[entity.pathLength - 1] * 128 + entity.size * 64;
        const dstZ: number = entity.pathTileZ[entity.pathLength - 1] * 128 + entity.size * 64;

        if (dstX - x > 256 && dstX - x < -256 && dstZ - z > 256 && dstZ - z < -256) {
            entity.x = dstX;
            entity.z = dstZ;
            return;
        }

        if (x < dstX) {
            if (z < dstZ) {
                entity.dstYaw = 1280;
            } else if (z > dstZ) {
                entity.dstYaw = 1792;
            } else {
                entity.dstYaw = 1536;
            }
        } else if (x > dstX) {
            if (z < dstZ) {
                entity.dstYaw = 768;
            } else if (z > dstZ) {
                entity.dstYaw = 256;
            } else {
                entity.dstYaw = 512;
            }
        } else if (z < dstZ) {
            entity.dstYaw = 1024;
        } else {
            entity.dstYaw = 0;
        }

        let deltaYaw: number = (entity.dstYaw - entity.yaw) & 0x7ff;
        if (deltaYaw > 1024) {
            deltaYaw -= 2048;
        }

        let seqId: number = entity.seqTurnAroundId;
        if (deltaYaw >= -256 && deltaYaw <= 256) {
            seqId = entity.seqWalkId;
        } else if (deltaYaw >= 256 && deltaYaw < 768) {
            seqId = entity.seqTurnRightId;
        } else if (deltaYaw >= -768 && deltaYaw <= -256) {
            seqId = entity.seqTurnLeftId;
        }

        if (seqId === -1) {
            seqId = entity.seqWalkId;
        }

        entity.secondarySeqId = seqId;
        let moveSpeed: number = 4;
        if (entity.yaw !== entity.dstYaw && entity.targetId === -1 && entity.turnSpeed !== 0) {
            moveSpeed = 2;
        }

        if (entity.pathLength > 2) {
            moveSpeed = 6;
        }

        if (entity.pathLength > 3) {
            moveSpeed = 8;
        }

        if (entity.seqTrigger > 0 && entity.pathLength > 1) {
            moveSpeed = 8;
            entity.seqTrigger--;
        }

        if (entity.pathRunning[entity.pathLength - 1]) {
            moveSpeed <<= 0x1;
        }

        if (moveSpeed >= 8 && entity.secondarySeqId === entity.seqWalkId && entity.seqRunId !== -1) {
            entity.secondarySeqId = entity.seqRunId;
        }

        if (x < dstX) {
            entity.x += moveSpeed;
            if (entity.x > dstX) {
                entity.x = dstX;
            }
        } else if (x > dstX) {
            entity.x -= moveSpeed;
            if (entity.x < dstX) {
                entity.x = dstX;
            }
        }
        if (z < dstZ) {
            entity.z += moveSpeed;
            if (entity.z > dstZ) {
                entity.z = dstZ;
            }
        } else if (z > dstZ) {
            entity.z -= moveSpeed;
            if (entity.z < dstZ) {
                entity.z = dstZ;
            }
        }

        if (entity.x === dstX && entity.z === dstZ) {
            entity.pathLength--;
            if (entity.seqPathLength > 0) {
                entity.seqPathLength--;
            }
        }
    };

    private getTopLevel = (): number => {
        let top: number = 3;
        if (this.cameraPitch < 310 && this.localPlayer) {
            let cameraLocalTileX: number = this.cameraX >> 7;
            let cameraLocalTileZ: number = this.cameraZ >> 7;
            const playerLocalTileX: number = this.localPlayer.x >> 7;
            const playerLocalTileZ: number = this.localPlayer.z >> 7;
            if (this.levelTileFlags && (this.levelTileFlags[this.currentLevel][cameraLocalTileX][cameraLocalTileZ] & 0x4) !== 0) {
                top = this.currentLevel;
            }
            let tileDeltaX: number;
            if (playerLocalTileX > cameraLocalTileX) {
                tileDeltaX = playerLocalTileX - cameraLocalTileX;
            } else {
                tileDeltaX = cameraLocalTileX - playerLocalTileX;
            }
            let tileDeltaZ: number;
            if (playerLocalTileZ > cameraLocalTileZ) {
                tileDeltaZ = playerLocalTileZ - cameraLocalTileZ;
            } else {
                tileDeltaZ = cameraLocalTileZ - playerLocalTileZ;
            }
            let delta: number;
            let accumulator: number;
            if (tileDeltaX > tileDeltaZ) {
                delta = ((tileDeltaZ * 65536) / tileDeltaX) | 0;
                accumulator = 32768;
                while (cameraLocalTileX !== playerLocalTileX) {
                    if (cameraLocalTileX < playerLocalTileX) {
                        cameraLocalTileX++;
                    } else if (cameraLocalTileX > playerLocalTileX) {
                        cameraLocalTileX--;
                    }
                    if (this.levelTileFlags && (this.levelTileFlags[this.currentLevel][cameraLocalTileX][cameraLocalTileZ] & 0x4) !== 0) {
                        top = this.currentLevel;
                    }
                    accumulator += delta;
                    if (accumulator >= 65536) {
                        accumulator -= 65536;
                        if (cameraLocalTileZ < playerLocalTileZ) {
                            cameraLocalTileZ++;
                        } else if (cameraLocalTileZ > playerLocalTileZ) {
                            cameraLocalTileZ--;
                        }
                        if (this.levelTileFlags && (this.levelTileFlags[this.currentLevel][cameraLocalTileX][cameraLocalTileZ] & 0x4) !== 0) {
                            top = this.currentLevel;
                        }
                    }
                }
            } else {
                delta = ((tileDeltaX * 65536) / tileDeltaZ) | 0;
                accumulator = 32768;
                while (cameraLocalTileZ !== playerLocalTileZ) {
                    if (cameraLocalTileZ < playerLocalTileZ) {
                        cameraLocalTileZ++;
                    } else if (cameraLocalTileZ > playerLocalTileZ) {
                        cameraLocalTileZ--;
                    }
                    if (this.levelTileFlags && (this.levelTileFlags[this.currentLevel][cameraLocalTileX][cameraLocalTileZ] & 0x4) !== 0) {
                        top = this.currentLevel;
                    }
                    accumulator += delta;
                    if (accumulator >= 65536) {
                        accumulator -= 65536;
                        if (cameraLocalTileX < playerLocalTileX) {
                            cameraLocalTileX++;
                        } else if (cameraLocalTileX > playerLocalTileX) {
                            cameraLocalTileX--;
                        }
                        if (this.levelTileFlags && (this.levelTileFlags[this.currentLevel][cameraLocalTileX][cameraLocalTileZ] & 0x4) !== 0) {
                            top = this.currentLevel;
                        }
                    }
                }
            }
        }
        if (this.localPlayer && this.levelTileFlags && (this.levelTileFlags[this.currentLevel][this.localPlayer.x >> 7][this.localPlayer.z >> 7] & 0x4) !== 0) {
            top = this.currentLevel;
        }
        return top;
    };

    private getTopLevelCutscene = (): number => {
        if (!this.levelTileFlags) {
            return 0; // custom
        }
        const y: number = this.getHeightmapY(this.currentLevel, this.cameraX, this.cameraZ);
        return y - this.cameraY >= 800 || (this.levelTileFlags[this.currentLevel][this.cameraX >> 7][this.cameraZ >> 7] & 0x4) === 0 ? 3 : this.currentLevel;
    };

    private getHeightmapY = (level: number, sceneX: number, sceneZ: number): number => {
        if (!this.levelHeightmap) {
            return 0; // custom
        }
        const tileX: number = Math.min(sceneX >> 7, CollisionMap.SIZE - 1);
        const tileZ: number = Math.min(sceneZ >> 7, CollisionMap.SIZE - 1);
        let realLevel: number = level;
        if (level < 3 && this.levelTileFlags && (this.levelTileFlags[1][tileX][tileZ] & 0x2) === 2) {
            realLevel = level + 1;
        }

        const tileLocalX: number = sceneX & 0x7f;
        const tileLocalZ: number = sceneZ & 0x7f;
        const y00: number = (this.levelHeightmap[realLevel][tileX][tileZ] * (128 - tileLocalX) + this.levelHeightmap[realLevel][tileX + 1][tileZ] * tileLocalX) >> 7;
        const y11: number = (this.levelHeightmap[realLevel][tileX][tileZ + 1] * (128 - tileLocalX) + this.levelHeightmap[realLevel][tileX + 1][tileZ + 1] * tileLocalX) >> 7;
        return (y00 * (128 - tileLocalZ) + y11 * tileLocalZ) >> 7;
    };

    private orbitCamera = (targetX: number, targetY: number, targetZ: number, yaw: number, pitch: number, distance: number): void => {
        const invPitch: number = (2048 - pitch) & 0x7ff;
        const invYaw: number = (2048 - yaw) & 0x7ff;
        let x: number = 0;
        let z: number = 0;
        let y: number = distance;
        let sin: number;
        let cos: number;
        let tmp: number;

        if (invPitch !== 0) {
            sin = Draw3D.sin[invPitch];
            cos = Draw3D.cos[invPitch];
            tmp = (z * cos - distance * sin) >> 16;
            y = (z * sin + distance * cos) >> 16;
            z = tmp;
        }

        if (invYaw !== 0) {
            sin = Draw3D.sin[invYaw];
            cos = Draw3D.cos[invYaw];
            tmp = (y * sin + x * cos) >> 16;
            y = (y * cos - x * sin) >> 16;
            x = tmp;
        }

        this.cameraX = targetX - x;
        this.cameraY = targetY - z;
        this.cameraZ = targetZ - y;
        this.cameraPitch = pitch;
        this.cameraYaw = yaw;
    };

    private updateOrbitCamera = (): void => {
        if (!this.localPlayer) {
            return; // custom
        }
        const orbitX: number = this.localPlayer.x + this.cameraAnticheatOffsetX;
        const orbitZ: number = this.localPlayer.z + this.cameraAnticheatOffsetZ;
        if (this.orbitCameraX - orbitX < -500 || this.orbitCameraX - orbitX > 500 || this.orbitCameraZ - orbitZ < -500 || this.orbitCameraZ - orbitZ > 500) {
            this.orbitCameraX = orbitX;
            this.orbitCameraZ = orbitZ;
        }
        if (this.orbitCameraX !== orbitX) {
            this.orbitCameraX += ((orbitX - this.orbitCameraX) / 16) | 0;
        }
        if (this.orbitCameraZ !== orbitZ) {
            this.orbitCameraZ += ((orbitZ - this.orbitCameraZ) / 16) | 0;
        }
        if (this.actionKey[1] === 1) {
            this.orbitCameraYawVelocity += ((-this.orbitCameraYawVelocity - 24) / 2) | 0;
        } else if (this.actionKey[2] === 1) {
            this.orbitCameraYawVelocity += ((24 - this.orbitCameraYawVelocity) / 2) | 0;
        } else {
            this.orbitCameraYawVelocity = (this.orbitCameraYawVelocity / 2) | 0;
        }
        if (this.actionKey[3] === 1) {
            this.orbitCameraPitchVelocity += ((12 - this.orbitCameraPitchVelocity) / 2) | 0;
        } else if (this.actionKey[4] === 1) {
            this.orbitCameraPitchVelocity += ((-this.orbitCameraPitchVelocity - 12) / 2) | 0;
        } else {
            this.orbitCameraPitchVelocity = (this.orbitCameraPitchVelocity / 2) | 0;
        }
        this.orbitCameraYaw = ((this.orbitCameraYaw + this.orbitCameraYawVelocity / 2) | 0) & 0x7ff;
        this.orbitCameraPitch += (this.orbitCameraPitchVelocity / 2) | 0;
        if (this.orbitCameraPitch < 128) {
            this.orbitCameraPitch = 128;
        }
        if (this.orbitCameraPitch > 383) {
            this.orbitCameraPitch = 383;
        }

        const orbitTileX: number = this.orbitCameraX >> 7;
        const orbitTileZ: number = this.orbitCameraZ >> 7;
        const orbitY: number = this.getHeightmapY(this.currentLevel, this.orbitCameraX, this.orbitCameraZ);
        let maxY: number = 0;

        if (this.levelHeightmap) {
            if (orbitTileX > 3 && orbitTileZ > 3 && orbitTileX < 100 && orbitTileZ < 100) {
                for (let x: number = orbitTileX - 4; x <= orbitTileX + 4; x++) {
                    for (let z: number = orbitTileZ - 4; z <= orbitTileZ + 4; z++) {
                        let level: number = this.currentLevel;
                        if (level < 3 && this.levelTileFlags && (this.levelTileFlags[1][x][z] & 0x2) === 2) {
                            level++;
                        }

                        const y: number = orbitY - this.levelHeightmap[level][x][z];
                        if (y > maxY) {
                            maxY = y;
                        }
                    }
                }
            }
        }

        let clamp: number = maxY * 192;
        if (clamp > 98048) {
            clamp = 98048;
        }

        if (clamp < 32768) {
            clamp = 32768;
        }

        if (clamp > this.cameraPitchClamp) {
            this.cameraPitchClamp += ((clamp - this.cameraPitchClamp) / 24) | 0;
        } else if (clamp < this.cameraPitchClamp) {
            this.cameraPitchClamp += ((clamp - this.cameraPitchClamp) / 80) | 0;
        }
    };

    private applyCutscene = (): void => {
        let x: number = this.cutsceneSrcLocalTileX * 128 + 64;
        let z: number = this.cutsceneSrcLocalTileZ * 128 + 64;
        let y: number = this.getHeightmapY(this.currentLevel, this.cutsceneSrcLocalTileX, this.cutsceneSrcLocalTileZ) - this.cutsceneSrcHeight;

        if (this.cameraX < x) {
            this.cameraX += this.cutsceneMoveSpeed + ((((x - this.cameraX) * this.cutsceneMoveAcceleration) / 1000) | 0);
            if (this.cameraX > x) {
                this.cameraX = x;
            }
        }

        if (this.cameraX > x) {
            this.cameraX -= this.cutsceneMoveSpeed + ((((this.cameraX - x) * this.cutsceneMoveAcceleration) / 1000) | 0);
            if (this.cameraX < x) {
                this.cameraX = x;
            }
        }

        if (this.cameraY < y) {
            this.cameraY += this.cutsceneMoveSpeed + ((((y - this.cameraY) * this.cutsceneMoveAcceleration) / 1000) | 0);
            if (this.cameraY > y) {
                this.cameraY = y;
            }
        }

        if (this.cameraY > y) {
            this.cameraY -= this.cutsceneMoveSpeed + ((((this.cameraY - y) * this.cutsceneMoveAcceleration) / 1000) | 0);
            if (this.cameraY < y) {
                this.cameraY = y;
            }
        }

        if (this.cameraZ < z) {
            this.cameraZ += this.cutsceneMoveSpeed + ((((z - this.cameraZ) * this.cutsceneMoveAcceleration) / 1000) | 0);
            if (this.cameraZ > z) {
                this.cameraZ = z;
            }
        }

        if (this.cameraZ > z) {
            this.cameraZ -= this.cutsceneMoveSpeed + ((((this.cameraZ - z) * this.cutsceneMoveAcceleration) / 1000) | 0);
            if (this.cameraZ < z) {
                this.cameraZ = z;
            }
        }

        x = this.cutsceneDstLocalTileX * 128 + 64;
        z = this.cutsceneDstLocalTileZ * 128 + 64;
        y = this.getHeightmapY(this.currentLevel, this.cutsceneDstLocalTileX, this.cutsceneDstLocalTileZ) - this.cutsceneDstHeight;

        const deltaX: number = x - this.cameraX;
        const deltaY: number = y - this.cameraY;
        const deltaZ: number = z - this.cameraZ;

        const distance: number = Math.sqrt(deltaX * deltaX + deltaZ * deltaZ) | 0;
        let pitch: number = ((Math.atan2(deltaY, distance) * 325.949) | 0) & 0x7ff;
        const yaw: number = ((Math.atan2(deltaX, deltaZ) * -325.949) | 0) & 0x7ff;

        if (pitch < 128) {
            pitch = 128;
        }

        if (pitch > 383) {
            pitch = 383;
        }

        if (this.cameraPitch < pitch) {
            this.cameraPitch += this.cutsceneRotateSpeed + ((((pitch - this.cameraPitch) * this.cutsceneRotateAcceleration) / 1000) | 0);
            if (this.cameraPitch > pitch) {
                this.cameraPitch = pitch;
            }
        }

        if (this.cameraPitch > pitch) {
            this.cameraPitch -= this.cutsceneRotateSpeed + ((((this.cameraPitch - pitch) * this.cutsceneRotateAcceleration) / 1000) | 0);
            if (this.cameraPitch < pitch) {
                this.cameraPitch = pitch;
            }
        }

        let deltaYaw: number = yaw - this.cameraYaw;
        if (deltaYaw > 1024) {
            deltaYaw -= 2048;
        }

        if (deltaYaw < -1024) {
            deltaYaw += 2048;
        }

        if (deltaYaw > 0) {
            this.cameraYaw += this.cutsceneRotateSpeed + (((deltaYaw * this.cutsceneRotateAcceleration) / 1000) | 0);
            this.cameraYaw &= 0x7ff;
        }

        if (deltaYaw < 0) {
            this.cameraYaw -= this.cutsceneRotateSpeed + (((-deltaYaw * this.cutsceneRotateAcceleration) / 1000) | 0);
            this.cameraYaw &= 0x7ff;
        }

        let tmp: number = yaw - this.cameraYaw;
        if (tmp > 1024) {
            tmp -= 2048;
        }

        if (tmp < -1024) {
            tmp += 2048;
        }

        if ((tmp < 0 && deltaYaw > 0) || (tmp > 0 && deltaYaw < 0)) {
            this.cameraYaw = yaw;
        }
    };

    private readZonePacket = (buf: Packet, opcode: number): void => {
        if (opcode === ServerProt.LOC_ADD) {
            // LOC_ADD
            const pos: number = buf.g1_alt3;
            const x: number = this.baseX + ((pos >> 4) & 0x7);
            const z: number = this.baseZ + (pos & 0x7);
            const id: number = buf.g2_alt1;
            const info: number = buf.g1_alt2;
            const shape: number = info >> 2;
            const angle: number = info & 0x3;
            const layer: number = LocShape.of(shape).layer;
            if (x >= 0 && z >= 0 && x < CollisionMap.SIZE && z < CollisionMap.SIZE) {
                this.pushLocs(id, angle, shape, layer, x, z, this.currentLevel);
            }
        } else if (opcode === ServerProt.LOC_CHANGE) {
            // LOC_CHANGE
            const pos: number = buf.g1_alt2;
            const x: number = this.baseX + ((pos >> 4) & 0x7);
            const z: number = this.baseZ + (pos & 0x7);
            const info: number = buf.g1_alt2;
            let shape: number = info >> 2;
            const angle: number = info & 0x3;
            const layer: number = LocShape.of(shape).layer;
            const id: number = buf.g2_alt2;

            if (x < 0 && z < 0 && x >= CollisionMap.SIZE - 1 && z >= CollisionMap.SIZE - 1) {
                return;
            }

            if (this.scene && this.levelHeightmap) {
                const heightSW: number = this.levelHeightmap[this.currentLevel][x][z];
                const heightSE: number = this.levelHeightmap[this.currentLevel][x + 1][z];
                const heightNW: number = this.levelHeightmap[this.currentLevel][x + 1][z + 1];
                const heightNE: number = this.levelHeightmap[this.currentLevel][x][z + 1];

                if (layer === LocLayer.WALL) {
                    const wall: Wall | null = this.scene.getWall(this.currentLevel, x, z);

                    if (wall) {
                        const locID: number = (wall.bitset >> 14) & 0x7fff;

                        if (shape == 2) {
                            wall.entityA = new LocEntity(locID, 4 + angle, 2, heightSE, heightNE, heightSW, heightNW, id, false);
                            wall.entityB = new LocEntity(locID, (angle + 1) & 3, 2, heightSE, heightNE, heightSW, heightNW, id, false);
                        } else {
                            wall.entityA = new LocEntity(locID, angle, shape, heightSE, heightNE, heightSW, heightNW, id, false);
                        }
                    }
                } else if (layer === LocLayer.WALL_DECOR) {
                    const deco: WallDecoration | null = this.scene.getWallDecoration(this.currentLevel, x, z);

                    if (deco) {
                        deco.entity = new LocEntity((deco.bitset >> 14) & 0x7fff, 0, 4, heightSE, heightNE, heightSW, heightNW, id, false);
                    }
                } else if (layer === LocLayer.GROUND) {
                    const loc: Loc | null = this.scene.getLoc(this.currentLevel, x, z);

                    if (shape == 11) {
                        shape = 10;
                    }

                    if (loc) {
                        loc.entity = new LocEntity((loc.bitset >> 14) & 0x7fff, angle, shape, heightSE, heightNE, heightSW, heightNW, id, false);
                    }
                } else if (layer === LocLayer.GROUND_DECOR) {
                    const deco: GroundDecoration | null = this.scene.getGroundDecoration(z, x, this.currentLevel);

                    if (deco) {
                        deco.entity = new LocEntity((deco.bitset >> 14) & 0x7fff, angle, 22, heightSE, heightNE, heightSW, heightNW, id, false);
                    }
                }
            }
        } else if (opcode === ServerProt.LOC_DEL) {
            // LOC_DEL
            const info: number = buf.g1_alt1;
            const shape: number = info >> 2;
            const angle: number = info & 0x3;
            const layer: number = LocShape.of(shape).layer;
            const pos: number = buf.g1;
            const x: number = this.baseX + ((pos >> 4) & 0x7);
            const z: number = this.baseZ + (pos & 0x7);

            if (x >= 0 && z >= 0 && x < CollisionMap.SIZE && z < CollisionMap.SIZE) {
                this.pushLocs(-1, angle, shape, layer, x, z, this.currentLevel);
            }
        } else if (opcode === ServerProt.OBJ_ADD) {
            // OBJ_ADD
            const id: number = buf.g2_alt3;
            const count: number = buf.g2;
            const pos: number = buf.g1;
            const x: number = this.baseX + ((pos >> 4) & 0x7);
            const z: number = this.baseZ + (pos & 0x7);
            if (x >= 0 && z >= 0 && x < CollisionMap.SIZE && z < CollisionMap.SIZE) {
                const obj: ObjStackEntity = new ObjStackEntity(id, count);
                if (!this.levelObjStacks[this.currentLevel][x][z]) {
                    this.levelObjStacks[this.currentLevel][x][z] = new LinkList();
                }
                this.levelObjStacks[this.currentLevel][x][z]?.addTail(obj);
                this.sortObjStacks(x, z);
            }
        } else if (opcode === ServerProt.OBJ_DEL) {
            // OBJ_DEL
            const pos: number = buf.g1_alt3;
            const x: number = this.baseX + ((pos >> 4) & 0x7);
            const z: number = this.baseZ + (pos & 0x7);
            const id: number = buf.g2;
            if (x >= 0 && z >= 0 && x < CollisionMap.SIZE && z < CollisionMap.SIZE) {
                const list: LinkList | null = this.levelObjStacks[this.currentLevel][x][z];
                if (list) {
                    for (let next: ObjStackEntity | null = list.head() as ObjStackEntity | null; next; next = list.next() as ObjStackEntity | null) {
                        if (next.index === (id & 0x7fff)) {
                            next.unlink();
                            break;
                        }
                    }
                    if (!list.head()) {
                        this.levelObjStacks[this.currentLevel][x][z] = null;
                    }
                    this.sortObjStacks(x, z);
                }
            }
        } else if (opcode === ServerProt.MAP_PROJANIM) {
            // MAP_PROJANIM
            const pos: number = buf.g1;
            let x: number = this.baseX + ((pos >> 4) & 0x7);
            let z: number = this.baseZ + (pos & 0x7);
            let dx: number = x + buf.g1b;
            let dz: number = z + buf.g1b;
            const target: number = buf.g2b;
            const spotanim: number = buf.g2;
            const srcHeight: number = buf.g1 * 4;
            const dstHeight: number = buf.g1 * 4;
            const startDelay: number = buf.g2;
            const endDelay: number = buf.g2;
            const peak: number = buf.g1;
            const arc: number = buf.g1;
            if (x >= 0 && z >= 0 && x < CollisionMap.SIZE && z < CollisionMap.SIZE && dx >= 0 && dz >= 0 && dx < CollisionMap.SIZE && dz < CollisionMap.SIZE) {
                x = x * 128 + 64;
                z = z * 128 + 64;
                dx = dx * 128 + 64;
                dz = dz * 128 + 64;
                const proj: ProjectileEntity = new ProjectileEntity(spotanim, this.currentLevel, x, this.getHeightmapY(this.currentLevel, x, z) - srcHeight, z, startDelay + Game.loopCycle, endDelay + Game.loopCycle, peak, arc, target, dstHeight);
                proj.updateVelocity(dx, this.getHeightmapY(this.currentLevel, dx, dz) - dstHeight, dz, startDelay + Game.loopCycle);
                this.projectiles.addTail(proj);
            }
        } else if (opcode === ServerProt.MAP_ANIM) {
            // MAP_ANIM
            const pos: number = buf.g1;
            let x: number = this.baseX + ((pos >> 4) & 0x7);
            let z: number = this.baseZ + (pos & 0x7);
            const id: number = buf.g2;
            const height: number = buf.g1;
            const delay: number = buf.g2;
            if (x >= 0 && z >= 0 && x < CollisionMap.SIZE && z < CollisionMap.SIZE) {
                x = x * 128 + 64;
                z = z * 128 + 64;
                const spotanim: SpotAnimEntity = new SpotAnimEntity(id, this.currentLevel, x, z, this.getHeightmapY(this.currentLevel, x, z) - height, Game.loopCycle, delay);
                this.spotanims.addTail(spotanim);
            }
        } else if (opcode === ServerProt.MAP_SOUND) {
            // MAP_SOUND
            const pos: number = buf.g1;
            const x: number = this.baseX + ((pos >> 4) & 0x7);
            const z: number = this.baseZ + (pos & 0x7);
            const id: number = buf.g2;
            const info: number = buf.g1;
            const maxDist: number = (info >> 4) & 0x7;
            const loopCount: number = info & 0b111;

            if (
                this.localPlayer &&
                this.localPlayer.pathTileX[0] >= x - maxDist &&
                this.localPlayer.pathTileX[0] <= x + maxDist &&
                this.localPlayer.pathTileZ[0] >= z - maxDist &&
                this.localPlayer.pathTileZ[0] <= z + maxDist &&
                this.waveEnabled &&
                !Client.lowMemory &&
                this.waveCount < 50
            ) {
                this.waveIds[this.waveCount] = id;
                this.waveLoops[this.waveCount] = loopCount;
                this.waveDelay[this.waveCount] = Wave.delays[id];
                this.waveCount++;
            }
        } else if (opcode === ServerProt.OBJ_REVEAL) {
            // OBJ_REVEAL
            const id: number = buf.g2_alt2;
            const pos: number = buf.g1_alt2;
            const x: number = this.baseX + ((pos >> 4) & 0x7);
            const z: number = this.baseZ + (pos & 0x7);
            const count: number = buf.g2_alt2;
            const receiver: number = buf.g2;
            if (x >= 0 && z >= 0 && x < CollisionMap.SIZE && z < CollisionMap.SIZE && receiver !== this.localPid) {
                const obj: ObjStackEntity = new ObjStackEntity(id, count);
                if (!this.levelObjStacks[this.currentLevel][x][z]) {
                    this.levelObjStacks[this.currentLevel][x][z] = new LinkList();
                }
                this.levelObjStacks[this.currentLevel][x][z]?.addTail(obj);
                this.sortObjStacks(x, z);
            }
        } else if (opcode === ServerProt.LOC_MERGE) {
            // LOC_MERGE
            const pos: number = buf.g1_alt2;
            const x: number = this.baseX + ((pos >> 4) & 0x7);
            const z: number = this.baseZ + (pos & 0x7);
            const pid: number = buf.g2;
            let west: number = buf.g1b;
            const start: number = buf.g2;
            let north: number = buf.g1b;
            const end: number = buf.g2;
            const info: number = buf.g1_alt2;
            const shape: number = info >> 2;
            const angle: number = info & 0x3;
            const layer: number = LocShape.of(shape).layer;
            let east: number = buf.g1b;
            const id: number = buf.g2;
            let south: number = buf.g1b;

            let player: PlayerEntity | null;
            if (pid === this.localPid) {
                player = this.localPlayer;
            } else {
                player = this.players[pid];
            }

            if (player && this.levelHeightmap) {
                const y0: number = this.levelHeightmap[this.currentLevel][x][z];
                const y1: number = this.levelHeightmap[this.currentLevel][x + 1][z];
                const y2: number = this.levelHeightmap[this.currentLevel][x + 1][z + 1];
                const y3: number = this.levelHeightmap[this.currentLevel][x][z + 1];
                const loc: LocType = LocType.get(id);

                const model: Model | null = loc.getModel(shape, angle, y0, y1, y2, y3, -1);

                if (model) {
                    this.pushLocs(-1, 0, 0, layer, x, z, this.currentLevel, start + 1, end + 1);

                    player.locStartCycle = start + Game.loopCycle;
                    player.locStopCycle = end + Game.loopCycle;
                    player.locModel = model;

                    let width: number = loc.width;
                    let height: number = loc.length;
                    if (angle === LocAngle.NORTH || angle === LocAngle.SOUTH) {
                        width = loc.length;
                        height = loc.width;
                    }

                    player.locOffsetX = x * 128 + width * 64;
                    player.locOffsetZ = z * 128 + height * 64;
                    player.locOffsetY = this.getHeightmapY(this.currentLevel, player.locOffsetX, player.locOffsetZ);

                    let tmp: number;
                    if (east > west) {
                        tmp = east;
                        east = west;
                        west = tmp;
                    }

                    if (south > north) {
                        tmp = south;
                        south = north;
                        north = tmp;
                    }

                    player.minTileX = x + east;
                    player.maxTileX = x + west;
                    player.minTileZ = z + south;
                    player.maxTileZ = z + north;
                }
            }
        } else if (opcode === ServerProt.OBJ_COUNT) {
            // OBJ_COUNT
            const pos: number = buf.g1;
            const x: number = this.baseX + ((pos >> 4) & 0x7);
            const z: number = this.baseZ + (pos & 0x7);
            const id: number = buf.g2;
            const oldCount: number = buf.g2;
            const newCount: number = buf.g2;
            if (x >= 0 && z >= 0 && x < CollisionMap.SIZE && z < CollisionMap.SIZE) {
                const list: LinkList | null = this.levelObjStacks[this.currentLevel][x][z];
                if (list) {
                    for (let next: ObjStackEntity | null = list.head() as ObjStackEntity | null; next; next = list.next() as ObjStackEntity | null) {
                        if (next.index === (id & 0x7fff) && next.count === oldCount) {
                            next.count = newCount;
                            break;
                        }
                    }
                    this.sortObjStacks(x, z);
                }
            }
        }
    };

    private updateTextures = (cycle: number): void => {
        if (Client.lowMemory) {
            return;
        }

        this.updateTexture(17, cycle);
        this.updateTexture(24, cycle);
        this.updateTexture(34, cycle);
    };

    private updateTexture = (id: number, cycle: number): void => {
        if (Draw3D.textureCycle[id] < cycle) {
            return;
        }

        const texture: Pix8 | null = Draw3D.textures[id];
        if (!texture) {
            return;
        }
        const bottom: number = texture.width * texture.height - 1;
        const adjustment: number = texture.width * this.sceneDelta * 2;

        const src: Int8Array = texture.pixels;
        const dst: Int8Array = this.textureBuffer;
        for (let i: number = 0; i <= bottom; i++) {
            dst[i] = src[(i - adjustment) & bottom];
        }

        texture.pixels = dst;
        this.textureBuffer = src;
        // causes the texture to rebuild
        Draw3D.pushTexture(id);
    };

    private updateFlames = (): void => {
        if (!this.flameBuffer3 || !this.flameBuffer2 || !this.flameBuffer0 || !this.flameLineOffset) {
            return;
        }

        const height: number = 256;

        for (let x: number = 10; x < 117; x++) {
            const rand: number = (Math.random() * 100.0) | 0;
            if (rand < 50) this.flameBuffer3[x + ((height - 2) << 7)] = 255;
        }

        for (let l: number = 0; l < 100; l++) {
            const x: number = ((Math.random() * 124.0) | 0) + 2;
            const y: number = ((Math.random() * 128.0) | 0) + 128;
            const index: number = x + (y << 7);
            this.flameBuffer3[index] = 192;
        }

        for (let y: number = 1; y < height - 1; y++) {
            for (let x: number = 1; x < 127; x++) {
                const index: number = x + (y << 7);
                this.flameBuffer2[index] = ((this.flameBuffer3[index - 1] + this.flameBuffer3[index + 1] + this.flameBuffer3[index - 128] + this.flameBuffer3[index + 128]) / 4) | 0;
            }
        }

        this.flameCycle0 += 128;
        if (this.flameCycle0 > this.flameBuffer0.length) {
            this.flameCycle0 -= this.flameBuffer0.length;
            this.updateFlameBuffer(this.imageRunes[(Math.random() * 12.0) | 0]);
        }

        for (let y: number = 1; y < height - 1; y++) {
            for (let x: number = 1; x < 127; x++) {
                const index: number = x + (y << 7);
                let intensity: number = this.flameBuffer2[index + 128] - ((this.flameBuffer0[(index + this.flameCycle0) & (this.flameBuffer0.length - 1)] / 5) | 0);
                if (intensity < 0) {
                    intensity = 0;
                }
                this.flameBuffer3[index] = intensity;
            }
        }

        for (let y: number = 0; y < height - 1; y++) {
            this.flameLineOffset[y] = this.flameLineOffset[y + 1];
        }

        this.flameLineOffset[height - 1] = (Math.sin(Game.loopCycle / 14.0) * 16.0 + Math.sin(Game.loopCycle / 15.0) * 14.0 + Math.sin(Game.loopCycle / 16.0) * 12.0) | 0;

        if (this.flameGradientCycle0 > 0) {
            this.flameGradientCycle0 -= 4;
        }

        if (this.flameGradientCycle1 > 0) {
            this.flameGradientCycle1 -= 4;
        }

        if (this.flameGradientCycle0 === 0 && this.flameGradientCycle1 === 0) {
            const rand: number = (Math.random() * 2000.0) | 0;

            if (rand === 0) {
                this.flameGradientCycle0 = 1024;
            } else if (rand === 1) {
                this.flameGradientCycle1 = 1024;
            }
        }
    };

    private mix = (src: number, alpha: number, dst: number): number => {
        const invAlpha: number = 256 - alpha;
        return ((((src & 0xff00ff) * invAlpha + (dst & 0xff00ff) * alpha) & 0xff00ff00) + (((src & 0xff00) * invAlpha + (dst & 0xff00) * alpha) & 0xff0000)) >> 8;
    };

    private drawFlames = (): void => {
        if (!this.flameGradient || !this.flameGradient0 || !this.flameGradient1 || !this.flameGradient2 || !this.flameLineOffset || !this.flameBuffer3) {
            return;
        }

        const height: number = 256;

        // just colors
        if (this.flameGradientCycle0 > 0) {
            for (let i: number = 0; i < 256; i++) {
                if (this.flameGradientCycle0 > 768) {
                    this.flameGradient[i] = this.mix(this.flameGradient0[i], 1024 - this.flameGradientCycle0, this.flameGradient1[i]);
                } else if (this.flameGradientCycle0 > 256) {
                    this.flameGradient[i] = this.flameGradient1[i];
                } else {
                    this.flameGradient[i] = this.mix(this.flameGradient1[i], 256 - this.flameGradientCycle0, this.flameGradient0[i]);
                }
            }
        } else if (this.flameGradientCycle1 > 0) {
            for (let i: number = 0; i < 256; i++) {
                if (this.flameGradientCycle1 > 768) {
                    this.flameGradient[i] = this.mix(this.flameGradient0[i], 1024 - this.flameGradientCycle1, this.flameGradient2[i]);
                } else if (this.flameGradientCycle1 > 256) {
                    this.flameGradient[i] = this.flameGradient2[i];
                } else {
                    this.flameGradient[i] = this.mix(this.flameGradient2[i], 256 - this.flameGradientCycle1, this.flameGradient0[i]);
                }
            }
        } else {
            for (let i: number = 0; i < 256; i++) {
                this.flameGradient[i] = this.flameGradient0[i];
            }
        }
        for (let i: number = 0; i < 33920; i++) {
            if (this.imageTitle0 && this.imageFlamesLeft) this.imageTitle0.pixels[i] = this.imageFlamesLeft.pixels[i];
        }

        let srcOffset: number = 0;
        let dstOffset: number = 1152;

        for (let y: number = 1; y < height - 1; y++) {
            const offset: number = ((this.flameLineOffset[y] * (height - y)) / height) | 0;
            let step: number = offset + 22;
            if (step < 0) {
                step = 0;
            }
            srcOffset += step;
            for (let x: number = step; x < 128; x++) {
                let value: number = this.flameBuffer3[srcOffset++];
                if (value === 0) {
                    dstOffset++;
                } else {
                    const alpha: number = value;
                    const invAlpha: number = 256 - value;
                    value = this.flameGradient[value];
                    if (this.imageTitle0) {
                        const background: number = this.imageTitle0.pixels[dstOffset];
                        this.imageTitle0.pixels[dstOffset++] = ((((value & 0xff00ff) * alpha + (background & 0xff00ff) * invAlpha) & 0xff00ff00) + (((value & 0xff00) * alpha + (background & 0xff00) * invAlpha) & 0xff0000)) >> 8;
                    }
                }
            }
            dstOffset += step;
        }

        this.imageTitle0?.draw(0, 0);

        for (let i: number = 0; i < 33920; i++) {
            if (this.imageTitle1 && this.imageFlamesRight) {
                this.imageTitle1.pixels[i] = this.imageFlamesRight.pixels[i];
            }
        }

        srcOffset = 0;
        dstOffset = 1176;
        for (let y: number = 1; y < height - 1; y++) {
            const offset: number = ((this.flameLineOffset[y] * (height - y)) / height) | 0;
            const step: number = 103 - offset;
            dstOffset += offset;
            for (let x: number = 0; x < step; x++) {
                let value: number = this.flameBuffer3[srcOffset++];
                if (value === 0) {
                    dstOffset++;
                } else {
                    const alpha: number = value;
                    const invAlpha: number = 256 - value;
                    value = this.flameGradient[value];
                    if (this.imageTitle1) {
                        const background: number = this.imageTitle1.pixels[dstOffset];
                        this.imageTitle1.pixels[dstOffset++] = ((((value & 0xff00ff) * alpha + (background & 0xff00ff) * invAlpha) & 0xff00ff00) + (((value & 0xff00) * alpha + (background & 0xff00) * invAlpha) & 0xff0000)) >> 8;
                    }
                }
            }
            srcOffset += 128 - step;
            dstOffset += 128 - step - offset;
        }

        this.imageTitle1?.draw(637, 0);
    };
}

console.log(`RS2 user client - release #${Client.clientversion}`);
await setupConfiguration();
Game.client = new Game();
Game.client.run().then((): void => {});

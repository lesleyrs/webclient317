import Jagfile from './Jagfile';
import Packet from './Packet';

export default class OnDemand {
    mapIndex: Int32Array = new Int32Array(0);
    mapLocFile: Int32Array = new Int32Array(0);
    mapLandFile: Int32Array = new Int32Array(0);
    mapPrefetched: Int32Array = new Int32Array(0);

    remaining(): number {
        return -1;
    }

    load(versionlist: Jagfile): void {
        console.log('TODO: this is wrong map and midi length why?', versionlist.read('midi_index'));
        const data: Uint8Array | null = versionlist.read('map_index');
        if (!data) {
            return;
        }

        const buffer: Packet = new Packet(data);
        const count: number = (data.length / 7) | 0;
        console.log(data.length, count);

        this.mapIndex = new Int32Array(count);
        this.mapLandFile = new Int32Array(count);
        this.mapLocFile = new Int32Array(count);
        this.mapPrefetched = new Int32Array(count);

        for (let i: number = 0; i < count; i++) {
            this.mapIndex[i] = buffer.g2;
            this.mapLandFile[i] = buffer.g2;
            this.mapLocFile[i] = buffer.g2;
            this.mapPrefetched[i] = buffer.g1;
        }
    }

    getMapFile(type: number, x: number, z: number): number {
        z = z | 0;
        const index: number = ((x << 8) + z) | 0;
        for (let i: number = 0; i < this.mapIndex.length; i++) {
            if (this.mapIndex[i] === index) {
                if (type === 0) {
                    return this.mapLandFile[i];
                } else {
                    return this.mapLocFile[i];
                }
            }
        }
        return -1;
    }
}

export default class Packet {
    static crctable: Int32Array = new Int32Array(256);
    static CRC32_POLYNOMIAL: number = 0xEDB88320;
    static bitmask: Uint32Array = new Uint32Array(33);

    static {
        for (let i = 0; i < 32; i++) {
            Packet.bitmask[i] = (1 << i) - 1;
        }
        Packet.bitmask[32] = 0xFFFFFFFF;

        for (let i = 0; i < 256; i++) {
            let remainder = i;

            for (let bit = 0; bit < 8; bit++) {
                if ((remainder & 1) == 1) {
                    remainder = (remainder >>> 1) ^ Packet.CRC32_POLYNOMIAL;
                } else {
                    remainder >>>= 1;
                }
            }

            Packet.crctable[i] = remainder;
        }
    }

    // constructor
    readonly data: Uint8Array;
    pos: number;

    // runtime
    bitPos: number = 0;

    constructor(src: Uint8Array) {
        this.data = src;
        this.pos = 0;
    }

    static alloc = (type: number): Packet => {
        if (type === 0) {
            return new Packet(new Uint8Array(100));
        } else if (type === 1) {
            return new Packet(new Uint8Array(5000));
        }
        return new Packet(new Uint8Array(30000));
    }

    get g1(): number {
        return this.data[this.pos++];
    }

    // signed
    get g1b(): number {
        return this.data[this.pos++] << 24 >> 24;
    }

    get g2(): number {
        return (this.data[this.pos++] << 8 | this.data[this.pos++]) >>> 0;
    }

    get g2s(): number {
        return this.data[this.pos++] << 8 | this.data[this.pos++];
    }

    get g3(): number {
        return (this.data[this.pos++] << 16 | this.data[this.pos++] << 8 | this.data[this.pos++]) >>> 0;
    }

    get g4(): number {
        return (this.data[this.pos++] << 24 | this.data[this.pos++] << 16 | this.data[this.pos++] << 8 | this.data[this.pos++]) >>> 0;
    }

    // signed
    get g4s(): number {
        return this.data[this.pos++] << 24 | this.data[this.pos++] << 16 | this.data[this.pos++] << 8 | this.data[this.pos++];
    }

    get g8(): bigint {
        return (BigInt(this.g4) << 32n) | BigInt(this.g4);
    }

    get gsmart(): number {
        return (this.data[this.pos] < 0x80) ? this.g1 : (this.g2 - 0x8000);
    }

    // signed
    get gsmarts(): number {
        return (this.data[this.pos] < 0x80) ? (this.g1 - 0x40) : (this.g2 - 0xC000);
    }

    get gjstr(): string {
        let str = '';
        while (this.data[this.pos] != 10 && this.pos < this.data.length) {
            str += String.fromCharCode(this.data[this.pos++]);
        }
        this.pos++;
        return str;
    }

    gdata = (offset: number, length: number): Uint8Array => this.data.subarray(offset, offset + length);

    p1 = (value: number): void => {
        this.data[this.pos++] = value;
    }

    p2 = (value: number): void => {
        this.data[this.pos++] = value >>> 8;
        this.data[this.pos++] = value;
    }

    ip2 = (value: number): void => {
        this.data[this.pos++] = value;
        this.data[this.pos++] = value >>> 8;
    }

    p3 = (value: number): void => {
        this.data[this.pos++] = value >>> 16;
        this.data[this.pos++] = value >>> 8;
        this.data[this.pos++] = value;
    }

    p4 = (value: number): void => {
        this.data[this.pos++] = value >>> 24;
        this.data[this.pos++] = value >>> 16;
        this.data[this.pos++] = value >>> 8;
        this.data[this.pos++] = value;
    }

    ip4 = (value: number): void => {
        this.data[this.pos++] = value;
        this.data[this.pos++] = value >>> 8;
        this.data[this.pos++] = value >>> 16;
        this.data[this.pos++] = value >>> 24;
    }

    p8 = (value: bigint): void => {
        this.p4(Number(value >> 32n));
        this.p4(Number(value & 0xFFFFFFFFn));
    }

    pjstr = (str: string): void => {
        for (let i = 0; i < str.length; i++) {
            this.data[this.pos++] = str.charCodeAt(i);
        }
        this.data[this.pos++] = 10;
    }

    pdata = (src: Uint8Array, length: number, offset: number): void => {
        for (let i = offset; i < offset + length; i++) {
            this.data[this.pos++] = src[i];
        }
    }

    psize1 = (size: number): void => {
        this.data[this.pos - size - 1] = size;
    }

    bits = (): void => {
        this.bitPos = this.pos * 8;
    }

    bytes = (): void => {
        this.pos = ((this.bitPos + 7) / 8) >>> 0;
    }

    gBit = (n: number): number => {
        let bytePos = this.bitPos >>> 3;
        let remaining = 8 - (this.bitPos & 7);
        let value = 0;
        this.bitPos += n;

        for (; n > remaining; remaining = 8) {
            value += (this.data[bytePos++] & Packet.bitmask[remaining]) << (n - remaining);
            n -= remaining;
        }

        if (n == remaining) {
            value += this.data[bytePos] & Packet.bitmask[remaining];
        } else {
            value += (this.data[bytePos] >>> (remaining - n)) & Packet.bitmask[n];
        }

        return value;
    }
}
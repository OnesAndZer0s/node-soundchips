import { VGM } from "./VGM";
import { ChipName } from "./VGMObject";

export type VGMCommandObject = {
  cmd: number;
  size: number;
  chip?: ChipName;
  index?: number;
  type?: number;
  port?: number | null;
  addr?: number | null;
  data?: number;
  blockType?: number;
  blockSize?: number;
  blockData?: Uint8Array;
  readOffset?: number;
  writeOffset?: number;
  writeSize?: number;
  count?: number;
  streamId?: number;
  offset?: number;
  channel?: number;
  dataBankId?: number;
  stepBase?: number;
  stepSize?: number;
  frequency?: number;
  lengthMode?: number;
  dataLength?: number;
  blockId?: number;
  flags?: number;
};

export namespace VGMCommand {

  export abstract class Command implements VGMCommandObject {
    cmd: number;
    constructor ( cmd: number ) {
      this.cmd = cmd;
    }
    abstract get size (): number;
    abstract toUint8Array (): Uint8Array;
    abstract toObject (): VGMCommandObject;
    abstract clone (): Command;
    abstract copy ( arg: Object ): Command;
    toJSON () {
      return this.toObject();
    }
  }

  export class DataBlock extends Command {
    blockType: number;
    blockSize: number;
    blockData: Uint8Array;

    constructor ( arg: { blockType: number; blockSize: number; blockData: Uint8Array } ) {
      super( 0x67 );
      this.blockType = arg.blockType;
      this.blockSize = arg.blockSize;
      this.blockData = arg.blockData;
    }

    copy ( arg: { blockType?: number; blockSize?: number; blockData?: Uint8Array } ): DataBlock {
      return new DataBlock( {
        blockType: arg.blockType != null ? arg.blockType : this.blockType,
        blockSize: arg.blockSize != null ? arg.blockSize : this.blockSize,
        blockData: arg.blockData != null ? arg.blockData.slice( 0 ) : this.blockData.slice( 0 )
      } );
    }

    clone (): DataBlock {
      return this.copy( {} );
    }

    get chip (): ChipName {
      return VGM.BlockTypeToChipName( this.blockType );
    }

    get size (): number {
      return 7 + this.blockData.length;
    }

    toUint8Array (): Uint8Array {
      const res = new Uint8Array( this.size );
      res[ 0 ] = 0x67;
      res[ 1 ] = 0x66;
      res[ 2 ] = this.blockType;
      setUint32LE( res, 3, this.blockSize );
      for ( let i = 0; i < this.blockData.length; i++ ) {
        res[ i + 7 ] = this.blockData[ i ];
      }
      return res;
    }

    static parse ( buf: ArrayLike<number>, offset: number ): DataBlock | null {
      if ( buf[ offset ] === 0x67 ) {
        const blockType = buf[ offset + 2 ];
        const blockSize = getUint32LE( buf, offset + 3 );
        const blockData = new Uint8Array( blockSize );
        for ( let i = 0; i < blockSize; i++ ) {
          blockData[ i ] = buf[ offset + 7 + i ];
        }
        return new DataBlock( { blockType, blockSize, blockData } );
      }
      return null;
    }

    toObject (): VGMCommandObject {
      return {
        cmd: this.cmd,
        chip: this.chip,
        size: this.size,
        blockType: this.blockType,
        blockSize: this.blockSize,
        blockData: this.blockData.slice( 0 )
      };
    }

    static fromObject ( obj: VGMCommandObject ): DataBlock | null {
      if ( obj.cmd === 0x67 ) {
        if ( obj.blockType != null && obj.blockData != null && obj.blockSize != null ) {
          return new DataBlock( obj as any );
        } else {
          throw new Error( `Can't create VGMDataBlockCommand: required parameter is missing.` );
        }
      }
      return null;
    }
  }

  export class End extends Command {
    constructor () {
      super( 0x66 );
    }

    copy ( arg: Object ): End {
      return new End();
    }

    clone (): End {
      return this.copy( {} );
    }

    get size (): number {
      return 1;
    }
    toUint8Array (): Uint8Array {
      const res = new Uint8Array( 1 );
      res[ 0 ] = 0x66;
      return res;
    }

    static parse ( buf: ArrayLike<number>, offset: number = 0 ): End | null {
      if ( buf[ offset ] === 0x66 ) {
        return new End();
      }
      return null;
    }

    toObject (): VGMCommandObject {
      return {
        cmd: this.cmd,
        size: this.size
      };
    }

    static fromObject ( obj: VGMCommandObject ): End | null {
      if ( obj.cmd === 0x66 ) {
        return new End();
      }
      return null;
    }
  }
  export abstract class Wait extends Command {
    count: number;
    constructor ( cmd: number, count: number ) {
      super( cmd );
      if ( cmd == 0x61 ) {
        this.count = count;
      } else if ( cmd == 0x62 ) {
        this.count = 735;
      } else if ( cmd == 0x63 ) {
        this.count = 882;
      } else if ( 0x70 <= cmd && cmd <= 0x7f ) {
        this.count = ( cmd & 15 ) + 1;
      } else {
        throw new Error( `0x${ cmd.toString( 16 ) } is not a VGMWaitCommand.` );
      }
      if ( this.count !== count ) {
        throw new Error(
          `Count ${ count } is given for command 0x${ cmd.toString( 16 ) } but the count should be ${ this.count }.`
        );
      }
    }
    get size (): number {
      return this.cmd === 0x61 ? 3 : 1;
    }
    toUint8Array (): Uint8Array {
      const res = new Uint8Array( this.size );
      res[ 0 ] = this.cmd;
      if ( this.cmd === 0x61 ) {
        setUint16LE( res, 1, this.count );
      }
      return res;
    }
    toObject (): VGMCommandObject {
      return {
        cmd: this.cmd,
        size: this.size,
        count: this.count
      };
    }
  }

  export class WaitWord extends Wait {
    constructor ( arg: { count: number } ) {
      super( 0x61, arg.count );
      if ( arg.count < 0 || 65535 < arg.count ) {
        throw new Error( `Count overflow: ${ arg.count }` );
      }
    }
    copy ( arg: { count?: number } ) {
      return new WaitWord( { count: arg.count != null ? arg.count : this.count } );
    }
    clone (): WaitWord {
      return this.copy( {} );
    }
    static parse ( buf: ArrayLike<number>, offset: number = 0 ): WaitWord | null {
      const cmd = buf[ offset ];
      if ( cmd === 0x61 ) {
        const nnnn = getUint16LE( buf, offset + 1 );
        return new WaitWord( { count: nnnn } );
      }
      return null;
    }
    static fromObject ( obj: VGMCommandObject ): WaitWord | null {
      if ( obj.cmd === 0x61 ) {
        if ( obj.count == null ) {
          throw new Error( `Can't create VGMWaitCommand: obj.count is missing.` );
        }
        return new WaitWord( { count: obj.count } );
      }
      return null;
    }
  }

  export class WaitNibble extends Wait {
    constructor ( arg: { count: number } ) {
      super( 0x70 | ( ( arg.count - 1 ) & 15 ), arg.count );
      if ( arg.count < 1 || 16 < arg.count ) {
        throw new Error( `Invalid count: ${ arg.count }` );
      }
    }
    copy ( arg: { count?: number } ) {
      return new WaitNibble( { count: arg.count != null ? arg.count : this.count } );
    }
    clone (): WaitNibble {
      return this.copy( {} );
    }
    static parse ( buf: ArrayLike<number>, offset: number = 0 ): WaitNibble | null {
      const cmd = buf[ offset ];
      if ( 0x70 <= cmd && cmd <= 0x7f ) {
        return new WaitNibble( { count: ( cmd & 15 ) + 1 } );
      }
      return null;
    }
    static fromObject ( obj: VGMCommandObject ): WaitNibble | null {
      if ( 0x70 <= obj.cmd && obj.cmd <= 0x7f ) {
        return new WaitNibble( { count: ( obj.cmd & 15 ) + 1 } );
      }
      return null;
    }
  }

  export class Wait735 extends Wait {
    constructor () {
      super( 0x62, 735 );
    }
    copy ( arg: {} ): Wait735 {
      return new Wait735();
    }
    clone (): Wait735 {
      return this.copy( {} );
    }
    static parse ( buf: ArrayLike<number>, offset: number = 0 ): Wait735 | null {
      const cmd = buf[ offset ];
      if ( cmd === 0x62 ) {
        return new Wait735();
      }
      return null;
    }
    static fromObject ( obj: VGMCommandObject ): Wait735 | null {
      if ( obj.cmd === 0x62 ) {
        return new Wait735();
      }
      return null;
    }
  }

  export class Wait882 extends Wait {
    constructor () {
      super( 0x63, 882 );
    }
    copy ( arg: {} ): Wait882 {
      return new Wait882();
    }
    clone (): Wait882 {
      return this.copy( {} );
    }
    static parse ( buf: ArrayLike<number>, offset: number = 0 ): Wait882 | null {
      const cmd = buf[ offset ];
      if ( cmd === 0x63 ) {
        return new Wait882();
      }
      return null;
    }
    static fromObject ( obj: VGMCommandObject ): Wait882 | null {
      if ( obj.cmd === 0x63 ) {
        return new Wait882();
      }
      return null;
    }
  }

  export class Write2A extends Command {
    constructor ( arg: { count: number } ) {
      super( 0x80 | ( arg.count & 15 ) );
      if ( arg.count < 0 || 15 < arg.count ) {
        throw new Error( `Invalid count ${ arg.count } for VGMWrite2ACommand.` );
      }
    }

    copy ( arg: { count?: number } ): Write2A {
      return new Write2A( { count: arg.count != null ? arg.count : this.count } );
    }

    clone (): Write2A {
      return this.copy( {} );
    }

    get count (): number {
      return this.cmd & 0xf;
    }
    get size (): number {
      return 1;
    }
    toUint8Array (): Uint8Array {
      const res = new Uint8Array( this.size );
      res[ 0 ] = this.cmd;
      return res;
    }
    static parse ( buf: ArrayLike<number>, offset: number = 0 ): Write2A | null {
      const cmd = buf[ offset ];
      if ( 0x80 <= cmd && cmd <= 0x8f ) {
        return new Write2A( { count: cmd & 15 } );
      }
      return null;
    }

    toObject (): VGMCommandObject {
      return {
        cmd: this.cmd,
        size: this.size,
        count: this.count
      };
    }

    static fromObject ( obj: VGMCommandObject ): Write2A | null {
      if ( 0x80 <= obj.cmd && obj.cmd <= 0x8f ) {
        return new Write2A( { count: obj.cmd & 15 } );
      }
      return null;
    }
  }

  export class PCMRAMWrite extends Command {
    blockType: number;
    readOffset: number;
    writeOffset: number; /* RAM offset to write */
    writeSize: number;
    constructor ( arg: { blockType: number; readOffset: number; writeOffset: number; writeSize: number } ) {
      super( 0x68 );
      this.blockType = arg.blockType;
      this.readOffset = arg.readOffset;
      this.writeOffset = arg.writeOffset;
      this.writeSize = arg.writeSize;
    }

    copy ( arg: {
      blockType?: number;
      readOffset?: number;
      writeOffset?: number;
      writeSize?: number;
    } ): PCMRAMWrite {
      return new PCMRAMWrite( {
        blockType: arg.blockType != null ? arg.blockType : this.blockType,
        readOffset: arg.readOffset != null ? arg.readOffset : this.readOffset,
        writeOffset: arg.writeOffset != null ? arg.writeOffset : this.writeOffset,
        writeSize: arg.writeSize != null ? arg.writeSize : this.writeSize
      } );
    }

    clone (): PCMRAMWrite {
      return this.copy( {} );
    }

    get size (): number {
      return 12;
    }
    toUint8Array (): Uint8Array {
      const res = new Uint8Array( this.size );
      res[ 0 ] = this.cmd;
      res[ 1 ] = 0x66;
      res[ 2 ] = this.blockType;
      setUint24LE( res, 3, this.readOffset );
      setUint24LE( res, 6, this.writeOffset );
      setUint24LE( res, 9, this.writeSize );
      return res;
    }
    static parse ( buf: ArrayLike<number>, offset: number = 0 ): PCMRAMWrite | null {
      const cmd = buf[ offset ];
      if ( cmd === 0x68 ) {
        const blockType = buf[ offset + 2 ];
        const readOffset = getUint24LE( buf, offset + 3 );
        const writeOffset = getUint24LE( buf, offset + 6 );
        const writeSize = getUint24LE( buf, offset + 9 );
        return new PCMRAMWrite( { blockType, readOffset, writeOffset, writeSize } );
      }
      return null;
    }

    toObject (): VGMCommandObject {
      return {
        cmd: this.cmd,
        size: this.size,
        blockType: this.blockType,
        readOffset: this.readOffset,
        writeOffset: this.writeOffset,
        writeSize: this.writeSize
      };
    }

    static fromObject ( obj: VGMCommandObject ): PCMRAMWrite | null {
      if ( obj.cmd === 0x68 ) {
        if ( obj.blockType == null || obj.readOffset == null || obj.writeOffset == null || obj.writeSize == null ) {
          throw new Error( `Can't create VGMPCMRAMWriteCommand: required parameter is missing.` );
        }
        return new PCMRAMWrite( obj as any );
      }
      return null;
    }
  }

  export class WriteData extends Command {
    chip: ChipName;
    index: number;
    port: number;
    addr: number;
    data: number;
    size: number;
    constructor ( arg: { cmd: number; index?: number; port?: number; addr?: number; data: number } ) {
      super( arg.cmd );
      this.chip = VGM.CommandToChipName( arg.cmd );
      this.index = arg.index || 0;
      this.port = arg.port || 0;
      this.addr = arg.addr || 0;
      this.data = arg.data;
      if ( ( 0x30 <= this.cmd && this.cmd <= 0x3f ) || this.cmd === 0x4f || this.cmd === 0x50 ) {
        this.size = 2;
      } else if ( 0x40 <= this.cmd && this.cmd <= 0x4e ) {
        this.size = 3;
      } else if ( 0x51 <= this.cmd && this.cmd <= 0x5f ) {
        this.size = 3;
      } else if ( 0xa0 <= this.cmd && this.cmd <= 0xbf ) {
        this.size = 3;
      } else if ( 0xc0 <= this.cmd && this.cmd <= 0xdf ) {
        this.size = 4;
      } else if ( 0xe0 <= this.cmd && this.cmd <= 0xff ) {
        this.size = 5;
      } else {
        throw new Error( `${ this.cmd } is not a VGMWriteDataComand.` );
      }
    }

    copy ( arg: { cmd?: number; index?: number; port?: number; addr?: number; data?: number } ): WriteData {
      return new WriteData( {
        cmd: arg.cmd != null ? arg.cmd : this.cmd,
        index: arg.index != null ? arg.index : this.index,
        port: arg.port != null ? arg.port : this.port,
        addr: arg.addr != null ? arg.addr : this.addr,
        data: arg.data != null ? arg.data : this.data
      } );
    }

    clone (): WriteData {
      return this.copy( {} );
    }

    toUint8Array (): Uint8Array {
      const res = new Uint8Array( this.size );
      res[ 0 ] = this.cmd;
      if ( ( 0x30 <= this.cmd && this.cmd <= 0x3f ) || this.cmd === 0x4f || this.cmd === 0x50 ) {
        res[ 1 ] = this.data;
        return res;
      } else if ( ( 0x51 <= this.cmd && this.cmd <= 0x5f ) || ( 0xa0 <= this.cmd && this.cmd <= 0xbf ) ) {
        res[ 1 ] = this.addr;
        res[ 2 ] = this.data;
        return res;
      } else if ( 0xc0 <= this.cmd && this.cmd <= 0xc2 ) {
        setUint16LE( res, 1, this.addr | ( this.index ? 0x8000 : 0 ) );
        res[ 3 ] = this.data;
        return res;
      } else if ( 0xc3 === this.cmd ) {
        res[ 1 ] = this.addr | ( this.index ? 0x80 : 0 );
        setUint16LE( res, 2, this.data );
        return res;
      } else if ( 0xc4 === this.cmd ) {
        setUint16BE( res, 1, this.data );
        res[ 3 ] = this.addr;
        return res;
      } else if ( 0xc5 <= this.cmd && this.cmd <= 0xc8 ) {
        setUint16BE( res, 1, this.addr | ( this.index ? 0x8000 : 0 ) );
        res[ 3 ] = this.data;
        return res;
      } else if ( 0xd0 <= this.cmd && this.cmd <= 0xd2 ) {
        res[ 1 ] = this.port | ( this.index ? 0x80 : 0 );
        res[ 2 ] = this.addr;
        res[ 3 ] = this.data;
        return res;
      } else if ( 0xd3 <= this.cmd && this.cmd <= 0xd5 ) {
        setUint16BE( res, 1, this.addr | ( this.index ? 0x8000 : 0 ) );
        res[ 3 ] = this.data;
        return res;
      } else if ( 0xd6 === this.cmd ) {
        res[ 1 ] = this.addr | ( this.index ? 0x80 : 0 );
        setUint16BE( res, 2, this.data );
        return res;
      } else if ( 0xe1 === this.cmd ) {
        setUint16BE( res, 1, this.addr | ( this.index ? 0x8000 : 0 ) );
        setUint16BE( res, 3, this.data );
        return res;
      } else {
        throw new Error( `${ this.cmd } is not a VGMWriteDataCommand` );
      }
    }

    get chipName (): ChipName {
      return VGM.CommandToChipName( this.cmd );
    }

    static parse ( buf: ArrayLike<number>, offset: number = 0 ): WriteData | null {
      const cmd = buf[ offset + 0 ];
      if ( 0x30 <= cmd && cmd <= 0x3f ) {
        // 0x30: 2nd SN76489, 0x31-0x3e: Reserved, 0x3f: 2nd GG Sterao
        return new WriteData( { cmd, index: 1, data: buf[ offset + 1 ] } );
      } else if ( cmd === 0x4f ) {
        // 1st GG Stereo
        return new WriteData( { cmd, index: 0, data: buf[ offset + 1 ] } );
      } else if ( cmd === 0x50 ) {
        // 1st SN76489
        return new WriteData( { cmd, index: 0, data: buf[ offset + 1 ] } );
      } else if ( cmd === 0xa0 ) {
        // AY-3-8910
        const addr = buf[ offset + 1 ];
        const index = addr & 0x80 ? 1 : 0;
        return new WriteData( { cmd, index, port: 0, addr: addr & 0x7f, data: buf[ offset + 2 ] } );
      } else if ( ( 0x51 <= cmd && cmd <= 0x5f ) || ( 0xa1 <= cmd && cmd <= 0xaf ) ) {
        const index = ( cmd & 0xf0 ) === 0x50 ? 0 : 1;
        const dev = cmd & 0xf;
        const port = dev === 0x3 || dev === 0x7 || dev === 0x9 || dev === 0xf ? 1 : 0;
        return new WriteData( { cmd, index, port, addr: buf[ offset + 1 ], data: buf[ offset + 2 ] } );
      } else if ( 0xb0 <= cmd && cmd <= 0xbf ) {
        const addr = buf[ offset + 1 ];
        const index = addr & 0x80 ? 1 : 0;
        return new WriteData( { cmd, index, addr: addr & 0x7f, data: buf[ offset + 2 ] } );
      } else if ( 0xc0 <= cmd && cmd <= 0xc2 ) {
        const addr = getUint16LE( buf, offset + 1 );
        const index = addr & 0x8000 ? 1 : 0;
        return new WriteData( { cmd, index, addr: addr & 0x7fff, data: buf[ offset + 3 ] } );
      } else if ( 0xc3 === cmd ) {
        const addr = buf[ offset + 1 ];
        const index = addr & 0x80 ? 1 : 0;
        return new WriteData( { cmd, index, addr: addr & 0x7f, data: getUint16LE( buf, offset + 2 ) } );
      } else if ( 0xc4 === cmd ) {
        return new WriteData( { cmd, index: 0, addr: buf[ 3 ], data: getUint16BE( buf, offset + 1 ) } );
      } else if ( 0xc5 <= cmd && cmd <= 0xc8 ) {
        const addr = getUint16BE( buf, offset + 1 );
        const index = addr & 0x8000 ? 1 : 0;
        return new WriteData( { cmd, index, addr: addr & 0x7fff, data: buf[ offset + 3 ] } );
      } else if ( 0xd0 <= cmd && cmd <= 0xd2 ) {
        const port = buf[ offset + 1 ] & 0x7f;
        const index = buf[ offset + 1 ] & 0x80 ? 1 : 0;
        return new WriteData( { cmd, index, port, addr: buf[ offset + 2 ], data: buf[ offset + 3 ] } );
      } else if ( 0xd3 <= cmd && cmd <= 0xd5 ) {
        const addr = getUint16BE( buf, offset + 1 );
        const index = addr & 0x8000 ? 1 : 0;
        return new WriteData( { cmd, index, addr: addr & 0x7fff, data: buf[ offset + 3 ] } );
      } else if ( cmd === 0xd6 ) {
        const addr = buf[ offset + 1 ];
        const index = addr & 0x80 ? 1 : 0;
        return new WriteData( { cmd, index, addr: addr & 0x7f, data: getUint16BE( buf, offset + 3 ) } );
      } else if ( cmd === 0xe1 ) {
        const addr = getUint16BE( buf, offset + 1 );
        const index = addr & 0x8000 ? 1 : 0;
        return new WriteData( { cmd, index, addr: addr & 0x7fff, data: getUint16BE( buf, offset + 3 ) } );
      }
      return null;
    }

    toObject (): VGMCommandObject {
      return {
        cmd: this.cmd,
        chip: this.chip,
        size: this.size,
        index: this.index,
        port: this.port,
        addr: this.addr,
        data: this.data
      };
    }

    static fromObject ( obj: VGMCommandObject ): WriteData | null {
      const cmd = obj.cmd;
      if (
        cmd === 0x30 ||
        cmd === 0x3f ||
        cmd === 0x4f ||
        ( 0x50 <= cmd && cmd <= 0x5f ) ||
        ( 0xa0 <= cmd && cmd <= 0xdf ) ||
        cmd === 0xe0 ||
        cmd === 0xe1
      ) {
        return new WriteData( obj as any );
      }
      return null;
    }
  }
  export abstract class Stream extends Command {
    streamId: number;
    constructor ( cmd: number, streamId: number ) {
      super( cmd );
      this.streamId = streamId;
    }
  }

  export class SetupStream extends Stream {
    type: number;
    port: number;
    channel: number;
    constructor ( arg: { streamId: number; type: number; port: number; channel: number } ) {
      super( 0x90, arg.streamId );
      this.type = arg.type;
      this.port = arg.port;
      this.channel = arg.channel;
    }

    copy ( arg: { streamId?: number; type?: number; port?: number; channel?: number } ): SetupStream {
      return new SetupStream( {
        streamId: arg.streamId != null ? arg.streamId : this.streamId,
        type: arg.type != null ? arg.type : this.type,
        port: arg.port != null ? arg.port : this.port,
        channel: arg.channel != null ? arg.channel : this.channel
      } );
    }

    clone (): SetupStream {
      return this.copy( {} );
    }

    get size (): number {
      return 5;
    }
    toUint8Array (): Uint8Array {
      const res = new Uint8Array( this.size );
      res[ 0 ] = 0x90;
      res[ 1 ] = this.streamId;
      res[ 2 ] = this.type;
      res[ 3 ] = this.port;
      res[ 4 ] = this.channel;
      return res;
    }
    static parse ( buf: ArrayLike<number>, offset: number = 0 ): SetupStream | null {
      const cmd = buf[ offset ];
      if ( cmd === 0x90 ) {
        return new SetupStream( {
          streamId: buf[ offset + 1 ],
          type: buf[ offset + 2 ],
          port: buf[ offset + 3 ],
          channel: buf[ offset + 4 ]
        } );
      }
      return null;
    }
    toObject (): VGMCommandObject {
      return {
        cmd: this.cmd,
        size: this.size,
        streamId: this.streamId,
        type: this.type,
        port: this.port,
        channel: this.channel
      };
    }
    static fromObject ( obj: VGMCommandObject ): SetupStream | null {
      const cmd = obj.cmd;
      if ( cmd === 0x90 ) {
        if ( obj.streamId == null || obj.type == null || obj.port == null || obj.channel == null ) {
          throw new Error( `Can't create VGMSetupStreamCommand: required parameter is missing.` );
        }
        return new SetupStream( obj as any );
      }
      return null;
    }
  }

  export class SetStreamData extends Stream {
    dataBankId: number;
    stepSize: number;
    stepBase: number;
    constructor ( arg: { streamId: number; dataBankId: number; stepSize: number; stepBase: number } ) {
      super( 0x91, arg.streamId );
      this.dataBankId = arg.dataBankId;
      this.stepSize = arg.stepSize;
      this.stepBase = arg.stepBase;
    }

    copy ( arg: { streamId?: number; dataBankId?: number; stepSize?: number; stepBase?: number } ): SetStreamData {
      return new SetStreamData( {
        streamId: arg.streamId != null ? arg.streamId : this.streamId,
        dataBankId: arg.dataBankId != null ? arg.dataBankId : this.dataBankId,
        stepSize: arg.stepSize != null ? arg.stepSize : this.stepSize,
        stepBase: arg.stepBase != null ? arg.stepBase : this.stepBase
      } );
    }

    clone (): SetStreamData {
      return this.copy( {} );
    }

    get size (): number {
      return 5;
    }
    toUint8Array (): Uint8Array {
      const res = new Uint8Array( this.size );
      res[ 0 ] = 0x91;
      res[ 1 ] = this.streamId;
      res[ 2 ] = this.dataBankId;
      res[ 3 ] = this.stepSize;
      res[ 4 ] = this.stepBase;
      return res;
    }
    static parse ( buf: ArrayLike<number>, offset: number = 0 ): SetStreamData | null {
      const cmd = buf[ offset ];
      if ( cmd === 0x91 ) {
        return new SetStreamData( {
          streamId: buf[ offset + 1 ],
          dataBankId: buf[ offset + 2 ],
          stepSize: buf[ offset + 3 ],
          stepBase: buf[ offset + 4 ]
        } );
      }
      return null;
    }
    toObject (): VGMCommandObject {
      return {
        cmd: this.cmd,
        size: this.size,
        streamId: this.streamId,
        dataBankId: this.dataBankId,
        stepBase: this.stepBase,
        stepSize: this.stepSize
      };
    }
    static fromObject ( obj: VGMCommandObject ): SetStreamData | null {
      const cmd = obj.cmd;
      if ( cmd === 0x91 ) {
        if ( obj.streamId == null || obj.dataBankId == null || obj.stepBase == null || obj.stepSize == null ) {
          throw new Error( `Can't create VGMSetStreamDataCommand: required parameter is missing.` );
        }
        return new SetStreamData( obj as any );
      }
      return null;
    }
  }

  export class SetStreamFrequency extends Stream {
    frequency: number;
    constructor ( arg: { streamId: number; frequency: number } ) {
      super( 0x92, arg.streamId );
      this.frequency = arg.frequency;
    }
    copy ( arg: { streamId?: number; frequency?: number } ): SetStreamFrequency {
      return new SetStreamFrequency( {
        streamId: arg.streamId != null ? arg.streamId : this.streamId,
        frequency: arg.frequency != null ? arg.frequency : this.frequency
      } );
    }
    clone (): SetStreamFrequency {
      return this.copy( {} );
    }
    get size (): number {
      return 6;
    }
    toUint8Array (): Uint8Array {
      const res = new Uint8Array( this.size );
      res[ 0 ] = 0x92;
      res[ 1 ] = this.streamId;
      setUint32LE( res, 2, this.frequency );
      return res;
    }
    static parse ( buf: ArrayLike<number>, offset: number = 0 ): SetStreamFrequency | null {
      const cmd = buf[ offset ];
      if ( cmd === 0x92 ) {
        return new SetStreamFrequency( {
          streamId: buf[ offset + 1 ],
          frequency: getUint32LE( buf, offset + 2 )
        } );
      }
      return null;
    }
    toObject (): VGMCommandObject {
      return {
        cmd: this.cmd,
        size: this.size,
        streamId: this.streamId,
        frequency: this.frequency
      };
    }
    static fromObject ( obj: VGMCommandObject ): SetStreamFrequency | null {
      const cmd = obj.cmd;
      if ( cmd === 0x92 ) {
        if ( obj.streamId == null || obj.frequency == null ) {
          throw new Error( `Can't create VGMSetStreamFrequencyCommand: required parameter is missing.` );
        }
        return new SetStreamFrequency( obj as any );
      }
      return null;
    }
  }

  export class StartStream extends Stream {
    offset: number;
    lengthMode: number;
    dataLength: number;
    constructor ( arg: { streamId: number; offset: number; lengthMode: number; dataLength: number } ) {
      super( 0x93, arg.streamId );
      this.offset = arg.offset;
      this.lengthMode = arg.lengthMode;
      this.dataLength = arg.dataLength;
    }
    copy ( arg: { streamId?: number; offset?: number; lengthMode?: number; dataLength?: number } ): StartStream {
      return new StartStream( {
        streamId: arg.streamId != null ? arg.streamId : this.streamId,
        offset: arg.offset != null ? arg.offset : this.offset,
        lengthMode: arg.lengthMode != null ? arg.lengthMode : this.lengthMode,
        dataLength: arg.dataLength != null ? arg.dataLength : this.dataLength
      } );
    }
    clone (): StartStream {
      return this.copy( {} );
    }
    get size (): number {
      return 11;
    }
    toUint8Array (): Uint8Array {
      const res = new Uint8Array( this.size );
      res[ 0 ] = 0x93;
      res[ 1 ] = this.streamId;
      setUint32LE( res, 2, this.offset );
      res[ 6 ] = this.lengthMode;
      setUint32LE( res, 7, this.dataLength );
      return res;
    }
    static parse ( buf: ArrayLike<number>, offset: number = 0 ): StartStream | null {
      const cmd = buf[ offset ];
      if ( cmd === 0x93 ) {
        return new StartStream( {
          streamId: buf[ offset + 1 ],
          offset: getUint32LE( buf, offset + 2 ),
          lengthMode: buf[ offset + 6 ],
          dataLength: getUint32LE( buf, offset + 7 )
        } );
      }
      return null;
    }
    toObject (): VGMCommandObject {
      return {
        cmd: this.cmd,
        size: this.size,
        streamId: this.streamId,
        offset: this.offset,
        lengthMode: this.lengthMode,
        dataLength: this.dataLength
      };
    }
    static fromObject ( obj: VGMCommandObject ): StartStream | null {
      const cmd = obj.cmd;
      if ( cmd === 0x93 ) {
        if ( obj.streamId == null || obj.offset == null || obj.lengthMode == null || obj.dataLength == null ) {
          throw new Error( `Can't create VGMStartStreamCommand: required parameter is missing.` );
        }
        return new StartStream( obj as any );
      }
      return null;
    }
  }

  export class StopStream extends Stream {
    constructor ( arg: { streamId: number } ) {
      super( 0x94, arg.streamId );
    }
    copy ( arg: { streamId?: number } ): StopStream {
      return new StopStream( {
        streamId: arg.streamId != null ? arg.streamId : this.streamId
      } );
    }
    clone (): StopStream {
      return this.copy( {} );
    }
    get size (): number {
      return 2;
    }
    toUint8Array (): Uint8Array {
      const res = new Uint8Array( this.size );
      res[ 0 ] = 0x94;
      res[ 1 ] = this.streamId;
      return res;
    }
    static parse ( buf: ArrayLike<number>, offset: number = 0 ): StopStream | null {
      const cmd = buf[ offset ];
      if ( cmd === 0x94 ) {
        return new StopStream( { streamId: buf[ offset + 1 ] } );
      }
      return null;
    }
    toObject (): VGMCommandObject {
      return {
        cmd: this.cmd,
        size: this.size,
        streamId: this.streamId
      };
    }
    static fromObject ( obj: VGMCommandObject ): StopStream | null {
      const cmd = obj.cmd;
      if ( cmd === 0x91 ) {
        if ( obj.streamId == null ) {
          throw new Error( `Can't create VGMStopStreamCommand: required parameter is missing.` );
        }
        return new StopStream( obj as any );
      }
      return null;
    }
  }

  export class StartStreamFast extends Stream {
    blockId: number;
    flags: number;
    constructor ( arg: { streamId: number; blockId: number; flags: number } ) {
      super( 0x95, arg.streamId );
      this.blockId = arg.blockId;
      this.flags = arg.flags;
    }
    copy ( arg: { streamId?: number; blockId?: number; flags?: number } ): StartStreamFast {
      return new StartStreamFast( {
        streamId: arg.streamId != null ? arg.streamId : this.streamId,
        blockId: arg.blockId != null ? arg.blockId : this.blockId,
        flags: arg.flags != null ? arg.flags : this.flags
      } );
    }
    clone (): StartStreamFast {
      return this.copy( {} );
    }
    get size (): number {
      return 5;
    }
    toUint8Array (): Uint8Array {
      const res = new Uint8Array( this.size );
      res[ 0 ] = 0x95;
      res[ 1 ] = this.streamId;
      setUint16LE( res, 2, this.blockId );
      res[ 4 ] = this.flags;
      return res;
    }
    static parse ( buf: ArrayLike<number>, offset: number = 0 ): StartStreamFast | null {
      const cmd = buf[ offset ];
      if ( cmd === 0x95 ) {
        return new StartStreamFast( {
          streamId: buf[ offset + 1 ],
          blockId: getUint16LE( buf, offset + 2 ),
          flags: buf[ offset + 4 ]
        } );
      }
      return null;
    }
    toObject (): VGMCommandObject {
      return {
        cmd: this.cmd,
        size: this.size,
        streamId: this.streamId,
        blockId: this.blockId,
        flags: this.flags
      };
    }
    static fromObject ( obj: VGMCommandObject ): StartStreamFast | null {
      const cmd = obj.cmd;
      if ( cmd === 0x95 ) {
        if ( obj.streamId == null || obj.blockId == null || obj.flags == null ) {
          throw new Error( `Can't create VGMStartStreamFastCommand: required parameter is missing.` );
        }
        return new StartStreamFast( obj as any );
      }
      return null;
    }
  }

  export class SeekPCM extends Command {
    offset: number;
    constructor ( arg: { offset: number } ) {
      super( 0xe0 );
      this.offset = arg.offset;
    }
    copy ( arg: { offset?: number } ): SeekPCM {
      return new SeekPCM( { offset: arg.offset != null ? arg.offset : this.offset } );
    }
    clone (): SeekPCM {
      return this.copy( {} );
    }
    get size (): number {
      return 5;
    }
    toUint8Array (): Uint8Array {
      const res = new Uint8Array( this.size );
      res[ 0 ] = 0xe0;
      setUint32LE( res, 1, this.offset );
      return res;
    }
    static parse ( buf: ArrayLike<number>, offset: number = 0 ): SeekPCM | null {
      const cmd = buf[ offset ];
      if ( cmd === 0xe0 ) {
        return new SeekPCM( { offset: getUint32LE( buf, offset + 1 ) } );
      }
      return null;
    }
    toObject (): VGMCommandObject {
      return {
        cmd: this.cmd,
        size: this.size,
        offset: this.offset
      };
    }

    static fromObject ( obj: VGMCommandObject ): SeekPCM | null {
      const cmd = obj.cmd;
      if ( cmd === 0xe0 ) {
        if ( obj.offset == null ) {
          throw new Error( `Can't create VGMSeekPCMCommand: required parameter is missing.` );
        }
        return new SeekPCM( obj as any );
      }
      return null;
    }
  }
}


function getUint16BE ( buf: ArrayLike<number>, pos: number ): number {
  return ( ( buf[ pos ] & 0xff ) << 8 ) | ( buf[ pos + 1 ] & 0xff );
}
function setUint16BE ( buf: Uint8Array, pos: number, data: number ): void {
  buf[ pos ] = ( data >> 8 ) & 0xff;
  buf[ pos + 1 ] = data & 0xff;
}
function getUint16LE ( buf: ArrayLike<number>, pos: number ): number {
  return ( buf[ pos ] & 0xff ) | ( ( buf[ pos + 1 ] & 0xff ) << 8 );
}
function setUint16LE ( buf: Uint8Array, pos: number, data: number ): void {
  buf[ pos ] = data & 0xff;
  buf[ pos + 1 ] = ( data >> 8 ) & 0xff;
}
function getUint24LE ( buf: ArrayLike<number>, pos: number ): number {
  return ( buf[ pos ] & 0xff ) | ( ( buf[ pos + 1 ] & 0xff ) << 8 ) | ( ( buf[ pos + 2 ] & 0xff ) << 16 );
}
function setUint24LE ( buf: Uint8Array, pos: number, data: number ): void {
  buf[ pos ] = data & 0xff;
  buf[ pos + 1 ] = ( data >> 8 ) & 0xff;
  buf[ pos + 2 ] = ( data >> 16 ) & 0xff;
}
function getUint32LE ( buf: ArrayLike<number>, pos: number ): number {
  return (
    ( buf[ pos ] & 0xff ) | ( ( buf[ pos + 1 ] & 0xff ) << 8 ) | ( ( buf[ pos + 2 ] & 0xff ) << 16 ) | ( ( buf[ pos + 3 ] & 0xff ) << 24 )
  );
}
function setUint32LE ( buf: Uint8Array, pos: number, data: number ): void {
  buf[ pos ] = data & 0xff;
  buf[ pos + 1 ] = ( data >> 8 ) & 0xff;
  buf[ pos + 2 ] = ( data >> 16 ) & 0xff;
  buf[ pos + 3 ] = ( data >> 24 ) & 0xff;
}


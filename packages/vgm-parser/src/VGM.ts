import { VGMCommand } from "./VGMCommand";
import fs from "fs";
import zlib from "zlib";
import { ChipClock, ChipName, ChipType, Chips, ExtraChipClock, ExtraChipVolume, ExtraHeader, GD3Tag, Offsets, Samples, Version } from "./VGMObject";
import { TextDecoder } from "util";


type FlatArray = Omit<Array<VGMCommand.Command>, "flat" | "flatMap">;
/**
 * The class that represents a Video Game Music file.
 */
export class VGM implements FlatArray {

  /** @ignore */
  private byteLength: number = 0;
  /** @ignore */
  private loopIndexOffset: number = 0;
  /** @ignore */
  private loopByteOffset: number = 0;
  /** @ignore */
  private _loop: boolean = false;

  public data: Uint8Array = new Uint8Array();
  public version: Version = { code: 0x171, major: "1", minor: "71" };
  public offsets: Offsets = { eof: 0, gd3: 0, loop: 0, data: 0, extraHeader: 0 };
  public samples: Samples = { total: 0, loop: 0 };
  public rate: number = 60;
  public loopModifier: number = 0;
  public loopBase: number = 0;
  public volumeModifier: number = 0;
  public extraHeader?: ExtraHeader;
  public gd3?: GD3Tag;
  public chips: Chips = {};
  public commands: Array<VGMCommand.Command> = [];

  /**
   * Creates an instance of a Video Game Music file.
   * @param {Uint8Array} [uintArr] - VGM file data
   */
  constructor ( uintArr?: Uint8Array ) {
    if ( uintArr ) {
      this.data = uintArr;
      this.updateFromData();
    } else {
      this.updateOffsets();
    }
  }

  /**
   * Parse VGM file from a file path.
   * @static
   * @param {string} path - Path to the VGM file.
   * @return {VGM} A new VGM instance.
   */
  public static Parse ( path: string ): VGM
  /**
 * Parse VGM file from a given buffer.
 * @static
 * @param {string} path - Buffer of VGM data.
 * @return {VGM} A new VGM instance.
 */
  public static Parse ( buf: Buffer ): VGM

  public static Parse ( data: Buffer | string ): VGM {
    if ( typeof data === "string" ) {
      var f = fs.readFileSync( data );
      data = f;
    }
    return new VGM( data );
  }

  /**
   * Update all of the parameters, based on the {@link VGM.data | data} property.
   */
  public updateFromData (): void {
    if ( this.data[ 0 ] === 0x1f && this.data[ 1 ] === 0x8b ) {
      const unzip = zlib.unzipSync( this.data );
      const plain: Uint8Array = new Uint8Array( unzip );
      this.data = new Uint8Array( plain.buffer.slice( plain.byteOffset, plain.byteOffset + plain.byteLength ) );
    }

    var d = new DataView( this.data.buffer );

    const magic = d.getUint32( 0x00, true );
    if ( magic != 0x206d6756 ) {
      throw new Error( 'Not a VGM data.' );
    }

    this.version.code = d.getUint32( 0x08, true );
    this.version.major = ( this.version.code >> 8 ).toString( 16 );
    this.version.minor = ( "0" + ( this.version.code & 0xff ).toString( 16 ) ).slice( -2 );

    this.chips.sn76489 = ParamDecoder.sn76489( d );
    this.chips.ym2413 = ParamDecoder.common( d, 0x10 );

    const eof = d.getUint32( 0x04, true );
    const gd3 = d.getUint32( 0x14, true );
    const loop = d.getUint32( 0x1c, true );
    this.offsets = {
      eof: eof ? 0x04 + eof : 0,
      gd3: gd3 ? 0x14 + gd3 : 0,
      loop: loop ? 0x1c + loop : 0,
      data: 0x40,
      extraHeader: 0
    };

    this.samples.total = d.getUint32( 0x18, true );
    this.samples.loop = d.getUint32( 0x20, true );

    this.rate = d.getUint32( 0x24, true );

    if ( this.version.code >= 0x110 ) {
      this.chips.ym2612 = ParamDecoder.ym2612( d );
      this.chips.ym2151 = ParamDecoder.ym2151( d );
    }

    if ( this.version.code >= 0x150 ) {
      const offset = d.getUint32( 0x34, true );
      if ( offset > 0 ) {
        this.offsets.data = 0x34 + offset;
      }
    }

    if ( this.version.code >= 0x151 ) {
      this.chips.segaPcm = ParamDecoder.segaPcm( d ); // 0x38

      if ( 0x80 <= this.offsets.data ) {
        this.chips.rf5c68 = ParamDecoder.common( d, 0x40 );
        this.chips.ym2203 = ParamDecoder.ym2203( d );
        this.chips.ym2608 = ParamDecoder.ym2608( d );
        this.chips.ym2610 = ParamDecoder.ym2610( d );
        this.chips.ym3812 = ParamDecoder.common( d, 0x50 );
        this.chips.ym3526 = ParamDecoder.common( d, 0x54 );
        this.chips.y8950 = ParamDecoder.common( d, 0x58 );
        this.chips.ymf262 = ParamDecoder.common( d, 0x5c );
        this.chips.ymf278b = ParamDecoder.common( d, 0x60 );
        this.chips.ymf271 = ParamDecoder.common( d, 0x64 );
        this.chips.ymz280b = ParamDecoder.common( d, 0x68 );
        this.chips.rf5c164 = ParamDecoder.common( d, 0x6c );
        this.chips.pwm = ParamDecoder.common( d, 0x70 );
        this.chips.ay8910 = ParamDecoder.ay8910( d );
        this.loopModifier = d.getUint8( 0x7f );
      }
    }
    if ( this.version.code >= 0x160 ) {
      if ( 0x80 <= this.offsets.data ) {
        this.volumeModifier = d.getUint8( 0x7c );
        this.loopBase = d.getUint8( 0x7e );
      }
    }

    if ( this.version.code >= 0x161 ) {
      if ( 0xb8 <= this.offsets.data ) {
        this.chips.gameBoyDmg = ParamDecoder.common( d, 0x80 );
        this.chips.nesApu = ParamDecoder.nesApu( d );
        this.chips.multiPcm = ParamDecoder.common( d, 0x88 );
        this.chips.upd7759 = ParamDecoder.common( d, 0x8c );
        this.chips.okim6258 = ParamDecoder.commonWithFlags( d, 0x90, 0x94 );
        this.chips.c140 = ParamDecoder.c140( d );
        this.chips.okim6295 = ParamDecoder.common( d, 0x98 );
        this.chips.k051649 = ParamDecoder.common( d, 0x9c );
        this.chips.k054539 = ParamDecoder.commonWithFlags( d, 0xa0, 0x95 );
        this.chips.huc6280 = ParamDecoder.common( d, 0xa4 );
        this.chips.k053260 = ParamDecoder.common( d, 0xac );
        this.chips.pokey = ParamDecoder.common( d, 0xb0 );
        this.chips.qsound = ParamDecoder.common( d, 0xb4 );
      }
    }

    if ( this.version.code >= 0x170 ) {
      if ( 0xc0 <= this.offsets.data ) {
        const v = d.getUint32( 0xbc, true );
        this.offsets.extraHeader = v ? 0xbc + v : 0;
      }
    }

    if ( this.version.code >= 0x171 ) {
      if ( 0xe8 <= this.offsets.data ) {
        this.chips.scsp = ParamDecoder.common( d, 0xb8 );
        this.chips.wonderSwan = ParamDecoder.common( d, 0xc0 );
        this.chips.vsu = ParamDecoder.common( d, 0xc4 );
        this.chips.saa1099 = ParamDecoder.common( d, 0xc8 );
        this.chips.es5506 = ParamDecoder.es5506( d );
        this.chips.es5503 = ParamDecoder.es5503( d );
        this.chips.x1_010 = ParamDecoder.common( d, 0xd8 );
        this.chips.c352 = ParamDecoder.c352( d );
        this.chips.ga20 = ParamDecoder.common( d, 0xe0 );
      }
    }

    for ( const key in this.chips ) {
      if ( this.chips[ key as ChipName ] == null ) {
        delete this.chips[ key as ChipName ];
      }
    }


    if ( this.offsets.extraHeader ) {
      const extraData: ArrayBuffer = this.data.slice( this.offsets.extraHeader ).buffer;
      if ( 4 <= extraData.byteLength ) {
        const d = new DataView( extraData );
        const size = d.getUint32( 0x00, true );
        const offsets: { chipClock?: number; chipVolume?: number } = {};
        let clocks: Array<ExtraChipClock> | undefined;
        let volumes: Array<ExtraChipVolume> | undefined;
        if ( 8 <= size ) {
          offsets.chipClock = d.getUint32( 0x04, true );
          if ( 0 < offsets.chipClock ) {
            clocks = [];
            const base = 0x04 + offsets.chipClock;
            const count = d.getUint8( base );
            for ( let i = 0; i < count; i++ ) {
              const chipId = d.getUint8( base + 1 + i * 5 );
              const clock = d.getUint32( base + 2 + i * 5, true );
              const chip = VGM.ChipIdToName( chipId ) || "unknown";
              clocks.push( { chip, chipId, clock } );
            }
          }
        }
        if ( 12 <= size ) {
          offsets.chipVolume = d.getUint32( 0x08, true );
          if ( 0 < offsets.chipVolume ) {
            volumes = [];
            const base = 0x08 + offsets.chipVolume;
            const count = d.getUint8( base );
            for ( let i = 0; i < count; i++ ) {
              const rawChipId = d.getUint8( base + 1 + i * 4 );
              const chipId = rawChipId & 0x7f;
              const paired = rawChipId & 0x80 ? true : false;
              const flags = d.getUint8( base + 2 + i * 4 );
              const rawVolume = d.getUint16( base + 3 + i * 4, true );
              const volume = rawVolume & 0x7fff;
              const absolute = rawVolume & 0x8000 ? true : false;
              const chip = VGM.ChipIdToName( chipId ) || "unknown";
              volumes.push( { chip, chipId, paired, flags, volume, absolute } );
            }
          }
        }
        this.extraHeader = { clocks, volumes };
      }
    }

    if ( this.offsets.gd3 ) {
      const d = new DataView( this.data.slice( this.offsets.gd3 ).buffer );
      const header = d.getUint32( 0x00, true );

      if ( header != 0x20336447 ) {
        this.gd3 = {
          version: 0x100,
          size: 22,
          trackTitle: "",
          gameName: "",
          system: "",
          composer: "",
          releaseDate: "",
          vgmBy: "",
          notes: "",
          japanese: {
            trackTitle: "",
            gameName: "",
            system: "",
            composer: ""
          }
        };
      } else {

        const version = d.getUint32( 0x04, true );
        const size = d.getUint32( 0x08, true );

        const td = new TextDecoder( "utf-16" );
        let index = 12;
        let pos = 12;
        const texts = [];
        while ( index < d.byteLength ) {
          const ch = d.getUint16( index );
          if ( ch === 0 ) {
            const slice = td.decode( new Uint8Array( d.buffer, pos + d.byteOffset, index - pos ) );
            texts.push( slice );
            index += 2;
            pos = index;
          } else {
            index += 2;
          }
        }

        this.gd3 = {
          version,
          size,
          trackTitle: texts[ 0 ] ?? '',
          gameName: texts[ 2 ] ?? '',
          system: texts[ 4 ] ?? '',
          composer: texts[ 6 ] ?? '',
          releaseDate: texts[ 8 ] ?? '',
          vgmBy: texts[ 9 ] ?? '',
          notes: texts[ 10 ] ?? '',
          japanese: {
            trackTitle: texts[ 1 ] ?? '',
            gameName: texts[ 3 ] ?? '',
            system: texts[ 5 ] ?? '',
            composer: texts[ 7 ] ?? ''
          }
        };
      }
    }

    this.commands = [];

    let rp = this.offsets.data;
    while ( rp < this.data.byteLength ) {
      // if ( this.offsets.data + rp === this.offsets.loop ) {
      //   this.markLoopPoint();
      // }
      const cmd = VGM.ParseVGMCommand( this.data, rp );
      if ( cmd == null ) break;
      this.commands.push( cmd );
      this.byteLength += cmd.size;
      rp += cmd.size;
      if ( cmd instanceof VGMCommand.End ) break;
    }
  }

  /**
 * Update the {@link VGM.data | data}, based on all of the parameters.
 */
  public build (): void {

    var buffer = new ArrayBuffer( this.offsets.eof );
    var d = new DataView( buffer );
    d.setUint32( 0x00, 0x206d6756, true ); // VGM

    if ( this.offsets.eof )
      d.setUint32( 0x04, this.offsets.eof - 0x04, true );

    var code = parseInt( this.version.major, 16 ) << 8 | parseInt( this.version.minor, 16 );
    d.setUint32( 0x08, code, true );

    ParamEncoder.sn76489( d, this.chips?.sn76489 );
    ParamEncoder.common( d, 0x10, this.chips?.ym2413 );

    if ( this.offsets.gd3 )
      d.setUint32( 0x14, this.offsets.gd3 - 0x14, true );

    d.setUint32( 0x18, this.samples.total, true );

    if ( this.offsets.loop )
      d.setUint32( 0x1c, this.offsets.loop - 0x1c, true );

    d.setUint32( 0x20, this.samples.loop, true );
    d.setUint32( 0x24, this.rate, true );

    if ( this.version.code >= 0x110 ) {
      ParamEncoder.ym2612( d, this.chips.ym2612 );
      ParamEncoder.ym2151( d, this.chips.ym2151 );
    }

    if ( this.version.code >= 0x150 ) {
      if ( this.offsets.data )
        d.setUint32( 0x34, this.offsets.data - 0x34, true );
    }

    if ( this.version.code >= 0x151 ) {
      ParamEncoder.segaPcm( d, this.chips.segaPcm ); // 0x38

      if ( 0x80 <= this.offsets.data ) {
        ParamEncoder.common( d, 0x40, this.chips.rf5c68 );
        ParamEncoder.ym2203( d, this.chips.ym2203 );
        ParamEncoder.ym2608( d, this.chips.ym2608 );
        ParamEncoder.ym2610( d, this.chips.ym2610 );
        ParamEncoder.common( d, 0x50, this.chips.ym3812 );
        ParamEncoder.common( d, 0x54, this.chips.ym3526 );
        ParamEncoder.common( d, 0x58, this.chips.y8950 );
        ParamEncoder.common( d, 0x5c, this.chips.ymf262 );
        ParamEncoder.common( d, 0x60, this.chips.ymf278b );
        ParamEncoder.common( d, 0x64, this.chips.ymf271 );
        ParamEncoder.common( d, 0x68, this.chips.ymz280b );
        ParamEncoder.common( d, 0x6c, this.chips.rf5c164 );
        ParamEncoder.common( d, 0x70, this.chips.pwm );
        ParamEncoder.ay8910( d, this.chips.ay8910 );
        d.setUint8( 0x7f, this.loopModifier );
      }
    }
    if ( this.version.code >= 0x160 ) {
      if ( 0x80 <= this.offsets.data ) {
        d.setUint8( 0x7c, this.volumeModifier );
        d.setUint8( 0x7e, this.loopBase );
      }
    }

    if ( this.version.code >= 0x161 ) {
      if ( 0xb8 <= this.offsets.data ) {
        ParamEncoder.common( d, 0x80, this.chips.gameBoyDmg );
        ParamEncoder.nesApu( d, this.chips.nesApu );
        ParamEncoder.common( d, 0x88, this.chips.multiPcm );
        ParamEncoder.common( d, 0x8c, this.chips.upd7759 );
        ParamEncoder.commonWithFlags( d, 0x90, 0x94, this.chips.okim6258 );
        ParamEncoder.c140( d, this.chips.c140 );
        ParamEncoder.common( d, 0x98, this.chips.okim6295 );
        ParamEncoder.common( d, 0x9c, this.chips.k051649 );
        ParamEncoder.commonWithFlags( d, 0xa0, 0x95, this.chips.k054539 );
        ParamEncoder.common( d, 0xa4, this.chips.huc6280 );
        ParamEncoder.common( d, 0xac, this.chips.k053260 );
        ParamEncoder.common( d, 0xb0, this.chips.pokey );
        ParamEncoder.common( d, 0xb4, this.chips.qsound );
      }
    }

    if ( this.version.code >= 0x170 ) {
      if ( 0xc0 <= this.offsets.data ) {
        d.setUint32( 0xbc, this.offsets.extraHeader ? this.offsets.extraHeader - 0xbc : 0, true );
      }
    }

    if ( this.version.code >= 0x171 ) {
      if ( 0xe8 <= this.offsets.data ) {
        ParamEncoder.common( d, 0xb8, this.chips.scsp );
        ParamEncoder.common( d, 0xc0, this.chips.wonderSwan );
        ParamEncoder.common( d, 0xc4, this.chips.vsu );
        ParamEncoder.common( d, 0xc8, this.chips.saa1099 );
        ParamEncoder.es5506( d, this.chips.es5506 );
        ParamEncoder.es5503( d, this.chips.es5503 );
        ParamEncoder.common( d, 0xd8, this.chips.x1_010 );
        ParamEncoder.c352( d, this.chips.c352 );
        ParamEncoder.common( d, 0xe0, this.chips.ga20 );
      }
    }

    if ( this.offsets.extraHeader ) {
      // TODO: implement extra header
      //   const extraData: ArrayBuffer = this.data.slice( this.offsets.extraHeader ).buffer;
      //   if ( 4 <= extraData.byteLength ) {
      //     const d = new DataView( extraData );
      //     const size = d.getUint32( 0x00, true );
      // const offsets: { chipClock?: number; chipVolume?: number } = {};
      //     let clocks: Array<ExtraChipClock> | undefined;
      //     let volumes: Array<ExtraChipVolume> | undefined;
      //     if ( 8 <= size ) {
      //       offsets.chipClock = d.getUint32( 0x04, true );
      //       if ( 0 < offsets.chipClock ) {
      //         clocks = [];
      //         const base = 0x04 + offsets.chipClock;
      //         const count = d.getUint8( base );
      //         for ( let i = 0; i < count; i++ ) {
      //           const chipId = d.getUint8( base + 1 + i * 5 );
      //           const clock = d.getUint32( base + 2 + i * 5, true );
      //           const chip = VGM.ChipIdToName( chipId ) || "unknown";
      //           clocks.push( { chip, chipId, clock } );
      //         }
      //       }
      //     }
      //     if ( 12 <= size ) {
      //       offsets.chipVolume = d.getUint32( 0x08, true );
      //       if ( 0 < offsets.chipVolume ) {
      //         volumes = [];
      //         const base = 0x08 + offsets.chipVolume;
      //         const count = d.getUint8( base );
      //         for ( let i = 0; i < count; i++ ) {
      //           const rawChipId = d.getUint8( base + 1 + i * 4 );
      //           const chipId = rawChipId & 0x7f;
      //           const paired = rawChipId & 0x80 ? true : false;
      //           const flags = d.getUint8( base + 2 + i * 4 );
      //           const rawVolume = d.getUint16( base + 3 + i * 4, true );
      //           const volume = rawVolume & 0x7fff;
      //           const absolute = rawVolume & 0x8000 ? true : false;
      //           const chip = VGM.ChipIdToName( chipId ) || "unknown";
      //           volumes.push( { chip, chipId, paired, flags, volume, absolute } );
      //         }
      //       }
      //     }
      //     this.extraHeader = { clocks, volumes };
      //   }
    }

    if ( this.offsets.gd3 ) {
      d.setUint32( this.offsets.gd3 + 0x00, 0x20336447, true );

      if ( this.gd3.version )
        d.setUint32( this.offsets.gd3 + 0x04, this.gd3.version, true );

      if ( this.gd3.size )
        d.setUint32( this.offsets.gd3 + 0x08, this.gd3.size, true );


      let index = 12;
      let pos = 12;
      const texts = [];
      var i = 0;


      var iterateMe = [
        this.gd3.trackTitle,
        this.gd3.japanese.trackTitle,
        this.gd3.gameName,
        this.gd3.japanese.gameName,
        this.gd3.system,
        this.gd3.japanese.system,
        this.gd3.composer,
        this.gd3.japanese.composer,
        this.gd3.releaseDate,
        this.gd3.vgmBy,
        this.gd3.notes
      ];

      for ( var it in iterateMe ) {
        it = iterateMe[ it ];
        i = 0;
        if ( it ) {
          var enc = strEncodeUTF16( it );
          for ( ; i < enc.length; i++ ) {
            d.setUint16( this.offsets.gd3 + index + i * 2, enc[ i ], true );
          }
        }
        index += ( i + 1 ) * 2;
      }
    }


    let rp = this.offsets.data;
    for ( let i = 0; i < this.commands.length; i++ ) {
      const cmd = this.commands[ i ];
      var obj = cmd.toUint8Array();
      for ( let j = 0; j < obj.length; j++ ) {
        d.setUint8( rp, obj[ j ] );
        rp++;
      }
    }

    var newData = new Uint8Array( d.buffer );

    // check whether each data match
    for ( let i = 0; i < this.data.length; i++ ) {
      if ( this.data[ i ] !== newData[ i ] ) {
        console.log( `(0x${ i.toString( 16 ) } or ${ i }) - [original: ${ this.data[ i ] }] - [new: ${ newData[ i ] }]` );
        debugger;
      }
    }
  }

  /**
   * Parse a buffer into a {@link VGMCommand.Command}.
   * @static
   * @param {ArrayLike<number>} buf - Buffer to parse.
   * @param {number} offset - Offset of the command in buffer.
   * @return {VGMCommand.Command} A new VGMCommand.Command instance.
   * @throws {Error} Throws an error if the buffer is an ArrayBuffer, or if the offset is out of range.
   */
  public static ParseVGMCommand ( buf: ArrayLike<number>, offset: number ): VGMCommand.Command {
    const result =
      VGMCommand.Write2A.parse( buf, offset ) ||
      VGMCommand.WriteData.parse( buf, offset ) ||
      VGMCommand.WaitNibble.parse( buf, offset ) ||
      VGMCommand.WaitWord.parse( buf, offset ) ||
      VGMCommand.Wait735.parse( buf, offset ) ||
      VGMCommand.Wait882.parse( buf, offset ) ||
      VGMCommand.SeekPCM.parse( buf, offset ) ||
      VGMCommand.DataBlock.parse( buf, offset ) ||
      VGMCommand.PCMRAMWrite.parse( buf, offset ) ||
      VGMCommand.SetupStream.parse( buf, offset ) ||
      VGMCommand.SetStreamData.parse( buf, offset ) ||
      VGMCommand.SetStreamFrequency.parse( buf, offset ) ||
      VGMCommand.StartStream.parse( buf, offset ) ||
      VGMCommand.StopStream.parse( buf, offset ) ||
      VGMCommand.StartStreamFast.parse( buf, offset ) ||
      VGMCommand.End.parse( buf, offset );
    if ( result ) {
      return result;
    }
    if ( buf instanceof ArrayBuffer ) {
      throw new Error( "Parse Error:: The buffer should not be an ArrayBuffer." );
    }
    if ( offset < buf.length ) {
      throw new Error( `Parse Error:: 0x${ buf[ offset ].toString( 16 ) }` );
    }
    throw new Error( `Parse Error:: offset is out of range (may be missing VGM end command).` );
  }

  /**
   * Create a new {@link VGMCommand.Command} instance from an object.
   * @static
   * @param {VGMCommand.Command} obj - Object to create a new instance from.
   * @return {VGMCommand.Command} A new VGMCommand.Command instance.
   * @throws {Error} Throws an error if the command is not supported.
   */
  public static FromVGMCommandObject ( obj: VGMCommand.Command ): VGMCommand.Command {
    const result =
      VGMCommand.Write2A.fromObject( obj ) ||
      VGMCommand.WriteData.fromObject( obj ) ||
      VGMCommand.WaitNibble.fromObject( obj ) ||
      VGMCommand.WaitWord.fromObject( obj ) ||
      VGMCommand.Wait735.fromObject( obj ) ||
      VGMCommand.Wait882.fromObject( obj ) ||
      VGMCommand.SeekPCM.fromObject( obj ) ||
      VGMCommand.DataBlock.fromObject( obj ) ||
      VGMCommand.PCMRAMWrite.fromObject( obj ) ||
      VGMCommand.SetupStream.fromObject( obj ) ||
      VGMCommand.SetStreamData.fromObject( obj ) ||
      VGMCommand.SetStreamFrequency.fromObject( obj ) ||
      VGMCommand.StartStream.fromObject( obj ) ||
      VGMCommand.StopStream.fromObject( obj ) ||
      VGMCommand.StartStreamFast.fromObject( obj ) ||
      VGMCommand.End.fromObject( obj );
    if ( result ) {
      return result;
    }
    throw new Error( `Unsupported command: 0x${ obj.cmd.toString( 16 ) }` );
  }

  // public markLoopPoint () {
  //   // this._loop = true;
  //   // this.loopIndexOffset = this.commands.length;
  //   // this.loopByteOffset = this.byteLength;
  //   // this.samples.loop = 0;
  // }

  /**
   * Update the {@link VGM.offsets | offsets}, based on all of the parameters.
   */
  public updateOffsets (): void {
    const newDataOffset = Math.max( this.offsets.data, VGM.calcMinimumVGMHeaderSize( this ) );
    const dataOffsetDiff = newDataOffset - this.offsets.data;

    this.offsets.data = newDataOffset;

    if ( this.offsets.loop ) {
      this.offsets.loop += dataOffsetDiff;
    }

    if ( this.extraHeader ) {
      this.offsets.extraHeader = VGM.calcMinimumExtraHeaderOffset( this );
    }

    if ( this.gd3 ) {
      this.offsets.gd3 = this.offsets.data + this.data.byteLength;
      this.offsets.eof = this.offsets.gd3 + 12 + VGM.calcGD3TagBodySize( this.gd3 );
    } else {
      this.offsets.gd3 = 0;
      this.offsets.eof = this.offsets.data + this.data.byteLength;
    }
  }

  /**
   * Convert a chip ID to a chip name.
   * @static
   * @param {number} chipId - Chip ID to convert.
   * @return {ChipName | undefined} Chip name.
   * @throws {Error} Throws an error if the chip ID is out of range.
   */
  public static ChipIdToName ( chipId: number ): ChipName | undefined {
    return ( [
      "sn76489", "ym2413", "ym2612", "ym2151", "segaPcm", "rf5c68", "ym2203", "ym2608", "ym2610",
      "ym3812", "ym3526", "y8950", "ymf262", "ymf278b", "ymf271", "ymz280b", "rf5c164",
      "pwm", "ay8910", "gameBoyDmg", "nesApu", "multiPcm", "upd7759", "okim6258", "okim6295",
      "k051649", "k054539", "huc6280", "c140", "k053260", "pokey", "qsound", "scsp", "wonderSwan",
      "vsu", "saa1099", "es5503", "es5506", "x1_010", "c352", "ga20"
    ] as Array<ChipName> )[ chipId ];
  }

  /** @ignore */
  private static calcGD3TagBodySize ( obj: GD3Tag ): number {
    return (
      ( obj.trackTitle.length +
        obj.gameName.length +
        obj.system.length +
        obj.composer.length +
        obj.releaseDate.length +
        obj.vgmBy.length +
        obj.notes.length +
        obj.japanese.trackTitle.length +
        obj.japanese.gameName.length +
        obj.japanese.system.length +
        obj.japanese.composer.length +
        11 ) *
      2
    );
  }

  /** @ignore */
  private static calcExtraHeaderSize ( obj: ExtraHeader ): number {
    const { clocks, volumes } = obj;
    const headSize = volumes ? 12 : 8;
    const clocksSize = clocks ? 1 + clocks.length * 5 : 0;
    const volumesSize = volumes ? 1 + volumes.length * 4 : 0;
    return headSize + clocksSize + volumesSize;
  }

  private static calcMinimumExtraHeaderOffset ( obj: VGM ): number {
    if ( obj.version.code < 0x170 ) {
      throw new Error( "vgm version >= 1.70 is required to use extra header." );
    }
    if ( obj.version.code < 0x171 ) {
      return 0xc0;
    } else {
      return 0x100;
    }
  }
  /** @ignore */
  private static calcMinimumVGMHeaderSize ( obj: VGM ): number {
    if ( obj.version.code < 0x150 ) {
      return 0x40;
    } else if ( obj.version.code < 0x151 ) {
      return Math.max( 0x40, obj.offsets.data );
    } else if ( obj.version.code < 0x160 ) {
      return Math.max( 0x80, obj.offsets.data );
    } else if ( obj.version.code < 0x170 ) {
      return Math.max( 0xc0, obj.offsets.data );
    } else {
      const extraHeaderSize = obj.extraHeader ? VGM.calcExtraHeaderSize( obj.extraHeader ) : 0;
      return VGM.calcMinimumExtraHeaderOffset( obj ) + extraHeaderSize;
    }
  }


  /**
   * Gets or sets the length of the array. This is a number one higher than the highest index in the array.
   */
  get length (): number {
    return this.commands.length;
  }

  /**
   * Removes the last element from an array and returns it. If the array is empty, undefined is returned and the array is not modified.
   * @returns The last element in the array.
   */
  pop (): VGMCommand.Command | undefined {
    var retVal = this.commands.pop();
    if ( retVal instanceof VGMCommand.Wait || retVal instanceof VGMCommand.Write2A ) {
      this.samples.total -= retVal.count;
      if ( this._loop ) {
        this.samples.loop -= retVal.count;
      }
      this.byteLength -= retVal.size;
    }
    return retVal;
  }

  /**
   * Appends new elements to an array, and returns the new length of the array.
   * @param items New elements of the Array.
   * @returns The new length of the array.
   */
  push ( ...items: VGMCommand.Command[] ): number {
    for ( const item of items ) {
      if ( item instanceof VGMCommand.Wait || item instanceof VGMCommand.Write2A ) {
        this.samples.total += item.count;
        if ( this._loop ) {
          this.samples.loop += item.count;
        }
      }
      this.byteLength += item.size;
    }
    return this.commands.push( ...items );
  }

  /**
   * Combines two or more arrays.
   * This method returns a new array without modifying any existing arrays.
   * @param items Additional arrays and/or items to add to the end of the array.
   */
  concat ( ...items: ConcatArray<VGMCommand.Command>[] ): VGMCommand.Command[];
  concat ( ...items: ( VGMCommand.Command | ConcatArray<VGMCommand.Command> )[] ): VGMCommand.Command[];
  concat ( ...items: any[] ): VGMCommand.Command[] {
    return this.commands.concat( ...items );
  }

  /**
   * Adds all the elements of an array into a string, separated by the specified separator string.
   * @param separator A string used to separate one element of the array from the next in the resulting string. If omitted, the array elements are separated with a comma.
   */
  join ( separator?: string ): string {
    return this.commands.join( separator );
  }

  /**
   * Reverses the elements in an array in place.
   * This method mutates the array and returns a reference to the same array.
   */
  reverse (): VGMCommand.Command[] {
    return this.commands.reverse();
  }

  /**
 * Removes the first element from an array and returns it.
 * If the array is empty, undefined is returned and the array is not modified.
 */
  shift (): VGMCommand.Command | undefined {
    var retVal = this.commands.shift();
    if ( retVal instanceof VGMCommand.Wait || retVal instanceof VGMCommand.Write2A ) {
      this.samples.total -= retVal.count;
      if ( this._loop ) {
        this.samples.loop -= retVal.count;
      }
      this.byteLength -= retVal.size;
    }
    return retVal;
  }

  /**
 * Returns a copy of a section of an array.
 * For both start and end, a negative index can be used to indicate an offset from the end of the array.
 * For example, -2 refers to the second to last element of the array.
 * @param start The beginning index of the specified portion of the array.
 * If start is undefined, then the slice begins at index 0.
 * @param end The end index of the specified portion of the array. This is exclusive of the element at the index 'end'.
 * If end is undefined, then the slice extends to the end of the array.
 */
  slice ( start?: number, end?: number ): VGMCommand.Command[] {
    return this.commands.slice( start, end );
  }

  /**
 * Sorts an array in place.
 * This method mutates the array and returns a reference to the same array.
 * @param compareFn Function used to determine the order of the elements. It is expected to return
 * a negative value if the first argument is less than the second argument, zero if they're equal, and a positive
 * value otherwise. If omitted, the elements are sorted in ascending, ASCII character order.
 * ```ts
 * [11,2,22,1].sort((a, b) => a - b)
 * ```
 */
  sort ( compareFn?: ( a: VGMCommand.Command, b: VGMCommand.Command ) => number ): VGMCommand.Command[] {
    this.commands.sort( compareFn );
    return this.commands;
    // return this;
  }

  /**
 * Removes elements from an array and, if necessary, inserts new elements in their place, returning the deleted elements.
 * @param start The zero-based location in the array from which to start removing elements.
 * @param deleteCount The number of elements to remove.
 * @returns An array containing the elements that were deleted.
 */
  splice ( start: number, deleteCount?: number ): VGMCommand.Command[];
  /**
 * Removes elements from an array and, if necessary, inserts new elements in their place, returning the deleted elements.
 * @param start The zero-based location in the array from which to start removing elements.
 * @param deleteCount The number of elements to remove.
 * @param items Elements to insert into the array in place of the deleted elements.
 * @returns An array containing the elements that were deleted.
 */
  splice ( start: number, deleteCount: number, ...items: VGMCommand.Command[] ): VGMCommand.Command[];
  splice ( start: number, deleteCount: number, ...items: VGMCommand.Command[] ): VGMCommand.Command[] {
    for ( let i = start; i < start + deleteCount; i++ ) {
      const item = this.commands[ i ];
      if ( item instanceof VGMCommand.Wait || item instanceof VGMCommand.Write2A ) {
        this.samples.total -= item.count;
        if ( this._loop ) {
          this.samples.loop -= item.count;
        }
        this.byteLength -= item.size;
      }
    }
    for ( const item of items ) {
      if ( item instanceof VGMCommand.Wait || item instanceof VGMCommand.Write2A ) {
        this.samples.total += item.count;
        if ( this._loop ) {
          this.samples.loop += item.count;
        }
        this.byteLength += item.size;
      }
    }
    return this.commands.splice( start, deleteCount, ...items );
  }

  /**
 * Inserts new elements at the start of an array, and returns the new length of the array.
 * @param items Elements to insert at the start of the array.
 */
  unshift ( ...items: VGMCommand.Command[] ): number {
    for ( const item of items ) {
      if ( item instanceof VGMCommand.Wait || item instanceof VGMCommand.Write2A ) {
        this.samples.total += item.count;
        if ( this._loop ) {
          this.samples.loop += item.count;
        }
        this.byteLength += item.size;
      }
    }
    return this.commands.unshift( ...items );
  }

  /**
 * Returns the index of the first occurrence of a value in an array, or -1 if it is not present.
 * @param searchElement The value to locate in the array.
 * @param fromIndex The array index at which to begin the search. If fromIndex is omitted, the search starts at index 0.
 */
  indexOf ( searchElement: VGMCommand.Command, fromIndex?: number ): number {
    return this.commands.indexOf( searchElement, fromIndex );
  }

  /**
 * Returns the index of the last occurrence of a specified value in an array, or -1 if it is not present.
 * @param searchElement The value to locate in the array.
 * @param fromIndex The array index at which to begin searching backward. If fromIndex is omitted, the search starts at the last index in the array.
 */
  lastIndexOf ( searchElement: VGMCommand.Command, fromIndex?: number ): number {
    return this.commands.lastIndexOf( searchElement, fromIndex );
  }

  /**
 * Determines whether all the members of an array satisfy the specified test.
 * @param predicate A function that accepts up to three arguments. The every method calls
 * the predicate function for each element in the array until the predicate returns a value
 * which is coercible to the Boolean value false, or until the end of the array.
 * @param thisArg An object to which the this keyword can refer in the predicate function.
 * If thisArg is omitted, undefined is used as the this value.
 */
  every ( callbackfn: ( value: VGMCommand.Command, index: number, array: VGMCommand.Command[] ) => unknown, thisArg?: any ): boolean {
    return this.commands.every( callbackfn, thisArg );
  }
  /**
   * Determines whether the specified callback function returns true for any element of an array.
   * @param predicate A function that accepts up to three arguments. The some method calls
   * the predicate function for each element in the array until the predicate returns a value
   * which is coercible to the Boolean value true, or until the end of the array.
   * @param thisArg An object to which the this keyword can refer in the predicate function.
   * If thisArg is omitted, undefined is used as the this value.
   */
  some ( callbackfn: ( value: VGMCommand.Command, index: number, array: VGMCommand.Command[] ) => unknown, thisArg?: any ): boolean {
    return this.commands.some( callbackfn, thisArg );
  }
  /**
   * Performs the specified action for each element in an array.
   * @param callbackfn  A function that accepts up to three arguments. forEach calls the callbackfn function one time for each element in the array.
   * @param thisArg  An object to which the this keyword can refer in the callbackfn function. If thisArg is omitted, undefined is used as the this value.
   */
  forEach ( callbackfn: ( value: VGMCommand.Command, index: number, array: VGMCommand.Command[] ) => void, thisArg?: any ): void {
    this.commands.forEach( callbackfn, thisArg );
  }
  /**
   * Returns the elements of an array that meet the condition specified in a callback function.
   * @param predicate A function that accepts up to three arguments. The filter method calls the predicate function one time for each element in the array.
   * @param thisArg An object to which the this keyword can refer in the predicate function. If thisArg is omitted, undefined is used as the this value.
   */
  filter ( callbackfn: ( value: VGMCommand.Command, index: number, array: VGMCommand.Command[] ) => unknown, thisArg?: any ): VGMCommand.Command[] {
    return this.commands.filter( callbackfn, thisArg );
  }

  /**
 * Calls the specified callback function for all the elements in an array. The return value of the callback function is the accumulated result, and is provided as an argument in the next call to the callback function.
 * @param callbackfn A function that accepts up to four arguments. The reduce method calls the callbackfn function one time for each element in the array.
 * @param initialValue If initialValue is specified, it is used as the initial value to start the accumulation. The first call to the callbackfn function provides this value as an argument instead of an array value.
 */
  reduce ( callbackfn: ( previousValue: VGMCommand.Command, currentValue: VGMCommand.Command, currentIndex: number, array: VGMCommand.Command[] ) => VGMCommand.Command ): VGMCommand.Command;
  reduce ( callbackfn: ( previousValue: VGMCommand.Command, currentValue: VGMCommand.Command, currentIndex: number, array: VGMCommand.Command[] ) => VGMCommand.Command, initialValue: VGMCommand.Command ): VGMCommand.Command;
  reduce ( callbackfn: ( previousValue: VGMCommand.Command, currentValue: VGMCommand.Command, currentIndex: number, array: VGMCommand.Command[] ) => VGMCommand.Command, initialValue?: VGMCommand.Command ): VGMCommand.Command {
    return this.commands.reduce( callbackfn, initialValue );
  }
  /**
   * Calls the specified callback function for all the elements in an array, in descending order. The return value of the callback function is the accumulated result, and is provided as an argument in the next call to the callback function.
   * @param callbackfn A function that accepts up to four arguments. The reduceRight method calls the callbackfn function one time for each element in the array.
   * @param initialValue If initialValue is specified, it is used as the initial value to start the accumulation. The first call to the callbackfn function provides this value as an argument instead of an array value.
   */
  reduceRight ( callbackfn: ( previousValue: VGMCommand.Command, currentValue: VGMCommand.Command, currentIndex: number, array: VGMCommand.Command[] ) => VGMCommand.Command ): VGMCommand.Command;
  reduceRight ( callbackfn: ( previousValue: VGMCommand.Command, currentValue: VGMCommand.Command, currentIndex: number, array: VGMCommand.Command[] ) => VGMCommand.Command, initialValue: VGMCommand.Command ): VGMCommand.Command;
  reduceRight ( callbackfn: ( previousValue: VGMCommand.Command, currentValue: VGMCommand.Command, currentIndex: number, array: VGMCommand.Command[] ) => VGMCommand.Command, initialValue?: VGMCommand.Command ): VGMCommand.Command {
    return this.commands.reduceRight( callbackfn, initialValue );
  }
  /**
   * Returns the value of the first element in the array where predicate is true, and undefined
   * otherwise.
   * @param predicate find calls predicate once for each element of the array, in ascending
   * order, until it finds one where predicate returns true. If such an element is found, find
   * immediately returns that element value. Otherwise, find returns undefined.
   * @param thisArg If provided, it will be used as the this value for each invocation of
   * predicate. If it is not provided, undefined is used instead.
   */
  find ( predicate: ( value: VGMCommand.Command, index: number, obj: VGMCommand.Command[] ) => unknown, thisArg?: any ): VGMCommand.Command | undefined {
    return this.commands.find( predicate, thisArg );
  }
  /**
   * Returns the index of the first element in the array where predicate is true, and -1
   * otherwise.
   * @param predicate find calls predicate once for each element of the array, in ascending
   * order, until it finds one where predicate returns true. If such an element is found,
   * findIndex immediately returns that element index. Otherwise, findIndex returns -1.
   * @param thisArg If provided, it will be used as the this value for each invocation of
   * predicate. If it is not provided, undefined is used instead.
   */
  findIndex ( predicate: ( value: VGMCommand.Command, index: number, obj: VGMCommand.Command[] ) => unknown, thisArg?: any ): number {
    return this.commands.findIndex( predicate, thisArg );
  }
  /**
   * Changes all array elements from `start` to `end` index to a static `value` and returns the modified array
   * @param value value to fill array section with
   * @param start index to start filling the array at. If start is negative, it is treated as
   * length+start where length is the length of the array.
   * @param end index to stop filling the array at. If end is negative, it is treated as
   * length+end.
   */
  fill ( value: VGMCommand.Command, start?: number, end?: number ): VGMCommand.Command[] {
    // subtract size from between start and end
    for ( let i = start; i < end; i++ ) {
      const item = this.commands[ i ];
      if ( item instanceof VGMCommand.Wait || item instanceof VGMCommand.Write2A ) {
        this.samples.total -= item.count;
        if ( this._loop ) {
          this.samples.loop -= item.count;
        }
        this.byteLength -= item.size;
      }
    }
    // add size of repeated value
    if ( value instanceof VGMCommand.Wait || value instanceof VGMCommand.Write2A ) {
      this.samples.total += value.count * ( end - start );
      if ( this._loop ) {
        this.samples.loop += value.count * ( end - start );
      }
      this.byteLength += value.size * ( end - start );
    }
    this.commands.fill( value, start, end );
    return this.commands;
  }
  /**
   * Returns the this object after copying a section of the array identified by start and end
   * to the same array starting at position target
   * @param target If target is negative, it is treated as length+target where length is the
   * length of the array.
   * @param start If start is negative, it is treated as length+start. If end is negative, it
   * is treated as length+end.
   * @param end If not specified, length of the this object is used as its default value.
   */
  copyWithin ( target: number, start: number, end?: number ): VGMCommand.Command[] {
    this.commands.copyWithin( target, start, end );
    return this.commands;
  }

  /** iterator */
  [ Symbol.iterator ] (): IterableIterator<VGMCommand.Command> {
    return this.commands[ Symbol.iterator ]();
  }
  /**
   * Returns an iterable of key, value pairs for every entry in the array
   */
  entries (): IterableIterator<[ number, VGMCommand.Command ]> {
    return this.commands.entries();
  }
  /**
   * Returns an iterable of keys in the array
   */
  keys (): IterableIterator<number> {
    return this.commands.keys();
  }
  /**
   * Returns an iterable of values in the array
   */
  values (): IterableIterator<VGMCommand.Command> {
    return this.commands.values();
  }
  /**
   * Determines whether an array includes a certain element, returning true or false as appropriate.
   * @param searchElement The element to search for.
   * @param fromIndex The position in this array at which to begin searching for searchElement.
   */
  includes ( searchElement: VGMCommand.Command, fromIndex?: number ): boolean {
    return this.commands.includes( searchElement, fromIndex );
  }

  /**
 * Takes an integer value and returns the item at that index,
 * allowing for positive and negative integers.
 * Negative integers count back from the last item in the array.
 */
  at ( index: number ): VGMCommand.Command {
    return this.commands.at( index );
  }

  /**
   * Calls a defined callback function on each element of an array, and returns an array that contains the results.
   * @param callbackfn A function that accepts up to three arguments. The map method calls the callbackfn function one time for each element in the array.
   * @param thisArg An object to which the this keyword can refer in the callbackfn function. If thisArg is omitted, undefined is used as the this value.
   */
  map ( callbackfn: ( value: VGMCommand.Command, index: number, array: VGMCommand.Command[] ) => unknown, thisArg?: any ): any[] {
    return this.commands.map( callbackfn, thisArg );
  }

  get [ Symbol.unscopables ] (): any {
    return this.commands[ Symbol.unscopables ];
  }

  [ n: number ]: VGMCommand.Command;


  /**
   * Get the chip name given a block type.
   * @static
   * @param {number} blockType - Block type.
   * @return {ChipName} Chip name.
   * @throws {Error} Throws an error if the block type is out of range.
   */
  static BlockTypeToChipName ( blockType: number ): ChipName {
    switch ( blockType ) {
      case 0x00:
      case 0x40:
        return "ym2612";
      case 0x01:
      case 0x41:
        return "rf5c68";
      case 0x02:
      case 0x42:
        return "rf5c164";
      case 0x03:
      case 0x43:
        return "pwm";
      case 0x04:
      case 0x44:
        return "okim6258";
      case 0x05:
      case 0x45:
        return "huc6280";
      case 0x06:
      case 0x46:
        return "scsp";
      case 0x07:
      case 0x47:
        return "nesApu";
      case 0x80:
        return "segaPcm";
      case 0x81:
        return "ym2608";
      case 0x82:
        return "ym2610";
      case 0x83:
        return "ym2610";
      case 0x84:
        return "ymf278b";
      case 0x85:
        return "ymf271";
      case 0x86:
        return "ymz280b";
      case 0x87:
        return "ymf278b";
      case 0x88:
        return "y8950";
      case 0x89:
        return "multiPcm";
      case 0x8a:
        return "upd7759";
      case 0x8b:
        return "okim6295";
      case 0x8c:
        return "k054539";
      case 0x8d:
        return "c140";
      case 0x8e:
        return "k053260";
      case 0x8f:
        return "qsound";
      case 0x90:
        return "es5506";
      case 0x91:
        return "x1_010";
      case 0x92:
        return "c352";
      case 0x93:
        return "ga20";
      case 0xc0:
        return "rf5c68";
      case 0xc1:
        return "rf5c164";
      case 0xc2:
        return "nesApu";
      case 0xe0:
        return "scsp";
      case 0xe1:
        return "es5503";
      default:
        return "unknown";
    }
  }

  /**
   * Get the chip name given a command.
   * @static
   * @param {number} cmd - Command.
   * @return {ChipName} Chip name.
   * @throws {Error} Throws an error if the command is out of range.
   */
  static CommandToChipName ( cmd: number ): ChipName {
    switch ( cmd ) {
      case 0x30:
      case 0x50:
        return "sn76489";
      case 0x3f:
      case 0x4f:
        return "gameGearStereo";
      case 0x51:
      case 0xa1:
        return "ym2413";
      case 0x52:
      case 0x53:
      case 0xa2:
      case 0xa3:
        return "ym2612";
      case 0x54:
      case 0xa4:
        return "ym2151";
      case 0x55:
      case 0xa5:
        return "ym2203";
      case 0x56:
      case 0x57:
      case 0xa6:
      case 0xa7:
        return "ym2608";
      case 0x58:
      case 0x59:
      case 0xa8:
      case 0xa9:
        return "ym2610";
      case 0x5a:
      case 0xaa:
        return "ym3812";
      case 0x5b:
      case 0xab:
        return "ym3526";
      case 0x5c:
      case 0xac:
        return "y8950";
      case 0x5d:
      case 0xad:
        return "ymz280b";
      case 0x5e:
      case 0x5f:
      case 0xae:
      case 0xaf:
        return "ymf262";
      case 0xa0:
        return "ay8910";
      case 0xb0:
        return "rf5c68";
      case 0xb1:
        return "rf5c164";
      case 0xb2:
        return "pwm";
      case 0xb3:
        return "gameBoyDmg";
      case 0xb4:
        return "nesApu";
      case 0xb5:
        return "multiPcm";
      case 0xb6:
        return "upd7759";
      case 0xb7:
        return "okim6258";
      case 0xb8:
        return "okim6295";
      case 0xb9:
        return "huc6280";
      case 0xba:
        return "k053260";
      case 0xbb:
        return "pokey";
      case 0xbc:
        return "wonderSwan";
      case 0xbd:
        return "saa1099";
      case 0xbe:
        return "es5506";
      case 0xbf:
        return "ga20";
      case 0xc0:
        return "segaPcm";
      case 0xc1:
        return "rf5c68";
      case 0xc2:
        return "rf5c164";
      case 0xc3:
        return "multiPcm";
      case 0xc4:
        return "qsound";
      case 0xc5:
        return "scsp";
      case 0xc6:
        return "wonderSwan";
      case 0xc7:
        return "vsu";
      case 0xc8:
        return "x1_010";
      case 0xd0:
        return "ymf278b";
      case 0xd1:
        return "ymf271";
      case 0xd2:
        return "k051649";
      case 0xd3:
        return "k054539";
      case 0xd4:
        return "c140";
      case 0xd5:
        return "es5503";
      case 0xd6:
        return "es5506";
      case 0xe1:
        return "c352";
      default:
        throw new Error( "Unknown chip" );
    }
  }
}




/** @ignore */
namespace ParamDecoder {

  /** @ignore */
  export function common ( d: DataView, clockIndex: number ) {
    const clock = d.getUint32( clockIndex, true );
    if ( clock ) {
      return { clock: clock & 0x3fffffff, dual: clock & 0x40000000 ? true : false };
    }
  }

  /** @ignore */
  export function commonWithFlags ( d: DataView, clockIndex: number, flagsIndex: number ) {
    const clock = d.getUint32( clockIndex, true );
    if ( clock ) {
      return { clock: clock & 0x3fffffff, dual: clock & 0x40000000 ? true : false, flags: d.getUint8( flagsIndex ) };
    }
  }

  /** @ignore */
  export function sn76489 ( d: DataView ) {
    const t6w28 = d.getUint8( 0x0f ) & 0x80 ? true : false;
    const obj = commonWithFlags( d, 0x0c, 0x2b );
    if ( obj ) {
      return {
        ...obj,
        feedback: d.getUint16( 0x28, true ),
        shiftRegisterWidth: d.getUint8( 0x2a ),
        t6w28
      };
    }
  }

  /** @ignore */
  export function segaPcm ( d: DataView ) {
    const obj = common( d, 0x38 );
    if ( obj ) {
      return {
        ...obj,
        interfaceRegister: d.getUint32( 0x3c, true )
      };
    }
  }

  /** @ignore */
  export function ym2151 ( d: DataView ) {
    const obj = common( d, 0x30 );
    if ( obj ) {
      const t = obj.clock >> 30;
      return {
        ...obj,
        clock: obj.clock & 0x7fffffff,
        chipType: {
          value: t,
          name: t ? "YM2164" : "YM2151"
        }
      };
    }
  }

  /** @ignore */
  export function ym2203 ( d: DataView ) {
    const obj = common( d, 0x44 );
    if ( obj ) {
      return {
        ...obj,
        ssgFlags: d.getUint8( 0x7a )
      };
    }
  }

  /** @ignore */
  export function ym2608 ( d: DataView ) {
    const obj = common( d, 0x48 );
    if ( obj ) {
      return {
        ...obj,
        ssgFlags: d.getUint8( 0x7b )
      };
    }
  }

  /** @ignore */
  export function ym2610 ( d: DataView ) {
    const obj = common( d, 0x4c );
    if ( obj ) {
      const t = d.getUint8( 0x4c );
      return {
        ...obj,
        clock: obj.clock & 0x7fffffff,
        chipType: {
          value: t,
          name: t ? "YM2610" : "YM2610B"
        }
      };
    }
  }

  /** @ignore */
  export function ym2612 ( d: DataView ) {
    const obj = common( d, 0x2c );
    if ( obj ) {
      const t = obj.clock >> 30;
      return {
        ...obj,
        clock: obj.clock & 0x7fffffff,
        chipType: {
          value: t,
          name: t ? "YM3438" : "YM2612"
        }
      };
    }
  }

  /** @ignore */
  export function nesApu ( d: DataView ) {
    const obj = common( d, 0x84 );
    if ( obj ) {
      return {
        ...obj,
        fds: d.getUint8( 0x84 ) & 0x80 ? true : false
      };
    }
  }

  /** @ignore */
  export function es5503 ( d: DataView ) {
    const obj = common( d, 0xcc );
    if ( obj ) {
      return {
        ...obj,
        numberOfChannels: d.getUint8( 0xd4 )
      };
    }
  }

  /** @ignore */
  export function es5506 ( d: DataView ) {
    const obj = common( d, 0xd0 );
    if ( obj ) {
      const t = obj.clock >> 30;
      return {
        ...obj,
        clock: obj.clock & 0x7fffffff,
        chipType: {
          value: t,
          name: t ? "ES5506" : "ES5505"
        },
        numberOfChannels: d.getUint8( 0xd5 )
      };
    }
  }

  /** @ignore */
  export function ay8910 ( d: DataView ) {
    const obj = common( d, 0x74 );
    if ( obj ) {
      const t = d.getUint8( 0x78 );
      const flags = d.getUint8( 0x79 );
      return {
        ...obj,
        chipType: {
          value: t,
          name: ( ( t: number ) => {
            switch ( t ) {
              case 0x00:
                return "AY8910";
              case 0x01:
                return "AY8912";
              case 0x02:
                return "AY8913";
              case 0x03:
                return "AY8930";
              case 0x10:
                return "YM2149";
              case 0x11:
                return "YM3439";
              case 0x12:
                return "YMZ284";
              case 0x13:
                return "YMZ294";
              default:
                return "UNKNOWN";
            }
          } )( t )
        },
        flags
      };
    }
  }

  /** @ignore */
  export function c140 ( d: DataView ) {
    const obj = common( d, 0xa8 );
    if ( obj ) {
      const t = d.getUint8( 0x96 );
      return {
        ...obj,
        chipType: {
          value: t,
          name: ( ( t: number ) => {
            switch ( t ) {
              case 0x00:
                return "C140, Namco System 2";
              case 0x01:
                return "C140, Namco System 21";
              case 0x02:
                return "219 ASIC, Namco NA-1/2";
              default:
                return "UNKNOWN";
            }
          } )( t )
        }
      };
    }
  }

  /** @ignore */
  export function c352 ( d: DataView ) {
    const obj = common( d, 0xdc );
    if ( obj ) {
      return {
        ...obj,
        clockDivider: d.getUint8( 0xd6 )
      };
    }
  }
}

/** @ignore */
namespace ParamEncoder {

  /** @ignore */
  export function common ( d: DataView, clockIndex: number, val: ChipClock ) {
    if ( val?.clock != null )
      d.setUint32( clockIndex, ( val.clock & 0x3fffffff ) | ( val.dual ? 0x40000000 : 0 ), true );
  }

  /** @ignore */
  export function commonWithFlags ( d: DataView, clockIndex: number, flagsIndex: number, val: ChipClock & { flags?: number; } ) {
    if ( val?.flags != null )
      d.setUint8( flagsIndex, val.flags ?? 0 );

    if ( val?.clock != null )
      d.setUint32( clockIndex, ( val.clock & 0x3fffffff ) | ( val.dual ? 0x40000000 : 0 ), true );


  }

  /** @ignore */
  export function sn76489 ( d: DataView, val: ChipClock & {
    feedback?: number;
    shiftRegisterWidth?: number;
    flags?: number;
    t6w28?: boolean;
  } ) {
    d.setUint8( 0x0f, ( val?.t6w28 ? 0x80 : 0 ) );
    commonWithFlags( d, 0x0c, 0x2b, val );

    if ( val?.feedback != null )
      d.setUint16( 0x28, val.feedback, true );

    if ( val?.shiftRegisterWidth != null )
      d.setUint8( 0x2a, val.shiftRegisterWidth );

  }

  /** @ignore */
  export function segaPcm ( d: DataView, val: ChipClock & { interfaceRegister?: number } ) {
    common( d, 0x38, val );


    if ( val?.interfaceRegister != null )
      d.setUint32( 0x3c, val.interfaceRegister, true );
    // if ( obj ) {
    //   return {
    //     ...obj,
    //     interfaceRegister: d.getUint32( 0x3c, true )
    //   };
    // }
  }

  /** @ignore */
  export function ym2151 ( d: DataView, val: ChipClock & { chipType?: ChipType } ) {
    common( d, 0x30, val );
    if ( val?.chipType != null )
      d.setUint8( 0x30, ( val?.clock & 0x3fffffff ) | ( val?.dual ? 0x40000000 : 0 ) | ( val.chipType.value & 0x01 ) );

    // if ( obj ) {
    //   const t = obj.clock >> 30;
    //   return {
    //     ...obj,
    //     clock: obj.clock & 0x7fffffff,
    //     chipType: {
    //       value: t,
    //       name: t ? "YM2164" : "YM2151"
    //     }
    //   };
    // }
  }

  /** @ignore */
  export function ym2203 ( d: DataView, val: ChipClock & { ssgFlags?: number } ) {
    common( d, 0x44, val );
    if ( val?.ssgFlags != null )
      d.setUint8( 0x7a, val.ssgFlags );
    // if ( obj ) {
    //   return {
    //     ...obj,
    //     ssgFlags: d.getUint8( 0x7a )
    //   };
    // }
  }

  /** @ignore */
  export function ym2608 ( d: DataView, val: ChipClock & { ssgFlags?: number } ) {
    common( d, 0x48, val );
    if ( val?.ssgFlags != null )
      d.setUint8( 0x7b, val.ssgFlags );
  }

  /** @ignore */
  export function ym2610 ( d: DataView, val: ChipClock & { chipType?: ChipType } ) {
    common( d, 0x4c, val );
    if ( val?.chipType != null )
      d.setUint8( 0x4c, ( val?.clock & 0x3fffffff ) | ( val?.dual ? 0x40000000 : 0 ) | ( val.chipType.value & 0x01 ) );

    // if ( obj ) {
    //   const t = d.getUint8( 0x4c );
    //   return {
    //     ...obj,
    //     clock: obj.clock & 0x7fffffff,
    //     chipType: {
    //       value: t,
    //       name: t ? "YM2610" : "YM2610B"
    //     }
    //   };
    // }
  }

  /** @ignore */
  export function ym2612 ( d: DataView, val: ChipClock & { chipType?: ChipType } ) {
    common( d, 0x2c, val );
    if ( val?.chipType != null )
      d.setUint8( 0x2c, ( val?.clock & 0x3fffffff ) | ( val?.dual ? 0x40000000 : 0 ) | ( val.chipType.value & 0x01 ) );

    // if ( obj ) {
    //   const t = obj.clock >> 30;
    //   return {
    //     ...obj,
    //     clock: obj.clock & 0x7fffffff,
    //     chipType: {
    //       value: t,
    //       name: t ? "YM3438" : "YM2612"
    //     }
    //   };
    // }
  }

  /** @ignore */
  export function nesApu ( d: DataView, val: ChipClock & { fds?: boolean } ) {
    common( d, 0x84, val );
    if ( val?.fds != null )
      d.setUint8( 0x84, ( val?.clock & 0x3fffffff ) | ( val?.dual ? 0x40000000 : 0 ) | ( val?.fds ? 0x80 : 0 ) );

    // if ( obj ) {
    //   return {
    //     ...obj,
    //     fds: d.getUint8( 0x84 ) & 0x80 ? true : false
    //   };
    // }
  }

  /** @ignore */
  export function es5503 ( d: DataView, val: ChipClock & { numberOfChannels?: number } ) {
    common( d, 0xcc, val );
    if ( val.numberOfChannels != null )
      d.setUint8( 0xd4, val.numberOfChannels );
  }

  /** @ignore */
  export function es5506 ( d: DataView, val: ChipClock & { chipType?: ChipType, numberOfChannels?: number } ) {
    common( d, 0xd0, val );

    if ( val?.chipType != null )
      d.setUint8( 0xd0, ( val?.clock & 0x3fffffff ) | ( val?.dual ? 0x40000000 : 0 ) | ( val.chipType.value & 0x01 ) );

    if ( val?.numberOfChannels != null )
      d.setUint8( 0xd5, val.numberOfChannels );
    // if ( obj ) {
    //   const t = obj.clock >> 30;
    //   return {
    //     ...obj,
    //     clock: obj.clock & 0x7fffffff,
    //     chipType: {
    //       value: t,
    //       name: t ? "ES5506" : "ES5505"
    //     },
    //     numberOfChannels: d.getUint8( 0xd5 )
    //   };
    // }
  }

  /** @ignore */
  export function ay8910 ( d: DataView, val: ChipClock & { chipType?: ChipType, flags?: number } ) {
    const obj = common( d, 0x74, val );
    if ( val?.chipType != null )
      d.setUint8( 0x78, val.chipType.value );

    if ( val?.flags != null )
      d.setUint8( 0x79, val.flags );

    // if ( obj ) {
    //   const t = d.getUint8( 0x78 );
    //   const flags = d.getUint8( 0x79 );
    //   return {
    //     ...obj,
    //     chipType: {
    //       value: t,
    //       name: ( ( t: number ) => {
    //         switch ( t ) {
    //           case 0x00:
    //             return "AY8910";
    //           case 0x01:
    //             return "AY8912";
    //           case 0x02:
    //             return "AY8913";
    //           case 0x03:
    //             return "AY8930";
    //           case 0x10:
    //             return "YM2149";
    //           case 0x11:
    //             return "YM3439";
    //           case 0x12:
    //             return "YMZ284";
    //           case 0x13:
    //             return "YMZ294";
    //           default:
    //             return "UNKNOWN";
    //         }
    //       } )( t )
    //     },
    //     flags
    //   };
    // }
  }

  /** @ignore */
  export function c140 ( d: DataView, val: ChipClock & { chipType?: ChipType } ) {
    const obj = common( d, 0xa8, val );
    if ( val?.chipType != null )
      d.setUint8( 0x96, val.chipType.value );

    // if ( obj ) {
    //   const t = d.getUint8( 0x96 );
    //   return {
    //     ...obj,
    //     chipType: {
    //       value: t,
    //       name: ( ( t: number ) => {
    //         switch ( t ) {
    //           case 0x00:
    //             return "C140, Namco System 2";
    //           case 0x01:
    //             return "C140, Namco System 21";
    //           case 0x02:
    //             return "219 ASIC, Namco NA-1/2";
    //           default:
    //             return "UNKNOWN";
    //         }
    //       } )( t )
    //     }
    //   };
    // }
  }

  /** @ignore */
  export function c352 ( d: DataView, val: ChipClock & { clockDivider?: number } ) {
    common( d, 0xdc, val );

    if ( val?.clockDivider != null )
      d.setUint8( 0xd6, val.clockDivider );
    // if ( obj ) {
    //   return {
    //     ...obj,
    //     clockDivider: d.getUint8( 0xd6 )
    //   };
    // }
  }
}

/** @ignore */
function strEncodeUTF16 ( str ) {
  var buf = new ArrayBuffer( str.length * 2 );
  var bufView = new Uint16Array( buf );
  for ( var i = 0, strLen = str.length; i < strLen; i++ ) {
    bufView[ i ] = str.charCodeAt( i );
  }
  return bufView;
}

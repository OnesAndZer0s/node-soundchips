import {
  VGM
} from "./packages/vgm-parser/src/index";

const vgm = VGM.Parse( "./unused.vgz" );
// vgm.commands.push( {} );
vgm.build();

console.log( "ASD" )
/* Iterative access for VGM commands */
// for ( const cmd in vgm ) {
//   console.log( cmd );
// }

// let index = 0;
// while ( true ) {
//   try {
//     const cmd = vgm.parseCommand( index );
//     console.log( cmd );
//     index += cmd.size;
//     if ( cmd instanceof VGMEndCommand ) break;
//   } catch ( e ) {
//     console.error( e );
//     break;
//   }
// }

// /* Access VGM commands as a list */
// const stream = vgm.getDataStream();
// for ( const cmd of stream.commands ) {
//   if ( cmd instanceof VGMWriteDataCommand ) {
//     console.log( cmd );
//   }
// }
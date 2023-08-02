export type ChipName =
  | "sn76489" | "gameGearStereo" | "ym2413" | "ym2612"
  | "ym2151" | "segaPcm" | "rf5c68" | "ym2203"
  | "ym2608" | "ym2610" | "ym3812" | "ym3526"
  | "y8950" | "ymf262" | "ymf278b" | "ymf271"
  | "ymz280b" | "rf5c164" | "pwm" | "ay8910"
  | "gameBoyDmg" | "nesApu" | "multiPcm" | "upd7759"
  | "okim6258" | "okim6295" | "k051649" | "k054539"
  | "huc6280" | "c140" | "k053260" | "pokey"
  | "qsound" | "scsp" | "wonderSwan" | "vsu"
  | "saa1099" | "es5503" | "es5506" | "x1_010"
  | "c352" | "ga20"
  | "unknown";

export type ChipType = {
  value: number;
  name: string;
};

export type ChipClock = {
  clock: number;
  dual?: boolean;
};

export type Chips = {
  sn76489?: ChipClock & {
    feedback?: number;
    shiftRegisterWidth?: number;
    flags?: number;
    t6w28?: boolean;
  };
  gameGearStereo?: null /* dummy */;
  ym2413?: ChipClock;
  ym2612?: ChipClock & { chipType?: ChipType };
  ym2151?: ChipClock & { chipType?: ChipType };
  segaPcm?: ChipClock & { interfaceRegister?: number };
  rf5c68?: ChipClock;
  ym2203?: ChipClock & { ssgFlags?: number };
  ym2608?: ChipClock & { ssgFlags?: number };
  ym2610?: ChipClock & { chipType?: ChipType };
  ym3812?: ChipClock;
  ym3526?: ChipClock;
  y8950?: ChipClock;
  ymf262?: ChipClock;
  ymf278b?: ChipClock;
  ymf271?: ChipClock;
  ymz280b?: ChipClock;
  rf5c164?: ChipClock;
  pwm?: ChipClock;
  ay8910?: ChipClock & {
    chipType?: ChipType;
    flags?: number;
  };
  gameBoyDmg?: ChipClock;
  nesApu?: ChipClock & { fds?: boolean };
  multiPcm?: ChipClock;
  upd7759?: ChipClock;
  okim6258?: ChipClock & { flags?: number };
  okim6295?: ChipClock;
  k051649?: ChipClock;
  k054539?: ChipClock & { flags?: number };
  huc6280?: ChipClock;
  c140?: ChipClock & { chipType?: ChipType };
  k053260?: ChipClock;
  pokey?: ChipClock;
  qsound?: ChipClock;
  scsp?: ChipClock;
  wonderSwan?: ChipClock;
  vsu?: ChipClock;
  saa1099?: ChipClock;
  es5503?: ChipClock & { numberOfChannels?: number };
  es5506?: ChipClock & { chipType?: ChipType; numberOfChannels?: number };
  x1_010?: ChipClock;
  c352?: ChipClock & { clockDivider?: number };
  ga20?: ChipClock;
  unknown?: null; // dummy
};

export type ExtraChipClock = {
  chip: ChipName;
  chipId: number;
  clock: number;
};
export type ExtraChipVolume = {
  chip: ChipName;
  chipId: number;
  paired: boolean;
  flags: number;
  volume: number;
  absolute: boolean;
};

export type ExtraHeader = {
  clocks?: Array<ExtraChipClock>;
  volumes?: Array<ExtraChipVolume>;
};

export type Version = {
  /** raw version code (ex. 0x0170) */
  code: number;
  /** major major version number in string (ex. "1"). */
  major: string;
  /** minor version number in 2 digit string (ex. "70").*/
  minor: string;
};

export type Offsets = {
  /** offset to end of file, relative from the top of the vgm file. */
  eof: number;
  /** offset to gd3 tag, relative from the top of the vgm file. 0 if no gd3 tag is present. */
  gd3: number;
  /** offset to loop point, relative from the top of the vgm file. 0 if no loop is present. */
  loop: number;
  /** offset to VGM data stream, relative from the top of the vgm file. */
  data: number;
  /** offset to extra header, relative from the top of the vgm file. 0 if no extra header is present. */
  extraHeader: number;
};

export type Samples = {
  /** Total of all wait values in the file. */
  total: number;
  /** Total of all wait values between the loop point and the end of the file, or 0 if there is no loop. */
  loop: number;
};

export type GD3Tag = {
  version: number;
  size: number;
  trackTitle: string;
  gameName: string;
  system: string;
  composer: string;
  releaseDate: string;
  vgmBy: string;
  notes: string;
  japanese: {
    trackTitle: string;
    gameName: string;
    system: string;
    composer: string;
  };
};
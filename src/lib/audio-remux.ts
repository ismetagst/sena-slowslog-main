const AAC_SAMPLE_RATES = [96000, 88200, 64000, 48000, 44100, 32000, 24000, 22050, 16000, 12000, 11025, 8000, 7350];

export interface AdtsFrameSet {
  frames: Uint8Array[];
  objectType: number;
  frequencyIndex: number;
  sampleRate: number;
  channelConfig: number;
  duration: number;
}

export const isAdtsAacBlob = async (blob: Blob) => {
  const head = new Uint8Array(await blob.slice(0, 2).arrayBuffer());
  return head.length >= 2 && head[0] === 0xff && (head[1] & 0xf0) === 0xf0;
};

const bytes = (...values: number[]) => Uint8Array.from(values);
const ascii = (value: string) => Uint8Array.from([...value].map((char) => char.charCodeAt(0)));
const u16 = (value: number) => bytes((value >>> 8) & 255, value & 255);
const u24 = (value: number) => bytes((value >>> 16) & 255, (value >>> 8) & 255, value & 255);
const u32 = (value: number) => bytes((value >>> 24) & 255, (value >>> 16) & 255, (value >>> 8) & 255, value & 255);
const descriptorLength = (value: number) => bytes(value & 0x7f);

const concatBytes = (...parts: Uint8Array[]) => {
  const output = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;
  parts.forEach((part) => {
    output.set(part, offset);
    offset += part.length;
  });
  return output;
};

const box = (type: string, ...payloads: Uint8Array[]) => {
  const body = concatBytes(...payloads);
  return concatBytes(u32(body.length + 8), ascii(type), body);
};

const fullBox = (type: string, version: number, flags: number, ...payloads: Uint8Array[]) =>
  box(type, bytes(version, (flags >>> 16) & 255, (flags >>> 8) & 255, flags & 255), ...payloads);

export const parseAdtsFrames = (input: Uint8Array, maxDurationSeconds: number): AdtsFrameSet => {
  const frames: Uint8Array[] = [];
  let offset = 0;
  let config: Omit<AdtsFrameSet, "frames" | "duration"> | null = null;

  while (offset + 7 <= input.length) {
    if (input[offset] !== 0xff || (input[offset + 1] & 0xf0) !== 0xf0) {
      offset += 1;
      continue;
    }

    const protectionAbsent = input[offset + 1] & 1;
    const profile = (input[offset + 2] & 0xc0) >> 6;
    const frequencyIndex = (input[offset + 2] & 0x3c) >> 2;
    const sampleRate = AAC_SAMPLE_RATES[frequencyIndex];
    const channelConfig = ((input[offset + 2] & 1) << 2) | ((input[offset + 3] & 0xc0) >> 6);
    const frameLength = ((input[offset + 3] & 3) << 11) | (input[offset + 4] << 3) | ((input[offset + 5] & 0xe0) >> 5);
    const headerLength = protectionAbsent ? 7 : 9;

    if (!sampleRate || frameLength <= headerLength || offset + frameLength > input.length) break;
    if (!config) config = { objectType: profile + 1, frequencyIndex, sampleRate, channelConfig };

    frames.push(input.slice(offset + headerLength, offset + frameLength));
    offset += frameLength;

    if (frames.length * 1024 / sampleRate >= maxDurationSeconds) break;
  }

  if (!config || frames.length === 0) throw new Error("AAC ADTS frames were not found");
  return { frames, ...config, duration: frames.length * 1024 / config.sampleRate };
};

const esdsBox = (config: AdtsFrameSet, bitrate: number) => {
  const audioSpecificConfig = (config.objectType << 11) | (config.frequencyIndex << 7) | (config.channelConfig << 3);
  const decoderSpecific = concatBytes(bytes(0x05), descriptorLength(2), u16(audioSpecificConfig));
  const slConfig = concatBytes(bytes(0x06), descriptorLength(1), bytes(0x02));
  const decoderConfigBody = concatBytes(bytes(0x40, 0x15), u24(0), u32(bitrate), u32(bitrate), decoderSpecific, slConfig);
  const decoderConfig = concatBytes(bytes(0x04), descriptorLength(decoderConfigBody.length), decoderConfigBody);
  const esDescriptorBody = concatBytes(u16(1), bytes(0), decoderConfig);
  const esDescriptor = concatBytes(bytes(0x03), descriptorLength(esDescriptorBody.length), esDescriptorBody);
  return fullBox("esds", 0, 0, esDescriptor);
};

const buildM4a = (config: AdtsFrameSet) => {
  const payloadSize = config.frames.reduce((total, frame) => total + frame.length, 0);
  const payload = concatBytes(...config.frames);
  const bitrate = Math.max(1, Math.round((payloadSize * 8) / config.duration));
  const sampleDuration = Math.round(config.frames.length * 1024);
  const movieTimescale = 1000;
  const movieDuration = Math.round(config.duration * movieTimescale);
  const ftyp = box("ftyp", ascii("M4A "), u32(0), ascii("M4A "), ascii("mp42"), ascii("isom"));
  const mdat = box("mdat", payload);
  const sampleSizes = concatBytes(...config.frames.map((frame) => u32(frame.length)));

  const makeMoov = (chunkOffset: number) => {
    const stsd = fullBox(
      "stsd",
      0,
      0,
      u32(1),
      box(
        "mp4a",
        bytes(0, 0, 0, 0, 0, 0),
        u16(1),
        u16(0), u16(0), u32(0),
        u16(config.channelConfig || 1), u16(16), u16(0), u16(0),
        u32(config.sampleRate * 65536),
        esdsBox(config, bitrate)
      )
    );
    const stbl = box(
      "stbl",
      stsd,
      fullBox("stts", 0, 0, u32(1), u32(config.frames.length), u32(1024)),
      fullBox("stsc", 0, 0, u32(1), u32(1), u32(config.frames.length), u32(1)),
      fullBox("stsz", 0, 0, u32(0), u32(config.frames.length), sampleSizes),
      fullBox("stco", 0, 0, u32(1), u32(chunkOffset))
    );
    const minf = box("minf", fullBox("smhd", 0, 0, u16(0), u16(0)), box("dinf", fullBox("dref", 0, 0, u32(1), fullBox("url ", 0, 1))), stbl);
    const mdia = box("mdia", fullBox("mdhd", 0, 0, u32(0), u32(0), u32(config.sampleRate), u32(sampleDuration), u16(0x55c4), u16(0)), fullBox("hdlr", 0, 0, u32(0), ascii("soun"), u32(0), u32(0), u32(0), bytes(0)), minf);
    const tkhd = fullBox("tkhd", 0, 7, u32(0), u32(0), u32(1), u32(0), u32(movieDuration), u32(0), u32(0), u16(0), u16(0), u16(0x0100), u16(0), u32(0x00010000), u32(0), u32(0), u32(0), u32(0x00010000), u32(0), u32(0), u32(0), u32(0x40000000), u32(0), u32(0));
    const mvhd = fullBox("mvhd", 0, 0, u32(0), u32(0), u32(movieTimescale), u32(movieDuration), u32(0x00010000), u16(0x0100), u16(0), u32(0), u32(0), u32(0x00010000), u32(0), u32(0), u32(0), u32(0x00010000), u32(0), u32(0), u32(0), u32(0x40000000), u32(0), u32(0), u32(0), u32(0), u32(0), u32(0), u32(2));
    return box("moov", mvhd, box("trak", tkhd, mdia));
  };

  let moov = makeMoov(0);
  moov = makeMoov(ftyp.length + moov.length + 8);
  return concatBytes(ftyp, moov, mdat);
};

export const remuxAdtsAacToM4a = async (blob: Blob, maxDurationSeconds: number) => {
  const frames = parseAdtsFrames(new Uint8Array(await blob.arrayBuffer()), maxDurationSeconds);
  const output = buildM4a(frames);
  return {
    blob: new Blob([output], { type: "audio/mp4" }),
    duration: frames.duration,
    sampleRate: frames.sampleRate,
    channels: frames.channelConfig,
    frameCount: frames.frames.length,
  };
};
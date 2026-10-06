const zlib = require("zlib");

// Draws a small receipt-like PNG (a header bar, lines of "text", a total)
// without any image library, so the demo data has a real uploaded receipt to
// open and review. Sample data only (spec section 21.8): nothing on it is real.

const W = 240, H = 340;

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function samplePng() {
  const px = Buffer.alloc(W * H * 3, 0xff); // white
  const rect = (x, y, w, h, [r, g, b]) => {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) {
      const o = (j * W + i) * 3; px[o] = r; px[o + 1] = g; px[o + 2] = b;
    }
  };
  rect(0, 0, W, 46, [47, 111, 237]);                 // store header
  rect(70, 16, 100, 12, [255, 255, 255]);            // store name
  const lines = [[20, 70, 150], [20, 92, 120], [20, 114, 170], [20, 136, 100], [20, 158, 140], [20, 180, 90]];
  for (const [x, y, w] of lines) { rect(x, y, w, 8, [190, 196, 208]); rect(W - 60, y, 40, 8, [190, 196, 208]); }
  for (let i = 20; i < W - 20; i += 8) rect(i, 206, 4, 2, [150, 156, 170]); // dashed rule
  rect(20, 224, 70, 12, [15, 30, 70]);               // TOTAL
  rect(W - 90, 224, 70, 12, [15, 30, 70]);           // amount
  for (let i = 0; i < 26; i++) rect(30 + i * 7, 270, i % 3 ? 3 : 5, 40, [40, 40, 40]); // barcode

  const raw = Buffer.alloc((W * 3 + 1) * H);
  for (let y = 0; y < H; y++) {
    raw[y * (W * 3 + 1)] = 0; // no filter
    px.copy(raw, y * (W * 3 + 1) + 1, y * W * 3, (y + 1) * W * 3);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0; // 8-bit RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

module.exports = { samplePng };

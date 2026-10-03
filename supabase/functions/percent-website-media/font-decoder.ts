import { create } from 'npm:fontkit@2.0.4'
import { Buffer } from 'node:buffer'
import { brotliDecompressSync } from 'node:zlib'
import { woff2CompressedBlock } from './font-validation.ts'

export function decodeWoff2(bytes:Uint8Array) {
  const block=woff2CompressedBlock(bytes)
  // Bound actual decompression, not just the untrusted SFNT header declaration.
  const expanded=brotliDecompressSync(Buffer.from(bytes.subarray(block.offset,block.offset+block.length)),{maxOutputLength:20*1024*1024})
  if(expanded.length!==block.expected)throw new Error('Invalid font stream size.')
  const font=create(Buffer.from(bytes))
  if(!Number.isInteger(font.numGlyphs)||font.numGlyphs<1||font.numGlyphs>65535||font.unitsPerEm<1||font.unitsPerEm>16384)throw new Error('Invalid font metrics.')
  for(const glyph of font.layout('Percent 0123456789').glyphs)void glyph.path.commands
}

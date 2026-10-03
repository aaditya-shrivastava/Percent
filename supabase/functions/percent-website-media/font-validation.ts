export const FONT_LIMIT = 2 * 1024 * 1024
export const fontUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
export type FontStyle = 'normal' | 'italic'
export type ManagedFontFace = {weight:number;style:FontStyle;storage_path:string;mime_type:'font/woff2';byte_size:number;sha256:string}

export function validateFontTarget(family:string, weight:number, style:string) {
  if (!fontUuid.test(family) || !Number.isInteger(weight) || weight < 100 || weight > 900 || weight % 100 !== 0 || !['normal', 'italic'].includes(style)) throw new Error('Choose a valid family, weight and style.')
}

export function validateWoff2Header(bytes:Uint8Array) {
  if (bytes.length > FONT_LIMIT) throw new Error('Font files must be 2 MB or smaller.')
  if (bytes.length < 48 || ![119,79,70,50].every((value,index) => bytes[index] === value)) throw new Error('Select a valid WOFF2 font.')
  const header = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const flavor = header.getUint32(4)
  if (![0x00010000,0x4f54544f].includes(flavor) || header.getUint32(8) !== bytes.length || header.getUint16(14) !== 0) throw new Error('The WOFF2 header is invalid.')
  const tables = header.getUint16(12), expanded = header.getUint32(16), compressed = header.getUint32(20)
  if (tables < 1 || tables > 128 || expanded < 12 + tables * 16 || expanded > 20 * 1024 * 1024 || compressed < 1 || compressed > bytes.length - 48) throw new Error('The WOFF2 content exceeds supported limits.')
  // Check the optional blocks too; do not silently ignore out-of-bounds metadata.
  for (const [offsetIndex,lengthIndex] of [[28,32],[40,44]]) {
    const offset = header.getUint32(offsetIndex), length = header.getUint32(lengthIndex)
    if ((!offset !== !length) || (offset && (offset < 48 || offset + length > bytes.length))) throw new Error('The WOFF2 contains an invalid optional block.')
  }
}

export function woff2CompressedBlock(bytes:Uint8Array) {
  validateWoff2Header(bytes)
  const header = new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength)
  let offset=48, expected=0
  const base128=()=>{
    let value=0
    for(let i=0;i<5;i++){
      if(offset>=bytes.length)throw new Error('Invalid WOFF2 directory.')
      const byte=bytes[offset++]
      if((i===0&&byte===128)||(value&0xfe000000)!==0)throw new Error('Invalid WOFF2 directory.')
      value=value*128+(byte&127)
      if(!(byte&128))return value
    }
    throw new Error('Invalid WOFF2 directory.')
  }
  for(let i=0;i<header.getUint16(12);i++){
    if(offset>=bytes.length)throw new Error('Invalid WOFF2 directory.')
    const flags=bytes[offset++],tag=flags&63,transform=flags>>6
    if(tag===63)offset+=4
    const original=base128()
    const transformed=(tag===10||tag===11)?transform!==3:transform!==0
    expected+=transformed?base128():original
    if(expected>20*1024*1024)throw new Error('Expanded font exceeds supported limits.')
  }
  const length=header.getUint32(20)
  if(offset+length>bytes.length||expected<1)throw new Error('Invalid WOFF2 compressed stream.')
  return {offset,length,expected}
}

export async function validateFontUpload(file:File, family:string, weight:number, style:string, decode:(bytes:Uint8Array)=>void):Promise<ManagedFontFace> {
  validateFontTarget(family, weight, style)
  if (!file.name.toLowerCase().endsWith('.woff2') || file.type !== 'font/woff2') throw new Error('Choose a WOFF2 file with font/woff2 MIME type.')
  if (file.size > FONT_LIMIT) throw new Error('Font files must be 2 MB or smaller.')
  const bytes = new Uint8Array(await file.arrayBuffer())
  validateWoff2Header(bytes)
  try { decode(bytes) } catch { throw new Error('This WOFF2 file could not be decoded. Choose a valid webfont.') }
  const sha256 = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(value=>value.toString(16).padStart(2,'0')).join('')
  return {weight,style:style as FontStyle,storage_path:`fonts/${family}/${weight}-${style}-${sha256}.woff2`,mime_type:'font/woff2',byte_size:bytes.length,sha256}
}

export function isCanonicalFontFace(family:string, face:ManagedFontFace) {
  try { validateFontTarget(family,face.weight,face.style) } catch { return false }
  return /^[0-9a-f]{64}$/.test(face.sha256) && face.mime_type === 'font/woff2' && Number.isInteger(face.byte_size) && face.byte_size >= 48 && face.byte_size <= FONT_LIMIT && face.storage_path === `fonts/${family}/${face.weight}-${face.style}-${face.sha256}.woff2`
}

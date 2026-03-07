import { Type, type Token } from '../token.js'
import { encodeCustom } from '../encode.js'
import { encodeErrPrefix } from '../common.js'
import { asU8A, fromString } from '../byte-utils.js'
import type { EncodeOptions, ByteWriter } from '../interface.js'

class JSONEncoder extends Array {
  inRecursive: { type: Type; elements: number }[]

  constructor() {
    super()
    this.inRecursive = []
  }

  prefix(buf: ByteWriter): void {
    const recurs = this.inRecursive[this.inRecursive.length - 1]
    if (recurs) {
      if (Type.equals(recurs.type, Type.array)) {
        recurs.elements++
        if (recurs.elements !== 1) {
          // >first
          buf.push([44]) // ','
        }
      }
      if (Type.equals(recurs.type, Type.map)) {
        recurs.elements++
        if (recurs.elements !== 1) {
          // >first
          if (recurs.elements % 2 === 1) {
            // key
            buf.push([44]) // ','
          } else {
            buf.push([58]) // ':'
          }
        }
      }
    }
  }

  [Type.uint.major](buf: ByteWriter, token: Token): void {
    this.prefix(buf)
    const is = String(token.value)
    const isa = []
    for (let i = 0; i < is.length; i++) {
      isa[i] = is.charCodeAt(i)
    }
    buf.push(isa)
  }

  [Type.negint.major](buf: ByteWriter, token: Token): void {
    // @ts-ignore hack
    this[Type.uint.major](buf, token)
  }

  [Type.bytes.major](_buf: ByteWriter, _token: Token): void {
    throw new Error(`${encodeErrPrefix} unsupported type: Uint8Array`)
  }

  [Type.string.major](buf: ByteWriter, token: Token): void {
    this.prefix(buf)
    // buf.push(34) // '"'
    // encodeUtf8(token.value, byts)
    // buf.push(34) // '"'
    const byts = fromString(JSON.stringify(token.value))
    buf.push(byts.length > 32 ? asU8A(byts) : byts)
  }

  [Type.array.major](buf: ByteWriter, _token: Token): void {
    this.prefix(buf)
    this.inRecursive.push({ type: Type.array, elements: 0 })
    buf.push([91]) // '['
  }

  [Type.map.major](buf: ByteWriter, _token: Token): void {
    this.prefix(buf)
    this.inRecursive.push({ type: Type.map, elements: 0 })
    buf.push([123]) // '{'
  }

  [Type.tag.major](_buf: ByteWriter, _token: Token): void {}

  [Type.float.major](buf: ByteWriter, token: Token): void {
    if (token.type.name === 'break') {
      const recurs = this.inRecursive.pop()
      if (recurs) {
        if (Type.equals(recurs.type, Type.array)) {
          buf.push([93]) // ']'
        } else if (Type.equals(recurs.type, Type.map)) {
          buf.push([125]) // '}'
          /* c8 ignore next 3 */
        } else {
          throw new Error('Unexpected recursive type; this should not happen!')
        }
        return
      }
      /* c8 ignore next 2 */
      throw new Error('Unexpected break; this should not happen!')
    }
    if (token.value === undefined) {
      throw new Error(`${encodeErrPrefix} unsupported type: undefined`)
    }

    this.prefix(buf)
    if (token.type.name === 'true') {
      buf.push([116, 114, 117, 101]) // 'true'
      return
    } else if (token.type.name === 'false') {
      buf.push([102, 97, 108, 115, 101]) // 'false'
      return
    } else if (token.type.name === 'null') {
      buf.push([110, 117, 108, 108]) // 'null'
      return
    }

    // number
    const is = String(token.value)
    const isa = []
    let dp = false
    for (let i = 0; i < is.length; i++) {
      isa[i] = is.charCodeAt(i)
      if (!dp && (isa[i] === 46 || isa[i] === 101 || isa[i] === 69)) {
        // '[.eE]'
        dp = true
      }
    }
    if (!dp) {
      // need a decimal point for floats
      isa.push(46) // '.'
      isa.push(48) // '0'
    }
    buf.push(isa)
  }
}

/**
 * @param {(Token|Token[])[]} e1
 * @param {(Token|Token[])[]} e2
 * @returns {number}
 */
function mapSorter(e1: (Token | Token[])[], e2: (Token | Token[])[]): number {
  if (Array.isArray(e1[0]) || Array.isArray(e2[0])) {
    throw new Error(`${encodeErrPrefix} complex map keys are not supported`)
  }
  const keyToken1 = e1[0]
  const keyToken2 = e2[0]
  if (keyToken1.type !== Type.string || keyToken2.type !== Type.string) {
    throw new Error(`${encodeErrPrefix} non-string map keys are not supported`)
  }
  if (keyToken1 < keyToken2) {
    return -1
  }
  if (keyToken1 > keyToken2) {
    return 1
  }
  /* c8 ignore next 1 */
  throw new Error(`${encodeErrPrefix} unexpected duplicate map keys, this is not supported`)
}

const defaultEncodeOptions = { addBreakTokens: true, mapSorter }

/**
 * @param {any} data
 * @param {EncodeOptions} [options]
 * @returns {Uint8Array}
 */
function encode(data: any, options: EncodeOptions): Uint8Array {
  options = Object.assign({}, defaultEncodeOptions, options)
  // @ts-ignore TokenTypeEncoder[] requires compareTokens() on each encoder, we don't use them here
  return encodeCustom(data, new JSONEncoder(), options)
}

export { encode }

import { Token, Type } from './token.js'
import * as uint from './0uint.js'
import type { Bl } from './bl.js'
import type { DecodeOptions } from './interface.js'

/**
 * @param {Uint8Array} _data
 * @param {number} _pos
 * @param {number} minor
 * @param {DecodeOptions} _options
 * @returns {Token}
 */
export function decodeTagCompact(_data: Uint8Array, _pos: number, minor: number, _options: DecodeOptions): Token {
  return new Token(Type.tag, minor, 1)
}

/**
 * @param {Uint8Array} data
 * @param {number} pos
 * @param {number} _minor
 * @param {DecodeOptions} options
 * @returns {Token}
 */
export function decodeTag8(data: Uint8Array, pos: number, _minor: number, options: DecodeOptions): Token {
  return new Token(Type.tag, uint.readUint8(data, pos + 1, options), 2)
}

/**
 * @param {Uint8Array} data
 * @param {number} pos
 * @param {number} _minor
 * @param {DecodeOptions} options
 * @returns {Token}
 */
export function decodeTag16(data: Uint8Array, pos: number, _minor: number, options: DecodeOptions): Token {
  return new Token(Type.tag, uint.readUint16(data, pos + 1, options), 3)
}

/**
 * @param {Uint8Array} data
 * @param {number} pos
 * @param {number} _minor
 * @param {DecodeOptions} options
 * @returns {Token}
 */
export function decodeTag32(data: Uint8Array, pos: number, _minor: number, options: DecodeOptions): Token {
  return new Token(Type.tag, uint.readUint32(data, pos + 1, options), 5)
}

/**
 * @param {Uint8Array} data
 * @param {number} pos
 * @param {number} _minor
 * @param {DecodeOptions} options
 * @returns {Token}
 */
export function decodeTag64(data: Uint8Array, pos: number, _minor: number, options: DecodeOptions): Token {
  return new Token(Type.tag, uint.readUint64(data, pos + 1, options), 9)
}

/**
 * @param {Bl} buf
 * @param {Token} token
 */
export function encodeTag(buf: Bl, token: Token) {
  uint.encodeUintValue(buf, Type.tag.majorEncoded, token.value)
}

encodeTag.compareTokens = uint.encodeUint.compareTokens

/**
 * @param {Token} token
 * @returns {number}
 */
encodeTag.encodedSize = function encodedSize(token: Token): number {
  return uint.encodeUintValue.encodedSize(token.value)
}

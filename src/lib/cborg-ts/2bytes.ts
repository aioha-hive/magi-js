import { Token, Type } from './token.js'
import { assertEnoughData, decodeErrPrefix } from './common.js'
import * as uint from './0uint.js'
import { compare, fromString, slice } from './byte-utils.js'
import type { Bl } from './bl.js'
import type { DecodeOptions } from './interface.js'

/**
 * @param {Uint8Array} data
 * @param {number} pos
 * @param {number} prefix
 * @param {number} length
 * @returns {Token}
 */
function toToken(data: Uint8Array, pos: number, prefix: number, length: number): Token {
  assertEnoughData(data, pos, prefix + length)
  const buf = slice(data, pos + prefix, pos + prefix + length)
  return new Token(Type.bytes, buf, prefix + length)
}

/**
 * @param {Uint8Array} data
 * @param {number} pos
 * @param {number} minor
 * @param {DecodeOptions} _options
 * @returns {Token}
 */
export function decodeBytesCompact(data: Uint8Array, pos: number, minor: number, _options: DecodeOptions): Token {
  return toToken(data, pos, 1, minor)
}

/**
 * @param {Uint8Array} data
 * @param {number} pos
 * @param {number} _minor
 * @param {DecodeOptions} options
 * @returns {Token}
 */
export function decodeBytes8(data: Uint8Array, pos: number, _minor: number, options: DecodeOptions): Token {
  return toToken(data, pos, 2, uint.readUint8(data, pos + 1, options))
}

/**
 * @param {Uint8Array} data
 * @param {number} pos
 * @param {number} _minor
 * @param {DecodeOptions} options
 * @returns {Token}
 */
export function decodeBytes16(data: Uint8Array, pos: number, _minor: number, options: DecodeOptions): Token {
  return toToken(data, pos, 3, uint.readUint16(data, pos + 1, options))
}

/**
 * @param {Uint8Array} data
 * @param {number} pos
 * @param {number} _minor
 * @param {DecodeOptions} options
 * @returns {Token}
 */
export function decodeBytes32(data: Uint8Array, pos: number, _minor: number, options: DecodeOptions): Token {
  return toToken(data, pos, 5, uint.readUint32(data, pos + 1, options))
}

// TODO: maybe we shouldn't support this ..
/**
 * @param {Uint8Array} data
 * @param {number} pos
 * @param {number} _minor
 * @param {DecodeOptions} options
 * @returns {Token}
 */
export function decodeBytes64(data: Uint8Array, pos: number, _minor: number, options: DecodeOptions): Token {
  const l = uint.readUint64(data, pos + 1, options)
  if (typeof l === 'bigint') {
    throw new Error(`${decodeErrPrefix} 64-bit integer bytes lengths not supported`)
  }
  return toToken(data, pos, 9, l)
}

/**
 * `encodedBytes` allows for caching when we do a byte version of a string
 * for key sorting purposes
 * @param {Token} token
 * @returns {Uint8Array}
 */
function tokenBytes(token: Token): Uint8Array {
  if (token.encodedBytes === undefined) {
    token.encodedBytes = token.type === Type.string ? fromString(token.value) : token.value
  }
  // @ts-ignore c'mon
  return token.encodedBytes
}

/**
 * @param {Bl} buf
 * @param {Token} token
 */
export function encodeBytes(buf: Bl, token: Token) {
  const bytes = tokenBytes(token)
  uint.encodeUintValue(buf, token.type.majorEncoded, bytes.length)
  buf.push(bytes)
}

/**
 * @param {Token} token
 * @returns {number}
 */
encodeBytes.encodedSize = function encodedSize(token: Token): number {
  const bytes = tokenBytes(token)
  return uint.encodeUintValue.encodedSize(bytes.length) + bytes.length
}

/**
 * @param {Token} tok1
 * @param {Token} tok2
 * @returns {number}
 */
encodeBytes.compareTokens = function compareTokens(tok1: Token, tok2: Token): number {
  return compareBytes(tokenBytes(tok1), tokenBytes(tok2))
}

/**
 * @param {Uint8Array} b1
 * @param {Uint8Array} b2
 * @returns {number}
 */
export function compareBytes(b1: Uint8Array, b2: Uint8Array): number {
  return b1.length < b2.length ? -1 : b1.length > b2.length ? 1 : compare(b1, b2)
}

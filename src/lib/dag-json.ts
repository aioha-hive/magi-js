/* eslint max-depth: ["error", 7] */
import { Token, Type } from './cborg-ts/token.js'
import { encode as cborgEnc } from './cborg-ts/json/encode.js'
import type { ToString } from 'multiformats'
import type { ArrayBufferView, ByteView } from 'multiformats/codecs/interface'
import { CID } from 'multiformats'
import { base64 } from 'multiformats/bases/base64'

/**
 * @template T
 * @param {ByteView<T> | ArrayBufferView<T>} buf
 * @returns {ByteView<T>}
 */
function toByteView<T>(buf: ByteView<T> | ArrayBufferView<T>): ByteView<T> {
  if (buf instanceof ArrayBuffer) {
    return new Uint8Array(buf, 0, buf.byteLength)
  }

  return buf
}

/**
 * cidEncoder will receive all Objects during encode, it needs to filter out
 * anything that's not a CID and return `null` for that so it's encoded as
 * normal. Encoding a CID means replacing it with a `{"/":"<CidString>}`
 * object as per the DAG-JSON spec.
 *
 * @param {any} obj
 * @returns {Token[]|null}
 */
function cidEncoder(obj: any): Token[] | null {
  if (obj.asCID !== obj && obj['/'] !== obj.bytes) {
    return null // any other kind of object
  }
  const cid = CID.asCID(obj)
  /* c8 ignore next 4 */
  // very unlikely case, and it'll probably throw a recursion error in cborg
  if (!cid) {
    return null
  }
  const cidString = cid.toString()

  return [
    new Token(Type.map, Infinity, 1),
    new Token(Type.string, '/', 1), // key
    new Token(Type.string, cidString, cidString.length), // value
    new Token(Type.break, undefined, 1)
  ]
}

/**
 * bytesEncoder will receive all Uint8Arrays (and friends) during encode, it
 * needs to replace it with a `{"/":{"bytes":"Base64ByteString"}}` object as
 * per the DAG-JSON spec.
 *
 * @param {Uint8Array} bytes
 * @returns {Token[]|null}
 */
function bytesEncoder(bytes: Uint8Array): Token[] | null {
  const bytesString = base64.encode(bytes).slice(1) // no mbase prefix
  return [
    new Token(Type.map, Infinity, 1),
    new Token(Type.string, '/', 1), // key
    new Token(Type.map, Infinity, 1), // value
    new Token(Type.string, 'bytes', 5), // inner key
    new Token(Type.string, bytesString, bytesString.length), // inner value
    new Token(Type.break, undefined, 1),
    new Token(Type.break, undefined, 1)
  ]
}

/**
 * taBytesEncoder wraps bytesEncoder() but for the more exotic typed arrays so
 * that we access the underlying ArrayBuffer data
 *
 * @param {Int8Array|Uint16Array|Int16Array|Uint32Array|Int32Array|Float32Array|Float64Array|Uint8ClampedArray|BigInt64Array|BigUint64Array} obj
 * @returns {Token[]|null}
 */
function taBytesEncoder(
  obj:
    | Int8Array
    | Uint16Array
    | Int16Array
    | Uint32Array
    | Int32Array
    | Float32Array
    | Float64Array
    | Uint8ClampedArray
    | BigInt64Array
    | BigUint64Array
): Token[] | null {
  return bytesEncoder(new Uint8Array(obj.buffer, obj.byteOffset, obj.byteLength))
}

/**
 * abBytesEncoder wraps bytesEncoder() but for plain ArrayBuffers
 *
 * @param {ArrayBuffer} ab
 * @returns {Token[]|null}
 */
function abBytesEncoder(ab: ArrayBuffer): Token[] | null {
  return bytesEncoder(new Uint8Array(ab))
}

// eslint-disable-next-line jsdoc/require-returns-check
/**
 * Intercept all `undefined` values from an object walk and reject the entire
 * object if we find one.
 *
 * @returns {null}
 */
function undefinedEncoder(): null {
  throw new Error('`undefined` is not supported by the IPLD Data Model and cannot be encoded')
}

/**
 * Intercept all `number` values from an object walk and reject the entire
 * object if we find something that doesn't fit the IPLD data model (NaN &
 * Infinity).
 *
 * @param {number} num
 * @returns {null}
 */
function numberEncoder(num: number): null {
  if (Number.isNaN(num)) {
    throw new Error('`NaN` is not supported by the IPLD Data Model and cannot be encoded')
  }
  if (num === Infinity || num === -Infinity) {
    throw new Error('`Infinity` and `-Infinity` is not supported by the IPLD Data Model and cannot be encoded')
  }
  return null // process with standard number encoder
}

const encodeOptions = {
  typeEncoders: {
    Object: cidEncoder,
    Buffer: bytesEncoder,
    Uint8Array: bytesEncoder,
    Int8Array: taBytesEncoder,
    Uint16Array: taBytesEncoder,
    Int16Array: taBytesEncoder,
    Uint32Array: taBytesEncoder,
    Int32Array: taBytesEncoder,
    Float32Array: taBytesEncoder,
    Float64Array: taBytesEncoder,
    Uint8ClampedArray: taBytesEncoder,
    BigInt64Array: taBytesEncoder,
    BigUint64Array: taBytesEncoder,
    DataView: taBytesEncoder,
    ArrayBuffer: abBytesEncoder,
    undefined: undefinedEncoder,
    number: numberEncoder
  }
}

/**
 * @template T
 * @param {T} node
 * @returns {ByteView<T>}
 */
export const encode = <T>(node: T): ByteView<T> => cborgEnc(node, encodeOptions)

/**
 * @template T
 * @param {T} node
 * @returns {ToString<T>}
 */
export const format = <T>(node: T): ToString<T> => utf8Decoder.decode(encode(node))
export { format as stringify }
const utf8Decoder = new TextDecoder()

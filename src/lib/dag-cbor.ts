import { encode as cborgEnc } from './cborg-ts/encode.js'
import { Token, Type } from './cborg-ts/token.js'
import { ByteView, ArrayBufferView } from 'multiformats/codecs/interface'
import { CID } from 'multiformats/cid'

// https://github.com/ipfs/go-ipfs/issues/3570#issuecomment-273931692
const CID_CBOR_TAG = 42

/**
 * @template T
 * @param {ByteView<T> | ArrayBufferView<T>} buf
 * @returns {ByteView<T>}
 */
export function toByteView<T>(buf: ByteView<T> | ArrayBufferView<T>): ByteView<T> {
  if (buf instanceof ArrayBuffer) {
    return new Uint8Array(buf, 0, buf.byteLength)
  }

  return buf
}

/**
 * cidEncoder will receive all Objects during encode, it needs to filter out
 * anything that's not a CID and return `null` for that so it's encoded as
 * normal.
 *
 * @param {any} obj
 * @returns {cborg.Token[]|null}
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
  const bytes = new Uint8Array(cid.bytes.byteLength + 1)
  bytes.set(cid.bytes, 1) // prefix is 0x00, for historical reasons
  return [new Token(Type.tag, CID_CBOR_TAG), new Token(Type.bytes, bytes)]
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
  return null
}

/**
 * @param {Map<any, any>} map
 * @returns {null}
 */
function mapEncoder(map: Map<any, any>): null {
  for (const key of map.keys()) {
    if (typeof key !== 'string' || key.length === 0) {
      throw new Error('Non-string Map keys are not supported by the IPLD Data Model and cannot be encoded')
    }
  }
  return null
}

const _encodeOptions = {
  float64: true,
  typeEncoders: {
    Map: mapEncoder,
    Object: cidEncoder,
    undefined: undefinedEncoder,
    number: numberEncoder
  }
}

export const encodeOptions = {
  ..._encodeOptions,
  typeEncoders: {
    ..._encodeOptions.typeEncoders
  }
}

export const name = 'dag-cbor'
export const code = 0x71

/**
 * @template T
 * @param {T} node
 * @returns {ByteView<T>}
 */
export const encode = <T>(node: T): ByteView<T> => cborgEnc(node, _encodeOptions)

import { Type, Token } from './token.js'
import type { TagDecoder } from './interface.js'
import { jump, quick } from './jump.js'
import { decodeErrPrefix } from './common.js'

export interface DecodeTokenizer {
  done(): boolean
  next(): Token
  pos(): number
}

export interface DecodeOptions {
  allowIndefinite?: boolean
  allowUndefined?: boolean
  coerceUndefinedToNull?: boolean
  allowInfinity?: boolean
  allowNaN?: boolean
  allowBigInt?: boolean
  strict?: boolean
  useMaps?: boolean
  rejectDuplicateMapKeys?: boolean
  retainStringBytes?: boolean
  tags?: TagDecoder[]
  tokenizer?: DecodeTokenizer
  visitor?: (path: string[], value: unknown) => void
}

const defaultDecodeOptions = {
  strict: false,
  allowIndefinite: true,
  allowUndefined: true,
  allowBigInt: true
}

class Tokeniser implements DecodeTokenizer {
  _pos: number
  data: Uint8Array
  options: DecodeOptions

  constructor(data: Uint8Array, options: DecodeOptions = {}) {
    this._pos = 0
    this.data = data
    this.options = options
  }

  pos() {
    return this._pos
  }

  done() {
    return this._pos >= this.data.length
  }

  next() {
    const byt = this.data[this._pos]
    let token = quick[byt]
    if (token === undefined) {
      const decoder = jump[byt]
      /* c8 ignore next 4 */
      // if we're here then there's something wrong with our jump or quick lists!
      if (!decoder) {
        throw new Error(`${decodeErrPrefix} no decoder for major type ${byt >>> 5} (byte 0x${byt.toString(16).padStart(2, '0')})`)
      }
      const minor = byt & 31
      token = decoder(this.data, this._pos, minor, this.options)
    }
    // @ts-ignore we get to assume encodedLength is set (crossing fingers slightly)
    this._pos += token.encodedLength
    return token
  }
}

const DONE = Symbol.for('DONE')
const BREAK = Symbol.for('BREAK')
export const EMPTY_ARRAY = Symbol.for('EMPTY_ARRAY')

function tokenToArray(
  token: Token,
  tokeniser: DecodeTokenizer,
  options: DecodeOptions,
  path: string[],
  ignoreToken: boolean = false
): unknown[] | Record<string, unknown> {
  const arr: unknown[] = []
  for (let i = 0; i < token.value; i++) {
    const value = tokensToObject(tokeniser, options, [...path, `_${i}_`], ignoreToken)
    if (value === BREAK) {
      if (token.value === Infinity) {
        // normal end to indefinite length array
        break
      }
      throw new Error(`${decodeErrPrefix} got unexpected break to lengthed array`)
    }
    if (value === DONE) {
      throw new Error(`${decodeErrPrefix} found array but not enough entries (got ${i}, expected ${token.value})`)
    }
    arr[i] = value
  }
  if (arr.length === 0 && !ignoreToken) {
    options.visitor?.(path, EMPTY_ARRAY)
  }
  const isObjArray = arr.some((val) => typeof val === 'object')
  if (isObjArray) {
    const res: Record<string, unknown> = {}
    for (let i = 0; i < arr.length; i++) {
      res[`_${i}_`] = arr[i]
    }
    return res
  }
  return arr
}

function tokenToMap(
  token: Token,
  tokeniser: DecodeTokenizer,
  options: DecodeOptions,
  path: string[],
  ignoreToken: boolean = false
): Record<any, unknown> | Map<string, unknown> {
  const useMaps = options.useMaps === true
  const obj: Record<string, unknown> = {}
  const m = useMaps ? new Map<string, unknown>() : undefined
  for (let i = 0; i < token.value; i++) {
    const key = tokensToObject(tokeniser, options, path, true)
    if (key === BREAK) {
      if (token.value === Infinity) {
        // normal end to indefinite length map
        break
      }
      throw new Error(`${decodeErrPrefix} got unexpected break to finite map`)
    }
    if (key === DONE) {
      throw new Error(`${decodeErrPrefix} found map but not enough entries (got ${i} [no key], expected ${token.value})`)
    }
    if (useMaps !== true && typeof key !== 'string') {
      throw new Error(`${decodeErrPrefix} non-string keys not supported (got ${typeof key})`)
    }
    if (options.rejectDuplicateMapKeys === true) {
      // @ts-ignore
      if ((useMaps && m.has(key)) || (!useMaps && key in obj)) {
        throw new Error(`${decodeErrPrefix} found repeat map key "${key}"`)
      }
    }
    if (typeof key !== 'string') {
      throw new Error('key in map is not type string, got: ' + typeof key)
    }
    const value = tokensToObject(tokeniser, options, [...path, key], ignoreToken)
    if (value === DONE) {
      throw new Error(`${decodeErrPrefix} found map but not enough entries (got ${i} [no value], expected ${token.value})`)
    }
    if (useMaps) {
      // @ts-ignore
      m.set(key, value)
    } else {
      obj[key] = value
    }
  }
  // @ts-ignore
  return useMaps ? m : obj
}

function tokensToObject(
  tokeniser: DecodeTokenizer,
  options: DecodeOptions,
  path: string[] = [],
  ignoreToken: boolean = false
): unknown | typeof BREAK | typeof DONE {
  // should we support array as an argument?
  // check for tokenIter[Symbol.iterator] and replace tokenIter with what that returns?
  if (tokeniser.done()) {
    return DONE
  }

  const token = tokeniser.next()

  if (token.type === Type.break) {
    return BREAK
  }

  if (token.type.terminal) {
    if (!ignoreToken) {
      options.visitor?.(path, token.value)
    }
    return token.value
  }

  if (token.type === Type.array || token.type.major === 4) {
    return tokenToArray(token, tokeniser, options, path, ignoreToken)
  }

  if (token.type === Type.map || token.type.major === 5) {
    return tokenToMap(token, tokeniser, options, path, ignoreToken)
  }

  if (token.type === Type.tag) {
    if (options.tags && typeof options.tags[token.value] === 'function') {
      const tagged = tokensToObject(tokeniser, options, path, true)
      const res = options.tags[token.value](tagged)
      if (!ignoreToken) {
        options.visitor?.(path, res)
      }
      return res
    }
    throw new Error(`${decodeErrPrefix} tag not supported (${token.value})`)
  }
  // console.log(token)
  /* c8 ignore next */
  throw new Error('unsupported')
}

function decodeFirst(data: Uint8Array, options: DecodeOptions): [unknown, Uint8Array] {
  if (!(data instanceof Uint8Array)) {
    throw new Error(`${decodeErrPrefix} data to decode must be a Uint8Array`)
  }
  options = Object.assign({}, defaultDecodeOptions, options)
  const tokeniser = options.tokenizer || new Tokeniser(data, options)
  const decoded = tokensToObject(tokeniser, options)
  if (decoded === DONE) {
    throw new Error(`${decodeErrPrefix} did not find any content to decode`)
  }
  if (decoded === BREAK) {
    throw new Error(`${decodeErrPrefix} got unexpected break`)
  }
  // @ts-ignore
  return [decoded, data.subarray(tokeniser.pos())]
}

/**
 * @param {Uint8Array} data
 * @param {DecodeOptions} [options]
 * @returns {any}
 */
function cborgdecode(data: Uint8Array, options: DecodeOptions): unknown {
  const [decoded, remainder] = decodeFirst(data, options)
  if (remainder.length > 0) {
    throw new Error(`${decodeErrPrefix} too many terminals, data makes no sense`)
  }
  return decoded
}

const _decodeOptions = {
  allowIndefinite: false,
  coerceUndefinedToNull: true,
  allowNaN: false,
  allowInfinity: false,
  allowBigInt: true, // this will lead to BigInt for ints outside of
  // safe-integer range, which may surprise users
  strict: true,
  useMaps: false,
  rejectDuplicateMapKeys: true,
  tags: []
}

type ByteView<T> = Uint8Array
export const decode = <T = unknown>(data: ByteView<T>, visitor?: (path: string[], value: unknown) => void): T =>
  cborgdecode(data, { ..._decodeOptions, visitor }) as T

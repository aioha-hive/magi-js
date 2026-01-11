class Type {
  major: number
  majorEncoded: number
  name: string
  terminal: boolean

  /**
   * @param {number} major
   * @param {string} name
   * @param {boolean} terminal
   */
  constructor(major: number, name: string, terminal: boolean) {
    this.major = major
    this.majorEncoded = major << 5
    this.name = name
    this.terminal = terminal
  }

  /* c8 ignore next 3 */
  toString() {
    return `Type[${this.major}].${this.name}`
  }

  /**
   * @param {Type} typ
   * @returns {number}
   */
  compare(typ: Type): number {
    /* c8 ignore next 1 */
    return this.major < typ.major ? -1 : this.major > typ.major ? 1 : 0
  }

  static uint = new Type(0, 'uint', true)
  static negint = new Type(1, 'negint', true)
  static bytes = new Type(2, 'bytes', true)
  static string = new Type(3, 'string', true)
  static array = new Type(4, 'array', false)
  static map = new Type(5, 'map', false)
  static tag = new Type(6, 'tag', false) // terminal?
  static float = new Type(7, 'float', true)
  static false = new Type(7, 'false', true)
  static true = new Type(7, 'true', true)
  static null = new Type(7, 'null', true)
  static undefined = new Type(7, 'undefined', true)
  static break = new Type(7, 'break', true)
}

class Token {
  type: Type
  value: any
  encodedLength?: number
  encodedBytes?: Uint8Array
  byteValue?: Uint8Array

  /**
   * @param {Type} type
   * @param {any} [value]
   * @param {number} [encodedLength]
   */
  constructor(type: Type, value?: any, encodedLength?: number) {
    this.type = type
    this.value = value
    this.encodedLength = encodedLength
  }

  /* c8 ignore next 3 */
  toString() {
    return `Token[${this.type}].${this.value}`
  }
}

export { Type, Token }

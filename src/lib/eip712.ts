import { decode, EMPTY_ARRAY } from './cborg-ts/decode.js'

function typeOf(a: any) {
  return typeof a
}

/**
 * Converts Number to uint256 or other type where applicable
 * @param type
 * @returns
 */
function eip712Type(type: ReturnType<typeof typeOf>) {
  if (type === 'number') {
    return 'uint256'
  } else {
    return type
  }
}

export function convertCBORToEIP712TypedData(domainName: string, res: Uint8Array, primaryType: string) {
  const typeMap: { typeName: string[]; val: { name: string; type: string } }[] = []
  const pathMap: { path: string[]; val: unknown }[] = []
  const message = decode<Record<string, unknown>>(res, (path, value) => {
    // console.log(path.join('/'), '->', value, `:${typeof value}`)
    switch (typeof value) {
      case 'undefined':
      case 'function':
        throw new Error('cbor value type can not be: ' + typeof value)
    }
    if (value === null) {
      throw new Error('cbor value can not be: null')
    }

    if (value === EMPTY_ARRAY) {
      return
    }

    const typeName = [primaryType, ...path.slice(0, -1)]
    typeMap.push({
      typeName,
      val: {
        // @ts-ignore
        name: path.at(-1),
        type: value === EMPTY_ARRAY ? 'undefined[]' : eip712Type(typeof value)
      }
    })
    pathMap.push({
      path,
      val: value === EMPTY_ARRAY ? [] : value
    })
  })

  // primaryTypeName.path.path.path : []{Name: x, Type: y}
  const types: Record<string, { name: string; type: string }[]> = {}
  for (const partialType of typeMap) {
    for (let i = 0; i < partialType.typeName.length; i++) {
      const before = partialType.typeName.slice(0, i + 1) // [tx_container], [tx_container, tx], [tx_container, tx, payload]
      const after = partialType.typeName.slice(i + 1)
      const typeName = before.join('_')
      if (after.length === 0) {
        if (types[typeName] === undefined) {
          types[typeName] = []
        }
        types[typeName].push(partialType.val)
      } else {
        const val = types[typeName]
        const exists = val !== undefined
        if (
          !exists ||
          !val.find((t) => {
            return t.name == after[0]
          })
        ) {
          const isArray = isValidArr(partialType.val.name)
          if (isArray) {
            const typeNameToFind = [...before, after[0]]
            const arrayType =
              typeMap[
                typeMap.findIndex((findType) => {
                  return arraysEqual(findType.typeName, typeNameToFind)
                })
              ].val.type
            types[typeName] = val || []
            types[typeName].push({ name: after[0], type: arrayType + '[]' })
            break
          } else {
            types[typeName] = val || []
            types[typeName].push({
              name: after[0],
              type: typeName + '_' + after[0]
            })
          }
        }
      }
    }
  }

  function arraysEqual<T>(arr1: T[], arr2: T[]): boolean {
    if (arr1.length !== arr2.length) {
      return false
    }
    for (let i = 0; i < arr1.length; i++) {
      if (arr1[i] !== arr2[i]) {
        return false
      }
    }
    return true
  }

  // returns true iff array is valid
  //
  // examples:
  // - "[]" -> false
  // - "[2]" -> true
  // - "4" -> false
  // - "[1" -> false
  // - "[two]" - false
  function isValidArr(s: string): boolean {
    if (s.length <= 2) {
      return false
    }

    if (s.at(0) !== '_' || s.at(-1) !== '_') {
      return false
    }

    const val = parseInt(s.slice(1, -1))
    return !isNaN(val)
  }

  return {
    EIP712Domain: [{ name: 'name', type: 'string' }],
    domain: { name: domainName },
    message,
    primaryType,
    types
  }
}

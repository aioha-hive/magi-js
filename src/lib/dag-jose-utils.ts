import * as Block from 'multiformats/block'
import { CID } from 'multiformats/cid'
import { sha256 } from 'multiformats/hashes/sha2'
import * as dagCBOR from './dag-cbor.js'

export interface EncodedPayload {
  cid: CID
  linkedBlock: Uint8Array
}

export async function encodePayload(payload: Record<string, any>): Promise<EncodedPayload> {
  const block = await Block.encode({ value: payload, codec: dagCBOR, hasher: sha256 })
  return {
    cid: block.cid,
    linkedBlock: block.bytes
  }
}

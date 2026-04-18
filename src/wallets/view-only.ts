import { error } from '@aioha/aioha/build/lib/errors.js'
import { MagiWalletBase } from './wallet.js'
import { MagiClient } from '../lib/client.js'
import { MagiEventEmitter, Result } from '../types.js'

const HIVE_PREFIX = 'hive:'
const EVM_PREFIX = 'did:pkh:eip155:1:'
const BTC_PREFIX = 'did:pkh:bip122:000000000019d6689c085ae165831e93:'

const VIEW_ONLY_ERR = error(4200, 'Cannot sign or transact in view only mode')

type ViewOnlyKind = 'hive' | 'evm' | 'btc'

const PREFIXES: { prefix: string; kind: ViewOnlyKind }[] = [
  { prefix: HIVE_PREFIX, kind: 'hive' },
  { prefix: EVM_PREFIX, kind: 'evm' },
  { prefix: BTC_PREFIX, kind: 'btc' }
]

export class MagiWalletViewOnly extends MagiWalletBase {
  private kind: ViewOnlyKind
  private address: string

  constructor(client: MagiClient, emitter: MagiEventEmitter, did: string) {
    super(client, emitter)
    const parsed = MagiWalletViewOnly.parseDid(did)
    this.kind = parsed.kind
    this.address = parsed.address
  }

  setDid(did: string) {
    const parsed = MagiWalletViewOnly.parseDid(did)
    this.kind = parsed.kind
    this.address = parsed.address
  }

  getUser(prefix?: boolean): string | undefined {
    if (!this.address) return undefined
    if (!prefix) return this.address
    const map: Record<ViewOnlyKind, string> = { hive: HIVE_PREFIX, evm: EVM_PREFIX, btc: BTC_PREFIX }
    return map[this.kind] + this.address
  }

  signAndBroadcastTx(): Promise<Result> {
    return Promise.resolve(VIEW_ONLY_ERR)
  }

  private static parseDid(did: string): { kind: ViewOnlyKind; address: string } {
    for (const { prefix, kind } of PREFIXES) {
      if (did.startsWith(prefix)) {
        const address = did.slice(prefix.length)
        if (!address) throw new Error('Unrecognized DID format for view-only wallet')
        return { kind, address }
      }
    }
    throw new Error('Unrecognized DID format for view-only wallet')
  }
}

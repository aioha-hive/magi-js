import { encodePayload } from '../lib/dag-jose-utils.js'
import { MagiClient } from '../lib/client.js'
import { TxSigningShell, TxSigned, MagiEventEmitter, BtcClient } from '../types.js'
import { MagiWalletL2Base } from './offchain.js'
import { MagiError } from '../lib/error.js'

const BTC_DID_PREFIX = 'did:pkh:bip122:000000000019d6689c085ae165831e93:'

/**
 * Normalize BIP-137 recovery flag for SegWit wallet signatures.
 *
 * btcd's RecoverCompact only accepts header bytes [27-34]. SegWit wallets
 * (e.g. Xverse, Leather) return BIP-137 headers in [35-42]:
 *   [35-38] for P2SH-P2WPKH, [39-42] for native P2WPKH (bc1q).
 *
 * Both SegWit types use compressed keys, so we map them into the
 * compressed P2PKH range [31-34] which the backend accepts.
 */
function normalizeBip137Sig(b64Sig: string): string {
  const sigBytes = Uint8Array.from(atob(b64Sig), (c) => c.charCodeAt(0))
  if (sigBytes.length === 65 && sigBytes[0] >= 35) {
    sigBytes[0] = sigBytes[0] >= 39
      ? sigBytes[0] - 8 // native SegWit [39-42] → [31-34]
      : sigBytes[0] - 4 // P2SH-SegWit  [35-38] → [31-34]
  }
  let binaryString = ''
  sigBytes.forEach((byte) => {
    binaryString += String.fromCharCode(byte)
  })
  return btoa(binaryString)
}

export class MagiWalletBitcoin extends MagiWalletL2Base {
  wallet: BtcClient

  constructor(magiClient: MagiClient, emitter: MagiEventEmitter, btcClient: BtcClient) {
    super(magiClient, emitter)
    this.wallet = btcClient
  }

  setClient(client: BtcClient) {
    this.wallet = client
  }

  getUser(prefix?: boolean): string | undefined {
    if (!this.wallet.address) return undefined
    return prefix ? `${BTC_DID_PREFIX}${this.wallet.address}` : this.wallet.address
  }

  async signTx(shell: TxSigningShell): Promise<TxSigned> {
    try {
      const encoded = await encodePayload(shell)
      const cidString = encoded.cid.toString()
      this.emitSignTx()
      const rawSignature = await this.wallet.signMessage(cidString)
      const signature = normalizeBip137Sig(rawSignature)

      return {
        sigs: [
          {
            alg: 'ES256K',
            kid: this.getUser(true)!,
            sig: signature
          }
        ],
        rawTx: encoded.linkedBlock
      }
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('User rejected') || error.message.includes('denied')) {
          throw new MagiError(4001, 'Transaction was rejected by user')
        } else if (error.message.includes('network')) {
          throw new MagiError(4003, 'Network error during signing')
        }
      }

      throw new MagiError(5000, `${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
}

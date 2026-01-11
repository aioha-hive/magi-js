import { encode } from '@ipld/dag-cbor'
import { encodePayload } from 'dag-jose-utils'
import { convertCBORToEIP712TypedData } from '../../lib/eip712.js'
import { MagiClient } from '../../lib/client.js'
import { TxSigningShell, TxSigned } from '../../types.js'
import { MagiWalletL2Base } from '../offchain.js'
import type { Client } from 'viem'
import { signTypedData } from 'viem/actions'
import { MagiError } from '../../lib/error.js'

export class MagiWalletViem extends MagiWalletL2Base {
  wallet: Client

  constructor(magiClient: MagiClient, viemClient: Client) {
    super(magiClient)
    this.wallet = viemClient
  }

  getUser(prefix?: boolean): string | undefined {
    const account = this.wallet.account
    if (!account) return undefined
    return prefix ? `did:pkh:eip155:1:${account.address}` : account.address
  }

  async signTx(shell: TxSigningShell): Promise<TxSigned> {
    try {
      const encodedShell = encode(shell)
      const typedData = convertCBORToEIP712TypedData('vsc.network', encodedShell, 'tx_container_v0')
      //@ts-ignore Account connection checks are already done
      const signature = await signTypedData(this.wallet, typedData)

      return {
        sigs: [
          {
            alg: 'EdDSA',
            kid: this.getUser(true)!,
            sig: signature
          }
        ],
        rawTx: (await encodePayload(shell)).linkedBlock
      }
    } catch (error) {
      console.error('=== Signing Failed ===')
      console.error('Error details:', error)

      if (error instanceof Error) {
        if (error.message.includes('User rejected')) {
          throw new MagiError(4001, 'Transaction was rejected by user')
        } else if (error.message.includes('network')) {
          throw new MagiError(4003, 'Network error during signing')
        }
      }

      throw new MagiError(5000, `${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
}

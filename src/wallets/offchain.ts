import { error } from '@aioha/aioha/build/lib/errors.js'
import { encode as encodeJson } from '@ipld/dag-json'
import { encodePayload } from 'dag-jose-utils'
import { Result, MagiKeyType, MagiOperation, TxSigningShell, TxContainer, TxSigned } from '../types.js'
import { MagiWalletBase } from './wallet.js'
import { MagiClient } from '../lib/client.js'
import { encode } from '../lib/cborg-ts/encode.js'
import { broadcastTx } from '../requests.js'

const RC_COSTS = {
  transfer: 100,
  withdraw: 200,
  stake_hbd: 200,
  unstake_hbd: 200,
  consensus_stake: 100,
  consensus_unstake: 100
}

// TODO: switch to Uint8Array.toBase64() after ~June 2026 when enough browsers are updated
const u8aToB64 = (uint8Array: Uint8Array) => {
  let binaryString = ''
  uint8Array.forEach((byte) => {
    binaryString += String.fromCharCode(byte)
  })

  return btoa(binaryString)
}

export abstract class MagiWalletL2Base extends MagiWalletBase {
  constructor(client: MagiClient) {
    super(client)
  }

  abstract getUser(prefix?: boolean): string | undefined
  abstract signTx(shell: TxSigningShell): Promise<TxSigned>

  async signAndBroadcastTx(tx: MagiOperation[], keyType: MagiKeyType): Promise<Result> {
    const nonceErr = await this.refreshNonce()
    if (!!nonceErr) return nonceErr

    const encodedOps = tx.map((op) => ({ type: op.type, payload: encode(op.payload) }))
    const container: TxContainer = {
      __t: 'vsc-tx',
      __v: '0.2',
      headers: {
        nonce: this.nonce!,
        required_auths: [this.getUser(true)!],
        rc_limit: tx.reduce((p, c) => p + (c.type === 'call' ? c.payload.rc_limit : RC_COSTS[c.type]), 0),
        net_id: this.client.netId
      },
      tx: encodedOps
    }
    const shell: TxSigningShell = {
      __t: container.__t,
      __v: container.__v,
      headers: {
        nonce: container.headers.nonce,
        required_auths: container.headers.required_auths,
        rc_limit: container.headers.rc_limit,
        net_id: container.headers.net_id
      },
      tx: tx.map((op) => ({ type: op.type, payload: new TextDecoder().decode(encodeJson(op.payload)) }))
    }
    try {
      const signed = await this.signTx(shell)
      const sigEncoded = u8aToB64(
        (
          await encodePayload({
            __t: 'vsc-sig',
            sigs: signed.sigs
          })
        ).linkedBlock
      )
      const txEncoded = u8aToB64((await encodePayload(container)).linkedBlock)
      const id = await broadcastTx(this.client, txEncoded, sigEncoded)
      return {
        success: true,
        result: id
      }
    } catch (e: any) {
      if (e.name === 'MagiError' && typeof e.code === 'number') return error(e.code, e.message)
      return error(5000, 'Failed to sign and broadcast tx')
    }
  }
}

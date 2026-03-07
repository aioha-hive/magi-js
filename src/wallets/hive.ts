import type { Aioha } from '@aioha/aioha'
import { MagiWalletBase } from './wallet.js'
import { KeyTypes as AiohaKT } from '@aioha/aioha/build/types.js'
import { Result, KeyTypes, MagiOperation, MagiEventEmitter } from '../types.js'
import { MagiClient } from '../lib/client.js'

const toAiohaKT = (kt: KeyTypes): AiohaKT => {
  // should return the same string
  switch (kt) {
    case KeyTypes.Posting:
      return AiohaKT.Posting
    case KeyTypes.Active:
      return AiohaKT.Active
  }
}

export class MagiWalletAioha extends MagiWalletBase {
  aioha: Aioha

  constructor(client: MagiClient, emitter: MagiEventEmitter, aioha: Aioha) {
    super(client, emitter)
    this.aioha = aioha
  }

  setAioha(aioha: Aioha) {
    this.aioha = aioha
  }

  getUser(prefix?: boolean): string | undefined {
    const u = this.aioha.getCurrentUser()
    return !!u ? (prefix ? 'hive:' : '') + u : undefined
  }

  signAndBroadcastTx(tx: MagiOperation[], keyType: KeyTypes = KeyTypes.Active): Promise<Result> {
    const auths = [this.getUser(false)!]
    this.emitSignTx()
    return this.aioha.signAndBroadcastTx(
      tx.map((op) => [
        'custom_json',
        {
          required_auths: keyType === KeyTypes.Active ? auths : [],
          required_posting_auths: keyType === KeyTypes.Posting ? auths : [],
          id: 'vsc.' + op.type,
          json: JSON.stringify({ net_id: this.client.netId, ...op.payload })
        }
      ]),
      toAiohaKT(keyType)
    )
  }
}

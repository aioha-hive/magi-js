import type { Aioha } from '@aioha/aioha'
import { MagiWalletBase } from './wallet.js'
import { KeyTypes } from '@aioha/aioha/build/types.js'
import { Result, MagiKeyType, MagiOperation, MagiEventEmitter } from '../types.js'
import { MagiClient } from '../lib/client.js'

const toAiohaKT = (kt: MagiKeyType): KeyTypes => {
  // should return the same string
  switch (kt) {
    case MagiKeyType.Posting:
      return KeyTypes.Posting
    case MagiKeyType.Active:
      return KeyTypes.Active
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

  signAndBroadcastTx(tx: MagiOperation[], keyType: MagiKeyType = MagiKeyType.Active): Promise<Result> {
    const auths = [this.getUser(false)!]
    this.emitSignTx()
    return this.aioha.signAndBroadcastTx(
      tx.map((op) => [
        'custom_json',
        {
          required_auths: keyType === MagiKeyType.Active ? auths : [],
          required_posting_auths: keyType === MagiKeyType.Posting ? auths : [],
          id: 'vsc.' + op.type,
          json: JSON.stringify({ net_id: this.client.netId, ...op.payload })
        }
      ]),
      toAiohaKT(keyType)
    )
  }

  /*
  call(
    contractId: string,
    action: string,
    payload: any,
    rc_limit: number,
    intents: VscTxIntent[],
    keyType: MagiKeyType
  ): Promise<Result> {
    return this.aioha.vscCallContract(contractId, action, payload, rc_limit, intents, toAiohaKT(keyType))
  }

  transfer(to: string, amount: number, currency: Asset, memo?: string): Promise<Result> {
    return this.aioha.vscTransfer(to, amount, currency.toLowerCase() as HiveAsset, memo)
  }

  unmap(to: string, amount: number, currency: Asset, memo?: string): Promise<Result> {
    return this.aioha.vscWithdraw(to, amount, toHiveAsset(currency), memo)
  }

  stake(stakeType: VscStakeType, amount: number, to?: string, memo?: string): Promise<Result> {
    return this.aioha.vscStake(stakeType, amount, to, memo)
  }

  unstake(stakeType: VscStakeType, amount: number, to?: string, memo?: string): Promise<Result> {
    return this.aioha.vscUnstake(stakeType, amount, to, memo)
  }
  */
}

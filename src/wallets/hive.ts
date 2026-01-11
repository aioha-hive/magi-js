import { Aioha, KeyTypes, VscStakeType } from '@aioha/aioha'
import { MagiWalletBase } from './wallet.js'
import { Asset as HiveAsset, VscTxIntent } from '@aioha/aioha/build/types.js'
import { Result, Asset, MagiOperation } from '../types.js'
import { MagiClient } from '../lib/client.js'

const toHiveAsset = (asset: Asset): HiveAsset => {
  switch (asset) {
    case Asset.hive:
      return HiveAsset.HIVE
    case Asset.hbd:
      return HiveAsset.HBD
    default:
      throw new Error('unsupported asset')
  }
}

export class MagiWalletAioha extends MagiWalletBase {
  private aioha: Aioha

  constructor(client: MagiClient, aioha: Aioha) {
    super(client)
    this.aioha = aioha
  }

  getUser(prefix?: boolean): string | undefined {
    const u = this.aioha.getCurrentUser()
    return !!u ? (prefix ? 'hive:' : '') + u : undefined
  }

  signAndBroadcastTx(tx: MagiOperation[], keyType: KeyTypes): Promise<Result> {
    const auths = [this.getUser(false)!]
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
      keyType
    )
  }

  call(
    contractId: string,
    action: string,
    payload: any,
    rc_limit: number,
    intents: VscTxIntent[],
    keyType: KeyTypes
  ): Promise<Result> {
    return this.aioha.vscCallContract(contractId, action, payload, rc_limit, intents, keyType)
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
}

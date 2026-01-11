import { KeyTypes, VscStakeType as StakeType, VscTxIntent as Intent } from '@aioha/aioha/build/types.js'
import { error } from '@aioha/aioha/build/lib/errors.js'
import { Asset, MagiOperation, Result, OpFer } from '../types.js'
import { MagiClient } from '../lib/client.js'
import { getNonce } from '../requests.js'

export abstract class MagiWalletBase implements MagiWallet {
  protected client: MagiClient
  protected nonce?: number

  constructor(client: MagiClient) {
    this.client = client
  }

  abstract getUser(prefix?: boolean): string | undefined
  abstract signAndBroadcastTx(tx: MagiOperation[], keyType: KeyTypes): Promise<Result>

  call(
    contractId: string,
    action: string,
    payload: any,
    rc_limit: number,
    intents: Intent[],
    keyType: KeyTypes
  ): Promise<Result> {
    return this.signAndBroadcastTx(
      [{ type: 'call', payload: { contract_id: contractId, action, payload, rc_limit, intents } }],
      keyType
    )
  }

  fer(type: OpFer['type'], to: string, amount: number, currency: Asset, memo?: string): Promise<Result> {
    return this.signAndBroadcastTx(
      [{ type, payload: { from: this.getUser(true)!, to, amount: amount.toFixed(3), asset: currency, memo } }],
      KeyTypes.Active
    )
  }

  transfer(to: string, amount: number, currency: Asset, memo?: string): Promise<Result> {
    return this.fer('transfer', to, amount, currency, memo)
  }

  unmap(to: string, amount: number, currency: Asset, memo?: string): Promise<Result> {
    return this.fer('withdraw', to, amount, currency, memo)
  }

  stake(stakeType: StakeType, amount: number, to?: string, memo?: string): Promise<Result> {
    if (stakeType === StakeType.Consensus) return this.fer('consensus_stake', to ?? this.getUser(true)!, amount, Asset.hive, memo)
    else return this.fer('stake_hbd', to ?? this.getUser(true)!, amount, Asset.hbd, memo)
  }

  unstake(stakeType: StakeType, amount: number, to?: string, memo?: string): Promise<Result> {
    if (stakeType === StakeType.Consensus)
      return this.fer('consensus_unstake', to ?? this.getUser(true)!, amount, Asset.hive, memo)
    else return this.fer('unstake_hbd', to ?? this.getUser(true)!, amount, Asset.hbd, memo)
  }

  async fetchNonce() {
    if (typeof this.nonce === 'undefined') {
      try {
        this.nonce = await getNonce(this.client, this.getUser(true)!)
      } catch (e) {
        return error(-32603, 'Failed to fetch nonce')
      }
      if (typeof this.nonce !== 'number') return error(-32603, 'Failed to fetch nonce')
    }
  }
}

export interface MagiWallet {
  getUser(prefix?: boolean): string | undefined
  signAndBroadcastTx(tx: MagiOperation[], keyType: KeyTypes): Promise<Result>
  call(contractId: string, action: string, payload: any, rc_limit: number, intents: Intent[], keyType: KeyTypes): Promise<Result>
  transfer(to: string, amount: number, currency: Asset, memo?: string): Promise<Result>
  unmap(to: string, amount: number, currency: Asset, memo?: string): Promise<Result>
  stake(stakeType: StakeType, amount: number, to?: string, memo?: string): Promise<Result>
  unstake(stakeType: StakeType, amount: number, to?: string, memo?: string): Promise<Result>
}

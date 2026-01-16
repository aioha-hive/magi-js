import type { VscTxIntent } from '@aioha/aioha/build/types.js'

interface BaseResult {
  success: boolean
}

export interface OperationError extends BaseResult {
  success: false
  error: string
  errorCode: number
}

export interface OperationSuccess<T = string> extends BaseResult {
  success: true
  result: T
}

export type Result<T = string> = OperationSuccess<T> | OperationError

export enum Asset {
  hive = 'hive',
  hbd = 'hbd',
  shbd = 'hbd_savings'
}

export enum Wallet {
  Hive = 'hive',
  Ethereum = 'evm'
}

export enum MagiKeyType {
  Posting = 'posting',
  Active = 'active'
}

export interface OpFer {
  type: 'consensus_stake' | 'consensus_unstake' | 'stake_hbd' | 'transfer' | 'unstake_hbd' | 'withdraw'
  payload: {
    from: string
    to: string
    amount: string
    asset: Asset
    memo?: string
  }
}

export interface OpCallContract {
  type: 'call'
  payload: {
    contract_id: string
    action: string
    payload: string
    rc_limit: number
    intents: VscTxIntent[]
    caller?: string
  }
}

export type MagiOperation = OpFer | OpCallContract

interface TxHeader<T> {
  __t: 'vsc-tx'
  __v: '0.2'
  headers: {
    nonce: number
    required_auths: string[]
    rc_limit: number
    net_id: string
  }
  tx: {
    type: string
    payload: T
  }[]
}

export type TxContainer = TxHeader<Uint8Array>
export type TxSigningShell = TxHeader<string>

export type TxSig = {
  alg: string
  kid: string
  sig: string
}

export type TxSigned = {
  sigs: TxSig[]
  rawTx: Uint8Array
}

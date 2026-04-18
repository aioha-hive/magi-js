import type { Aioha, VscStakeType } from '@aioha/aioha'
import { error } from '@aioha/aioha/build/lib/errors.js'
import { VscTxIntent } from '@aioha/aioha/build/types.js'
import { SimpleEventEmitter } from '@aioha/aioha/build/lib/event-emitter.js'
import type { Client as ViemClient } from 'viem'
import { MagiClient } from './lib/client.js'
import { Asset, BtcClient, MagiEventEmitter, MagiEvents, KeyTypes, MagiOperation, Result, Wallet } from './types.js'
import { MagiWallet, MagiWalletBase } from './wallets/wallet.js'
import { MagiWalletAioha } from './wallets/hive.js'
import { MagiWalletViem } from './wallets/viem.js'
import { MagiWalletBitcoin } from './wallets/bitcoin.js'
import { MagiWalletViewOnly } from './wallets/view-only.js'
export { Wallet, Asset, KeyTypes, MagiOperation, BtcClient } from './types.js'

const notLoggedInResult = error(4900, 'Wallet not connected')
const invalidAmtErr = error(5006, 'amount must be greater than 0')
const emptyOpsErr = error(5007, 'operations cannot be empty')

const isValidAmt = (amt: number) => isNaN(amt) || amt > 0

export class Magi implements MagiWallet {
  private client: MagiClient
  private currentWallet?: Wallet
  private wallets: {
    hive?: MagiWalletAioha
    evm?: MagiWalletViem
    btc?: MagiWalletBitcoin
    viewonly?: MagiWalletViewOnly
  }
  private eventEmitter: MagiEventEmitter

  constructor() {
    this.wallets = {}
    this.client = new MagiClient()
    this.eventEmitter = new SimpleEventEmitter()
  }

  /**
   * Register a Hive wallet using [Aioha](https://aioha.dev).
   * @param aioha Aioha instance
   */
  setAioha(aioha: Aioha) {
    if (!this.wallets.hive) {
      this.wallets.hive = new MagiWalletAioha(this.client, this.eventEmitter, aioha)
    } else {
      this.wallets.hive.setAioha(aioha)
    }
  }

  /**
   * Register an Ethereum wallet using [Viem](https://viem.sh).
   * @param viemClient Viem client
   */
  setViem(viemClient: ViemClient) {
    if (!this.wallets.evm) {
      this.wallets.evm = new MagiWalletViem(this.client, this.eventEmitter, viemClient)
    } else {
      this.wallets.evm.setClient(viemClient)
    }
  }

  /**
   * Register a Bitcoin wallet using a BtcClient-compatible signer.
   * @param btcClient An object with `address` and `signMessage()`
   */
  setBitcoin(btcClient: BtcClient) {
    if (!this.wallets.btc) {
      this.wallets.btc = new MagiWalletBitcoin(this.client, this.eventEmitter, btcClient)
    } else {
      this.wallets.btc.setClient(btcClient)
    }
  }

  /**
   * Register a view-only wallet from a prefixed DID string (e.g. `hive:alice`,
   * `did:pkh:eip155:1:0x...`, `did:pkh:bip122:<mainnet-genesis>:bc1...`).
   * All signing and broadcast operations return an error.
   * @param did Prefixed DID identifying the account to observe
   */
  setViewOnly(did: string) {
    if (!this.wallets.viewonly) {
      this.wallets.viewonly = new MagiWalletViewOnly(this.client, this.eventEmitter, did)
    } else {
      this.wallets.viewonly.setDid(did)
    }
  }

  /**
   * Set Magi GraphQL API URL
   * @param api Magi GraphQL API URL
   */
  setApi(api: string, fallbackApis?: string[]): void {
    if (!api.startsWith('http://') && !api.startsWith('https://')) throw new Error('api must start from http:// or https://')
    this.client.api = api
    if (fallbackApis) this.client.fallbackApis = fallbackApis
  }

  /**
   * Get current API endpoints(s).
   * @returns Array of API endpoints(s), where the first item is the main endpoint and the remaining are fallbacks.
   */
  getApi(): string[] {
    return [this.client.api, ...this.client.fallbackApis]
  }

  /**
   * Set Magi network ID.
   * @param netId Network ID
   */
  setNetId(netId: string): void {
    this.client.netId = netId
  }

  /**
   * Retrieve the current Magi network ID.
   * @returns Network ID
   */
  getNetId(): string {
    return this.client.netId
  }

  /**
   * Manually set the current nonce
   * @param newNonce The nonce to set
   */
  setNonce(newNonce: number) {
    this.getWI()?.setNonce(newNonce)
  }

  /**
   * Get current nonce set
   * @returns The current nonce set in wallet instance
   */
  getNonce() {
    return this.getWI()?.getNonce()
  }

  /**
   * Returns a boolean of whether an account is connected or not.
   */
  isConnected(): boolean {
    return !!this.currentWallet && !!this.wallets[this.currentWallet]!.getUser()
  }

  /**
   * Retrieve the connected user address.
   * @param prefix Whether to include a prefix (`did:` or `hive:`)
   * @returns The user address if any
   */
  getUser(prefix?: boolean): string | undefined {
    return !!this.currentWallet ? this.wallets[this.currentWallet]?.getUser(prefix) : undefined
  }

  /**
   * Retrieve the enum of the wallet type currently in use.
   */
  getWallet(): Wallet | undefined {
    return this.currentWallet
  }

  getWI(): MagiWalletBase | undefined {
    return this.currentWallet ? this.wallets[this.currentWallet] : undefined
  }

  /**
   * Set the wallet type to use (Hive or Ethereum)
   * @param wallet The new wallet enum
   */
  setWallet(wallet?: Wallet) {
    if (wallet !== this.currentWallet) {
      this.currentWallet = wallet
      this.eventEmitter.emit('wallet_changed')
    }
  }

  /**
   * Sign and broadcase a Magi transaction.
   * @param tx List of Magi operations
   * @param keyType Active or posting auth (only applicable for Hive wallets)
   * @returns Transaction result
   */
  async signAndBroadcastTx(tx: MagiOperation[], keyType?: KeyTypes): Promise<Result> {
    if (!this.isConnected()) return notLoggedInResult
    if (tx.length === 0) return emptyOpsErr
    return await this.getWI()!.signAndBroadcastTx(tx, keyType)
  }

  /**
   * Call a Magi contract.
   */
  async call(
    contractId: string,
    action: string,
    payload: any,
    rc_limit: number,
    intents: VscTxIntent[],
    keyType?: KeyTypes
  ): Promise<Result> {
    if (!this.isConnected()) return notLoggedInResult
    return await this.getWI()!.call(contractId, action, payload, rc_limit, intents, keyType)
  }

  /**
   * Transfer tokens to another Magi account.
   */
  async transfer(to: string, amount: number, currency: Asset, memo?: string): Promise<Result> {
    if (!this.isConnected()) return notLoggedInResult
    if (!isValidAmt(amount)) return invalidAmtErr
    return await this.getWI()!.transfer(to, amount, currency, memo)
  }

  /**
   * Unmap tokens from Magi.
   */
  async unmap(to: string, amount: number, currency: Asset, memo?: string): Promise<Result> {
    if (!this.isConnected()) return notLoggedInResult
    if (!isValidAmt(amount)) return invalidAmtErr
    return await this.getWI()!.unmap(to, amount, currency, memo)
  }

  /**
   * Stake tokens on Magi.
   */
  async stake(stakeType: VscStakeType, amount: number, to?: string, memo?: string): Promise<Result> {
    if (!this.isConnected()) return notLoggedInResult
    if (!isValidAmt(amount)) return invalidAmtErr
    return await this.getWI()!.stake(stakeType, amount, to, memo)
  }

  /**
   * Unstake tokens on Magi.
   */
  async unstake(stakeType: VscStakeType, amount: number, to?: string, memo?: string): Promise<Result> {
    if (!this.isConnected()) return notLoggedInResult
    if (!isValidAmt(amount)) return invalidAmtErr
    return await this.getWI()!.unstake(stakeType, amount, to, memo)
  }

  /**
   * Subscribe to an event. The listener function will be called every time the event is emitted.
   *
   * The list of event names may be found in the [docs](https://aioha.dev/docs/core/jsonrpc#events).
   * @param eventName Event name to subscribe to
   * @param listener Listener function
   */
  on(eventName: MagiEvents, listener: Function) {
    this.eventEmitter.on(eventName, listener)
    return this
  }

  /**
   * Subscribe to an event once. The listener function will be called once on the next time the event is emitted.
   *
   * The list of event names may be found in the [docs](https://aioha.dev/docs/core/jsonrpc#events).
   * @param eventName Event name to subscribe to
   * @param listener Listener function
   */
  once(eventName: MagiEvents, listener: Function) {
    this.eventEmitter.once(eventName, listener)
    return this
  }

  /**
   * Unsubscribe to an event by name and listener function.
   * @param eventName Event name to unsubscribe from
   * @param listener Listener function
   */
  off(eventName: MagiEvents, listener?: Function) {
    this.eventEmitter.off(eventName, listener)
    return this
  }
}

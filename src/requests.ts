import { MagiClient } from './lib/client.js'

export const getNonce = async (client: MagiClient, address: string) => {
  return (
    await client.gql<{ nonce: { nonce: number } }>(`query GetNonce($a: String!) { nonce: getAccountNonce(account: $a) {nonce}}`, {
      a: address
    })
  ).data.nonce.nonce
}

export const broadcastTx = async (client: MagiClient, tx: string, sig: string) => {
  return (
    await client.gql<{ tx: { id: string } }>(
      `query SendTx($tx: String!, $sig: String!) { tx: submitTransactionV1(tx: $tx, sig: $sig) { id }}`,
      { tx, sig }
    )
  ).data.tx.id
}

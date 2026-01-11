import { MagiError } from './error.js'

export interface GqlResponse<
  T = {
    [key: string]: string
  }
> {
  data: T
}

const DEFAULT_GQL_API = 'https://vsc.techcoderx.com/api/v1/graphql'
const DEFAULT_FALLBACKS = ['https://api.vsc.eco/api/v1/graphql', 'https://vsc.atexoras.com:2087/api/v1/graphql']
const DEFAULT_NET_ID = 'vsc-mainnet'

export class MagiClient {
  api: string = DEFAULT_GQL_API
  fallbackApis: string[] = DEFAULT_FALLBACKS
  netId: string = DEFAULT_NET_ID

  gql = async <T>(
    query: string,
    variables: { [key: string]: any } = {},
    api: string = this.api,
    fallbackApis: string[] = [...this.fallbackApis]
  ): Promise<GqlResponse<T>> => {
    try {
      const req = await fetch(api, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          query: query,
          variables,
          extensions: {}
        }),
        signal: AbortSignal.timeout(10000)
      })
      if (req.status >= 400) {
        if (fallbackApis.length === 0) throw new MagiError(-32603, 'Failed to fetch')
        return await this.gql<T>(query, variables, fallbackApis[0], fallbackApis.slice(1, fallbackApis.length))
      }
      return (await req.json()) as GqlResponse<T>
    } catch {
      if (fallbackApis.length === 0) throw new MagiError(-32603, 'Failed to fetch')
      return await this.gql<T>(query, variables, fallbackApis[0], fallbackApis.slice(1, fallbackApis.length))
    }
  }
}

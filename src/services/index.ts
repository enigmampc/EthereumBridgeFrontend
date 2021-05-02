import {
  IClaimProofDocument,
  IOperation,
  IRewardPool,
  ISecretSwapPair,
  ISecretSwapPool,
  ISecretToken,
  ISignerHealth,
  ISwap,
  ITokenInfo,
  tokenFromSecretToken,
} from '../stores/interfaces';
import * as agent from 'superagent';
import { SwapStatus } from '../constants';

const backendUrl = url => {
  return `${process.env.BACKEND_URL}${url}`;
};

export const getSushiPool = async (address: String) => {
  const res = await agent.get<any>(process.env.SUSHI_API).query({ address });
  return res.body;
};

export const createOperation = async params => {
  const url = backendUrl(`/operations`);

  const res = await agent.post<IOperation>(url, params);

  return res.body;
};

export const updateOperation = async (id: string, transactionHash: string) => {
  const url = backendUrl(`/operations/${id}`);

  const res = await agent.post<IOperation>(url, { transactionHash });

  return res.body;
};

export const getStatus = async (params): Promise<SwapStatus> => {
  const url = backendUrl(`/operations/${params.id}`);

  const res = await agent.get<IOperation>(url);

  if (res.body.swap) {
    return SwapStatus[SwapStatus[res.body.swap.status]];
  } else {
    return SwapStatus[SwapStatus[res.body.operation.status]];
  }
};

export const getOperation = async (params): Promise<{ operation: IOperation; swap: ISwap }> => {
  const url = backendUrl(`/operations/${params.id}`);

  const res = await agent.get<{ body: { operation: IOperation; swap: ISwap } }>(url);

  return res.body;
};

export const getSwap = async (id): Promise<IOperation> => {
  const url = backendUrl(`/swaps/${id}`);

  const res = await agent.get<{ body: IOperation }>(url);

  return res.body;
};

export const getOperations = async (params: any): Promise<{ content: ISwap[] }> => {
  const url = backendUrl('/swaps/');

  const res = await agent.get<{ body: ISwap[] }>(url, params);

  const content = res.body.swaps;

  return { content: content };
};

export const getTokensInfo = async (params: any): Promise<{ content: ITokenInfo[] }> => {
  const url = backendUrl('/tokens/');

  const secretTokenListUrl = backendUrl('/secret_tokens/');

  const [tokens, secretTokens] = await Promise.all([
    agent.get<{ body: { tokens: ITokenInfo[] } }>(url, params),
    agent.get<{ body: { tokens: ISecretToken[] } }>(secretTokenListUrl, params),
  ]);

  let content = tokens.body.tokens
    .filter(t => (process.env.TEST_COINS ? t : !t.display_props.hidden))
    .map(t => {
      // todo: fix this up - proxy token
      if (t.display_props.proxy) {
        switch (t.display_props.symbol.toLowerCase()) {
          case 'sscrt':
            t.display_props.proxy_address = t.dst_address;
            t.dst_address = process.env.SSCRT_CONTRACT;
            t.display_props.proxy_symbol = 'WSCRT';
            break;
          case 'sienna':
            t.display_props.proxy_address = t.dst_address;
            t.dst_address = process.env.SIENNA_CONTRACT;
            t.display_props.proxy_symbol = 'WSIENNA';
            break;
          default:
            throw new Error('Unsupported proxy token');
        }

        //t.display_props.symbol = t.name;
      }

      return t;
    })
    .map(t => {
      if (t?.display_props?.usage === undefined) {
        t.display_props.usage = ['BRIDGE', 'REWARDS', 'SWAP'];
      }
      return t;
    });

  let sTokens = secretTokens.body.tokens.map(t => {
    return tokenFromSecretToken(t);
  });

  content.push(...sTokens);

  return { content };
};

export const getSecretSwapPairs = async (params: any): Promise<{ content: ISecretSwapPair[] }> => {
  const url = backendUrl('/secretswap_pairs/');

  const res = await agent.get<{ body: ISecretSwapPair[] }>(url, params);

  const content = res.body.pairs;

  return { content: content };
};

export const getSecretSwapPools = async (params: any): Promise<{ content: ISecretSwapPool[] }> => {
  const url = backendUrl('/secretswap_pools/');

  const res = await agent.get<{ body: ISecretSwapPool[] }>(url, params);

  const content = res.body.pools;

  return { content: content };
};

export const getSignerHealth = async (): Promise<{ content: ISignerHealth[] }> => {
  const url = backendUrl('/signer_health/');

  const res = await agent.get<{ body: { health: ISignerHealth[] } }>(url, {});

  const content = res.body.health;

  return { content: content };
};

export const getRewardsInfo = async (params: any): Promise<{ content: IRewardPool[] }> => {
  const url = backendUrl('/rewards/');

  const res = await agent.get<{ body: { tokens: IRewardPool[] } }>(url, params);

  const content = res.body.pools;

  return { ...res.body, content };
};

export const getEthProof = async (addr: string): Promise<{ proof: IClaimProofDocument }> => {
  const url = backendUrl(`/proof/eth/${addr.toLowerCase()}`);
  const res = await agent.get<{ body: IClaimProofDocument }>(url);

  return res.body;
};

export const getScrtProof = async (addr): Promise<{ proof: IClaimProofDocument }> => {
  const url = backendUrl(`/proof/scrt/${addr.toLowerCase()}`);

  const res = await agent.get<{ body: IClaimProofDocument }>(url);

  return res.body;
};

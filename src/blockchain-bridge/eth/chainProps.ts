import { NETWORKS } from '../index';

export enum chainProps {
  swap_direction_source,
  swap_direction_dst,
  wallet,
  currency_symbol,
  secret_currency_symbol,
  image_logo,
  destination_network_address,
  full_name,
  token_name,
  explorerUrl,
  decimals,
  swap_contract,
}

const message_map: Record<chainProps, Record<NETWORKS, string>> = {
  [chainProps.destination_network_address]: {
    [NETWORKS.ETH]: 'Destination ETH Address',
    [NETWORKS.BSC]: 'Destination BSC Address',
    [NETWORKS.PLSM]: 'Destination PLSM Addresss',
  },
  [chainProps.swap_direction_source]: {
    [NETWORKS.ETH]: 'ETH -> Secret Network',
    [NETWORKS.BSC]: 'BSC -> Secret Network',
    [NETWORKS.PLSM]: 'PLSM -> Secret Network',
  },
  [chainProps.swap_direction_dst]: {
    [NETWORKS.ETH]: 'Secret Network -> ETH',
    [NETWORKS.BSC]: 'Secret Network -> BSC',
    [NETWORKS.PLSM]: 'Secret Network -> PLSM',
  },
  [chainProps.wallet]: {
    [NETWORKS.ETH]: '(Metamask)',
    [NETWORKS.BSC]: '(Metamask)',
    [NETWORKS.PLSM]: '(Metamask)',
  },
  [chainProps.currency_symbol]: {
    [NETWORKS.ETH]: 'ETH',
    [NETWORKS.BSC]: 'BNB',
    [NETWORKS.PLSM]: 'PLM',
  },
  [chainProps.secret_currency_symbol]: {
    [NETWORKS.ETH]: 'secretETH',
    [NETWORKS.BSC]: 'secretBNB',
    [NETWORKS.PLSM]: 'secretPLM',
  },
  [chainProps.image_logo]: {
    [NETWORKS.ETH]: '/static/networks/eth.svg',
    [NETWORKS.BSC]: '/static/networks/binance-smart-chain.svg',
    [NETWORKS.PLSM]: '/static/plsm.png',
  },
  [chainProps.full_name]: {
    [NETWORKS.ETH]: 'Ethereum',
    [NETWORKS.BSC]: 'Binance Smart Chain',
    [NETWORKS.PLSM]: 'Plasm',
  },
  [chainProps.token_name]: {
    [NETWORKS.ETH]: 'ERC20',
    [NETWORKS.BSC]: 'BEP20',
    [NETWORKS.PLSM]: 'Parachain',
  },
  [chainProps.explorerUrl]: {
    [NETWORKS.ETH]: process.env.ETH_EXPLORER_URL,
    [NETWORKS.BSC]: process.env.BSC_EXPLORER_URL,
    [NETWORKS.PLSM]: process.env.ETH_EXPLORER_URL,
  },
  [chainProps.decimals]: {
    [NETWORKS.ETH]: '18',
    [NETWORKS.BSC]: '18',
    [NETWORKS.PLSM]: '18',
  },
  [chainProps.swap_contract]: {
    [NETWORKS.ETH]: process.env.SCRT_SWAP_CONTRACT,
    [NETWORKS.BSC]: process.env.BSC_SCRT_SWAP_CONTRACT,
    [NETWORKS.PLSM]: process.env.PLSM_SWAP_CONTRACT,
  },
};

export const chainPropToString = (msg: chainProps, network: NETWORKS): string => {
  return message_map[msg][network];
};

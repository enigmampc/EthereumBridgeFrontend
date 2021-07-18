import { StoreConstructor } from './core/StoreConstructor';
import { action, computed, observable } from 'mobx';
import { statusFetching, SwapStatus } from '../constants';
import { ACTION_TYPE, EXCHANGE_MODE, IOperation, ITokenInfo, TOKEN } from './interfaces';
import * as operationService from 'services';
import * as contract from '../blockchain-bridge';
import { NETWORKS, Snip20SendToBridge, Snip20SwapHash, web3 } from '../blockchain-bridge';
import { balanceNumberFormat, divDecimals, formatSymbol, mulDecimals, uuid } from '../utils';
import { getNetworkFee } from '../blockchain-bridge/eth/helpers';
import { proxyContracts, ProxyTokens } from '../blockchain-bridge/eth/proxyTokens';
import { chainProps, chainPropToString } from '../blockchain-bridge/eth/chainProps';

export const LOCAL_STORAGE_OPERATIONS_KEY = 'operationskey';

export enum EXCHANGE_STEPS {
  BASE = 'BASE',
  APPROVE_CONFIRMATION = 'APPROVE_CONFIRMATION',
  SENDING_APPROVE = 'SENDING_APPROVE',
  CONFIRMATION = 'CONFIRMATION',
  SENDING = 'SENDING',
  RESULT = 'RESULT',
  CHECK_TRANSACTION = 'CHECK_TRANSACTION',
}

export interface IOperationPanel {
  id: string;
  tokenImage: any;
  amount: number;
  fromToken: string;
  toToken: string;
  mode: string;
}
export interface IStepConfig {
  id: EXCHANGE_STEPS;
  buttons: Array<{
    title: string;
    onClick: () => void;
    validate?: boolean;
    transparent?: boolean;
  }>;
  title?: string;
}

export class Exchange extends StoreConstructor {
  @observable operations: Array<IOperationPanel> = [];
  @observable error = '';
  @observable txHash = '';
  @observable confirmations = 0;
  @observable fetchOperationInterval = 0;
  @observable actionStatus: statusFetching = 'init';
  @observable stepNumber = EXCHANGE_STEPS.BASE;
  @observable isFeeLoading = false;
  @observable isTokenApproved = false;
  @observable tokenApprovedLoading = false;
  @observable tokens: ITokenInfo[] = [];

  defaultTransaction = {
    scrtAddress: '',
    ethAddress: '',
    amount: '',
    erc20Address: '',
    snip20Address: '',
    loading: false,
    confirmed: null,
    error: '',
    tokenSelected: {
      symbol: '',
      image: '',
      value: '',
      src_coin: '',
      src_address: '',
    },
  };

  defaultOperation: IOperation = {
    actions: undefined,
    amount: 0,
    ethAddress: '',
    transactionHash: '',
    fee: 0,
    id: '',
    oneAddress: '',
    status: null,
    timestamp: 0,
    token: undefined,
    type: undefined,
    swap: null,
  };

  @observable transaction = this.defaultTransaction;
  @observable mode: EXCHANGE_MODE = EXCHANGE_MODE.TO_SCRT;
  @observable token: TOKEN;

  @observable network: NETWORKS = NETWORKS.ETH;
  @observable mainnet: boolean = true;

  @computed
  get step() {
    return this.stepsConfig[this.stepNumber];
  }

  @observable ethNetworkFee = 0;
  @observable ethSwapFee = 0;
  @observable swapFeeToken = 0;
  @observable swapFeeUsd = 0;

  @computed
  get networkFee() {
    return this.mode === EXCHANGE_MODE.TO_SCRT ? this.ethNetworkFee : 0.0134438;
  }

  @computed
  get swapFee() {
    return this.mode === EXCHANGE_MODE.FROM_SCRT ? Number(balanceNumberFormat.format(this.swapFeeToken)) : 0;
  }

  @computed
  get swapFeeUSD() {
    return this.mode === EXCHANGE_MODE.FROM_SCRT ? this.swapFeeUsd : 0;
  }

  stepsConfig = {
    [EXCHANGE_STEPS.BASE]: {
      id: EXCHANGE_STEPS.BASE,
      modal: false,
      onClickSend: async () => {
        this.transaction.erc20Address = this.stores.userMetamask.erc20Address;
        this.transaction.snip20Address = this.stores.user.snip20Address;
        this.transaction.loading = false;
        this.stepNumber = EXCHANGE_STEPS.CONFIRMATION;

        switch (this.mode) {
          case EXCHANGE_MODE.TO_SCRT:
            this.transaction.ethAddress = this.stores.userMetamask.ethAddress;

            this.isFeeLoading = true;
            this.ethNetworkFee = await getNetworkFee(Number(process.env.ETH_GAS_LIMIT));
            this.isFeeLoading = false;
            this.swapFeeToken = 0;
            break;
          case EXCHANGE_MODE.FROM_SCRT:
            this.transaction.scrtAddress = this.stores.user.address;
            this.isFeeLoading = true;
            this.ethSwapFee = await getNetworkFee(Number(process.env.SWAP_FEE));
            let token: ITokenInfo;
            if (this.token === TOKEN.NATIVE) {
              token = this.tokens.find(t => t.src_address === 'native');
            } else {
              token = this.tokens.find(t => t.dst_address === this.transaction.snip20Address);
            }
            this.swapFeeUsd = this.ethSwapFee * this.stores.userMetamask.getNetworkPrice();
            this.swapFeeToken = this.swapFeeUsd / Number(token.price);
            this.isFeeLoading = false;
            break;
        }
      },
      onClickApprove: async () => {
        if (this.mode !== EXCHANGE_MODE.TO_SCRT || this.token === TOKEN.NATIVE) return;
        this.stepNumber = EXCHANGE_STEPS.APPROVE_CONFIRMATION;
        this.isFeeLoading = true;
        this.ethNetworkFee = await getNetworkFee(Number(process.env.ETH_GAS_LIMIT));
        this.isFeeLoading = false;
      },
    },
    [EXCHANGE_STEPS.CONFIRMATION]: {
      id: EXCHANGE_STEPS.CONFIRMATION,
      modal: true,
      onClick: () => this.sendOperation(),
    },
    [EXCHANGE_STEPS.APPROVE_CONFIRMATION]: {
      id: EXCHANGE_STEPS.APPROVE_CONFIRMATION,
      modal: true,
      onClick: () => this.sendOperation(),
    },
    [EXCHANGE_STEPS.CHECK_TRANSACTION]: {
      id: EXCHANGE_STEPS.CHECK_TRANSACTION,
      modal: true,
    },
  };

  @action.bound
  async checkTokenApprove(address: string) {
    this.isTokenApproved = false;
    this.tokenApprovedLoading = true;
    try {
      const allowance = await contract.fromScrtMethods[this.network][this.token].getAllowance(address);
      if (Number(allowance) > 0) this.isTokenApproved = true;
      this.tokenApprovedLoading = false;
    } catch (error) {
      this.tokenApprovedLoading = false;
    }
  }

  @action.bound
  setAddressByMode() {
    if (this.mode === EXCHANGE_MODE.TO_SCRT) {
      this.transaction.scrtAddress = '';
      this.transaction.ethAddress = this.stores.userMetamask.ethAddress;
    } else if (this.mode === EXCHANGE_MODE.FROM_SCRT) {
      this.transaction.ethAddress = '';
      this.transaction.scrtAddress = this.stores.user.address;
    }
  }

  @action.bound
  removeLocalstorageOperation(id) {
    let tmpoperations = this.getLocalstorageOperations().filter(o => o.id !== id);
    this.operations = tmpoperations;
    localStorage.setItem(LOCAL_STORAGE_OPERATIONS_KEY, JSON.stringify(tmpoperations));
  }

  @action.bound
  addLocalstorageOperation(operation) {
    let tmpoperations = this.getLocalstorageOperations();
    tmpoperations.push(operation);
    this.operations = tmpoperations;
    localStorage.setItem(LOCAL_STORAGE_OPERATIONS_KEY, JSON.stringify(tmpoperations));
  }

  @action.bound
  getLocalstorageOperations() {
    try {
      const result = JSON.parse(localStorage.getItem(LOCAL_STORAGE_OPERATIONS_KEY)) || [];
      return result;
    } catch (error) {
      return [];
    }
  }

  @action.bound
  setMode(mode: EXCHANGE_MODE) {
    this.mode = mode;
    this.setAddressByMode();
  }

  @action.bound
  async setNetwork(network: NETWORKS) {
    this.network = network;
    await this.stores.tokens.fetch();
    await this.setTokens(network);
  }

  @action.bound
  setToken(token: TOKEN) {
    // this.clear();
    this.token = token;
    // this.setAddressByMode();
  }

  async setTokens(network: NETWORKS) {
    this.tokens = await this.stores.tokens.tokensUsage('BRIDGE', network);
  }

  @action.bound
  setMainnet(mainnet: boolean) {
    this.mainnet = mainnet;
  }

  @observable operation: IOperation;

  @action.bound
  fetchStatus(id) {
    const fetcher = async () => {
      const result = await operationService.getOperation(this.network, { id });
      const swap = result.swap;
      function isEthHash(addr) {
        return /^0x([A-Fa-f0-9]{64})$/.test(addr);
      }

      if (result.operation.transactionHash && isEthHash(result.operation.transactionHash))
        this.operation.transactionHash = result.operation.transactionHash;

      if (swap) {
        this.operation.status = swap.status;

        if (isEthHash(swap.src_tx_hash)) this.operation.transactionHash = swap.src_tx_hash;
        if (isEthHash(swap.dst_tx_hash)) this.operation.transactionHash = swap.dst_tx_hash;

        this.operation.swap = swap;

        this.operation.type = swap.src_network !== 'Secret' ? EXCHANGE_MODE.TO_SCRT : EXCHANGE_MODE.FROM_SCRT;

        if (this.operation.type === EXCHANGE_MODE.TO_SCRT) {
          const token = this.tokens.find(t => t.dst_address === swap.dst_address);
          if (token) {
            this.operation.image = token.display_props.image;
            this.operation.symbol = formatSymbol(EXCHANGE_MODE.TO_SCRT, token.display_props.symbol);
            this.operation.swap.amount = Number(divDecimals(swap.amount, token.decimals));
          } else {
            const proxy = proxyContracts.find(p => p.contract === swap.dst_address);
            if (proxy) {
              const token = this.stores.tokens.allData.find(t => t.display_props.symbol === proxy.symbol);
              this.operation.image = token.display_props.image;
              this.operation.symbol = formatSymbol(EXCHANGE_MODE.FROM_SCRT, token.display_props.symbol);
              this.operation.swap.amount = Number(divDecimals(swap.amount, token.decimals));
            }
          }
        } else {
          const token = this.tokens.find(t => t.dst_address === swap.src_coin);
          if (token) {
            this.operation.image = token.display_props.image;
            this.operation.symbol = formatSymbol(EXCHANGE_MODE.TO_SCRT, token.display_props.symbol);
            this.operation.swap.amount = Number(divDecimals(swap.amount, token.decimals));
          } else {
            const proxy = proxyContracts.find(p => p.contract === swap.src_coin);
            if (proxy) {
              const token = this.stores.tokens.allData.find(t => t.display_props.symbol === proxy.symbol);
              this.operation.image = token.display_props.image;
              this.operation.symbol = formatSymbol(EXCHANGE_MODE.FROM_SCRT, token.display_props.symbol);
              this.operation.swap.amount = Number(divDecimals(swap.amount, token.decimals));
            }
          }
        }

        try {
          const etherHash = swap.src_network === 'Secret' ? swap.dst_tx_hash : swap.src_tx_hash;
          const blockNumber = await web3.eth.getBlockNumber();
          const tx = await web3.eth.getTransaction(etherHash);
          if (tx.blockNumber) this.confirmations = blockNumber - tx.blockNumber;
          if (this.confirmations < 0) this.confirmations = 0;
        } catch (error) {}
      }
    };

    fetcher();

    clearInterval(this.fetchOperationInterval);
    this.fetchOperationInterval = setInterval(async () => {
      await fetcher();
      if ([SwapStatus.SWAP_CONFIRMED, SwapStatus.SWAP_FAILED].includes(this.operation.status)) {
        clearInterval(this.fetchOperationInterval);
      }
    }, 2000);
  }

  @action.bound
  async setOperationId(operationId: string) {
    this.operation = this.defaultOperation;
    this.operation.id = operationId;
    //await this.waitForResult();
    this.stepNumber = EXCHANGE_STEPS.CHECK_TRANSACTION;

    this.fetchStatus(this.operation.id);
  }

  @action.bound
  async createOperation(transactionHash?: string) {
    clearInterval(this.fetchOperationInterval);
    let params = transactionHash ? { id: uuid(), transactionHash } : { id: uuid() };
    this.operation = this.defaultOperation;
    this.confirmations = 0;
    this.txHash = '';
    this.operation.id = params.id;
    this.addLocalstorageOperation({
      id: params.id,
      tokenImage: this.transaction.tokenSelected.image,
      amount: this.transaction.amount,
      fromToken: this.transaction.tokenSelected.symbol,
      toToken: this.transaction.tokenSelected.symbol,
      mode: this.mode,
    });
    await operationService.createOperation(this.network, params);
    return this.operation;
  }

  @action.bound
  async updateOperation(id: string, transactionHash: string) {
    const result = await operationService.updateOperation(this.network, id, transactionHash);

    if (result.result === 'failed') {
      throw Error(
        `Failed to update operation ${this.operation.id}, tx hash: ${transactionHash}. Please contact support with these details`,
      );
    }

    return await this.getStatus(id);
  }

  async getStatus(id) {
    return await operationService.getStatus({
      id,
    });
  }

  getActionByType = (type: ACTION_TYPE) => this.operation.actions.find(a => a.type === type);

  @action.bound
  async sendOperation(id: string = '') {
    try {
      this.actionStatus = 'fetching';
      this.confirmations = 0;
      this.transaction.erc20Address = this.transaction.erc20Address.trim();
      this.transaction.scrtAddress = this.transaction.scrtAddress.trim();
      this.transaction.ethAddress = this.transaction.ethAddress.trim();
      this.txHash = '';
      this.transaction.loading = true;
      this.transaction.error = '';

      if (this.mode === EXCHANGE_MODE.FROM_SCRT) {
        await this.swapSnip20ToEth(this.token === TOKEN.NATIVE);
      } else if (this.mode === EXCHANGE_MODE.TO_SCRT) {
        if (this.token === TOKEN.ERC20) {
          await this.checkTokenApprove(this.transaction.erc20Address);
          if (!this.isTokenApproved) {
            await this.approveErc20();
          } else {
            await this.swapErc20ToScrt();
          }
        } else {
          await this.swapEthToScrt();
        }
      }

      return;
    } catch (e) {
      if (e.status && e.response.body) {
        this.transaction.error = e.response.body.message;
      } else {
        this.transaction.error = e.message;
      }
      this.actionStatus = 'error';
      this.operation = null;
    }
  }

  async approveErc20() {
    this.operation = this.defaultOperation;
    //await this.createOperation();
    //this.stores.routing.push('/operations/' + this.operation.id);

    contract.fromScrtMethods[this.network][this.token].callApprove(
      this.transaction.erc20Address,
      this.transaction.amount,
      this.stores.userMetamask.erc20TokenDetails.decimals,
      async result => {
        if (result.hash) {
          this.updateOperation(this.operation.id, result.hash);
          this.tokenApprovedLoading = true;
          this.transaction.loading = true;
          this.txHash = result.hash;
        }

        if (result.receipt) {
          this.isTokenApproved = true;
          this.tokenApprovedLoading = false;
          this.transaction.loading = false;
        }

        if (result.error) {
          this.tokenApprovedLoading = false;
          this.transaction.loading = false;
          this.transaction.error = result.error.message;
        }
      },
    );
  }

  async swapErc20ToScrt() {
    this.operation = this.defaultOperation;

    contract.fromScrtMethods[this.network][TOKEN.ERC20].swapToken(
      this.transaction.erc20Address,
      this.transaction.scrtAddress,
      this.transaction.amount,
      this.stores.userMetamask.erc20TokenDetails.decimals,
      async result => {
        if (result.hash) {
          await this.createOperation(result.hash);
          this.transaction.loading = false;
          this.txHash = result.hash;
          this.transaction.confirmed = true;
          this.stores.routing.push('/operations/' + this.operation.id);
          this.fetchStatus(this.operation.id);
        }

        if (result.receipt) {
          this.transaction.loading = false;
          this.transaction.confirmed = result.receipt;
        }

        if (result.error) {
          this.transaction.error = result.error.message;
          this.transaction.loading = false;
          this.operation.status = SwapStatus.SWAP_FAILED;
        }
      },
    );

    return;
  }

  async swapEthToScrt() {
    this.operation = this.defaultOperation;

    try {
      contract.fromScrtMethods[this.network][TOKEN.NATIVE].swapEth(
        this.transaction.scrtAddress,
        this.transaction.amount,
        async result => {
          if (result.hash) {
            await this.createOperation(result.hash);
            this.transaction.loading = false;
            this.txHash = result.hash;
            this.transaction.confirmed = true;
            this.stores.routing.push('/operations/' + this.operation.id);
            this.fetchStatus(this.operation.id);
          }

          if (result.receipt) {
            this.transaction.loading = false;
            this.transaction.confirmed = true;
          }

          if (result.error) {
            this.transaction.error = result.error.message;
            this.transaction.loading = false;
            this.operation.status = SwapStatus.SWAP_FAILED;
          }
        },
      );
    } catch (error) {
      console.log('error', error);
    }
    return;
  }

  async swapSnip20ToEth(isNative: boolean) {
    this.operation = this.defaultOperation;

    let proxyContract: string;
    let decimals: number | string;
    let recipient = chainPropToString(chainProps.swap_contract, this.network);
    //let price: string;
    if (isNative) {
      const token = this.tokens.find(t => t.src_address === 'native');
      decimals = token.decimals;
      //price = token.price;
      this.transaction.snip20Address = token.dst_address;
    } else {
      const token = this.tokens.find(t => t.dst_address === this.transaction.snip20Address);
      if (token) {
        decimals = token.decimals;
        //price = token.price;
        this.transaction.snip20Address = token.dst_address;
        // todo: fix this up - proxy token
        if (token.display_props.proxy) {
          proxyContract = ProxyTokens[token.display_props.symbol.toUpperCase()][this.network]?.proxy;
          recipient = ProxyTokens[token.display_props.symbol.toUpperCase()][this.network]?.proxy;
          this.transaction.snip20Address = ProxyTokens[token.display_props.symbol.toUpperCase()][this.network]?.token;

          // if (
          //   token.display_props.symbol.toUpperCase() === 'WSCRT' ||
          //   token.display_props.symbol.toUpperCase() === 'SSCRT'
          // ) {
          //   proxyContract = process.env.WSCRT_PROXY_CONTRACT;
          //   recipient = process.env.WSCRT_PROXY_CONTRACT;
          //   this.transaction.snip20Address = process.env.SSCRT_CONTRACT;
          // } else if (token.display_props.symbol === 'SIENNA') {
          //   proxyContract = process.env.SIENNA_PROXY_CONTRACT;
          //   recipient = process.env.SIENNA_PROXY_CONTRACT;
          //   this.transaction.snip20Address = process.env.SIENNA_CONTRACT;
          // }
        }
      }
    }

    const amount = mulDecimals(this.transaction.amount, decimals).toString();

    let tx_id = '';
    try {
      tx_id = await Snip20SendToBridge({
        recipient,
        secretjs: this.stores.user.secretjsSend,
        address: this.transaction.snip20Address,
        amount,
        msg: btoa(this.transaction.ethAddress),
      });
      this.transaction.confirmed = true;
      this.transaction.loading = false;
      await this.createOperation(
        Snip20SwapHash({
          tx_id,
          address: proxyContract || this.transaction.snip20Address,
        }),
      );
      this.stores.routing.push('/operations/' + this.operation.id);
      this.fetchStatus(this.operation.id);
    } catch (e) {
      this.operation.status = SwapStatus.SWAP_FAILED;
      this.transaction.error = e.message;
      this.transaction.loading = false;
      //throw e;
    }
  }

  clear() {
    this.transaction = this.defaultTransaction;
  }
}

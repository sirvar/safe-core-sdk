import {
  CreateCallEthersContract,
  CreateProxyProps as CreateEthersProxyProps,
  EthersAdapter,
  EthersAdapterConfig,
  EthersTransactionOptions,
  EthersTransactionResult,
  GnosisSafeContractEthers,
  GnosisSafeProxyFactoryEthersContract,
  MultiSendCallOnlyEthersContract,
  MultiSendEthersContract,
  SignMessageLibEthersContract
} from './adapters/ethers'
import {
  CreateCallWeb3Contract,
  CreateProxyProps as CreateWeb3ProxyProps,
  GnosisSafeContractWeb3,
  GnosisSafeProxyFactoryWeb3Contract,
  MultiSendCallOnlyWeb3Contract,
  MultiSendWeb3Contract,
  SignMessageLibWeb3Contract,
  Web3Adapter,
  Web3AdapterConfig,
  Web3TransactionOptions,
  Web3TransactionResult
} from './adapters/web3'
import {
  getCompatibilityFallbackHandlerContract,
  getCreateCallContract,
  getMultiSendCallOnlyContract,
  getMultiSendContract,
  getProxyFactoryContract,
  getSafeContract,
  getSignMessageLibContract
} from './contracts/safeDeploymentContracts'
import ContractManager from './managers/contractManager'
import Safe from './Safe'
import SafeFactory, { DeploySafeProps, SafeFactoryConfig } from './safeFactory'
import {
  AddOwnerTxParams,
  ConnectSafeConfig,
  CreateTransactionProps,
  PredictSafeProps,
  RemoveOwnerTxParams,
  SafeAccountConfig,
  SafeConfig,
  SafeDeploymentConfig,
  SwapOwnerTxParams
} from './types'

import { ContractNetworksConfig } from './types'
import { SafeTransactionOptionalProps } from './utils/transactions/types'
import { standardizeSafeTransactionData } from './utils/transactions/utils'

export {
  ContractManager,
  SafeFactory,
  SafeFactoryConfig,
  SafeAccountConfig,
  SafeDeploymentConfig,
  PredictSafeProps,
  DeploySafeProps,
  SafeConfig,
  ConnectSafeConfig,
  ContractNetworksConfig,
  SafeTransactionOptionalProps,
  CreateTransactionProps,
  AddOwnerTxParams,
  RemoveOwnerTxParams,
  SwapOwnerTxParams,
  standardizeSafeTransactionData,
  EthersAdapter,
  EthersAdapterConfig,
  EthersTransactionOptions,
  EthersTransactionResult,
  CreateEthersProxyProps,
  CreateCallEthersContract,
  GnosisSafeContractEthers,
  GnosisSafeProxyFactoryEthersContract,
  MultiSendEthersContract,
  MultiSendCallOnlyEthersContract,
  SignMessageLibEthersContract,
  Web3Adapter,
  Web3AdapterConfig,
  Web3TransactionOptions,
  CreateWeb3ProxyProps,
  Web3TransactionResult,
  CreateCallWeb3Contract,
  GnosisSafeContractWeb3,
  GnosisSafeProxyFactoryWeb3Contract,
  MultiSendWeb3Contract,
  MultiSendCallOnlyWeb3Contract,
  SignMessageLibWeb3Contract,
  getSafeContract,
  getProxyFactoryContract,
  getCompatibilityFallbackHandlerContract,
  getMultiSendContract,
  getMultiSendCallOnlyContract,
  getSignMessageLibContract,
  getCreateCallContract
}

export default Safe

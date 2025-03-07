import { BigNumber } from '@ethersproject/bignumber'
import {
  Eip3770Address,
  EthAdapter,
  EthAdapterTransaction,
  GetContractProps,
  SafeTransactionEIP712Args
} from '@safe-global/safe-core-sdk-types'
import { generateTypedData, validateEip3770Address } from '@safe-global/protocol-kit/utils'
import Web3 from 'web3'
import { Transaction } from 'web3-core'
import { ContractOptions } from 'web3-eth-contract'
import { AbiItem } from 'web3-utils'
// TODO remove @types/web3 when migrating to web3@v4
// Deprecated https://www.npmjs.com/package/@types/web3?activeTab=readme
// Migration guide https://docs.web3js.org/docs/guides/web3_migration_guide#types
import type { JsonRPCResponse, Provider } from 'web3/providers'
import CompatibilityFallbackHandlerWeb3Contract from './contracts/CompatibilityFallbackHandler/CompatibilityFallbackHandlerWeb3Contract'
import {
  getCompatibilityFallbackHandlerContractInstance,
  getCreateCallContractInstance,
  getGnosisSafeProxyFactoryContractInstance,
  getMultiSendCallOnlyContractInstance,
  getMultiSendContractInstance,
  getSafeContractInstance,
  getSignMessageLibContractInstance
} from './contracts/contractInstancesWeb3'
import CreateCallWeb3Contract from './contracts/CreateCall/CreateCallWeb3Contract'
import GnosisSafeContractWeb3 from './contracts/GnosisSafe/GnosisSafeContractWeb3'
import GnosisSafeProxyFactoryWeb3Contract from './contracts/GnosisSafeProxyFactory/GnosisSafeProxyFactoryWeb3Contract'
import MultiSendWeb3Contract from './contracts/MultiSend/MultiSendWeb3Contract'
import MultiSendCallOnlyWeb3Contract from './contracts/MultiSendCallOnly/MultiSendCallOnlyWeb3Contract'
import SignMessageLibWeb3Contract from './contracts/SignMessageLib/SignMessageLibWeb3Contract'

export interface Web3AdapterConfig {
  /** web3 - Web3 library */
  web3: Web3
  /** signerAddress - Address of the signer */
  signerAddress?: string
}

class Web3Adapter implements EthAdapter {
  #web3: Web3
  #signerAddress?: string

  constructor({ web3, signerAddress }: Web3AdapterConfig) {
    if (!web3) {
      throw new Error('web3 property missing from options')
    }
    this.#web3 = web3
    this.#signerAddress = signerAddress
  }

  isAddress(address: string): boolean {
    return this.#web3.utils.isAddress(address)
  }

  async getEip3770Address(fullAddress: string): Promise<Eip3770Address> {
    const chainId = await this.getChainId()
    return validateEip3770Address(fullAddress, chainId)
  }

  async getBalance(address: string, defaultBlock?: string | number): Promise<BigNumber> {
    const balance = defaultBlock
      ? await this.#web3.eth.getBalance(address, defaultBlock)
      : await this.#web3.eth.getBalance(address)
    return BigNumber.from(balance)
  }

  async getNonce(address: string, defaultBlock?: string | number): Promise<number> {
    const nonce = defaultBlock
      ? await this.#web3.eth.getTransactionCount(address, defaultBlock)
      : await this.#web3.eth.getTransactionCount(address)
    return nonce
  }

  async getChainId(): Promise<number> {
    return this.#web3.eth.getChainId()
  }

  getChecksummedAddress(address: string): string {
    return this.#web3.utils.toChecksumAddress(address)
  }

  getSafeContract({
    safeVersion,
    chainId,
    singletonDeployment,
    customContractAddress,
    customContractAbi
  }: GetContractProps): GnosisSafeContractWeb3 {
    const contractAddress = customContractAddress ?? singletonDeployment?.networkAddresses[chainId]
    if (!contractAddress) {
      throw new Error('Invalid SafeProxy contract address')
    }
    const safeContract = this.getContract(
      contractAddress,
      customContractAbi ?? (singletonDeployment?.abi as AbiItem[])
    )
    return getSafeContractInstance(safeVersion, safeContract)
  }

  getSafeProxyFactoryContract({
    safeVersion,
    chainId,
    singletonDeployment,
    customContractAddress,
    customContractAbi
  }: GetContractProps): GnosisSafeProxyFactoryWeb3Contract {
    const contractAddress = customContractAddress ?? singletonDeployment?.networkAddresses[chainId]
    if (!contractAddress) {
      throw new Error('Invalid SafeProxyFactory contract address')
    }
    const proxyFactoryContract = this.getContract(
      contractAddress,
      customContractAbi ?? (singletonDeployment?.abi as AbiItem[])
    )
    return getGnosisSafeProxyFactoryContractInstance(safeVersion, proxyFactoryContract)
  }

  getMultiSendContract({
    safeVersion,
    chainId,
    singletonDeployment,
    customContractAddress,
    customContractAbi
  }: GetContractProps): MultiSendWeb3Contract {
    const contractAddress = customContractAddress ?? singletonDeployment?.networkAddresses[chainId]
    if (!contractAddress) {
      throw new Error('Invalid MultiSend contract address')
    }
    const multiSendContract = this.getContract(
      contractAddress,
      customContractAbi ?? (singletonDeployment?.abi as AbiItem[])
    )
    return getMultiSendContractInstance(safeVersion, multiSendContract)
  }

  getMultiSendCallOnlyContract({
    safeVersion,
    chainId,
    singletonDeployment,
    customContractAddress,
    customContractAbi
  }: GetContractProps): MultiSendCallOnlyWeb3Contract {
    const contractAddress = customContractAddress ?? singletonDeployment?.networkAddresses[chainId]
    if (!contractAddress) {
      throw new Error('Invalid MultiSendCallOnly contract address')
    }
    const multiSendContract = this.getContract(
      contractAddress,
      customContractAbi ?? (singletonDeployment?.abi as AbiItem[])
    )
    return getMultiSendCallOnlyContractInstance(safeVersion, multiSendContract)
  }

  getCompatibilityFallbackHandlerContract({
    safeVersion,
    chainId,
    singletonDeployment,
    customContractAddress,
    customContractAbi
  }: GetContractProps): CompatibilityFallbackHandlerWeb3Contract {
    const contractAddress = customContractAddress ?? singletonDeployment?.networkAddresses[chainId]
    if (!contractAddress) {
      throw new Error('Invalid Compatibility Fallback Handler contract address')
    }
    const multiSendContract = this.getContract(
      contractAddress,
      customContractAbi ?? (singletonDeployment?.abi as AbiItem[])
    )
    return getCompatibilityFallbackHandlerContractInstance(safeVersion, multiSendContract)
  }

  getSignMessageLibContract({
    safeVersion,
    chainId,
    singletonDeployment,
    customContractAddress,
    customContractAbi
  }: GetContractProps): SignMessageLibWeb3Contract {
    const contractAddress = customContractAddress ?? singletonDeployment?.networkAddresses[chainId]
    if (!contractAddress) {
      throw new Error('Invalid SignMessageLib contract address')
    }
    const signMessageLibContract = this.getContract(
      contractAddress,
      customContractAbi ?? (singletonDeployment?.abi as AbiItem[])
    )
    return getSignMessageLibContractInstance(safeVersion, signMessageLibContract)
  }

  getCreateCallContract({
    safeVersion,
    chainId,
    singletonDeployment,
    customContractAddress,
    customContractAbi
  }: GetContractProps): CreateCallWeb3Contract {
    const contractAddress = customContractAddress ?? singletonDeployment?.networkAddresses[chainId]
    if (!contractAddress) {
      throw new Error('Invalid CreateCall contract address')
    }
    const createCallContract = this.getContract(
      contractAddress,
      customContractAbi ?? (singletonDeployment?.abi as AbiItem[])
    )
    return getCreateCallContractInstance(safeVersion, createCallContract)
  }

  getContract(address: string, abi: AbiItem | AbiItem[], options?: ContractOptions): any {
    return new this.#web3.eth.Contract(abi, address, options)
  }

  async getContractCode(address: string, defaultBlock?: string | number): Promise<string> {
    const code = defaultBlock
      ? await this.#web3.eth.getCode(address, defaultBlock)
      : await this.#web3.eth.getCode(address)
    return code
  }

  async isContractDeployed(address: string, defaultBlock?: string | number): Promise<boolean> {
    const contractCode = await this.getContractCode(address, defaultBlock)
    return contractCode !== '0x'
  }

  async getStorageAt(address: string, position: string): Promise<string> {
    const content = await this.#web3.eth.getStorageAt(address, position)
    const decodedContent = this.decodeParameters(['address'], content)
    return decodedContent[0]
  }

  async getTransaction(transactionHash: string): Promise<Transaction> {
    return this.#web3.eth.getTransaction(transactionHash)
  }

  async getSignerAddress(): Promise<string | undefined> {
    return this.#signerAddress
  }

  signMessage(message: string): Promise<string> {
    if (!this.#signerAddress) {
      throw new Error('EthAdapter must be initialized with a signer to use this method')
    }
    return this.#web3.eth.sign(message, this.#signerAddress)
  }

  async signTypedData(
    safeTransactionEIP712Args: SafeTransactionEIP712Args,
    methodVersion?: 'v3' | 'v4'
  ): Promise<string> {
    if (!this.#signerAddress) {
      throw new Error('This method requires a signer')
    }
    const typedData = generateTypedData(safeTransactionEIP712Args)
    let method = 'eth_signTypedData_v3'
    if (methodVersion === 'v4') {
      method = 'eth_signTypedData_v4'
    } else if (!methodVersion) {
      method = 'eth_signTypedData'
    }
    const jsonTypedData = JSON.stringify(typedData)
    const signedTypedData = {
      jsonrpc: '2.0',
      method,
      params:
        methodVersion === 'v3' || methodVersion === 'v4'
          ? [this.#signerAddress, jsonTypedData]
          : [jsonTypedData, this.#signerAddress],
      from: this.#signerAddress,
      id: new Date().getTime()
    }
    return new Promise((resolve, reject) => {
      const provider = this.#web3.currentProvider as Provider
      function callback(err: Error): void
      function callback(err: null, val: JsonRPCResponse): void
      function callback(err: null | Error, val?: JsonRPCResponse): void {
        if (err) {
          reject(err)
          return
        }
        if (val?.result == null) {
          reject(new Error("EIP-712 is not supported by user's wallet"))
          return
        }
        resolve(val.result)
      }
      provider.send(signedTypedData, callback)
    })
  }

  estimateGas(
    transaction: EthAdapterTransaction,
    callback?: (error: Error, gas: number) => void
  ): Promise<number> {
    return this.#web3.eth.estimateGas(transaction, callback)
  }

  call(transaction: EthAdapterTransaction, defaultBlock?: string | number): Promise<string> {
    return this.#web3.eth.call(transaction, defaultBlock)
  }

  encodeParameters(types: string[], values: any[]): string {
    return this.#web3.eth.abi.encodeParameters(types, values)
  }

  decodeParameters(types: any[], values: string): { [key: string]: any } {
    return this.#web3.eth.abi.decodeParameters(types, values)
  }
}

export default Web3Adapter

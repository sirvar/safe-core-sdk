import { BigNumber } from '@ethersproject/bignumber'
import {
  EthAdapter,
  MetaTransactionData,
  OperationType,
  SafeMultisigTransactionResponse,
  SafeTransaction,
  SafeTransactionDataPartial,
  SafeTransactionEIP712Args,
  SafeVersion,
  TransactionOptions,
  TransactionResult
} from '@safe-global/safe-core-sdk-types'
import {
  SAFE_FEATURES,
  hasSafeFeature,
  isMetaTransactionArray,
  isSafeMultisigTransactionResponse,
  sameString
} from './utils'
import ContractManager from './managers/contractManager'
import FallbackHandlerManager from './managers/fallbackHandlerManager'
import GuardManager from './managers/guardManager'
import ModuleManager from './managers/moduleManager'
import OwnerManager from './managers/ownerManager'
import { ContractNetworksConfig } from './types'
import {
  generateEIP712Signature,
  generatePreValidatedSignature,
  generateSignature
} from './utils/signatures'
import SafeSignature from './utils/signatures/SafeSignature'
import EthSafeTransaction from './utils/transactions/SafeTransaction'
import { SafeTransactionOptionalProps } from './utils/transactions/types'
import {
  encodeMultiSendData,
  standardizeMetaTransactionData,
  standardizeSafeTransactionData
} from './utils/transactions/utils'

export interface SafeConfig {
  /** ethAdapter - Ethereum adapter */
  ethAdapter: EthAdapter
  /** safeAddress - The address of the Safe account to use */
  safeAddress: string
  /** isL1SafeMasterCopy - Forces to use the GnosisSafe L1 version of the contract instead of the L2 version */
  isL1SafeMasterCopy?: boolean
  /** contractNetworks - Contract network configuration */
  contractNetworks?: ContractNetworksConfig
}

export interface ConnectSafeConfig {
  /** ethAdapter - Ethereum adapter */
  ethAdapter?: EthAdapter
  /** safeAddress - The address of the Safe account to use */
  safeAddress?: string
  /** isL1SafeMasterCopy - Forces to use the GnosisSafe L1 version of the contract instead of the L2 version */
  isL1SafeMasterCopy?: boolean
  /** contractNetworks - Contract network configuration */
  contractNetworks?: ContractNetworksConfig
}

export interface CreateTransactionProps {
  /** safeTransactionData - The transaction or transaction array to process */
  safeTransactionData: SafeTransactionDataPartial | MetaTransactionData[]
  /** options - The transaction array optional properties */
  options?: SafeTransactionOptionalProps
  /** onlyCalls - Forces the execution of the transaction array with MultiSendCallOnly contract */
  onlyCalls?: boolean
}

export interface AddOwnerTxParams {
  /** ownerAddress - The address of the new owner */
  ownerAddress: string
  /** threshold - The new threshold */
  threshold?: number
}

export interface RemoveOwnerTxParams {
  /** ownerAddress - The address of the owner that will be removed */
  ownerAddress: string
  /** threshold - The new threshold */
  threshold?: number
}

export interface SwapOwnerTxParams {
  /** oldOwnerAddress - The old owner address */
  oldOwnerAddress: string
  /** newOwnerAddress - The new owner address */
  newOwnerAddress: string
}

class Safe {
  #ethAdapter!: EthAdapter
  #contractManager!: ContractManager
  #ownerManager!: OwnerManager
  #moduleManager!: ModuleManager
  #guardManager!: GuardManager
  #fallbackHandlerManager!: FallbackHandlerManager

  /**
   * Creates an instance of the Safe Core SDK.
   * @param config - Ethers Safe configuration
   * @returns The Safe Core SDK instance
   * @throws "SafeProxy contract is not deployed on the current network"
   * @throws "MultiSend contract is not deployed on the current network"
   * @throws "MultiSendCallOnly contract is not deployed on the current network"
   */
  static async create({
    ethAdapter,
    safeAddress,
    isL1SafeMasterCopy,
    contractNetworks
  }: SafeConfig): Promise<Safe> {
    const safeSdk = new Safe()
    await safeSdk.init({ ethAdapter, safeAddress, isL1SafeMasterCopy, contractNetworks })
    return safeSdk
  }

  /**
   * Initializes the Safe Core SDK instance.
   * @param config - Safe configuration
   * @throws "Signer must be connected to a provider"
   * @throws "SafeProxy contract is not deployed on the current network"
   * @throws "MultiSend contract is not deployed on the current network"
   * @throws "MultiSendCallOnly contract is not deployed on the current network"
   */
  private async init({
    ethAdapter,
    safeAddress,
    isL1SafeMasterCopy,
    contractNetworks
  }: SafeConfig): Promise<void> {
    this.#ethAdapter = ethAdapter
    this.#contractManager = await ContractManager.create({
      ethAdapter: this.#ethAdapter,
      safeAddress,
      isL1SafeMasterCopy,
      contractNetworks
    })
    this.#ownerManager = new OwnerManager(this.#ethAdapter, this.#contractManager.safeContract)
    this.#moduleManager = new ModuleManager(this.#ethAdapter, this.#contractManager.safeContract)
    this.#guardManager = new GuardManager(this.#ethAdapter, this.#contractManager.safeContract)
    this.#fallbackHandlerManager = new FallbackHandlerManager(
      this.#ethAdapter,
      this.#contractManager.safeContract
    )
  }

  /**
   * Returns a new instance of the Safe Core SDK.
   * @param config - Connect Safe configuration
   * @throws "SafeProxy contract is not deployed on the current network"
   * @throws "MultiSend contract is not deployed on the current network"
   * @throws "MultiSendCallOnly contract is not deployed on the current network"
   */
  async connect({
    ethAdapter,
    safeAddress,
    isL1SafeMasterCopy,
    contractNetworks
  }: ConnectSafeConfig): Promise<Safe> {
    return await Safe.create({
      ethAdapter: ethAdapter || this.#ethAdapter,
      safeAddress: safeAddress || this.getAddress(),
      isL1SafeMasterCopy: isL1SafeMasterCopy || this.#contractManager.isL1SafeMasterCopy,
      contractNetworks: contractNetworks || this.#contractManager.contractNetworks
    })
  }

  /**
   * Returns the address of the current SafeProxy contract.
   *
   * @returns The address of the SafeProxy contract
   */
  getAddress(): string {
    return this.#contractManager.safeContract.getAddress()
  }

  /**
   * Returns the ContractManager
   *
   * @returns The current ContractManager
   * */
  getContractManager(): ContractManager {
    return this.#contractManager
  }

  /**
   * Returns the current EthAdapter.
   *
   * @returns The current EthAdapter
   */
  getEthAdapter(): EthAdapter {
    return this.#ethAdapter
  }

  /**
   * Returns the address of the MultiSend contract.
   *
   * @returns The address of the MultiSend contract
   */
  getMultiSendAddress(): string {
    return this.#contractManager.multiSendContract.getAddress()
  }

  /**
   * Returns the address of the MultiSendCallOnly contract.
   *
   * @returns The address of the MultiSendCallOnly contract
   */
  getMultiSendCallOnlyAddress(): string {
    return this.#contractManager.multiSendCallOnlyContract.getAddress()
  }

  /**
   * Returns the Safe Master Copy contract version.
   *
   * @returns The Safe Master Copy contract version
   */
  async getContractVersion(): Promise<SafeVersion> {
    return this.#contractManager.safeContract.getVersion()
  }

  /**
   * Returns the list of Safe owner accounts.
   *
   * @returns The list of owners
   */
  async getOwners(): Promise<string[]> {
    return this.#ownerManager.getOwners()
  }

  /**
   * Returns the Safe nonce.
   *
   * @returns The Safe nonce
   */
  async getNonce(): Promise<number> {
    return this.#contractManager.safeContract.getNonce()
  }

  /**
   * Returns the Safe threshold.
   *
   * @returns The Safe threshold
   */
  async getThreshold(): Promise<number> {
    return this.#ownerManager.getThreshold()
  }

  /**
   * Returns the chainId of the connected network.
   *
   * @returns The chainId of the connected network
   */
  async getChainId(): Promise<number> {
    return this.#ethAdapter.getChainId()
  }

  /**
   * Returns the ETH balance of the Safe.
   *
   * @returns The ETH balance of the Safe
   */
  async getBalance(): Promise<BigNumber> {
    return this.#ethAdapter.getBalance(this.getAddress())
  }

  /**
   * Returns the address of the FallbackHandler contract.
   *
   * @returns The address of the FallbackHandler contract
   */
  getFallbackHandler(): Promise<string> {
    return this.#fallbackHandlerManager.getFallbackHandler()
  }

  /**
   * Returns the enabled Safe guard or 0x address if no guards are enabled.
   *
   * @returns The address of the enabled Safe guard
   * @throws "Current version of the Safe does not support Safe transaction guards functionality"
   */
  async getGuard(): Promise<string> {
    return this.#guardManager.getGuard()
  }

  /**
   * Returns the list of addresses of all the enabled Safe modules.
   *
   * @returns The list of addresses of all the enabled Safe modules
   */
  async getModules(): Promise<string[]> {
    return this.#moduleManager.getModules()
  }

  /**
   * Checks if a specific Safe module is enabled for the current Safe.
   *
   * @param moduleAddress - The desired module address
   * @returns TRUE if the module is enabled
   */
  async isModuleEnabled(moduleAddress: string): Promise<boolean> {
    return this.#moduleManager.isModuleEnabled(moduleAddress)
  }

  /**
   * Checks if a specific address is an owner of the current Safe.
   *
   * @param ownerAddress - The account address
   * @returns TRUE if the account is an owner
   */
  async isOwner(ownerAddress: string): Promise<boolean> {
    return this.#ownerManager.isOwner(ownerAddress)
  }

  /**
   * Returns a Safe transaction ready to be signed by the owners.
   *
   * @param createTransactionProps - The createTransaction props
   * @returns The Safe transaction
   * @throws "Invalid empty array of transactions"
   */
  async createTransaction({
    safeTransactionData,
    onlyCalls = false,
    options
  }: CreateTransactionProps): Promise<SafeTransaction> {
    if (isMetaTransactionArray(safeTransactionData) && safeTransactionData.length === 0) {
      throw new Error('Invalid empty array of transactions')
    }
    let newTransaction: SafeTransactionDataPartial
    if (isMetaTransactionArray(safeTransactionData) && safeTransactionData.length > 1) {
      const multiSendContract = onlyCalls
        ? this.#contractManager.multiSendCallOnlyContract
        : this.#contractManager.multiSendContract
      const multiSendData = encodeMultiSendData(
        safeTransactionData.map(standardizeMetaTransactionData)
      )
      const multiSendTransaction = {
        ...options,
        to: multiSendContract.getAddress(),
        value: '0',
        data: multiSendContract.encode('multiSend', [multiSendData]),
        operation: OperationType.DelegateCall
      }
      newTransaction = multiSendTransaction
    } else {
      newTransaction = isMetaTransactionArray(safeTransactionData)
        ? { ...options, ...safeTransactionData[0] }
        : safeTransactionData
    }
    const standardizedTransaction = await standardizeSafeTransactionData(
      this.#contractManager.safeContract,
      this.#ethAdapter,
      newTransaction
    )
    return new EthSafeTransaction(standardizedTransaction)
  }

  /**
   * Returns a Safe transaction ready to be signed by the owners that invalidates the pending Safe transaction/s with a specific nonce.
   *
   * @param nonce - The nonce of the transaction/s that are going to be rejected
   * @returns The Safe transaction that invalidates the pending Safe transaction/s
   */
  async createRejectionTransaction(nonce: number): Promise<SafeTransaction> {
    const safeTransactionData: SafeTransactionDataPartial = {
      to: this.getAddress(),
      nonce,
      value: '0',
      data: '0x',
      safeTxGas: 0
    }
    return this.createTransaction({ safeTransactionData })
  }

  /**
   * Copies a Safe transaction
   *
   * @param safeTransaction - The Safe transaction
   * @returns The new Safe transaction
   */
  async copyTransaction(safeTransaction: SafeTransaction): Promise<SafeTransaction> {
    const signedSafeTransaction = await this.createTransaction({
      safeTransactionData: safeTransaction.data
    })
    safeTransaction.signatures.forEach((signature) => {
      signedSafeTransaction.addSignature(signature)
    })
    return signedSafeTransaction
  }

  /**
   * Returns the transaction hash of a Safe transaction.
   *
   * @param safeTransaction - The Safe transaction
   * @returns The transaction hash of the Safe transaction
   */
  async getTransactionHash(safeTransaction: SafeTransaction): Promise<string> {
    const safeTransactionData = safeTransaction.data
    const txHash = await this.#contractManager.safeContract.getTransactionHash(safeTransactionData)
    return txHash
  }

  /**
   * Signs a hash using the current signer account.
   *
   * @param hash - The hash to sign
   * @returns The Safe signature
   */
  async signTransactionHash(hash: string): Promise<SafeSignature> {
    return generateSignature(this.#ethAdapter, hash)
  }

  /**
   * Signs a transaction according to the EIP-712 using the current signer account.
   *
   * @param safeTransaction - The Safe transaction to be signed
   * @param methodVersion - EIP-712 version. Optional
   * @returns The Safe signature
   */
  async signTypedData(
    safeTransaction: SafeTransaction,
    methodVersion?: 'v3' | 'v4'
  ): Promise<SafeSignature> {
    const safeTransactionEIP712Args: SafeTransactionEIP712Args = {
      safeAddress: this.getAddress(),
      safeVersion: await this.getContractVersion(),
      chainId: await this.getEthAdapter().getChainId(),
      safeTransactionData: safeTransaction.data
    }
    return generateEIP712Signature(this.#ethAdapter, safeTransactionEIP712Args, methodVersion)
  }

  /**
   * Adds the signature of the current signer to the Safe transaction object.
   *
   * @param safeTransaction - The Safe transaction to be signed
   * @param signingMethod - Method followed to sign a transaction. Optional. Default value is "eth_sign"
   * @returns The signed Safe transaction
   * @throws "Transactions can only be signed by Safe owners"
   */
  async signTransaction(
    safeTransaction: SafeTransaction | SafeMultisigTransactionResponse,
    signingMethod:
      | 'eth_sign'
      | 'eth_signTypedData'
      | 'eth_signTypedData_v3'
      | 'eth_signTypedData_v4' = 'eth_signTypedData_v4'
  ): Promise<SafeTransaction> {
    const transaction = isSafeMultisigTransactionResponse(safeTransaction)
      ? await this.toSafeTransactionType(safeTransaction)
      : safeTransaction

    const owners = await this.getOwners()
    const signerAddress = await this.#ethAdapter.getSignerAddress()
    if (!signerAddress) {
      throw new Error('EthAdapter must be initialized with a signer to use this method')
    }
    const addressIsOwner = owners.find(
      (owner: string) => signerAddress && sameString(owner, signerAddress)
    )
    if (!addressIsOwner) {
      throw new Error('Transactions can only be signed by Safe owners')
    }

    let signature: SafeSignature
    if (signingMethod === 'eth_signTypedData_v4') {
      signature = await this.signTypedData(transaction, 'v4')
    } else if (signingMethod === 'eth_signTypedData_v3') {
      signature = await this.signTypedData(transaction, 'v3')
    } else if (signingMethod === 'eth_signTypedData') {
      signature = await this.signTypedData(transaction)
    } else {
      const safeVersion = await this.getContractVersion()
      if (!hasSafeFeature(SAFE_FEATURES.ETH_SIGN, safeVersion)) {
        throw new Error('eth_sign is only supported by Safes >= v1.1.0')
      }
      const txHash = await this.getTransactionHash(transaction)
      signature = await this.signTransactionHash(txHash)
    }

    const signedSafeTransaction = await this.createTransaction({
      safeTransactionData: transaction.data
    })
    transaction.signatures.forEach((signature) => {
      signedSafeTransaction.addSignature(signature)
    })
    signedSafeTransaction.addSignature(signature)
    return signedSafeTransaction
  }

  /**
   * Approves on-chain a hash using the current signer account.
   *
   * @param hash - The hash to approve
   * @param options - The Safe transaction execution options. Optional
   * @returns The Safe transaction response
   * @throws "Transaction hashes can only be approved by Safe owners"
   * @throws "Cannot specify gas and gasLimit together in transaction options"
   */
  async approveTransactionHash(
    hash: string,
    options?: TransactionOptions
  ): Promise<TransactionResult> {
    const owners = await this.getOwners()
    const signerAddress = await this.#ethAdapter.getSignerAddress()
    if (!signerAddress) {
      throw new Error('EthAdapter must be initialized with a signer to use this method')
    }
    const addressIsOwner = owners.find(
      (owner: string) => signerAddress && sameString(owner, signerAddress)
    )
    if (!addressIsOwner) {
      throw new Error('Transaction hashes can only be approved by Safe owners')
    }
    if (options?.gas && options?.gasLimit) {
      throw new Error('Cannot specify gas and gasLimit together in transaction options')
    }
    return this.#contractManager.safeContract.approveHash(hash, {
      from: signerAddress,
      ...options
    })
  }

  /**
   * Returns a list of owners who have approved a specific Safe transaction.
   *
   * @param txHash - The Safe transaction hash
   * @returns The list of owners
   */
  async getOwnersWhoApprovedTx(txHash: string): Promise<string[]> {
    const owners = await this.getOwners()
    const ownersWhoApproved: string[] = []
    for (const owner of owners) {
      const approved = await this.#contractManager.safeContract.approvedHashes(owner, txHash)
      if (approved.gt(0)) {
        ownersWhoApproved.push(owner)
      }
    }
    return ownersWhoApproved
  }

  /**
   * Returns the Safe transaction to enable the fallback handler.
   *
   * @param address - The new fallback handler address
   * @param options - The transaction optional properties
   * @returns The Safe transaction ready to be signed
   * @throws "Invalid fallback handler address provided"
   * @throws "Fallback handler provided is already enabled"
   * @throws "Current version of the Safe does not support the fallback handler functionality"
   */
  async createEnableFallbackHandlerTx(
    fallbackHandlerAddress: string,
    options?: SafeTransactionOptionalProps
  ): Promise<SafeTransaction> {
    const safeTransactionData: SafeTransactionDataPartial = {
      to: this.getAddress(),
      value: '0',
      data: await this.#fallbackHandlerManager.encodeEnableFallbackHandlerData(
        fallbackHandlerAddress
      ),
      ...options
    }
    const safeTransaction = await this.createTransaction({ safeTransactionData })
    return safeTransaction
  }

  /**
   * Returns the Safe transaction to disable the fallback handler.
   *
   * @param options - The transaction optional properties
   * @returns The Safe transaction ready to be signed
   * @throws "There is no fallback handler enabled yet"
   * @throws "Current version of the Safe does not support the fallback handler functionality"
   */
  async createDisableFallbackHandlerTx(
    options?: SafeTransactionOptionalProps
  ): Promise<SafeTransaction> {
    const safeTransactionData: SafeTransactionDataPartial = {
      to: this.getAddress(),
      value: '0',
      data: await this.#fallbackHandlerManager.encodeDisableFallbackHandlerData(),
      ...options
    }
    const safeTransaction = await this.createTransaction({ safeTransactionData })
    return safeTransaction
  }

  /**
   * Returns the Safe transaction to enable a Safe guard.
   *
   * @param guardAddress - The desired guard address
   * @param options - The transaction optional properties
   * @returns The Safe transaction ready to be signed
   * @throws "Invalid guard address provided"
   * @throws "Guard provided is already enabled"
   * @throws "Current version of the Safe does not support Safe transaction guards functionality"
   */
  async createEnableGuardTx(
    guardAddress: string,
    options?: SafeTransactionOptionalProps
  ): Promise<SafeTransaction> {
    const safeTransactionData: SafeTransactionDataPartial = {
      to: this.getAddress(),
      value: '0',
      data: await this.#guardManager.encodeEnableGuardData(guardAddress),
      ...options
    }
    const safeTransaction = await this.createTransaction({ safeTransactionData })
    return safeTransaction
  }

  /**
   * Returns the Safe transaction to disable a Safe guard.
   *
   * @param options - The transaction optional properties
   * @returns The Safe transaction ready to be signed
   * @throws "There is no guard enabled yet"
   * @throws "Current version of the Safe does not support Safe transaction guards functionality"
   */
  async createDisableGuardTx(options?: SafeTransactionOptionalProps): Promise<SafeTransaction> {
    const safeTransactionData: SafeTransactionDataPartial = {
      to: this.getAddress(),
      value: '0',
      data: await this.#guardManager.encodeDisableGuardData(),
      ...options
    }
    const safeTransaction = await this.createTransaction({ safeTransactionData })
    return safeTransaction
  }

  /**
   * Returns the Safe transaction to enable a Safe module.
   *
   * @param moduleAddress - The desired module address
   * @param options - The transaction optional properties
   * @returns The Safe transaction ready to be signed
   * @throws "Invalid module address provided"
   * @throws "Module provided is already enabled"
   */
  async createEnableModuleTx(
    moduleAddress: string,
    options?: SafeTransactionOptionalProps
  ): Promise<SafeTransaction> {
    const safeTransactionData: SafeTransactionDataPartial = {
      to: this.getAddress(),
      value: '0',
      data: await this.#moduleManager.encodeEnableModuleData(moduleAddress),
      ...options
    }
    const safeTransaction = await this.createTransaction({ safeTransactionData })
    return safeTransaction
  }

  /**
   * Returns the Safe transaction to disable a Safe module.
   *
   * @param moduleAddress - The desired module address
   * @param options - The transaction optional properties
   * @returns The Safe transaction ready to be signed
   * @throws "Invalid module address provided"
   * @throws "Module provided is not enabled already"
   */
  async createDisableModuleTx(
    moduleAddress: string,
    options?: SafeTransactionOptionalProps
  ): Promise<SafeTransaction> {
    const safeTransactionData: SafeTransactionDataPartial = {
      to: this.getAddress(),
      value: '0',
      data: await this.#moduleManager.encodeDisableModuleData(moduleAddress),
      ...options
    }
    const safeTransaction = await this.createTransaction({ safeTransactionData })
    return safeTransaction
  }

  /**
   * Returns the Safe transaction to add an owner and optionally change the threshold.
   *
   * @param params - The transaction params
   * @param options - The transaction optional properties
   * @returns The Safe transaction ready to be signed
   * @throws "Invalid owner address provided"
   * @throws "Address provided is already an owner"
   * @throws "Threshold needs to be greater than 0"
   * @throws "Threshold cannot exceed owner count"
   */
  async createAddOwnerTx(
    { ownerAddress, threshold }: AddOwnerTxParams,
    options?: SafeTransactionOptionalProps
  ): Promise<SafeTransaction> {
    const safeTransactionData: SafeTransactionDataPartial = {
      to: this.getAddress(),
      value: '0',
      data: await this.#ownerManager.encodeAddOwnerWithThresholdData(ownerAddress, threshold),
      ...options
    }
    const safeTransaction = await this.createTransaction({ safeTransactionData })
    return safeTransaction
  }

  /**
   * Returns the Safe transaction to remove an owner and optionally change the threshold.
   *
   * @param params - The transaction params
   * @param options - The transaction optional properties
   * @returns The Safe transaction ready to be signed
   * @throws "Invalid owner address provided"
   * @throws "Address provided is not an owner"
   * @throws "Threshold needs to be greater than 0"
   * @throws "Threshold cannot exceed owner count"
   */
  async createRemoveOwnerTx(
    { ownerAddress, threshold }: RemoveOwnerTxParams,
    options?: SafeTransactionOptionalProps
  ): Promise<SafeTransaction> {
    const safeTransactionData: SafeTransactionDataPartial = {
      to: this.getAddress(),
      value: '0',
      data: await this.#ownerManager.encodeRemoveOwnerData(ownerAddress, threshold),
      ...options
    }
    const safeTransaction = await this.createTransaction({ safeTransactionData })
    return safeTransaction
  }

  /**
   * Returns the Safe transaction to replace an owner of the Safe with a new one.
   *
   * @param params - The transaction params
   * @param options - The transaction optional properties
   * @returns The Safe transaction ready to be signed
   * @throws "Invalid new owner address provided"
   * @throws "Invalid old owner address provided"
   * @throws "New address provided is already an owner"
   * @throws "Old address provided is not an owner"
   */
  async createSwapOwnerTx(
    { oldOwnerAddress, newOwnerAddress }: SwapOwnerTxParams,
    options?: SafeTransactionOptionalProps
  ): Promise<SafeTransaction> {
    const safeTransactionData: SafeTransactionDataPartial = {
      to: this.getAddress(),
      value: '0',
      data: await this.#ownerManager.encodeSwapOwnerData(oldOwnerAddress, newOwnerAddress),
      ...options
    }
    const safeTransaction = await this.createTransaction({ safeTransactionData })
    return safeTransaction
  }

  /**
   * Returns the Safe transaction to change the threshold.
   *
   * @param threshold - The new threshold
   * @param options - The transaction optional properties
   * @returns The Safe transaction ready to be signed
   * @throws "Threshold needs to be greater than 0"
   * @throws "Threshold cannot exceed owner count"
   */
  async createChangeThresholdTx(
    threshold: number,
    options?: SafeTransactionOptionalProps
  ): Promise<SafeTransaction> {
    const safeTransactionData: SafeTransactionDataPartial = {
      to: this.getAddress(),
      value: '0',
      data: await this.#ownerManager.encodeChangeThresholdData(threshold),
      ...options
    }
    const safeTransaction = await this.createTransaction({ safeTransactionData })
    return safeTransaction
  }

  /**
   * Converts a transaction from type SafeMultisigTransactionResponse to type SafeTransaction
   *
   * @param serviceTransactionResponse - The transaction to convert
   * @returns The converted transaction with type SafeTransaction
   */
  async toSafeTransactionType(
    serviceTransactionResponse: SafeMultisigTransactionResponse
  ): Promise<SafeTransaction> {
    const safeTransactionData: SafeTransactionDataPartial = {
      to: serviceTransactionResponse.to,
      value: serviceTransactionResponse.value,
      data: serviceTransactionResponse.data || '0x',
      operation: serviceTransactionResponse.operation,
      safeTxGas: serviceTransactionResponse.safeTxGas,
      baseGas: serviceTransactionResponse.baseGas,
      gasPrice: Number(serviceTransactionResponse.gasPrice),
      gasToken: serviceTransactionResponse.gasToken,
      refundReceiver: serviceTransactionResponse.refundReceiver,
      nonce: serviceTransactionResponse.nonce
    }
    const safeTransaction = await this.createTransaction({ safeTransactionData })
    serviceTransactionResponse.confirmations?.map((confirmation) => {
      const signature = new SafeSignature(confirmation.owner, confirmation.signature)
      safeTransaction.addSignature(signature)
    })
    return safeTransaction
  }

  /**
   * Checks if a Safe transaction can be executed successfully with no errors.
   *
   * @param safeTransaction - The Safe transaction to check
   * @param options - The Safe transaction execution options. Optional
   * @returns TRUE if the Safe transaction can be executed successfully with no errors
   */
  async isValidTransaction(
    safeTransaction: SafeTransaction | SafeMultisigTransactionResponse,
    options?: TransactionOptions
  ): Promise<boolean> {
    const transaction = isSafeMultisigTransactionResponse(safeTransaction)
      ? await this.toSafeTransactionType(safeTransaction)
      : safeTransaction

    const signedSafeTransaction = await this.copyTransaction(transaction)

    const txHash = await this.getTransactionHash(signedSafeTransaction)
    const ownersWhoApprovedTx = await this.getOwnersWhoApprovedTx(txHash)
    for (const owner of ownersWhoApprovedTx) {
      signedSafeTransaction.addSignature(generatePreValidatedSignature(owner))
    }
    const owners = await this.getOwners()
    const signerAddress = await this.#ethAdapter.getSignerAddress()
    if (!signerAddress) {
      throw new Error('EthAdapter must be initialized with a signer to use this method')
    }
    if (owners.includes(signerAddress)) {
      signedSafeTransaction.addSignature(generatePreValidatedSignature(signerAddress))
    }

    const isTxValid = await this.#contractManager.safeContract.isValidTransaction(
      signedSafeTransaction,
      {
        from: signerAddress,
        ...options
      }
    )
    return isTxValid
  }

  /**
   * Executes a Safe transaction.
   *
   * @param safeTransaction - The Safe transaction to execute
   * @param options - The Safe transaction execution options. Optional
   * @returns The Safe transaction response
   * @throws "No signer provided"
   * @throws "There are X signatures missing"
   * @throws "Cannot specify gas and gasLimit together in transaction options"
   */
  async executeTransaction(
    safeTransaction: SafeTransaction | SafeMultisigTransactionResponse,
    options?: TransactionOptions
  ): Promise<TransactionResult> {
    const transaction = isSafeMultisigTransactionResponse(safeTransaction)
      ? await this.toSafeTransactionType(safeTransaction)
      : safeTransaction

    const signedSafeTransaction = await this.copyTransaction(transaction)

    const txHash = await this.getTransactionHash(signedSafeTransaction)
    const ownersWhoApprovedTx = await this.getOwnersWhoApprovedTx(txHash)
    for (const owner of ownersWhoApprovedTx) {
      signedSafeTransaction.addSignature(generatePreValidatedSignature(owner))
    }
    const owners = await this.getOwners()
    const signerAddress = await this.#ethAdapter.getSignerAddress()
    if (signerAddress && owners.includes(signerAddress)) {
      signedSafeTransaction.addSignature(generatePreValidatedSignature(signerAddress))
    }

    const threshold = await this.getThreshold()
    if (threshold > signedSafeTransaction.signatures.size) {
      const signaturesMissing = threshold - signedSafeTransaction.signatures.size
      throw new Error(
        `There ${signaturesMissing > 1 ? 'are' : 'is'} ${signaturesMissing} signature${
          signaturesMissing > 1 ? 's' : ''
        } missing`
      )
    }

    const value = BigNumber.from(signedSafeTransaction.data.value)
    if (!value.isZero()) {
      const balance = await this.getBalance()
      if (value.gt(BigNumber.from(balance))) {
        throw new Error('Not enough Ether funds')
      }
    }

    if (options?.gas && options?.gasLimit) {
      throw new Error('Cannot specify gas and gasLimit together in transaction options')
    }
    const txResponse = await this.#contractManager.safeContract.execTransaction(
      signedSafeTransaction,
      {
        from: signerAddress,
        ...options
      }
    )
    return txResponse
  }
}

export default Safe

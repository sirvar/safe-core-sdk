import { EthAdapter, GnosisSafeContract } from '@safe-global/safe-core-sdk-types'
import {
  SAFE_FEATURES,
  hasSafeFeature,
  isZeroAddress,
  sameString
} from '@safe-global/protocol-kit/utils'
import { ZERO_ADDRESS } from '@safe-global/protocol-kit/utils/constants'

class FallbackHandlerManager {
  #ethAdapter: EthAdapter
  #safeContract: GnosisSafeContract
  // keccak256("fallback_manager.handler.address")
  #slot = '0x6c9a6c4a39284e37ed1cf53d337577d14212a4870fb976a4366c693b939918d5'

  constructor(ethAdapter: EthAdapter, safeContract: GnosisSafeContract) {
    this.#ethAdapter = ethAdapter
    this.#safeContract = safeContract
  }

  private validateFallbackHandlerAddress(fallbackHandlerAddress: string): void {
    const isValidAddress = this.#ethAdapter.isAddress(fallbackHandlerAddress)
    if (!isValidAddress || isZeroAddress(fallbackHandlerAddress)) {
      throw new Error('Invalid fallback handler address provided')
    }
  }

  private validateFallbackHandlerIsNotEnabled(
    currentFallbackHandler: string,
    newFallbackHandlerAddress: string
  ): void {
    if (sameString(currentFallbackHandler, newFallbackHandlerAddress)) {
      throw new Error('Fallback handler provided is already enabled')
    }
  }

  private validateFallbackHandlerIsEnabled(fallbackHandlerAddress: string): void {
    if (isZeroAddress(fallbackHandlerAddress)) {
      throw new Error('There is no fallback handler enabled yet')
    }
  }

  async getFallbackHandler(): Promise<string> {
    const safeVersion = await this.#safeContract.getVersion()
    if (hasSafeFeature(SAFE_FEATURES.SAFE_FALLBACK_HANDLER, safeVersion)) {
      return this.#ethAdapter.getStorageAt(this.#safeContract.getAddress(), this.#slot)
    } else {
      throw new Error(
        'Current version of the Safe does not support the fallback handler functionality'
      )
    }
  }

  async encodeEnableFallbackHandlerData(fallbackHandlerAddress: string): Promise<string> {
    this.validateFallbackHandlerAddress(fallbackHandlerAddress)
    const currentFallbackHandler = await this.getFallbackHandler()
    this.validateFallbackHandlerIsNotEnabled(currentFallbackHandler, fallbackHandlerAddress)
    return this.#safeContract.encode('setFallbackHandler', [fallbackHandlerAddress])
  }

  async encodeDisableFallbackHandlerData(): Promise<string> {
    const currentFallbackHandler = await this.getFallbackHandler()
    this.validateFallbackHandlerIsEnabled(currentFallbackHandler)
    return this.#safeContract.encode('setFallbackHandler', [ZERO_ADDRESS])
  }
}

export default FallbackHandlerManager

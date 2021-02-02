import { expect } from '../../../setup'

/* External Imports */
import { ethers } from 'hardhat'
import { Signer, ContractFactory, Contract } from 'ethers'
import { smockit, MockContract } from '@eth-optimism/smock'

/* Internal Imports */
import {
  makeAddressManager,
  NON_ZERO_ADDRESS,
  NON_NULL_BYTES32,
  DUMMY_BATCH_HEADERS,
  DUMMY_BATCH_PROOFS,
  toHexString
} from '../../../helpers'
import { sign } from 'crypto'

describe('OVM_L1MultiMessageRelayer', () => {
  let signer: Signer
  before(async () => {
    ;[signer] = await ethers.getSigners()
  })
  
  let AddressManager: Contract
  let Factory__OVM_L1MultiMessageRelayer: ContractFactory
  let Mock__OVM_L1CrossDomainMessenger: MockContract
  let messages: any[]
  
  before(async () => {

    AddressManager = await makeAddressManager()

    Factory__OVM_L1MultiMessageRelayer = await ethers.getContractFactory(
      'OVM_L1MultiMessageRelayer'
    )

    Mock__OVM_L1CrossDomainMessenger = await smockit(
      await ethers.getContractFactory('OVM_L1CrossDomainMessenger')
    )

    // set the address of the mock contract to target
    await AddressManager.setAddress(
      'OVM_L1CrossDomainMessenger',
      Mock__OVM_L1CrossDomainMessenger.address
    )

    // set the signer as the address required by access control
    await AddressManager.setAddress(
      'OVM_L2BatchMessageRelayer',
      signer.getAddress()
    )

    // define a dummy proof to satisfy the abi
    let dummyProof = {
      stateRoot: NON_NULL_BYTES32,
      stateRootBatchHeader: DUMMY_BATCH_HEADERS[0],
      stateRootProof: DUMMY_BATCH_PROOFS[0],
      stateTrieWitness: toHexString("some bytes"),
      storageTrieWitness: toHexString("some more bytes")
    } 

    // create a few dummy messages to relay
    let m1 = {
      target: "0x1100000000000000000000000000000000000000",
      message: NON_NULL_BYTES32,
      sender: "0x2200000000000000000000000000000000000000",
      messageNonce: 1,
      proof: dummyProof,
    }
    let m2 = {
      target: "0x1100000000000000000000000000000000000000",
      message: NON_NULL_BYTES32,
      sender: "0x2200000000000000000000000000000000000000",
      messageNonce: 2,
      proof: dummyProof,
    }
    let m3 = {
      target: "0x1100000000000000000000000000000000000000",
      message: NON_NULL_BYTES32,
      sender: "0x2200000000000000000000000000000000000000",
      messageNonce: 2,
      proof: dummyProof,
    }
    messages = [m1, m2, m3]
  }
)

  let OVM_L1MultiMessageRelayer: Contract

  beforeEach(async () => {
    OVM_L1MultiMessageRelayer = await Factory__OVM_L1MultiMessageRelayer.deploy(
      AddressManager.address
    )

    // set the address of the OVM_L1MultiMessageRelayer, which the OVM_L1CrossDomainMessenger will
    // check in its onlyRelayer modifier
    await AddressManager.setAddress(
      'OVM_L2MessageRelayer', // This is the string currently used in the AddressManager
      OVM_L1MultiMessageRelayer.address
    )
    // set the mock return value
    Mock__OVM_L1CrossDomainMessenger.smocked.relayMessage.will.return()
  })

  describe('batchRelayMessages', () => {
    it('Successfully relay multiple messages', async () => {
      await OVM_L1MultiMessageRelayer.batchRelayMessages(
        messages
      )
      await expect(
        Mock__OVM_L1CrossDomainMessenger.smocked.relayMessage.calls.length
      ).to.deep.equal(messages.length)
    })


    it('should revert if called by the wrong account', async () => {
      // set the wrong address to use for ACL
      await AddressManager.setAddress(
        'OVM_L2BatchMessageRelayer',
        NON_ZERO_ADDRESS
      )

      await expect(
        OVM_L1MultiMessageRelayer.batchRelayMessages(
          messages
        )
      ).to.be.revertedWith('OVM_L1MultiMessageRelayer: Function can only be called by the OVM_L2BatchMessageRelayer')
    })
  })
})
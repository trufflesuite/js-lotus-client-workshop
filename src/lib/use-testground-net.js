import { useEffect, useCallback } from 'react'
import { LotusRPC } from '@filecoin-shipyard/lotus-client-rpc'
import { BrowserProvider } from '@filecoin-shipyard/lotus-client-provider-browser'
import { testnet } from '@filecoin-shipyard/lotus-client-schema'
import IpfsHttpClient from 'ipfs-http-client'

const api = 'localhost:7777'

export default function useTestgroundNet ({ appState, updateAppState }) {
  const updateAvailable = useCallback(
    updateFunc => {
      updateAppState(draft => {
        if (!draft.available) {
          draft.available = []
        }
        updateFunc(draft.available)
      })
    },
    [updateAppState]
  )
  const updateMiners = useCallback(
    updateFunc => {
      updateAppState(draft => {
        if (!draft.miners) {
          draft.miners = []
        }
        updateFunc(draft.miners)
      })
    },
    [updateAppState]
  )
  const { selectedNode, nodesScanned, rescan, genesisCid } = appState

  useEffect(() => {
    if (nodesScanned && !(rescan > nodesScanned)) return
    let state = { canceled: false }
    updateAvailable(draft => {
      draft = []
    })
    async function run () {
      if (state.canceled) return
      if (!genesisCid) return
      // const paramsUrl = `https://${api}/0/testplan/params`
      // const response = await fetch(paramsUrl)
      // const {
      //   TestInstanceCount: nodeCount,
      //   TestRun: testgroundRunId
      // } = await response.json()
      const nodeCount = 1
      const testgroundRunId = 0
      if (state.canceled) return
      const available = {}
      for (let i = 0; i < nodeCount; i++) {
        available[i] = true
        updateAvailable(draft => {
          draft[i] = true
        })
        const url = `http://${api}/rpc/v0`
        const provider = new BrowserProvider(url, { transport: 'http' })
        const client = new LotusRPC(provider, { schema: testnet.storageMiner })
        const address = await client.actorAddress()
        updateMiners(draft => {
          draft[i] = address
        })
      }
      updateAppState(draft => {
        draft.nodesScanned = Date.now()
        draft.testgroundRunId = testgroundRunId
      })
      if (
        typeof selectedNode === 'undefined' ||
        selectedNode > Object.keys(available).length ||
        !available[selectedNode]
      ) {
        // Select a random node
        const keys = Object.keys(available)
        const randomIndex = Math.floor(Math.random() * Math.floor(keys.length))
        updateAppState(draft => {
          draft.selectedNode = Number(keys[randomIndex])
        })
      }
    }
    run()
    return () => {
      state.canceled = true
    }
  }, [
    updateAppState,
    updateAvailable,
    updateMiners,
    nodesScanned,
    selectedNode,
    genesisCid,
    rescan
  ])

  useEffect(() => {
    let state = { canceled: false }
    async function run () {
      if (state.canceled) return
      const url = `http://${api}/rpc/v0`
      const provider = new BrowserProvider(url, { transport: 'http' })
      const client = new LotusRPC(provider, { schema: testnet.fullNode })
      try {
        const {
          Cids: [{ '/': newGenesisCid }]
        } = await client.chainGetGenesis()
        console.log('Genesis CID:', newGenesisCid)
        const updated = newGenesisCid !== genesisCid
        updateAppState(draft => {
          if (draft.genesisCid && draft.genesisCid !== newGenesisCid) {
            console.log('Old Genesis is different, resetting', draft.genesisCid)
            for (const prop in draft) {
              delete draft[prop]
            }
          }
          draft.genesisCid = newGenesisCid
        })
        if (updated) {
          const versionInfo = await client.version()
          console.log('Version Info:', versionInfo)
          const genesisMinerInfo = await client.stateMinerInfo('t01000', [])
          console.log('Genesis Miner Info:', genesisMinerInfo)
          updateAppState(draft => {
            draft.versionInfo = versionInfo
            draft.sectorSize = genesisMinerInfo.SectorSize
          })
        }
      } catch (e) {
        console.warn('Error fetching genesis:', e)
      }
    }
    run()
    return () => {
      state.canceled = true
    }
  }, [updateAppState, genesisCid, rescan])

  useEffect(() => {
    let state = { canceled: false }
    const ipfs = IpfsHttpClient({
      host: 'localhost',
      port: 5001,
      protocol: 'http',
      apiPath: '/api/v0'
    })
    async function run () {
      if (state.canceled) return
      try {
        const version = await ipfs.version()
        if (state.canceled) return
        updateAppState(draft => {
          draft.ipfsVersion = version
        })
      } catch (e) {
        console.warn('Error connecting to IPFS:', e)
      }
    }
    run()
    return () => {
      state.canceled = true
    }
  }, [updateAppState])
}

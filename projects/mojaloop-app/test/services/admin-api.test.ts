import 'mocha'
import * as sinon from 'sinon'
import * as Chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import axios from 'axios'
import { App } from '../../src/app'
import { AdminApi } from '../../src/services/admin-api'

Chai.use(chaiAsPromised)
const assert = Object.assign(Chai.assert, sinon.assert)

describe('Admin api', async function () {
  let app: App
  let adminApi: AdminApi

  beforeEach(async function () {
    app = new App() // defaults to port 3000
    adminApi = new AdminApi({ app }) // default to port 2000

    await adminApi.start()

  })

  afterEach(function () {
    if(app) app.shutdown()
    if(adminApi) adminApi.shutdown()
  })

  describe('start', function () {
    it('starts the http server', async function () {
      
      const res = await axios.get('http://0.0.0.0:2000/health')

      assert.equal(res.statusText, 'status: ok')
    })
  })

  describe('shutdown', function () {
    it('stops the server', async function () {
      adminApi.shutdown()
      try {
        const res = await axios.get('http://0.0.0.0:2000/health')
      } catch (error) {
        return
      }

      assert.fail('Did not throw expected error')
    })
  })

  it('can add a peer to the app', async function () {
    const appAddPeerSpy = sinon.spy(app, 'addPeer')
    const data = {
      id: 'alice',
      assetCode: 'USD',
      assetScale: '2',
      relation: 'peer',
      mojaAddress: 'moja.alice',
      url: 'http://localhost:7780',
      rules: []
    }

    const response = await axios.post('http://0.0.0.0:2000/participants', { ...data })

    assert.equal(response.status, 202)
    sinon.assert.calledWith(appAddPeerSpy, {
      id: 'alice',
      assetCode: 'USD',
      assetScale: 2,
      relation: 'peer',
      mojaAddress: 'moja.alice',
      url: 'http://localhost:7780',
      rules: []
    })
  })

  it('can set app\'s moja address', async function () {
    const response = await axios.post('http://0.0.0.0:2000/address', { address: 'moja.super-remit' })

    assert.equal(response.status, 202)
    assert.equal(app.getOwnAddress(), 'moja.super-remit')
  })

  it('can get a key-value mapping of participant ids and participant infos', async function () {
    const participantInfo = {
      id: 'alice',
      assetCode: 'USD',
      assetScale: '2',
      relation: 'peer',
      mojaAddress: 'moja.alice',
      url: 'http://localhost:7780',
      rules: []
    }
    await addParticipant(participantInfo)

    const response = await axios.get('http://0.0.0.0:2000/participants')

    assert.deepEqual(response.data, {'alice': {
      id: 'alice',
      assetCode: 'USD',
      assetScale: 2, // will return a peerInfo object which has assetScale as a number
      relation: 'peer',
      mojaAddress: 'moja.alice',
      url: 'http://localhost:7780',
      rules: []
    }})
  })

  it('can return a summary of the routing table as a JSON object', async function () {
    const participantInfo = {
      id: 'alice',
      assetCode: 'USD',
      assetScale: '2',
      relation: 'peer',
      mojaAddress: 'moja.alice',
      url: 'http://localhost:7780',
      rules: []
    }
    await addParticipant(participantInfo)

    const response = await axios.get('http://0.0.0.0:2000/routes')

    assert.deepEqual(response.data, { 
      "moja.alice": {
        "nextHop": "alice",
        "path": []
      }
    })
  })
})


async function addParticipant(participantInfo: { [key: string]: any }) {
  return axios.post('http://0.0.0.0:2000/participants', {...participantInfo})
}
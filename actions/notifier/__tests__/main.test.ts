import nock from 'nock'
import path from 'path'

const fixtures = path.join(__dirname, 'fixtures')

beforeAll(() => {
    nock.disableNetConnect()
})

afterAll(() => {
    nock.cleanAll()
    nock.enableNetConnect()
})

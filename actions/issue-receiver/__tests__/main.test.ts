import nock from 'nock'

beforeAll(() => {
    nock.disableNetConnect()
})

describe('implement at least one test', () => {
    test.skip('skipping this', () => {
        //
    })
})

afterAll(() => {
    nock.cleanAll()
    nock.enableNetConnect()
})

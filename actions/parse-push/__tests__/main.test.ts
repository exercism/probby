// This file is derived from the setup-go action's test suite, released under the MIT license attached below.
// https://github.com/actions/setup-go/tree/3b4dc6cbed1779f759b9c638cb83696acea809d1)
//
// The MIT License (MIT)
//
// Copyright (c) 2018 GitHub, Inc. and contributors
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.

import nock from 'nock'
import path from 'path'

import { getPullRequestHtmlUrl } from '../src/run'

const fixtures = path.join(__dirname, 'fixtures')

beforeAll(() => {
    nock.disableNetConnect()
})

afterAll(() => {
    nock.cleanAll()
    nock.enableNetConnect()
})

describe('commit construction functions', () => {
    describe('pull_request_html_url', () => {
        it('correctly extracts the HTML URL from a commit with a single associated PR', async () => {
            const commit = '1ec45d4ca4ccae5c3a68c2cf319d29c8ab4028e2'

            nock('https://api.github.com')
                .persist()
                .get(`/repos/exercism/problem-specifications/commits/${commit}/pulls`)
                .replyWithFile(200, path.join(fixtures, 'associated-pulls-merged.json'), {
                    'Content-Type': 'application/json',
                })

            // This is the same as:
            //
            // process.env['GITHUB_REPOSITORY'] = 'exercism/problem-specifications'
            // const response = await getPullRequestHtmlUrl(commit, '__fake')
            //
            // But doesn't rely on the Environment to be correctly interpreted
            //
            const response = await getPullRequestHtmlUrl(commit, '__fake', {
                owner: 'exercism',
                repo: 'problem-specifications',
            })

            expect(response).toEqual('https://github.com/exercism/problem-specifications/pull/1746')
        })
    })
})

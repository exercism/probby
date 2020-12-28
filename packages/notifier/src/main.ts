import * as core from '@actions/core'

async function run(): Promise<void> {
    try {
        core.debug('Hello, World!')
    } catch (err) {
        core.setFailed(err.message)
    }
}

run()

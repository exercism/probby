import * as core from '@actions/core'
import * as gh from '@actions/github'
import * as fs from 'fs'

async function run(): Promise<void> {
    try {
        // Init octokit client
        const octokit = gh.getOctokit(core.getInput('token'))

        // Load dispatch payload
        const payloadFile = core.getInput('payload-file')
        const payload = JSON.parse(fs.readFileSync(payloadFile).toString())

        const repos = core.getInput('track-repos').split(',')

        // Send dispatch event to repos
        for (const repo of repos) {
            core.debug(`Sending dispatch event to ${repo}...`)
            octokit.repos.createDispatchEvent({
                owner: gh.context.repo.owner,
                repo: repo,
                event_type: 'probby-notification',
                client_payload: payload,
            })
        }
    } catch (err) {
        core.setFailed(err.message)
    }
}

run()

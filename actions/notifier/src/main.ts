import core from '@actions/core'
import { context, getOctokit } from '@actions/github'
import { readFileSync } from 'fs'

async function run(): Promise<void> {
    try {
        // Init octokit client
        const octokit = getOctokit(core.getInput('token'))

        // Load dispatch payload
        const payloadFile = core.getInput('payload-file')
        const payload = JSON.parse(readFileSync(payloadFile).toString())

        const repos = core.getInput('track-repos').split(',')

        const events: Promise<unknown>[] = []

        // Send dispatch event to repos
        for (const repo of repos) {
            core.debug(`Sending dispatch event to ${repo}...`)

            events.push(
                octokit.repos.createDispatchEvent({
                    owner: context.repo.owner,
                    repo: repo,
                    event_type: 'probby-notification',
                    client_payload: payload,
                })
            )
        }

        await Promise.all(events)
    } catch (err) {
        core.setFailed(err.message)
    }
}

run()

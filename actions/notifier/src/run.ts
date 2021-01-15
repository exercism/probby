import { debug, getInput, setFailed } from '@actions/core'
import { context, getOctokit } from '@actions/github'
import { readFileSync } from 'fs'

export async function run(): Promise<void> {
    try {
        // Init octokit client
        const octokit = getOctokit(getInput('token'))

        // Load dispatch payload
        const payloadFile = getInput('payload-file')
        const payload = JSON.parse(readFileSync(payloadFile).toString())

        const repos = getInput('track-repos').split(',')

        const events: Promise<unknown>[] = []

        // Send dispatch event to repos
        for (const repo of repos) {
            debug(`Sending dispatch event to ${repo}...`)

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
        setFailed(err.message)
    }
}

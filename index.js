const createScheduler = require('probot-scheduler')
const db = {}

const getLastCommitTime = async (ctx, repoWithRef) => {
  const commits = await ctx.github.repos.getCommit(repoWithRef)
  const lastCommit = commits.data.commit
  if (!lastCommit) return
  const lastCommitedAt = new Date(lastCommit.author.date)
  return lastCommitedAt
}

/**
 * @param {import('probot').Application} app
 */
module.exports = app => {
  createScheduler(app)
  /**
   * @param {import('probot').Context} ctx
   */
  const checkStatusAndCreatePR = async ctx => {
    const repo = ctx.repo()
    const nameWithOwner = repo.owner + '/' + repo.repo
    if (nameWithOwner in db) {
      // const lastCheckAt = db[nameWithOwner]
      // if (Date.now() - lastCheckAt < 3600 * 1000) return
    }
    db[nameWithOwner] = Date.now()
    const repoWithRef = Object.assign({sha: 'master'}, repo)
    const forkLastCommitedAt = await getLastCommitTime(ctx, repoWithRef)
    const repoDetail = await ctx.github.repos.get(repo)
    const parentRepoDetail = repoDetail.data.parent
    if (!parentRepoDetail) return
    const parentRepoWithRef = {
      owner: parentRepoDetail.owner.login,
      repo: parentRepoDetail.name,
      sha: 'master'
    }
    const parentLastCommitedAt = await getLastCommitTime(ctx, parentRepoWithRef)
    if (parentLastCommitedAt > forkLastCommitedAt) {
      const prParams = Object.assign({
        title: 'Following the upstream',
        body: '',
        base: 'master',
        head: parentRepoWithRef.owner + ':master',
        maintainer_can_modify: false // must be false
      }, repo)
      await ctx.github.pullRequests.create(prParams)
    }
  }
  app.on('installation_repositories.added', checkStatusAndCreatePR)
  app.on('installation.added', checkStatusAndCreatePR)
  app.on('schedule.repository', checkStatusAndCreatePR)
  app.on('*', checkStatusAndCreatePR)
}

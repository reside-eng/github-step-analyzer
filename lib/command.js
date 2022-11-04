import chalk from "chalk";
import Table from "cli-table3";
import { differenceInSeconds, formatISO, sub } from "date-fns";
import { oraPromise } from "ora";

/**
 * 1. For all given repos
 *    a.  Find the workflow with $WORKFLOW_NAME
 *    b.  Get all runs with status=successful in the last 10 days
 *    c.  For each run
 *        i.  Get all jobs
 *       ii.  Find the job with the $JOB_NAME
 *            1.  Get the step with the $STEP_NAME and status=completed
 *            2.  Calculate the duration of the step
 *
 * 2. Print the results
 *    a.  Print a summary table/box with
 *        i.    Average duration
 *        ii.   Median duration
 *        iii.  Min duration
 *        iv.   Max duration
 *        v.    95th percentile duration
 *    b.  Print a table with the following columns
 *        i.  Job ID (link to job)
 *       ii.  Step start timestamp
 *       ii.  Step duration
 *      iii.  Offset from average duration
 *
 */

/**
 * @typedef {Object} options
 * @property {import("octokit").Octokit} options.octokit
 * @property {string[]} options.repos
 * @property {string} options.workflow
 * @property {string} options.job
 * @property {string} options.step
 * @property {number} [options.daysToAnalyze]
 *
 * @param {options} options
 */
export async function run({
  octokit,
  repos: repoNames,
  workflow: workflowName,
  job: jobName,
  step: stepName,
  daysToAnalyze = 2,
}) {
  const results = await oraPromise(
    Promise.all(
      repoNames.map(async (repoName) => {
        const [owner, repo] = repoName.split("/");

        const [workflow] = await octokit.paginate(
          octokit.rest.actions.listRepoWorkflows,
          {
            owner,
            repo: repo,
            per_page: 100,
          },
          ({ data }, done) => {
            const workflow = data.find(
              (workflow) => workflow.name === workflowName
            );

            if (workflow) {
              done();
              return [workflow];
            }

            return [];
          }
        );

        if (!workflow) {
          return null;
        }

        // Get successful runs in the last N days
        const runs = await octokit.paginate(
          octokit.rest.actions.listWorkflowRuns,
          {
            owner,
            repo,
            workflow_id: workflow.id,
            status: "success",
            per_page: 100,
            created: `>${formatISO(sub(new Date(), { days: daysToAnalyze }), {
              representation: "date",
            })}`,
          }
        );

        // Get matching job for each run
        return Promise.all(
          runs.map(async (run) => {
            const [job] = await octokit.paginate(
              octokit.rest.actions.listJobsForWorkflowRun,
              {
                owner,
                repo,
                run_id: run.id,
              },
              ({ data }, done) => {
                const job = data.find((job) => job.name === jobName);

                if (job) {
                  done();
                  return [job];
                }

                return [];
              }
            );

            if (!job) {
              return null;
            }

            // Get step
            const step = job.steps?.find(
              (step) => step.name === stepName && step.status === "completed"
            );

            if (!step || !step.completed_at || !step.started_at) {
              return null;
            }

            const durationInSeconds = differenceInSeconds(
              new Date(step.completed_at),
              new Date(step.started_at)
            );

            return {
              step,
              durationInSeconds,
              job,
              run,
              workflow,
              owner,
              repo,
            };
          })
        );
      })
    ),
    {
      text: `Downloading and analyzing ${chalk.yellow(
        `${daysToAnalyze} days`
      )} of job runs...`,
    }
  );

  const normalizedResults = results.flat(2).filter(
    /**
     * @template T
     * @param {T} result
     * @returns {result is Exclude<T, null>}
     */
    (result) => result !== null
  );

  // Print results
  const table = new Table({
    head: ["Repo", "# of Runs", "Avg.", "Min.", "Max."],
  });

  /** @type {Array<Record<string, string|number>>} */
  const initial = [];

  const rows = repoNames.reduce((acc, repoName, currentIndex) => {
    const [owner, repo] = repoName.split("/");

    // Get results for this repo
    const results = normalizedResults.filter(
      (result) => result.repo === repo && result.owner === owner
    );

    // Calculate summary for each repo
    const qty = results.length,
      avgDuration = Math.round(
        results.reduce((sum, r) => sum + r.durationInSeconds, 0) /
          results.length
      ),
      minDuration = Math.min(...results.map((r) => r.durationInSeconds)),
      maxDuration = Math.max(...results.map((r) => r.durationInSeconds));

    /** @type {(seconds: number) => string} */
    const secondsToHuman = (seconds) =>
      `${Math.floor(seconds / 60)}m ${seconds % 60}s`;

    const summary = {
      repoName,
      qty,
      avg: secondsToHuman(avgDuration),
      min: secondsToHuman(minDuration),
      max: secondsToHuman(maxDuration),
    };

    acc.push(summary);

    return acc;
  }, initial);

  table.push(...rows.map((row) => Object.values(row)));

  console.log(`${table}`);
}

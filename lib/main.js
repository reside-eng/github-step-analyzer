#!/usr/bin/env node
import meow from "meow";
import prompts from "prompts";
import { Octokit } from "octokit";
import { run } from "./command.js";
import chalk from "chalk";

// @ts-ignore
delete globalThis.fetch;

const promptConfig = {
  onCancel: () => process.exit(0),
};
const cli = meow(
  `
${chalk.bold("USAGE")}
  gh-step-analyze
    --token <token>
    --repo <repo> [--repo <repo>, ...[--repo <n>]]
    --workflow <workflow>
    --job <job>
    --step <step>
    --days [days]

${chalk.bold("OPTIONS")}
  --token       GitHub auth token
  --repo        Repos to analyze (e.g. --repo foo/bar --repo foo/baz --repo fizz/buzz)
  --workflow    Workflow name
  --job         Job name
  --step        Step name
  --days        Number of days to analyze (default: 2)

${chalk.bold("EXAMPLES")}
  gh-step-analyze
    --token gh_1232
    --repo foo/bar --repo foo/bar-improved
    --workflow "Build and Test"
    --job build
    --step "Install dependencies"
    --days 5
`,
  {
    importMeta: import.meta,
    flags: {
      token: {
        type: "string",
        default: process.env.ANALYZER_AUTH_TOKEN ?? "",
      },
      repo: {
        type: "string",
        isMultiple: true,
      },
      workflow: {
        type: "string",
        default: process.env.ANALYZER_WORKFLOW_NAME ?? "",
      },
      job: {
        type: "string",
        default: process.env.ANALYZER_JOB_NAME ?? "",
      },
      step: {
        type: "string",
        default: process.env.ANALYZER_STEP_NAME ?? "",
      },
      days: {
        type: "number",
        default: 2,
      },
    },
  }
);

let { token, repo: repos = [], workflow, job, step, days } = cli.flags;

if (!token) {
  token = await prompts(
    {
      name: "token",
      type: "password",
      message: "Enter your GitHub token",
    },
    promptConfig
  ).then((answers) => answers.token);
}

if (!repos || repos.length === 0) {
  repos = await prompts(
    {
      name: "repos",
      type: "list",
      message: "Repos:",
    },
    promptConfig
  ).then((answers) => answers.repos);
}

if (!workflow) {
  workflow = await prompts(
    {
      name: "workflow",
      type: "text",
      message: "Workflow name:",
    },
    promptConfig
  ).then((answers) => answers.workflow);
}

if (!job) {
  job = await prompts(
    {
      name: "job",
      type: "text",
      message: "Job name:",
    },
    promptConfig
  ).then((answers) => answers.job);
}

if (!step) {
  step = await prompts(
    {
      name: "step",
      type: "text",
      message: "Step name:",
    },
    promptConfig
  ).then((answers) => answers.step);
}

try {
  // Configure Octokit
  const octokit = new Octokit({
    auth: token,
  });

  await run({
    octokit,
    repos,
    workflow,
    job,
    step,
    daysToAnalyze: days,
  });
} catch (err) {
  console.error(err);
  process.exit(1);
}

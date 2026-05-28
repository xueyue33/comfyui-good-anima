const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const workspace = __dirname;
const runtimeRoot = resolveRuntimeRoot();
const defaultWorkflowId = 'local/anima-txt2img-aesthetic-lora';
const workflowId = argValue('--workflow-id', defaultWorkflowId);
const workflowName = workflowNameFromId(workflowId);
const historyDir = path.join(runtimeRoot, 'history', workflowName);

function resolveRuntimeRoot() {
  if (process.env.COMFYUI_MANAGER_RUNTIME_DIR) {
    return path.resolve(process.env.COMFYUI_MANAGER_RUNTIME_DIR);
  }
  const runtimeRoot = process.env.SKILL_RUNTIME_ROOT;
  if (runtimeRoot) {
    return path.resolve(runtimeRoot, 'comfyui-manager');
  }
  const configRuntime = resolveRuntimeFromConfig();
  if (configRuntime) {
    return configRuntime;
  }
  const existingRuntime = findExistingRuntimeRoot(workspace, 'comfyui-manager');
  if (existingRuntime) {
    return existingRuntime;
  }
  return path.resolve(workspace, '..', '..', 'runtime', 'comfyui-manager');
}

function resolveRuntimeFromConfig() {
  const config = readJson(path.join(workspace, 'config.json'));
  const server = Array.isArray(config && config.servers) ? config.servers.find((item) => item && item.output_dir) : null;
  if (!server) return '';
  const outputDir = path.resolve(workspace, server.output_dir);
  return path.basename(outputDir).toLowerCase() === 'outputs' ? path.dirname(outputDir) : '';
}

function findExistingRuntimeRoot(start, runtimeName) {
  let cursor = path.resolve(start);
  while (cursor) {
    const root = path.join(cursor, 'runtime');
    if (fs.existsSync(root)) return path.join(root, runtimeName);
    const parent = path.dirname(cursor);
    if (parent === cursor) break;
    cursor = parent;
  }
  return '';
}

function argValue(name, fallback = '') {
  const index = process.argv.indexOf(name);
  if (index >= 0 && process.argv[index + 1]) return process.argv[index + 1];
  return fallback;
}

function workflowNameFromId(value) {
  const parts = String(value || '').split(/[\\/]/).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : defaultWorkflowId.split('/').pop();
}

function normalizeDate(value) {
  return String(value || '').replace(/[^\d-]/g, '').slice(0, 10);
}

function localDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function dateFromAnimaPath(value) {
  const match = /(?:^|[\\/])anima[\\/](\d{4}-\d{2}-\d{2})(?:[\\/]|$)/i.exec(String(value || ''));
  return match ? match[1] : '';
}

function mkdirp(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function writeJson(file, value) {
  fs.writeFileSync(file, JSON.stringify(value, null, 2), 'utf8');
}

function cacheImage(source, imageCachePath) {
  if (path.resolve(source).toLowerCase() === path.resolve(imageCachePath).toLowerCase()) {
    return 'same-path';
  }
  if (fs.existsSync(imageCachePath)) {
    return 'exists';
  }
  try {
    fs.linkSync(source, imageCachePath);
    return 'hardlink';
  } catch {
    fs.copyFileSync(source, imageCachePath);
    return 'copy';
  }
}

function findOutputRoot() {
  const fromArg = argValue('--output-root');
  if (fromArg) return path.resolve(fromArg);
  if (process.env.COMFYUI_OUTPUT_DIR) return path.resolve(process.env.COMFYUI_OUTPUT_DIR);

  const config = readJson(path.join(workspace, 'config.json'));
  const configuredOutputs = Array.isArray(config && config.servers)
    ? config.servers.map((server) => server && server.output_dir).filter(Boolean)
    : [];
  const candidates = [
    ...configuredOutputs.map((outputDir) => path.resolve(workspace, outputDir)),
    path.join(runtimeRoot, 'outputs'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error('Cannot find ComfyUI output dir. Pass --output-root or set COMFYUI_OUTPUT_DIR.');
}

function outputPath(outputRoot, preview) {
  const subfolder = preview.subfolder ? String(preview.subfolder) : '';
  return path.join(outputRoot, subfolder, preview.filename);
}

function normalizeStatus(status) {
  return ['success', 'completed'].includes(String(status || '').toLowerCase()) ? 'completed' : String(status || '');
}

function previewFromLocalOutput(output) {
  if (!output || !output.filename) return null;
  return {
    filename: output.filename,
    subfolder: output.subfolder || '',
    type: output.type || 'output',
    media_type: output.media_type || 'image',
    local_path: output.local_path || '',
  };
}

function jobsFromLocalHistory() {
  if (!fs.existsSync(historyDir)) return [];
  return fs.readdirSync(historyDir)
    .filter((name) => name.endsWith('.json'))
    .map((name) => {
      const localHistoryPath = path.join(historyDir, name);
      const localHistory = readJson(localHistoryPath);
      const output = localHistory && Array.isArray(localHistory.outputs)
        ? localHistory.outputs.find((item) => item && item.media_type === 'image' && item.filename)
        : null;
      return {
        id: (localHistory && (localHistory.prompt_id || localHistory.run_id)) || path.basename(name, '.json'),
        status: normalizeStatus(localHistory && localHistory.status),
        preview_output: previewFromLocalOutput(output),
        local_history_path: localHistoryPath,
      };
    });
}

function cacheOne(job, outputRoot) {
  const preview = job.preview_output;
  if (!preview || !preview.filename) {
    return { id: job.id, cached: false, reason: 'missing preview_output' };
  }

  const source = preview.local_path && fs.existsSync(preview.local_path)
    ? path.resolve(preview.local_path)
    : outputPath(outputRoot, preview);
  if (!fs.existsSync(source)) {
    return { id: job.id, cached: false, reason: `source not found: ${source}` };
  }

  const dateFromSubfolder = dateFromAnimaPath(preview.subfolder);
  const dateFromSource = dateFromAnimaPath(source);
  const date = normalizeDate(argValue('--date')) || dateFromSubfolder || dateFromSource || localDateString();
  const cacheDir = path.join(runtimeRoot, 'cache', 'anima', date);
  mkdirp(cacheDir);

  const imageCachePath = path.join(cacheDir, preview.filename);
  const cache_mode = cacheImage(source, imageCachePath);

  const localHistoryPath = job.local_history_path || path.join(historyDir, `${job.id}.json`);
  const localHistory = readJson(localHistoryPath);
  const args = localHistory && localHistory.args ? localHistory.args : {};
  const stem = path.basename(preview.filename, path.extname(preview.filename));
  const argsPath = path.join(cacheDir, `${stem}.args.json`);
  const manifestPath = path.join(cacheDir, `${stem}.manifest.json`);

  writeJson(argsPath, args);
  writeJson(manifestPath, {
    workflow_id: workflowId,
    prompt_id: job.id,
    status: job.status,
    source_local_path: source,
    cache_local_path: imageCachePath,
    cache_mode,
    args_path: argsPath,
    filename_prefix: args.filename_prefix || '',
    created_at: new Date().toISOString(),
    preview_output: preview,
    local_history_path: fs.existsSync(localHistoryPath) ? localHistoryPath : '',
  });

  return { id: job.id, cached: true, cache_local_path: imageCachePath, args_path: argsPath, manifest_path: manifestPath };
}

function main() {
  const limit = Number.parseInt(argValue('--limit', '50'), 10) || 50;
  const outputRoot = findOutputRoot();
  let jobs = jobsFromLocalHistory()
    .filter((job) => job.status === 'completed')
    .sort((a, b) => {
      const aTime = fs.statSync(a.local_history_path).mtimeMs;
      const bTime = fs.statSync(b.local_history_path).mtimeMs;
      return bTime - aTime;
    })
    .slice(0, limit);

  if (jobs.length === 0) {
    const raw = execFileSync('comfyui-skill', ['history', 'list', workflowId, '--server', '--limit', String(limit)], {
      cwd: workspace,
      encoding: 'utf8',
      env: process.env,
    });
    const data = JSON.parse(raw);
    jobs = Array.isArray(data.jobs) ? data.jobs.filter((job) => job.status === 'completed') : [];
  }
  const results = jobs.map((job) => cacheOne(job, outputRoot));
  console.log(JSON.stringify({
    workflow_id: workflowId,
    workflow_name: workflowName,
    output_root: outputRoot,
    total_completed_seen: jobs.length,
    cached: results.filter((item) => item.cached).length,
    failed: results.filter((item) => !item.cached).length,
    results,
  }, null, 2));
}

main();

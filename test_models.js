/**
 * AI 模型可用性测试脚本
 *
 * 用法:
 *   node test_models.js --base-url <url> --api-key <key> [选项]
 *
 * 参数:
 *   --base-url  (必填) API 地址，例如 https://api.openai.com
 *   --api-key   (必填) API Key
 *   --delay     每次测试间隔秒数 (默认: 3，建议 5 以上防封号)
 *   --timeout   单次请求超时秒数 (默认: 30)
 *   --filter    只测试模型名包含该关键字的模型 (可选，不填则测试全部)
 *   --output    将结果保存到指定 JSON 文件 (可选)
 *
 * 示例:
 *   # 最简用法
 *   node test_models.js --base-url https://api.openai.com --api-key sk-xxx
 *
 *   # 设置延迟防封号
 *   node test_models.js --base-url https://api.openai.com --api-key sk-xxx --delay 5
 *
 *   # 只测试 deepseek 系列模型
 *   node test_models.js --base-url https://api.openai.com --api-key sk-xxx --delay 5 --filter deepseek
 *
 *   # 完整参数，结果保存到文件
 *   node test_models.js --base-url https://qianfan.baidubce.com --api-key bce-v3/xxx --delay 5 --timeout 60 --filter ernie --output result.json
 */

const https = require("https");
const http = require("http");
const fs = require("fs");
const path = require("path");

// ─── 参数解析 ───

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { delay: 3, timeout: 30, filter: "", output: "" };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg.startsWith("--")) {
      console.error(`未知参数: ${arg}`);
      process.exit(1);
    }
    const key = arg;
    const val = args[i + 1];
    // 如果下一个值缺失或也是 -- 开头，则当前 flag 无值
    if (!val || val.startsWith("--")) {
      if (key === "--filter") { opts.filter = ""; continue; }
      console.error(`${key} 缺少参数值`);
      process.exit(1);
    }
    i++;
    switch (key) {
      case "--base-url": opts.baseUrl = val; break;
      case "--api-key":  opts.apiKey  = val; break;
      case "--delay":    opts.delay   = Number(val); break;
      case "--timeout":  opts.timeout = Number(val); break;
      case "--filter":   opts.filter  = val; break;
      case "--output":   opts.output  = val; break;
      default:
        console.error(`未知参数: ${key}`);
        process.exit(1);
    }
  }
  if (!opts.baseUrl || !opts.apiKey) {
    console.error("必须提供 --base-url 和 --api-key");
    process.exit(1);
  }
  return opts;
}

// ─── HTTP 请求封装 ───

function request(url, options, body) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith("https") ? https : http;
    const req = mod.request(url, options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ statusCode: res.statusCode, body: data });
        } else {
          const err = new Error(`HTTP ${res.statusCode}`);
          err.statusCode = res.statusCode;
          err.body = data;
          reject(err);
        }
      });
    });
    req.on("error", reject);
    req.setTimeout(options.timeout * 1000, () => {
      req.destroy(new Error("请求超时"));
    });
    if (body) req.write(body);
    req.end();
  });
}

// ─── 获取模型列表 ───

async function fetchModels(baseUrl, apiKey, timeout) {
  const url = `${baseUrl.replace(/\/+$/, "")}/v2/models`;
  console.log(`正在获取模型列表: ${url}\n`);

  const res = await request(url, {
    method: "GET",
    timeout,
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  const data = JSON.parse(res.body);
  let models;
  if (typeof data.data === "string") {
    // 逗号分隔的字符串格式
    models = data.data.split(",").map((s) => s.trim()).filter(Boolean).sort();
  } else if (Array.isArray(data.data)) {
    // 标准数组格式，优先取 id 字段，兼容纯字符串元素
    models = data.data.map((m) => (typeof m === "string" ? m : m.id)).filter(Boolean).sort();
  } else {
    models = [];
  }
  console.log(`共获取到 ${models.length} 个模型\n`);
  return models;
}

// ─── 测试单个模型 ───

function classifyError(code) {
  const map = {
    401: "认证失败(401)",
    403: "无权限(403)",
    404: "模型不存在(404)",
    429: "请求过快(429)",
    500: "服务器错误(500)",
    502: "网关错误(502)",
    503: "服务不可用(503)",
  };
  return map[code] || `HTTP ${code}`;
}

async function testModel(baseUrl, apiKey, model, timeout) {
  const url = `${baseUrl.replace(/\/+$/, "")}/v2/chat/completions`;
  const body = JSON.stringify({
    model,
    messages: [{ role: "user", content: "Hi" }],
    max_tokens: 5,
    temperature: 0,
  });

  try {
    await request(url, {
      method: "POST",
      timeout,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    }, body);
    return { model, status: "ok" };
  } catch (e) {
    const code = e.statusCode;
    if (code) {
      return { model, status: "fail", reason: classifyError(code) };
    }
    return { model, status: "fail", reason: e.message.slice(0, 100) };
  }
}

// ─── 延迟 ───

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ─── 主流程 ───

async function main() {
  const opts = parseArgs();

  // 1. 获取模型列表
  let models;
  try {
    models = await fetchModels(opts.baseUrl, opts.apiKey, opts.timeout);
  } catch (e) {
    console.error(`获取模型列表失败: ${e.message}`);
    process.exit(1);
  }

  if (models.length === 0) {
    console.log("没有获取到任何模型");
    process.exit(0);
  }

  // 2. 可选过滤
  if (opts.filter) {
    const kw = opts.filter.toLowerCase();
    models = models.filter((m) => m.toLowerCase().includes(kw));
    console.log(`过滤后剩余 ${models.length} 个模型 (关键字: ${opts.filter})\n`);
  }

  // 3. 逐个测试
  const available = [];
  const unavailable = [];
  const total = models.length;

  console.log(`开始测试 (每次间隔 ${opts.delay}s, 超时 ${opts.timeout}s)`);
  console.log("-".repeat(60));

  for (let i = 0; i < total; i++) {
    const model = models[i];
    process.stdout.write(`[${i + 1}/${total}] 测试: ${model} ... `);
    const result = await testModel(opts.baseUrl, opts.apiKey, model, opts.timeout);

    if (result.status === "ok") {
      available.push(model);
      console.log("可用");
    } else {
      unavailable.push({ model, reason: result.reason });
      console.log(`不可用 (${result.reason})`);
    }

    if (i < total - 1) {
      await sleep(opts.delay * 1000);
    }
  }

  // 4. 输出结果
  console.log("\n" + "=".repeat(60));
  console.log(`测试完成! 可用: ${available.length} / ${total}`);
  console.log("=".repeat(60));

  if (available.length) {
    console.log("\n可用模型:");
    available.forEach((m) => console.log(`  - ${m}`));
  }

  if (unavailable.length) {
    console.log("\n不可用模型:");
    unavailable.forEach((item) => console.log(`  - ${item.model}  (${item.reason})`));
  }

  // 5. 可选保存结果
  if (opts.output) {
    const resultData = {
      base_url: opts.baseUrl,
      available,
      unavailable,
      total,
    };
    fs.writeFileSync(opts.output, JSON.stringify(resultData, null, 2), "utf-8");
    console.log(`\n结果已保存到: ${opts.output}`);
  }

  // 6. 输出可用模型 ID 列表（方便复制）
  if (available.length) {
    console.log("\n可用模型 ID (一行一个, 方便复制):");
    console.log(available.join("\n"));
  }
}

main().catch((e) => {
  console.error(`运行出错: ${e.message}`);
  process.exit(1);
});

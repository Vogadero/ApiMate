import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  HttpRequest,
  HttpResponse,
  HttpMethod,
  RequestBody,
  FormDataField,
  Collection,
  Environment,
  METHOD_RAW_COLORS,
} from '../../types/api';
import { Icon } from '../common/Icon';
import { vscode } from '../../utils/vscode';
import './EditorView.css';

interface EditorViewProps {
  request: HttpRequest;
  response: HttpResponse | null;
  isLoading: boolean;
  error: string | null;
  collections: Collection[];
  environments: Environment[];
  activeEnvironmentId: string | null;
  selectedFile: { index: number; filename: string; path: string } | null;
  onSendRequest: (request: HttpRequest) => void;
  onSaveRequest: (request: HttpRequest, collectionId: string, folderId?: string) => void;
  onRequestChange: (request: HttpRequest | null) => void;
  onClose?: () => void;
  onSwitchEnvironment: (environmentId: string | null) => void;
  onSelectedFileConsumed?: () => void;
}

const METHODS: HttpMethod[] = [
  'GET',
  'POST',
  'PUT',
  'DELETE',
  'PATCH',
  'HEAD',
  'OPTIONS',
  'CONNECT',
  'TRACE',
  'PROPFIND',
  'CUSTOM',
];
const BODY_CATEGORIES = [
  { key: 'none', label: '无', types: [{ key: 'none', label: '无', contentType: '' }] },
  {
    key: 'text',
    label: '文本',
    types: [
      { key: 'json', label: 'JSON', contentType: 'application/json' },
      { key: 'json-ld', label: 'JSON-LD', contentType: 'application/ld+json' },
      { key: 'json-hal', label: 'JSON-HAL', contentType: 'application/hal+json' },
      { key: 'json-api', label: 'JSON:API', contentType: 'application/vnd.api+json' },
      { key: 'xml', label: 'XML', contentType: 'application/xml' },
      { key: 'text-xml', label: 'Text/XML', contentType: 'text/xml' },
    ],
  },
  {
    key: 'structured',
    label: '对象结构',
    types: [
      {
        key: 'x-www-form-urlencoded',
        label: 'x-www-form',
        contentType: 'application/x-www-form-urlencoded',
      },
      { key: 'form-data', label: 'form-data', contentType: 'multipart/form-data' },
    ],
  },
  {
    key: 'binary',
    label: '二进制',
    types: [{ key: 'binary', label: 'Binary', contentType: 'application/octet-stream' }],
  },
  {
    key: 'other',
    label: '其他',
    types: [
      { key: 'html', label: 'HTML', contentType: 'text/html' },
      { key: 'plain', label: 'Plain', contentType: 'text/plain' },
      { key: 'graphql', label: 'GraphQL', contentType: 'application/graphql' },
    ],
  },
] as const;

const BODY_TYPE_MAP: Record<string, { label: string; contentType: string; category: string }> = {};
BODY_CATEGORIES.forEach((cat) => {
  cat.types.forEach((t) => {
    BODY_TYPE_MAP[t.key] = { label: t.label, contentType: t.contentType, category: cat.key };
  });
});
const AUTH_TYPES = ['none', 'basic', 'bearer', 'oauth2', 'ntlm', 'aws'] as const;
const AUTH_LABELS: Record<string, string> = {
  none: 'None',
  basic: 'Basic',
  bearer: 'Bearer',
  oauth2: 'OAuth 2',
  ntlm: 'NTLM',
  aws: 'AWS',
};
const AUTH_ICONS: Record<string, string> = {
  none: 'lock',
  basic: 'user',
  bearer: 'key',
  oauth2: 'shield',
  ntlm: 'server',
  aws: 'cloud',
};
type ReqTab = 'query' | 'headers' | 'auth' | 'body' | 'tests' | 'pre-run';
type ResTab = 'response' | 'headers' | 'cookies' | 'results' | 'docs';
type Layout = 'horizontal' | 'vertical';

const REQ_TAB_TITLES: Record<ReqTab, { cn: string; en: string }> = {
  query: { cn: '参数', en: 'Params' },
  headers: { cn: '请求头', en: 'Headers' },
  auth: { cn: '认证', en: 'Auth' },
  body: { cn: '请求体', en: 'Body' },
  tests: { cn: '测试', en: 'Tests' },
  'pre-run': { cn: '前置脚本', en: 'Pre-run' },
};

const RES_TAB_TITLES: Record<ResTab, { cn: string; en: string }> = {
  response: { cn: '响应体', en: 'Response' },
  headers: { cn: '响应头', en: 'Headers' },
  cookies: { cn: 'Cookie', en: 'Cookies' },
  results: { cn: '结果', en: 'Results' },
  docs: { cn: '文档', en: 'Docs' },
};

const LANG_COLORS: Record<string, string> = {
  http: '#89e051',
  bash: '#89e051',
  powershell: '#012456',
  javascript: '#f7df1e',
  typescript: '#3178c6',
  python: '#3776ab',
  java: '#b07219',
  go: '#00add8',
  rust: '#dea584',
  csharp: '#68217a',
  ruby: '#cc342d',
  php: '#777bb4',
  swift: '#fa7343',
  dart: '#00b4ab',
  kotlin: '#a97bff',
  scala: '#dc322f',
  elixir: '#6e4a7e',
  clojure: '#db5855',
  lua: '#000080',
  r: '#198ce7',
  c: '#555555',
};

const LANG_ICONS: Record<string, string> = {
  http: '📡',
  bash: '🖥️',
  powershell: '💻',
  javascript: 'JS',
  typescript: 'TS',
  python: '🐍',
  java: '☕',
  go: '🔵',
  rust: '🦀',
  csharp: '💜',
  ruby: '💎',
  php: '🐘',
  swift: '🐦',
  dart: '🎯',
  kotlin: '🟣',
  scala: '🔴',
  elixir: '🧪',
  clojure: '🔮',
  lua: '🌙',
  r: '📊',
  c: '⚙️',
};

const CODE_SNIPPETS: { label: string; lang: string; category: string }[] = [
  { label: 'HTTP', lang: 'http', category: '协议' },
  { label: 'cURL', lang: 'bash', category: 'CLI' },
  { label: 'Wget', lang: 'bash', category: 'CLI' },
  { label: 'PowerShell', lang: 'powershell', category: 'CLI' },
  { label: 'Fetch', lang: 'javascript', category: 'JS/TS' },
  { label: 'Axios', lang: 'javascript', category: 'JS/TS' },
  { label: 'jQuery', lang: 'javascript', category: 'JS/TS' },
  { label: 'XHR', lang: 'javascript', category: 'JS/TS' },
  { label: 'Node HTTP', lang: 'javascript', category: 'JS/TS' },
  { label: 'Got', lang: 'javascript', category: 'JS/TS' },
  { label: 'SuperAgent', lang: 'javascript', category: 'JS/TS' },
  { label: 'Undici', lang: 'javascript', category: 'JS/TS' },
  { label: 'Python Requests', lang: 'python', category: 'Python' },
  { label: 'Python http.client', lang: 'python', category: 'Python' },
  { label: 'Python aiohttp', lang: 'python', category: 'Python' },
  { label: 'Java OkHttp', lang: 'java', category: 'Java' },
  { label: 'Java HttpClient', lang: 'java', category: 'Java' },
  { label: 'Java Unirest', lang: 'java', category: 'Java' },
  { label: 'Go net/http', lang: 'go', category: 'Go' },
  { label: 'Rust reqwest', lang: 'rust', category: 'Rust' },
  { label: 'C# HttpClient', lang: 'csharp', category: 'C#' },
  { label: 'C# RestSharp', lang: 'csharp', category: 'C#' },
  { label: 'Ruby Net::HTTP', lang: 'ruby', category: 'Ruby' },
  { label: 'PHP cURL', lang: 'php', category: 'PHP' },
  { label: 'PHP Guzzle', lang: 'php', category: 'PHP' },
  { label: 'Swift URLSession', lang: 'swift', category: 'Swift' },
  { label: 'Swift Alamofire', lang: 'swift', category: 'Swift' },
  { label: 'Dart http', lang: 'dart', category: 'Dart' },
  { label: 'Kotlin ktor', lang: 'kotlin', category: 'Kotlin' },
  { label: 'Scala sttp', lang: 'scala', category: 'Scala' },
  { label: 'Elixir HTTPoison', lang: 'elixir', category: 'Elixir' },
  { label: 'Clojure clj-http', lang: 'clojure', category: 'Clojure' },
  { label: 'Lua http', lang: 'lua', category: 'Lua' },
  { label: 'R httr', lang: 'r', category: 'R' },
  { label: 'C libcurl', lang: 'c', category: 'C' },
  { label: 'Shell cURL', lang: 'bash', category: 'Shell' },
];

const TYPE_GENERATORS = [
  { label: 'TypeScript', key: 'typescript', lang: 'typescript' },
  { label: 'Flow', key: 'flow', lang: 'javascript' },
  { label: 'JSON Schema', key: 'json-schema', lang: 'javascript' },
  { label: 'Go Struct', key: 'go', lang: 'go' },
  { label: 'Java Class', key: 'java', lang: 'java' },
  { label: 'C# Class', key: 'csharp', lang: 'csharp' },
  { label: 'Python DataClass', key: 'python', lang: 'python' },
  { label: 'Rust Struct', key: 'rust', lang: 'rust' },
  { label: 'Kotlin DataClass', key: 'kotlin', lang: 'kotlin' },
  { label: 'Swift Codable', key: 'swift', lang: 'swift' },
  { label: 'Dart Class', key: 'dart', lang: 'dart' },
  { label: 'Scala Case Class', key: 'scala', lang: 'scala' },
  { label: 'PHP Class', key: 'php', lang: 'php' },
  { label: 'Ruby Struct', key: 'ruby', lang: 'ruby' },
  { label: 'C++ Struct', key: 'cpp', lang: 'c' },
];

const TEST_SNIPPETS = [
  {
    label: '状态码断言',
    code: 'pm.test("Status code is 200", () => {\n  pm.expect(pm.response.status).to.equal(200);\n});',
    lang: 'javascript',
  },
  {
    label: '状态码范围断言',
    code: 'pm.test("Status code is 2xx", () => {\n  pm.expect(pm.response.status).to.be.within(200, 299);\n});',
    lang: 'javascript',
  },
  {
    label: 'JSON 属性断言',
    code: 'pm.test("JSON value check", () => {\n  const json = pm.response.json();\n  pm.expect(json.key).to.eql("value");\n});',
    lang: 'javascript',
  },
  {
    label: 'JSON 深层属性断言',
    code: 'pm.test("Deep nested value", () => {\n  const json = pm.response.json();\n  pm.expect(json.data.user.name).to.eql("expected");\n});',
    lang: 'javascript',
  },
  {
    label: '响应时间断言',
    code: 'pm.test("Response time < 200ms", () => {\n  pm.expect(pm.response.time).to.be.below(200);\n});',
    lang: 'javascript',
  },
  {
    label: '响应头断言',
    code: 'pm.test("Content-Type header", () => {\n  pm.expect(pm.response.headers["content-type"]).to.include("application/json");\n});',
    lang: 'javascript',
  },
  {
    label: '包含字符串',
    code: 'pm.test("Body contains string", () => {\n  pm.expect(pm.response.body).to.include("expected");\n});',
    lang: 'javascript',
  },
  {
    label: '设置环境变量',
    code: 'pm.environment.set("variable_key", "variable_value");',
    lang: 'javascript',
  },
  {
    label: '获取环境变量',
    code: 'const value = pm.environment.get("variable_key");',
    lang: 'javascript',
  },
  {
    label: 'JSON 数组长度',
    code: 'pm.test("Array length check", () => {\n  const json = pm.response.json();\n  pm.expect(json).to.be.an("array").with.lengthOf(10);\n});',
    lang: 'javascript',
  },
  {
    label: '响应体非空',
    code: 'pm.test("Response body is not empty", () => {\n  pm.expect(pm.response.body).to.have.length.above(0);\n});',
    lang: 'javascript',
  },
  {
    label: 'JSON 类型检查',
    code: 'pm.test("Response is object", () => {\n  const json = pm.response.json();\n  pm.expect(json).to.be.an("object");\n});',
    lang: 'javascript',
  },
  {
    label: '正则匹配',
    code: 'pm.test("Body matches pattern", () => {\n  pm.expect(pm.response.body).to.match(/pattern/);\n});',
    lang: 'javascript',
  },
  {
    label: 'Cookie 检查',
    code: 'pm.test("Cookie exists", () => {\n  pm.expect(pm.cookies.has("session_id")).to.be.true;\n});',
    lang: 'javascript',
  },
  {
    label: '异步等待测试',
    code: 'pm.test("Async test", async () => {\n  const res = await fetch("https://api.example.com/check");\n  pm.expect(res.ok).to.be.true;\n});',
    lang: 'javascript',
  },
  {
    label: '多次断言组合',
    code: 'pm.test("Multiple assertions", () => {\n  const json = pm.response.json();\n  pm.expect(pm.response.status).to.equal(200);\n  pm.expect(json).to.have.property("id");\n  pm.expect(json.name).to.be.a("string");\n});',
    lang: 'javascript',
  },
];

const PREREQUEST_SNIPPETS = [
  {
    label: '设置环境变量',
    code: 'pm.environment.set("variable_key", "variable_value");',
    lang: 'javascript',
  },
  {
    label: '获取环境变量',
    code: 'const value = pm.environment.get("variable_key");',
    lang: 'javascript',
  },
  { label: '清除环境变量', code: 'pm.environment.unset("variable_key");', lang: 'javascript' },
  {
    label: '设置全局变量',
    code: 'pm.globals.set("variable_key", "variable_value");',
    lang: 'javascript',
  },
  {
    label: '获取全局变量',
    code: 'const value = pm.globals.get("variable_key");',
    lang: 'javascript',
  },
  {
    label: '添加请求头',
    code: 'pm.request.headers.add({ key: "X-Custom-Header", value: "value" });',
    lang: 'javascript',
  },
  {
    label: '添加查询参数',
    code: 'pm.request.queryParams.add({ key: "param", value: "value" });',
    lang: 'javascript',
  },
  {
    label: '生成随机数',
    code: 'const rand = Math.floor(Math.random() * 10000);\npm.environment.set("random_id", rand);',
    lang: 'javascript',
  },
  {
    label: '时间戳',
    code: 'pm.environment.set("timestamp", new Date().toISOString());',
    lang: 'javascript',
  },
  {
    label: 'Base64 编码',
    code: 'const encoded = btoa("username:password");\npm.request.headers.add({ key: "Authorization", value: "Basic " + encoded });',
    lang: 'javascript',
  },
  {
    label: 'UUID 生成',
    code: 'const uuid = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {\n  const r = Math.random() * 16 | 0;\n  return (c === "x" ? r : (r & 0x3 | 0x8)).toString(16);\n});\npm.environment.set("uuid", uuid);',
    lang: 'javascript',
  },
  {
    label: '延迟执行',
    code: 'setTimeout(() => {\n  console.log("Delayed action");\n}, 1000);',
    lang: 'javascript',
  },
  {
    label: '条件判断',
    code: 'if (pm.environment.get("env") === "production") {\n  pm.request.url = pm.request.url.replace("staging", "prod");\n}',
    lang: 'javascript',
  },
  {
    label: '请求体修改',
    code: 'const body = JSON.parse(pm.request.body);\nbody.timestamp = Date.now();\npm.request.body = JSON.stringify(body);',
    lang: 'javascript',
  },
  {
    label: 'HMAC 签名',
    code: 'const crypto = require("crypto");\nconst signature = crypto.createHmac("sha256", "secret")\n  .update(pm.request.body).digest("hex");\npm.request.headers.add({ key: "X-Signature", value: signature });',
    lang: 'javascript',
  },
  {
    label: '日期格式化',
    code: 'const now = new Date();\nconst dateStr = now.toISOString().split("T")[0];\npm.environment.set("today", dateStr);',
    lang: 'javascript',
  },
];

function showToast(msg: string) {
  const existing = document.getElementById('apimate-toast');
  if (existing) existing.remove();
  const el = document.createElement('div');
  el.id = 'apimate-toast';
  el.className = 'toast-msg';
  el.innerHTML = `<span class="toast-icon">✓</span><span class="toast-text">${msg}</span>`;
  document.body.appendChild(el);
  requestAnimationFrame(() => {
    el.classList.add('toast-show');
  });
  setTimeout(() => {
    el.classList.remove('toast-show');
    el.classList.add('toast-hide');
    setTimeout(() => el.remove(), 300);
  }, 1500);
}

const BRACKET_COLORS = [
  'bracket-d0',
  'bracket-d1',
  'bracket-d2',
  'bracket-d3',
  'bracket-d4',
  'bracket-d5',
];

function bracketClass(depth: number) {
  return BRACKET_COLORS[depth % BRACKET_COLORS.length]!;
}

function renderJsonLines(obj: any, depth: number, path: string, lineNumRef: React.MutableRefObject<number>, linesRef: React.MutableRefObject<any[]>): React.ReactNode {
  if (obj === null || obj === undefined)
    return (
      <span className="json-null" data-vpath={path}>
        null
      </span>
    );
  if (typeof obj === 'string')
    return (
      <span className="json-string" data-vpath={path}>
        "{obj}"
      </span>
    );
  if (typeof obj === 'number')
    return (
      <span className="json-number" data-vpath={path}>
        {obj}
      </span>
    );
  if (typeof obj === 'boolean')
    return (
      <span className="json-boolean" data-vpath={path}>
        {String(obj)}
      </span>
    );
  if (Array.isArray(obj)) {
    if (obj.length === 0) {
      linesRef.current.push({
        num: ++lineNumRef.current,
        indent: depth,
        content: <span className="json-bracket">[]</span>,
      });
      return null;
    }
    const id = `json-${path || 'root'}`;
    const openLine = ++lineNumRef.current;
    const startIdx = linesRef.current.length;
    linesRef.current.push({
      num: openLine,
      indent: depth,
      content: (
        <>
          <span className={`json-bracket ${bracketClass(depth)}`}>[</span>
        </>
      ),
      collapsible: { id, hint: `${obj.length} items`, closeBracket: ']', lineCount: -1, depth },
    });
    obj.forEach((item, i) => {
      const ln = ++lineNumRef.current;
      const val = renderJsonLines(item, depth + 1, `${path}[${i}]`, lineNumRef, linesRef);
      const isPrimitive = item === null || item === undefined || typeof item !== 'object';
      linesRef.current.push({
        num: ln,
        indent: depth + 1,
        content: (
          <>
            {val}
            {i < obj.length - 1 && <span className="json-comma">,</span>}
          </>
        ),
        valuePath: isPrimitive ? `${path}[${i}]` : undefined,
        valueRaw: isPrimitive ? item : undefined,
      });
    });
    const closeLine = ++lineNumRef.current;
    linesRef.current.push({
      num: closeLine,
      indent: depth,
      content: <span className={`json-bracket ${bracketClass(depth)}`}>]</span>,
    });
    linesRef.current[startIdx]!.collapsible!.lineCount = linesRef.current.length - startIdx - 1;
    return null;
  }
  const keys = Object.keys(obj);
  if (keys.length === 0) {
    linesRef.current.push({
      num: ++lineNumRef.current,
      indent: depth,
      content: <span className="json-bracket">{'{}'}</span>,
    });
    return null;
  }
  const id2 = `json-${path || 'root'}`;
  const openLine2 = ++lineNumRef.current;
  const startIdx2 = linesRef.current.length;
  linesRef.current.push({
    num: openLine2,
    indent: depth,
    content: (
      <>
        <span className={`json-bracket ${bracketClass(depth)}`}>{'{'}</span>
      </>
    ),
    collapsible: { id: id2, hint: `${keys.length} keys`, closeBracket: '}', lineCount: -1, depth },
  });
  keys.forEach((key, i) => {
    const ln = ++lineNumRef.current;
    const val = renderJsonLines(obj[key], depth + 1, `${path}.${key}`, lineNumRef, linesRef);
    const isPrimitive = obj[key] === null || obj[key] === undefined || typeof obj[key] !== 'object';
    linesRef.current.push({
      num: ln,
      indent: depth + 1,
      content: (
        <>
          <span className="json-key">"{key}"</span>
          <span className="json-colon">: </span>
          {val}
          {i < keys.length - 1 && <span className="json-comma">,</span>}
        </>
      ),
      valuePath: isPrimitive ? `${path}.${key}` : undefined,
      valueRaw: isPrimitive ? obj[key] : undefined,
      keyPath: `${path}.${key}`,
      keyRaw: key,
    });
  });
  const closeLine2 = ++lineNumRef.current;
  linesRef.current.push({
    num: closeLine2,
    indent: depth,
    content: <span className={`json-bracket ${bracketClass(depth)}`}>{'}'}</span>,
  });
  linesRef.current[startIdx2]!.collapsible!.lineCount = linesRef.current.length - startIdx2 - 1;
  return null;
}

function JsonEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [allCollapsed, setAllCollapsed] = useState(false);
  const [bracketPair, setBracketPair] = useState(true);
  const [editPath, setEditPath] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editKeyPath, setEditKeyPath] = useState<string | null>(null);
  const [editKeyValue, setEditKeyValue] = useState('');
  let parsed: any = null;
  let isValid = false;
  try {
    parsed = JSON.parse(value);
    isValid = true;
  } catch {
    isValid = false;
  }

  if (!isValid || editing) {
    return (
      <div className="json-editor-viewer">
        <div className="json-editor-toolbar">
          <button
            className="toolbar-icon-btn sm"
            onClick={() => {
              navigator.clipboard.writeText(value);
              showToast('已复制');
            }}
            title="复制 / Copy"
          >
            <Icon name="copy" size={12} />
          </button>
          {isValid && (
            <button
              className="toolbar-icon-btn sm"
              onClick={() => {
                setEditing(false);
              }}
              title="视图模式 / View Mode"
            >
              <Icon name="preview" size={12} />
            </button>
          )}
        </div>
        <textarea
          className="code-editor json-source-editor"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="输入 JSON 内容"
          spellCheck={false}
          autoFocus
        />
      </div>
    );
  }

  const handleValueDoubleClick = (path: string, currentVal: any) => {
    setEditPath(path);
    setEditValue(typeof currentVal === 'string' ? currentVal : String(currentVal));
  };

  const handleValueCommit = (path: string) => {
    try {
      const obj = JSON.parse(value);
      const segments: (string | number)[] = [];
      const normalized = path.replace(/^\./, '');
      const regex = /\[(\d+)\]|^([^.[\]]+)|\.([^.[\]]+)/g;
      let match;
      while ((match = regex.exec(normalized)) !== null) {
        if (match[1] !== undefined) {
          segments.push(parseInt(match[1]));
        } else if (match[2] !== undefined) {
          segments.push(match[2]);
        } else if (match[3] !== undefined) {
          segments.push(match[3]);
        }
      }
      if (segments.length === 0) {
        setEditPath(null);
        setEditValue('');
        return;
      }
      let target: any = obj;
      for (let i = 0; i < segments.length - 1; i++) {
        target = target[segments[i]!];
      }
      const lastSeg = segments[segments.length - 1]!;
      try {
        target[lastSeg] = JSON.parse(editValue);
      } catch {
        target[lastSeg] = editValue;
      }
      onChange(JSON.stringify(obj, null, 2));
    } catch {
      /* ignore */
    }
    setEditPath(null);
    setEditValue('');
  };

  const handleKeyCommit = (path: string) => {
    if (!editKeyValue.trim()) {
      setEditKeyPath(null);
      setEditKeyValue('');
      return;
    }
    try {
      const obj = JSON.parse(value);
      const segments: (string | number)[] = [];
      const normalized = path.replace(/^\./, '');
      const regex = /\[(\d+)\]|^([^.[\]]+)|\.([^.[\]]+)/g;
      let match;
      while ((match = regex.exec(normalized)) !== null) {
        if (match[1] !== undefined) segments.push(parseInt(match[1]));
        else if (match[2] !== undefined) segments.push(match[2]);
        else if (match[3] !== undefined) segments.push(match[3]);
      }
      if (segments.length === 0) {
        setEditKeyPath(null);
        setEditKeyValue('');
        return;
      }
      const lastSeg = segments[segments.length - 1]!;
      if (typeof lastSeg !== 'string' || lastSeg === editKeyValue) {
        setEditKeyPath(null);
        setEditKeyValue('');
        return;
      }
      let target: any = obj;
      for (let i = 0; i < segments.length - 1; i++) {
        target = target[segments[i]!];
      }
      if (Array.isArray(target)) {
        setEditKeyPath(null);
        setEditKeyValue('');
        return;
      }
      target[editKeyValue] = target[lastSeg];
      delete target[lastSeg];
      onChange(JSON.stringify(obj, null, 2));
    } catch {
      /* ignore */
    }
    setEditKeyPath(null);
    setEditKeyValue('');
  };

  return (
    <div className="json-editor-viewer">
      <div className="json-editor-toolbar">
        <button
          className="toolbar-icon-btn sm"
          onClick={() => {
            navigator.clipboard.writeText(value);
            showToast('已复制');
          }}
          title="复制 / Copy"
        >
          <Icon name="copy" size={12} />
        </button>
        <button
          className="toolbar-icon-btn sm"
          onClick={() => setEditing(true)}
          title="源码编辑 / Source Edit"
        >
          <Icon name="edit" size={12} />
        </button>
        <button
          className="toolbar-icon-btn sm"
          onClick={() => setAllCollapsed(!allCollapsed)}
          title={allCollapsed ? '展开全部 / Expand All' : '折叠全部 / Collapse All'}
        >
          <Icon name={allCollapsed ? 'indent-right' : 'indent-left'} size={12} />
        </button>
        <button
          className={`toolbar-icon-btn sm ${bracketPair ? 'active' : ''}`}
          onClick={() => setBracketPair(!bracketPair)}
          title={
            bracketPair ? '括号匹配: 开 / Bracket Pair: On' : '括号匹配: 关 / Bracket Pair: Off'
          }
        >
          <Icon name="code-brackets" size={12} />
        </button>
      </div>
      <JsonViewer
        data={parsed}
        wordWrap={false}
        allCollapsed={allCollapsed}
        bracketPair={bracketPair}
        editable
        editPath={editPath}
        editValue={editValue}
        onEditStart={handleValueDoubleClick}
        onEditChange={setEditValue}
        onEditCommit={handleValueCommit}
        onEditCancel={() => {
          setEditPath(null);
          setEditValue('');
        }}
        editKeyPath={editKeyPath}
        editKeyValue={editKeyValue}
        onEditKeyStart={(path, key) => {
          setEditKeyPath(path);
          setEditKeyValue(key);
        }}
        onEditKeyChange={setEditKeyValue}
        onEditKeyCommit={handleKeyCommit}
        onEditKeyCancel={() => {
          setEditKeyPath(null);
          setEditKeyValue('');
        }}
      />
    </div>
  );
}

function JsonViewer({
  data,
  wordWrap,
  allCollapsed,
  editable,
  editPath,
  editValue,
  onEditStart,
  onEditChange,
  onEditCommit,
  onEditCancel,
  bracketPair,
  editKeyPath,
  editKeyValue,
  onEditKeyStart,
  onEditKeyChange,
  onEditKeyCommit,
  onEditKeyCancel,
}: {
  data: any;
  wordWrap: boolean;
  allCollapsed: boolean;
  editable?: boolean;
  editPath?: string | null;
  editValue?: string;
  onEditStart?: (path: string, val: any) => void;
  onEditChange?: (v: string) => void;
  onEditCommit?: (path: string) => void;
  onEditCancel?: () => void;
  bracketPair?: boolean;
  editKeyPath?: string | null;
  editKeyValue?: string;
  onEditKeyStart?: (path: string, key: string) => void;
  onEditKeyChange?: (v: string) => void;
  onEditKeyCommit?: (path: string) => void;
  onEditKeyCancel?: () => void;
}) {
  const viewerRef = useRef<HTMLDivElement>(null);
  const linesRef = useRef<{ num: number; indent: number; content: React.ReactNode; valuePath?: string; valueRaw?: any; keyPath?: string; keyRaw?: string; collapsible?: { id: string; hint: string; closeBracket: string; lineCount: number; depth: number } }[]>([]);
  const lineNumRef = useRef(0);

  lineNumRef.current = 0;
  linesRef.current = [];
  renderJsonLines(data, 0, '', lineNumRef, linesRef);
  const lines = linesRef.current;

  useEffect(() => {
    if (!viewerRef.current) return;
    const el = viewerRef.current;
    const collapsibleLines = el.querySelectorAll('.json-line[data-collapsible-id]');
    collapsibleLines.forEach((lineEl) => {
      const htmlLine = lineEl as HTMLElement;
      const isCollapsed = allCollapsed;
      htmlLine.dataset.collapsed = String(isCollapsed);
      const toggle = htmlLine.querySelector('.json-toggle') as HTMLElement;
      if (toggle) toggle.textContent = isCollapsed ? '▶' : '▼';
      const hint = htmlLine.querySelector('.json-collapse-hint') as HTMLElement;
      if (hint) hint.style.display = isCollapsed ? '' : 'none';
      const closeBkt = htmlLine.querySelector('.json-close-bracket') as HTMLElement;
      if (closeBkt) closeBkt.style.display = isCollapsed ? '' : 'none';
      const count = parseInt(htmlLine.dataset.lineCount || '0', 10);
      let cur = htmlLine.nextElementSibling;
      let remaining = count;
      while (cur && remaining > 0) {
        if (isCollapsed) {
          (cur as HTMLElement).style.display = 'none';
        } else {
          (cur as HTMLElement).style.display = '';
          const subId = cur.getAttribute('data-collapsible-id');
          if (subId) {
            const subEl = cur as HTMLElement;
            subEl.dataset.collapsed = 'false';
            const subToggle = subEl.querySelector('.json-toggle') as HTMLElement;
            if (subToggle) subToggle.textContent = '▼';
            const subHint = subEl.querySelector('.json-collapse-hint') as HTMLElement;
            if (subHint) subHint.style.display = 'none';
            const subClose = subEl.querySelector('.json-close-bracket') as HTMLElement;
            if (subClose) subClose.style.display = 'none';
            const subCount = parseInt(subEl.dataset.lineCount || '0', 10);
            for (let j = 0; j < subCount && cur; j++) {
              cur = cur.nextElementSibling;
              remaining--;
            }
          }
        }
        cur = cur?.nextElementSibling || null;
        remaining--;
      }
    });
  }, [allCollapsed, data]);

  const toggleCollapse = (id: string) => {
    const el = viewerRef.current?.querySelector(`[data-collapsible-id="${id}"]`) as HTMLElement;
    if (!el) return;
    const isCollapsed = el.dataset.collapsed === 'true';
    el.dataset.collapsed = String(!isCollapsed);
    const toggle = el.querySelector('.json-toggle') as HTMLElement;
    if (toggle) toggle.textContent = isCollapsed ? '▼' : '▶';
    const hint = el.querySelector('.json-collapse-hint') as HTMLElement;
    if (hint) hint.style.display = isCollapsed ? 'none' : '';
    const closeBkt = el.querySelector('.json-close-bracket') as HTMLElement;
    if (closeBkt) closeBkt.style.display = isCollapsed ? 'none' : '';
    let count = parseInt(el.dataset.lineCount || '0', 10);
    let cur = el.nextElementSibling;
    while (cur && count > 0) {
      if (!isCollapsed) {
        (cur as HTMLElement).style.display = 'none';
      } else {
        (cur as HTMLElement).style.display = '';
        const subId = cur.getAttribute('data-collapsible-id');
        if (subId) {
          const subEl = cur as HTMLElement;
          const subWasCollapsed = subEl.dataset.collapsed === 'true';
          if (subWasCollapsed) {
            const subCount = parseInt(subEl.dataset.lineCount || '0', 10);
            for (let j = 0; j < subCount && cur; j++) {
              cur = cur.nextElementSibling;
              count--;
            }
            continue;
          }
        }
      }
      cur = (cur?.nextElementSibling as HTMLElement) || null;
      count--;
    }
  };

  const renderEditableValue = (line: (typeof lines)[0]) => {
    const isKeyEditing = editable && line.keyPath && editKeyPath === line.keyPath;
    const isValEditing = editable && line.valuePath && editPath === line.valuePath;
    const raw = line.valueRaw;
    const isStr = typeof raw === 'string';
    const keyName = line.keyPath
      ? line.keyPath
          .split('.')
          .pop()!
          .replace(/\[\d+\]$/, '')
      : '';
    const renderValueSpan = () => {
      if (raw === null || raw === undefined) return <span className="json-null">null</span>;
      if (typeof raw === 'string') return <span className="json-string">"{raw}"</span>;
      if (typeof raw === 'number') return <span className="json-number">{raw}</span>;
      if (typeof raw === 'boolean') return <span className="json-boolean">{String(raw)}</span>;
      return <>{line.content}</>;
    };
    return (
      <>
        {isKeyEditing ? (
          <span className="json-edit-wrap">
            <span className="json-string">"</span>
            <input
              className="json-edit-input json-edit-key"
              type="text"
              value={editKeyValue ?? ''}
              onChange={(e) => onEditKeyChange?.(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  onEditKeyCommit?.(line.keyPath!);
                }
                if (e.key === 'Escape') {
                  e.preventDefault();
                  onEditKeyCancel?.();
                }
              }}
              onBlur={() => onEditKeyCommit?.(line.keyPath!)}
              autoFocus
              spellCheck={false}
            />
            <span className="json-string">"</span>
          </span>
        ) : (
          <span
            className="json-key"
            onDoubleClick={(e) => {
              e.stopPropagation();
              if (editable && line.keyPath) onEditKeyStart?.(line.keyPath!, line.keyRaw ?? keyName);
            }}
          >
            "{keyName}"
          </span>
        )}
        <span className="json-colon">: </span>
        {isValEditing ? (
          <span className="json-edit-wrap">
            {isStr && <span className="json-string">"</span>}
            <input
              className="json-edit-input"
              type="text"
              value={editValue ?? ''}
              onChange={(e) => onEditChange?.(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  onEditCommit?.(line.valuePath!);
                }
                if (e.key === 'Escape') {
                  e.preventDefault();
                  onEditCancel?.();
                }
              }}
              onBlur={() => onEditCommit?.(line.valuePath!)}
              autoFocus
              spellCheck={false}
            />
            {isStr && <span className="json-string">"</span>}
          </span>
        ) : (
          <span
            onDoubleClick={(e) => {
              e.stopPropagation();
              if (editable && line.valuePath) onEditStart?.(line.valuePath!, line.valueRaw);
            }}
          >
            {renderValueSpan()}
          </span>
        )}
      </>
    );
  };

  return (
    <div
      ref={viewerRef}
      className={`json-viewer ${wordWrap ? 'wrap' : 'nowrap'} ${editable ? 'json-viewer-editable' : ''} ${bracketPair ? 'bracket-pair-on' : 'bracket-pair-off'}`}
    >
      {lines.map((line, idx) => (
        <div
          key={idx}
          className={`json-line ${line.collapsible ? 'json-line-collapsible' : ''} ${editable && (line.valuePath || line.keyPath) ? 'json-line-editable' : ''}`}
          data-collapsible-id={line.collapsible?.id}
          data-collapsed={allCollapsed ? 'true' : 'false'}
          data-line-count={line.collapsible?.lineCount}
        >
          <span className="json-line-num">{line.num}</span>
          {line.collapsible ? (
            <span className="json-toggle-col">
              <span className="json-toggle" onClick={() => toggleCollapse(line.collapsible!.id)}>
                {allCollapsed ? '▶' : '▼'}
              </span>
            </span>
          ) : (
            <span className="json-toggle-col" />
          )}
          <span className="json-indent">{'  '.repeat(line.indent)}</span>
          {editable && (line.keyPath || line.valuePath) ? renderEditableValue(line) : line.content}
          {line.collapsible && (
            <>
              <span
                className="json-collapse-hint"
                style={{ display: allCollapsed ? '' : 'none' }}
                onClick={() => toggleCollapse(line.collapsible!.id)}
              >
                {line.collapsible.hint}
              </span>
              <span className="json-close-bracket" style={{ display: allCollapsed ? '' : 'none' }}>
                <span className="json-ellipsis"> ... </span>
                <span
                  className={`json-bracket ${bracketPair ? bracketClass(line.collapsible.depth) : ''}`}
                >
                  {line.collapsible.closeBracket}
                </span>
              </span>
            </>
          )}
        </div>
      ))}
    </div>
  );
}

function generateSnippet(req: HttpRequest, type: string): string {
  const u = req.url || 'https://api.example.com';
  const m = req.method;
  const h = Object.entries(req.headers)
    .filter(([k]) => k)
    .map(([k, v]) => `"${k}": "${v}"`)
    .join(', ');
  const hObj = h ? `{ ${h} }` : '';
  const headerLines = Object.entries(req.headers).filter(([k]) => k);
  switch (type) {
    case 'HTTP':
      return `${m} ${u} HTTP/1.1${headerLines.map(([k, v]) => `\n${k}: ${v}`).join('')}`;
    case 'cURL':
      return `curl -X ${m} '${u}'${headerLines.length ? ` \\\n  ${headerLines.map(([k, v]) => `-H '${k}: ${v}'`).join(' \\\n  ')}` : ''}`;
    case 'Wget':
      return `wget --method=${m} '${u}'${headerLines.length ? ` ${headerLines.map(([k, v]) => `--header='${k}: ${v}'`).join(' ')}` : ''}`;
    case 'PowerShell':
      return `$headers = @{${headerLines.map(([k, v]) => `\n  "${k}" = "${v}"`).join(',')}\n}\nInvoke-RestMethod -Uri '${u}' -Method ${m}${headerLines.length ? ' -Headers $headers' : ''} -ContentType 'application/json'`;
    case 'Fetch':
      return `fetch('${u}', {\n  method: '${m}',${h ? `\n  headers: ${hObj},` : ''}\n})\n  .then(res => res.json())\n  .then(data => console.log(data));`;
    case 'Axios':
      return `import axios from 'axios';\n\naxios.${m.toLowerCase()}('${u}'${h ? `, { headers: ${hObj} }` : ''})\n  .then(res => console.log(res.data));`;
    case 'jQuery':
      return `$.ajax({\n  url: '${u}',\n  method: '${m}',${h ? `\n  headers: ${hObj},` : ''}\n  success: function(data) { console.log(data); }\n});`;
    case 'XHR':
      return `const xhr = new XMLHttpRequest();\nxhr.open('${m}', '${u}');${headerLines.map(([k, v]) => `\nxhr.setRequestHeader('${k}', '${v}');`).join('')}\nxhr.onload = () => console.log(xhr.responseText);\nxhr.send();`;
    case 'Node HTTP':
      return `const http = require('http');\nconst url = new URL('${u}');\nconst options = { method: '${m}', hostname: url.hostname, path: url.pathname${h ? `, headers: ${hObj}` : ''} };\nconst req = http.request(options, res => { let data = ''; res.on('data', c => data += c); res.on('end', () => console.log(data)); });\nreq.end();`;
    case 'Got':
      return `const got = require('got');\n\ngot('${u}', { method: '${m}'${h ? `, headers: ${hObj}` : ''} })\n  .then(res => console.log(res.body));`;
    case 'SuperAgent':
      return `const superagent = require('superagent');\n\nsuperagent('${m}', '${u}')${headerLines.map(([k, v]) => `\n  .set('${k}', '${v}')`).join('')}\n  .then(res => console.log(res.body));`;
    case 'Undici':
      return `import { request } from 'undici';\n\nconst { statusCode, body } = await request('${u}', {\n  method: '${m}',${h ? `\n  headers: ${hObj},` : ''}\n});\nconsole.log(await body.json());`;
    case 'Python Requests':
      return `import requests\n\nresponse = requests.${m.toLowerCase()}('${u}'${h ? `, headers={${headerLines.map(([k, v]) => `'${k}': '${v}'`).join(', ')}}` : ''})\nprint(response.json())`;
    case 'Python http.client':
      return `import http.client\nimport json\n\nconn = http.client.HTTPSConnection('${u.replace(/https?:\/\//, '').split('/')[0]}')\nconn.request('${m}', '${u}'${h ? `, headers={${headerLines.map(([k, v]) => `'${k}': '${v}'`).join(', ')}}` : ''})\nres = conn.getresponse()\nprint(json.loads(res.read()))`;
    case 'Python aiohttp':
      return `import aiohttp\nimport asyncio\n\nasync def main():\n    async with aiohttp.ClientSession() as session:\n        async with session.${m.toLowerCase()}('${u}'${h ? `, headers=${hObj}` : ''}) as resp:\n            print(await resp.json())\n\nasyncio.run(main())`;
    case 'Java OkHttp':
      return `OkHttpClient client = new OkHttpClient();\nRequest request = new Request.Builder()\n  .url("${u}")\n  .${m.toLowerCase()}(${headerLines.length ? `addHeader(${headerLines.map(([k, v]) => `"${k}", "${v}"`).join(').addHeader(')})` : 'build()'})\n  .build();\nResponse response = client.newCall(request).execute();`;
    case 'Java HttpClient':
      return `HttpClient client = HttpClient.newHttpClient();\nHttpRequest request = HttpRequest.newBuilder()\n  .uri(URI.create("${u}"))\n  .header("Content-Type", "application/json")${headerLines.map(([k, v]) => `\n  .header("${k}", "${v}")`).join('')}\n  .${m.toLowerCase() === 'delete' ? 'DELETE' : m.toLowerCase() === 'patch' ? 'method("PATCH"' : m.toLowerCase() === 'put' ? 'PUT' : m.toLowerCase() === 'post' ? 'POST' : 'GET'}()\n  .build();\nHttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());\nSystem.out.println(response.body());`;
    case 'Java Unirest':
      return `import kong.unirest.Unirest;\n\nHttpResponse<String> response = Unirest.${m.toLowerCase()}("${u}")${headerLines.map(([k, v]) => `\n  .header("${k}", "${v}")`).join('')}\n  .asString();\nSystem.out.println(response.getBody());`;
    case 'Go net/http':
      return `package main\n\nimport (\n  "fmt"\n  "net/http"\n  "io"\n)\n\nfunc main() {\n  req, _ := http.NewRequest("${m}", "${u}", nil)${headerLines.map(([k, v]) => `\n  req.Header.Set("${k}", "${v}")`).join('')}\n  resp, _ := http.DefaultClient.Do(req)\n  defer resp.Body.Close()\n  body, _ := io.ReadAll(resp.Body)\n  fmt.Println(string(body))\n}`;
    case 'Rust reqwest':
      return `let client = reqwest::Client::new();\nlet resp = client.${m.toLowerCase()}("${u}")${headerLines.map(([k, v]) => `.header("${k}", "${v}")`).join('')}\n  .send()\n  .await?;\nprintln!("{:?}", resp.text().await?);`;
    case 'C# HttpClient':
      return `using var client = new HttpClient();${headerLines.map(([k, v]) => `\nclient.DefaultRequestHeaders.Add("${k}", "${v}");`).join('')}\nvar response = await client.${m.toLowerCase() === 'delete' ? 'Delete' : m.toLowerCase() === 'patch' ? 'Patch' : m.toLowerCase() === 'put' ? 'Put' : m.toLowerCase() === 'post' ? 'Post' : 'Get'}Async("${u}");\nvar content = await response.Content.ReadAsStringAsync();\nConsole.WriteLine(content);`;
    case 'C# RestSharp':
      return `var client = new RestClient("${u}");\nvar request = new RestRequest("", Method.${m.charAt(0) + m.slice(1).toLowerCase()});${headerLines.map(([k, v]) => `\nrequest.AddHeader("${k}", "${v}");`).join('')}\nvar response = await client.ExecuteAsync(request);\nConsole.WriteLine(response.Content);`;
    case 'Ruby Net::HTTP':
      return `require 'net/http'\nrequire 'json'\n\nuri = URI('${u}')\nhttp = Net::HTTP.new(uri.host, uri.port)\nhttp.use_ssl = uri.scheme == 'https'\nrequest = Net::HTTP::${m.charAt(0) + m.slice(1).toLowerCase()}.new(uri.request_uri)${headerLines.map(([k, v]) => `\nrequest['${k}'] = '${v}'`).join('')}\nresponse = http.request(request)\nputs JSON.parse(response.body)`;
    case 'PHP cURL':
      return `<?php\n$ch = curl_init();\ncurl_setopt($ch, CURLOPT_URL, "${u}");\ncurl_setopt($ch, CURLOPT_CUSTOMREQUEST, "${m}");${headerLines.map(([k, v]) => `\ncurl_setopt($ch, CURLOPT_HTTPHEADER, ["${k}: ${v}"]);`).join('')}\ncurl_setopt($ch, CURLOPT_RETURNTRANSFER, true);\n$response = curl_exec($ch);\ncurl_close($ch);\necho $response;`;
    case 'PHP Guzzle':
      return `<?php\nrequire 'vendor/autoload.php';\n\n$client = new GuzzleHttp\\Client();\n$response = $client->${m.toLowerCase()}('${u}'${h ? `, [\n  'headers' => [${headerLines.map(([k, v]) => `\n    '${k}' => '${v}'`).join(',')}\n  ]\n]` : ''});\necho $response->getBody();`;
    case 'Swift URLSession':
      return `let url = URL(string: "${u}")!\nvar request = URLRequest(url: url)\nrequest.httpMethod = "${m}"${headerLines.map(([k, v]) => `\nrequest.setValue("${v}", forHTTPHeaderField: "${k}")`).join('')}\nURLSession.shared.dataTask(with: request) { data, _, _ in\n  if let data = data { print(String(data: data, encoding: .utf8)!) }\n}.resume()`;
    case 'Swift Alamofire':
      return `import Alamofire\n\nAF.request("${u}", method: .${m.toLowerCase()}${h ? `, headers: HTTPHeaders(${hObj})` : ''})\n  .responseJSON { response in\n    print(response.value ?? "")\n  }`;
    case 'Dart http':
      return `import 'package:http/http.dart' as http;\n\nfinal response = await http.${m.toLowerCase()}(\n  Uri.parse('${u}'),${h ? `\n  headers: ${hObj},` : ''}\n);\nprint(response.body);`;
    case 'Kotlin ktor':
      return `import io.ktor.client.*\nimport io.ktor.client.request.*\nimport io.ktor.client.statement.*\n\nval client = HttpClient()\nval response = client.${m.toLowerCase()}("${u}")${headerLines.map(([k, v]) => ` {\n  header("${k}", "${v}")\n}`).join('')}\nprintln(response.bodyAsText())`;
    case 'Scala sttp':
      return `import sttp.client3._\n\nval backend = HttpURLConnectionBackend()\nval request = basicRequest\n  .${m.toLowerCase()}(uri"${u}")${headerLines.map(([k, v]) => `\n  .header("${k}", "${v}")`).join('')}\nval response = request.send(backend)\nprintln(response.body)`;
    case 'Elixir HTTPoison':
      return `HTTPoison.${m.toLowerCase()}("${u}"${h ? `, "", ${hObj}` : ''})\n|> case do\n  {:ok, %HTTPoison.Response{body: body}} -> IO.puts(body)\n  {:error, %HTTPoison.Error{reason: reason}} -> IO.inspect(reason)\nend`;
    case 'Clojure clj-http':
      return `(require '[clj-http.client :as client])\n\n(client/${m.toLowerCase()} "${u}"${h ? ` {:headers ${hObj}}` : ''})`;
    case 'Lua http':
      return `local http = require("socket.http")\nlocal ltn12 = require("ltn12")\n\nlocal response = {}\nhttp.request({\n  url = "${u}",\n  method = "${m}",${headerLines.length ? `\n  headers = {${headerLines.map(([k, v]) => `["${k}"] = "${v}"`).join(', ')}},` : ''}\n  sink = ltn12.sink.table(response)\n})\nprint(table.concat(response))`;
    case 'R httr':
      return `library(httr)\n\nresponse <- ${m.toLowerCase()}("${u}"${h ? `, add_headers(${headerLines.map(([k, v]) => `"${k}"="${v}"`).join(', ')})` : ''})\ncontent(response)`;
    case 'C libcurl':
      return `#include <curl/curl.h>\n\nCURL *curl = curl_easy_init();\nif (curl) {\n  curl_easy_setopt(curl, CURLOPT_URL, "${u}");\n  curl_easy_setopt(curl, CURLOPT_CUSTOMREQUEST, "${m}");${headerLines.map(([k, v]) => `\n  struct curl_slist *headers = NULL;\n  headers = curl_slist_append(headers, "${k}: ${v}");`).join('')}\n  curl_easy_perform(curl);\n  curl_easy_cleanup(curl);\n}`;
    case 'Shell cURL':
      return `#!/bin/bash\ncurl -s -X ${m} '${u}'${headerLines.length ? ` ${headerLines.map(([k, v]) => `-H '${k}: ${v}'`).join(' ')}` : ''}`;
    default:
      return '';
  }
}

function generateTypes(response: HttpResponse, name: string, key: string): string {
  try {
    const obj = JSON.parse(response.body);
    const typeName = name.replace(/[^a-zA-Z0-9]/g, '') || 'Response';
    switch (key) {
      case 'typescript': {
        const lines = [`interface ${typeName} {`];
        for (const [k, v] of Object.entries(obj)) {
          lines.push(
            `  ${k}: ${typeof v === 'string' ? 'string' : typeof v === 'number' ? 'number' : typeof v === 'boolean' ? 'boolean' : Array.isArray(v) ? 'any[]' : 'any'};`
          );
        }
        return lines.join('\n') + '\n}';
      }
      case 'flow': {
        const lines = [`type ${typeName} = {|`];
        for (const [k, v] of Object.entries(obj)) {
          lines.push(
            `  ${k}: ${typeof v === 'string' ? 'string' : typeof v === 'number' ? 'number' : typeof v === 'boolean' ? 'boolean' : 'any'},`
          );
        }
        return lines.join('\n') + '\n|};';
      }
      case 'json-schema':
        return JSON.stringify(
          {
            $schema: 'http://json-schema.org/draft-07/schema#',
            type: 'object',
            properties: Object.fromEntries(
              Object.entries(obj).map(([k, v]) => [
                k,
                {
                  type:
                    typeof v === 'string'
                      ? 'string'
                      : typeof v === 'number'
                        ? 'number'
                        : typeof v === 'boolean'
                          ? 'boolean'
                          : 'object',
                },
              ])
            ),
            title: typeName,
          },
          null,
          2
        );
      case 'go': {
        const lines = [`type ${typeName} struct {`];
        for (const [k, v] of Object.entries(obj)) {
          const t =
            typeof v === 'string'
              ? 'string'
              : typeof v === 'number'
                ? 'float64'
                : typeof v === 'boolean'
                  ? 'bool'
                  : 'interface{}';
          lines.push(`  ${k.charAt(0).toUpperCase() + k.slice(1)} ${t} \`json:"${k}"\``);
        }
        return lines.join('\n') + '\n}';
      }
      case 'java': {
        const lines = [`public class ${typeName} {`];
        for (const [k, v] of Object.entries(obj)) {
          const t =
            typeof v === 'string'
              ? 'String'
              : typeof v === 'number'
                ? 'double'
                : typeof v === 'boolean'
                  ? 'boolean'
                  : 'Object';
          lines.push(
            `  private ${t} ${k};`,
            `  public ${t} get${k.charAt(0).toUpperCase() + k.slice(1)}() { return ${k}; }`,
            `  public void set${k.charAt(0).toUpperCase() + k.slice(1)}(${t} ${k}) { this.${k} = ${k}; }`
          );
        }
        return lines.join('\n') + '\n}';
      }
      case 'csharp': {
        const lines = [`public class ${typeName}`, '{'];
        for (const [k, v] of Object.entries(obj)) {
          const t =
            typeof v === 'string'
              ? 'string'
              : typeof v === 'number'
                ? 'double'
                : typeof v === 'boolean'
                  ? 'bool'
                  : 'object';
          lines.push(`  [JsonProperty("${k}")]`);
          lines.push(`  public ${t} ${k.charAt(0).toUpperCase() + k.slice(1)} { get; set; }`);
        }
        return 'using Newtonsoft.Json;\n\n' + lines.join('\n') + '\n}';
      }
      case 'python': {
        const lines = [`@dataclass`, `class ${typeName}:`];
        for (const [k, v] of Object.entries(obj)) {
          const t =
            typeof v === 'string'
              ? 'str'
              : typeof v === 'number'
                ? 'float'
                : typeof v === 'boolean'
                  ? 'bool'
                  : 'Any';
          lines.push(`    ${k}: ${t}`);
        }
        return 'from dataclasses import dataclass\nfrom typing import Any\n\n' + lines.join('\n');
      }
      case 'rust': {
        const lines = [`#[derive(Debug, Serialize, Deserialize)]`, `struct ${typeName} {`];
        for (const [k, v] of Object.entries(obj)) {
          const t =
            typeof v === 'string'
              ? 'String'
              : typeof v === 'number'
                ? 'f64'
                : typeof v === 'boolean'
                  ? 'bool'
                  : 'serde_json::Value';
          lines.push(`    #[serde(rename = "${k}")]`);
          lines.push(`    ${k}: ${t},`);
        }
        return lines.join('\n') + '\n}';
      }
      case 'kotlin': {
        const lines = [`data class ${typeName}(`];
        const entries = Object.entries(obj);
        entries.forEach(([k, v], i) => {
          const t =
            typeof v === 'string'
              ? 'String'
              : typeof v === 'number'
                ? 'Double'
                : typeof v === 'boolean'
                  ? 'Boolean'
                  : 'Any';
          lines.push(`    @SerializedName("${k}")`);
          lines.push(`    val ${k}: ${t}${i < entries.length - 1 ? ',' : ''}`);
        });
        return 'import com.google.gson.annotations.SerializedName\n\n' + lines.join('\n') + '\n)';
      }
      case 'swift': {
        const lines = [`struct ${typeName}: Codable {`];
        for (const [k, v] of Object.entries(obj)) {
          const t =
            typeof v === 'string'
              ? 'String'
              : typeof v === 'number'
                ? 'Double'
                : typeof v === 'boolean'
                  ? 'Bool'
                  : 'Any';
          lines.push(`    let ${k}: ${t}`);
        }
        return lines.join('\n') + '\n}';
      }
      case 'dart': {
        const lines = [`class ${typeName} {`];
        for (const [k, v] of Object.entries(obj)) {
          const t =
            typeof v === 'string'
              ? 'String'
              : typeof v === 'number'
                ? 'double'
                : typeof v === 'boolean'
                  ? 'bool'
                  : 'dynamic';
          lines.push(`  final ${t} ${k};`);
        }
        lines.push('');
        lines.push(
          `  ${typeName}({${Object.entries(obj)
            .map(([k]) => `required this.${k}`)
            .join(', ')}});`
        );
        lines.push('');
        lines.push(
          `  factory ${typeName}.fromJson(Map<String, dynamic> json) => ${typeName}(${Object.entries(
            obj
          )
            .map(([k]) => `${k}: json['${k}']`)
            .join(', ')});`
        );
        return lines.join('\n') + '\n}';
      }
      case 'scala': {
        const lines = [`case class ${typeName}(`];
        const entries = Object.entries(obj);
        entries.forEach(([k, v], i) => {
          const t =
            typeof v === 'string'
              ? 'String'
              : typeof v === 'number'
                ? 'Double'
                : typeof v === 'boolean'
                  ? 'Boolean'
                  : 'Any';
          lines.push(`  ${k}: ${t}${i < entries.length - 1 ? ',' : ''}`);
        });
        return lines.join('\n') + '\n)';
      }
      case 'php': {
        const lines = [`class ${typeName}`, '{'];
        for (const [k, v] of Object.entries(obj)) {
          const t =
            typeof v === 'string'
              ? 'string'
              : typeof v === 'number'
                ? 'float'
                : typeof v === 'boolean'
                  ? 'bool'
                  : 'mixed';
          lines.push(`  public ${t} $${k};`);
        }
        lines.push('');
        lines.push(`  public static function fromJson(array $data): self`);
        lines.push('  {');
        lines.push(`    $obj = new self();`);
        for (const [k] of Object.entries(obj)) {
          lines.push(`    $obj->${k} = $data['${k}'];`);
        }
        lines.push('    return $obj;');
        lines.push('  }');
        return lines.join('\n') + '\n}';
      }
      case 'ruby': {
        const lines = [
          `class ${typeName} < Struct.new(${Object.entries(obj)
            .map(([k]) => `:${k}`)
            .join(', ')})`,
          'end',
        ];
        return lines.join('\n');
      }
      case 'cpp': {
        const lines = [`struct ${typeName} {`];
        for (const [k, v] of Object.entries(obj)) {
          const t =
            typeof v === 'string'
              ? 'std::string'
              : typeof v === 'number'
                ? 'double'
                : typeof v === 'boolean'
                  ? 'bool'
                  : 'nlohmann::json';
          lines.push(`    ${t} ${k};`);
        }
        return '#include <string>\n#include <nlohmann/json.hpp>\n\n' + lines.join('\n') + '\n};';
      }
      default:
        return '// 不支持的类型';
    }
  } catch {
    return '// 无法解析响应体为 JSON';
  }
}

const REQUEST_CLIENT_TYPES = [
  'Fetch',
  'Axios',
  'XHR',
  'jQuery',
  'Node HTTP',
  'Got',
  'SuperAgent',
  'Undici',
] as const;

export const EditorView: React.FC<EditorViewProps> = ({
  request,
  response,
  isLoading,
  error,
  collections,
  environments,
  activeEnvironmentId,
  selectedFile,
  onSendRequest,
  onSaveRequest,
  onRequestChange,
  onClose: _onClose,
  onSwitchEnvironment,
  onSelectedFileConsumed,
}) => {
  const [reqTab, setReqTab] = useState<ReqTab>('query');
  const [resTab, setResTab] = useState<ResTab>('response');
  const [bodyType, setBodyType] = useState<string>(request.body?.type ?? 'none');
  const [authType, setAuthType] = useState<string>(request.auth?.type ?? 'none');
  const [layout, setLayout] = useState<Layout>('horizontal');
  const [splitPos, setSplitPos] = useState(50);
  const [requestClientType, setRequestClientType] = useState<string>('Fetch');
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [selectedCollectionId, setSelectedCollectionId] = useState('');
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showCookieManager, setShowCookieManager] = useState(false);
  const [cookieFilter, setCookieFilter] = useState('');
  const [showSnippetMenu, setShowSnippetMenu] = useState(false);
  const [showTypeMenu, setShowTypeMenu] = useState(false);
  const [showMethodDropdown, setShowMethodDropdown] = useState(false);
  const [snippetCode, setSnippetCode] = useState('');
  const [selectedSnippetLabel, setSelectedSnippetLabel] = useState('');
  const [typeCode, setTypeCode] = useState('');
  const [selectedTypeLabel, setSelectedTypeLabel] = useState('');
  const [wordWrap, setWordWrap] = useState(true);
  const [isMaximized, setIsMaximized] = useState(false);
  const [viewMode, setViewMode] = useState<'response' | 'chart'>('response');
  const [queryRaw, setQueryRaw] = useState(false);
  const [headersRaw, setHeadersRaw] = useState(false);
  const [urlEncodedRaw, setUrlEncodedRaw] = useState(false);
  const [queryRawText, setQueryRawText] = useState('');
  const [headersRawText, setHeadersRawText] = useState('');
  const [urlEncodedRawText, setUrlEncodedRawText] = useState('');
  const [resHeadersRaw, setResHeadersRaw] = useState(false);
  const [resBodyRaw, setResBodyRaw] = useState(false);

  useEffect(() => {
    if (selectedFile && request.body?.type === 'form-data') {
      const fields = [...(request.body.content as FormDataField[])];
      const idx = selectedFile.index;
      if (idx < fields.length) {
        fields[idx] = { ...fields[idx]!, filename: selectedFile.filename, value: selectedFile.path };
        onRequestChange({ ...request, body: { ...request.body, content: fields } });
      }
      onSelectedFileConsumed?.();
    }
  }, [selectedFile]);
  const [allCollapsed, setAllCollapsed] = useState(false);
  const [bracketPair, setBracketPair] = useState(true);
  const [testSubTab, setTestSubTab] = useState<'tests' | 'scripting'>('tests');
  const [preSubTab, setPreSubTab] = useState<'prerequest' | 'scripting'>('prerequest');
  const [disabledParams, setDisabledParams] = useState<Set<number>>(new Set());
  const [disabledHeaders, setDisabledHeaders] = useState<Set<number>>(new Set());
  const [snippetFilter, setSnippetFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [showSaveDropdown, setShowSaveDropdown] = useState(false);
  const saveDropdownRef = useRef<HTMLDivElement>(null);
  const [saveDropdownPos, setSaveDropdownPos] = useState<{ top: number; left: number; width: number }>({ top: 0, left: 0, width: 0 });
  const [encodeActions, setEncodeActions] = useState<Record<number, string>>({});
  const dragging = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const methodRef = useRef<HTMLDivElement>(null);

  const [showEnvToolbarDropdown, setShowEnvToolbarDropdown] = useState(false);
  const envToolbarRef = useRef<HTMLDivElement>(null);

  const [showCurlDialog, setShowCurlDialog] = useState(false);
  const [curlRaw, setCurlRaw] = useState(false);
  const [curlText, setCurlText] = useState('');
  const [showClientTypeDropdown, setShowClientTypeDropdown] = useState(false);
  const clientTypeRef = useRef<HTMLDivElement>(null);
  const [showGrantTypeDropdown, setShowGrantTypeDropdown] = useState(false);
  const grantTypeRef = useRef<HTMLDivElement>(null);
  const [formDataTypeOpen, setFormDataTypeOpen] = useState<number | null>(null);
  const formDataTypeRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  const updateField = useCallback(
    <K extends keyof HttpRequest>(key: K, value: HttpRequest[K]) => {
      onRequestChange({ ...request, [key]: value });
    },
    [request, onRequestChange]
  );

  const updateBody = useCallback(
    (body: RequestBody | undefined) => {
      onRequestChange({ ...request, body: body as any });
    },
    [request, onRequestChange]
  );

  const handleSend = useCallback(() => {
    try {
      const decodedUrl = decodeURIComponent(request.url);
      onSendRequest({ ...request, url: decodedUrl });
    } catch {
      onSendRequest(request);
    }
  }, [request, onSendRequest]);

  const handleSave = useCallback(() => {
    if (!selectedCollectionId) return;
    onSaveRequest(request, selectedCollectionId);
    setShowSaveDialog(false);
    showToast('已保存到集合');
  }, [request, selectedCollectionId, onSaveRequest]);

  const onDragStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      dragging.current = true;
      const onMove = (ev: MouseEvent) => {
        if (!dragging.current || !containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const pos =
          layout === 'horizontal'
            ? ((ev.clientX - rect.left) / rect.width) * 100
            : ((ev.clientY - rect.top) / rect.height) * 100;
        setSplitPos(Math.min(80, Math.max(20, pos)));
      };
      const onUp = () => {
        dragging.current = false;
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    },
    [layout]
  );

  const animateSplitTo = useCallback(
    (target: number) => {
      const start = splitPos;
      const diff = target - start;
      const duration = 400;
      const startTime = performance.now();
      const step = (now: number) => {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        setSplitPos(start + diff * eased);
        if (progress < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    },
    [splitPos]
  );

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMoreMenu(false);
        setShowSnippetMenu(false);
        setShowTypeMenu(false);
      }
      if (methodRef.current && !methodRef.current.contains(e.target as Node))
        setShowMethodDropdown(false);
      if (saveDropdownRef.current && !saveDropdownRef.current.contains(e.target as Node))
        setShowSaveDropdown(false);
      if (envToolbarRef.current && !envToolbarRef.current.contains(e.target as Node))
        setShowEnvToolbarDropdown(false);
      if (clientTypeRef.current && !clientTypeRef.current.contains(e.target as Node))
        setShowClientTypeDropdown(false);
      if (grantTypeRef.current && !grantTypeRef.current.contains(e.target as Node))
        setShowGrantTypeDropdown(false);
      let inFormDataRef = false;
      formDataTypeRefs.current.forEach((ref) => {
        if (ref && ref.contains(e.target as Node)) inFormDataRef = true;
      });
      if (!inFormDataRef) setFormDataTypeOpen(null);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const queryEntries = Object.entries(request.queryParams).filter(([k]) => k);
  const headerEntries = Object.entries(request.headers).filter(([k]) => k);

  const ensureEmptyRow = (obj: Record<string, string>): Record<string, string> => {
    const entries = Object.entries(obj);
    if (entries.length === 0 || entries[entries.length - 1]![0] !== '') {
      return { ...obj, '': '' };
    }
    return obj;
  };

  const renderKvEditor = (
    entries: [string, string][],
    onDelete: (key: string) => void,
    onUpdate: (index: number, key: string, value: string) => void,
    keyLabel: string,
    valueLabel: string,
    disabledSet: Set<number>,
    onToggleDisable: (index: number) => void,
    extraBtns?: (index: number) => React.ReactNode
  ) => (
    <div className="kv-editor">
      {entries.map(([key, value], index) => (
        <div key={index} className={`kv-table-row ${disabledSet.has(index) ? 'disabled' : ''}`}>
          <input
            type="checkbox"
            className="kv-checkbox"
            checked={!disabledSet.has(index)}
            onChange={() => onToggleDisable(index)}
            title={disabledSet.has(index) ? '启用此行 / Enable' : '禁用此行 / Disable'}
          />
          <input
            className="kv-input-key"
            type="text"
            value={key}
            onChange={(e) => onUpdate(index, e.target.value, value)}
            placeholder={keyLabel}
            spellCheck={false}
          />
          <div className="kv-value-wrapper">
            <input
              className="kv-input-value"
              type="text"
              value={value}
              onChange={(e) => onUpdate(index, key, e.target.value)}
              placeholder={valueLabel}
              spellCheck={false}
            />
            {extraBtns && extraBtns(index)}
          </div>
          <button className="kv-delete-btn" onClick={() => onDelete(key)} title="删除 / Delete">
            <Icon name="close" size={14} />
          </button>
        </div>
      ))}
    </div>
  );

  const renderQueryTab = () => {
    if (queryRaw) {
      return (
        <div className="tab-panel animate-fade-in raw-editor-panel">
          <textarea
            className="code-editor raw-editor"
            value={queryRawText || Object.entries(request.queryParams)
              .filter(([k]) => k)
              .map(([k, v]) => `${k}=${v}`)
              .join('\n')}
            onChange={(e) => {
              setQueryRawText(e.target.value);
              const p: Record<string, string> = {};
              e.target.value.split('\n').forEach((line) => {
                const [k, ...rest] = line.split('=');
                if (k && k.trim()) p[k.trim()] = rest.join('=').trim();
              });
              updateField('queryParams', p);
            }}
            placeholder="key1=value1&#10;key2=value2"
            spellCheck={false}
          />
        </div>
      );
    }
    const params = ensureEmptyRow(request.queryParams);
    const entries = Object.entries(params);
    return (
      <div className="tab-panel animate-fade-in">
        {renderKvEditor(
          entries,
          (key) => {
            const p = { ...request.queryParams };
            delete p[key];
            updateField('queryParams', p);
          },
          (i, k, v) => {
            const e = Object.entries(params);
            e[i] = [k, v];
            const p: Record<string, string> = {};
            for (const [a, b] of e) {
              if (a) p[a] = b;
            }
            updateField('queryParams', p);
          },
          '参数名',
          '参数值',
          disabledParams,
          (i) => {
            const n = new Set(disabledParams);
            if (n.has(i)) n.delete(i);
            else n.add(i);
            setDisabledParams(n);
          },
          (index) => {
            const isEncode = encodeActions[index] === 'encode';
            const isDecode = encodeActions[index] === 'decode';
            return (
              <div
                className="kv-encode-switch"
                title={
                  isEncode
                    ? '已编码 / Encoded'
                    : isDecode
                      ? '已解码 / Decoded'
                      : '编码/解码 / Encode/Decode'
                }
              >
                <span
                  className={`kv-encode-opt ${isEncode ? 'active' : ''}`}
                  onClick={() => {
                    const e2 = Object.entries(params);
                    const v = e2[index]![1];
                    const n = [...e2];
                    n[index] = [n[index]![0], encodeURIComponent(v)];
                    const p: Record<string, string> = {};
                    for (const [a, b] of n) {
                      if (a) p[a] = b;
                    }
                    updateField('queryParams', p);
                    setEncodeActions({ ...encodeActions, [index]: isEncode ? '' : 'encode' });
                    if (!isEncode) showToast('已 Encode');
                  }}
                >
                  E
                </span>
                <span
                  className={`kv-encode-opt ${isDecode ? 'active' : ''}`}
                  onClick={() => {
                    const e2 = Object.entries(params);
                    const v = e2[index]![1];
                    const n = [...e2];
                    n[index] = [n[index]![0], decodeURIComponent(v)];
                    const p: Record<string, string> = {};
                    for (const [a, b] of n) {
                      if (a) p[a] = b;
                    }
                    updateField('queryParams', p);
                    setEncodeActions({ ...encodeActions, [index]: isDecode ? '' : 'decode' });
                    if (!isDecode) showToast('已 Decode');
                  }}
                >
                  D
                </span>
              </div>
            );
          }
        )}
      </div>
    );
  };

  const renderHeadersTab = () => {
    if (headersRaw) {
      return (
        <div className="tab-panel animate-fade-in raw-editor-panel">
          <textarea
            className="code-editor raw-editor"
            value={headersRawText || Object.entries(request.headers)
              .filter(([k]) => k)
              .map(([k, v]) => `${k}: ${v}`)
              .join('\n')}
            onChange={(e) => {
              setHeadersRawText(e.target.value);
              const h: Record<string, string> = {};
              e.target.value.split('\n').forEach((line) => {
                const [k, ...rest] = line.split(':');
                if (k && k.trim()) h[k.trim()] = rest.join(':').trim();
              });
              updateField('headers', h);
            }}
            placeholder="Header-Key: Header-Value"
            spellCheck={false}
          />
        </div>
      );
    }
    const headers = ensureEmptyRow(request.headers);
    const entries = Object.entries(headers);
    return (
      <div className="tab-panel animate-fade-in">
        {renderKvEditor(
          entries,
          (key) => {
            const h = { ...request.headers };
            delete h[key];
            updateField('headers', h);
          },
          (i, k, v) => {
            const e = Object.entries(headers);
            e[i] = [k, v];
            const h: Record<string, string> = {};
            for (const [a, b] of e) {
              if (a) h[a] = b;
            }
            updateField('headers', h);
          },
          '请求头',
          '值',
          disabledHeaders,
          (i) => {
            const n = new Set(disabledHeaders);
            if (n.has(i)) n.delete(i);
            else n.add(i);
            setDisabledHeaders(n);
          }
        )}
      </div>
    );
  };

  const renderAuthTab = () => (
    <div className="tab-panel animate-fade-in">
      <div className="auth-card">
        <div className="auth-type-selector">
          <label>认证类型 / Auth Type</label>
          <div className="auth-type-pills">
            {AUTH_TYPES.map((v) => (
              <button
                key={v}
                className={`auth-pill ${authType === v ? 'active' : ''}`}
                title={`${AUTH_LABELS[v]} 认证 / ${AUTH_LABELS[v]} Auth`}
                onClick={() => {
                  setAuthType(v);
                  let c: Record<string, string> = {};
                  if (v === 'basic') c = { username: '', password: '' };
                  else if (v === 'bearer') c = { token: '' };
                  else if (v === 'oauth2')
                    c = {
                      grantType: 'authorization_code',
                      accessTokenUrl: '',
                      clientId: '',
                      clientSecret: '',
                      scope: '',
                    };
                  else if (v === 'ntlm')
                    c = { username: '', password: '', domain: '', workstation: '' };
                  else if (v === 'aws')
                    c = { accessKey: '', secretKey: '', region: 'us-east-1', service: '' };
                  onRequestChange({ ...request, auth: { type: v as any, config: c } });
                }}
              >
                <Icon name={AUTH_ICONS[v] || 'lock'} size={16} />
                <span>{AUTH_LABELS[v]}</span>
              </button>
            ))}
          </div>
        </div>
        {authType === 'basic' && (
          <div className="auth-form animate-fade-in">
            <div className="form-field">
              <label>用户名 / Username</label>
              <input
                type="text"
                value={request.auth?.config.username ?? ''}
                onChange={(e) =>
                  onRequestChange({
                    ...request,
                    auth: {
                      ...request.auth!,
                      config: { ...request.auth!.config, username: e.target.value },
                    },
                  })
                }
                placeholder="输入用户名"
                spellCheck={false}
              />
            </div>
            <div className="form-field">
              <label>密码 / Password</label>
              <input
                type="password"
                value={request.auth?.config.password ?? ''}
                onChange={(e) =>
                  onRequestChange({
                    ...request,
                    auth: {
                      ...request.auth!,
                      config: { ...request.auth!.config, password: e.target.value },
                    },
                  })
                }
                placeholder="输入密码"
              />
            </div>
          </div>
        )}
        {authType === 'bearer' && (
          <div className="auth-form animate-fade-in">
            <div className="form-field">
              <label>令牌 / Token</label>
              <input
                type="text"
                value={request.auth?.config.token ?? ''}
                onChange={(e) =>
                  onRequestChange({
                    ...request,
                    auth: {
                      ...request.auth!,
                      config: { ...request.auth!.config, token: e.target.value },
                    },
                  })
                }
                placeholder="输入 Bearer 令牌"
                spellCheck={false}
              />
            </div>
            <div className="form-field">
              <label>前缀 / Prefix</label>
              <input
                type="text"
                value={request.auth?.config.prefix ?? 'Bearer'}
                onChange={(e) =>
                  onRequestChange({
                    ...request,
                    auth: {
                      ...request.auth!,
                      config: { ...request.auth!.config, prefix: e.target.value },
                    },
                  })
                }
                placeholder="Bearer"
                spellCheck={false}
              />
            </div>
          </div>
        )}
        {authType === 'oauth2' && (
          <div className="auth-form animate-fade-in">
            <div className="form-field">
              <label>授权类型 / Grant Type</label>
              <div className="grant-type-dropdown" ref={grantTypeRef}>
                <div
                  className="grant-type-selector"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowGrantTypeDropdown(!showGrantTypeDropdown);
                  }}
                >
                  <span>
                    {request.auth?.config.grantType === 'client_credentials'
                      ? 'Client Credentials'
                      : request.auth?.config.grantType === 'password'
                        ? 'Password'
                        : request.auth?.config.grantType === 'implicit'
                          ? 'Implicit'
                          : 'Authorization Code'}
                  </span>
                  <Icon
                    name="arrow-down"
                    size={14}
                    color="var(--text-muted)"
                    className={`grant-arrow ${showGrantTypeDropdown ? 'rotated' : ''}`}
                  />
                </div>
                {showGrantTypeDropdown && (
                  <div
                    className="grant-type-options animate-scale-in"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {['authorization_code', 'client_credentials', 'password', 'implicit'].map(
                      (gt) => (
                        <button
                          key={gt}
                          className={`grant-type-opt ${(request.auth?.config.grantType ?? 'authorization_code') === gt ? 'active' : ''}`}
                          onClick={() => {
                            onRequestChange({
                              ...request,
                              auth: {
                                ...request.auth!,
                                config: { ...request.auth!.config, grantType: gt },
                              },
                            });
                            setShowGrantTypeDropdown(false);
                          }}
                        >
                          <span>
                            {gt === 'authorization_code'
                              ? 'Authorization Code'
                              : gt === 'client_credentials'
                                ? 'Client Credentials'
                                : gt === 'password'
                                  ? 'Password'
                                  : 'Implicit'}
                          </span>
                        </button>
                      )
                    )}
                  </div>
                )}
              </div>
            </div>
            <div className="form-field">
              <label>授权 URL / Auth URL</label>
              <input
                type="text"
                value={request.auth?.config.authUrl ?? ''}
                onChange={(e) =>
                  onRequestChange({
                    ...request,
                    auth: {
                      ...request.auth!,
                      config: { ...request.auth!.config, authUrl: e.target.value },
                    },
                  })
                }
                placeholder="https://auth.example.com/authorize"
                spellCheck={false}
              />
            </div>
            <div className="form-field">
              <label>令牌 URL / Token URL</label>
              <input
                type="text"
                value={request.auth?.config.accessTokenUrl ?? ''}
                onChange={(e) =>
                  onRequestChange({
                    ...request,
                    auth: {
                      ...request.auth!,
                      config: { ...request.auth!.config, accessTokenUrl: e.target.value },
                    },
                  })
                }
                placeholder="https://auth.example.com/token"
                spellCheck={false}
              />
            </div>
            <div className="form-field">
              <label>Client ID</label>
              <input
                type="text"
                value={request.auth?.config.clientId ?? ''}
                onChange={(e) =>
                  onRequestChange({
                    ...request,
                    auth: {
                      ...request.auth!,
                      config: { ...request.auth!.config, clientId: e.target.value },
                    },
                  })
                }
                placeholder="Client ID"
                spellCheck={false}
              />
            </div>
            <div className="form-field">
              <label>Client Secret</label>
              <input
                type="password"
                value={request.auth?.config.clientSecret ?? ''}
                onChange={(e) =>
                  onRequestChange({
                    ...request,
                    auth: {
                      ...request.auth!,
                      config: { ...request.auth!.config, clientSecret: e.target.value },
                    },
                  })
                }
                placeholder="Client Secret"
              />
            </div>
            <div className="form-field">
              <label>Scope</label>
              <input
                type="text"
                value={request.auth?.config.scope ?? ''}
                onChange={(e) =>
                  onRequestChange({
                    ...request,
                    auth: {
                      ...request.auth!,
                      config: { ...request.auth!.config, scope: e.target.value },
                    },
                  })
                }
                placeholder="read write"
                spellCheck={false}
              />
            </div>
            <div className="form-field">
              <label>回调 URL / Callback URL</label>
              <input
                type="text"
                value={request.auth?.config.callbackUrl ?? ''}
                onChange={(e) =>
                  onRequestChange({
                    ...request,
                    auth: {
                      ...request.auth!,
                      config: { ...request.auth!.config, callbackUrl: e.target.value },
                    },
                  })
                }
                placeholder="https://example.com/callback"
                spellCheck={false}
              />
            </div>
          </div>
        )}
        {authType === 'ntlm' && (
          <div className="auth-form animate-fade-in">
            <div className="form-field">
              <label>用户名 / Username</label>
              <input
                type="text"
                value={request.auth?.config.username ?? ''}
                onChange={(e) =>
                  onRequestChange({
                    ...request,
                    auth: {
                      ...request.auth!,
                      config: { ...request.auth!.config, username: e.target.value },
                    },
                  })
                }
                placeholder="输入用户名"
                spellCheck={false}
              />
            </div>
            <div className="form-field">
              <label>密码 / Password</label>
              <input
                type="password"
                value={request.auth?.config.password ?? ''}
                onChange={(e) =>
                  onRequestChange({
                    ...request,
                    auth: {
                      ...request.auth!,
                      config: { ...request.auth!.config, password: e.target.value },
                    },
                  })
                }
                placeholder="输入密码"
              />
            </div>
            <div className="form-field">
              <label>域名 / Domain</label>
              <input
                type="text"
                value={request.auth?.config.domain ?? ''}
                onChange={(e) =>
                  onRequestChange({
                    ...request,
                    auth: {
                      ...request.auth!,
                      config: { ...request.auth!.config, domain: e.target.value },
                    },
                  })
                }
                placeholder="DOMAIN"
                spellCheck={false}
              />
            </div>
            <div className="form-field">
              <label>工作站 / Workstation</label>
              <input
                type="text"
                value={request.auth?.config.workstation ?? ''}
                onChange={(e) =>
                  onRequestChange({
                    ...request,
                    auth: {
                      ...request.auth!,
                      config: { ...request.auth!.config, workstation: e.target.value },
                    },
                  })
                }
                placeholder="WORKSTATION"
                spellCheck={false}
              />
            </div>
          </div>
        )}
        {authType === 'aws' && (
          <div className="auth-form animate-fade-in">
            <div className="form-field">
              <label>Access Key</label>
              <input
                type="text"
                value={request.auth?.config.accessKey ?? ''}
                onChange={(e) =>
                  onRequestChange({
                    ...request,
                    auth: {
                      ...request.auth!,
                      config: { ...request.auth!.config, accessKey: e.target.value },
                    },
                  })
                }
                placeholder="AKIAIOSFODNN7EXAMPLE"
                spellCheck={false}
              />
            </div>
            <div className="form-field">
              <label>Secret Key</label>
              <input
                type="password"
                value={request.auth?.config.secretKey ?? ''}
                onChange={(e) =>
                  onRequestChange({
                    ...request,
                    auth: {
                      ...request.auth!,
                      config: { ...request.auth!.config, secretKey: e.target.value },
                    },
                  })
                }
                placeholder="Secret Key"
              />
            </div>
            <div className="form-field">
              <label>区域 / Region</label>
              <input
                type="text"
                value={request.auth?.config.region ?? 'us-east-1'}
                onChange={(e) =>
                  onRequestChange({
                    ...request,
                    auth: {
                      ...request.auth!,
                      config: { ...request.auth!.config, region: e.target.value },
                    },
                  })
                }
                placeholder="us-east-1"
                spellCheck={false}
              />
            </div>
            <div className="form-field">
              <label>服务 / Service</label>
              <input
                type="text"
                value={request.auth?.config.service ?? ''}
                onChange={(e) =>
                  onRequestChange({
                    ...request,
                    auth: {
                      ...request.auth!,
                      config: { ...request.auth!.config, service: e.target.value },
                    },
                  })
                }
                placeholder="execute-api"
                spellCheck={false}
              />
            </div>
          </div>
        )}
        {authType === 'none' && (
          <div className="auth-empty-state">
            <Icon name="lock" size={40} color="var(--text-muted)" />
            <p>此请求不需要认证 / No auth required</p>
          </div>
        )}
      </div>
    </div>
  );

  const renderBodyTab = () => (
    <div className="tab-panel animate-fade-in">
      <div className="body-categories">
        {BODY_CATEGORIES.map((cat) => (
          <div key={cat.key} className="body-category">
            {cat.key !== 'none' && <div className="body-category-label">{cat.label}</div>}
            <div className="body-type-row">
              {cat.types.map((t) => (
                <label
                  key={t.key}
                  className={`body-radio ${bodyType === t.key ? 'active' : ''}`}
                  title={`${t.label} / ${t.contentType || 'No body'}`}
                >
                  <input
                    type="radio"
                    name="bodyType"
                    checked={bodyType === t.key}
                    onChange={() => {
                      setBodyType(t.key);
                      if (t.key === 'none') updateBody(undefined);
                      else if (t.key === 'json')
                        updateBody({ type: 'json', content: '{\n  \n}' } as any);
                      else if (t.key === 'json-ld')
                        updateBody({
                          type: 'json',
                          content:
                            '{\n  "@context": "https://json-ld.org/contexts/person.jsonld",\n  "@type": "Person",\n  "name": ""\n}',
                        } as any);
                      else if (t.key === 'json-hal')
                        updateBody({
                          type: 'json',
                          content: '{\n  "_links": {\n    "self": { "href": "" }\n  }\n}',
                        } as any);
                      else if (t.key === 'json-api')
                        updateBody({
                          type: 'json',
                          content:
                            '{\n  "data": {\n    "type": "",\n    "id": "",\n    "attributes": {}\n  }\n}',
                        } as any);
                      else if (t.key === 'xml' || t.key === 'text-xml')
                        updateBody({
                          type: 'raw',
                          content: '<?xml version="1.0"?>\n<root>\n  \n</root>',
                        } as any);
                      else if (t.key === 'form-data')
                        updateBody({ type: 'form-data', content: [] } as any);
                      else if (t.key === 'x-www-form-urlencoded')
                        updateBody({ type: 'x-www-form-urlencoded', content: '' } as any);
                      else if (t.key === 'binary') updateBody({ type: 'raw', content: '' } as any);
                      else if (t.key === 'html')
                        updateBody({
                          type: 'raw',
                          content:
                            '<!DOCTYPE html>\n<html>\n<head>\n  <title></title>\n</head>\n<body>\n  \n</body>\n</html>',
                        } as any);
                      else if (t.key === 'plain') updateBody({ type: 'raw', content: '' } as any);
                      else if (t.key === 'graphql')
                        updateBody({ type: 'graphql', content: '{\n  \n}' } as any);
                    }}
                  />
                  <span className="body-radio-label">{t.label}</span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
      {bodyType === 'none' && (
        <div className="body-empty-state">
          <Icon name="doc" size={40} color="var(--text-muted)" />
          <p>此请求没有请求体 / No request body</p>
        </div>
      )}
      {['json', 'json-ld', 'json-hal', 'json-api'].includes(bodyType) && request.body && (
        <div className="body-editor-wrap">
          <div className="body-editor-toolbar">
            <div className="body-content-type-hint">{BODY_TYPE_MAP[bodyType]?.contentType}</div>
            <button
              className={`json-format-switch ${(() => {
                try {
                  const v = String(request.body?.content ?? '').trim();
                  JSON.parse(v);
                  return 'valid';
                } catch {
                  return 'invalid';
                }
              })()}`}
              onClick={() => {
                const raw = String(request.body?.content ?? '').trim();
                if (!raw) {
                  showToast('内容为空');
                  return;
                }
                try {
                  const parsed = JSON.parse(raw);
                  updateBody({ type: 'json', content: JSON.stringify(parsed, null, 2) } as any);
                  showToast('JSON 已格式化');
                } catch {
                  let fixed = raw.trim();
                  try {
                    fixed = fixed.replace(/,\s*([}\]])/g, '$1');
                    JSON.parse(fixed);
                  } catch {}
                  try {
                    if (!fixed.startsWith('{') && !fixed.startsWith('[')) {
                      fixed = '{' + fixed + '}';
                    }
                    fixed = fixed.replace(/(?<!["\w])(\b\w+)\s*:/g, '"$1":');
                    JSON.parse(fixed);
                  } catch {}
                  try {
                    fixed = fixed.replace(/'/g, '"');
                    JSON.parse(fixed);
                  } catch {}
                  try {
                    fixed = fixed
                      .replace(/\t/g, '  ')
                      .replace(/[\x00-\x1f]/g, (c) =>
                        c === '\n' || c === '\r' || c === '\t' ? c : ''
                      );
                    JSON.parse(fixed);
                  } catch {}
                  try {
                    const parsed = JSON.parse(fixed);
                    updateBody({ type: 'json', content: JSON.stringify(parsed, null, 2) } as any);
                    showToast('JSON 已自动修复并格式化');
                  } catch {
                    showToast('JSON 格式不正确，无法自动修复');
                  }
                }
              }}
              title={(() => {
                try {
                  const v = String(request.body?.content ?? '').trim();
                  if (!v) return '格式化 JSON / Format JSON';
                  JSON.parse(v);
                  return 'JSON 有效 ✓ 点击格式化';
                } catch {
                  return 'JSON 无效 ✗ 点击自动修复';
                }
              })()}
            >
              <span className="json-format-track">
                <span className="json-format-thumb" />
              </span>
            </button>
          </div>
          <JsonEditor
            value={String(request.body.content ?? '')}
            onChange={(v) => updateBody({ type: 'json', content: v } as any)}
          />
        </div>
      )}
      {['xml', 'text-xml', 'html', 'plain'].includes(bodyType) && request.body && (
        <div className="body-editor-wrap">
          <div className="body-editor-toolbar">
            <div className="body-content-type-hint">{BODY_TYPE_MAP[bodyType]?.contentType}</div>
          </div>
          <textarea
            className="code-editor"
            value={String(request.body.content ?? '')}
            onChange={(e) => updateBody({ type: 'raw', content: e.target.value } as any)}
            placeholder={
              bodyType === 'xml' || bodyType === 'text-xml'
                ? '输入 XML 内容'
                : bodyType === 'html'
                  ? '输入 HTML 内容'
                  : '输入文本内容'
            }
            spellCheck={false}
          />
        </div>
      )}
      {bodyType === 'binary' && (
        <div className="body-editor-wrap">
          <div className="body-editor-toolbar">
            <div className="body-content-type-hint">{BODY_TYPE_MAP[bodyType]?.contentType}</div>
          </div>
          <div className="binary-upload-area">
            <Icon name="upload" size={32} color="var(--text-muted)" />
            <p>点击选择文件或拖拽文件到此处</p>
            <input
              type="file"
              className="binary-file-input"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  const reader = new FileReader();
                  reader.onload = () =>
                    updateBody({ type: 'raw', content: reader.result as string } as any);
                  reader.readAsDataURL(file);
                }
              }}
            />
          </div>
        </div>
      )}
      {bodyType === 'form-data' && request.body && (
        <div className="body-editor-wrap">
          <div className="body-editor-toolbar">
            <div className="body-content-type-hint">{BODY_TYPE_MAP[bodyType]?.contentType}</div>
          </div>
          <div className="form-data-section">
            {(() => {
              const FD_TYPES = ['Text', 'File'] as const;
              const rawFields = (request.body.content as FormDataField[]) ?? [];
              const fields = [...rawFields];
              if (fields.length === 0 || fields[fields.length - 1]!.name !== '') {
                fields.push({ name: '', value: '', enabled: true });
              }
              const updateFormField = (idx: number, updater: (field: FormDataField) => FormDataField) => {
                const f = [...rawFields];
                if (idx < f.length) {
                  f[idx] = updater(f[idx]!);
                } else {
                  const newField = updater({ name: '', value: '', enabled: true });
                  if (newField.name || newField.value || newField.filename !== undefined) {
                    f.push(newField);
                  }
                }
                updateBody({ type: 'form-data', content: f } as any);
              };
              return fields.map((field, i) => {
                const currentType = (field.filename !== undefined && field.filename !== null) ? 'File' : 'Text';
                return (
                  <div key={i} className={`form-data-row ${field.enabled === false ? 'disabled' : ''}`}>
                    <input
                      type="checkbox"
                      className="form-data-check"
                      checked={field.enabled !== false}
                      onChange={(e) => {
                        updateFormField(i, (f) => ({ ...f, enabled: e.target.checked }));
                      }}
                    />
                    <input
                      type="text"
                      className="form-data-key"
                      placeholder="Key"
                      value={field.name}
                      spellCheck={false}
                      onChange={(e) => {
                        updateFormField(i, (f) => ({ ...f, name: e.target.value }));
                      }}
                    />
                    <div
                      className="form-data-type-dropdown"
                      ref={(el) => { if (el) formDataTypeRefs.current.set(i, el); else formDataTypeRefs.current.delete(i); }}
                    >
                      <div
                        className="form-data-type-selector"
                        onClick={(e) => {
                          e.stopPropagation();
                          setFormDataTypeOpen(formDataTypeOpen === i ? null : i);
                        }}
                      >
                        <span>{currentType}</span>
                        <Icon
                          name="arrow-down"
                          size={12}
                          color="var(--text-muted)"
                          className={`fd-type-arrow ${formDataTypeOpen === i ? 'rotated' : ''}`}
                        />
                      </div>
                      {formDataTypeOpen === i && (() => {
                        const refEl = formDataTypeRefs.current.get(i);
                        const rect = refEl?.getBoundingClientRect();
                        return (
                        <div className="form-data-type-options animate-scale-in" onClick={(e) => e.stopPropagation()}
                          style={rect ? { top: rect.bottom + 4, left: rect.left } : undefined}
                        >
                          {FD_TYPES.map((t) => (
                            <button
                              key={t}
                              className={`form-data-type-opt ${currentType === t ? 'active' : ''}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                updateFormField(i, (f) => {
                                  if (t === 'File') {
                                    return { ...f, filename: f.filename ?? '', value: '' };
                                  } else {
                                    const { filename: _, ...rest } = f;
                                    return { ...rest, value: f.value || '' };
                                  }
                                });
                                setFormDataTypeOpen(null);
                              }}
                            >
                              <span>{t}</span>
                            </button>
                          ))}
                        </div>
                        );
                      })()}
                    </div>
                    {currentType === 'File' ? (
                      <button
                        className="form-data-file-btn"
                        onClick={() => {
                          vscode.postMessage({ type: 'selectFile', payload: { index: i } });
                        }}
                      >
                        {field.filename || '选择文件 / Select File'}
                      </button>
                    ) : (
                      <input
                        type="text"
                        className="form-data-value"
                        placeholder="Value"
                        value={field.value}
                        spellCheck={false}
                        onChange={(e) => {
                          updateFormField(i, (f) => ({ ...f, value: e.target.value }));
                        }}
                      />
                    )}
                    <button
                      className="icon-btn sm danger"
                      onClick={() => {
                        const f = rawFields.filter((_, idx) => idx !== i);
                        updateBody({ type: 'form-data', content: f } as any);
                      }}
                      title="删除 / Delete"
                    >
                      <Icon name="close" size={12} />
                    </button>
                  </div>
                );
              });
            })()}
          </div>
        </div>
      )}
      {bodyType === 'x-www-form-urlencoded' && request.body && (
        <div className="body-editor-wrap">
          <div className="body-editor-toolbar">
            <div className="body-content-type-hint">{BODY_TYPE_MAP[bodyType]?.contentType}</div>
            <div
              className={`raw-toggle ${urlEncodedRaw ? 'active' : ''}`}
              onClick={() => { setUrlEncodedRaw(!urlEncodedRaw); setUrlEncodedRawText(''); }}
            >
              <div className="raw-toggle-knob" />
              <span className="raw-toggle-label">Raw</span>
            </div>
          </div>
          {urlEncodedRaw ? (
            <div className="tab-panel animate-fade-in raw-editor-panel">
              <textarea
                className="code-editor raw-editor"
                value={urlEncodedRawText || String(request.body.content ?? '')}
                onChange={(e) => {
                  setUrlEncodedRawText(e.target.value);
                  updateBody({ type: 'x-www-form-urlencoded', content: e.target.value } as any);
                }}
                placeholder="key1=value1&key2=value2"
                spellCheck={false}
              />
            </div>
          ) : (
            <div className="tab-panel animate-fade-in">
              {renderKvEditor(
                (() => {
                  const raw = String(request.body.content ?? '');
                  const entries: [string, string][] = [];
                  raw.split('&').forEach((pair) => {
                    const [k, ...rest] = pair.split('=');
                    if (k) entries.push([k, rest.join('=')]);
                  });
                  if (entries.length === 0 || entries[entries.length - 1]![0] !== '') {
                    entries.push(['', '']);
                  }
                  return entries;
                })(),
                (key) => {
                  const raw = String(request.body!.content ?? '');
                  const pairs = raw.split('&').filter((p) => {
                    const [k] = p.split('=');
                    return k !== key;
                  });
                  updateBody({ type: 'x-www-form-urlencoded', content: pairs.join('&') } as any);
                },
                (i, k, v) => {
                  const raw = String(request.body!.content ?? '');
                  const pairs = raw.split('&').map((p) => {
                    const [pk, ...rest] = p.split('=');
                    return [pk, rest.join('=')] as [string, string];
                  });
                  if (i < pairs.length) {
                    pairs[i] = [k, v];
                  } else {
                    pairs.push([k, v]);
                  }
                  updateBody({ type: 'x-www-form-urlencoded', content: pairs.map(([a, b]) => `${a}=${b}`).join('&') } as any);
                },
                '键',
                '值',
                new Set(),
                () => {}
              )}
            </div>
          )}
        </div>
      )}
      {bodyType === 'graphql' && request.body && (
        <div className="body-editor-wrap">
          <div className="body-editor-toolbar">
            <div className="body-content-type-hint">{BODY_TYPE_MAP[bodyType]?.contentType}</div>
          </div>
          <div className="graphql-section">
            <textarea
              className="code-editor"
              value={String(request.body.content ?? '')}
              onChange={(e) => updateBody({ type: 'graphql', content: e.target.value } as any)}
              placeholder="输入 GraphQL 查询"
              spellCheck={false}
            />
            <div className="graphql-variables">
              <label>GraphQL Variables</label>
              <textarea
                className="code-editor"
                value={request.auth?.config.graphqlVariables ?? '{}'}
                onChange={(e) =>
                  onRequestChange({
                    ...request,
                    auth: {
                      ...request.auth!,
                      config: { ...request.auth!.config, graphqlVariables: e.target.value },
                    },
                  })
                }
                placeholder='{ "key": "value" }'
                spellCheck={false}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderScriptPanel = (
    title: string,
    value: string,
    onChange: (v: string) => void,
    snippets: { label: string; code: string; lang: string }[]
  ) => (
    <div className="script-panel">
      <div className="script-main">
        <textarea
          className="code-editor script-editor"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={`// ${title}`}
          spellCheck={false}
        />
      </div>
      <div className="script-sidebar">
        <div className="script-snippets-header">代码片段 / Snippets</div>
        <div className="script-snippets-list">
          {snippets.map((s, i) => (
            <button
              key={i}
              className="snippet-btn"
              onClick={() => {
                onChange(value ? value + '\n' + s.code : s.code);
                showToast('已插入代码片段');
              }}
              title={`${s.label} / Insert snippet`}
            >
              <span
                className="snippet-mini-icon"
                style={{ background: LANG_COLORS[s.lang] || '#569cd6' }}
              >
                {LANG_ICONS[s.lang] || s.lang.charAt(0).toUpperCase()}
              </span>
              <span>{s.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  const renderTestsTab = () => (
    <div className="tab-panel script-tab animate-fade-in">
      <div className="sub-tab-bar">
        <button
          className={`sub-tab ${testSubTab === 'tests' ? 'active' : ''}`}
          onClick={() => setTestSubTab('tests')}
          title="测试断言 / Test Assertions"
        >
          <Icon name="check" size={16} />
          Tests
        </button>
        <button
          className={`sub-tab ${testSubTab === 'scripting' ? 'active' : ''}`}
          onClick={() => setTestSubTab('scripting')}
          title="后置脚本 / Post-request Script"
        >
          <Icon name="code" size={16} />
          Scripting
        </button>
      </div>
      {testSubTab === 'tests' && (
        <div className="script-card animate-fade-in">
          <div className="script-help-banner">
            {
              '// 编写测试断言 / Write test assertions: pm.test("名称", () => pm.expect(res.status).to.equal(200));'
            }
          </div>
          {renderScriptPanel(
            '编写测试断言',
            request.postRequestScript ?? '',
            (v) => onRequestChange({ ...request, postRequestScript: v }),
            TEST_SNIPPETS
          )}
        </div>
      )}
      {testSubTab === 'scripting' && (
        <div className="script-card animate-fade-in">
          <div className="script-help-banner">
            {'// 可用 / Available: pm.response, pm.cookies, pm.environment, console.log()'}
          </div>
          {renderScriptPanel(
            '后置脚本',
            request.postRequestScript ?? '',
            (v) => onRequestChange({ ...request, postRequestScript: v }),
            TEST_SNIPPETS
          )}
        </div>
      )}
    </div>
  );

  const renderPreRunTab = () => (
    <div className="tab-panel script-tab animate-fade-in">
      <div className="sub-tab-bar">
        <button
          className={`sub-tab ${preSubTab === 'prerequest' ? 'active' : ''}`}
          onClick={() => setPreSubTab('prerequest')}
          title="前置请求 / Pre-request"
        >
          <Icon name="send" size={16} />
          Pre Requests
        </button>
        <button
          className={`sub-tab ${preSubTab === 'scripting' ? 'active' : ''}`}
          onClick={() => setPreSubTab('scripting')}
          title="前置脚本 / Pre-request Script"
        >
          <Icon name="code" size={16} />
          Scripting
        </button>
      </div>
      {preSubTab === 'prerequest' && (
        <div className="script-card animate-fade-in">
          <div className="script-help-banner">
            {
              '// 请求前执行 / Execute before request: pm.environment.set("key", "value"); pm.request.headers.add({...});'
            }
          </div>
          {renderScriptPanel(
            '前置请求脚本',
            request.preRequestScript ?? '',
            (v) => onRequestChange({ ...request, preRequestScript: v }),
            PREREQUEST_SNIPPETS
          )}
        </div>
      )}
      {preSubTab === 'scripting' && (
        <div className="script-card animate-fade-in">
          <div className="script-help-banner">
            {'// 可用 / Available: pm.environment, pm.variables, pm.request, console.log()'}
          </div>
          {renderScriptPanel(
            '前置脚本',
            request.preRequestScript ?? '',
            (v) => onRequestChange({ ...request, preRequestScript: v }),
            PREREQUEST_SNIPPETS
          )}
        </div>
      )}
    </div>
  );

  const renderResponseArea = () => {
    if (!response && !isLoading)
      return (
        <div className="response-empty">
          <Icon name="preview" size={56} color="var(--text-muted)" />
          <p className="response-empty-title">等待发送请求</p>
          <p className="response-empty-hint">按 Ctrl+Enter 发送请求 / Press Ctrl+Enter to send</p>
        </div>
      );
    if (isLoading)
      return (
        <div className="response-loading">
          <div className="loading-spinner" />
          <p>正在发送请求...</p>
        </div>
      );
    if (!response) return null;
    const sc = String(response.status).charAt(0);
    const statusColor = sc === '2' ? '#4ec9b0' : sc === '3' ? '#dcdcaa' : '#f14c4c';
    let formattedBody = response.body;
    try {
      formattedBody = JSON.stringify(JSON.parse(response.body), null, 2);
    } catch {
      /* not json */
    }
    const resHeaders = Object.entries(response.headers);
    const flatHeaders: Record<string, string> = response.headers;
    const perfGrade =
      response.time < 200
        ? 'A'
        : response.time < 500
          ? 'B'
          : response.time < 1000
            ? 'C'
            : response.time < 3000
              ? 'D'
              : 'F';
    const perfColor =
      perfGrade === 'A'
        ? '#4ec9b0'
        : perfGrade === 'B'
          ? '#569cd6'
          : perfGrade === 'C'
            ? '#dcdcaa'
            : perfGrade === 'D'
              ? '#ce9178'
              : '#f14c4c';

    return (
      <div className="response-content animate-fade-in">
        <div className="response-status-bar">
          <span
            className="status-badge"
            style={{ background: statusColor }}
            title={`状态码 / Status: ${response.status} ${response.statusText}`}
          >
            {response.status} {response.statusText}
          </span>
          <span
            className="meta-chip time-chip"
            title={`响应时间 / Response Time: ${response.time}ms`}
          >
            <Icon name="timer" size={14} /> {response.time} ms
          </span>
          <span
            className="meta-chip size-chip"
            title={`响应大小 / Response Size: ${response.size} B`}
          >
            <Icon name="doc" size={14} /> {response.size} B
          </span>
          <span
            className="meta-chip grade-chip"
            title={`性能评级 / Performance Grade: ${perfGrade}`}
            style={{ borderColor: perfColor + '40' }}
          >
            <span style={{ color: perfColor, fontWeight: 700 }}>{perfGrade}</span>
          </span>
          <span
            className="meta-chip reqtype-chip"
            title={`请求类型 / Request Type: ${requestClientType}`}
            onClick={() => setShowClientTypeDropdown(!showClientTypeDropdown)}
            style={{ cursor: 'pointer' }}
          >
            {requestClientType}
            {showClientTypeDropdown && (
              <div
                className="client-type-dropdown animate-scale-in"
                ref={clientTypeRef}
                onClick={(e) => e.stopPropagation()}
              >
                {REQUEST_CLIENT_TYPES.map((t) => (
                  <button
                    key={t}
                    className={`env-toolbar-opt ${requestClientType === t ? 'active' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setRequestClientType(t);
                      setShowClientTypeDropdown(false);
                    }}
                  >
                    {t}
                  </button>
                ))}
              </div>
            )}
          </span>
          {response.cookies && response.cookies.length > 0 && (
            <span
              className="meta-chip cookies-chip clickable"
              title={`Cookie 管理 / Cookie Manager: ${response.cookies.length}`}
              onClick={() => setShowCookieManager(true)}
            >
              <Icon name="cookie" size={14} /> {response.cookies.length} cookies
            </span>
          )}
          {flatHeaders['content-type'] && (
            <span
              className="meta-chip type-chip"
              title={`内容类型 / Content-Type: ${flatHeaders['content-type']}`}
            >
              {flatHeaders['content-type'].split(';')[0]}
            </span>
          )}
          {flatHeaders['server'] && (
            <span
              className="meta-chip server-chip"
              title={`服务器 / Server: ${flatHeaders['server']}`}
            >
              {flatHeaders['server']}
            </span>
          )}
          {error && (
            <span className="meta-chip error-chip" title={`错误 / Error: ${error}`}>
              {error}
            </span>
          )}
        </div>
        <div
          className="response-tabs-bar"
          ref={menuRef}
          onClick={() => {
            setShowSnippetMenu(false);
            setShowTypeMenu(false);
            setShowMoreMenu(false);
          }}
        >
          <div className="res-tabs-left" onClick={(e) => e.stopPropagation()}>
            {(['response', 'headers', 'cookies', 'results', 'docs'] as ResTab[]).map((tab) => (
              <button
                key={tab}
                className={`res-tab ${resTab === tab ? 'active' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setResTab(tab);
                }}
                title={`${RES_TAB_TITLES[tab].cn} / ${RES_TAB_TITLES[tab].en}`}
              >
                {RES_TAB_TITLES[tab].cn}
                {tab === 'headers' && resHeaders.length > 0 && (
                  <span className="tab-badge">{resHeaders.length}</span>
                )}
              </button>
            ))}
          </div>
          <div className="res-tabs-right" onClick={(e) => e.stopPropagation()}>
            <div className="snippet-wrapper">
              <button
                className="toolbar-icon-btn"
                title="代码片段 / Code Snippets"
                onClick={() => {
                  setShowSnippetMenu(!showSnippetMenu);
                  setShowTypeMenu(false);
                  setShowMoreMenu(false);
                  setSnippetCode('');
                  setSelectedSnippetLabel('');
                }}
              >
                <Icon name="code" size={18} />
              </button>
              {showSnippetMenu && (
                <div className="dropdown-menu wide animate-scale-in">
                  {snippetCode ? (
                    <div className="snippet-preview-area">
                      <div className="snippet-preview-header">
                        <span className="snippet-lang-badge">{selectedSnippetLabel}</span>
                        <button
                          className="toolbar-icon-btn sm"
                          onClick={() => {
                            setSnippetCode('');
                            setSelectedSnippetLabel('');
                          }}
                          title="返回 / Back"
                        >
                          <Icon name="close" size={14} />
                        </button>
                      </div>
                      <pre className="snippet-preview">{snippetCode}</pre>
                      <div className="snippet-preview-footer">
                        <button
                          className="btn-primary sm"
                          onClick={() => {
                            navigator.clipboard.writeText(snippetCode);
                            showToast('代码已复制');
                          }}
                        >
                          复制代码
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="snippet-search">
                        <input
                          type="text"
                          value={snippetFilter}
                          onChange={(e) => setSnippetFilter(e.target.value)}
                          placeholder="搜索代码片段 / Search snippets..."
                          spellCheck={false}
                        />
                      </div>
                      <div className="snippet-scroll-area">
                        {Array.from(
                          new Set(
                            CODE_SNIPPETS.filter(
                              (s) =>
                                !snippetFilter ||
                                s.label.toLowerCase().includes(snippetFilter.toLowerCase()) ||
                                s.category.toLowerCase().includes(snippetFilter.toLowerCase())
                            ).map((s) => s.category)
                          )
                        ).map((cat) => (
                          <div key={cat}>
                            <div className="snippet-category">{cat}</div>
                            {CODE_SNIPPETS.filter(
                              (s) =>
                                s.category === cat &&
                                (!snippetFilter ||
                                  s.label.toLowerCase().includes(snippetFilter.toLowerCase()) ||
                                  s.category.toLowerCase().includes(snippetFilter.toLowerCase()))
                            ).map((s) => (
                              <button
                                key={s.label}
                                className="dropdown-item snippet-item"
                                onClick={() => {
                                  setSnippetCode(generateSnippet(request, s.label));
                                  setSelectedSnippetLabel(s.label);
                                }}
                                title={`${s.label} (${s.lang})`}
                              >
                                <span
                                  className="snippet-lang-icon"
                                  style={{ background: LANG_COLORS[s.lang] || '#555' }}
                                >
                                  {LANG_ICONS[s.lang] || s.lang.charAt(0).toUpperCase()}
                                </span>
                                <span className="snippet-item-text">{s.label}</span>
                                <span className="snippet-lang-tag">{s.lang}</span>
                              </button>
                            ))}
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
            <div className="snippet-wrapper">
              <button
                className="toolbar-icon-btn"
                title="生成类型 / Type Generators"
                onClick={() => {
                  setShowTypeMenu(!showTypeMenu);
                  setShowSnippetMenu(false);
                  setShowMoreMenu(false);
                  setTypeCode('');
                  setSelectedTypeLabel('');
                }}
              >
                <Icon name="edit" size={18} />
              </button>
              {showTypeMenu && (
                <div className="dropdown-menu wide animate-scale-in">
                  {typeCode ? (
                    <div className="snippet-preview-area">
                      <div className="snippet-preview-header">
                        <span className="snippet-lang-badge">{selectedTypeLabel}</span>
                        <button
                          className="toolbar-icon-btn sm"
                          onClick={() => {
                            setTypeCode('');
                            setSelectedTypeLabel('');
                          }}
                          title="返回 / Back"
                        >
                          <Icon name="close" size={14} />
                        </button>
                      </div>
                      <pre className="snippet-preview">{typeCode}</pre>
                      <div className="snippet-preview-footer">
                        <button
                          className="btn-primary sm"
                          onClick={() => {
                            navigator.clipboard.writeText(typeCode);
                            showToast('类型代码已复制');
                          }}
                        >
                          复制代码
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="snippet-search">
                        <input
                          type="text"
                          value={typeFilter}
                          onChange={(e) => setTypeFilter(e.target.value)}
                          placeholder="搜索类型生成器 / Search generators..."
                          spellCheck={false}
                        />
                      </div>
                      <div className="snippet-scroll-area">
                        {TYPE_GENERATORS.filter(
                          (t) =>
                            !typeFilter || t.label.toLowerCase().includes(typeFilter.toLowerCase())
                        ).map((t) => (
                          <button
                            key={t.key}
                            className="dropdown-item snippet-item"
                            onClick={() => {
                              setTypeCode(generateTypes(response, request.name, t.key));
                              setSelectedTypeLabel(t.label);
                            }}
                            title={`${t.label} 类型生成 / Generate ${t.label}`}
                          >
                            <span
                              className="snippet-lang-icon"
                              style={{ background: LANG_COLORS[t.lang] || '#555' }}
                            >
                              {LANG_ICONS[t.lang] || t.label.charAt(0)}
                            </span>
                            <span className="snippet-item-text">{t.label}</span>
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
            <div className="snippet-wrapper">
              <button
                className="toolbar-icon-btn"
                onClick={() => {
                  setShowMoreMenu(!showMoreMenu);
                  setShowSnippetMenu(false);
                  setShowTypeMenu(false);
                }}
                title="更多 / More"
              >
                <Icon name="more" size={18} />
              </button>
              {showMoreMenu && (
                <div className="dropdown-menu animate-scale-in">
                  <div className="dropdown-divider" />
                  <button
                    className="dropdown-item"
                    onClick={() => {
                      const blob = new Blob([formattedBody], { type: 'application/json' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = 'response.json';
                      a.click();
                      URL.revokeObjectURL(url);
                      showToast('已保存到文件');
                      setShowMoreMenu(false);
                    }}
                    title="保存到文件 / Save to file"
                  >
                    <Icon name="download" size={14} />
                    保存到文件
                  </button>
                  <button
                    className="dropdown-item"
                    onClick={() => {
                      vscode.postMessage({
                        type: 'openInEditor',
                        payload: { content: formattedBody, language: 'json' },
                      });
                      showToast('正在编辑器中打开...');
                      setShowMoreMenu(false);
                    }}
                    title="在编辑器中打开 / Open in editor"
                  >
                    <Icon name="edit" size={14} />
                    在编辑器中打开
                  </button>
                  <div className="dropdown-divider" />
                  <button
                    className="dropdown-item"
                    onClick={() => {
                      setAllCollapsed(!allCollapsed);
                      showToast(allCollapsed ? '已展开全部' : '已折叠全部');
                      setShowMoreMenu(false);
                    }}
                    title={allCollapsed ? '展开全部 / Expand All' : '折叠全部 / Collapse All'}
                  >
                    <Icon name={allCollapsed ? 'indent-right' : 'indent-left'} size={14} />
                    {allCollapsed ? '展开全部' : '折叠全部'}
                  </button>
                  <button
                    className="dropdown-item"
                    onClick={() => {
                      setBracketPair(!bracketPair);
                      showToast(`括号匹配: ${!bracketPair ? '开' : '关'}`);
                      setShowMoreMenu(false);
                    }}
                    title={`括号匹配 / Bracket Pair: ${bracketPair ? 'On' : 'Off'}`}
                  >
                    <Icon name="code-brackets" size={14} />
                    括号匹配: {bracketPair ? '开' : '关'}
                  </button>
                  <button
                    className="dropdown-item"
                    onClick={() => {
                      setWordWrap(!wordWrap);
                      showToast(`自动换行: ${!wordWrap ? '开' : '关'}`);
                      setShowMoreMenu(false);
                    }}
                    title={`自动换行 / Word Wrap: ${wordWrap ? 'On' : 'Off'}`}
                  >
                    <Icon name={wordWrap ? 'wrap-on' : 'wrap-off'} size={14} />
                    自动换行: {wordWrap ? '开' : '关'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="response-tab-content">
          {resTab === 'response' && viewMode === 'response' && (
            <div className="response-body-panel animate-fade-in">
              <div className="response-body-code-wrap">
                <div className="response-body-hover-bar">
                  <button
                    className="toolbar-icon-btn sm"
                    onClick={() => {
                      navigator.clipboard.writeText(formattedBody);
                      showToast('已复制');
                    }}
                    title="复制 / Copy"
                  >
                    <Icon name="copy" size={16} />
                  </button>
                  <button
                    className={`toolbar-icon-btn sm ${bracketPair ? 'active' : ''}`}
                    onClick={() => setBracketPair(!bracketPair)}
                    title={
                      bracketPair
                        ? '括号匹配: 开 / Bracket Pair: On'
                        : '括号匹配: 关 / Bracket Pair: Off'
                    }
                  >
                    <Icon name="code-brackets" size={16} />
                  </button>
                  <div className="raw-toggle-wrap" title="原始格式 / Raw format">
                    <span className="raw-toggle-label">Raw</span>
                    <div
                      className={`raw-toggle ${resBodyRaw ? 'active' : ''}`}
                      onClick={() => setResBodyRaw(!resBodyRaw)}
                    >
                      <div className="raw-toggle-knob" />
                    </div>
                  </div>
                </div>
                {resBodyRaw ? (
                  <pre className={`response-body-code ${wordWrap ? 'wrap' : 'nowrap'}`}>
                    {response.body}
                  </pre>
                ) : (
                  (() => {
                    try {
                      const obj = JSON.parse(response.body);
                      return (
                        <JsonViewer
                          data={obj}
                          wordWrap={wordWrap}
                          allCollapsed={allCollapsed}
                          bracketPair={bracketPair}
                        />
                      );
                    } catch {
                      return <pre className="response-body-code">{formattedBody}</pre>;
                    }
                  })()
                )}
              </div>
            </div>
          )}
          {resTab === 'response' && viewMode === 'chart' && (
            <div className="response-chart-view animate-fade-in">
              <div className="chart-timeline chart-card-animate" style={{ animationDelay: '0ms' }}>
                <div className="chart-timeline-title">请求时间线 / Timeline</div>
                <div className="chart-timeline-bar">
                  <div
                    className="chart-timeline-segment"
                    style={{ width: '30%', background: '#4ec9b0' }}
                    title="DNS 解析"
                  />
                  <div
                    className="chart-timeline-segment"
                    style={{ width: '20%', background: '#dcdcaa' }}
                    title="TCP 连接"
                  />
                  <div
                    className="chart-timeline-segment"
                    style={{ width: '25%', background: '#569cd6' }}
                    title="服务处理"
                  />
                  <div
                    className="chart-timeline-segment"
                    style={{ width: '25%', background: '#c586c0' }}
                    title="内容传输"
                  />
                </div>
                <div className="chart-timeline-legend">
                  <span className="chart-legend-item">
                    <span className="chart-legend-dot" style={{ background: '#4ec9b0' }} />
                    DNS
                  </span>
                  <span className="chart-legend-item">
                    <span className="chart-legend-dot" style={{ background: '#dcdcaa' }} />
                    TCP
                  </span>
                  <span className="chart-legend-item">
                    <span className="chart-legend-dot" style={{ background: '#569cd6' }} />
                    Server
                  </span>
                  <span className="chart-legend-item">
                    <span className="chart-legend-dot" style={{ background: '#c586c0' }} />
                    Transfer
                  </span>
                </div>
              </div>
              <div className="chart-grid">
                <div
                  className="chart-card chart-card-animate"
                  style={{ borderLeft: `3px solid ${statusColor}`, animationDelay: '80ms' }}
                >
                  <div className="chart-status-display">
                    <div className="chart-status-number" style={{ color: statusColor }}>
                      {response.status}
                    </div>
                    <div className="chart-status-text" style={{ color: statusColor }}>
                      {response.statusText}
                    </div>
                  </div>
                  <div className="chart-card-title">状态码 / Status</div>
                </div>
                <div
                  className="chart-card chart-card-animate"
                  style={{ borderLeft: `3px solid ${perfColor}`, animationDelay: '160ms' }}
                >
                  <div
                    className="chart-grade"
                    style={{ color: perfColor, borderColor: perfColor + '40' }}
                  >
                    {perfGrade}
                  </div>
                  <div className="chart-card-title">性能评级 / Grade</div>
                  <div className="chart-card-sub">
                    {response.time < 200
                      ? '优秀'
                      : response.time < 500
                        ? '良好'
                        : response.time < 1000
                          ? '一般'
                          : response.time < 3000
                            ? '较慢'
                            : '很慢'}
                  </div>
                </div>
                <div
                  className="chart-card chart-card-animate"
                  style={{ borderLeft: '3px solid var(--method-get)', animationDelay: '240ms' }}
                >
                  <div className="chart-stat-big" style={{ color: 'var(--method-get)' }}>
                    {response.time}
                    <span className="chart-stat-unit">ms</span>
                  </div>
                  <div className="chart-card-title">响应时间 / Time</div>
                  <div className="chart-bar-mini">
                    <div
                      className="chart-bar-mini-fill chart-bar-animate"
                      style={{
                        width: `${Math.min(100, (response.time / 5000) * 100)}%`,
                        background: 'var(--method-get)',
                      }}
                    />
                  </div>
                </div>
                <div
                  className="chart-card chart-card-animate"
                  style={{ borderLeft: '3px solid var(--method-put)', animationDelay: '320ms' }}
                >
                  <div className="chart-stat-big" style={{ color: 'var(--method-put)' }}>
                    {response.size < 1024 ? response.size : (response.size / 1024).toFixed(1)}
                    <span className="chart-stat-unit">{response.size < 1024 ? 'B' : 'KB'}</span>
                  </div>
                  <div className="chart-card-title">数据大小 / Size</div>
                  <div className="chart-bar-mini">
                    <div
                      className="chart-bar-mini-fill chart-bar-animate"
                      style={{
                        width: `${Math.min(100, (response.size / 102400) * 100)}%`,
                        background: 'var(--method-put)',
                      }}
                    />
                  </div>
                </div>
              </div>
              <div className="chart-details chart-card-animate" style={{ animationDelay: '400ms' }}>
                <div className="chart-detail-row">
                  <span className="chart-detail-label">请求方法 / Method</span>
                  <span
                    className="chart-detail-value"
                    style={{ color: METHOD_RAW_COLORS[request.method] }}
                  >
                    {request.method}
                  </span>
                </div>
                <div className="chart-detail-row">
                  <span className="chart-detail-label">请求类型 / Client</span>
                  <span className="chart-detail-value">{requestClientType}</span>
                </div>
                <div className="chart-detail-row">
                  <span className="chart-detail-label">响应头数 / Headers</span>
                  <span className="chart-detail-value">{resHeaders.length}</span>
                </div>
                <div className="chart-detail-row">
                  <span className="chart-detail-label">Cookie 数 / Cookies</span>
                  <span className="chart-detail-value">{(response.cookies ?? []).length}</span>
                </div>
                <div className="chart-detail-row">
                  <span className="chart-detail-label">内容类型 / Content-Type</span>
                  <span className="chart-detail-value">
                    {response.headers['content-type']?.split(';')[0] ?? '未知'}
                  </span>
                </div>
                <div className="chart-detail-row">
                  <span className="chart-detail-label">服务器 / Server</span>
                  <span className="chart-detail-value">{response.headers['server'] ?? '未知'}</span>
                </div>
              </div>
            </div>
          )}
          {resTab === 'headers' && (
            <div className="response-headers-panel animate-fade-in">
              <div className="res-headers-toolbar">
                <div className="raw-toggle-wrap" title="原始格式 / Raw format">
                  <span className="raw-toggle-label">Raw</span>
                  <div
                    className={`raw-toggle ${resHeadersRaw ? 'active' : ''}`}
                    onClick={() => setResHeadersRaw(!resHeadersRaw)}
                  >
                    <div className="raw-toggle-knob" />
                  </div>
                </div>
              </div>
              {resHeadersRaw ? (
                <pre className="response-body-code wrap">
                  {resHeaders.map(([k, v]) => `${k}: ${v}`).join('\n')}
                </pre>
              ) : (
                resHeaders.map(([key, value]) => (
                  <div key={key} className="resp-header-row">
                    <span className="resp-header-key">{key}</span>
                    <span className="resp-header-value">{value}</span>
                  </div>
                ))
              )}
              {resHeaders.length === 0 && <div className="empty-hint">暂无响应头 / No headers</div>}
            </div>
          )}
          {resTab === 'cookies' && (
            <div className="response-headers-panel animate-fade-in">
              <div className="cookie-tab-toolbar">
                <button
                  className="btn-secondary sm"
                  onClick={() => {
                    vscode.postMessage({ type: 'viewCookies' });
                  }}
                  title="Cookie 管理 / Cookie Manager"
                >
                  <Icon name="cookie" size={14} />
                  Cookie管理
                </button>
              </div>
              {(response.cookies ?? []).length === 0 && (
                <div className="empty-hint">暂无 Cookie / No cookies</div>
              )}
              {(response.cookies ?? []).map((cookie: any, index: number) => (
                <div key={index} className="resp-header-row">
                  <span className="resp-header-key">{cookie.name}</span>
                  <span className="resp-header-value">{cookie.value}</span>
                </div>
              ))}
            </div>
          )}
          {resTab === 'results' && (
            <div className="empty-hint animate-fade-in">
              运行测试后，结果将显示在这里 / Results will appear after running tests
            </div>
          )}
          {resTab === 'docs' && (
            <div className="empty-hint animate-fade-in">
              API 文档将显示在这里 / API docs will appear here
            </div>
          )}
        </div>
        {resTab === 'response' && (
          <div className="response-footer">
            <div className="view-toggle">
              <button
                className={`view-toggle-btn ${viewMode === 'response' ? 'active' : ''}`}
                onClick={() => setViewMode('response')}
                title="响应 / Response"
              >
                响应
              </button>
              <button
                className={`view-toggle-btn ${viewMode === 'chart' ? 'active' : ''}`}
                onClick={() => setViewMode('chart')}
                title="图表 / Chart"
              >
                图表
              </button>
            </div>
            <button
              className="toolbar-icon-btn"
              onClick={() => {
                setIsMaximized(!isMaximized);
                showToast(isMaximized ? '已还原' : '已最大化');
              }}
              title={isMaximized ? '还原 / Restore' : '最大化 / Maximize'}
            >
              <Icon name={isMaximized ? 'switch' : 'full-screen'} size={18} />
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      className={`editor-view ${isMaximized ? 'maximized' : ''}`}
      onKeyDown={(e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
          e.preventDefault();
          handleSend();
        }
      }}
    >
      <div className="editor-toolbar">
        <div className="url-bar">
          <div
            className="method-selector"
            ref={methodRef}
            onClick={(e) => {
              e.stopPropagation();
              setShowMethodDropdown(!showMethodDropdown);
            }}
            style={{ color: METHOD_RAW_COLORS[request.method] }}
            title={`请求方法 / Method: ${request.method}`}
          >
            <span className="method-text">{request.method}</span>
            <Icon
              name="arrow-down"
              size={14}
              color={METHOD_RAW_COLORS[request.method]}
              className={`dropdown-arrow ${showMethodDropdown ? 'rotated' : ''}`}
            />
            {showMethodDropdown && (
              <div
                className="method-dropdown animate-scale-in"
                onClick={(e) => e.stopPropagation()}
              >
                {METHODS.map((m) => (
                  <button
                    key={m}
                    className={`method-option ${request.method === m ? 'active' : ''}`}
                    style={{ color: METHOD_RAW_COLORS[m] }}
                    onClick={(e) => {
                      e.stopPropagation();
                      updateField('method', m);
                      setShowMethodDropdown(false);
                    }}
                    title={`${m} 方法 / ${m} Method`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            )}
          </div>
          <input
            className="url-input"
            type="text"
            value={request.url}
            onChange={(e) => updateField('url', e.target.value)}
            placeholder="输入请求 URL / Enter request URL"
            spellCheck={false}
            title="请求 URL / Request URL"
          />
          <div className="url-encode-actions">
            <button
              className={`url-encode-btn ${(() => {
                try {
                  const d = decodeURIComponent(request.url);
                  return d !== request.url ? 'encoded' : '';
                } catch {
                  return 'encoded';
                }
              })()}`}
              onClick={() => {
                try {
                  const decoded = decodeURIComponent(request.url);
                  if (decoded !== request.url) {
                    updateField('url', decoded);
                    showToast('URL 已解码');
                  } else {
                    updateField('url', encodeURIComponent(request.url));
                    showToast('URL 已编码');
                  }
                } catch {
                  try {
                    updateField('url', decodeURIComponent(request.url));
                    showToast('URL 已解码');
                  } catch {
                    showToast('操作失败');
                  }
                }
              }}
              title={(() => {
                try {
                  const d = decodeURIComponent(request.url);
                  return d !== request.url ? '解码 URL / Decode URL' : '编码 URL / Encode URL';
                } catch {
                  return '编码 URL / Encode URL';
                }
              })()}
            >
              <Icon
                name={(() => {
                  try {
                    const d = decodeURIComponent(request.url);
                    return d !== request.url ? 'unlock' : 'lock';
                  } catch {
                    return 'lock';
                  }
                })()}
                size={14}
              />
            </button>
          </div>
          <button
            className={`send-btn ${isLoading ? 'loading' : ''}`}
            onClick={handleSend}
            disabled={isLoading}
            title="发送请求 / Send request"
          >
            {isLoading ? (
              <>
                <div className="btn-spinner" />
                <span>发送中</span>
              </>
            ) : (
              <>
                <Icon name="send" size={18} />
                <span>发送</span>
              </>
            )}
          </button>
        </div>
        <div className="toolbar-actions">
          {environments.length > 0 && (
            <div className="env-toolbar-dropdown" ref={envToolbarRef}>
              <div
                className="env-toolbar-selector"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowEnvToolbarDropdown(!showEnvToolbarDropdown);
                }}
                title="切换环境 / Switch environment"
              >
                <span>
                  {(activeEnvironmentId
                    ? environments.find((e) => e.id === activeEnvironmentId)?.name
                    : null) ??
                    environments[0]?.name ??
                    ''}
                </span>
                <Icon
                  name="arrow-down"
                  size={14}
                  color="var(--text-muted)"
                  className={`env-arrow ${showEnvToolbarDropdown ? 'rotated' : ''}`}
                />
              </div>
              {showEnvToolbarDropdown && (
                <div
                  className="env-toolbar-options animate-scale-in"
                  onClick={(e) => e.stopPropagation()}
                >
                  {environments.map((env) => (
                    <button
                      key={env.id}
                      className={`env-toolbar-opt ${(activeEnvironmentId ?? environments[0]?.id) === env.id ? 'active' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSwitchEnvironment(env.id);
                        setShowEnvToolbarDropdown(false);
                      }}
                      title={`环境: ${env.name}`}
                    >
                      <span>{env.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <button
            className="toolbar-icon-btn"
            onClick={() => setShowCurlDialog(true)}
            title="导入 cURL / Import cURL"
          >
            <Icon name="link" size={18} />
          </button>
          <button
            className="toolbar-icon-btn"
            onClick={() => {
              setSelectedCollectionId(collections.length > 0 ? collections[0]!.id : '');
              setShowSaveDialog(true);
            }}
            title="保存到集合 / Save to collection"
          >
            <Icon name="save" size={18} />
          </button>
          <button
            className="toolbar-icon-btn"
            onClick={() => setLayout(layout === 'horizontal' ? 'vertical' : 'horizontal')}
            title={
              layout === 'horizontal'
                ? '切换上下布局 / Switch to vertical'
                : '切换左右布局 / Switch to horizontal'
            }
          >
            <Icon name={layout === 'horizontal' ? 'indent-right' : 'indent-left'} size={18} />
          </button>
        </div>
      </div>
      {showSaveDialog && (
        <div className="save-dialog-overlay" onClick={() => setShowSaveDialog(false)}>
          <div className="curl-dialog-content" onClick={(e) => e.stopPropagation()}>
            <div className="curl-dialog-header">
              <span className="curl-dialog-title">保存到集合</span>
              <button
                className="toolbar-icon-btn sm"
                onClick={() => setShowSaveDialog(false)}
                title="关闭 / Close"
              >
                <Icon name="close" size={16} />
              </button>
            </div>
            <div className="curl-dialog-body">
              <p className="curl-dialog-desc">选择一个集合来保存当前请求</p>
              {collections.length > 0 ? (
                <div className="save-collection-dropdown" ref={saveDropdownRef}>
                  <div
                    className="save-collection-selector"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!showSaveDropdown) {
                        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                        setSaveDropdownPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
                      }
                      setShowSaveDropdown(!showSaveDropdown);
                    }}
                  >
                    <span className="save-collection-text">
                      {selectedCollectionId
                        ? (collections.find((c) => c.id === selectedCollectionId)?.name ??
                          '选择集合')
                        : '选择集合'}
                    </span>
                    <Icon name="arrow-down" size={14} color="var(--text-muted)" />
                  </div>
                  {showSaveDropdown && (
                    <div
                      className="save-collection-options animate-scale-in"
                      style={{ position: 'fixed', top: saveDropdownPos.top, left: saveDropdownPos.left, width: saveDropdownPos.width }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {collections.map((c) => (
                        <button
                          key={c.id}
                          className={`save-collection-option ${selectedCollectionId === c.id ? 'active' : ''}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedCollectionId(c.id);
                            setShowSaveDropdown(false);
                          }}
                        >
                          <span>{c.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="save-dialog-empty">暂无集合，请先创建集合</div>
              )}
            </div>
            <div className="curl-dialog-footer">
              <div />
              <div className="curl-dialog-footer-right">
                <button className="btn-secondary sm" onClick={() => setShowSaveDialog(false)}>
                  取消
                </button>
                <button
                  className="btn-primary sm"
                  onClick={handleSave}
                  disabled={!selectedCollectionId || collections.length === 0}
                >
                  保存
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showCurlDialog && (
        <div className="save-dialog-overlay" onClick={() => setShowCurlDialog(false)}>
          <div className="curl-dialog-content" onClick={(e) => e.stopPropagation()}>
            <div className="curl-dialog-header">
              <span className="curl-dialog-title">导入 cURL</span>
              <div className="curl-dialog-header-right">
                <div className="raw-toggle-wrap" title="原始格式 / Raw format">
                  <span className="raw-toggle-label">Raw</span>
                  <div
                    className={`raw-toggle ${curlRaw ? 'active' : ''}`}
                    onClick={() => setCurlRaw(!curlRaw)}
                  >
                    <div className="raw-toggle-knob" />
                  </div>
                </div>
                <button
                  className="toolbar-icon-btn sm"
                  onClick={() => {
                    setShowCurlDialog(false);
                    setCurlText('');
                  }}
                  title="关闭 / Close"
                >
                  <Icon name="close" size={16} />
                </button>
              </div>
            </div>
            <div className="curl-dialog-body">
              <p className="curl-dialog-desc">{curlRaw ? '直接输入 URL 地址，将以 GET 请求导入' : '粘贴 cURL 命令以导入请求，支持 curl、wget 等格式'}</p>
              <div className="curl-textarea-wrap">
                <textarea
                  className="curl-input"
                  value={curlText}
                  onChange={(e) => setCurlText(e.target.value)}
                  placeholder={curlRaw ? 'https://api.example.com/users' : `curl --location 'https://api.example.com/users' \\
--header 'Authorization: Bearer token' \\
--header 'Content-Type: application/json' \\
--data '{
    "name": "test",
    "email": "test@example.com"
}'`}
                  spellCheck={false}
                  autoFocus
                />
              </div>
            </div>
            <div className="curl-dialog-footer">
              <button
                className="btn-secondary sm"
                onClick={() => {
                  navigator.clipboard
                    .readText()
                    .then((text) => {
                      setCurlText(text);
                      showToast('已从剪贴板粘贴');
                    })
                    .catch(() => showToast('无法读取剪贴板'));
                }}
                title="从剪贴板粘贴 / Paste from clipboard"
              >
                <Icon name="copy" size={14} />
                粘贴
              </button>
              <div className="curl-dialog-footer-right">
                <button
                  className="btn-secondary sm"
                  onClick={() => {
                    setShowCurlDialog(false);
                    setCurlText('');
                  }}
                >
                  取消
                </button>
                <button
                  className="btn-primary sm"
                  onClick={() => {
                    if (!curlText.trim()) {
                      showToast('请输入 cURL 命令');
                      return;
                    }
                    vscode.postMessage({ type: 'importCurl', payload: { curl: curlText, raw: curlRaw } });
                    setShowCurlDialog(false);
                    setCurlText('');
                    showToast('正在导入 cURL...');
                  }}
                  disabled={!curlText.trim()}
                >
                  导入
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      <div
        className={`editor-content ${layout} ${isMaximized ? 'maximized-response' : ''}`}
        ref={containerRef}
      >
        <div
          className={`request-pane ${isMaximized ? 'pane-hidden' : ''}`}
          style={layout === 'horizontal' ? { width: `${splitPos}%` } : { height: `${splitPos}%` }}
        >
          <div className="request-tabs">
            {(['query', 'headers', 'auth', 'body', 'tests', 'pre-run'] as ReqTab[]).map((tab) => (
              <button
                key={tab}
                className={`req-tab ${reqTab === tab ? 'active' : ''}`}
                onClick={() => setReqTab(tab)}
                title={`${REQ_TAB_TITLES[tab].cn} / ${REQ_TAB_TITLES[tab].en}`}
              >
                {REQ_TAB_TITLES[tab].cn}
                {tab === 'query' && queryEntries.length > 0 && (
                  <span className="tab-badge">{queryEntries.length}</span>
                )}
                {tab === 'headers' && headerEntries.length > 0 && (
                  <span className="tab-badge">{headerEntries.length}</span>
                )}
              </button>
            ))}
          </div>
          <div className="request-tab-content">
            {reqTab === 'query' && (
              <div className="content-raw-bar">
                <div className="raw-toggle-wrap" title="原始格式 / Raw format">
                  <span className="raw-toggle-label">Raw</span>
                  <div
                    className={`raw-toggle ${queryRaw ? 'active' : ''}`}
                    onClick={() => { setQueryRaw(!queryRaw); setQueryRawText(''); }}
                  >
                    <div className="raw-toggle-knob" />
                  </div>
                </div>
              </div>
            )}
            {reqTab === 'headers' && (
              <div className="content-raw-bar">
                <div className="raw-toggle-wrap" title="原始格式 / Raw format">
                  <span className="raw-toggle-label">Raw</span>
                  <div
                    className={`raw-toggle ${headersRaw ? 'active' : ''}`}
                    onClick={() => { setHeadersRaw(!headersRaw); setHeadersRawText(''); }}
                  >
                    <div className="raw-toggle-knob" />
                  </div>
                </div>
              </div>
            )}
            {reqTab === 'query' && renderQueryTab()}
            {reqTab === 'headers' && renderHeadersTab()}
            {reqTab === 'auth' && renderAuthTab()}
            {reqTab === 'body' && renderBodyTab()}
            {reqTab === 'tests' && renderTestsTab()}
            {reqTab === 'pre-run' && renderPreRunTab()}
          </div>
        </div>
        <div className={`splitter-wrapper ${isMaximized ? 'pane-hidden' : ''}`}>
          <div className={`splitter ${layout}`} onMouseDown={onDragStart} />
          {layout === 'horizontal' && (
            <>
              <button
                className="splitter-arrow splitter-arrow-left"
                onClick={(e) => {
                  e.stopPropagation();
                  splitPos <= 5 || splitPos >= 95 ? animateSplitTo(50) : animateSplitTo(0);
                }}
                title={
                  splitPos <= 5 || splitPos >= 95 ? '还原 / Restore' : '展开响应 / Expand response'
                }
              >
                <svg width="12" height="20" viewBox="0 0 12 20">
                  <path
                    d="M9 2L3 10L9 18"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
              <button
                className="splitter-arrow splitter-arrow-right"
                onClick={(e) => {
                  e.stopPropagation();
                  splitPos <= 5 || splitPos >= 95 ? animateSplitTo(50) : animateSplitTo(100);
                }}
                title={
                  splitPos <= 5 || splitPos >= 95 ? '还原 / Restore' : '展开请求 / Expand request'
                }
              >
                <svg width="12" height="20" viewBox="0 0 12 20">
                  <path
                    d="M3 2L9 10L3 18"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </>
          )}
          {layout === 'vertical' && (
            <>
              <button
                className="splitter-arrow splitter-arrow-up"
                onClick={(e) => {
                  e.stopPropagation();
                  splitPos <= 5 || splitPos >= 95 ? animateSplitTo(50) : animateSplitTo(0);
                }}
                title={
                  splitPos <= 5 || splitPos >= 95 ? '还原 / Restore' : '展开响应 / Expand response'
                }
              >
                <svg width="20" height="12" viewBox="0 0 20 12">
                  <path
                    d="M2 9L10 3L18 9"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
              <button
                className="splitter-arrow splitter-arrow-down"
                onClick={(e) => {
                  e.stopPropagation();
                  splitPos <= 5 || splitPos >= 95 ? animateSplitTo(50) : animateSplitTo(100);
                }}
                title={
                  splitPos <= 5 || splitPos >= 95 ? '还原 / Restore' : '展开请求 / Expand request'
                }
              >
                <svg width="20" height="12" viewBox="0 0 20 12">
                  <path
                    d="M2 3L10 9L18 3"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </>
          )}
        </div>
        <div
          className="response-pane"
          style={
            isMaximized
              ? { width: '100%', height: '100%' }
              : layout === 'horizontal'
                ? { width: `${100 - splitPos}%` }
                : { height: `${100 - splitPos}%` }
          }
        >
          <div className="response-body-container">{renderResponseArea()}</div>
        </div>
      </div>
      {showCookieManager && (
        <div className="cookie-manager-overlay" onClick={() => setShowCookieManager(false)}>
          <div className="cookie-manager-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="cookie-manager-header">
              <span className="cookie-manager-title">
                <Icon name="cookie" size={16} /> Cookie 管理
              </span>
              <button
                className="toolbar-icon-btn sm"
                onClick={() => setShowCookieManager(false)}
                title="关闭 / Close"
              >
                <Icon name="close" size={16} />
              </button>
            </div>
            <div className="cookie-manager-toolbar">
              <div className="cookie-search-wrap">
                <Icon name="search" size={14} color="var(--text-muted)" />
                <input
                  type="text"
                  className="cookie-search-input"
                  placeholder="搜索 Cookie / Search cookies..."
                  value={cookieFilter}
                  onChange={(e) => setCookieFilter(e.target.value)}
                  spellCheck={false}
                />
              </div>
              <button
                className="btn-secondary sm danger"
                onClick={() => {
                  vscode.postMessage({ type: 'clearCookies' });
                  showToast('已清除所有 Cookie');
                }}
                title="清除所有 Cookie / Clear all cookies"
              >
                <Icon name="delete" size={14} /> 全部清除
              </button>
            </div>
            <div className="cookie-manager-list">
              {(() => {
                const allCookies = response?.cookies ?? [];
                const filtered = cookieFilter
                  ? allCookies.filter(
                      (c: any) =>
                        (c.name ?? '').toLowerCase().includes(cookieFilter.toLowerCase()) ||
                        (c.value ?? '').toLowerCase().includes(cookieFilter.toLowerCase()) ||
                        (c.domain ?? '').toLowerCase().includes(cookieFilter.toLowerCase())
                    )
                  : allCookies;
                if (filtered.length === 0) {
                  return (
                    <div className="empty-hint">{cookieFilter ? '无匹配结果' : '暂无 Cookie'}</div>
                  );
                }
                return filtered.map((cookie: any, index: number) => (
                  <div key={index} className="cookie-item">
                    <div className="cookie-item-main">
                      <span className="cookie-item-name">{cookie.name}</span>
                      <span className="cookie-item-value">{cookie.value}</span>
                    </div>
                    {(cookie.domain || cookie.path || cookie.expires) && (
                      <div className="cookie-item-meta">
                        {cookie.domain && (
                          <span className="cookie-meta-tag">域: {cookie.domain}</span>
                        )}
                        {cookie.path && (
                          <span className="cookie-meta-tag">路径: {cookie.path}</span>
                        )}
                        {cookie.expires && (
                          <span className="cookie-meta-tag">过期: {cookie.expires}</span>
                        )}
                        {cookie.httpOnly && <span className="cookie-meta-tag">HttpOnly</span>}
                        {cookie.secure && <span className="cookie-meta-tag">Secure</span>}
                      </div>
                    )}
                    <button
                      className="icon-btn sm danger"
                      onClick={() => {
                        vscode.postMessage({
                          type: 'deleteCookie',
                          payload: { name: cookie.name, domain: cookie.domain },
                        });
                        showToast(`已删除 Cookie: ${cookie.name}`);
                      }}
                      title={`删除 / Delete: ${cookie.name}`}
                    >
                      <Icon name="delete" size={12} />
                    </button>
                  </div>
                ));
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

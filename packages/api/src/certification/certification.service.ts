import { Injectable, Logger } from '@nestjs/common';
import { readFile } from 'fs/promises';
import axios from 'axios';
import * as path from 'path';

type AssertResult = { expr: string; pass: boolean; message?: string };

@Injectable()
export class CertificationService {
  private readonly logger = new Logger(CertificationService.name);

  // Resolve script path: allow absolute, or relative to repo root
  private resolveScriptPath(p: string) {
    if (path.isAbsolute(p)) return p;
    const cwd = process.cwd();
    const candidate = path.join(cwd, p);
    return candidate;
  }

  // Robust block extractor: finds the first occurrence of blockName followed by '{' and
  // returns the contents between the matching braces (handles nested braces and varied formatting).
  private extractBlock(content: string, blockName: string) {
    const idx = content.indexOf(blockName);
    if (idx === -1) return null;

    // find the opening brace after blockName
    const braceOpen = content.indexOf('{', idx);
    if (braceOpen === -1) return null;

    let depth = 0;
    let i = braceOpen;
    for (; i < content.length; i++) {
      const ch = content[i];
      if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) break;
      }
    }

    if (i >= content.length) return null;

    // return text between the first opening brace and the matching closing brace
    const inner = content.substring(braceOpen + 1, i);
    return inner.trim();
  }

  // Parse params:query block into mapping of placeholder -> key
  private parseParamsBlock(content: string): Record<string, string> {
    const block = this.extractBlock(content, 'params:query');
    const map: Record<string, string> = {};
    if (!block) return map;
    const lines = block.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    for (const line of lines) {
      // expect form: key: [ENTER SOMETHING]
      const m = line.match(/^([^:]+):\s*(.+)$/);
      if (!m) continue;
      const key = m[1].trim();
      const value = m[2].trim();
      // store mapping from exact placeholder token to param key
      map[value] = key;
    }
    return map;
  }

  // Replace placeholders using explicit mapping (placeholder token -> param key)
  private replacePlaceholdersWithMap(s: string, mapping: Record<string,string>, params?: Record<string, string | number>) {
    let out = s;
    if (mapping && params) {
      for (const [placeholder, key] of Object.entries(mapping)) {
        if (!Object.prototype.hasOwnProperty.call(params, key)) continue;
        const val = String(params[key]);
        // replace exact placeholder occurrences like [ENTER ...]
        out = out.split(placeholder).join(val);
        // replace mustache-style {{key}}
        out = out.split(`{{${key}}}`).join(val);
        out = out.split(`{{ ${key} }}`).join(val);
      }
    }
    // also replace any {{var}} where var is present in params
    if (params) {
      for (const k of Object.keys(params)) {
        const v = String(params[k]);
        out = out.split(`{{${k}}}`).join(v);
        out = out.split(`{{ ${k} }}`).join(v);
      }
    }
    return out;
  }

  // Obtain an OAuth2 client-credentials token from params if present.
  // Returns an object with either `token` or `error` (+optional details/statusCode).
  private async fetchTokenFromParams(params?: Record<string, string | number>): Promise<{ token?: string; error?: string; details?: string; statusCode?: number }> {
    const clientId = (params as any)?.clientId;
    const clientSecret = (params as any)?.clientSecret;
    const oauthUrl = (params as any)?.oauthUrl;

    if (!clientId || !clientSecret || !oauthUrl) {
      return { error: 'Bearer token not provided and client credentials not found in params', statusCode: 401 };
    }

    const oauthUrlStr = String(oauthUrl).trim();
    try {
      new URL(oauthUrlStr);
    } catch (err: any) {
      return { error: 'Invalid oauthUrl', details: oauthUrlStr };
    }

    try {
      const form = new URLSearchParams();
      form.append('grant_type', 'client_credentials');
      form.append('client_id', String(clientId));
      form.append('client_secret', String(clientSecret));

      const tokenRes = await axios.post(oauthUrlStr, form.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
      const token = tokenRes?.data?.access_token;
      if (!token) return { error: 'Token not found in response' };
      return { token };
    } catch (err: any) {
      this.logger.error('Failed to fetch token using client credentials', err?.message || err);
      return { error: `Failed to fetch token: ${err?.message || String(err)}` };
    }
  }

  private getValueByPath(obj: any, pathStr: string) {
    if (!pathStr) return undefined;
    // remove leading 'res.' if present
    const p = pathStr.replace(/^res\./, '');
    const parts: (string | number)[] = [];
    const re = /([^.\[]+)|(\[\d+\])/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(p))) {
      if (m[1]) parts.push(m[1]);
      else if (m[2]) parts.push(Number(m[2].replace(/\[|\]/g, '')));
    }
    let cur = obj;
    for (const part of parts) {
      if (cur === undefined || cur === null) return undefined;
      cur = (cur as any)[part as any];
    }
    return cur;
  }

  private evalAssert(line: string, resObj: any): AssertResult {
    const raw = line.trim();
    // normalize both "key: predicate value" and "key predicate value"
    let left: string | undefined; let pred: string | undefined; let val: string | undefined;
    const colonMatch = raw.match(/^([^:]+):\s*(\w+)(?:\s+(.*))?$/);
    if (colonMatch) {
      left = colonMatch[1].trim(); pred = colonMatch[2].trim(); val = colonMatch[3]?.trim();
    } else {
      const parts = raw.split(/\s+/);
      left = parts.shift(); pred = parts.shift(); val = parts.join(' ');
    }

    if (!left || !pred) return { expr: raw, pass: false, message: 'Could not parse assert' };

    const actual = this.getValueByPath(resObj, left);

    switch (pred) {
      case 'eq':
        return { expr: raw, pass: String(actual) === (val || ''), message: `expected ${val}, got ${actual}` };
      case 'neq':
        return { expr: raw, pass: String(actual) !== (val || ''), message: `expected not ${val}, got ${actual}` };
      case 'isArray':
        return { expr: raw, pass: Array.isArray(actual), message: `actual type ${typeof actual}` };
      case 'isNotEmpty':
        if (actual == null) return { expr: raw, pass: false, message: 'value is null/undefined' };
        if (Array.isArray(actual)) return { expr: raw, pass: actual.length > 0, message: `length ${actual.length}` };
        if (typeof actual === 'string') return { expr: raw, pass: actual.length > 0, message: `length ${actual.length}` };
        return { expr: raw, pass: true };
      case 'isDefined':
        return { expr: raw, pass: actual !== undefined && actual !== null, message: actual === undefined ? 'undefined' : undefined };
      case 'isString':
        return { expr: raw, pass: typeof actual === 'string', message: `type ${typeof actual}` };
      case 'isNumber':
        return { expr: raw, pass: typeof actual === 'number', message: `type ${typeof actual}` };
      default:
        return { expr: raw, pass: false, message: `unsupported predicate ${pred}` };
    }
  }

  async run(scriptPath: string, params?: Record<string, string | number>, auth?: { type?: string; token?: string }) {
    const resolved = await this.resolveScriptPath(scriptPath);
    const content = await readFile(resolved, 'utf8');

    // extract url from get/post block (support GET only for POC)
    const methodMatch = content.match(/^(get|post|put|patch|delete)\s*\{/im);
    const method = methodMatch ? methodMatch[1].toLowerCase() : 'get';

    const urlBlock = this.extractBlock(content, method) || '';
    const urlLine = (urlBlock.split(/\r?\n/).find(l => l.trim().startsWith('url:')) || '').replace(/^url:\s*/, '').trim();
    let url = urlLine.replace(/^['"]|['"]$/g, '');

    // parse explicit params mapping from params:query block
    const mapping = this.parseParamsBlock(content);
    url = this.replacePlaceholdersWithMap(url, mapping, params);
    url = url.trim();

    // Validate URL early and return helpful error if invalid
    try {
      // this will throw if url is malformed
      // allow relative urls? for POC require absolute
      new URL(url);
    } catch (err: any) {
      return { ok: false, error: 'Invalid URL', details: String(url) } as any;
    }

    // prepare headers
    const headers: Record<string,string> = {};

    // If auth.type == 'bearer', accept either a provided token or client credentials in params to obtain one
    if (auth && auth.type === 'bearer') {
      let token = auth.token;

      if (!token) {
        const tokenResult = await this.fetchTokenFromParams(params);

        if (tokenResult.error) {
          const resp: any = { ok: false, error: tokenResult.error, assertions: [] };
          if (tokenResult.details) resp.details = tokenResult.details;
          if (tokenResult.statusCode) resp.statusCode = tokenResult.statusCode;
          return resp;
        }

        token = tokenResult.token;
      }

      if (token) headers['Authorization'] = `Bearer ${token}`;
    }

    // perform axios request (GET only in POC)
    const axiosRes = await axios.get(url, { headers }).catch(err => {
      // return structured failure
      return { error: true, err } as any;
    });

    if ((axiosRes as any).error) {
      const e = (axiosRes as any).err;
      this.logger.error('Request failed', e.message || e.toString());
      return { ok: false, error: e.message || String(e), assertions: [] };
    }

    const resObj = { status: axiosRes.status, body: axiosRes.data } as any;

    // parse assert block
    const assertBlock = this.extractBlock(content, 'assert') || '';
    const assertLines = assertBlock.split(/\r?\n/).map(l => l.trim()).filter(l => l && l.startsWith('res.'));
    const results: AssertResult[] = assertLines.map(l => this.evalAssert(l, resObj));

    return {
      ok: results.every(r => r.pass),
      url,
      status: resObj.status,
      body: resObj.body,
      assertions: results,
    };
  }
}

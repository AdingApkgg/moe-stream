# 升级到 ESLint 10 说明

## 当前状况

- **ESLint 10** 移除了旧 API：`context.getFilename()` 改为 `context.filename`。
- **eslint-plugin-react**（当前 7.37.5）仍使用 `getFilename()`，在 ESLint 10 下会报错：`contextOrFilename.getFilename is not a function`。
- **eslint-config-next** 依赖该 React 插件，因此整条链路在未适配前无法直接使用 ESLint 10。

## 可选方案

### 方案一：等待生态支持（推荐）

保持 `eslint: "^9"`，等以下包官方支持 ESLint 10 后再升级：

- [eslint-plugin-react](https://github.com/jsx-eslint/eslint-plugin-react)（有 [ESLint 10 兼容 issue](https://github.com/jsx-eslint/eslint-plugin-react/issues/3295)）
- [eslint-config-next](https://github.com/vercel/next.js/tree/canary/packages/eslint-config-next)
- [typescript-eslint](https://github.com/typescript-eslint/typescript-eslint)

升级时把 `package.json` 里 `eslint` 改回 `"^10"` 并 `pnpm install` 即可。

---

### 方案二：使用 pnpm patch 临时兼容

在生态未更新前，用 patch 把 `eslint-plugin-react` 里对 `getFilename` 的调用改为兼容 ESLint 10 的写法（使用 `context.filename` 或兼容层）。

1. **改回 ESLint 10**

   ```bash
   # package.json 中 devDependencies 里
   "eslint": "^10"
   ```

2. **生成 patch**

   ```bash
   pnpm install
   pnpm patch eslint-plugin-react@7.37.5
   ```

   会打开一个临时目录，例如：`/tmp/xxx`。

3. **在临时目录中修改**

   - 找到 `lib/util/version.js`（以及所有调用 `getFilename` 的文件）。
   - 将 `contextOrFilename.getFilename()` 改为：
     - `(typeof contextOrFilename.getFilename === 'function' ? contextOrFilename.getFilename() : contextOrFilename.filename)`
     或仅使用 `contextOrFilename.filename`（ESLint 10 的 context 上直接有 `filename`）。

4. **写回 patch**

   修改保存后退出临时目录，执行：

   ```bash
   pnpm patch-commit /tmp/xxx  # 替换为实际输出的路径
   ```

5. **在 package.json 中确认**

   - 会多出 `"pnpm": { "patchedDependencies": { "eslint-plugin-react@7.37.5": "..." } }`。
   - 之后每次 `pnpm install` 都会自动应用该 patch。

**注意**：eslint-plugin-react 内部可能有多处使用 `getFilename`，需要全部改为兼容写法或 `context.filename`，否则仍会报错。若上游发布支持 ESLint 10 的版本，应移除 patch 并改用新版本。

---

### 方案三：不用 React 插件，仅用 TS + Next 规则（不推荐）

- 使用 ESLint 10，但**不再使用** `eslint-config-next` 的完整配置（因为会拉进不兼容的 React 插件）。
- 自己写 flat config：只启用 `@next/eslint-plugin-next`、`typescript-eslint` 等，不启用 `eslint-plugin-react`。
- 缺点：会失去 React 相关规则（如 display-name、jsx-key 等），只适合临时过渡或对 React 规则无要求的场景。

---

## 总结

| 方案     | 难度 | 风险     | 建议     |
|----------|------|----------|----------|
| 等生态   | 低   | 无       | 推荐     |
| pnpm patch | 中   | 需维护 patch | 想提前用 10 时可选 |
| 不用 React 插件 | 中 | 失去部分规则 | 仅作临时方案 |

当前项目已固定为 `eslint: "^9"`，lint 可正常运行。要升级到 10，优先考虑**方案一**；若必须立刻用 10，再按**方案二**做 patch。

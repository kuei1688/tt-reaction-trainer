# GLM Task 017: 只讀核心物理抽取工具 MVP 邊界檢查

## 目的

請只做 read-only 檢查與整理，不修改任何檔案，不新增任何檔案，不建立新的任務包。

這一輪的目標是確認 `docs/READ_ONLY_PHYSICS_EXTRACTOR_SPEC.md` 是否已經足夠支撐一個「只讀抽取 / 比較 / 報告」的 MVP 工具。

## 讀取範圍

請優先閱讀：

- `docs/READ_ONLY_PHYSICS_EXTRACTOR_SPEC.md`
- `docs/CORE_FILE_SYNC_STATUS.md`
- `docs/VALIDATION_PLAN.md`
- `docs/PHYSICS_MODEL_SPEC.md`
- `docs/MODEL_DECISIONS.md`
- `docs/PROJECT_OVERVIEW.md`

如有必要，再回看：

- `AI_CONTEXT/00_READ_ME_FIRST.md`
- `AI_CONTEXT/CODEX_CONTEXT_SUMMARY.md`

## 你要檢查的事情

1. 這份規格是否已經足夠定義一個 MVP 只讀工具。
2. 這個工具應該抽哪些常數。
3. 這個工具應該抽哪些函式。
4. 輸出報告應該用什麼格式，才適合後續人工或高階模型審查。
5. 是否應先只做 MVP，不要一次擴到完整 AST / 全檔同步 / 自動修正。
6. 哪些內容現在還不夠明確，不能直接進入實作。

## 明確禁止

- 不要修改 `game4.html`
- 不要修改 `return-studio.html`
- 不要修改 `physics-studio.html`
- 不要修改任何核心程式
- 不要自動同步任何函式
- 不要做物理判斷
- 不要新增新模型
- 不要提出物理解決方案
- 不要把研究工具內容升格成正式部署

## 請輸出的格式

請用簡短條列回覆，分成這 6 段：

1. `可否做 MVP`
   - 是 / 否
   - 原因

2. `常數範圍`
   - 應抽取的常數群組
   - 哪些先不要碰

3. `函式範圍`
   - 應抽取的函式群組
   - 哪些先不要碰

4. `報告格式`
   - JSON / Markdown 是否都需要
   - 最小欄位建議

5. `仍有缺口`
   - 哪些規格還不夠明確
   - 哪些地方現在不能直接實作

6. `本輪應停止處`
   - 最小安全邊界
   - 不要往哪裡擴張

## 判斷原則

- 先確認能不能穩定抽取與比較，再談更細的解析。
- 先比名稱、簽名、body hash，先不要做語意推論。
- 先保守輸出差異，不要自動修正任何檔案。
- 如果規格不足以直接實作，請明確指出缺口，不要自己補成完整方案。


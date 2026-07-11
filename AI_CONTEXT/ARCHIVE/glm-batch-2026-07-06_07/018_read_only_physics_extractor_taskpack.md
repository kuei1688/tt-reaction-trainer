# GLM Task 018: 只讀核心物理抽取工具 MVP 任務包

## 任務目的

請幫我只做 read-only 的規格整理與邊界確認，不修改任何檔案，不新增任何檔案，不建立新的任務包。

我想確認 `docs/READ_ONLY_PHYSICS_EXTRACTOR_SPEC.md` 是否已經足夠支撐一個 MVP 工具，用來抽取並比較以下檔案的核心物理常數與函式：

- `game4.html`
- `return-studio.html`
- `physics-studio.html`

## 你要回答的問題

1. 這個工具應該抽哪些常數？
2. 這個工具應該抽哪些函式？
3. 輸出報告格式應該長什麼樣？
4. 是否可以先做 MVP 版本？
5. 會讀哪些檔案？
6. 會輸出到哪裡？

## 你要看的檔案

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

## 我希望你的輸出格式

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


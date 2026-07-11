# GLM Task 015: 尾段候選內容降溫包

## 目標
針對尾段候選與 review 類草稿的內容本體做降溫，讓它們明確維持在「候選 / review / 摘要」而不是決策或正式台帳。

## 來源範圍
- `AI_CONTEXT/DRAFTS/codex_review_notes.md`
- `AI_CONTEXT/DRAFTS/tail_todo_006_008_candidate_draft.md`
- `AI_CONTEXT/DRAFTS/physics_tail_candidate_entries_draft.md`
- `AI_CONTEXT/DRAFTS/physics_tail_candidate_review.md`

## 要求
1. 不改寫成新事實，只做語氣降溫與邊界補強。
2. `codex_review_notes.md` 保持 review notes，避免看起來像正式合併規格。
3. `tail_todo_006_008_candidate_draft.md` 保持 TODO 候選，避免看起來像已完成項目台帳。
4. `physics_tail_candidate_entries_draft.md` 保持候選條目，不要讓 DEC / RES 文字像正式決策。
5. `physics_tail_candidate_review.md` 只補 review 邊界，不升格成 approve/decision 文件。

## 驗收標準
- 這幾份文件的內容語氣清楚保守。
- 沒有任何句子能直接被讀成「已定案」或「已核准」。

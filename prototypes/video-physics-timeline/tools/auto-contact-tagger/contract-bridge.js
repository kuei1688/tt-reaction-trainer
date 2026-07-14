'use strict';
// contract-bridge.js
// 載入 Direction C 標註器使用的同一份 annotation-contract.js，
// 確保本腳本產出的 draft JSON 與標註器匯入入口用完全相同的驗證邏輯。
// 不複製、不重新實作 schema。
const path = require('path');
const contract = require(path.join(__dirname, '..', 'direction-c-annotator', 'annotation-contract.js'));
module.exports = contract;
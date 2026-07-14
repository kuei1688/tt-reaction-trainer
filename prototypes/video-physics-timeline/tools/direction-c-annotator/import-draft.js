// import-draft.js — 附加功能：把外部 draft JSON（如 auto-contact-tagger 產出）
// 匯入標註器欄位。不更動 annotator-app.js，只透過既有欄位的 input/change
// 事件觸發 annotator-app 的更新流程。
(function () {
  function init() {
    var contract = window.DirectionCAnnotationContract;
    var runPreview = document.getElementById('runPreview');
    if (!contract || !runPreview) return;
    var actions = runPreview.parentNode;
    var file = document.createElement('input');
    file.type = 'file';
    file.accept = '.json,application/json';
    file.style.display = 'none';
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = '匯入 draft';
    btn.style.marginLeft = '8px';
    btn.addEventListener('click', function () { file.value = ''; file.click(); });
    file.addEventListener('change', function () {
      var f = file.files && file.files[0];
      if (!f) return;
      var r = new FileReader();
      r.onload = function () {
        var v = document.getElementById('validation');
        try {
          var draft = JSON.parse(r.result);
          contract.validateAnnotation(draft);
          var $ = function (id) { return document.getElementById(id); };
          $('fps').value = draft.fps;
          $('contactTime').value = Number(draft.contact_time_sec).toFixed(3);
          $('observationEnd').value = Number(draft.observation_end_sec).toFixed(3);
          $('spinNote').value = draft.spin_note;
          $('entryX').value = Number(draft.entry_position.x).toFixed(3);
          $('entryY').value = Number(draft.entry_position.y).toFixed(3);
          ['fps', 'contactTime', 'observationEnd', 'spinNote'].forEach(function (id) {
            $(id).dispatchEvent(new Event('input', { bubbles: true }));
          });
          ['entryX', 'entryY'].forEach(function (id) {
            $(id).dispatchEvent(new Event('change', { bubbles: true }));
          });
          if (v) {
            v.textContent = '已匯入「' + draft.source_video + '」的 draft（contact=' + draft.contact_time_sec + 's, obsEnd=' + draft.observation_end_sec + 's）。可按「播放 C3 預覽」觀看 handoff。';
            v.className = 'validation ok';
          }
        } catch (e) {
          if (v) { v.textContent = '匯入失敗：' + e.message; v.className = 'validation error'; }
        }
      };
      r.readAsText(f);
    });
    actions.appendChild(btn);
    actions.appendChild(file);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
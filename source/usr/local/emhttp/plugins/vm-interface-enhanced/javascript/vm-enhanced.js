/**
 * VM Interface Enhanced - JavaScript
 * Patches the Unraid VM manager UI to keep useful information always
 * visible and make modifiable fields visually prominent.
 */
(function (window, $) {
  'use strict';

  /* ----------------------------------------------------------------
     Constants / config
     ---------------------------------------------------------------- */

  var PLUGIN = 'vmie';

  // Maps icon-color clues (from the status icon in each VM row) to
  // a canonical state name and badge label.
  var STATE_MAP = [
    { test: function (td) { return td.find('i.green,i.fa-play,i.icon-u-play').length > 0 ||
                                   td.find('i[class*="circle"]').hasClass('green') ||
                                   td.find('.green').length > 0; },
      state: 'running',   label: 'Running'   },
    { test: function (td) { return td.find('i.orange,.orange-text').length > 0; },
      state: 'paused',    label: 'Paused'    },
    { test: function (td) { return td.find('i.blue,.blue-text').length > 0; },
      state: 'suspended', label: 'Suspended' },
    { test: function (td) { return td.find('i.red,.red-text').length > 0; },
      state: 'crashed',   label: 'Crashed'   },
  ];

  /* ----------------------------------------------------------------
     Detect VM state from existing icon colours in a <tr>
     ---------------------------------------------------------------- */

  function detectState($row) {
    // The first <td> typically holds the context-menu icon which is
    // coloured according to state.
    var $first = $row.find('td').first();
    for (var i = 0; i < STATE_MAP.length; i++) {
      if (STATE_MAP[i].test($first)) {
        return STATE_MAP[i];
      }
    }
    return { state: 'stopped', label: 'Stopped' };
  }

  /* ----------------------------------------------------------------
     Apply state badge and row class to a single VM <tr>
     ---------------------------------------------------------------- */

  function applyStateBadge($row) {
    // Skip child / detail rows (they don't have vm-name cells)
    if (!$row.find('td.vm-name').length) return;

    var info = detectState($row);

    // Row-level class for CSS background tinting
    $row.removeClass('vm-state-running vm-state-stopped vm-state-paused vm-state-suspended vm-state-crashed')
        .addClass('vm-state-' + info.state);

    // Inject a badge after the VM name link (idempotent)
    var $name = $row.find('td.vm-name');
    $name.find('.' + PLUGIN + '-state-badge').remove();
    $('<span>')
      .addClass(PLUGIN + '-state-badge vmie-state-badge vmie-' + info.state)
      .text(info.label)
      .appendTo($name);
  }

  /* ----------------------------------------------------------------
     Add ARIA label + title tooltip to .text editable elements so
     keyboard users and hoverers know the field is editable.
     ---------------------------------------------------------------- */

  function markEditableFields($scope) {
    $scope.find('.text').each(function () {
      var $el = $(this);
      if ($el.data(PLUGIN + '-marked')) return;
      $el.data(PLUGIN + '-marked', true)
         .attr('title', 'Click to edit')
         .attr('role', 'button')
         .attr('tabindex', '0');

      // Allow keyboard activation (Enter / Space)
      $el.on('keydown.' + PLUGIN, function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          $(this).trigger('click');
        }
      });
    });
  }

  /* ----------------------------------------------------------------
     Show a visible placeholder in description cells that are empty
     ---------------------------------------------------------------- */

  function markEmptyDescriptions($scope) {
    $scope.find('td.vm-description, td:nth-child(2)').each(function () {
      var $td = $(this);
      var $text = $td.find('.text');
      if ($text.length && $text.text().trim() === '') {
        $text.attr('data-placeholder', 'add description…');
      }
    });
  }

  /* ----------------------------------------------------------------
     Main enhancement pass – run after kvm_list is populated
     ---------------------------------------------------------------- */

  function enhanceVMList() {
    var $list = $('#kvm_list');
    if (!$list.length) return;

    // 1. State badges on all main VM rows
    $list.find('tr.sortable').each(function () {
      applyStateBadge($(this));
    });

    // 2. Editable-field hints
    markEditableFields($list);

    // 3. Empty description placeholders
    markEmptyDescriptions($list);
  }

  /* ----------------------------------------------------------------
     Observe #kvm_list for dynamic updates (loadlist replaces innerHTML)
     ---------------------------------------------------------------- */

  function setupObserver() {
    var target = document.getElementById('kvm_list');
    if (!target) return;

    var observer = new MutationObserver(function (mutations) {
      var relevant = mutations.some(function (m) {
        return m.type === 'childList' && m.addedNodes.length > 0;
      });
      if (relevant) {
        // Small debounce – loadlist may do multiple DOM writes
        clearTimeout(window[PLUGIN + '_debounce']);
        window[PLUGIN + '_debounce'] = setTimeout(enhanceVMList, 120);
      }
    });

    observer.observe(target, { childList: true });
  }

  /* ----------------------------------------------------------------
     Also patch the global loadlist() so we run even if MutationObserver
     misses anything (belt-and-suspenders).
     ---------------------------------------------------------------- */

  function patchLoadlist() {
    if (typeof window.loadlist !== 'function') return;
    var _orig = window.loadlist;
    window.loadlist = function () {
      var result = _orig.apply(this, arguments);
      // loadlist uses $.get (async), so enhancements are handled by
      // the MutationObserver above. We just need to call _orig here.
      return result;
    };
  }

  /* ----------------------------------------------------------------
     Entry point
     ---------------------------------------------------------------- */

  function init() {
    setupObserver();
    patchLoadlist();
    // Run once in case kvm_list is already populated
    enhanceVMList();
  }

  // Defer until jQuery and the page are ready
  if (typeof $ !== 'undefined') {
    $(document).ready(init);
  } else {
    document.addEventListener('DOMContentLoaded', function () {
      if (typeof window.jQuery !== 'undefined') {
        $ = window.jQuery;
      }
      init();
    });
  }

}(window, window.jQuery || {}));

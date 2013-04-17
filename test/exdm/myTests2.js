


/*
*
* tests for the jQuery addin
*
*/

var domain = 'dev.rdbhost.com';

module('rdbhost plugin pre-test', {
  setup: function () {
      $.rdbHostConfig( {
        'domain': domain,
        'format': 'json-easy',
        'userName': demo_r_role,
        'authcode': '-'
      })
  },
  teardown: function () {
      $.rdbHostConfig( {
        'domain': '',
        'format': '',
        'userName': '',
        'authcode': ''
      });
  }
});

// verify setup
asyncTest('verify setup', 1, function() {

  $.withResults({

    'q': 'SELECT 1 AS one',
    'callback' : function(json) {
          console.log(json);
          equal(json.status[1],'OK', 'json has data');
          start();
        },
    'errback': function(json) {
          ok(false);
          start();
        }
  });
});


// verify setup promise
asyncTest('verify setup - promise', 2, function() {

  var p = $.withResults({

    'q': 'SELECT 1 AS one',
    'callback' : function(json) {
      console.log(json);
      equal(json.status[1],'OK', 'json has data');
    },

    'errback': function(json) {
      ok(false);
      start();
    }
  });

  p.done(function(m) {
    ok(m,'promise done called');
    start();
  });
});


/* $.eachRecord, */
asyncTest('$.eachRecord', 2, function() {

  $.eachRecord({

    'q': 'SELECT 1 AS one UNION SELECT 2',

    'eachrec' : function(jsonRow) {
          ok(jsonRow['one']===1 || jsonRow['one']===2, 'row has value 1');
          start();
        },

    'errback': function(json) {
          ok(false);
          start();
        }
  })
});


/* $.eachRecord w/ promise */
asyncTest('$.eachRecord', 3, function() {

  var p = $.eachRecord({

    'q': 'SELECT 1 AS one UNION SELECT 2',

    'eachrec' : function(jsonRow) {
      ok(jsonRow['one']===1 || jsonRow['one']===2, 'row has value 1');
    },

    'errback': function(json) {
      ok(false);
      start();
    }
  });

  p.done(function(m) {
    ok(m,'promise done called');
    start();
  })
});


// $.eachRecord
asyncTest('$.eachRecord err', 1, function() {
  $.eachRecord({
    'q': 'SELECTY 1 AS one UNION SELECT 2',
    'eachrec' : function(jsonRow) {
          //ok(jsonRow['one']===1 || jsonRow['one']===2, 'row has value 1');
          start();
        },
    'errback': function(json) {
          ok(true,'errback called');
          start();
        }
  })
});


// $.eachRecord err w/ promise
asyncTest('$.eachRecord err', 2, function() {
  var p = $.eachRecord({

    'q': 'SELECTY 1 AS one UNION SELECT 2',

    'eachrec' : function(jsonRow) {
      //ok(jsonRow['one']===1 || jsonRow['one']===2, 'row has value 1');
      start();
    },
    'errback': function(json) {
      ok(true,'errback called');
    }
  });

  p.fail(function(m) {
    ok(m,'promise fail called');
    start();
  })
});




/* $.postFormData.  */

// do SELECT query form way
var form = "<form id=\"qunit_form2\" method='post' enctype=\"multipart/form-data\">"+
           "<input name=\"q\" value=\"SELECT 199 AS col\" />"+
           "</form>";

module('$.postFormData tests', {

  setup: function () {
    $.rdbHostConfig( {
      'domain': domain,
      'format': 'json-easy',
      'userName': demo_r_role,
      'authcode': '-'
    });
    $('#qunit_form2').remove();
    $('body').append(form);
  },

  teardown: function () {
    $.rdbHostConfig( {
      'domain': undefined,
      'format': undefined,
      'userName': undefined,
      'authcode': '-'
    });

    $('#qunit_form2').remove();
    equal($('#qunit_form2').length, 0, 'test form not cleaned up');
  }
});

// verify setup is ok
test('$.postFormData setup verification', function() {
  equal($('#qunit_form2').length, 1, 'test form appended '+$('#qunit_form2').length);
});


// $.postFormData test
asyncTest('$.postFornData test', 4+1, function() {

  $.postFormData($('#qunit_form2'), {
      callback: function (resp) {
            ok(typeof resp === 'object', 'response is object'); // 0th assert
            ok(resp.status[1].toLowerCase() == 'ok', 'status is not ok: '+resp.status[1]); // 1st assert
            ok(resp.row_count[0] > 0, 'data row found');
            ok(resp.records.rows[0][0] === 199, 'data is not 99: '+resp.records.rows[0]['col']);
            start();
          }
  });

  $('#qunit_form2').rdbhostSubmit();
});


// $.postFormData fail w/ promise
asyncTest('$.postFornData test fail promise', 2+1, function() {

  var p = $.postFormData($('#qunit_form2'), {

    errback: function(resp) {
      ok(resp,'errback called');
    },

    callback: function (resp) {
      ok(typeof resp === 'object', 'response is object'); // 0th assert
    }
  });

  $('#qunit_form2 input:text').val('SELECTY');
  $('#qunit_form2').rdbhostSubmit();

  p.fail(function(m) {
    ok(m,'promise fail called');
    start();
  });
});


// $.postFormData test w/ promise
asyncTest('$.postFornData test promise', 5+1, function() {

  var p = $.postFormData($('#qunit_form2'), {
    callback: function (resp) {
      ok(typeof resp === 'object', 'response is object'); // 0th assert
      ok(resp.status[1].toLowerCase() == 'ok', 'status is not ok: '+resp.status[1]); // 1st assert
      ok(resp.row_count[0] > 0, 'data row found');
      ok(resp.records.rows[0][0] === 199, 'data is not 99: '+resp.records.rows[0]['col']);
    }
  });

  $('#qunit_form2').rdbhostSubmit();

  p.done(function(m) {
    ok(m,'promise done called');
    start();
  });
});


module('$.loginAjax tests', {
  setup: function () {
    $.rdbHostConfig( {
      'domain': domain,
      'format': 'jsond-easy',
      'userName': demo_r_role,
      'authcode': '-'
    });
  },
  teardown: function () {
    $.rdbHostConfig( {
      'domain': undefined,
      'format': undefined,
      'userName': undefined,
      'authcode': '-'
    });
  }
});


// $.loginByForm test w/ promise
asyncTest('$.loginAjax test w/ promise ', 2+0, function() {

  var p = $.loginAjax({

    errback: function(resp) {

      ok(resp,'loginAjax');
      start();
    }
  });

  p.fail(function (m) {

    ok(m,'fail handler called');
  });

});



// do SELECT query form way
var testdiv = "<div id=\"qunit_div\"></div>";

module('plugin display tests', {
  setup: function () {
    $.rdbHostConfig( {
      'domain': domain,
      'format': 'json-easy',
      'userName': demo_r_role,
      'authcode': '-'
    });
    $('#qunit_div').remove();
    $('body').append(testdiv);
  },
  teardown: function () {
    $.rdbHostConfig( {
      'domain': undefined,
      'format': undefined,
      'userName': undefined,
      'authcode': '-'
    });
    $('#qunit_div').remove();
    equal($('#qunit_div').length, 0, 'test div cleaned up');
  }
});

// verify setup is ok
test('$.datadump setup verification', function() {
  equal($('#qunit_div').length, 1, 'test div appended '+$('#qunit_div').length);
});

/* and $.fn.datadump.  */
asyncTest('$.datadump test', 2+1, function() {

  $('#qunit_div').datadump('SELECT \'abc\' AS txt, 1 AS num');

  setTimeout(function () {
      // timeout allows for datadump to act
      var div = $('#qunit_div').html();
      ok(div.length > 10, 'div has content');
      var tst = /status/;
      ok(tst.test(div), 'content includes status');
      start();
    }, 1000);
});


/* $.fn.populateTable,  */
asyncTest('$.populateTable test', 3+1, function() {

  ok($('#qunit_div').length > 0, 'qunit div is there');
  $('#qunit_div').populateTable('SELECT \'abc\' AS txt, 1 AS num');

  setTimeout(function () {
      // timeout allows for datadump to act
      var div = $('#qunit_div').html();
      ok(div.length > 10, 'div has content');
      var tst = /table/i;
      ok(tst.test(div), 'content includes table');
      start();
    }, 1000);
});




/*  $.fn.populateForm, */
// do SELECT query form way
var testform = "<form id=\"qunit_form\"><input name=\"txt\" id=\"txt\" /><input name=\"num\" id=\"num\" /></form>";

module('$.populateForm tests', {
  setup: function () {
    $.rdbHostConfig( {
      'domain': domain,
      'format': 'json-easy',
      'userName': demo_r_role,
      'authcode': '-'
    });
    $('#qunit_form').remove();
    $('body').append(testform);
  },
  teardown: function () {
    $.rdbHostConfig( {
      'domain': undefined,
      'format': undefined,
      'userName': undefined,
      'authcode': '-'
    });
    $('#qunit_form').remove();
    equal($('#qunit_form').length, 0, 'test form cleaned up');
  }
});

// verify setup is ok
test('$.populateForm setup verification', function() {
  equal($('#qunit_form').length, 1, 'test form appended '+$('#qunit_form').length);
});

/* $.fn.populateTable,  */
asyncTest('$.populateForm test', 2+1, function() {

  $('#qunit_form').populateForm('SELECT \'abc\' AS txt, 1 AS num');

  setTimeout(function () {
      // timeout allows for datadump to act
      var $form = $('#qunit_form');
      ok($form.length > 0, 'form has content');
      var txtin = $form.find('input#txt').val();
      equal(txtin,'abc',"txt field has correct value");
      start();
    }, 2000);
});






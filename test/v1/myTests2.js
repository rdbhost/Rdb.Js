

/*
*
* tests for the jQuery addin
*
*/




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
          ok(false,'should not see');
          start();
        }
  })
});


// verify setup promise
asyncTest('verify setup - promise', 2, function() {

  var p = $.withResults({

    'q': 'SELECT 1 AS one',
    'callback' : function(json) {
      console.log(json);
      equal(json.status[1],'OK', 'json has data');
      return 'abc';
    },

    'errback': function(err, errmsg) {
      ok(false);
      start();
    }
  });

  p.done(function(m) {
    ok(m,'promise done called');
    start();
  });
});


// verify setup promise - chained
asyncTest('verify setup - promise chained', 3, function() {

  var p = $.withResults({

    'q': 'SELECT 1 AS one',
    'callback' : function(json) {

      console.log(json);
      equal(json.status[1],'OK', 'json has data');
      json.pumpkin = 'pie';
      return json;
    },

    'errback': function(json) {

      ok(false);
      start();
    }
  });

  p.done(function(m) {

    equal(m.pumpkin, 'pie', 'pumpkin pie');
    ok(m,'promise done called');
    start();
  });
});


// verify postData
asyncTest('verify postData - promise', 2, function() {

  var p = $.postData({

    'q': 'SELECT 1 AS one',
    'callback' : function(json) {
      console.log(json);
      equal(json.status[1],'OK', 'json has data');
      return 1;
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


// verify postData
asyncTest('verify postData - roleName r', 2, function() {

    $.rdbHostConfig( {
        'domain': domain,
        'format': 'json-easy',
        'accountNumber': acct_number,
        'userName': 'reader',
        'authcode': '-'
    });

    var p = $.postData({

        'q': 'SELECT 1 AS one',
        'callback' : function(json) {
            console.log(json);
            equal(json.status[1],'OK', 'json has data');
            return 1;
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


// verify postData
asyncTest('verify postData - roleName p', 1, function() {

    $.rdbHostConfig( {
        'domain': domain,
        'format': 'json-easy',
        'accountNumber': acct_number,
        'userName': 'preauth',
        'authcode': '-'
    });

    var p = $.postData({

        'q': 'SELECT 1 AS onesy',
        'callback' : function(json) {
            console.log(json);
        },

        'errback': function(json) {
            ok(true);
        }
    });

    p.always(function(m) {
        start();
    });
});

// verify postData
asyncTest('verify postData - roleName r + repeat', 3, function() {

    $.rdbHostConfig( {
        'domain': domain,
        'format': 'json-easy',
        'accountNumber': acct_number,
        'userName': 'reader',
        'authcode': '-'
    });

    var p = $.postData({

        'q': 'SELECT 1 AS one',
        repeat: 3,
        'callback' : function(json) {
            console.log(json);
            equal(json.status[1],'OK', 'json has data');
            ok(json.result_sets && json.result_sets.length > 2, 'json has multi result sets');
            return 1;
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


// verify easy format
asyncTest('verify easy - promise', 2, function() {

  var p = $.withResults({

    'q': 'SELECT 1 AS one',
    'callback' : function(json) {
      console.log(json);
      equal(json.status[1],'OK', 'json has data');
      return 1;
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

    var ct = 0;
    $.eachRecord({

        'q': 'SELECT 1 AS one UNION SELECT 2',

        'eachrec' : function(jsonRow) {
            ok(jsonRow['one']===1 || jsonRow['one']===2, 'row has value 1');
            ct += 1;
            if ( ct === 2 )
                start();
        },

        'errback': function(json) {
            ok(false);
            ct += 1;
            if ( ct === 2 )
                start();
        }
  });
});


/* $.eachRecord w/ promise */
asyncTest('$.eachRecord promise', 3, function() {

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
    ok(true,'promise done called');
    start();
  })
});


/* $.eachRecord w/ promise - chained */
asyncTest('$.eachRecord promise - chained', 3, function() {

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
    ok(true,'promise done called');
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
asyncTest('$.eachRecord err promise', 2, function() {
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
    ok(true,'promise fail called');
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

    // var tmpEngine = new SQLEngine('','',domain);
    // this.skip = false; //~tmpEngine.version.indexOf('cors');
    // tmpEngine = undefined;

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
  format: 'json-easy',
  callback: function (resp) {
    ok(typeof resp === 'object', 'response is object'); // 0th assert
    ok(resp.status[1].toLowerCase() == 'ok', 'status is not ok: '+resp.status[1]); // 1st assert
    ok(resp.row_count[0] > 0, 'data row found');
    ok(resp.records.rows[0]['col'] === 199, 'data is not 199: '+resp.records.rows[0]['col']);
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
     return 1;
   },

   callback: function (resp) {
     ok(typeof resp === 'object', 'response is object'); // 0th assert
   }
 });

 p.fail(function(m) {
   ok(m,'promise fail called');
   start();
 });

 $('#qunit_form2').find('input').val('SELECTY');
 $('#qunit_form2').rdbhostSubmit();

});


 // $.postFormData test w/ promise
 asyncTest('$.postFornData test promise', 5+1, function() {

   var p = $.postFormData($('#qunit_form2'), {

      callback: function (resp) {
           ok(typeof resp === 'object', 'response is object'); // 0th assert
           ok(resp.status[1].toLowerCase() == 'ok', 'status is not ok: '+resp.status[1]); // 1st assert
           ok(resp.row_count[0] > 0, 'data row found');
           ok(resp.records.rows[0]['col'] === 199, 'data is not 199: '+resp.records.rows[0]['col']);
           return 456;
        }
   });

  p.done(function(m) {
      ok(m === 456, 'promise done called');
      start();
    });

   $('#qunit_form2').rdbhostSubmit();

 });


// $.postFormData test w/ promise only
asyncTest('$.postFornData test promise only', 4+1, function() {

    var p = $.postFormData($('#qunit_form2'), {});

    p.done(function(resp) {

        ok(typeof resp === 'object', 'response is object'); // 0th assert
        ok(resp.status[1].toLowerCase() == 'ok', 'status is not ok: '+resp.status[1]); // 1st assert
        ok(resp.row_count[0] > 0, 'data row found');
        ok(resp.records.rows[0]['col'] === 199, 'data is not 199: '+resp.records.rows[0]['col']);
        start();
    });

    setTimeout(function() {

        $('#qunit_form2').rdbhostSubmit();
    }, 800);

});


// $.postFormData test w/ promise - chained
asyncTest('$.postFornData test promise - chained', 6+1, function() {

var p = $.postFormData($('#qunit_form2'), {

  callback: function (resp) {

    ok(typeof resp === 'object', 'response is object'); // 0th assert
    ok(resp.status[1].toLowerCase() == 'ok', 'status is not ok: '+resp.status[1]); // 1st assert
    ok(resp.row_count[0] > 0, 'data row found');
    ok(resp.records.rows[0]['col'] === 199, 'data is not 199: '+resp.records.rows[0]['col']);
    var r = {'pumpkin' :'pie'};
    return r;
  }
});

p.done(function(m) {

  equal(m.pumpkin, 'pie', 'pumpkin pie');
  ok(m,'promise done called');
  start();
});

$('#qunit_form2').rdbhostSubmit();

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



module('Rdbhost.getGET tests', {

    setup: function () {
        $.rdbHostConfig( {
            'domain': domain,
            'format': 'json-easy',
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

/* Rdbhost.getGET throws,  */
test('Rdbhost.getGET test throws', function() {

    throws(function() { Rdbhost.getGET() }, 'always throws exception');
});

/* Rdbhost.getGET ,  */
test('Rdbhost.getGET test ', function() {

    var opts = {
        q: 'SELECT 1'
    };
    var u = Rdbhost.getGET(opts);
    ok(~u.indexOf('format'), 'has format string');
    ok(~u.indexOf('SELECT'), 'has query string');
    ok(~u.indexOf('rdbhost.'), 'has host string');
    ok(~u.indexOf(demo_r_role), 'rolename in url');
    ok(!~u.indexOf(' '), 'has no white space');
});


/* Rdbhost.getGET ,  */
test('Rdbhost.getGET test args ', function() {

    var opts = {
        q: 'SELECT 1',
        args: [1, 'abc'],
        format: 'json-easy'
    };
    var u = Rdbhost.getGET(opts);

    ok(~u.indexOf('format'), 'has format string');
    ok(~u.indexOf('SELECT'), 'has query string');
    ok(~u.indexOf('rdbhost.'), 'has host string');
    ok(~u.indexOf(demo_r_role), 'rolename in url');
    ok(!~u.indexOf(' '), 'has no white space');

    ok(~u.indexOf('q='), 'query in url');
    ok(~u.indexOf('arg000=1'), 'arg000 is correct in url');
    ok(~u.indexOf('arg001=abc'), 'arg001 is correct in url');
    ok(~u.indexOf('argtype000=NUMBER'), 'argtype000 is correct in url ');
    ok(~u.indexOf('argtype001=STRING'), 'argtype001 is correct in url ');
    ok(!~u.indexOf('arg002'), 'no arg002 in url');
    ok(!~u.indexOf('argtype002'), 'no argtype002 in url');

    ok(~u.indexOf('format=json'), 'format in url');
});


/* Rdbhost.getGET ,  */
asyncTest('Rdbhost.getGET test w AJAX ', 3, function() {

    var opts = {
        q: 'SELECT 1',
        args: [1, 'abc'],
        format: 'json-easy'
    };
    var u = Rdbhost.getGET(opts);

    var p = $.ajax({
        url: u,
        dataType: 'json'
    });

    p.fail(function(errArray) {

       ok(false, 'AJAX test failed ' + errArray[0] + ' ' + errArray[1]);
       start();
    });

    p.done(function(data) {

        ok(data, 'AJAX test succeeded');
        ok(data.status[1].toLowerCase() === 'ok', 'status ' + data.status[1]);
        ok(data.row_count[0] === 1, 'row count ' + data.row_count);
        start();
    });
});


module('Rdbhost.getPOST tests', {

    setup: function () {
        $.rdbHostConfig( {
            'domain': domain,
            'format': 'json-easy',
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

/* R.getPOST throws,  */
test('Rdbhost.getPOST test throws', function() {

    throws(function() {Rdbhost.getPOST() }, 'always throws exception');
});

/* Rdbhost.getPOST ,  */
test('Rdbhost.getPOST test ', function() {

    var opts = {
        q: 'SELECT 1'
    };
    var o = Rdbhost.getPOST(opts),
        u = o.url,
        d = o.data;

    ok(!~u.indexOf('format'), 'url has no format string');
    ok(!~u.indexOf('SELECT'), 'url has no query string');
    ok(~u.indexOf('rdbhost.'), 'url has host string');
    ok(!~u.indexOf(' '), 'has no white space');
    ok(~u.indexOf(demo_r_role), 'rolename in url');

    ok(d.q, 'query in data');
    ok(!d.arg000, 'no arg000 in data');
    ok(!d.arg001, 'no arg001 in data');
    ok(!d.argtype000, 'no argtype000 in data');
});


/* Rdbhost.getPOST ,  */
test('Rdbhost.getPOST test w args', function() {

    var opts = {
        q: 'SELECT 1',
        args: [1, 'abc']
    };
    var o = Rdbhost.getPOST(opts),
        u = o.url,
        d = o.data;

    ok(!~u.indexOf('format'), 'url has no format string');
    ok(!~u.indexOf('SELECT'), 'url has no query string');
    ok(~u.indexOf('rdbhost.'), 'url has host string');
    ok(!~u.indexOf(' '), 'has no white space');
    ok(~u.indexOf(demo_r_role), 'rolename in url');

    ok(d.q, 'query in data');
    ok(d.arg000 === 1, 'arg000 is correct in data');
    ok(d.arg001 === 'abc', 'arg001 is correct in data');
    ok(d.argtype000 === 'NUMBER', 'argtype000 is correct in data '+ d.argtype000);
    ok(d.argtype001 === 'STRING', 'argtype001 is correct in data ' + d.argtype001);
    ok(!d.arg002, 'no arg002 in data');
    ok(!d.argtype002, 'no argtype002 in data');
});


/* Rdbhost.getPOST ,  */
asyncTest('Rdbhost.getPOST test w AJAX ', 3, function() {

    var opts = {
        q: 'SELECT 1',
        args: [1, 'abc'],
        format: 'json-easy'
    };
    var u = Rdbhost.getPOST(opts);

    var p = $.ajax({
        method: 'POST',
        url: u.url,
        data: u.data,
        dataType: 'json'
    });

    p.fail(function(errArray) {

        ok(false, 'AJAX test failed ' + errArray[0] + ' ' + errArray[1]);
        start();
    });

    p.done(function(data) {

        ok(data, 'AJAX test succeeded');
        ok(data.status[1].toLowerCase() === 'ok', 'status ' + data.status[1]);
        ok(data.row_count[0] === 1, 'row count ' + data.row_count);
        start();
    });
});


/* Rdbhost.getPOST ,  */
asyncTest('Rdbhost.getPOST test 2 w AJAX ', 2, function() {

    var opts = {
        userName: 'super',
        authcode: 'abcdef',
        q: 'SELECT 1',
        args: [1, 'abc'],
        format: 'json-easy'
    };
    var u = Rdbhost.getPOST(opts);

    var p = $.ajax({
        method: 'POST',
        type: 'POST', // keep Zepto happy
        url: u.url,
        data: u.data,
        dataType: 'json'
    });

    p.fail(function(errArray) {

        ok(false, 'AJAX test failed ' + errArray[0] + ' ' + errArray[1]);
        start();
    });

    p.done(function(data) {

        // for ajax calls, even errors are returned as done(), only http level errors are fail()
        ok(data.error, 'error occurred');
        ok(data.error[1] && ~data.error[1].indexOf('Auth fail') || ~data.error[1].indexOf('bad authcode'),
          'error occurred' + data.error[1]);
        start();
    });
});







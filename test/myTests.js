
/*
*
* tests for the SQLEngine
*
*
*/
module('SQLEngine pre-test');
//var domain = 'www.rdbhost.com';

// create engine
test('createEngine', function() {

  var e = new SQLEngine(demo_r_role, '-', domain);
  ok(e, 'SQLEngine created');
  ok(e.query, 'engine has query method ');
  ok(typeof e.query === 'function', 'e.query is type: ' + (typeof e.query));
});

module('SQLEngine AJAX tests', {

  setup: function () {
    this.e = new SQLEngine(demo_r_role,'-',domain);
  }
});

// do SELECT query ajax-way
test('SQLEngine setup verification', function() {

  ok(this.e, 'engine defined');
  ok(this.dontfind === undefined, 'engine does not have "dontfind"');
});

asyncTest('ajax SELECT', 4, function() {

  this.e.query({

      q: "SELECT 1 as one",
      format: 'json-easy',

      callback: function (resp) {

            ok(typeof resp === 'object', 'response is object'); // 0th assert
            ok(resp.status[1].toLowerCase() == 'ok', 'status is not ok: ' + resp.status[1]); // 1st assert
            ok(resp.row_count[0] > 0, 'data row found');
            ok(resp.records.rows[0]['one'] === 1, 'data is ' + resp.records.rows[0]['one']);
            start();
          },

      errback: function(err) {

          ok(false, 'errback called ' + err[0] + ' ' + err[1]);
          start();
      }
    });
});


asyncTest('ajax SELECT promise', 5, function() {

  var p = this.e.query({

    q: "SELECT 1 as one",
    format: 'json-easy',

    callback: function (resp) {

      ok(typeof resp === 'object', 'response is object'); // 0th assert
      ok(resp.status[1].toLowerCase() == 'ok', 'status is not ok: ' + resp.status[1]); // 1st assert
      ok(resp.row_count[0] > 0, 'data row found');
      ok(resp.records.rows[0]['one'] === 1, 'data is '+resp.records.rows[0]['one']);
    }
  });

  p.done(function () {
    ok(true, 'promise resolved');
    start();
  });

});


asyncTest('ajax SELECT promise chained', 4, function() {

  var p = this.e.query({

    q: "SELECT 1 as one",
    format: 'json-easy',

    callback: function (resp) {

      ok(typeof resp === 'object', 'response is object'); // 0th assert
      ok(resp.status[1].toLowerCase() == 'ok', 'status is ok: ' + resp.status[1]); // 1st assert

      return {'pumpkin' :'pie'};
    }
  });

  p.done(function (resp) {

    ok(resp.pumpkin == 'pie', 'pumpkin pie');
    ok(true, 'promise resolved');
    start();
  });

});

asyncTest('ajax SELECT + repeat', 4, function() {

    this.e.query({

        q: "SELECT 1 as one",
        format: 'json-easy',
        repeat: 3,

        callback: function (resp) {

            ok(typeof resp === 'object', 'response is object'); // 0th assert
            ok(resp.status[1].toLowerCase() == 'ok', 'status is not ok: '  +resp.status[1]); // 1st assert
            ok(resp.result_sets && resp.result_sets.length > 2, 'data sets found');
            ok(resp.result_sets[2].records.rows[0]['one'] === 1, 'data is ' + resp.result_sets[2].records.rows[0]['one']);
            start();
        }
    });
});




asyncTest('ajax multi SELECT', 12, function() {

  this.e.query({

      q: "SELECT 1 as one",
      format: 'json-easy',

      callback: function (resp) {

            ok(typeof resp === 'object', 'response is object'); // 0th assert
            ok(resp.status[1].toLowerCase() == 'ok', 'status is not ok: '+resp.status[1]); // 1st assert
            ok(resp.row_count[0] > 0, 'data row found');
            ok(resp.records.rows[0]['one'] === 1, 'data is '+resp.records.rows[0]['one']);
          }
    });
  this.e.query({

      q: "SELECT 2 as two",
      format: 'json-easy',

      callback: function (resp) {

            ok(typeof resp === 'object', 'response is object'); // 0th assert
            ok(resp.status[1].toLowerCase() == 'ok', 'status is not ok: '+resp.status[1]); // 1st assert
            ok(resp.row_count[0] > 0, 'data row found');
            ok(resp.records.rows[0]['two'] === 2, 'data is not 2');
          }
    });
  this.e.query({

      q: "SELECT 3 as three",
      format: 'json-easy',

      callback: function (resp) {

          ok(typeof resp === 'object', 'response is object'); // 0th assert
          ok(resp.status[1].toLowerCase() == 'ok', 'status is not ok: '+resp.status[1]); // 1st assert
          ok(resp.row_count[0] > 0, 'data row found');
          ok(resp.records.rows[0]['three'] === 3, 'data is not 3')
        }
    });

  // ends async test at 2 seconds.
  setTimeout(function() {
      start();
    }, 2000);
});


// test that error calls errback
asyncTest('ajax SELECT error', 1+0+1, function() {

  this.e.query({

      q: "SELECTY 1 as one",
      format: 'json-easy',

      errback: function(err) {

          ok(true, "errback was called");
          equal(err[0].length, 5, "errorval: "+err[0]);   // 42601
          start();
        },

      callback: function (resp) {
          start();
        }
    });
});


// test that error calls errback - with promise
asyncTest('ajax SELECT error - promise', 3, function() {

  var p = this.e.query({

    q: "SELECTY 1 as one",
    format: 'json-easy',

    errback: function(err) {

      ok(true, "errback was called");
      equal(err[0].length, 5, "errorval: "+err[0]); // 42601
    },

    callback: function (resp) {
      start();
    }
  });

  p.fail( function(a) {
    ok(true,'promise fail called');
    start();
  });
});


// do SELECT query by rows
asyncTest('ajax SELECT', 5, function() {

  this.e.queryRows({

      q: "SELECT 1 as one UNION SELECT 2",
      format: 'json-easy',

      callback: function (rows, hdr) {

          ok(typeof hdr === 'object', 'hdr param is object'); // 0th assert
          ok(typeof rows === 'object', 'hdr param is object'); // 0th assert
          ok(rows.length > 1, 'mutliple rows not found');
          ok(rows[0]['one'] === 1, 'data is '+rows[0]['one']);
          ok(rows[1]['one'] === 2, 'data is '+rows[1]['one']);
          start();
        }
    });
});


// do SELECT query by rows - with promise
asyncTest('ajax SELECT promise', 6, function() {

  var p = this.e.queryRows({

    q: "SELECT 1 as one UNION SELECT 2",
    format: 'json-easy',

    callback: function (rows, hdr) {

      ok(typeof hdr === 'object', 'hdr param is object'); // 0th assert
      ok(typeof rows === 'object', 'hdr param is object'); // 0th assert
      ok(rows.length > 1, 'multiple rows found');
      ok(rows[0]['one'] === 1, 'data is '+rows[0]['one']);
      ok(rows[1]['one'] === 2, 'data is '+rows[1]['one']);
    }
  });

  p.done(function(a) {
    ok(true,'promise done called');
    start();
  });
});


// use args param
//
asyncTest('use args 1', 4, function () {

  this.e.query({

    q : 'SELECT %s as one',
    format: 'json-easy',
    args: [1],

    callback: function (resp) {

      ok(typeof resp === 'object', 'response is object'); // 0th assert
      ok(resp.status[1].toLowerCase() == 'ok', 'status is not ok: '+resp.status[1]); // 1st assert
      ok(resp.row_count[0] > 0, 'data row found');
      ok(resp.records.rows[0]['one'] === 1, 'data is not 1');
      clearTimeout(to);
      start();
    },

    errback: function(err) {

      ok(true, "errback was called");
      equal(err[0].length, 5, "errorval: "+err[0]);
      clearTimeout(to);
      start();
    }
  });

  // ends async test at 2 seconds.
  var to = setTimeout(function() {
    start();
  }, 2000);

});


// use args param
//
asyncTest('use args 2', 5, function () {

  this.e.query({

    q : 'SELECT %s as one, %s as two',
    format: 'json-easy',
    args: [1, 'dos'],

    callback: function (resp) {

      ok(typeof resp === 'object', 'response is object'); // 0th assert
      ok(resp.status[1].toLowerCase() == 'ok', 'status is not ok: '+resp.status[1]); // 1st assert
      ok(resp.row_count[0] > 0, 'data row found');
      ok(resp.records.rows[0]['one'] === 1, 'data is not 1');
      ok(resp.records.rows[0]['two'] === 'dos', 'data is not "dos"');
      clearTimeout(to);
      start();
    },

    errback: function(err) {

      ok(true, "errback was called");
      equal(err[0].length, 5, "errorval: "+err[0]);
      clearTimeout(to);
      start();
    }
  });

  // ends async test at 2 seconds.
  var to = setTimeout(function() {
    start();
  }, 2000);

});


// use cookies
//
asyncTest('use cookies ', 5, function () {

  $.cookie('ck','abc');
  $.cookie('ck1','def');

  this.e.query({

    q : 'SELECT %{ck} as one, %{ck1} as two',
    format: 'json-easy',
    args: [1, 'dos'],

    callback: function (resp) {

      ok(typeof resp === 'object', 'response is object'); // 0th assert
      ok(resp.status[1].toLowerCase() == 'ok', 'status is not ok: '+resp.status[1]); // 1st assert
      ok(resp.row_count[0] > 0, 'data row found');
      ok(resp.records.rows[0]['one'] === 'abc', 'data is not "abc" ');
      ok(resp.records.rows[0]['two'] === 'def', 'data is not "def" ');
      clearTimeout(to);
      start();
    },

    errback: function(err) {

      ok(true, "errback was called");
      ok(err[0].length >= 3, "errorval: "+err[0]);
      ok(false, 'errresp'+err[1]);
      clearTimeout(to);
      start();
    }
  });

  // ends async test at 2 seconds.
  var to = setTimeout(function() {
    start();
  }, 2000);

});


// use namedParams param
//
asyncTest('use namedParams', 5, function () {

  this.e.query({

    q : 'SELECT %(un) as one, %(der) as two',
    format: 'json-easy',
    namedParams: {'un':1, 'der':'dos'},

    callback: function (resp) {

      ok(typeof resp === 'object', 'response is object'); // 0th assert
      ok(resp.status[1].toLowerCase() == 'ok', 'status is not ok: '+resp.status[1]); // 1st assert
      ok(resp.row_count[0] > 0, 'data row found');
      ok(resp.records.rows[0]['one'] === 1, 'data is not 1');
      ok(resp.records.rows[0]['two'] === 'dos', 'data is not "dos"');
      clearTimeout(to);
      start();
    },
    errback: function(err) {

      ok(true, "errback was called");
      equal(err[0].length, 5, "errorval: "+err[0]);
      clearTimeout(to);
      start();
    }
  });

  // ends async test at 2 seconds.
  var to = setTimeout(function() {
    start();
  }, 2000);

});


// use namedParams Date param
//
asyncTest('use namedParams Date', 3, function () {

  var q = 'CREATE TEMP TABLE t ( t TIMESTAMP );\n'+
          'INSERT INTO t (t) VALUES (%(ts));',
      dt = new Date();

  this.e.query({

    q : q,
    format: 'json-easy',
    namedParams: { 'ts': dt.toISOString() },

    callback: function (resp) {

      ok(typeof resp === 'object', 'response is object'); // 0th assert
      ok(resp.status[1].toLowerCase() == 'ok', 'status is not ok: '+resp.status[1]); // 1st assert
      ok(resp.result_sets[1].row_count[0] > 0, 'data row found');
      clearTimeout(to);
      start();
    },

    errback: function(err) {

      ok(true, "errback was called");
      clearTimeout(to);
      start();
    }
  });

  // ends async test at 2 seconds.
  var to = setTimeout(function() {
    start();
  }, 2000);

});


// use namedParams Date param, and get date value back
//
asyncTest('use namedParams Date & SELECT', 4, function () {

    var q = 'CREATE TEMP TABLE t ( t TIMESTAMP );\n'+
            'INSERT INTO t (t) VALUES (%(ts));\n' +
            'SELECT * FROM t;',
        dt = new Date();

    this.e.query({

        q : q,
        format: 'json-easy',
        namedParams: { 'ts': dt.toISOString() },

        callback: function (resp) {

            ok(typeof resp === 'object', 'response is object'); // 0th assert
            ok(resp.status[1].toLowerCase() == 'ok', 'status is not ok: ' + resp.status[1]); // 1st assert
            ok(resp.result_sets[1].row_count[0] > 0, 'data row found');
            var res = resp.result_sets[2].records;
            ok(res.rows.length > 0, 'records were returned');
            clearTimeout(to);
            start();
        },

        errback: function(err) {

            ok(true, "errback was called");
            clearTimeout(to);
            start();
        }
    });

    // ends async test at 2 seconds.
    var to = setTimeout(function() {
        start();
    }, 2000);

});


// use namedParams Date param, and get date value back
//
asyncTest('use true Date & SELECT', 4, function () {

    var q = 'CREATE TEMP TABLE t ( t TIMESTAMP );\n'+
            'INSERT INTO t (t) VALUES (%(ts));\n' +
            'SELECT * FROM t;',
        dt = new Date();

    this.e.query({

        q : q,
        format: 'json-easy',
        namedParams: { 'ts': dt },

        callback: function (resp) {

            ok(typeof resp === 'object', 'response is object'); // 0th assert
            ok(resp.status[1].toLowerCase() == 'ok', 'status is not ok: ' + resp.status[1]); // 1st assert
            ok(resp.result_sets[1].row_count[0] > 0, 'data row found');
            var res = resp.result_sets[2].records;
            ok(res.rows.length > 0, 'records were returned');
            clearTimeout(to);
            start();
        },

        errback: function(err) {

            ok(true, "errback was called " + err[0] + ' ' + err[1]);
            clearTimeout(to);
            start();
        }
    });

    // ends async test at 2 seconds.
    var to = setTimeout(function() {
        start();
    }, 2000);

});


// use namedParams Date param - fail on bad format
//
asyncTest('use namedParams Date - fail', 2, function () {

  var q = 'CREATE TEMP TABLE t ( t TIMESTAMP );\n'+
          'INSERT INTO t (t) VALUES (%(ts));',
      dt = 'foo';

  this.e.query({

    q : q,
    format: 'json-easy',
    namedParams: { 'ts': dt },

    callback: function (resp) {

      ok(false, 'callback called');
      clearTimeout(to);
      start();
    },

    errback: function(err) {

      ok(true, "errback was called");
      equal(err[0], '22007', "errorval: " + err[0]);
      clearTimeout(to);
      start();
    }
  });

  // ends async test at 2 seconds.
  var to = setTimeout(function() {
    start();
  }, 2000);

});


// do SELECT query form way
var form = "<form id=\"qunit_form\" method='post' enctype=\"multipart/form-data\">"+
           "<input name=\"q\" value=\"SELECT 99 AS col\" />"+
           "</form>";


module('SQLEngine Form tests', {

  setup: function () {

    this.e = new SQLEngine(demo_r_role,'-',domain);
    $('#qunit_form').remove();
    $('body').append(form);
  },

  teardown: function () {

    $('#qunit_form').remove();
    this.e = null;
    equal($('#qunit_form').length, 0, 'test form not cleaned up');
  }
});

// verify setup is ok
test('SQLEngine form setup verification', function() {

  ok(this.e, 'engine defined');
  ok(this.dontfind === undefined, 'engine does not have "dontfind"');
  equal($('#qunit_form').length, 1, 'test form appended '+$('#qunit_form').length);
});

// form select
asyncTest('form SELECT', 4+1, function() {

    var that = this;

    that.e.queryByForm({

      "formId": "qunit_form",

      callback: function (resp) {

        ok(typeof resp === 'object', 'response is object'); // 0th assert
        ok(resp.status[1].toLowerCase() == 'ok', 'status is not ok: '+resp.status[1]); // 1st assert
        ok(resp.row_count[0] > 0, 'data row found');
        ok(resp.records.rows[0][0] === 99, 'data is not 99: '+resp.records.rows[0]['col']);
        start();
      }
    });

    $('#qunit_form').rdbhostSubmit();
});



/*
// form select
if ( isCORSversion ) {

  test('form SELECT multi ****SKIPPED***', function() { ok(true,'skipped') } );
}
else {

  asyncTest('form SELECT multi', 8+1, function() {

    var that = this,
        ct = 0;

    that.e.queryByForm({

      "formId": "qunit_form",

      callback: function (resp) {

        ok(typeof resp === 'object', 'response is object'); // 0th assert
        ok(resp.status[1].toLowerCase() == 'ok', 'status is not ok: '+resp.status[1]); // 1st assert
        ok(resp.row_count[0] > 0, 'data row found');
        ok(resp.records.rows[0][0] === 99, 'data is not 99: '+resp.records.rows[0]['col']);
        ct = ct+1;

        if ( ct > 1 )
          start();
      }
    });

    $('#qunit_form').rdbhostSubmit();
    setTimeout(function() {

      $('#qunit_form').rdbhostSubmit();
    },10000);
  });
}

*/


// form select with promise
asyncTest('form SELECT promise', 5+1, function() {

    var that = this;

    var p = that.e.queryByForm({

      "formId": "qunit_form",

      callback: function (resp) {

        ok(typeof resp === 'object', 'response is object'); // 0th assert
        ok(resp.status[1].toLowerCase() == 'ok', 'status is not ok: '+resp.status[1]); // 1st assert
        ok(resp.row_count[0] > 0, 'data row found');
        ok(resp.records.rows[0][0] === 99, 'data is not 99: '+resp.records.rows[0]['col']);
        return resp;
      }
    });

    p.done(function(a) {
      ok(a, 'promise done called');
        start();
    });

    $('#qunit_form').rdbhostSubmit();
});


// form select with promise only
asyncTest('form SELECT promise only', 5+1, function() {

    var that = this;

    var p = that.e.queryByForm({

        "formId": "qunit_form"
    });

    p.done(function(resp) {

        ok(typeof resp === 'object', 'response is object'); // 0th assert
        ok(resp.status[1].toLowerCase() == 'ok', 'status is not ok: '+resp.status[1]); // 1st assert
        ok(resp.row_count[0] > 0, 'data row found');
        ok(resp.records.rows[0][0] === 99, 'data is not 99: '+resp.records.rows[0][0]);

        ok(resp, 'promise done called');
        start();
    });

    $('#qunit_form').rdbhostSubmit();
});


// form select with error
asyncTest('form SELECT error', 2+1, function() {

    var that = this;

    $('#qunit_form').find('input').val('SELECTY 1');

    that.e.queryByForm({

        "formId": "qunit_form",

        errback: function (err) {

              console.log(err[0]);
              console.log(err[1]);
              ok(typeof err[1] === typeof 'o', 'response is string'); // 0th assert
              ok(err[0].length === 5, 'error code not len 5: '+err[0]); // 1st assert
              start();
            },
        callback: function(resp) {
              ok(false,'callback called');
            }
      });

    $('#qunit_form').rdbhostSubmit();
});


// form select with error w/ promise
asyncTest('form SELECT error - promise', 3+1, function() {

    var that = this;

    $('#qunit_form').find('input').val('SELECTY 1');

    var p = that.e.queryByForm({

      "formId": "qunit_form",

      errback: function (err) {

        console.log(err[0]);
        console.log(err[1]);
        ok(typeof err[1] === typeof 'o', 'response is string'); // 0th assert
        ok(err[0].length === 5, 'error code not len 5: '+err[0]); // 1st assert
        return ['abc','def'];
      },
      callback: function(resp) {
        ok(false,'should not happen');
      }
    });

    p.fail(function(m,msg) {
      ok(m,'promise fail called');
      start();
    });

    $('#qunit_form').rdbhostSubmit();
});



/*
*
*/

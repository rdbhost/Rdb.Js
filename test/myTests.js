
/*
*
* tests for the SQLEngine
*
*
*/
module('SQLEngine pre-test');
var domain = 'dev.rdbhost.com';

// create engine
test('createEngine', function() {
  var e = new SQLEngine(demo_r_role,'-',domain);
  ok(e, 'SQLEngine created');
  ok(e.query, 'engine has query method ');
  ok(typeof e.query === 'function', 'e.query is type: '+(typeof e.query));
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
            ok(resp.status[1].toLowerCase() == 'ok', 'status is not ok: '+resp.status[1]); // 1st assert
            ok(resp.row_count[0] > 0, 'data row found');
            ok(resp.records.rows[0]['one'] === 1, 'data is '+resp.records.rows[0]['one']);
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
asyncTest('ajax SELECT error', 2, function() {

  this.e.query({
      q: "SELECTY 1 as one",
      format: 'json-easy',
      errback: function(err, resp) {
            ok(true, "errback was called");
            equal(err.length, 5, "errorval: "+err);
            start();
          },
      callback: function (resp) {
            start();
          }
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


asyncTest('form SELECT', 4+1, function() {

  var that = this;
  setTimeout(function () {
    // timeout allows for rpc iframes to be setup.

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
    }, 10);
});



asyncTest('form SELECT error', 2+1, function() {

  var that = this;
  setTimeout(function () {
    // timeout allows for rpc iframes to be setup.

    $('#qunit_form input').val('SELECTY 1');
    that.e.queryByForm({
        "formId": "qunit_form",
        errback: function (err, resp) {
              console.log(err);
              console.log(resp);
              ok(typeof resp === typeof 'o', 'response is string'); // 0th assert
              ok(err.length === 5, 'error code not len 5: '+err); // 1st assert
              start();
            }
      });
    $('#qunit_form').rdbhostSubmit();
    }, 10);
});




/*
*
* tests for the jQuery addin
*
*/

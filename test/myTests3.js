

/*
*
* tests for the jQuery addin
*
*/

var tmpEngine = new SQLEngine(demo_r_role,'-',domain),
    isCORSversion = ~tmpEngine.version.indexOf('cors');
tmpEngine = null;


module('rdbhost utils plugin pre-test', {
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




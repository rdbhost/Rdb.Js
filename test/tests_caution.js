
module('Login tests', {

  setup: function () {

    this.e = new SQLEngine(demo_r_role, '-', domain);
  },

  teardown: function () {

    this.e = null;
  }
});


asyncTest('login ajax fail', 2+0, function() {

  this.e.loginAjax({

    'email': 'abc',
    'password': 'def',

    errback: function (err) {

      console.log(err[0]);
      console.log(err[1]);
      ok(typeof err[1] === typeof 'o', 'response is string'); // 0th assert
      ok(err[0].length, 'error code: '+err[0]); // 1st assert
      start();
    },

    callback: function(resp) {
      ok(false,'should not happen');
    }
  });

});

var email = 'demo@travelbyroad.net',
    pass = '';  // provide for valid test

if ( email && pass ) {

  asyncTest('login ajax succeed', 2+0, function() {

    this.e.loginAjax({

      'email': email,
      'password': pass,

      errback: function (err, resp) {

        ok(false,'should not happen');
        start();
      },

      callback: function(resp) {

        console.log(resp);
        ok(typeof resp === 'object', 'response is object');
        ok(resp.row_count, 'row_count: '+resp.row_count);
        start();
      }
    });

  });
}
else {
  test('login ajax succeed ***SKIPPED***', function() { ok(true) });
}

//

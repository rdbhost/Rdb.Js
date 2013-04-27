
module('Login tests', {

  setup: function () {

    this.e = new SQLEngine(demo_r_role, '-', domain);
  },

  teardown: function () {

    this.e = null;
  }
});


asyncTest('login ajax', 2+0, function() {

  this.e.loginAjax({

    'email': 'abc',
    'password': 'def',

    errback: function (err, resp) {

      console.log(err);
      console.log(resp);
      ok(typeof resp === typeof 'o', 'response is string'); // 0th assert
      ok(err.length, 'error code: '+err); // 1st assert
      start();
    },

    callback: function(resp) {
      ok(false,'should not happen');
    }
  });

});


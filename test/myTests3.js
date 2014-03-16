

/*
*
* tests for the jQuery addin
*
*/

var gAcctEmail = gPassword = null;



module('rdbhost utils plugin pre-test', {

  setup: function () {
      $.rdbHostConfig( {
        'domain': domain,
        'format': 'json-easy',
        'userName': demo_p_role,
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
asyncTest('verifysetup', 1, function() {

  $.withResults({

    'q': 'SELECT 1 AS one',

    'callback': function(json) {
          console.log(json);
          equal(json.status[1],'OK', 'json has data');
          start();
        },
    'errback': function(errArry) {
          if ( errArry[0] === 'rdb10' ) {
              ok('true','not preauthorized');
          }
          else {
              ok(false,'should not see '+errArry);
          }
          start();
        }
  })
});



asyncTest('superLogin', 4, function() {

    var demo_password = gPassword = gPassword || prompt('provide password');

    Rdbhost.superLogin({

        email: demo_email,
        password: demo_password,

        callback: function(json) {

            ok(json.preauth[0] === 'p0000000012');
            ok(json.super[0] === 's0000000012');
            ok(json.preauth[1] === '');
            ok(json.super[1].length > 25);
            start();
        }
    });
});



asyncTest('superLogin - dialog', 4, function() {

    var demo_password = gPassword = gPassword || prompt('provide password');
    Rdbhost._clearAuthcode();

    Rdbhost.superLogin({

        email: demo_email,
        password: '',

        callback: function(json) {

            ok(json.preauth[0] === 'p0000000012');
            ok(json.super[0] === 's0000000012');
            ok(json.preauth[1] === '');
            ok(json.super[1].length > 25);
            start();
        },

        errback: function(err) {

            ok(false);
            start();
        }
    });

    setTimeout(function() {
        $('#rdbhost-super-login-form [name="password"]').val(demo_password);
        $('#rdbhost-super-login-form').submit();
    },5);

});


asyncTest('superLogin - dialog - fail', 1, function() {

    var demo_password = gPassword = gPassword || prompt('provide password');
    Rdbhost._clearAuthcode();

    Rdbhost.superLogin({

        email: demo_email,
        password: '',

        callback: function(json) {

            ok(false, '');
            start();
        },

        errback: function(err) {

            ok(~err[1].indexOf('bad email'));
            start();
        }
    });

    setTimeout(function() {
        $('#rdbhost-super-login-form [name="password"]').val(demo_password+'-not');
        $('#rdbhost-super-login-form').submit();
    },5);

});



// verify superPostData
asyncTest('verify superPostData - promise', 2, function() {

    var demo_password = gPassword = gPassword || prompt('provide password');
    Rdbhost._clearAuthcode();

    var p = Rdbhost.superPostData({

        userName: demo_s_role,

        'q': 'SELECT 1 AS one',
        'callback' : function(json) {
            console.log(json);
            equal(json.status[1], 'OK', 'json has data');
            return 1;
        },

        'errback': function(json) {
            ok(true,'maybe login error');
            return true;
        }
    });

    p.done(function(m) {
        ok(m,'promise done called');
        start();
    });
    p.fail(function(m) {
        ok(m,'promise fail called');
        start();
    });

    setTimeout(function() {
        $('#rdbhost-super-login-form [name="email"]').val('js@travelbyroad.net');
        $('#rdbhost-super-login-form [name="password"]').val(demo_password);
        $('#rdbhost-super-login-form').submit();
    },5);

});




// do SELECT query form way
var form = "<form id=\"qunit_form2\" method='post' enctype=\"multipart/form-data\">"+
    "<input name=\"q\" value=\"SELECT 199 AS col\" />"+
    "</form>";

module('Rdbhost.superPostFormData tests', {

    setup: function () {

        $.rdbHostConfig( {
            'domain': domain,
            'format': 'json-easy',
            'userName': demo_s_role,
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
test('Rdbhost.superPostFormData setup verification', function() {
    equal($('#qunit_form2').length, 1, 'test form appended '+$('#qunit_form2').length);
});


asyncTest('R.superPostFornData dialog', 4+1, function() {

    var demo_password = gPassword = gPassword || prompt('provide password');
    Rdbhost._clearAuthcode();

    Rdbhost.superPostFormData($('#qunit_form2'), {

    userName: demo_s_role,
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

    setTimeout(function() {
        $('#rdbhost-super-login-form [name="email"]').val('js@travelbyroad.net');
        $('#rdbhost-super-login-form [name="password"]').val(demo_password);
        $('#rdbhost-super-login-form').submit();
    },5);

});



module('Rdbhost.emailWebmaster tests', {

    setup: function () {

        $.rdbHostConfig( {
            'domain': domain,
            'format': 'json-easy',
            'userName': demo_p_role,
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


asyncTest('Rdbhost.emailWebmaster test', 4, function() {

    var demo_password = gPassword = gPassword || prompt('provide password');
    Rdbhost._clearAuthcode();

    var p = Rdbhost.emailWebmaster({

        bodyString: 'test email',
        replyTo: 'dkeeney@travelbyroad.net',
        subject: 'test subject'
    });

    p.then(function (resp) {

        ok(typeof resp === 'object', 'response is object'); // 0th assert
        ok(resp.status[1].toLowerCase() == 'ok', 'status is not ok: '+resp.status[1]); // 1st assert
        ok(resp.row_count[0] > 0, 'data row found');
        ok(resp.records.rows[0]['result'] === 'Success', 'data is not Success: '+resp.records.rows[0]['result']);
    }, function(errArry) {

        ok(false,'should not see this '+errArry);
    })

    .then(function() { start(); },
          function() { start(); }
    );

    setTimeout(function _tof() {
        if ( $('#rdbhost-super-login-form').length ) {

            $('#rdbhost-super-login-form [name="email"]').val('js@travelbyroad.net');
            $('#rdbhost-super-login-form [name="password"]').val(demo_password);
            $('#rdbhost-super-login-form').submit();
        }
        else {
            setTimeout(_tof, 50);
        }
    },250);

});


asyncTest('Rdbhost.emailAllUsers test', 4, function() {

    var demo_password = gPassword = gPassword || prompt('provide password');
    Rdbhost._clearAuthcode();

    var p = Rdbhost.emailAllUsers({
        emailid: 'test'
    });

    p.then(function (resp) {

        ok(typeof resp === 'object', 'response is object'); // 0th assert
        ok(resp.status[1].toLowerCase() == 'ok', 'status is not ok: '+resp.status[1]); // 1st assert
        ok(resp.row_count[0] > 0, 'data row found');
        ok(resp.records.rows[0]['result'] === 'Success', 'data is not Success: '+resp.records.rows[0]['result']);
    },
    function(errArry) {

        ok(false,'should not see this '+errArry[1]);
    })

    .then(function() { start(); },
        function() { start(); }
    );

    setTimeout(function _tof() {
        if ( $('#rdbhost-super-login-form').length ) {

            $('#rdbhost-super-login-form [name="email"]').val('js@travelbyroad.net');
            $('#rdbhost-super-login-form [name="password"]').val(demo_password);
            $('#rdbhost-super-login-form').submit();
        }
        else {
            setTimeout(_tof, 50);
        }
    },250);
});



module('R.creditCardCharge tests', {

  setup: function () {

    $.rdbHostConfig( {
      'domain': domain,
      'format': 'json-easy',
      'userName': demo_p_role,
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


asyncTest('R.ccCharge test (refused)', 4, function() {

    var demo_password = gPassword = gPassword || prompt('provide password');
    Rdbhost._clearAuthcode();

    var p = Rdbhost.chargeCard({

    amount: 10.09,
    cc_num: '4242424242424000',
    cc_cvc: '100',
    exp_mon: '10',
    exp_yr: '18',
    cardholder: 'Joe User'
  });

  p.then(function (resp) {

    ok(typeof resp === 'object', 'response is object'); // 0th assert
    ok(resp.status[1].toLowerCase() == 'ok', 'status is not ok: '+resp.status[1]); // 1st assert
    ok(resp.row_count[0] > 0, 'data row found');
    var firstResult = resp.records.rows[0]['result'];
    ok( ~firstResult.indexOf('card number is incorrect'), 'card number is bad '+resp.records.rows[0]['result']);
  }, function(errArry) {

    ok(false,'should not see this '+errArry[1]);
  })
  .then(function() { start(); },
      function() { start(); }
  );

    setTimeout(function _tof() {
        if ( $('#rdbhost-super-login-form').length ) {

            $('#rdbhost-super-login-form [name="email"]').val('js@travelbyroad.net');
            $('#rdbhost-super-login-form [name="password"]').val(demo_password);
            $('#rdbhost-super-login-form').submit();
        }
        else {
            setTimeout(_tof, 50);
        }
    },250);
});


asyncTest('R.ccCharge test (good)', 4, function() {

    var demo_password = gPassword = gPassword || prompt('provide password');
    Rdbhost._clearAuthcode();

    var p = Rdbhost.chargeCard({

        amount: 10.09,
        cc_num: '4242424242424242',
        cc_cvc: '100',
        exp_mon: '10',
        exp_yr: '18',
        cardholder: 'Joe User'
    });

    p.then(function (resp) {

        ok(typeof resp === 'object', 'response is object'); // 0th assert
        ok(resp.status[1].toLowerCase() == 'ok', 'status is not ok: '+resp.status[1]); // 1st assert
        ok(resp.row_count[0] > 0, 'data row found');
        var firstResult = resp.records.rows[0]['result'];
        ok( firstResult.toLowerCase() === 'success', 'Success? '+resp.records.rows[0]['result']);
    },
    function(errArry) {

        ok(false,'should not see this '+errArry[1]);
     })
    .then(function() { start(); },
        function() { start(); }
    );

    setTimeout(function _tof() {
        if ( $('#rdbhost-super-login-form').length ) {

            $('#rdbhost-super-login-form [name="email"]').val('js@travelbyroad.net');
            $('#rdbhost-super-login-form [name="password"]').val(demo_password);
            $('#rdbhost-super-login-form').submit();
        }
        else {
            setTimeout(_tof, 50);
        }
    },250);
});


/*
asyncTest('research', 2, function() {

    var $dfr = $.Deferred();
    setTimeout(function() {
        $dfr.resolve(1);
    }, 500);

    var $pr = $dfr.promise();

    $pr.then(function(c) {
        ok(c===1, '1 ok');
        return c;
    })
    .then(function(b) {
        var $dfrN = $.Deferred();
        setTimeout(function() {
            $dfrN.resolve(2);
        },5000);
        return $dfrN.promise();
    })
    .then(function(a) {
        ok(a===2, '2 ok')
    })
    .then(function() { start() });
});
*/


module('R.provideSuperPOST tests', {

  setup: function () {
    $.rdbHostConfig( {
      'domain': domain,
      'format': 'json-easy',
      'userName': demo_s_role,
      accountNumber: acct_number,
      'authcode': '-'
    });
  },

  teardown: function () {
    $.rdbHostConfig( {
      'domain': undefined,
      'format': undefined,
      'userName': undefined,
      accountNumber: undefined,
      'authcode': '-'
    });
  }
});


/* Rdbhost.provideSuperPOST ,  */
asyncTest('R.provideSuperPOST test ', 9, function() {

    var demo_password = gPassword = gPassword || prompt('provide password');
    Rdbhost._clearAuthcode();

    var opts = {
        q: 'SELECT 1'
    };
  var d = Rdbhost.provideSuperPOST(opts, function(pd) {

    var u = pd.url,
        d = pd.data;

    ok(!~u.indexOf('format'), 'url has no format string');
    ok(!~u.indexOf('SELECT'), 'url has no query string');
    ok(~u.indexOf('rdbhost.'), 'url has host string');
    ok(!~u.indexOf(' '), 'has no white space');
    ok(~u.indexOf(demo_s_role), 'rolename in url');

    ok(d.q, 'query in data');
    ok(!d.arg000, 'no arg000 in data');
    ok(!d.arg001, 'no arg001 in data');
    ok(!d.argtype000, 'no argtype000 in data');

    start();
  });

    setTimeout(function() {
        $('#rdbhost-super-login-form [name="email"]').val('js@travelbyroad.net');
        $('#rdbhost-super-login-form [name="password"]').val(demo_password);
        $('#rdbhost-super-login-form').submit();
    },5);

});


/* Rdbhost.provideSuperPOST ,  */
asyncTest('R.provideSuperPOST test promise ', 8, function() {

  var opts = {
    q: 'SELECT 1'
  };
  var d = Rdbhost.provideSuperPOST(opts);
  d.then(function(pd) {

    var u = pd.url,
      d = pd.data;

    ok(!~u.indexOf('SELECT'), 'url has no query string');
    ok(~u.indexOf('rdbhost.'), 'url has host string');
    ok(!~u.indexOf(' '), 'has no white space');
    ok(~u.indexOf(demo_s_role), 'rolename in url');

    ok(d.q, 'query in data');
    ok(!d.arg000, 'no arg000 in data');
    ok(!d.arg001, 'no arg001 in data');
    ok(!d.argtype000, 'no argtype000 in data');

    start();
  });
});


/*
asyncTest('stalling for authcode timeout', 0, function() {

  setTimeout(start, 10000);
});


*/
/* Rdbhost.provideSuperPOST ,  *//*

asyncTest('Rdbhost.provideSuperPOST test promise err ', 2, function() {

  var opts = {
    q: 'SELECT 1',
    accountNumber: acct_number+1 // introduce error
  };
  var d = Rdbhost.provideSuperPOST(opts);
  d.fail(function(pd) {

    var code = pd[0], msg = pd[1];

    ok(code, 'error code returned');
    ok(msg, 'error msg returned');

    start();
  });
});
*/


/* Rdbhost.provideSuperPOST ,  */
asyncTest('R.provideSuperPOST test w args', 12, function() {

  var opts = {
    q: 'SELECT 1',
    args: [1, 'abc']
  };
  var d = Rdbhost.provideSuperPOST(opts, function(pd) {

    var u = pd.url,
        d = pd.data;

    ok(!~u.indexOf('format'), 'url has no format string');
    ok(!~u.indexOf('SELECT'), 'url has no query string');
    ok(~u.indexOf('rdbhost.'), 'url has host string');
    ok(!~u.indexOf(' '), 'has no white space');
    ok(~u.indexOf(demo_s_role), 'rolename in url');

    ok(d.q, 'query in data');
    ok(d.arg000 === 1, 'arg000 is correct in data');
    ok(d.arg001 === 'abc', 'arg001 is correct in data');
    ok(d.argtype000 === 'NUMBER', 'argtype000 is correct in data '+ d.argtype000);
    ok(d.argtype001 === 'STRING', 'argtype001 is correct in data ' + d.argtype001);
    ok(!d.arg002, 'no arg002 in data');
    ok(!d.argtype002, 'no argtype002 in data');

    start();
  });
});


/* Rdbhost.provideSuperPOST ,  */
asyncTest('R.provideSuperPOST test w AJAX ', 3, function() {

  var opts = {
    q: 'SELECT 1',
    args: [1, 'abc'],
    format: 'json-easy'
  };
  var d = Rdbhost.provideSuperPOST(opts, function(u) {

    var p = $.ajax({
      method: 'POST',
      type: 'POST', // placate Zepto
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
});


/* Rdbhost.provideSuperPOST ,  */
asyncTest('R.provideSuperPOST err test w AJAX ', 2, function() {

  var opts = {
    userName: 'super',
    authcode: 'abcdef',
    q: 'SELECT 1',
    args: [1, 'abc'],
    format: 'json-easy'
  };
  var d = Rdbhost.provideSuperPOST(opts, function(u) {

    var p = $.ajax({
      method: 'POST',
      type: 'POST', // placate Zepto
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
      ok(data.error[1] && ~data.error[1].indexOf('Auth fail') || ~data.error[1].indexOf('bad auth'),
        'error occurred'+data.error[1]);
      start();
    });
  });
});




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
    'errback': function(err,errmsg) {
          if ( err === 'rdb10' ) {
              ok('true','not preauthorized');
          }
          else {
              ok(false,'should not see');
          }
          start();
        }
  })
});



asyncTest('superLogin', 4, function() {

    var demo_password = gPassword || prompt('provide password');

    $.superLogin({

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



// verify superPostData
asyncTest('verify superPostData - promise', 2, function() {

    var p = $.superPostData({

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
});




// do SELECT query form way
var form = "<form id=\"qunit_form2\" method='post' enctype=\"multipart/form-data\">"+
    "<input name=\"q\" value=\"SELECT 199 AS col\" />"+
    "</form>";

module('$.superPostFormData tests', {

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
test('$.superPostFormData setup verification', function() {
    equal($('#qunit_form2').length, 1, 'test form appended '+$('#qunit_form2').length);
});


asyncTest('$.superPostFornData test', 4+1, function() {

    $.superPostFormData($('#qunit_form2'), {

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
});



module('$.emailWebmaster tests', {

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


asyncTest('$.emailWebmaster test', 4, function() {

    var p = $.emailWebmaster({

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

        ok(false,'should not see this '+errArry[1]);
    })

    .then(function() { start(); },
          function() { start(); }
    );
});


asyncTest('$.emailAllUsers test', 4, function() {

    var p = $.emailAllUsers({
        emailid: 'test'
    });

    p.then(function (resp) {

        ok(typeof resp === 'object', 'response is object'); // 0th assert
        ok(resp.status[1].toLowerCase() == 'ok', 'status is not ok: '+resp.status[1]); // 1st assert
        ok(resp.row_count[0] > 0, 'data row found');
        ok(resp.records.rows[0]['result'] === 'Success', 'data is not Success: '+resp.records.rows[0]['result']);
    }, function(errArry) {

        ok(false,'should not see this '+errArry[1]);
    })

    .then(function() { start(); },
        function() { start(); }
    );
});



module('$.creditCardCharge tests', {

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


asyncTest('$.ccCharge test (refused)', 4, function() {

  var p = $.chargeCard({

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
});


asyncTest('$.ccCharge test (good)', 4, function() {

  var p = $.chargeCard({

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
  }, function(errArry) {

    ok(false,'should not see this '+errArry[1]);
  })
  .then(function() { start(); },
      function() { start(); }
  );
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




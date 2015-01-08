

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



// verify preauthPostData
asyncTest('verify preauthPostData - promise', 2, function() {

    //var demo_password = gPassword = gPassword || prompt('provide password');
    Rdbhost._clearAuthcode();

    var p = Rdbhost.preauthPostData({

        userName: demo_p_role,

        'q': 'SELECT 1 AS one -- ' + Math.random(),
        'callback' : function(json) {
            console.log(json);
            equal(json.status[1], 'OK', 'json has data');
            return json;
        },

        'errback': function(json) {
            ok(false,'maybe login error');
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
        $('#rdbhost-super-login-form [name="email"]').val(demo_email);
        $('#rdbhost-super-login-form [name="password"]').val('');
        $('#rdbhost-super-login-form').rdbhostSubmit();
    },5);

});




// do SELECT query form way
var form = "<form id=\"qunit_form2\" method='post' enctype=\"multipart/form-data\">"+
    "<input name=\"q\" value=\"SELECT 199 AS col --~rand\" />"+
    "</form>";

module('Rdbhost.preauthPostFormData tests', {

    setup: function () {

        $.rdbHostConfig( {
            'domain': domain,
            'format': 'json-easy',
            'userName': demo_p_role,
            'authcode': '-'
        });

        $('#qunit_form2').remove();
        var formT = form.replace('~rand', Math.random());
        $('body').append(formT);
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
test('Rdbhost.preauthPostFormData setup verification', function() {
    equal($('#qunit_form2').length, 1, 'test form appended '+$('#qunit_form2').length);
});


asyncTest('R.preauthPostFornData dialog', 4+1, function() {

    // var demo_password = gPassword = gPassword || prompt('provide password');
    Rdbhost._clearAuthcode();

    Rdbhost.preauthPostFormData($('#qunit_form2'), {

    userName: demo_p_role,
    format: 'json-easy',

    callback: function (resp) {

        ok(typeof resp === 'object', 'response is object'); // 0th assert
        ok(resp.status[1].toLowerCase() == 'ok', 'status is not ok: ' + resp.status[1]); // 1st assert
        ok(resp.row_count[0] > 0, 'data row found');
        ok(resp.records.rows[0]['col'] === 199, 'data is not 199: ' + resp.records.rows[0]['col']);
        start();
    },

    errback: function (resp) {

        ok(false, 'errback called');
        start();
    }
  });

  $('#qunit_form2').rdbhostSubmit();

    setTimeout(function() {
        $('#rdbhost-super-login-form [name="email"]').val(demo_email);
        $('#rdbhost-super-login-form [name="password"]').val('');
        $('#rdbhost-super-login-form').rdbhostSubmit();
    },5);

});



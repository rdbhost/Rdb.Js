
/*
*
* tests for rdbhost-angular.js
*
*/

var injector = angular.injector(['ng', 'rdbhost']);

module('rdbhost-angular tests', {
    setup: function() {
        this.$scope = injector.get('$rootScope').$new();
    }
});

test('MyCtrl', function() {
    var $controller = injector.get('$controller');
    $controller('MyCtrl', {
        $scope: this.$scope
    });
    equal(3, this.$scope.addTwo(1));
});

test('MyService', function() {
    var MyService = injector.get('MyService');
    equal(4, MyService.addThree(1));
});

module('SQLEngine pre-test');
//var domain = 'dev.rdbhost.com';

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

/*
*
*/

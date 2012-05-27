/*

    jquery.rdbhost.js
    
    A jquery plugin to access PostgreSQL databases on Rdbhost.com
  
    requires a (free) account at www.rdbhost.com to be useful.
    
    this module includes a class 'SQLEngine' for the database connection, and
      that class can be used by itself, aside from the plugins.  jQuery 1.4+
      is required, even when using the connection class without the plugin.
      
       
    the module adds four functions and three methods to the jQuery namespace.
    
    The four functions are $.rdbHostConfig, $.withResults, $.eachRecord, and
      $.postFormData.  The three methods are $.fn.populateTable,
      $.fn.populateForm, and $.fn.datadump.  There is also a $.postData alias
      to $.withResults
      
    $.rdbHostConfig takes an options object, and makes those options default for
      all subsequent functions and methods.
      
    $.withResults sends a query to the server, receives the data, and calls
      a callback with the received data.
      
    $.eachRecord is like $.withResults, in that it gets data from the server,
      but it extracts the rows from the data structure, and calls an eachrec
      callback for each record.  Each record is a javascript object, with a
      named attribute for each field.
      
    $.postFormData takes a form as input, submits that form to the server,
      receives the data returned, and provides it to the callback.
      The form fields must conform to the rdbhost protocol.
      
    Form fields
      The form *must* include either a 'q' or a 'kw' field.  It may also include
      'arg###', or 'argtype###' fields.  Argument fields are numbered like
      'arg000', 'arg001'... in order.  Argument type fields, 'argtype000'..
      must correspond to arg fields. Argument fields may be file fields.
      
	  The 'kw' field value allows you to invoke a query that is stored in the
	  'lookup.queries' table on the  server.  See website documentation for
	  details.
      
    $.fn.populateTable sends a query to the server, receives the data, and populates
      an html table with it.  If the element provided is not a table, a new
      table is inserted in it; if the element is an empty table, it is expanded
      with new rows, one per record, and if the table has a prototype row, that
      row is duplicated once per record, and the record data is placed in
      td elements based on class name matches. (a field named 'firstName' would
      put its value in a table cell like '<td class="firstName">').  A cell
      can have multiple classes, so adding field-name classes should not interfere
      with styling.
      
    $.fn.populateForm sends a query to the server, receives the data, selects the
      first record, and populates a form with it.  It attempts to match each field
      name to an input field with matching id, and then attempts to match an input
      field with matching class-name.
      
    $.fn.datadump is a diagnostic-aid that puts a formatted json-string of
      the data into the selected html elements.  It allows you to verify the
      data retrieval functionality before doing (much) html work.
      
*/

// isolate each easyXDM in its own namespace
var CONNECTIONS = {};

function createConnection(username,domain) {

  var uid = username.substring(1);
  var REMOTE = 'https://'+domain;

  assert(!CONNECTIONS[uid],'repeated namespace creation');
  CONNECTIONS[uid] = {};

  // ajaxRpc object is created one time, used by .SQLEngine.query() method
  CONNECTIONS[uid].ajaxRpc = new easyXDM.Rpc({
        local: "/static/~/easyxdm/name.html".replace('~',uid),
        swf: "/js/easyxdm/easyxdm.swf",
        remote: REMOTE + ("/static/~/easyxdm/cors/index.debug.html".replace('~',uid)),
        remoteHelper: REMOTE + ("/static/~/easyxdm/name.html".replace('~',uid))
    }, {
        remote: {
            request: {}
        }
    }
  );

  // remote rpc created for use by .queryByForm() method
  CONNECTIONS[uid].remoteRpc = new easyXDM.Rpc({
      remote: REMOTE + "/static/~/receiver_debug.html".replace('~',uid),
      swf: REMOTE + "/js/easyxdm/easyxdm.swf",
      remoteHelper: REMOTE + "/static/~/easyxdm/name.html".replace('~',uid)
    }, {
      local: {
          returnResponse: function(response) {
              CONNECTIONS[uid].handler(response);
            }
        }
    }
  );

  return uid;
}

function LoginFunction(uid, domain, container, start, onComplete) {
  // remote rpc created for use by .queryByForm() method
  var REMOTE = 'https://'+domain;
  if (typeof(container) === 'string') {
    container = document.getElementById(container);
  }

  function loadIFrame(remoteRpc, stuff, height, width) {
    if (stuff.substr(0,4) === 'http') {
      remoteRpc.loadIFrame(stuff, height, width);
    }
    else {
      remoteRpc.loadIFrameContent(stuff, height, width);
    }
  }

  var rpc = new easyXDM.Rpc({
      remote: REMOTE + "/static/~/receiver_debug.html".replace('~',uid),
      swf: REMOTE + "/js/easyxdm/easyxdm.swf",
      remoteHelper: REMOTE + "/static/~/easyxdm/name.html".replace('~',uid),
      container: container,
      onReady: function () {
            var h = parseInt(container.attributes.height.value),
                w = parseInt(container.attributes.width.value);
            var widgetFrame = container.getElementsByTagName('iframe')[0];
            widgetFrame.height = h;
            widgetFrame.width = w;
            loadIFrame(rpc, start, h-25, w-25);
          }
    }, {
      local: {
          returnResponse: function(response) {
              jsonResp = JSON.parse(response);
              onComplete(jsonResp);
              rpc.destroy();
            }
          },
      remote: {
          loadIFrame: {},
          loadIFrameContent: {}
        }
    }
  );
}


// SQL Engine that uses form for input, and hidden iframe for response
//   handles file fields 
//
function SQLEngine(userName, authcode, domain)
{
	// store engine config info
	var format = 'json-exdm',
      remote = 'https://'+domain,
      easyXDMAjaxHandle = userName.substring(1);
  if ( ! domain ) {
    domain = 'www.rdbhost.com';
  }
  if (CONNECTIONS[easyXDMAjaxHandle] === undefined) {
    createConnection(userName, domain);
  }

  // function to clean up entry forms
  function cleanup_form($form, target, action) {
    $form.find('.to-remove-later').remove();
    $form.attr('target',target);
    $form.attr('action',action);
  }

	// to add hidden field to form
	function add_hidden_field($form,nm,val) {
		var fld = $('<input type="hidden" class="to-remove-later" />');
		fld.attr('name',nm).val(val);
		$form.append(fld);
	}

	this.getQueryUrl = function(altPath) {
    if (altPath === undefined) { altPath = '/db/'+userName; }
    return remote + altPath;
	};
	this.getLoginUrl = function() {
		return this.getQueryUrl('/mbr/jslogin');
	};

	this.query = function(parms) 
	/* parms is object containing various options
		callback : function to call with data from successful query
		errback : function to call with error object from query failure
		q : the query string itself
		args : array of arguments (optional), must correspond with %s tokens
			  in query
		argtypes : array of python DB API types, one per argument
		plainTextJson : true if JSON parsing to be skipped, instead
				 returning the JSON plaintext
		format : 'json' or 'json-easy'
	*/
	{
		var callback = parms.callback,
		    errback = parms.errback,
		    args = parms.args || [];
		//var argtypes = parms.argtypes || [];

    var data = {
      q : parms.q,
      kw : parms.kw,
		  format : parms.format || format
    };
		
		// define default errback
		if (errback === undefined) {
			errback = function () {
				var arg2 = Array.apply(null,arguments);
				alert(arg2.join(', '));
			};
		}
		// if params are provided, convert to named form 'arg000', 'arg001'...
		if (args !== undefined) {
			for ( var i=0; i<args.length; i+=1 ) {
				var num = '000'+i;
				var nm = 'arg'+num.substr(num.length-3);
        data[nm] = args[i];
			}
		}

    var url = this.getQueryUrl();
    CONNECTIONS[easyXDMAjaxHandle].ajaxRpc.request({
        url : url,
        method : "POST",
        data: data
      },
      function(resp){
        if ( !parms.plainTextJson ) {
          try {
            resp.data = JSON.parse(resp.data);
            if (resp.data.status[0] == 'error') {
              errback("", resp.data.error);
            }
            else {
              callback(resp.data);
            }
          }
          catch (e) {
            errback(e, resp.data.error);
          }
        }
      },
      function(resp) {
        try {
          resp.data = JSON.parse(resp.data);
          errback("", resp.headers);
        }
        catch (e) {
          errback(e, resp.headers);
        }
      }
    );
	};
	
	
	this.queryRows = function(parms)
	/* parms is just like for query method, but callback gets row array and
	   header array, not whole data structure.
	   an additional param is 'incomplete', a function that is called
		 (with rows and header) when data set is truncated by 100 record limit
	*/
	{
		var callback = parms.callback,
		    incomplete_callback = parms.incomplete || callback;
		function cb(json) {
			var rows = json.records.rows || [],
			    status = json.status[0],
			    header = json.records.header || [];
			if (status === 'complete') {
				callback(rows,header);				
			}
			else if (status === 'incomplete') {
				incomplete_callback(rows, header);
			}
		}
		parms.callback = cb;
		this.query(parms);
	};

	this.queryByForm = function(parms)
	/* parms is object containing various options
		  formId : the id of the form with the data
		  callback : function to call with data from successful query
		  errback : function to call with error object from query failure
		  plainTextJson : true if JSON parsing to be skipped, in lieu of
				 returning the JSON plaintext
	  call this prior to form click, not from click handler.
	*/
	{
		var callback = parms.callback,
		    errback = parms.errback,
		    formId = parms.formId,
        plainTextJson = parms.plainTextJson;

    function cBack(response) {
      if ( !plainTextJson ) {
        try {
          response = JSON.parse(response);
          if (response.status[0] == 'error') {
            errback("", response.error);
          }
          else {
            callback(response);
          }
        }
        catch (e) {
          errback(e, response);
        }
      }
      else {
        callback(response);
      }
    }
    CONNECTIONS[easyXDMAjaxHandle].handler = cBack;

		var format = 'json-exdm', // parms.format || format;
		    targettag = 'request_target_'+userName.substring(1);
		// get form, return if not found
		var $form = $('#'+formId);
		if ($form.length<1) {
			return false;
		}
		// define default errback
		if (errback === undefined) {
			errback = function () {
				var arg2 = Array.apply(null,arguments);
				alert(arg2.join(', '));
			};
		}

		// init vars
		var dbUrl =  this.getQueryUrl();
    // save vals
		var target = $form.attr('target'),
		    action = $form.attr('action');
		// put password into form
		add_hidden_field($form,'authcode', authcode);
		// set format, action, and target
		add_hidden_field($form,'format',format);
		$form.attr('target',targettag);
		$form.attr('action',dbUrl);

    return true;
	};

	this.loginByForm = function(parms)
	/* parms is object containing various options
		formId : the id of the form with the data
		callback : function to call with data from successfull query
		errback : function to call with error object from query failure
		plainTextJson : true if JSON parsing to be skipped, in lieu of
				 returning the JSON plaintext
	*/
	{
		var callback = parms.callback,
		    errback = parms.errback,
		    formId = parms.formId;

    function cBack(response) {
      try {
        response = JSON.parse(response);
        callback(response);
      }
      catch (e) {
        errback(e, response);
      }
      // cleanup form
      cleanup_form($form, target, action);
    }
    CONNECTIONS[easyXDMAjaxHandle].handler = cBack;

		// get form, return if not found
		var $form = $('#'+formId);
		if ($form.length<1) {
			alert('form '+formId+' not found');
			return false;
		}
		// define default errback
		if (errback === undefined) {
			errback = function () {
				var arg2 = Array.apply(null,arguments);
				alert(arg2.join(', '));
			};
		}
		// init vars
		var dbUrl =  this.getLoginUrl();
    // save vals
		var target = $form.attr('target'),
		    action = $form.attr('action');
		// set format, action, and target
		add_hidden_field($form,'format',format);
		$form.attr('target',targettag);
		$form.attr('action',dbUrl);

    return true;
	};
} // end of SQLEngine class


/*
  following section defines some jQuery plugins
  
*/

(function ($,window) {
	
	// default generic callbacks
	//
	function errback(err,msg) {
		alert('<pre>'+err.toString()+': '+msg+'</pre>');
	}
	function dumper(json) {
		var str = JSON.stringify(json,null,4);
		alert(str);
	}
	
	//  configuration setting function
	//  saves defaults as attribute on the config function
	//
	var opts = {  errback : errback,
                callback : dumper,
                eachrec : undefined,
                domain : 'www.rdbhost.com',
                format : 'json-easy',
                userName : '',
                authcode : ''        };
	var rdbHostConfig= function (parms) {
    rdbHostConfig.opts = $.extend({}, opts, parms||{});
	};
	$.rdbHostConfig = rdbHostConfig;  // makes it a plugin


	/*
	    withResults - calls callback with json result object
	      or errback with error object
	  
	    param q : query to get data
	    param callback : function to call with json data
	    param errback : function to call in case of error
	*/
	var withResults = function(parms) {
		assert(arguments.length<=1, 'too many parms to withResults');
		var inp = $.extend({}, $.rdbHostConfig.opts, parms||{});
		var sqlEngine = new SQLEngine(inp.userName, inp.authcode, inp.domain);
		delete inp.userName; delete inp.authcode; delete inp.domain;
		sqlEngine.query(inp);
	};
	$.withResults = withResults;
	
	/*
	    eachRecord - calls 'eachrec' callback with each record,
	      or errback with error object
	  
	    param q : query to get data
	    param eachrec : function to call with each record
	    param errback : function to call in case of error
	*/
	var eachRecord = function(parms) {
		assert(arguments.length<=1, 'too many parms to eachRecord');
		var eachrec = parms.eachrec;
		delete parms.eachrec;
		assert(eachrec, 'eachrec not provided');
		function cback (json) {
			for (var r in json.records.rows) {
				eachrec(json.records.rows[r]);
			}
		}
		parms.callback = cback;
		$.withResults(parms);
	};
	$.eachRecord = eachRecord;

	/*
	    postFormData should be called on a form BEFORE form is submitted.
	
	    param q : query to post data
	    param kw : query-keyword to post data
	*/
	var postFormData = function(that,parms) {
		assert(arguments.length<=2, 'too many parms to postFormData');
		var $form = $(that).closest('form');
		var inp = $.extend({}, $.rdbHostConfig.opts, parms||{});
		inp.formId = $form.attr('id');
		assert(inp.formId,'form must have a unique id attribute');
		if (inp.q) {
			$form.find('#kw').remove();
			$form.find('#q').remove();
			$form.append($('<input type="hidden" id="q" name="q" >').val(inp.q));
		}
		if (inp.kw) {
			$form.find('#kw').remove();
			$form.find('#q').remove();
			$form.append($('<input type="hidden" id="kw" name="kw" >').val(inp.kw));
		}
		var sqlEngine = new SQLEngine(inp.userName, inp.authcode, inp.domain);
		delete inp.userName; delete inp.authcode; delete inp.domain;
		sqlEngine.queryByForm(inp);
		return true;
	};
	$.postFormData = postFormData;

	/*
	    postData submits some data (in the options object) to the server
	      and provides the response to callback.
	
	    param q : query to post data
	    param kw : query-keyword to post data
	*/
	var postData = function(parms) {
		assert(arguments.length<2, 'too many parms to postData');
		var inp = $.extend({}, $.rdbHostConfig.opts, parms||{});
		var sqlEngine = new SQLEngine(inp.userName, inp.authcode, inp.domain);
		delete inp.userName; delete inp.authcode; delete inp.domain;
		sqlEngine.query(inp);
		return true;
	};
	$.postData = postData;

	/*
	    populateTable creates an html table and inserts into  page

	    param q : query to get data
	*/
	var populateTable = function(parms) {
		assert(arguments.length<=1, 'too many parms to populateTable');
		var $selset = this;
		if (typeof(parms) === 'string') {
			parms = { 'q' : parms };
		}
		function populate_html_table($table,$row,recs) {
			var rec, $newrow;
			$table.find('tbody').empty();
			for (var r in recs) {
				rec = recs[r];
				$newrow = $row.clone().show();
				var ctr = 0, flds = [];
				for (var fname in rec) {
					$newrow.find('td.'+fname).html(rec[fname]);
					ctr += $newrow.find('td.'+fname).length;
					flds.push(fname);
				}
				assert(ctr,'no td elements found with field names! '+flds.join(', '));
				$table.append($newrow);
			}
		}
		function generate_html_table($table,recs) {
			var rec, $row, $td, fld;
			for (var r in recs) {
				rec = recs[r];
				$row = $('<tr>');
				for (var o in rec) {
					fld = rec[o];
					$td = $('<td>').html(fld);
					$row.append($td);
				}
				$table.append($row);
			}
		}
		function cback (json) {
			var recs = json.records.rows;
			$selset.each( function () {
				var $table = $(this);
				assert( !$table.is('form'), 'use .populateForm for forms' );
				if (!$table.is('table')) {
					$table.empty().append('<table><tbody></tbody></table>');
					$table = $table.find('table');
					generate_html_table($table,recs);
				}
				else if ( $table.find('tbody tr:first').length ) {
					var $row = $table.find('tbody tr:first').hide();
					populate_html_table($table,$row,recs);
				}
				else {
					generate_html_table($table,recs);					
				}
			});
		}
		parms.callback = cback;
		$.withResults(parms);
		return $selset;
	};
	$.fn.populateTable = populateTable;
	
	/*
	    populateForm populates a form with a single record
	    
	    param q : query to get data
	*/
	var populateForm = function(parms) {
		assert(arguments.length<=1, 'too many parms to populateForm');
		var $selset = this;
		if (typeof(parms) === 'string') {
			parms = { 'q' : parms };
		}
		function populate_form($form,rec) {
			for (var f in rec) {
				var $inp = $form.find('input#'+f);
				if ($inp.length) {
					$inp.val(rec[f]);
				}
				else {
					$inp = $form.find('input.'+f);
					$inp.val(rec[f]);
				}
			}
		}
		function cback (json) {
			if (json.records.rows.length) {
				var rec = json.records.rows[0];
				$selset.each( function () {
					var $form = $(this);
					assert( $form.is('form'), 'use .populateForm on a form' );
					populate_form($form,rec);
				});
			}
		}
		parms.callback = cback;
		$.withResults(parms);
		return $selset;
	};
	$.fn.populateForm = populateForm;
	
	/*
	    datadump puts a <pre>-formatted json dump into the html
	
	    param q : query to get data
	    param kw : query-keyword to get data
	*/
	var datadump = function(parms) {
		var $selset = this;
		if (typeof(parms) === 'string') {
			parms = { 'q' : parms };
		}
		function cback (json) {
			$selset.each( function () {
				$(this).html(JSON.stringify(json,null,4)); // 4 space indent
			});
		}
		parms.callback = cback;
		$.withResults(parms);
		return $selset;
	};
	$.fn.datadump = datadump;
		
}(jQuery,this));


/* create assert function
  example : assert( obj === null, 'object was not null!' );
  error message appears in javascript console, if any.
  credit to: Ayman Hourieh http://aymanh.com/
*/
function AssertException(message) { this.message = message; }
AssertException.prototype.toString = function () {
  return 'AssertException: ' + this.message;
};
function assert(exp, message) {
  if (!exp) {
    throw new AssertException(message);
  }
}


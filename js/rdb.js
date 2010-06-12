

// to add hidden field to form
function add_hidden_field($form,nm,val) {
	var fld = $('<input type="hidden" class="to-remove-later" />');
	fld.attr('name',nm).val(val);
	$form.append(fld);
};


// SQL Engine that uses form for input, and hidden iframe for response
//   handles file fields
//
function SQLEngine(uName,authcode,subdomain)
{
	// store engine config info
	this.format = 'json';
	this.userName = uName;
	this.authcode = authcode;
	this.subdomain = subdomain || 'rdbhost';
	
	this.getQueryUrl = function() {
		var proto = window.location.protocol;
		var hparts = window.location.hostname.split('.').slice(-2);
		hparts.unshift(this.subdomain);
		return proto+'//'+hparts.join('.')+'/db/'+this.userName;
	}
	this.getCommonDomain = function() {
		var hparts = window.location.hostname.split('.').slice(-2);
		return hparts.join('.');
	}

	this.query = function(parms) //callback,errback,query,args,argtypes)
	// parms is object containing various options
	//  callback : function to call with data from successfull query
	//  errback : function to call with error object from query failure
	//  query : the query string itself
	//  args : array of arguments (optional), must correspond with %s tokens
	//          in query
	//  argtypes : array of python DB API types, one per argument
	//  plainTextJson : true if JSON parsing to be skipped, in lieu of
	//           returning the JSON plaintext
	{
		var callback = parms['callback']
		var errback = parms['errback'];
		var query = parms['q'];
		var kw = parms['kw'];
		var args = parms['args'] || [];
		var argtypes = parms['argtypes'] || [];
		var plainText = parms['plainTextJson'];
		
		// local callbacks to do cleanup prior to 'real' callback
		function qErrback() {
			// if frame loaded by 'back button', skip over it
			if (!iframe_requested)
				parent.history.back();
			iframe_requested = false;
			$hiddenform.empty();
			errback(arguments);
		}
		function qCallback(json) {
			// if frame loaded by 'back button', skip over it
			if (!iframe_requested)
				parent.history.back();
			iframe_requested = false;
			$hiddenform.empty();
			callback(json);
		}
		var $this = this;
		// create hidden form if necessary
		var formId = 'rdb_hidden_form_rdb_hidden_form_rdb';
		var $hiddenform = $('#'+formId);
		var iframe_requested = false;
		if ( $hiddenform.length < 1 ) {
			var $newform = $(('<form method="post" name="~~id~~" id="~~id~~"'+
							  ' enctype="multipart/form-data" style="display:none">'+
							  ' </form>').replace(/~~id~~/g,formId));
			$('body').append($newform);
			$hiddenform = $('#'+formId);
		}
		// put query in hidden form
		add_hidden_field($hiddenform,'q',query);
		add_hidden_field($hiddenform,'kw',kw);
		// if params are provided, convert to named form 'arg000', 'arg001'...
		if (args != undefined) {
			for ( var i=0; i<args.length; i++ ) {
				var num = '000'+i;
				var nm = 'arg'+num.substr(num.length-3);
				add_hidden_field($hiddenform,nm,args[i]);
			}
		}
		// remove submit handler, if one already, and bind new handler
		$hiddenform.unbind('submit');
		$hiddenform.submit(function () {
			iframe_requested = true;
			var res = $this.queryByForm(formId,qCallback,qErrback,plainText);
			return res;
		});
		// submit the hidden form
		$hiddenform.submit();
	}
	
	this.queryByForm = function(formId,callback,errback,plainTextJson)
	// formId : id of form with query params
	//  callback is function to call with json if success
	//  errback (optional) is function to call with error
	//  plainTextJson indicates to return Json as text, not parsed (default false) 
	{
		var $this = this;
		var targettag = 'upload_target';
		// get form, return if not found
		var $form = $('#'+formId);
		if ($form.length<1) {
			alert('form '+formId+' not found');
			return false;
		};
		// define default errback
		if (errback === undefined) {
			errback = function () {
				var arg2 = Array.apply(null,arguments);
				alert(arg2.join(', '));
			}
		}

		// function to handle json when loaded		
		function results_loaded(callback,errback) {
			//
			var $fr = $(frames[targettag].document);
			try {
				frames[targettag].document.domain = $this.getCommonDomain();
			}
			catch (err) {
				if ( /not set property 'dom/i.test(err.toString()) ) {
					errback('iframe error: check that format is "jsond" '+
							'and subdomain is set or "rdbhost"');
					return;
				}
				else {
					errback('iframe error: '+err.toString());
					return;
				}
			}
			if ($fr.length === 0) alert('target "~" iframe document not found'
									     .replace('~',targettag));
			var cont = $fr.find('body script').html();
			var json_result, stat;
			if ( cont ) {
				cont = cont.replace(/^\s*<pr[^>]+>/i,''); // remove opening pre
				cont = cont.replace(/<[/]pr[^>]+\s*>$/i,''); // remove end pre
				if (cont.substr(0,1)==='{') {
					if ( plainTextJson ) {
						callback(cont);
					}
					else {
						try {
							json_result = JSON.parse(cont);
						}
						catch(err) {
							errback('json err: '+err.toString());
							return;
						}
						if (json_result.status[0] === 'error') {
							errback(json_result.status[1],json_result.error[1]);
						}
						else {
							callback(json_result);
						};
					}
				}
				else {
					errback('not json');
				}
			}
			else {
				errback('no content');
			}
		}
		// function to cleanup after data recieved
		function cleanup_submit(formtag) {
			var $form = $('#'+formtag);
			$form.find('.to-remove-later').remove();
			$form.attr('target',target);  // restore saved target,action
			$form.attr('action',action);
			$('#'+targettag).empty();
		};
		// init vars
		var dbUrl =  this.getQueryUrl(); //"/db/" + this.userName;
		//dbUrl = "http://rdbhost.paginaswww.com/helloalert.html";
		var target = $form.attr('target'); // save vals
		var action = $form.attr('action');
		// put password into form
		add_hidden_field($form,'authcode', this.authcode);
		// set format, action, and target
		add_hidden_field($form,'format','jsond');
		$form.attr('target',targettag);
		$form.attr('action',dbUrl);
		// add hidden iframe to end of body
		var iframeTxt = '<iframe id="~tt~" name="~tt~" src="" style="display:none;" ></iframe>';
		if ( $('#'+targettag).length === 0 ) {
			iframeTxt = iframeTxt.replace(/~tt~/g,targettag);
			$('body').append($(iframeTxt));
			// bind action functions to hidden iframe
			$('#'+targettag).load(function() {
				results_loaded(callback,errback);
				cleanup_submit(formId);
			});
		}
		var winDomain = window.document.domain;
		window.document.domain = this.getCommonDomain();
		//alert('new windocdom: '+window.document.domain);
		return true;
	};

	this.queryAjax = function(callback,errback,query,args,argtypes)
	{
		var result;
		var json_result;
		var result;
		if ( typeof(errback) !== 'function' ) {
			argypes = args;
			args = query;
			query = errback;
			errback = alert;
		}

		var dbUrl =  this.getQueryUrl(); //"/db/" + this.userName;

		var params = {	q: query,
						authcode: this.authcode,
						format:this.format,
						u: this.userName	};
		// if params are provided, convert to named form 'arg000', 'arg001'...
		if (args != undefined) {
			for ( var i=0; i<args.length; i++ ) {
				num = '000'+i;
				nm = 'arg'+num.substr(num.length-3);
				val = args[i];
				params[nm] = val;
			}
		}
		$.ajax({
			type: "POST",
			url: dbUrl,
			data: params,
			async: true,
			dataType: "json",
			success: function(json_result,stat,XHR) {
				var result;
				if (json_result === null || json_result === ''
					                    || json_result === undefined) {
					result = {status:['error','Incomplete result'],
							  error:['error','Recieved an empty response or timeout occured.']};
					errback(result.status[1]);
				}
				else {
					if (json_result.status[0] == 'error') {
						errback(json_result.status[1]);
						return;
					}
					else {
						result = new Array();
						if (json_result.row_count[0] != 0) {
							for (var i in json_result.records.rows) {
								result.push(json_result.records.rows[i]);
							}
						}
						callback(result)
					}
				}
			},
			error : function(XHR,stat,err) {
				if ( errback ) {
					errback(stat);
				}
				else {
					alert('error: '+stat);
				}
			}
		});
	}
	
} // end of SQLEngine class



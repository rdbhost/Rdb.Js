

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

	this.query = function(callback,errback,query,args,argtypes)
	{
		if ( typeof(errback) !== 'function' ) {
			argypes = args;
			args = query;
			query = errback;
			errback = alert;
		}
		var dbUrl =  "/db/" + this.userName;

		var params = {	q: query,
						authcode: this.authcode,
						format: this.format,
						u: this.userName	};
		// if params are provided, convert to named form 'arg000', 'arg001'...
		var num, nm, val,
			params = {};
		if (args != undefined) {
			for ( var i=0; i<args.length; i++ ) {
				num = '000'+i;
				nm = 'arg'+num.substr(num.length-3);
				val = args[i];
				params[nm] = val;
			}
		}
		// create hidden form, put vars in it.
		var $formId = '';
		// ...
		
		this.
		
	}
	
	this.queryAjax = function(callback,errback,query,args,argtypes)
	{
		var result;
		var json_result;
		var result;
		if ( ! errback ) errback = alert;

		var dbUrl =  "/db/" + this.userName;

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
	
	this.queryByForm = function(callback,errback,formId)
	{
		var targettag = 'upload_target';
		// get form, return if not found
		var $form = $('#'+formId);
		if ($form.length<1) {
			alert('form '+formId+' not found');
			return false;
		};
		// to add hidden field to form
		function add_hidden_field(nm,val) {
			var fld = $('<input type="hidden" class="to-remove-later" />');
			fld.attr('name',nm).val(val);
			$form.append(fld);
		};
		// define default errback
		if (errback === undefined) errback = alert;

		// function to handle json when loaded		
		function results_loaded(callback,errback) {
			//
			var $fr = $(frames[targettag].document);
			if ($fr.length === 0) alert('target "~" iframe document not found'
									     .replace('~',targettag));
			var $fr1 = $fr.find('body')
			var cont = $fr1.html();
			var json_result, stat;
			if ( cont ) {
				cont = cont.replace(/^\s*<pr[^>]+>/i,''); // remove opening pre
				cont = cont.replace(/<[/]pr[^>]+\s*>$/i,''); // remove end pre
				if (cont.substr(0,1)==='{') {
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
		};
		// init vars
		var dbUrl =  "/db/" + this.userName;
		var target = $form.attr('target'); // save vals
		var action = $form.attr('action');
		// put username, password into form
		add_hidden_field('u','');
		add_hidden_field('authcode', this.authcode);
		// set format, action, and target
		add_hidden_field('format','json');
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
		return true;
	};
}



define(function(require) {
	var $ = require('jquery'),
        _ = require('lodash'),
		monster = require('monster');

	var app = {
		requests: {},

		subscribe: {
			'callflows.fetchActions': 'afterbridgeDefineActions'
		},

		afterbridgeDefineActions: function(args) {
			var self = this,
				callflow_nodes = args.actions,
                hideCallflowAction = args.hideCallflowAction,
				afterBridgeTransfer = args.afterBridgeTransfer;

			// function to determine if an action should be listed
			var determineIsListed = function(key) {
				return !(hideCallflowAction.hasOwnProperty(key) && hideCallflowAction[key] === true);
			};

            var actions = {
				'after_bridge[action=park]': {
					name: self.i18n.active().callflows.after_bridge.park.nodeName,
					icon: 'minus_circle',
					category: self.i18n.active().callflows.after_bridge.category,
					module: 'after_bridge',
					tip: self.i18n.active().callflows.after_bridge.park.tooltip,
					data: {
						action: 'park',
						data: true
					},
					rules: [
						{
							type: 'quantity',
							maxSize: '1'
						}
					],
					isUsable: 'true',
					isListed: determineIsListed('after_bridge[action=park]'),
					weight: 48,
					caption: function(node, caption_map) {
						return '';
					},
					edit: function(node, callback) {
						var popup_html = $(self.getTemplate({
								name: 'warningDialog',
								data: {},
								submodule: 'afterbridge'
							})),
							popup;
		
						$('#ok', popup_html).click(function() {
							if (typeof callback === 'function') {
								callback();
							}
							popup.dialog('close');
						});
			
						popup = monster.ui.dialog(popup_html, {
							title: self.i18n.active().callflows.after_bridge.park.nodeName,
							minHeight: '0',
							beforeClose: function() {
								if (typeof callback === 'function') {
									callback();
								}
							}
						});
					}
				},
				'after_bridge[action=transfer]': {
					name: self.i18n.active().callflows.after_bridge.transfer.nodeName,
					icon: 'check_circle',
					category: self.i18n.active().callflows.after_bridge.category,
					module: 'after_bridge',
					tip: self.i18n.active().callflows.after_bridge.transfer.tooltip,
					data: {
						action: 'transfer',
						data: false
					},
					rules: [
						{
							type: 'quantity',
							maxSize: '1'
						}
					],
					isUsable: 'true',
                    isListed: determineIsListed('after_bridge[action=transfer]'),
					weight: 48,
					caption: function(node, caption_map) {
						return node.getMetadata('data') || '';
					},
					edit: function(node, callback) {
						var action = node.getMetadata('action'),
							number = node.getMetadata('data');

						// Set numberLength to null or undefined if afterBridgeTransfer.numberLength is not set
    					var numberLength = afterBridgeTransfer.numberLength !== undefined ? afterBridgeTransfer.numberLength : null;

						var popup_html = $(self.getTemplate({
								name: 'transferDialog',
								data: {
									action: action,
									number: number || '',
									numberLength: numberLength 
								},
								submodule: 'afterbridge'
							})),
							popup;

						// enable or disable the save button based on the input value
						function toggleSaveButton() {
							var inputValue = $('#after-bridge-number', popup_html).val();
							
							if (Array.isArray(afterBridgeTransfer.denyNumbers) && afterBridgeTransfer.denyNumbers.includes(inputValue)) {
								$('#after-bridge-number', popup_html).val('');
								monster.ui.alert('warning', self.i18n.active().callflows.after_bridge.transfer.denyNumbers + afterBridgeTransfer.denyNumbers);
								$('#add', popup_html).prop('disabled', true);
							} else if (inputValue == '') {
								$('#add', popup_html).prop('disabled', true);
							} else {
								$('#add', popup_html).prop('disabled', false);
							}
						}

						toggleSaveButton();

						$('#after-bridge-number', popup_html).change(toggleSaveButton);

						$('#add', popup_html).click(function() {
							var number = $('#after-bridge-number').val(),
								caption = '';

							if(!number) {
								number = false
							} else {
								caption = number;
							}

							node.setMetadata('data', number);
							node.caption = caption;
							if (typeof callback === 'function') {
								callback();
							}

							popup.dialog('close');
						});

						popup = monster.ui.dialog(popup_html, {
							title: self.i18n.active().callflows.after_bridge.transfer.dialog_title,
							minHeight: '0',
							beforeClose: function() {
								if (typeof callback === 'function') {
									callback();
								}
							}
						});						
					}
				},
				'after_bridge[action=hangup]': {
					name: self.i18n.active().callflows.after_bridge.hangup.nodeName,
					icon: 'x_circle',
					category: self.i18n.active().callflows.after_bridge.category,
					module: 'after_bridge',
					tip: self.i18n.active().callflows.after_bridge.hangup.tooltip,
					data: {
						action: 'hangup',
						data: true
					},
					rules: [
						{
							type: 'quantity',
							maxSize: '1'
						}
					],
					isUsable: 'true',
                    isListed: determineIsListed('after_bridge[action=hangup]'),
					weight: 48,
					caption: function(node, caption_map) {
						return '';
					},
					edit: function(node, callback) {
						var popup_html = $(self.getTemplate({
								name: 'warningDialog',
								data: {},
								submodule: 'afterbridge'
							})),
							popup;
		
						$('#ok', popup_html).click(function() {
							if (typeof callback === 'function') {
								callback();
							}
							popup.dialog('close');
						});
			
						popup = monster.ui.dialog(popup_html, {
							title: self.i18n.active().callflows.after_bridge.hangup.nodeName,
							minHeight: '0',
							beforeClose: function() {
								if (typeof callback === 'function') {
									callback();
								}
							}
						});
					}
				}

			}

			$.extend(callflow_nodes, actions);

		}

	};

	return app;
});
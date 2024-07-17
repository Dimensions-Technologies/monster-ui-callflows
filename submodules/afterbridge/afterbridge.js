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
                hideCallflowAction = args.hideCallflowAction;

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
						self.afterbridgeShowWarningDialog(node, callback);
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
						self.afterbridgeTransferEdit(node, callback);
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
						self.afterbridgeShowWarningDialog(node, callback);
					}
				}

			}

			$.extend(callflow_nodes, actions);

		},

        afterbridgeShowWarningDialog: function (node, callback) {
			var self = this,
				$popup,
				$dialog;

			$dialog = $(self.getTemplate({
				name: 'warningDialog',
				data: {},
				submodule: 'afterbridge'
			}));

			$popup = monster.ui.dialog($dialog, {
				title: self.i18n.active().callflows.after_bridge.warning_dialog.title,
				minHeight: '0',
				width: 400,
				beforeClose: function() {
					if (typeof callback === 'function') {
						callback();
					}
				}
			});

			$dialog.find('.js-confirm').click(function() {
				if (typeof callback === 'function') {
					callback();
				}
				$popup.dialog('close');
			});

		},

		afterbridgeTransferEdit: function (node, callback) {
			var self = this,
				$popup,
				$dialog,
				action = node.getMetadata('action'),
				number = node.getMetadata('data');

			$dialog = $(self.getTemplate({
				name: 'transferDialog',
				data: {
					action: action,
					number: number || ''
				},
				submodule: 'afterbridge'
			}));

			$popup = monster.ui.dialog($dialog, {
				title: self.i18n.active().callflows.after_bridge.transfer.dialog_title,
				minHeight: '0',
				width: 400,
				beforeClose: function() {
					if (typeof callback === 'function') {
						callback();
					}
				}
			});

			$dialog.find('.js-save').click(function() {
				var number = $('#after-bridge-number').val();
				var caption = '';

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

				$popup.dialog('close');
			});

		}

	};

	return app;
});
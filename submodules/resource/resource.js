define(function(require) {
	var $ = require('jquery'),
		_ = require('lodash'),
		monster = require('monster');

	var app = {
		requests: {},

		subscribe: {
			'callflows.fetchActions': 'resourceDefineActions'
		},

		resourceDefineActions: function(args) {
			var self = this,
				callflow_nodes = args.actions,
				hideCallflowAction = args.hideCallflowAction;

			// function to determine if an action should be listed
			var determineIsListed = function(key) {
				return !(hideCallflowAction.hasOwnProperty(key) && hideCallflowAction[key] === true);
			};

			var actions = {
				'offnet[]': {
					name: self.i18n.active().callflows.resource.global_carrier,
					icon: 'offnet',
					google_icon: 'cell_tower',
					category: self.i18n.active().oldCallflows.advanced_cat,
					module: 'offnet',
					tip: self.i18n.active().callflows.resource.global_carrier_tip,
					data: {},
					rules: [
						{
							type: 'quantity',
							maxSize: '0'
						}
					],
					isTerminating: 'true',
					isUsable: 'true',
					isListed: determineIsListed('offnet[]'),
					weight: 140,
					caption: function(node) {
						return '';
					},
					edit: function(node, callback) {
						if (typeof callback === 'function') {
							callback();
						}
					}
				},
				'resources[]': {
					name: self.i18n.active().callflows.resource.account_carrier,
					icon: 'resource',
					google_icon: 'cell_tower',
					category: self.i18n.active().oldCallflows.advanced_cat,
					module: 'resources',
					tip: self.i18n.active().callflows.resource.account_carrier_tip,
					data: {},
					rules: [
						{
							type: 'quantity',
							maxSize: '0'
						}
					],
					isTerminating: 'true',
					isUsable: 'true',
					isListed: determineIsListed('resources[]'),
					weight: 150,
					caption: function(node) {
						return '';
					},
					edit: function(node, callback) {
						var popup, popup_html;

						popup_html = $(self.getTemplate({
							name: 'account_carrier',
							data: {
								data_resource: {
									'hunt_account_id': node.getMetadata('hunt_account_id') || ''
								}
							},
							submodule: 'resource'
						}));

						// enable or disable the save button based on the input value
						function toggleSaveButton() {
							var inputValue = $('#hunt_account_id', popup_html).val();
							
							if (inputValue == '') {
								$('#add', popup_html).prop('disabled', true);
							} else {
								$('#add', popup_html).prop('disabled', false);
							}
						}

						toggleSaveButton();

						$('#hunt_account_id', popup_html).change(toggleSaveButton);

						$('#add', popup_html).click(function() {
							var hunt_id = $('#hunt_account_id', popup_html).val();

							if (hunt_id) {
								node.setMetadata('hunt_account_id', hunt_id);
							}

							popup.dialog('close');
						});

						popup = monster.ui.dialog(popup_html, {
							title: self.i18n.active().callflows.resource.account_carrier_title,
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

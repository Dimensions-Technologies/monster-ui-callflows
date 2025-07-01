define(function(require) {
	var $ = require('jquery'),
		_ = require('lodash'),
		monster = require('monster');

	var app = {
		requests: {},

		subscribe: {
			'callflows.fetchActions': 'aiAgentDefineActions'
		},

		aiAgentDefineActions: function(args) {
			var self = this,
				callflow_nodes = args.actions,
				hideCallflowAction = args.hideCallflowAction

			// Function to determine if an action should be listed
			var determineIsListed = function(key) {
				return !(hideCallflowAction.hasOwnProperty(key) && hideCallflowAction[key] === true);
			};

			var actions = {
			'ai_agent[]': {
					name: self.i18n.active().callflows.ai_agent.name,
					icon: 'user',
					google_icon: 'ai_agent',
					category: self.i18n.active().oldCallflows.advanced_cat,
					module: 'ai_agent',
					tip: self.i18n.active().callflows.ai_agent.tip,
					data: {
						text: ''
					},
					rules: [
						{
							type: 'quantity',
							maxSize: '1'
						}
					],
					isUsable: 'true',
					isListed: determineIsListed('ai_agent[]'),
					weight: 45,
					caption: function(node) {
						return '';
					},
					edit: function(node, callback) {
						var popup, popup_html;

						popup_html = $(self.getTemplate({
							name: 'ai_agent',
							data: {
								data_ai: {
									'prompt': node.getMetadata('prompt')
								}
							},
							submodule: 'ai_agent'
						}));

						monster.ui.tooltips(popup_html);

						// enable or disable the save button based on the input value
						function toggleSaveButton() {
							var inputValue = $('#ai_text_input', popup_html).val();

							if (inputValue == '') {
								$('#add', popup_html).prop('disabled', true);
							} else {
								$('#add', popup_html).prop('disabled', false);
							}
						}

						toggleSaveButton();

						$('#ai_text_input', popup_html).change(toggleSaveButton);

						$('#add', popup_html).click(function() {
							var setData = function(field, value) {
								if (value !== 'default') {
									node.setMetadata(field, value);
								} else {
									node.deleteMetadata(field);
								}
							};


							setData('prompt', $('#ai_text_input', popup_html).val());
							popup.dialog('close');
						});

						popup = monster.ui.dialog(popup_html, {
							title: self.i18n.active().callflows.ai_agent.title,
							beforeClose: function() {
								if (typeof callback === 'function') {
									callback();
								}
							}
						});
					}
				},
			};

			$.extend(callflow_nodes, actions);
		}
	};

	return app;
});